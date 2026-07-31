# Nabtex Academy Notifications — Setup Checklist

Everything code-side is done and syntax-validated. What's left needs your
own credentials/accounts, so it's written up here step by step.

## What shipped

| Piece | File | Status |
|---|---|---|
| Bell + dropdown panel, mark-as-read, mute toggle | `index.html` | ✅ done |
| `lastActiveAt` heartbeat (Academy-section entry, throttled 10 min) | `index.html` | ✅ done |
| FCM token registration (deliberate-moment prompt in the panel) | `index.html` | ✅ done |
| Admin broadcast composer (all students / one course's enrollees) | `admin.html` | ✅ done |
| Immediate push when a broadcast is sent, so it also reaches closed/backgrounded devices — previously the composer above only updated the in-app bell | `academy-broadcast-push.ts` + `admin.html` | ✅ code done (needs deploy — Part E) |
| Recent-sends log (last 10) | `admin.html` | ✅ done |
| Firestore rules for `academy_notifications` / `academy_broadcast_log` | `firestore.rules` | ✅ done |
| Background push + click deep-link | `sw.js` | ✅ done (needs VAPID key — Part A) |
| Automated daily inactivity push | `supabase/functions/academy-inactivity-push/` | ✅ code done (needs deploy — Part C) |

New-course announcements are **manual by design**, not a placeholder: I
checked `_acCourseConfig`/`course_config` in the live code and confirmed
it only gates pause/resume of a course that's *already* in the catalog
(`toggleCourse(cid, makeActive)` runs both directions today). A brand
new course arrives purely at deploy time (spliced into `index.html`),
with no Firestore write to hook — so a Cloud Function watching
`course_config` would fire on routine pause/resume, not launches, and
would need the Blaze plan for nothing gained. Use the "🔗 فتح دورة عند
الضغط" field in the broadcast composer instead — it's one extra click,
costs nothing, and is actually correct.

## Part A — Firebase Console (10 min)

1. **VAPID key**: [console.firebase.google.com](https://console.firebase.google.com) → your project → ⚙️ *Project settings* → **Cloud Messaging** tab → **Web configuration** → **Web Push certificates** → **Generate key pair**. Copy the public key string.
2. Paste it into `index.html`, search for `PASTE_YOUR_VAPID_KEY_HERE` (one occurrence, in the `AcNotif` module) and replace it.
3. Cloud Messaging API should already be enabled (it's on by default for any project with a web app registered) — nothing else to toggle here.
4. iOS note: Safari only supports web push for a PWA that's been **added to the home screen** (iOS 16.4+). Desktop/Android Chrome work immediately from the browser tab.

## Part B — Course metadata for personalized inactivity messages (optional, per course)

The inactivity job can say *"still just 40% left in Food Safety"* — but
only for courses where `course_config/{courseId}` has a `totalLessons`
number. Without it, the job still sends a perfectly fine name-only
message, just without the % and course name. To enable the fuller copy,
in Firebase Console → Firestore → `course_config`, add/update per course:

```
course_config/pest            { active: true, totalLessons: <n>, title: "الآفات الزراعية" }
course_config/mol-bio          { active: true, totalLessons: <n>, title: "البيولوجيا الجزيئية" }
course_config/food-quality     { active: true, totalLessons: <n>, title: "جودة الأغذية" }
course_config/ag-english       { active: true, totalLessons: <n>, title: "الإنجليزية الزراعية" }
course_config/food-safety      { active: true, totalLessons: <n>, title: "سلامة الأغذية" }
course_config/land-reclamation { active: true, totalLessons: <n>, title: "استصلاح الأراضي" }
course_config/tissue-culture   { active: true, totalLessons: <n>, title: "زراعة الأنسجة" }
```
(`active` only needs setting if you want it explicitly true — remember: no doc = active by default.) Skip any course you don't want personalized yet; it'll just fall back gracefully.

## Part C — Supabase (30–45 min, one-time)

1. **Create the project** (if you don't have one yet): [supabase.com/dashboard](https://supabase.com/dashboard) → New project → free tier is fine.
2. **Install the CLI locally** and link it:
   ```
   npm install -g supabase
   supabase login
   cd <your project folder, containing the supabase/ folder from this zip>
   supabase link --project-ref <your-project-ref>
   ```
3. **Create the Google service account** the function authenticates as:
   - Go to [Google Cloud Console → IAM → Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts) for the **same project as Firebase** (`nabtex-b8475`).
   - Create service account → any name (e.g. `academy-notif-job`) → grant it the role **Firebase Admin SDK Administrator Service Agent** (`roles/firebase.sdkAdminServiceAgent` — covers Firestore + FCM in one role).
   - Open it → **Keys** → **Add key** → **Create new key** → JSON → download it.
4. **Set the secrets** (paste the whole downloaded JSON as one value):
   ```
   supabase secrets set GCP_SERVICE_ACCOUNT_JSON='<paste the entire JSON file contents here>'
   supabase secrets set FIREBASE_PROJECT_ID='nabtex-b8475'
   supabase secrets set CRON_SECRET='<make up a random string>'
   ```
5. **Deploy the function**:
   ```
   supabase functions deploy academy-inactivity-push
   ```
   Supabase's function-auth model has been changing (a newer `auth: 'secret'` config option now exists specifically for cron/webhook callers, alongside the older `verify_jwt` flag) — check the current exact syntax at **https://supabase.com/docs/guides/functions/auth** before deploying, since this is the one piece most likely to have moved since this was written. Either way, this function also checks its own `x-cron-secret` header (`CRON_SECRET` above) as a second layer, so it's protected either way once that's wired into however you end up scheduling it below.
6. **Schedule it** — simplest path: Dashboard → **Integrations → Cron** → *Create a new Job* → type **Supabase Edge Function** → pick `academy-inactivity-push` → schedule `0 6 * * *` (once daily, adjust the hour to whenever Cairo-morning makes sense) → make sure the `x-cron-secret` header gets sent with the value you set above (the Cron UI lets you add custom headers per job). If that option isn't available on your plan, the fallback is a `pg_cron` + `pg_net` SQL snippet calling the function URL directly — Supabase's docs above cover both paths.
7. **Test it once manually** before trusting the schedule:
   ```
   curl -X POST 'https://<project-ref>.supabase.co/functions/v1/academy-inactivity-push' \
     -H 'x-cron-secret: <your CRON_SECRET>'
   ```
   It returns a small JSON summary (`scanned`, `notified`, `pushSent`, etc.) — check `errors` is empty on the first run.

## Part D — Supabase (immediate broadcast push, ~15 min if Part C is already done)

Same project, same secrets — this just deploys a second, companion function
so a broadcast sent from `admin.html` also reaches students whose site/app
is closed, not only students with a tab open.

1. **Add the file** to your local project at `supabase/functions/academy-broadcast-push/index.ts`, using `academy-broadcast-push.ts` from this delivery (same flattened-filename convention as `academy-inactivity-push.ts`).
2. **No new secrets** — it reuses `GCP_SERVICE_ACCOUNT_JSON` and `FIREBASE_PROJECT_ID`, already set in Part C step 4.
3. **Deploy**:
   ```
   supabase functions deploy academy-broadcast-push --no-verify-jwt
   ```
   (`--no-verify-jwt` because the caller here is an admin's browser sending a Firebase ID token in the request body, not a Supabase-authenticated caller — the function verifies that ID token itself, see the file's header comment.)
4. **Paste the URL into `admin.html`**: search for `PASTE_YOUR_SUPABASE_PROJECT_REF_HERE` (one occurrence, right above the broadcast composer code) and replace it with your actual project ref — same pattern as the VAPID key in Part A.
5. **Test it**: send any test broadcast from `admin.html`, then check the browser console — logs `[broadcast push]` with the same kind of JSON summary as Part C step 7 (`targeted`, `pushSent`, `pushFailed`, `errors`). A closed-tab device with a saved token should get a real push within seconds.

## Part E — Testing checklist

- [ ] Open the Academy tab as a logged-in student → bell shows, badge hidden when 0 unread
- [ ] From `admin.html`, send a test broadcast to "كل الطلاب" → bell badge updates live, tapping opens the panel, message shows
- [ ] Send a course-targeted broadcast → confirm only students with progress/payment in that course receive it (check `academy_notifications` docs in Firestore console: should be `scope:'user'` docs, one per uid)
- [ ] With Part D deployed: close the app entirely on a test device that already granted notification permission, send a broadcast from `admin.html` → a real push notification arrives within seconds (not just the in-app bell)
- [ ] Tap a notification with a course link attached → confirms it opens that course
- [ ] Leave the panel open for 2 seconds → unread dot disappears, badge count drops
- [ ] Toggle "🔕 كتم تذكيرات المتابعة" → check `users/{uid}.notifMuted` flips in Firestore
- [ ] Grant notification permission from the panel's banner → check `users/{uid}.fcmTokens` gets the new token appended
- [ ] Run the Supabase function manually (Part C step 7) against a test account with `lastActiveAt` manually backdated >7 days in Firestore console → confirm push arrives + `academy_notifications` doc appears + `lastInactivityPushAt` gets set
- [ ] Reload the app after all this → confirm offline/cache behavior (`sw.js`) is unaffected — this was the main risk called out up front, since a past deploy broke on a service-worker/CSP conflict

## FYI, unrelated to this feature (not fixed, out of scope)

While reading `firestore.rules` for this task, `marketplace_notifications`'s rule reads `request.auth.userId` — that field doesn't exist on Firebase Auth tokens (only `request.auth.uid` does), so as written that rule can never actually match. Didn't touch it since marketplace code was explicitly out of scope here, but flagging it since it likely means direct client reads/updates/deletes on that collection are being blocked by rules right now. Let me know if you'd like that looked at separately.
