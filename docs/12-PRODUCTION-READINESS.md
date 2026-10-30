# Gatekeeper: production readiness and Play Store launch guide

Audit date: 30 Oct 2026. The detailed findings, with file:line evidence, are in [audits/](audits):
[API](audits/2026-10-30-api-audit.md) · [Mobile / Play Store](audits/2026-10-30-mobile-playstore-audit.md) · [Infra, web and India compliance](audits/2026-10-30-infra-web-compliance-audit.md).

## 1. Verdict

**Gatekeeper works as a product but is not yet safe or legal to launch publicly.**

What is solid today:
- All 61 API endpoints work. 57 automated tests pass. The typecheck is clean in all three apps.
- Data isolation holds. More than 12 live attempts to read or change another flat's or another society's data were all refused (404/403).
- The core flows were verified end to end on a real Android phone: OTP login, live visitor approval, passcode entry, staff attendance, SOS, amenity booking, notices and polls.
- The mobile app already targets Android API 36 and supports 16 KB pages. No dangerous permissions are used, and expo-doctor passes 20/20.

What stops a launch is mostly **launch plumbing that was out of v1 scope**: real SMS, real payments, push notifications, account deletion, HTTPS hosting, and Play Store setup. There are also **a few security defects** that must be fixed first.

| Area | Blocker | High | Medium | Low |
|---|---|---|---|---|
| API | 5 | 6 | 11 | 12 |
| Mobile / Play Store | 7 | 7 | 9 | 10 |
| Infra / web / compliance | 7 | 9 | 11 | 6 |

Many findings overlap across the three audits. The deduplicated list is below.

## 2. Launch blockers (deduplicated)

### 2a. Code work (can be built in this repo)

