/**
 * Nabtex Arena — بروفايل اللاعب + الألقاب + الإنجازات (التحقق من نتيجة المباراة على الخادم)
 *
 * POST /api/arena-profile      Authorization: Bearer <Firebase ID token>
 *   body: { action: 'finalize', rid }   (rid = كود الغرفة، 6 خانات)
 *
 * ليه خادم؟ الـ Arena كلها شغّالة من العميل + firestore.rules، وقواعد Firestore مش قادرة تحسب نتيجة مباراة (حد 20 قراءة/طلب).
 * فالإنجازات والإحصائيات (arena_profiles) ما بتتكتبش من العميل نهائيًا: الخادم بيقرا بيانات الغرفة بصلاحية Admin
 * (pl / ans / k — إجابات بتوقيت السيرفر + مفاتيح الإجابة)، بيحسب النقاط بنفس معادلة arena.js (pts)،
 * وبيكتب كل حاجة في commit واحد ذرّي: marker للمباراة (arena_results/{rid}_{t0}) + بروفايل كل لاعب.
 * الـ marker create-only ⇒ المباراة الواحدة بتتحسب مرة واحدة بس مهما اتنادى الطلب (idempotent).
 *
 * - مفيش XP ولا أي مكافأة قابلة للاستبدال هنا: XP نظام الأكاديمية (xp_wallet) بيتقرا بس. الألقاب/الشارات تجميلية.
 * - الإعداد (مرة واحدة): Vercel → Settings → Environment Variables → FIREBASE_SERVICE_ACCOUNT = محتوى Service Account JSON
 *   (نفس المستخدم في Supabase functions). من غيره الخادم بيرد 503 والـ Arena بتفضل شغّالة عادي من غير تسجيل إنجازات.
 * - الأرقام لازم تطابق arena.js و firestore.rules (LEAD / QDUR / SLOT / NQ / BONUS).
 * للتراجع: امسح الملف ده وكتلة arena_profiles في firestore.rules ووظائف البروفايل في arena.js.
 *
 * ── المهام اليومية (DAILY-QUESTS) ──
 * POST { action: 'quests' }            → حالة مهام النهارده (قراءة بس — مفيش كتابة)
 * POST { action: 'claim', k: 'm|c|w' } → استلام مكافأة مهمة مكتملة
 * arena_quests/{uid}: d (يوم القاهرة YYYY-MM-DD) · ex (نهاية اليوم) · g/r/p/cl = [هدف، مكافأة XP، تقدّم، اتستلمت؟] للمهام m (مباريات) / c (إجابات صحيحة) / w (انتصارات).
 *   الكتابة من الخادم بس (Admin) والقواعد بتقفل أي وصول من العميل (default deny). التقدّم بيتزوّد جوه نفس commit تسجيل المباراة (marker create-only ⇒ المباراة بتتحسب مرة واحدة).
 *   الاستلام: commit واحد ذرّي = حدث xp_events/{uid}_aq_{yyyymmdd}_{k} (create-only) + xp_wallet (نفس محفظة الـ NBXP — مفيش محفظة جديدة) + علامة cl في arena_quests (شرط updateTime).
 *   اليوم = Africa/Cairo بتوقيت الخادم (Intl — بيراعي التوقيت الصيفي)، مش ساعة الجهاز. اللي ما اتستلمش قبل منتصف الليل بيضيع.
 * للتراجع: امسح كتلة DAILY-QUESTS هنا وسطور q في finalize، وكتلة المهام في arena.js، وارجع ?v في index.html.
 */
'use strict';
const crypto = require('crypto');

const FIREBASE_WEB_KEY = process.env.FIREBASE_API_KEY || 'AIzaSyDRR7TgaEvFdVwWNtftfT1a2oENYgUyxkM';   /* مفتاح Web عام أصلًا في index.html — للتحقق من توكن المستخدم بس */
const LOOKUP_URL = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=';
const FS_PROJECT = process.env.FIREBASE_PROJECT_ID || 'nabtex-b8475';
const FS_ROOT = 'projects/' + FS_PROJECT + '/databases/(default)/documents';
const FS_DOCS = 'https://firestore.googleapis.com/v1/' + FS_ROOT;

