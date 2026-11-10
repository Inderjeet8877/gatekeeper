# Gatekeeper mobile: Google Play readiness audit

- **Scope:** `C:\my folder\Gatekeeper\apps\mobile` (Expo SDK 58.0.21, RN 0.88.1, expo-router). Read-only audit, no repo files changed.
- **Date:** 2026-10-30.
- **Verdict:** **Not shippable to Play production yet.** The code quality is good: `tsc --noEmit` passes, `expo-doctor` reports 20/20 checks passed, and accessibility labels are thorough. The gaps are in release plumbing (EAS, HTTPS API, SMS OTP) and in Play policy items (account deletion, in-app privacy policy, reviewer access, the fake payment flow).

## Tool results (read-only)

| Command | Result |
|---|---|
| `npx tsc --noEmit` | exit 0, no errors |
| `npx expo-doctor` | "20/20 checks passed. No issues detected!" |
| `npx expo config --type public` | No `owner`, no `extra.eas.projectId`, no `android.versionCode`, no `runtimeVersion`/`updates`, no `android.permissions`/`blockedPermissions`, no `allowBackup`. `platforms` includes web. |
| `npm audit --omit=dev` | 8 vulns (5 low, 3 high). All are in build tooling: `@expo/cli`, `@expo/config`, `zod`, `deepmerge`. None are in the app's runtime JS. `audit fix --force` would downgrade to expo@51, so don't run it. |
| RN Gradle defaults (`node_modules/react-native/gradle/libs.versions.toml`) | `targetSdk = "36"`, `compileSdk = "37"`, `minSdk = "24"`, `ndkVersion = "27.1.12297006"` |
| Assets | icon.png 1024x1024 RGB (no alpha). Adaptive foreground, background and monochrome are 1024x1024 RGBA. splash-icon 1024x1024. All fine. |
| `docs/screenshots/mobile` | 15 PNGs: 13 at 1080x2340 and 2 at 1080x2424. Aspect ratio is 2.17 to 2.24, which is **over Play's 2:1 limit**. See S-1. |

## Confirmed policy numbers (late 2026)

| Requirement | Value | Source |
|---|---|---|
| Target API for new apps and updates | **API 36 (Android 16)** from **Aug 31 2026**. You can request an extension to Nov 1 2026. Existing apps need API 35 or higher to stay visible to new users. SDK 58 targets 36, so it complies. | https://developer.android.com/google/play/requirements/target-sdk |
| 16 KB page size | Applies to apps targeting API 35+. **From Feb 1 2027**, updates without 16 KB support are blocked. SDK 58/RN 0.88 prebuilt libraries support it. Check in Play Console > App bundle explorer. | https://developer.android.com/guide/practices/page-sizes |
| New personal developer account | Closed test with **at least 12 testers opted in continuously for 14 days**. This applies to accounts created after Nov 13 2023, before you can apply for production. | https://support.google.com/googleplay/android-developer/answer/14151465 |
| Account deletion | You need **both**: (1) a readily discoverable in-app way to start deletion, and (2) a web URL entered in Play Console that does not route back to the app. Deactivating or freezing an account does not count. | https://support.google.com/googleplay/android-developer/answer/13327111 , https://support.google.com/googleplay/android-developer/answer/10144311 |
| Privacy policy | Must be in the Play Console field **and** linked or shown inside the app. | https://support.google.com/googleplay/android-developer/answer/10144311 |
| Data safety form | Mandatory for closed, open and production tracks. Not needed while the app is internal-only. Includes questions on encryption in transit and deletion. | https://support.google.com/googleplay/android-developer/answer/10787469 |
| App access (login-gated apps) | You must give reviewers everything they need to get in. OTP logins must be explained under "Any other instructions". Up to 5 instruction sets. | https://support.google.com/googleplay/android-developer/answer/9859455 |
| Full-screen intent (for any future SOS alarm UI) | On Android 14+, the permission is on by default only for calling and alarm apps. Everyone else completes a Play Console declaration and asks the user at runtime. | https://support.google.com/googleplay/android-developer/answer/13392821 |
| Deceptive behavior | No "functionally impossible" features. The listing must match what the app actually does. | https://support.google.com/googleplay/android-developer/answer/9888077 |
| Store graphics | Icon 512x512 32-bit PNG, max 1 MB. Feature graphic 1024x500 JPEG or 24-bit PNG with no alpha. Screenshots: at least 2, up to 8 per device type, 320 to 3840 px, **longest side no more than 2x the shortest**. Promotion needs at least 4 screenshots at 1080 px or more, 9:16. App name max 30 characters, short description max 80. | https://support.google.com/googleplay/android-developer/answer/9866151 , https://support.google.com/googleplay/android-developer/answer/9859152 |
| Developer fee | US$25 one-time | https://docs.expo.dev/build/setup/ |
| EAS Submit | Needs a Google service account JSON key. Production builds an `.aab` by default. The first `eas submit` works and creates an internal-track release. | https://docs.expo.dev/submit/android/ , https://docs.expo.dev/build/eas-json/ |
| SDK 58 note | **R8 minification is on by default** in Android release builds. Opt out with `expo-build-properties` `android.enableMinifyInReleaseBuilds: false`. Test a release build before submitting. | https://expo.dev/blog/how-to-upgrade-to-sdk-58 |

