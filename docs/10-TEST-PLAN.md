# Gatekeeper — Test Plan

| | |
|---|---|
| **Document** | 10-TEST-PLAN |
| **Version** | 1.0 |
| **Source of truth** | [`00-PROJECT-BRIEF.md`](./00-PROJECT-BRIEF.md) |
| **Requirements** | [`02-SRS.md`](./02-SRS.md). Every `TC-*` below appears in the SRS traceability matrix (§7) |

---

## 1. Purpose and scope

This plan defines how Gatekeeper v1 is verified against the SRS. It covers:

- `apps/api` — all endpoints in brief §7, business rules, state machines, SSE.
- `apps/web` — the marketing site and the web app (manual E2E plus automated a11y checks).
- `apps/mobile` — Resident and Guard flows (manual E2E on device or emulator).
- The `docker-compose.yml` stack (smoke).
- Cross-cutting security, accessibility, performance and privacy requirements.

Out of scope: post-v1 features (brief §3 "Out of scope"), real SMS delivery and real payment gateways.

## 2. Test strategy

| Level | What | Tooling | Owner | Automation |
|---|---|---|---|---|
| **Unit** | Pure logic: visitor, ticket, SOS and pre-approval state machines; passcode generator; slot calculator; IST date helpers; paise formatting; Zod schemas; KPI maths | Vitest | Developer | Automated, runs on every commit |
| **Integration (API)** | Each endpoint through the full middleware chain (helmet → auth → tenancy → RBAC → Zod → service → Prisma) against a **real PostgreSQL test DB** | Vitest + supertest | Developer | Automated, runs on every commit |
| **Realtime** | SSE auth, routing and heartbeat. Event emitted → received by the right recipients only | Vitest + an SSE client (`eventsource` or raw `http.get` stream parsing) | Developer | Automated |
| **Smoke** | Whole docker-compose stack boots, seeds, and the core gate flow works end to end | Bash script (§8) using curl + jq | Developer / QA | Scripted, run per phase and per release |
| **E2E (manual)** | Web and mobile user journeys per role, using the seed accounts | Browser, Expo Go / emulator | QA | Manual checklist (§7.13). Candidates for later automation |
| **Security** | OWASP Top 10 checks, IDOR sweep, header and CORS checks, dependency audit, secret scan | supertest, `npm audit`, gitleaks (or equivalent grep), OWASP ZAP baseline (optional) | Developer / QA | Mostly automated |
| **Accessibility** | WCAG 2.1 AA: automated scans plus keyboard and screen-reader passes | axe DevTools / `@axe-core/cli`, Lighthouse, NVDA or VoiceOver, TalkBack | QA | Semi-automated |
| **Performance** | Latency SLOs and SSE fan-out | k6 or autocannon against the compose stack with scaled seed | Developer | Run in Phase 6 |

**Principles**
- Test against a real Postgres, never mocks. Uniqueness constraints, transactions and row locks are part of the behaviour under test.
- Each integration test file creates its own society through factories, so tests are independent and order-agnostic.
- Time-dependent rules (10-minute visitor expiry, 5-minute OTP expiry, poll close, overdue) are tested by **backdating rows directly via Prisma**, for example setting `createdAt = now − 11 min`. No real waiting, and no global fake timers against DB time.
- One test case ID may map to several `it()` blocks. The `describe` names include the TC ID, for example `describe('TC-VIS-03 resident approves', …)`, so results trace back to this plan.

## 3. Test environments

| Env | Purpose | Composition | Data |
|---|---|---|---|
| **local-dev** | Developer runs | `docker compose up` (db, adminer, api, web) | Seed (brief §9) |
| **test** | Automated integration tests | Postgres 16 (compose `db` service or a dedicated container) with database `gatekeeper_test`. API in-process via supertest (`createApp()` without `listen`) | Created by factories per test file. Tables truncated in `beforeAll` |
| **staging** | Smoke, manual E2E, a11y, performance | Same compose file on a VM, `NODE_ENV=production` except where a test needs dev OTP (use a `staging` env with `NODE_ENV=development` for E2E accounts) | Seed + scaled synthetic data for performance |
| **mobile** | Mobile E2E | Expo Go on 1 Android (10+) and 1 iOS device, pointed at local-dev or staging API URL | Seed |

**Test-DB setup**

```bash
# from apps/api
export DATABASE_URL="postgresql://gatekeeper:gatekeeper@localhost:5432/gatekeeper_test"
npx prisma migrate reset --force --skip-seed   # clean schema
npx vitest run                                 # unit + integration
npx vitest run --coverage                      # coverage gate (≥ 80% services)
```

Vitest runs integration files with `pool: "forks"` and `fileParallelism: false` (or one schema per worker) to avoid cross-file DB interference.

## 4. Test data

### 4.1 Seed accounts (brief §9)

Society **Emerald Heights**, Bengaluru. Blocks **A**, **B**. Flats **A-101…A-104**, **B-201…B-204**.

| Role | Phone | Name | Flat | Used for |
|---|---|---|---|---|
| ADMIN | 9000000001 | Ananya Rao | — | Admin console, generate invoices, notices, polls, reports |
| RESIDENT | 9000000002 | Rohan Mehta | A-101 | Visitor decisions, pre-approvals, bookings, payments, SOS |
| GUARD | 9000000003 | Suresh Kumar | — | Gate console, check-in/out, passcode verify, SOS handling |
| RESIDENT | 9000000004 | Priya Iyer | B-201 | Cross-flat isolation (must **not** see A-101 data) |

| Fixture | Value |
|---|---|
| Staff passcode | `482913` |
| Pre-approval passcode | `135790` (for a seeded flat, ACTIVE, `maxUses = 1`) |
| Amenities | Clubhouse, Tennis Court, Swimming Pool |
| Invoices | Current month (`YYYY-MM` in IST), one per flat |
| Other | Sample notices, one poll, sample tickets, sample expenses |

In dev, the OTP is read from the `devCode` field of `POST /auth/otp/request`.

### 4.2 Factories (integration tests)
`createSociety()`, `createFlat(block, number)`, `createMember(role, {flat, residentType})` (returns the JWT plus headers), `createVisitor(status, {createdAt})`, `createPreApproval({passcode, validFrom, validTo, maxUses})`, `createStaff({passcode, isActive})`, `createAmenity({capacity, slotMinutes})`, `createInvoice({period, status, dueDate})`. Factories also create a **second society** so cross-tenant tests are possible.