/* نفس أرقام arena.js / firestore.rules (arOpen/arClose) */
const LEAD = 5000, QDUR = 20000, SLOT = 26000, NQ = 10, BONUS = 50;
const END_GRACE = 1500;                  /* سماحية ساعة الخادم بعد قفل آخر سؤال */
const MIN_ACTIVE_ANSWERS = 3;            /* اللاعب «فعّال» = جاوب 3 أسئلة على الأقل */
const DAILY_CAP = 30;                    /* أقصى عدد مباريات بتتحسب للاعب في اليوم (حماية من التدوير) */
const FAST_MS = 3000, FAST_NEED = 5;     /* إنجاز «برق الحقل»: 5 إجابات صحيحة كل واحدة أقل من 3 ثواني في مباراة واحدة */
const RID_RE = /^[A-HJKMNP-Z2-9]{6}$/;

/* DAILY-QUESTS: k = m مباريات · c إجابات صحيحة · w انتصارات. g = الهدف، r = مكافأة XP. أي تعديل هنا بيسري على مهام اليوم الجديد بس (اللي اتولّد بيفضل بقيمه). */
const QUEST_TZ = 'Africa/Cairo';
const QUESTS = [{ k: 'm', g: 2, r: 10 }, { k: 'c', g: 10, r: 10 }, { k: 'w', g: 1, r: 15 }];
const QK = QUESTS.map(function (q) { return q.k; });
const MAX_QUEST_XP = 50;                /* سقف أمان لمكافأة المهمة الواحدة (بيتفحص على القيمة المخزّنة) */

/* كتالوج الإنجازات: id → شرط (بيتقيّم على نتيجة المباراة + الإجماليات بعد التحديث). نفس الـ ids في arena.js و firestore.rules */
const ACH = {
  first_match: function (c) { return c.m >= 1; },
  first_win:   function (c) { return c.w >= 1; },
  matches10:   function (c) { return c.m >= 10; },
  matches50:   function (c) { return c.m >= 50; },
  wins10:      function (c) { return c.w >= 10; },
  wins25:      function (c) { return c.w >= 25; },
  streak3:     function (c) { return c.bs >= 3; },
  streak5:     function (c) { return c.bs >= 5; },
  perfect:     function (c) { return c.cc === NQ; },
  speed:       function (c) { return c.fast >= FAST_NEED; },
  team_win:    function (c) { return c.team && c.won; }
};
const ACH_IDS = Object.keys(ACH);

/* ───────── helpers ───────── */
function send(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
function fail(res, status, error) { send(res, status, { error: error }); }
function readBody(req) {
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    if (typeof req.body === 'string') { try { return resolve(JSON.parse(req.body)); } catch (e) { return reject(new Error('bad_json')); } }
    const chunks = []; let size = 0;
    req.on('data', function (c) { size += c.length; if (size > 4096) { reject(new Error('too_large')); req.destroy(); } else chunks.push(c); });
    req.on('end', function () { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch (e) { reject(new Error('bad_json')); } });
    req.on('error', reject);
  });
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function b64u(buf) { return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

/* rate limit بسيط لكل مستخدم (best-effort على مستوى الـ instance) */
const hits = new Map();
function limited(uid) {
  const now = Date.now(), arr = (hits.get(uid) || []).filter(function (t) { return now - t < 60000; });
  if (arr.length >= 12) { hits.set(uid, arr); return true; }
  arr.push(now); hits.set(uid, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

async function verifyUser(idToken) {
  const ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 5000);
  try {
    const r = await fetch(LOOKUP_URL + encodeURIComponent(FIREBASE_WEB_KEY), { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: idToken }) });
    if (!r.ok) return null;
    const j = await r.json(), u = j && j.users && j.users[0];
    return u && u.localId ? { uid: String(u.localId), name: typeof u.displayName === 'string' ? u.displayName : '' } : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}

/* ───────── Admin access token (Service Account → OAuth2 JWT bearer) ───────── */
let saCache = null, tokCache = null;
function serviceAccount() {
  if (saCache !== null) return saCache || null;
  let raw = String(process.env.FIREBASE_SERVICE_ACCOUNT || '').trim();
  saCache = false;
  if (!raw) return null;
  try {
    if (raw.charAt(0) !== '{') raw = Buffer.from(raw, 'base64').toString('utf8');
    const j = JSON.parse(raw);
    if (j && j.client_email && j.private_key) saCache = { email: j.client_email, key: String(j.private_key).replace(/\\n/g, '\n') };
  } catch (e) { saCache = false; }
  return saCache || null;
}
async function adminToken() {
  if (tokCache && tokCache.exp - 60000 > Date.now()) return tokCache.v;
  const sa = serviceAccount();
  if (!sa) return '';
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64u(JSON.stringify({ iss: sa.email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
  let sig;
  try { sig = b64u(crypto.createSign('RSA-SHA256').update(head + '.' + claim).sign(sa.key)); } catch (e) { console.error('[arena-profile] bad service account key'); return ''; }
  const ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 6000);
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: ctl.signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=' + encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer') + '&assertion=' + head + '.' + claim + '.' + sig });
    if (!r.ok) { console.error('[arena-profile] token http ' + r.status); return ''; }
    const j = await r.json();
    if (!j.access_token) return '';
    tokCache = { v: j.access_token, exp: Date.now() + (parseInt(j.expires_in, 10) || 3000) * 1000 };
    return tokCache.v;
  } catch (e) { return ''; } finally { clearTimeout(t); }
}

