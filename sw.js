/**
 * Nabtex PWA — Production Service Worker v2.0.0
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * Strategies:
 *  App Shell HTML  → Network First  → Cache → Offline Page
 *  Fonts / Static  → Cache First   → Network
 *  Firebase / Auth → Network Only  (NEVER cached)
 */

const SW_VERSION   = 'nabtex-v2.4.0';
const SHELL_CACHE  = SW_VERSION + '-shell';
const STATIC_CACHE = SW_VERSION + '-static';
const FONT_CACHE   = SW_VERSION + '-fonts';

const LOG = (...a) => console.log('%c[Nabtex SW]', 'color:#2d9a58;font-weight:700', ...a);

/* ── Offline page (pre-rendered HTML, synthetic response) ── */
const OFFLINE_URL  = '/__offline__';
const OFFLINE_HTML = "<!DOCTYPE html>\n<html lang=\"ar\" dir=\"rtl\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">\n<title>\u0646\u0628\u062a\u064a\u0643\u0633 \u2014 \u063a\u064a\u0631 \u0645\u062a\u0635\u0644</title>\n<style>\n*{margin:0;padding:0;box-sizing:border-box}\n:root{--brand:#1B6B3A;--brand-d:#0f552e;--brand-l:#2d9a58;--bg:#fafef9;--ink:#1e2a24;--muted:#6d8f7a;--card:#fff;--line:#e2eee5}\n@media(prefers-color-scheme:dark){:root{--bg:#0b160d;--ink:#e2f0e6;--muted:#5a8068;--card:#162019}}\nhtml,body{height:100%;font-family:'Segoe UI',system-ui,sans-serif;background:var(--bg);color:var(--ink)}\nbody{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px;text-align:center}\n.icon-wrap{width:88px;height:88px;border-radius:22px;background:linear-gradient(145deg,#2d9a58,#0f552e);display:grid;place-items:center;margin:0 auto 28px;box-shadow:0 12px 40px rgba(27,107,58,.35)}\nh1{font-size:clamp(22px,5vw,30px);font-weight:800;margin-bottom:10px;letter-spacing:-.02em}\np{font-size:15px;color:var(--muted);line-height:1.7;max-width:320px;margin:0 auto 32px}\n.badge{display:inline-flex;align-items:center;gap:8px;padding:8px 18px;border-radius:99px;background:rgba(27,107,58,.1);border:1px solid rgba(27,107,58,.2);color:#1B6B3A;font-size:13px;font-weight:700;margin-bottom:28px}\n.badge-dot{width:8px;height:8px;border-radius:50%;background:#ef4444;animation:blink 1.4s ease-in-out infinite}\n@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}\n.btn{display:inline-flex;align-items:center;gap:8px;padding:13px 28px;border-radius:99px;background:#1B6B3A;color:#fff;font-size:14px;font-weight:700;border:none;cursor:pointer;font-family:inherit;box-shadow:0 4px 18px rgba(27,107,58,.4);transition:all .2s}\n.btn:hover{background:#2d9a58;transform:translateY(-2px)}\n.brand{margin-top:40px;font-size:13px;color:var(--muted);opacity:.6;font-weight:600;letter-spacing:.04em}\n</style>\n</head>\n<body>\n<div class=\"icon-wrap\">\n  <svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#fff\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" width=\"46\" height=\"46\">\n    <path d=\"M12 22V12M12 12C12 8 8 5 4 6M12 12C12 8 16 5 20 6\"/><path d=\"M5 20c2-3 5-5 7-8\"/>\n  </svg>\n</div>\n<div class=\"badge\"><span class=\"badge-dot\"></span>\u063a\u064a\u0631 \u0645\u062a\u0635\u0644 \u0628\u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a</div>\n<h1>\u0644\u0627 \u064a\u0648\u062c\u062f \u0627\u062a\u0635\u0627\u0644 \u0628\u0627\u0644\u0634\u0628\u0643\u0629</h1>\n<p>\u062a\u062d\u0642\u0642 \u0645\u0646 \u0627\u062a\u0635\u0627\u0644\u0643 \u0628\u0627\u0644\u0625\u0646\u062a\u0631\u0646\u062a \u062b\u0645 \u062d\u0627\u0648\u0644 \u0645\u0631\u0629 \u0623\u062e\u0631\u0649. \u0627\u0644\u0645\u062d\u062a\u0648\u0649 \u0627\u0644\u0645\u062d\u0641\u0648\u0638 \u0645\u0633\u0628\u0642\u0627\u064b \u0645\u062a\u0627\u062d \u0644\u0644\u0627\u0633\u062a\u062e\u062f\u0627\u0645.</p>\n<button class=\"btn\" onclick=\"window.location.reload()\">\n  <svg width=\"16\" height=\"16\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" stroke-linecap=\"round\"><path d=\"M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8\"/><path d=\"M3 3v5h5\"/></svg>\n  \u0625\u0639\u0627\u062f\u0629 \u0627\u0644\u0645\u062d\u0627\u0648\u0644\u0629\n</button>\n<div class=\"brand\">\u0646\u0628\u062a\u064a\u0643\u0633 \u00b7 Nabtex</div>\n</body>\n</html>";

/* ── Firebase & Auth — BYPASS, never touch ── */
const BYPASS_HOSTS = [
  'firestore.googleapis.com',
  'firebase.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebaseinstallations.googleapis.com',
  'fcm.googleapis.com',
  'firebasestorage.googleapis.com',
  'accounts.google.com',
  'oauth2.googleapis.com',
  'lh3.googleusercontent.com',
];
const BYPASS_PATH_FRAGS = ['/__/auth/', '/v1/', '/v1beta1/'];

function shouldBypass(url) {
  try {
    const u = new URL(url);
    if (BYPASS_HOSTS.some(h => u.hostname.includes(h))) return true;
    if (BYPASS_PATH_FRAGS.some(p => u.pathname.includes(p))) return true;
    if (u.search.includes('token') || u.search.includes('key=')) return true;
  } catch (_) {}
  return false;
}

/* ── Font origins ── */
function isFont(url) {
  try {
    const h = new URL(url).hostname;
    return h.includes('fonts.googleapis.com') || h.includes('fonts.gstatic.com');
  } catch (_) { return false; }
}

/* ── Static cacheable extensions ── */
const STATIC_EXTS = ['.woff','.woff2','.ttf','.otf','.css','.png','.jpg','.jpeg','.svg','.ico','.webp','.gif'];
function isStatic(url) {
  try {
    const p = new URL(url).pathname;
    return STATIC_EXTS.some(e => p.endsWith(e));
  } catch (_) { return false; }
}

/* Same-origin app scripts (social.js, etc.) — must always try network first
   so a deploy is visible on the very next load, not one load later */
function isAppScript(url) {
  try {
    const u = new URL(url);
    return u.origin === self.location.origin && u.pathname.endsWith('.js');
  } catch (_) { return false; }
}

function isNavigate(req) {
  return req.mode === 'navigate' ||
    (req.method === 'GET' && (req.headers.get('accept') || '').includes('text/html'));
}

/* ══════════════════════════════════════════════════
   INSTALL — precache shell + embed offline page
══════════════════════════════════════════════════ */
self.addEventListener('install', event => {
  LOG('📦 Installing ' + SW_VERSION);
  event.waitUntil((async () => {
    const shellCache = await caches.open(SHELL_CACHE);

    /* Always embed offline fallback — no network needed */
    await shellCache.put(
      new Request(OFFLINE_URL),
      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html;charset=utf-8' } })
    );
    LOG('✅ Offline page embedded in cache');

    /* Precache shell (best-effort — skip if offline during SW install) */
    for (const url of ['/', '/index.html']) {
      try {
        const resp = await fetch(url, { cache: 'reload' });
        if (resp && resp.ok) {
          await shellCache.put(new Request(url), resp);
          LOG('✅ Shell cached:', url);
        }
      } catch (_) {
        LOG('⚠️ Shell precache skipped (offline):', url);
      }
    }

    await self.skipWaiting();
    LOG('⚡ skipWaiting() called');
  })());
});

/* ══════════════════════════════════════════════════
   ACTIVATE — purge old caches, claim all clients
══════════════════════════════════════════════════ */
self.addEventListener('activate', event => {
  LOG('🚀 Activating, cleaning old caches...');
  event.waitUntil((async () => {
    const keep = [SHELL_CACHE, STATIC_CACHE, FONT_CACHE];
    const all  = await caches.keys();
    await Promise.all(
      all.filter(k => !keep.includes(k)).map(k => {
        LOG('🗑 Deleting:', k);
        return caches.delete(k);
      })
    );
    await self.clients.claim();
    LOG('✅ Controlling all clients. Offline mode: ACTIVE');

    /* Notify page that SW is live */
    const clients = await self.clients.matchAll({ includeUncontrolled: true });
    clients.forEach(c => c.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION }));
  })());
});

