/* ═══════════════════════════════════════════════════════════════════════════
   NABTEX ARENA — مسابقة زراعية متعددة اللاعبين (2–6) داخل نبتيكس. ملف عميل مستقل (إضافة بحتة: بيعتمد على window.auth / window.db / firebase / showToast / openAuth).
   - الأسئلة بتتولّد مرة واحدة للغرفة على الخادم (api/farm-ai.js · mode:arena_gen) ومفاتيح الإجابة بتتكتب هناك؛ العميل عمره ما بيشوف الإجابة الصحيحة قبل نهاية نافذة السؤال.
   - كل القواعد الموثوقة (السعة، توازن الفرق، نافذة الـ 20ث، قفل الإجابة، إخفاء المفاتيح) في firestore.rules (arena_rooms). العميل بيحسب النقاط من إجابات اتسجّلت بتوقيت السيرفر.
   - الجدول الزمني ثابت من t0 (توقيت السيرفر): ليد 5ث ثم لكل سؤال 20ث إجابة + 6ث كشف. مفيش حد بيتحكم في التقدّم، فالمضيف لو فصل اللعبة تكمّل.
   للتراجع: امسح الملف وسطر <script src="arena.js"> وروابط NbArena في index.html وكتلة arena في firestore.rules وmode arena_gen في api/farm-ai.js.
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  if (window.NbArena) return;

  /* لازم تطابق ARENA_SPECS في api/farm-ai.js (المفتاح → الاسم) */
  var SPECS = [['pp', 'وقاية النبات'], ['path', 'أمراض النبات'], ['ent', 'علم الحشرات الاقتصادية'], ['hort', 'البساتين والفاكهة'],
    ['bio', 'التكنولوجيا الحيوية الزراعية'], ['soil', 'علوم الأراضي والتسميد'], ['food', 'علوم وتكنولوجيا الأغذية'], ['gen', 'الوراثة وتربية النبات'],
    ['crop', 'المحاصيل الحقلية'], ['irr', 'الري والموارد المائية'], ['anim', 'الإنتاج الحيواني والداجني'], ['eco', 'الاقتصاد والإرشاد الزراعي'],
    ['mix', 'منوّع (كل التخصصات الزراعية)']];
  var LEAD = 5000, QDUR = 20000, SLOT = 26000, NQ = 10, BONUS = 50, STALE = 75000;   /* نفس أرقام firestore.rules (arOpen/arClose) */
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', COLS = ['#1B6B3A', '#c9871a', '#2b6cb0', '#b83280', '#6b46c1', '#c05621'];
  var LETTERS = ['أ', 'ب', 'ج', 'د'], DIFF = { e: 'سهل', m: 'متوسط', h: 'صعب' };
  var root = null, S = null, V = { view: 'hub' }, ticking = false;

  /* ───────── أدوات صغيرة ───────── */
  function h(tag, a, kids) {
    var e = document.createElement(tag);
    if (a) Object.keys(a).forEach(function (k) {
      var v = a[k];
      if (v == null || v === false) return;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'style') e.style.cssText = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    });
    (kids || []).forEach(function (c) { if (c != null && c !== false) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function $(sel) { return root ? root.querySelector(sel) : null; }
  function toast(m, t) { try { if (window.showToast) window.showToast(m, t || 'inf'); } catch (e) { /* ignore */ } }
  function me() { return window.auth && window.auth.currentUser; }
  function SV() { return firebase.firestore.FieldValue.serverTimestamp(); }
  function rref(rid) { return window.db.collection('arena_rooms').doc(rid); }
  function srvNow() { return Date.now() + (S ? S.off : 0); }
  function hash(s) { var x = 0; for (var i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0; return Math.abs(x); }
  function myName() { var u = me(), n = (u && (u.displayName || (u.email || '').split('@')[0])) || 'لاعب'; return String(n).trim().slice(0, 24) || 'لاعب'; }
  function myPhoto() { var p = me() && me().photoURL; return (typeof p === 'string' && /^https:\/\//.test(p) && p.length <= 300) ? p : ''; }
  function specLabel(k) { for (var i = 0; i < SPECS.length; i++) if (SPECS[i][0] === k) return SPECS[i][1]; return ''; }
  function specKey(l) { for (var i = 0; i < SPECS.length; i++) if (SPECS[i][1] === l) return SPECS[i][0]; return ''; }
  function ls(k, v) { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* private mode */ } return null; }
  function genCode() { var a = new Uint8Array(6), s = ''; (window.crypto || window.msCrypto).getRandomValues(a); for (var i = 0; i < 6; i++) s += ALPHA.charAt(a[i] % ALPHA.length); return s; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function openT(i) { return S.t0 + LEAD + i * SLOT; }
  function closeT(i) { return openT(i) + QDUR; }
  function avatar(uid, p, size) {
    var s = size || 40, d = h('div', { class: 'nba-av', style: 'width:' + s + 'px;height:' + s + 'px;font-size:' + Math.round(s * 0.42) + 'px;background:' + COLS[hash(uid) % COLS.length] });
    d.appendChild(h('span', { text: ((p && p.n) || '؟').trim().charAt(0) }));
    if (p && p.ph && /^https:\/\//.test(p.ph)) { var im = h('img', { src: p.ph, alt: '', referrerpolicy: 'no-referrer' }); im.onerror = function () { im.remove(); }; d.appendChild(im); }
    return d;
  }
  function ico(path) { var d = document.createElement('span'); d.className = 'nba-ico'; d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; return d; }
  var I = {
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
    crown: '<path d="M3 18l2-11 5 5 2-8 2 8 5-5 2 11z"/>',
    swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'
  };

  /* ───────── CSS (بنفس توكنز نبتيكس: --brand / --card / --line / --gold ...) ───────── */
  function css() {
    if (document.getElementById('nba-css')) return;
    var st = document.createElement('style'); st.id = 'nba-css';
    st.textContent = [
      '.nba-root{position:fixed;inset:0;z-index:100000;direction:rtl;font-family:var(--f-ui,Cairo,sans-serif);color:var(--ink);background:linear-gradient(180deg,var(--brand-pale,#f5fbf6) 0,var(--bg,#fafef9) 38%);overflow-y:auto;-webkit-overflow-scrolling:touch;padding-top:env(safe-area-inset-top,0)}',
      '.nba-wrap{max-width:520px;margin:0 auto;padding:12px 16px calc(28px + env(safe-area-inset-bottom,0))}',
      '.nba-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0 12px}',
      '.nba-ttl{display:flex;align-items:center;gap:9px;font-weight:800;font-size:18px}',
      '.nba-logo{width:34px;height:34px;border-radius:11px;background:linear-gradient(135deg,var(--brand-l,#2d9a58),var(--brand,#1B6B3A));color:#fff;display:grid;place-items:center;box-shadow:var(--s2)}',
      '.nba-ico{display:inline-grid;place-items:center;width:18px;height:18px}.nba-ico svg{width:100%;height:100%}',
      '.nba-x{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:var(--card);color:var(--ink);display:grid;place-items:center;cursor:pointer}',
      '.nba-card{background:var(--card,#fff);border:1px solid var(--line);border-radius:var(--r4,24px);box-shadow:var(--s2);padding:16px;margin-bottom:12px}',
      '.nba-hero{background:linear-gradient(135deg,var(--brand,#1B6B3A),var(--brand-l,#2d9a58));color:#fff;border:0;position:relative;overflow:hidden}',
      '.nba-hero h2{margin:0 0 6px;font-size:21px;font-weight:800}.nba-hero p{margin:0;opacity:.92;font-size:13.5px;line-height:1.7}',
      '.nba-btn{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:var(--r3,16px);padding:14px;font:700 15px var(--f-ui,Cairo,sans-serif);cursor:pointer;background:var(--brand,#1B6B3A);color:#fff;box-shadow:0 6px 16px rgba(27,107,58,.22);transition:transform .15s,opacity .15s}',
      '.nba-btn:active{transform:scale(.98)}.nba-btn[disabled]{opacity:.45;cursor:not-allowed;box-shadow:none}',
      '.nba-btn.sec{background:var(--card);color:var(--brand,#1B6B3A);border:1.5px solid var(--line2,#cfe2d4);box-shadow:none}',
      '.nba-btn.gold{background:linear-gradient(135deg,var(--gold-l,#e5a343),var(--gold,#c9871a));box-shadow:0 6px 16px rgba(201,135,26,.28)}',
      '.nba-btn.sm{width:auto;padding:7px 12px;font-size:12.5px;border-radius:var(--r2,10px)}',
      '.nba-in{width:100%;box-sizing:border-box;border:1.5px solid var(--line2);border-radius:var(--r3);padding:13px;font:800 20px var(--f-ui,Cairo,sans-serif);letter-spacing:.35em;text-align:center;text-transform:uppercase;background:var(--bg);color:var(--ink);direction:ltr}',
      '.nba-in:focus{outline:0;border-color:var(--brand);box-shadow:var(--sglow)}',
      '.nba-lbl{font-weight:700;font-size:13px;color:var(--slate);margin:14px 0 8px}',
      '.nba-seg{display:flex;gap:8px}.nba-seg>button{flex:1}',
      '.nba-chips{display:flex;flex-wrap:wrap;gap:7px}',
      '.nba-chip{border:1.5px solid var(--line2);background:var(--bg);color:var(--ink2);border-radius:var(--rpill,999px);padding:7px 13px;font:600 12.5px var(--f-ui,Cairo,sans-serif);cursor:pointer}',
      '.nba-chip.on{background:var(--brand);border-color:var(--brand);color:#fff}',
      '.nba-code{font:800 34px/1 var(--f-ui,Cairo,sans-serif);letter-spacing:.28em;direction:ltr;text-align:center;color:var(--brand);padding:14px 0 14px .28em;background:var(--brand-mist,#eef8f0);border-radius:var(--r3);border:1.5px dashed var(--line2)}',
      '.nba-row{display:flex;align-items:center;gap:10px;padding:9px 4px;border-bottom:1px solid var(--line)}.nba-row:last-child{border-bottom:0}',
      '.nba-row .nm{flex:1;min-width:0;font-weight:700;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nba-av{position:relative;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:800;flex:none;overflow:hidden}.nba-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.nba-dot{width:9px;height:9px;border-radius:50%;background:#bbb;flex:none}.nba-dot.on{background:var(--green,#27ae60);box-shadow:0 0 0 3px rgba(39,174,96,.18)}',
      '.nba-tag{font-size:11px;font-weight:700;border-radius:var(--rpill);padding:2px 8px;background:var(--brand-mist);color:var(--brand)}.nba-tag.g{background:var(--gold-pale,#fff6e8);color:var(--gold,#c9871a)}',
      '.nba-teams{display:grid;grid-template-columns:1fr 1fr;gap:10px}.nba-team{border-radius:var(--r3);padding:10px;border:1.5px solid var(--line2);background:var(--bg)}.nba-team h4{margin:0 0 6px;font-size:14px;font-weight:800;display:flex;justify-content:space-between;align-items:center}',
      '.nba-team.a h4{color:var(--brand)}.nba-team.b h4{color:var(--gold)}.nba-team.b{border-color:rgba(201,135,26,.4)}',
      '.nba-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}',
      '.nba-bar{height:9px;border-radius:9px;background:var(--bg3,#ecf5ee);overflow:hidden}.nba-bar>i{display:block;height:100%;width:100%;background:linear-gradient(90deg,var(--brand-l),var(--brand));border-radius:9px;transition:width .25s linear}.nba-bar>i.lo{background:linear-gradient(90deg,#e67e22,#c0392b)}',
      '.nba-qh{display:flex;align-items:center;justify-content:space-between;margin:2px 0 10px;font-weight:700;font-size:13px;color:var(--slate)}',
      '.nba-tm{font:800 22px var(--f-ui,Cairo,sans-serif);color:var(--brand);min-width:34px;text-align:center}.nba-tm.lo{color:var(--red,#c0392b)}',
      '.nba-q{font-weight:800;font-size:18px;line-height:1.75;margin:14px 0 14px}',
      '.nba-opt{display:flex;align-items:center;gap:11px;width:100%;text-align:right;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);border-radius:var(--r3);padding:13px;margin-bottom:9px;font:600 15px/1.6 var(--f-ui,Cairo,sans-serif);cursor:pointer;transition:transform .12s,border-color .12s,background .12s}',
      '.nba-opt:active{transform:scale(.985)}.nba-opt .lt{width:30px;height:30px;border-radius:10px;background:var(--brand-mist);color:var(--brand);display:grid;place-items:center;font-weight:800;flex:none}',
      '.nba-opt.sel{border-color:var(--brand);background:var(--brand-mist);box-shadow:var(--sglow)}.nba-opt.sel .lt{background:var(--brand);color:#fff}',
      '.nba-opt.ok{border-color:var(--green,#27ae60);background:rgba(39,174,96,.12)}.nba-opt.ok .lt{background:var(--green,#27ae60);color:#fff}',
      '.nba-opt.no{border-color:var(--red,#c0392b);background:rgba(192,57,43,.09)}.nba-opt.no .lt{background:var(--red,#c0392b);color:#fff}',
      '.nba-opt[disabled]{cursor:default}.nba-opt.dim{opacity:.55}',
      '.nba-lock{text-align:center;font-weight:700;font-size:13px;color:var(--slate);padding:6px 0}',
      '.nba-gain{font:800 26px var(--f-ui,Cairo,sans-serif);text-align:center;margin:2px 0}.nba-gain.ok{color:var(--green,#27ae60)}.nba-gain.no{color:var(--red,#c0392b)}',
      '.nba-xp{background:var(--brand-pale,#f5fbf6);border:1px solid var(--line);border-radius:var(--r3);padding:12px 14px;font-size:13.5px;line-height:1.85;color:var(--ink2)}',
      '.nba-lead{display:flex;align-items:center;gap:10px;padding:7px 4px}.nba-lead .rk{width:22px;text-align:center;font-weight:800;color:var(--muted)}.nba-lead .sc{font-weight:800;color:var(--brand);font-variant-numeric:tabular-nums}',
      '.nba-lead.me{background:var(--brand-mist);border-radius:var(--r2)}',
      '.nba-big{font:800 78px/1 var(--f-ui,Cairo,sans-serif);color:var(--brand);text-align:center;margin:36px 0 10px;animation:nbaPop .9s ease-out infinite}',
      '@keyframes nbaPop{0%{transform:scale(.7);opacity:.4}30%{transform:scale(1.08);opacity:1}100%{transform:scale(1)}}',
      '.nba-win{text-align:center;padding:22px 12px}.nba-win .tr{width:74px;height:74px;margin:0 auto 10px;border-radius:50%;background:linear-gradient(135deg,var(--gold-l),var(--gold));color:#fff;display:grid;place-items:center;box-shadow:0 10px 26px rgba(201,135,26,.35)}.nba-win .tr .nba-ico{width:38px;height:38px}',
      '.nba-win h2{margin:0 0 4px;font-size:22px;font-weight:800}.nba-win p{margin:0;color:var(--slate);font-size:13.5px}',
      '.nba-pod{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:18px 0 6px}.nba-pod>div{display:flex;flex-direction:column;align-items:center;gap:5px;width:30%}.nba-pod .st{width:100%;border-radius:12px 12px 0 0;display:grid;place-items:center;color:#fff;font-weight:800;padding-top:6px;background:linear-gradient(180deg,var(--brand-l),var(--brand))}.nba-pod .p1 .st{height:84px;background:linear-gradient(180deg,var(--gold-l),var(--gold))}.nba-pod .p2 .st{height:58px}.nba-pod .p3 .st{height:42px;opacity:.85}.nba-pod small{font-weight:700;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nba-rv{border-top:1px solid var(--line);padding:11px 2px;font-size:13.5px;line-height:1.8}.nba-rv b{display:block;margin-bottom:3px}.nba-rv .ca{color:var(--green,#27ae60);font-weight:700}',
      '.nba-err{background:rgba(192,57,43,.09);color:var(--red,#c0392b);border-radius:var(--r2);padding:10px 12px;font-size:13px;font-weight:600;margin-bottom:10px}',
      '.nba-note{color:var(--slate);font-size:12.5px;line-height:1.8;text-align:center;margin:8px 0}',
      '.nba-spin{width:22px;height:22px;border-radius:50%;border:3px solid rgba(255,255,255,.4);border-top-color:#fff;animation:nbaSp .8s linear infinite}.nba-spin.d{border-color:var(--line2);border-top-color:var(--brand)}@keyframes nbaSp{to{transform:rotate(360deg)}}',
      '@media (prefers-reduced-motion:reduce){.nba-big{animation:none}.nba-bar>i{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ───────── فتح / قفل ───────── */
  function open(o) {
    o = o || {};
    css();
    if (!me()) {
      try { sessionStorage.setItem('nbArenaPending', o.code || '1'); } catch (e) { /* ignore */ }
      toast('سجّل الدخول الأول علشان تدخل ساحة نبتيكس', 'inf');
      if (typeof window.openAuth === 'function') window.openAuth('login');
      return;
    }
    if (!root) {
      root = h('div', { class: 'nba-root', role: 'dialog', 'aria-label': 'ساحة نبتيكس' }, [h('div', { class: 'nba-wrap' })]);
      document.body.appendChild(root);
      document.documentElement.style.overflow = 'hidden';
      sweep();
    }
    if (S && S.rid) { V.key = ''; render(); return; }
    V = { view: o.code ? 'join' : 'hub', code: o.code || '' };
    render();
    if (o.code) joinRoom(o.code);
  }
  function close() {
    detach();
    if (root) { root.remove(); root = null; document.documentElement.style.overflow = ''; }
    V = { view: 'hub' };
  }
  function detach() {
    if (!S) return;
    (S.unsub || []).forEach(function (f) { try { f(); } catch (e) { /* ignore */ } });
    clearInterval(S.hbT); clearInterval(S.tk);
    S = null;
  }

  /* ───────── إنشاء / انضمام ───────── */
  async function createRoom(o) {
    var u = me(), tries = 0, last = null;
    V.busy = true; V.err = ''; render();
    while (tries++ < 5) {
      var code = genCode(), rr = rref(code), b = window.db.batch();
      b.set(rr, { host: u.uid, st: 'lobby', md: o.md, sp: specLabel(o.sp), mx: o.mx, pc: 1, na: o.md === 't' ? 1 : 0, nb: 0, qr: false, cr: SV(), exp: firebase.firestore.Timestamp.fromMillis(Date.now() + 3 * 3600000) });
      b.set(rr.collection('pl').doc(u.uid), { n: myName(), ph: myPhoto(), tm: 0, ls: SV(), j: SV() });
      try { await b.commit(); V.busy = false; attach(code); return; } catch (e) { last = e; if (!e || e.code !== 'permission-denied') break; }   /* permission-denied هنا = الكود متكرر (أو ساعة الجهاز غلط) → كود جديد */
    }
    V.busy = false; V.err = 'تعذّر إنشاء الغرفة. اتأكد من الاتصال ومن ضبط تاريخ ووقت جهازك وحاول تاني.'; render();
    if (last) console.warn('[arena] create', last);
  }
  async function joinRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJKMNP-Z2-9]{6}$/.test(code)) { V.err = 'الكود لازم يكون 6 حروف/أرقام.'; render(); return; }
    var u = me(), rr = rref(code), pr = rr.collection('pl').doc(u.uid);
    V.busy = true; V.err = ''; V.view = 'join'; V.code = code; render();
    try {
      await window.db.runTransaction(async function (tx) {
        var rs = await tx.get(rr);
        if (!rs.exists) throw { k: 'nf' };
        var r = rs.data(), ps = await tx.get(pr);
        if (ps.exists) return;   /* رجوع للغرفة (إعادة اتصال) */
        if (r.st !== 'lobby') throw { k: 'started' };
        if (r.exp && r.exp.toMillis() < Date.now()) throw { k: 'expired' };
        if (r.pc >= r.mx) throw { k: 'full' };
        var tm = r.md === 's' ? 0 : (r.na <= r.nb ? 0 : 1), up = { pc: r.pc + 1 };
        if (r.md === 't') { if (tm === 0) up.na = r.na + 1; else up.nb = r.nb + 1; }
        tx.update(rr, up);
        tx.set(pr, { n: myName(), ph: myPhoto(), tm: tm, ls: SV(), j: SV() });
      });
      V.busy = false; attach(code);
    } catch (e) {
      V.busy = false; V.view = 'hub';
      var m = { nf: 'مفيش غرفة بالكود ده.', started: 'اللعبة في الغرفة دي بدأت بالفعل.', expired: 'الغرفة دي انتهت صلاحيتها.', full: 'الغرفة اكتملت (6 لاعبين كحد أقصى).' }[e && e.k];
      V.err = m || 'تعذّر الانضمام. اتأكد من الكود والاتصال وحاول تاني.';
      if (!m) console.warn('[arena] join', e);
      render();
    }
  }

  /* ───────── الاشتراك في الغرفة (مستمعين اتنين بس: الغرفة + اللاعبين) ───────── */
  function attach(rid) {
    detach();
    S = { rid: rid, uid: me().uid, off: 0, bestRtt: 1e9, room: null, players: {}, t0: 0, q: {}, k: {}, ans: {}, my: {}, rev: {}, pend: {}, nextTry: {}, unsub: [], hbSent: 0, lastLs: 0 };
    ls('nbArenaRoom', rid);
    var rr = rref(rid);
    S.unsub.push(rr.onSnapshot({ includeMetadataChanges: true }, function (d) {
      if (!d.exists) { gone('الغرفة اتقفلت.'); return; }
      S.room = d.data();
      if (S.room.st === 'play' && S.room.t0 && !d.metadata.hasPendingWrites) { var t = S.room.t0.toMillis(); if (t !== S.t0) { S.t0 = t; hb(); } }
      render();
    }, function (e) { console.warn('[arena] room', e); gone('انقطع الاتصال بالغرفة.'); }));
    S.unsub.push(rr.collection('pl').onSnapshot({ includeMetadataChanges: true }, function (sn) {
      var m = {};
      sn.forEach(function (d) {
        var x = d.data();
        m[d.id] = { n: x.n, ph: x.ph, tm: x.tm, ls: x.ls ? x.ls.toMillis() : null, j: x.j ? x.j.toMillis() : 0 };
        if (d.id === S.uid && !d.metadata.hasPendingWrites && x.ls) mySnap(x.ls.toMillis());
      });
      S.players = m;
      if (!m[S.uid] && S.room && !sn.metadata.fromCache) { gone('لم تعد ضمن هذه الغرفة.'); return; }
      render();
    }, function (e) { console.warn('[arena] players', e); gone('انقطع الاتصال بالغرفة.'); }));
    S.hbT = setInterval(hb, 30000);
    S.tk = setInterval(tick, 250);
    setTimeout(hb, 2600);
    V = { view: 'room', key: '' };
    render();
  }
  function gone(msg) {
    detach(); ls('nbArenaRoom', null);
    V = { view: 'hub', err: msg, key: '' };
    render();
  }
  /* ───────── نبض الحضور + معايرة ساعة السيرفر (أقل زمن رحلة = أدق عينة) ───────── */
  function hb() {
    if (!S || !S.room || S.lsInit === undefined) return;
    var sess = S;
    S.hbSent = Date.now();
    rref(S.rid).collection('pl').doc(S.uid).update({ ls: SV() }).catch(function () { if (sess === S) S.hbSent = 0; /* offline أو خرجنا من الغرفة: هيتعاد في النبضة الجاية */ });
  }
  /* أول snapshot لمستندي = القيمة القديمة (بس بنسجّلها وبعدين نبعت أول نبضة)؛ أي قيمة جديدة بعد كده = ناتج نبضتي: ls(سيرفر) ≈ منتصف رحلة الذهاب والإياب */
  function mySnap(ms) {
    if (S.lsInit === undefined) { S.lsInit = ms; S.lastLs = ms; setTimeout(hb, 30); return; }
    if (ms === S.lastLs) return;
    S.lastLs = ms;
    if (!S.hbSent) return;
    var rtt = Date.now() - S.hbSent;
    if (rtt <= S.bestRtt + 40) { S.bestRtt = Math.min(S.bestRtt, rtt); S.off = ms - (S.hbSent + rtt / 2); }
    S.hbSent = 0;
  }

  /* ───────── الجدول الزمني ───────── */
  function phase() {
    if (!S || !S.t0) return null;
    var el = srvNow() - S.t0;
    if (el < LEAD) return { k: 'lead', i: 0, left: LEAD - el };
    var x = el - LEAD, i = Math.floor(x / SLOT);
    if (i >= NQ) return { k: 'done', i: NQ - 1, left: 0 };
    var w = x - i * SLOT;
    return w < QDUR ? { k: 'q', i: i, left: QDUR - w } : { k: 'r', i: i, left: SLOT - w };
  }
  function fetchOnce(key, fn) {
    if (S.pend[key] || (S.nextTry[key] && Date.now() < S.nextTry[key])) return;
    S.pend[key] = 1;
    var sess = S;
    fn().then(function () { if (sess === S) { render(); } }).catch(function (e) {
      if (sess === S) { S.nextTry[key] = Date.now() + 450; if (e && e.code && e.code !== 'permission-denied' && e.code !== 'unavailable') console.warn('[arena] ' + key, e.code); }
    }).then(function () { if (sess === S) S.pend[key] = 0; });
  }
  function ensureQ(i) {
    if (S.q[i] || srvNow() < openT(i)) return;
    fetchOnce('q' + i, function () { return rref(S.rid).collection('q').doc(String(i)).get().then(function (d) { if (d.exists) S.q[i] = d.data(); else throw { code: 'nf' }; }); });
  }
  function ensureRev(i) {
    if (S.rev[i] || srvNow() < closeT(i) + 80) return;
    fetchOnce('r' + i, function () {
      var rr = rref(S.rid);
      var jobs = [rr.collection('k').doc(String(i)).get().then(function (d) { if (!d.exists) throw { code: 'nf' }; S.k[i] = d.data(); })];
      Object.keys(S.players).forEach(function (u) {
        jobs.push(rr.collection('ans').doc(u + '_' + i).get().then(function (d) { S.ans[u + '_' + i] = d.exists ? { c: d.data().c, t: d.data().t.toMillis() } : null; }));
      });
      return Promise.all(jobs).then(function () { S.rev[i] = true; });
    });
  }
  function tick() {
    if (!S || !S.room) return;
    if (S.room.st === 'lobby') return;   /* اللوبي بيتعاد رسمه مع تغيّرات الغرفة/اللاعبين بس (مش كل 250ms) */
    var p = phase();
    if (!p) { render(); return; }
    if (p.k === 'q' || p.k === 'r') ensureQ(p.i);
    for (var i = 0; i <= p.i; i++) {
      if (i < p.i || p.k === 'r' || p.k === 'done') { ensureRev(i); if (p.k === 'done') ensureQ(i); }
    }
    if (p.k === 'done' && !S.doneAt) { S.doneAt = Date.now(); clearInterval(S.hbT); }
    render();
  }

  /* ───────── النقاط (مشتقّة من إجابات السيرفر + المفاتيح) ───────── */
  function pts(uid, i) {
    var a = S.ans[uid + '_' + i], k = S.k[i];
    if (!a || !k || a.c !== k.c) return 0;
    var el = Math.max(0, Math.min(QDUR, a.t - openT(i)));
    return 100 + Math.round(BONUS * (QDUR - el) / QDUR);
  }
  function totals() {
    var t = {};
    Object.keys(S.players).forEach(function (u) { t[u] = 0; for (var i = 0; i < NQ; i++) if (S.rev[i]) t[u] += pts(u, i); });
    return t;
  }
  function teamTotals(t) { var r = [0, 0]; Object.keys(S.players).forEach(function (u) { r[S.players[u].tm ? 1 : 0] += t[u] || 0; }); return r; }
  function correctCount(u) { var n = 0; for (var i = 0; i < NQ; i++) if (S.rev[i] && pts(u, i) > 0) n++; return n; }
  function ranked(t) { return Object.keys(S.players).sort(function (a, b) { return (t[b] - t[a]) || (S.players[a].j - S.players[b].j); }); }

  /* ───────── أفعال اللاعب ───────── */
  function answer(i, c) {
    var p = phase();
    if (!p || p.k !== 'q' || p.i !== i || p.left < 200 || S.my[i]) { if (!S.my[i]) toast('انتهى وقت السؤال'); return; }
    S.my[i] = { c: c };
    try { if (navigator.vibrate) navigator.vibrate(15); } catch (e) { /* ignore */ }
    render();
    var sess = S;
    rref(S.rid).collection('ans').doc(S.uid + '_' + i).set({ u: S.uid, i: i, c: c, t: SV() }).catch(function (e) {
      if (sess === S) { S.my[i].late = true; render(); }
      console.warn('[arena] answer rejected', e && e.code);
    });
  }
  async function switchTeam() {
    var rr = rref(S.rid), pr = rr.collection('pl').doc(S.uid);
    try {
      await window.db.runTransaction(async function (tx) {
        var r = (await tx.get(rr)).data(), pl = (await tx.get(pr)).data();
        if (r.st !== 'lobby' || r.md !== 't') throw { k: 'x' };
        var nt = pl.tm ? 0 : 1, dlt = nt === 0 ? 1 : -1;
        tx.update(rr, { na: r.na + dlt, nb: r.nb - dlt });
        tx.update(pr, { tm: nt });
      });
    } catch (e) { toast('تعذّر تبديل الفريق، جرّب تاني', 'err'); }
  }
  async function leaveLobby() {
    if (!S) return;
    var rid = S.rid, r = S.room, uid = S.uid, others = Object.keys(S.players).filter(function (u) { return u !== uid; }).sort(function (a, b) { return S.players[a].j - S.players[b].j; });
    var rr = rref(rid), pr = rr.collection('pl').doc(uid);
    try {
      if (r && r.st === 'lobby') {
        if (r.host === uid && !others.length) { await cleanup(rid); }
        else {
          if (r.host === uid) await rr.update({ host: others[0] });
          await window.db.runTransaction(async function (tx) {
            var rs = (await tx.get(rr)).data(), pl = (await tx.get(pr)).data(), up = { pc: rs.pc - 1 };
            if (rs.md === 't') { if (pl.tm === 0) up.na = rs.na - 1; else up.nb = rs.nb - 1; }
            tx.update(rr, up); tx.delete(pr);
          });
        }
      }
    } catch (e) { console.warn('[arena] leave', e); }
    ls('nbArenaRoom', null); detach(); V = { view: 'hub', key: '' }; render();
  }
  async function takeHost(uid) { try { await rref(S.rid).update({ host: uid }); } catch (e) { toast('تعذّر نقل الإدارة', 'err'); } }
  async function cleanup(rid) {
    var rr = rref(rid), b = window.db.batch(), ids = [];
    try { var pl = await rr.collection('pl').get(); pl.forEach(function (d) { ids.push(d.id); }); } catch (e) { /* مش عضو */ }
    ids.forEach(function (u) { b.delete(rr.collection('pl').doc(u)); for (var i = 0; i < NQ; i++) b.delete(rr.collection('ans').doc(u + '_' + i)); });
    for (var i = 0; i < NQ; i++) { b.delete(rr.collection('q').doc(String(i))); b.delete(rr.collection('k').doc(String(i))); }
    b.delete(rr);
    try { await b.commit(); } catch (e) { console.warn('[arena] cleanup', e && e.code); }
  }
  /* تنضيف غرف المضيف القديمة (استعلام واحد بحد 5) — بيتعمل مرة عند فتح الساحة */
  async function sweep() {
    try {
      var u = me(), now = Date.now(), sn = await window.db.collection('arena_rooms').where('host', '==', u.uid).limit(5).get(), jobs = [];
      sn.forEach(function (d) {
        var r = d.data(), over = (r.exp && r.exp.toMillis() < now) || (r.st === 'play' && r.t0 && r.t0.toMillis() + 280000 < now);
        if (over && d.id !== (S && S.rid)) jobs.push(cleanup(d.id));
      });
      await Promise.all(jobs);
    } catch (e) { /* ignore */ }
  }
  /* توليد الأسئلة (طلب واحد للغرفة) مع إعادة محاولة وتعامل مع الأخطاء */
  async function genQuestions() {
    var key = specKey(S.room.sp), lastErr = 'تعذّر تجهيز الأسئلة، حاول تاني.';
    for (var a = 0; a < 3; a++) {
      try {
        var u = me(), tok = await u.getIdToken(), hd = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok };
        if (typeof window.nbDevId === 'function') hd['X-NB-Device'] = window.nbDevId();
        var ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 58000);
        var r;
        try { r = await fetch('/api/farm-ai', { method: 'POST', headers: hd, body: JSON.stringify({ mode: 'arena_gen', rid: S.rid, spec: key }), signal: ctl.signal }); } finally { clearTimeout(tm); }
        if (r.ok) return;
        var j = await r.json().catch(function () { return {}; });
        if (r.status === 409) { var d = await rref(S.rid).get(); if (d.exists && d.data().qr) return; throw new Error('الغرفة اتغيّرت، ارجع للوبي وحاول تاني.'); }
        if (r.status === 429) throw Object.assign(new Error('وصلت للحد اليومي لتوليد الأسئلة. جرّب بكرة.'), { fatal: 1 });
        if (r.status === 401 || r.status === 403 || r.status === 404 || r.status === 410 || r.status === 400) throw Object.assign(new Error('تعذّر تجهيز الأسئلة (' + (j.error || r.status) + ').'), { fatal: 1 });
        lastErr = 'الذكاء الاصطناعي مشغول دلوقتي، جاري إعادة المحاولة…';
      } catch (e) {
        if (e && e.fatal) throw e;
        if (e && e.message && /الغرفة اتغيّرت/.test(e.message)) throw e;
        lastErr = 'تعذّر تجهيز الأسئلة. اتأكد من الاتصال وحاول تاني.';
      }
      await sleep(1500 * (a + 1));
    }
    throw new Error(lastErr);
  }
  async function startGame() {
    if (V.busy) return;
    V.busy = true; V.err = ''; render();
    try {
      if (!S.room.qr) await genQuestions();
      await rref(S.rid).update({ st: 'play', t0: SV() });
    } catch (e) {
      V.err = (e && e.code === 'permission-denied') ? 'تغيّر عدد اللاعبين أو الفرق. راجع القائمة وحاول تاني.' : ((e && e.message) || 'تعذّر بدء اللعبة.');
    }
    V.busy = false; render();
  }
  function shareLink() { return location.origin + '/?arena=' + S.rid; }
  async function share() {
    var txt = 'تعالى نلعب مسابقة زراعية في ساحة نبتيكس! الكود: ' + S.rid;
    try { if (navigator.share) { await navigator.share({ title: 'ساحة نبتيكس', text: txt, url: shareLink() }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    copy(txt + '\n' + shareLink(), 'اتنسخ لينك الدعوة');
  }
  function copy(text, msg) {
    var done = function () { toast(msg || 'اتنسخ', 'ok'); };
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).then(done, function () { fb(); }); } else fb();
    function fb() { var t = h('textarea', { style: 'position:fixed;opacity:0' }); t.value = text; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); done(); } catch (e) { toast('انسخ الكود يدويًا', 'err'); } t.remove(); }
  }

  /* ───────── الواجهة ───────── */
  function top(title, onClose) {
    return h('div', { class: 'nba-top' }, [
      h('div', { class: 'nba-ttl' }, [h('div', { class: 'nba-logo' }, [ico(I.bolt)]), h('span', { text: title || 'ساحة نبتيكس' })]),
      h('button', { class: 'nba-x', 'aria-label': 'إغلاق', onclick: onClose || close }, [ico(I.x)])
    ]);
  }
  function viewKey() {
    if (!S) return V.view + (V.busy ? ':b' : '') + (V.err || '');
    if (!S.room) return 'load';
    if (S.room.st === 'lobby') return 'lobby';
    var p = phase();
    if (!p) return 'wait';
    return p.k + ':' + p.i + ':' + (S.q[p.i] ? 1 : 0) + ':' + (S.rev[p.i] ? 1 : 0) + ':' + (S.my[p.i] ? (S.my[p.i].late ? 'l' : 'a') : 'n') + (p.k === 'done' ? ':' + Object.keys(S.rev).length : '');
  }
  function render() {
    if (!root) return;
    var key = viewKey(), w = root.firstChild;
    if (key === V.key && V.live) { V.live(); return; }
    var always = key === 'lobby';
    if (key === V.key && !always) return;
    V.key = key; V.live = null;
    var y = root.scrollTop;
    w.innerHTML = '';
    if (!S) { (V.view === 'create' ? vCreate : V.view === 'join' ? vJoin : vHub)(w); }
    else if (!S.room) w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري تحميل الغرفة…']));
    else if (S.room.st === 'lobby') vLobby(w);
    else vGame(w);
    if (always) root.scrollTop = y;
  }
  function errBox() { return V.err ? h('div', { class: 'nba-err', text: V.err }) : document.createDocumentFragment(); }

  function vHub(w) {
    var saved = ls('nbArenaRoom');
    w.appendChild(top());
    w.appendChild(h('div', { class: 'nba-card nba-hero' }, [h('h2', { text: 'تحدّى أصحابك في الزراعة' }), h('p', { text: 'غرف خاصة من 2 لـ 6 لاعبين، 10 أسئلة بالذكاء الاصطناعي في تخصصك، ونقاط لحظية. اللي بيجاوب أسرع بياخد أكتر.' })]));
    w.appendChild(errBox());
    if (saved) w.appendChild(h('div', { class: 'nba-card' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'عندك غرفة شغّالة: ' + saved }), h('div', { class: 'nba-seg' }, [
      h('button', { class: 'nba-btn', onclick: function () { joinRoom(saved); } }, ['ارجع للغرفة']),
      h('button', { class: 'nba-btn sec', onclick: function () { ls('nbArenaRoom', null); V.key = ''; render(); } }, ['تجاهل'])])]));
    w.appendChild(h('div', { class: 'nba-card' }, [
      h('button', { class: 'nba-btn', onclick: function () { V = { view: 'create', md: 's', mx: 4, sp: 'pp' }; render(); } }, [ico(I.users), 'إنشاء غرفة جديدة']),
      h('div', { class: 'nba-lbl', text: 'أو انضم بكود صاحبك' }),
      h('input', { class: 'nba-in', id: 'nba-code', maxlength: '6', placeholder: 'ABC234', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: V.code || '', onkeydown: function (e) { if (e.key === 'Enter') joinRoom(e.target.value); } }),
      h('button', { class: 'nba-btn sec', style: 'margin-top:10px', onclick: function () { joinRoom($('#nba-code').value); } }, ['انضمام'])]));
  }
  function vJoin(w) {
    w.appendChild(top());
    w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:70px auto 12px' }), 'جاري الانضمام للغرفة ' + (V.code || '') + '…']));
  }
  function vCreate(w) {
    var o = V, teams = o.md === 't', mxs = teams ? [2, 4, 6] : [2, 3, 4, 5, 6];
    if (mxs.indexOf(o.mx) === -1) o.mx = teams ? 4 : 4;
    w.appendChild(top('غرفة جديدة', function () { V = { view: 'hub' }; render(); }));
    w.appendChild(errBox());
    var seg = function (items, cur, fn) { return h('div', { class: 'nba-seg' }, items.map(function (it) { return h('button', { class: 'nba-btn ' + (cur === it[0] ? '' : 'sec') + ' sm', style: 'flex:1;justify-content:center', onclick: function () { fn(it[0]); } }, [it[1]]); })); };
    w.appendChild(h('div', { class: 'nba-card' }, [
      h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'نمط اللعب' }),
      seg([['s', 'فردي'], ['t', 'فريقين']], o.md, function (v) { o.md = v; V.key = ''; render(); }),
      h('div', { class: 'nba-lbl', text: teams ? 'عدد اللاعبين (فريقين متساويين)' : 'الحد الأقصى للاعبين' }),
      seg(mxs.map(function (n) { return [n, String(n)]; }), o.mx, function (v) { o.mx = v; V.key = ''; render(); }),
      h('div', { class: 'nba-lbl', text: 'التخصص' }),
      h('div', { class: 'nba-chips' }, SPECS.map(function (s) { return h('button', { class: 'nba-chip' + (o.sp === s[0] ? ' on' : ''), onclick: function () { o.sp = s[0]; V.key = ''; render(); } }, [s[1]]); }))]));
    w.appendChild(h('button', { class: 'nba-btn', disabled: !!o.busy, onclick: function () { createRoom({ md: o.md, mx: o.mx, sp: o.sp }); } }, [o.busy ? h('div', { class: 'nba-spin' }) : null, o.busy ? 'جاري الإنشاء…' : 'إنشاء الغرفة']));
  }

  function playerRow(uid, p, extra) {
    var onl = p.ls && (srvNow() - p.ls) < STALE, r = S.room;
    return h('div', { class: 'nba-row' }, [avatar(uid, p, 38), h('div', { class: 'nm', text: p.n + (uid === S.uid ? ' (أنت)' : '') }),
      r.host === uid ? h('span', { class: 'nba-tag g', title: 'المضيف' }, [ico(I.crown)]) : null,
      extra || null, h('span', { class: 'nba-dot' + (onl ? ' on' : ''), title: onl ? 'متصل' : 'غير متصل' })]);
  }
  function vLobby(w) {
    var r = S.room, uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), isHost = r.host === S.uid, teams = r.md === 't';
    var hostP = S.players[r.host], hostStale = !hostP || !hostP.ls || (srvNow() - hostP.ls) > STALE;
    var balanced = !teams || (r.pc % 2 === 0 && r.na === r.nb), canStart = isHost && r.pc >= 2 && balanced && !V.busy;
    w.appendChild(top('الغرفة', leaveLobby));
    w.appendChild(h('div', { class: 'nba-card' }, [
      h('div', { class: 'nba-code', text: S.rid }),
      h('div', { class: 'nba-seg', style: 'margin-top:10px' }, [
        h('button', { class: 'nba-btn sec sm', onclick: function () { copy(S.rid, 'اتنسخ الكود'); } }, [ico(I.copy), 'نسخ الكود']),
        h('button', { class: 'nba-btn sm', onclick: share }, [ico(I.share), 'دعوة صديق'])]),
      h('div', { class: 'nba-meta' }, [h('span', { class: 'nba-tag', text: r.sp }), h('span', { class: 'nba-tag', text: teams ? 'فريقين' : 'فردي' }), h('span', { class: 'nba-tag', text: r.pc + ' / ' + r.mx + ' لاعبين' }), h('span', { class: 'nba-tag', text: '10 أسئلة' })])]));
    if (V.err) w.appendChild(errBox());
    if (teams) {
      var col = function (t) {
        return h('div', { class: 'nba-team ' + (t ? 'b' : 'a') }, [h('h4', {}, [h('span', { text: t ? 'الفريق ب' : 'الفريق أ' }), h('span', { class: 'nba-tag' + (t ? ' g' : ''), text: String(t ? r.nb : r.na) })])].concat(
          uids.filter(function (u) { return (S.players[u].tm ? 1 : 0) === t; }).map(function (u) {
            return playerRow(u, S.players[u], u === S.uid ? h('button', { class: 'nba-btn sec sm', style: 'padding:5px 8px', title: 'تبديل الفريق', onclick: switchTeam }, [ico(I.swap)]) : null);
          })));
      };
      w.appendChild(h('div', { class: 'nba-card' }, [h('div', { class: 'nba-teams' }, [col(0), col(1)])]));
      if (!balanced) w.appendChild(h('div', { class: 'nba-note', text: 'لازم الفريقين يبقوا متساويين (2 أو 4 أو 6 لاعبين). حد يبدّل فريقه أو انتظر لاعب جديد.' }));
    } else {
      w.appendChild(h('div', { class: 'nba-card' }, uids.map(function (u) {
        return playerRow(u, S.players[u], isHost && u !== S.uid ? h('button', { class: 'nba-btn sec sm', style: 'padding:5px 8px', title: 'نقل الإدارة', onclick: function () { takeHost(u); } }, [ico(I.crown)]) : null);
      })));
    }
    if (isHost) {
      w.appendChild(h('button', { class: 'nba-btn gold', disabled: !canStart, onclick: startGame }, [V.busy ? h('div', { class: 'nba-spin' }) : ico(I.bolt), V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة بالذكاء الاصطناعي… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة')]));
      if (r.pc < 2) w.appendChild(h('div', { class: 'nba-note', text: 'محتاج لاعب واحد على الأقل. ابعت الكود لصاحبك.' }));
    } else {
      w.appendChild(h('div', { class: 'nba-note' }, [r.qr ? 'الأسئلة جاهزة — في انتظار المضيف يبدأ اللعبة…' : 'في انتظار المضيف يبدأ اللعبة…']));
      if (hostStale) w.appendChild(h('button', { class: 'nba-btn sec', onclick: function () { takeHost(S.uid); } }, [ico(I.crown), 'المضيف مش متصل — تولّى الإدارة']));
    }
  }

  function boardCard(t, upTo) {
    var teams = S.room.md === 't', order = ranked(t), card = h('div', { class: 'nba-card' });
    if (teams) {
      var tt = teamTotals(t);
      card.appendChild(h('div', { class: 'nba-teams', style: 'margin-bottom:8px' }, [0, 1].map(function (x) { return h('div', { class: 'nba-team ' + (x ? 'b' : 'a'), style: 'text-align:center' }, [h('h4', { style: 'justify-content:center' }, [x ? 'الفريق ب' : 'الفريق أ']), h('div', { class: 'sc nba-tm', style: 'color:inherit', text: String(tt[x]) })]); })));
    }
    order.forEach(function (u, i) {
      var p = S.players[u];
      card.appendChild(h('div', { class: 'nba-lead' + (u === S.uid ? ' me' : '') }, [h('span', { class: 'rk', text: String(i + 1) }), avatar(u, p, 32), h('span', { class: 'nm', style: 'flex:1;font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', text: p.n + (teams ? (p.tm ? ' · ب' : ' · أ') : '') }), upTo != null && S.rev[upTo] && pts(u, upTo) ? h('span', { class: 'nba-tag', text: '+' + pts(u, upTo) }) : null, h('span', { class: 'sc', text: String(t[u]) })]));
    });
    return card;
  }
  function vGame(w) {
    var p = phase();
    if (!p) { w.appendChild(top('اللعبة', close)); w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري مزامنة وقت اللعبة…'])); return; }
    if (p.k === 'lead') {
      w.appendChild(top('اللعبة', close));
      var big = h('div', { class: 'nba-big' });
      w.appendChild(big); w.appendChild(h('div', { class: 'nba-note', text: 'جهّز نفسك… السؤال الأول بعد لحظات. الإجابة بتتقفل أول ما تضغط!' }));
      V.live = function () { var q = phase(); big.textContent = q && q.k === 'lead' ? String(Math.max(1, Math.ceil(q.left / 1000))) : '…'; }; V.live();
      return;
    }
    if (p.k === 'done') { vResults(w); return; }
    var i = p.i, q = S.q[i], my = S.my[i], revealed = p.k === 'r';
    w.appendChild(top('اللعبة', close));
    var fill = h('i'), tmEl = h('div', { class: 'nba-tm' });
    w.appendChild(h('div', { class: 'nba-qh' }, [h('span', { text: 'السؤال ' + (i + 1) + ' / ' + NQ }), q ? h('span', { class: 'nba-tag' + (q.d === 'h' ? ' g' : ''), text: DIFF[q.d] || '' }) : null, tmEl]));
    w.appendChild(h('div', { class: 'nba-bar' }, [fill]));
    if (!q) { w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:44px auto 12px' }), 'جاري تحميل السؤال…'])); }
    else {
      w.appendChild(h('div', { class: 'nba-q', text: q.q }));
      var k = revealed && S.rev[i] ? S.k[i] : null;
      q.o.forEach(function (txt, n) {
        var cls = 'nba-opt';
        if (k) { if (n === k.c) cls += ' ok'; else if (my && my.c === n) cls += ' no'; else cls += ' dim'; } else if (my && my.c === n) cls += ' sel';
        w.appendChild(h('button', { class: cls, disabled: !!(my || revealed), onclick: function () { answer(i, n); } }, [h('span', { class: 'lt', text: LETTERS[n] }), h('span', { text: txt })]));
      });
      if (!revealed) {
        w.appendChild(h('div', { class: 'nba-lock', text: my ? (my.late ? 'إجابتك وصلت متأخرة ولم تُحتسب' : 'اتقفلت إجابتك — استنى بقية اللاعبين') : 'اختار إجابتك بسرعة — السرعة بتزوّد النقاط' }));
      } else if (k) {
        var g = pts(S.uid, i);
        w.appendChild(h('div', { class: 'nba-gain ' + (g ? 'ok' : 'no'), text: g ? '+' + g + ' نقطة' : (my ? 'إجابة غير صحيحة' : 'لم تجاوب') }));
        if (k.e) w.appendChild(h('div', { class: 'nba-xp', text: k.e }));
        w.appendChild(h('div', { style: 'height:12px' }));
        w.appendChild(boardCard(totals(), i));
      } else w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:20px auto 8px' }), 'جاري احتساب النتيجة…']));
    }
    V.live = function () {
      var c = phase(); if (!c || c.i !== i) return;
      var total = c.k === 'q' ? QDUR : SLOT - QDUR, left = Math.max(0, c.left);
      fill.style.width = (left / total * 100) + '%'; fill.className = c.k === 'q' && left < 5000 ? 'lo' : '';
      tmEl.textContent = c.k === 'q' ? String(Math.ceil(left / 1000)) : ''; tmEl.className = 'nba-tm' + (c.k === 'q' && left < 5000 ? ' lo' : '');
    };
    V.live();
  }
  function vResults(w) {
    var t = totals(), order = ranked(t), teams = S.room.md === 't', tt = teams ? teamTotals(t) : null, isHost = S.room.host === S.uid;
    w.appendChild(top('النتيجة النهائية', function () { leaveGame(); }));
    var ready = Object.keys(S.rev).length >= NQ, title, sub;
    if (!ready) { w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري احتساب النتيجة النهائية…'])); return; }
    if (teams) { title = tt[0] === tt[1] ? 'تعادل بين الفريقين!' : (tt[0] > tt[1] ? 'الفريق أ فاز!' : 'الفريق ب فاز!'); sub = tt[0] + ' × ' + tt[1]; }
    else { var top1 = order.filter(function (u) { return t[u] === t[order[0]]; }); title = top1.length > 1 ? 'تعادل على المركز الأول!' : S.players[order[0]].n + ' هو البطل!'; sub = t[order[0]] + ' نقطة'; }
    w.appendChild(h('div', { class: 'nba-card nba-win' }, [h('div', { class: 'tr' }, [ico(I.trophy)]), h('h2', { text: title }), h('p', { text: sub })]));
    if (!teams && order.length >= 2) {
      var pod = h('div', { class: 'nba-pod' });
      [1, 0, 2].forEach(function (pi) { var u = order[pi]; if (!u) return; pod.appendChild(h('div', { class: 'p' + (pi + 1) }, [avatar(u, S.players[u], 44), h('small', { text: S.players[u].n }), h('div', { class: 'st', text: String(t[u]) })])); });
      w.appendChild(h('div', { class: 'nba-card' }, [pod]));
    }
    var board = boardCard(t, null);
    order.forEach(function (u, i) { var rows = board.querySelectorAll('.nba-lead'); if (rows[i]) rows[i].insertBefore(h('span', { class: 'nba-tag', text: correctCount(u) + '/' + NQ }), rows[i].lastChild); });
    w.appendChild(board);
    var rv = h('div', { class: 'nba-card' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'مراجعة الأسئلة' })]);
    for (var i = 0; i < NQ; i++) {
      var q = S.q[i], k = S.k[i]; if (!q || !k) continue;
      rv.appendChild(h('div', { class: 'nba-rv' }, [h('b', { text: (i + 1) + '. ' + q.q }), h('div', { class: 'ca', text: 'الصحيح: ' + LETTERS[k.c] + ' — ' + q.o[k.c] }), k.e ? h('div', { text: k.e }) : null,
        S.my[i] && S.my[i].c !== undefined ? h('div', { style: 'color:var(--muted);font-size:12px', text: pts(S.uid, i) ? 'جاوبت صح (+' + pts(S.uid, i) + ')' : 'إجابتك: ' + (q.o[S.my[i].c] || '—') }) : null]));
    }
    w.appendChild(rv);
    w.appendChild(h('button', { class: 'nba-btn', onclick: function () { leaveGame(); } }, [isHost ? 'إنهاء الغرفة والرجوع' : 'خروج']));
  }
  async function leaveGame() {
    var rid = S && S.rid, host = S && S.room && S.room.host === S.uid;
    ls('nbArenaRoom', null); detach(); V = { view: 'hub', key: '' };
    if (rid && host) cleanup(rid);
    render();
  }

  /* ───────── تسجيل الدخول المؤجّل + لينك الدعوة (?arena=CODE) ───────── */
  function boot() {
    if (!window.auth || !window.auth.onAuthStateChanged) return;
    var first = true;
    window.auth.onAuthStateChanged(function (u) {
      var code = '';
      try { var q = new URLSearchParams(location.search).get('arena'); if (q && first) { code = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6); var url = new URL(location.href); url.searchParams.delete('arena'); history.replaceState(null, '', url.pathname + (url.search || '') + url.hash); if (code) sessionStorage.setItem('nbArenaPending', code); } } catch (e) { /* ignore */ }
      first = false;
      if (!u) { if (root) close(); return; }
      var pend = null; try { pend = sessionStorage.getItem('nbArenaPending'); sessionStorage.removeItem('nbArenaPending'); } catch (e) { /* ignore */ }
      if (pend) open({ code: pend === '1' ? '' : pend });
    });
  }
  window.NbArena = { open: open, close: close, join: function (c) { open({ code: c }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