/* ───────── Firestore REST ───────── */
function tsMs(s) {   /* بنفس دقة toMillis() في عميل Firebase (بما فيها الكسور) */
  const m = /^(.*?)(?:\.(\d+))?Z$/.exec(String(s));
  if (!m) return Date.parse(s);
  return Date.parse(m[1] + 'Z') + (m[2] ? parseFloat('0.' + m[2]) * 1000 : 0);
}
function fv(f) {
  if (!f) return null;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.integerValue !== undefined) return parseInt(f.integerValue, 10);
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.timestampValue) return tsMs(f.timestampValue);
  if (f.arrayValue) return (f.arrayValue.values || []).map(fv);
  if (f.mapValue) { const o = {}, m = f.mapValue.fields || {}; Object.keys(m).forEach(function (k) { o[k] = fv(m[k]); }); return o; }
  return null;
}
function fd(doc) { const o = {}, f = (doc && doc.fields) || {}; Object.keys(f).forEach(function (k) { o[k] = fv(f[k]); }); return o; }
const S = function (v) { return { stringValue: v }; };
const I = function (v) { return { integerValue: String(Math.max(0, Math.floor(v))) }; };
const TS = function (ms) { return { timestampValue: new Date(ms).toISOString() }; };
const AI = function (a) { return { arrayValue: { values: a.map(function (v) { return { integerValue: String(Math.max(0, Math.floor(v))) }; }) } }; };
const AB = function (a) { return { arrayValue: { values: a.map(function (v) { return { booleanValue: !!v }; }) } }; };

async function fs(path, opt, tok) {
  const ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 8000);
  try {
    const o = Object.assign({ signal: ctl.signal, headers: { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } }, opt || {});
    const r = await fetch(FS_DOCS + path, o);
    let j = null; try { j = await r.json(); } catch (e) { /* ignore */ }
    return { status: r.status, json: j };
  } catch (e) { return { status: 0, json: null }; } finally { clearTimeout(t); }
}
/* batchGet: name → {found doc | null}. بنقسّم لدفعات 100 */
async function batchGet(names, tok) {
  const out = {};
  for (let i = 0; i < names.length; i += 100) {
    const r = await fs(':batchGet', { method: 'POST', body: JSON.stringify({ documents: names.slice(i, i + 100).map(function (n) { return FS_ROOT + '/' + n; }) }) }, tok);
    if (r.status !== 200 || !Array.isArray(r.json)) return null;
    r.json.forEach(function (e) {
      if (e.found) out[e.found.name.slice(FS_ROOT.length + 1)] = e.found;
      else if (e.missing) out[e.missing.slice(FS_ROOT.length + 1)] = null;
    });
  }
  return out;
}

/* ───────── منطق المباراة ───────── */
function cairoDay(ms) { return Math.floor((ms + 7200000) / 86400000); }

/* نقاط لاعب في سؤال: نفس pts() في arena.js */
function ptsOf(a, key, t0, i) {
  if (!a || !key || a.c !== key.c) return { p: 0, el: 0, ok: false };
  const open = t0 + LEAD + i * SLOT;
  if (a.t < open || a.t >= open + QDUR) return { p: 0, el: 0, ok: false };   /* أمان زيادة: القواعد أصلًا بتمنع الإجابة برّه النافذة */
  const el = Math.max(0, Math.min(QDUR, a.t - open));
  return { p: 100 + Math.round(BONUS * (QDUR - el) / QDUR), el: el, ok: true };
}