| # | Problem | Why it blocks launch | Fix |
|---|---|---|---|
| C1 | **Unsafe production defaults.** `NODE_ENV` defaults to `development`, which returns the OTP to the caller (`devCode`) and seeds demo users with published phone numbers. The known `JWT_SECRET` from `.env.example` is accepted. | If someone forgets one env var, anyone can log in as any phone number, or forge tokens. | Require `NODE_ENV` explicitly. Refuse to start with a known or weak secret. Make the dev OTP strictly opt-in. Never seed when `NODE_ENV=production`. Add a `docker-compose.prod.yml` with no published DB port, no Adminer, restart policies and secrets taken from env. |
| C2 | **OTP rate limit can be bypassed.** The limiter keys on phone+IP together, `trust proxy` is hard-coded, `/otp/verify` has no limiter, and a new code resets the attempt counter. | OTP guessing has no overall limit. With real SMS, attackers can also run up your SMS bill (SMS pumping). | Limit separately per phone and per IP. Add a limiter on verify. Cap attempts per phone over 24 h. Make `trust proxy` configurable. Use a Redis store once there are 2+ API instances. |
| C3 | **No SMS delivery.** In production the OTP is stored but never sent. | Nobody can log in. | Integrate a DLT-registered provider (MSG91, Gupshup or Twilio Verify) behind one `sendOtp()` function. Add a single allow-listed **review account** with a fixed OTP for Google Play reviewers. |
| C4 | **Mock payments.** A resident can mark their own invoice PAID without paying. | It corrupts society accounts, and Google Play treats it as deceptive behaviour. | Integrate Razorpay (or Cashfree) Checkout, with **PAID set only by a signature-verified webhook**. Money settles to each society's own account through Route. Until then, hide Pay behind a server flag and show "Pay at the society office / UPI". |
| C5 | **No account deletion.** There is no `DELETE /me`, no in-app button and no web page. | It's mandatory for Google Play (both in the app and on the web) and under the DPDP Act. | Add `DELETE /me`: anonymise the user, end their memberships, keep financial records as legally required. Add a **Delete account** button in resident Profile and the guard menu. Publish a public `/delete-account` page. |
| C6 | **No privacy policy, consent or grievance contact in the app.** | Required by Play (Console **and** in-app) and by DPDP. | Link Privacy and Terms on the sign-in screen and in Profile. Show a consent notice at first sign-in and record its version and timestamp. Publish a grievance officer contact. Legal text must be reviewed by counsel (see Y6). |
| C7 | **No push notifications.** Visitor approvals and SOS alerts arrive only while the app is open. | A gate app that misses visitors and SOS when the phone is locked fails at its main job. | Add `expo-notifications` + Firebase Cloud Messaging, a device-token table, and high-priority Android channels for "Visitor at gate" and "SOS". Send through the Expo Push API from the existing event bus. |
| C8 | **Phone-to-name lookup.** Anyone can create a society and call `POST /members` with any phone number. That reveals the person's registered name and adds an unwanted membership to their account. | It leaks private data and lets anyone spam members. | Don't return existing users' names. Turn adding a member into an invite the person must accept. Rate-limit society creation. |
| C9 | **Sessions can't be revoked.** Tokens last 7 days with no logout, refresh or revocation, guard phones are shared, and the SSE token travels in the URL. | A lost guard phone keeps access for a week. Tokens also leak into proxy logs. | Use short access tokens plus refresh tokens stored server-side with revocation. Check that the membership is still active on every request. Send SSE auth in the `Authorization` header (`react-native-sse` supports headers). Add a guard shift timeout. |
| C10 | **Mobile release config is missing.** No `eas.json`, no `versionCode`, the API URL falls back to `http://localhost`, and the package ID `com.gatekeeper.app` implies a domain you don't own. | A signed release build can't be produced, and HTTP is blocked in release builds. | Add `eas.json` (template in section 4). Require `EXPO_PUBLIC_API_URL` (HTTPS) in release builds. Set `allowBackup: false`. Replace the Profile footer that shows the API host with the app version and legal links. **Settle the package name first: it can never change after the first upload.** |
| C11 | **Marketing site placeholders.** It has fictional testimonials labelled "names changed for privacy", a contact form that sends nothing, placeholder email/phone, real brand names (Swiggy, Uber) in the hero, and draft legal pages. | These are misleading-advertising risks under the Consumer Protection Act and ASCI rules. | Remove or replace the testimonials. Send contact form messages to email. Use generic courier names. Show prices as "+ GST". Publish the final legal pages. |
| C12 | **Hardening.** The API image runs as root with dev dependencies, migrations and seed run on every start, `/health` doesn't check the DB, nginx sends no security headers, and `VITE_API_URL`/CORS are baked to localhost. | It isn't production-grade. | Non-root multi-stage image, migrations as a release step, DB readiness probe, CSP/HSTS/frame headers, env-driven URLs and CORS. |
| C13 | **No visibility.** There's no Sentry, no root ErrorBoundary in the mobile app, no uptime monitor and no CI. | Release-only crashes are likely, because SDK 58 enables R8 by default, and you would have no way to see them. | Sentry in the API, web and mobile (with source maps from EAS). Add an ErrorBoundary. GitHub Actions running test → build → deploy to staging → prod. |

High items that can follow shortly after launch:
- **Scaling to 2+ API replicas:** move live events (SSE) and rate limits to Redis pub/sub, and put an advisory lock on the expiry sweeper.
- **Offline banner for the guard app.**
- **OTA updates** (`expo-updates`).
- **Data-retention purge jobs:** visitor PII after N months, OTP rows after 24 h.
- **Paid amenity bookings.**
- **Tests** for tickets, members, staff and the rate limiter.
- **Dependency upgrades:** zod 3 → 4, Prisma.

### 2b. Things only you can do (accounts, money, legal)

