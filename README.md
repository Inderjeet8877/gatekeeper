# Gatekeeper

Gatekeeper is a society management app for gated communities. Guards log visitors at the gate, residents approve them from their phone, and the society admin handles notices, dues, complaints, amenity bookings and the rest of the day to day stuff.

There are three parts in this repo:

- `apps/api` - backend (Node, TypeScript, Express 5, Prisma, PostgreSQL)
- `apps/web` - marketing site plus the admin, resident and guard web portals (React, Vite, Tailwind)
- `apps/mobile` - the resident and guard app (Expo / React Native)

## Running it locally

You need Docker Desktop. From the repo root:

```bash
docker compose up -d --build
```

That starts everything:

- Web app: http://localhost:8080
- API: http://localhost:4000/api/v1 (health check at `/health`)
- Adminer: http://localhost:8081 (server `db`, user, password and database are all `gatekeeper`)
- Postgres: `localhost:5433`

I mapped Postgres to 5433 on purpose because I already have a local Postgres on 5432. The API container runs the migrations and seeds a demo society every time it starts.

### Demo logins

The demo society is called Emerald Heights. Log in with one of these phone numbers. In development the OTP is shown right on the login screen, so you don't need SMS.

| Role | Phone | |
|---|---|---|
| Admin | 9000000001 | use the web console |
| Resident | 9000000002 | flat A-101 |
| Resident | 9000000004 | flat B-201 |
| Guard | 9000000003 | gate console on web or mobile |

Passcodes to try at the gate: `135790` for a pre-approved guest and `482913` for the maid.

### Without Docker (except the database)

```bash
docker compose up -d db

cd apps/api
cp .env.example .env
npm i
npm run db:deploy
npm run db:seed
npm run dev

cd apps/web && npm i && npm run dev        # http://localhost:5173
cd apps/mobile && npm i && npx expo start  # more in apps/mobile/README.md
```

Tests for the API: `cd apps/api && npm test` (needs the database running).

## Docs

All the planning documents are in the [docs](docs) folder. The [project brief](docs/00-PROJECT-BRIEF.md) is the place to start, it links to everything else: PRD, SRS, data dictionary, ERD, DFDs, HLD/LLD, the API spec, the design system, the test plan and the roadmap.

[docs/12-PRODUCTION-READINESS.md](docs/12-PRODUCTION-READINESS.md) has the list of what still has to be done before this goes live on the Play Store.

## What's not done yet

- Payments are mocked. No real gateway is wired up.
- No SMS provider, so OTP only works in dev mode.
- No push notifications. Alerts only show up while the app is open.
- No photo uploads.

See the [roadmap](docs/11-ROADMAP.md) for what's planned next.
