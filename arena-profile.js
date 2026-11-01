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
    return u && u.localId ? String(u.localId) : null;
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

/* ───────── الـ handler ───────── */
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return fail(res, 405, 'method_not_allowed'); }
  const site = String((req.headers && req.headers['sec-fetch-site']) || '');
  if (site === 'cross-site') return fail(res, 403, 'forbidden');
  const m = /^Bearer\s+(\S{20,4000})$/.exec(String((req.headers && req.headers.authorization) || ''));
  if (!m) return fail(res, 401, 'unauthorized');
  let body;
  try { body = await readBody(req); } catch (e) { return fail(res, e && e.message === 'too_large' ? 413 : 400, 'bad_request'); }
  if (!body || typeof body !== 'object' || body.action !== 'finalize') return fail(res, 400, 'bad_request');
  const rid = typeof body.rid === 'string' ? body.rid : '';
  if (!RID_RE.test(rid)) return fail(res, 400, 'bad_request');
  if (!serviceAccount()) return fail(res, 503, 'not_configured');

  const uid = await verifyUser(m[1]);
  if (!uid) return fail(res, 401, 'unauthorized');
  if (limited(uid)) return fail(res, 429, 'slow_down');
  const tok = await adminToken();
  if (!tok) return fail(res, 503, 'not_configured');

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
    const writes = [], entries = {};

    uids.forEach(function (u) {
      const r = ev.res[u], d = docs['arena_profiles/' + u], p = d ? fd(d) : {};
      const cur = { m: p.m | 0, w: p.w | 0, ws: p.ws | 0, bs: p.bs | 0, c: p.c | 0, pf: p.pf | 0, tw: p.tw | 0, dd: p.dd | 0, dc: p.dc | 0, ac: Array.isArray(p.ac) ? p.ac.filter(function (x) { return ACH_IDS.indexOf(x) > -1; }) : [] };
      const capped = cur.dd === day && cur.dc >= DAILY_CAP;
      const credited = ev.counted && r.active && !capped;
      entries[u] = { s: r.s, c: r.cc, w: r.won ? 1 : 0, k: credited ? 1 : 0, n: [] };
      if (!credited) return;
      const nx = { m: cur.m + 1, w: cur.w + (r.won ? 1 : 0), c: cur.c + r.cc, pf: cur.pf + (r.cc === NQ ? 1 : 0), tw: cur.tw + (r.won && r.team ? 1 : 0), dd: day, dc: (cur.dd === day ? cur.dc : 0) + 1 };
      nx.ws = r.won ? cur.ws + 1 : (r.draw ? cur.ws : 0);   /* تعادل الفرق ما بيكسرش السلسلة */
      nx.bs = Math.max(cur.bs, nx.ws);
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
    });

    const rmap = {};
    uids.forEach(function (u) {
      const e = entries[u];
      rmap[u] = { mapValue: { fields: { s: I(e.s), c: I(e.c), w: I(e.w), k: I(e.k), n: { arrayValue: { values: e.n.map(S) } } } } };
    });
    writes.unshift({
      update: { name: FS_ROOT + '/arena_results/' + mid, fields: { rid: S(rid), ts: TS(now), exp: TS(now + 30 * 86400000), np: I(uids.length), ct: { booleanValue: ev.counted }, md: S(room.md === 't' ? 't' : 's'), r: { mapValue: { fields: rmap } } } },
      currentDocument: { exists: false }
    });

    const cm = await fs(':commit', { method: 'POST', body: JSON.stringify({ writes: writes }) }, tok);
    if (cm.status === 200) {
      const mine = entries[uid], ru = ev.res[uid];
      return send(res, 200, { ok: true, counted: ev.counted, me: { s: mine.s, c: mine.c, w: mine.w, k: mine.k, n: mine.n, rank: ru.rank } });
    }
    const code = cm.json && cm.json.error && cm.json.error.status;
    if (code === 'ALREADY_EXISTS' || code === 'FAILED_PRECONDITION' || code === 'ABORTED' || cm.status === 409) continue;   /* حد سبقنا أو البروفايل اتغيّر — نقرا من الأول */
    console.error('[arena-profile] commit http ' + cm.status + ' ' + String(code || ''));
    return fail(res, 503, 'write_failed');
  }
  return fail(res, 503, 'busy');
};
