# Gatekeeper: production-readiness audit (infra + web)

Date: 2026-10-30. Scope: `docker-compose.yml`, `apps/api/Dockerfile`, `apps/web` (Dockerfile, nginx.conf, src/marketing), README, `.gitignore`, git history (5 commits, HEAD `2ff32e7`). This was a read-only audit. Live probes were run against the local stack (web :8080, api :4000, adminer :8081). No `.env` contents were read.

**Verdict: not launchable as-is.** The current compose file is a dev stack. With its defaults, anyone can sign in as any phone number. There are two separate causes: the dev OTP is returned in the API response, and the JWT secret is a publicly known value. There is also no TLS, no backups, no SMS provider, and the marketing site has fictional content presented as real.

Counts: **BLOCKER 7 · HIGH 9 · MEDIUM 11 · LOW 6**

---

## 1. Findings

### BLOCKER

| # | Finding | Evidence | Fix |
|---|---|---|---|
| B1 | **OTP returned to client = account takeover.** Compose defaults `NODE_ENV` to `development`. `exposeDevOtp` is then true and the OTP request returns `devCode`, so anyone can sign in as any phone, including admins. | `docker-compose.yml`: `NODE_ENV: ${NODE_ENV:-development}`. `apps/api/src/config.ts`: `exposeDevOtp = … NODE_ENV !== 'production'`. `auth.service.ts:18` `return { sent: true, devCode: code }`. Running container: `printenv NODE_ENV` → `development` | Use a prod compose/manifest with `NODE_ENV=production` and no fallback (`${NODE_ENV:?}`). Better: make `exposeDevOtp` opt-in only (`EXPOSE_DEV_OTP==='true'`) rather than "on unless production". |
| B2 | **Known JWT secret accepted.** Compose falls back to `change-me-in-production-please-32chars`. That value is also in the committed `apps/api/.env.example` (commit `b5cd9ed`) and passes `z.string().min(32)`, so anyone can forge tokens for any user. | `docker-compose.yml` `JWT_SECRET: ${JWT_SECRET:-change-me-…}`; `config.ts` only checks length | Use `${JWT_SECRET:?JWT_SECRET required}`. In `config.ts`, refuse to boot in production if the secret equals the example value or is under 32 random bytes. Generate with `openssl rand -base64 48` and store it in the platform secret manager. |
| B3 | **No real OTP delivery.** No SMS provider exists. Once B1 is fixed, nobody can sign in in production. India also requires TRAI DLT registration (entity, header and OTP template) before any provider will deliver. | README "v1 limitations: there is no SMS provider (the OTP is shown in dev only)" | Integrate a DLT-registered provider (MSG91 / Gupshup / Exotel / Twilio India). Register the PE ID, a 6-char header and the OTP template (with brand name) on the DLT portal. Allow 1–2 weeks lead time. Optionally add WhatsApp OTP as a fallback. |
| B4 | **Database and admin GUI exposed on all interfaces, with a trivial password.** Postgres is published on `0.0.0.0:5433` with user/password `gatekeeper`/`gatekeeper`. Adminer is on `0.0.0.0:8081`. On any VPS this means full DB compromise. | `docker-compose.yml` `ports: "5433:5432"`, `adminer … "8081:8080"`. `docker compose ps` shows `0.0.0.0:5433`, `0.0.0.0:8081`. `curl :8081` → 200 | Prod: no `ports:` on db, no adminer service, a random DB password from secrets, and preferably managed Postgres with private networking. Use an SSH tunnel or bastion for admin access. |
| B5 | **No TLS, no domain.** The API is served as plain HTTP on :4000 and the web as plain HTTP on :80. Bearer JWTs and OTPs would travel in cleartext. | Compose publishes `4000:4000` and `8080:80`; no proxy/cert anywhere | Terminate TLS at a reverse proxy (Caddy auto-HTTPS) or a platform/CDN edge. Serve web on `gatekeeper.in` (example), API on `api.` or same-origin `/api`, and redirect all HTTP to HTTPS. |
| B6 | **No backups, no restore path.** Data lives in one Docker named volume on one host. That data is the visitor audit trail, billing records and SOS history. | `volumes: pgdata:`; no dump job, no PITR. Roadmap's TC-OPS-01 "backups and restore drill" is not done | Use managed Postgres with daily snapshots and PITR (≥7 days). Also add a nightly `pg_dump -Fc` to object storage in another region/account with 30-day retention. Run a restore drill before launch and then monthly. |
| B7 | **Public site has fictional or misleading content and a dead contact path.** (a) Testimonials are fictional placeholders but labelled "Names changed for privacy", which presents them as real. That is a misleading-advertisement risk under the Consumer Protection Act 2019 and the ASCI code. (b) The contact form shows "Thanks" but sends nothing. (c) Contact details are placeholders: `hello@gatekeeper.example`, and `+91 80 4000 0000`, which may be a real Bengaluru number. (d) Privacy and Terms are marked "Draft for review" and fall short of the DPDP notice requirements (see §4). | `Home.tsx:251` comment "fictional placeholders"; `Home.tsx:267` "Names changed for privacy."; `Contact.tsx:13-21` `setSent(true)` only; `Contact.tsx:52-53`, `MarketingLayout.tsx:78`; `About.tsx:74` "Draft for review." | Remove the testimonials until you have consented quotes. Wire the form to the API (`POST /leads` → email via SES/Resend) or replace it with mailto. Put in the real domain email, phone and support@. Have counsel finalise the Privacy Notice and Terms, including grievance officer details. |

