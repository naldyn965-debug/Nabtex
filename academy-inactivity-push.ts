// ═══════════════════════════════════════════════════════════════════
// Nabtex Academy — automated inactivity win-back push
// ═══════════════════════════════════════════════════════════════════
//
// Runs once a day (schedule it with Supabase Cron — see the setup
// checklist doc alongside this file). This is the ONLY server-side
// piece of the academy-notifications feature: new_course / admin
// broadcasts are sent manually from admin.html and need no server
// code at all.
//
// What it does, each run:
//   1. Get a Google OAuth2 access token for a service account (kept in
//      Supabase Vault, never in client code).
//   2. Query Firestore (REST API) for users whose `lastActiveAt` in the
//      Academy is >7 days old.
//   3. Skip anyone muted, or already nudged in the last 7 days, or
//      unlicensed (no academy_progress => never really started Academy,
//      lastActiveAt would never be set for them anyway).
//   4. Look up their most relevant in-progress course + % done.
//   5. Send a personalised push via the FCM HTTP v1 API to every device
//      token on their profile (data-only payload — sw.js builds the
//      visible notification and owns the click → deep-link behaviour).
//   6. Write back `lastInactivityPushAt` (caps re-sends) and create the
//      matching `academy_notifications` doc so the in-app bell shows it
//      too, exactly like a push that never arrived (offline device,
//      permission not granted, etc.) still would.
//
// Nothing here touches marketplace_notifications, mktState, or any
// existing academy client code — it only ever reads/writes:
//   users/{uid}                (lastActiveAt read, lastInactivityPushAt
//                                + fcmTokens cleanup written)
//   academy_progress/{uid}_*   (read only)
//   course_config/{courseId}   (read only — optional title/totalLessons)
//   academy_notifications      (create only, scope:'user')
//
// Deploy:  supabase functions deploy academy-inactivity-push --no-verify-jwt
// Secrets: supabase secrets set GCP_SERVICE_ACCOUNT_JSON='<...>' FIREBASE_PROJECT_ID='nabtex-b8475'
// (Full steps are in ACADEMY_NOTIFICATIONS_SETUP.md)
// ═══════════════════════════════════════════════════════════════════

import { GoogleAuth } from "npm:google-auth-library@9";

// ── Config ──────────────────────────────────────────────────────────
const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") ?? "nabtex-b8475";
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const FCM_SEND_URL = `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`;

const INACTIVITY_DAYS = 7;        // must be idle this long to qualify
const RENOTIFY_COOLDOWN_DAYS = 7; // guardrail: at most 1 nudge / user / rolling 7 days
const USER_QUERY_LIMIT = 300;     // see "Scaling" note near queryInactiveUsers()

// ── Copy (rotates so it doesn't feel canned; extend this list freely) ──
type Ctx = { name: string; pct?: number; course?: string; courseId?: string };
const VARIANTS: { needs: (keyof Ctx)[]; text: (c: Ctx) => string }[] = [
  { needs: ["name", "pct", "course"], text: (c) => `🌱 وحشتنا يا ${c.name}! لسه فاضل ${c.pct}% بس من ${c.course} — خطوة واحدة وهتكملها` },
  { needs: ["name"],                  text: (c) => `🎯 ${c.name}، رجّعلك تركيزك في دقيقتين: محاضرة واحدة وهتقرب من الشهادة` },
  { needs: ["course"],                text: (c) => `⏳ كتير من زمايلك في ${c.course} خلصوا الأسبوع ده — نفسنا نشوفك تكمل` },
];

// ── Firestore REST value <-> JS helpers ──────────────────────────────
// deno-lint-ignore no-explicit-any
function fsValue(v: any): any {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "string") return { stringValue: v };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(fsValue) } };
  return { stringValue: String(v) };
}
// deno-lint-ignore no-explicit-any
function fsFields(obj: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(obj)) out[k] = fsValue(obj[k]);
  return out;
}
// deno-lint-ignore no-explicit-any
function jsValue(v: any): any {
  if (!v) return null;
  if ("stringValue" in v) return v.stringValue;
  if ("integerValue" in v) return parseInt(v.integerValue, 10);
  if ("doubleValue" in v) return v.doubleValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("timestampValue" in v) return new Date(v.timestampValue);
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values || []).map(jsValue);
  if ("mapValue" in v) return jsDoc(v.mapValue.fields || {});
  return null;
}
// deno-lint-ignore no-explicit-any
function jsDoc(fields: Record<string, any>): Record<string, any> {
  const out: Record<string, any> = {};
  for (const k of Object.keys(fields || {})) out[k] = jsValue(fields[k]);
  return out;
}
function uidFromDocName(name: string): string {
  return name.substring(name.lastIndexOf("/") + 1);
}