## Findings

Severity counts: **BLOCKER 7 · HIGH 7 · MEDIUM 9 · LOW 10**

### BLOCKER

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| B-1 | **The API URL falls back to `http://localhost`, and the API is reached over cleartext HTTP.** Release builds block cleartext by default (Android 9+; only Expo debug builds allow it). Even a LAN IP over http fails in a Play build. The admin console link has the same localhost default. | `src/lib/api.ts:2` `process.env.EXPO_PUBLIC_API_URL \|\| 'http://localhost:4000/api/v1'`, `src/lib/api.ts:4` `WEB_URL ... 'http://localhost:8080'`, `.env.example:7,10`. SSE also uses `API_URL` (`src/lib/realtime.tsx:38`). | Deploy the API behind HTTPS, e.g. `https://api.<domain>/api/v1`. Set `EXPO_PUBLIC_API_URL` and `EXPO_PUBLIC_WEB_URL` in the `eas.json` production `env`, or with `eas env:create --environment production`. Make the code fail loudly if the variable is missing in a release build, instead of falling back to localhost. Do not enable `usesCleartextTraffic`. |
| B-2 | **No SMS OTP delivery in production, so nobody can sign in.** With `NODE_ENV=production`, the API stores the OTP and returns `{sent:true}` but sends nothing. | `apps/api/src/modules/auth/auth.service.ts:11-18`, `docs/01-PRD.md:60` ("SMS delivery of OTPs ... A provider is post-v1"). | Integrate an SMS or WhatsApp OTP provider with Indian DLT registration (MSG91, Twilio Verify, Gupshup, or Firebase Phone Auth). |
| B-3 | **No account deletion, either in the app or on the web.** The Profile screen only has Sign out. The API has only `GET/PATCH /me`, no delete. The web privacy text says "Contact us to have your account deleted", which is not a discoverable deletion resource. | `src/app/(resident)/(tabs)/profile.tsx:46-48`; guard: `src/app/(guard)/_layout.tsx:88-89`; `apps/api/src/modules/me/me.routes.ts:8,12`; `apps/web/src/marketing/About.tsx:58`. | Add `DELETE /me`: anonymise or delete the user, memberships and OTPs, and document which visitor, audit and invoice data is kept and why. Add "Delete account" to the resident Profile and to the guard and societies screens. Publish a web page such as `/delete-account` that names "Gatekeeper" and shows the request path prominently (form or email). Enter that URL in Play Console > Data safety. |
| B-4 | **No `eas.json`, no EAS project link, no `owner`, no `versionCode`.** You cannot produce a signed AAB or submit. | `apps/mobile/eas.json` is missing. The `expo config` output has no `owner`, `extra.eas.projectId` or `android.versionCode`. | `eas init` then `eas build:configure`. Use `"cli": {"appVersionSource": "remote"}` and `production.autoIncrement: true`. See the checklist. |
| B-5 | **Reviewers have no way in.** Login is OTP-only, with no SMS (B-2) and no demo account. Play rejects apps under "App access". | `src/app/(auth)/phone.tsx:19`, `otp.tsx:63`. | Create a review account on prod: a fixed demo phone, e.g. `9000000099`, with a static OTP allow-listed server-side for that number only. Seed demo resident and guard memberships in a demo society. Enter both in Play Console > App content > App access, with instructions. |
| B-6 | **No privacy policy is reachable from the app, and none is on a public URL yet.** Play's User Data policy requires both the Console field and an in-app link. A `/privacy` route exists on the web app but is not deployed or linked. | `src/app/(auth)/welcome.tsx:24-25` (no privacy or terms link), `profile.tsx` (none). Web route: `apps/web/src/App.tsx:44-45`. | Deploy the web app on HTTPS. Review `/privacy` so it covers mobile data: phone, name, flat, visitor names/phones/vehicles, SOS, payments, retention and deletion. Link Privacy and Terms on the Welcome/Phone screen and in Profile. |
| B-7 | **Closed-testing gate (process).** If the Play developer account is a *personal* account created after Nov 13 2023, production access needs **12 testers opted in for 14 consecutive days** in a closed test. | Policy: https://support.google.com/googleplay/android-developer/answer/14151465 | Recruit 15 or more testers (real society residents and guards) early. Alternatively, register an **organization** account with a D-U-N-S number, which is not subject to this rule. Budget at least 14 days plus review time. |