/* ══════════════════════════════════════════════════
   FETCH — Smart routing engine
══════════════════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = request.url;

  /* Non-GET, extensions, special URIs — pass through */
  if (request.method !== 'GET') return;
  if (url.startsWith('chrome-extension://')) return;
  if (url.startsWith('data:')) return;
  if (url.startsWith('blob:')) return;
  if (url.startsWith('ws://') || url.startsWith('wss://')) return;

  /* Firebase / Auth / Real-time → NEVER intercept */
  if (shouldBypass(url)) return;

  /* Google Fonts → Cache First (CDN-cached) */
  if (isFont(url)) {
    event.respondWith(stratCacheFirst(request, FONT_CACHE));
    return;
  }

  /* Static assets (CSS, images, woff) → Cache First */
  if (isStatic(url)) {
    event.respondWith(stratCacheFirst(request, STATIC_CACHE));
    return;
  }

  /* HTML navigation → Network First + Offline fallback */
  if (isNavigate(request)) {
    event.respondWith(stratNetworkFirstOffline(request));
    return;
  }

  /* Same-origin app scripts → Network First (avoid serving stale code after a deploy) */
  if (isAppScript(url)) {
    event.respondWith(stratNetworkFirst(request, STATIC_CACHE));
    return;
  }

  /* gstatic / CDN scripts / other same-origin → Stale-While-Revalidate */
  event.respondWith(stratStaleWhileRevalidate(request, STATIC_CACHE));
});