function evaluate(room, players, ans, keys) {
  const t0 = room.t0, uids = Object.keys(players), res = {};
  uids.forEach(function (u) {
    const r = { s: 0, cc: 0, fast: 0, answered: 0 };
    for (let i = 0; i < NQ; i++) {
      const a = ans[u + '_' + i];
      if (a) r.answered++;
      const x = ptsOf(a, keys[i], t0, i);
      if (x.ok) { r.s += x.p; r.cc++; if (x.el < FAST_MS) r.fast++; }
    }
    r.active = r.answered >= MIN_ACTIVE_ANSWERS;
    res[u] = r;
  });
  const team = room.md === 't';
  const order = uids.slice().sort(function (a, b) { return (res[b].s - res[a].s) || (players[a].j - players[b].j); });
  order.forEach(function (u, i) { res[u].rank = i + 1; });
  const activeN = uids.filter(function (u) { return res[u].active; }).length;
  let tt = [0, 0], teamDraw = false, winTeam = -1;
  if (team) {
    uids.forEach(function (u) { tt[players[u].tm ? 1 : 0] += res[u].s; });
    teamDraw = tt[0] === tt[1]; winTeam = teamDraw ? -1 : (tt[0] > tt[1] ? 0 : 1);
  }
  const top = order.length ? res[order[0]].s : 0;
  uids.forEach(function (u) {
    const r = res[u];
    r.team = team; r.draw = team && teamDraw;
    r.won = r.active && (team ? (!teamDraw && (players[u].tm ? 1 : 0) === winTeam) : (top > 0 && r.s === top));
  });
  return { res: res, counted: activeN >= 2 };
}

/* ═════════ DAILY-QUESTS ═════════ */
/* يوم القاهرة (YYYY-MM-DD) من Intl — بيراعي التوقيت الصيفي المصري، ومش بيتأثر بتوقيت الجهاز/العملية (TZ). */
let dayFmt = null;
function cairoKey(ms) {
  if (!dayFmt) dayFmt = new Intl.DateTimeFormat('en-US', { timeZone: QUEST_TZ, calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: '2-digit', day: '2-digit' });
  const p = {};
  dayFmt.formatToParts(new Date(ms)).forEach(function (x) { p[x.type] = x.value; });
  return p.year + '-' + p.month + '-' + p.day;
}
/* أول لحظة بيتغيّر فيها يوم القاهرة بعد ms (بحث ثنائي — بيغطي يوم 23 ساعة/25 ساعة بتاع تغيير الساعة من غير أي افتراض ثابت) */
function cairoDayEnd(ms) {
  const k = cairoKey(ms);
  let lo = ms, hi = ms + 26 * 3600000;
  while (hi - lo > 1) {
    const mid = lo + Math.floor((hi - lo) / 2);
    if (cairoKey(mid) === k) lo = mid; else hi = mid;
  }
  return hi;
}
function isInt(v, lo, hi) { return typeof v === 'number' && v === Math.floor(v) && v >= lo && v <= hi; }
function all3(a, f) { return Array.isArray(a) && a.length === 3 && a.every(f); }
/* حالة مهام اليوم من الوثيقة المخزّنة (x = fd(doc) أو null). لو مفيش وثيقة لليوم ده أو شكلها مش سليم ⇒ حالة جديدة (stored:false) */
function questState(x, day, ex) {
  const fresh = { d: day, ex: ex, g: QUESTS.map(function (q) { return q.g; }), r: QUESTS.map(function (q) { return q.r; }), p: [0, 0, 0], cl: [false, false, false] };
  if (!x || x.d !== day) return { s: fresh, stored: false };
  if (!all3(x.g, function (v) { return isInt(v, 1, 1000); }) || !all3(x.r, function (v) { return isInt(v, 0, MAX_QUEST_XP); })
      || !all3(x.p, function (v) { return isInt(v, 0, 1000); }) || !all3(x.cl, function (v) { return typeof v === 'boolean'; })) return { s: fresh, stored: false };
  return { s: { d: day, ex: ex, g: x.g.slice(), r: x.r.slice(), p: x.p.map(function (v, i) { return Math.min(v, x.g[i]); }), cl: x.cl.slice() }, stored: true };
}
function questView(s) {
  return { d: s.d, ex: s.ex, t: QUESTS.map(function (q, i) { return { k: q.k, g: s.g[i], r: s.r[i], p: s.p[i], c: !!s.cl[i] }; }) };
}
/* زيادة التقدّم بعد مباراة اتحسبت. بترجّع { s, write } — write = null لو مفيش تغيير (مفيش كتابة ⇒ أقل تكلفة) */
function questApply(uid, doc, day, ex, delta, now) {
  const st = questState(doc ? fd(doc) : null, day, ex), s = st.s;
  const np = s.p.map(function (v, i) { return Math.min(s.g[i], v + delta[i]); });
  const changed = np.some(function (v, i) { return v !== s.p[i]; });
  s.p = np;
  if (!changed && st.stored) return { s: s, write: null };
  const name = FS_ROOT + '/arena_quests/' + uid;
  if (st.stored) {   /* نفس اليوم: بنعدّل p + lt بس (والـ cl سليمة) بشرط إن الوثيقة ما اتغيّرتش */
    const f = { p: AI(np), lt: TS(now) };
    return { s: s, write: { update: { name: name, fields: f }, updateMask: { fieldPaths: Object.keys(f) }, currentDocument: { updateTime: doc.updateTime } } };
  }
  const f = { d: S(day), ex: TS(ex), g: AI(s.g), r: AI(s.r), p: AI(np), cl: AB(s.cl), lt: TS(now) };   /* يوم جديد (أو وثيقة قديمة): استبدال كامل */
  return { s: s, write: { update: { name: name, fields: f }, currentDocument: doc ? { updateTime: doc.updateTime } : { exists: false } } };
}
/* نفس nm() في academy-data.js: اسم الليدربورد (أول كلمتين، 20 حرف كحد أقصى) */
function walletName(dn) {
  const p = String(dn || '').trim().split(/\s+/), a = p[0] || 'طالب', b = p[1] ? a + ' ' + p[1] : a;
  return (b.length <= 20 ? b : a).slice(0, 20);
}