### HIGH

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| H-1 | **No push notifications.** Visitor-at-gate approvals and SOS alerts only arrive while the app is open and the SSE stream is connected. A gate app that misses visitors when backgrounded fails its core job. The sign-out copy also implies the phone gets requests in the background. | `package.json` has no `expo-notifications`. `src/lib/realtime.tsx:34-85` is SSE only. `profile.tsx:47`: "You will stop receiving visitor requests on this phone". PRD defers this: `docs/01-PRD.md:64`, `docs/11-ROADMAP.md:215` (H1-2). | `npx expo install expo-notifications expo-device`, add the plugin, create a Firebase project, and upload FCM V1 credentials (`eas credentials`). Add a device-token table in the API and send via the Expo Push API. Use high-priority Android channels for "visitor" and "sos". Request POST_NOTIFICATIONS at runtime. Do **not** use a full-screen intent for SOS unless you complete that declaration. https://docs.expo.dev/push-notifications/push-notifications-setup/ |
| H-2 | **The payment flow is fake in a production app.** The "Pay" button marks the invoice PAID with a "Test payment — no money will move" banner and shows a "Payment received" receipt. Play treats this as functionally impossible or misleading, and it corrupts society ledgers. Maintenance dues are real-world services, so Play Billing does **not** apply and a normal gateway is fine. | `src/app/(resident)/payments.tsx:69-76` (calls `/invoices/:id/pay`), `:97-99` banner, `:87` "Payment received". | Integrate a real gateway (Razorpay or Cashfree UPI), or for v1 hide the Pay button behind a server feature flag and show "Pay via your society's UPI / office". Declare "Financial info: purchase history" in Data safety. |
| H-3 | **`android.package` is permanent and `com.gatekeeper.app` implies the `gatekeeper.app` domain.** The ID is free on Play (the details page returns 404), but it should be a domain you control. It cannot change after the first upload. | `app.json` `android.package` and `ios.bundleIdentifier`: `com.gatekeeper.app`. | Decide now. Use a domain you own, e.g. `in.realhubb.gatekeeper` or `com.realhubb.gatekeeper`. Change it before the first `eas build` that reaches Play. |
| H-4 | **Name and trademark collision in the same category and market.** India's society-app market already has "**ADDA Gatekeeper**" (`com.threefiveeight.addagatekeeper`) and "**Gatekeeper by ApnaComplex**" (`com.apnacomplex.visitor`). NoBrokerHood markets a "Gatekeeper app". "Gatekeeper" is generic for guard apps, so a bare "Gatekeeper" title will be hard to find and invites complaints. | https://appgoblin.info/apps/com.threefiveeight.addagatekeeper , https://apkcombo.com/gatekeeper-by-apnacomplex/com.apnacomplex.visitor/ , https://www.nobrokerhood.com/solutions/gatekeeper-app | Use a distinctive Play title within 30 characters, e.g. "Gatekeeper by Realhubb" or a new brand. Do a quick trademark search (India IP office class 9/42). Don't use competitor names in keywords. |
| H-5 | **No crash reporting and no root ErrorBoundary.** With R8 on by default in SDK 58 release builds, release-only crashes are likely and you would have no visibility. | No Sentry/Bugsnag in `package.json`. No `export function ErrorBoundary` in `src/app/_layout.tsx`. | `npx expo install @sentry/react-native` with its config plugin, and upload source maps on EAS build. Export an `ErrorBoundary` from the root `_layout.tsx`. |
| H-6 | **Data safety form needs careful declaration** because the app handles a lot of PII about users and third parties (visitors). | See the Data safety table below. | Fill it in before the closed track. All traffic must be HTTPS (B-1) to answer "encrypted in transit: yes". |
| H-7 | **The guard flow shares resident phone numbers.** SOS shows the raiser's phone with a call button. The guard log shows visitor phones. This must be disclosed in the privacy policy, and the guard app is often a shared device. | `src/app/(guard)/alerts.tsx:59`. | Disclose it in the privacy policy. The guard sign-out already clears data (`session.tsx:52-61`). Consider auto sign-out or a shift timeout on guard devices. |