### HIGH

| # | Finding | Evidence | Fix |
|---|---|---|---|
| H1 | **Web serves no security headers** (no CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy or Permissions-Policy). The nginx version is also disclosed. (The API does set them via helmet.) | `curl -I :8080/` returns only Server `nginx/1.27.5`, Cache-Control, ETag; `nginx.conf` has no `add_header` for security | Put the headers in a snippet and `include` it in **every** `location` block, because nginx does not inherit `add_header` into a location that defines its own. Add `server_tokens off`. The CSP must allow the inline theme script in `index.html` (sha256 hash), `fonts.googleapis.com`/`fonts.gstatic.com` (or self-host fonts), and `connect-src` for the API origin. Add HSTS once on HTTPS. Use `frame-ancestors 'none'`. |
| H2 | **Build-time and runtime config is hard-coded to localhost.** `VITE_API_URL` is baked as `http://localhost:4000/api/v1`, so a prod build calls the visitor's own machine. API `CORS_ORIGINS` is a hard-coded localhost list in compose with no env override. | `docker-compose.yml` web `args: VITE_API_URL: http://localhost:4000/api/v1`; api `CORS_ORIGINS: http://localhost:8080,…`; `apps/web/src/lib/api.ts:5` fallback to localhost | Pass `VITE_API_URL=https://api.<domain>/api/v1` in CI per environment. A simpler option is to serve the API same-origin under `/api` via the edge/nginx and set `VITE_API_URL=/api/v1`, which removes CORS entirely. Set `CORS_ORIGINS` from env. |
| H3 | **Demo data is seeded into whatever DB the container starts against.** Seeding runs on every start unless `NODE_ENV=production`. It creates admin `9000000001` and gate passcodes `135790`/`482913`, all published in the README. | `apps/api/Dockerfile` CMD `S=${SEED_ON_START:-$NODE_ENV}; … npx prisma db seed` | Prod: `SEED_ON_START=false` explicitly. Remove the seed step from the prod image CMD and run it only as a manual job for demo environments. |
| H4 | **No CI/CD.** There is no `.github/` and no workflows, so no tests run on PRs, there are no image builds or tags, and there is no rollback. The roadmap promised a "CI workflow (typecheck, lint, test)". | `git ls-files` has no workflow files; `docs/11-ROADMAP.md:93,194` | GitHub Actions: on PR run `tsc --noEmit`, the vitest suite (with a Postgres service container), `npm audit --omit=dev --audit-level=high`, and web build. On main, build and push images tagged with the git SHA to GHCR/ECR, deploy to staging, smoke-test `/health`, then promote to prod manually. |
| H5 | **No observability.** There is no error tracking (Sentry), uptime monitoring, metrics, alerting or log shipping. `/health` does not touch the DB. CERT-In Directions require 180-day log retention in India and 6-hour incident reporting. | `grep sentry` returns nothing; `app.ts` `/health` returns static ok; pino logs go to stdout only | Sentry (free/Team) for API and web. Better Stack / UptimeRobot on `https://…/health` with alerts to phone/WhatsApp. Add a `/health/ready` that runs `SELECT 1`. Ship stdout logs to CloudWatch (ap-south-1) or Better Stack with ≥180-day retention. Write a one-page incident runbook that includes the CERT-In reporting step. |
| H6 | **No restart policies, resource limits or redundancy.** A single crash means an outage until someone notices. A gate app that is down blocks visitor entry. | `docker inspect` shows `restart=no mem=0 cpus=0` for api/db/web | Prod: `restart: unless-stopped` (or the platform equivalent), memory limits, compose healthchecks on api/web. Write down a guard fallback (paper register / passcode-only mode) for API outages. |
| H7 | **The JWT travels in the SSE query string.** `/events?token=<JWT>` appears in reverse-proxy, CDN and load-balancer access logs. The API logger strips query strings, but nginx, ALB and Cloudflare do not. Tokens last 7 days and cannot be revoked. | `apps/web/src/lib/sse.ts:31`; `config.ts` `JWT_EXPIRES_IN 7d`; `app.ts` comment "/events carries the JWT in ?token=" | Short-term: strip or mask the query string in edge/proxy log formats. Better: exchange the JWT for a short-lived (60 s) single-use SSE ticket, or use a cookie on same-origin `/api`. Add refresh tokens or a server-side `tokenVersion` for revocation. |
| H8 | **Payments are mocked.** If maintenance dues will be collected, the money must go through an RBI-authorised Payment Aggregator. Funds should settle **directly to each society's bank account** (Razorpay Route / Cashfree Split / sub-merchant onboarding). If the platform pools funds, it risks needing its own PA authorisation. | README "payment gateway is mocked"; Terms: "processed in test mode" | Launch with billing as invoices plus offline/UPI-QR mark-paid, or integrate Razorpay/Cashfree with linked accounts per society and verified webhooks (signature check, idempotency). |
| H9 | **DPDP Act gaps in the product.** There is no notice or consent at OTP sign-up and no consent records. There is no data-principal rights flow (access/correction/erasure; currently "contact us"). No grievance officer or DPO contact is published. There is no retention/deletion schedule for visitor data, which belongs to third parties who never signed up and is entered by guards. There is no breach-notification runbook. Most Rule obligations apply from about May 2027, but notice and security are expected now, and societies will ask. | `About.tsx:53-59` privacy text; no consent fields in auth flow | See the §4 checklist. Minimum for launch: notice and consent checkbox at sign-in, visitor-data retention (e.g. auto-purge or anonymise visitor PII after N days, with configurable audit retention), a published grievance contact, and a DPA/processor agreement with each society (the society is the Data Fiduciary for resident data and you are its processor; confirm with counsel). |