/* POST {action:'quests'} — قراءة بس: وثيقة واحدة (أو مفيش) ⇒ حالة اليوم */
async function questsAction(res, uid, tok) {
  const now = Date.now(), day = cairoKey(now), ex = cairoDayEnd(now);
  const docs = await batchGet(['arena_quests/' + uid], tok);
  if (!docs) return fail(res, 503, 'read_failed');
  const d = docs['arena_quests/' + uid];
  return send(res, 200, { ok: true, now: now, q: questView(questState(d ? fd(d) : null, day, ex).s) });
}

/* POST {action:'claim', k} — استلام مكافأة: كل التحقق من وثيقة الخادم، والدفع في commit واحد ذرّي على نفس محفظة الـ XP */
async function claimAction(res, uid, dispName, k, tok) {
  const qi = QK.indexOf(k);
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(200 * attempt + Math.floor(Math.random() * 150));
    const now = Date.now(), day = cairoKey(now), ex = cairoDayEnd(now);
    const key = 'aq_' + day.replace(/-/g, '') + '_' + k, eid = uid + '_' + key;
    const names = ['arena_quests/' + uid, 'xp_wallet/' + uid];
    if (attempt) names.push('xp_events/' + eid);   /* أول محاولة مش محتاجة قراءة الحدث (بيتحمي بـ exists:false) — بنقراه بس بعد تعارض */
    const docs = await batchGet(names, tok);
    if (!docs) return fail(res, 503, 'read_failed');
    const qdoc = docs['arena_quests/' + uid], st = questState(qdoc ? fd(qdoc) : null, day, ex), s = st.s;
    if (st.stored && s.cl[qi]) return send(res, 200, { ok: true, again: true, xp: 0, q: questView(s) });
    if (!st.stored || s.p[qi] < s.g[qi]) return send(res, 409, { error: 'not_ready', q: questView(s) });

    const qf = (function () { const c = s.cl.slice(); c[qi] = true; return { cl: AB(c), lt: TS(now) }; })();
    const writes = [{ update: { name: FS_ROOT + '/arena_quests/' + uid, fields: qf }, updateMask: { fieldPaths: Object.keys(qf) }, currentDocument: { updateTime: qdoc.updateTime } }];
    let paid = 0, total = null;
    if (!(attempt && docs['xp_events/' + eid])) {   /* لو الحدث موجود أصلًا (حالة غير متوقعة) بنقفل العلامة من غير دفع تاني */
      const amt = s.r[qi], wdoc = docs['xp_wallet/' + uid], w = wdoc ? fd(wdoc) : null;
      const n0 = function (v) { return typeof v === 'number' && v > 0 ? Math.floor(v) : 0; };
      /* نفس تعريفات NBXP للأسبوع/الشهر (dayN/wkN/monN بإزاحة +2 ساعة) علشان عدّادات المحفظة تفضل متّسقة مع باقي النظام */
      const xd = Math.floor((now + 7200000) / 86400000), wk = Math.floor((xd + 3) / 7), t2 = new Date(now + 7200000), mo = t2.getUTCFullYear() * 12 + t2.getUTCMonth() + 1;
      const nxp = n0(w && w.xp) + amt;
      const wf = { xp: I(nxp), wk: I(wk), wx: I((w && n0(w.wk) === wk ? n0(w.wx) : 0) + amt), mo: I(mo), mx: I((w && n0(w.mo) === mo ? n0(w.mx) : 0) + amt), last: S(eid) };
      if (wdoc) writes.push({ update: { name: FS_ROOT + '/xp_wallet/' + uid, fields: wf }, updateMask: { fieldPaths: Object.keys(wf) }, currentDocument: { updateTime: wdoc.updateTime } });
      else writes.push({ update: { name: FS_ROOT + '/xp_wallet/' + uid, fields: Object.assign({ uid: S(uid), nm: S(walletName(dispName)), spent: I(0) }, wf) }, currentDocument: { exists: false } });
      writes.push({ update: { name: FS_ROOT + '/xp_events/' + eid, fields: { uid: S(uid), type: S('arena_quest'), key: S(key), amt: I(amt), m: S(k), ts: TS(now) } }, currentDocument: { exists: false } });
      paid = amt; total = nxp;
    }
    const cm = await fs(':commit', { method: 'POST', body: JSON.stringify({ writes: writes }) }, tok);
    if (cm.status === 200) {
      s.cl[qi] = true;
      return send(res, 200, { ok: true, xp: paid, total: total, q: questView(s) });
    }
    const code = cm.json && cm.json.error && cm.json.error.status;
    if (code === 'ALREADY_EXISTS' || code === 'FAILED_PRECONDITION' || code === 'ABORTED' || cm.status === 409) continue;   /* حد سبقنا (استلام تاني/مباراة اتسجّلت) — نقرا من الأول */
    console.error('[arena-profile] claim commit http ' + cm.status + ' ' + String(code || ''));
    return fail(res, 503, 'write_failed');
  }
  return fail(res, 503, 'busy');
}
/* ═════════ نهاية DAILY-QUESTS ═════════ */