### 4.3 Data rules
- Phones in tests use the `98xxxxxxxx` range, never real numbers.
- Money is always integer paise in fixtures (`250000` = ₹2,500.00).
- No production data in any test environment.

## 5. Entry and exit criteria

| | Criteria |
|---|---|
| **Entry (per phase)** | Phase scope merged. Migrations apply cleanly. Seed runs. Unit and integration suites green locally. |
| **Exit (per phase)** | All TCs mapped to the phase's FRs pass. No open Sev-1/Sev-2 defects. Smoke (§8) passes. Coverage ≥ 80% on services touched. |
| **Exit (v1 release)** | 100% of `Must` and `Should` FRs have passing TCs. `npm audit` shows no high/critical issues. axe shows 0 serious or critical issues on the key screens (§10). PERF SLOs met (§11). The backup/restore drill (TC-OPS-01) has passed. |

## 6. Defect severity

| Sev | Definition | Example | Release blocker |
|---|---|---|---|
| 1 | Security breach, data loss, cross-tenant leak, core gate flow broken | Resident sees another flat's visitors | Yes |
| 2 | Major feature broken, no workaround | Booking exceeds capacity | Yes |
| 3 | Feature impaired, workaround exists | Wrong sort order on notices | No (fix by next patch) |
| 4 | Cosmetic | Misaligned chip | No |

## 7. Test cases

Legend. **Level**: U = unit, I = integration (Vitest + supertest + Postgres), S = SSE integration, M = manual E2E, X = security, A = accessibility, P = performance, O = ops. Unless stated otherwise, requests carry `Authorization: Bearer <jwt>` and `X-Society-Id` for the relevant seed or factory member.

### 7.1 Platform (SYS)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-SYS-01 | FR-SYS-01 | I | `GET /health` and `GET /api/v1/health`. Then stop the DB (test via Prisma disconnect mock) | 200 `{status:"ok", db:"up"}`. With the DB down, 503 with `db:"down"` |
| TC-SYS-02 | FR-SYS-02 | I | `GET /api/v1/nope`. `POST /visitors` with an invalid body. Force a service throw | 404 / 400 / 500, each in the `{error:{code,message}}` envelope. The 500 has no stack in production mode |
| TC-SYS-03 | FR-SYS-03 | I | Create 60 notices. `GET /notices`; `?limit=10`; `?limit=500`; `?limit=0`; `?limit=abc` | 50 items; 10 items; clamped to 200 (returns all 60); 400; 400. Items newest first (pinned rules aside) |
| TC-SYS-04 | FR-SYS-04 | U/I | Create a visitor at 2026-01-01T20:00Z. `GET /visitors?date=2026-01-02` | Timestamps end in `Z`. The visitor is included (20:00Z = 01:30 IST on Jan 2) |
| TC-SYS-05 | FR-SYS-05 | I | Run the seed twice on an empty DB | All brief §9 entities exist with the documented phones and passcodes. Row counts unchanged after the second run |
| TC-SYS-06 | FR-SYS-06 | U/I | Schema tests for each DTO. `POST /tickets` with an extra `status:"CLOSED"` and `societyId:"x"` | Invalid shapes → 400 with `details`. The extra keys are stripped and the ticket is created `OPEN` in the caller's society |

### 7.2 Authentication (AUTH)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-AUTH-01 | FR-AUTH-01 | I | `POST /auth/otp/request {phone:"9000000002"}` (dev) | 200 `{sent:true, devCode:/^\d{6}$/}`. The `OtpCode` row has a bcrypt `codeHash` ≠ devCode, `expiresAt ≈ now+5m`, `attempts=0`. Earlier unconsumed codes for the phone are invalidated |
| TC-AUTH-02 | FR-AUTH-02 | I | Request an OTP 6× in quick succession for the same phone and IP | Requests 1–5 → 200. Request 6 → 429 `RATE_LIMITED` |
| TC-AUTH-03 | FR-AUTH-03 | I | Request, then verify with devCode for 9000000002 | 200 `{token, user, memberships}`. The membership includes `society.name="Emerald Heights"` and `flat.number="101"` with block A. `consumedAt` set |
| TC-AUTH-04 | FR-AUTH-04 | I | Verify with a wrong code 5×, then with the correct code | Attempts 1–5 → 401 `OTP_INVALID`, `attempts` increments to 5. The 6th call (correct code) → 429 `OTP_LOCKED` |
| TC-AUTH-05 | FR-AUTH-05 | I | Build the app with `NODE_ENV=production`. Request an OTP. Capture logs | Response has no `devCode`. No 6-digit code appears in the log output |
| TC-AUTH-06 | FR-AUTH-06 | I | Call `GET /me` with: no header; `Bearer garbage`; a token signed with a wrong secret; an expired token (`exp` in the past); `alg:none` | All → 401 `UNAUTHENTICATED`. A valid token's decoded payload has only `sub`, `iat`, `exp`; `exp − iat = 7d` |
| TC-AUTH-07 | FR-AUTH-07 | I | `GET /me` as Rohan | 200, user + 1 membership with society and flat |
| TC-AUTH-08 | FR-AUTH-08 | I | `PATCH /me {name:"Rohan M", email:"r@example.com"}`; then `{email:"bad"}`; then `{phone:"9999999999"}` | 200 with the update; 400; the phone is unchanged (key stripped) |
| TC-AUTH-09 | FR-AUTH-01 | I | Request with phone `"123"`, `"abcdefghij"`, a 16-digit number, or a missing phone | 400 `VALIDATION_ERROR` |
| TC-AUTH-10 | FR-AUTH-04 | I | Request an OTP, backdate `expiresAt` by 1 s past expiry, verify with the right code | 401 `OTP_INVALID` |
| TC-AUTH-11 | FR-AUTH-04 | I | Verify successfully, then verify again with the same code | Second call → 401 `OTP_INVALID` |
| TC-AUTH-12 | FR-AUTH-03 | I | Verify a new phone `9800000099` with `name:"New User"` | 200. User created with that name, `memberships: []` |

