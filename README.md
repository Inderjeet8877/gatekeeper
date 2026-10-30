# Gatekeeper

**Every arrival, accounted for.** A gated-community management platform: visitor management at the gate, resident convenience, and society administration.

| App | Path | Stack |
|---|---|---|
| API | [apps/api](apps/api) | Node + TypeScript, Express 5, Prisma, PostgreSQL, Zod, SSE |
| Web (marketing site + admin / resident / guard portals) | [apps/web](apps/web) | Vite, React 18, Tailwind, TanStack Query |
| Mobile (resident + guard) | [apps/mobile](apps/mobile) | Expo, expo-router |

## Quick start

Requires Docker Desktop.

```bash
docker compose up -d --build
```

| Service | URL |
|---|---|
| Website & web app | http://localhost:8080 |
| API | http://localhost:4000/api/v1 (health: `/health`) |
| Adminer (DB GUI) | http://localhost:8081 — server `db`, user/pass/db `gatekeeper` |
| PostgreSQL | `localhost:5433` (host port 5433 avoids clashing with a local Postgres) |

The API container runs migrations and seeds the demo society on start.

### Demo accounts (society "Emerald Heights")
Log in with the phone number. In development, the OTP is shown on the login screen.

| Role | Phone | Notes |
|---|---|---|
| Admin | 9000000001 | Web console |
| Resident | 9000000002 | Flat A-101 |
| Resident | 9000000004 | Flat B-201 |
| Guard | 9000000003 | Gate console (web or mobile) |

Gate passcodes: guest pre-approval **135790**, daily help **482913**.

### Local development
```bash
docker compose up -d db
cd apps/api && cp .env.example .env && npm i && npm run db:deploy && npm run db:seed && npm run dev
cd apps/web && npm i && npm run dev          # http://localhost:5173
cd apps/mobile && npm i && npx expo start    # see apps/mobile/README.md
cd apps/api && npm test                      # API test suite
```

## Documentation
All planning and design documents live in [docs/](docs). Start with the [project brief](docs/00-PROJECT-BRIEF.md).

| Doc | |
|---|---|
| [PRD](docs/01-PRD.md) | Product requirements, personas, user stories |
| [SRS](docs/02-SRS.md) | Functional & non-functional requirements, traceability |
| [Data dictionary](docs/03-DATA-DICTIONARY.md) · [ERD](docs/04-ERD.md) | Data model |
| [DFD](docs/05-DFD.md) | Data flow diagrams L0–L2 |
| [HLD](docs/06-HLD.md) · [LLD](docs/07-LLD.md) | Architecture, patterns, ADRs, module design |
| [API spec](docs/08-API-SPEC.md) | REST + SSE contract |
| [UI/UX design system](docs/09-UI-UX-DESIGN-SYSTEM.md) | Brand, tokens, components, screens, flows |
| [Test plan](docs/10-TEST-PLAN.md) · [Roadmap](docs/11-ROADMAP.md) | |
| [Production readiness](docs/12-PRODUCTION-READINESS.md) | Launch blockers, hosting plan, Play Store steps |

## v1 limitations
The payment gateway is mocked, there is no SMS provider (the OTP is shown in dev only), and there are no push notifications: realtime alerts reach only open apps. Photo uploads are not supported yet. See the [roadmap](docs/11-ROADMAP.md).