/* ══════════════════════════════════════════════════
   STRATEGIES
══════════════════════════════════════════════════ */

async function stratCacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreSearch: false });
  if (cached) return cached;
  try {
    const resp = await fetch(request);
    if (resp && resp.ok && resp.type !== 'opaque') {
      cache.put(request, resp.clone());
    }
    return resp;
  } catch (_) {
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function stratNetworkFirstOffline(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok) {
      cache.put(request, resp.clone());
      return resp;
    }
    throw new Error('Bad response ' + resp.status);
  } catch (_) {
    LOG('🔌 Offline — serving shell from cache for:', request.url);
    const cached =
      (await cache.match(request)) ||
      (await cache.match('/')) ||
      (await cache.match('/index.html')) ||
      (await cache.match(OFFLINE_URL));
    return cached || new Response(OFFLINE_HTML, {
      headers: { 'Content-Type': 'text/html;charset=utf-8' }
    });
  }
}

async function stratNetworkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(request);
    if (resp && resp.ok && resp.type !== 'opaque') cache.put(request, resp.clone());
    return resp;
  } catch (_) {
    const cached = await cache.match(request);
    return cached || new Response('', { status: 503, statusText: 'Offline' });
  }
}

async function stratStaleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const fetchP = fetch(request).then(resp => {
    if (resp && resp.ok && resp.type !== 'opaque') cache.put(request, resp.clone());
    return resp;
  }).catch(() => null);
  return cached || (await fetchP) || new Response('', { status: 503 });
}

/* ══════════════════════════════════════════════════
   BACKGROUND SYNC — auto-sync pending ops when online
══════════════════════════════════════════════════ */
self.addEventListener('sync', event => {
  if (event.tag === 'nabtex-farm-sync') {
    LOG('🔄 Background Sync triggered — notifying client');
    event.waitUntil(
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(c => c.postMessage({ type: 'BG_SYNC_TRIGGER' }));
      })
    );
  }
});

/* ══════════════════════════════════════════════════
   MESSAGE — client commands
══════════════════════════════════════════════════ */
self.addEventListener('message', event => {
  const d = event.data;
  if (!d) return;

  if (d.type === 'SKIP_WAITING') {
    LOG('⚡ Skip waiting (from client)');
    self.skipWaiting();
  }

  if (d.type === 'GET_VERSION') {
    event.source?.postMessage({ type: 'SW_VERSION', version: SW_VERSION });
  }

  if (d.type === 'CACHE_STATUS') {
    (async () => {
      const keys   = await caches.keys();
      const report = await Promise.all(keys.map(async k => {
        const c  = await caches.open(k);
        const ks = await c.keys();
        return { cache: k, entries: ks.length };
      }));
      LOG('📊 Cache status:', JSON.stringify(report));
      event.source?.postMessage({ type: 'CACHE_STATUS_RESULT', data: report });
    })();
  }
});