### MEDIUM

| # | Finding | Evidence | Fix |
|---|---|---|---|
| M1 | API dependencies have high-severity advisories: `zod <4.6.6` (memory exhaustion, GHSA-mrhx-c7xc-m3w5, **runtime**, reachable from unauthenticated `/auth` bodies; partly mitigated by the 100 kb JSON limit) and `deepmerge-ts` via the `prisma` CLI (GHSA-ggr8-5vv4-36mx; the CLI ships in the runtime image). | `apps/api npm audit --omit=dev` → 4 high | Upgrade zod to 4.x (breaking: schema API changes) and prisma to 7.x on a branch, then run the suite. Gate CI on `--audit-level=high`. |
| M2 | Web dependencies: react-router 6.x has 2 moderate advisories (open redirect via backslash in `<Link>`/`useNavigate`; SSR hydration not used). | `apps/web npm audit --omit=dev` → 2 moderate | Upgrade to react-router 7.18+ (`react-router-dom` → `react-router`), or validate any user-controlled redirect targets. |
| M3 | The API image ships full `node_modules` (dev deps, prisma CLI, tsx) and runs as **root**. | `apps/api/Dockerfile` comment + no `USER` | Add `USER node`. Run migrations as a separate release job (`prisma migrate deploy`) rather than in CMD, then prune dev deps (`npm ci --omit=dev` in a separate stage). |
| M4 | Migrations run inside the container start command. With more than one replica or a rolling deploy, they race. There is also no staging environment to rehearse them on. | Dockerfile CMD `npx prisma migrate deploy` | Run a pre-deploy release step (Render "pre-deploy command", ECS one-off task, Railway deploy hook) against staging first. |
| M5 | The design is single-replica only: the SSE hub is an in-process `EventEmitter`, the OTP rate limiter uses the in-memory store, and the sweeper uses `setInterval`. With 2+ replicas, events miss users on other replicas, the rate limit is per-replica, and sweeps double-run. | `events.ts` `new EventEmitter()`; `rateLimit.ts` default store; `index.ts` ponytail note | Fine at launch with 1 replica. When scaling: Postgres `LISTEN/NOTIFY` (no new infra) or Redis pub/sub for the bus, `rate-limit-redis` (or a PG store), `pg_try_advisory_lock` around the sweep. |
| M6 | `trust proxy 1` is only correct for exactly one proxy hop. Behind CDN + LB (2 hops), `req.ip` is the CDN edge, so OTP rate limiting collapses onto edge IPs. | `app.ts:41` | Set the hop count per environment (`TRUST_PROXY` env), or use `CF-Connecting-IP` behind Cloudflare. |
| M7 | Caching is correct (hashed `/assets/` immutable for 1y, shell `no-cache`), but there is **one 498 KB JS chunk (140 KB gz)** with no code-splitting. Marketing visitors download the full admin, guard and resident app. | `dist/assets/index-*.js` 497,967 B; `grep lazy(` → 0 | `React.lazy` the `/app/*` route tree. That is a one-line change per route group and should halve the marketing first load. |
| M8 | SEO: `robots.txt` and `sitemap.xml` return `index.html` with 200 (soft-200), and unknown routes return 200 (soft-404). There are no OG/Twitter tags, no canonical URL and no per-route `<title>`. Only one global meta description exists. | `curl /robots.txt`, `/sitemap.xml`, `/nonexistent-route` → 200 text/html; `index.html` | Add `public/robots.txt` (disallow `/app`), `public/sitemap.xml` (6 marketing URLs), OG/Twitter tags, and a 1200×630 OG image. Set `document.title` per marketing route. Optionally prerender marketing pages (vite-plugin-prerender / `vite-ssg`). |
| M9 | Brand and pricing content: the hero mock uses real brands (Swiggy, Uber, Urban Company), which implies a partnership or trademark use. Pricing shows ₹2/₹4 per flat as real prices, with "illustrative" only in a code comment and no GST note. | `Home.tsx:14,16,18,55`; `Pricing.tsx:7-13` | Use generic labels ("Food delivery", "Cab", "Home services"). Confirm the prices, add "+ 18% GST", or label them "indicative". |
| M10 | `.gitignore` ignores only `.env`, not `.env.*` (`.env.local`, `.env.production`). The `.dockerignore` files do cover them. | `.gitignore` line `.env` | Add `.env.*` and `!.env.example`. |
| M11 | The PWA is half-done. The manifest declares `display: standalone` but there is no service worker, and the only icon is an SVG (no 192/512 PNG, no apple-touch-icon), so installability fails on Android/iOS. | `public/manifest.webmanifest`; no SW in `src` | Either drop the manifest's install intent or add PNG icons plus `vite-plugin-pwa` (shell caching only; never cache API responses). The guard console would benefit from an offline shell. |