/* ───────── الـ handler ───────── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'method_not_allowed'); }
  const site = String((req.headers && req.headers['sec-fetch-site']) || '');
  if (site === 'cross-site') return fail(res, 403, 'forbidden');
  const m = /^Bearer\s+(\S{20,4000})$/.exec(String((req.headers && req.headers.authorization) || ''));
  if (!m) return fail(res, 401, 'unauthorized');
  let body;
  try { body = await readBody(req); } catch (e) { return fail(res, e && e.message === 'too_large' ? 413 : 400, 'bad_request'); }
  const action = body && typeof body === 'object' ? body.action : '';
  if (action !== 'finalize' && action !== 'quests' && action !== 'claim') return fail(res, 400, 'bad_request');
  const rid = typeof body.rid === 'string' ? body.rid : '';
  if (action === 'finalize' && !RID_RE.test(rid)) return fail(res, 400, 'bad_request');
  if (action === 'claim' && (typeof body.k !== 'string' || QK.indexOf(body.k) < 0)) return fail(res, 400, 'bad_request');
  if (!serviceAccount()) return fail(res, 503, 'not_configured');

  const who = await verifyUser(m[1]);
  if (!who) return fail(res, 401, 'unauthorized');
  const uid = who.uid;
  if (limited(uid)) return fail(res, 429, 'slow_down');
  const tok = await adminToken();
  if (!tok) return fail(res, 503, 'not_configured');
  if (action === 'quests') return questsAction(res, uid, tok);
  if (action === 'claim') return claimAction(res, uid, who.name, body.k, tok);

  /* 1) الغرفة + اللاعبين */
  const rr = await fs('/arena_rooms/' + rid, { method: 'GET' }, tok);
  if (rr.status === 404) return fail(res, 404, 'no_room');
  if (rr.status !== 200) return fail(res, 503, 'read_failed');
  const room = fd(rr.json);
  if (room.st !== 'play' || typeof room.t0 !== 'number') return fail(res, 409, 'not_started');
  if (Date.now() < room.t0 + LEAD + (NQ - 1) * SLOT + QDUR + END_GRACE) return fail(res, 409, 'not_finished');
  const pr = await fs('/arena_rooms/' + rid + '/pl?pageSize=20', { method: 'GET' }, tok);
  if (pr.status !== 200) return fail(res, 503, 'read_failed');
  const players = {};
  ((pr.json && pr.json.documents) || []).forEach(function (d) {
    const id = d.name.split('/').pop(), x = fd(d);
    players[id] = { tm: x.tm ? 1 : 0, j: typeof x.j === 'number' ? x.j : 0 };
  });
  const uids = Object.keys(players);
  if (!players[uid]) return fail(res, 403, 'not_member');
  if (uids.length < 2 || uids.length > 6) return fail(res, 409, 'bad_room');

  const mid = rid + '_' + Math.round(room.t0);
  const names = ['arena_results/' + mid];
  for (let i = 0; i < NQ; i++) { names.push('arena_rooms/' + rid + '/k/' + i); }
  uids.forEach(function (u) {
    names.push('arena_profiles/' + u);
    names.push('arena_quests/' + u);   /* DAILY-QUESTS: وثيقة المهام (قراءة واحدة للاعب جوه نفس batchGet) */
    for (let i = 0; i < NQ; i++) names.push('arena_rooms/' + rid + '/ans/' + u + '_' + i);
  });

  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await sleep(250 * attempt + Math.floor(Math.random() * 200));
    const docs = await batchGet(names, tok);
    if (!docs) return fail(res, 503, 'read_failed');

    /* المباراة اتسجّلت قبل كده → رجّع نتيجة اللاعب المخزّنة (idempotent) */
    if (docs['arena_results/' + mid]) {
      const mk = fd(docs['arena_results/' + mid]), mine = mk.r && mk.r[uid];
      return send(res, 200, { ok: true, again: true, counted: !!mk.ct, me: mine || null });
    }

    const keys = {};
    for (let i = 0; i < NQ; i++) { const d = docs['arena_rooms/' + rid + '/k/' + i]; if (!d) return fail(res, 409, 'no_keys'); keys[i] = fd(d); }
    const ans = {};
    uids.forEach(function (u) {
      for (let i = 0; i < NQ; i++) {
        const d = docs['arena_rooms/' + rid + '/ans/' + u + '_' + i];
        if (d) { const x = fd(d); if (x.u === u && x.i === i && typeof x.t === 'number' && typeof x.c === 'number') ans[u + '_' + i] = { c: x.c, t: x.t }; }
      }
    });
    const ev = evaluate(room, players, ans, keys), now = Date.now(), day = cairoDay(now);
    const qDay = cairoKey(now), qEx = cairoDayEnd(now);   /* DAILY-QUESTS: يوم القاهرة الحقيقي (مش اليوم الثابت +2 بتاع DAILY_CAP) */
    const writes = [], entries = {};

    uids.forEach(function (u) {
      const r = ev.res[u], d = docs['arena_profiles/' + u], p = d ? fd(d) : {};
      const cur = { m: p.m | 0, w: p.w | 0, ws: p.ws | 0, bs: p.bs | 0, c: p.c | 0, pf: p.pf | 0, tw: p.tw | 0, dd: p.dd | 0, dc: p.dc | 0, ac: Array.isArray(p.ac) ? p.ac.filter(function (x) { return ACH_IDS.indexOf(x) > -1; }) : [] };
      const capped = cur.dd === day && cur.dc >= DAILY_CAP;
      const credited = ev.counted && r.active && !capped;
      entries[u] = { s: r.s, c: r.cc, w: r.won ? 1 : 0, k: credited ? 1 : 0, n: [], ws: cur.ws, bs: cur.bs, ps: cur.ws };   /* WIN-STREAK: ws/bs بعد المباراة · ps قبلها (مباراة ما اتحسبتش = السلسلة زي ما هي) */
      if (!credited) return;
      const nx = { m: cur.m + 1, w: cur.w + (r.won ? 1 : 0), c: cur.c + r.cc, pf: cur.pf + (r.cc === NQ ? 1 : 0), tw: cur.tw + (r.won && r.team ? 1 : 0), dd: day, dc: (cur.dd === day ? cur.dc : 0) + 1 };
      nx.ws = r.won ? cur.ws + 1 : (r.draw ? cur.ws : 0);   /* تعادل الفرق ما بيكسرش السلسلة */
      nx.bs = Math.max(cur.bs, nx.ws);
      entries[u].ws = nx.ws; entries[u].bs = nx.bs;
      const ctx = { m: nx.m, w: nx.w, bs: nx.bs, cc: r.cc, fast: r.fast, team: r.team, won: r.won };
      const have = cur.ac.slice(), added = [];
      ACH_IDS.forEach(function (id) { if (have.indexOf(id) === -1 && ACH[id](ctx)) { have.push(id); added.push(id); } });
      entries[u].n = added;
      const fields = { m: I(nx.m), w: I(nx.w), ws: I(nx.ws), bs: I(nx.bs), c: I(nx.c), pf: I(nx.pf), tw: I(nx.tw), dd: I(nx.dd), dc: I(nx.dc), ac: { arrayValue: { values: have.map(S) } }, lt: TS(now) };
      writes.push({
        update: { name: FS_ROOT + '/arena_profiles/' + u, fields: fields },
        updateMask: { fieldPaths: Object.keys(fields) },   /* eq (اللقب المُجهّز) بيتكتب من العميل — مش جوه الماسك فمش بيتمسح */
        currentDocument: d ? { updateTime: d.updateTime } : { exists: false }
      });
      /* DAILY-QUESTS: التقدّم من نفس المباراة المتحقَّق منها (مباراة اتحسبت = +1 · إجابات صحيحة من الخادم · انتصار) — في نفس commit الـ marker */
      const qa = questApply(u, docs['arena_quests/' + u], qDay, qEx, [1, r.cc, r.won ? 1 : 0], now);
      if (qa.write) writes.push(qa.write);
      entries[u].q = questView(qa.s);
    });

    const rmap = {};
    uids.forEach(function (u) {
      const e = entries[u];
      rmap[u] = { mapValue: { fields: { s: I(e.s), c: I(e.c), w: I(e.w), k: I(e.k), n: { arrayValue: { values: e.n.map(S) } }, ws: I(e.ws), bs: I(e.bs), ps: I(e.ps) } } };
    });
    writes.unshift({
      update: { name: FS_ROOT + '/arena_results/' + mid, fields: { rid: S(rid), ts: TS(now), exp: TS(now + 30 * 86400000), np: I(uids.length), ct: { booleanValue: ev.counted }, md: S(room.md === 't' ? 't' : 's'), r: { mapValue: { fields: rmap } } } },
      currentDocument: { exists: false }
    });

    const cm = await fs(':commit', { method: 'POST', body: JSON.stringify({ writes: writes }) }, tok);
    if (cm.status === 200) {
      const mine = entries[uid], ru = ev.res[uid];
      return send(res, 200, { ok: true, counted: ev.counted, me: { s: mine.s, c: mine.c, w: mine.w, k: mine.k, n: mine.n, ws: mine.ws, bs: mine.bs, ps: mine.ps, rank: ru.rank, q: mine.q || null } });
    }
    const code = cm.json && cm.json.error && cm.json.error.status;
    if (code === 'ALREADY_EXISTS' || code === 'FAILED_PRECONDITION' || code === 'ABORTED' || cm.status === 409) continue;   /* حد سبقنا أو البروفايل اتغيّر — نقرا من الأول */
    console.error('[arena-profile] commit http ' + cm.status + ' ' + String(code || ''));
    return fail(res, 503, 'write_failed');
  }
  return fail(res, 503, 'busy');
};