### 7.3 Tenancy and RBAC (TEN)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-TEN-01 | FR-TEN-01 | I | `GET /visitors` without `X-Society-Id` | 400 `SOCIETY_REQUIRED` |
| TC-TEN-02 | FR-TEN-02 | I | Rohan calls `GET /society` with society B's ID (no membership there) | 403 `FORBIDDEN` |
| TC-TEN-03 | FR-TEN-03 | I | Table-driven: for each row of SRS §3.17, call the endpoint with each disallowed role | 403 for every disallowed (role, endpoint) pair. Allowed pairs ≠ 403 |
| TC-TEN-04 | FR-TEN-04 | I | Society B creates a visitor, ticket, invoice, booking and notice. Society A's admin `GET`/`PATCH`es them by ID with A's header | 404 for all. Society B's data is unchanged |
| TC-TEN-05 | FR-TEN-02 | I | Admin sets Rohan's membership `INACTIVE`. Rohan calls `GET /visitors` with his still-valid JWT | 403 |

### 7.4 Society setup (SOC)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-SOC-01 | FR-SOC-01 | I | New user `POST /societies {…, pincode:"560001"}`; then with pincode `"56"` | 201. The caller has an ACTIVE ADMIN membership (verify via `/me`). Second call → 400 |
| TC-SOC-02 | FR-SOC-02 | I | `GET /society` as each seed role | 200 Emerald Heights for all |
| TC-SOC-03 | FR-SOC-03 | I | `GET /blocks` as a resident | 200 `[A, B]` ordered by name |
| TC-SOC-04 | FR-SOC-04 | I | Admin `POST /blocks {name:"C"}`, then `{name:"c"}`. A resident posts | 201; 409 `ALREADY_EXISTS`; 403 |
| TC-SOC-05 | FR-SOC-05 | I | `GET /flats?blockId=<A>` | 4 flats (101–104), each with block |
| TC-SOC-06 | FR-SOC-06 | I | Admin `POST /flats/bulk {blockId:A, numbers:["104","105","106"]}`; blockId from another society | 201 `created` has 105 and 106, `skipped:["104"]`; 404 |
| TC-SOC-07 | FR-SOC-07 | I | Admin `GET /members`. Guard `GET /members?flatId=<A-101>`. Guard `GET /members` without flatId. Resident `GET /members` | All members; only Rohan (name, phone, residentType; no other fields); 400; 403 |
| TC-SOC-08 | FR-SOC-08 | I | Admin adds new phone as RESIDENT with flat and OWNER; RESIDENT without flatId; GUARD with flatId; the same phone again | 201 (user created); 400; 400; 409 |
| TC-SOC-09 | FR-SOC-09 | I | Admin sets Priya INACTIVE. The only admin sets own `role:"RESIDENT"` or `status:"INACTIVE"` | 200; 422 `LAST_ADMIN` |

### 7.5 Visitors (VIS)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-VIS-01 | FR-VIS-01 | I | Create visitors for A-101 and B-201. Rohan `GET /visitors`; Rohan `?flatId=<B-201>`; guard `GET /visitors?status=PENDING_APPROVAL`; admin `GET /visitors?date=<today IST>` | Rohan sees only A-101; empty list; guard sees all pending; admin sees today's visitors only |
| TC-VIS-02 | FR-VIS-02 | I+S | Rohan and Priya connect SSE. Guard `POST /visitors {flatId:A-101, type:"DELIVERY", name:"Swift Parcel", vehicleNo:"ka01ab1234"}` | 201 `status:"PENDING_APPROVAL"`, `loggedById = guard membership`, `vehicleNo:"KA01AB1234"`. Rohan receives `visitor.requested` and a `notification`. Priya receives nothing. A Notification row exists for Rohan |
| TC-VIS-03 | FR-VIS-03 | I | Rohan `POST /visitors/:id/decision {decision:"APPROVE"}` on a pending visitor | 200 `status:"APPROVED"`, `decidedById = Rohan's membership`, `decidedAt` set |
| TC-VIS-04 | FR-VIS-04 | I | `LEAVE_AT_GATE` on a GUEST visitor; then on a DELIVERY visitor | 422 `LEAVE_AT_GATE_NOT_ALLOWED`; 200 `LEFT_AT_GATE` |
| TC-VIS-05 | FR-VIS-05, FR-VIS-09 | I | Guard check-in on an APPROVED visitor; check-in on a PENDING visitor; resident attempts check-in | 200 `CHECKED_IN` with `checkInAt`; 422 `INVALID_TRANSITION` `{from:"PENDING_APPROVAL", to:"CHECKED_IN"}`; 403 |
| TC-VIS-06 | FR-VIS-06 | I | Guard check-out on CHECKED_IN; check-out on APPROVED | 200 `CHECKED_OUT` with `checkOutAt`; 422 |
| TC-VIS-07 | FR-VIS-07 | I | Rohan collects a LEFT_AT_GATE delivery; the guard collects another; Priya collects an A-101 one | 200 `COLLECTED`; 200; 404 |
| TC-VIS-08 | FR-VIS-08 | I+U | Create a pending visitor with `createdAt = now − 11 min`. (a) `GET /visitors/:id` via list. (b) Rohan decides. (c) Run the sweeper function once against another backdated visitor | (a) status `EXPIRED`; (b) 422 `VISITOR_EXPIRED`; (c) status `EXPIRED` and `visitor.updated` emitted. A visitor at `now − 9 min` is untouched |
| TC-VIS-09 | FR-VIS-03 | I | Add a second resident to A-101. Both send APPROVE / DENY concurrently (`Promise.all`). Priya (B-201) decides on an A-101 visitor | Exactly one 200 and one 409 `ALREADY_DECIDED`; the final status matches the 200. Priya → 404 |
| TC-VIS-10 | FR-VIS-10 | S | Guard and admin connect SSE. Rohan approves | Guard, admin and Rohan receive `visitor.updated` with `status:"APPROVED"`. The guard gets a `notification` |
| TC-VIS-11 | FR-VIS-03, FR-VIS-09 | I | Rohan DENYs. Guard attempts check-in | 200 `DENIED`; check-in → 422 |
| TC-VIS-12 | FR-VIS-09 | U | Enumerate all 8×8 (from, to) status pairs against the transition function | Only the 7 transition edges in the SRS diagram are allowed (creation via gate verify is not a transition); all others throw `INVALID_TRANSITION` |