### LOW

| # | Finding | Evidence | Fix |
|---|---|---|---|
| L1 | Git history is clean of real credentials. Secret-like strings appear only in `apps/api/.env.example`, `docker-compose.yml` (default JWT, see B2), `apps/api/vitest.config.ts` (test secret), `apps/web/src/pages/Login.tsx` / `marketing/Home.tsx` (UI copy) and `docs/*` (all in `b5cd9ed`). No `.env` files were ever committed (only `.env.example` ×3). | `git log -p --all` scan (file names only) | None. Keep secret scanning (gitleaks) in CI. |
| L2 | Images are pinned by tag rather than digest, and `nginx:1.27-alpine` is a superseded mainline line. | Dockerfiles | Use `nginx:1.28-alpine` (stable) or later, and let Renovate/Dependabot bump. |
| L3 | Google Fonts load from a third party: render-blocking, with a CSP/privacy footprint (IP sent to Google). | `index.html` | Self-host the fonts with `@fontsource/fraunces` and `@fontsource/manrope`. |
| L4 | gzip only, no brotli. Compression starts at 1 KB, which is fine. | `nginx.conf` | The CDN edge (Cloudflare/CloudFront) does brotli for you. |
| L5 | The README documents demo phones and passcodes. That is fine for dev but becomes a credential leak if a prod DB is ever seeded (H3). | README | Keep, but label it "dev only". |
| L6 | API `/health` is the only probe and compose has no healthcheck for api/web. | `app.ts`, compose | Add liveness and readiness probes (see H5). |