// ── Auth ──────────────────────────────────────────────────────────────
async function getAccessToken(): Promise<string> {
  const raw = Deno.env.get("GCP_SERVICE_ACCOUNT_JSON");
  if (!raw) throw new Error("Missing secret: GCP_SERVICE_ACCOUNT_JSON");
  const credentials = JSON.parse(raw);
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/firebase.messaging",
    ],
  });
  const client = await auth.getClient();
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("Failed to mint an access token for the service account");
  return token.token;
}

// ── Firestore helpers ──────────────────────────────────────────────────
async function runQuery(token: string, structuredQuery: unknown) {
  const res = await fetch(`${FIRESTORE_BASE}:runQuery`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`Firestore runQuery failed: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  // deno-lint-ignore no-explicit-any
  return (rows as any[]).filter((r) => r.document).map((r) => r.document);
}

async function patchDoc(token: string, path: string, fields: Record<string, unknown>) {
  const mask = Object.keys(fields).map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`).join("&");
  const res = await fetch(`${FIRESTORE_BASE}/${path}?${mask}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: fsFields(fields) }),
  });
  if (!res.ok) throw new Error(`Firestore patch failed (${path}): ${res.status} ${await res.text()}`);
}

async function createDoc(token: string, collectionId: string, fields: Record<string, unknown>) {
  const res = await fetch(`${FIRESTORE_BASE}/${collectionId}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: fsFields(fields) }),
  });
  if (!res.ok) throw new Error(`Firestore create failed (${collectionId}): ${res.status} ${await res.text()}`);
}

// Scaling note: a single runQuery page is fine for hundreds of qualifying
// users. If this project grows past USER_QUERY_LIMIT inactive users in one
// day, add a `startAt` cursor loop here (Firestore REST supports it) —
// not built now since it'd be untested complexity for a scale this
// project isn't at yet.
async function queryInactiveUsers(token: string, cutoff: Date) {
  return runQuery(token, {
    from: [{ collectionId: "users" }],
    where: {
      fieldFilter: {
        field: { fieldPath: "lastActiveAt" },
        op: "LESS_THAN",
        value: { timestampValue: cutoff.toISOString() },
      },
    },
    limit: USER_QUERY_LIMIT,
  });
}

async function queryAcademyProgress(token: string, uid: string) {
  return runQuery(token, {
    from: [{ collectionId: "academy_progress" }],
    where: {
      fieldFilter: { field: { fieldPath: "uid" }, op: "EQUAL", value: { stringValue: uid } },
    },
    limit: 20,
  });
}

async function getCourseConfig(token: string, courseId: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${FIRESTORE_BASE}/course_config/${encodeURIComponent(courseId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const doc = await res.json();
  return jsDoc(doc.fields || {});
}

// ── Pick the course + % to reference, if any ───────────────────────────
async function pickContext(token: string, uid: string, name: string): Promise<Ctx> {
  const progressDocs = await queryAcademyProgress(token, uid);
  let best: { courseId: string; pct?: number; updatedAt: number } | null = null;

  for (const doc of progressDocs) {
    const data = jsDoc(doc.fields || {});
    const courseId = String(data.courseId || "");
    if (!courseId) continue;
    const doneCount = Array.isArray(data.d) ? data.d.length : 0;
    const updatedAt = typeof data.updatedAt === "number" ? data.updatedAt : 0;

    const cfg = await getCourseConfig(token, courseId);
    const total = cfg && typeof cfg.totalLessons === "number" ? cfg.totalLessons : null;
    const pct = total ? Math.round((doneCount / total) * 100) : undefined;

    if (total && pct !== undefined && pct >= 100) continue; // already finished — not a nudge target
    if (!best || updatedAt > best.updatedAt) best = { courseId, pct, updatedAt };
  }

  if (!best) return { name };
  const cfg = await getCourseConfig(token, best.courseId);
  const courseTitle = (cfg && typeof cfg.title === "string" && cfg.title) || best.courseId;
  return { name, pct: best.pct, course: courseTitle, courseId: best.courseId };
}

function composeMessage(ctx: Ctx, seedForRotation: string): string {
  const eligible = VARIANTS.filter((v) => v.needs.every((k) => ctx[k] !== undefined && ctx[k] !== ""));
  if (!eligible.length) return `🌱 وحشتنا يا ${ctx.name}! رجعلنا في نبتيكس أكاديمي`;
  // Deterministic-but-varied rotation (day + uid hash) — no extra state to track.
  let hash = 0;
  for (const ch of seedForRotation) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  const dayIndex = Math.floor(Date.now() / 86400000);
  const pick = eligible[(hash + dayIndex) % eligible.length];
  return pick.text(ctx);
}

// ── FCM send ────────────────────────────────────────────────────────────
async function sendPush(token: string, fcmToken: string, title: string, body: string, courseId?: string) {
  const res = await fetch(FCM_SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token: fcmToken,
        // Data-only (no top-level "notification") — sw.js's onBackgroundMessage
        // builds the visible notification and owns click → deep-link behaviour.
        data: { title, body, courseId: courseId || "" },
        webpush: { headers: { Urgency: "normal" } },
      },
    }),
  });
  if (res.ok) return { ok: true as const };
  const errText = await res.text();
  const invalid = res.status === 404 || /UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/i.test(errText);
  return { ok: false as const, invalid, errText };
}