### 7.6 Pre-approvals (PRE)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-PRE-01 | FR-PRE-01 | I | Rohan `POST /preapprovals {type:"GUEST", guestName:"Asha", validFrom:now, validTo:now+4h}`. Then `validTo ≤ validFrom`. Then a window > 7 days. Then `maxUses: 0` | 201, `passcode:/^\d{6}$/`, `status:"ACTIVE"`, `usedCount:0`, `maxUses:1`, flat = A-101; 400; 400; 400 |
| TC-PRE-02 | FR-PRE-02 | U+I | Unit: stub the RNG to return an existing active pre-approval passcode, then an existing staff passcode, then a fresh one. Integration: create 200 pre-approvals | The generator retries and returns the fresh code. All 200 integration passcodes are distinct and none equals a staff passcode |
| TC-PRE-03 | FR-PRE-03 | I | Rohan, Priya, admin and guard `GET /preapprovals` | Rohan: A-101 only; Priya: B-201 only; admin: all; guard: 403 |
| TC-PRE-04 | FR-PRE-04 | I | Rohan `DELETE /preapprovals/:id` (ACTIVE). Guard verifies its passcode. Rohan deletes it again | 200 `CANCELLED`; verify → 404 `PASSCODE_NOT_FOUND`; 422 |
| TC-PRE-05 | FR-PRE-05 | I | (a) Backdate `validTo` to the past, then GET. (b) `maxUses: 2`: verify twice, then a third time | (a) `EXPIRED`. (b) `usedCount` 1 then 2, status `USED` after the 2nd; 3rd verify → 404 |

### 7.7 Gate verify (GATE)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-GATE-01 | FR-GATE-01 | I+S | Seed DB. Rohan connects SSE. Guard `POST /gate/verify {passcode:"135790"}` | 200 `{kind:"VISITOR", visitor}` with `status:"CHECKED_IN"`, `checkInAt`, `preApprovalId`. Pre-approval `usedCount=1` → `USED`. The flat's residents get `visitor.updated` and a `notification`. Visitor and pre-approval updates are atomic (force a failure after the insert → no partial state) |
| TC-GATE-02 | FR-GATE-02 | I | Guard verifies `482913`, then again | 1st: `{kind:"STAFF", action:"CHECK_IN"}` with an open attendance. 2nd: `action:"CHECK_OUT"` with `checkOutAt` set. Exactly one attendance row |
| TC-GATE-03 | FR-GATE-03 | I | Verify `"000000"` (unused); `"12345"`; a pre-approval with `validFrom` tomorrow; a deactivated staff passcode | 404 `PASSCODE_NOT_FOUND`; 400; 404; 422 `STAFF_INACTIVE` |
| TC-GATE-04 | FR-GATE-04 | I | Guard sends 31 verify requests within a minute | The 31st → 429. Logs contain the guard ID and no passcode |
| TC-GATE-05 | FR-TEN-03 | I | Rohan and admin `POST /gate/verify` | 403 |

### 7.8 Staff (STF)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-STF-01 | FR-STF-01 | I | `GET /staff` as admin, guard and Rohan; `?category=MAID` | All roles 200. `passcode` present for admin and guard, **absent** for Rohan. The filter works |
| TC-STF-02 | FR-STF-02 | I | Admin `POST /staff {name:"Lakshmi", category:"COOK"}`; invalid category | 201 with a unique 6-digit passcode, `isActive:true`; 400 |
| TC-STF-03 | FR-STF-03 | I | Check in staff via the gate, then admin `PATCH /staff/:id {isActive:false}` | 200. The open attendance now has `checkOutAt` |
| TC-STF-04 | FR-STF-04 | I | Rohan links staff to A-101; Rohan links to B-201; Rohan links A-101 again; admin links to B-201 | 201; 403; 409; 201 |
| TC-STF-05 | FR-STF-05 | I | Rohan `GET /staff/:id/attendance` for staff linked to A-101; for unlinked staff; guard for any | 200 newest first; 404; 200 |

### 7.9 Notices (NOT)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-NOT-01 | FR-NOT-01 | I | Create N1 (old, pinned), N2 (new), N3 (newer). `GET /notices` | Order: N1, N3, N2. Author name included |
| TC-NOT-02 | FR-NOT-02 | I+S | All seed users connect SSE. Admin `POST /notices {title, body, category:"URGENT", isPinned:true}`. Then a resident posts | 201. Everyone receives `notice.created`. Notifications are created for all active members except the admin. Resident post → 403 |
| TC-NOT-03 | FR-NOT-03 | I | Admin `PATCH /notices/:id {isPinned:false, title:"Updated"}`; invalid category | 200 updated; 400 |
| TC-NOT-04 | FR-NOT-04 | I | Admin `DELETE /notices/:id`, then GET by list or delete again | 204; no longer listed; second delete → 404 |

### 7.10 Polls (POLL)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-POLL-01 | FR-POLL-01 | I | Seed poll. Rohan votes for option 1. `GET /polls` as Rohan and as Priya | Counts reflect 1 vote; `totalVotes:1`; Rohan `myVoteOptionId` = option 1; Priya `null`; `isClosed:false` |
| TC-POLL-02 | FR-POLL-02 | I | Admin creates with 1 option; 11 options; duplicate options; `closesAt` in the past; 3 valid options | 400 ×4; 201 with 3 options |
| TC-POLL-03 | FR-POLL-03 | I | Rohan votes, then votes again (same or different option). Two concurrent votes | 200; 409 `ALREADY_VOTED`. Concurrent: one 200, one 409. One row in `PollVote` |
| TC-POLL-04 | FR-POLL-04 | I | Backdate `closesAt`, then Priya votes. Vote with an option from a different poll | 422 `POLL_CLOSED`; 400 |
| TC-POLL-05 | FR-TEN-03 | I | Admin and guard vote | 403 |

