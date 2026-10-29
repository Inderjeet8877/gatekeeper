# Gatekeeper — Project Brief (Source of Truth)

> Every other document in `docs/` and all code in `apps/` MUST conform to this brief.
> If a doc needs to deviate, update this brief first.

## 1. Product

**Gatekeeper** is a residential-community (gated society / apartment complex) management platform:
security & visitor management at the gate, resident convenience, and society administration.
Feature parity target: the public feature set of products like MyGate, with an **original** brand,
UI, and codebase. No MyGate names, assets, copy, colors or code are reused.

Tagline: **"Every arrival, accounted for."**

### Surfaces
| Surface | Tech | Users |
|---|---|---|
| Marketing website (`/`) | `apps/web` (public routes) | Prospects, society committees |
| Web app (`/app/*`) | `apps/web` (authenticated, responsive, PWA) | Admin (primary), Resident, Guard |
| Mobile app | `apps/mobile` (Expo / React Native) | Resident, Guard |
| API | `apps/api` | All clients |
| Database | PostgreSQL 16 in Docker | — |

## 2. Roles
| Role | Enum | Description |
|---|---|---|
| Society Admin | `ADMIN` | Committee / facility manager. Configures society, manages members, billing, notices, amenities, helpdesk. |
| Resident | `RESIDENT` | Owner, tenant or family member linked to exactly one flat (`residentType`: `OWNER`, `TENANT`, `FAMILY`). |
| Guard | `GUARD` | Security staff at the gate. Logs/verifies visitors, staff attendance, responds to SOS. |

A user (identified by phone) can hold **memberships** in one or more societies, one role per membership.

## 3. Modules (v1 scope)
1. **Auth** — phone + OTP login. Dev mode: OTP returned in response as `devCode` and logged; never in production.
2. **Society setup** — create society (creator becomes ADMIN), blocks/towers, flats (bulk create), members (admin adds by phone).
3. **Visitor management (Gate)** — core flow:
   - Guard logs a walk-in (GUEST / DELIVERY / CAB / SERVICE) for a flat → status `PENDING_APPROVAL` → realtime push to that flat's residents → resident **Approves / Denies** (delivery may be "Leave at gate") → guard checks in → checks out.
   - Residents **pre-approve** guests → 6-digit **passcode**; guard enters passcode → entry auto-approved and checked in.
   - Visitor status machine: `PENDING_APPROVAL → APPROVED | DENIED | EXPIRED`; `APPROVED → CHECKED_IN → CHECKED_OUT`; `LEFT_AT_GATE` (deliveries, terminal when collected → `COLLECTED`). Pending > 10 min → `EXPIRED`.
4. **Daily help (Staff)** — maids, cooks, drivers, etc. Each has a society-unique 6-digit passcode, linked to one or more flats. Guard checks them in/out via passcode; residents see attendance.
5. **Notices & Polls** — admin posts notices (pinnable, categorized); admin creates polls; residents vote once.
6. **Helpdesk** — residents raise tickets (category, priority); admin assigns/updates status; comment thread.
7. **Amenities** — admin defines amenities (hours, slot length, capacity, price); residents book slots; no double-booking beyond capacity.
8. **Billing & Accounts** — admin generates monthly maintenance invoices per flat; residents pay (**mock payment gateway**, records a Payment); admin records expenses; dashboard KPIs (collection %, dues, expenses, visitors today, open tickets).
9. **SOS / Emergency** — resident raises SOS (MEDICAL/FIRE/THEFT/OTHER) → realtime alert to all on-duty guards & admins → guard acknowledges → resolves.
10. **Notifications** — in-app notification records + realtime **Server-Sent Events** stream.

**Out of scope v1** (documented as roadmap): smart locks, ad platform, IoT/boom-barrier integration, real payment gateway, SMS provider, photo uploads (photo URL field only), guard patrolling, marketplace, GST/TDS accounting, bank reconciliation, multi-language.

