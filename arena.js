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
      warn: function (n) { t(900 + (5 - Math.min(5, n || 5)) * 110, 0, 0.06, 'square', 0.07); },
      correct: function () { [523, 659, 784, 1047].forEach(function (f, i) { t(f, i * 0.07, 0.24, 'triangle', 0.22); }); },
      wrong: function () { t(220, 0, 0.3, 'sawtooth', 0.15, 110); t(165, 0.1, 0.3, 'square', 0.06, 80); },
      win: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { t(f, i * 0.11, 0.3, 'triangle', 0.22); }); [523, 659, 784, 1047].forEach(function (f) { t(f, 0.6, 1.2, 'sine', 0.1); }); },
      end: function () { [392, 330, 262].forEach(function (f, i) { t(f, i * 0.17, 0.4, 'sine', 0.18); }); },
      /* ARENA-ROUNDS: فاصل صوتي لكل جولة (e سهل · m متوسط · h صعب) + صوت نهاية الجولة + سلسلة صح + عدم إجابة */
      rd: function (d) {
        if (d === 'h') { t(70, 0, 1, 'sine', 0.42, 34); t(110, 0, 0.75, 'sawtooth', 0.09, 440); [440, 523, 659].forEach(function (f) { t(f, 0.72, 1.3, 'sawtooth', 0.06); t(f / 2, 0.72, 1.3, 'triangle', 0.12); }); }
        else if (d === 'm') { t(110, 0, 0.3, 'sine', 0.36, 55); t(110, 0.2, 0.3, 'sine', 0.3, 55); [294, 392, 440].forEach(function (f, i) { t(f, 0.3 + i * 0.09, 0.4, 'triangle', 0.18); }); t(587, 0.58, 0.55, 'square', 0.06); }
        else { [330, 440, 554, 659].forEach(function (f, i) { t(f, i * 0.09, 0.5, 'sine', 0.16); }); t(1318, 0.34, 0.7, 'sine', 0.07); t(1760, 0.42, 0.6, 'sine', 0.04); }
      },
      re: function () { [784, 659, 523].forEach(function (f, i) { t(f, i * 0.12, 0.28, 'sine', 0.16); }); t(130, 0, 0.35, 'sine', 0.22, 65); },
      streak: function (n) { var b = 880 + Math.min(4, (n || 2) - 2) * 110; [b, b * 1.25, b * 1.5].forEach(function (f, i) { t(f, i * 0.06, 0.2, 'sine', 0.12); }); },
      miss: function () { t(300, 0, 0.1, 'square', 0.07, 240); t(220, 0.14, 0.18, 'triangle', 0.12, 150); }
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
    for (var i = 0; i < 14; i++) d.appendChild(h('i', { style: '--x:' + (4 + (i * 7) % 92) + '%;--s:' + (2 + i % 3) + 'px;--d:' + (9 + (i % 5) * 2) + 's;--dl:-' + (i * 1.3).toFixed(1) + 's;--dx:' + ((i % 2 ? 1 : -1) * (20 + (i % 4) * 15)) + 'px' }));
    return d;
  }
  function flash(kind) { if (!root || RM()) return; var f = h('div', { class: 'nba-flash ' + kind, 'aria-hidden': 'true' }); root.appendChild(f); setTimeout(function () { f.remove(); }, 900); }
  function confetti(n) {
    if (!root || RM()) return;
    var c = h('div', { class: 'nba-conf', 'aria-hidden': 'true' }), cols = ['#3ddc84', '#f5b83d', '#7af0ae', '#ffd778', '#ffffff', '#2b9cff'];
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

  /* ───────── CSS (بنفس توكنز نبتيكس: --brand / --card / --line / --gold ...) ───────── */
  function css() {
    if (document.getElementById('nba-css')) return;
    var st = document.createElement('style'); st.id = 'nba-css';
    st.textContent = [
      '.nba-root{--bg:#060d09;--bg2:#0a1610;--bg3:#12231a;--card:#0f1d16;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.14);--ink:#ecf6f0;--ink2:#c6dccf;--slate:#9bb5a5;--muted:#7c9887;--brand:#3ddc84;--brand-l:#7af0ae;--brand-d:#157a3d;--brand-mist:rgba(61,220,132,.12);--brand-pale:rgba(61,220,132,.06);--gold:#f5b83d;--gold-l:#ffd778;--gold-pale:rgba(245,184,61,.13);--green:#3ddc84;--red:#ff5c6c;--r2:12px;--r3:16px;--r4:22px;--rpill:999px;--s2:0 12px 32px rgba(0,0,0,.4);--sglow:0 0 0 3px rgba(61,220,132,.22),0 0 26px rgba(61,220,132,.22);position:fixed;inset:0;z-index:100000;direction:rtl;font-family:var(--f-ui,Cairo,sans-serif);color:var(--ink);background:radial-gradient(120% 60% at 50% -8%,#14452b 0,transparent 62%),radial-gradient(70% 45% at 100% 100%,rgba(245,184,61,.08) 0,transparent 60%),linear-gradient(180deg,#07120b,#050a07);overflow-x:hidden;overflow-y:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;padding-top:env(safe-area-inset-top,0px);-webkit-tap-highlight-color:transparent;touch-action:manipulation;-webkit-font-smoothing:antialiased}',
      '.nba-root *{box-sizing:border-box}',
      '.nba-fx{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
      '.nba-fx::before{content:"";position:absolute;inset:0;background-image:linear-gradient(rgba(61,220,132,.045) 1px,transparent 1px),linear-gradient(90deg,rgba(61,220,132,.045) 1px,transparent 1px);background-size:44px 44px;-webkit-mask-image:radial-gradient(70% 55% at 50% 30%,#000,transparent);mask-image:radial-gradient(70% 55% at 50% 30%,#000,transparent)}',
      '.nba-fx i{position:absolute;bottom:-12px;left:var(--x);width:var(--s);height:var(--s);border-radius:50%;background:var(--brand-l);box-shadow:0 0 10px 2px rgba(61,220,132,.55);opacity:0;animation:nbaFloat var(--d) linear var(--dl) infinite;will-change:transform,opacity}',
      '.nba-wrap{position:relative;z-index:1;max-width:520px;margin:0 auto;padding:12px 16px calc(32px + env(safe-area-inset-bottom,0px))}',
      '.nba-enter>*{animation:nbaIn .5s cubic-bezier(.2,.8,.2,1) both}',
      '.nba-enter>*:nth-child(2){animation-delay:.05s}.nba-enter>*:nth-child(3){animation-delay:.1s}.nba-enter>*:nth-child(4){animation-delay:.15s}.nba-enter>*:nth-child(5){animation-delay:.2s}.nba-enter>*:nth-child(6){animation-delay:.25s}.nba-enter>*:nth-child(n+7){animation-delay:.3s}',
      '.nba-top{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:6px 0 12px;height:60px}',
      '.nba-ttl{display:flex;align-items:center;gap:10px;font-weight:900;font-size:18px;letter-spacing:.2px}',
      '.nba-logo{width:36px;height:36px;border-radius:12px;background:linear-gradient(135deg,var(--brand-l),var(--brand-d));color:#04140a;display:grid;place-items:center;box-shadow:0 0 0 1px rgba(255,255,255,.18) inset,0 6px 20px rgba(61,220,132,.4)}',
      '.nba-ico{display:inline-grid;place-items:center;width:18px;height:18px;flex:none}.nba-ico svg{width:100%;height:100%}',
      '.nba-x{width:42px;height:42px;border-radius:50%;border:1px solid var(--line2);background:rgba(255,255,255,.06);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:background .2s,transform .15s}',
      '.nba-x:hover{background:rgba(255,255,255,.12)}.nba-x:active{transform:scale(.92)}',
      '.nba-sndbar{position:absolute;top:calc(env(safe-area-inset-top,0px) + 18px);left:0;right:0;max-width:520px;margin:0 auto;height:0;z-index:6;pointer-events:none}',
      '.nba-snb{position:absolute;left:66px;top:0;pointer-events:auto}',
      '.nba-snb .nba-x.off{color:var(--muted)}',
      '.nba-pop{position:absolute;top:50px;left:0;width:220px;padding:14px;border-radius:var(--r3);background:rgba(15,29,22,.97);border:1px solid var(--line2);box-shadow:0 18px 40px rgba(0,0,0,.55);animation:nbaIn .2s ease-out both}',
      '.nba-pop[hidden]{display:none}',
      '.nba-pop .rw{display:flex;align-items:center;justify-content:space-between;gap:10px;font-weight:700;font-size:13px;margin-bottom:12px}',
      '.nba-sw{position:relative;width:46px;height:26px;border-radius:26px;border:0;background:rgba(255,255,255,.15);cursor:pointer;transition:background .2s;padding:0}',
      '.nba-sw::after{content:"";position:absolute;top:3px;right:3px;width:20px;height:20px;border-radius:50%;background:#fff;transition:transform .2s}',
      '.nba-sw[aria-checked=true]{background:var(--brand)}.nba-sw[aria-checked=true]::after{transform:translateX(-20px)}',
      '.nba-rng{width:100%;direction:ltr;accent-color:var(--brand);height:28px;margin:0}',
      '.nba-card{position:relative;background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012)),var(--card);border:1px solid var(--line);border-radius:var(--r4);box-shadow:var(--s2),inset 0 1px 0 rgba(255,255,255,.06);padding:16px;margin-bottom:12px}',
      '.nba-card.tight{padding:12px}',
      '.nba-hero{background:radial-gradient(90% 120% at 100% 0,rgba(61,220,132,.3),transparent 60%),linear-gradient(135deg,#0f3d25,#0a2417);border:1px solid rgba(61,220,132,.3);overflow:hidden;padding:20px 18px}',
      '.nba-hero::after{content:"";position:absolute;width:220px;height:220px;left:-70px;bottom:-110px;border-radius:50%;background:radial-gradient(circle,rgba(245,184,61,.28),transparent 70%)}',
      '.nba-hero h2{margin:12px 0 6px;font-size:23px;font-weight:900;line-height:1.4}.nba-hero p{margin:0;color:var(--ink2);font-size:13.5px;line-height:1.75}',
      '.nba-hb{width:46px;height:46px;border-radius:15px;display:grid;place-items:center;color:#04140a;background:linear-gradient(135deg,var(--gold-l),var(--gold));box-shadow:0 8px 24px rgba(245,184,61,.4);animation:nbaBob 3s ease-in-out infinite}.nba-hb .nba-ico{width:24px;height:24px}',
      '.nba-btn{position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:50px;border:0;border-radius:var(--r3);padding:13px 16px;font:800 15px var(--f-ui,Cairo,sans-serif);cursor:pointer;color:#04140a;background:linear-gradient(135deg,var(--brand-l),var(--brand) 55%,#22b868);box-shadow:0 8px 22px rgba(61,220,132,.28),inset 0 1px 0 rgba(255,255,255,.45);transition:transform .15s,box-shadow .2s,filter .2s,opacity .2s}',
      '.nba-btn:active{transform:scale(.97)}.nba-btn[disabled]{opacity:.4;cursor:not-allowed;box-shadow:none;filter:grayscale(.35)}',
      '.nba-btn.sec{background:rgba(255,255,255,.05);color:var(--ink);border:1.5px solid var(--line2);box-shadow:none}',
      '.nba-btn.gold{color:#2a1a00;background:linear-gradient(135deg,var(--gold-l),var(--gold) 60%,#e09a1c);box-shadow:0 8px 26px rgba(245,184,61,.32),inset 0 1px 0 rgba(255,255,255,.5);font-size:16.5px;min-height:58px}',
      '.nba-btn.gold:not([disabled]){animation:nbaGlow 2.2s ease-in-out infinite}',
      '.nba-btn.gold:not([disabled])::after{content:"";position:absolute;top:0;bottom:0;width:40%;left:-60%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.55),transparent);transform:skewX(-20deg);animation:nbaShine 3s ease-in-out infinite}',
      '.nba-btn.sm{width:auto;min-height:42px;padding:8px 14px;font-size:13px;border-radius:var(--r2)}',
      '.nba-ib{flex:none;width:38px;height:38px;border-radius:50%;border:1px solid var(--line2);background:rgba(255,255,255,.07);color:var(--ink);display:grid;place-items:center;cursor:pointer;transition:transform .15s,background .2s}.nba-ib:active{transform:scale(.9)}.nba-ib:hover{background:rgba(255,255,255,.14)}',
      '@media (hover:hover){.nba-btn:not([disabled]):hover{filter:brightness(1.08)}.nba-btn.sec:hover{background:rgba(255,255,255,.1);filter:none}.nba-chip:hover{border-color:rgba(61,220,132,.5)}.nba-opt:not([disabled]):hover{border-color:rgba(61,220,132,.55);transform:translateY(-1px)}}',
      '.nba-in{width:100%;border:1.5px solid var(--line2);border-radius:var(--r3);padding:13px;font:800 22px var(--f-ui,Cairo,sans-serif);letter-spacing:.35em;text-align:center;text-transform:uppercase;background:rgba(0,0,0,.35);color:var(--ink);direction:ltr}',
      '.nba-in::placeholder{color:var(--muted);opacity:.6}',
      '.nba-in:focus{outline:0;border-color:var(--brand);box-shadow:var(--sglow)}',
      '.nba-lbl{font-weight:800;font-size:13px;color:var(--slate);margin:16px 0 9px}.nba-cen{text-align:center}',
      '.nba-seg{display:flex;gap:8px}.nba-seg>button{flex:1}',
      '.nba-chips{display:flex;flex-wrap:wrap;gap:8px}',
      '.nba-chip{min-height:38px;border:1.5px solid var(--line2);background:rgba(255,255,255,.04);color:var(--ink2);border-radius:var(--rpill);padding:7px 14px;font:700 12.5px var(--f-ui,Cairo,sans-serif);cursor:pointer;transition:transform .15s,background .2s,border-color .2s}',
      '.nba-chip:active{transform:scale(.94)}',
      '.nba-chip.on{background:linear-gradient(135deg,var(--brand-l),var(--brand));border-color:transparent;color:#04140a;box-shadow:0 4px 16px rgba(61,220,132,.3)}',
      '.nba-codecard{text-align:center;background:radial-gradient(80% 100% at 50% 0,rgba(61,220,132,.16),transparent 70%),linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.012)),var(--card)}',
      '.nba-cl{font-size:12px;font-weight:800;color:var(--slate);letter-spacing:.5px}',
      '.nba-code{display:flex;direction:ltr;justify-content:center;gap:7px;width:100%;border:0;background:none;padding:10px 0 4px;cursor:pointer;font-family:inherit;color:inherit;perspective:500px}',
      '.nba-code .ch{flex:1;max-width:52px;height:62px;display:grid;place-items:center;border-radius:13px;font:900 30px var(--f-ui,Cairo,sans-serif);color:var(--brand-l);background:linear-gradient(180deg,rgba(61,220,132,.18),rgba(61,220,132,.05));border:1.5px solid rgba(61,220,132,.35);box-shadow:0 6px 18px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.12);text-shadow:0 0 14px rgba(61,220,132,.7)}',
      '.nba-code .ch.in{animation:nbaTile .6s cubic-bezier(.2,.9,.3,1.2) both}',
      '.nba-code.cp .ch{animation:nbaCp .5s ease-out;color:var(--gold-l);border-color:var(--gold)}',
      '.nba-hint{font-size:11.5px;color:var(--muted);margin:4px 0 12px;font-weight:600}',
      '.nba-row{position:relative;display:flex;align-items:center;gap:11px;padding:8px 10px;min-height:58px;margin-bottom:8px;border:1px solid var(--line);border-radius:var(--r3);background:rgba(255,255,255,.03)}',
      '.nba-row:last-child{margin-bottom:0}',
      '.nba-row.me{border-color:rgba(61,220,132,.45);background:var(--brand-mist)}',
      '.nba-row.in{animation:nbaPl .55s cubic-bezier(.2,.9,.3,1.15) both;animation-delay:var(--dl,0s)}',
      '.nba-row.em{border-style:dashed;background:none;color:var(--muted);font-weight:700;font-size:12.5px;justify-content:center;gap:8px}',
      '.nba-wt{width:8px;height:8px;border-radius:50%;background:var(--muted);animation:nbaWait 1.4s ease-in-out infinite}',
      '.nba-row .nm{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.35}.nba-row .nm b{font-weight:800;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nba-row .nm small{font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '.nba-avw{position:relative;flex:none}',
      '.nba-hc{position:absolute;top:-7px;right:-5px;width:19px;height:19px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,var(--gold-l),var(--gold));color:#3a2400;box-shadow:0 2px 8px rgba(0,0,0,.4);z-index:2}.nba-hc .nba-ico{width:11px;height:11px}',
      '.nba-av{position:relative;border-radius:50%;color:#fff;display:grid;place-items:center;font-weight:800;flex:none;overflow:hidden;box-shadow:0 0 0 2px #07110b,0 0 0 4px var(--c,#3ddc84),0 0 16px -2px var(--c,#3ddc84)}.nba-av img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}',
      '.nba-dot{position:absolute;bottom:-1px;left:-2px;width:12px;height:12px;border-radius:50%;background:#5b6b62;border:2px solid #0f1d16;z-index:2}.nba-dot.on{background:var(--green);box-shadow:0 0 0 3px rgba(61,220,132,.2)}',
      '.nba-tag{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;font-weight:800;border-radius:var(--rpill);padding:3px 10px;background:var(--brand-mist);color:var(--brand-l);border:1px solid rgba(61,220,132,.2)}.nba-tag.g{background:var(--gold-pale);color:var(--gold-l);border-color:rgba(245,184,61,.25)}',
      '.nba-meta{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px;justify-content:center}.nba-hero .nba-meta{justify-content:flex-start;position:relative;z-index:1}',
      '.nba-teams{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nba-team{min-width:0;border-radius:var(--r3);padding:9px;border:1.5px solid rgba(61,220,132,.32);background:linear-gradient(180deg,rgba(61,220,132,.12),rgba(61,220,132,.02))}',
      '.nba-team.b{border-color:rgba(245,184,61,.38);background:linear-gradient(180deg,rgba(245,184,61,.13),rgba(245,184,61,.02))}',
      '.nba-team h4{margin:0 0 8px;font-size:14px;font-weight:900;display:flex;justify-content:space-between;align-items:center;gap:6px}',
      '.nba-team.a h4{color:var(--brand-l)}.nba-team.b h4{color:var(--gold-l)}',
      '.nba-team .nba-row{padding:6px 5px;gap:7px;min-height:52px}.nba-team .nba-av{width:32px!important;height:32px!important;font-size:13px!important}.nba-team .nba-row .nm b{font-size:13px}',
      '.nba-vs{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:42px;height:42px;border-radius:50%;display:grid;place-items:center;font:900 13px var(--f-ui,Cairo,sans-serif);letter-spacing:.5px;color:#fff;background:radial-gradient(circle,#2a3b32,#0a120d);border:2px solid var(--line2);box-shadow:0 0 0 4px #0f1d16,0 0 24px rgba(255,255,255,.14);z-index:2;animation:nbaVs 2.4s ease-in-out infinite}',
      '.nba-qh{display:flex;align-items:center;justify-content:space-between;margin:2px 0 6px;min-height:56px}',
      '.nba-qn{display:flex;align-items:baseline;gap:6px;flex-wrap:wrap;font-weight:800;color:var(--slate);font-size:13px}.nba-qn b{font:900 30px/1 var(--f-ui,Cairo,sans-serif);color:var(--ink)}',
      '.nba-pips{display:flex;gap:5px;margin:2px 0 10px}',
      '.nba-pips i{flex:1;height:5px;border-radius:5px;background:rgba(255,255,255,.1);transition:background .3s}',
      '.nba-pips i.ok{background:var(--green);box-shadow:0 0 8px rgba(61,220,132,.6)}.nba-pips i.no{background:var(--red)}.nba-pips i.cur{background:var(--brand-l);animation:nbaPulse 1.2s ease-in-out infinite}',
      '.nba-ring{position:relative;width:56px;height:56px;flex:none}',
      '.nba-ring svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '.nba-ring circle{fill:none;stroke-width:5;stroke-linecap:round}',
      '.nba-ring .bg{stroke:rgba(255,255,255,.1)}',
      '.nba-ring .fg{stroke:var(--brand);stroke-dasharray:138.23;stroke-dashoffset:0;transition:stroke-dashoffset .25s linear,stroke .3s}',
      '.nba-ring .n{position:absolute;inset:0;display:grid;place-items:center;font:900 19px var(--f-ui,Cairo,sans-serif);font-variant-numeric:tabular-nums}',
      '.nba-ring.lo .fg{stroke:var(--red)}.nba-ring.lo .n{color:var(--red)}.nba-ring.lo{animation:nbaBeat 1s ease-in-out infinite}',
      '.nba-ring.nx .fg{stroke:var(--gold)}.nba-ring.nx .n{color:var(--gold-l)}',
      '.nba-qcard{position:relative;display:flex;align-items:center;min-height:116px;overflow:hidden;border-radius:var(--r4);padding:18px 16px;margin:6px 0 14px;background:linear-gradient(160deg,rgba(61,220,132,.14),rgba(255,255,255,.03) 50%),var(--card);border:1px solid rgba(61,220,132,.26);box-shadow:var(--s2),inset 0 1px 0 rgba(255,255,255,.08)}',
      '.nba-qcard::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,var(--brand),transparent)}',
      '.nba-qcard.in{animation:nbaIn .45s cubic-bezier(.2,.9,.3,1) both}',
      '.nba-q{font-weight:800;font-size:18px;line-height:1.75;margin:0}',
      '.nba-opt{position:relative;display:flex;align-items:center;gap:12px;width:100%;min-height:58px;text-align:right;border:1.5px solid var(--line2);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.02));color:var(--ink);border-radius:var(--r3);padding:11px 12px;margin-bottom:10px;font:700 15.5px/1.6 var(--f-ui,Cairo,sans-serif);cursor:pointer;transition:transform .14s,border-color .18s,background .18s,box-shadow .18s,opacity .25s}',
      '.nba-opt:active:not([disabled]){transform:scale(.975)}',
      '.nba-opt .lt{width:34px;height:34px;border-radius:11px;background:rgba(255,255,255,.09);color:var(--ink2);display:grid;place-items:center;font-weight:900;flex:none;transition:background .2s,color .2s}',
      '.nba-opt.in{animation:nbaOpt .42s cubic-bezier(.2,.9,.3,1) both;animation-delay:calc(var(--n,0)*70ms + 120ms)}',
      '.nba-opt.sel{border-color:var(--brand);background:linear-gradient(180deg,rgba(61,220,132,.24),rgba(61,220,132,.08));box-shadow:var(--sglow);animation:nbaPick .38s cubic-bezier(.2,.9,.3,1.3)}.nba-opt.sel .lt{background:var(--brand);color:#04140a}',
      '.nba-opt.lk{opacity:.5}',
      '.nba-opt.ok{border-color:var(--green);background:linear-gradient(180deg,rgba(61,220,132,.3),rgba(61,220,132,.1));box-shadow:0 0 0 3px rgba(61,220,132,.2),0 0 28px rgba(61,220,132,.32);animation:nbaOk .6s ease-out}.nba-opt.ok .lt{background:var(--green);color:#04140a}',
      '.nba-opt.no{border-color:var(--red);background:rgba(255,92,108,.15);animation:nbaNo .45s ease-out}.nba-opt.no .lt{background:var(--red);color:#fff}',
      '.nba-opt.dim{opacity:.4}.nba-opt[disabled]{cursor:default}',
      '.nba-lock{display:flex;align-items:center;justify-content:center;gap:8px;min-height:40px;text-align:center;font-weight:700;font-size:13px;color:var(--slate);padding:6px 0}',
      '.nba-lock::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--brand);animation:nbaWait 1.2s ease-in-out infinite;flex:none}',
      '.nba-fb{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;min-height:46px}',
      '.nba-gain{font:900 30px var(--f-ui,Cairo,sans-serif);text-align:center;margin:2px 0;font-variant-numeric:tabular-nums;animation:nbaGain .6s cubic-bezier(.2,.9,.3,1.4) both}',
      '.nba-gain.ok{color:var(--green);text-shadow:0 0 24px rgba(61,220,132,.55)}.nba-gain.no{color:var(--red);font-size:20px}',
      '.nba-streak{display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border-radius:var(--rpill);font-weight:800;font-size:12px;color:#2a1a00;background:linear-gradient(135deg,var(--gold-l),var(--gold));animation:nbaGain .6s .2s cubic-bezier(.2,.9,.3,1.4) both}.nba-streak .nba-ico{width:14px;height:14px}',
      '.nba-xp{background:var(--brand-pale);border:1px solid var(--line);border-right:3px solid var(--brand);border-radius:var(--r3);padding:12px 14px;font-size:13.5px;line-height:1.85;color:var(--ink2);margin-top:6px}',
      '.nba-lead{position:relative;display:flex;align-items:center;gap:10px;height:46px;padding:0 8px;border-radius:var(--r2)}',
      '.nba-lead .rk{width:24px;height:24px;border-radius:50%;display:grid;place-items:center;flex:none;font-weight:900;font-size:12px;color:var(--muted);background:rgba(255,255,255,.06)}',
      '.nba-lead .rk.r1{background:linear-gradient(135deg,var(--gold-l),var(--gold));color:#3a2400}.nba-lead .rk.r2{background:linear-gradient(135deg,#e6edf2,#a9b6c0);color:#1d2a33}.nba-lead .rk.r3{background:linear-gradient(135deg,#e9a56d,#b0642c);color:#2d1500}',
      '.nba-lead .nm{flex:1;min-width:0;font-weight:700;font-size:13.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nba-lead .sc{font-weight:900;color:var(--brand-l);font-variant-numeric:tabular-nums;min-width:38px;text-align:left}',
      '.nba-lead.me{background:var(--brand-mist);box-shadow:inset 0 0 0 1px rgba(61,220,132,.35)}',
      '.nba-lead.mv{animation:nbaRise .7s cubic-bezier(.25,.9,.3,1) both}',
      '.nba-lead .nba-tag{animation:nbaGain .5s .3s cubic-bezier(.2,.9,.3,1.4) both}',
      '.nba-lead .pb{position:absolute;right:8px;left:8px;bottom:0;height:2px;border-radius:2px;background:linear-gradient(270deg,var(--brand),transparent);transform-origin:right;animation:nbaScaleX 1s .4s cubic-bezier(.2,.9,.3,1) both;opacity:.7}',
      '.nba-cd{position:relative;display:grid;place-items:center;height:250px;margin:4px 0 8px}',
      '.nba-cd::before{content:"";position:absolute;width:230px;height:230px;border-radius:50%;background:conic-gradient(from 0deg,transparent,rgba(61,220,132,.7),transparent 40%,rgba(245,184,61,.6),transparent 80%);-webkit-mask:radial-gradient(circle,transparent 62%,#000 63%,#000 70%,transparent 71%);mask:radial-gradient(circle,transparent 62%,#000 63%,#000 70%,transparent 71%);animation:nbaSpin 3.5s linear infinite}',
      '.nba-cd i{position:absolute;width:150px;height:150px;border-radius:50%;border:3px solid var(--brand);opacity:0}.nba-cd i.b{border-color:var(--gold)}',
      '.nba-cd.hit i{animation:nbaWave .9s ease-out}.nba-cd.hit i.b{animation-delay:.12s}',
      '.nba-big{position:relative;font:900 124px/1 var(--f-ui,Cairo,sans-serif);color:#fff;text-shadow:0 0 36px rgba(61,220,132,.85),0 0 80px rgba(61,220,132,.4);font-variant-numeric:tabular-nums}.nba-big.sm{font-size:50px}',
      '.nba-cd.hit .nba-big{animation:nbaCount .9s cubic-bezier(.1,.9,.2,1) both}',
      '.nba-vsrow{display:flex;align-items:flex-start;justify-content:center;gap:14px;flex-wrap:wrap;margin:6px 0 4px}',
      '.nba-side{display:flex;flex-direction:column;align-items:center;gap:8px;min-width:0}.nba-side>b{font-size:12px;font-weight:900}.nba-side.a>b{color:var(--brand-l)}.nba-side.b>b{color:var(--gold-l)}',
      '.nba-mu{display:flex;justify-content:center;gap:12px;flex-wrap:wrap}.nba-mp{display:flex;flex-direction:column;align-items:center;gap:6px;width:62px;animation:nbaPl .5s cubic-bezier(.2,.9,.3,1.15) both;animation-delay:var(--dl,0s)}.nba-mp small{font-weight:700;font-size:11px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ink2)}',
      '.nba-vsb{align-self:center;font:900 22px var(--f-ui,Cairo,sans-serif);color:var(--gold-l);text-shadow:0 0 18px rgba(245,184,61,.7);animation:nbaVs2 1.6s ease-in-out infinite}',
      '.nba-badge{display:inline-block;margin-bottom:12px;padding:4px 14px;border-radius:var(--rpill);font-size:12px;font-weight:800;color:var(--gold-l);background:var(--gold-pale);border:1px solid rgba(245,184,61,.3)}',
      '.nba-win{position:relative;text-align:center;padding:24px 14px 20px;overflow:hidden;border-color:rgba(245,184,61,.35);background:radial-gradient(90% 70% at 50% 0,rgba(245,184,61,.2),transparent 70%),var(--card)}',
      '.nba-win::before{content:"";position:absolute;left:50%;top:-80px;width:320px;height:320px;margin-left:-160px;background:repeating-conic-gradient(rgba(245,184,61,.2) 0 7deg,transparent 7deg 22deg);-webkit-mask:radial-gradient(circle,#000,transparent 68%);mask:radial-gradient(circle,#000,transparent 68%);animation:nbaSpin 16s linear infinite}',
      '.nba-win>*{position:relative}',
      '.nba-win .tr{width:84px;height:84px;margin:0 auto 12px;border-radius:50%;background:linear-gradient(135deg,var(--gold-l),var(--gold));color:#3a2400;display:grid;place-items:center;box-shadow:0 12px 34px rgba(245,184,61,.45);animation:nbaDrop .8s cubic-bezier(.2,1.3,.3,1) both}.nba-win .tr .nba-ico{width:42px;height:42px}',
      '.nba-win h2{margin:0 0 4px;font-size:24px;font-weight:900;animation:nbaIn .6s .25s both}.nba-win p{margin:0;color:var(--slate);font-size:14px;font-weight:700;animation:nbaIn .6s .35s both}',
      '.nba-pod{display:flex;align-items:flex-end;justify-content:center;gap:10px;margin:10px 0 0}',
      '.nba-pod>div{position:relative;display:flex;flex-direction:column;align-items:center;gap:7px;width:31%;min-width:0;animation:nbaIn .5s both;animation-delay:var(--dl)}',
      '.nba-pod .p3{--dl:.15s}.nba-pod .p2{--dl:.45s}.nba-pod .p1{--dl:.8s}',
      '.nba-pod .st{position:relative;width:100%;border-radius:14px 14px 0 0;display:grid;place-items:center;color:#fff;font:900 20px var(--f-ui,Cairo,sans-serif);padding-top:6px;font-variant-numeric:tabular-nums}',
      '.nba-pod .st::before{content:"";position:absolute;inset:0;border-radius:inherit;background:linear-gradient(180deg,var(--brand),var(--brand-d));transform-origin:bottom;animation:nbaGrow .8s cubic-bezier(.2,.9,.3,1) both;animation-delay:var(--dl)}',
      '.nba-pod .st>span{position:relative}',
      '.nba-pod .p1 .st{height:104px;color:#2a1a00}.nba-pod .p1 .st::before{background:linear-gradient(180deg,var(--gold-l),var(--gold))}.nba-pod .p2 .st{height:76px}.nba-pod .p3 .st{height:56px}.nba-pod .p3 .st::before{opacity:.75}',
      '.nba-pod small{font-weight:800;font-size:12px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nba-pod .cr{position:absolute;top:-24px;color:var(--gold-l);animation:nbaBob 2.4s ease-in-out infinite;filter:drop-shadow(0 0 8px rgba(245,184,61,.8))}.nba-pod .cr .nba-ico{width:24px;height:24px}',
      '.nba-tvs{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:8px;text-align:center}',
      '.nba-tvs .t{border-radius:var(--r3);padding:12px 6px;border:1.5px solid rgba(61,220,132,.32);background:rgba(61,220,132,.08);min-width:0}.nba-tvs .t.b{border-color:rgba(245,184,61,.38);background:rgba(245,184,61,.09)}',
      '.nba-tvs .t.w{box-shadow:0 0 0 3px rgba(61,220,132,.2),0 0 30px rgba(61,220,132,.3)}.nba-tvs .t.b.w{box-shadow:0 0 0 3px rgba(245,184,61,.22),0 0 30px rgba(245,184,61,.3)}',
      '.nba-tvs .t small{display:block;font-weight:800;font-size:12.5px;color:var(--slate)}.nba-tvs .t b{display:block;font:900 32px/1.3 var(--f-ui,Cairo,sans-serif);font-variant-numeric:tabular-nums}.nba-tvs .t.a b{color:var(--brand-l)}.nba-tvs .t.b b{color:var(--gold-l)}',
      '.nba-tbar{height:10px;border-radius:10px;background:var(--gold);overflow:hidden;margin-top:14px}.nba-tbar i{display:block;height:100%;width:var(--p);background:linear-gradient(270deg,var(--brand-l),var(--brand-d));border-radius:10px;transform-origin:right;animation:nbaScaleX 1.1s .4s cubic-bezier(.2,.9,.3,1) both}',
      '.nba-stats{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nba-stat{border-radius:var(--r3);background:rgba(255,255,255,.04);border:1px solid var(--line);padding:12px 8px;text-align:center;animation:nbaIn .5s both;animation-delay:var(--dl,0s)}',
      '.nba-stat b{display:block;font:900 26px/1.3 var(--f-ui,Cairo,sans-serif);color:var(--brand-l);font-variant-numeric:tabular-nums}.nba-stat.g b{color:var(--gold-l)}.nba-stat span{font-size:12px;color:var(--slate);font-weight:700}',
      '.nba-rvd summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;font-weight:800;font-size:13px;color:var(--slate);min-height:28px}.nba-rvd summary::-webkit-details-marker{display:none}.nba-rvd summary::after{content:"+";font-size:20px;color:var(--brand-l)}.nba-rvd[open] summary::after{content:"\\2212"}',
      '.nba-rv{border-top:1px solid var(--line);padding:11px 2px;font-size:13.5px;line-height:1.8}.nba-rv b{display:block;margin-bottom:3px}.nba-rv .ca{color:var(--green);font-weight:700}',
      '.nba-err{background:rgba(255,92,108,.12);border:1px solid rgba(255,92,108,.3);color:#ff9aa4;border-radius:var(--r2);padding:10px 12px;font-size:13px;font-weight:700;margin-bottom:10px}',
      '.nba-note{color:var(--slate);font-size:12.5px;line-height:1.8;text-align:center;margin:8px 0;font-weight:600}',
      '.nba-spin{width:22px;height:22px;border-radius:50%;border:3px solid rgba(4,20,10,.25);border-top-color:#04140a;animation:nbaSp .8s linear infinite}.nba-spin.d{border-color:var(--line2);border-top-color:var(--brand)}',
      '.nba-conf{position:fixed;inset:0;z-index:5;pointer-events:none;overflow:hidden}',
      '.nba-conf i{position:absolute;top:-16px;left:var(--x);width:var(--w);height:calc(var(--w)*1.6);background:var(--c);border-radius:2px;opacity:0;animation:nbaFall var(--t) linear var(--d) forwards;will-change:transform}',
      '.nba-flash{position:fixed;inset:0;z-index:4;pointer-events:none;animation:nbaFlash .8s ease-out forwards}',
      '.nba-flash.ok,.nba-flash.go{background:radial-gradient(120% 90% at 50% 50%,transparent 50%,rgba(61,220,132,.4))}.nba-flash.no{background:radial-gradient(120% 90% at 50% 50%,transparent 50%,rgba(255,92,108,.4))}',
      '@keyframes nbaIn{from{opacity:0;transform:translate3d(0,14px,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaFloat{0%{transform:translate3d(0,0,0);opacity:0}12%{opacity:.8}100%{transform:translate3d(var(--dx),-105vh,0);opacity:0}}',
      '@keyframes nbaShine{0%,55%{left:-60%}100%{left:130%}}',
      '@keyframes nbaGlow{0%,100%{box-shadow:0 8px 26px rgba(245,184,61,.3),inset 0 1px 0 rgba(255,255,255,.5)}50%{box-shadow:0 8px 40px rgba(245,184,61,.6),inset 0 1px 0 rgba(255,255,255,.5)}}',
      '@keyframes nbaBob{0%,100%{transform:translate3d(0,0,0)}50%{transform:translate3d(0,-5px,0)}}',
      '@keyframes nbaPl{from{opacity:0;transform:translate3d(24px,0,0) scale(.92)}to{opacity:1;transform:none}}',
      '@keyframes nbaWait{0%,100%{opacity:.25}50%{opacity:1}}',
      '@keyframes nbaVs{0%,100%{transform:translate(-50%,-50%) scale(1)}50%{transform:translate(-50%,-50%) scale(1.1)}}',
      '@keyframes nbaVs2{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}',
      '@keyframes nbaTile{from{opacity:0;transform:rotateX(-90deg) translate3d(0,10px,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaCp{0%{transform:scale(1)}40%{transform:scale(1.14);box-shadow:0 0 24px rgba(245,184,61,.7)}100%{transform:scale(1)}}',
      '@keyframes nbaPick{0%{transform:scale(.96)}60%{transform:scale(1.025)}100%{transform:scale(1)}}',
      '@keyframes nbaOk{0%{transform:scale(1)}40%{transform:scale(1.04)}100%{transform:scale(1)}}',
      '@keyframes nbaNo{0%,100%{transform:translate3d(0,0,0)}20%{transform:translate3d(-7px,0,0)}40%{transform:translate3d(7px,0,0)}60%{transform:translate3d(-5px,0,0)}80%{transform:translate3d(4px,0,0)}}',
      '@keyframes nbaOpt{from{opacity:0;transform:translate3d(28px,0,0)}to{opacity:1;transform:none}}',
      '@keyframes nbaGain{from{opacity:0;transform:scale(.5)}to{opacity:1;transform:none}}',
      '@keyframes nbaBeat{0%,100%{transform:scale(1)}50%{transform:scale(1.1)}}',
      '@keyframes nbaPulse{0%,100%{opacity:.55}50%{opacity:1}}',
      '@keyframes nbaSpin{to{transform:rotate(360deg)}}',
      '@keyframes nbaCount{0%{opacity:0;transform:scale(2.4)}35%{opacity:1;transform:scale(.94)}100%{opacity:1;transform:scale(1)}}',
      '@keyframes nbaWave{0%{opacity:.8;transform:scale(.6)}100%{opacity:0;transform:scale(2.3)}}',
      '@keyframes nbaRise{from{opacity:var(--o,1);transform:translate3d(0,var(--dy,0),0)}to{opacity:1;transform:none}}',
      '@keyframes nbaDrop{from{opacity:0;transform:translate3d(0,-60px,0) scale(.4)}to{opacity:1;transform:none}}',
      '@keyframes nbaGrow{from{transform:scaleY(0)}to{transform:scaleY(1)}}',
      '@keyframes nbaScaleX{from{transform:scaleX(0)}to{transform:scaleX(1)}}',
      '@keyframes nbaFall{0%{opacity:1;transform:translate3d(0,0,0) rotate(0)}100%{opacity:1;transform:translate3d(var(--dx),108vh,0) rotate(var(--r))}}',
      '@keyframes nbaFlash{0%{opacity:0}20%{opacity:1}100%{opacity:0}}',
      '@keyframes nbaSp{to{transform:rotate(360deg)}}',
      '@media (max-width:360px){.nba-q{font-size:16.5px}.nba-opt{font-size:14.5px}.nba-code .ch{height:54px;font-size:26px}.nba-big{font-size:104px}.nba-hero h2{font-size:20px}}',
      '@media (max-height:640px){.nba-cd{height:200px}.nba-cd::before{width:190px;height:190px}.nba-big{font-size:96px}}',
      '@media (prefers-reduced-motion:reduce){.nba-root *,.nba-root *::before,.nba-root *::after{animation-duration:.001ms!important;animation-delay:0s!important;animation-iteration-count:1!important;transition-duration:.001ms!important}.nba-fx,.nba-conf,.nba-flash{display:none!important}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ───────── تحديث تصميم الساحة والغرفة v3 (إضافة فقط — يتفعّل بكلاس nba-lb على اللوبي) ───────── */
  function cssLobby() {
    if (document.getElementById('nba-css-lb')) return;
    var st = document.createElement('style'); st.id = 'nba-css-lb';
    st.textContent = [
      ".nba-root.nba-lb{--card:#14271D;--line:#28463A;--line2:#35594A;--brand:#2BD98A;--brand-l:#2BD98A;--slate:#A9BCB0;--muted:#98B0A2;--gold:#F2B84B;--gold-l:#F2B84B;--r3:8px;--r4:12px;--sglow:0 0 0 2px rgba(43,217,138,.35);background:linear-gradient(180deg,#112419 0,#0A1510 100%)}",
      ".nba-lb .nba-fx{display:none}",
      ".nba-lb .nba-ttl{font-size:15px;font-weight:700}.nba-lb .nba-ttl>span::after{content:\"\";display:inline-block;width:6px;height:6px;margin-inline-start:7px;background:#2BD98A;border-radius:1px}",
      ".nba-lb .nba-logo{width:34px;height:34px;border-radius:8px;background:#2BD98A url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Cpath d='M12 30V10L28 25V10' fill='none' stroke='%2304140A' stroke-width='4.5'/%3E%3Ccircle cx='28' cy='31.5' r='2.6' fill='%2304140A'/%3E%3C/svg%3E\") center/100% no-repeat;box-shadow:none}.nba-lb .nba-logo .nba-ico{display:none}",
      ".nba-lb .nba-x{border-radius:8px;background:none;border-color:#35594A}",
      ".nba-lb .nba-card{background:#14271D;box-shadow:none;border-radius:12px}",
      ".nba-lb .nba-btn{background:#2BD98A;color:#04140A;box-shadow:none;border-radius:8px;min-height:52px;font-weight:800}",
      ".nba-lb .nba-btn.sec{background:#1D372A;color:#EAF2ED;border:1px solid #35594A}",
      ".nba-lb .nba-btn.gold,.nba-lb .nba-btn.gold:not([disabled]){background:#2BD98A;color:#04140A;box-shadow:none;animation:none;min-height:58px;font-size:16.5px}",
      ".nba-lb .nba-btn.gold:not([disabled])::after{display:none}",
      ".nba-lb .nba-btn.sm{min-height:48px;font-size:14px}",
      ".nba-lb .nba-btn[disabled]{background:#1D372A;color:#A9BCB0;border:1px dashed #46685A;opacity:1;filter:none}.nba-lb .nba-btn.nbx-ch[disabled]{border:0;background:#1D372A}",
      ".nba-lb .nba-err{background:none;border:0;color:#FF8A7E;padding:0;margin:8px 0 0;font-size:13px}.nba-lb .nba-note{color:#A9BCB0}",
      ".nba-wrap.nba-hubw,.nba-wrap.nba-lobw{display:flex;flex-direction:column;min-height:100%;box-sizing:border-box}.nba-sp{flex:1;min-height:12px}",
      ".nba-lb .nba-av{box-shadow:0 0 0 2px #0C1912,0 0 0 3px var(--c,#2BD98A)}.nba-lb .nba-dot{border-color:#0C1912}.nba-lb .nba-hc{background:#F2B84B;box-shadow:none;width:20px;height:20px}",
      ".nba-lb .nba-row .nm small{color:#A9BCB0}.nba-lb .nba-ib.tx{width:auto;height:34px;padding:0 10px;border-radius:6px;border:1px solid #35594A;background:none;color:#A9BCB0;font:700 12px var(--f-ui,Cairo,sans-serif);cursor:pointer}",
      ".nbx-eb{display:flex;align-items:center;gap:8px;font-size:12.5px;font-weight:700;color:#2BD98A}.nbx-eb::before{content:\"\";width:6px;height:6px;background:#2BD98A;border-radius:1px}",
      ".nbx-hero{padding:18px 0 4px}.nbx-h{margin:14px 0 12px;font-size:36px;line-height:1.2;font-weight:800}.nbx-h em{font-style:normal;color:#2BD98A}.nbx-p{margin:0;color:#A9BCB0;font-size:15px;line-height:1.8;max-width:30ch}",
      ".nbx-stats{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid #28463A;border-bottom:1px solid #28463A;margin:26px 0 16px}.nbx-stats>div{padding:14px 0 12px}.nbx-stats>div+div{border-inline-start:1px solid #28463A;padding-inline-start:16px}",
      ".nbx-stats b{display:block;direction:ltr;text-align:right;font-size:26px;font-weight:800;line-height:1.1;font-variant-numeric:tabular-nums}.nbx-stats span{font-size:12.5px;color:#A9BCB0;font-weight:600}",
      ".nbx-ch{border-radius:0!important;clip-path:polygon(0 0,calc(100% - 14px) 0,100% 14px,100% 100%,14px 100%,0 calc(100% - 14px))}",
      ".nbx-jl{font-size:13px;font-weight:700;color:#A9BCB0;margin:16px 0 8px}",
      ".nbx-jg{display:flex;height:56px;border:1px solid #35594A;border-radius:8px;background:#0F2018;overflow:hidden}.nbx-jg:focus-within{border-color:#2BD98A}.nbx-jg.bad{border-color:#FF6B5E}",
      ".nbx-jg input{flex:1;min-width:0;border:0;outline:0;background:none;color:#EAF2ED;font:700 20px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.24em;text-align:center;text-transform:uppercase;direction:ltr;padding:0 12px}.nbx-jg input::placeholder{color:#7C9A8A;opacity:1}",
      ".nbx-jg button{border:0;border-inline-start:1px solid #35594A;background:none;color:#A9BCB0;font:700 15px var(--f-ui,Cairo,sans-serif);padding:0 24px;cursor:pointer}.nbx-jg button:not([disabled]){background:#2BD98A;color:#04140A;border-color:#2BD98A}.nbx-jg button[disabled]{cursor:not-allowed}",
      ".nbx-fh{font-size:12.5px;color:#98B0A2;margin-top:8px}.nbx-er{font-size:13px;color:#FF8A7E;margin-top:8px;font-weight:600}",
      ".nbx-tk{position:relative;background:#14271D;border:1px solid #28463A;border-radius:14px;margin-bottom:18px}.nbx-tk .a{padding:14px 18px 4px;text-align:center}.nbx-tk .l{display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:#A9BCB0}",
      ".nbx-code{display:block;width:100%;background:none;border:0;padding:0;cursor:pointer;font-family:inherit}.nbx-cv{display:block;direction:ltr;font:800 46px/1.15 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.16em;text-indent:.16em;color:#2BD98A;padding:10px 0 14px}.nbx-code.cp .nbx-cv{color:#F2B84B}",
      ".nbx-tk .p{position:relative;height:0;border-top:1.5px dashed #35594A;margin:0 14px}.nbx-tk .p::before,.nbx-tk .p::after{content:\"\";position:absolute;top:-10px;width:18px;height:18px;border-radius:50%;background:#0C1912}.nbx-tk .p::before{right:-24px}.nbx-tk .p::after{left:-24px}",
      ".nbx-tk .b{padding:14px}.nbx-meta{display:flex;justify-content:center;gap:8px;font-size:13px;font-weight:600;color:#A9BCB0;margin-bottom:12px}.nbx-meta i{font-style:normal;color:#7C9A8A}",
      ".nbx-sh{display:flex;align-items:center;gap:12px;margin:2px 2px 10px}.nbx-sh b{font-size:15px;font-weight:800}.nbx-mt{display:flex;gap:4px;flex:1}.nbx-mt i{flex:1;max-width:26px;height:4px;border-radius:2px;background:#35594A}.nbx-mt i.on{background:#2BD98A}.nbx-sh span{font:700 13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#A9BCB0}",
      ".nbx-seats{counter-reset:s;border-top:1px solid #28463A}.nbx-seats .nba-row{counter-increment:s;display:flex;align-items:center;gap:12px;border:0;border-bottom:1px solid #28463A;border-radius:0;background:none;margin:0;padding:10px 2px;min-height:64px}",
      ".nbx-seats .nba-row::before{content:counter(s,decimal-leading-zero);font:700 12px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#7C9A8A;width:20px}.nbx-seats .nba-row.me{background:none}.nbx-seats .nba-row.me .nm small{color:#2BD98A}.nbx-seats .nba-row.host .nm small{color:#F2B84B}",
      ".nbx-seats .nba-row.em{justify-content:flex-start;color:#98B0A2;font-weight:600;font-size:13.5px}",
      ".nbx-why{display:flex;gap:8px;align-items:center;justify-content:center;font-size:13px;color:#A9BCB0;font-weight:600;margin-top:10px;text-align:center}",
".nbx-hero{position:relative;padding:14px 0 0}.nbx-hero::before{content:\"\";position:absolute;top:6px;left:-36px;width:210px;height:250px;background:url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='6 4 28 34'%3E%3Cpath d='M12 30V10L28 25V10' fill='none' stroke='%232BD98A' stroke-width='4.5'/%3E%3Ccircle cx='28' cy='31.5' r='2.6' fill='%232BD98A'/%3E%3C/svg%3E\") center/contain no-repeat;opacity:.08;pointer-events:none}",
      ".nbx-pl{position:relative;display:flex;align-items:center;gap:10px;font-size:14.5px;font-weight:700}.nbx-pl small{display:block;color:#A9BCB0;font-weight:600;font-size:12.5px}.nbx-pl .nba-av{flex:none}",
      ".nbx-h{position:relative;font-size:34px;margin:16px 0 10px}.nbx-p{position:relative}",
      ".nbx-sec{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:700;color:#A9BCB0;margin:2px 0 10px}.nbx-sec::before{content:\"\";width:6px;height:6px;background:#2BD98A;border-radius:1px}",
      ".nbx-tiles{display:flex;gap:10px;overflow-x:auto;margin:0 -16px;padding:0 16px 4px;scroll-snap-type:x proximity;scrollbar-width:none}.nbx-tiles::-webkit-scrollbar{display:none}",
      ".nbx-t{flex:none;width:136px;height:92px;scroll-snap-align:start;display:flex;flex-direction:column;justify-content:space-between;text-align:right;padding:12px;background:#14271D;border:1px solid #28463A;border-radius:8px;color:#EAF2ED;font:700 14px/1.45 var(--f-ui,Cairo,sans-serif);cursor:pointer}.nbx-t i{font:700 11px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-style:normal;color:#7C9A8A}.nbx-t:active{border-color:#2BD98A}",
      "@media (hover:hover){.nbx-t:hover{border-color:#2BD98A}}",
      ".nba-lb .nba-btn{background:#2BD98A;box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 3px 0 #168A57;margin-bottom:3px;transition:transform .08s,box-shadow .08s}",
      ".nba-lb .nba-btn:active{transform:translateY(3px);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),0 0 0 #168A57}",
      ".nba-lb .nba-btn.sec{background:#1D372A;border:1px solid #35594A;box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 3px 0 #0A1510}.nba-lb .nba-btn.sec:active{box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 0 #0A1510}",
      ".nba-lb .nba-btn.nbx-ch,.nba-lb .nba-btn.gold.nbx-ch:not([disabled]){margin-bottom:0;box-shadow:none;padding-bottom:16px;background:linear-gradient(#8AF5C6 0 2px,#2BD98A 2px calc(100% - 5px),#168A57 calc(100% - 5px) 100%)}",
      ".nba-lb .nba-btn.nbx-ch:active{transform:translateY(2px)}",
      ".nba-lb .nba-btn.nbx-ch[disabled]{box-shadow:none;border:0;color:#98B0A2;background:linear-gradient(#35594A 0 2px,#1D372A 2px calc(100% - 5px),#14271D calc(100% - 5px) 100%)}",
      ".nbx-jg button:not([disabled]){box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -3px 0 #168A57}",
      ".nbx-t{box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 0 #0A1510}.nbx-tk{box-shadow:inset 0 1px 0 rgba(255,255,255,.05),0 2px 0 #0A1510}"
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ───────── توافق الأجهزة (إضافة فقط — بتتحمّل آخر ورقة ستايل فبتكسب أي تعادل في الأولوية، ومفيش كلاس ولا منطق اتغيّر) ───────── */
  function cssResp() {
    if (document.getElementById('nba-css-rs')) return;
    var st = document.createElement('style'); st.id = 'nba-css-rs';
    st.textContent = [
      /* كل الأجهزة: ألوان نظام داكنة للسكرول والعناصر الأصلية، منع تضخيم الخط في الأيفون بالعرض، سكرول رفيع للكمبيوتر */
      '.nba-root{color-scheme:dark;-webkit-text-size-adjust:100%;text-size-adjust:100%;scrollbar-width:thin;scrollbar-color:#35594A transparent}',
      '.nba-root::-webkit-scrollbar{width:8px}.nba-root::-webkit-scrollbar-track{background:transparent}.nba-root::-webkit-scrollbar-thumb{background:#35594A;border-radius:8px}',
      /* احتياطي للمتصفحات القديمة اللي مش بتدعم inset (أيفون قبل 14.5 / أندرويد ويب-فيو قديم) */
      '.nba-root,.nba-fx,.nba-conf,.nba-flash{top:0;right:0;bottom:0;left:0}',
      /* كيبورد/ماوس: حلقة تركيز واضحة */
      '.nba-root button:focus-visible,.nba-root summary:focus-visible{outline:2px solid #2BD98A;outline-offset:2px}',
      /* تابلت + لابتوب + كمبيوتر: عمود أعرض وخطوط أكبر شوية (شريط الصوت لازم يطابق عرض العمود عشان زرّه يفضل جنب زر الإغلاق) */
      '@media (min-width:768px){.nba-wrap,.nba-sndbar{max-width:600px}.nba-q{font-size:20px}.nba-opt{font-size:16.5px}}',
      '@media (min-width:1200px){.nba-wrap,.nba-sndbar{max-width:680px}}',
      /* شاشة السؤال على الموبايل الطويل (أيفون/أندرويد بالطول): كارت السؤال والاختيارات بيكبروا حسب ارتفاع الشاشة بدل فراغ كبير تحت. القيم ثابتة ومش بتتأثر بظهور الإجابة فمفيش قفزة وقت الكشف */
      '.nba-qcard{min-height:clamp(116px,24vh,230px);min-height:clamp(116px,24dvh,230px)}',
      '.nba-opt{min-height:clamp(58px,10vh,92px);min-height:clamp(58px,10dvh,92px)}',
      /* كلمة الصعوبة (سهل/متوسط/صعب) فوق السؤال: نص عادي من غير إطار بيضاوي ولا خلفية — اللون زي ما هو (أخضر، وذهبي للصعب). مقصورة على هيدر السؤال بس فباقي التاجات في الساحة زي ما هي */
      '.nba-qn .nba-tag{background:none;border:0;border-radius:0;padding:0}',
      /* جملة النتيجة (مبروك — أنت من الأبطال / انتهت المواجهة): نص عادي من غير إطار بيضاوي ولا خلفية، واللون الذهبي زي ما هو */
      '.nba-badge{background:none;border:0;border-radius:0;padding:0}',
      /* موبايل بالعرض (ارتفاع قليل) */
      '@media (max-height:480px){.nba-cd{height:150px}.nba-cd::before{width:140px;height:140px}.nba-cd i{width:96px;height:96px}.nba-big{font-size:72px}.nba-qcard{min-height:76px;padding:12px}.nba-opt{min-height:50px;margin-bottom:8px}.nba-win{padding:16px 12px}.nba-win .tr{width:64px;height:64px;margin-bottom:8px}}',
      /* شاشات ضيقة جدًا (320px) */
      '@media (max-width:340px){.nbx-cv{font-size:38px;letter-spacing:.1em;text-indent:.1em}.nbx-stats b{font-size:22px}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* أيقونات التخصصات (SVG مضمّنة، نفس أسلوب باقي أيقونات الساحة — بدون مكتبات) */
  var SPI = {
    pp: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
    path: '<path d="M5 19c0-9 5-14 15-14 0 10-5 15-14 15z"/><path d="M5 19c2-5 5-8 9-10"/>',
    ent: '<rect x="8" y="8" width="8" height="11" rx="4"/><path d="M12 8V5M9.5 4l2.5 1 2.5-1M4 11h4M16 11h4M5 18l3-2M19 18l-3-2M5.5 6.5L8 9M18.5 6.5L16 9"/>',
    hort: '<path d="M12 8c-2-2-7-1-7 5 0 5 3 8 7 8s7-3 7-8c0-6-5-7-7-5z"/><path d="M12 8c0-2 1-4 3-5"/>',
    bio: '<path d="M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4A2 2 0 0019 18l-5-9V3"/><path d="M7.5 15h9"/>',
    soil: '<path d="M12 2l9 5-9 5-9-5z"/><path d="M3 12l9 5 9-5"/><path d="M3 17l9 5 9-5"/>',
    food: '<path d="M7 3v8M5 3v5a2 2 0 002 2 2 2 0 002-2V3M7 11v10"/><path d="M17 21V3c-2.5 1.5-3.5 4.5-3.5 8H17"/>',
    gen: '<path d="M7 3c0 5 10 5 10 9s-10 4-10 9"/><path d="M17 3c0 5-10 5-10 9s10 4 10 9"/><path d="M9 5.5h6M9 18.5h6"/>',
    crop: '<path d="M12 22V8"/><path d="M12 8c-3 0-4-2-4-4 3 0 4 2 4 4zM12 8c3 0 4-2 4-4-3 0-4 2-4 4z"/><path d="M12 14c-3 0-4-2-4-4 3 0 4 2 4 4zM12 14c3 0 4-2 4-4-3 0-4 2-4 4z"/><path d="M12 20c-3 0-4-2-4-4 3 0 4 2 4 4zM12 20c3 0 4-2 4-4-3 0-4 2-4 4z"/>',
    irr: '<path d="M12 2.5C8 8 5 11 5 15a7 7 0 0014 0c0-4-3-7-7-12.5z"/>',
    anim: '<circle cx="7" cy="10" r="1.8"/><circle cx="12" cy="7" r="1.8"/><circle cx="17" cy="10" r="1.8"/><path d="M12 12c-3 0-5 3-5 5.5 0 1.5 1.5 2.5 3 2 1-.3 1.5-.5 2-.5s1 .2 2 .5c1.5.5 3-.5 3-2C17 15 15 12 12 12z"/>',
    eco: '<path d="M3 21h18"/><path d="M6 21v-7M12 21V4M18 21V10"/>',
    mix: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>'
  };

  /* ───────── تحسين شاشة ساحة نبتيكس الرئيسية (إضافة فقط — نفس الكلاسات ونفس المنطق، وبتتحمّل بعد باقي الستايلات) ───────── */
  function cssHub() {
    if (document.getElementById('nba-css-hb')) return;
    var st = document.createElement('style'); st.id = 'nba-css-hb';
    st.textContent = [
      /* ── الهيرو: تسلسل بصري أوضح وفراغات أقل ── */
      '.nbx-hero{padding:2px 0 0}',
      '.nbx-hero::before{opacity:.06;top:-4px;left:-52px;width:180px;height:220px}',
      '.nbx-pl{font-size:15px}.nbx-pl small{color:#B9CCBF;font-size:12.5px}',
      '.nbx-h{font-size:clamp(27px,8vw,34px);line-height:1.25;margin:10px 0 8px}',
      '.nbx-p{color:#C3D4C9;font-size:14px;line-height:1.7;max-width:34ch}',
      /* ── الإحصائيات: كارت واحد متماسك ── */
      '.nbx-stats{margin:14px 0 14px;border:1px solid #28463A;border-radius:14px;background:linear-gradient(180deg,rgba(43,217,138,.08),rgba(43,217,138,.02))}',
      '.nbx-stats>div{padding:10px 14px}.nbx-stats>div+div{padding-inline-start:14px}',
      '.nbx-stats b{font-size:21px}.nbx-stats span{color:#B9CCBF;font-size:12px}',
      '.nbx-stats>div:last-child b{color:#2BD98A}',
      '.nbx-stats>div:last-child b::before{content:"";display:inline-block;width:6px;height:6px;margin-inline-end:6px;border-radius:50%;background:#2BD98A;vertical-align:middle;animation:nbxLive 1.6s ease-in-out infinite}',
      /* ── عنوان القسم + تلميح السحب ── */
      '.nbx-sec{color:#C3D4C9;font-size:13.5px;margin:0 0 10px}',
      '.nbx-sec::after{content:"اسحب للمزيد ‹";margin-inline-start:auto;font-size:12px;font-weight:600;color:#8FA99A}',
      /* ── كروت التخصصات: صفين أفقيين بسنابّ ونهايات متلاشية (من غير قص مفاجئ)، وRTL صحيح ── */
      '.nbx-tiles{display:grid;grid-auto-flow:column;grid-template-rows:repeat(2,auto);grid-auto-columns:min(176px,46%);gap:10px;overflow-x:auto;overflow-y:hidden;margin:0 -16px;padding:10px 16px 8px;scroll-padding-inline:16px;overscroll-behavior-x:contain;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 14px,#000 calc(100% - 14px),transparent 100%)}',
      '.nbx-t{position:relative;width:auto;height:auto;min-height:64px;flex-direction:row;justify-content:flex-start;align-items:center;gap:10px;padding:10px 12px;border-radius:14px;background:linear-gradient(180deg,#183225,#132A1E);color:#EAF2ED;font:700 13.5px/1.4 var(--f-ui,Cairo,sans-serif);transition:transform .18s,border-color .18s,background .18s,box-shadow .18s;animation:nbxTileIn .45s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--n,0)*35ms + 80ms)}',
      '.nbx-t i{position:absolute;top:5px;left:9px;font-size:10px;opacity:.7}',
      '.nbx-ti{flex:none;display:grid;place-items:center;width:36px;height:36px;border-radius:11px;color:#2BD98A;background:rgba(43,217,138,.12);border:1px solid rgba(43,217,138,.22);transition:transform .2s,background .2s,color .2s}',
      '.nbx-ti .nba-ico{width:20px;height:20px}',
      '.nbx-tl{flex:1;min-width:0;overflow-wrap:anywhere}',
      '.nbx-t:active{transform:scale(.96)}',
      '@media (hover:hover){.nbx-t:hover{transform:translateY(-2px);border-color:rgba(43,217,138,.6);background:linear-gradient(180deg,#1B3A2A,#153023);box-shadow:0 8px 18px rgba(0,0,0,.28)}.nbx-t:hover .nbx-ti{transform:scale(1.08) rotate(-4deg)}}',
      '.nbx-t.sel,.nbx-t.sel:hover{transform:scale(1.02);border-color:#2BD98A;background:linear-gradient(180deg,rgba(43,217,138,.28),rgba(43,217,138,.1));box-shadow:0 0 0 3px rgba(43,217,138,.18),0 8px 22px rgba(43,217,138,.22)}',
      '.nbx-t.sel .nbx-ti{color:#04140A;background:#2BD98A;border-color:#2BD98A;animation:nbxPop .35s ease-out}',
      '.nbx-t.sel::after{content:"";position:absolute;top:-6px;right:-5px;width:20px;height:20px;border-radius:50%;background:#2BD98A url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27%3E%3Cpath d=%27M5 12.5l4.5 4.5L19 7.5%27 fill=%27none%27 stroke=%27%2304140A%27 stroke-width=%273.4%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27/%3E%3C/svg%3E") center/13px no-repeat;box-shadow:0 0 0 2px #0F2018;animation:nbxPop .3s ease-out}',
      /* تابلت/كمبيوتر/ماوس: شبكة كاملة بدل الشريط (عجلة الماوس مبتحرّكش الأفقي) */
      '@media (min-width:768px),(hover:hover) and (pointer:fine){.nbx-tiles{grid-auto-flow:row;grid-template-rows:none;grid-auto-columns:auto;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));overflow:visible;margin:0;padding:6px 0 8px;-webkit-mask-image:none;mask-image:none;scroll-snap-type:none}.nbx-sec::after{content:none}}',
      /* ── زر إنشاء الغرفة: نفس لغة الأزرار (حواف مستديرة 14px، تدرّج، ضغطة ناعمة) ── */
      '.nba-lb .nba-hubw .nba-btn.nbx-ch{border-radius:14px!important;clip-path:none;padding-bottom:13px;background:linear-gradient(180deg,#43EBA3 0,#2BD98A 55%,#22C47D 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),inset 0 -3px 0 rgba(8,80,45,.32),0 10px 24px rgba(43,217,138,.24);transition:transform .15s,box-shadow .2s,filter .2s}',
      '.nba-lb .nba-hubw .nba-btn.nbx-ch:active{transform:translateY(1px) scale(.985);box-shadow:inset 0 1px 0 rgba(255,255,255,.4),inset 0 -1px 0 rgba(8,80,45,.32),0 4px 12px rgba(43,217,138,.2)}',
      '.nba-lb .nba-hubw .nba-btn.nbx-ch::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.42),transparent);transform:skewX(-20deg);pointer-events:none;animation:nbxShine 1.1s ease-out .9s 1 backwards}',
      '@media (hover:hover){.nba-lb .nba-hubw .nba-btn.nbx-ch:hover{filter:brightness(1.06)}.nba-lb .nba-hubw .nba-btn.nbx-ch:hover .nba-ico{transform:scale(1.12)}}',
      '.nba-lb .nba-hubw .nba-btn.nbx-ch .nba-ico{transition:transform .2s}',
      /* ── حقل الانضمام: افتراضي / تركيز / نجاح / خطأ ── */
      '.nbx-jl{color:#C3D4C9;font-size:13.5px;margin:14px 0 8px}',
      '.nbx-jg{height:54px;border:1.5px solid #35594A;border-radius:14px;transition:border-color .2s,box-shadow .2s}',
      '.nbx-jg:focus-within{border-color:#2BD98A;box-shadow:0 0 0 3px rgba(43,217,138,.16)}',
      '.nbx-jg:has(button:not([disabled])){border-color:#2BD98A;box-shadow:0 0 0 3px rgba(43,217,138,.14)}',
      '.nba-lb .nbx-jg.bad{border-color:#FF6B5E;box-shadow:0 0 0 3px rgba(255,107,94,.16);animation:nbxShake .4s}',
      '.nbx-jg button{min-width:92px;padding:0 20px;font-weight:800;transition:background .2s,color .2s}',
      '.nbx-jg button:not([disabled]){animation:nbxPop .3s ease-out;box-shadow:none}',
      '.nbx-jg button:not([disabled]):active{filter:brightness(.94)}',
      '.nbx-fh{color:#AFC4B8;font-size:12.5px;margin-top:8px}',
      '.nbx-er{display:flex;align-items:center;gap:7px;color:#FF9A8F;font-size:13px;font-weight:700}',
      '.nbx-er::before{content:"!";flex:none;display:grid;place-items:center;width:16px;height:16px;border-radius:50%;background:#FF6B5E;color:#2A0A07;font-size:11px;font-weight:900}',
      /* ── الخلفية والزخرفة: توهّج خفيف + شبكة باهتة خلف المحتوى فقط ── */
      '.nba-root.nba-lb:has(.nba-hubw){background:radial-gradient(80% 34% at 88% -4%,rgba(43,217,138,.18),transparent 70%),radial-gradient(60% 30% at 0% 96%,rgba(242,184,75,.07),transparent 70%),linear-gradient(180deg,#112419 0,#0A1510 100%)}',
      '.nba-hubw::before{content:"";position:absolute;top:0;right:0;left:0;height:360px;background-image:linear-gradient(rgba(43,217,138,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(43,217,138,.05) 1px,transparent 1px);background-size:36px 36px;-webkit-mask-image:linear-gradient(180deg,#000,transparent);mask-image:linear-gradient(180deg,#000,transparent);pointer-events:none;z-index:-1}',
      '.nba-wrap.nba-hubw{padding-bottom:calc(20px + env(safe-area-inset-bottom,0px))}.nba-hubw .nba-sp{min-height:8px}',
      /* ── شاشات طويلة / ضيقة ── */
      '@media (min-height:780px){.nbx-hero{padding-top:10px}.nbx-stats{margin:20px 0 18px}.nbx-t{min-height:76px}.nbx-tiles{gap:12px}}',
      '@media (min-height:860px) and (max-width:767px){.nbx-tiles{grid-template-rows:repeat(3,auto)}}',
      '@media (min-width:768px){.nbx-h{font-size:38px}.nbx-p{font-size:16px;max-width:44ch}}',
      '@media (max-width:360px){.nbx-tiles{grid-auto-columns:min(160px,48%)}.nbx-t{padding:9px 10px;font-size:13px}.nbx-ti{width:32px;height:32px}}',
      /* ── احترام تقليل الحركة ── */
      '@media (prefers-reduced-motion:reduce){.nbx-t,.nbx-t *,.nba-lb .nba-hubw .nbx-ch,.nbx-jg,.nbx-jg button{transition:none!important;animation:none!important}.nbx-t:hover,.nbx-t:active,.nbx-t.sel,.nba-lb .nba-hubw .nbx-ch:active{transform:none!important}.nba-lb .nba-hubw .nbx-ch::after{display:none}.nbx-stats>div:last-child b::before{animation:none}}',
      '@keyframes nbxTileIn{from{opacity:0;transform:translate3d(18px,0,0)}to{opacity:1;transform:none}}',
      '@keyframes nbxPop{0%{transform:scale(.6)}60%{transform:scale(1.15)}100%{transform:scale(1)}}',
      '@keyframes nbxShake{0%,100%{transform:translate3d(0,0,0)}20%{transform:translate3d(-6px,0,0)}40%{transform:translate3d(6px,0,0)}60%{transform:translate3d(-4px,0,0)}80%{transform:translate3d(3px,0,0)}}',
      '@keyframes nbxLive{0%,100%{opacity:.35}50%{opacity:1}}',
      '@keyframes nbxShine{from{left:-60%}to{left:130%}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  function cssArena() {
    if (document.getElementById('nba-css-zx')) return;
    var st = document.createElement('style'); st.id = 'nba-css-zx';
    st.textContent = [
      /* ── أساس الصفحة ── */
      '.nba-root.nba-lb:has(.nbz){background:radial-gradient(70% 26% at 50% 100%,rgba(43,217,138,.07),transparent 70%),#0A1510}',
      '.nba-wrap.nbz{padding-top:12px;padding-bottom:calc(30px + env(safe-area-inset-bottom,0px))}',
      '.nba-wrap.nbz.nba-hubw::before{display:none}',
      '.nbz .nba-sp{display:none}',
      /* ── المشهد ── */
      '.nbz-stage{position:relative;display:flex;flex-direction:column;margin:calc(-12px - env(safe-area-inset-top,0px)) -16px 0;padding:calc(12px + env(safe-area-inset-top,0px)) 16px 0;overflow:hidden;background:radial-gradient(70% 36% at 50% 42%,rgba(43,217,138,.16),transparent 72%),linear-gradient(180deg,#030A06 0,#07150E 32%,#0B1D14 60%,#0A1510 100%)}',
      '.nbz-stage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:110px;background:linear-gradient(180deg,transparent,#0A1510);pointer-events:none}',
      '.nbz-stars{position:absolute;inset:0 0 46% 0;opacity:.6;background-image:radial-gradient(1.3px 1.3px at 12% 16%,#fff,transparent),radial-gradient(1px 1px at 27% 8%,#dfffee,transparent),radial-gradient(1.2px 1.2px at 41% 22%,#fff,transparent),radial-gradient(1px 1px at 58% 11%,#fff,transparent),radial-gradient(1.4px 1.4px at 73% 19%,#fff6d6,transparent),radial-gradient(1px 1px at 86% 9%,#fff,transparent),radial-gradient(1px 1px at 93% 27%,#dfffee,transparent),radial-gradient(1.1px 1.1px at 6% 34%,#fff,transparent),radial-gradient(1px 1px at 66% 33%,#fff,transparent);animation:nbzTw 6s ease-in-out infinite alternate}',
      '.nbz-stage .nba-top{position:relative;z-index:4;height:60px;padding:6px 0}',
      '.nbz .nba-ttl{color:#F2F8F4;text-shadow:0 1px 12px rgba(0,0,0,.7)}',
      '.nbz-stage .nba-x{width:40px;height:40px;border-radius:14px;background:rgba(3,10,6,.55);border:1px solid rgba(255,255,255,.1)}',
      '.nba-root:has(.nbz) .nba-snb .nba-x{width:40px;height:40px;border-radius:14px;background:rgba(3,10,6,.55);border:1px solid rgba(255,255,255,.1)}',
      '.nbz-vista{position:relative;z-index:1;flex:none;margin:-22px -16px 0;height:clamp(200px,33vh,318px);height:clamp(200px,33dvh,318px);will-change:transform;-webkit-mask-image:linear-gradient(180deg,#000 0,#000 76%,transparent 100%);mask-image:linear-gradient(180deg,#000 0,#000 76%,transparent 100%)}',
      '.nbz-vista svg{position:absolute;left:0;top:0;width:100%;height:100%;display:block}',
      '.nbz-ry{animation:nbzRy 7s ease-in-out infinite alternate}.nbz-ry.b{animation-duration:9s;animation-delay:-3s}',
      '.nbz-br{transform-box:fill-box;transform-origin:50% 60%;animation:nbzBr 4.2s ease-in-out infinite}',
      '.nbz-rn{animation:nbzRn 3.4s ease-in-out infinite}',
      '.nbz-ff{position:absolute;inset:0;pointer-events:none}',
      '.nbz-ff i{position:absolute;left:var(--x);top:var(--y);width:var(--s);height:var(--s);border-radius:50%;background:#9BF5C8;box-shadow:0 0 8px 2px rgba(124,240,182,.45);opacity:0;animation:nbzFly var(--d) ease-in-out var(--dl) infinite;will-change:transform,opacity}',
      '.nbz-ff i.g{background:#FFE29A;box-shadow:0 0 8px 2px rgba(242,184,75,.45)}',
      '.nbz-mist{position:absolute;left:-25%;right:-25%;bottom:-8px;height:40%;pointer-events:none;background:radial-gradient(40% 70% at 20% 100%,rgba(150,215,185,.16),transparent 70%),radial-gradient(35% 60% at 62% 100%,rgba(150,215,185,.12),transparent 70%),radial-gradient(30% 55% at 90% 100%,rgba(150,215,185,.14),transparent 70%);animation:nbzMist 22s ease-in-out infinite alternate}',
      /* ── لوحة اللاعب ── */
      '.nbz-pl{position:relative;z-index:3;display:flex;align-items:center;gap:12px;padding-top:4px}',
      '.nbz-av{position:relative;flex:none;width:64px;height:64px;display:grid;place-items:center}',
      '.nbz-rg{position:absolute;inset:0}.nbz-rg svg{width:100%;height:100%;transform:rotate(-90deg)}',
      '.nbz-rg circle{fill:none;stroke-width:2.6}.nbz-rg .t{stroke:rgba(255,255,255,.13)}',
      '.nbz-rg .v{stroke:#F2B84B;stroke-linecap:round;transition:stroke-dasharray 1s cubic-bezier(.2,.8,.2,1);filter:drop-shadow(0 0 3px rgba(242,184,75,.55))}',
      '.nbz-av .nba-av{width:50px!important;height:50px!important;box-shadow:0 0 0 2px #07120B,0 6px 14px rgba(0,0,0,.5)}',
      '.nbz-lv{position:absolute;bottom:-6px;left:50%;transform:translateX(-50%);padding:1px 8px;border-radius:9px;background:linear-gradient(180deg,#F8D27A,#C98A24);color:#2A1B03;font:900 10.5px/1.55 var(--f-ui,Cairo,sans-serif);letter-spacing:.06em;white-space:nowrap;direction:ltr;box-shadow:0 2px 6px rgba(0,0,0,.55)}',
      '.nbz-lv[hidden]{display:none}',
      '.nbz-pt{flex:1;min-width:0}',
      '.nbz-nm{font-size:17px;font-weight:900;line-height:1.3;color:#F2F8F4;text-shadow:0 1px 10px rgba(0,0,0,.6);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.nbz-rk{display:block;font-size:12.5px;font-weight:700;color:#AFC6B8}',
      '.nbz-pl.on .nbz-rk{color:#F2C66A}',
      '.nbz-xpb{display:none;margin-top:6px}.nbz-pl.on .nbz-xpb{display:block}',
      '.nbz-xpb .bar{height:5px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden}',
      '.nbz-xpb .bar i{display:block;height:100%;width:0;border-radius:5px;background:linear-gradient(90deg,#1FB872,#7CF0B6);transition:width 1s cubic-bezier(.2,.8,.2,1)}',
      '.nbz-xpb span{display:block;margin-top:3px;font-size:10.5px;font-weight:700;color:#9DB7A8;direction:ltr;text-align:right;letter-spacing:.04em}',
      '.nbz-pl .nba-pfbtn{margin-inline-start:0;flex:none;border:1px solid rgba(255,255,255,.12);background:rgba(3,10,6,.5);color:#EAF4EE;border-radius:14px;min-height:38px;padding:7px 13px}',
      '.nbz-pl .nba-pfbtn .nba-ico{color:#F2C66A}',
      /* ── العنوان وزر اللعب ── */
      '.nbz-hero{position:relative;z-index:3;margin-top:-30px;padding-bottom:20px}',
      '.nbz-h{margin:0;font-size:clamp(30px,9vw,38px);line-height:1.2;font-weight:900;color:#F4FAF6;text-shadow:0 3px 22px rgba(0,0,0,.65)}',
      '.nbz-h em{font-style:normal;background:linear-gradient(180deg,#8AF5C6,#2BD98A 62%,#1DB06E);-webkit-background-clip:text;background-clip:text;color:transparent;-webkit-text-fill-color:transparent;filter:drop-shadow(0 0 14px rgba(43,217,138,.32))}',
      '.nbz-p{margin:10px 0 0;max-width:33ch;color:#B9CEC1;font-size:14px;line-height:1.75;text-shadow:0 1px 10px rgba(0,0,0,.7)}',
      '.nbz-play{position:relative;display:flex;align-items:center;gap:14px;width:100%;min-height:70px;margin-top:20px;padding:10px 14px;border:0;border-radius:20px;cursor:pointer;color:#04140A;font:inherit;text-align:right;background:linear-gradient(180deg,#4CF0A8 0,#2BD98A 48%,#1CB574 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.55),inset 0 -4px 0 rgba(6,70,40,.4),0 18px 36px -10px rgba(43,217,138,.55);transition:transform .15s,filter .2s}',
      '.nbz-play::before{content:"";position:absolute;left:-5px;right:-5px;top:-5px;bottom:-5px;border-radius:25px;border:1.5px solid rgba(43,217,138,.5);opacity:0;pointer-events:none;animation:nbzAura 2.8s ease-out infinite}',
      '.nbz-play::after{content:"";position:absolute;left:3px;right:3px;top:3px;bottom:3px;border-radius:17px;border:1px solid rgba(255,230,160,.5);pointer-events:none}',
      '.nbz-play .gl{position:absolute;left:0;right:0;top:0;bottom:0;border-radius:inherit;overflow:hidden;pointer-events:none}',
      '.nbz-play .gl::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:38%;background:linear-gradient(100deg,transparent,rgba(255,255,255,.5),transparent);transform:skewX(-20deg);animation:nbzShine 5s ease-in-out 1.2s infinite}',
      '.nbz-play .ic{position:relative;flex:none;width:46px;height:46px;border-radius:15px;display:grid;place-items:center;background:#06190F;color:#7CF0B6;box-shadow:inset 0 0 0 1px rgba(242,184,75,.5)}.nbz-play .ic .nba-ico{width:22px;height:22px}',
      '.nbz-play .tx{position:relative;display:block}',
      '.nbz-play .tx b{display:block;font-size:22px;font-weight:900;line-height:1.2}',
      '.nbz-play .tx small{display:block;font:800 10.5px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.3em;opacity:.68;direction:ltr;text-align:right}',
      '.nbz-play .ar{position:relative;margin-inline-start:auto;display:grid;place-items:center;width:34px;height:34px;border-radius:50%;background:rgba(4,20,10,.14)}.nbz-play .ar .nba-ico{width:18px;height:18px}',
      '.nbz-play:active{transform:translateY(2px) scale(.985);filter:brightness(.96)}',
      '@media (hover:hover){.nbz-play:hover{filter:brightness(1.06)}.nbz-play:hover .ar{transform:translateX(-3px)}}',
      '.nbz-play .ar{transition:transform .2s}',
      '.nbz-info{display:flex;align-items:center;justify-content:center;gap:12px;margin-top:14px;font-size:12px;font-weight:700;color:#9DB7A8}',
      '.nbz-info b{margin-inline-end:5px;font-size:15px;font-weight:900;color:#EAF4EE;font-variant-numeric:tabular-nums}',
      '.nbz-info>i{width:3px;height:3px;border-radius:50%;background:#F2B84B;opacity:.75}',
      '.nbz-info .lv b{color:#2BD98A;letter-spacing:.08em}',
      '.nbz-info .lv b::before{content:"";display:inline-block;width:6px;height:6px;margin-inline-end:6px;border-radius:50%;background:#2BD98A;vertical-align:middle;animation:nbxLive 1.6s ease-in-out infinite}',
      /* ── رجوع لغرفة شغّالة ── */
      '.nbz-rs{display:flex;align-items:center;gap:10px;margin-top:6px;padding:12px 14px;border-radius:18px;background:linear-gradient(90deg,rgba(242,184,75,.05),rgba(242,184,75,.15));box-shadow:inset 3px 0 0 #F2B84B}',
      '.nbz-rs .tt{flex:1;min-width:0}.nbz-rs small{display:block;font-size:12px;font-weight:700;color:#C9B27A}',
      '.nbz-rs b{display:block;font:800 17px/1.3 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.2em;color:#FFE7B0;direction:ltr;text-align:right}',
      '.nbz-b{flex:none;border:0;border-radius:12px;min-height:40px;padding:0 14px;font:800 13px var(--f-ui,Cairo,sans-serif);color:#2A1B03;cursor:pointer;background:linear-gradient(180deg,#FFE29A,#F2B84B 60%,#D99A2B);box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}',
      '.nbz-b:active{transform:scale(.96)}',
      '.nbz-gh{flex:none;border:0;background:none;color:#98B0A2;font:700 13px var(--f-ui,Cairo,sans-serif);min-height:40px;padding:0 6px;cursor:pointer}',
      /* ── عناوين الأقسام ── */
      '.nbz-st{display:flex;align-items:center;gap:10px;margin:28px 0 12px;font-size:15.5px;font-weight:900;color:#EAF4EE}',
      '.nbz-st::before{content:"";flex:none;width:8px;height:8px;border-radius:1.5px;background:#F2B84B;transform:rotate(45deg);box-shadow:0 0 10px rgba(242,184,75,.5)}',
      '.nbz-st::after{content:"";flex:1;height:1px;background:linear-gradient(to left,rgba(255,255,255,.14),transparent)}',
      '.nbz-st small{order:3;font-size:11.5px;font-weight:700;color:#8FA99A}',
      '.nbz-st small+*{display:none}',
      /* ── أنماط اللعب ── */
      '.nbz-modes{display:grid;grid-template-columns:1fr 1fr;gap:12px}',
      '.nbz-m{position:relative;display:flex;align-items:flex-end;min-height:196px;padding:0;border:0;border-radius:22px;overflow:hidden;text-align:right;color:#EAF4EE;font:inherit;cursor:pointer;isolation:isolate;--a:#2BD98A;background:radial-gradient(120% 90% at 85% 0,rgba(43,217,138,.34),transparent 62%),linear-gradient(165deg,#14492D,#0A1A12 72%);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 16px 28px -14px rgba(0,0,0,.8);transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .25s}',
      '.nbz-m.team{--a:#F2B84B;background:radial-gradient(120% 90% at 15% 0,rgba(242,184,75,.26),transparent 62%),linear-gradient(195deg,#24401F,#0A1A12 72%)}',
      '.nbz-m .art{position:absolute;left:0;right:0;bottom:0;height:55%;z-index:-1}.nbz-m .art svg{width:100%;height:100%;display:block}',
      '.nbz-m::after{content:"";position:absolute;left:0;right:0;top:0;bottom:0;background:linear-gradient(115deg,transparent 38%,rgba(255,255,255,.08) 50%,transparent 62%);transform:translateX(120%);transition:transform .7s;pointer-events:none}',
      '.nbz-m .gm{position:absolute;top:14px;inset-inline-start:14px;width:58px;height:58px;display:grid;place-items:center;border-radius:18px;color:var(--a);background:radial-gradient(circle at 50% 35%,rgba(255,255,255,.13),rgba(255,255,255,.02));box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),0 0 26px -4px var(--a)}.nbz-m .gm .nba-ico{width:28px;height:28px}',
      '.nbz-m .tx{display:block;width:100%;padding:14px}',
      '.nbz-m small{display:block;font:800 10px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.3em;color:var(--a);direction:ltr;text-align:right}',
      '.nbz-m b{display:block;margin-top:2px;font-size:20px;font-weight:900;line-height:1.25}',
      '.nbz-m em{display:block;margin-top:3px;font-style:normal;font-size:12px;font-weight:600;line-height:1.55;color:#B4CABD}',
      '.nbz-m .ch{display:inline-block;margin-top:9px;padding:3px 10px;border-radius:99px;font-size:11px;font-weight:800;color:#EAF4EE;background:rgba(0,0,0,.34)}',
      '.nbz-m:active{transform:scale(.97)}',
      '@media (hover:hover){.nbz-m:hover{transform:translateY(-3px);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 22px 34px -14px rgba(0,0,0,.85)}.nbz-m:hover::after{transform:translateX(-120%)}}',
      /* ── المهام اليومية كمهام بمكافآت ── */
      '.nbz .nba-qs{margin-top:28px}',
      '.nbz .nbq-c{padding:0;margin:0;background:none;border:0;box-shadow:none;border-radius:0}',
      '.nbz .nbq-h{align-items:center}',
      '.nbz .nbq-ti{font-size:15.5px;font-weight:900;color:#EAF4EE}.nbz .nbq-ti .nba-ico{color:#F2B84B}',
      '.nbz .nbq-h .nba-tag{background:rgba(242,184,75,.12);color:#FFD98A;border:0;direction:ltr;font-variant-numeric:tabular-nums;padding:3px 11px}',
      '.nbz .nbq-sub{margin:4px 0 6px;color:#8FA99A;font-size:11.5px}',
      '.nbz .nbq-r{position:relative;gap:12px;margin-top:9px;padding:12px 14px 12px 10px;border:0;border-radius:18px;overflow:hidden;background:linear-gradient(90deg,rgba(255,255,255,.025),rgba(43,217,138,.07));transition:background .3s}',
      '.nbz .nbq-r::before{content:"";position:absolute;top:12px;bottom:12px;right:0;width:3px;border-radius:3px 0 0 3px;background:#2BD98A;opacity:.55}',
      '.nbz .nbq-r.rd{background:linear-gradient(90deg,rgba(242,184,75,.05),rgba(242,184,75,.16))}',
      '.nbz .nbq-r.rd::before{background:#F2B84B;opacity:1;box-shadow:0 0 12px rgba(242,184,75,.65)}',
      '.nbz .nbq-r.cl{opacity:.7}',
      '.nbz .nbq-i{width:46px;height:52px;border-radius:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#1F5E3C,#0E2A1D);color:#7CF0B6}',
      '.nbz .nbq-r.rd .nbq-i{background:linear-gradient(160deg,#F8D27A,#B9801F);color:#2A1B03}',
      '.nbz .nbq-r.cl .nbq-i{background:linear-gradient(160deg,#35E597,#168A57);color:#04140A}',
      '.nbz .nbq-t b{font-size:14px;font-weight:800;color:#EAF4EE}',
      '.nbz .nbq-t em{color:#9DB7A8}',
      '.nbz .nbq-r.cl .nbq-t b{color:#B4CABD}',
      '.nbz .nbq-pb{height:8px;border-radius:8px;background:rgba(0,0,0,.38);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);overflow:hidden}',
      '.nbz .nbq-pb i{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,#1FB872,#7CF0B6);box-shadow:0 0 10px rgba(43,217,138,.5);transition:width .7s cubic-bezier(.2,.8,.2,1)}',
      '.nbz .nbq-r.rd .nbq-pb i{background:linear-gradient(90deg,#D99A2B,#FFE29A);box-shadow:0 0 10px rgba(242,184,75,.55)}',
      '.nbz .nbq-rw{display:inline-flex;align-items:center;gap:7px;direction:ltr;unicode-bidi:isolate;border:0;background:rgba(242,184,75,.11);color:#FFD98A;padding:5px 11px;font-size:12px;font-weight:800}',
      '.nbz .nbq-rw::before{content:"";width:8px;height:8px;border-radius:1.5px;background:linear-gradient(135deg,#FFE7A8,#D9962A);transform:rotate(45deg);box-shadow:0 0 8px rgba(242,184,75,.7)}',
      '.nbz .nbq-bt{position:relative;color:#2A1B03;background:linear-gradient(180deg,#FFE29A,#F2B84B 58%,#D99A2B);box-shadow:inset 0 1px 0 rgba(255,255,255,.6),0 8px 18px rgba(242,184,75,.28)}',
      '.nbz .nbq-bt::after{content:"";position:absolute;left:-4px;right:-4px;top:-4px;bottom:-4px;border-radius:99px;border:2px solid rgba(242,184,75,.55);opacity:0;pointer-events:none;animation:nbzAura 1.9s ease-out infinite}',
      '.nbz .nbq-bt[disabled]::after{display:none}',
      '.nbz .nbq-dn{background:none;border:0;padding:0;color:#7CF0B6;font-size:12.5px;font-weight:800}',
      '.nbz .nbq-dn::before{content:"";display:inline-block;width:5px;height:9px;margin-inline-end:7px;border:solid #7CF0B6;border-width:0 2.2px 2.2px 0;transform:rotate(45deg) translateY(-2px)}',
      '.nbz .nbq-nt{border-top:0;padding-top:10px;color:#7F9A8B}',
      '.nbz .nbq-sk i{height:64px;border-radius:18px}',
      /* ── التخصصات كلاسات ── */
      '.nbz-cls{display:flex;gap:12px;margin:0 -16px;padding:6px 16px 18px;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scroll-padding-inline:16px;overscroll-behavior-x:contain;scrollbar-width:none;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%);mask-image:linear-gradient(90deg,transparent 0,#000 16px,#000 calc(100% - 16px),transparent 100%)}',
      '.nbz-cls::-webkit-scrollbar{display:none}',
      '.nbz-c{position:relative;flex:none;width:136px;height:198px;padding:14px 12px;border:0;border-radius:22px;display:flex;flex-direction:column;align-items:flex-start;text-align:right;color:#EAF4EE;font:inherit;cursor:pointer;overflow:hidden;isolation:isolate;scroll-snap-align:start;background:radial-gradient(90% 62% at 50% 22%,hsl(var(--h) 58% 34%/.62),transparent 74%),linear-gradient(180deg,#12281C,#0A1710);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05),0 16px 26px -16px rgba(0,0,0,.85);transition:transform .22s cubic-bezier(.2,.8,.2,1),box-shadow .25s,opacity .25s;animation:nbzCi .5s cubic-bezier(.2,.8,.2,1) backwards;animation-delay:calc(var(--n,0)*40ms + 120ms)}',
      '.nbz-c i{font:800 10.5px/1 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-style:normal;letter-spacing:.14em;color:hsl(var(--h) 45% 72%/.75);direction:ltr}',
      '.nbz-em{align-self:center;display:grid;place-items:center;width:68px;height:68px;margin-top:8px;border-radius:50%;color:hsl(var(--h) 72% 70%);background:radial-gradient(circle at 50% 32%,hsl(var(--h) 60% 30%),hsl(var(--h) 55% 13%));box-shadow:inset 0 0 0 1.5px hsl(var(--h) 60% 55%/.55),0 0 24px -2px hsl(var(--h) 70% 50%/.5);transition:transform .25s,box-shadow .25s,color .2s,background .2s}',
      '.nbz-em .nba-ico{width:32px;height:32px}',
      '.nbz-ep{margin-top:auto;font-size:10.5px;font-weight:800;color:#E7C06E}',
      '.nbz-cn{margin-top:3px;font-size:13px;font-weight:800;line-height:1.35;color:#F0F7F2;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}',
      '.nbz-c:active{transform:scale(.96)}',
      '@media (hover:hover){.nbz-c:hover{transform:translateY(-4px);box-shadow:inset 0 0 0 1px hsl(var(--h) 55% 50%/.4),0 22px 32px -14px rgba(0,0,0,.9)}.nbz-c:hover .nbz-em{transform:scale(1.07)}}',
      '.nbz-c.sel,.nbz-c.sel:hover{transform:scale(1.04);box-shadow:0 0 0 2px #F2B84B,0 0 30px -4px rgba(242,184,75,.5)}',
      '.nbz-c.sel .nbz-em{color:#04140A;background:hsl(var(--h) 68% 58%);box-shadow:0 0 30px 2px hsl(var(--h) 70% 55%/.6);animation:nbxPop .35s ease-out}',
      '.nbz-c.sel::after{content:"✓";position:absolute;top:10px;inset-inline-end:10px;width:20px;height:20px;border-radius:50%;background:#F2B84B;color:#2A1B03;font:900 12px/20px sans-serif;text-align:center;animation:nbxPop .3s ease-out}',
      '.nbz-cls:has(.sel) .nbz-c:not(.sel){opacity:.4}',
      '@media (min-width:768px),(hover:hover) and (pointer:fine){.nbz-cls{flex-wrap:wrap;overflow:visible;margin:0;padding:6px 0 10px;-webkit-mask-image:none;mask-image:none;display:grid;grid-template-columns:repeat(auto-fill,minmax(136px,1fr))}.nbz-c{width:auto}.nbz-st small{display:none}}',
      /* ── الانضمام بكود ── */
      '.nbz-gate{margin-top:10px}',
      '.nbz-gl{margin-bottom:10px;font-size:14px;font-weight:800;color:#CFE0D6}',
      '.nbz-jg{display:flex;align-items:stretch;height:58px;border-radius:18px;overflow:hidden;background:linear-gradient(180deg,#0B1710,#0E1E16);box-shadow:inset 0 0 0 1px rgba(255,255,255,.09),inset 0 2px 10px rgba(0,0,0,.5);transition:box-shadow .2s}',
      '.nbz-jg:focus-within{box-shadow:inset 0 0 0 1.5px rgba(242,184,75,.7),0 0 0 4px rgba(242,184,75,.1)}',
      '.nbz-jg.bad{box-shadow:inset 0 0 0 1.5px #FF6B5E,0 0 0 4px rgba(255,107,94,.14);animation:nbxShake .4s}',
      '.nbz-jg input{flex:1;min-width:0;border:0;outline:0;background:none;padding:0 10px;color:#FFE7B0;font:800 21px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;letter-spacing:.3em;text-align:center;text-transform:uppercase;direction:ltr}',
      '.nbz-jg input::placeholder{color:#4F6B5C;opacity:1}',
      '.nbz-jg button{flex:none;min-width:104px;border:0;background:rgba(255,255,255,.05);color:#7F9A8B;font:800 15px var(--f-ui,Cairo,sans-serif);cursor:not-allowed;transition:background .2s,color .2s}',
      '.nbz-jg button:not([disabled]){cursor:pointer;color:#2A1B03;background:linear-gradient(180deg,#FFE29A,#F2B84B 60%,#D99A2B);animation:nbxPop .3s ease-out}',
      '.nbz-gate .nbx-fh,.nbz-gate .nbx-er{margin-top:9px}',
      /* ── حركة الدخول + الحركات ── */
      '.nbz-h,.nbz-p,.nbz-play,.nbz-info{animation:nbzUp .7s cubic-bezier(.2,.8,.2,1) both}',
      '.nbz-p{animation-delay:.08s}.nbz-play{animation-delay:.16s}.nbz-info{animation-delay:.26s}',
      '@keyframes nbzUp{from{opacity:0;transform:translate3d(0,16px,0)}to{opacity:1;transform:none}}',
      '@keyframes nbzCi{from{opacity:0;transform:translate3d(18px,0,0)}to{opacity:1;transform:none}}',
      '@keyframes nbzTw{from{opacity:.35}to{opacity:.75}}',
      '@keyframes nbzRy{from{opacity:.65}to{opacity:1}}',
      '@keyframes nbzBr{0%,100%{opacity:.14;transform:scaleY(.94)}50%{opacity:.4;transform:scaleY(1.04)}}',
      '@keyframes nbzRn{0%,100%{opacity:.35}50%{opacity:1}}',
      '@keyframes nbzFly{0%{transform:translate3d(0,0,0);opacity:0}15%{opacity:.9}50%{transform:translate3d(var(--dx),-46px,0)}85%{opacity:.6}100%{transform:translate3d(calc(var(--dx)*-.6),-92px,0);opacity:0}}',
      '@keyframes nbzMist{from{transform:translate3d(-6%,0,0)}to{transform:translate3d(6%,0,0)}}',
      '@keyframes nbzAura{0%{opacity:.75;transform:scale(.98)}100%{opacity:0;transform:scale(1.07)}}',
      '@keyframes nbzShine{0%,70%{left:-60%}100%{left:140%}}',
      '.nbz-cr .nbz-vista{margin-top:-4px;height:clamp(150px,20vh,190px);height:clamp(150px,20dvh,190px);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 34%,#000 76%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 34%,#000 76%,transparent 100%)}',
      '.nbz-cr .nbz-stage::after{height:60px}',
      '.nbz-cr .nbz-st.f{margin-top:10px}',
      '.nbz-cr .nba-err{margin:10px 0 0}',
      '.nbz-mds{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nbz-pk{position:relative;display:flex;align-items:center;gap:10px;min-height:80px;padding:12px;border:0;border-radius:20px;text-align:right;color:#EAF4EE;font:inherit;cursor:pointer;overflow:hidden;--a:#2BD98A;background:linear-gradient(165deg,#14301F,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06);transition:transform .2s,box-shadow .25s,background .25s}',
      '.nbz-pk.t{--a:#F2B84B}',
      '.nbz-pk .gm{flex:none;display:grid;place-items:center;width:44px;height:44px;border-radius:14px;color:var(--a);background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}.nbz-pk .gm .nba-ico{width:22px;height:22px}',
      '.nbz-pk b{display:block;font-size:16.5px;font-weight:900;line-height:1.3}',
      '.nbz-pk em{display:block;margin-top:1px;font-style:normal;font-size:11.5px;font-weight:600;line-height:1.45;color:#9FB8A9}',
      '.nbz-pk.on{background:radial-gradient(110% 110% at 90% 0,rgba(43,217,138,.34),transparent 66%),linear-gradient(165deg,#165236,#0B1A12);box-shadow:0 0 0 2px #F2B84B,0 14px 26px -12px rgba(43,217,138,.45)}',
      '.nbz-pk.t.on{background:radial-gradient(110% 110% at 90% 0,rgba(242,184,75,.3),transparent 66%),linear-gradient(165deg,#3A4A1F,#0B1A12)}',
      '.nbz-pk.on .gm{background:var(--a);color:#04140A;box-shadow:0 0 22px -2px var(--a);animation:nbxPop .3s ease-out}',
      '.nbz-pk:active,.nbz-sc:active,.nbz-sn:active{transform:scale(.96)}',
      '.nbz-seats{display:flex;justify-content:center;gap:8px}',
      '.nbz-sn{flex:1;min-width:0;max-width:92px;height:58px;border:0;cursor:pointer;color:#CFE0D6;font:900 20px var(--f-ui,Cairo,sans-serif);clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#1B3D29,#0E2016);transition:transform .2s,background .2s,color .2s}',
      '.nbz-sn.on{color:#2A1B03;background:linear-gradient(160deg,#FFE29A,#F2B84B 60%,#C98A24);transform:scale(1.08)}',
      '.nbz-sp{display:grid;grid-template-columns:1fr 1fr;gap:10px}',
      '.nbz-sp>.nbz-sc:last-child:nth-child(odd){grid-column:1/-1}',
      '.nbz-sc{position:relative;display:flex;align-items:center;gap:10px;min-height:68px;padding:10px;border:0;border-radius:18px;text-align:right;color:#EAF4EE;font:inherit;cursor:pointer;background:radial-gradient(90% 130% at 100% 50%,hsl(var(--h) 55% 30%/.5),transparent 72%),linear-gradient(180deg,#12281C,#0A1710);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05);transition:transform .2s,box-shadow .25s}',
      '.nbz-sc .nbz-em{flex:none;width:42px;height:42px;margin:0}.nbz-sc .nbz-em .nba-ico{width:21px;height:21px}',
      '.nbz-sx{min-width:0}.nbz-sx small{display:block;font-size:10px;font-weight:800;color:#E7C06E}',
      '.nbz-sx b{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;font-size:12.5px;font-weight:800;line-height:1.35}',
      '.nbz-sc.on{box-shadow:0 0 0 2px #F2B84B,0 0 24px -6px rgba(242,184,75,.5)}',
      '.nbz-sc.on .nbz-em{color:#04140A;background:hsl(var(--h) 68% 58%);box-shadow:0 0 24px 1px hsl(var(--h) 70% 55%/.55)}',
      '.nbz-bar{position:sticky;bottom:0;z-index:5;margin:18px -16px 0;padding:22px 16px calc(12px + env(safe-area-inset-bottom,0px));background:linear-gradient(180deg,rgba(10,21,16,0),#0A1510 20px)}',
      '.nbz-sum{margin-bottom:10px;text-align:center;font-size:12.5px;font-weight:700;color:#A9C0B2}',
      '.nbz-bar .nbz-play{margin-top:0}',
      '.nbz-play[disabled]{cursor:default;filter:grayscale(.7) brightness(.72)}.nbz-play[disabled]::before,.nbz-play[disabled] .gl{display:none}',
      '.nbz-lb .nbz-vista{height:clamp(140px,18vh,172px);height:clamp(140px,18dvh,172px)}',
      '.nbz-lb .nbx-tk{position:relative;z-index:3;margin:-26px 0 6px;border:0;border-radius:24px;background:radial-gradient(120% 90% at 50% 0,rgba(43,217,138,.17),transparent 62%),linear-gradient(180deg,#14301F,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 22px 38px -16px rgba(0,0,0,.85)}',
      '.nbz-lb .nbx-tk .a{padding:16px 18px 2px}',
      '.nbz-lb .nbx-tk .l{font-size:11.5px;font-weight:800;color:#9FB8A9}',
      '.nbz-lb .nbx-cv{font-size:clamp(34px,11vw,46px);color:#8AF5C6;text-shadow:0 0 26px rgba(43,217,138,.45)}',
      '.nbz-lb .nbx-code.cp .nbx-cv{color:#FFD98A;text-shadow:0 0 26px rgba(242,184,75,.5)}',
      '.nbz-lb .nbx-tk .p{border-top:1.5px dashed rgba(255,255,255,.14)}',
      '.nbz-lb .nbx-tk .p::before,.nbz-lb .nbx-tk .p::after{background:#0A1510}',
      '.nbz-lb .nbx-meta{gap:7px;flex-wrap:wrap}',
      '.nbz-lb .nbx-meta i{display:none}',
      '.nbz-lb .nbx-meta span{padding:3px 12px;border-radius:99px;background:rgba(255,255,255,.06);color:#CFE0D6;font-size:12.5px;font-weight:700}',
      '.nbz-lb .nbx-meta span:first-child{color:#E7C06E}',
      '.nba-wrap.nbz-lb .nbx-tk .nba-btn{margin-bottom:0;min-height:46px;border-radius:14px;font-size:13.5px}',
      '.nba-wrap.nbz-lb .nbx-tk .nba-btn.sec{background:rgba(255,255,255,.06);color:#EAF4EE;border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}',
      '.nba-wrap.nbz-lb .nbx-tk .nba-btn:not(.sec){background:linear-gradient(180deg,#4CF0A8,#2BD98A 55%,#1CB574);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 10px 20px -8px rgba(43,217,138,.55)}',
      '.nba-wrap.nbz-lb .nba-btn.sec{border-radius:16px;background:rgba(255,255,255,.06);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}.nba-wrap.nbz-lb>.nba-btn.sec{margin-bottom:12px}.nbz-bar .nba-btn.sec{margin:8px 0 0}',
      '.nbz-lb .nbx-sh{margin:24px 2px 12px}',
      '.nbz-lb .nbx-sh b{display:flex;align-items:center;gap:10px;font-size:15.5px;font-weight:900;color:#EAF4EE}',
      '.nbz-lb .nbx-sh b::before{content:"";width:8px;height:8px;border-radius:1.5px;background:#F2B84B;transform:rotate(45deg);box-shadow:0 0 10px rgba(242,184,75,.5)}',
      '.nbz-lb .nbx-mt{gap:5px}.nbz-lb .nbx-mt i{max-width:32px;height:6px;border-radius:3px;background:rgba(255,255,255,.12);transition:background .3s}',
      '.nbz-lb .nbx-mt i.on{background:linear-gradient(90deg,#1FB872,#7CF0B6);box-shadow:0 0 8px rgba(43,217,138,.5)}',
      '.nbz-lb .nbx-sh span{color:#F2C66A;font-weight:800}',
      '.nbz-lb .nbx-seats{display:flex;flex-direction:column;gap:8px;border-top:0}',
      '.nbz-lb .nbx-seats .nba-row{position:relative;overflow:hidden;min-height:68px;padding:10px 14px 10px 12px;border:0;border-radius:18px;background:linear-gradient(90deg,rgba(255,255,255,.025),rgba(43,217,138,.07))}',
      '.nbz-lb .nbx-seats .nba-row::before{width:22px;color:#5F7D6D}',
      '.nbz-lb .nbx-seats .nba-row:not(.em)::after{content:"";position:absolute;top:12px;bottom:12px;right:0;width:3px;border-radius:3px 0 0 3px;background:#2BD98A;opacity:.5}',
      '.nbz-lb .nbx-seats .nba-row.me{background:linear-gradient(90deg,rgba(43,217,138,.05),rgba(43,217,138,.16))}.nbz-lb .nbx-seats .nba-row.me::after{opacity:1;box-shadow:0 0 12px rgba(43,217,138,.6)}',
      '.nbz-lb .nbx-seats .nba-row.host{background:linear-gradient(90deg,rgba(242,184,75,.04),rgba(242,184,75,.15))}.nbz-lb .nbx-seats .nba-row.host::after{background:#F2B84B;opacity:1;box-shadow:0 0 12px rgba(242,184,75,.6)}',
      '.nbz-lb .nbx-seats .nba-row.em{background:none;border:1.5px dashed rgba(255,255,255,.12);color:#7F9A8B}',
      '.nbz-lb .nba-row .nm b{font-size:14.5px;color:#F2F8F4}',
      '.nbz-lb .nba-tag{border:0;background:rgba(242,184,75,.13);color:#FFD98A}',
      '.nbz-lb .nba-card.tight{margin:22px 0 12px;padding:0;border:0;background:none;box-shadow:none;border-radius:0}',
      '.nbz-lb .nba-team{border:0;border-radius:20px;padding:10px;background:linear-gradient(180deg,rgba(43,217,138,.17),rgba(43,217,138,.03))}',
      '.nbz-lb .nba-team.b{background:linear-gradient(180deg,rgba(242,184,75,.18),rgba(242,184,75,.03))}',
      '.nbz-lb .nba-team .nba-row{border:0;border-radius:14px;background:rgba(0,0,0,.24)}',
      '.nbz-lb .nba-team .nba-row.em{background:none;border:1.5px dashed rgba(255,255,255,.12)}',
      '.nbz-lb .nba-team h4{font-size:14.5px}',
      '.nbz-lb .nba-teams{gap:22px}.nbz-lb .nba-vs{width:40px;height:46px;font-size:12px;border:0;border-radius:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#F8D27A,#B9801F);color:#2A1B03;box-shadow:none}',
      '.nbz-lb .nbx-why{margin:10px 0 0;font-size:12.5px;color:#A9C0B2;line-height:1.7}',
      '.nbz-lb .nbz-bar{margin-top:14px}',
      '.nbz-wait{display:flex;align-items:center;justify-content:center;gap:10px;margin:0 0 8px;padding:14px;border-radius:18px;background:rgba(255,255,255,.05);color:#CFE0D6;font-weight:700}',
      '.nbz-wait .nba-wt{background:#2BD98A}',
      /* ── اللعب: ألوان/خلفية ── */
      '.nba-root:has(.nbz-gm){--card:#0F2218;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);--brand:#2BD98A;--brand-l:#7CF0B6;--brand-d:#157A3D;--gold:#F2B84B;--gold-l:#FFD98A;--green:#2BD98A;--red:#FF6B5E;--r3:16px;--r4:22px;--slate:#A9BCB0;--muted:#8FA99A;--sglow:0 0 0 2px rgba(242,184,75,.5),0 0 28px rgba(242,184,75,.25);background:radial-gradient(80% 34% at 50% -6%,rgba(43,217,138,.18),transparent 70%),radial-gradient(60% 30% at 100% 100%,rgba(242,184,75,.06),transparent 70%),linear-gradient(180deg,#0B1D14 0,#0A1510 100%)}',
      '.nbz-gm .nba-top{position:relative;z-index:4}',
      '.nbz-gm .nba-x{width:40px;height:40px;border-radius:14px;background:rgba(3,10,6,.55);border:1px solid rgba(255,255,255,.1)}',
      '.nbz-gm .nbz-vista{height:clamp(110px,15vh,140px);height:clamp(110px,15dvh,140px)}',
      '.nbz-gm .nba-card{border:0;border-radius:22px;background:linear-gradient(180deg,#12281C,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06),0 18px 32px -18px rgba(0,0,0,.85)}',
      /* ── عدّ تنازلي + مواجهة ── */
      '.nbz-gm .nba-cd{margin-top:-6px}',
      '.nbz-gm .nba-big{color:#F4FAF6;text-shadow:0 0 36px rgba(43,217,138,.8),0 0 90px rgba(43,217,138,.35)}',
      '.nbz-gm .nba-lbl{color:#CFE0D6}',
      '.nbz-gm .nba-mp small{color:#EAF4EE}',
      '.nbz-gm .nba-vsb{width:44px;height:50px;display:grid;place-items:center;align-self:center;font-size:13px;color:#2A1B03;text-shadow:none;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#F8D27A,#B9801F);animation:none}',
      '.nbz-gm .nba-note{color:#A9BCB0}',
      /* ── رأس السؤال: الجولة + التقدّم ── */
      '.nbz-gm .nba-pips{gap:4px;margin:4px 0 12px}',
      '.nbz-gm .nba-pips i{height:6px;border-radius:3px;background:var(--ta,rgba(255,255,255,.1))}',
      '.nbz-gm .nba-pips i.g{margin-inline-start:8px}',
      '.nbz-gm .nba-pips i.ok{background:linear-gradient(90deg,#1FB872,#7CF0B6);box-shadow:0 0 8px rgba(43,217,138,.55)}',
      '.nbz-gm .nba-pips i.no{background:var(--red);box-shadow:none}',
      '.nbz-gm .nba-pips i.cur{background:var(--tc,#7CF0B6);box-shadow:0 0 10px var(--tc,#7CF0B6)}',
      '.nbz-gm .nba-qn b{font-size:32px}',
      '.nbz-tc{display:inline-flex;align-items:center;gap:6px;padding:3px 11px 3px 9px;border-radius:99px;background:var(--ta);color:var(--tc);font-size:12px;font-weight:800}.nbz-tc .nba-ico{width:14px;height:14px}',
      '.nbz-gm .nba-ring circle{stroke-width:4}',
      '.nbz-gm .nba-ring .fg{stroke:#2BD98A}',
      '.nbz-gm .nba-ring{filter:drop-shadow(0 0 8px rgba(43,217,138,.3))}',
      '.nbz-gm .nba-ring.lo{filter:drop-shadow(0 0 8px rgba(255,107,94,.45))}',
      /* ── بطاقة السؤال والاختيارات ── */
      '.nbz-gm .nba-qcard{border:0;border-radius:24px;padding:20px 18px;background:radial-gradient(120% 100% at 50% 0,var(--ta,rgba(43,217,138,.2)),transparent 62%),linear-gradient(180deg,#14301F,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.07),0 20px 36px -18px rgba(0,0,0,.85)}',
      '.nbz-gm .nba-qcard::before{height:3px;background:linear-gradient(90deg,transparent,var(--tc,#2BD98A),transparent)}',
      '.nbz-gm .nba-q{font-size:18px;line-height:1.8;color:#F4FAF6}',
      '.nbz-gm .nba-qcard{min-height:clamp(100px,17vh,190px);min-height:clamp(100px,17dvh,190px)}',
      '.nbz-gm .nba-opt{min-height:clamp(54px,8vh,76px);min-height:clamp(54px,8dvh,76px)}',
      '.nbz-gm .nba-opt{border:0;border-radius:18px;padding:10px 12px;background:linear-gradient(180deg,rgba(255,255,255,.065),rgba(255,255,255,.025));box-shadow:inset 0 0 0 1px rgba(255,255,255,.08)}',
      '.nbz-gm .nba-opt .lt{width:38px;height:42px;border-radius:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#1F5E3C,#0E2A1D);color:#9FF0C8;font-size:15px}',
      '.nbz-gm .nba-opt .lt .nba-ico{width:18px;height:18px}',
      '.nbz-gm .nba-opt.sel{background:linear-gradient(180deg,rgba(242,184,75,.2),rgba(242,184,75,.06));box-shadow:0 0 0 2px #F2B84B,0 0 26px -4px rgba(242,184,75,.45)}',
      '.nbz-gm .nba-opt.sel .lt{background:linear-gradient(160deg,#F8D27A,#B9801F);color:#2A1B03}',
      '.nbz-gm .nba-opt.ok{background:linear-gradient(180deg,rgba(43,217,138,.3),rgba(43,217,138,.08));box-shadow:0 0 0 2px #2BD98A,0 0 30px -2px rgba(43,217,138,.5)}',
      '.nbz-gm .nba-opt.ok .lt{background:linear-gradient(160deg,#6BF3B4,#1FB872);color:#04140A}',
      '.nbz-gm .nba-opt.no{background:rgba(255,107,94,.13);box-shadow:0 0 0 2px #FF6B5E}',
      '.nbz-gm .nba-opt.no .lt{background:#FF6B5E;color:#2A0A06}',
      '.nbz-gm .nba-lock{border-radius:99px;background:rgba(255,255,255,.05);margin-top:4px;padding:10px 16px}',
      '.nbz-gm .nba-lock::before{background:#F2B84B}',
      '.nbz-gm .nba-gain.ok{color:#FFD98A;text-shadow:0 0 24px rgba(242,184,75,.5)}',
      '.nbz-gm .nba-gain.no{color:#FF8A7E}',
      '.nbz-gm .nba-xp{border:0;border-radius:16px;background:rgba(242,184,75,.07);box-shadow:inset 3px 0 0 #F2B84B;color:#D6E4DA}',
      '.nbz-rend{display:flex;align-items:center;gap:10px;margin:10px 0 4px;color:var(--tc);font-size:12.5px;font-weight:800}',
      '.nbz-rend::before,.nbz-rend::after{content:"";flex:1;height:1px;background:linear-gradient(to left,var(--ta),transparent)}',
      '.nbz-gm .nba-lead{height:50px;border-radius:14px;padding:0 10px}',
      '.nbz-gm .nba-lead.me{background:linear-gradient(90deg,rgba(43,217,138,.06),rgba(43,217,138,.17));box-shadow:none}',
      '.nbz-gm .nba-lead .sc{color:#7CF0B6}',
      /* ── بانر الجولة ── */
      '.nbz-rb{position:fixed;left:0;right:0;top:30%;z-index:7;pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:6px;padding:22px 16px;background:linear-gradient(90deg,transparent,rgba(3,10,6,.9) 18%,rgba(3,10,6,.9) 82%,transparent);animation:nbzRb 2.2s cubic-bezier(.2,.8,.2,1) both}',
      '.nbz-rb::before,.nbz-rb::after{content:"";position:absolute;left:8%;right:8%;height:1.5px;background:linear-gradient(90deg,transparent,var(--tc),transparent)}.nbz-rb::before{top:0}.nbz-rb::after{bottom:0}',
      '.nbz-rb .rn{font-size:15px;font-weight:800;color:#F2C66A}',
      '.nbz-rb .tt{display:flex;align-items:center;gap:12px}',
      '.nbz-rb .em{display:grid;place-items:center;width:48px;height:54px;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:var(--tc);color:#04140A}.nbz-rb .em .nba-ico{width:24px;height:24px}',
      '.nbz-rb b{font-size:46px;font-weight:900;line-height:1.2;color:var(--tc);text-shadow:0 0 30px var(--ta)}',
      '.nbz-rb small{font-size:13px;font-weight:700;color:#B4CABD}',
      '@keyframes nbzRb{0%{opacity:0;transform:scaleY(.55)}12%{opacity:1;transform:none}82%{opacity:1}100%{opacity:0;transform:translateY(-8px)}}',
      /* ── النتيجة النهائية ── */
      '.nbz-gm .nba-win{border:0;border-radius:26px;background:radial-gradient(90% 70% at 50% 0,rgba(242,184,75,.24),transparent 70%),linear-gradient(180deg,#14301F,#0B1A12);box-shadow:inset 0 0 0 1px rgba(242,184,75,.18),0 24px 40px -20px rgba(0,0,0,.9)}',
      '.nbz-gm .nba-win .tr{width:88px;height:98px;border-radius:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:linear-gradient(160deg,#F8D27A,#B9801F);box-shadow:none}',
      '.nbz-gm .nba-badge{border:0;background:rgba(242,184,75,.13)}',
      '.nbz-gm .nba-stat{border:0;border-radius:18px;background:rgba(255,255,255,.045)}',
      '.nbz-gm .nba-stat b{color:#7CF0B6}.nbz-gm .nba-stat.g b{color:#FFD98A}',
      '.nbz-gm .nba-tvs .t{border:0;border-radius:18px;background:linear-gradient(180deg,rgba(43,217,138,.17),rgba(43,217,138,.04))}.nbz-gm .nba-tvs .t.b{background:linear-gradient(180deg,rgba(242,184,75,.18),rgba(242,184,75,.04))}',
      '.nbz-gm .nba-pod .st::before{background:linear-gradient(180deg,#1FB872,#0E2A1D)}.nbz-gm .nba-pod .p1 .st::before{background:linear-gradient(180deg,#FFE29A,#D99A2B)}',
      '.nbz-gm .nba-btn{border-radius:16px}',
      /* ── الملف الشخصي ── */
      '.nba-pf{--brand:#2BD98A;--brand-l:#7CF0B6;--brand-d:#157A3D;--gold:#F2B84B;--gold-l:#FFD98A;--gold-pale:rgba(242,184,75,.13);--muted:#8FA99A;--slate:#A9BCB0;--ink2:#CFE0D6;--line:rgba(255,255,255,.07);--line2:rgba(255,255,255,.12);background:rgba(2,8,5,.8)}',
      '.nba-pfb{padding:0 16px calc(24px + env(safe-area-inset-bottom,0px));border:0;border-radius:28px 28px 0 0;background:linear-gradient(180deg,#0B1D14,#08130D);box-shadow:0 -24px 60px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08)}',
      '.nba-pfb .nba-pfh{position:sticky;top:0;z-index:5;margin:0 -16px -62px;padding:16px 16px 22px;height:62px;background:linear-gradient(180deg,rgba(8,19,13,.92),rgba(8,19,13,0));color:#F2F8F4;text-shadow:0 1px 10px rgba(0,0,0,.6)}',
      '.nba-pfb .nba-pfh .nba-x{width:40px;height:40px;border-radius:14px;background:rgba(3,10,6,.55);border:1px solid rgba(255,255,255,.1)}',
      '.nbz-pfhero{position:relative;margin:0 -16px;height:206px;overflow:hidden;background:radial-gradient(70% 60% at 50% 55%,rgba(43,217,138,.16),transparent 72%),linear-gradient(180deg,#030A06,#07150E 70%)}',
      '.nbz-pfhero .nbz-vista{margin:0;height:100%}',
      '.nba-pfb .nba-pfu{position:relative;z-index:2;margin-top:-42px;padding:0 0 16px;gap:6px}',
      '.nbz-av.pf{width:104px;height:104px}.nbz-av.pf .nba-av{width:84px!important;height:84px!important;font-size:30px;box-shadow:0 0 0 3px #08130D,0 10px 24px rgba(0,0,0,.55)}',
      '.nbz-av.pf .nbz-lv{bottom:-8px;font-size:11.5px;padding:2px 10px}',
      '.nba-pfb .nba-pfu h3{margin-top:8px;font-size:22px;text-shadow:0 1px 12px rgba(0,0,0,.5)}',
      '.nba-pfb .nba-ttc.big{border:0;background:rgba(242,184,75,.13);color:#FFD98A;padding:4px 14px}',
      '.nba-pfb .nba-pfl{border:0;border-radius:20px;padding:14px 16px;background:linear-gradient(180deg,#12281C,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}',
      '.nba-pfb .nba-pfl .t span:first-child{color:#F2C66A;font-weight:900;font-size:13.5px}',
      '.nba-pfb .nba-pbar{height:8px;background:rgba(0,0,0,.4);box-shadow:inset 0 0 0 1px rgba(255,255,255,.05)}',
      '.nba-pfb .nba-pbar i{background:linear-gradient(90deg,#1FB872,#7CF0B6);box-shadow:0 0 10px rgba(43,217,138,.5)}',
      '.nba-pfb .nba-pfs{gap:10px;border:0;border-radius:0;background:none;overflow:visible}',
      '.nba-pfb .nba-pfs>div{padding:14px 6px;border:0;border-radius:18px;background:linear-gradient(180deg,#12281C,#0B1A12);box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}',
      '.nba-pfb .nba-pfs>div+div{border:0}',
      '.nba-pfb .nba-pfs b{font-size:25px;color:#7CF0B6}.nba-pfb .nba-pfs>div:nth-child(3) b{color:#FFD98A}',
      '.nba-pfb .nba-pftabs{gap:4px;padding:4px;border-radius:16px;background:rgba(255,255,255,.05);overflow:visible}',
      '.nba-pfb .nba-pft{flex:1;border:0;border-radius:12px;min-height:40px;color:#A9BCB0;transition:background .2s,color .2s}',
      '.nba-pfb .nba-pft[aria-pressed=true]{color:#04140A;background:linear-gradient(180deg,#4CF0A8,#2BD98A 55%,#1CB574);box-shadow:inset 0 1px 0 rgba(255,255,255,.5),0 8px 16px -8px rgba(43,217,138,.55)}',
      '.nba-pfb .nba-ai{position:relative;gap:12px;padding:12px 14px 12px 12px;border:0;border-radius:18px;overflow:hidden;background:linear-gradient(90deg,rgba(255,255,255,.02),rgba(255,255,255,.045))}',
      '.nba-pfb .nba-ai::before{content:"";position:absolute;top:12px;bottom:12px;right:0;width:3px;border-radius:3px 0 0 3px;background:rgba(255,255,255,.14)}',
      '.nba-pfb .nba-ai.on{background:linear-gradient(90deg,rgba(43,217,138,.05),rgba(43,217,138,.15))}.nba-pfb .nba-ai.on::before{background:#2BD98A;box-shadow:0 0 12px rgba(43,217,138,.6)}',
      '.nba-pfb .nba-ai.eq{background:linear-gradient(90deg,rgba(242,184,75,.05),rgba(242,184,75,.17))}.nba-pfb .nba-ai.eq::before{background:#F2B84B;box-shadow:0 0 12px rgba(242,184,75,.6)}',
      '.nba-pfb .nba-aic{width:46px;height:52px;border-radius:0;clip-path:polygon(50% 0,100% 25%,100% 75%,50% 100%,0 75%,0 25%);background:rgba(255,255,255,.07);color:#6F8A7A}',
      '.nba-pfb .nba-ai.on .nba-aic{background:linear-gradient(160deg,#35E597,#168A57);color:#04140A}',
      '.nba-pfb .nba-ai.eq .nba-aic{background:linear-gradient(160deg,#F8D27A,#B9801F);color:#2A1B03}',
      '.nba-pfb .nba-aim b{font-size:14.5px;color:#F2F8F4}.nba-pfb .nba-ai:not(.on) .nba-aim b{color:#B4CABD}',
      '.nba-pfb .nba-aim small{color:#8FA99A}',
      '.nba-pfb .nba-ai.on .nba-alk{color:#2BD98A}',
      '.nba-pfb .nba-eqb{min-height:36px;padding:6px 16px;color:#2A1B03;background:linear-gradient(180deg,#FFE29A,#F2B84B 58%,#D99A2B);box-shadow:inset 0 1px 0 rgba(255,255,255,.6)}',
      '.nba-pfb .nba-tag.g{border:0;background:rgba(242,184,75,.15);color:#FFD98A}',
      '.nba-pfb .nba-btn.sec{border-radius:14px;background:rgba(255,255,255,.06);border:0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}',
      /* ── شاشات صغيرة / قصيرة / عريضة ── */
      '@media (max-width:360px){.nbz-h{font-size:29px}.nbz-c{width:124px;height:190px}.nbz-modes{gap:10px}.nbz-m b{font-size:18px}}',
      '@media (max-height:700px){.nbz-vista{height:clamp(170px,30vh,230px)}.nbz-play{min-height:64px}}',
      '@media (min-width:560px){.nbz-stage{margin-inline:0;border-radius:0 0 28px 28px}.nbz-vista{margin-inline:0}}',
      '@media (prefers-reduced-motion:reduce){.nbz *,.nbz *::before,.nbz *::after{animation:none!important;transition:none!important}.nbz-ff,.nbz-mist{display:none}.nbz-vista{transform:none!important}.nbz-m::after{display:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ───────── فتح / قفل ───────── */
  function open(o) {
    o = o || {};
    css();
    cssLobby();
    cssResp();
    cssHub();
    cssProf();
    cssQuests();
    cssRM();
    cssArena();
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
    rmLeave(true);
    detach();
    PV = null;
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

  /* ═════════ بروفايل اللاعب + الألقاب + الإنجازات (ARENA-PROFILE) ═════════
     - المصدر الوحيد للـ XP والمستوى = xp_wallet/{uid} (نظام الأكاديمية NBXP) — بنقراه بس ومش بنكتب فيه ولا بنضيف XP هنا. العتبات وأسماء المستويات من NBXP.lv().
     - إحصائيات الساحة + الإنجازات في arena_profiles/{uid} (قراءة بس من العميل). الكتابة الوحيدة المسموحة للاعب: eq = اللقب المُجهّز (بشرط يكون مفتوح — firestore.rules).
     - الإنجازات بتتسجّل من /api/arena-profile بعد ما الخادم يتحقق من نتيجة المباراة (pl/ans/k) — العميل بيطلب التسجيل بس ومش بيحدد أي رقم.
     - الـ ids لازم تطابق ACH في api/arena-profile.js وقائمة الألقاب في firestore.rules (arTitleOk).
     للتراجع: امسح الكتلة دي (لحد «نهاية بروفايل») + سطور loadRoomProfs/titleChip/openProfile/startFinalize/paintFin/cssProf في باقي الملف. */
  var PIc = {
    user: '<path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    lock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 018 0v4"/>',
    unlock: '<rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 017.5-1.5"/>',
    seed: '<path d="M12 22v-9"/><path d="M12 13c0-4 3-7 8-7 0 5-3 8-8 7z"/><path d="M12 15c0-3-2-5-6-5 0 4 2 6 6 5z"/>',
    flag: '<path d="M4 22V4"/><path d="M4 4h13l-2 4 2 4H4"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    crown: I.crown, fire: I.fire, bolt: I.bolt, users: I.users, trophy: I.trophy, x: I.x
  };
  /* id · اسم الشارة · شرط الفتح · اللقب اللي بتفتحه · أيقونة · [حقل التقدّم, الهدف] */
  var ACH = [
    { id: 'first_match', n: 'أول مواجهة', d: 'لعبت أول مباراة فعلية في الساحة', t: 'نبتة جديدة', i: 'seed' },
    { id: 'first_win', n: 'أول انتصار', d: 'فزت بأول مباراة', t: 'حصاد أول', i: 'trophy' },
    { id: 'matches10', n: 'مثابر', d: 'لعبت 10 مباريات', t: 'المثابر', i: 'flag', f: 'm', g: 10 },
    { id: 'matches50', n: 'محارب قديم', d: 'لعبت 50 مباراة', t: 'من المخضرمين', i: 'shield', f: 'm', g: 50 },
    { id: 'wins10', n: 'بطل الساحة', d: 'فزت بـ 10 مباريات', t: 'بطل الساحة', i: 'crown', f: 'w', g: 10 },
    { id: 'wins25', n: 'سيّد الساحة', d: 'فزت بـ 25 مباراة', t: 'سيّد الساحة', i: 'crown', f: 'w', g: 25 },
    { id: 'streak3', n: 'سلسلة خضراء', d: 'فزت 3 مرات ورا بعض', t: 'السلسلة الخضراء', i: 'fire', f: 'bs', g: 3 },
    { id: 'streak5', n: 'بطل المواسم', d: 'فزت 5 مرات ورا بعض', t: 'بطل المواسم', i: 'fire', f: 'bs', g: 5 },
    { id: 'perfect', n: 'العلامة الكاملة', d: 'جاوبت 10 من 10 صح في مباراة', t: 'العالِم', i: 'target' },
    { id: 'speed', n: 'برق الحقل', d: '5 إجابات صحيحة كل واحدة في أقل من 3 ثواني في مباراة واحدة', t: 'سريع البديهة', i: 'bolt' },
    { id: 'team_win', n: 'روح الفريق', d: 'فزت في مباراة فرق', t: 'قائد الفريق', i: 'users' }
  ];
  var PC = {}, PT = {}, PV = null;   /* PC: uid → { ok, p (arena_profiles), at, xp, wn, wat } · PT: آخر محاولة تحميل · PV: شاشة البروفايل المفتوحة */
  function nbxp() { return window.NBXP && typeof window.NBXP.lv === 'function' ? window.NBXP : null; }
  function achOf(id) { for (var i = 0; i < ACH.length; i++) if (ACH[i].id === id) return ACH[i]; return null; }
  function titleLabel(id) {
    if (!id || typeof id !== 'string') return '';
    var a = achOf(id); if (a) return a.t;
    var m = /^lv([0-6])$/.exec(id), x = nbxp();
    return m && x ? (x.lv(0).nm[+m[1]] || '') : '';
  }
  function eqOf(uid) { var c = PC[uid]; return c && c.p && typeof c.p.eq === 'string' ? c.p.eq : ''; }
  function titleChip(uid, cls) { var l = titleLabel(eqOf(uid)); return l ? h('span', { class: 'nba-ttc' + (cls ? ' ' + cls : ''), text: l }) : null; }
  function num(v) { v = +v; return v > 0 ? Math.floor(v) : 0; }

  /* قراءة بروفايل الساحة (+ محفظة الـ XP لو withXp). الفشل ما بيكسرش حاجة: من غير بيانات = من غير لقب/مستوى */
  function loadProf(uid, withXp, force) {
    var c = PC[uid], now = Date.now();
    if (!force && c && c.ok && now - c.at < 90000 && (!withXp || (c.wat && now - c.wat < 90000))) return Promise.resolve(c);
    var db = window.db;
    var pj = db.collection('arena_profiles').doc(uid).get().then(function (d) { return { ok: true, p: d.exists ? d.data() : null }; }, function () { return { ok: false }; });
    var wj = withXp ? db.collection('xp_wallet').doc(uid).get().then(function (d) { var x = d.exists ? d.data() : {}; return { xp: num(x.xp), nm: typeof x.nm === 'string' ? x.nm : '' }; }, function () { return null; }) : Promise.resolve(null);
    return Promise.all([pj, wj]).then(function (r) {
      var o = PC[uid] || {};
      if (r[0].ok) { o.ok = true; o.p = r[0].p; o.at = Date.now(); }
      if (r[1]) { o.xp = r[1].xp; o.wn = r[1].nm; o.wat = Date.now(); }
      PC[uid] = o;
      return o;
    });
  }
  /* بروفايلات لاعبين الغرفة (للقب جنب الاسم) — قراءة واحدة لكل لاعب، وبتتعاد بس لو قديمة (5 دقايق) */
  function loadRoomProfs() {
    if (!S || !window.db) return;
    var sess = S, now = Date.now(), need = Object.keys(S.players).filter(function (u) {
      var c = PC[u]; return !(c && c.ok && now - c.at < 300000) && !(PT[u] && now - PT[u] < 20000);
    });
    if (!need.length) return;
    need.forEach(function (u) { PT[u] = now; });
    Promise.all(need.map(function (u) { return loadProf(u, false); })).then(function () { if (sess === S) repaintCards(); });
  }
  function repaintCards() {
    if (!S || !S.room || !root) return;
    if (S.room.st === 'lobby') { render(); return; }
    var p = phase();
    if (p && (p.k === 'lead' || p.k === 'done')) { V.key = ''; render(); }   /* مش بنعيد الرسم أثناء الأسئلة */
  }

  /* تجهيز لقب: كتابة eq بس — القواعد بتتأكد إنه مفتوح فعلًا (إنجاز مسجّل من الخادم أو مستوى XP كافي) */
  async function equipTitle(id, btn) {
    var u = me(); if (!u || !window.db) return;
    if (btn) btn.disabled = true;
    try {
      await window.db.collection('arena_profiles').doc(u.uid).set({ eq: id }, { merge: true });
      var c = PC[u.uid]; if (c && c.ok) c.p = Object.assign({}, c.p || {}, { eq: id });
      toast(id ? 'تم تجهيز اللقب' : 'تم إلغاء اللقب', 'ok');
      loadProf(u.uid, true, true).then(function () { if (PV) paintProfile(); paintFin(); repaintCards(); });
    } catch (e) {
      toast(e && e.code === 'permission-denied' ? 'اللقب ده لسه مقفول' : 'تعذّر تجهيز اللقب، جرّب تاني', 'err');
    }
    if (btn) btn.disabled = false;
    if (PV) paintProfile(); paintFin(); repaintCards();
  }

  /* ───────── شاشة البروفايل (Bottom sheet فوق أي شاشة في الساحة) ───────── */
  function openProfile(uid, info) {
    if (!root || !uid) return;
    closeProfile();
    var ov = h('div', { class: 'nba-pf', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'الملف الشخصي' }), box = h('div', { class: 'nba-pfb' });
    ov.appendChild(box);
    ov.addEventListener('click', function (e) { if (e.target === ov) closeProfile(); });
    ov.addEventListener('keydown', function (e) { if (e.key === 'Escape') { e.stopPropagation(); closeProfile(); } });
    root.appendChild(ov);
    PV = { ov: ov, box: box, uid: uid, info: info || {}, tab: 'ach', back: document.activeElement };
    paintProfile(true);
    var mine = PV;
    loadProf(uid, true).then(function () { if (PV === mine) paintProfile(); });
  }
  function closeProfile() {
    if (!PV) return;
    var b = PV.back; try { PV.ov.remove(); } catch (e) { /* ignore */ }
    PV = null;
    try { if (b && b.focus && document.contains(b)) b.focus(); } catch (e) { /* ignore */ }
  }
  function paintProfile(first) {
    if (!PV || !PV.ov.isConnected) return;
    var uid = PV.uid, u = me(), own = !!(u && u.uid === uid), c = PC[uid] || {}, p = c.p || {}, x = nbxp(), box = PV.box, st = box.scrollTop;
    var name = (PV.info.n || c.wn || (own ? myName() : '') || 'لاعب'), photo = PV.info.ph || (own ? myPhoto() : '');
    var eq = typeof p.eq === 'string' ? p.eq : '', ac = Array.isArray(p.ac) ? p.ac : [];
    var m = num(p.m), w = num(p.w), ws = num(p.ws), bs = num(p.bs), xp = typeof c.xp === 'number' ? c.xp : null;
    box.innerHTML = '';
    box.appendChild(h('div', { class: 'nba-pfh' }, [h('span', { text: 'الملف الشخصي' }), h('button', { class: 'nba-x', 'aria-label': 'إغلاق', onclick: closeProfile }, [ico(PIc.x)])]));
    var chip = titleLabel(eq), L0 = null, pc0 = 0;   /* ARENA-LOBBY-X: بروفايل بنفس لغة اللوبي */
    if (x && xp !== null) { L0 = x.lv(xp); pc0 = L0.hi ? Math.max(0, Math.min(100, Math.round((xp - L0.lo) / (L0.hi - L0.lo) * 100))) : 100; }
    box.appendChild(h('div', { class: 'nbz-pfhero', 'aria-hidden': 'true' }, [h('div', { class: 'nbz-stars' }), nbzVista()]));
    var rgb = h('span', { class: 'nbz-rg' }); rgb.innerHTML = nbzRing(0);
    if (L0) {
      var setRg = function () { var v = rgb.querySelector('.v'); if (v) v.style.strokeDasharray = (+v.getAttribute('data-c') * pc0 / 100).toFixed(2) + ' ' + v.getAttribute('data-c'); };
      if (first) requestAnimationFrame(setRg); else { rgb.querySelector('.v').style.transition = 'none'; setRg(); }
    }
    box.appendChild(h('div', { class: 'nba-pfu' }, [h('div', { class: 'nbz-av pf' }, [rgb, avatar(uid, { n: name, ph: photo }, 80), L0 ? h('span', { class: 'nbz-lv', text: 'LV ' + (L0.i + 1) }) : null]), h('h3', { text: name }), chip ? h('span', { class: 'nba-ttc big', text: chip }) : h('small', { style: 'color:var(--muted);font-weight:700', text: 'بدون لقب' })]));
    if (!c.ok && !first) box.appendChild(h('div', { class: 'nba-fn dim', text: 'تعذّر تحميل بيانات الساحة دلوقتي.' }));
    /* المستوى + الـ XP (من xp_wallet — نفس نظام الأكاديمية) */
    if (x && xp !== null) {
      var L = x.lv(xp), span = L.hi ? L.hi - L.lo : 1, pc = L.hi ? Math.max(0, Math.min(100, Math.round((xp - L.lo) / span * 100))) : 100;
      box.appendChild(h('div', { class: 'nba-pfl' }, [h('div', { class: 't' }, [h('span', { text: 'المستوى ' + (L.i + 1) + ' — ' + L.n }), h('span', { text: L.hi ? xp + ' / ' + L.hi + ' XP' : xp + ' XP · أعلى مستوى' })]),
        h('div', { class: 'nba-pbar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(pc), 'aria-label': 'التقدّم نحو المستوى التالي' }, [h('i', { style: 'width:' + pc + '%' })])]));
    }
    var stat = function (v, l) { return h('div', {}, [h('b', { text: v }), h('span', { text: l })]); };
    box.appendChild(h('div', { class: 'nba-pfs' }, [stat(String(w), 'انتصارات'), stat(String(m), 'مباريات'), stat(m ? Math.round(w / m * 100) + '%' : '—', 'نسبة الفوز')]));
    if (ws > 0 || bs > 0) box.appendChild(h('div', { class: 'nba-pfk' }, [ws > 0 ? h('span', { class: 'nba-streak' }, [ico(I.fire), 'سلسلة انتصارات ×' + ws]) : h('span', { style: 'color:var(--muted)', text: 'مفيش سلسلة انتصارات حالية' }), bs > 0 ? h('span', { style: 'color:var(--muted)', text: 'أفضل سلسلة: ' + bs }) : null]));   /* WIN-STREAK */
    else if (!m && c.ok) box.appendChild(h('div', { class: 'nba-fn dim', text: own ? 'لسه ما لعبتش مباريات — أول مباراة بتبدأ بيها ملفك.' : 'لسه ما لعبش مباريات.' }));
    var tabs = h('div', { class: 'nba-pftabs', role: 'group', 'aria-label': 'أقسام الملف' }, [['ach', 'الإنجازات'], ['ttl', 'الألقاب']].map(function (t) {
      return h('button', { class: 'nba-pft', 'aria-pressed': PV.tab === t[0] ? 'true' : 'false', onclick: function () { PV.tab = t[0]; paintProfile(); } }, [t[1]]);
    }));
    box.appendChild(tabs);
    var list = h('div', { class: 'nba-pfli' });
    if (PV.tab === 'ach') {
      ACH.forEach(function (a) {
        var on = ac.indexOf(a.id) > -1, prog = !on && a.f && c.ok ? Math.min(num(p[a.f]), a.g) + ' / ' + a.g : '';
        list.appendChild(h('div', { class: 'nba-ai' + (on ? ' on' : '') }, [h('span', { class: 'nba-aic' }, [ico(PIc[a.i])]),
          h('div', { class: 'nba-aim' }, [h('b', { text: a.n }), h('small', { text: a.d + (prog ? ' · ' + prog : '') })]),
          h('span', { class: 'nba-alk', role: 'img', 'aria-label': on ? 'مفتوح' : 'مقفول' }, [ico(on ? PIc.unlock : PIc.lock)])]));
      });
    } else {
      var rows = [];
      if (x) { var th = x.lv(0).th, nm = x.lv(0).nm; for (var n = 0; n < nm.length; n++) rows.push({ id: 'lv' + n, t: nm[n], need: 'المستوى ' + (n + 1) + ' (' + th[n] + ' XP)', on: xp !== null && xp >= th[n], ic: 'seed' }); }
      ACH.forEach(function (a) { rows.push({ id: a.id, t: a.t, need: 'إنجاز «' + a.n + '»', on: ac.indexOf(a.id) > -1, ic: a.i }); });
      if (own && eq) list.appendChild(h('button', { class: 'nba-btn sec sm', style: 'margin-bottom:10px', onclick: function (e) { equipTitle('', e.currentTarget); } }, ['إلغاء اللقب الحالي']));
      rows.forEach(function (r) {
        var isEq = eq === r.id;
        list.appendChild(h('div', { class: 'nba-ai' + (r.on ? ' on' : '') + (isEq ? ' eq' : '') }, [h('span', { class: 'nba-aic' }, [ico(PIc[r.ic])]),
          h('div', { class: 'nba-aim' }, [h('b', { text: r.t }), h('small', { text: r.on ? 'مفتوح' : 'يتفتح بـ ' + r.need })]),
          isEq ? h('span', { class: 'nba-tag g', text: 'مُجهّز' }) : (own && r.on ? h('button', { class: 'nba-eqb', 'aria-label': 'تجهيز لقب ' + r.t, onclick: function (e) { equipTitle(r.id, e.currentTarget); } }, ['تجهيز']) : h('span', { class: 'nba-alk', role: 'img', 'aria-label': r.on ? 'مفتوح' : 'مقفول' }, [ico(r.on ? PIc.unlock : PIc.lock)]))]));
      });
    }
    box.appendChild(list);
    box.scrollTop = st;
    if (first) { var cb = box.querySelector('.nba-x'); if (cb) cb.focus(); }
  }

  /* ───────── تسجيل نتيجة المباراة (الخادم هو اللي بيتحقق ويحسب) ───────── */
  function startFinalize() {
    var sess = S, rid = S.rid, uid = S.uid;
    sess.fin = { st: 'busy' };
    sess.finP = (async function () {
      var wait = [0, 1500, 4000, 8000];
      try {
        for (var a = 0; a < wait.length; a++) {
          if (wait[a]) await sleep(wait[a]);
          try {
            var tok = await me().getIdToken(), ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 15000), r;
            try { r = await fetch('/api/arena-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify({ action: 'finalize', rid: rid }), signal: ctl.signal }); } finally { clearTimeout(tm); }
            var j = await r.json().catch(function () { return {}; });
            if (r.ok && j && j.ok) { sess.fin = { st: 'ok', d: j }; if (j.me && qValid(j.me.q)) qSet(j.me.q); else Q.at = 0; break; }
            if (r.status === 503 && j && j.error === 'not_configured') { sess.fin = { st: 'off' }; break; }
            if (r.status !== 503 && r.status !== 429 && r.status !== 409) { sess.fin = { st: 'err' }; break; }
          } catch (e) { /* شبكة: نعيد المحاولة */ }
        }
      } catch (e) { /* ignore */ }
      if (sess.fin.st === 'busy') sess.fin = { st: 'err' };
      if (sess.fin.st === 'ok') {
        try { await loadProf(uid, true, true); } catch (e) { /* ignore */ }
        try {   /* WIN-STREAK: الخادم كتب بروفايلات كل لاعبين المباراة في نفس الـ commit → نحدّث سلاسلهم المعروضة جنب الأسماء */
          await Promise.all(Object.keys(sess.players || {}).filter(function (u) { return u !== uid; }).map(function (u) { return loadProf(u, false, true).catch(function () { /* ignore */ }); }));
        } catch (e) { /* ignore */ }
      }
      if (sess === S) { paintFin(); repaintCards(); }
    })();
  }
  function paintFin() {
    var el = S && S.finEl, f = S && S.fin;
    if (!el || !el.isConnected || !f) return;
    el.innerHTML = '';
    if (f.st === 'busy') { el.appendChild(h('div', { class: 'nba-fn' }, [h('div', { class: 'nba-spin d', style: 'margin:0 auto 8px' }), 'جاري تسجيل تقدّمك في الساحة…'])); return; }
    if (f.st === 'err') { el.appendChild(h('div', { class: 'nba-fn dim', text: 'تعذّر تسجيل تقدّمك في الملف الشخصي دلوقتي. نتيجة المباراة هنا سليمة.' })); return; }
    if (f.st !== 'ok' || !f.d || !f.d.me) return;
    var d = f.d, mi = d.me, uid = S.uid, c = PC[uid] || {}, p = c.p || {}, eq = typeof p.eq === 'string' ? p.eq : '';
    /* WIN-STREAK: الأرقام من رد الخادم المتحقَّق (ws بعد المباراة · bs أفضل · ps قبلها) — لو مش موجودة (marker قديم) بنرجع للبروفايل */
    var ws = typeof mi.ws === 'number' ? mi.ws : num(p.ws), bs = typeof mi.bs === 'number' ? mi.bs : num(p.bs), ps = typeof mi.ps === 'number' ? mi.ps : -1;
    var keep = ws > 0 ? ' سلسلة انتصاراتك (×' + ws + ') ما اتأثّرتش.' : '';
    if (!d.counted) { el.appendChild(h('div', { class: 'nba-fn dim', text: 'المباراة دي ما اتحسبتش في الإحصائيات — لازم لاعبين اتنين على الأقل يجاوبوا 3 أسئلة أو أكتر.' + keep })); return; }
    if (!mi.k) { el.appendChild(h('div', { class: 'nba-fn dim', text: 'مباراتك ما اتحسبتش في ملفك (ما جاوبتش بما يكفي، أو وصلت للحد اليومي).' + keep })); return; }
    var card = h('div', { class: 'nba-card nba-prg' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'تقدّمك في الساحة' }),
      h('div', { style: 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px' }, [
        h('span', { class: 'nba-tag' + (mi.w ? ' g' : ''), text: mi.w ? 'انتصار اتسجّل في ملفك' : 'مباراة اتسجّلت في ملفك' }),
        ws >= 1 && mi.w ? h('span', { class: 'nba-streak' }, [ico(I.fire), 'سلسلة انتصارات ×' + ws]) : null])]);
    var sl = mi.w ? (bs > ws ? 'أفضل سلسلة ليك: ' + bs : (ws >= 2 ? 'ده أفضل رقم ليك لحد دلوقتي!' : ''))
      : (ps > 0 && ws === 0 ? 'السلسلة اتصفّرت (كانت ×' + ps + ')' + (bs > 0 ? ' — أفضل سلسلة ليك: ' + bs : '')
        : (ps > 0 && ws === ps ? 'تعادل — سلسلتك محفوظة ×' + ws : (bs > 0 ? 'أفضل سلسلة ليك: ' + bs : '')));
    if (sl) card.appendChild(h('div', { class: 'nba-skl', text: sl }));   /* WIN-STREAK */
    (mi.n || []).forEach(function (id) {
      var a = achOf(id); if (!a) return;
      card.appendChild(h('div', { class: 'nba-ng' }, [h('span', { class: 'nba-aic', style: 'background:rgba(61,220,132,.16);color:var(--brand-l)' }, [ico(PIc[a.i])]),
        h('div', { class: 'nba-aim' }, [h('b', { text: 'إنجاز جديد: ' + a.n }), h('small', { text: 'لقب جديد: ' + a.t })]),
        eq === id ? h('span', { class: 'nba-tag g', text: 'مُجهّز' }) : h('button', { class: 'nba-eqb', onclick: function (e) { equipTitle(id, e.currentTarget); } }, ['جهّزه'])]));
    });
    card.appendChild(h('button', { class: 'nba-btn sec sm', style: 'margin-top:10px', onclick: function () { openProfile(uid, { n: myName(), ph: myPhoto() }); } }, [ico(PIc.user), 'ملفي الشخصي']));
    el.appendChild(card);
    el.appendChild(qCard());   /* DAILY-QUESTS */
  }
  function cssProf() {
    if (document.getElementById('nba-css-pf')) return;
    var st = document.createElement('style'); st.id = 'nba-css-pf';
    st.textContent = [
      '.nba-ttc{display:inline-flex;align-items:center;max-width:100%;padding:1px 8px;border-radius:99px;font-size:10.5px;font-weight:800;line-height:1.6;color:var(--gold-l);background:var(--gold-pale);border:1px solid rgba(245,184,61,.28);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:none}',
      '.nba-ttc.sm{display:flex;margin:2px auto 0;width:fit-content;font-size:9.5px;padding:0 6px}',
      '.nba-ttc.big{font-size:12.5px;padding:3px 12px}',
      '.nba-nl{display:flex;align-items:center;gap:6px;min-width:0}',
      '.nba-lead .nm .nba-ttc{margin-inline-start:6px;vertical-align:1px;font-size:9.5px;padding:0 6px}',
      '.nba-row[role=button],.nba-lead[role=button]{cursor:pointer}.nba-row[role=button]:focus-visible,.nba-lead[role=button]:focus-visible{outline:2px solid var(--brand);outline-offset:2px}',
      '.nba-pfbtn{margin-inline-start:auto;display:inline-flex;align-items:center;gap:6px;border:1px solid rgba(61,220,132,.35);background:rgba(61,220,132,.1);color:var(--brand-l);border-radius:99px;padding:7px 13px;font:800 12.5px var(--f-ui,Cairo,sans-serif);cursor:pointer;min-height:36px;position:relative}',
      '.nba-pf{position:fixed;inset:0;z-index:40;display:flex;align-items:flex-end;justify-content:center;background:rgba(2,8,5,.74);-webkit-backdrop-filter:blur(6px);backdrop-filter:blur(6px);animation:nbaPfF .2s ease-out both}',
      '.nba-pfb{position:relative;width:100%;max-width:520px;max-height:94vh;max-height:94dvh;overflow-y:auto;overscroll-behavior:contain;padding:14px 16px calc(24px + env(safe-area-inset-bottom,0px));border-radius:24px 24px 0 0;background:radial-gradient(120% 55% at 50% 0,rgba(61,220,132,.18),transparent 60%),linear-gradient(180deg,#0f2418,#08130d);border:1px solid rgba(61,220,132,.18);border-bottom:0;box-shadow:0 -20px 50px rgba(0,0,0,.5);animation:nbaPfU .28s cubic-bezier(.2,.8,.2,1) both}',
      '@keyframes nbaPfF{from{opacity:0}to{opacity:1}}@keyframes nbaPfU{from{transform:translateY(26px);opacity:0}to{transform:none;opacity:1}}',
      '@media (prefers-reduced-motion:reduce){.nba-pf,.nba-pfb{animation:none}.nba-pbar i{transition:none}}',
      '.nba-pfh{display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;font-weight:900;font-size:16px}',
      '.nba-pfu{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:6px 0 14px}.nba-pfu h3{margin:0;font-size:20px;font-weight:900;overflow-wrap:anywhere}',
      '.nba-pfl{border:1px solid rgba(61,220,132,.16);border-radius:16px;background:rgba(255,255,255,.035);padding:12px 14px;margin-bottom:12px}',
      '.nba-pfl .t{display:flex;justify-content:space-between;gap:8px;font-size:12.5px;font-weight:800;color:var(--ink2);margin-bottom:8px}.nba-pfl .t span:last-child{color:var(--muted);font-weight:700;direction:ltr}',
      '.nba-pbar{height:8px;border-radius:8px;background:rgba(255,255,255,.09);overflow:hidden}.nba-pbar i{display:block;height:100%;border-radius:8px;background:linear-gradient(90deg,var(--brand-d),var(--brand-l));transition:width .6s cubic-bezier(.2,.8,.2,1)}',
      '.nba-pfs{display:grid;grid-template-columns:repeat(3,1fr);margin-bottom:12px;border:1px solid rgba(61,220,132,.16);border-radius:16px;background:rgba(255,255,255,.035);overflow:hidden}',
      '.nba-pfs>div{padding:12px 6px;text-align:center}.nba-pfs>div+div{border-inline-start:1px solid var(--line)}',
      '.nba-pfs b{display:block;font-size:20px;font-weight:900;font-variant-numeric:tabular-nums}.nba-pfs span{font-size:11.5px;color:var(--slate);font-weight:700}',
      '.nba-pfk{display:flex;align-items:center;justify-content:center;gap:10px;flex-wrap:wrap;margin:-2px 0 12px;font-size:12.5px;font-weight:800}',
      '.nba-pftabs{display:flex;gap:8px;margin:4px 0 12px;overflow-x:auto}',
      '.nba-pft{flex:none;border:1px solid var(--line2);background:transparent;color:var(--ink2);padding:7px 14px;border-radius:99px;font:800 13px var(--f-ui,Cairo,sans-serif);cursor:pointer;min-height:36px}.nba-pft[aria-pressed=true]{background:var(--brand);color:#04140a;border-color:var(--brand)}',
      '.nba-ai{display:flex;align-items:center;gap:12px;padding:11px 12px;margin-bottom:8px;border-radius:14px;border:1px solid var(--line);background:rgba(255,255,255,.03)}',
      '.nba-ai.on{border-color:rgba(61,220,132,.3);background:linear-gradient(180deg,rgba(61,220,132,.1),rgba(61,220,132,.03))}.nba-ai.eq{border-color:rgba(245,184,61,.42);background:linear-gradient(180deg,var(--gold-pale),rgba(245,184,61,.03))}',
      '.nba-aic{flex:none;width:42px;height:42px;border-radius:12px;display:grid;place-items:center;background:rgba(255,255,255,.06);color:var(--muted)}.nba-ai.on .nba-aic{background:rgba(61,220,132,.16);color:var(--brand-l)}.nba-aic .nba-ico{width:22px;height:22px}',
      '.nba-aim{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px;line-height:1.45}.nba-aim b{font-size:14px;font-weight:800}.nba-aim small{font-size:11.5px;color:var(--muted);font-weight:600}.nba-ai:not(.on) .nba-aim b{color:var(--ink2)}',
      '.nba-alk{flex:none;display:inline-flex;color:var(--muted)}.nba-ai.on .nba-alk{color:var(--brand)}',
      '.nba-eqb{flex:none;border:0;border-radius:99px;padding:6px 14px;font:800 12px var(--f-ui,Cairo,sans-serif);cursor:pointer;color:#04140a;background:var(--brand);min-height:34px}.nba-eqb[disabled]{opacity:.55}',
      '.nba-fn{text-align:center;font-size:13px;font-weight:700;color:var(--ink2);padding:6px 4px 12px;line-height:1.7}.nba-fn.dim{color:var(--muted)}',
      '.nba-prg{border-color:rgba(61,220,132,.3)}.nba-ng{display:flex;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--line)}'
    ].join('\n');
    document.head.appendChild(st);
  }
  /* ═════════ نهاية بروفايل ═════════ */

  /* ═════════ المهام اليومية (DAILY-QUESTS) ═════════
     - الحالة والتقدّم والمكافآت كلها من الخادم (/api/arena-profile: quests / claim). العميل بيعرض ويطلب الاستلام بس — مفيش رقم بيتكتب من هنا.
     - الـ XP بتدخل محفظة NBXP الموجودة (xp_wallet) من الخادم في commit واحد ذرّي مع علامة الاستلام وحدث الـ ledger. مفيش محفظة جديدة.
     - اليوم = Africa/Cairo بيحدّده الخادم (مش ساعة الجهاز). التقدّم بيجي في ردّ finalize (من غير قراءة زيادة) والباقي كاش 90ث في الذاكرة. مفيش مستمعين onSnapshot.
     للتراجع: امسح الكتلة دي (لحد «نهاية المهام») + سطر cssQuests() في open() + سطري qSet/qCard في startFinalize/paintFin + qCard() في vHub2. */
  var QIC = { m: PIc.flag, c: PIc.target, w: I.trophy };
  var Q = { uid: '', d: null, at: 0, sk: 0, p: null, err: false, off: false, tm: 0, busy: {} };
  function qValid(q) {
    return !!q && typeof q.d === 'string' && typeof q.ex === 'number' && Array.isArray(q.t) && q.t.length === 3 &&
      q.t.every(function (t) { return t && /^[mcw]$/.test(t.k) && isFinite(t.g) && isFinite(t.p) && isFinite(t.r) && t.g > 0; });
  }
  function qLeft() { return Q.d ? Q.d.ex - (Date.now() + Q.sk) : 0; }   /* الوقت المتبقي لتجديد المهام (بساعة الخادم) */
  function qSet(q, now) {
    var u = me(); if (!u || !qValid(q)) return;
    if (typeof now === 'number') Q.sk = now - Date.now();
    Q.uid = u.uid; Q.d = q; Q.at = Date.now(); Q.err = false;
    clearTimeout(Q.tm);
    var ms = qLeft() + 1500;   /* مؤقّت واحد بس لحد التجديد — بعدها نجيب مهام اليوم الجديد */
    if (ms > 0 && ms < 26 * 3600000) Q.tm = setTimeout(function () { Q.d = null; Q.at = 0; if (root) { qRepaint(); qLoad(true); } }, ms);
  }
  function qClear() { clearTimeout(Q.tm); Q.uid = ''; Q.d = null; Q.at = 0; Q.err = false; Q.p = null; Q.busy = {}; }
  async function qApi(body) {
    var tok = await me().getIdToken(), ctl = new AbortController(), tm = setTimeout(function () { ctl.abort(); }, 15000), r;
    try { r = await fetch('/api/arena-profile', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + tok }, body: JSON.stringify(body), signal: ctl.signal }); } finally { clearTimeout(tm); }
    var j = await r.json().catch(function () { return {}; });
    return { status: r.status, body: j || {} };
  }
  function qLoad(force) {
    var u = me(); if (!u || Q.off) return Promise.resolve(null);
    if (Q.uid && Q.uid !== u.uid) qClear();
    if (!force && Q.d && Date.now() - Q.at < 90000 && qLeft() > 0) return Promise.resolve(Q.d);
    if (Q.p) return Q.p;
    Q.err = false;
    var run = qApi({ action: 'quests' }).then(function (r) {
      if (r.status === 200 && r.body.ok && qValid(r.body.q)) qSet(r.body.q, r.body.now);
      else if (r.status === 503 && r.body.error === 'not_configured') Q.off = true;   /* الخادم مش مظبوط: نخفي الكارت — الساحة شغّالة عادي */
      else Q.err = true;
    }, function () { Q.err = true; }).then(function () { if (Q.p === run) Q.p = null; qRepaint(); return Q.d; });
    Q.p = run;
    return run;
  }
  function qAr(n, one, two, few, many) { return n === 1 ? one : n === 2 ? two : n + ' ' + (n <= 10 ? few : many); }
  function qLabel(k, g) {
    return k === 'm' ? 'خلّص ' + qAr(g, 'مباراة', 'مباراتين', 'مباريات', 'مباراة')
      : k === 'c' ? 'جاوب ' + qAr(g, 'إجابة صح', 'إجابتين صح', 'إجابات صح', 'إجابة صح')
      : 'اكسب ' + qAr(g, 'مباراة', 'مباراتين', 'مباريات', 'مباراة');
  }
  function qRemain() {
    var ms = Math.max(0, qLeft()), hr = Math.floor(ms / 3600000), mn = Math.floor((ms % 3600000) / 60000);
    return hr > 0 ? hr + ' س' + (mn ? ' و' + mn + ' د' : '') : Math.max(1, mn) + ' د';
  }
  async function qClaim(k, btn) {
    if (Q.busy[k]) return;
    Q.busy[k] = 1; btn.disabled = true; btn.classList.add('ld');
    try {
      var r = await qApi({ action: 'claim', k: k });
      if (r.status === 200 && r.body.ok) {
        qSet(r.body.q, r.body.now);
        if (r.body.xp > 0) { toast('+' + r.body.xp + ' XP اتضافت لمحفظتك', 'ok'); SFX.play('correct'); var c = PC[me().uid]; if (c) { c.wat = 0; c.at = 0; } }
        else toast('المكافأة دي اتستلمت قبل كده', 'inf');
      } else if (r.status === 409) {
        if (qValid(r.body.q)) qSet(r.body.q);
        toast('المهمة لسه ما خلصتش أو اليوم اتجدد.', 'inf');
      } else if (r.status === 429) toast('استنى لحظة وجرّب تاني.', 'inf');
      else toast('تعذّر استلام المكافأة دلوقتي. جرّب تاني.', 'err');
    } catch (e) { toast('تعذّر الاتصال. جرّب تاني.', 'err'); }
    Q.busy[k] = 0; qRepaint();
  }
  function qRow(t) {
    var lb = qLabel(t.k, t.g), pc = Math.max(0, Math.min(100, Math.round(t.p / t.g * 100))), ready = t.p >= t.g;
    var act = t.c ? h('span', { class: 'nba-tag g nbq-dn', text: 'اتستلمت' }, [])
      : ready ? h('button', { class: 'nbq-bt', 'aria-label': 'استلم ' + t.r + ' XP — ' + lb, onclick: function (e) { qClaim(t.k, e.currentTarget); } }, ['استلم +' + t.r])
      : h('span', { class: 'nbq-rw', text: '+' + t.r + ' XP' });
    return h('div', { class: 'nbq-r' + (t.c ? ' cl' : ready ? ' rd' : '') }, [
      h('span', { class: 'nbq-i' }, [ico(QIC[t.k])]),
      h('div', { class: 'nbq-m' }, [
        h('div', { class: 'nbq-t' }, [h('b', { text: lb }), h('em', { text: Math.min(t.p, t.g) + '/' + t.g })]),
        h('div', { class: 'nba-pbar nbq-pb', role: 'progressbar', 'aria-label': lb, 'aria-valuemin': '0', 'aria-valuemax': String(t.g), 'aria-valuenow': String(Math.min(t.p, t.g)) }, [h('i', { style: 'width:' + pc + '%' })])]),
      h('div', { class: 'nbq-a' }, [act])]);
  }
  function qFill(el) {
    el.innerHTML = '';
    if (Q.off) { el.hidden = true; return; }
    el.hidden = false;
    var d = Q.d, done = d ? d.t.filter(function (t) { return t.c; }).length : 0;
    var head = h('div', { class: 'nbq-h' }, [h('div', { class: 'nbq-ti' }, [ico(PIc.target), h('b', { text: 'المهام اليومية' })]), d ? h('span', { class: 'nba-tag' + (done === 3 ? ' g' : ''), text: done + '/3' }) : null]);
    var kids = [head];
    if (!d) kids.push(Q.err ? h('div', { class: 'nbq-er' }, ['تعذّر تحميل المهام دلوقتي.', h('button', { class: 'nba-eqb', onclick: function () { qLoad(true); qRepaint(); } }, ['إعادة المحاولة'])])
      : h('div', { class: 'nbq-sk', 'aria-busy': 'true', 'aria-label': 'جاري تحميل المهام' }, [h('i'), h('i'), h('i')]));
    else {
      kids.push(h('div', { class: 'nbq-sub', text: 'بتتجدد كل يوم 12 بالليل بتوقيت القاهرة • باقي ' + qRemain() }));
      d.t.forEach(function (t) { kids.push(qRow(t)); });
      kids.push(h('div', { class: 'nbq-nt', text: 'بتتحسب المباريات اللي لاعبين اتنين على الأقل جاوبوا فيها 3 أسئلة أو أكتر.' }));
    }
    el.appendChild(h('div', { class: 'nba-card nbq-c' }, kids));
  }
  function qRepaint() { if (!root) return; var l = root.querySelectorAll('.nba-qs'); for (var i = 0; i < l.length; i++) qFill(l[i]); }
  function qCard() {
    var el = h('div', { class: 'nba-qs', 'aria-live': 'polite' });
    if (Q.uid && me() && Q.uid !== me().uid) qClear();
    qFill(el);
    qLoad(false);
    return el;
  }
  function cssQuests() {
    if (document.getElementById('nba-css-q')) return;
    var st = document.createElement('style'); st.id = 'nba-css-q';
    st.textContent = [
      '.nba-qs[hidden]{display:none}',
      '.nbq-c{padding:14px 14px 10px;border-color:rgba(61,220,132,.22)}',
      '.nbq-h{display:flex;align-items:center;justify-content:space-between;gap:8px}',
      '.nbq-ti{display:flex;align-items:center;gap:8px;font-size:15px;font-weight:900;color:var(--ink)}.nbq-ti .nba-ico{color:var(--brand-l)}',
      '.nbq-sub{font-size:11.5px;font-weight:700;color:var(--muted);margin:2px 0 10px}',
      '.nbq-r{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid var(--line)}',
      '.nbq-i{flex:none;width:36px;height:36px;border-radius:11px;display:grid;place-items:center;background:rgba(255,255,255,.06);color:var(--slate)}.nbq-i .nba-ico{width:20px;height:20px}',
      '.nbq-r.rd .nbq-i,.nbq-r.cl .nbq-i{background:rgba(61,220,132,.16);color:var(--brand-l)}',
      '.nbq-m{flex:1;min-width:0}',
      '.nbq-t{display:flex;align-items:baseline;justify-content:space-between;gap:8px;margin-bottom:6px;line-height:1.4}.nbq-t b{font-size:13.5px;font-weight:800;color:var(--ink2)}.nbq-t em{font-style:normal;font-size:12px;font-weight:800;color:var(--muted);direction:ltr;font-variant-numeric:tabular-nums}',
      '.nbq-r.cl .nbq-t b{color:var(--muted)}.nbq-r.cl .nbq-pb i{opacity:.45}',
      '.nbq-pb{height:7px}',
      '.nbq-a{flex:none;min-width:64px;display:flex;justify-content:flex-end}',
      '.nbq-rw{font-size:12px;font-weight:800;color:var(--gold-l);background:var(--gold-pale);border:1px solid rgba(245,184,61,.28);border-radius:99px;padding:3px 9px;white-space:nowrap}',
      '.nbq-bt{border:0;border-radius:99px;min-height:40px;padding:0 16px;font:800 13px var(--f-ui,Cairo,sans-serif);color:#04140a;background:linear-gradient(180deg,#43EBA3,#22C47D);cursor:pointer;white-space:nowrap;box-shadow:0 6px 16px rgba(43,217,138,.25);transition:transform .15s,opacity .2s}',
      '.nbq-bt:active{transform:scale(.96)}.nbq-bt[disabled]{opacity:.6;cursor:default}.nbq-bt.ld{opacity:.6}',
      '.nbq-nt{font-size:11px;font-weight:600;color:var(--muted);line-height:1.6;padding-top:8px;border-top:1px solid var(--line)}',
      '.nbq-er{display:flex;align-items:center;justify-content:space-between;gap:10px;font-size:13px;font-weight:700;color:var(--ink2);padding:12px 0 6px}',
      '.nbq-sk{display:grid;gap:10px;padding:12px 0 4px}.nbq-sk i{display:block;height:36px;border-radius:11px;background:linear-gradient(90deg,rgba(255,255,255,.04),rgba(255,255,255,.09),rgba(255,255,255,.04));background-size:200% 100%;animation:nbqSh 1.2s linear infinite}',
      '@keyframes nbqSh{from{background-position:200% 0}to{background-position:-200% 0}}',
      '@media (prefers-reduced-motion:reduce){.nbq-sk i{animation:none}.nbq-bt{transition:none}.nbq-pb i{transition:none}}'
    ].join('\n');
    document.head.appendChild(st);
  }
  /* ═════════ نهاية المهام ═════════ */

  /* ═════════ إعادة المباراة + عرض السلاسل (ARENA-REMATCH) ═════════
     - دعوة الإعادة = مستند واحد arena_rematch/{كود الغرفة القديمة} (فدعوة واحدة بس لكل مباراة): by (اللي طلب) · pl (أسماء اللاعبين السابقين) · rs (الردود) · ny (عدد الموافقين) · nr (كود الغرفة الجديدة).
     - اللاعب بيرد على نفسه بس. الغرفة الجديدة بتتعمل بـ createRoom/joinRoom الأصليين (نفس قواعد arena_rooms) ومن اللاعب اللي طلب الإعادة بس، وبس لما 2+ يكونوا وافقوا (القواعد بتفرض ده والـ nr بيتكتب مرة واحدة).
       مفيش أي تدخّل في محرّك المباراة (الجدول الزمني/النقاط/الأسئلة) ولا في تسجيل النتايج: الغرفة الجديدة مباراة جديدة بكود وt0 جداد → marker جديد في arena_results، فمفيش احتساب مرتين ولا مكافآت مكررة.
     - متابعة الدعوة (RMS) مستقلة عن S: لاعب وافق وخرج للهب برضو بيتنقل للغرفة الجديدة أول ما تتعمل. ردود الأشخاص اللي ما ردّوش بتتحسب «في الانتظار» لحد انتهاء المهلة.
     للتراجع: امسح الكتلة دي + كتلة arena_rematch في firestore.rules + سطور rm* في createRoom/attach/close/leaveGame/sweep/vResults/open وسطر streakChip في boardCard. */
  var RM_WIN = 120000;   /* مهلة الرد (بتوقيت السيرفر) — لازم ≤ 5 دقايق (arRmCreate في firestore.rules) */
  var RMS = null;         /* ARENA-REMATCH state { rid, uid, ref, unsub, tm, d, ok, fc, err, busy:{p,c,r,j}, cd, jf, told, cdEl } */
  function rmRef(rid) { return window.db.collection('arena_rematch').doc(rid); }
  function rmInfo(d) {
    var ids = Object.keys(d.pl || {}).sort(function (a, b) { return (S && S.players[a] && S.players[b]) ? (S.players[a].j - S.players[b].j) : (a < b ? -1 : 1); }), rs = d.rs || {}, o = { ids: ids, y: 0, n: 0, p: 0, st: {} };
    ids.forEach(function (u) { var v = rs[u] === 'y' ? 'y' : (rs[u] === 'n' ? 'n' : 'p'); o.st[u] = v; o[v]++; });
    return o;
  }
  function rmEnd(d) { return d && d.exp && d.exp.toMillis ? d.exp.toMillis() : 0; }
  function rmExpired(d) { return !!d && srvNow() >= rmEnd(d); }
  async function rmTaken(ref) {   /* true = الدعوة اتربطت بغرفة (أو اتلغت) → createRoom يبطّل يحاول */
    try { var sn = await ref.get(); return !sn.exists || !!(sn.data() && sn.data().nr); } catch (e) { return false; }
  }
  function rmWatch() {
    if (!S || !window.db || !S.uid) return;
    if (RMS && RMS.rid === S.rid) return;
    rmStop();
    var m = RMS = { rid: S.rid, uid: S.uid, ref: rmRef(S.rid), unsub: null, tm: 0, d: null, ok: false, fc: true, err: false, busy: {}, cd: 0, jf: 0, told: 0, cdEl: null, sig: '' };
    m.unsub = m.ref.onSnapshot({ includeMetadataChanges: true }, function (sn) {
      if (RMS !== m) return;
      m.err = false; m.fc = !!sn.metadata.fromCache; m.d = sn.exists ? sn.data() : null;
      m.ok = !m.fc || !!m.d;   /* لسه ما اتأكدناش من السيرفر إن مفيش دعوة → نمنع «ريماتش» لحد ما نتأكد (بيمنع دعوتين) */
      if (m.d && !m.d.nr && !m.tm) m.tm = setInterval(rmTick, 1000);
      rmStep(); rmPaint();
    }, function (e) { if (RMS !== m) return; m.err = true; m.ok = true; console.warn('[arena] rematch', e && e.code); rmPaint(); });
  }
  function rmStop() {
    var m = RMS; RMS = null;
    if (!m) return;
    try { if (m.unsub) m.unsub(); } catch (e) { /* ignore */ }
    clearInterval(m.tm);
  }
  function rmTick() {
    var m = RMS; if (!m) return;
    if (!m.d || m.d.nr || srvNow() > rmEnd(m.d) + 20000) { clearInterval(m.tm); m.tm = 0; }
    rmStep(); rmPaint();
  }
  /* القرار الوحيد في الدورة: (1) الدعوة اتربطت بغرفة → اللي وافق ينضم · (2) أنا اللي طلبت و2+ وافقوا و(الكل رد أو المهلة خلصت) → أعمل الغرفة */
  function rmStep() {
    var m = RMS; if (!m || !m.d || m.fc || m.err) return;
    var d = m.d, info = rmInfo(d), uid = m.uid;
    if (d.nr) { if (info.st[uid] === 'y') rmJoin(d.nr, false); return; }
    if (d.by !== uid || m.busy.c || Date.now() < m.cd) return;
    var end = rmEnd(d);
    if (d.ny >= 2 && info.y >= 2 && (info.p === 0 || srvNow() >= end) && srvNow() < end + 12000) rmCreate();
  }
  async function rmCreate() {
    var m = RMS; if (!m || !m.d || m.busy.c || m.d.nr || m.d.by !== m.uid) return;
    var d = m.d; m.busy.c = true; rmPaint();
    var ok = false;
    try { ok = await createRoom({ md: d.md, sp: specKey(d.sp) || 'mix', mx: d.mx, rm: m.ref }); } catch (e) { ok = false; }
    if (RMS !== m) return;   /* نجح: attach() قفل الدعوة ونقلنا للوبي الجديد */
    m.busy.c = false; m.cd = Date.now() + 5000;
    if (!ok) toast('تعذّر إنشاء الغرفة الجديدة، هنحاول تاني…', 'err');
    rmPaint();
  }
  async function rmJoin(code, manual) {
    var m = RMS; if (!m || m.busy.j || (S && S.rid === code)) return;
    if (S && S.rid !== m.rid) { if (!m.told) { m.told = 1; toast('الغرفة الجديدة جاهزة — الكود ' + code, 'inf'); } return; }   /* لاعب في غرفة تانية: ما نشدّوش غصب */
    if (!manual && m.jf >= 3) return;
    m.busy.j = true; rmPaint();
    var ok = false;
    try { ok = await joinRoom(code); } catch (e) { ok = false; }
    if (RMS !== m) return;   /* نجح: attach() قفل الدعوة */
    m.busy.j = false;
    if (!ok) { m.jf++; if (m.jf < 3) setTimeout(function () { if (RMS === m) rmStep(); }, 2500 * m.jf); else toast('تعذّر الانضمام للغرفة الجديدة. الكود: ' + code, 'err'); }
    rmPaint();
  }
  async function rmPropose() {
    var m = RMS, sess = S;
    if (!m || !sess || sess.rid !== m.rid || !m.ok || m.d || m.busy.p || !sess.room) return;
    var r = sess.room, uid = sess.uid, ids = Object.keys(sess.players);
    if (ids.length < 2 || !sess.players[uid]) return;
    var pl = {}, rs = {}, T = firebase.firestore.Timestamp;
    ids.forEach(function (u) { var p = sess.players[u]; pl[u] = { n: String(p.n || 'لاعب').slice(0, 24), ph: (typeof p.ph === 'string' && /^https:\/\//.test(p.ph) && p.ph.length <= 300) ? p.ph : '' }; });
    rs[uid] = 'y';
    m.busy.p = true; rmPaint();
    try {
      await window.db.runTransaction(async function (tx) {   /* لو حد سبقنا (دعوتين في نفس اللحظة) المعاملة بتشوف المستند وما بتكتبش حاجة → دعوة واحدة بس */
        var sn = await tx.get(m.ref);
        if (sn.exists) return;
        tx.set(m.ref, { by: uid, t0: r.t0, md: r.md, sp: r.sp, mx: r.mx, pl: pl, rs: rs, ny: 1, nr: '', exp: T.fromMillis(srvNow() + RM_WIN), cr: SV() });
      });
    } catch (e) { console.warn('[arena] rematch propose', e && e.code); toast('تعذّر بدء الإعادة، جرّب تاني', 'err'); }
    if (RMS === m) { m.busy.p = false; rmPaint(); }
  }
  async function rmRespond(v) {
    var m = RMS; if (!m || !m.d || m.busy.r) return;
    var d = m.d, uid = m.uid, cur = d.rs && d.rs[uid];
    if (d.nr || rmExpired(d) || d.by === uid || cur === 'y' || cur === v) return;
    m.busy.r = true; rmPaint();
    var FV = firebase.firestore.FieldValue, FP = firebase.firestore.FieldPath;
    try {
      if (v === 'y') await m.ref.update(new FP('rs', uid), 'y', 'ny', FV.increment(1));   /* القبول نهائي (القواعد بتمنع الرد التاني فمفيش عدّ مرتين) */
      else await m.ref.update(new FP('rs', uid), 'n');
    } catch (e) { toast(e && e.code === 'permission-denied' ? 'انتهت مهلة الرد على الدعوة' : 'تعذّر إرسال ردك، جرّب تاني', 'err'); }
    if (RMS === m) { m.busy.r = false; rmPaint(); }
  }
  /* خروج من شاشة النتيجة/الساحة: اللي طلب الإعادة بيلغيها (ما حدش غيره يقدر يعمل الغرفة) · اللي لسه ما ردّش بيترفض · اللي وافق بيفضل مستني الغرفة */
  function rmLeave(all) {   /* all = قفل الساحة بالكامل (مفيش حد هيستنى الغرفة) */
    var m = RMS; if (!m) return;
    var d = m.d, uid = m.uid, keep = false;
    if (d && !d.nr && !rmExpired(d)) {
      try {
        if (d.by === uid) m.ref.delete().catch(function () { /* ignore */ });
        else if (!(d.rs && d.rs[uid])) m.ref.update(new firebase.firestore.FieldPath('rs', uid), 'n').catch(function () { /* ignore */ });
        else keep = d.rs[uid] === 'y';
      } catch (e) { /* ignore */ }
    }
    if (!keep || all) rmStop();
  }
  /* بننتقل لغرفة جديدة (attach): لو دي غرفة الإعادة بنقفل المتابعة، ولو كنا مضيف الغرفة القديمة بننضّفها بعد ما النتايج تتسجّل وكل اللاعبين ينضموا */
  function rmMoved(rid) {
    if (!RMS || RMS.rid === rid) return;
    var old = RMS.rid, host = S && S.rid === old && S.room && S.room.host === S.uid, fin = S && S.finP;
    rmStop();
    if (host) Promise.race([fin || Promise.resolve(), sleep(8000)]).catch(function () { /* ignore */ }).then(function () { return sleep(25000); }).then(function () { cleanup(old); });
  }
  function streakChip(uid) {   /* WIN-STREAK: سلسلة اللاعب جنب اسمه في النتيجة النهائية — بعد ما الخادم يتحقق بس */
    if (!S || !S.fin || S.fin.st !== 'ok') return null;
    var c = PC[uid], w = uid === S.uid && S.fin.d && S.fin.d.me && typeof S.fin.d.me.ws === 'number' ? S.fin.d.me.ws : (c && c.ok && c.p ? num(c.p.ws) : 0);
    return w >= 2 ? h('span', { class: 'nba-skc', title: 'سلسلة انتصارات' }, [ico(I.fire), String(w)]) : null;
  }
  function rmPaint() {
    var m = RMS, el = S && S.rmEl;
    if (!m || !el || !el.isConnected || m.rid !== S.rid) return;
    var d = m.d, uid = m.uid, info = d ? rmInfo(d) : null, exp = d ? rmExpired(d) : false;
    var sig = [m.ok ? 1 : 0, m.err ? 1 : 0, m.busy.p ? 1 : 0, m.busy.c ? 1 : 0, m.busy.r ? 1 : 0, m.busy.j ? 1 : 0, m.jf, exp ? 1 : 0, d ? [d.by, d.nr, d.ny, JSON.stringify(d.rs || {})].join('~') : '-'].join('|');
    if (el.getAttribute('data-sig') === sig) { rmCd(m, d); return; }   /* ما نعيدش بناء الكارت كل ثانية (بيضيّع الضغطات) */
    el.setAttribute('data-sig', sig); el.innerHTML = '';
    var kids = [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'إعادة المباراة' })], busy = function (t) { return [h('div', { class: 'nba-spin d', style: 'margin:0 auto 8px' }), t]; };
    m.cdEl = null;
    if (m.err && !d) kids.push(h('div', { class: 'nba-fn dim', text: 'تعذّر تحميل حالة الإعادة دلوقتي.' }));
    else if (!d) {
      kids.push(h('div', { class: 'nba-note', style: 'margin-top:0', text: 'ادعُ نفس اللاعبين لمباراة جديدة بنفس الإعدادات. الغرفة الجديدة بتتعمل لما اللاعبين يوافقوا.' }));
      kids.push(h('button', { class: 'nba-btn', disabled: !m.ok || m.busy.p || Object.keys(S.players).length < 2, onclick: rmPropose }, [m.busy.p ? h('div', { class: 'nba-spin' }) : ico(I.swap), 'ريماتش']));
    } else {
      var ids = info.ids, me0 = info.st[uid];
      var list = h('div', { class: 'nba-rml' });
      ids.forEach(function (u) {
        var pp = d.pl[u] || {}, v = info.st[u];
        list.appendChild(h('div', { class: 'nba-row' + (u === uid ? ' me' : '') }, [avatar(u, { n: pp.n, ph: pp.ph }, 36),
          h('div', { class: 'nm' }, [h('b', { text: pp.n || 'لاعب' }), h('small', { text: u === d.by ? (u === uid ? 'أنت · طلبت الإعادة' : 'طلب الإعادة') : (u === uid ? 'أنت' : '') })]),
          h('span', { class: 'nba-tag ' + (v === 'y' ? '' : (v === 'n' ? 'no' : 'g dim')), text: v === 'y' ? 'وافق' : (v === 'n' ? 'رفض' : 'في الانتظار') })]));
      });
      kids.push(list);
      if (d.nr) {
        if (m.busy.j || me0 === 'y') kids.push(h('div', { class: 'nba-fn' }, busy('الغرفة الجديدة جاهزة — جاري الانتقال…')));
        else { kids.push(h('div', { class: 'nba-fn', text: 'الغرفة الجديدة اتعملت (الكود ' + d.nr + ').' })); kids.push(h('button', { class: 'nba-btn sm', onclick: function () { rmJoin(d.nr, true); } }, ['انضم للغرفة الجديدة'])); }
        if (m.jf >= 3 && me0 === 'y') kids.push(h('button', { class: 'nba-btn sm', onclick: function () { m.jf = 0; rmJoin(d.nr, true); } }, ['حاول الانضمام تاني']));
      } else if (exp) {
        kids.push(h('div', { class: 'nba-fn dim', text: info.y < 2 ? 'انتهت مهلة الإعادة — ما حدش وافق في الوقت.' : (d.by === uid && m.busy.c ? 'جاري إنشاء الغرفة…' : 'انتهت مهلة الإعادة.') }));
      } else {
        if (info.p === 0 && info.y < 2) kids.push(h('div', { class: 'nba-fn dim', text: 'كل اللاعبين رفضوا الإعادة.' }));
        else { var cd = h('span', { class: 'nba-tag g', text: '' }); m.cdEl = cd; kids.push(h('div', { class: 'nba-fn' }, ['الدعوة بتنتهي بعد ', cd])); rmCd(m, d); }
        if (uid !== d.by && (me0 === 'p' || me0 === 'n')) kids.push(h('div', { class: 'nba-seg' }, [
          h('button', { class: 'nba-btn', disabled: m.busy.r, onclick: function () { rmRespond('y'); } }, [m.busy.r ? h('div', { class: 'nba-spin' }) : ico(I.check), 'قبول']),
          me0 === 'p' ? h('button', { class: 'nba-btn sec', disabled: m.busy.r, onclick: function () { rmRespond('n'); } }, [ico(I.x), 'رفض']) : null]));
        else if (me0 === 'y' && uid !== d.by) kids.push(h('div', { class: 'nba-fn dim', text: 'وافقت — في انتظار باقي اللاعبين.' }));
        if (uid === d.by) {
          kids.push(h('button', { class: 'nba-btn', disabled: info.y < 2 || m.busy.c, onclick: rmCreate }, [m.busy.c ? h('div', { class: 'nba-spin' }) : ico(I.bolt), info.p > 0 ? 'ابدأ بمن وافق (' + info.y + ')' : 'إنشاء الغرفة']));
          if (info.y < 2) kids.push(h('div', { class: 'nbx-why', text: 'لازم لاعب واحد على الأقل يوافق معاك.' }));
        }
      }
    }
    el.appendChild(h('div', { class: 'nba-card nba-rm' }, kids));
  }
  function rmCd(m, d) { if (m && m.cdEl && d) m.cdEl.textContent = Math.max(0, Math.ceil((rmEnd(d) - srvNow()) / 1000)) + ' ث'; }
  function cssRM() {
    if (document.getElementById('nba-css-rm')) return;
    var st = document.createElement('style'); st.id = 'nba-css-rm';
    st.textContent = [
      '.nba-rm .nba-rml{margin-bottom:10px}.nba-rm .nba-row{min-height:52px}',
      '.nba-tag.no{background:rgba(255,92,108,.12);color:#ff9aa4;border-color:rgba(255,92,108,.3)}.nba-tag.dim{opacity:.75}',
      '.nba-rm .nba-btn{margin-top:4px}.nba-rm .nba-seg .nba-btn{margin-top:0}.nba-rm .nba-fn{padding:6px 4px 8px}',
      '.nba-skl{margin-top:8px;font-size:12.5px;font-weight:800;color:var(--gold-l)}',
      '.nba-skc{display:inline-flex;align-items:center;gap:2px;margin-inline-start:6px;font-size:10.5px;font-weight:800;color:var(--gold-l);vertical-align:1px}.nba-skc .nba-ico{width:12px;height:12px}'
    ].join('\n');
    document.head.appendChild(st);
  }
  /* ═════════ نهاية إعادة المباراة ═════════ */

  /* ───────── إنشاء / انضمام ───────── */
  async function createRoom(o) {
    var u = me(), tries = 0, last = null;
    V.busy = true; V.err = ''; render();
    while (tries++ < 5) {
      var code = genCode(), rr = rref(code), b = window.db.batch();
      b.set(rr, { host: u.uid, st: 'lobby', md: o.md, sp: specLabel(o.sp), mx: o.mx, pc: 1, na: o.md === 't' ? 1 : 0, nb: 0, qr: false, cr: SV(), exp: firebase.firestore.Timestamp.fromMillis(Date.now() + 3 * 3600000) });
      b.set(rr.collection('pl').doc(u.uid), { n: myName(), ph: myPhoto(), tm: 0, ls: SV(), j: SV() });
      if (o.rm) b.update(o.rm, { nr: code });   /* ARENA-REMATCH: ربط الغرفة بالدعوة في نفس الـ batch (nr بيتكتب مرة واحدة بس — القواعد) */
      try { await b.commit(); V.busy = false; attach(code); return true; } catch (e) {
        last = e; if (!e || e.code !== 'permission-denied') break;   /* permission-denied هنا = الكود متكرر (أو ساعة الجهاز غلط) → كود جديد */
        if (o.rm && await rmTaken(o.rm)) break;                       /* ARENA-REMATCH: حد سبقنا وعمل الغرفة (أو الدعوة اتلغت) → مفيش داعي نكرّر */
      }
    }
    V.busy = false; V.err = 'تعذّر إنشاء الغرفة. اتأكد من الاتصال ومن ضبط تاريخ ووقت جهازك وحاول تاني.'; render();
    if (last) console.warn('[arena] create', last);
    return false;
  }
  async function joinRoom(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[A-HJKMNP-Z2-9]{6}$/.test(code)) { V.err = 'الكود لازم يكون 6 حروف/أرقام.'; render(); return false; }
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
      V.busy = false; attach(code); return true;
    } catch (e) {
      V.busy = false; V.view = 'hub';
      var m = { nf: 'مفيش غرفة بالكود ده.', started: 'اللعبة في الغرفة دي بدأت بالفعل.', expired: 'الغرفة دي انتهت صلاحيتها.', full: 'الغرفة اكتملت (6 لاعبين كحد أقصى).' }[e && e.k];
      V.err = m || 'تعذّر الانضمام. اتأكد من الكود والاتصال وحاول تاني.';
      if (!m) console.warn('[arena] join', e);
      render(); return false;
    }
  }

  /* ───────── الاشتراك في الغرفة (مستمعين اتنين بس: الغرفة + اللاعبين) ───────── */
  function attach(rid) {
    rmMoved(rid);   /* ARENA-REMATCH: لو رايحين للغرفة الجديدة بنقفل متابعة الدعوة (وتنضيف الغرفة القديمة لو إحنا مضيفها) قبل ما detach() يمسح S */
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
      loadRoomProfs();
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
      try {   /* ARENA-REMATCH: دعوات إعادة قديمة بتاعتنا (الدعوة بتفضل ≥ دقيقة بعد انتهاء مهلتها علشان آخر لاعب يلحق ينضم) */
        var rm = await window.db.collection('arena_rematch').where('by', '==', u.uid).limit(5).get();
        rm.forEach(function (d) { var x = d.data(); if (x.exp && x.exp.toMillis() + 60000 < now && !(RMS && RMS.rid === d.id)) jobs.push(d.ref.delete().catch(function () { /* ignore */ })); });
      } catch (e) { /* ignore */ }
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
        lastErr = 'السيرفر مشغول دلوقتي، جاري إعادة المحاولة…';
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
    MUS.sync();
    var key = viewKey(), w = root.firstChild;
    if (key === V.key && V.live) { V.live(); return; }
    var always = key === 'lobby';
    if (key === V.key && !always) return;
    var base = key.split(':', 2).join(':'), enter = base !== V.base;
    V.key = key; V.live = null; V.base = base;
    var y = root.scrollTop;
    w.className = 'nba-wrap' + (enter ? ' nba-enter' : '');
    root.classList.toggle('nba-lb', !S || !S.room || S.room.st === 'lobby');
    w.innerHTML = '';
    if (!S) { (V.view === 'create' ? vCreate : V.view === 'join' ? vJoin : vHub2)(w); }
    else if (!S.room) w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري تحميل الغرفة…']));
    else if (S.room.st === 'lobby') vLobby2(w);
    else vGame(w);
    if (always) root.scrollTop = y;
  }
  function errBox() { return V.err ? h('div', { class: 'nba-err', text: V.err }) : document.createDocumentFragment(); }

  function vHub(w) {
    var saved = ls('nbArenaRoom');
    w.appendChild(top());
    w.appendChild(h('div', { class: 'nba-card nba-hero' }, [h('div', { class: 'nba-hb' }, [ico(I.bolt)]), h('h2', { text: 'تحدّى أصحابك في الزراعة' }), h('p', { text: 'غرف خاصة من 2 لـ 6 لاعبين، 10 أسئلة بالذكاء الاصطناعي في تخصصك، ونقاط لحظية. اللي بيجاوب أسرع بياخد أكتر.' }), h('div', { class: 'nba-meta' }, [h('span', { class: 'nba-tag', text: '2–6 لاعبين' }), h('span', { class: 'nba-tag g', text: '10 أسئلة' }), h('span', { class: 'nba-tag', text: 'ذكاء اصطناعي' })])]));
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
  /* ARENA-LOBBY-X: شاشة «غرفة جديدة» بنفس لغة اللوبي — نفس الحالة (V.md / V.mx / V.sp) ونفس createRoom بالظبط، العرض بس اللي اتغيّر */
  function vCreate(w) {
    var o = V, teams = o.md === 't', mxs = teams ? [2, 4, 6] : [2, 3, 4, 5, 6];
    if (mxs.indexOf(o.mx) === -1) o.mx = teams ? 4 : 4;
    w.classList.add('nbz', 'nbz-cr');
    var up = function () { V.key = ''; render(); };
    function sec(t, first) { return h('div', { class: 'nbz-st' + (first ? ' f' : '') }, [h('span', { text: t })]); }
    function pk(k, ttl, sub, ic) {
      var on = o.md === k;
      return h('button', { class: 'nbz-pk ' + k + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { o.md = k; up(); } }, [
        h('span', { class: 'gm' }, [ico(ic)]), h('span', { class: 'tx' }, [h('b', { text: ttl }), h('em', { text: sub })])]);
    }
    var lbl = teams ? 'عدد اللاعبين (فريقين متساويين)' : 'الحد الأقصى للاعبين';
    w.appendChild(h('div', { class: 'nbz-stage cr' }, [h('div', { class: 'nbz-stars', 'aria-hidden': 'true' }), top('غرفة جديدة', function () { V = { view: 'hub' }; render(); }), nbzVista()]));
    w.appendChild(errBox());
    w.appendChild(sec('نمط اللعب', true));
    w.appendChild(h('div', { class: 'nbz-mds' }, [pk('s', 'فردي', 'كل واحد لنفسه', I.crown), pk('t', 'فريقين', 'فريقين متساويين', I.users)]));
    w.appendChild(sec(lbl));
    w.appendChild(h('div', { class: 'nbz-seats', role: 'group', 'aria-label': lbl }, mxs.map(function (n) {
      var on = o.mx === n;
      return h('button', { class: 'nbz-sn' + (on ? ' on' : ''), 'aria-pressed': on ? 'true' : 'false', onclick: function () { o.mx = n; up(); } }, [String(n)]);
    })));
    w.appendChild(sec('التخصص'));
    w.appendChild(h('div', { class: 'nbz-sp' }, SPECS.map(function (s) {
      var on = o.sp === s[0];
      return h('button', { class: 'nbz-sc' + (on ? ' on' : ''), style: '--h:' + (NBZ_HUE[s[0]] || 150), 'aria-pressed': on ? 'true' : 'false', onclick: function () { o.sp = s[0]; up(); } }, [
        h('span', { class: 'nbz-em' }, [ico(SPI[s[0]] || SPI.mix)]), h('span', { class: 'nbz-sx' }, [h('small', { text: NBZ_CL[s[0]] || '' }), h('b', { text: s[1] })])]);
    })));
    w.appendChild(h('div', { class: 'nbz-bar' }, [
      h('div', { class: 'nbz-sum', text: (teams ? 'فريقين' : 'فردي') + ' · ' + o.mx + ' لاعبين · ' + specLabel(o.sp) }),
      h('button', { class: 'nbz-play go', disabled: !!o.busy, onclick: function () { createRoom({ md: o.md, mx: o.mx, sp: o.sp }); } }, [
        h('span', { class: 'gl', 'aria-hidden': 'true' }), h('span', { class: 'ic' }, [o.busy ? h('div', { class: 'nba-spin d' }) : ico(I.bolt)]),
        h('span', { class: 'tx' }, [h('b', { text: o.busy ? 'جاري الإنشاء…' : 'إنشاء الغرفة' }), h('small', { text: 'CREATE ROOM' })]),
        h('span', { class: 'ar' }, [ico('<path d="M15 5l-7 7 7 7"/>')])])]));
  }


  function playerRow(uid, p, extra, sz) {
    var onl = p.ls && (srvNow() - p.ls) < STALE, r = S.room, fresh = !S.seen[uid], n = S.ln++;
    S.seen[uid] = 1;
    if (fresh && S.seenInit && uid !== S.uid) SFX.play('pop');
    var role = uid === S.uid ? 'أنت' : (r.host === uid ? 'مضيف' : (onl ? 'متصل' : 'غير متصل'));
    return h('div', { class: 'nba-row' + (uid === S.uid ? ' me' : '') + (fresh ? ' in' : ''), style: fresh ? '--dl:' + (n * 70) + 'ms' : '', role: 'button', tabindex: '0', 'aria-label': 'الملف الشخصي: ' + p.n,
      onclick: function (e) { if (!(e.target.closest && e.target.closest('button'))) openProfile(uid, p); },
      onkeydown: function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openProfile(uid, p); } } }, [
      h('div', { class: 'nba-avw' }, [avatar(uid, p, sz || 42), r.host === uid ? h('span', { class: 'nba-hc', title: 'المضيف' }, [ico(I.crown)]) : null, h('span', { class: 'nba-dot' + (onl ? ' on' : ''), title: onl ? 'متصل' : 'غير متصل' })]),
      h('div', { class: 'nm' }, [h('div', { class: 'nba-nl' }, [h('b', { text: p.n }), titleChip(uid)]), h('small', { text: role })]), extra || null]);
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
      w.appendChild(h('button', { class: 'nba-btn gold', disabled: !canStart, onclick: startGame }, [V.busy ? h('div', { class: 'nba-spin' }) : ico(I.bolt), V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة بالذكاء الاصطناعي… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة')]));
      if (r.pc < 2) w.appendChild(h('div', { class: 'nba-note', text: 'محتاج لاعب واحد على الأقل. ابعت الكود لصاحبك.' }));
    } else {
      w.appendChild(h('div', { class: 'nba-note' }, [r.qr ? 'الأسئلة جاهزة — في انتظار المضيف يبدأ اللعبة…' : 'في انتظار المضيف يبدأ اللعبة…']));
      if (hostStale) w.appendChild(h('button', { class: 'nba-btn sec', onclick: function () { takeHost(S.uid); } }, [ico(I.crown), 'المضيف مش متصل — تولّى الإدارة']));
    }
  }

  /* ───────── شاشة الساحة (v4 — لوبي ألعاب) ───────── */
  /* ═════════ ARENA-LOBBY-X: لوبي الساحة بشكل لعبة (عرض فقط) ═════════
     - نفس الدوال ونفس الحالة بالظبط (V / S / joinRoom / openProfile / qCard / ls('nbArenaRoom') / handlers التخصصات) — اللي اتغيّر الـ DOM والـ CSS بس. مفيش قراءة/كتابة جديدة غير loadProf (الموجودة أصلًا، بكاش 90ث) لعرض المستوى والـ XP.
     - المشهد SVG/CSS مولَّد بالكود (بدون صور ولا شبكة ولا مكتبات). كل الكلاسات nbz-* ومقصورة على .nbz فمفيش أي تأثير على شاشات الغرفة/السؤال/النتيجة.
     للتراجع: رجّع vHub2 القديمة من الـ git وامسح الكتلة دي + سطر cssArena() في open(). */
  var NBZ_HUE = { pp: 152, path: 166, ent: 92, hort: 126, bio: 182, soil: 38, food: 46, gen: 204, crop: 74, irr: 192, anim: 26, eco: 50, mix: 44 };
  var NBZ_CL = { pp: 'الحارس', path: 'الطبيب', ent: 'الصيّاد', hort: 'البستاني', bio: 'الكيميائي', soil: 'حارس الأرض', food: 'الطاهي', gen: 'المُهجّن', crop: 'الحصّاد', irr: 'سيّد المياه', anim: 'الراعي', eco: 'المخطِّط', mix: 'المتجوّل' };
  var NBZ_HILL = '<svg viewBox="0 0 160 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 70V40C20 28 38 34 58 42S104 30 124 34 150 42 160 38V70Z" fill="#000" opacity=".26"/><path d="M0 70V54C26 46 50 52 76 56S128 48 160 52V70Z" fill="#000" opacity=".4"/></svg>';
  function nbzRaw(tag, cls, html) { var e = document.createElement(tag); e.className = cls; e.innerHTML = html; e.setAttribute('aria-hidden', 'true'); return e; }
  /* أشجار طبقات (3 مثلثات لكل شجرة) بتوزيع ثابت — بدون Math.random علشان الشكل يبقى ثابت */
  function nbzTrees(base, n, h0, h1, fill, op, skip) {
    var d = '', i, k, cx, th, tw, w2, b2, a2, sd = base * 7 + n;
    function r() { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }
    for (i = 0; i < n; i++) {
      cx = -8 + (i + 0.15 + r() * 0.7) * (416 / n); th = h0 + r() * (h1 - h0); tw = th * (0.36 + r() * 0.1);
      if (skip && Math.abs(cx - 200) < skip) continue;
      for (k = 0; k < 3; k++) {
        w2 = tw * (1 - k * 0.24); b2 = base - th * k * 0.27; a2 = base - th * (0.56 + k * 0.22);
        d += 'M' + (cx - w2 / 2).toFixed(1) + ' ' + b2.toFixed(1) + 'L' + cx.toFixed(1) + ' ' + a2.toFixed(1) + 'L' + (cx + w2 / 2).toFixed(1) + ' ' + b2.toFixed(1) + 'Z';
      }
    }
    return '<path d="' + d + '" fill="' + fill + '" opacity="' + op + '"/>';
  }
  function nbzLeaves(m) {
    var g = '<path d="M-6 300C0 262 16 236 46 216C46 246 36 276 22 300Z"/><path d="M8 300C20 270 44 252 78 246C68 270 52 288 40 300Z"/><path d="M-6 300C-4 246 6 206 30 168C42 210 40 260 28 300Z"/><path d="M30 300C40 280 62 268 92 268C80 284 64 296 52 300Z"/>';
    return '<g fill="#030A06"' + (m ? ' transform="translate(400 0) scale(-1 1)"' : '') + '>' + g + '</g>';
  }
  /* المشهد: بوابة حجرية قديمة بحرف N متوهّج وسط غابة ليلية — طبقات (سما · جبال · غابة بعيدة · غابة قريبة · البوابة · أرض · أوراق أمامية) */
  function nbzVista() {
    var svg = '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false"><defs>'
      + '<radialGradient id="nbzHalo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#FFE9B8" stop-opacity=".30"/><stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/></radialGradient>'
      + '<linearGradient id="nbzRay" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#2BD98A" stop-opacity=".24"/><stop offset="1" stop-color="#2BD98A" stop-opacity="0"/></linearGradient>'
      + '<radialGradient id="nbzDoor" cx=".5" cy=".66" r=".72"><stop offset="0" stop-color="#A8FFD6"/><stop offset=".38" stop-color="#2BD98A"/><stop offset="1" stop-color="#0D5C38"/></radialGradient>'
      + '<linearGradient id="nbzStone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#23452F"/><stop offset=".55" stop-color="#112219"/><stop offset="1" stop-color="#09140E"/></linearGradient>'
      + '<linearGradient id="nbzFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1B4B34"/><stop offset="1" stop-color="#0A1D14"/></linearGradient>'
      + '<mask id="nbzMk"><rect width="400" height="300" fill="#fff"/><circle cx="328" cy="118" r="16" fill="#000"/></mask></defs>'
      + '<circle cx="318" cy="124" r="62" fill="url(#nbzHalo)"/><circle cx="318" cy="124" r="16" fill="#F3E6C4" opacity=".92" mask="url(#nbzMk)"/>'
      + '<path class="nbz-ry" d="M176 252L224 252L336 -40L64 -40Z" fill="url(#nbzRay)"/><path class="nbz-ry b" d="M190 252L210 252L250 -40L150 -40Z" fill="url(#nbzRay)"/>'
      + '<path d="M0 190C40 158 82 166 124 186C166 206 214 150 264 164C312 178 352 156 400 176V300H0Z" fill="url(#nbzFar)"/>'
      + nbzTrees(206, 30, 24, 50, '#0B241A', 0.95, 0)
      + '<path d="M0 232C60 214 120 222 168 236C200 244 232 244 266 234C320 218 360 222 400 236V300H0Z" fill="#08190F"/>'
      + nbzTrees(246, 15, 40, 74, '#06130C', 1, 78)
      + '<g class="nbz-pt"><ellipse cx="200" cy="268" rx="126" ry="13" fill="#2BD98A" opacity=".2"/>'
      + '<path d="M146 270V176Q146 120 200 120Q254 120 254 176V270Z" fill="url(#nbzStone)"/>'
      + '<path d="M146 270V176Q146 120 200 120Q254 120 254 176V270" fill="none" stroke="#2BD98A" stroke-opacity=".26" stroke-width="1.2"/>'
      + '<path d="M170 270V186Q170 148 200 148Q230 148 230 186V270Z" fill="url(#nbzDoor)"/>'
      + '<ellipse class="nbz-br" cx="200" cy="236" rx="22" ry="40" fill="#D4FFE9" opacity=".22"/>'
      + '<path d="M170 270V186Q170 148 200 148Q230 148 230 186V270" fill="none" stroke="#F2B84B" stroke-opacity=".62" stroke-width="1.2"/>'
      + '<g transform="translate(168 181) scale(1.6)"><path d="M12 30V10L28 25V10" fill="none" stroke="#06231A" stroke-width="4.5"/><circle cx="28" cy="31.5" r="2.6" fill="#06231A"/></g>'
      + '<g fill="#F2B84B"><circle class="nbz-rn" cx="158" cy="152" r="1.9"/><circle class="nbz-rn" style="animation-delay:.8s" cx="242" cy="152" r="1.9"/><circle class="nbz-rn" style="animation-delay:1.6s" cx="154" cy="206" r="1.9"/><circle class="nbz-rn" style="animation-delay:2.2s" cx="246" cy="206" r="1.9"/></g>'
      + '<path d="M158 134C150 152 156 168 150 188" fill="none" stroke="#2A7A50" stroke-width="2" stroke-linecap="round" opacity=".85"/><circle cx="150" cy="190" r="2.6" fill="#4FD39A"/>'
      + '<path d="M240 138C250 158 244 176 252 198" fill="none" stroke="#2A7A50" stroke-width="2" stroke-linecap="round" opacity=".85"/><circle cx="252" cy="200" r="2.6" fill="#4FD39A"/></g>'
      + '<path d="M0 300V264C30 252 70 260 108 272C150 284 250 284 292 272C330 260 370 252 400 264V300Z" fill="#040C07"/>'
      + nbzLeaves(0) + nbzLeaves(1) + '</svg>';
    var v = h('div', { class: 'nbz-vista', 'aria-hidden': 'true' });
    v.innerHTML = svg;
    var ff = h('div', { class: 'nbz-ff' }), fx = [[12, 58, 3, 9, 0, 14], [24, 76, 2, 11, 2.2, -10], [36, 48, 3, 8, 4.1, 12], [46, 70, 2, 12, 1.1, -8], [58, 54, 3, 10, 3.3, 10], [68, 78, 2, 9, 5.2, -14], [78, 46, 3, 13, 0.6, 8], [88, 66, 2, 10, 2.9, -12], [30, 86, 2, 12, 6.1, 10], [64, 90, 3, 11, 4.6, -9]];
    fx.forEach(function (f, n) { ff.appendChild(h('i', { class: n % 3 === 0 ? 'g' : '', style: '--x:' + f[0] + '%;--y:' + f[1] + '%;--s:' + f[2] + 'px;--d:' + f[3] + 's;--dl:' + f[4] + 's;--dx:' + f[5] + 'px' })); });
    v.appendChild(ff); v.appendChild(h('div', { class: 'nbz-mist' }));
    return v;
  }
  function nbzParallax(st, vista) {
    if (RM() || !root) return;
    var raf = 0;
    function on() {
      if (!st.isConnected) { root.removeEventListener('scroll', on); return; }
      if (raf) return;
      raf = requestAnimationFrame(function () { raf = 0; var y = Math.max(0, Math.min(root.scrollTop, 520)); vista.style.transform = 'translate3d(0,' + (y * 0.16).toFixed(1) + 'px,0)'; });
    }
    root.addEventListener('scroll', on, { passive: true });
  }
  function nbzRing(pc) { var C = 2 * Math.PI * 21; return '<svg viewBox="0 0 48 48" aria-hidden="true"><circle class="t" cx="24" cy="24" r="21"/><circle class="v" cx="24" cy="24" r="21" data-c="' + C.toFixed(2) + '" style="stroke-dasharray:0 ' + C.toFixed(2) + '"/></svg>'; }
  /* المستوى/الـ XP من نفس مصدر شاشة الملف الشخصي (PC + NBXP.lv) — لو مش متاح بيفضل «جاهز للتحدي؟» */
  function nbzLvl(uid) {
    var c = PC[uid], x = nbxp();
    if (!c || !x || typeof c.xp !== 'number') return null;
    var L = x.lv(c.xp), span = L.hi ? L.hi - L.lo : 1;
    return { i: L.i + 1, n: L.n, xp: c.xp, hi: L.hi || 0, pc: L.hi ? Math.max(0, Math.min(100, Math.round((c.xp - L.lo) / span * 100))) : 100 };
  }
  function vHub2(w) {
    var saved = ls('nbArenaRoom'), u = me(), uid = u ? u.uid : 'x', nm = ((u && (u.displayName || '')) || '').trim() || 'لاعب';
    w.classList.add('nba-hubw', 'nbz');
    var go = function (md) { V = { view: 'create', md: md, mx: 4, sp: 'pp' }; render(); };
    function sec(t, hint) { return h('div', { class: 'nbz-st' }, [h('span', { text: t }), hint ? h('small', { text: hint }) : null]); }
    function stat(a, b, c) { return h('span', { class: c || '' }, [h('b', { text: a }), b]); }
    /* ── لوحة اللاعب: صورة بحلقة تقدّم XP + المستوى + اللقب ── */
    var ringBox = h('span', { class: 'nbz-rg' }); ringBox.innerHTML = nbzRing(0);
    var lvB = h('span', { class: 'nbz-lv', hidden: true });
    var rk = h('small', { class: 'nbz-rk', text: 'جاهز للتحدي؟' }), xpf = h('i'), xpt = h('span');
    var xpb = h('div', { class: 'nbz-xpb' }, [h('div', { class: 'bar', role: 'progressbar', 'aria-label': 'التقدّم نحو المستوى التالي', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, [xpf]), xpt]);
    var pl = h('div', { class: 'nbz-pl' }, [
      h('div', { class: 'nbz-av' }, [ringBox, avatar(uid, { n: nm, ph: u && u.photoURL }, 50), lvB]),
      h('div', { class: 'nbz-pt' }, [h('div', { class: 'nbz-nm', text: 'أهلاً ' + nm.split(' ')[0] }), rk, xpb]),
      u ? h('button', { class: 'nba-pfbtn', 'aria-label': 'ملفي الشخصي', onclick: function () { openProfile(u.uid, { n: myName(), ph: myPhoto() }); } }, [ico(PIc.user), 'ملفي']) : null]);
    function paint() {
      if (!pl.isConnected) return;
      var L = nbzLvl(uid); if (!L) return;
      pl.classList.add('on'); lvB.hidden = false; lvB.textContent = 'LV ' + L.i;
      rk.textContent = 'المستوى ' + L.i + ' — ' + L.n;
      xpf.style.width = L.pc + '%'; xpt.textContent = L.hi ? L.xp + ' / ' + L.hi + ' XP' : L.xp + ' XP · أعلى مستوى';
      xpb.firstChild.setAttribute('aria-valuenow', String(L.pc));
      var v = ringBox.querySelector('.v');
      if (v) requestAnimationFrame(function () { v.style.strokeDasharray = (+v.getAttribute('data-c') * L.pc / 100).toFixed(2) + ' ' + v.getAttribute('data-c'); });
    }
    if (u) { paint(); loadProf(uid, true).then(paint, function () { /* ignore */ }); }
    /* ── المشهد + العنوان + زر العب الآن (نفس إجراء «إنشاء غرفة جديدة» القديم بالظبط) ── */
    var vista = nbzVista();
    var hero = h('div', { class: 'nbz-hero' }, [
      h('h2', { class: 'nbz-h' }, ['تحدّى أصحابك', h('br'), 'في ', h('em', { text: 'الزراعة' })]),
      h('p', { class: 'nbz-p', text: '10 أسئلة في تخصصك، نقاط لحظية، واللي بيجاوب أسرع بياخد أكتر.' }),
      h('button', { class: 'nbz-play', 'aria-label': 'العب الآن — إنشاء غرفة جديدة', onclick: function () { go('s'); } }, [
        h('span', { class: 'gl', 'aria-hidden': 'true' }), h('span', { class: 'ic' }, [ico(I.bolt)]),
        h('span', { class: 'tx' }, [h('b', { text: 'العب الآن' }), h('small', { text: 'PLAY NOW' })]),
        h('span', { class: 'ar' }, [ico('<path d="M15 5l-7 7 7 7"/>')])]),
      h('div', { class: 'nbz-info' }, [stat('2–6', 'لاعبين'), h('i'), stat('10', 'أسئلة'), h('i'), stat('LIVE', 'نقاط لحظية', 'lv')])]);
    var stage = h('div', { class: 'nbz-stage' }, [h('div', { class: 'nbz-stars', 'aria-hidden': 'true' }), top(), pl, vista, hero]);
    w.appendChild(stage); nbzParallax(stage, vista);
    if (saved) w.appendChild(h('div', { class: 'nbz-rs' }, [
      h('div', { class: 'tt' }, [h('small', { text: 'عندك غرفة شغّالة' }), h('b', { text: saved })]),
      h('button', { class: 'nbz-b', onclick: function () { joinRoom(saved); } }, ['ارجع للغرفة']),
      h('button', { class: 'nbz-gh', onclick: function () { ls('nbArenaRoom', null); V.key = ''; render(); } }, ['تجاهل'])]));
    /* ── أنماط اللعب: نفس حالة إنشاء الغرفة (md: s فردي / t فريقين) ── */
    function mode(md, eb, ttl, sub, chip, ic, cls) {
      return h('button', { class: 'nbz-m ' + cls, onclick: function () { go(md); } }, [nbzRaw('span', 'art', NBZ_HILL), h('span', { class: 'gm' }, [ico(ic)]),
        h('span', { class: 'tx' }, [h('small', { text: eb }), h('b', { text: ttl }), h('em', { text: sub }), h('span', { class: 'ch', text: chip })])]);
    }
    w.appendChild(sec('اختار طريقة اللعب'));
    w.appendChild(h('div', { class: 'nbz-modes' }, [
      mode('s', 'SOLO', 'فردي', 'كل واحد لنفسه، والأسرع ياخد أكتر', '2–6 لاعبين', I.crown, 'solo'),
      mode('t', 'TEAMS', 'فريقين', 'فريقين متساويين بيتنافسوا على النقاط', '2 · 4 · 6 لاعبين', I.users, 'team')]));
    w.appendChild(qCard());   /* DAILY-QUESTS */
    /* ── التخصصات ككلاسات: نفس handler الاختيار القديم حرفيًا ── */
    w.appendChild(sec('اختار تخصص التحدي', 'اسحب للمزيد ‹'));
    w.appendChild(h('div', { class: 'nbz-cls' }, SPECS.map(function (s, n) {
      return h('button', { class: 'nbz-c', style: '--n:' + n + ';--h:' + (NBZ_HUE[s[0]] || 150), 'aria-pressed': 'false', onclick: function (e) {
        var b = e.currentTarget; if (b.parentNode.querySelector('.sel')) return;
        var go2 = function () { if (!root || S || V.view !== 'hub') return; V = { view: 'create', md: 's', mx: 4, sp: s[0] }; render(); };
        b.classList.add('sel'); b.setAttribute('aria-pressed', 'true');
        if (RM()) go2(); else setTimeout(go2, 160);
      } }, [h('i', { text: (n < 9 ? '0' : '') + (n + 1) }), h('span', { class: 'nbz-em' }, [ico(SPI[s[0]] || SPI.mix)]), h('small', { class: 'nbz-ep', text: NBZ_CL[s[0]] || '' }), h('span', { class: 'nbz-cn', text: s[1] })]);
    })));
    /* ── الانضمام بكود ── */
    var jb = h('button', { disabled: String(V.code || '').trim().length < 6, onclick: function () { joinRoom($('#nba-code').value); } }, ['انضمام']);
    var inp = h('input', { id: 'nba-code', maxlength: '6', placeholder: 'ABC234', 'aria-label': 'كود الغرفة', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: V.code || '',
      oninput: function (e) { jb.disabled = e.target.value.trim().length < 6; },
      onkeydown: function (e) { if (e.key === 'Enter') joinRoom(e.target.value); } });
    w.appendChild(h('div', { class: 'nbz-gate' }, [h('div', { class: 'nbz-gl', text: 'عندك كود من صاحبك؟' }), h('div', { class: 'nbz-jg' + (V.err ? ' bad' : '') }, [inp, jb]),
      V.err ? h('div', { class: 'nbx-er', role: 'alert', text: V.err }) : h('div', { class: 'nbx-fh', text: 'الكود 6 خانات (حروف وأرقام). الزر يتفعّل لما تكمله.' })]));
  }

  /* ───────── شاشة الغرفة (v3) ───────── */
  function vLobby2(w) {
    var r = S.room, uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), isHost = r.host === S.uid, teams = r.md === 't';
    var hostP = S.players[r.host], hostStale = !hostP || !hostP.ls || (srvNow() - hostP.ls) > STALE;
    var balanced = !teams || (r.pc % 2 === 0 && r.na === r.nb), canStart = isHost && r.pc >= 2 && balanced && !V.busy;
    S.ln = 0;
    w.classList.add('nba-lobw', 'nbz', 'nbz-cr', 'nbz-lb');   /* ARENA-LOBBY-X: نفس لغة اللوبي */
    w.appendChild(h('div', { class: 'nbz-stage cr' }, [h('div', { class: 'nbz-stars', 'aria-hidden': 'true' }), top('الغرفة', leaveLobby), nbzVista()]));
    function flash(b, label) { var tn = b.lastChild, old = tn.nodeValue; tn.nodeValue = label; setTimeout(function () { tn.nodeValue = old; }, 1600); }
    var code = h('button', { class: 'nbx-code', 'data-nosnd': '1', 'aria-label': 'نسخ كود الغرفة ' + S.rid, onclick: function (e) { copy(S.rid, 'اتنسخ الكود'); var b = e.currentTarget; b.classList.remove('cp'); void b.offsetWidth; b.classList.add('cp'); SFX.play('pop'); } },
      [h('span', { class: 'nbx-cv', text: S.rid })]);
    S.codeAnim = true;
    w.appendChild(h('div', { class: 'nbx-tk' }, [
      h('div', { class: 'a' }, [h('div', { class: 'l' }, [h('span', { text: 'كود الغرفة' }), h('span', { text: 'اضغط للنسخ' })]), code]),
      h('div', { class: 'p' }),
      h('div', { class: 'b' }, [
        h('div', { class: 'nbx-meta' }, [h('span', { text: r.sp }), h('i', { text: '·' }), h('span', { text: teams ? 'فريقين' : 'فردي' }), h('i', { text: '·' }), h('span', { text: '10 أسئلة' })]),
        h('div', { class: 'nba-seg' }, [
          h('button', { class: 'nba-btn sec sm', onclick: function (e) { copy(S.rid, 'اتنسخ الكود'); flash(e.currentTarget, 'تم النسخ ✓'); } }, [ico(I.copy), 'نسخ الكود']),
          h('button', { class: 'nba-btn sm', onclick: share }, [ico(I.share), 'دعوة صديق'])])])]));
    if (V.err) w.appendChild(errBox());
    var meP = S.players[S.uid];
    function pr(u, extra, sz) {
      var el = playerRow(u, S.players[u], extra, sz);
      if (r.host === u) { el.classList.add('host'); var sm = el.querySelector('.nm small'); if (sm) sm.textContent = (u === S.uid ? 'أنت · ' : '') + 'مضيف الغرفة'; }
      return el;
    }
    if (teams) {
      var per = Math.max(1, Math.round(r.mx / 2));
      var col = function (t) {
        var mem = uids.filter(function (u) { return (S.players[u].tm ? 1 : 0) === t; }), kids = mem.map(function (u) { return pr(u, null, 36); });
        for (var k = mem.length; k < per; k++) kids.push(emptySlot());
        return h('div', { class: 'nba-team ' + (t ? 'b' : 'a') }, [h('h4', {}, [h('span', { text: t ? 'الفريق ب' : 'الفريق أ' }), h('span', { class: 'nba-tag' + (t ? ' g' : ''), text: (t ? r.nb : r.na) + ' / ' + per })])].concat(kids));
      };
      w.appendChild(h('div', { class: 'nba-card tight' }, [h('div', { class: 'nba-teams' }, [col(0), col(1), h('div', { class: 'nba-vs', text: 'VS' })])]));
      if (meP) w.appendChild(h('button', { class: 'nba-btn sec', style: 'margin-bottom:12px', onclick: switchTeam }, [ico(I.swap), 'انتقل للفريق ' + (meP.tm ? 'أ' : 'ب')]));
      if (!balanced) w.appendChild(h('div', { class: 'nba-note', text: 'لازم الفريقين يبقوا متساويين (2 أو 4 أو 6 لاعبين). حد يبدّل فريقه أو انتظر لاعب جديد.' }));
    } else {
      var meter = []; for (var m = 0; m < r.mx; m++) meter.push(h('i', { class: m < r.pc ? 'on' : '' }));
      w.appendChild(h('div', { class: 'nbx-sh' }, [h('b', { text: 'اللاعبون' }), h('div', { class: 'nbx-mt' }, meter), h('span', { text: r.pc + ' / ' + r.mx })]));
      var rows = uids.map(function (u) {
        return pr(u, isHost && u !== S.uid ? h('button', { class: 'nba-ib tx', 'aria-label': 'نقل الإدارة', onclick: function () { takeHost(u); } }, ['اجعله مضيفًا']) : null);
      });
      for (var e = uids.length; e < r.mx; e++) rows.push(h('div', { class: 'nba-row em' }, [h('span', { class: 'nba-wt' }), 'مقعد فاضي — شارك الكود']));
      w.appendChild(h('div', { class: 'nbx-seats' }, rows));
    }
    if (meP) S.seenInit = true;
    w.appendChild(h('div', { class: 'nba-sp' }));
    if (isHost) {
      var lab = V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة');
      w.appendChild(h('div', { class: 'nbz-bar' }, [
        h('button', { class: 'nbz-play go', disabled: !canStart, onclick: startGame }, [
          h('span', { class: 'gl', 'aria-hidden': 'true' }), h('span', { class: 'ic' }, [V.busy ? h('div', { class: 'nba-spin d' }) : ico(I.bolt)]),
          h('span', { class: 'tx' }, [h('b', { text: lab, style: lab.length > 16 ? 'font-size:15px' : '' }), h('small', { text: 'START MATCH' })]),
          h('span', { class: 'ar' }, [ico('<path d="M15 5l-7 7 7 7"/>')])]),
        r.pc < 2 ? h('div', { class: 'nbx-why', text: 'لازم لاعب واحد على الأقل (' + r.pc + ' / 2) عشان تبدأ المباراة. ابعت الكود لصاحبك.' }) : null]));
    } else {
      w.appendChild(h('div', { class: 'nbz-bar' }, [
        h('div', { class: 'nba-note nbz-wait' }, [h('span', { class: 'nba-wt' }), r.qr ? 'الأسئلة جاهزة — في انتظار المضيف يبدأ اللعبة…' : 'في انتظار المضيف يبدأ اللعبة…']),
        hostStale ? h('button', { class: 'nba-btn sec', onclick: function () { takeHost(S.uid); } }, [ico(I.crown), 'المضيف مش متصل — تولّى الإدارة']) : null]));
    }
  }

  /* مواجهة اللاعبين (VS) — بتظهر في الكاونت داون */
  function matchup() {
    var teams = S.room.md === 't', uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), n = 0;
    var group = function (list, sz) { return h('div', { class: 'nba-mu' }, list.map(function (u) { return h('div', { class: 'nba-mp', style: '--dl:' + (n++ * 80) + 'ms' }, [avatar(u, S.players[u], sz), h('small', { text: S.players[u].n }), titleChip(u, 'sm')]); })); };
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
        var sc = h('div', { class: 'sc nba-tm', style: 'font:900 26px var(--f-ui,Cairo,sans-serif);font-variant-numeric:tabular-nums;color:inherit', text: String(tp[x]) });
        countUp(sc, tp[x], tt[x], 800);
        return h('div', { class: 'nba-team ' + (x ? 'b' : 'a'), style: 'text-align:center' }, [h('h4', { style: 'justify-content:center;margin-bottom:2px' }, [x ? 'الفريق ب' : 'الفريق أ']), sc]);
      })));
    }
    order.forEach(function (u, i) {
      var p = S.players[u], from = prev ? prev[u] : (fin ? 0 : t[u]), sc = h('span', { class: 'sc', text: String(from) }), cls = 'nba-lead' + (u === S.uid ? ' me' : ''), st = '';
      if (prev && pr[u] !== i) { cls += ' mv'; st = '--dy:' + ((pr[u] - i) * 46) + 'px;--o:1'; }
      else if (fin) { cls += ' mv'; st = '--dy:16px;--o:0;animation-delay:' + (i * 90 + 150) + 'ms'; }
      countUp(sc, from, t[u], 800);
      card.appendChild(h('div', { class: cls, style: st, role: fin ? 'button' : null, tabindex: fin ? '0' : null, onclick: fin ? function () { openProfile(u, p); } : null,
        onkeydown: fin ? function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); openProfile(u, p); } } : null }, [
        h('span', { class: 'rk r' + (i + 1), text: String(i + 1) }), avatar(u, p, 32),
        h('span', { class: 'nm' }, [p.n + (teams ? (p.tm ? ' · ب' : ' · أ') : ''), titleChip(u), fin ? streakChip(u) : null]),
        fin ? h('span', { class: 'nba-tag', text: correctCount(u) + '/' + NQ }) : null,
        upTo != null && S.rev[upTo] && pts(u, upTo) ? h('span', { class: 'nba-tag g', text: '+' + pts(u, upTo) }) : null, sc,
        fin ? h('i', { class: 'pb', style: 'width:' + Math.round(t[u] / max * 100) + '%;left:auto' }) : null]));
    });
    return card;
  }
  /* ARENA-ROUNDS: الأسئلة مترتبة من السيرفر سهل ← متوسط ← صعب (4/4/2) فكل مستوى = جولة. الجولة بتبدأ بفاصل صوتي + بانر وبتنتهي بصوت نهاية الجولة. عرض وصوت بس — مفيش أي تغيير في التوقيت أو النقاط */
  var NBZ_TIER = {
    e: { c: '#2BD98A', a: 'rgba(43,217,138,.2)', ad: 'السهلة', ic: '<path d="M12 21v-9"/><path d="M12 12C12 8 9 6 5 6c0 4 2 6 7 6z"/><path d="M12 14c0-3 2-5 6-5 0 3-2 5-6 5z"/>' },
    m: { c: '#F2B84B', a: 'rgba(242,184,75,.2)', ad: 'المتوسطة', ic: '<path d="M5 13l7-6 7 6"/><path d="M5 19l7-6 7 6"/>' },
    h: { c: '#FF7A59', a: 'rgba(255,122,89,.2)', ad: 'الصعبة', ic: I.fire }
  };
  var NBZ_ORD = ['الأولى', 'الثانية', 'الثالثة', 'الرابعة'];
  function nbzRoundInfo(i) {
    var q = S.q[i]; if (!q) return null;
    var tiers = [], cnt = {}, pos = 0, j, qq;
    for (j = 0; j < NQ; j++) { qq = S.q[j]; if (!qq) continue; if (tiers.indexOf(qq.d) < 0) tiers.push(qq.d); cnt[qq.d] = (cnt[qq.d] || 0) + 1; if (j < i && qq.d === q.d) pos++; }
    var n = tiers.indexOf(q.d);
    return { d: q.d, n: n, cnt: cnt[q.d], first: pos === 0, last: n > 0 && n === tiers.length - 1 && Object.keys(S.q).length >= NQ };
  }
  function nbzRdLabel(rd) { return rd.last ? 'الجولة الأخيرة' : 'الجولة ' + (NBZ_ORD[rd.n] || (rd.n + 1)); }
  function nbzBanner(rd) {
    if (!root || RM()) return;
    var T = NBZ_TIER[rd.d] || NBZ_TIER.e;
    var b = h('div', { class: 'nbz-rb', style: '--tc:' + T.c + ';--ta:' + T.a, 'aria-hidden': 'true' }, [h('span', { class: 'rn', text: nbzRdLabel(rd) }),
      h('div', { class: 'tt' }, [h('span', { class: 'em' }, [ico(T.ic)]), h('b', { text: DIFF[rd.d] || '' })]), h('small', { text: rd.cnt + (rd.cnt > 2 ? ' أسئلة' : ' سؤالان') })]);
    root.appendChild(b); setTimeout(function () { b.remove(); }, 2200);
  }
  function nbzStage(title, onClose) { return h('div', { class: 'nbz-stage cr' }, [h('div', { class: 'nbz-stars', 'aria-hidden': 'true' }), top(title, onClose), nbzVista()]); }
  function vGame(w) {
    var p = phase();
    w.classList.add('nbz', 'nbz-gm'); w.style.cssText = '';   /* ARENA-LOBBY-X */
    if (!p) { w.appendChild(top('اللعبة', close)); w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري مزامنة وقت اللعبة…'])); return; }
    if (p.k === 'lead') {
      w.classList.add('nbz-cr'); w.appendChild(nbzStage('اللعبة', close));
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
    var rd = q ? nbzRoundInfo(i) : null, T = q ? (NBZ_TIER[q.d] || NBZ_TIER.e) : null, rEnd = !!(q && S.q[i + 1] && S.q[i + 1].d !== q.d), sess = S;
    if (T) w.style.cssText = '--tc:' + T.c + ';--ta:' + T.a;
    if (q) S.shown[i] = 1;
    if (i === 0 && p.k === 'q' && p.left > QDUR - 2500 && once('go')) { SFX.play('go'); flash('go'); }
    if (rd && rd.first && p.k === 'q' && p.left > QDUR - 3000 && once('rd' + i)) {   /* بداية جولة: فاصل صوتي + بانر */
      if (i === 0) setTimeout(function () { if (S === sess) SFX.play('rd', q.d); }, 420); else SFX.play('rd', q.d);
      nbzBanner(rd);
    }
    w.appendChild(top('اللعبة', close));
    var pips = h('div', { class: 'nba-pips', 'aria-hidden': 'true' });
    for (var j = 0; j < NQ; j++) {
      var qj = S.q[j], Tj = qj && NBZ_TIER[qj.d];
      pips.appendChild(h('i', { class: (j < i || (j === i && revealed && S.rev[i]) ? (S.rev[j] ? (pts(S.uid, j) ? 'ok' : 'no') : '') : (j === i ? 'cur' : '')) + (qj && S.q[j - 1] && S.q[j - 1].d !== qj.d ? ' g' : ''), style: Tj ? '--tc:' + Tj.c + ';--ta:' + Tj.a : '' }));
    }
    w.appendChild(pips);
    var ring = h('div', { class: 'nba-ring', role: 'timer' }), num = h('span', { class: 'n' }), fg;
    ring.innerHTML = '<svg viewBox="0 0 56 56" aria-hidden="true"><circle class="bg" cx="28" cy="28" r="22"/><circle class="fg" cx="28" cy="28" r="22"/></svg>';
    fg = ring.querySelector('.fg'); ring.appendChild(num);
    w.appendChild(h('div', { class: 'nba-qh' }, [h('div', { class: 'nba-qn' }, [h('b', { text: String(i + 1) }), h('span', { text: '/ ' + NQ }), q ? h('span', { class: 'nbz-tc' }, [ico(T.ic), nbzRdLabel(rd) + ' · ' + (DIFF[q.d] || '')]) : null]), ring]));
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
        if (once('rv' + i)) {
          SFX.play(g ? 'correct' : (my ? 'wrong' : 'miss')); flash(g ? 'ok' : 'no');
          if (g && sk >= 2) setTimeout(function () { if (S === sess) SFX.play('streak', sk); }, 420);
          if (rEnd) setTimeout(function () { if (S === sess && once('re' + i)) SFX.play('re', q.d); }, 1500);   /* نهاية الجولة */
        }
        w.appendChild(h('div', { class: 'nba-fb' }, [gain, g && sk >= 2 ? h('span', { class: 'nba-streak' }, [ico(I.fire), 'سلسلة ×' + sk]) : null]));
        if (rEnd) w.appendChild(h('div', { class: 'nbz-rend', text: 'انتهت الجولة ' + T.ad }));
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
      if (lo && !S.my[i] && S.fx['w' + i] !== sec) { S.fx['w' + i] = sec; SFX.play('warn', sec); }
    };
    V.live();
  }
  function vResults(w) {
    var t = totals(), order = ranked(t), teams = S.room.md === 't', tt = teams ? teamTotals(t) : null;
    w.classList.add('nbz-cr'); w.appendChild(nbzStage('النتيجة النهائية', function () { leaveGame(); }));
    var ready = Object.keys(S.rev).length >= NQ, title, sub, won = false, meP = S.players[S.uid], rank = order.indexOf(S.uid) + 1;
    if (!ready) { w.appendChild(h('div', { class: 'nba-note' }, [h('div', { class: 'nba-spin d', style: 'margin:60px auto 12px' }), 'جاري احتساب النتيجة النهائية…'])); return; }
    if (teams) { title = tt[0] === tt[1] ? 'تعادل بين الفريقين!' : (tt[0] > tt[1] ? 'الفريق أ فاز!' : 'الفريق ب فاز!'); sub = tt[0] + ' × ' + tt[1]; won = tt[0] !== tt[1] && (tt[0] > tt[1] ? 0 : 1) === (meP && meP.tm ? 1 : 0); }
    else { var top1 = order.filter(function (u) { return t[u] === t[order[0]]; }); title = top1.length > 1 ? 'تعادل على المركز الأول!' : S.players[order[0]].n + ' هو البطل!'; sub = t[order[0]] + ' نقطة'; won = top1.indexOf(S.uid) > -1; }
    if (once('res')) { SFX.play(won ? 'win' : 'end'); confetti(won ? 80 : 28); }
    w.appendChild(h('div', { class: 'nba-card nba-win' }, [h('div', { class: 'nba-badge', text: won ? 'مبروك — أنت من الأبطال' : 'انتهت المواجهة' }), h('div', { class: 'tr' }, [ico(I.trophy)]), h('h2', { text: title }), h('p', { text: sub })]));
    if (!S.fin && once('fin')) startFinalize();
    S.finEl = h('div', { class: 'nba-finw' }); w.appendChild(S.finEl); paintFin();
    S.rmEl = h('div', { class: 'nba-rmw' }); w.appendChild(S.rmEl); rmWatch(); rmPaint();   /* ARENA-REMATCH */
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
    rmLeave();   /* ARENA-REMATCH: لو لسه ما رديتش على دعوة الإعادة بنرفضها (أو بنلغيها لو إحنا اللي طلبناها) */
    var rid = S && S.rid, host = S && S.room && S.room.host === S.uid, fin = S && S.finP;
    ls('nbArenaRoom', null); detach(); V = { view: 'hub', key: '' };
    if (rid && host) { if (fin) Promise.race([fin, sleep(6000)]).catch(function () { /* ignore */ }).then(function () { cleanup(rid); }); else cleanup(rid); }   /* ARENA-PROFILE: نستنى تسجيل النتيجة (حد أقصى 6ث) قبل ما نمسح بيانات الغرفة */
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