### MEDIUM

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| M-1 | No OTA updates or `runtimeVersion` configured, so every JS fix needs a full Play review. | No `expo-updates` in `package.json`, no `updates`/`runtimeVersion` in the config. | `npx expo install expo-updates`, then `eas update:configure`, with `runtimeVersion: {policy: "fingerprint"}` and channels per profile. https://docs.expo.dev/versions/latest/config/app/ |
| M-2 | `android.allowBackup` is unset, so it defaults to `true`. Google Drive backup can include app data. SecureStore keys are Keystore-bound, so they won't restore, but there is no reason to back up a security app. | `app.json` android block. | `"allowBackup": false`. |
| M-3 | The JWT is passed in the SSE query string, where it lands in proxy, CDN and access logs. | `src/lib/realtime.tsx:38` `qs({ token, societyId })`; `apps/api/src/modules/events/events.routes.ts:10`. | `react-native-sse` supports `headers`, so send `Authorization: Bearer` and accept the header server-side. Or use a short-lived SSE ticket. |
| M-4 | No analytics or funnel metrics for launch (OTP success, approvals). Optional, but it affects any analytics declaration in Data safety. | `package.json`. | Add later if needed, and declare it if you do. |
| M-5 | **Release-build verification gap.** Everything was QA'd in Expo Go or dev builds. R8, HTTPS, the cleartext block and edge-to-edge only show up in release. | Commit history; no `eas.json`. | Run the `preview` profile (internal APK) end to end against the prod API before submitting. |
| M-6 | `platforms` includes web with `expo-router` web async routes. This doesn't hurt Android, but it's unneeded surface. | `expo config` output `platforms: [ios, android, web]`. | Optional: `"platforms": ["android","ios"]`. |
| M-7 | Content rating and user-generated content. Ticket comments, poll votes and notices are visible to other society members. They are admin-moderated, but the IARC questionnaire will ask about user interaction. | `src/app/(resident)/ticket/[id].tsx`, `community.tsx`. | Answer "users can interact / share info: yes". The expected rating is Everyone or PEGI 3. Keep admin delete for notices and comments. |
| M-8 | No explicit offline state. `fetch` failures show a generic toast. React Query retries twice. The guard gate keypad has no offline queue, so a dropped network at the gate blocks entry. | `src/lib/api.ts:27-30`, `src/app/_layout.tsx:25`. | Show a persistent "Offline" banner. Wire `@react-native-community/netinfo` into React Query's `onlineManager`. |
| M-9 | Existing screenshots break the Play 2:1 rule: 1080x2340 is 2.17 and 1080x2424 is 2.24. | `docs/screenshots/mobile/*.png`. | Re-export at 1080x1920 (9:16, eligible for promotion) or pad to 1080x2160. Pick 4 to 8. Suggested: 01, 03, 04, 05, 07, 09, 11, 15. |

