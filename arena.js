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
      '@media (min-width:768px){.nba-wrap,.nba-sndbar{max-width:600px}.nba-q{font-size:20px}.nba-opt{font-size:16.5px}.nbx-h{font-size:42px}.nbx-p{font-size:16px;max-width:44ch}}',
      '@media (min-width:1200px){.nba-wrap,.nba-sndbar{max-width:680px}}',
      /* بطاقات التخصصات: الشريط الأفقي مخفي السكرول مش بيتحرّك بعجلة الماوس → شبكة على التابلت والكمبيوتر */
      '@media (min-width:768px),(hover:hover) and (pointer:fine){.nbx-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(128px,1fr));overflow:visible;margin:0;padding:0 0 4px;scroll-snap-type:none}.nbx-t{width:auto}}',
      /* شاشة السؤال على الموبايل الطويل (أيفون/أندرويد بالطول): كارت السؤال والاختيارات بيكبروا حسب ارتفاع الشاشة بدل فراغ كبير تحت. القيم ثابتة ومش بتتأثر بظهور الإجابة فمفيش قفزة وقت الكشف */
      '.nba-qcard{min-height:clamp(116px,24vh,230px);min-height:clamp(116px,24dvh,230px)}',
      '.nba-opt{min-height:clamp(58px,10vh,92px);min-height:clamp(58px,10dvh,92px)}',
      /* كلمة الصعوبة (سهل/متوسط/صعب) فوق السؤال: نص عادي من غير إطار بيضاوي ولا خلفية — اللون زي ما هو (أخضر، وذهبي للصعب). مقصورة على هيدر السؤال بس فباقي التاجات في الساحة زي ما هي */
      '.nba-qn .nba-tag{background:none;border:0;border-radius:0;padding:0}',
      /* موبايل بالعرض (ارتفاع قليل) */
      '@media (max-height:480px){.nba-cd{height:150px}.nba-cd::before{width:140px;height:140px}.nba-cd i{width:96px;height:96px}.nba-big{font-size:72px}.nba-qcard{min-height:76px;padding:12px}.nba-opt{min-height:50px;margin-bottom:8px}.nba-win{padding:16px 12px}.nba-win .tr{width:64px;height:64px;margin-bottom:8px}}',
      /* شاشات ضيقة جدًا (320px) */
      '@media (max-width:340px){.nbx-cv{font-size:38px;letter-spacing:.1em;text-indent:.1em}.nbx-stats b{font-size:22px}}'
    ].join('\n');
    document.head.appendChild(st);
  }

  /* ───────── فتح / قفل ───────── */
  function open(o) {
    o = o || {};
    css();
    cssLobby();
    cssResp();
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
      w.appendChild(h('button', { class: 'nba-btn gold', disabled: !canStart, onclick: startGame }, [V.busy ? h('div', { class: 'nba-spin' }) : ico(I.bolt), V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة بالذكاء الاصطناعي… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة')]));
      if (r.pc < 2) w.appendChild(h('div', { class: 'nba-note', text: 'محتاج لاعب واحد على الأقل. ابعت الكود لصاحبك.' }));
    } else {
      w.appendChild(h('div', { class: 'nba-note' }, [r.qr ? 'الأسئلة جاهزة — في انتظار المضيف يبدأ اللعبة…' : 'في انتظار المضيف يبدأ اللعبة…']));
      if (hostStale) w.appendChild(h('button', { class: 'nba-btn sec', onclick: function () { takeHost(S.uid); } }, [ico(I.crown), 'المضيف مش متصل — تولّى الإدارة']));
    }
  }

  /* ───────── شاشة الساحة (v4 — لوبي ألعاب) ───────── */
  function vHub2(w) {
    var saved = ls('nbArenaRoom'), u = me(), nm = ((u && (u.displayName || '')) || '').trim() || 'لاعب';
    w.classList.add('nba-hubw');
    w.appendChild(top());
    function stat(a, b) { return h('div', {}, [h('b', { text: a }), h('span', { text: b })]); }
    w.appendChild(h('div', { class: 'nbx-hero' }, [
      h('div', { class: 'nbx-pl' }, [avatar(u ? u.uid : 'x', { n: nm, ph: u && u.photoURL }, 36), h('div', {}, [h('div', { text: 'أهلاً ' + nm.split(' ')[0] }), h('small', { text: 'جاهز للتحدي؟' })])]),
      h('h2', { class: 'nbx-h' }, ['تحدّى أصحابك', h('br'), 'في ', h('em', { text: 'الزراعة' })]),
      h('p', { class: 'nbx-p', text: '10 أسئلة في تخصصك، نقاط لحظية، واللي بيجاوب أسرع بياخد أكتر.' })]));
    w.appendChild(h('div', { class: 'nbx-stats' }, [stat('2–6', 'لاعبين'), stat('10', 'أسئلة'), stat('LIVE', 'نقاط لحظية')]));
    if (saved) w.appendChild(h('div', { class: 'nba-card' }, [h('div', { class: 'nba-lbl', style: 'margin-top:0', text: 'عندك غرفة شغّالة: ' + saved }), h('div', { class: 'nba-seg' }, [
      h('button', { class: 'nba-btn', onclick: function () { joinRoom(saved); } }, ['ارجع للغرفة']),
      h('button', { class: 'nba-btn sec', onclick: function () { ls('nbArenaRoom', null); V.key = ''; render(); } }, ['تجاهل'])])]));
    w.appendChild(h('div', { class: 'nbx-sec', text: 'اختار تخصص التحدي' }));
    w.appendChild(h('div', { class: 'nbx-tiles' }, SPECS.map(function (s, n) {
      return h('button', { class: 'nbx-t', onclick: function () { V = { view: 'create', md: 's', mx: 4, sp: s[0] }; render(); } }, [h('i', { text: (n < 9 ? '0' : '') + (n + 1) }), s[1]]);
    })));
    w.appendChild(h('div', { class: 'nba-sp' }));
    w.appendChild(h('button', { class: 'nba-btn nbx-ch', style: 'min-height:58px;font-size:16.5px;margin-top:16px', onclick: function () { V = { view: 'create', md: 's', mx: 4, sp: 'pp' }; render(); } }, [ico(I.users), 'إنشاء غرفة جديدة']));
    w.appendChild(h('div', { class: 'nbx-jl', text: 'عندك كود من صاحبك؟' }));
    var jb = h('button', { disabled: String(V.code || '').trim().length < 6, onclick: function () { joinRoom($('#nba-code').value); } }, ['انضمام']);
    var inp = h('input', { id: 'nba-code', maxlength: '6', placeholder: 'ABC234', 'aria-label': 'كود الغرفة', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', value: V.code || '',
      oninput: function (e) { jb.disabled = e.target.value.trim().length < 6; },
      onkeydown: function (e) { if (e.key === 'Enter') joinRoom(e.target.value); } });
    w.appendChild(h('div', { class: 'nbx-jg' + (V.err ? ' bad' : '') }, [inp, jb]));
    w.appendChild(V.err ? h('div', { class: 'nbx-er', role: 'alert', text: V.err }) : h('div', { class: 'nbx-fh', text: 'الكود 6 خانات (حروف وأرقام). الزر يتفعّل لما تكمله.' }));
  }

  /* ───────── شاشة الغرفة (v3) ───────── */
  function vLobby2(w) {
    var r = S.room, uids = Object.keys(S.players).sort(function (a, b) { return S.players[a].j - S.players[b].j; }), isHost = r.host === S.uid, teams = r.md === 't';
    var hostP = S.players[r.host], hostStale = !hostP || !hostP.ls || (srvNow() - hostP.ls) > STALE;
    var balanced = !teams || (r.pc % 2 === 0 && r.na === r.nb), canStart = isHost && r.pc >= 2 && balanced && !V.busy;
    S.ln = 0;
    w.classList.add('nba-lobw');
    w.appendChild(top('الغرفة', leaveLobby));
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
      w.appendChild(h('button', { class: 'nba-btn gold nbx-ch', style: 'margin-top:16px', disabled: !canStart, onclick: startGame }, [V.busy ? h('div', { class: 'nba-spin' }) : null, V.busy ? (r.qr ? 'جاري البدء…' : 'جاري تجهيز الأسئلة… (ممكن ياخد لحد 30 ثانية)') : (r.qr ? 'ابدأ اللعبة' : 'ابدأ وجهّز الأسئلة')]));
      if (r.pc < 2) w.appendChild(h('div', { class: 'nbx-why', text: 'لازم لاعب واحد على الأقل (' + r.pc + ' / 2) عشان تبدأ المباراة. ابعت الكود لصاحبك.' }));
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
    if (once('res')) { SFX.play(won ? 'win' : 'end'); confetti(won ? 80 : 28); }
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
