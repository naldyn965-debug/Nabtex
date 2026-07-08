/* ═══════════════════════════════════════════════════════════════
   NABTEX SOCIAL MODULE v1.0
   Modular, non-destructive | RTL | Firebase-backed
   Adds: Social Profiles, Feed, Follow, Like, Comment, Share
═══════════════════════════════════════════════════════════════ */

/* ── CSS Injection ─────────────────────────────────────────── */
(function injectCSS() {
  const css = `

/* ══════════════════════════════════════════════════════════════
   NABTEX SOCIAL PREMIUM v3.0
   Community + Profile  |  RTL  |  Glass·Glow·Depth
══════════════════════════════════════════════════════════════ */

/* ── Tab NEW badge — removed ─────────────────────────────────── */
.mkt-tab-social{position:relative}

/* ── Root containers ────────────────────────────────────────── */
#social-feed-root,#social-profile-root,
#social-followers-root,#social-following-root{
  min-height:60vh;padding:0 0 100px;
}

/* ════════════════════════════════════════
   FEED HEADER  ★★★
════════════════════════════════════════ */
.soc-feed-header{
  padding:12px 16px 10px;
  display:flex;align-items:center;justify-content:space-between;
  border-bottom:1px solid var(--line);
  background:var(--glass);
  backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);
  position:sticky;top:110px;z-index:10;
  box-shadow:0 1px 0 var(--line),0 4px 16px rgba(27,107,58,.04);
}
.soc-feed-title{
  font-size:16px;font-weight:900;color:var(--ink);
  display:flex;align-items:center;gap:10px;letter-spacing:-.015em;
}
.soc-feed-title-icon{
  width:34px;height:34px;border-radius:10px;flex-shrink:0;
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  display:flex;align-items:center;justify-content:center;color:#fff;
  box-shadow:0 4px 14px rgba(27,107,58,.38),inset 0 1px 0 rgba(255,255,255,.2);
  animation:iconGlow 3s ease-in-out infinite;
}
@keyframes iconGlow{
  0%,100%{box-shadow:0 4px 14px rgba(27,107,58,.38),inset 0 1px 0 rgba(255,255,255,.2)}
  50%{box-shadow:0 4px 22px rgba(27,107,58,.65),inset 0 1px 0 rgba(255,255,255,.2)}
}
.soc-feed-tabs{
  display:flex;gap:2px;background:var(--bg2);
  padding:3px;border-radius:10px;border:1px solid var(--line);
}
.soc-ft{
  padding:5px 14px;border-radius:7px;font-size:12px;font-weight:800;
  color:var(--muted);cursor:pointer;border:none;background:none;
  font-family:var(--f-ui);transition:all .22s cubic-bezier(.16,1,.3,1);
}
.soc-ft.active{
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  color:#fff;box-shadow:0 3px 10px rgba(27,107,58,.35);
}
.soc-ft:not(.active):hover{color:var(--brand);background:var(--brand-pale)}

/* ── Create-post card ───────────────────────────────────────── */
.soc-create-card{
  margin:12px 13px 0;
  background:var(--card);border-radius:20px;
  border:1.5px solid var(--line);padding:13px 14px;
  display:flex;gap:11px;align-items:flex-start;cursor:pointer;
  transition:border-color .28s,box-shadow .28s,transform .28s cubic-bezier(.16,1,.3,1);
  position:relative;overflow:hidden;
}
.soc-create-card::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(27,107,58,.04),transparent 60%);
  opacity:0;transition:opacity .28s;
}
.soc-create-card:hover{
  border-color:rgba(27,107,58,.35);
  box-shadow:0 8px 28px rgba(27,107,58,.12);
  transform:translateY(-1px);
}
.soc-create-card:hover::before{opacity:1}

/* ── Avatar system ──────────────────────────────────────────── */
.soc-avatar{
  width:40px;height:40px;border-radius:50%;
  background:linear-gradient(145deg,var(--brand-l),var(--brand-d));
  flex-shrink:0;display:flex;align-items:center;justify-content:center;
  color:#fff;font-weight:800;font-size:14px;overflow:hidden;
  cursor:pointer;position:relative;
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;
}
.soc-avatar:hover{transform:scale(1.06);box-shadow:0 4px 14px rgba(27,107,58,.28)}
.soc-avatar img{width:100%;height:100%;object-fit:cover;display:block;}
.soc-avatar-sm{width:36px;height:36px;font-size:13px}
.soc-avatar-xl{
  width:112px;height:112px;font-size:38px;
  border:4px solid var(--card);
  box-shadow:0 8px 28px rgba(0,0,0,.28),0 0 0 1px rgba(0,0,0,.06);
  flex-shrink:0;
}

/* ── Create-post inner ──────────────────────────────────────── */
.soc-create-placeholder{
  flex:1;background:var(--bg2);border-radius:var(--rpill);
  padding:9px 16px;font-size:13px;color:var(--muted);cursor:pointer;
  border:1.5px solid var(--line);transition:all .22s;font-family:var(--f-ui);
}
.soc-create-placeholder:hover{border-color:var(--brand-l);color:var(--brand-d)}
.soc-create-actions{display:flex;gap:7px;padding-top:9px;border-top:1px solid var(--line);margin-top:9px}
.soc-create-action-btn{
  flex:1;display:flex;align-items:center;justify-content:center;
  gap:5px;padding:6px 4px;border-radius:9px;font-size:11px;font-weight:700;
  color:var(--muted);background:var(--bg2);border:1.5px solid var(--line);
  cursor:pointer;transition:all .22s;font-family:var(--f-ui);
}
.soc-create-action-btn:hover{color:var(--brand);border-color:var(--brand-l);background:var(--brand-pale)}

/* ════════════════════════════════════════
   POST CARDS  ★★★★★ PREMIUM
════════════════════════════════════════ */
.soc-post-card{
  margin:14px 13px 0;
  background:var(--card);
  border-radius:24px;
  border:1px solid var(--line);
  overflow:hidden;
  position:relative;
  transition:box-shadow .36s cubic-bezier(.16,1,.3,1),
             transform .36s cubic-bezier(.16,1,.3,1),
             border-color .28s;
  animation:socCardIn .52s cubic-bezier(.16,1,.3,1) both;
  box-shadow:0 2px 12px rgba(0,0,0,.06),0 1px 4px rgba(0,0,0,.04);
}
@keyframes socCardIn{
  from{opacity:0;transform:translateY(22px) scale(.96)}
  to{opacity:1;transform:none}
}
/* animated gradient top accent */
.soc-post-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:3px;
  background:linear-gradient(90deg,var(--brand-d),var(--brand-l),#f0c040,var(--brand-l),var(--brand-d));
  background-size:300% 100%;
  opacity:0;transition:opacity .32s;
  border-radius:24px 24px 0 0;
}
/* inner glow */
.soc-post-card::after{
  content:'';position:absolute;inset:0;
  background:radial-gradient(ellipse at top,rgba(27,107,58,.05),transparent 65%);
  opacity:0;transition:opacity .32s;pointer-events:none;
}
.soc-post-card:hover{
  box-shadow:0 20px 52px rgba(27,107,58,.15),0 6px 18px rgba(0,0,0,.08);
  transform:translateY(-4px);
  border-color:rgba(27,107,58,.24);
}
.soc-post-card:hover::before{
  opacity:1;
  animation:accentSlide 2.4s linear infinite;
}
.soc-post-card:hover::after{opacity:1}
@keyframes accentSlide{
  0%{background-position:0% 0}100%{background-position:300% 0}
}

/* post header */
.soc-post-header{display:flex;align-items:center;gap:10px;padding:14px 15px 9px;background:linear-gradient(180deg,rgba(27,107,58,.025),transparent)}
.soc-post-user-info{flex:1;min-width:0}
.soc-post-username{
  font-size:13.5px;font-weight:800;color:var(--ink);cursor:pointer;
  display:flex;align-items:center;gap:5px;
  transition:color .15s;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.soc-post-username:hover{color:var(--brand)}
.soc-verified-badge{
  width:18px;height:18px;flex-shrink:0;
  border-radius:50%;display:inline-flex;align-items:center;justify-content:center;
  box-shadow:0 2px 10px rgba(27,107,58,.55),0 0 0 1.5px rgba(255,255,255,.5);
  overflow:visible;
}
.soc-verified-badge svg{width:18px;height:18px;display:block}
.soc-post-meta{
  font-size:10.5px;color:var(--muted);margin-top:2px;
  display:flex;align-items:center;gap:4px;flex-wrap:wrap;
}
.soc-post-meta-dot{width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.45;flex-shrink:0}
.soc-post-more-btn{
  width:30px;height:30px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  background:none;border:none;cursor:pointer;color:var(--muted);
  transition:all .2s;flex-shrink:0;
}
.soc-post-more-btn:hover{background:var(--bg2);color:var(--ink);transform:scale(1.1)}

/* ── Post Action Bottom Sheet ── */
.soc-post-sheet-overlay{
  position:fixed;inset:0;z-index:9000;
  background:rgba(0,0,0,.45);
  backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);
  opacity:0;pointer-events:none;
  transition:opacity .25s;
  display:flex;align-items:flex-end;justify-content:center;
}
.soc-post-sheet-overlay.open{opacity:1;pointer-events:all;}
.soc-post-sheet{
  width:100%;max-width:520px;
  background:var(--card);
  border-radius:22px 22px 0 0;
  padding:0 0 calc(env(safe-area-inset-bottom) + 12px);
  transform:translateY(100%);
  transition:transform .32s cubic-bezier(.34,1.1,.64,1);
  direction:rtl;
  overflow:hidden;
}
.soc-post-sheet-overlay.open .soc-post-sheet{transform:translateY(0);}
.soc-post-sheet-handle{
  width:38px;height:4px;border-radius:99px;
  background:var(--line);margin:12px auto 4px;
}
.soc-post-sheet-title{
  font-size:11px;font-weight:700;color:var(--muted);
  text-align:center;padding:6px 0 10px;letter-spacing:.04em;
  text-transform:uppercase;
}
.soc-post-sheet-item{
  display:flex;align-items:center;gap:13px;
  padding:15px 22px;cursor:pointer;
  font-size:15px;font-weight:600;color:var(--ink);
  transition:background .15s;border:none;background:none;
  width:100%;text-align:right;direction:rtl;
  font-family:var(--f-ui);
}
.soc-post-sheet-item:hover{background:var(--bg2);}
.soc-post-sheet-item svg{flex-shrink:0;color:var(--muted);}
.soc-post-sheet-item.danger{color:#e53935;}
.soc-post-sheet-item.danger svg{color:#e53935;}
.soc-post-sheet-divider{height:1px;background:var(--line);margin:2px 0;}
.soc-post-sheet-cancel{
  display:flex;align-items:center;justify-content:center;
  padding:14px;cursor:pointer;
  font-size:15px;font-weight:700;color:var(--muted);
  transition:background .15s;border:none;background:none;
  width:100%;font-family:var(--f-ui);
  margin-top:4px;
}
.soc-post-sheet-cancel:hover{background:var(--bg2);}

/* post text */
.soc-post-text{padding:0 14px 10px;font-size:13.5px;line-height:1.72;color:var(--ink);white-space:pre-wrap}
.soc-post-tag{
  display:inline-block;background:var(--brand-pale);color:var(--brand);
  font-size:11.5px;font-weight:700;padding:1px 9px;border-radius:99px;
  margin:0 2px;border:1px solid rgba(27,107,58,.14);cursor:pointer;transition:all .2s;
}
.soc-post-tag:hover{background:var(--brand);color:#fff}

/* post images */
.soc-post-images{width:100%;overflow:hidden}
.soc-post-images.single img{width:100%;max-height:380px;object-fit:cover}
.soc-post-images.grid2{display:grid;grid-template-columns:1fr 1fr;gap:2px}
.soc-post-images.grid2 img{width:100%;height:190px;object-fit:cover}
.soc-post-images img{cursor:pointer;transition:transform .35s cubic-bezier(.16,1,.3,1),filter .22s}
.soc-post-images img:hover{transform:scale(1.025);filter:brightness(.9)}

/* stats bar */
.soc-post-stats{
  display:flex;align-items:center;gap:10px;padding:7px 14px;
  border-top:1px solid var(--line);border-bottom:1px solid var(--line);
  font-size:11.5px;color:var(--muted);
  background:linear-gradient(180deg,var(--bg2) 0%,var(--card) 100%);
}
.soc-post-stat-item{
  display:flex;align-items:center;gap:4px;cursor:pointer;
  padding:2px 7px;border-radius:var(--rpill);transition:all .18s;
}
.soc-post-stat-item:hover{color:var(--brand);background:var(--brand-pale)}
.soc-post-stat-item svg{width:12px;height:12px}

/* action buttons */
.soc-post-actions{display:flex;padding:6px 8px;gap:2px;border-top:1px solid var(--line)}
.soc-action-btn{
  flex:1;display:flex;align-items:center;justify-content:center;
  gap:5px;padding:9px 4px;border-radius:12px;
  font-size:12px;font-weight:700;color:var(--muted);
  cursor:pointer;background:none;border:none;font-family:var(--f-ui);
  transition:color .2s,background .2s;
  white-space:nowrap;overflow:visible;
}
.soc-action-btn:hover{color:var(--brand);background:var(--brand-pale)}
.soc-action-btn.liked{color:#e05252}
.soc-action-btn.liked:hover{color:#c0392b;background:#fdecea}
.soc-action-btn.liked svg{fill:#e05252;stroke:#e05252}
.soc-action-btn.saved{color:var(--brand)}
.soc-action-btn.saved svg{fill:var(--brand)}
.soc-action-btn svg{
  width:16px;height:16px;flex-shrink:0;
  transition:transform .25s cubic-bezier(.34,1.56,.64,1);
}
.soc-action-btn:hover svg{transform:scale(1.18)}

/* comments */
.soc-comments-wrap{
  border-top:1px solid var(--line);padding:11px 14px;display:none;
  background:var(--bg2);
}
.soc-comments-wrap.open{display:block;animation:socFadeIn .22s ease both}
@keyframes socFadeIn{from{opacity:0;transform:translateY(-5px)}to{opacity:1;transform:none}}
.soc-comment-input-row{display:flex;gap:8px;align-items:center;margin-bottom:10px}
.soc-comment-input{
  flex:1;background:var(--card);border:1.5px solid var(--line);
  border-radius:var(--rpill);padding:8px 15px;font-size:12.5px;
  color:var(--ink);font-family:var(--f-ui);outline:none;
  transition:border-color .2s,box-shadow .2s;
}
.soc-comment-input:focus{border-color:var(--brand-l);box-shadow:0 0 0 3px rgba(27,107,58,.09)}
.soc-comment-send-btn{
  width:34px;height:34px;flex-shrink:0;
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  border:none;border-radius:50%;display:flex;align-items:center;
  justify-content:center;cursor:pointer;color:#fff;
  box-shadow:0 3px 12px rgba(27,107,58,.35);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),box-shadow .28s;
}
.soc-comment-send-btn:hover{transform:scale(1.12);box-shadow:0 6px 18px rgba(27,107,58,.48)}
.soc-comment-item{display:flex;gap:8px;margin-bottom:8px;animation:socFadeIn .2s ease both}
.soc-comment-bubble{
  flex:1;background:var(--card);
  border-radius:0 14px 14px 14px;padding:8px 12px;
  border:1px solid var(--line);
  box-shadow:0 1px 4px rgba(0,0,0,.04);
}
.soc-comment-author{font-size:11px;font-weight:800;color:var(--brand);margin-bottom:2px;cursor:pointer}
.soc-comment-text{font-size:12.5px;color:var(--ink);line-height:1.5}
.soc-comment-time{font-size:10px;color:var(--muted);margin-top:3px}

/* skeleton */
.soc-skeleton-card{
  margin:12px 13px 0;background:var(--card);border-radius:20px;
  border:1px solid var(--line);padding:14px;overflow:hidden;position:relative;
}
.soc-skeleton-card::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(90deg,transparent 20%,rgba(255,255,255,.4) 50%,transparent 80%);
  background-size:200% 100%;
  animation:socShimmer 1.7s ease-in-out infinite;
}
@keyframes socShimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
@keyframes skelPulse{0%,100%{opacity:1}50%{opacity:.45}}
.soc-skel-row{display:flex;gap:10px;align-items:center;margin-bottom:12px}
.soc-skel-circle{width:38px;height:38px;border-radius:50%;background:var(--line);flex-shrink:0}
.soc-skel-lines{flex:1;display:flex;flex-direction:column;gap:7px}
.soc-skel-line{height:10px;background:var(--line);border-radius:5px;animation:skelPulse 1.5s ease-in-out infinite}
.soc-skel-line.w40{width:40%}.soc-skel-line.w70{width:70%}.soc-skel-line.w100{width:100%}
.soc-skel-img{height:165px;background:var(--line);border-radius:12px;margin-top:10px;animation:skelPulse 1.5s ease-in-out infinite}

/* suggested users */
.soc-suggest-section{padding:10px 13px 2px}
.soc-suggest-title{
  font-size:10px;font-weight:900;color:var(--muted);letter-spacing:.1em;
  text-transform:uppercase;padding:0 0 8px;
  display:flex;align-items:center;gap:7px;
}
.soc-suggest-title::after{content:'';flex:1;height:1px;background:linear-gradient(90deg,var(--line),transparent)}
.soc-suggest-scroll{
  display:flex;gap:9px;overflow-x:auto;padding-bottom:8px;
  scrollbar-width:none;-ms-overflow-style:none;
  -webkit-overflow-scrolling:touch;transform:translateZ(0);will-change:scroll-position;
}
.soc-suggest-scroll::-webkit-scrollbar{display:none}
.soc-suggest-card{
  flex-shrink:0;width:126px;background:var(--card);
  border:1.5px solid var(--line);border-radius:18px;
  padding:14px 10px;text-align:center;cursor:pointer;
  transition:transform .28s cubic-bezier(.16,1,.3,1),box-shadow .28s cubic-bezier(.16,1,.3,1),border-color .28s cubic-bezier(.16,1,.3,1);
  position:relative;overflow:hidden;
}
.soc-suggest-card::before{
  content:'';position:absolute;top:0;left:0;right:0;height:52px;
  background:linear-gradient(135deg,rgba(27,107,58,.07),rgba(45,154,88,.04));
}
.soc-suggest-card:hover{
  box-shadow:0 10px 28px rgba(27,107,58,.15);
  border-color:rgba(27,107,58,.35);transform:translateY(-3px);
}
.soc-suggest-name{font-size:12px;font-weight:800;color:var(--ink);margin:7px 0 2px}
.soc-suggest-handle{font-size:10px;color:var(--muted);margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.soc-suggest-follow-btn{
  width:100%;padding:5px 6px;border-radius:var(--rpill);
  font-size:11px;font-weight:800;
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  color:#fff;border:none;cursor:pointer;font-family:var(--f-ui);
  box-shadow:0 3px 10px rgba(27,107,58,.28);
  transition:all .28s cubic-bezier(.34,1.56,.64,1);
}
.soc-suggest-follow-btn:hover{transform:scale(1.05);box-shadow:0 5px 18px rgba(27,107,58,.45)}
.soc-suggest-follow-btn.following{background:var(--bg2);color:var(--brand);border:1.5px solid var(--brand-l);box-shadow:none}

/* spinner */
.soc-load-spinner{display:flex;justify-content:center;padding:24px}
.soc-spinner{
  width:28px;height:28px;border:3px solid var(--line);
  border-top-color:var(--brand);border-radius:50%;
  animation:socSpin .75s linear infinite;
}
@keyframes socSpin{to{transform:rotate(360deg)}}

/* ════════════════════════════════════════
   PROFILE PAGE  ★★★★★
════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   PROFILE — مطابق للصورة المرجعية 100%
══════════════════════════════════════════════ */

/* Wrapper يحتوي الكوفر والأفاتار معاً */
.soc-profile-cover-wrap{
  position:relative;
  width:100%;
  background:var(--card);
  /* padding-bottom = نص حجم الأفاتار (56px) عشان الأفاتار يطلع نصه من الكوفر */
  padding-bottom:56px;
}

/* شريط الكوفر */
.soc-profile-cover{
  width:100%;height:240px;position:relative;overflow:hidden;
  background:linear-gradient(135deg,var(--brand-d) 0%,var(--brand-l) 55%,var(--gold-l) 100%);
  display:block;
}
.soc-profile-cover-bg{
  position:absolute;inset:0;background-size:cover;background-position:center;z-index:0;
}
.soc-profile-cover img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0;}
.soc-profile-cover-overlay{
  position:absolute;inset:0;
  background:linear-gradient(to bottom,rgba(0,0,0,.03) 0%,rgba(0,0,0,.18) 100%);
  z-index:1;
}

/* زر تغيير الغلاف — أسفل يسار الكوفر */
.soc-cover-edit-btn{
  position:absolute;bottom:14px;left:14px;z-index:4;
  background:rgba(10,10,10,.55);color:#fff;
  border-radius:10px;padding:7px 14px;font-size:12px;font-weight:700;
  font-family:var(--f-ui);cursor:pointer;
  display:flex;align-items:center;gap:6px;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  border:1px solid rgba(255,255,255,.2);
  transition:background .2s,transform .18s;
}
.soc-cover-edit-btn:hover{background:rgba(0,0,0,.78);transform:scale(1.03)}
.soc-cover-edit-btn.uploading,.soc-avatar-edit-btn.uploading{opacity:.55;pointer-events:none}

/* الأفاتار — على اليمين، نصه داخل الكوفر ونصه في الكارد */
.soc-profile-avatar-container{
  position:absolute;
  bottom:0;
  right:16px;
  z-index:10;
}
/* زر الكاميرا على الأفاتار */
.soc-avatar-edit-btn{
  position:absolute;bottom:4px;right:4px;width:30px;height:30px;
  background:rgba(10,10,10,.62);
  border:2.5px solid var(--card);border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  cursor:pointer;color:#fff;
  backdrop-filter:blur(8px);
  transition:transform .28s cubic-bezier(.34,1.56,.64,1),background .2s;
}
.soc-avatar-edit-btn:hover{transform:scale(1.15);background:rgba(0,0,0,.82)}

/* إخفاء العناصر القديمة */
.soc-profile-cover-content{display:none!important}
.soc-profile-cover-avatar-row{display:none!important}
.soc-profile-cover-name-block{display:none!important}
.soc-profile-cover-name{display:none!important}
.soc-profile-cover-handle{display:none!important}
.soc-profile-avatar-wrap{display:none!important}

/* ══ بطاقة المعلومات تحت الكوفر ══ */
.soc-profile-header{
  position:relative;z-index:2;
  padding:14px 16px 22px 16px;
  background:var(--card);
  border-bottom:1px solid var(--line);
  direction:rtl;
  text-align:right;
}

/* صف الاسم + spacer بجانب الأفاتار */
.soc-profile-top-row{
  display:flex;
  flex-direction:row-reverse; /* RTL: spacer على اليمين، الاسم يبدأ من تحت مركز الأفاتار */
  align-items:center;
  gap:0;
  margin-bottom:2px;
}
/* spacer = مركز الأفاتار من حافة الـ header
   الأفاتار: right=16px، عرضه 112px → مركزه عند 72px من الحافة
   header padding = 16px → spacer الفعلي = 72-16+16 = 72px
   name-block: text-align center لتمركز الاسم تحت وسط الأفاتار */
.soc-profile-avatar-spacer{
  width:210px;
  flex-shrink:0;
}
.soc-profile-name-block{
  display:flex;flex-direction:column;gap:3px;
  flex:1;min-width:0;
  text-align:center;
}
.soc-profile-name{
  font-size:20px;font-weight:900;color:var(--ink);
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  letter-spacing:-.015em;line-height:1.3;
}
.soc-profile-handle{
  font-size:13px;color:var(--muted);
  text-align:right;direction:rtl;
}
.soc-profile-email{
  font-size:12px;color:var(--muted);margin-top:1px;
  display:flex;align-items:center;gap:4px;
}

/* صف الإيميل وتاريخ الانضمام */
.soc-profile-meta-row{
  display:flex;flex-flow:row wrap;align-items:center;gap:8px;
  font-size:12px;color:var(--muted);
  margin-top:6px;margin-bottom:14px;
  direction:rtl;
}
.soc-profile-meta-item{
  display:inline-flex;align-items:center;gap:5px;
  background:var(--bg2);border:1px solid var(--line);
  border-radius:20px;padding:4px 11px;
  white-space:nowrap;flex-shrink:0;width:auto;
}
.soc-profile-meta-item svg{width:12px;height:12px;color:var(--brand);flex-shrink:0;}

/* farm badge */
.soc-profile-farm-badge{
  display:inline-flex;align-items:center;gap:5px;
  margin-bottom:10px;padding:4px 12px;border-radius:var(--rpill);
  background:var(--brand-pale);border:1px solid rgba(27,107,58,.18);
  font-size:11.5px;font-weight:700;color:var(--brand);width:fit-content;
  margin-right:0;
}
.soc-profile-bio{
  font-size:13.5px;color:var(--ink2);line-height:1.68;
  margin:8px 0 14px;text-align:right;
  padding:10px 13px;background:var(--bg2);
  border-radius:10px;border:1px solid var(--line);
}

/* stats */
.soc-profile-stats{
  display:flex;gap:10px;padding:0 0 16px;
  border-bottom:1px solid var(--line);margin-bottom:16px;
}
.soc-stat-block{
  flex:1;display:flex;flex-direction:column;align-items:center;gap:3px;
  cursor:pointer;padding:14px 6px;border-radius:14px;
  background:var(--bg2);border:1px solid var(--line);
  transition:all .28s cubic-bezier(.16,1,.3,1);position:relative;overflow:hidden;
  min-width:0;
}
.soc-stat-block::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2.5px;
  background:linear-gradient(90deg,var(--brand-l),var(--brand-d));
  opacity:0;transition:opacity .28s;
}
.soc-stat-block:hover{background:var(--card);border-color:rgba(27,107,58,.28);box-shadow:0 6px 18px rgba(27,107,58,.1);transform:translateY(-2px)}
.soc-stat-block:hover::before{opacity:1}
.soc-stat-num{font-size:22px;font-weight:900;color:var(--ink);letter-spacing:-.03em;line-height:1.1}
.soc-stat-label{font-size:11px;color:var(--muted);font-weight:700}

/* أزرار الإجراءات */
.soc-profile-actions{display:flex;gap:10px;flex-wrap:wrap}
.soc-follow-btn{
  flex:1;padding:11px 18px;border-radius:var(--rpill);font-size:13px;font-weight:800;
  font-family:var(--f-ui);cursor:pointer;border:none;
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  color:#fff;display:flex;align-items:center;justify-content:center;gap:7px;
  box-shadow:0 4px 16px rgba(27,107,58,.32),inset 0 1px 0 rgba(255,255,255,.18);
  transition:all .28s cubic-bezier(.34,1.56,.64,1);position:relative;overflow:hidden;
}
.soc-follow-btn::after{
  content:'';position:absolute;top:-50%;left:-60%;width:60%;height:200%;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.22),transparent);
  transform:skewX(-20deg);transition:left .5s ease;
}
.soc-follow-btn:hover{transform:translateY(-2px) scale(1.02);box-shadow:0 7px 22px rgba(27,107,58,.45)}
.soc-follow-btn:hover::after{left:130%}
.soc-follow-btn.following{background:transparent;color:var(--brand);border:2px solid var(--brand-l);box-shadow:none;}
.soc-follow-btn.following:hover{background:#fdecea;border-color:#e74c3c;color:#e74c3c}
.soc-follow-btn svg{width:14px;height:14px}
.soc-msg-btn{
  flex:1;padding:11px 16px;border-radius:var(--rpill);font-size:13px;font-weight:700;
  font-family:var(--f-ui);cursor:pointer;
  border:1.5px solid var(--line);background:var(--bg2);color:var(--ink);
  transition:all .24s cubic-bezier(.16,1,.3,1);
  display:flex;align-items:center;justify-content:center;gap:6px;
}
.soc-msg-btn:hover{border-color:var(--brand-l);background:var(--brand-pale);color:var(--brand);transform:translateY(-1px)}

.soc-notif-bell-btn{
  flex-shrink:0;width:42px;height:42px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  border:1.5px solid var(--line);background:var(--bg2);color:var(--ink);
  cursor:pointer;transition:all .24s cubic-bezier(.16,1,.3,1);
}
.soc-notif-bell-btn:hover{border-color:var(--brand-l);background:var(--brand-pale);color:var(--brand);transform:translateY(-1px)}
.soc-notif-bell-btn svg{width:16px;height:16px}

/* تابات البروفايل */
.soc-profile-tabs{
  display:flex;background:var(--glass);
  border-bottom:1.5px solid var(--line);
  position:sticky;top:110px;z-index:9;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  box-shadow:0 2px 8px rgba(0,0,0,.04);
}
.soc-pt{
  flex:1;padding:13px 5px;text-align:center;font-size:12px;font-weight:700;
  color:var(--muted);cursor:pointer;border-bottom:2.5px solid transparent;
  transition:all .24s cubic-bezier(.16,1,.3,1);
  background:none;border-left:none;border-right:none;border-top:none;
  font-family:var(--f-ui);
}
.soc-pt:hover{color:var(--brand);background:var(--brand-pale)}
.soc-pt.active{color:var(--brand);border-bottom-color:var(--brand);background:var(--brand-pale);font-weight:800;}

.soc-profile-content{min-height:40vh}
.soc-profile-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;padding:52px 20px;text-align:center;gap:10px;color:var(--muted);}
.soc-profile-empty svg{opacity:.18}
.soc-profile-empty-title{font-size:14.5px;font-weight:700;color:var(--ink)}
.soc-profile-products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:2px;padding:2px}
.soc-profile-product-thumb{aspect-ratio:1;overflow:hidden;position:relative;cursor:pointer;background:var(--line)}
.soc-profile-product-thumb img{width:100%;height:100%;object-fit:cover;transition:transform .35s cubic-bezier(.16,1,.3,1)}
.soc-profile-product-thumb:hover img{transform:scale(1.08)}
.soc-profile-product-thumb-overlay{
  position:absolute;inset:0;background:rgba(0,0,0,0);
  display:flex;align-items:center;justify-content:center;transition:background .22s;
}
.soc-profile-product-thumb:hover .soc-profile-product-thumb-overlay{background:rgba(0,0,0,.38)}
.soc-profile-product-thumb-overlay span{color:#fff;font-size:11.5px;font-weight:800;opacity:0;transition:opacity .22s}
.soc-profile-product-thumb:hover .soc-profile-product-thumb-overlay span{opacity:1}

/* followers / following list */
.soc-user-list-header{
  display:flex;align-items:center;gap:8px;padding:13px 16px;
  font-size:15px;font-weight:900;color:var(--ink);
  border-bottom:1px solid var(--line);cursor:pointer;
  background:var(--glass);backdrop-filter:blur(14px);
  position:sticky;top:110px;z-index:10;transition:background .15s;
}
.soc-user-list-header:hover{background:var(--bg2)}
.soc-user-item{
  display:flex;align-items:center;gap:10px;padding:12px 16px;
  border-bottom:1px solid var(--line);transition:background .15s;
  cursor:pointer;animation:socCardIn .3s ease both;
}
.soc-user-item:hover{background:var(--bg2)}
.soc-user-item-info{flex:1}
.soc-user-item-name{font-size:13px;font-weight:800;color:var(--ink)}
.soc-user-item-handle{font-size:11px;color:var(--muted)}
.soc-user-item-bio{font-size:11.5px;color:var(--ink2);margin-top:2px;line-height:1.4}

/* modal */
.soc-modal-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.68);
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  z-index:3000;display:flex;align-items:center;justify-content:center;
  padding:20px;opacity:0;pointer-events:none;
  transition:opacity .28s ease;box-sizing:border-box;
}
.soc-modal-overlay.open{opacity:1;pointer-events:all}
.soc-modal{
  width:100%;max-width:500px;max-height:82vh;background:var(--card);
  border-radius:24px;overflow-y:auto;-webkit-overflow-scrolling:touch;
  transform:scale(.92) translateY(16px);
  transition:transform .36s cubic-bezier(.16,1,.3,1),opacity .28s;
  opacity:0;
  box-shadow:0 32px 80px rgba(0,0,0,.42),0 0 0 1px rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.1);
}
.soc-modal-overlay.open .soc-modal{transform:scale(1) translateY(0);opacity:1}
.soc-modal-header{
  display:flex;align-items:center;justify-content:space-between;padding:16px 18px;
  border-bottom:1px solid var(--line);font-size:15px;font-weight:900;color:var(--ink);
  position:sticky;top:0;background:var(--glass);backdrop-filter:blur(16px);z-index:1;
  border-radius:24px 24px 0 0;
}
.soc-modal-header span{font-family:var(--f-ui)}
.soc-modal-close{
  width:32px;height:32px;border-radius:50%;background:var(--bg2);border:none;
  cursor:pointer;display:flex;align-items:center;justify-content:center;
  color:var(--muted);transition:all .2s;
}
.soc-modal-close:hover{background:var(--line);color:var(--ink);transform:rotate(90deg)}
.soc-modal-body{padding:16px}
.soc-post-textarea{
  width:100%;min-height:120px;resize:none;
  border:1.5px solid var(--line);border-radius:14px;
  padding:12px 14px;font-size:16px;line-height:1.65;
  font-family:var(--f-ui);color:var(--ink);background:var(--bg2);
  outline:none;transition:border-color .2s,box-shadow .2s;
  box-sizing:border-box;display:block;-webkit-appearance:none;
  direction:rtl;text-align:right;
}
.soc-post-textarea:focus{border-color:var(--brand-l);background:var(--bg);box-shadow:0 0 0 3px rgba(27,107,58,.1)}
.soc-post-images-preview{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.soc-post-img-preview-item{width:72px;height:72px;border-radius:10px;overflow:hidden;position:relative}
.soc-post-img-preview-item img{width:100%;height:100%;object-fit:cover}
.soc-post-img-remove{
  position:absolute;top:3px;left:3px;width:19px;height:19px;
  background:rgba(0,0,0,.65);color:#fff;border-radius:50%;border:none;
  cursor:pointer;font-size:10.5px;display:flex;align-items:center;justify-content:center;
}
.soc-post-options-bar{display:flex;align-items:center;gap:7px;padding:10px 0;border-top:1px solid var(--line);margin-top:11px}
.soc-post-opt-btn{
  min-width:36px;height:36px;padding:0 10px;border-radius:10px;
  background:var(--bg2);border:1.5px solid var(--line);cursor:pointer;
  display:flex;align-items:center;justify-content:center;gap:5px;
  color:var(--muted);transition:all .2s;font-family:var(--f-ui);
}
.soc-post-opt-btn:hover{border-color:var(--brand-l);color:var(--brand);background:var(--brand-pale)}
.soc-post-submit-btn{
  margin-right:auto;padding:9px 24px;border-radius:var(--rpill);
  background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
  color:#fff;font-size:13px;font-weight:800;font-family:var(--f-ui);
  border:none;cursor:pointer;
  box-shadow:0 4px 16px rgba(27,107,58,.32);
  transition:all .28s cubic-bezier(.34,1.56,.64,1);
  display:flex;align-items:center;gap:6px;
}
.soc-post-submit-btn:hover{transform:scale(1.04) translateY(-1px);box-shadow:0 7px 22px rgba(27,107,58,.48)}
.soc-post-submit-btn:disabled{opacity:.5;pointer-events:none}
.soc-edit-field{margin-bottom:13px}
.soc-edit-label{font-size:11px;font-weight:900;color:var(--muted);letter-spacing:.06em;text-transform:uppercase;margin-bottom:5px}
.soc-edit-input{
  width:100%;padding:9px 13px;border:1.5px solid var(--line);border-radius:10px;
  font-size:16px;font-family:var(--f-ui);color:var(--ink);background:var(--bg2);
  outline:none;transition:border-color .2s,box-shadow .2s;
  /* font-size:16px يمنع iOS من عمل zoom تلقائي عند الكتابة */
}
.soc-edit-input:focus{border-color:var(--brand-l);box-shadow:0 0 0 3px rgba(27,107,58,.09)}
.soc-edit-textarea{resize:none;min-height:72px}

/* toast */
.soc-msg-toast{
  position:fixed;bottom:90px;left:50%;transform:translateX(-50%) translateY(12px);
  background:rgba(18,32,22,.96);color:#fff;
  padding:10px 20px 10px 14px;
  border-radius:20px;font-size:13px;font-weight:700;
  z-index:4000;opacity:0;pointer-events:none;
  transition:all .34s cubic-bezier(.16,1,.3,1);white-space:nowrap;
  box-shadow:0 16px 48px rgba(0,0,0,.32),0 4px 16px rgba(0,0,0,.16),0 0 0 1px rgba(255,255,255,.08);
  border:1px solid rgba(255,255,255,.1);
  display:flex;align-items:center;gap:9px;
  backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
}
.soc-msg-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

/* notifications - premium */
.soc-notif-item{
  display:flex;align-items:flex-start;gap:12px;padding:14px 16px;
  border-bottom:1px solid var(--line);transition:background .18s,transform .18s;
  cursor:pointer;animation:socCardIn .3s ease both;position:relative;
}
.soc-notif-item:hover{background:var(--bg2);transform:translateX(-2px)}
.soc-notif-item.unread{background:var(--brand-pale);border-right:3px solid var(--brand-l)}
.soc-notif-item.unread::before{content:'';position:absolute;right:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,var(--brand-l),var(--brand-d));border-radius:0 3px 3px 0}
.soc-notif-icon{
  width:38px;height:38px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;flex-shrink:0;
  box-shadow:0 2px 10px rgba(0,0,0,.1);
}
.soc-notif-icon.follow{background:rgba(27,107,58,.15);color:var(--brand)}
.soc-notif-icon.like{background:rgba(231,76,60,.12);color:#e74c3c}
.soc-notif-icon.comment{background:rgba(21,101,192,.12);color:#5b9bd5}
/* dark mode: الألوان بتشتغل تلقائياً لأنها rgba شفافة على الـ card */
.soc-notif-icon svg{width:16px;height:16px}
.soc-notif-text{flex:1;font-size:12.5px;line-height:1.55;color:var(--ink)}
.soc-notif-text strong{font-weight:800;color:var(--brand)}
.soc-notif-time{font-size:10.5px;color:var(--muted);white-space:nowrap;margin-top:2px}

/* lightbox */
.soc-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:5000;display:none;align-items:center;justify-content:center}
.soc-lightbox.open{display:flex;animation:socFadeIn .22s ease both}
.soc-lightbox img{max-width:95vw;max-height:92vh;object-fit:contain;border-radius:12px}
.soc-lightbox-close{
  position:absolute;top:14px;left:14px;width:42px;height:42px;
  background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);
  border-radius:50%;cursor:pointer;color:#fff;font-size:19px;
  display:flex;align-items:center;justify-content:center;transition:background .2s;
}
.soc-lightbox-close:hover{background:rgba(255,255,255,.3)}

/* responsive */
@media(max-width:700px){
  .soc-feed-header,.soc-profile-tabs,.soc-user-list-header{top:58px}
  .soc-profile-cover{height:200px}
  .soc-profile-cover-wrap{padding-bottom:52px}
  .soc-avatar-xl{width:100px;height:100px;font-size:33px}
  .soc-profile-avatar-container{right:12px}
  .soc-profile-header{padding:12px 14px 18px 14px;}
  .soc-profile-avatar-spacer{width:176px;}
  .soc-profile-name{font-size:17px}
  .soc-stat-num{font-size:19px}
  .soc-profile-stats{gap:7px}
  .soc-stat-block{padding:12px 4px;border-radius:12px}
}
`;
  const style = document.createElement('style');
  style.id = 'soc-styles-v3';
  const old = document.getElementById('soc-styles-v3');
  if (old) old.remove();
  style.textContent = css;
  document.head.appendChild(style);
})();