## 4. Architecture (locked)
- **Style:** modular monolith, layered per module: `routes → controller/handler → service → Prisma (data access)`.
- **Patterns:** Layered architecture; middleware chain (auth → tenancy → RBAC → validation); **Observer / pub-sub** via in-process event bus (`EventEmitter`) for notifications + SSE fan-out; **State machine** for visitor & ticket lifecycles; multi-tenancy by `societyId` row scoping; DTO validation with Zod at the trust boundary; centralized error handler.
- **API:** REST, JSON, base path `/api/v1`, port **4000**.
- **Auth:** JWT (HS256, 7-day expiry) in `Authorization: Bearer <token>`. Token holds `sub` (userId) only.
- **Tenancy:** society-scoped routes require header `X-Society-Id`. Middleware resolves the caller's ACTIVE membership in that society → `req.member = { id, role, flatId, societyId, residentType }`; 403 otherwise.
- **Realtime:** `GET /api/v1/events?token=<jwt>&societyId=<id>` (SSE; EventSource can't set headers). Event names: `visitor.requested`, `visitor.updated`, `sos.raised`, `sos.updated`, `notice.created`, `notification`.
- **Errors:** `{ "error": { "code": "STRING_CODE", "message": "Human readable", "details"?: any } }` with proper HTTP status (400 validation, 401, 403, 404, 409 conflict, 422 business rule, 429, 500).
- **Lists:** `{ "items": [...] }`, `?limit=` (default 50, max 200). Newest first. Exception: picker lists `/blocks`, `/flats`, `/members`, `/staff`, `/amenities` return all rows (bounded by society size).
- **Security:** bcrypt-hashed OTPs, OTP 5-min expiry, max 5 attempts, rate limit on OTP request (express-rate-limit), helmet, CORS allowlist, Zod validation, Prisma (parameterized), no secrets in code (`.env`).

## 5. Tech stack (locked)
| Layer | Choice |
|---|---|
| API | Node 22+, TypeScript, Express 5, Prisma ORM, Zod, jsonwebtoken, bcryptjs, helmet, cors, express-rate-limit, pino logger |
| DB | PostgreSQL 16 (Docker), Prisma migrations, seed script |
| Web | Vite + React 18 + TypeScript + Tailwind CSS 3 + React Router 6 + TanStack Query 5 + lucide-react icons |
| Mobile | Expo (latest stable SDK) + expo-router + TypeScript + TanStack Query |
| Tests | Vitest + supertest (API) |
| Infra | `docker-compose.yml` at repo root: `db` (postgres:16-alpine, 5432), `adminer` (8081), `api` (4000), `web` (nginx serving build, 8080) |

Repo layout:
```
Gatekeeper/
  docs/            # all planning & design docs (this folder)
  apps/api/        # backend
  apps/web/        # marketing site + web app
  apps/mobile/     # Expo app
  docker-compose.yml
  README.md
```
No shared package / workspace tooling — each app is standalone (simpler Docker & Expo builds).

## 6. Core entities (canonical names — Prisma models)
`User, OtpCode, Society, Block, Flat, Membership, Visitor, PreApproval, Staff, StaffFlat, StaffAttendance, Notice, Poll, PollOption, PollVote, Ticket, TicketComment, Amenity, AmenityBooking, Invoice, Payment, Expense, SosAlert, Notification`

Key fields (all have `id` cuid string, `createdAt`, most `updatedAt`; society-owned rows have `societyId`):
- **User**: phone (unique, E.164-ish 10-15 digits), name, email?, avatarUrl?
- **OtpCode**: phone, codeHash, expiresAt, attempts, consumedAt?
- **Society**: name, addressLine, city, state, pincode, logoUrl?
- **Block**: societyId, name (unique per society)
- **Flat**: societyId, blockId, number (unique per block), floor?
- **Membership**: userId, societyId, role (ADMIN|RESIDENT|GUARD), flatId? (required for RESIDENT), residentType? (OWNER|TENANT|FAMILY), status (ACTIVE|INACTIVE)
- **Visitor**: societyId, flatId, type (GUEST|DELIVERY|CAB|SERVICE), name, phone?, company?, vehicleNo?, photoUrl?, purpose?, status (PENDING_APPROVAL|APPROVED|DENIED|EXPIRED|CHECKED_IN|CHECKED_OUT|LEFT_AT_GATE|COLLECTED), preApprovalId?, loggedById (guard membership), decidedById?, decidedAt?, checkInAt?, checkOutAt?
- **PreApproval**: societyId, flatId, createdById, type, guestName, guestPhone?, passcode (6-digit, unique among active in society), validFrom, validTo, maxUses (default 1), usedCount, status (ACTIVE|USED|CANCELLED|EXPIRED)
- **Staff**: societyId, name, phone?, category (MAID|COOK|DRIVER|NANNY|CLEANER|GARDENER|OTHER), passcode (unique per society), photoUrl?, isActive
- **StaffFlat**: staffId, flatId (composite unique)
- **StaffAttendance**: staffId, societyId, checkInAt, checkOutAt?, loggedById
- **Notice**: societyId, title, body, category (GENERAL|MAINTENANCE|EVENT|URGENT), isPinned, createdById
- **Poll**: societyId, question, closesAt?, createdById; **PollOption**: pollId, text; **PollVote**: pollId, optionId, membershipId (unique per poll+membership)
- **Ticket**: societyId, flatId?, raisedById, assignedToId?, category (PLUMBING|ELECTRICAL|CLEANING|SECURITY|LIFT|PARKING|OTHER), title, description, priority (LOW|MEDIUM|HIGH), status (OPEN|IN_PROGRESS|RESOLVED|CLOSED), resolvedAt?; **TicketComment**: ticketId, authorId, body
- **Amenity**: societyId, name, description?, openTime "HH:mm", closeTime "HH:mm", slotMinutes, capacity, pricePerSlot (int paise), isActive
- **AmenityBooking**: amenityId, societyId, flatId, bookedById, startAt, endAt, status (CONFIRMED|CANCELLED)
- **Invoice**: societyId, flatId, period "YYYY-MM" (unique per flat+period), amount (int paise), dueDate, status (UNPAID|PAID|OVERDUE)
- **Payment**: invoiceId, societyId, amount, method (UPI|CARD|NETBANKING|CASH), reference, paidById?, paidAt
- **Expense**: societyId, category (SECURITY|HOUSEKEEPING|ELECTRICITY|WATER|REPAIRS|SALARIES|OTHER), amount (paise), vendor?, note?, spentOn (date), createdById
- **SosAlert**: societyId, flatId?, raisedById, type (MEDICAL|FIRE|THEFT|OTHER), message?, status (RAISED|ACKNOWLEDGED|RESOLVED), acknowledgedById?, acknowledgedAt?, resolvedAt?
- **Notification**: userId, societyId?, type, title, body, data (Json?), readAt?

"…ById" fields referencing actors point to **Membership.id** (actor-in-society), except `Notification.userId` → User.
Money is integer **paise** (₹1 = 100). Timestamps UTC; UI shows `Asia/Kolkata`.

## 7. API surface (`/api/v1`) — canonical
| Method & path | Roles | Purpose |
|---|---|---|
| POST `/auth/otp/request` `{phone}` | public | Send OTP (dev: returns `devCode`) |
| POST `/auth/otp/verify` `{phone, code, name?}` | public | → `{ token, user, memberships[] }` (memberships include society + flat) |
| GET `/me` | auth | user + memberships |
| PATCH `/me` `{name?, email?}` | auth | update profile |
| POST `/societies` `{name, addressLine, city, state, pincode}` | auth | create society; caller becomes ADMIN |
| GET `/society` | member | current society (from X-Society-Id) |
| GET/POST `/blocks` | GET member / POST admin | blocks |
| GET `/flats` (`?blockId`), POST `/flats/bulk` `{blockId, numbers[]}` | GET member / POST admin | flats |
| GET `/members`, POST `/members` `{phone, name, role, flatId?, residentType?}`, PATCH `/members/:id` `{status?, role?}` | admin (GET also guard: residents of a flat via `?flatId`) | membership mgmt |
| GET `/visitors` (`?status&date&flatId`) | guard/admin all; resident own flat | list |
| POST `/visitors` `{flatId, type, name, phone?, company?, vehicleNo?, purpose?}` | guard | log walk-in → PENDING_APPROVAL |
| POST `/visitors/:id/decision` `{decision: APPROVE\|DENY\|LEAVE_AT_GATE}` | resident of flat | decide |
| POST `/visitors/:id/check-in` / `/check-out` / `/collect` | guard (collect: guard or resident) | lifecycle |
| POST `/gate/verify` `{passcode}` | guard | matches PreApproval → creates CHECKED_IN visitor; or Staff → toggles attendance. Returns `{kind: "VISITOR"\|"STAFF", ...}` |
| GET/POST `/preapprovals`, DELETE `/preapprovals/:id` | resident write; admin & guard read (guard: `?status=ACTIVE`, today's "Expected" list, passcode hidden) | invites |
| GET/POST `/staff`, PATCH `/staff/:id`, POST `/staff/:id/flats` `{flatId}`, GET `/staff/:id/attendance` | GET all members; POST/PATCH admin; link flats admin or resident for own flat | daily help |
| GET/POST `/notices`, PATCH/DELETE `/notices/:id` | GET member / write admin | notices |
| GET/POST `/polls`, POST `/polls/:id/vote` `{optionId}` | GET member, POST admin, vote resident | polls (results counts in GET) |
| GET/POST `/tickets`, GET/PATCH `/tickets/:id`, POST `/tickets/:id/comments` | resident own; admin all | helpdesk |
| GET/POST `/amenities`, PATCH `/amenities/:id`, GET `/amenities/:id/availability?date=YYYY-MM-DD` | GET member, write admin | amenities |
| GET/POST `/bookings`, DELETE `/bookings/:id` | resident own; admin all | bookings |
| GET `/invoices` (`?status&period`), POST `/invoices/generate` `{period, amount, dueDate}`, POST `/invoices/:id/pay` `{method}` | resident own; admin all/generate | billing (mock pay) |
| GET/POST `/expenses` | admin | expenses |
| GET `/reports/summary` | admin | dashboard KPIs |
| GET/POST `/sos`, PATCH `/sos/:id` `{status}` | POST resident; GET/PATCH guard/admin (resident sees own) | emergency |
| GET `/notifications`, POST `/notifications/:id/read`, POST `/notifications/read-all` | auth | notifications |
| GET `/events?token&societyId` | auth (SSE) | realtime |
| GET `/health` (no /api/v1 prefix also ok) | public | liveness |

## 8. Brand & design direction (locked)
"Premium, calm, trustworthy" — private-bank feel, not consumer-loud. **Must look distinct from MyGate.**

| Token | Hex | Use |
|---|---|---|
| `navy-950` | `#060E22` | darkest surfaces, marketing hero |
| `navy-900` | `#0B1B3F` | **primary brand**, sidebar, headings |
| `navy-800` | `#13285A` | hover on dark |
| `navy-700` | `#1D3B7A` | primary button hover |
| `emerald-600` | `#0E8A6A` | **trust / approve / success / primary CTA** |
| `emerald-650` | `#0C7F62` | **button fill** with white text (4.97:1 AA); hover → emerald-700 |
| `emerald-500` | `#12A37E` | focus ring, decorative |
| `emerald-50` | `#E8F7F1` | success tint |
| `gold-500` | `#C8A04A` | **premium accent** — thin rules, badges, icons on navy only (not text on white) |
| `gold-100` | `#F6EDD6` | subtle highlight |
| `ink-900` | `#111827` | body text |
| `slate-600` | `#475467` | secondary text |
| `slate-300` | `#D0D5DD` | decorative borders (cards, dividers) |
| `slate-450` | `#7A8599` | form input borders (3:1 non-text contrast) |
| `slate-100` | `#F2F4F7` | app background tint |
| `paper` | `#FBFAF7` | warm off-white page bg |
| `danger-600` | `#D14343` | deny / SOS / destructive |
| `warning-500` | `#E0A100` | pending / overdue |

- **Typography:** Display/headings on marketing: **"Fraunces"** (serif, conveys heritage/trust). UI & body: **"Manrope"**. Numbers: tabular-nums.
- **Shape:** radius 12px cards, 10px inputs/buttons, pill badges. Soft layered shadows (`0 1px 2px rgba(16,24,40,.06), 0 8px 24px rgba(16,24,40,.06)`).
- **Motifs:** thin gold hairlines, shield/keyhole mark logo, generous whitespace, status chips with dot.
- **Accessibility:** WCAG 2.1 AA contrast, 44px touch targets, visible focus ring (emerald-500, 2px offset), never color-only status.
- **Dark mode:** web app supports system dark mode (navy-950 bg).

## 9. Demo seed data
Society **"Emerald Heights"**, Bengaluru. Blocks A, B; flats A-101…A-104, B-201…B-204.
| Role | Phone | Name | Flat |
|---|---|---|---|
| ADMIN | 9000000001 | Ananya Rao | — |
| RESIDENT | 9000000002 | Rohan Mehta | A-101 |
| RESIDENT | 9000000004 | Priya Iyer | B-201 |
| GUARD | 9000000003 | Suresh Kumar | — |
Plus sample staff (passcode 482913), a pre-approval (passcode 135790), notices, a poll, tickets, amenities (Clubhouse, Tennis Court, Swimming Pool), invoices for current month, expenses.

## 10. Docs index
| # | File | Contents |
|---|---|---|
| 00 | `00-PROJECT-BRIEF.md` | this file |
| 01 | `01-PRD.md` | Product Requirements |
| 02 | `02-SRS.md` | Software Requirements Specification (SRD) |
| 03 | `03-DATA-DICTIONARY.md` | Entities, fields, types, constraints, enums |
| 04 | `04-ERD.md` | Entity relationship diagram (Mermaid) |
| 05 | `05-DFD.md` | Data flow diagrams L0/L1/L2 (Mermaid) |
| 06 | `06-HLD.md` | High-level design / system architecture |
| 07 | `07-LLD.md` | Low-level design: modules, classes, sequences, state machines |
| 08 | `08-API-SPEC.md` | Endpoint-by-endpoint contract |
| 09 | `09-UI-UX-DESIGN-SYSTEM.md` | Brand, tokens, components, screen inventory, flows |
| 10 | `10-TEST-PLAN.md` | Test strategy & cases |
| 11 | `11-ROADMAP.md` | Phased delivery & future scope |