### 7.11 Helpdesk (TKT)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-TKT-01 | FR-TKT-01 | I | Rohan `POST /tickets {category:"PLUMBING", title, description}` | 201 `OPEN`, `priority:"MEDIUM"`, `flatId` = A-101, `raisedById` = Rohan. Admins notified |
| TC-TKT-02 | FR-TKT-02 | I | `GET /tickets` as Rohan, Priya and admin; `?status=OPEN&priority=HIGH`; as guard | Own only; own only; all; filter works; guard 403 |
| TC-TKT-03 | FR-TKT-03 | I | Rohan GETs his ticket with 2 comments; Priya GETs Rohan's ticket | 200 with comments oldest first and author names; 404 |
| TC-TKT-04 | FR-TKT-04 | I+U | Admin: OPEN→IN_PROGRESS (assign the guard); →RESOLVED; →CLOSED; CLOSED→OPEN. Rohan PATCHes `priority`, and PATCHes `status:"CLOSED"` on his OPEN ticket. Assign to a membership in another society. Unit: full transition table | 200 ×3 (`resolvedAt` set on RESOLVED); 422 `INVALID_TRANSITION`; Rohan priority → 403; Rohan close → 200; foreign assignee → 400/404; table matches the SRS diagram |
| TC-TKT-05 | FR-TKT-05 | I | Rohan comments; admin comments; Priya comments on Rohan's ticket; comment on a CLOSED ticket; empty body | 201; 201; 404; 422 `TICKET_CLOSED`; 400 |
| TC-TKT-06 | FR-TKT-06 | I | Admin resolves Rohan's ticket and comments | Rohan has 2 new Notifications (status, comment). Rohan comments → admin notified |

### 7.12 Amenities and bookings (AMN, BKG)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-AMN-01 | FR-AMN-01 | I | Deactivate Swimming Pool. `GET /amenities` as Rohan and admin | Rohan: 2 (active only); admin: 3 |
| TC-AMN-02 | FR-AMN-02 | I | Admin creates with `openTime:"22:00", closeTime:"06:00"`; `slotMinutes:10`; `pricePerSlot:99.5`; `capacity:0`; a duplicate name; a valid amenity | 400 ×4; 409; 201 |
| TC-AMN-03 | FR-AMN-03 | I | Admin `PATCH {isActive:false}`; Rohan books it | 200; 422 `AMENITY_INACTIVE` |
| TC-AMN-04 | FR-AMN-04 | I+U | Amenity 06:00–22:00, 60 min, capacity 2. One booking at 07:00 IST tomorrow. `GET availability?date=<tomorrow>`. Unit: 06:00–07:30 with 45 min | 16 slots. The 07:00 slot has `booked:1, remaining:1`. `startAt` is UTC (`01:30Z`). Unit: 2 slots (06:00, 06:45) |
| TC-BKG-01 | FR-BKG-01 | I | Rohan books tomorrow 07:00 (valid); 07:15 (misaligned); yesterday 07:00; +31 days; 07:00 again (same flat) | 201 `CONFIRMED`, `endAt = +60 min`; 422 `SLOT_INVALID`; 422 `SLOT_IN_PAST`; 422 `SLOT_TOO_FAR`; 409 |
| TC-BKG-02 | FR-BKG-02 | I | Capacity 1. 10 residents from different flats book the same slot in parallel (`Promise.all`) | Exactly 1 × 201 and 9 × 409 `SLOT_FULL`. The DB has 1 CONFIRMED row |
| TC-BKG-03 | FR-BKG-03 | I | `GET /bookings` as Rohan, Priya and admin; `?amenityId&date` | Flat-scoped; flat-scoped; all; filters work |
| TC-BKG-04 | FR-BKG-04 | I | Rohan cancels his future booking, then another resident books that full slot. Priya cancels Rohan's. Rohan cancels a started booking (backdated). Admin cancels any | 200 `CANCELLED` and the slot is bookable again; 404; 422 `BOOKING_STARTED`; 200 |

### 7.13 Billing, expenses, reports (BIL, RPT)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-BIL-01 | FR-BIL-01 | I | `GET /invoices` as Rohan, admin; `?status=PAID&period=<p>`; as guard | A-101 only; all 8 with flat and block; filter works; 403 |
| TC-BIL-02 | FR-BIL-02 | I | Admin generates `{period:"2026-12", amount:350000, dueDate:"2026-12-10"}`, then again. Add a flat, generate again | `{created:8, skipped:0}`; `{created:0, skipped:8}`; `{created:1, skipped:8}`. A direct duplicate insert violates the unique constraint. Residents notified |
| TC-BIL-03 | FR-BIL-03 | I | Rohan pays an UNPAID invoice `{method:"UPI"}`; pays again; Rohan `{method:"CASH"}` on another; admin `CASH`; Priya pays A-101's invoice | 200 `PAID`, Payment `amount = invoice.amount`, `reference` starts with `MOCK-`; 409 `ALREADY_PAID`; 403 (or 400); 200; 404. The invoice update and payment insert are atomic |
| TC-BIL-04 | FR-BIL-04 | I | An UNPAID invoice with `dueDate` = yesterday (IST); GET. Pay it | Shows `OVERDUE`; payment is allowed → `PAID` |
| TC-BIL-05 | FR-BIL-05 | I | Generate with `amount:3500.5`, `-1`, `"3500"`; expense `amount:0` | 400 for each. Responses for valid records return integer amounts |
| TC-BIL-06 | FR-BIL-06 | I | Admin `GET /expenses?category=SECURITY`; Rohan GET | Filtered list, newest `spentOn` first; 403 |
| TC-BIL-07 | FR-BIL-07 | I | Admin posts a valid expense; `spentOn` tomorrow; missing category | 201 with `createdById`; 400; 400 |
| TC-RPT-01 | FR-RPT-01 | I | Fixture: 8 invoices × ₹3,500 for the current month, 6 paid; 2 older unpaid; expenses ₹12,000 this month; 5 visitors today + 2 yesterday; tickets 2 OPEN, 1 IN_PROGRESS, 1 RESOLVED; 1 RAISED SOS. `GET /reports/summary`. Then with no invoices | `invoicedAmount:2800000`, `collectedAmount:2100000`, `collectionPct:75.0`, `outstandingDues` = 2 current unpaid + 2 older, `expensesThisMonth:1200000`, `visitorsToday:5`, `openTickets:3`, `activeSos:1`. Empty → `collectionPct:0` |

