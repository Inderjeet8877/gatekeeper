# Gatekeeper API (`apps/api`)

REST + SSE backend for Gatekeeper. Node 22, TypeScript (strict, ESM), Express 5, Prisma 6 / PostgreSQL 16, Zod, JWT.
The contract is [`docs/08-API-SPEC.md`](../../docs/08-API-SPEC.md) (all 61 endpoints). Design: [`docs/07-LLD.md`](../../docs/07-LLD.md), [`docs/06-HLD.md`](../../docs/06-HLD.md).

## Quick start

```bash
# from the repo root: start Postgres
docker compose up -d db

# from apps/api
cp .env.example .env
npm install
npm run db:deploy        # apply migrations (or `npm run db:migrate` when changing the schema)
npm run db:seed          # idempotent demo data
npm run dev              # http://localhost:4000  (GET /health)
```

Whole stack in Docker: `docker compose up -d --build db api` (the container runs `prisma migrate deploy`, then the seed, then the server).

> The compose `db` is published on host port **5433** (not 5432) so it never collides with a locally installed PostgreSQL.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | `tsx watch src/index.ts` |
| `npm run build` / `npm start` | `tsc` to `dist/`, then `node dist/index.js` |
| `npm run db:migrate` | `prisma migrate dev` (create and apply a migration) |
| `npm run db:deploy` | `prisma migrate deploy` |
| `npm run db:seed` | `tsx prisma/seed.ts` (also used by `prisma db seed`) |
| `npm test` | Vitest + supertest against a real Postgres (`gatekeeper_test`) |

## Environment

| Var | Default | Notes |
|---|---|---|
| `DATABASE_URL` | — | `postgresql://gatekeeper:gatekeeper@localhost:5433/gatekeeper` |
| `JWT_SECRET` | — | at least 32 chars |
| `NODE_ENV` | `development` | `production` hides `devCode` (and refuses to start if `EXPOSE_DEV_OTP=true`) |
| `PORT` | `4000` | |
| `CORS_ORIGINS` | `http://localhost:8080,http://localhost:5173` | comma-separated allowlist |
| `EXPOSE_DEV_OTP` | `NODE_ENV !== production` | return the OTP as `devCode` |
| `LOG_LEVEL` | `info` | pino level (`silent` in tests) |
| `SEED_ON_START` | on outside production | container only: `false` skips the seed |
| `TEST_DATABASE_URL` | `DATABASE_URL` with db `gatekeeper_test` | tests only |

## Tests

`npm test` runs `prisma migrate deploy` against the test database (it is created if missing), then every suite in
`tests/`. Each test file builds its own society through the API (OTP login → create society → add members), and uses
random `98xxxxxxxx` phones, so the database never needs to be wiped between runs. Test names carry the `TC-*` ids from
[`docs/10-TEST-PLAN.md`](../../docs/10-TEST-PLAN.md).

## Architecture

```
src/
  index.ts      bootstrap: listen, 60 s expiry sweeper, graceful shutdown
  app.ts        createApp(): helmet → cors → json(100kb) → pino-http → /health → auth → events → requireAuth → user routes → requireMember → society routes
  config.ts     zod-validated env + pino logger (redacts auth header, codes, passcodes, tokens; query strings never logged)
  db.ts         PrismaClient + shared flat/actor ref mappers
  events.ts     EventEmitter bus, in-process SSE hub, notification persistence + push
  middleware/   auth (JWT), tenancy (X-Society-Id → req.member), rbac, validate (zod), error, rateLimit
  lib/          errors (AppError + catalog helpers), otp, passcode, jwt, time (IST helpers)
  modules/<m>/  <m>.routes.ts (thin) · <m>.service.ts (logic + Prisma) · <m>.schemas.ts (zod)
```

- Layered modular monolith: routes → service → Prisma (no repository layer).
- Multi-tenancy by `societyId` on every query; ids from another society are 404.
- State machines (visitor, pre-approval, ticket, SOS, booking, invoice) use compare-and-set `updateMany`, so concurrent
  actors are safe ("first decision wins"); invalid moves → `422 INVALID_TRANSITION {from, to}`.
- Realtime: `GET /api/v1/events?token=<jwt>&societyId=<id>` (SSE, 25 s heartbeat). Events `visitor.requested`,
  `visitor.updated`, `sos.raised`, `sos.updated`, `notice.created`, `notification`.
- Errors: `{ "error": { "code", "message", "details"? } }`.

## Demo accounts (seed)

Society **Emerald Heights**, Bengaluru. Blocks A, B; flats A-101…A-104, B-201…B-204.

| Role | Phone | Name | Flat |
|---|---|---|---|
| ADMIN | 9000000001 | Ananya Rao | — |
| RESIDENT | 9000000002 | Rohan Mehta | A-101 |
| RESIDENT | 9000000004 | Priya Iyer | B-201 |
| GUARD | 9000000003 | Suresh Kumar | — |

- Staff passcode **482913** (Lakshmi Devi, maid, A-101). The guard verifies it to toggle check-in/out.
- Pre-approval passcode **135790** (Kavya Shah, A-101, `maxUses` 10, valid 30 days, re-armed on every seed run).
- Also seeded: 3 notices (one pinned), an open poll with a vote, 2 tickets with comments, Clubhouse / Tennis Court /
  Swimming Pool, current-month invoices for all 8 flats (5 paid), expenses, and visitors in several statuses.

Login in dev: `POST /api/v1/auth/otp/request {"phone":"9000000003"}` returns `devCode`; `POST /api/v1/auth/otp/verify
{"phone":"9000000003","code":"<devCode>"}` returns the token. Send `X-Society-Id: <memberships[0].society.id>` on society routes.