### What a production topology should look like

```
Users ─► CDN/edge (Cloudflare or CloudFront; TLS, HSTS, WAF/rate-limit on /auth, brotli)
          ├─ static SPA (Cloudflare Pages / S3) with security headers + robots/sitemap
          └─ /api/* ─► API (1 replica now, 2+ later) in India/SG region, NODE_ENV=production,
                         secrets from platform store, USER node, no host ports except via LB
                         └─► Managed Postgres (private network, TLS, daily snapshots + PITR,
                               nightly pg_dump to object storage in a second region)
Side: SMS (DLT-registered), transactional email (SES/Resend), Sentry, uptime monitor,
      log sink with 180-day retention, GitHub Actions → GHCR/ECR → staging → prod.
No adminer, no published DB port, no seed in prod.
```

---

## 2. Hosting plan (launch: about 3–10 societies, ≤3,000 flats, under 5 req/s peak)

Prices are rough USD/month from 2026 third-party trackers. Verify on the vendors' pages before budgeting. FX ≈ ₹85/$.

### Option A: Managed PaaS (least ops). About $35–70/mo (₹3k–6k)

| Piece | Choice | Cost |
|---|---|---|
| Web | Cloudflare Pages (free; `_headers` for CSP/HSTS, `_redirects` for SPA fallback). Cloudflare DNS and proxy in front of the API too. | $0 |
| API | Render Starter web service, Singapore (no India region; ~60 ms to India), 0.5 CPU / 512 MB, or Railway (Singapore) on usage | ~$7–25 |
| DB | Supabase Pro in **ap-south-1 Mumbai** (daily backups, 7-day retention; PITR is a paid add-on), or Render Postgres basic in Singapore (~$6+, check backup tier), or Neon Launch (Singapore; pooled connection) | $6–25 (+PITR) |
| SMS | DLT-registered OTP provider (MSG91/Gupshup etc.), pay per SMS (paise per OTP; get quotes) | usage |
| Email | Resend / AWS SES for transactional; Zoho Mail or Google Workspace for `support@`/`grievance@` | $0–10 |
| Monitoring | Sentry Developer/Team, Better Stack or UptimeRobot free, log drain to Better Stack | $0–30 |
| Domain | `.in` / `.com` | ~$1 |