### 7.14 SOS

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-SOS-01 | FR-SOS-01, FR-SOS-04 | I+S | Guard, admin and Priya connect SSE. Rohan `POST /sos {type:"MEDICAL", message:"Fall"}`; then `type:"FLOOD"` | 201 `RAISED` with `flatId` = A-101. Guard and admin receive `sos.raised` within 2 s, plus a `notification`. Priya receives nothing. Invalid type → 400 |
| TC-SOS-02 | FR-SOS-02 | I | `GET /sos` as guard, admin, Rohan, Priya | Guard and admin: all, with flat and raiser phone. Rohan: own. Priya: own (none) |
| TC-SOS-03 | FR-SOS-03 | I+U | Guard PATCHes `ACKNOWLEDGED`, then `RESOLVED`, then `ACKNOWLEDGED`. Another alert RAISED → RESOLVED directly. Rohan PATCHes | 200 with `acknowledgedById` and `acknowledgedAt`; 200 with `resolvedAt`; 422 `INVALID_TRANSITION`; 200 (acknowledgement fields filled); 403 |
| TC-SOS-04 | FR-SOS-04 | S | Rohan connects SSE. Guard acknowledges | Rohan receives `sos.updated` `ACKNOWLEDGED` |

### 7.15 Notifications and SSE (NTF)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-NTF-01 | FR-NTF-01 | I | Generate 3 notifications for Rohan, 1 for Priya. Rohan `GET /notifications`; `?unread=true` after reading one | 3 newest first with `unreadCount:3`; then 2 |
| TC-NTF-02 | FR-NTF-02 | I | Rohan reads his notification twice; reads Priya's | 200 with `readAt` set (idempotent, unchanged on the 2nd call); 404 |
| TC-NTF-03 | FR-NTF-03 | I | Rohan `POST /notifications/read-all` | `{updated:3}`. Priya's unaffected |
| TC-NTF-04 | FR-NTF-04 | S | `GET /events` with no token; a bad token; a valid token with a society the user isn't in; a valid token and society. Wait 26 s (or inject a 1 s heartbeat interval in the test config). Close the client | 401; 401; 403; 200 with the `text/event-stream` and `no-cache` headers; a `: ping` comment is received; the hub's subscriber count decrements on close |
| TC-NTF-05 | FR-NTF-05 | S | Connect Rohan (A-101), Priya (B-201), guard and admin. Trigger one of each event type | Every recipient set matches SRS §4.3 exactly. Event names match the brief. `data` parses as JSON |
| TC-NTF-06 | FR-NTF-06 | U/I | Register a bus subscriber that throws. Guard `POST /visitors` | 201 returned. The error is logged. Other subscribers (notification persistence) still run |

### 7.16 Web and mobile (manual E2E)

| ID | FR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-WEB-01 | FR-WEB-01 | M | Open `http://localhost:8080/` at 360 px, 768 px and 1440 px. Click every CTA and anchor. Stop the API container and reload | All sections render (hero with tagline, features, gate-flow explainer, security and privacy, FAQ, footer). Get started / Sign in → `/app/login`. Contact opens `mailto:`. The page works without the API. No third-party product names |
| TC-WEB-02 | FR-WEB-02 | M | Log in as Rohan with devCode; reload; create a second membership for Rohan, log in again; switch society; tamper the token in storage | The session persists. The society picker appears with 2 memberships. The switcher changes data scope. A tampered token → redirect to login |
| TC-WEB-03 | FR-WEB-03 | M | Log in as admin, resident and guard; compare the navigation to SRS FR-WEB-03; deep-link to an admin route as a resident | Navigation matches the role. A forbidden deep-link shows a "not permitted" state (and the API returns 403) |
| TC-WEB-04 | FR-WEB-04 | M | Chrome DevTools → Application → Manifest; install the app; go offline | Manifest valid, installable, icons present. Offline shows the cached shell with an offline message. No API responses are served from cache |
| TC-WEB-05 | FR-WEB-05 | M | Switch the OS to dark mode | The app uses the navy-950 background. Contrast still meets AA (spot-check with axe) |
| TC-WEB-06 | FR-WEB-06 | M | Two browsers: guard and Rohan. The guard logs a walk-in; Rohan approves; Rohan raises an SOS | Rohan sees the request card within 2 s without a refresh. The guard's pending list updates live. The guard sees a persistent SOS banner until acknowledged. Network drop/restore → auto-reconnect |
| TC-MOB-01 | FR-MOB-01 | M | On Android and iOS as Rohan: sign in, approve, leave at gate, create a pre-approval and share the passcode, view staff attendance, vote, raise a ticket, book an amenity, pay an invoice, raise an SOS, read notifications | Every step succeeds. The share sheet opens with the passcode text. Amounts show as ₹ |
| TC-MOB-02 | FR-MOB-02 | M | As Suresh: log a walk-in via the block→flat picker, verify `135790` and `482913` (twice), check in/out, collect, acknowledge and resolve an SOS | Results are clearly labelled VISITOR / STAFF CHECK_IN / CHECK_OUT. Pending status updates live or within 15 s |
| TC-MOB-03 | FR-MOB-03 | M | Disable SSE (feature flag or a proxy that blocks it), keep the app foregrounded, approve from the web | The update appears within 15 s via polling |

### 7.17 Security (SEC), privacy (PRIV), ops (OPS), quality (QA)