/* ── SOCIAL MODULE LOGIC ────────────────────────────────────── */
(function() {
'use strict';

const S = {
  uid: null,
  profile: null,
  feedTab: 'following',
  feedLast: null,
  feedLoading: false,
  profileUid: null,
  imgs: [],
  initialized: false,
  authReady: false,
  _authListeners: [],
  followingSet: new Set(), // الحسابات اللي بتتابعها
};

// Returns a promise that resolves once Firebase auth state is known
function waitForAuth() {
  return new Promise(resolve => {
    if (S.authReady) { resolve(); return; }
    // Add listener
    S._authListeners.push(resolve);
    // Safety timeout: resolve after 5s max so UI never hangs
    setTimeout(() => {
      const idx = S._authListeners.indexOf(resolve);
      if (idx !== -1) { S._authListeners.splice(idx, 1); resolve(); }
    }, 5000);
  });
}

const rel = ts => {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const s = (Date.now() - d) / 1000;
  if (s < 60) return 'الآن';
  if (s < 3600) return Math.floor(s/60) + ' دقيقة';
  if (s < 86400) return Math.floor(s/3600) + ' ساعة';
  if (s < 604800) return Math.floor(s/86400) + ' يوم';
  return d.toLocaleDateString('ar-EG',{day:'numeric',month:'short'});
};

const init = n => { if(!n)return'؟'; return n.trim().split(/\s+/).slice(0,2).map(w=>w[0]).join(''); };

const av = (p, sz='', uid='') => {
  const bg = p&&p.photoURL ? 'background:transparent;' : 'background:linear-gradient(145deg,var(--brand-l),var(--brand-d));';
  const oc = uid ? `onclick="SOCIAL.profile('${uid}')" style="cursor:pointer;"` : '';
  const inn = p&&p.photoURL ? `<img src="${p.photoURL}" alt="" loading="lazy">` : init(p&&(p.displayName||p.username));
  return `<div class="soc-avatar ${sz}" style="${bg}" ${oc}>${inn}</div>`;
};

const toast = (msg, type) => {
  const el = document.getElementById('soc-toast');
  if (!el) return;
  const svgOk   = `<svg viewBox="0 0 24 24" fill="none" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/><polyline points="7 12.5 10.5 16 17 9" stroke="#fff" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg>`;
  const svgErr  = `<svg viewBox="0 0 24 24" fill="none" style="width:15px;height:15px;flex-shrink:0"><circle cx="12" cy="12" r="10" stroke="rgba(255,100,100,.6)" stroke-width="1.5"/><line x1="8" y1="8" x2="16" y2="16" stroke="#ff8080" stroke-width="2.3" stroke-linecap="round"/><line x1="16" y1="8" x2="8" y2="16" stroke="#ff8080" stroke-width="2.3" stroke-linecap="round"/></svg>`;
  const icon = type === 'err' ? svgErr : svgOk;
  const cleanMsg = (typeof msg === 'string') ? msg.replace(/^[✅❌⚠️]\s?/,'') : msg;
  el.innerHTML = `${icon}<span>${cleanMsg}</span>`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2800);
};

const getDB = () => window.db || null;
const getAuth = () => window.auth || null;

// In-memory profile cache — eliminates repeated Firestore reads for same UID
const _profileCache = {};
async function getProfile(uid) {
  if (!uid) return null;
  if (_profileCache[uid]) return _profileCache[uid];
  const db = getDB(); if (!db) return null;
  try {
    const s = await db.collection('social_profiles').doc(uid).get();
    const data = s.exists ? s.data() : null;
    if (data) _profileCache[uid] = data;
    return data;
  } catch(e) { return null; }
}
function invalidateProfileCache(uid) {
  if (uid) delete _profileCache[uid];
}

async function ensureProfile(user) {
  const db = getDB(); if (!db || !user) return null;
  // Check cache first to avoid read on every auth state change
  if (_profileCache[user.uid]) return _profileCache[user.uid];
  const ref = db.collection('social_profiles').doc(user.uid);
  const snap = await ref.get();
  if (!snap.exists) {
    const p = {
      uid: user.uid,
      displayName: user.displayName || 'مزارع',
      username: (user.email||'').split('@')[0].replace(/[^a-z0-9_]/gi,'').toLowerCase() || 'u_'+user.uid.slice(-6),
      photoURL: user.photoURL || '',
      coverURL: '', bio: '', location: '', farmName: '',
      followersCount: 0, followingCount: 0, postsCount: 0, verified: false,
      joinedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await ref.set(p); _profileCache[user.uid] = p; return p;
  }
  const data = snap.data(); _profileCache[user.uid] = data; return data;
}

async function isFollowing(a, b) {
  try { const s = await getDB().collection('social_follows').doc(`${a}_${b}`).get(); return s.exists; }
  catch(e) { return false; }
}

async function follow(a, b) {
  const db = getDB();
  const FV = firebase.firestore.FieldValue;
  // سجّل المتابعة والإشعار
  await db.collection('social_follows').doc(`${a}_${b}`).set({ followerUid:a, targetUid:b, createdAt:FV.serverTimestamp() });
  db.collection('social_notifications').add({ toUid:b, fromUid:a, type:'follow', read:false, createdAt:FV.serverTimestamp() }).catch(()=>{});
  // تحديث العدادات — بتجاهل الخطأ لو الـ profile مش موجود
  db.collection('social_profiles').doc(a).update({ followingCount: FV.increment(1) }).catch(()=>{});
  db.collection('social_profiles').doc(b).update({ followersCount: FV.increment(1) }).catch(()=>{});
}

async function unfollow(a, b) {
  const db = getDB();
  const FV = firebase.firestore.FieldValue;
  // احذف المتابعة
  await db.collection('social_follows').doc(`${a}_${b}`).delete();
  // تحديث العدادات — بتجاهل الخطأ لو الـ profile مش موجود
  db.collection('social_profiles').doc(a).update({ followingCount: FV.increment(-1) }).catch(()=>{});
  db.collection('social_profiles').doc(b).update({ followersCount: FV.increment(-1) }).catch(()=>{});
}

const skel = () => Array(3).fill(0).map(()=>`<div class="soc-skeleton-card"><div class="soc-skel-row"><div class="soc-skel-circle"></div><div class="soc-skel-lines"><div class="soc-skel-line w70"></div><div class="soc-skel-line w40"></div></div></div><div class="soc-skel-line w100" style="margin-bottom:5px"></div><div class="soc-skel-line w70"></div><div class="soc-skel-img"></div></div>`).join('');

function postCard(id, p, auth, delay) {
  const liked = (p.likedBy  || []).includes(S.uid);
  const saved = (p.savedBy  || []).includes(S.uid);
  const a     = auth || { displayName: 'مستخدم' };
  const lf    = liked ? '#e05252' : 'none';
  const ls    = liked ? '#e05252' : 'currentColor';
  const sf    = saved ? 'currentColor' : 'none';

  /* images */
  let imgs = '';
  if (p.images && p.images.length) {
    const cls = p.images.length === 1 ? 'single' : 'grid2';
    imgs = `<div class="soc-post-images ${cls}">
  ${p.images.slice(0, 2).map(u =>
    `<img src="${u}" loading="lazy" onclick="SOCIAL.lb('${u}')" alt="">`
  ).join('')}
</div>`;
  }

  /* verified badge */
  const vb = a.verified
    ? `<span class="soc-verified-badge" title="موثّق"><svg viewBox="0 0 24 24" fill="none" style="width:100%;height:100%"><circle cx="12" cy="12" r="12" fill="url(#vgp)"/><defs><linearGradient id="vgp" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#2d9a58"/><stop offset="1" stop-color="#1a6b3a"/></linearGradient></defs><polyline points="7 12.2 10.5 15.5 17 9" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>`
    : '';

  /* farm pill */
  const farm = a.farmName
    ? `<span style="display:inline-flex;align-items:center;gap:3px;background:var(--brand-pale);color:var(--brand);font-size:10px;font-weight:700;padding:1px 7px;border-radius:99px;border:1px solid rgba(27,107,58,.12);">&#x1F33F; ${a.farmName}</span>`
    : '';

  /* stats row */
  const stats = (p.likesCount > 0 || p.commentsCount > 0) ? `
<div class="soc-post-stats">
  <span style="flex:1;display:flex;align-items:center;gap:8px;">
    ${p.likesCount > 0 ? `
    <span class="soc-post-stat-item">
      <svg viewBox="0 0 24 24" fill="${lf}" stroke="${ls}" stroke-width="2">
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
      </svg>
      ${p.likesCount}
    </span>` : ''}
    ${p.commentsCount > 0 ? `
    <span class="soc-post-stat-item" onclick="SOCIAL.cmts('${id}')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      ${p.commentsCount}
    </span>` : ''}
  </span>
</div>` : '';

  return `<div class="soc-post-card" style="animation-delay:${delay * .055}s" data-pid="${id}">

<div class="soc-post-header">
  ${av(a, 'soc-avatar-sm', p.authorUid)}
  <div class="soc-post-user-info">
    <div class="soc-post-username" onclick="SOCIAL.profile('${p.authorUid}')">
      ${a.displayName || 'مستخدم'}${vb}
    </div>
    <div class="soc-post-meta">
      ${farm ? farm + '<span class="soc-post-meta-dot"></span>' : ''}
      <span>${rel(p.createdAt)}</span>
      ${a.location ? `<span class="soc-post-meta-dot"></span><span>&#x1F4CD; ${a.location}</span>` : ''}
    </div>
  </div>
  <button class="soc-post-more-btn" onclick="SOCIAL.menu('${id}','${p.authorUid}')">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
    </svg>
  </button>
</div>

${p.text ? `<div class="soc-post-text">${p.text.replace(/\n/g,'<br>').replace(/#(\S+)/g,'<span class="soc-post-tag">#$1</span>')}</div>` : ''}
${imgs}
${stats}

<div class="soc-post-actions">
  <button class="soc-action-btn ${liked ? 'liked' : ''}" onclick="SOCIAL.like('${id}',this)">
    <svg viewBox="0 0 24 24" fill="${lf}" stroke="${ls}" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px;flex-shrink:0">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
    <span>إعجاب</span>
  </button>
  <button class="soc-action-btn" onclick="SOCIAL.cmts('${id}')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px;flex-shrink:0">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
    <span>تعليق</span>
  </button>
  <button class="soc-action-btn" onclick="SOCIAL.share('${id}')">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px;flex-shrink:0">
      <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
    </svg>
    <span>مشاركة</span>
  </button>
  <button class="soc-action-btn ${saved ? 'saved' : ''}" onclick="SOCIAL.save('${id}',this)">
    <svg viewBox="0 0 24 24" fill="${sf}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" style="width:16px;height:16px;flex-shrink:0">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
    </svg>
    <span>حفظ</span>
  </button>
</div>

<div class="soc-comments-wrap" id="cw-${id}">
  <div class="soc-comment-input-row">
    ${av(S.profile, 'soc-avatar-sm')}
    <input type="text" class="soc-comment-input" placeholder="اكتب تعليقاً..."
      id="ci-${id}" onkeydown="if(event.key==='Enter')SOCIAL.sendCmt('${id}')">
    <button class="soc-comment-send-btn" onclick="SOCIAL.sendCmt('${id}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <line x1="22" y1="2" x2="11" y2="13"/>
        <polygon points="22 2 15 22 11 13 2 9 22 2"/>
      </svg>
    </button>
  </div>
  <div id="cl-${id}"></div>
</div>

</div>`;
}


async function loadFeed(reset) {
  if (S.feedLoading) return;
  S.feedLoading = true;
  const db = getDB();
  const cont = document.getElementById('soc-posts');
  if (!cont || !db) { S.feedLoading=false; return; }
  if (reset) { cont.innerHTML=skel(); S.feedLast=null; }
  try {
    let q;
    if (S.feedTab==='following' && S.uid) {
      const fs = await db.collection('social_follows').where('followerUid','==',S.uid).get();
      const uids = fs.docs.map(d=>d.data().targetUid);
      uids.push(S.uid);
      // Firestore 'in' requires at least 1 element and max 10
      const safeUids = uids.slice(0,10);
      // No orderBy on 'in' query — avoids composite index; sort client-side
      q = db.collection('social_posts').where('authorUid','in',safeUids).limit(20);
    } else {
      // Explore: fetch posts, sort client-side
      q = db.collection('social_posts').limit(20);
    }
    if (S.feedLast && !reset) q = q.startAfter(S.feedLast);
    const snap = await q.get();
    // Sort client-side by createdAt descending (avoids composite index)
    const sortedDocs = snap.docs.slice().sort((a,b)=>{
      const ta=a.data().createdAt; const tb=b.data().createdAt;
      const sa=ta&&ta.seconds?ta.seconds:0; const sb=tb&&tb.seconds?tb.seconds:0;
      return sb-sa;
    });
    S.feedLast = sortedDocs[sortedDocs.length-1]||null;
    const uids2 = [...new Set(sortedDocs.map(d=>d.data().authorUid))];
    const pm = {}; await Promise.all(uids2.map(async u=>{pm[u]=await getProfile(u);}));
    if (sortedDocs.length === 0 && reset) {
      // If following tab is empty, suggest switching to explore
      const emptyMsg = S.feedTab==='following'
        ? `<div class="soc-profile-empty" style="margin:24px 13px;background:var(--card);border-radius:var(--r3);border:1px solid var(--line)"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div class="soc-profile-empty-title">لا توجد منشورات من المتابَعين بعد</div><button onclick="SOCIAL.ftab('explore')" style="margin-top:9px;padding:7px 18px;background:var(--brand);color:#fff;border:none;border-radius:var(--rpill);font-size:12.5px;font-weight:800;font-family:var(--f-ui);cursor:pointer">استكشاف عام</button></div>`
        : `<div class="soc-profile-empty" style="margin:24px 13px;background:var(--card);border-radius:var(--r3);border:1px solid var(--line)"><svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg><div class="soc-profile-empty-title">لا توجد منشورات بعد</div></div>`;
      cont.innerHTML = emptyMsg;
    } else {
      const html = sortedDocs.map((d,i)=>postCard(d.id,d.data(),pm[d.data().authorUid],i)).join('');
      if (reset) cont.innerHTML = html; else cont.insertAdjacentHTML('beforeend',html);
    }
    const lm = document.getElementById('soc-lm');
    if (lm) lm.style.display = sortedDocs.length < 7 ? 'none' : 'flex';
  } catch(e) {
    console.warn('loadFeed error:', e.code || e.message);
    if (reset) {
      const errMsg = e.code === 'permission-denied'
        ? 'لا توجد صلاحية للوصول — يُرجى مراجعة إعدادات Firebase'
        : 'حدث خطأ في تحميل المنشورات';
      if (cont) cont.innerHTML = `<div class="soc-profile-empty" style="margin:24px 13px;background:var(--card);border-radius:var(--r3);border:1px solid var(--line)">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
        <div class="soc-profile-empty-title">${errMsg}</div>
        <button onclick="loadFeed(true)" style="margin-top:9px;padding:7px 18px;background:var(--brand);color:#fff;border:none;border-radius:var(--rpill);font-size:12.5px;font-weight:800;font-family:var(--f-ui);cursor:pointer">إعادة المحاولة</button>
      </div>`;
    }
  }
  S.feedLoading = false;
}

async function suggestHtml() {
  const db = getDB(); if (!db) return '';
  try {
    // جيب الحسابات + الحسابات اللي بتتابعها في نفس الوقت
    const [snap, followSnap] = await Promise.all([
      db.collection('social_profiles').orderBy('followersCount','desc').get(),
      S.uid ? db.collection('social_follows').where('followerUid','==',S.uid).get() : Promise.resolve({docs:[]})
    ]);
    // حدّث الـ followingSet من Firestore عشان يكون دايماً sync
    followSnap.docs.forEach(d => S.followingSet.add(d.data().targetUid));
    // فلتر: مش انت + مش بتتابعه فعلاً
    const docs = snap.docs.filter(d=>d.id!==S.uid && !S.followingSet.has(d.id));
    if (!docs.length) return '';
    const cards = docs.map(d=>{
      const p=d.data();
      const inn = p.photoURL?`<img src="${p.photoURL}" loading="lazy" decoding="async" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`:init(p.displayName);
      const bg = p.photoURL?'background:transparent;':'background:linear-gradient(145deg,var(--brand-l),var(--brand-d));';
      return `<div class="soc-suggest-card" data-suggest-uid="${d.id}" onclick="SOCIAL.profile('${d.id}')">
<div class="soc-avatar" style="width:46px;height:46px;font-size:16px;margin:0 auto;${bg}">${inn}</div>
<div class="soc-suggest-name">${p.displayName||'مزارع'}</div>
<div class="soc-suggest-handle">${p.location||'@'+(p.username||'')}</div>
<button class="soc-suggest-follow-btn" onclick="event.stopPropagation();SOCIAL.follow('${d.id}',this)">متابعة</button>
</div>`;
    }).join('');
    if (!cards) return '';
    return `<div class="soc-suggest-section"><div class="soc-suggest-title">حسابات مقترحة</div><div class="soc-suggest-scroll">${cards}</div></div>`;
  } catch(e){return '';}
}

async function renderFeed() {
  const root = document.getElementById('social-feed-root');
  if (!root) return;

  const alreadyRendered = !!document.getElementById('soc-posts');
  if (alreadyRendered) { loadFeed(true); return; }

  root.innerHTML = `
<div class="soc-feed-header">
  <div class="soc-feed-title">
    <div class="soc-feed-title-icon">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    </div>
    المجتمع الزراعي
  </div>
  <div class="soc-feed-tabs">
    <button class="soc-ft active" id="sft-f" onclick="SOCIAL.ftab('following')">المتابَعون</button>
    <button class="soc-ft" id="sft-e" onclick="SOCIAL.ftab('explore')">استكشاف</button>
  </div>
</div>

${S.uid ? `
<div class="soc-create-card" onclick="SOCIAL.openPost()">
  ${av(S.profile, 'soc-avatar-sm')}
  <div style="flex:1">
    <div class="soc-create-placeholder" onclick="event.stopPropagation();SOCIAL.openPost()">
      شارك خبرتك الزراعية مع المجتمع...
    </div>
    <div class="soc-create-actions">
      <button class="soc-create-action-btn" onclick="event.stopPropagation();SOCIAL.openPost()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
        </svg>
        صورة
      </button>
      <button class="soc-create-action-btn" onclick="event.stopPropagation();SOCIAL.openPost()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2z"/>
        </svg>
        خبرة
      </button>
      <button class="soc-create-action-btn" onclick="event.stopPropagation();SOCIAL.openPost()">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
          <circle cx="12" cy="9" r="2.5"/>
        </svg>
        موقع
      </button>
    </div>
  </div>
</div>
` : `
<div style="margin:12px 13px 0;padding:14px 16px;
  background:linear-gradient(135deg,var(--brand-pale),rgba(27,107,58,.04));
  border-radius:18px;border:1.5px solid rgba(27,107,58,.15);
  display:flex;align-items:center;gap:10px;">
  <div style="width:36px;height:36px;border-radius:50%;flex-shrink:0;
    background:linear-gradient(135deg,var(--brand-l),var(--brand-d));
    display:flex;align-items:center;justify-content:center;color:#fff;">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
    </svg>
  </div>
  <div style="flex:1;font-size:13px;color:var(--brand);font-weight:700;">
    سجّل الدخول للتفاعل مع المجتمع الزراعي
  </div>
</div>
`}

<div id="soc-suggest-slot"></div>
<div id="soc-posts" style="padding-top:4px;">${skel()}</div>
<div class="soc-load-spinner" id="soc-lm" style="display:none;"><div class="soc-spinner"></div></div>`;

  const io = new IntersectionObserver(
    e => { if (e[0].isIntersecting && !S.feedLoading) loadFeed(false); },
    { threshold: .1 }
  );
  const lm = document.getElementById('soc-lm');
  if (lm) io.observe(lm);

  loadFeed(true);
  waitForAuth().then(() => suggestHtml()).then(sg => {
    const slot = document.getElementById('soc-suggest-slot');
    if (slot && sg) slot.outerHTML = sg;
  });
}


async function renderProfile(uid, isSelf) {
  const root = document.getElementById('social-profile-root');
  if (!root) return;
  root.innerHTML = `<div style="padding:55px;text-align:center"><div class="soc-load-spinner"><div class="soc-spinner"></div></div></div>`;

  const [p, fol] = await Promise.all([
    getProfile(uid),
    (S.uid && !isSelf) ? isFollowing(S.uid, uid) : Promise.resolve(false)
  ]);

  if (!p) {
    root.innerHTML = `<div class="soc-profile-empty"><div class="soc-profile-empty-title">الصفحة غير موجودة</div></div>`;
    return;
  }

  const cov = p.coverURL
    ? `background-image:url('${p.coverURL}');background-size:cover;background-position:center;`
    : `background:linear-gradient(135deg,var(--brand-d) 0%,var(--brand-l) 55%,var(--gold-l) 100%);`;

  const vb = p.verified
    ? `<span class="soc-verified-badge" title="موثّق"><svg viewBox="0 0 24 24" fill="none" style="width:100%;height:100%"><circle cx="12" cy="12" r="12" fill="url(#vg)"/><defs><linearGradient id="vg" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse"><stop stop-color="#2d9a58"/><stop offset="1" stop-color="#1a6b3a"/></linearGradient></defs><polyline points="7 12.2 10.5 15.5 17 9" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg></span>`
    : '';

  const svgFollow    = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
  const svgFollowing = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`;

  root.innerHTML = `
<div class="soc-profile-cover-wrap">
  <div class="soc-profile-cover" style="${cov}">
    <div class="soc-profile-cover-overlay"></div>

    ${isSelf ? `
    <button class="soc-cover-edit-btn" onclick="document.getElementById('soc-cover-input').click()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
      تغيير الغلاف
    </button>` : ''}
  </div>

  <!-- Avatar straddles cover/header boundary -->
  <div class="soc-profile-avatar-container">
    ${av(p, 'soc-avatar-xl')}
    ${isSelf ? `
    <button class="soc-avatar-edit-btn" onclick="document.getElementById('soc-avatar-input').click()">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
        <circle cx="12" cy="13" r="4"/>
      </svg>
    </button>` : ''}
  </div>
</div>

<div class="soc-profile-header">

  <!-- صف الاسم: spacer بعرض الأفاتار على اليمين + الاسم جنبه مباشرة -->
  <div class="soc-profile-top-row">
    <div class="soc-profile-avatar-spacer"></div>
    <div class="soc-profile-name-block">
      <div class="soc-profile-name">${p.displayName || 'مزارع'}${vb}</div>
    </div>
  </div>

  <!-- Email + join date -->
  <div class="soc-profile-meta-row" style="margin-top:12px;margin-bottom:14px;">
    ${isSelf && S.currentUser && S.currentUser.email ? `<span class="soc-profile-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2,4 12,13 22,4"/></svg>${S.currentUser.email}</span>` : ''}
    ${p.joinedAt  ? `<span class="soc-profile-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>انضم منذ ${rel(p.joinedAt)}</span>` : ''}
    ${p.location  ? `<span class="soc-profile-meta-item"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>${p.location}</span>` : ''}
  </div>

  ${p.farmName ? `<div class="soc-profile-farm-badge">&#x1F33F; ${p.farmName}</div>` : ''}
  ${p.bio      ? `<div class="soc-profile-bio">${p.bio}</div>` : ''}

  <!-- stat cards -->
  <div class="soc-profile-stats">
    <div class="soc-stat-block" onclick="SOCIAL.followers('${uid}')">
      <div class="soc-stat-num" id="spf">${p.followersCount || 0}</div>
      <div class="soc-stat-label">متابع</div>
    </div>
    <div class="soc-stat-block" onclick="SOCIAL.following('${uid}')">
      <div class="soc-stat-num">${p.followingCount || 0}</div>
      <div class="soc-stat-label">يتابع</div>
    </div>
    <div class="soc-stat-block">
      <div class="soc-stat-num">${p.postsCount || 0}</div>
      <div class="soc-stat-label">منشور</div>
    </div>
  </div>

  <!-- action buttons -->
  <div class="soc-profile-actions">
    ${isSelf ? `
    <button class="soc-follow-btn" onclick="SOCIAL.openEdit()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
      </svg>
      تعديل الصفحة
    </button>
    <button class="soc-msg-btn" onclick="SOCIAL.openPost()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
      </svg>
      منشور جديد
    </button>
    <button class="soc-notif-bell-btn" onclick="SOCIAL.notifications()" title="الإشعارات">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </button>` : `
    <button class="soc-follow-btn ${fol ? 'following' : ''}" id="sfbm" onclick="SOCIAL.follow('${uid}',this)">
      ${fol ? svgFollowing + ' تتابعه' : svgFollow + ' متابعة'}
    </button>
    <button class="soc-msg-btn" onclick="SOCIAL.soon()">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      مراسلة
    </button>`}
  </div>

</div><!-- end profile-header -->

<!-- profile tabs -->
<div class="soc-profile-tabs">
  <button class="soc-pt active" onclick="SOCIAL.ptab('posts','${uid}')">
    <span style="display:inline-flex;align-items:center;gap:4px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
      منشورات
    </span>
  </button>
  <button class="soc-pt" onclick="SOCIAL.ptab('photos','${uid}')">
    <span style="display:inline-flex;align-items:center;gap:4px;">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      صور
    </span>
  </button>
</div>

<div class="soc-profile-content" id="soc-pc">
  <div class="soc-load-spinner" style="padding:40px 0"><div class="soc-spinner"></div></div>
</div>`;

  ptab('posts', uid);
}


async function ptab(tab, uid) {
  const el = document.getElementById('soc-pc'); if (!el) return;
  document.querySelectorAll('.soc-pt').forEach((b,i)=>b.classList.toggle('active',['posts','photos'][i]===tab));
  el.innerHTML = `<div class="soc-load-spinner" style="padding:38px 0"><div class="soc-spinner"></div></div>`;
  // Safety timeout — if query hangs > 8s show error
  const spinTimeout = setTimeout(() => {
    if (el.querySelector('.soc-spinner')) {
      el.innerHTML = `<div class="soc-profile-empty"><div class="soc-profile-empty-title">انتهت مهلة التحميل — تحقق من الاتصال</div><button onclick="ptab('${tab}','${uid}')" style="margin-top:9px;padding:7px 18px;background:var(--brand);color:#fff;border:none;border-radius:var(--rpill);font-size:12.5px;font-weight:800;font-family:var(--f-ui);cursor:pointer">إعادة المحاولة</button></div>`;
    }
  }, 8000);
  const db = getDB();
  if (!db) {
    clearTimeout(spinTimeout);
    el.innerHTML = `<div class="soc-profile-empty"><div class="soc-profile-empty-title">تعذّر الاتصال بالخادم</div></div>`;
    return;
  }
  const emptyHtml = (icon, label) => `<div class="soc-profile-empty">${icon}<div class="soc-profile-empty-title">${label}</div></div>`;
  try {
    if (tab==='posts') {
      // No orderBy = no composite index needed; sort client-side
      const snap = await db.collection('social_posts').where('authorUid','==',uid).limit(15).get();
      if (snap.empty) { el.innerHTML=emptyHtml(`<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="3"/></svg>`,'لا توجد منشورات بعد'); return; }
      const sortedDocs = snap.docs.slice().sort((a,b)=>{ const ta=a.data().createdAt; const tb=b.data().createdAt; const sa=ta&&ta.seconds?ta.seconds:0; const sb=tb&&tb.seconds?tb.seconds:0; return sb-sa; });
      const authorProfile = await getProfile(uid);
      el.innerHTML = sortedDocs.map((d,i)=>postCard(d.id,d.data(),authorProfile,i)).join('');
    } else {
      // Photos tab — posts with images
      // No orderBy = no composite index needed
      const snap = await db.collection('social_posts').where('authorUid','==',uid).limit(30).get();
      const imgs=[]; snap.docs.forEach(d=>{ const dd=d.data(); if(dd.images&&dd.images.length) dd.images.forEach(u=>imgs.push(u)); });
      if(!imgs.length){el.innerHTML=emptyHtml(`<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,'لا توجد صور');return;}
      el.innerHTML=`<div class="soc-profile-products-grid">${imgs.map(u=>`<div class="soc-profile-product-thumb" onclick="SOCIAL.lb('${u}')"><img src="${u}" loading="lazy" style="width:100%;height:100%;object-fit:cover;"><div class="soc-profile-product-thumb-overlay"><span>عرض</span></div></div>`).join('')}</div>`;
    }
  } catch(e) {
    console.warn('ptab error', tab, e.code || e.message);
    clearTimeout(spinTimeout);
    const errLabel = (e.code === 'permission-denied' || e.code === 7)
      ? 'خطأ في الصلاحيات — افتح Firebase Console وحدّث Firestore Rules'
      : (e.code === 'failed-precondition' || e.code === 9)
      ? 'خطأ في Index — افتح Firebase Console وأضف Composite Index'
      : `خطأ (${e.code||'unknown'}): ${e.message||''}`;
    el.innerHTML = emptyHtml(`<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`, errLabel);
  } finally {
    clearTimeout(spinTimeout);
  }
}