Codebase/config changes for A:
- `VITE_API_URL` set per environment in the Pages build env, or proxy `/api` through a Cloudflare Worker to stay same-origin.
- `NODE_ENV=production`, `SEED_ON_START=false`, a strong `JWT_SECRET`, `CORS_ORIGINS=https://<domain>` in Render env.
- Move `prisma migrate deploy` to Render's **pre-deploy command**. Remove migrate and seed from CMD.
- Neon/Supabase: use the pooled URL for the app (`?pgbouncer=true&connection_limit=…`) and add `directUrl` in `schema.prisma` for migrations.
- `trust proxy` set to the right hop count behind Cloudflare + Render.
- Verify SSE through the edge: Cloudflare proxied requests have a 100 s idle timeout and the 25 s heartbeat is fine. Render is fine.
- Data location caveat: API logs in Singapore. For CERT-In "logs in India" (180 days), ship logs to an India-region sink (CloudWatch ap-south-1 or self-retained), or pick Option B.

### Option B: AWS Mumbai (ap-south-1). Launch about $35–75/mo; growth about $150–250/mo

| Stage | Pieces | Cost |
|---|---|---|
| Launch | Lightsail 2 GB instance (Mumbai; half the transfer allowance of other regions) running the API image behind **Caddy** (auto-TLS). RDS PostgreSQL `db.t4g.micro` single-AZ (~$15) + 20 GB gp3 + 7-day automated backups/PITR. S3 + CloudFront for the SPA (response-headers policy for CSP/HSTS). SES (Mumbai) for email. Route 53 ($0.50/zone). CloudWatch Logs with 180-day retention. | ~$35–75 |
| Growth | ECS Fargate or App Runner, 2 tasks, behind ALB (~$18+). RDS Multi-AZ `db.t4g.small` (~$50–60). ElastiCache Redis t4g.micro (~$12) for SSE fan-out and rate limits. WAF on ALB/CloudFront. | ~$150–250 |

Codebase/config changes for B:
- Prod compose override (Lightsail) or task definition with no db/adminer services and API on `127.0.0.1:4000` behind Caddy.
- `DATABASE_URL` pointing at RDS with `sslmode=require`; secrets in SSM Parameter Store.
- A one-off migration task in the deploy pipeline.
- At more than one replica, the M5 changes are required: Redis (or PG LISTEN/NOTIFY) pub/sub for `bus`, `rate-limit-redis`, and an advisory lock on the sweeper. ALB idle timeout ≥ 60 s for SSE (heartbeat is 25 s).
- `trust proxy` = 2 for CloudFront + ALB.

**Recommendation:** start on A (Cloudflare Pages + Render or Railway + Supabase Mumbai) if speed of launch matters most. Pick B-launch if societies or counsel want data and logs in India from day one. Both stay single-replica at launch. Neither needs Redis until you run 2+ API instances.

Cheapest fallback (not recommended without discipline): a single ~$12–24 VPS in Mumbai/Bangalore with a prod compose override, Caddy, and a nightly `pg_dump` cron to S3. You own patching, backups and uptime.

---

## 3. Pre-launch infra checklist (ordered)

1. Fix B1/B2/H3: prod env with no fallbacks; code refuses a known secret; dev OTP opt-in only; no seed.
2. Domain + DNS (Cloudflare) + TLS. Set `VITE_API_URL`/`CORS_ORIGINS` (H2). Add web security headers (H1).
3. Managed Postgres with PITR + nightly off-site dump. **Restore drill done and timed** (B6).
4. DLT registration + SMS provider live (B3). Transactional email + `support@` + `grievance@` mailboxes.
5. GitHub Actions: test → build → staging → prod. Migrations as a release step (H4, M4).
6. Sentry + uptime alert + readiness probe + 180-day log retention (H5).
7. Marketing content clean-up: testimonials, contact form, brands, prices, legal pages (B7, M9).
8. Dependency upgrades (M1, M2), non-root image (M3), code-split (M7), SEO files (M8).