### LOW

| ID | Finding | Evidence | Fix |
|---|---|---|---|
| L-1 | The "Dev code" banner renders whenever the API returns `devCode`. The API refuses to start in production with `EXPOSE_DEV_OTP=true`, so this is safe if the prod environment is correct. | `src/app/(auth)/otp.tsx:89-91`; `apps/api/src/config.ts:24,33`. | Make sure `EXPOSE_DEV_OTP` is unset in prod. Optionally gate it with `__DEV__` as well. |
| L-2 | The Profile footer shows the API host ("Gatekeeper · localhost:4000/api/v1"). | `src/app/(resident)/(tabs)/profile.tsx:48`. | Replace it with the app version (`Constants.expoConfig.version`) and links to Privacy, Terms and Delete account. |
| L-3 | Leftover Expo template files sat in `apps/mobile`. Metro doesn't bundle them, so they don't affect the AAB. | `apps/mobile`. | Removed. |
| L-4 | Permissions: no dangerous permissions are declared or expected. Only INTERNET and VIBRATE come from expo-haptics and `Vibration`. No camera, photos, location, foreground service or full-screen intent, so no Play declarations are needed today. | `app.json` has no `permissions`. Plugins: router, secure-store, font, splash. | After the first AAB, check the merged manifest (Play Console > App bundle explorer). If needed, add `blockedPermissions` (e.g. `android.permission.SYSTEM_ALERT_WINDOW`, `READ/WRITE_EXTERNAL_STORAGE`). When adding photo uploads (ROADMAP H1-3), use the system photo picker, not READ_MEDIA_IMAGES, per the Photo/Video permissions policy. |
| L-5 | `orientation: "default"` (rotation allowed). That's fine for guard tablets, and Android 16 ignores orientation locks on screens of 600dp or more anyway. | `app.json`. | Test the guard keypad in landscape on a tablet. Upload tablet screenshots only if you want tablet visibility. |
| L-6 | `predictiveBackGestureEnabled: false`. That's fine. With target API 36, predictive back is system-default, so test Android back on modal sheets. | `app.json` android. | Test it. Enable later. |
| L-7 | Edge-to-edge is enforced at target API 35+. A previous commit fixed the auth status bar. | Commit 2ff32e7. | Check every screen in the release build with 3-button nav. |
| L-8 | npm audit shows 3 high findings in build tooling only (`@expo/cli`, `zod`). | `npm audit --omit=dev`. | Run `npx expo install --fix` on the next SDK patch. Do not run `audit fix --force`. |
| L-9 | No i18n (Hindi or regional languages). English-only is acceptable for launch. | No i18n library. | Post-launch, with `expo-localization`. |
| L-10 | Accessibility is good: buttons, keypad, slots and polls have labels and roles. Only spot-check TalkBack on the Sheet modal and Chips. | `src/components/ui.tsx` (20 labels), `gate.tsx:98,108`. | Do one TalkBack pass. |

## Data safety form: what to declare (draft)

| Category / type | Collected | Shared* | Purpose | Optional? |
|---|---|---|---|---|
| Personal info: Name | Yes | No | App functionality, account management | Required |
| Personal info: Phone number | Yes (login, SOS, staff, visitors) | No | Account management, app functionality, fraud prevention/security | Required |
| Personal info: Address (flat number, block, society) | Yes | No | App functionality | Required |
| Personal info: Email | Only if collected via PATCH /me | No | Account management | Optional |
| Personal info: Other (vehicle number, visitor company) | Yes | No | App functionality, security | Optional |
| Financial info: Purchase history (invoices, payments) | Yes | Yes, with the payment gateway once real | App functionality | Required for payment |
| App activity: Other user-generated content (tickets, comments, poll votes) | Yes | No | App functionality | Optional |
| App info and performance: Crash logs, Diagnostics | Yes, once Sentry is added | No (Sentry is a processor) | Analytics | — |
| Device or other IDs | Yes, once push tokens are added | No | App functionality | — |