async function renderFollowers(uid) {
  const root=document.getElementById('social-followers-root'); if(!root)return;
  root.innerHTML=`<div class="soc-load-spinner" style="padding:55px 0"><div class="soc-spinner"></div></div>`;
  const snap=await getDB().collection('social_follows').where('targetUid','==',uid).limit(30).get();
  const uids=snap.docs.map(d=>d.data().followerUid);
  const profs=await Promise.all(uids.map(getProfile));
  root.innerHTML=`<div class="soc-user-list-header" onclick="SOCIAL.backProfile()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>المتابعون (${snap.docs.length})</div>${uids.length===0?`<div class="soc-profile-empty"><div class="soc-profile-empty-title">لا يوجد متابعون بعد</div></div>`:profs.map((p,i)=>p?userItem(uids[i],p):'').join('')}`;
}

async function renderFollowing(uid) {
  const root=document.getElementById('social-following-root'); if(!root)return;
  root.innerHTML=`<div class="soc-load-spinner" style="padding:55px 0"><div class="soc-spinner"></div></div>`;
  const snap=await getDB().collection('social_follows').where('followerUid','==',uid).limit(30).get();
  const uids=snap.docs.map(d=>d.data().targetUid);
  // حدّث followingSet عشان الأزرار تظهر صح
  uids.forEach(id => S.followingSet.add(id));
  const profs=await Promise.all(uids.map(getProfile));
  root.innerHTML=`<div class="soc-user-list-header" onclick="SOCIAL.backProfile()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>يتابع (${snap.docs.length})</div>${uids.length===0?`<div class="soc-profile-empty"><div class="soc-profile-empty-title">لا يتابع أحدًا بعد</div></div>`:profs.map((p,i)=>p?userItem(uids[i],p):'').join('')}`;
}