---

## 4. India compliance checklist

**This is not legal advice. Have Indian counsel and a CA confirm each item.**

### DPDP Act 2023 + DPDP Rules 2025
The Rules were notified around 13–14 Nov 2025. Rules 1, 2 and 17–21 took effect immediately. **Rules 3 and 5–16 (notice, security, breach, retention, rights, grievance) take effect 18 months later, around May 2027.**

- [ ] Decide the role: for resident and visitor data, the **society is likely the Data Fiduciary and Gatekeeper its Processor**. For the marketing site, leads and your own accounts, Gatekeeper is the Fiduciary. Sign a processing agreement (DPA) with each society.
- [ ] **Notice (Rule 3):** clear, standalone, itemised data and purposes, how to withdraw consent, how to exercise rights, and how to complain to the Board. Show it at first sign-in and record consent (timestamp, notice version).
- [ ] **Security safeguards (Rule 6):** encryption in transit and at rest, access control, logging, **backup and recovery** (ties to B6), and the same obligations flowed down to sub-processors (hosting, SMS, email).
- [ ] **Breach intimation (Rule 7):** notify affected Data Principals and the Data Protection Board without delay. A detailed report to the Board follows, commonly cited as within 72 hours; confirm against the Gazette text (G.S.R. 846(E)). Keep a runbook and templates.
- [ ] **Retention/erasure (Rule 8):** delete when the purpose is served, with 48 h notice before erasure. **Keep processing logs ≥1 year.** Define a visitor-PII purge schedule.
- [ ] **Contact (Rule 9):** publish DPO or authorised-person contact details prominently on the site and in the app.
- [ ] **Rights + grievance (Rules 13–14):** access, correction, erasure, nomination. Respond within the published period (commentary cites 90 days as the outer limit).
- [ ] Children: if minors are registered as residents, verifiable parental consent is required. Avoid it, or let only adults hold accounts.
- [ ] Cross-border: transfer is allowed except to notified countries. Singapore hosting is acceptable, but record it in the notice.