| ID | NFR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-SEC-01 | NFR-SEC-05 | X | `curl -I` any API route | helmet headers present (`X-Content-Type-Options: nosniff`, `Strict-Transport-Security` in prod, `X-Frame-Options`/CSP frame-ancestors). No `X-Powered-By` |
| TC-SEC-02 | NFR-SEC-05 | X | Preflight from `Origin: https://evil.example` and from an allowed origin | Evil origin: no `Access-Control-Allow-Origin`. Allowed origin: it is echoed |
| TC-SEC-03 | NFR-SEC-03 | X | Send `' OR 1=1 --`, `{"$gt":""}` and `<script>` payloads in query, params and body across the list and create endpoints | 400 or a literal-string match only. No 500s, no extra rows. Stored `<script>` renders escaped in the web app |
| TC-SEC-04 | FR-AUTH-06 | X | Forge tokens: `alg:none`, HS512 with the right secret, RS256 confusion | All 401 |
| TC-SEC-05 | FR-SYS-06 | X | Mass assignment: `PATCH /members/:id {societyId, userId}`, `POST /visitors {status:"APPROVED"}`, `POST /invoices/:id/pay {amount:1}` | Protected fields are ignored. The visitor is created PENDING. The payment amount equals the invoice amount |
| TC-SEC-06 | NFR-SEC-01 | X | Automated IDOR sweep: for every `/:id` route, try IDs from another society and another flat | Always 404 (or 403 where the role itself is disallowed). Never 200 |
| TC-SEC-07 | NFR-SEC-02 | X | Run a secret scan (gitleaks or `git grep -nE "(JWT_SECRET\|password\|BEGIN PRIVATE)"`) across the repo and the built images | No secrets. `.env` is git-ignored. `.env.example` has placeholders only |
| TC-SEC-08 | NFR-SEC-06, 08 | X | `npm audit --audit-level=high` in each app. Lockfiles present | Exit 0. Lockfiles committed |
| TC-SEC-09 | NFR-SEC-09, NFR-LOG-01–03 | X | Run the OTP, gate verify and `/events?token=` flows in production mode; inspect stdout | JSON logs with `reqId`, route, status, latency. No OTP, passcode, JWT or `token` query value. Phones masked. 401/403/429 at `warn` |
| TC-SEC-10 | NFR-SEC-05 | X | Start the API with `NODE_ENV=production` and `JWT_SECRET` unset or equal to `change-me`. Inspect the production compose override | The process exits with a clear error. Adminer is not published publicly (bound to 127.0.0.1 or profile-disabled) |
| TC-SEC-11 | NFR-SEC-10 | X | `PATCH /staff/:id {photoUrl:"http://169.254.169.254/"}`; `{photoUrl:"file:///etc/passwd"}`; monitor egress | 400 for non-https. Even a valid https URL produces no outbound request from the API |
| TC-SEC-12 | NFR-SEC-11 | X | POST a 200 KB JSON body; send `Content-Type: text/plain` | 413 in the error envelope; 400 / 415 |
| TC-PRIV-01 | NFR-PRIV-02 | I | Backdate rows past each retention period; run the purge job | OtpCode > 24 h past expiry, Visitor/PreApproval/StaffAttendance > 13 months and Notification > 90 days are deleted. Invoices, payments and expenses are untouched |
| TC-OPS-01 | NFR-AVL-03 | O | `pg_dump` the staging DB, drop it, restore, run the smoke test | Smoke passes on the restored DB. Time to restore recorded (≤ RTO) |
| TC-OPS-02 | NFR-AVL-05 | O | With 50 SSE clients and a request loop running, `docker compose stop api` | The process exits within 10 s. In-flight requests complete. No DB connection leak warnings |
| TC-QA-01 | NFR-MAINT-01, 03 | O | `tsc --noEmit`, `eslint .`, `vitest run --coverage` in each app | 0 type errors, 0 lint errors, service coverage ≥ 80% |

### 7.18 Accessibility (A11Y)

| ID | NFR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-A11Y-01 | NFR-A11Y-01 | A | axe and Lighthouse on: marketing home, login, admin dashboard, visitors table, gate console, resident home, booking, invoice pay; light and dark | 0 serious or critical violations. Lighthouse a11y ≥ 95. Gold is never used as text on white |
| TC-A11Y-02 | NFR-A11Y-02 | A | Keyboard-only: log in, approve a visitor, book an amenity, open/close a dialog | Every control is reachable. The focus ring is visible (emerald-500, 2 px offset). Dialogs trap and restore focus |
| TC-A11Y-03 | NFR-A11Y-03 | A | Measure targets on the gate console and resident home at 360 px. Grayscale screenshot of the status chips | All targets ≥ 44×44 px. Status is still distinguishable by label |
| TC-A11Y-04 | NFR-A11Y-04 | A | NVDA (web) and TalkBack/VoiceOver (mobile): log in, receive a visitor request, raise an SOS | Fields are labelled. Errors are announced. A visitor request is announced politely and an SOS assertively |
| TC-A11Y-05 | NFR-A11Y-05 | A | 200% zoom; 320 px width; `prefers-reduced-motion: reduce` | No horizontal scroll and no clipped content. Non-essential animation disabled |

### 7.19 Performance (PERF)

| ID | NFR | Lvl | Steps | Expected |
|---|---|---|---|---|
| TC-PERF-01 | NFR-PERF-01, 02, 06 | P | Scale the seed to 50 societies × 500 flats × 90 days of visitors. k6: 100 rps for 10 minutes on a weighted mix (40% `GET /visitors`, 15% `POST /visitors`, 10% `/gate/verify`, 10% `GET /notices`, 10% `GET /notifications`, 15% other) on 2 vCPU / 4 GB | p95 < 300 ms and p99 < 800 ms overall. Gate endpoints p95 < 200 ms. Error rate < 0.1%. `EXPLAIN` on hot queries shows index scans |
| TC-PERF-02 | NFR-PERF-03, 04 | P | Open 2,000 SSE connections across 50 societies. Fire 10 visitor events per second for 5 minutes | Delivery latency p95 < 2 s. No dropped connections. API RSS stable |
| TC-PERF-03 | NFR-PERF-05 | P | Lighthouse mobile (simulated 4G) on the marketing home. Inspect the build output | LCP < 2.5 s, CLS < 0.1. App initial JS ≤ 250 KB gzipped |

## 8. Smoke test — docker-compose stack

Run from the repository root after every phase (Phase 2 onwards) and before every release. The script uses the seed accounts and the dev OTP (`devCode`), so the stack must run with `NODE_ENV` other than `production`. Run it on a **fresh volume**, because the seed pre-approval `135790` is single-use.

### 8.1 Manual checklist

| Step | ID | Action | Pass when |
|---|---|---|---|
| 1 | TC-SMK-01 | `cp .env.example .env`, then `docker compose down -v && docker compose up -d --build` | `docker compose ps` shows `db` (healthy), `adminer`, `api` and `web` running. `api` started only after `db` was healthy |
| 2 | TC-SMK-02 | `curl -s localhost:4000/health` | `{"status":"ok",...}` |
| 3 | TC-SMK-03 | Seed: runs automatically on api start, or `docker compose exec api npx prisma db seed` | Adminer (`localhost:8081`) shows society "Emerald Heights" with 8 flats |
| 4 | TC-SMK-04 | Log in as the guard and Rohan (OTP via `devCode`) | Both get tokens. Rohan's membership shows flat A-101 |
| 5 | TC-SMK-05 | Rohan opens the SSE stream. The guard logs a DELIVERY for A-101 | 201 PENDING_APPROVAL. Rohan's stream prints `event: visitor.requested` |
| 6 | TC-SMK-06 | Rohan APPROVEs. The guard checks in, then checks out | Statuses APPROVED → CHECKED_IN → CHECKED_OUT |
| 7 | TC-SMK-07 | The guard verifies `135790`, then `482913` twice | VISITOR (CHECKED_IN); STAFF CHECK_IN; STAFF CHECK_OUT |
| 8 | TC-SMK-08 | Rohan raises an SOS. The guard acknowledges and resolves it | RAISED → ACKNOWLEDGED → RESOLVED |
| 9 | TC-SMK-09 | The admin calls `GET /reports/summary` | 200 with `visitorsToday ≥ 2`, `activeSos: 0` |
| 10 | TC-SMK-10 | Open `http://localhost:8080/` and `/app/login`; log in as the admin | The marketing page renders. The dashboard shows the KPIs from step 9 |