| # | Task | Notes |
|---|---|---|
| Y1 | **Brand name and package ID** | "Gatekeeper" collides in the same Indian market: *ADDA Gatekeeper* and *Gatekeeper by ApnaComplex* are on Play, and NoBrokerHood markets a "Gatekeeper app". Pick a distinctive store title (max 30 characters) and run a trademark search (classes 9/42). Choose a package ID on a domain you own, e.g. `com.realhubb.gatekeeper`. |
| Y2 | **Domain + DNS** | e.g. `yourbrand.in`, behind Cloudflare. |
| Y3 | **Google Play developer account** | US$25 one-time. An **Organization** account needs a D-U-N-S number but skips the testing rule. A **Personal** account (created after 13 Nov 2023) must run a **closed test with ≥12 testers for 14 consecutive days** before production. |
| Y4 | **SMS: TRAI DLT registration** | Register as a Principal Entity, plus a 6-character sender header and an OTP template that includes the brand name. Without it, Indian operators drop the SMS. Then open the SMS provider account. |
| Y5 | **Payment gateway** | Razorpay or Cashfree business account (KYC). Use Route or sub-merchants so each society's dues settle to the society's own bank account. Never pool residents' money. |
| Y6 | **Legal and tax** | A lawyer reviews the Privacy Notice, Terms, Refund policy and a data processing agreement with each society (the society is usually the data fiduciary, you the processor). Get a GSTIN (18% GST on SaaS). Name a grievance officer and a CERT-In point of contact (incidents reported within 6 h, logs kept 180 days in India). |
| Y7 | **Service accounts** | Expo (EAS), Firebase (push), Sentry, hosting, transactional email, `support@` / `grievance@` mailboxes. |
| Y8 | **Testers and store assets** | 15+ real residents and guards from a pilot society. A 1024×500 feature graphic. Screenshots re-exported at 1080×1920: the current device shots are taller than Play's 2:1 limit. |

## 3. Recommended hosting for launch

For about 3–10 societies (≤3,000 flats), one API instance is enough. Redis isn't needed until you run two.

| | Option A: managed (fastest) | Option B: AWS Mumbai (data in India) |
|---|---|---|
| Web | Cloudflare Pages (free) | S3 + CloudFront |
| API | Render or Railway, Singapore | Lightsail 2 GB + Caddy (auto-HTTPS) |
| Database | Supabase Pro, **Mumbai** (daily backups) | RDS PostgreSQL `db.t4g.micro` with 7-day PITR |
| Logs | Ship to an India-region sink for CERT-In | CloudWatch, Mumbai, 180-day retention |
| Approx. cost | **$35–70 / month** (₹3k–6k) | **$35–75 / month**, ~$150–250 at growth size |

Recommendation: **Option B (AWS Mumbai)** if societies or your lawyer want data and logs in India from day one. Otherwise Option A is quicker. Either way, run a timed **backup restore drill** before launch. Prices are third-party estimates; confirm them on the vendors' pages.

## 4. Step-by-step: from this repo to Google Play

### Phase 1: decisions (you, about 1 day)
Brand name and package ID (Y1), domain (Y2), hosting option (section 3), SMS provider, payment gateway, Personal or Organization Play account (Y3).

### Phase 2: code fixes C1–C13 (in this repo)
Order: C1 → C2 → C8 → C9 (security) → C5 → C6 (compliance) → C3 → C4 → C7 (integrations) → C10–C13 (release and ops).
Each fix ships with a test. Run them in parallel with Phase 3, because DLT registration and payment-gateway KYC can take days to weeks.

### Phase 3: accounts and paperwork (you, in parallel)
Y3–Y7. Start **DLT registration and payment-gateway KYC first**; they take the longest.

### Phase 4: deploy
1. Create the staging and production environments with these settings:
   - `NODE_ENV=production` and a fresh 64-character `JWT_SECRET`.
   - `EXPOSE_DEV_OTP` unset and seeding off.
   - `CORS_ORIGINS` set to your domain and HTTPS everywhere.
2. Run the migrations as a release step, not on container start.
3. Seed **only** the demo society and Play review account, on a separate allow-listed phone number.
4. Restore drill: restore last night's backup into staging and time it.

