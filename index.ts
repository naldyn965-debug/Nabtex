// supabase/functions/payment-request-push/index.ts
//
// نداء عام (بدون Supabase auth) — بيتنادى من academy-data.js لحظة ما
// الطالب يبعت طلب دفع، وبيبعت push notification حقيقي لتوكنات الأدمن
// المسجّلة في Firestore (admin_config/notifications.tokens)، عشان
// تحس بالطلب حتى لو الموقع قافل عندك تمامًا.
//
// الهدف مقصود إنه ثابت (توكنات الأدمن بس) — مفيش أي uid بييجي من
// الكلاينت بيقدر يوجّه الإشعار لمكان تاني، فأقصى ضرر ممكن لطلب
// مزيّف هو إشعار وهمي، مش تسريب أو استهداف حساب حد.
//
// ── الإعداد (مرة واحدة) ──────────────────────────────────────────
// 1) عندك Service Account JSON لمشروع Firebase (نفس اللي مستخدم في
//    academy-broadcast-push على الأغلب — لو اتعمل له rotation قبل
//    كده حسب سجل المحادثات، استخدم النسخة الحالية بعد الـ rotation):
//      supabase secrets set FIREBASE_SERVICE_ACCOUNT='<PASTE_JSON_HERE>'
//
// 2) الدالة دي المفروض متتنادَاش من طالب مسجّل دخول بحساب Supabase —
//    هي بتتنادى بـ fetch عادي من المتصفح فقط، فلازم تتنشر بدون
//    التحقق من الـ JWT بتاع Supabase نفسه (نفس المشكلة اللي واجهتها
//    قبل كده مع academy-broadcast-push):
//      supabase functions deploy payment-request-push --no-verify-jwt
//
// 3) تأكد إن admin_config/notifications موجود في Firestore وفيه
//    tokens array — بيتملى أوتوماتيك أول ما تدوس زرار "🔔 إشعارات
//    الدفع" في admin.html.

import { initializeApp, cert, getApps } from "npm:firebase-admin@12/app";
import { getFirestore } from "npm:firebase-admin@12/firestore";
import { getMessaging } from "npm:firebase-admin@12/messaging";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function initFirebaseAdmin() {
  if (getApps().length) return;
  const raw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT");
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT secret is not set");
  const serviceAccount = JSON.parse(raw);
  initializeApp({ credential: cert(serviceAccount) });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  try {
    initFirebaseAdmin();

    const body = await req.json().catch(() => ({}));
    const courseLabel = String(body?.courseLabel || "").trim();
    const amount = body?.amount;
    const docId = String(body?.docId || "").trim();

    if (!courseLabel || !docId) {
      return new Response(JSON.stringify({ error: "missing courseLabel or docId" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const db = getFirestore();
    const snap = await db.collection("admin_config").doc("notifications").get();
    const tokens: string[] = (snap.exists && snap.data()?.tokens) || [];

    if (!tokens.length) {
      return new Response(
        JSON.stringify({ pushSent: 0, errors: ["no admin tokens registered — افتح admin.html ودوس زرار إشعارات الدفع"] }),
        { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
      );
    }

    const amountText = amount ? `${amount} جنيه` : "";
    const messaging = getMessaging();
    const res = await messaging.sendEachForMulticast({
      tokens,
      notification: {
        title: "💳 طلب دفع جديد",
        body: amountText ? `${courseLabel} — ${amountText}` : courseLabel,
      },
      data: {
        type: "payment_request",
        docId,
        courseLabel,
      },
      webpush: {
        fcmOptions: { link: "/admin.html" },
      },
    });

    const errors = res.responses
      .map((r, i) => (r.success ? null : `${tokens[i].slice(0, 12)}…: ${r.error?.message || "unknown"}`))
      .filter(Boolean) as string[];

    // Prune tokens Firebase reports as dead (unregistered/invalid) so the
    // admin_config doc doesn't accumulate stale tokens over time.
    const deadTokens = res.responses
      .map((r, i) => (!r.success && (r.error?.code === "messaging/registration-token-not-registered" || r.error?.code === "messaging/invalid-registration-token") ? tokens[i] : null))
      .filter(Boolean) as string[];
    if (deadTokens.length) {
      await db.collection("admin_config").doc("notifications").update({
        tokens: tokens.filter((t) => !deadTokens.includes(t)),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ pushSent: res.successCount, errors }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[payment-request-push]", e);
    return new Response(JSON.stringify({ error: String((e as Error)?.message || e) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