// ── Main handler ────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  // Simple shared-secret guard so this can't be triggered by randoms if the
  // function URL leaks. Supabase Cron sends this header automatically when
  // configured with a secret — see the setup doc. Skipped harmlessly if the
  // secret isn't set (e.g. first manual test run).
  const expected = Deno.env.get("CRON_SECRET");
  if (expected && req.headers.get("x-cron-secret") !== expected) {
    return new Response("unauthorized", { status: 401 });
  }

  const stats = { scanned: 0, skippedMuted: 0, skippedCooldown: 0, notified: 0, pushSent: 0, pushFailed: 0, errors: [] as string[] };

  try {
    const token = await getAccessToken();
    const cutoff = new Date(Date.now() - INACTIVITY_DAYS * 86400000);
    const candidates = await queryInactiveUsers(token, cutoff);
    stats.scanned = candidates.length;

    for (const doc of candidates) {
      const uid = uidFromDocName(doc.name);
      try {
        const data = jsDoc(doc.fields || {});
        if (data.notifMuted === true) { stats.skippedMuted++; continue; }

        const lastPush = data.lastInactivityPushAt instanceof Date ? data.lastInactivityPushAt : null;
        if (lastPush && Date.now() - lastPush.getTime() < RENOTIFY_COOLDOWN_DAYS * 86400000) {
          stats.skippedCooldown++; continue;
        }

        const name = typeof data.name === "string" && data.name ? data.name : "صديقنا";
        const ctx = await pickContext(token, uid, name);
        const message = composeMessage(ctx, uid);

        // 1) In-app bell — always, regardless of push token availability.
        const notifFields: Record<string, unknown> = {
          scope: "user", userId: uid, type: "inactivity", message,
          read: false, createdAt: new Date(), source: "auto",
        };
        if (ctx.courseId) notifFields.courseId = ctx.courseId;
        await createDoc(token, "academy_notifications", notifFields);

        // 2) Push, to every registered device.
        const tokens: string[] = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
        const deadTokens: string[] = [];
        for (const t of tokens) {
          const r = await sendPush(token, t, "نبتيكس أكاديمي", message, ctx.courseId);
          if (r.ok) stats.pushSent++;
          else { stats.pushFailed++; if (r.invalid) deadTokens.push(t); }
        }

        // 3) Write back the cap timestamp (+ prune dead tokens found above).
        const patch: Record<string, unknown> = { lastInactivityPushAt: new Date() };
        if (deadTokens.length) patch.fcmTokens = tokens.filter((t) => !deadTokens.includes(t));
        await patchDoc(token, `users/${uid}`, patch);

        stats.notified++;
      } catch (innerErr) {
        stats.errors.push(`${uid}: ${(innerErr as Error).message}`);
      }
    }
  } catch (err) {
    stats.errors.push(`fatal: ${(err as Error).message}`);
    return new Response(JSON.stringify(stats), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(stats), { headers: { "Content-Type": "application/json" } });
});