### Phase 5: build the app
From `apps/mobile`:
```sh
npx eas-cli@latest login
npx eas-cli@latest init              # links the EAS project, sets owner + projectId
npx eas-cli@latest build:configure   # creates eas.json, then edit it as below
```
```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "preview": { "distribution": "internal", "android": { "buildType": "apk" },
                 "env": { "EXPO_PUBLIC_API_URL": "https://api.<domain>/api/v1", "EXPO_PUBLIC_WEB_URL": "https://<domain>" } },
    "production": { "autoIncrement": true,
                    "env": { "EXPO_PUBLIC_API_URL": "https://api.<domain>/api/v1", "EXPO_PUBLIC_WEB_URL": "https://<domain>" } }
  },
  "submit": { "production": { "android": { "serviceAccountKeyPath": "./play-service-account.json", "track": "internal", "releaseStatus": "draft" } } }
}
```
```sh
npx eas-cli@latest build -p android --profile preview      # release-mode APK: test on 2-3 real phones against production
npx eas-cli@latest build -p android --profile production   # signed .aab for Play
```
Test the preview build on real phones before uploading anything. Check:
- the real SMS OTP
- a push notification arriving while the phone is locked
- SOS
- account deletion
- dark mode and the Android back gesture

R8 only runs in release builds.

### Phase 6: Play Console
1. Create the app: default language en-IN, Free, category **House & Home**.
2. **App signing:** keep Play App Signing. EAS manages the upload key. Back it up with `eas credentials -p android`.
3. Fill in **App content**:
   - Privacy policy URL.
   - **App access:** the review phone number plus its fixed OTP, with resident and guard instructions.
   - Ads: No. Target audience: 18+.
   - Content rating questionnaire: users can interact.
   - **Data safety** (draft below).
   - **Data deletion URL.**
4. **Store listing:** title (≤30 characters), short description (≤80), full description, 512×512 icon, 1024×500 feature graphic, and 4–8 screenshots at 9:16.
5. Create a Google Cloud service account with release permission, then:
   ```sh
   npx eas-cli@latest submit -p android --profile production --latest   # goes to Internal testing
   ```

**Data safety draft:**
- **Collected:**
  - name and phone number
  - address (flat, block, society)
  - other personal info (vehicle numbers, visitor names and phones)
  - purchase history (invoices)
  - user content (tickets, comments, poll votes)
  - crash logs (Sentry)
  - device IDs (push tokens)
- **Sharing:** none is shared except with the payment gateway.
- **Encrypted in transit:** yes.
- **Deletion:** users can request it.

### Phase 7: testing tracks → production
1. **Internal testing:** up to 100 testers, usually live within minutes. Fix crashes.
2. **Closed testing:** at least 12 testers opted in for **14 consecutive days**; recruit 15+ to allow for drop-outs. This is required for personal accounts. Then apply for production access.
3. **Production:** country India, **staged rollout 10% → 50% → 100%**, watching Sentry and Android vitals.

### Ongoing deadlines
- **1 Feb 2027:** 16 KB page-size support becomes mandatory for updates. SDK 58 already complies; check App bundle explorer.
- **About Aug 2027:** the next target-API bump, expected to be API 37. Plan an Expo SDK upgrade mid-2027.
- **About May 2027:** most DPDP Rules obligations take effect (notice, security, breach reporting, retention, rights).

## 5. Rough timeline

| Track | Effort |
|---|---|
| Code fixes C1–C13 | ~2–3 weeks of focused work |
| DLT registration + payment-gateway KYC | 1–3 weeks (external) |
| Hosting, domain, deploy, restore drill | 2–4 days |
| Internal test + fixes | ~1 week |
| Closed test (personal account) | 14 days minimum + Google review |
| **Realistic first production release** | **~5–7 weeks from start** |

*This guide is not legal advice. Have a lawyer and a CA confirm the DPDP, CERT-In, RBI, GST and TRAI items in the [compliance audit](audits/2026-10-30-infra-web-compliance-audit.md).*