### 8.2 Script (`bash`, requires `curl` and `jq`)

```bash
#!/usr/bin/env bash
# Gatekeeper smoke test — run from repo root against a fresh `docker compose up`.
set -euo pipefail
API=${API:-http://localhost:4000/api/v1}
j() { jq -er "$1"; }                      # jq that fails on null/false

echo "TC-SMK-02 health";  curl -fs "${API%/api/v1}/health" | j '.status=="ok"'

login() {                                  # $1 = phone → prints token
  local code; code=$(curl -fs -X POST "$API/auth/otp/request" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$1\"}" | j .devCode)
  curl -fs -X POST "$API/auth/otp/verify" -H 'Content-Type: application/json' \
    -d "{\"phone\":\"$1\",\"code\":\"$code\"}"
}
echo "TC-SMK-04 login"
GUARD_JSON=$(login 9000000003); GUARD=$(echo "$GUARD_JSON" | j .token)
ROHAN_JSON=$(login 9000000002); ROHAN=$(echo "$ROHAN_JSON" | j .token)
ADMIN=$(login 9000000001 | j .token)
SID=$(echo "$ROHAN_JSON" | j '.memberships[0].societyId')
FLAT=$(echo "$ROHAN_JSON" | j '.memberships[0].flatId')

call() {  # $1 token, $2 method, $3 path, $4 body(optional)
  curl -fs -X "$2" "$API$3" -H "Authorization: Bearer $1" -H "X-Society-Id: $SID" \
    -H 'Content-Type: application/json' ${4:+-d "$4"}
}

echo "TC-SMK-05 walk-in + SSE"
SSE_LOG=$(mktemp)
curl -sN "$API/events?token=$ROHAN&societyId=$SID" > "$SSE_LOG" & SSE_PID=$!
sleep 1
VID=$(call "$GUARD" POST /visitors "{\"flatId\":\"$FLAT\",\"type\":\"DELIVERY\",\"name\":\"Smoke Parcel\"}" \
  | j 'select(.status=="PENDING_APPROVAL") | .id')
sleep 2; kill $SSE_PID || true
grep -q 'event: visitor.requested' "$SSE_LOG"

echo "TC-SMK-06 approve → check-in → check-out"
call "$ROHAN" POST "/visitors/$VID/decision" '{"decision":"APPROVE"}' | j '.status=="APPROVED"'
call "$GUARD" POST "/visitors/$VID/check-in"  | j '.status=="CHECKED_IN"'
call "$GUARD" POST "/visitors/$VID/check-out" | j '.status=="CHECKED_OUT"'

echo "TC-SMK-07 gate passcodes"
call "$GUARD" POST /gate/verify '{"passcode":"135790"}' | j '.kind=="VISITOR" and .visitor.status=="CHECKED_IN"'
call "$GUARD" POST /gate/verify '{"passcode":"482913"}' | j '.kind=="STAFF" and .action=="CHECK_IN"'
call "$GUARD" POST /gate/verify '{"passcode":"482913"}' | j '.kind=="STAFF" and .action=="CHECK_OUT"'

echo "TC-SMK-08 SOS"
SOS=$(call "$ROHAN" POST /sos '{"type":"MEDICAL","message":"smoke test"}' | j .id)
call "$GUARD" PATCH "/sos/$SOS" '{"status":"ACKNOWLEDGED"}' | j '.status=="ACKNOWLEDGED"'
call "$GUARD" PATCH "/sos/$SOS" '{"status":"RESOLVED"}'     | j '.status=="RESOLVED"'

echo "TC-SMK-09 dashboard"
call "$ADMIN" GET /reports/summary | j '.visitorsToday >= 2 and .activeSos == 0'

echo "SMOKE PASSED"
```

Field paths (`memberships[0].societyId`, `.kind`, `.action`) follow SRS FR-AUTH-03 and FR-GATE-01/02. If `08-API-SPEC.md` finalises different response shapes, update this script in the same change.

## 9. Security testing approach

- **Automated (CI):** TC-SEC-01 to TC-SEC-06, TC-SEC-09 to TC-SEC-12 and TC-TEN-03/04 run as part of the Vitest suite. TC-SEC-07 and TC-SEC-08 run as CI steps.
- **Phase 6:** an OWASP ZAP baseline scan against staging (passive), plus a manual review of the middleware order and each service's `where` clauses for `societyId` scoping.
- Findings are logged as defects with severity per §6. Any cross-tenant issue is Sev-1.

## 10. Accessibility testing approach

- **Key screens:** marketing home, login/OTP, society picker, admin dashboard, visitors table, members, invoice list, gate console, resident home (pending approvals), pre-approval form, amenity booking, SOS.
- Automated axe on every key screen in both themes, every phase that touches UI (TC-A11Y-01).
- Manual keyboard and screen-reader passes in Phase 6 (TC-A11Y-02 to 05).

## 11. Performance testing approach

Run in Phase 6 on staging-equivalent hardware (2 vCPU / 4 GB, API and DB on the same host) with the scaled seed. Results are recorded as k6 summary JSON attached to the release. A regression of more than 20% on p95 between releases is treated as a Sev-2 defect.

## 12. Reporting and traceability

- The CI job publishes the Vitest JUnit report and coverage. `describe` names carry TC IDs.
- A per-phase test summary lists TCs executed, passed, failed and blocked, open defects by severity, and smoke result.
- **Coverage rule:** every FR and NFR in the SRS §7 matrix maps to at least one TC in this plan. Every TC here maps back to an SRS ID. When a requirement changes, update the SRS matrix and this plan in the same change.