\*Showing data to other members of the same society at the user's direction (guard sees visitor, admin sees resident) is not "sharing" under Play's definition, but say so in the privacy policy.

Also answer: encrypted in transit **Yes** (requires B-1). Users can request deletion **Yes**, with the web URL (requires B-3). Retention: say what you keep and for how long, e.g. visitor logs N days per NFR-PRIV-02, and invoices for legal reasons.

## Store listing assets checklist

- [ ] App name, 30 characters max, distinctive (H-4). Short description, 80 characters max. Full description.
- [ ] Icon 512x512 32-bit PNG, max 1 MB. Export it from `assets/icon.png` (1024, RGB).
- [ ] Feature graphic 1024x500 JPEG or 24-bit PNG, no alpha. **Missing**: design one in the navy `#060E22` / gold brand.
- [ ] Phone screenshots: 4 to 8 at 9:16 (1080x1920). Re-export from `docs/screenshots/mobile` (M-9).
- [ ] Optional: 7-inch and 10-inch tablet screenshots, for the guard tablet use case.
- [ ] Privacy policy URL (B-6), account deletion URL (B-3), support email, website.
- [ ] Category: **House & Home** (or Lifestyle). Tags: apartment, society, visitor management.

## Step-by-step: EAS build, Play Console, internal, closed, production

Commands run from `apps/mobile`. Use `npx eas-cli@latest` in place of `eas` if it isn't installed globally.

### Phase 0: code and infra fixes (before any Play upload)
1. Fix B-1 to B-3, B-5, B-6, H-2 and H-3, and ideally H-1 and H-5.
2. Deploy the API and web on HTTPS. Set the API `NODE_ENV=production` and leave `EXPOSE_DEV_OTP` unset. Configure the SMS provider. Seed the demo society and review account.
3. Settle the final `android.package` (H-3). **This is irreversible after the first upload.**

### Phase 1: EAS setup
```sh
npm i -g eas-cli          # or: npx eas-cli@latest ...
eas login && eas whoami
eas init                  # creates the EAS project; writes extra.eas.projectId and owner into the app config
eas build:configure       # creates eas.json
```
Edit `eas.json` (minimum):
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview": { "distribution": "internal", "android": { "buildType": "apk" },
                 "env": { "EXPO_PUBLIC_API_URL": "https://api.<domain>/api/v1", "EXPO_PUBLIC_WEB_URL": "https://<domain>" } },
    "production": { "autoIncrement": true,
                    "env": { "EXPO_PUBLIC_API_URL": "https://api.<domain>/api/v1", "EXPO_PUBLIC_WEB_URL": "https://<domain>" } }
  },
  "submit": {
    "production": { "android": { "serviceAccountKeyPath": "./play-service-account.json", "track": "internal", "releaseStatus": "draft" } }
  }
}
```
Add `play-service-account.json` to `.gitignore`. You can store it in EAS credentials instead. Optional `app.json` additions: `"android": { "allowBackup": false }`, `"runtimeVersion": { "policy": "fingerprint" }` (with expo-updates), and the plugins for `expo-notifications` and `@sentry/react-native`.

### Phase 2: release-build smoke test
```sh
eas build -p android --profile preview          # APK; install on 2-3 real devices including Android 16
```
Test against the prod API: OTP over SMS, approve a visitor while the app is backgrounded (push), SOS, deep link `gatekeeper://`, sign-out, delete account, and dark mode. If R8 breaks something, fix the keep rules or temporarily use `expo-build-properties` `android.enableMinifyInReleaseBuilds: false`.