async function renderNotifications() {
  const root = document.getElementById('social-notifications-root'); if (!root) return;
  const header = `<div class="soc-user-list-header" onclick="SOCIAL.backProfile()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>الإشعارات</div>`;
  const emptyHtml = (icon, label) => `<div class="soc-profile-empty">${icon}<div class="soc-profile-empty-title">${label}</div></div>`;
  const bellIcon = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`;
  const errIcon   = `<svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
  root.innerHTML = header + `<div class="soc-load-spinner" style="padding:55px 0"><div class="soc-spinner"></div></div>`;

  const db = getDB(); const uid = S.uid;
  if (!db || !uid) { root.innerHTML = header + emptyHtml(bellIcon, 'لا توجد إشعارات'); return; }

  // مهلة أمان — لو الاستعلام علّق أكتر من 8 ثواني نعرض رسالة بدل ما تفضل تلف للأبد
  const spinTimeout = setTimeout(() => {
    if (root.querySelector('.soc-spinner')) {
      root.innerHTML = header + `<div class="soc-profile-empty"><div class="soc-profile-empty-title">انتهت مهلة التحميل — تحقق من الاتصال</div><button onclick="SOCIAL.notifications()" style="margin-top:9px;padding:7px 18px;background:var(--brand);color:#fff;border:none;border-radius:var(--rpill);font-size:12.5px;font-weight:800;font-family:var(--f-ui);cursor:pointer">إعادة المحاولة</button></div>`;
    }
  }, 8000);

  try {
    // من غير orderBy عشان ميحتاجش composite index — الترتيب بيتم محليًا بعد الجلب
    const snap = await db.collection('social_notifications').where('toUid','==',uid).limit(30).get();
    if (snap.empty) { root.innerHTML = header + emptyHtml(bellIcon, 'لا توجد إشعارات بعد'); return; }
    const sortedDocs = snap.docs.slice().sort((a,b)=>{ const ta=a.data().createdAt; const tb=b.data().createdAt; const sa=ta&&ta.seconds?ta.seconds:0; const sb=tb&&tb.seconds?tb.seconds:0; return sb-sa; });
    const fromUids = [...new Set(sortedDocs.map(d=>d.data().fromUid))];
    const fpm = {}; await Promise.all(fromUids.map(async u=>{fpm[u]=await getProfile(u);}));
    const icons={follow:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`,like:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`,comment:`<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`};
    const msgs={follow:n=>`<strong>${n}</strong> بدأ في متابعة صفحتك`,like:n=>`<strong>${n}</strong> أعجب بمنشورك`,comment:n=>`<strong>${n}</strong> علّق على منشورك`};
    root.innerHTML = header + sortedDocs.map(doc=>{const n=doc.data(),fp=fpm[n.fromUid]||{displayName:'مستخدم'},t=n.type||'follow';return`<div class="soc-notif-item ${n.read?'':'unread'}" onclick="SOCIAL.profile('${n.fromUid}')"><div class="soc-notif-icon ${t}">${icons[t]||icons.follow}</div><div><div class="soc-notif-text">${(msgs[t]||msgs.follow)(fp.displayName||'مستخدم')}</div><div class="soc-notif-time">${rel(n.createdAt)}</div></div>${av(fp,'soc-avatar-sm')}</div>`;}).join('');
    sortedDocs.filter(d=>!d.data().read).forEach(d=>d.ref.update({read:true}));
  } catch(e) {
    console.warn('renderNotifications error', e.code || e.message);
    const errLabel = (e.code === 'permission-denied' || e.code === 7)
      ? 'خطأ في الصلاحيات — افتح Firebase Console وحدّث Firestore Rules'
      : (e.code === 'failed-precondition' || e.code === 9)
      ? 'خطأ في Index — افتح Firebase Console وأضف Composite Index'
      : `خطأ (${e.code||'unknown'}): ${e.message||''}`;
    root.innerHTML = header + emptyHtml(errIcon, errLabel);
  } finally {
    clearTimeout(spinTimeout);
  }
}