Sources: [SCC Online, DPDP Rules 2025 key highlights](https://www.scconline.com/blog/post/2025/12/26/digital-personal-data-protection-rules-2025-key-highlights/) · [Mondaq, Rules notified](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified) · [KPMG guidance PDF](https://assets.kpmg.com/content/dam/kpmgsites/in/pdf/2025/11/dpdp-rules-2025-guidance-to-dpdp-act-implementation.pdf) · [JSA Prism Nov 2025](https://www.jsalaw.com/?p=55573) · [EY on DPDP Rules](https://www.ey.com/en_in/insights/cybersecurity/transforming-data-privacy-digital-personal-data-protection-rules-2025) · [YourStory, 18-month rollout](https://yourstory.com/2025/11/digital-personal-data-protection-dpdp-rules-2025-rollout-over-18-months)

### CERT-In Directions (28 Apr 2022, in force 27 Jun 2022)
- [ ] Report specified cyber incidents to CERT-In **within 6 hours** of noticing them.
- [ ] Keep ICT system logs for a **rolling 180 days within India**.
- [ ] Sync clocks to NIC/NPL NTP (or a source traceable to them).
- [ ] Name a point of contact with CERT-In.

Sources: [Mondaq, 6 hours to report](https://www.mondaq.com/india/it-and-internet/1270332/6-hours-to-report-cyber-incidents-to-cert-in) · [Mondaq overview](https://www.mondaq.com/india/security/1191962/an-overview-on-the-cert-in-cyber-security-directions-2022) · [ManageEngine summary](https://www.manageengine.com/log-management/cyber-security/cert-in-compliance-for-indian-enterprises.html) · primary text at cert-in.org.in

### Payments (RBI)
- [ ] Use only an **RBI-authorised Payment Aggregator**. Razorpay and Cashfree received final PA authorisation in Dec 2023. Check the current RBI list.
- [ ] Society maintenance must settle **to the society's own account** (Route / split settlements / sub-merchant KYC per society). The platform must not pool resident funds.
- [ ] Verify webhook signatures, make the payment path idempotent, and never store card data (PA-hosted checkout keeps you out of PCI-DSS scope).

Sources: [Moneylife, Razorpay/Cashfree final approval](https://www.moneylife.in/article/razorpay-cashfree-get-final-approval-from-rbi-to-function-as-payment-aggregators/72912.html) · [Entrackr](https://entrackr.com/2023/12/razorpay-cashfree-get-final-pa-license-can-onboard-new-merchants) · [Outlook Money, new PA directions](https://www.outlookmoney.com/amp/story/banking/payment-aggregator-guidelines-rbi-issues-new-directions-for-payment-aggregators)

### GST
- [ ] SaaS subscriptions attract **18% GST**. For an Indian supplier, registration is mandatory above ₹20 lakh aggregate turnover (₹10 lakh in special-category states). Many B2B buyers (societies/RWAs, facility managers) will want a GSTIN invoice anyway, so register early.
- [ ] Show prices "+ GST" on the pricing page (M9). Issue GST-compliant tax invoices from billing.
- [ ] Note: maintenance collected *by the society* from residents has its own GST rules (₹7,500 per flat per month exemption). That is the society's liability, not yours, but your invoice templates must not mislabel it.

Sources: [Kintsugi India GST guide](https://trykintsugi.com/sales-tax-guides/apac/india) · [Taxadda on OIDAR/thresholds](https://taxadda.com/decoding-oidar-services-under-gst/) · [Stripe India GST](https://stripe.com/resources/more/india-vat-tax) · confirm with a CA / cbic.gov.in

### SMS OTP (TRAI TCCCPR 2018, DLT)
- [ ] Register as a **Principal Entity** on an operator DLT portal (PAN plus business documents).
- [ ] Register a **header** (6-char sender ID) and the **OTP content template**. OTP templates must contain the brand name.
- [ ] Unregistered entity, header or template means operators drop the SMS. Pass the PE ID and template ID with every send.

Sources: [Exotel, TRAI regulations](https://support.exotel.com/support/solutions/articles/3000096504) · [Infobip DLT registration](https://www.infobip.com/docs/essentials/dlt-registration) · [Fast2SMS, OTP template IDs](https://www.fast2sms.com/help/?p=16520) · [Netcore DLT FAQs](https://cedocs.netcorecloud.com/docs/dlt-faqs) · [MoEngage India messaging regulations](https://help.moengage.com/hc/en-us/articles/360060712432)

### Consumer / advertising
- [ ] No fictional testimonials presented as real (Consumer Protection Act 2019, misleading ads; ASCI code). Get written consent for real quotes.
- [ ] Remove third-party trademarks implying association (Swiggy/Uber/Urban Company).
- [ ] Publish final Terms, Privacy Notice, Refund/Cancellation policy (PAs require it for merchant onboarding), and a working grievance contact.

### Hosting price sources
[Render pricing 2026 (activepieces)](https://www.activepieces.com/blog/render-pricing-2026-free-tier-workers-total-cost.md) · [PricingSaaS Render](https://pricingsaas.com/companies/render) · [Neon pricing breakdown](https://vela.simplyblock.io/articles/neon-serverless-postgres-pricing-2026) · [Spare Cores db.t4g.micro](https://sparecores.com/database/aws/db.t4g.micro) · [Bytebase RDS db.t4g.micro](https://www.bytebase.com/dbcost/rds/instance/db.t4g.micro/) · [Lightsail data transfer (Mumbai half allowance)](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-faq-data-transfer-allowance.html)