### Phase 3: Play Console setup
1. Create the developer account at https://play.google.com/console: US$25, identity verification. Choose **Organization** with D-U-N-S to skip the 12-tester rule, or Personal.
2. Create the app with name, default language en-IN, "App", Free. Accept the declarations.
3. **App signing:** keep the default **Play App Signing**. EAS generates and stores the **upload** keystore on the first `eas build`. Back it up with `eas credentials -p android` and download the keystore.
4. Create a Google Cloud service account, grant it access in Play Console (Users & permissions, release permissions for this app), and download the JSON key. Then `eas credentials -p android` and upload the key, or use `serviceAccountKeyPath`.
5. App content: Privacy policy URL; **App access** (demo phone and static OTP, resident and guard instructions); Ads: No; Content rating questionnaire (IARC); Target audience: 18+ (not for children); News app: No; **Data safety** (table above); Government app: No; Financial features: none, or "payments for services" once a gateway exists; **Data deletion URL**. No full-screen intent or foreground service declarations are needed unless push SOS uses them later.
6. Store listing: assets from the checklist above.

### Phase 4: internal testing (up to 100 testers, minutes to go live, no review gate for most apps)
```sh
eas build -p android --profile production       # signed .aab, versionCode auto-incremented remotely
eas submit -p android --profile production --latest
# or in one step: eas build -p android --profile production --auto-submit
```
Then in Play Console go to Testing > Internal testing: add a tester email list, roll out the draft release, and share the opt-in link. Check Android vitals and the pre-launch report (it can't get past OTP, so watch for crashes only).

### Phase 5: closed testing (needed for personal accounts: 12 or more testers, 14 consecutive days)
1. Testing > Closed testing > Create track, or use "Alpha". Add a Google Group or email list of **15 or more** testers to absorb opt-outs.
2. Promote the internal build (Promote release > Closed), or submit with `"track": "alpha"`.
3. Make sure Data safety, App access and content rating are complete. Closed tracks need them. Send for review: Publishing overview > Send changes for review.
4. Keep testers opted in and **actively using the app for 14 or more consecutive days**. Collect feedback. Ship fixes with `eas update` (if expo-updates is set up) or new builds.
5. Dashboard > **Apply for production access**: answer the questionnaire about testing, feedback and changes.

### Phase 6: production
1. After approval: Production > Create release > promote the closed build. Choose countries (India).
2. Use a **staged rollout**, e.g. 10%, then 50%, then 100%, while watching Sentry and Android vitals for crash rate and ANR.
3. For later updates: `eas build -p android --profile production --auto-submit` with `track: production`, or `eas update --channel production` for JS-only fixes.

### Ongoing deadlines
- **Feb 1 2027:** 16 KB page support is mandatory for updates. SDK 58 complies; check the App bundle explorer on the first AAB.
- **About Aug 31 2027:** the next yearly target API increase, expected to be API 37. Plan an SDK upgrade mid-2027.

## Sources
- Target API: https://developer.android.com/google/play/requirements/target-sdk
- 16 KB: https://developer.android.com/guide/practices/page-sizes
- Testing for new personal accounts: https://support.google.com/googleplay/android-developer/answer/14151465
- Account deletion: https://support.google.com/googleplay/android-developer/answer/13327111
- User Data policy (privacy policy in-app, deletion): https://support.google.com/googleplay/android-developer/answer/10144311
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- App access: https://support.google.com/googleplay/android-developer/answer/9859455
- Full-screen intent: https://support.google.com/googleplay/android-developer/answer/13392821
- Deceptive behavior: https://support.google.com/googleplay/android-developer/answer/9888077
- Graphic assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Metadata / title limit: https://support.google.com/googleplay/android-developer/answer/9859152
- EAS Build setup: https://docs.expo.dev/build/setup/ ; eas.json: https://docs.expo.dev/build/eas-json/ ; Submit: https://docs.expo.dev/submit/android/
- App config reference: https://docs.expo.dev/versions/latest/config/app/ ; Permissions: https://docs.expo.dev/guides/permissions/
- Push setup: https://docs.expo.dev/push-notifications/push-notifications-setup/
- SDK 58 upgrade (R8 default): https://expo.dev/blog/how-to-upgrade-to-sdk-58
- Name collisions: https://appgoblin.info/apps/com.threefiveeight.addagatekeeper , https://apkcombo.com/gatekeeper-by-apnacomplex/com.apnacomplex.visitor/ , https://www.nobrokerhood.com/solutions/gatekeeper-app