function userItem(uid, p) {
  const my = S.uid;
  if (!my || my === uid) return `<div class="soc-user-item" onclick="SOCIAL.profile('${uid}')">${av(p,'soc-avatar-sm')}<div class="soc-user-item-info"><div class="soc-user-item-name">${p.displayName||'مزارع'}</div><div class="soc-user-item-handle">@${p.username||uid.slice(0,8)}</div>${p.bio?`<div class="soc-user-item-bio">${p.bio.slice(0,52)}${p.bio.length>52?'...':''}</div>`:''}</div></div>`;
  const isFollowing = S.followingSet.has(uid);
  const svgFollow = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
  const svgFollowing = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`;
  return `<div class="soc-user-item" onclick="SOCIAL.profile('${uid}')">${av(p,'soc-avatar-sm')}<div class="soc-user-item-info"><div class="soc-user-item-name">${p.displayName||'مزارع'}</div><div class="soc-user-item-handle">@${p.username||uid.slice(0,8)}</div>${p.bio?`<div class="soc-user-item-bio">${p.bio.slice(0,52)}${p.bio.length>52?'...':''}</div>`:''}</div><button class="soc-follow-btn ${isFollowing?'following':''}" style="padding:6px 13px;font-size:11.5px;" onclick="event.stopPropagation();SOCIAL.follow('${uid}',this)">${isFollowing?svgFollowing+' تتابعه':svgFollow+' متابعة'}</button></div>`;
}

function injectGlobal() {
  if (document.getElementById('soc-g')) return;
  const el = document.createElement('div');
  el.id = 'soc-g';
  el.innerHTML = `
<div class="soc-msg-toast" id="soc-toast"></div>
<div class="soc-lightbox" id="soc-lb" onclick="if(event.target===this)SOCIAL.closeLb()">
  <button class="soc-lightbox-close" onclick="SOCIAL.closeLb()">✕</button>
  <img id="soc-lb-img" src="" alt="">
</div>
<div class="soc-modal-overlay" id="soc-pm" onclick="if(event.target===this)SOCIAL.closePost()">
  <div class="soc-modal" dir="rtl">
    <div class="soc-modal-header"><span>منشور جديد</span><button class="soc-modal-close" onclick="SOCIAL.closePost()">✕</button></div>
    <div class="soc-modal-body" style="padding:16px 15px 20px;">
      <div style="display:flex;gap:10px;align-items:flex-start;margin-bottom:10px;">
        <div id="soc-pma" style="flex-shrink:0;padding-top:2px;"></div>
        <textarea class="soc-post-textarea" id="soc-post-text"
          placeholder="شارك خبرتك الزراعية مع المجتمع..."
          dir="rtl" autocomplete="off" autocorrect="off" spellcheck="true"
          rows="4"
        ></textarea>
      </div>
      <div class="soc-post-images-preview" id="soc-pip"></div>
      <div class="soc-post-options-bar" style="display:flex;align-items:center;gap:8px;padding:10px 0 0;border-top:1px solid var(--line);margin-top:8px;flex-wrap:wrap;">
        <button class="soc-post-opt-btn" title="إضافة صورة" onclick="document.getElementById('soc-iu').click()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
          <span style="font-size:11px;font-weight:700;color:var(--muted)">صورة</span>
        </button>
        <input type="file" id="soc-iu" accept="image/*" multiple style="display:none" onchange="SOCIAL.imgUp(event)">
        <button class="soc-post-opt-btn" title="إضافة هاشتاق" onclick="document.getElementById('soc-post-text').value+=' #';document.getElementById('soc-post-text').focus()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/></svg>
          <span style="font-size:11px;font-weight:700;color:var(--muted)">#هاشتاق</span>
        </button>
        <button class="soc-post-submit-btn" id="soc-psb" onclick="SOCIAL.submitPost()" style="margin-right:auto;">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          نشر الآن
        </button>
      </div>
    </div>
  </div>
</div>
<input type="file" id="soc-avatar-input" accept="image/*" style="display:none" onchange="SOCIAL.uploadImg(event,'avatar')">
<input type="file" id="soc-cover-input" accept="image/*" style="display:none" onchange="SOCIAL.uploadImg(event,'cover')">

<!-- ── Post Action Sheet ── -->
<div class="soc-post-sheet-overlay" id="soc-pas" onclick="if(event.target===this)SOCIAL.closeSheet()">
  <div class="soc-post-sheet">
    <div class="soc-post-sheet-handle"></div>
    <div class="soc-post-sheet-title">خيارات المنشور</div>

    <!-- خيارات صاحب المنشور (أنا) -->
    <div id="soc-sheet-owner">
      <button class="soc-post-sheet-item" onclick="SOCIAL.closeSheet();SOCIAL.editPost(SOCIAL._sheetPid)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
        تعديل المنشور
      </button>
      <div class="soc-post-sheet-divider"></div>
      <button class="soc-post-sheet-item danger" onclick="SOCIAL.closeSheet();SOCIAL.confirmDelete(SOCIAL._sheetPid)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/><path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
        حذف المنشور
      </button>
    </div>

    <!-- خيارات منشور شخص آخر -->
    <div id="soc-sheet-other">
      <!-- متابعة — تظهر لو مش متابعه -->
      <button class="soc-post-sheet-item" id="soc-sheet-follow-btn" onclick="SOCIAL.closeSheet();SOCIAL.sheetFollow()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        متابعة
      </button>
      <!-- إلغاء متابعة — تظهر لو بتتابعه -->
      <button class="soc-post-sheet-item" id="soc-sheet-unfollow-btn" onclick="SOCIAL.closeSheet();SOCIAL.sheetFollow()">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        إلغاء المتابعة
      </button>
      <div class="soc-post-sheet-divider"></div>
      <button class="soc-post-sheet-item" onclick="SOCIAL.closeSheet();toast('تم الإبلاغ، شكراً')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/>
          <line x1="4" y1="22" x2="4" y2="15"/>
        </svg>
        الإبلاغ عن المنشور
      </button>
    </div>

    <button class="soc-post-sheet-cancel" onclick="SOCIAL.closeSheet()">إلغاء</button>
  </div>
</div>
<div class="soc-modal-overlay" id="soc-em" onclick="if(event.target===this)SOCIAL.closeEdit()">
  <div class="soc-modal" dir="rtl">
    <div class="soc-modal-header"><span>تعديل الصفحة</span><button class="soc-modal-close" onclick="SOCIAL.closeEdit()">✕</button></div>
    <div class="soc-modal-body">
      <div class="soc-edit-field"><div class="soc-edit-label">الاسم</div><input type="text" class="soc-edit-input" id="soc-en" placeholder="اسمك الكامل"></div>
      <div class="soc-edit-field"><div class="soc-edit-label">اسم المستخدم</div><input type="text" class="soc-edit-input" id="soc-eu" placeholder="username"></div>
      <div class="soc-edit-field"><div class="soc-edit-label">اسم المزرعة</div><input type="text" class="soc-edit-input" id="soc-ef" placeholder="مزرعة ..."></div>
      <div class="soc-edit-field"><div class="soc-edit-label">نبذة تعريفية</div><textarea class="soc-edit-input soc-edit-textarea" id="soc-eb" placeholder="اكتب نبذة عن نشاطك..."></textarea></div>
      <div class="soc-edit-field"><div class="soc-edit-label">الموقع</div><input type="text" class="soc-edit-input" id="soc-el" placeholder="المحافظة / المدينة"></div>
      <button class="soc-post-submit-btn" id="soc-esb" style="width:100%;justify-content:center;margin-top:3px;" onclick="SOCIAL.saveProfile()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>حفظ التغييرات</button>
    </div>
  </div>
</div>`;
  document.body.appendChild(el);
}

// Social panels that SOCIAL module manages directly
const SOCIAL_PANELS = ['feed','profile-me','followers','following','notifications'];

function switchPanel(name) {
  const isSocialPanel = SOCIAL_PANELS.includes(name);

  if (isSocialPanel) {
    // For social panels: manage directly without waiting for MKT animation
    // Remove active from all panels
    document.querySelectorAll('.mkt-panel').forEach(p => {
      p.classList.remove('active');
      p.classList.remove('leaving');
    });
    // Activate the target panel immediately
    const panel = document.getElementById('mkt-panel-' + name);
    if (panel) panel.classList.add('active');
    // Update tab highlight
    document.querySelectorAll('.mkt-tab').forEach(t => t.classList.remove('active'));
    const tab = document.getElementById('mkt-tab-' + name);
    if (tab) tab.classList.add('active');
    // Reset MKT transitioning flag so MKT isn't stuck
    if (window.mktState) window.mktState._transitioning = false;
  } else {
    // Non-social panels: delegate to MKT
    if (window.MKT && window.MKT.showPanel) window.MKT.showPanel(name);
  }
}

/* ─── PUBLIC API ─────────────────────────────────────────────── */
window.SOCIAL = {
  async init() {
    if (S.initialized) return;
    S.initialized = true;
    injectGlobal();
    const auth = getAuth(); 
    if (!auth) {
      // Firebase not ready yet, retry after short delay
      S.initialized = false;
      setTimeout(() => SOCIAL.init(), 500);
      return;
    }
    auth.onAuthStateChanged(async user => {
      S.uid = user ? user.uid : null;
      S.currentUser = user || null;
      S.profile = user ? await ensureProfile(user) : null;
      if (user && S.profile) {
        // ── إعادة حساب العدادات من social_follows لضمان دقتها ──
        const db = getDB();
        if (db) {
          try {
            const [followersSnap, followingSnap] = await Promise.all([
              db.collection('social_follows').where('targetUid',  '==', user.uid).get(),
              db.collection('social_follows').where('followerUid','==', user.uid).get()
            ]);
            const realFollowers = followersSnap.size;
            const realFollowing = followingSnap.size;
            // حدّث Firestore بس لو العدادات مختلفة
            const updates = {};
            if (S.profile.followersCount !== realFollowers) updates.followersCount = realFollowers;
            if (S.profile.followingCount  !== realFollowing) updates.followingCount  = realFollowing;
            if (Object.keys(updates).length > 0) {
              db.collection('social_profiles').doc(user.uid).update(updates).catch(()=>{});
              S.profile = { ...S.profile, ...updates };
              invalidateProfileCache(user.uid);
              _profileCache[user.uid] = S.profile;
            }
          } catch(e) { /* بتجاهل هادئ لو مفيش صلاحية */ }
        }
      }
      if (!S.authReady) {
        S.authReady = true;
        S._authListeners.forEach(fn => fn());
        S._authListeners = [];
      }
    });
  },

  async show(name) {
    switchPanel(name);
    await waitForAuth();
    if (name==='feed') renderFeed();
    if (name==='profile-me') {
      if (S.uid) { S.profileUid=S.uid; renderProfile(S.uid,true); }
      else {
        const r=document.getElementById('social-profile-root');
        if(r) r.innerHTML=`<div class="soc-profile-empty" style="padding:65px 20px;"><svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".25"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg><div class="soc-profile-empty-title">سجّل الدخول لعرض صفحتك</div></div>`;
      }
    }
  },

  async profile(uid) {
    if (!uid) return;
    S.profileUid = uid;
    switchPanel('profile-me');
    await waitForAuth();
    const isSelf = uid===S.uid;
    renderProfile(uid,isSelf);
  },

  ftab(tab) {
    S.feedTab=tab;
    document.querySelectorAll('.soc-ft').forEach(b=>b.classList.toggle('active',(tab==='following'&&b.id==='sft-f')||(tab==='explore'&&b.id==='sft-e')));
    loadFeed(true);
  },

  ptab(tab, uid) { ptab(tab, uid||S.profileUid); },

  async follow(targetUid, btn) {
    // استنى الـ auth يكون جاهز الأول
    await waitForAuth();
    if (!S.uid){toast('سجّل الدخول أولاً');return;}
    // منع الضغط المزدوج
    if (btn._following) return;
    btn._following = true;
    btn.disabled = true;
    const curr = btn.classList.contains('following');
    const svgFollow = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>`;
    const svgFollowing = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>`;
    try {
      if (curr) {
        await unfollow(S.uid, targetUid);
        S.followingSet.delete(targetUid);
        btn.classList.remove('following');
        btn.innerHTML = svgFollow + ' متابعة';
        toast('تم إلغاء المتابعة');
      } else {
        await follow(S.uid, targetUid);
        S.followingSet.add(targetUid);
        btn.classList.add('following');
        btn.innerHTML = svgFollowing + ' تتابعه';
        toast('✅ تم المتابعة');
        // إخفاء كل كروت هذا الحساب من الحسابات المقترحة
        document.querySelectorAll(`[data-suggest-uid="${targetUid}"]`).forEach(card => {
          card.style.transition = 'opacity .3s, transform .3s';
          card.style.opacity = '0';
          card.style.transform = 'scale(0.85)';
          setTimeout(() => { card.remove(); }, 300);
        });
      }
      // ── 1. حدّث followersCount لو بتفرج على صفحة الشخص ده ──
      if (S.profileUid === targetUid) {
        const el = document.getElementById('spf');
        if (el) {
          const current = parseInt(el.textContent) || 0;
          el.textContent = curr ? Math.max(0, current - 1) : current + 1;
        }
        invalidateProfileCache(targetUid);
      }
      // ── 2. حدّث followingCount في صفحتي أنا optimistic ──
      if (S.profile) {
        S.profile.followingCount = (S.profile.followingCount || 0) + (curr ? -1 : 1);
        if (S.profile.followingCount < 0) S.profile.followingCount = 0;
        // لو بتفرج على صفحتك دلوقتي حدّث الـ DOM مباشرة
        if (S.profileUid === S.uid) {
          const statBlocks = document.querySelectorAll('.soc-stat-block');
          // الترتيب: متابع [0]، يتابع [1]، منشور [2]
          if (statBlocks[1]) {
            const numEl = statBlocks[1].querySelector('.soc-stat-num');
            if (numEl) numEl.textContent = S.profile.followingCount;
          }
        }
        invalidateProfileCache(S.uid);
      }
    } catch(e) {
      // رجّع الـ UI للحالة الأصلية لو فشل
      btn.classList.toggle('following', curr);
      btn.innerHTML = curr ? (svgFollowing + ' تتابعه') : (svgFollow + ' متابعة');
      const msg = e.code === 'permission-denied'
        ? 'تحقق من Firestore Rules في Firebase Console'
        : 'حدث خطأ، حاول مرة أخرى';
      toast(msg);
      console.error('follow error:', e.code, e.message);
    }
    btn._following = false;
    btn.disabled = false;
  },

  async like(postId, btn) {
    if (!S.uid) { toast('سجّل الدخول أولاً'); return; }
    const db = getDB(); if (!db) { toast('سجّل الدخول أولاً'); return; }
    if (btn._liking) return;
    btn._liking = true;

    // ── Optimistic UI update immediately ──
    const wasLiked = btn.classList.contains('liked');
    const svg = btn.querySelector('svg');
    const applyLiked = (on) => {
      btn.classList.toggle('liked', on);
      if (svg) {
        svg.setAttribute('fill', on ? '#e74c3c' : 'none');
        svg.setAttribute('stroke', on ? '#e74c3c' : 'currentColor');
      }
    };
    applyLiked(!wasLiked);
    if (!wasLiked) {
      btn.style.transform = 'scale(1.3)';
      setTimeout(() => { btn.style.transform = ''; }, 220);
    }

    try {
      const ref = db.collection('social_posts').doc(postId);
      const FV = firebase.firestore.FieldValue;
      await ref.update({
        likesCount: FV.increment(wasLiked ? -1 : 1),
        likedBy: wasLiked ? FV.arrayRemove(S.uid) : FV.arrayUnion(S.uid)
      });

      // Send notification async — don't await, don't block like
      if (!wasLiked) {
        ref.get().then(snap => {
          if (snap.exists && snap.data().authorUid !== S.uid) {
            db.collection('social_notifications').add({
              toUid: snap.data().authorUid, fromUid: S.uid,
              type: 'like', postId, read: false,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch(e) {
      applyLiked(wasLiked); // revert
      const msg = e.code === 'permission-denied'
        ? 'تحقق من Firestore Rules في Firebase Console'
        : 'حدث خطأ، حاول مرة أخرى';
      toast(msg);
      console.error('like error:', e.code, e.message);
    }
    btn._liking = false;
  },

  async save(postId, btn) {
    if(!S.uid||!getDB()){toast('سجّل الدخول أولاً');return;}
    const ref=getDB().collection('social_posts').doc(postId);
    const snap=await ref.get(); const saved=(snap.data().savedBy||[]).includes(S.uid);
    await ref.update({savedBy:saved?firebase.firestore.FieldValue.arrayRemove(S.uid):firebase.firestore.FieldValue.arrayUnion(S.uid)});
    btn.classList.toggle('saved',!saved); const svg=btn.querySelector('svg'); if(svg) svg.setAttribute('fill',saved?'none':'currentColor');
    toast(saved?'تم إلغاء الحفظ':'✅ تم حفظ المنشور');
  },

  cmts(postId) { const el=document.getElementById(`cw-${postId}`); if(!el)return; const open=el.classList.toggle('open'); if(open) this.loadCmts(postId); },

  async loadCmts(postId) {
    const el=document.getElementById(`cl-${postId}`); if(!el||!getDB())return;
    const snap=await getDB().collection('social_posts').doc(postId).collection('comments').orderBy('createdAt','asc').limit(10).get();
    if(snap.empty){el.innerHTML='';return;}
    const uids=[...new Set(snap.docs.map(d=>d.data().authorUid))];
    const pm={}; await Promise.all(uids.map(async u=>{pm[u]=await getProfile(u);}));
    el.innerHTML=snap.docs.map(d=>{const c=d.data(),p=pm[c.authorUid]||{};return`<div class="soc-comment-item">${av(p,'soc-avatar-sm',c.authorUid)}<div class="soc-comment-bubble"><div class="soc-comment-author" onclick="SOCIAL.profile('${c.authorUid}')">${p.displayName||'مستخدم'}</div><div class="soc-comment-text">${c.text||''}</div><div class="soc-comment-time">${rel(c.createdAt)}</div></div></div>`;}).join('');
  },

  async sendCmt(postId) {
    if(!S.uid||!getDB()){toast('سجّل الدخول أولاً');return;}
    const inp=document.getElementById(`ci-${postId}`); const text=inp?inp.value.trim():''; if(!text)return;
    inp.value='';
    await getDB().collection('social_posts').doc(postId).collection('comments').add({authorUid:S.uid,text,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
    await getDB().collection('social_posts').doc(postId).update({commentsCount:firebase.firestore.FieldValue.increment(1)});
    await this.loadCmts(postId);
    const snap=await getDB().collection('social_posts').doc(postId).get();
    if(snap.data().authorUid!==S.uid) getDB().collection('social_notifications').add({toUid:snap.data().authorUid,fromUid:S.uid,type:'comment',postId,read:false,createdAt:firebase.firestore.FieldValue.serverTimestamp()});
  },

  share(postId) {
    const url=`${location.origin}${location.pathname}#post/${postId}`;
    if(navigator.share)navigator.share({title:'نبتيكس',url});else if(navigator.clipboard){navigator.clipboard.writeText(url);toast('✅ تم نسخ الرابط');}
    if(getDB())getDB().collection('social_posts').doc(postId).update({sharesCount:firebase.firestore.FieldValue.increment(1)});
  },

  menu(postId, authorUid) {
    this._sheetPid = postId;
    this._sheetAuthorUid = authorUid;
    const ov = document.getElementById('soc-pas'); if(!ov) return;
    const ownerDiv  = document.getElementById('soc-sheet-owner');
    const otherDiv  = document.getElementById('soc-sheet-other');
    const followBtn   = document.getElementById('soc-sheet-follow-btn');
    const unfollowBtn = document.getElementById('soc-sheet-unfollow-btn');

    if(S.uid === authorUid){
      // منشوري — أظهر خيارات التعديل/الحذف فقط
      if(ownerDiv)  ownerDiv.style.display  = '';
      if(otherDiv)  otherDiv.style.display  = 'none';
    } else {
      // منشور شخص آخر — أظهر متابعة أو إلغاء متابعة
      if(ownerDiv)  ownerDiv.style.display  = 'none';
      if(otherDiv)  otherDiv.style.display  = '';
      const isFollowing = S.followingSet.has(authorUid);
      if(followBtn)   followBtn.style.display   = isFollowing ? 'none' : '';
      if(unfollowBtn) unfollowBtn.style.display = isFollowing ? '' : 'none';
    }
    ov.classList.add('open');
  },

  closeSheet() {
    const ov = document.getElementById('soc-pas');
    if(ov) ov.classList.remove('open');
  },

  sheetFollow() {
    const uid = this._sheetAuthorUid; if(!uid || !S.uid) return;
    // ابنِ زر وهمي بالـ state الحالي وادّيه لـ follow() — ده يضمن منطق موحّد بدون تكرار
    const isFollowing = S.followingSet.has(uid);
    const fakeBtn = document.createElement('button');
    if(isFollowing) fakeBtn.classList.add('following');
    fakeBtn._following = false;
    this.follow(uid, fakeBtn);
  },

  confirmDelete(postId) {
    if(!postId) return;
    if(confirm('هل تريد حذف هذا المنشور نهائياً؟')) this.delPost(postId);
  },

  editPost(postId) {
    if(!postId) return;
    const db = getDB(); if(!db || !S.uid) return;
    db.collection('social_posts').doc(postId).get().then(doc => {
      if(!doc.exists) return toast('المنشور غير موجود');
      const data = doc.data();
      if(data.authorUid !== S.uid) return toast('ليس لديك صلاحية');
      // افتح modal النشر بالبيانات الحالية
      const m = document.getElementById('soc-pm'); if(!m) return;
      const ta = document.getElementById('soc-post-text'); if(!ta) return;
      ta.value = data.text || '';
      S.imgs = [];
      this.renderPrev();
      // غير الـ header ليعبر عن التعديل
      const header = m.querySelector('.soc-modal-header span');
      if(header) header.textContent = 'تعديل المنشور';
      // غير زر النشر ليحفظ التعديل
      const btn = document.getElementById('soc-psb'); if(!btn) return;
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> حفظ التعديل`;
      btn.onclick = () => this.saveEdit(postId);
      // أفاتار
      const pma = document.getElementById('soc-pma');
      if(pma) pma.innerHTML = av(S.profile,'soc-avatar-sm');
      m.classList.add('open');
      setTimeout(() => ta.focus(), 320);
    });
  },

  async saveEdit(postId) {
    const ta = document.getElementById('soc-post-text');
    const text = ta ? ta.value.trim() : '';
    if(!text) return toast('اكتب نصاً للمنشور');
    const db = getDB(); if(!db || !S.uid) return;
    const btn = document.getElementById('soc-psb');
    if(btn){ btn.disabled=true; btn.style.opacity='.6'; }
    // ── Optimistic: حدّث نص الكارد فوراً ──
    const card = document.querySelector(`[data-pid="${postId}"]`);
    const textEl = card ? card.querySelector('.soc-post-text') : null;
    const oldText = textEl ? textEl.textContent : '';
    if(textEl){
      textEl.textContent = text;
      // إضافة علامة "تم التعديل" خفيفة
      if(!card.querySelector('.soc-edited-badge')){
        textEl.insertAdjacentHTML('afterend','<span class="soc-edited-badge" style="font-size:10px;color:var(--muted);padding:0 14px 6px;display:block;">تم التعديل</span>');
      }
    }
    this.closePost();
    toast('✅ تم تعديل المنشور');
    // reset الزر للوضع الأصلي
    if(btn){
      btn.disabled=false; btn.style.opacity='';
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> نشر الآن`;
      btn.onclick = () => this.submitPost();
    }
    const header = document.querySelector('#soc-pm .soc-modal-header span');
    if(header) header.textContent = 'منشور جديد';
    // ── Firestore في الـ background ──
    try {
      await db.collection('social_posts').doc(postId).update({
        text,
        editedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    } catch(e) {
      // revert DOM
      if(textEl) textEl.textContent = oldText;
      toast('حدث خطأ، حاول مرة أخرى');
    }
  },

  async delPost(postId) {
    const db=getDB(); if(!db||!S.uid)return;
    // ── Optimistic: ازل الكارد فوراً ──
    const el=document.querySelector(`[data-pid="${postId}"]`);
    if(el){
      el.style.cssText='opacity:0;transform:scale(.95);transition:.28s ease;pointer-events:none;';
      setTimeout(()=>{ el.style.cssText='opacity:0;transform:scale(.95);max-height:0;overflow:hidden;margin:0;padding:0;transition:.25s ease;'; setTimeout(()=>el.remove(),260); },280);
    }
    // ── حدّث عداد المنشورات فوراً ──
    const sc = document.querySelector('.soc-stat-block:last-child .soc-stat-num');
    if(sc) sc.textContent = Math.max(0,(parseInt(sc.textContent)||1)-1);
    toast('✅ تم حذف المنشور');
    // ── Firestore في الـ background ──
    try {
      await db.collection('social_posts').doc(postId).delete();
      await db.collection('social_profiles').doc(S.uid).update({postsCount:firebase.firestore.FieldValue.increment(-1)});
    } catch(e){ toast('حدث خطأ في الحذف'); }
  },

  openPost() {
    if(!S.uid){toast('سجّل الدخول أولاً');return;}
    const m=document.getElementById('soc-pm'); if(!m)return;
    // Reset textarea first (before open so layout is calculated)
    const ta=document.getElementById('soc-post-text');
    if(ta){ ta.value=''; }
    S.imgs=[]; this.renderPrev();
    // Set avatar
    const pma=document.getElementById('soc-pma');
    if(pma) pma.innerHTML=av(S.profile,'soc-avatar-sm');
    // Open modal
    m.classList.add('open');
    // Delay focus until after animation (important for iOS)
    setTimeout(() => {
      const taFocus=document.getElementById('soc-post-text');
      if(taFocus){ taFocus.focus(); }
    }, 420);
  },
  closePost() {
    const m=document.getElementById('soc-pm');
    if(m) m.classList.remove('open');
  },

  imgUp(e) {
    Array.from(e.target.files).slice(0,4-S.imgs.length).forEach(f=>{
      const r=new FileReader(); r.onload=ev=>{S.imgs.push(ev.target.result);this.renderPrev();}; r.readAsDataURL(f);
    });
  },
  renderPrev() {
    const el=document.getElementById('soc-pip'); if(!el)return;
    el.innerHTML=S.imgs.map((u,i)=>`<div class="soc-post-img-preview-item"><img src="${u}"><button class="soc-post-img-remove" onclick="SOCIAL.rmImg(${i})">✕</button></div>`).join('');
  },
  rmImg(i) { S.imgs.splice(i,1); this.renderPrev(); },

  async submitPost() {
    const db=getDB(); if(!S.uid||!db)return;
    const ta=document.getElementById('soc-post-text'); const text=ta?ta.value.trim():'';
    if(!text&&S.imgs.length===0){toast('اكتب شيئاً أو أضف صورة');return;}
    const btn=document.getElementById('soc-psb'); if(btn)btn.disabled=true;
    // ── Optimistic: أضف المنشور للـ DOM فوراً ──
    const tempId = 'temp_'+Date.now();
    const tempData = {
      authorUid: S.uid, text, images: S.imgs.slice(),
      hasImages: S.imgs.length>0, likesCount:0, commentsCount:0,
      sharesCount:0, likedBy:[], savedBy:[],
      createdAt: {seconds: Math.floor(Date.now()/1000)}
    };
    const cont = document.getElementById('soc-posts');
    if(cont){
      const cardHtml = postCard(tempId, tempData, S.profile, 0);
      cont.insertAdjacentHTML('afterbegin', cardHtml);
      // أنيميشن ظهور
      const newCard = cont.querySelector('[data-pid="'+tempId+'"]');
      if(newCard){ newCard.style.cssText='opacity:0;transform:translateY(-12px);transition:.35s'; requestAnimationFrame(()=>{ newCard.style.cssText='opacity:1;transform:translateY(0);transition:.35s'; }); }
    }
    this.closePost();
    toast('✅ تم نشر المنشور');
    // ── حدّث عداد المنشورات في الـ stats ──
    const sc = document.querySelector('.soc-stat-block:last-child .soc-stat-num');
    if(sc) sc.textContent = (parseInt(sc.textContent)||0)+1;
    try {
      const ref = await db.collection('social_posts').add({authorUid:S.uid,text,images:S.imgs,hasImages:S.imgs.length>0,likesCount:0,commentsCount:0,sharesCount:0,likedBy:[],savedBy:[],createdAt:firebase.firestore.FieldValue.serverTimestamp(),updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
      await db.collection('social_profiles').doc(S.uid).update({postsCount:firebase.firestore.FieldValue.increment(1)});
      // استبدل الـ tempId بالـ id الحقيقي في الـ DOM
      const tempEl = document.querySelector('[data-pid="'+tempId+'"]');
      if(tempEl) tempEl.setAttribute('data-pid', ref.id);
    } catch(e){
      toast('حدث خطأ في النشر');
      // ازل الكارد المؤقت
      const tempEl = document.querySelector('[data-pid="'+tempId+'"]');
      if(tempEl) tempEl.remove();
    }
    if(btn)btn.disabled=false;
  },

  openEdit() {
    const p=S.profile; const m=document.getElementById('soc-em'); if(!m||!p)return;
    document.getElementById('soc-en').value=p.displayName||'';
    document.getElementById('soc-eu').value=p.username||'';
    document.getElementById('soc-ef').value=p.farmName||'';
    document.getElementById('soc-eb').value=p.bio||'';
    document.getElementById('soc-el').value=p.location||'';
    m.classList.add('open');
  },
  closeEdit() { const m=document.getElementById('soc-em'); if(m)m.classList.remove('open'); },

  async saveProfile() {
    const db=getDB(); if(!S.uid||!db)return;
    const btn=document.getElementById('soc-esb'); if(btn)btn.disabled=true;
    try {
      const u={
        displayName:document.getElementById('soc-en').value.trim(),
        username:document.getElementById('soc-eu').value.trim().toLowerCase().replace(/[^a-z0-9_]/g,''),
        farmName:document.getElementById('soc-ef').value.trim(),
        bio:document.getElementById('soc-eb').value.trim(),
        location:document.getElementById('soc-el').value.trim(),
        updatedAt:firebase.firestore.FieldValue.serverTimestamp()
      };
      // ── Optimistic: حدّث الـ DOM فوراً قبل Firestore ──
      S.profile={...S.profile,...u};
      invalidateProfileCache(S.uid);
      _profileCache[S.uid] = S.profile;
      // حدّث الاسم في صفحة البروفايل مباشرة
      const nameEl = document.querySelector('.soc-profile-name');
      if(nameEl && u.displayName){ const first=nameEl.firstChild; if(first&&first.nodeType===3) first.textContent=u.displayName; else nameEl.childNodes[0] && (nameEl.childNodes[0].textContent=u.displayName); }
      const bioEl = document.querySelector('.soc-profile-bio');
      if(bioEl && u.bio) bioEl.textContent=u.bio;
      this.closeEdit(); toast('✅ تم حفظ التغييرات');
      await db.collection('social_profiles').doc(S.uid).update(u);
      renderProfile(S.uid, true);
    }catch(e){toast('حدث خطأ');}
    if(btn)btn.disabled=false;
  },

  lb(url) { const lb=document.getElementById('soc-lb'); const img=document.getElementById('soc-lb-img'); if(!lb||!img)return; img.src=url; lb.classList.add('open'); },
  closeLb() { const lb=document.getElementById('soc-lb'); if(lb)lb.classList.remove('open'); },
  soon() { toast('📷 هذه الميزة قريباً'); },

  async uploadImg(e, type) {
    if (!S.uid) { toast('سجّل الدخول أولاً'); return; }
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('يُرجى اختيار صورة صالحة'); return; }
    if (file.size > 10 * 1024 * 1024) { toast('الصورة أكبر من 10MB'); return; }

    const isAvatar = (type === 'avatar');
    const fieldKey = isAvatar ? 'photoURL' : 'coverURL';

    // Show local preview immediately (Optimistic UI)
    const localURL = URL.createObjectURL(file);
    if (isAvatar) {
      const avatarEl = document.querySelector('.soc-avatar-xl');
      if (avatarEl) {
        avatarEl.style.background = 'transparent';
        avatarEl.innerHTML = `<img src="${localURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
      }
    } else {
      const cover = document.querySelector('.soc-profile-cover');
      if (cover) cover.style.backgroundImage = `url('${localURL}')`;
    }

    const input = document.getElementById(isAvatar ? 'soc-avatar-input' : 'soc-cover-input');
    if (input) input.disabled = true;
    toast('⏳ جاري معالجة الصورة...');

    try {
      // ── Compress image using Canvas ──────────────────────────
      const dataURL = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const maxW = isAvatar ? 400 : 1200;
          const maxH = isAvatar ? 400 : 400;
          let w = img.width, h = img.height;
          if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
          if (h > maxH) { w = Math.round(w * maxH / h); h = maxH; }
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', isAvatar ? 0.82 : 0.75));
        };
        img.onerror = reject;
        img.src = localURL;
      });
      URL.revokeObjectURL(localURL);

      toast('⏳ جاري الحفظ...');

      // ── Try Firebase Storage first ───────────────────────────
      let finalURL = dataURL; // fallback: store as base64 in Firestore
      const stor = window.storage;
      if (stor) {
        try {
          const path = `profile_photos/${S.uid}/${isAvatar ? 'avatar' : 'cover'}_${Date.now()}`;
          const storRef = stor.ref(path);
          // Convert dataURL back to blob for smaller storage transfer
          const res = await fetch(dataURL);
          const blob = await res.blob();
          const uploadTask = storRef.put(blob, { contentType: 'image/jpeg' });
          const storageURL = await new Promise((res, rej) => {
            uploadTask.on('state_changed',
              snap => {
                const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                toast(`⏳ جاري الرفع ${pct}%`);
              },
              err => rej(err),
              async () => {
                try { res(await uploadTask.snapshot.ref.getDownloadURL()); }
                catch(e) { rej(e); }
              }
            );
          });
          finalURL = storageURL; // Use Storage URL if succeeded
        } catch(storErr) {
          console.warn('Storage upload failed, using base64 fallback:', storErr.code);
          // finalURL stays as dataURL (base64 in Firestore)
        }
      }

      // ── Save URL to Firestore ────────────────────────────────
      const db = getDB();
      if (!db) throw new Error('db unavailable');
      await db.collection('social_profiles').doc(S.uid).set(
        { [fieldKey]: finalURL },
        { merge: true }
      );

      // Update local state + cache
      S.profile = { ...(S.profile || {}), [fieldKey]: finalURL };
      _profileCache[S.uid] = S.profile;

      // Update UI with final URL
      if (isAvatar) {
        const avatarEl = document.querySelector('.soc-avatar-xl');
        if (avatarEl) {
          avatarEl.innerHTML = `<img src="${finalURL}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`;
        }
      } else {
        const cover = document.querySelector('.soc-profile-cover');
        if (cover) cover.style.backgroundImage = `url('${finalURL}')`;
      }

      toast('✅ تم تغيير الصورة بنجاح');
    } catch (err) {
      console.error('uploadImg final error:', err.code, err.message);
      toast('حدث خطأ: ' + (err.code || err.message || 'غير معروف'));
      if (S.uid) renderProfile(S.uid, true);
    } finally {
      if (input) { input.disabled = false; input.value = ''; }
    }
  },

  followers(uid) { switchPanel('followers'); waitForAuth().then(()=>renderFollowers(uid)); },
  following(uid) { switchPanel('following'); waitForAuth().then(()=>renderFollowing(uid)); },
  backProfile() { this.profile(S.profileUid); },

  notifications() { switchPanel('notifications'); waitForAuth().then(()=>renderNotifications()); },

  // aliases for onclick handlers in HTML
  showPanel(n) { this.show(n); },
  showMyProfile() { this.show('profile-me'); },
  showUserProfile(uid) { this.profile(uid); },
  openCreatePostModal() { this.openPost(); },
  openEditProfile() { this.openEdit(); },
  openLightbox(url) { this.lb(url); },
  closeLightbox() { this.closeLb(); },
};

/* ─── BOOT ─────────────────────────────────────────────────────*/
function boot() {
  injectGlobal();
  // Wait for firebase to be available before init
  if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
    SOCIAL.init();
  } else {
    // Firebase not ready yet, wait
    setTimeout(boot, 300);
  }
}
if (document.readyState==='loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

})();
