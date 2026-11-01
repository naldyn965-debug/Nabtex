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
  var ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', COLS = ['#3f7d4e', '#a8802c', '#2f6f94', '#9b3f6e', '#6a58a6', '#a85a31'];
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
  function ico(path) { var d = document.createElement('span'); d.className = 'nba-ico'; d.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + path + '</svg>'; return d; }
  var I = {
    x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/>',
    crown: '<path d="M3 18l2-11 5 5 2-8 2 8 5-5 2 11z"/>',
    swap: '<path d="M7 4l-4 4 4 4"/><path d="M3 8h14"/><path d="M17 20l4-4-4-4"/><path d="M21 16H7"/>',
    bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>',
    leaf: '<path d="M12 21v-7"/><path d="M12 14c0-4.4-3.4-7-8-7 0 4.6 3 7 8 7z"/><path d="M12 11c0-3.8 2.6-6.4 8-6.4 0 4.2-3 6.4-8 6.4z"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4.5h12l-2.6 3.8L17 12H5"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    fire: '<path d="M12 2c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
    vol: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14"/>',
    mute: '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="22" y1="9" x2="16" y2="15"/><line x1="16" y1="9" x2="22" y2="15"/>',
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0z"/><path d="M17 5h3v2a3 3 0 01-3 3M7 5H4v2a3 3 0 003 3"/>',
    users: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>'
  };

  /* ───────── مدير الصوت المركزي (WebAudio مولَّد بالكود — بدون ملفات ولا طلبات شبكة) ─────────
     مفيش أي صوت بيشتغل قبل أول لمسة/ضغطة من المستخدم داخل الساحة. الإعدادات محفوظة (nbArenaSnd / nbArenaVol). */
  var SFX = (function () {
    var ctx = null, mg = null, on = ls('nbArenaSnd') !== '0', vol = parseFloat(ls('nbArenaVol'));
    if (!(vol >= 0 && vol <= 1)) vol = 0.7;
    function apply() { if (mg) mg.gain.value = on ? vol * vol * 0.85 : 0; }
    function unlock() {
      try {
        if (!ctx) { var AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = new AC(); mg = ctx.createGain(); mg.connect(ctx.destination); apply(); }
        if (ctx.state === 'suspended') ctx.resume();
      } catch (e) { ctx = null; }
    }
    function t(f, at, d, type, g, to) {
      if (!ctx || !on || vol <= 0 || ctx.state !== 'running') return;
      var o = ctx.createOscillator(), v = ctx.createGain(), s = ctx.currentTime + (at || 0);
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, s); if (to) o.frequency.exponentialRampToValueAtTime(to, s + d);
      v.gain.setValueAtTime(0.0001, s); v.gain.exponentialRampToValueAtTime(g || 0.2, s + 0.012); v.gain.exponentialRampToValueAtTime(0.0001, s + d);
      o.connect(v); v.connect(mg); o.start(s); o.stop(s + d + 0.05);
    }
    var fx = {
      ui: function () { t(640, 0, 0.05, 'triangle', 0.12); },
      pop: function () { t(440, 0, 0.1, 'sine', 0.2, 880); t(1320, 0.07, 0.08, 'sine', 0.08); },
      pick: function () { t(700, 0, 0.08, 'triangle', 0.22, 1000); t(180, 0, 0.09, 'sine', 0.2); },
      count: function (n) { if (n > 3) t(330, 0, 0.08, 'triangle', 0.14); else { t(420 + (4 - n) * 120, 0, 0.2, 'sine', 0.3); t(210 + (4 - n) * 60, 0, 0.2, 'triangle', 0.2); } },
      go: function () { t(784, 0, 0.14, 'square', 0.1); t(1175, 0.08, 0.45, 'triangle', 0.26); t(1568, 0.08, 0.45, 'sine', 0.12); },
      warn: function () { t(1100, 0, 0.05, 'square', 0.07); },
      correct: function () { [523, 659, 784, 1047].forEach(function (f, i) { t(f, i * 0.07, 0.24, 'triangle', 0.22); }); },
      wrong: function () { t(220, 0, 0.3, 'sawtooth', 0.15, 110); t(165, 0.1, 0.3, 'square', 0.06, 80); },
      win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { t(f, i * 0.11, 0.3, 'triangle', 0.22); }); [523, 659, 784, 1047].forEach(function (f) { t(f, 0.6, 1.2, 'sine', 0.1); }); },
      end: function () { [392, 330, 262].forEach(function (f, i) { t(f, i * 0.17, 0.4, 'sine', 0.18); }); }
    };
    return {
      unlock: unlock,
      play: function (n, a) { try { if (fx[n]) fx[n](a); } catch (e) { /* ignore */ } },
      on: function () { return on; }, vol: function () { return vol; },
      setOn: function (v) { on = !!v; ls('nbArenaSnd', on ? '1' : '0'); apply(); },
      setVol: function (v) { vol = Math.max(0, Math.min(1, v)); ls('nbArenaVol', String(vol)); apply(); }
    };
  })();
  /* ───────── موسيقى اللوبي (ملف MP3 واحد · WebAudio · لوب بدون فجوة) ─────────
     بتبدأ بعد أول لمسة/ضغطة جوّه الساحة، وبتشتغل في شاشات اللوبي بس (الرئيسية / إنشاء / انضمام / غرفة الانتظار) وبتتوقف أثناء اللعب وبتكمّل من نفس المكان لما نرجع للوبي.
     مصدر واحد بس بيتعمل مرة واحدة (loop=true) فمفيش تشغيل مكرّر ولا تداخل. التفضيل محفوظ (nbArenaMus). أي فشل صامت ومش بيأثّر على الساحة. */
  var MUS = (function () {
    var FILE = 'Nabtex_arina_lobby.mp3', KEY = 'nbArenaMus', LEVEL = 0.22, FADE = 0.35;
    var on = ls(KEY) !== '0', gesture = false, dead = false, ctx = null, gain = null, src = null, buf = null, raw = null, deco = false, lvl = 0, tm = 0, fail = 0, hooked = null, vis = false;
    function noop() { /* ignore */ }
    function inLobby() { return !S || !S.room || S.room.st === 'lobby'; }
    function wanted() { return !!(root && on && gesture && !document.hidden && inLobby()); }
    function pre() {   /* تحميل الملف مبكرًا (بدون AudioContext) علشان يبقى جاهز أول ما المستخدم يلمس */
      if (raw || !on || Date.now() - fail < 30000) return;
      raw = fetch(FILE).then(function (r) { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).catch(function () { raw = null; fail = Date.now(); return null; });
    }
    function mk() {
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { dead = true; return false; }
        ctx = new AC(); gain = ctx.createGain(); gain.gain.value = 0; gain.connect(ctx.destination); lvl = 0; return true;
      } catch (e) { ctx = null; dead = true; return false; }
    }
    function dec() {
      if (buf || deco || !ctx) return;
      pre(); if (!raw) return;
      deco = true;
      raw.then(function (ab) {
        if (!ab) throw new Error('fetch');
        return new Promise(function (ok, no) { var p = ctx.decodeAudioData(ab, ok, no); if (p && p.catch) p.catch(no); });
      }).then(function (b) { buf = b; raw = null; deco = false; update(); }, function () { deco = false; raw = null; fail = Date.now(); });
    }
    function setLvl(v, d) {
      if (lvl === v && d) return;
      lvl = v;
      var p = gain.gain, t = ctx.currentTime;
      try { p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); if (d) p.linearRampToValueAtTime(v, t + d); else p.setValueAtTime(v, t); } catch (e) { p.value = v; }
    }
    function sus() { try { var p = ctx.suspend(); if (p && p.catch) p.catch(noop); } catch (e) { /* ignore */ } }
    function update() {
      try {
        if (wanted()) {
          if (tm) { clearTimeout(tm); tm = 0; }
          if (dead) return;
          if (!ctx && !mk()) return;
          if (ctx.state !== 'running') { var rp = ctx.resume(); if (rp && rp.catch) rp.catch(noop); }
          dec();
          if (!buf) return;
          if (!src) { src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(gain); src.start(0); }
          setLvl(LEVEL, FADE);
        } else if (ctx && src && ctx.state === 'running') {
          if (document.hidden) { if (tm) { clearTimeout(tm); tm = 0; } setLvl(0, 0); sus(); return; }
          setLvl(0, FADE);
          if (!tm) tm = setTimeout(function () { tm = 0; if (!wanted() && ctx.state === 'running') sus(); }, FADE * 1000 + 80);
        }
      } catch (e) { /* الصوت مش لازم يكسر الساحة */ }
    }
    function kick() { gesture = true; update(); }
    function hook() {
      if (!vis) { vis = true; document.addEventListener('visibilitychange', update); }
      if (!root || hooked === root) return;
      hooked = root;
      ['pointerup', 'touchend', 'click', 'keydown'].forEach(function (ev) { root.addEventListener(ev, kick, { capture: true, passive: true }); });
    }
    return {
      sync: function () { try { if (S && !S.room) return; if (root && on) pre(); hook(); update(); } catch (e) { /* ignore */ } },
      on: function () { return on; },
      setOn: function (v) { on = !!v; ls(KEY, on ? '1' : '0'); gesture = true; if (on) pre(); update(); }
    };
  })();
  /* زر الصوت (بيتبني مرة واحدة برا الشاشات علشان السلايدر ما يتقطعش مع إعادة الرسم) */
  function sndUI() {
    var pop = h('div', { class: 'nba-pop', hidden: true }), btn = h('button', { class: 'nba-x', 'aria-label': 'إعدادات الصوت', 'aria-haspopup': 'true' }), sw, rng;
    function paint() { btn.innerHTML = ''; btn.appendChild(ico(SFX.on() && SFX.vol() > 0 ? I.vol : I.mute)); btn.className = 'nba-x' + (SFX.on() ? '' : ' off'); sw.setAttribute('aria-checked', SFX.on() ? 'true' : 'false'); }
    sw = h('button', { class: 'nba-sw', role: 'switch', 'aria-label': 'تشغيل المؤثرات الصوتية', onclick: function () { SFX.setOn(!SFX.on()); paint(); if (SFX.on()) SFX.play('pop'); } });
    rng = h('input', { class: 'nba-rng', type: 'range', min: '0', max: '100', step: '5', value: String(Math.round(SFX.vol() * 100)), 'aria-label': 'مستوى الصوت',
      oninput: function () { SFX.setVol(rng.value / 100); if (!SFX.on() && rng.value > 0) { SFX.setOn(true); } paint(); }, onchange: function () { SFX.play('pick'); } });
    pop.appendChild(h('div', { class: 'rw' }, [h('span', { text: 'المؤثرات الصوتية' }), sw]));
    pop.appendChild(h('div', { class: 'nba-cl', style: 'margin-bottom:2px', text: 'مستوى الصوت' }));
    pop.appendChild(rng);
    var ms = h('button', { class: 'nba-sw', role: 'switch', 'aria-label': 'تشغيل موسيقى اللوبي', 'aria-checked': MUS.on() ? 'true' : 'false', onclick: function () { MUS.setOn(!MUS.on()); ms.setAttribute('aria-checked', MUS.on() ? 'true' : 'false'); } });
    pop.appendChild(h('div', { class: 'rw', style: 'margin:12px 0 0' }, [h('span', { text: 'موسيقى اللوبي' }), ms]));
    btn.addEventListener('click', function () { pop.hidden = !pop.hidden; });
    paint();
    return h('div', { class: 'nba-sndbar' }, [h('div', { class: 'nba-snb' }, [btn, pop])]);
  }
  /* ───────── مؤثرات بصرية خفيفة (transform/opacity بس) ───────── */
  function RM() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function once(k) { if (S.fx[k]) return false; S.fx[k] = 1; return true; }
  function fxLayer() {
    var d = h('div', { class: 'nba-fx', 'aria-hidden': 'true' });
    for (var i = 0; i < 8; i++) d.appendChild(h('i', { style: '--x:' + (4 + (i * 12) % 92) + '%;--s:' + (2 + i % 3) + 'px;--d:' + (17 + (i % 5) * 3) + 's;--dl:-' + (i * 2.6).toFixed(1) + 's;--dx:' + ((i % 2 ? 1 : -1) * (20 + (i % 4) * 15)) + 'px' }));
    return d;
  }
  function flash(kind) { if (!root || RM()) return; var f = h('div', { class: 'nba-flash ' + kind, 'aria-hidden': 'true' }); root.appendChild(f); setTimeout(function () { f.remove(); }, 900); }
  function confetti(n) {
    if (!root || RM()) return;
    var c = h('div', { class: 'nba-conf', 'aria-hidden': 'true' }), cols = ['#6fae62', '#a4d28d', '#c9a24a', '#e6cf8a', '#f1ead6', '#4a9a5c'];
    for (var i = 0; i < n; i++) c.appendChild(h('i', { style: '--x:' + (Math.random() * 100).toFixed(1) + '%;--w:' + (6 + Math.random() * 6).toFixed(1) + 'px;--c:' + cols[i % cols.length] + ';--t:' + (2.6 + Math.random() * 2).toFixed(2) + 's;--d:' + (Math.random() * 0.9).toFixed(2) + 's;--dx:' + Math.round(Math.random() * 160 - 80) + 'px;--r:' + Math.round(360 + Math.random() * 720) + 'deg' }));
    root.appendChild(c); setTimeout(function () { c.remove(); }, 6500);
  }
  function countUp(el, from, to, ms, fmt) {
    fmt = fmt || String;
    if (RM() || from === to) { el.textContent = fmt(to); return; }
    el.textContent = fmt(from);
    var s = performance.now();
    requestAnimationFrame(function f(n) {
      var k = Math.min(1, Math.max(0, (n - s) / ms)); k = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * k));
      if (k < 1 && el.isConnected) requestAnimationFrame(f); else el.textContent = fmt(to);
    });
  }
  /* إحصائيات لاعب (مشتقّة من نفس إجابات السيرفر) */
  function stats(u) {
    var c = 0, st = 0, best = 0, sum = 0, fast = 0;
    for (var i = 0; i < NQ; i++) {
      if (S.rev[i] && pts(u, i)) { c++; st++; best = Math.max(best, st); var el = Math.max(0, Math.min(QDUR, S.ans[u + '_' + i].t - openT(i))); sum += el; fast = fast ? Math.min(fast, el) : el; } else st = 0;
    }
    return { c: c, best: best, avg: c ? sum / c : 0, fast: fast };
  }
  function streakAt(u, i) { var n = 0; for (var j = i; j >= 0 && S.rev[j] && pts(u, j); j--) n++; return n; }

  /* ───────── CSS (نظام تصميم الساحة: أخضر غابة + ذهب نحاسي · خط Cairo للنص و Cormorant للأرقام الكبيرة) ───────── */
  function css() {
    if (document.getElementById('nba-css')) return;
    var st = document.createElement('style'); st.id = 'nba-css';
    /* زخرفة سنبلة (خطوط فقط) — بتتستخدم بشفافية عالية كخلفية في الكروت المميّزة */
    var SPRIG = 'url("data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -8 120 148" fill="none" stroke="#c9a24a" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M60 136C57 104 63 72 60 16"/><path transform="translate(59.2,112) scale(1.25,1.25) scale(-1,1) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60.8,121) scale(1.25,1.25) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(59.2,94) scale(1.08,1.08) scale(-1,1) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60.8,103) scale(1.08,1.08) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(59.2,76) scale(0.91,0.91) scale(-1,1) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60.8,85) scale(0.91,0.91) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(59.2,58) scale(0.74,0.74) scale(-1,1) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60.8,67) scale(0.74,0.74) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(59.2,40) scale(0.57,0.57) scale(-1,1) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60.8,49) scale(0.57,0.57) rotate(-52)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/><path transform="translate(60,16) scale(.9) rotate(-90)" d="M0 0C5-7 15-9 22-6 19 1 9 5 0 0Z"/></svg>') + '")';
    st.textContent = [
      '.nba-root{--bg:#0d1f15;--bg2:#102619;--card:#14291d;--card2:#1a3325;--line:rgba(236,226,190,.10);--line2:rgba(236,226,190,.20);--ink:#f1ead6;--ink2:#d3d8c4;--slate:#a8b79d;--muted:#8da386;--leaf:#2f7a42;--leaf-hi:#4a9a5c;--leaf-lo:#1c4f2c;--fern:#6fae62;--sprout:#a4d28d;--brass:#c9a24a;--wheat:#e6cf8a;--antique:#8f7230;--madder:#bb433b;--madder-l:#f0a79f;--parch:#ece3c8;--parch-ink:#1b2a1c;--r2:10px;--r3:12px;--r4:14px;--fd:var(--f-display,\'Cormorant Garamond\'),\'Times New Roman\',serif;--sglow:0 0 0 3px rgba(201,162,74,.22);position:fixed;inset:0;z-index:100000;direction:rtl;font-family:var(--f-ui,Cairo,sans-serif);color:var(--ink);background:radial-gradient(95% 34% at 50% 0,rgba(96,160,102,.18) 0,transparent 72%),linear-gradient(180deg,var(--bg) 0,#0a1a11 100%);overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-top:env(safe-area-inset-top,0px);-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-font-smoothing:antialiased}',
      '.nba-root *{box-sizing:border-box}',
      '.nba-root :focus-visible{outline:2px solid var(--brass);outline-offset:2px}',
      '.nba-fx{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
      '.nba-fx i{position:absolute;top:-18px;left:var(--x);width:calc(var(--s)*3.4);height:calc(var(--s)*3.4);border-radius:0 100% 0 100%;background:var(--fern);opacity:0;animation:nbaFloat var(--d) linear var(--dl) infinite;will-change:transform,opacity}',
      '.nba-wrap{position:relative;z-index:1;max-width:520px;margin:0 auto;padding:12px 16px calc(32px + env(safe-area-inset-bottom,0px))}',
      '.nba-enter>*{animation:nbaIn .45s cubic-bezier(.2,.8,.2,1) both}',
      '.nba-enter>*:nth-child(2){animation-delay:.05s}.nba-enter>*:nth-child(3){animation-delay:.1s}.nba-enter>*:nth-child(4){animation-delay:.15s}.nba-enter>*:nth-child(5){animation-delay:.2s}.nba-enter>*:nth-child(6){animation-delay:.25s}.nba-enter>*:nth-child(n+7){animation-delay:.3s}',
      '.nba-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0 12px;height:60px}',
      '.nba-ttl{display:flex;align-items:center;gap:11px;font-weight:800;font-size:17px;line-height:1.3}',
      '.nba-logo{width:36px;height:36px;border-radius:3px 13px 3px 13px;background:var(--brass);color:#241a05;display:grid;place-items:center;box-shadow:inset 0 0 0 1.5px rgba(36,26,5,.32),0 4px 10px -4px rgba(0,0,0,.6)}',
      '.nba-ico{display:inline-grid;place-items:center;width:18px;height:18px;flex:none}.nba-ico svg{width:100%;height:100%}',
      '.nba-x{width:42px;height:42px;border-radius:var(--r3);border:1px solid var(--line2);background:rgba(236,226,190,.05);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:background .2s,transform .15s}',
      '.nba-x:hover{background:rgba(236,226,190,.11)}.nba-x:active{transform:scale(.94)}',
      '.nba-sndbar{position:absolute;top:calc(env(safe-area-inset-top,0px) + 18px);left:0;right:0;max-width:520px;margin:0 auto;height:0;z-index:6;pointer-events:none}',
      '.nba-snb{position:absolute;left:66px;top:0;pointer-events:auto}',
      '.nba-snb .nba-x.off{color:var(--muted)}',
      '.nba-pop{position:absolute;top:50px;left:0;width:224px;padding:14px;border-radius:var(--r4);background:var(--card2);border:1px solid var(--line2);box-shadow:0 16px 30px -12px rgba(0,0,0,.7);animation:nbaIn .2s ease-out both}',
      '.nba-pop[hidden]{display:none}',
      '.nba-pop .rw{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:13px;margin-bottom:12px}',
      '.nba-sw{position:relative;width:46px;height:26px;border-radius:26px;border:1px solid var(--line2);background:rgba(0,0,0,.3);cursor:pointer;transition:background .2s,border-color .2s;padding:0}',
      '.nba-sw::after{content:"";position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:var(--ink2);transition:transform .2s}',
      '.nba-sw[aria-checked=true]{background:var(--leaf);border-color:var(--leaf-hi)}.nba-sw[aria-checked=true]::after{transform:translateX(-20px);background:var(--ink)}',
      '.nba-rng{width:100%;direction:ltr;accent-color:var(--brass);height:28px;margin:0}',
      '.nba-card{position:relative;background:var(--card);border:1px solid var(--line);border-radius:var(--r4);box-shadow:inset 0 1px 0 rgba(255,255,255,.035),0 12px 22px -16px rgba(0,0,0,.75);padding:16px;margin-bottom:12px}',
      '.nba-card.tight{padding:12px}',
      '.nba-hero,.nba-codecard,.nba-win,.nba-qcard{background:var(--card2);border-color:rgba(201,162,74,.30)}',
      '.nba-hero::before,.nba-codecard::before,.nba-win::before,.nba-qcard::before{content:"";position:absolute;inset:5px;border:1px solid rgba(201,162,74,.22);border-radius:10px;pointer-events:none}',
      '.nba-hero{overflow:hidden;padding:22px 20px}',
      '.nba-hero::after{content:"";position:absolute;left:26px;top:16px;width:70px;height:88px;background:' + SPRIG + ' center/contain no-repeat;opacity:.3;pointer-events:none}',
      '.nba-hero>*{position:relative;z-index:1}',
      '.nba-hero h2{margin:14px 0 6px;font-size:23px;font-weight:800;line-height:1.5}.nba-hero p{margin:0;color:var(--ink2);font-size:14px;line-height:1.9;font-weight:500}',
      '.nba-hb{position:relative;z-index:1;width:46px;height:46px;border-radius:3px 17px 3px 17px;display:grid;place-items:center;color:#241a05;background:var(--brass);box-shadow:inset 0 0 0 1.5px rgba(36,26,5,.32),0 6px 12px -6px rgba(0,0,0,.65)}.nba-hb .nba-ico{width:25px;height:25px}',
      '.nba-btn{position:relative;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border:1px solid var(--leaf-hi);border-radius:var(--r3);padding:12px 16px;font:800 15px var(--f-ui,Cairo,sans-serif);cursor:pointer;color:#f7f2e0;background:var(--leaf);box-shadow:0 3px 0 var(--leaf-lo),0 10px 16px -10px rgba(0,0,0,.7);transition:transform .12s,box-shadow .12s,background .2s,opacity .2s}',
      '.nba-btn:active{transform:translateY(2px);box-shadow:0 1px 0 var(--leaf-lo),0 4px 8px -6px rgba(0,0,0,.7)}',
      '.nba-btn[disabled]{opacity:.45;cursor:not-allowed;box-shadow:none;transform:none}',
      '.nba-btn.sec{background:transparent;color:var(--ink);border:1.5px solid var(--line2);box-shadow:none}',
      '.nba-btn.sec:active{transform:none;background:rgba(236,226,190,.07)}',
      '.nba-btn.gold{color:#241a05;background:var(--brass);border-color:#dfbf6c;box-shadow:0 3px 0 var(--antique),0 10px 16px -10px rgba(0,0,0,.7);font-size:16.5px;min-height:56px}',
      '.nba-btn.gold:active{box-shadow:0 1px 0 var(--antique),0 4px 8px -6px rgba(0,0,0,.7)}',
      '.nba-btn.gold[disabled]{box-shadow:none}',
      '.nba-btn.sm{width:auto;min-height:42px;padding:8px 14px;font-size:13px;border-radius:var(--r2);box-shadow:0 2px 0 var(--leaf-lo)}',
      '.nba-btn.sm:active{box-shadow:0 0 0 var(--leaf-lo)}',
      '.nba-btn.sm.sec{box-shadow:none}',
      '.nba-ib{flex:none;width:38px;height:38px;border-radius:var(--r2);border:1px solid var(--line2);background:rgba(236,226,190,.05);color:var(--wheat);display:grid;place-items:center;cursor:pointer;transition:transform .15s,background .2s}.nba-ib:active{transform:scale(.92)}.nba-ib:hover{background:rgba(236,226,190,.11)}',
      '@media (hover:hover){.nba-btn:not([disabled]):not(.sec):hover{background:#37884b}.nba-btn.gold:not([disabled]):hover{background:#d3ad58}.nba-btn.sec:hover{background:rgba(236,226,190,.07)}.nba-chip:hover{border-color:rgba(201,162,74,.55)}.nba-opt:not([disabled]):hover{border-color:rgba(201,162,74,.55)}}',
      '.nba-in{width:100%;border:1.5px solid var(--line2);border-radius:var(--r3);padding:13px;font:800 22px var(--f-ui,Cairo,sans-serif);letter-spacing:.35em;text-align:center;text-transform:uppercase;background:var(--bg);color:var(--wheat);direction:ltr;box-shadow:inset 0 2px 6px rgba(0,0,0,.4)}',
      '.nba-in::placeholder{color:var(--muted);opacity:.55}',
      '.nba-in:focus{outline:0;border-color:var(--brass);box-shadow:inset 0 2px 6px rgba(0,0,0,.4),var(--sglow)}',
      '.nba-lbl{font-weight:700;font-size:13px;color:var(--slate);margin:18px 0 9px;line-height:1.5}.nba-cen{text-align:center}',
      '.nba-seg{display:flex;gap:8px}.nba-seg>button{flex:1}',
      '.nba-chips{display:flex;flex-wrap:wrap;gap:8px}',
      '.nba-chip{min-height:38px;border:1.5px solid var(--line2);background:transparent;color:var(--ink2);border-radius:var(--r2);padding:7px 13px;font:600 12.5px var(--f-ui,Cairo,sans-serif);cursor:pointer;transition:transform .15s,background .2s,border-color .2s}',
      '.nba-chip:active{transform:scale(.96)}',
      '.nba-chip.on{background:var(--leaf);border-color:var(--leaf-hi);color:#f7f2e0;font-weight:800}',
      '.nba-codecard{text-align:center;padding:18px 16px 16px}',
      '.nba-codecard>*{position:relative}',
      '.nba-cl{font-size:12.5px;font-weight:700;color:var(--slate)}',
      '.nba-code{display:flex;direction:ltr;justify-content:center;gap:7px;width:100%;border:0;background:none;padding:10px 0 4px;cursor:pointer;font-family:inherit;color:inherit;perspective:500px}',
      '.nba-code .ch{flex:1;max-width:52px;height:62px;display:grid;place-items:center;border-radius:var(--r3);font:800 30px var(--f-ui,Cairo,sans-serif);color:var(--wheat);background:var(--bg);border:1.5px solid rgba(201,162,74,.42);box-shadow:inset 0 3px 8px rgba(0,0,0,.5)}',
      '.nba-code .ch.in{animation:nbaTile .5s cubic-bezier(.2,.9,.3,1.2) both}',
      '.nba-code.cp .ch{animation:nbaCp .45s ease-out;color:var(--sprout);border-color:var(--fern)}',
      '.nba-hint{font-size:12px;color:var(--muted);margin:4px 0 14px;font-weight:600}',
      '.nba-row{position:relative;display:flex;align-items:center;gap:11px;padding:8px 10px;min-height:58px;margin-bottom:8px;border:1px solid var(--line);border-radius:var(--r3);background:rgba(236,226,190,.035)}',
      '.nba-row:last-child{margin-bottom:0}',
      '.nba-row.me{border-color:rgba(111,174,98,.5);background:rgba(111,174,98,.10)}',
      '.nba-row.in{animation:nbaPl .5s cubic-bezier(.2,.9,.3,1.15) both;animation-delay:var(--dl,0s)}',
      '.nba-row.em{border-style:dashed;border-color:var(--line2);background:none;color:var(--muted);font-weight:600;font-size:12.5px;justify-content:center;gap:8px}',
      '.nba-wt{width:7px;height:7px;border-radius:50%;background:var(--muted);animation:nbaWait 1.4s ease-in-out infinite}',
      '.nba-row .nm{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.45}.nba-row .nm b{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nba-row .nm small{font-size:11.5px;font-weight:600;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nba-avw{position:relative;flex:none}',
      '.nba-hc{position:absolute;top:-7px;right:-5px;width:20px;height:20px;border-radius:50%;display:grid;place-items:center;background:var(--brass);color:#241a05;box-shadow:0 0 0 2px var(--card);z-index:2}.nba-hc .nba-ico{width:11px;height:11px}',
      '.nba-av{position:relative;border-radius:50%;color:#f7f2e0;display:grid;place-items:center;font-weight:800;flex:none;overflow:hidden;box-shadow:0 0 0 2px var(--card),0 0 0 3.5px rgba(236,226,190,.3)}.nba-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.nba-dot{position:absolute;bottom:-1px;left:-2px;width:12px;height:12px;border-radius:50%;background:#58665a;border:2px solid var(--card);z-index:2}.nba-dot.on{background:#86c978}',
      '.nba-tag{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:700;line-height:1.5;border-radius:7px;padding:2px 9px;background:rgba(111,174,98,.13);color:var(--sprout);border:1px solid rgba(111,174,98,.28)}.nba-tag.g{background:rgba(201,162,74,.12);color:var(--wheat);border-color:rgba(201,162,74,.36)}',
      '.nba-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:14px;justify-content:center}.nba-hero .nba-meta{justify-content:flex-start;position:relative;z-index:1}',
      '.nba-teams{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nba-team{min-width:0;border-radius:var(--r3);padding:9px;border:1px solid rgba(111,174,98,.42);background:rgba(111,174,98,.07)}',
      '.nba-team.b{border-color:rgba(201,162,74,.46);background:rgba(201,162,74,.07)}',
      '.nba-team h4{margin:0 0 8px;font-size:14px;font-weight:800;display:flex;justify-content:space-between;align-items:center;gap:6px}',
      '.nba-team.a h4{color:var(--sprout)}.nba-team.b h4{color:var(--wheat)}',
      '.nba-team .nba-row{padding:6px 5px;gap:7px;min-height:52px}.nba-team .nba-av{width:32px!important;height:32px!important;font-size:13px!important}.nba-team .nba-row .nm b{font-size:13px}',
      '.nba-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;display:grid;place-items:center;font:800 12px var(--f-ui,Cairo,sans-serif);color:var(--wheat);background:var(--bg);border:1.5px solid rgba(201,162,74,.6);box-shadow:0 0 0 4px var(--card);z-index:2}',
      '.nba-qh{display:flex;align-items:center;justify-content:space-between;margin:2px 0 6px;min-height:56px}',
      '.nba-qn{display:flex;align-items:baseline;gap:7px;flex-wrap:wrap;font-weight:700;color:var(--slate);font-size:13px}.nba-qn b{font:600 38px/1 var(--fd);font-variant-numeric:lining-nums;color:var(--ink)}',
      '.nba-pips{display:flex;gap:5px;margin:2px 0 10px}',
      '.nba-pips i{flex:1;height:4px;border-radius:2px;background:rgba(236,226,190,.13);transition:background .3s}',
      '.nba-pips i.ok{background:var(--fern)}.nba-pips i.no{background:var(--madder)}.nba-pips i.cur{background:var(--wheat);animation:nbaPulse 1.2s ease-in-out infinite}',
      '.nba-ring{position:relative;width:56px;height:56px;flex:none}',
      '.nba-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '.nba-ring circle{fill:none;stroke-width:3.5;stroke-linecap:round}',
      '.nba-ring .bg{stroke:rgba(236,226,190,.13)}',
      '.nba-ring .fg{stroke:var(--sprout);stroke-dasharray:138.23;stroke-dashoffset:0;transition:stroke-dashoffset .25s linear,stroke .3s}',
      '.nba-ring .n{position:absolute;inset:0;display:grid;place-items:center;font:800 18px var(--f-ui,Cairo,sans-serif);font-variant-numeric:tabular-nums}',
      '.nba-ring.lo .fg{stroke:#e0675c}.nba-ring.lo .n{color:#f0867c;animation:nbaPulse 1s ease-in-out infinite}',
      '.nba-ring.nx .fg{stroke:var(--brass)}.nba-ring.nx .n{color:var(--wheat)}',
      '.nba-qcard{position:relative;display:flex;align-items:center;min-height:116px;overflow:hidden;border:1px solid #b99a52;border-radius:var(--r4);padding:20px 18px;margin:6px 0 14px;background:var(--parch);color:var(--parch-ink);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 14px 22px -14px rgba(0,0,0,.8)}',
      '.nba-qcard::before{border-color:rgba(143,114,48,.5)}',
      '.nba-qcard>*{position:relative}',
      '.nba-qcard.in{animation:nbaIn .4s cubic-bezier(.2,.9,.3,1) both}',
      '.nba-q{font-weight:700;font-size:18px;line-height:1.9;margin:0}',
      '.nba-opt{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;text-align:right;border:1.5px solid var(--line2);background:var(--card);color:var(--ink);border-radius:var(--r3);padding:10px 12px;margin-bottom:10px;font:600 15.5px/1.7 var(--f-ui,Cairo,sans-serif);cursor:pointer;transition:transform .14s,border-color .18s,background .18s,opacity .25s}',
      '.nba-opt:active:not([disabled]){transform:scale(.985)}',
      '.nba-opt .lt{width:34px;height:34px;border-radius:3px 12px 3px 12px;background:#22402e;color:var(--ink2);display:grid;place-items:center;font-weight:800;line-height:1;flex:none;transition:background .2s,color .2s}',
      '.nba-opt.in{animation:nbaOpt .4s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(var(--n,0)*70ms + 120ms)}',
      '.nba-opt.sel{border-color:var(--brass);background:rgba(201,162,74,.11);animation:nbaPick .32s cubic-bezier(.2,.9,.3,1.3)}.nba-opt.sel .lt{background:var(--brass);color:#241a05}',
      '.nba-opt.lk{opacity:.55}',
      '.nba-opt.ok{border-color:var(--fern);background:rgba(111,174,98,.17);animation:nbaOk .5s ease-out}.nba-opt.ok .lt{background:var(--fern);color:#0b1a10}',
      '.nba-opt.no{border-color:var(--madder);background:rgba(187,67,59,.15);animation:nbaNo .42s ease-out}.nba-opt.no .lt{background:var(--madder);color:#f7f2e0}',
      '.nba-opt.dim{opacity:.42}.nba-opt[disabled]{cursor:default}',
      '.nba-lock{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;text-align:center;font-weight:600;font-size:13px;color:var(--slate);padding:6px 0;line-height:1.7}',
      '.nba-lock::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--brass);animation:nbaWait 1.2s ease-in-out infinite;flex:none}',
      '.nba-fb{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;min-height:46px}',
      '.nba-gain{font:800 28px/1.4 var(--f-ui,Cairo,sans-serif);text-align:center;margin:2px 0;font-variant-numeric:tabular-nums;animation:nbaGain .5s cubic-bezier(.2,.9,.3,1.3) both}',
      '.nba-gain.ok{color:var(--sprout)}.nba-gain.no{color:var(--madder-l);font-size:19px}',
      '.nba-streak{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:7px;font-weight:700;font-size:12px;color:var(--wheat);background:rgba(201,162,74,.13);border:1px solid rgba(201,162,74,.4);animation:nbaGain .5s .2s cubic-bezier(.2,.9,.3,1.3) both}.nba-streak .nba-ico{width:14px;height:14px}',
      '.nba-xp{background:rgba(236,226,190,.04);border:1px solid var(--line);border-right:3px solid var(--fern);border-radius:var(--r2) 3px 3px var(--r2);padding:12px 14px;font-size:13.5px;line-height:1.9;color:var(--ink2);margin-top:6px}',
      '.nba-lead{position:relative;display:flex;align-items:center;gap:10px;height:46px;padding:0 8px;border-radius:var(--r2)}',
      '.nba-lead .rk{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font-weight:800;font-size:12px;color:var(--muted);border:1px solid var(--line2)}',
      '.nba-lead .rk.r1{background:var(--brass);border-color:var(--brass);color:#241a05}.nba-lead .rk.r2{background:#b9c2bb;border-color:#b9c2bb;color:#1f2a24}.nba-lead .rk.r3{background:#b97d49;border-color:#b97d49;color:#1a0d03}',
      '.nba-lead .nm{flex:1;min-width:0;font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nba-lead .sc{font-weight:800;color:var(--ink);font-variant-numeric:tabular-nums;min-width:38px;text-align:left}',
      '.nba-lead.me{background:rgba(111,174,98,.10);box-shadow:inset 0 0 0 1px rgba(111,174,98,.45)}',
      '.nba-lead.mv{animation:nbaRise .7s cubic-bezier(.25,.9,.3,1) both}',
      '.nba-lead .nba-tag{animation:nbaGain .45s .3s cubic-bezier(.2,.9,.3,1.3) both}',
      '.nba-lead .pb{position:absolute;right:8px;left:8px;bottom:0;height:2px;border-radius:2px;background:linear-gradient(270deg,var(--fern),transparent);transform-origin:right;animation:nbaScaleX 1s .4s cubic-bezier(.2,.9,.3,1) both;opacity:.6}',
      '.nba-cd{position:relative;display:grid;place-items:center;height:250px;margin:4px 0 8px}',
      '.nba-cd::before{content:"";position:absolute;width:236px;height:236px;border-radius:50%;background:repeating-radial-gradient(circle,transparent 0 9px,rgba(201,162,74,.17) 9px 10px);-webkit-mask:radial-gradient(circle,#000 38%,transparent 71%);mask:radial-gradient(circle,#000 38%,transparent 71%)}',
      '.nba-cd i{position:absolute;width:150px;height:150px;border-radius:50%;border:1.5px solid var(--wheat);opacity:0}.nba-cd i.b{border-color:var(--fern)}',
      '.nba-cd.hit i{animation:nbaWave .9s ease-out}.nba-cd.hit i.b{animation-delay:.12s}',
      '.nba-big{position:relative;font:600 132px/1 var(--fd);font-variant-numeric:lining-nums;color:var(--ink);text-shadow:0 3px 0 rgba(0,0,0,.35)}.nba-big.sm{font:800 46px/1.3 var(--f-ui,Cairo,sans-serif)}',
      '.nba-cd.hit .nba-big{animation:nbaCount .8s cubic-bezier(.1,.9,.2,1) both}',
      '.nba-vsrow{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;margin:6px 0 4px}',
      '.nba-side{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}.nba-side>b{font-size:12.5px;font-weight:800}.nba-side.a>b{color:var(--sprout)}.nba-side.b>b{color:var(--wheat)}',
      '.nba-mu{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}.nba-mp{display:flex;flex-direction:column;align-items:center;gap:6px;width:62px;animation:nbaPl .5s cubic-bezier(.2,.9,.3,1.15) both;animation-delay:var(--dl,0s)}.nba-mp small{font-weight:600;font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2)}',
      '.nba-vsb{align-self:center;font:800 18px var(--f-ui,Cairo,sans-serif);color:var(--wheat)}',
      '.nba-badge{display:inline-block;margin-bottom:14px;padding:3px 12px;border-radius:7px;font-size:12px;font-weight:700;color:var(--wheat);background:rgba(201,162,74,.12);border:1px solid rgba(201,162,74,.36)}',
      '.nba-win{text-align:center;padding:26px 14px 22px;overflow:hidden}',
      '.nba-win::after{content:"";position:absolute;right:-10px;bottom:-16px;width:120px;height:140px;background:' + SPRIG + ' center/contain no-repeat;opacity:.16;pointer-events:none;transform:scaleX(-1) rotate(10deg)}',
      '.nba-win>*{position:relative;z-index:1}',
      '.nba-win .tr{width:80px;height:80px;margin:0 auto 14px;border-radius:50%;background:var(--brass);color:#241a05;display:grid;place-items:center;box-shadow:0 0 0 5px var(--card2),0 0 0 6.5px rgba(201,162,74,.55),0 14px 20px -10px rgba(0,0,0,.75);animation:nbaDrop .7s cubic-bezier(.2,1.2,.3,1) both}.nba-win .tr .nba-ico{width:38px;height:38px}',
      '.nba-win h2{margin:0 0 4px;font-size:23px;font-weight:800;line-height:1.5;animation:nbaIn .5s .25s both}.nba-win p{margin:0;color:var(--slate);font-size:14px;font-weight:700;animation:nbaIn .5s .35s both}',
      '.nba-pod{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:10px 0 0}',
      '.nba-pod>div{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;width:31%;min-width:0;animation:nbaIn .5s both;animation-delay:var(--dl)}',
      '.nba-pod .p3{--dl:.15s}.nba-pod .p2{--dl:.45s}.nba-pod .p1{--dl:.8s}',
      '.nba-pod .st{position:relative;width:100%;border-radius:8px 8px 0 0;display:grid;place-items:center;color:#1f2a24;font:800 19px var(--f-ui,Cairo,sans-serif);padding-top:6px;font-variant-numeric:tabular-nums}',
      '.nba-pod .st::before{content:"";position:absolute;inset:0;border-radius:inherit;background:#b9c2bb;box-shadow:inset 0 2px 0 rgba(255,255,255,.28);transform-origin:bottom;animation:nbaGrow .7s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--dl)}',
      '.nba-pod .st>span{position:relative}',
      '.nba-pod .p1 .st{height:104px;color:#241a05}.nba-pod .p1 .st::before{background:var(--brass)}.nba-pod .p2 .st{height:76px}.nba-pod .p3 .st{height:56px;color:#1a0d03}.nba-pod .p3 .st::before{background:#b97d49}',
      '.nba-pod small{font-weight:700;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nba-pod .cr{position:absolute;top:-24px;color:var(--brass)}.nba-pod .cr .nba-ico{width:24px;height:24px}',
      '.nba-tvs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;text-align:center}',
      '.nba-tvs .t{border-radius:var(--r3);padding:12px 6px;border:1px solid rgba(111,174,98,.42);background:rgba(111,174,98,.07);min-width:0}.nba-tvs .t.b{border-color:rgba(201,162,74,.46);background:rgba(201,162,74,.07)}',
      '.nba-tvs .t.w{border-width:2px;background:rgba(111,174,98,.16);border-color:var(--fern)}.nba-tvs .t.b.w{background:rgba(201,162,74,.16);border-color:var(--brass)}',
      '.nba-tvs .t small{display:block;font-weight:700;font-size:12.5px;color:var(--slate)}.nba-tvs .t b{display:block;font:600 40px/1.2 var(--fd);font-variant-numeric:lining-nums}.nba-tvs .t.a b{color:var(--sprout)}.nba-tvs .t.b b{color:var(--wheat)}',
      '.nba-tbar{height:8px;border-radius:6px;background:var(--brass);overflow:hidden;margin-top:14px}.nba-tbar i{display:block;height:100%;width:var(--p);background:var(--fern);border-radius:6px;transform-origin:right;animation:nbaScaleX 1s .4s cubic-bezier(.2,.9,.3,1) both}',
      '.nba-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nba-stat{border-radius:var(--r3);background:rgba(236,226,190,.04);border:1px solid var(--line);padding:12px 8px;text-align:center;animation:nbaIn .45s both;animation-delay:var(--dl,0s)}',
      '.nba-stat b{display:block;font:600 34px/1.2 var(--fd);font-variant-numeric:lining-nums;color:var(--ink)}.nba-stat.g b{color:var(--wheat)}.nba-stat span{font-size:12px;color:var(--slate);font-weight:600;line-height:1.6}',
      '.nba-team .sc.nba-tm{font:600 30px/1.2 var(--fd);font-variant-numeric:lining-nums;color:inherit;text-align:center}',
      '.nba-rvd summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:13.5px;color:var(--ink2);min-height:28px}.nba-rvd summary::-webkit-details-marker{display:none}.nba-rvd summary::after{content:"+";font-size:20px;color:var(--brass)}.nba-rvd[open] summary::after{content:"\\2212"}',
      '.nba-rv{border-top:1px solid var(--line);padding:12px 2px;font-size:13.5px;line-height:1.85}.nba-rv b{display:block;margin-bottom:3px}.nba-rv .ca{color:var(--sprout);font-weight:700}',
      '.nba-err{background:rgba(187,67,59,.14);border:1px solid rgba(187,67,59,.42);color:var(--madder-l);border-radius:var(--r2);padding:10px 12px;font-size:13px;font-weight:700;margin-bottom:10px;line-height:1.7}',
      '.nba-note{color:var(--slate);font-size:12.5px;line-height:1.85;text-align:center;margin:8px 0;font-weight:600}',
      '.nba-spin{width:22px;height:22px;border-radius:50%;border:3px solid rgba(247,242,224,.28);border-top-color:#f7f2e0;animation:nbaSp .8s linear infinite}.nba-btn.gold .nba-spin{border-color:rgba(36,26,5,.25);border-top-color:#241a05}.nba-spin.d{border-color:var(--line2);border-top-color:var(--brass)}',
      '.nba-conf{position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden}',
      '.nba-conf i{position:absolute;top:-16px;left:var(--x);width:var(--w);height:calc(var(--w)*1.5);background:var(--c);border-radius:0 85% 0 85%;opacity:0;animation:nbaFall var(--t) linear var(--d) forwards;will-change:transform}',
      '.nba-flash{position:fixed;inset:0;z-index:4;pointer-events:none;animation:nbaFlash .8s ease-out forwards}',
      '.nba-flash.ok,.nba-flash.go{background:radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(111,174,98,.28))}.nba-flash.no{background:radial-gradient(120% 90% at 50% 50%,transparent 55%,rgba(187,67,59,.28))}',
      '@keyframes nbaIn{from{opacity:0;transform:translate3d(0,12px,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaFloat{0%{transform:translate3d(0,0,0) rotate(0);opacity:0}10%{opacity:.2}90%{opacity:.14}100%{transform:translate3d(var(--dx),108vh,0) rotate(240deg);opacity:0}}',
      '@keyframes nbaPl{from{opacity:0;transform:translate3d(22px,0,0) scale(.94)}to{opacity:1;transform:none}}',
      '@keyframes nbaWait{0%,100%{opacity:.25}50%{opacity:1}}',
      '@keyframes nbaTile{from{opacity:0;transform:rotateX(-90deg) translate3d(0,10px,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaCp{0%{transform:scale(1)}40%{transform:scale(1.1)}100%{transform:scale(1)}}',
      '@keyframes nbaPick{0%{transform:scale(.97)}60%{transform:scale(1.015)}100%{transform:scale(1)}}',
      '@keyframes nbaOk{0%{transform:scale(1)}40%{transform:scale(1.025)}100%{transform:scale(1)}}',
      '@keyframes nbaNo{0%,100%{transform:translate3d(0,0,0)}20%{transform:translate3d(-6px,0,0)}40%{transform:translate3d(6px,0,0)}60%{transform:translate3d(-4px,0,0)}80%{transform:translate3d(3px,0,0)}}',
      '@keyframes nbaOpt{from{opacity:0;transform:translate3d(24px,0,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaGain{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}',
      '@keyframes nbaPulse{0%,100%{opacity:.55}50%{opacity:1}}',
      '@keyframes nbaCount{0%{opacity:0;transform:scale(1.9)}35%{opacity:1;transform:scale(.96)}100%{opacity:1;transform:scale(1)}}',
      '@keyframes nbaWave{0%{opacity:.7;transform:scale(.6)}100%{opacity:0;transform:scale(2.2)}}',
      '@keyframes nbaRise{from{opacity:var(--o,1);transform:translate3d(0,var(--dy,0),0)}to{opacity:1;transform:none}}',
      '@keyframes nbaDrop{from{opacity:0;transform:translate3d(0,-50px,0) scale(.5)}to{opacity:1;transform:none}}',
      '@keyframes nbaGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '@keyframes nbaScaleX{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '@keyframes nbaFall{0%{opacity:1;transform:translate3d(0,0,0) rotate(0)}100%{opacity:1;transform:translate3d(var(--dx),108vh,0) rotate(var(--r))}}',
      '@keyframes nbaFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}',
      '@keyframes nbaSp{to{transform:rotate(360deg)}}',
      '@media (max-width:360px){.nba-q{font-size:16.5px}.nba-opt{font-size:14.5px}.nba-code .ch{height:54px;font-size:26px}.nba-big{font-size:108px}.nba-hero h2{font-size:20px}}',
      '@media (max-height:640px){.nba-cd{height:200px}.nba-cd::before{width:190px;height:190px}.nba-big{font-size:96px}}',
      '@media (prefers-reduced-motion:reduce){.nba-root *,.nba-root *::before,.nba-root *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.nba-fx,.nba-conf,.nba-flash{display:none!important}}'
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
      root.appendChild(fxLayer()); root.appendChild(sndUI());
      root.addEventListener('pointerdown', function (e) { SFX.unlock(); var pp = root.querySelector('.nba-pop'); if (pp && !pp.hidden && !(e.target.closest && e.target.closest('.nba-snb'))) pp.hidden = true; }, { passive: true });
      root.addEventListener('keydown', SFX.unlock);
      root.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('button'); if (b && !b.classList.contains('nba-opt') && !b.hasAttribute('data-nosnd') && !b.closest('.nba-snb')) SFX.play('ui'); });
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
    MUS.sync();
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
    S = { rid: rid, uid: me().uid, off: 0, bestRtt: 1e9, room: null, players: {}, t0: 0, q: {}, k: {}, ans: {}, my: {}, rev: {}, pend: {}, nextTry: {}, unsub: [], hbSent: 0, lastLs: 0, fx: {}, shown: {}, seen: {}, ln: 0 };
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
    SFX.play('pick');
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
      h('div', { class: 'nba-ttl' }, [h('div', { class: 'nba-logo' }, [ico(I.leaf)]), h('span', { text: title || 'ساحة نبتيكس' })]),
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
    MUS.sync();
    var key = viewKey(), w = root.firstChild;
    if (key === V.key && V.live) { V.live(); return; }
    var always = key === 'lobby';
    if (key === V.key && !always) return;
    var base = key.split(':', 2).join(':'), enter = base !== V.base;
    V.key = key; V.live = null; V.base = base;
    var y = root.scrollTop;
    w.className = 'nba-wrap' + (enter ? ' nba-enter' : '');
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
    w.appendChild(h('div', { class: 'nba-card nba-hero' }, [h('div', { class: 'nba-hb' }, [ico(I.leaf)]), h('h2', { text: 'تحدّى أصحابك في الزراعة' }), h('p', { text: 'غرف خاصة من 2 لـ 6 لاعبين، 10 أسئلة بالذكاء الاصطناعي في تخصصك، ونقاط لحظية. اللي بيجاوب أسرع بياخد أكتر.' }), h('div', { class: 'nba-meta' }, [h('span', { class: 'nba-tag', text: '2–6 لاعبين' }), h('span', { class: 'nba-tag g', text: '10 أسئلة' }), h('span', { class: 'nba-tag', text: 'ذكاء اصطناعي' })])]));
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

  function playerRow(uid, p, extra, sz) {
    var onl = p.ls && (srvNow() - p.ls) < STALE, r = S.room, fresh = !S.seen[uid], n = S.ln++;
    S.seen[uid] = 1;
    if (fresh && S.seenInit && uid !== S.uid) SFX.play('pop');
    var role = uid === S.uid ? 'أنت' : (r.host === uid ? 'مضيف' : (onl ? 'متصل' : 'غير متصل'));
    return h('div', { class: 'nba-row' + (uid === S.uid ? ' me' : '') + (fresh ? ' in' : ''), style: fresh ? '--dl:' + (n * 70) + 'ms' : '' }, [
      h('div', { class: 'nba-avw' }, [avatar(uid, p, sz || 42), r.host === uid ? h('span', { class: 'nba-hc', title: 'المضيف' }, [ico(I.crown)]) : null, h('span', { class: 'nba-dot' + (onl ? ' on' : ''), title: onl ? 'متصل' : 'غير متصل' })]),
      h('div', { class: 'nm' }, [h('b', { text: p.n }), h('small', { text: role })]), extra || null]);
  }
  function emptySlot() { return h('div', { class: 'nba-row em' }, [h('span', { class: 'nba-wt' }), 'في انتظار لاعب…']); }
  function vLobby(w) {
    var r = S.room, uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), isHost = r.host === S.uid, teams = r.md === 't';
    var hostP = S.players[r.host], hostStale = !hostP || !hostP.ls || (srvNow() - hostP.ls) > STALE;
    var balanced = !teams || (r.pc % 2 === 0 && r.na === r.nb), canStart = isHost && r.pc >= 2 && balanced && !V.busy;
    S.ln = 0;
    w.appendChild(top('الغرفة', leaveLobby));
    var code = h('button', { class: 'nba-code', 'data-nosnd': '1', 'aria-label': 'نسخ كود الغرفة ' + S.rid, onclick: function (e) { copy(S.rid, 'اتنسخ الكود'); var b = e.currentTarget; b.classList.remove('cp'); void b.offsetWidth; b.classList.add('cp'); SFX.play('pop'); } },
      S.rid.split('').map(function (c, n) { return h('span', { class: 'ch' + (S.codeAnim ? '' : ' in'), style: 'animation-delay:' + (n * 70) + 'ms', text: c }); }));
    S.codeAnim = true;
    w.appendChild(h('div', { class: 'nba-card nba-codecard' }, [
      h('div', { class: 'nba-cl', text: 'كود الغرفة' }), code, h('div', { class: 'nba-hint', text: 'اضغط على الكود لنسخه' }),
      h('div', { class: 'nba-seg' }, [
        h('button', { class: 'nba-btn sec sm', onclick: function () { copy(S.rid, 'اتنسخ الكود'); } }, [ico(I.copy), 'نسخ الكود']),
        h('button', { class: 'nba-btn sm', onclick: share }, [ico(I.share), 'دعوة صديق'])]),
      h('div', { class: 'nba-meta' }, [h('span', { class: 'nba-tag', text: r.sp }), h('span', { class: 'nba-tag', text: teams ? 'فريقين' : 'فردي' }), h('span', { class: 'nba-tag', text: r.pc + ' / ' + r.mx + ' لاعبين' }), h('span', { class: 'nba-tag', text: '10 أسئلة' })])]));
    if (V.err) w.appendChild(errBox());
    var meP = S.players[S.uid];
    if (teams) {
      var per = Math.max(1, Math.round(r.mx / 2));
      var col = function (t) {
        var mem = uids.filter(function (u) { return (S.players[u].tm ? 1 : 0) === t; }), kids = mem.map(function (u) { return playerRow(u, S.players[u], null, 36); });
        for (var k = mem.length; k < per; k++) kids.push(emptySlot());
        return h('div', { class: 'nba-team ' + (t ? 'b' : 'a') }, [h('h4', {}, [h('span', { text: t ? 'الفريق ب' : 'الفريق أ' }), h('span', { class: 'nba-tag' + (t ? ' g' : ''), text: (t ? r.nb : r.na) + ' / ' + per })])].concat(kids));
      };
      w.appendChild(h('div', { class: 'nba-card tight' }, [h('div', { class: 'nba-teams' }, [col(0), col(1), h('div', { class: 'nba-vs', text: 'VS' })])]));
      if (meP) w.appendChild(h('button', { class: 'nba-btn sec', style: 'margin-bottom:12px', onclick: switchTeam }, [ico(I.swap), 'انتقل للفريق ' + (meP.tm ? 'أ' : 'ب')]));
      if (!balanced) w.appendChild(h('div', { class: 'nba-note', text: 'لازم الفريقين يبقوا متساويين (2 أو 4 أو 6 لاعبين). حد يبدّل فريقه أو انتظر لاعب جديد.' }));
    } else {
      var rows = uids.map(function (u) {
        return playerRow(u, S.players[u], isHost && u !== S.uid ? h('button', { class: 'nba-ib', title: 'نقل الإدارة', 'aria-label': 'نقل الإدارة', onclick: function () { takeHost(u); } }, [ico(I.crown)]) : null);
      });
      for (var e = uids.length; e < r.mx; e++) rows.push(emptySlot());
      w.appendChild(h('div', { class: 'nba-card' }, rows));
    }
    if (meP) S.seenInit = true;
    if (isHost) {
      w.appendChild(h('button', { class: 'nba-btn gold', disabled: !canStart, onclick: startGame }, [V.busy ? h('div', { class: 'nba-spin' }) : ico(I.flag), V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة بالذكاء الاصطناعي… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة')]));
      if (r.pc < 2) w.appendChild(h('div', { class: 'nba-note', text: 'محتاج لاعب واحد على الأقل. ابعت الكود لصاحبك.' }));
    } else {
      w.appendChild(h('div', { class: 'nba-note' }, [r.qr ? 'الأسئلة جاهزة — في انتظار المضيف يبدأ اللعبة…' : 'في انتظار المضيف يبدأ اللعبة…']));
      if (hostStale) w.appendChild(h('button', { class: 'nba-btn sec', onclick: function () { takeHost(S.uid); } }, [ico(I.crown), 'المضيف مش متصل — تولّى الإدارة']));
    }
  }

  /* مواجهة اللاعبين (VS) — بتظهر في الكاونت داون */
  function matchup() {
    var teams = S.room.md === 't', uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), n = 0;
    var group = function (list, sz) { return h('div', { class: 'nba-mu' }, list.map(function (u) { return h('div', { class: 'nba-mp', style: '--dl:' + (n++ * 80) + 'ms' }, [avatar(u, S.players[u], sz), h('small', { text: S.players[u].n })]); })); };
    if (!teams) return h('div', { class: 'nba-vsrow' }, [group(uids, 46)]);
    var side = function (t) { return h('div', { class: 'nba-side ' + (t ? 'b' : 'a') }, [h('b', { text: t ? 'الفريق ب' : 'الفريق أ' }), group(uids.filter(function (u) { return (S.players[u].tm ? 1 : 0) === t; }), 40)]); };
    return h('div', { class: 'nba-vsrow' }, [side(0), h('div', { class: 'nba-vsb', text: 'VS' }), side(1)]);
  }

  /* لوحة الترتيب: upTo = تحريك التغيّر بعد السؤال (FLIP + عدّاد) · fin = النتيجة النهائية */
  function boardCard(t, upTo, fin) {
    var teams = S.room.md === 't', order = ranked(t), card = h('div', { class: 'nba-card' }), prev = null, pr = {}, max = 1;
    if (upTo != null) { prev = {}; Object.keys(t).forEach(function (u) { prev[u] = t[u] - pts(u, upTo); }); ranked(prev).forEach(function (u, i) { pr[u] = i; }); }
    order.forEach(function (u) { max = Math.max(max, t[u]); });
    if (teams && !fin) {
      var tt = teamTotals(t), tp = prev ? teamTotals(prev) : (fin ? [0, 0] : tt);
      card.appendChild(h('div', { class: 'nba-teams', style: 'margin-bottom:8px' }, [0, 1].map(function (x) {
        var sc = h('div', { class: 'sc nba-tm', style: 'color:inherit', text: String(tp[x]) });
        countUp(sc, tp[x], tt[x], 800);
        return h('div', { class: 'nba-team ' + (x ? 'b' : 'a'), style: 'text-align:center' }, [h('h4', { style: 'justify-content:center;margin-bottom:2px' }, [x ? 'الفريق ب' : 'الفريق أ']), sc]);
      })));
    }
    order.forEach(function (u, i) {
      var p = S.players[u], from = prev ? prev[u] : (fin ? 0 : t[u]), sc = h('span', { class: 'sc', text: String(from) }), cls = 'nba-lead' + (u === S.uid ? ' me' : ''), st = '';
      if (prev && pr[u] !== i) { cls += ' mv'; st = '--dy:' + ((pr[u] - i) * 46) + 'px;--o:1'; }
      else if (fin) { cls += ' mv'; st = '--dy:16px;--o:0;animation-delay:' + (i * 90 + 150) + 'ms'; }
      countUp(sc, from, t[u], 800);
      card.appendChild(h('div', { class: cls, style: st }, [
        h('span', { class: 'rk r' + (i + 1), text: String(i + 1) }), avatar(u, p, 32),
        h('span', { class: 'nm', text: p.n + (teams ? (p.tm ? ' · ب' : ' · أ') : '') }),
        fin ? h('span', { class: 'nba-tag', text: correctCount(u) + '/' + NQ }) : null,
        upTo != null && S.rev[upTo] && pts(u, upTo) ? h('span', { class: 'nba-tag g', text: '+' + pts(u, upTo) }) : null, sc,
        fin ? h('i', { class: 'pb', style: 'width:' + Math.round(t[u] / max * 100) + '%;left:auto' }) : null]));
    });
    return card;
  }
  function vGame(w) {
    var p = phase();
    if (!p) { w.appendChild(top('اللعبة', close)); w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري مزامنة وقت اللعبة…'])); return; }
    if (p.k === 'lead') {
      w.appendChild(top('اللعبة', close));
      var cd = h('div', { class: 'nba-cd' }, [h('i'), h('i', { class: 'b' }), h('div', { class: 'nba-big' })]), big = cd.lastChild;
      w.appendChild(cd);
      w.appendChild(h('div', { class: 'nba-lbl nba-cen', style: 'margin-top:0', text: S.room.sp + ' · 10 أسئلة' }));
      w.appendChild(matchup());
      w.appendChild(h('div', { class: 'nba-note', text: 'جهّز نفسك… السؤال الأول بعد لحظات. الإجابة بتتقفل أول ما تضغط!' }));
      V.live = function () {
        var q = phase(), n = q && q.k === 'lead' ? Math.max(1, Math.ceil(q.left / 1000)) : 0;
        if (big.getAttribute('data-n') === String(n)) return;
        big.setAttribute('data-n', String(n)); big.textContent = n > 3 ? 'استعد' : (n ? String(n) : '…'); big.className = 'nba-big' + (n > 3 ? ' sm' : '');
        if (n) { SFX.play('count', n); cd.classList.remove('hit'); void cd.offsetWidth; cd.classList.add('hit'); }
      };
      V.live();
      return;
    }
    if (p.k === 'done') { vResults(w); return; }
    var i = p.i, q = S.q[i], my = S.my[i], revealed = p.k === 'r', fresh = !!q && !S.shown[i];
    if (q) S.shown[i] = 1;
    if (i === 0 && p.k === 'q' && p.left > QDUR - 2500 && once('go')) { SFX.play('go'); flash('go'); }
    w.appendChild(top('اللعبة', close));
    var pips = h('div', { class: 'nba-pips', 'aria-hidden': 'true' });
    for (var j = 0; j < NQ; j++) pips.appendChild(h('i', { class: j < i || (j === i && revealed && S.rev[i]) ? (S.rev[j] ? (pts(S.uid, j) ? 'ok' : 'no') : '') : (j === i ? 'cur' : '') }));
    w.appendChild(pips);
    var ring = h('div', { class: 'nba-ring', role: 'timer' }), num = h('span', { class: 'n' }), fg;
    ring.innerHTML = '<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="bg" cx="28" cy="28" r="22"/><circle class="fg" cx="28" cy="28" r="22"/></svg>';
    fg = ring.querySelector('.fg'); ring.appendChild(num);
    w.appendChild(h('div', { class: 'nba-qh' }, [h('div', { class: 'nba-qn' }, [h('b', { text: String(i + 1) }), h('span', { text: '/ ' + NQ }), q ? h('span', { class: 'nba-tag' + (q.d === 'h' ? ' g' : ''), text: DIFF[q.d] || '' }) : null]), ring]));
    if (!q) { w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:44px auto 12px' }), 'جاري تحميل السؤال…'])); }
    else {
      w.appendChild(h('div', { class: 'nba-qcard' + (fresh ? ' in' : '') }, [h('div', { class: 'nba-q', text: q.q })]));
      var k = revealed && S.rev[i] ? S.k[i] : null;
      q.o.forEach(function (txt, n) {
        var cls = 'nba-opt', lt = h('span', { class: 'lt', text: LETTERS[n] });
        if (k) { if (n === k.c) { cls += ' ok'; lt = h('span', { class: 'lt' }, [ico(I.check)]); } else if (my && my.c === n) { cls += ' no'; lt = h('span', { class: 'lt' }, [ico(I.x)]); } else cls += ' dim'; }
        else if (my && my.c === n) cls += ' sel'; else if (my) cls += ' lk';
        w.appendChild(h('button', { class: cls + (fresh ? ' in' : ''), style: '--n:' + n, disabled: !!(my || revealed), onclick: function () { answer(i, n); } }, [lt, h('span', { text: txt })]));
      });
      if (!revealed) {
        w.appendChild(h('div', { class: 'nba-lock', text: my ? (my.late ? 'إجابتك وصلت متأخرة ولم تُحتسب' : 'اتقفلت إجابتك — استنى بقية اللاعبين') : 'اختار إجابتك بسرعة — السرعة بتزوّد النقاط' }));
      } else if (k) {
        var g = pts(S.uid, i), gain = h('div', { class: 'nba-gain ' + (g ? 'ok' : 'no'), text: g ? '+0 نقطة' : (my ? 'إجابة غير صحيحة' : 'لم تجاوب') }), sk = streakAt(S.uid, i);
        if (g) countUp(gain, 0, g, 700, function (v) { return '+' + v + ' نقطة'; });
        if (once('rv' + i)) { SFX.play(g ? 'correct' : 'wrong'); flash(g ? 'ok' : 'no'); }
        w.appendChild(h('div', { class: 'nba-fb' }, [gain, g && sk >= 2 ? h('span', { class: 'nba-streak' }, [ico(I.fire), 'سلسلة ×' + sk]) : null]));
        if (k.e) w.appendChild(h('div', { class: 'nba-xp', text: k.e }));
        w.appendChild(h('div', { style: 'height:12px' }));
        w.appendChild(boardCard(totals(), i));
      } else w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:20px auto 8px' }), 'جاري احتساب النتيجة…']));
    }
    V.live = function () {
      var c = phase(); if (!c || c.i !== i) return;
      var isq = c.k === 'q', total = isq ? QDUR : SLOT - QDUR, left = Math.max(0, c.left), lo = isq && left < 5000, sec = Math.ceil(left / 1000);
      fg.style.strokeDashoffset = String(138.23 * (1 - Math.min(1, left / total)));
      num.textContent = String(sec); ring.className = 'nba-ring' + (lo ? ' lo' : '') + (isq ? '' : ' nx');
      if (lo && !S.my[i] && S.fx['w' + i] !== sec) { S.fx['w' + i] = sec; SFX.play('warn'); }
    };
    V.live();
  }
  function vResults(w) {
    var t = totals(), order = ranked(t), teams = S.room.md === 't', tt = teams ? teamTotals(t) : null;
    w.appendChild(top('النتيجة النهائية', function () { leaveGame(); }));
    var ready = Object.keys(S.rev).length >= NQ, title, sub, won = false, meP = S.players[S.uid], rank = order.indexOf(S.uid) + 1;
    if (!ready) { w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري احتساب النتيجة النهائية…'])); return; }
    if (teams) { title = tt[0] === tt[1] ? 'تعادل بين الفريقين!' : (tt[0] > tt[1] ? 'الفريق أ فاز!' : 'الفريق ب فاز!'); sub = tt[0] + ' × ' + tt[1]; won = tt[0] !== tt[1] && (tt[0] > tt[1] ? 0 : 1) === (meP && meP.tm ? 1 : 0); }
    else { var top1 = order.filter(function (u) { return t[u] === t[order[0]]; }); title = top1.length > 1 ? 'تعادل على المركز الأول!' : S.players[order[0]].n + ' هو البطل!'; sub = t[order[0]] + ' نقطة'; won = top1.indexOf(S.uid) > -1; }
    if (once('res')) { SFX.play(won ? 'win' : 'end'); confetti(won ? 56 : 20); }
    w.appendChild(h('div', { class: 'nba-card nba-win' }, [h('div', { class: 'nba-badge', text: won ? 'مبروك — أنت من الأبطال' : 'انتهت المواجهة' }), h('div', { class: 'tr' }, [ico(I.trophy)]), h('h2', { text: title }), h('p', { text: sub })]));
    if (teams) {
      var tot = Math.max(1, tt[0] + tt[1]);
      w.appendChild(h('div', { class: 'nba-card' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'نتيجة الفرق' }), h('div', { class: 'nba-tvs' }, [
        h('div', { class: 't a' + (tt[0] > tt[1] ? ' w' : '') }, [h('small', { text: 'الفريق أ' }), h('b', { text: String(tt[0]) })]), h('div', { class: 'nba-vsb', text: 'VS' }),
        h('div', { class: 't b' + (tt[1] > tt[0] ? ' w' : '') }, [h('small', { text: 'الفريق ب' }), h('b', { text: String(tt[1]) })])]),
        h('div', { class: 'nba-tbar' }, [h('i', { style: '--p:' + Math.round(tt[0] / tot * 100) + '%' })])]));
    } else if (order.length >= 2) {
      var pod = h('div', { class: 'nba-pod' });
      [1, 0, 2].forEach(function (pi) { var u = order[pi]; if (!u) return; pod.appendChild(h('div', { class: 'p' + (pi + 1) }, [pi === 0 ? h('span', { class: 'cr' }, [ico(I.crown)]) : null, avatar(u, S.players[u], pi === 0 ? 54 : 44), h('small', { text: S.players[u].n }), h('div', { class: 'st' }, [h('span', { text: String(t[u]) })])])); });
      w.appendChild(h('div', { class: 'nba-card', style: 'padding-top:30px' }, [pod]));
    }
    var ms = stats(S.uid), st = function (v, lb, fmt, g, n) { var b = h('b', { text: '0' }); countUp(b, 0, v, 900, fmt); return h('div', { class: 'nba-stat' + (g ? ' g' : ''), style: '--dl:' + (n * 90 + 200) + 'ms' }, [b, h('span', { text: lb })]); };
    var sec = function (v) { return (v / 1000).toFixed(1) + ' ث'; };
    w.appendChild(h('div', { class: 'nba-card' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'إحصائياتك' }), h('div', { class: 'nba-stats' }, [
      st(t[S.uid] || 0, 'نقاطك', String, true, 0), st(rank, 'ترتيبك', function (v) { return '#' + v; }, false, 1),
      st(ms.c, 'إجابات صحيحة من ' + NQ, String, false, 2), st(ms.best, 'أطول سلسلة صح', String, false, 3),
      st(Math.round(ms.avg), 'متوسط زمن الإجابة', sec, false, 4), st(Math.round(ms.fast), 'أسرع إجابة', sec, true, 5)])]));
    w.appendChild(boardCard(t, null, true));
    var rv = h('details', { class: 'nba-card nba-rvd' }, [h('summary', { text: 'مراجعة الأسئلة' })]);
    for (var i = 0; i < NQ; i++) {
      var q = S.q[i], k = S.k[i]; if (!q || !k) continue;
      rv.appendChild(h('div', { class: 'nba-rv' }, [h('b', { text: (i + 1) + '. ' + q.q }), h('div', { class: 'ca', text: 'الصحيح: ' + LETTERS[k.c] + ' — ' + q.o[k.c] }), k.e ? h('div', { text: k.e }) : null,
        S.my[i] && S.my[i].c !== undefined ? h('div', { style: 'color:var(--muted);font-size:12px', text: pts(S.uid, i) ? 'جاوبت صح (+' + pts(S.uid, i) + ')' : 'إجابتك: ' + (q.o[S.my[i].c] || '—') }) : null]));
    }
    w.appendChild(rv);
    w.appendChild(h('button', { class: 'nba-btn', onclick: function () { leaveGame(); } }, [isHostNow() ? 'إنهاء الغرفة والرجوع' : 'خروج']));
  }
  function isHostNow() { return !!(S && S.room && S.room.host === S.uid); }
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
