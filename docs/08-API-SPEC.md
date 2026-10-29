# Gatekeeper — API Specification (v1)

> This contract conforms to `00-PROJECT-BRIEF.md` (sections 4, 6, 7, 9). If it conflicts with the brief, the brief wins. Fix this file to match.
> Backend, web and mobile are built against this file independently. Anything this file does not define is **not** part of the API.

---

## 0. Endpoint summary

`Tenant` means the endpoint requires the `X-Society-Id` header (see 1.3). Every path is under `/api/v1` except where noted.

| # | Method & path | Roles | Tenant | Success |
|---|---|---|---|---|
| 1 | POST `/auth/otp/request` | public | no | 200 |
| 2 | POST `/auth/otp/verify` | public | no | 200 |
| 3 | GET `/me` | auth | no | 200 |
| 4 | PATCH `/me` | auth | no | 200 |
| 5 | POST `/societies` | auth | no | 201 |
| 6 | GET `/society` | member | yes | 200 |
| 7 | GET `/blocks` | member | yes | 200 |
| 8 | POST `/blocks` | ADMIN | yes | 201 |
| 9 | GET `/flats` | member | yes | 200 |
| 10 | POST `/flats/bulk` | ADMIN | yes | 201 |
| 11 | GET `/members` | ADMIN; GUARD with `?flatId` | yes | 200 |
| 12 | POST `/members` | ADMIN | yes | 201 |
| 13 | PATCH `/members/:id` | ADMIN | yes | 200 |
| 14 | GET `/visitors` | GUARD, ADMIN (all); RESIDENT (own flat) | yes | 200 |
| 15 | POST `/visitors` | GUARD | yes | 201 |
| 16 | POST `/visitors/:id/decision` | RESIDENT of the flat | yes | 200 |
| 17 | POST `/visitors/:id/check-in` | GUARD | yes | 200 |
| 18 | POST `/visitors/:id/check-out` | GUARD | yes | 200 |
| 19 | POST `/visitors/:id/collect` | GUARD; RESIDENT of the flat | yes | 200 |
| 20 | POST `/gate/verify` | GUARD | yes | 200 |
| 21 | GET `/preapprovals` | RESIDENT (own flat); ADMIN (all); GUARD (active today, no passcode) | yes | 200 |
| 22 | POST `/preapprovals` | RESIDENT | yes | 201 |
| 23 | DELETE `/preapprovals/:id` | RESIDENT of the flat | yes | 200 |
| 24 | GET `/staff` | member | yes | 200 |
| 25 | POST `/staff` | ADMIN | yes | 201 |
| 26 | PATCH `/staff/:id` | ADMIN | yes | 200 |
| 27 | POST `/staff/:id/flats` | ADMIN; RESIDENT (own flat only) | yes | 200 |
| 28 | GET `/staff/:id/attendance` | member | yes | 200 |
| 29 | GET `/notices` | member | yes | 200 |
| 30 | POST `/notices` | ADMIN | yes | 201 |
| 31 | PATCH `/notices/:id` | ADMIN | yes | 200 |
| 32 | DELETE `/notices/:id` | ADMIN | yes | 204 |
| 33 | GET `/polls` | member | yes | 200 |
| 34 | POST `/polls` | ADMIN | yes | 201 |
| 35 | POST `/polls/:id/vote` | RESIDENT | yes | 200 |
| 36 | GET `/tickets` | RESIDENT (own flat); ADMIN (all) | yes | 200 |
| 37 | POST `/tickets` | RESIDENT, ADMIN | yes | 201 |
| 38 | GET `/tickets/:id` | RESIDENT (own flat); ADMIN | yes | 200 |
| 39 | PATCH `/tickets/:id` | ADMIN; RESIDENT (limited, see below) | yes | 200 |
| 40 | POST `/tickets/:id/comments` | RESIDENT (own flat); ADMIN | yes | 201 |
| 41 | GET `/amenities` | member | yes | 200 |
| 42 | POST `/amenities` | ADMIN | yes | 201 |
| 43 | PATCH `/amenities/:id` | ADMIN | yes | 200 |
| 44 | GET `/amenities/:id/availability` | member | yes | 200 |
| 45 | GET `/bookings` | RESIDENT (own flat); ADMIN (all) | yes | 200 |
| 46 | POST `/bookings` | RESIDENT, ADMIN | yes | 201 |
| 47 | DELETE `/bookings/:id` | RESIDENT (own flat); ADMIN | yes | 200 |
| 48 | GET `/invoices` | RESIDENT (own flat); ADMIN (all) | yes | 200 |
| 49 | POST `/invoices/generate` | ADMIN | yes | 201 |
| 50 | POST `/invoices/:id/pay` | RESIDENT (own flat); ADMIN | yes | 200 |
| 51 | GET `/expenses` | ADMIN | yes | 200 |
| 52 | POST `/expenses` | ADMIN | yes | 201 |
| 53 | GET `/reports/summary` | ADMIN | yes | 200 |
| 54 | GET `/sos` | GUARD, ADMIN (all); RESIDENT (own) | yes | 200 |
| 55 | POST `/sos` | RESIDENT | yes | 201 |
| 56 | PATCH `/sos/:id` | GUARD, ADMIN | yes | 200 |
| 57 | GET `/notifications` | auth | no | 200 |
| 58 | POST `/notifications/:id/read` | auth | no | 200 |
| 59 | POST `/notifications/read-all` | auth | no | 200 |
| 60 | GET `/events?token&societyId` | auth (query token) | no (query param) | 200 stream |
| 61 | GET `/health` (also `/api/v1/health`) | public | no | 200 |

**61 endpoints.**

---

## 1. Conventions

### 1.1 Base URL and transport
- Base URL: `http://<host>:4000/api/v1`. Local dev: `http://localhost:4000/api/v1`.
- Requests and responses are JSON (`Content-Type: application/json; charset=utf-8`). The only exceptions are SSE (`text/event-stream`) and `204 No Content`.
- Requests with a body must send `Content-Type: application/json`. Maximum body size is 100 kB, and larger bodies get `413` with code `VALIDATION_ERROR`.
- Header names are case-insensitive.

### 1.2 Authentication
- Header: `Authorization: Bearer <jwt>`.
- JWT is HS256 with a 7-day expiry. The payload is `{ "sub": "<userId>", "iat", "exp" }`. There is no refresh endpoint. When a request returns `401`, clients send the user back to login.
- Every endpoint except `POST /auth/otp/request`, `POST /auth/otp/verify` and `GET /health` requires a valid token. A missing, malformed or expired token returns `401 UNAUTHORIZED`.
- SSE (`GET /events`) takes the token as the `?token=` query param, because EventSource cannot set headers.

### 1.3 Tenancy (`X-Society-Id`)
- **Required** on every route **except** `/auth/*`, `/me`, `POST /societies`, `/notifications*`, `/events` (which uses `?societyId=` instead) and `/health`.
- Middleware order: auth, tenancy, RBAC, validation.
- The tenancy middleware resolves the caller's **ACTIVE** membership in that society into `req.member = { id, role, flatId, societyId, residentType }`.
  - Header missing: `400 VALIDATION_ERROR` ("X-Society-Id header is required").
  - No ACTIVE membership, or the society does not exist: `403 FORBIDDEN`. The API never reveals whether a society exists.
- All society-owned rows are scoped by `societyId = req.member.societyId`. An id that belongs to another society returns `404 NOT_FOUND`.
- **Authorization rule:** if the caller's role cannot use the endpoint, the response is `403 FORBIDDEN`. If the role can use the endpoint but the specific row is outside what the caller may see (for example another flat's ticket), the response is `404 NOT_FOUND`.

### 1.4 Data formats
| Kind | Format |
|---|---|
| ids | cuid strings, e.g. `"clx9v2k3f0001ab12cd34ef56"` |
| timestamps | ISO 8601 UTC strings with ms and `Z`, e.g. `"2026-10-29T04:30:00.000Z"` (JS `toISOString()`) |
| date-only fields (`Invoice.dueDate`, `Expense.spentOn`) | `"YYYY-MM-DD"`, a calendar date in Asia/Kolkata |
| `date` query param | `YYYY-MM-DD`, meaning the Asia/Kolkata day `[00:00 IST, 24:00 IST)`, i.e. `[D-1T18:30:00Z, DT18:30:00Z)` |
| `period` | `"YYYY-MM"` |
| clock times (`openTime`, `closeTime`) | `"HH:mm"` 24h, Asia/Kolkata wall clock |
| money | integer **paise** (₹1 = 100). Never floats. ₹2,500.00 is `250000` |
| phone | digits only, `^[0-9]{10,15}$`. Clients strip spaces, `+` and dashes before sending |
| passcodes | 6-digit strings `^[0-9]{6}$`. Always strings, never numbers, so leading zeros survive |
| booleans | JSON `true`/`false`. Query booleans are `"true"`/`"false"` |
| enums | UPPER_SNAKE strings exactly as in brief section 6 |

**Strings:** the server trims all input strings. For a required field, a string that is empty after trimming is a `VALIDATION_ERROR`. For an optional field, an empty string becomes `null`. In PATCH bodies, `null` clears an optional field and an omitted field is left unchanged. Unknown body fields are ignored (stripped).

**Nullable fields** are always present in responses as `null`, never omitted. The only exception is `Ticket.comments`, which appears only on the detail response.

### 1.5 Lists
- Response envelope: `{ "items": [ ... ] }`. A few endpoints add documented sibling keys (e.g. `unreadCount`).
- `?limit=` is an integer from 1 to 200, default 50. Values outside that range return `400 VALIDATION_ERROR`.
- Default order is newest first (`createdAt desc`) unless the endpoint says otherwise.
- **Reference lists** (`/blocks`, `/flats`, `/members`, `/staff`, `/amenities`) return **all** matching rows, ignore `limit`, and are sorted as documented. Clients use them to fill pickers, so truncating them would silently break forms.
- There is no cursor pagination in v1.

### 1.6 Errors
Every non-2xx response (except the SSE stream itself) has this shape:
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Human readable message", "details": [] } }
```
- `details` is optional. For `VALIDATION_ERROR` it is an array of `{ "path": "field.sub", "message": "..." }`, built from Zod issues with the path joined by `.`. For `INVALID_TRANSITION` it is `{ "from": "<status>", "to": "<status>" }`.
- `message` is safe to show to users. Clients branch on `code`, never on `message`.

### 1.7 HTTP status usage
| Status | Meaning |
|---|---|
| 200 | OK (read, update, action) |
| 201 | Resource created |
| 204 | Deleted, no body |
| 400 | Malformed or invalid input (`VALIDATION_ERROR`) |
| 401 | Not authenticated |
| 403 | Authenticated, but the role or membership is not allowed |
| 404 | Not found, or not visible to the caller (also `PASSCODE_INVALID`) |
| 409 | Uniqueness or state conflict (`CONFLICT`, `SLOT_FULL`, `ALREADY_VOTED`, `ALREADY_PAID`) |
| 413 | Body too large |
| 422 | Business-rule violation (`INVALID_TRANSITION`, `OTP_*`, `NAME_REQUIRED`, …) |
| 429 | Rate limited / too many OTP attempts |
| 500 | Unexpected (`INTERNAL_ERROR`). Never leaks stack traces |

### 1.8 Rate limits
| Scope | Limit | Key | On exceed |
|---|---|---|---|
| `POST /auth/otp/request` | 5 requests / 15 min | phone + IP | `429 RATE_LIMITED` with `Retry-After` (seconds) and `RateLimit-*` headers (express-rate-limit standard headers) |
| OTP verification | 5 wrong attempts per issued code | OTP record | `429 OTP_TOO_MANY_ATTEMPTS` |

v1 has no other rate limits.

### 1.9 Security notes
- The API uses helmet and a CORS allowlist (`CORS_ORIGINS` env). Prisma queries are parameterized. OTPs are stored bcrypt-hashed.
- Because SSE passes the JWT in a query string, the server must not log query strings for `/events`.

---

## 2. Error code catalog

| Code | HTTP | When |
|---|---|---|
| `VALIDATION_ERROR` | 400 / 413 | Body, query or params fail the schema; `X-Society-Id` missing; body too large (413) |
| `UNAUTHORIZED` | 401 | Missing, invalid or expired JWT; the user in the token no longer exists |
| `FORBIDDEN` | 403 | No ACTIVE membership in the society; role not allowed; resident acting on another flat in a role-gated action (e.g. linking staff to a flat that is not theirs, a resident paying `CASH`) |
| `NOT_FOUND` | 404 | Unknown id, row in another society, row not visible to the caller, unknown route |
| `CONFLICT` | 409 | Unique constraint (block name, membership exists, duplicate flat booking for a slot) |
| `OTP_INVALID` | 422 | Wrong code, or no outstanding OTP for this phone |
| `OTP_EXPIRED` | 422 | The latest OTP is past its 5-minute expiry |
| `OTP_TOO_MANY_ATTEMPTS` | 429 | 5 wrong attempts on the current OTP. The user must request a new one |
| `NAME_REQUIRED` | 422 | OTP is valid but the phone is new and no `name` was sent. The OTP is **not** consumed |
| `RATE_LIMITED` | 429 | Request rate limit hit |
| `INVALID_TRANSITION` | 422 | State machine does not allow the change (visitor, ticket, SOS, booking, pre-approval). `details: {from, to}` |
| `PASSCODE_INVALID` | 404 | `/gate/verify`: no usable pre-approval or active staff matches. `details: { reason }` (see 4.6) |
| `SLOT_FULL` | 409 | Booking: confirmed bookings for the slot already equal capacity |
| `SLOT_IN_PAST` | 422 | Booking or cancellation for a slot whose `startAt <= now` |
| `SLOT_INVALID` | 422 | `startAt` is not on a slot boundary within the amenity's hours |
| `AMENITY_INACTIVE` | 422 | Booking an amenity with `isActive=false` |
| `ALREADY_VOTED` | 409 | Membership already voted in this poll |
| `POLL_CLOSED` | 422 | Voting after `closesAt` |
| `ALREADY_PAID` | 409 | Paying an invoice whose status is `PAID` |
| `FLAT_REQUIRED` | 422 | A RESIDENT membership would end up without a flat |
| `LAST_ADMIN` | 422 | A change would leave the society with no ACTIVE ADMIN |
| `INTERNAL_ERROR` | 500 | Anything unexpected |

---

## 3. Shared response shapes (TypeScript)

Every `…By` actor reference uses the **Membership id** plus the user's name. `name` always comes from `User.name`.

```ts
type ISODateTime = string;   // "2026-10-29T04:30:00.000Z"
type ISODate = string;       // "2026-10-29" (Asia/Kolkata calendar date)
type Paise = number;         // integer

type Role = "ADMIN" | "RESIDENT" | "GUARD";
type ResidentType = "OWNER" | "TENANT" | "FAMILY";
type MembershipStatus = "ACTIVE" | "INACTIVE";
type VisitorType = "GUEST" | "DELIVERY" | "CAB" | "SERVICE";
type VisitorStatus = "PENDING_APPROVAL" | "APPROVED" | "DENIED" | "EXPIRED"
  | "CHECKED_IN" | "CHECKED_OUT" | "LEFT_AT_GATE" | "COLLECTED";
type PreApprovalStatus = "ACTIVE" | "USED" | "CANCELLED" | "EXPIRED";
type StaffCategory = "MAID" | "COOK" | "DRIVER" | "NANNY" | "CLEANER" | "GARDENER" | "OTHER";
type NoticeCategory = "GENERAL" | "MAINTENANCE" | "EVENT" | "URGENT";
type TicketCategory = "PLUMBING" | "ELECTRICAL" | "CLEANING" | "SECURITY" | "LIFT" | "PARKING" | "OTHER";
type TicketPriority = "LOW" | "MEDIUM" | "HIGH";
type TicketStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED";
type BookingStatus = "CONFIRMED" | "CANCELLED";
type InvoiceStatus = "UNPAID" | "PAID" | "OVERDUE";
type PaymentMethod = "UPI" | "CARD" | "NETBANKING" | "CASH";
type ExpenseCategory = "SECURITY" | "HOUSEKEEPING" | "ELECTRICITY" | "WATER" | "REPAIRS" | "SALARIES" | "OTHER";
type SosType = "MEDICAL" | "FIRE" | "THEFT" | "OTHER";
type SosStatus = "RAISED" | "ACKNOWLEDGED" | "RESOLVED";

interface ActorRef { id: string; name: string }           // id = Membership.id

interface FlatRef {                                        // compact flat used inside other objects
  id: string;
  number: string;        // "101"
  blockName: string;     // "A"
  label: string;         // "A-101"  = `${blockName}-${number}`
}

interface User {
  id: string;
  phone: string;
  name: string;
  email: string | null;
  avatarUrl: string | null;
  createdAt: ISODateTime;
}

interface Membership {
  id: string;
  role: Role;
  status: MembershipStatus;
  residentType: ResidentType | null;          // non-null only for RESIDENT
  society: { id: string; name: string; city: string };
  flat: { id: string; number: string; block: { id: string; name: string } } | null; // non-null only for RESIDENT
  createdAt: ISODateTime;
}

interface Society {
  id: string;
  name: string;
  addressLine: string;
  city: string;
  state: string;
  pincode: string;
  logoUrl: string | null;
  createdAt: ISODateTime;
}

interface Block {
  id: string;
  name: string;
  flatCount: number;
  createdAt: ISODateTime;
}

interface Flat {
  id: string;
  number: string;
  floor: number | null;
  block: { id: string; name: string };
  label: string;           // "A-101"
  residentCount: number;   // ACTIVE RESIDENT memberships on this flat
  createdAt: ISODateTime;
}

interface Member {         // a Membership seen from inside its society
  id: string;              // Membership.id
  role: Role;
  status: MembershipStatus;
  residentType: ResidentType | null;
  flat: { id: string; number: string; block: { id: string; name: string } } | null;
  user: { id: string; name: string; phone: string };
  createdAt: ISODateTime;
}

interface Visitor {
  id: string;
  type: VisitorType;
  name: string;
  phone: string | null;
  company: string | null;
  vehicleNo: string | null;
  photoUrl: string | null;
  purpose: string | null;
  status: VisitorStatus;
  flat: FlatRef;
  preApprovalId: string | null;
  loggedBy: ActorRef;                // guard membership
  decidedBy: ActorRef | null;        // resident who decided; for pre-approved entries, the pre-approval creator
  decidedAt: ISODateTime | null;
  checkInAt: ISODateTime | null;
  checkOutAt: ISODateTime | null;
  expiresAt: ISODateTime | null;     // createdAt + 10 min while PENDING_APPROVAL, else null
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface PreApproval {
  id: string;
  type: VisitorType;
  guestName: string;
  guestPhone: string | null;
  passcode: string;                  // 6 digits
  validFrom: ISODateTime;
  validTo: ISODateTime;
  maxUses: number;
  usedCount: number;
  status: PreApprovalStatus;
  flat: FlatRef;
  createdBy: ActorRef;
  createdAt: ISODateTime;
}

interface Staff {
  id: string;
  name: string;
  phone: string | null;
  category: StaffCategory;
  passcode: string | null;           // returned ONLY to ADMIN; null for everyone else
  photoUrl: string | null;
  isActive: boolean;
  flats: FlatRef[];
  isInside: boolean;                 // has an attendance row with checkOutAt = null
  createdAt: ISODateTime;
}

interface StaffAttendance {
  id: string;
  staff: { id: string; name: string; category: StaffCategory };
  checkInAt: ISODateTime;
  checkOutAt: ISODateTime | null;
  loggedBy: ActorRef;                // guard who checked in
}

interface Notice {
  id: string;
  title: string;
  body: string;
  category: NoticeCategory;
  isPinned: boolean;
  createdBy: ActorRef;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface Poll {
  id: string;
  question: string;
  closesAt: ISODateTime | null;
  isClosed: boolean;                 // closesAt != null && closesAt <= now
  options: { id: string; text: string; votes: number }[];  // creation order
  totalVotes: number;
  myVoteOptionId: string | null;     // caller membership's vote
  createdBy: ActorRef;
  createdAt: ISODateTime;
}

interface TicketComment {
  id: string;
  body: string;
  author: { id: string; name: string; role: Role };
  createdAt: ISODateTime;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  flat: FlatRef | null;
  raisedBy: ActorRef;
  assignedTo: ActorRef | null;
  resolvedAt: ISODateTime | null;
  commentCount: number;
  comments?: TicketComment[];        // ONLY on GET /tickets/:id (oldest first)
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

interface Amenity {
  id: string;
  name: string;
  description: string | null;
  openTime: string;                  // "06:00"
  closeTime: string;                 // "22:00"
  slotMinutes: number;
  capacity: number;
  pricePerSlot: Paise;
  isActive: boolean;
  createdAt: ISODateTime;
}

interface AvailabilitySlot {
  startAt: ISODateTime;
  endAt: ISODateTime;
  booked: number;                    // CONFIRMED bookings in this slot
  capacity: number;
  available: number;                 // max(0, capacity - booked)
}

interface Booking {
  id: string;
  amenity: { id: string; name: string };
  flat: FlatRef;
  bookedBy: ActorRef;
  startAt: ISODateTime;
  endAt: ISODateTime;
  status: BookingStatus;
  createdAt: ISODateTime;
}

interface Payment {
  id: string;
  invoiceId: string;
  amount: Paise;
  method: PaymentMethod;
  reference: string;                 // e.g. "MOCK-UPI-7F3K9Q2L"
  paidBy: ActorRef | null;
  paidAt: ISODateTime;
}

interface Invoice {
  id: string;
  period: string;                    // "2026-10"
  amount: Paise;
  dueDate: ISODate;
  status: InvoiceStatus;
  flat: FlatRef;                     // flat.label e.g. "A-101"
  payments: Payment[];               // oldest first; at most 1 in v1
  createdAt: ISODateTime;
}

interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: Paise;
  vendor: string | null;
  note: string | null;
  spentOn: ISODate;
  createdBy: ActorRef;
  createdAt: ISODateTime;
}

interface ReportSummary {
  visitorsToday: number;       // visitors with createdAt in today's IST day
  pendingApprovals: number;    // visitors currently PENDING_APPROVAL
  insideNow: number;           // visitors currently CHECKED_IN (staff not counted)
  openTickets: number;         // tickets OPEN or IN_PROGRESS
  collectionRate: number;      // integer 0–100: round(paid amount / billed amount * 100) over invoices of the current IST month's period; 0 if none
  totalDue: Paise;             // sum of amount of all UNPAID + OVERDUE invoices (all periods)
  totalCollected: Paise;       // sum of Payment.amount with paidAt in the current IST month
  expensesThisMonth: Paise;    // sum of Expense.amount with spentOn in the current IST month
  residents: number;           // ACTIVE RESIDENT memberships
  flats: number;               // all flats in the society
  recentVisitors: Visitor[];   // latest 5 by createdAt
  sosActive: number;           // SOS alerts RAISED or ACKNOWLEDGED
}

interface SosAlert {
  id: string;
  type: SosType;
  message: string | null;
  status: SosStatus;
  flat: FlatRef | null;
  raisedBy: { id: string; name: string; phone: string };   // phone so guards can call back
  acknowledgedBy: ActorRef | null;
  acknowledgedAt: ISODateTime | null;
  resolvedAt: ISODateTime | null;
  createdAt: ISODateTime;
}

interface Notification {
  id: string;
  type: NotificationType;      // see 5.3
  title: string;
  body: string;
  data: Record<string, unknown> | null;   // ids for deep links, always includes societyId when society-bound
  societyId: string | null;
  readAt: ISODateTime | null;
  createdAt: ISODateTime;
}
```

---

## 4. Endpoints

Notation per endpoint:
- **Auth:** `Bearer` (JWT required) or `public`.
- **Society:** whether `X-Society-Id` is required.
- Every authenticated endpoint can also return `401 UNAUTHORIZED`. Every tenant endpoint can also return `400 VALIDATION_ERROR` (missing header) and `403 FORBIDDEN` (no membership). These are not repeated below.

### 4.1 Auth

#### POST `/auth/otp/request`
- **Auth:** public · **Society:** no
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `phone` | string | yes | `^[0-9]{10,15}$` |

- **Behavior:** generates a random 6-digit code, stores its bcrypt hash with `expiresAt = now + 5 min` and `attempts = 0`, and invalidates (marks consumed) any earlier unconsumed codes for that phone. In non-production the code is logged at `info`. Works for both existing and new phones and never reveals which one it is.
- **200**
```json
{ "sent": true, "devCode": "123456" }
```
`devCode` is present **only when `NODE_ENV !== "production"`**. In production the response is `{ "sent": true }`.
- **Errors:** `400 VALIDATION_ERROR`, `429 RATE_LIMITED` (5 / 15 min per phone+IP).

#### POST `/auth/otp/verify`
- **Auth:** public · **Society:** no
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `phone` | string | yes | `^[0-9]{10,15}$` |
| `code` | string | yes | `^[0-9]{6}$` |
| `name` | string | conditional | 1–80 chars. Required if no user exists for `phone`. Ignored for existing users |

- **Behavior, in order:**
  1. Load the latest unconsumed OTP for the phone. If there is none, return `422 OTP_INVALID`.
  2. If `attempts >= 5`, return `429 OTP_TOO_MANY_ATTEMPTS`.
  3. If `expiresAt <= now`, return `422 OTP_EXPIRED`.
  4. If the code does not match, increment `attempts`. If attempts now equals 5, return `429 OTP_TOO_MANY_ATTEMPTS`, otherwise `422 OTP_INVALID`.
  5. The code matches. If there is no user for the phone and no `name`, return `422 NAME_REQUIRED`. The OTP is **not** consumed and attempts are **not** incremented, so the client re-submits the same code with `name`.
  6. Mark the OTP consumed, create the user if new, and sign the JWT.
- **200**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "clx9u0000000001rohan0000",
    "phone": "9000000002",
    "name": "Rohan Mehta",
    "email": null,
    "avatarUrl": null,
    "createdAt": "2026-10-01T05:00:00.000Z"
  },
  "memberships": [
    {
      "id": "clx9m0000000002rohanEH00",
      "role": "RESIDENT",
      "status": "ACTIVE",
      "residentType": "OWNER",
      "society": { "id": "clx9s00000000emeraldhts0", "name": "Emerald Heights", "city": "Bengaluru" },
      "flat": { "id": "clx9f0000000000a101000000", "number": "101", "block": { "id": "clx9b000000000blocka0000", "name": "A" } },
      "createdAt": "2026-10-01T05:00:00.000Z"
    }
  ]
}
```
`memberships` contains **ACTIVE memberships only**, ordered by society name. It is `[]` for a brand-new user. The client then shows "Create a society", or "Ask your society admin to add you".
- **Errors:** `400 VALIDATION_ERROR`, `422 OTP_INVALID`, `422 OTP_EXPIRED`, `422 NAME_REQUIRED`, `429 OTP_TOO_MANY_ATTEMPTS`.

### 4.2 Me

#### GET `/me`
- **Auth:** Bearer · **Society:** no
- **200:** `{ "user": User, "memberships": Membership[] }`. Same shape and rules as the verify response, without `token`.

#### PATCH `/me`
- **Auth:** Bearer · **Society:** no
- **Body** (at least one field)

| Field | Type | Req | Constraints |
|---|---|---|---|
| `name` | string | no | 1–80 chars |
| `email` | string \| null | no | valid email, max 254 chars; `null` clears it |

- **200:** `User`
- **Errors:** `400 VALIDATION_ERROR` (including an empty body).

### 4.3 Society setup

#### POST `/societies`
- **Auth:** Bearer · **Society:** no
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `name` | string | yes | 2–120 chars |
| `addressLine` | string | yes | 1–200 chars |
| `city` | string | yes | 1–80 chars |
| `state` | string | yes | 1–80 chars |
| `pincode` | string | yes | `^[1-9][0-9]{5}$` |

- **Behavior:** creates the Society and an ACTIVE `ADMIN` membership for the caller (with `flat` null).
- **201**
```json
{
  "society": { "id": "clx9s00000000emeraldhts0", "name": "Emerald Heights", "addressLine": "12 Outer Ring Road, Bellandur", "city": "Bengaluru", "state": "Karnataka", "pincode": "560103", "logoUrl": null, "createdAt": "2026-10-29T04:30:00.000Z" },
  "membership": { "id": "clx9m0000000001ananyaEH0", "role": "ADMIN", "status": "ACTIVE", "residentType": null, "society": { "id": "clx9s00000000emeraldhts0", "name": "Emerald Heights", "city": "Bengaluru" }, "flat": null, "createdAt": "2026-10-29T04:30:00.000Z" }
}
```
- **Errors:** `400 VALIDATION_ERROR`.

#### GET `/society`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member
- **200:** `Society`

#### GET `/blocks`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member
- **Reference list.** Returns all blocks sorted by `name` ascending.
- **200:** `{ "items": Block[] }`
```json
{ "items": [ { "id": "clx9b000000000blocka0000", "name": "A", "flatCount": 4, "createdAt": "2026-10-01T05:00:00.000Z" } ] }
```

#### POST `/blocks`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body:** `name` string, required, 1–20 chars, unique per society (case-insensitive).
- **201:** `Block` (with `flatCount: 0`)
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `409 CONFLICT` (name exists).

#### GET `/flats`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member
- **Query:** `blockId?` (cuid). If the block is not in the society, the response is `{ "items": [] }`.
- **Reference list.** Returns all matching flats sorted by block name ascending, then number ascending with natural sort ("2" < "10").
- **200:** `{ "items": Flat[] }`
```json
{ "items": [ { "id": "clx9f0000000000a101000000", "number": "101", "floor": null, "block": { "id": "clx9b000000000blocka0000", "name": "A" }, "label": "A-101", "residentCount": 1, "createdAt": "2026-10-01T05:00:00.000Z" } ] }
```

#### POST `/flats/bulk`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `blockId` | string | yes | block in this society, else `404 NOT_FOUND` |
| `numbers` | string[] | yes | 1–200 items; each 1–10 chars `^[A-Za-z0-9-]+$`. The server de-duplicates within the request |

- **Behavior:** creates one flat per number that does not already exist in the block (`floor` = null). Numbers that already exist are skipped. The request never fails just because some numbers already exist.
- **201**
```json
{ "items": [ /* Flat[] created */ ], "skipped": ["101"] }
```
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.

#### GET `/members`
- **Auth:** Bearer · **Society:** yes
- **Roles:**
  - ADMIN: all memberships.
  - GUARD: **must** pass `?flatId`, and the result is limited to ACTIVE RESIDENT members of that flat, so the guard can call them. A GUARD without `flatId` gets `403 FORBIDDEN`.
  - RESIDENT: `403 FORBIDDEN`.
- **Query (ADMIN):** `role?` (Role), `status?` (MembershipStatus), `flatId?`.
- **Reference list.** Returns all matching rows sorted by user name ascending.
- **200:** `{ "items": Member[] }`
```json
{ "items": [ { "id": "clx9m0000000002rohanEH00", "role": "RESIDENT", "status": "ACTIVE", "residentType": "OWNER", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "block": { "id": "clx9b000000000blocka0000", "name": "A" } }, "user": { "id": "clx9u0000000001rohan0000", "name": "Rohan Mehta", "phone": "9000000002" }, "createdAt": "2026-10-01T05:00:00.000Z" } ] }
```

#### POST `/members`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `phone` | string | yes | `^[0-9]{10,15}$` |
| `name` | string | yes | 1–80 chars. Used only if no user exists for the phone. An existing user's name is never overwritten |
| `role` | Role | yes | |
| `flatId` | string | if RESIDENT | flat in this society, else `404 NOT_FOUND`. Must be absent/null for ADMIN or GUARD (`400`) |
| `residentType` | ResidentType | no | RESIDENT only, default `OWNER`. Must be absent/null for other roles (`400`) |

- **Behavior:** finds or creates the User by phone, then creates an ACTIVE membership.
- **201:** `Member`
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND` (flat), `409 CONFLICT` (the user already has a membership in this society, ACTIVE or INACTIVE. Use PATCH to reactivate it).
- **Side effects:** Notification `MEMBERSHIP_ADDED` to the user.

#### PATCH `/members/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body** (at least one)

| Field | Type | Req | Constraints |
|---|---|---|---|
| `status` | MembershipStatus | no | |
| `role` | Role | no | Changing to ADMIN/GUARD clears `flatId` and `residentType`. Changing to RESIDENT requires that the membership already has a `flatId`, else `422 FLAT_REQUIRED` |

- **200:** `Member`
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `422 FLAT_REQUIRED`, `422 LAST_ADMIN` (the change would leave zero ACTIVE ADMINs, including an admin demoting or deactivating themselves).

### 4.4 Visitors

#### Visitor state machine

| From | Trigger | Endpoint | Actor | To |
|---|---|---|---|---|
| (new) | Walk-in logged | POST `/visitors` | GUARD | `PENDING_APPROVAL` |
| (new) | Pre-approval passcode verified | POST `/gate/verify` | GUARD | `CHECKED_IN` (created directly) |
| `PENDING_APPROVAL` | `APPROVE` | POST `/visitors/:id/decision` | RESIDENT of flat | `APPROVED` |
| `PENDING_APPROVAL` | `DENY` | POST `/visitors/:id/decision` | RESIDENT of flat | `DENIED` |
| `PENDING_APPROVAL` | `LEAVE_AT_GATE` (**type `DELIVERY` only**) | POST `/visitors/:id/decision` | RESIDENT of flat | `LEFT_AT_GATE` |
| `PENDING_APPROVAL` | 10 min after `createdAt` with no decision | system | system | `EXPIRED` |
| `APPROVED` | Check in | POST `/visitors/:id/check-in` | GUARD | `CHECKED_IN` |
| `CHECKED_IN` | Check out | POST `/visitors/:id/check-out` | GUARD | `CHECKED_OUT` |
| `LEFT_AT_GATE` | Parcel collected | POST `/visitors/:id/collect` | GUARD or RESIDENT of flat | `COLLECTED` |

- Terminal statuses: `DENIED`, `EXPIRED`, `CHECKED_OUT`, `COLLECTED`.
- Any other transition returns `422 INVALID_TRANSITION` with `details: { from, to }`. That includes `LEAVE_AT_GATE` on a non-DELIVERY visitor (`to: "LEFT_AT_GATE"`).
- **Expiry:** the server runs a sweeper every 60 s that moves `PENDING_APPROVAL` visitors with `createdAt <= now - 10 min` to `EXPIRED` and emits `visitor.updated`. If a decision request arrives for a stale pending visitor before the sweeper runs, the server first expires the visitor (and emits the event), then returns `422 INVALID_TRANSITION` (`from: "EXPIRED"`).
- "Resident of flat" means the caller's membership has role RESIDENT and `flatId == visitor.flat.id`.

#### GET `/visitors`
- **Auth:** Bearer · **Society:** yes
- **Roles:** GUARD and ADMIN see all. RESIDENT sees only their own flat (`flatId` is ignored and forced to the resident's flat).
- **Query**

| Param | Type | Notes |
|---|---|---|
| `status` | VisitorStatus, or comma-separated list | e.g. `PENDING_APPROVAL,APPROVED` |
| `date` | `YYYY-MM-DD` | IST day of `createdAt` |
| `flatId` | cuid | GUARD/ADMIN only |
| `limit` | 1–200 | default 50 |

- **200:** `{ "items": Visitor[] }`, newest first.
```json
{
  "items": [
    {
      "id": "clx9v00000000visitor0001",
      "type": "DELIVERY",
      "name": "Arjun",
      "phone": "9876543210",
      "company": "QuickKart",
      "vehicleNo": null,
      "photoUrl": null,
      "purpose": "Parcel",
      "status": "PENDING_APPROVAL",
      "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" },
      "preApprovalId": null,
      "loggedBy": { "id": "clx9m0000000003sureshEH0", "name": "Suresh Kumar" },
      "decidedBy": null,
      "decidedAt": null,
      "checkInAt": null,
      "checkOutAt": null,
      "expiresAt": "2026-10-29T04:40:00.000Z",
      "createdAt": "2026-10-29T04:30:00.000Z",
      "updatedAt": "2026-10-29T04:30:00.000Z"
    }
  ]
}
```
- **Errors:** `400 VALIDATION_ERROR`.

#### POST `/visitors`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `flatId` | string | yes | flat in this society, else `404 NOT_FOUND` |
| `type` | VisitorType | yes | |
| `name` | string | yes | 1–80 chars |
| `phone` | string | no | `^[0-9]{10,15}$` |
| `company` | string | no | max 80 |
| `vehicleNo` | string | no | max 20, stored uppercase |
| `purpose` | string | no | max 200 |
| `photoUrl` | string | no | valid http(s) URL, max 500 |

- **201:** `Visitor` with `status: "PENDING_APPROVAL"`, `loggedBy` = caller, and `expiresAt` = createdAt + 10 min.
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`.
- **Side effects:** SSE `visitor.requested` to the flat's ACTIVE residents. Notification `VISITOR_REQUESTED` to each of those residents.
- A flat with no residents still creates the visitor. It will expire unless the guard sees it handled another way. v1 has no admin override.

#### POST `/visitors/:id/decision`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT of the visitor's flat. Other residents get `404`. Admins and guards get `403`.
- **Body:** `decision`: `"APPROVE" | "DENY" | "LEAVE_AT_GATE"`, required.
- **Behavior:** applies the transition and sets `decidedBy` = caller and `decidedAt` = now.
- **200:** `Visitor`
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`, `422 INVALID_TRANSITION`. This includes a visitor that is already decided (first decision wins when several residents respond), an expired visitor, and `LEAVE_AT_GATE` on a non-DELIVERY visitor.
- **Side effects:** SSE `visitor.updated` to the flat's residents and all guards.

#### POST `/visitors/:id/check-in`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD
- **Body:** none (send `{}` or no body).
- **Behavior:** `APPROVED` to `CHECKED_IN`, sets `checkInAt` = now.
- **200:** `Visitor`
- **Errors:** `403`, `404`, `422 INVALID_TRANSITION`.
- **Side effects:** SSE `visitor.updated` (flat residents + guards).

#### POST `/visitors/:id/check-out`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD
- **Behavior:** `CHECKED_IN` to `CHECKED_OUT`, sets `checkOutAt` = now.
- **200:** `Visitor` · **Errors:** `403`, `404`, `422 INVALID_TRANSITION` · **Side effects:** SSE `visitor.updated`.

#### POST `/visitors/:id/collect`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD, or RESIDENT of the visitor's flat (other residents get `404`). ADMIN gets `403`.
- **Behavior:** `LEFT_AT_GATE` to `COLLECTED`. `checkOutAt` is set to now as the collection time.
- **200:** `Visitor` · **Errors:** `403`, `404`, `422 INVALID_TRANSITION` · **Side effects:** SSE `visitor.updated`.

### 4.5 Gate

#### POST `/gate/verify`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD
- **Body:** `passcode`: string, required, `^[0-9]{6}$`.
- **Resolution order:**
  1. **Pre-approval:** a PreApproval in this society with this passcode and `status = ACTIVE`.
     - If one is found and `validFrom <= now <= validTo` and `usedCount < maxUses`, the server, in one transaction:
       - creates a Visitor with `type` = preApproval.type, `name` = guestName, `phone` = guestPhone, `preApprovalId`, `status` = `CHECKED_IN`, `loggedBy` = caller, `decidedBy` = preApproval.createdBy, `decidedAt` = `checkInAt` = now;
       - increments `usedCount`, and sets `status = USED` once `usedCount == maxUses`.
     - If one is found but `now < validFrom`, the response is `404 PASSCODE_INVALID` with `details.reason = "NOT_YET_VALID"`.
     - If one is found but `now > validTo`, the server marks it `EXPIRED` and returns `404 PASSCODE_INVALID` with `details.reason = "EXPIRED"`.
  2. **Staff:** if no ACTIVE pre-approval matches, look for Staff in this society with this passcode and `isActive = true`.
     - If the staff member has an open attendance row (`checkOutAt = null`), set `checkOutAt = now` (action `CHECK_OUT`).
     - Otherwise create an attendance row with `checkInAt = now` and `loggedBy` = caller (action `CHECK_IN`).
  3. If nothing matches, return `404 PASSCODE_INVALID` with `details.reason = "NOT_FOUND"`. This also covers USED, CANCELLED and EXPIRED pre-approvals and inactive staff.
- **Passcode uniqueness:** the server generates pre-approval passcodes that do not collide with any ACTIVE pre-approval or any Staff passcode in the society. It generates staff passcodes that do not collide with any Staff passcode or ACTIVE pre-approval. Collisions therefore cannot happen, and the resolution order is only a safeguard.
- **200 (visitor)**
```json
{ "kind": "VISITOR", "visitor": { "id": "clx9v00000000visitor0002", "type": "GUEST", "name": "Kavya Shah", "status": "CHECKED_IN", "preApprovalId": "clx9p0000000preapproval01", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" }, "...": "full Visitor" } }
```
- **200 (staff)**
```json
{
  "kind": "STAFF",
  "action": "CHECK_IN",
  "staff": { "id": "clx9t000000000staff00001", "name": "Lakshmi Devi", "phone": null, "category": "MAID", "passcode": null, "photoUrl": null, "isActive": true, "flats": [ { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" } ], "isInside": true, "createdAt": "2026-10-01T05:00:00.000Z" },
  "attendance": { "id": "clx9a00000000attend00001", "staff": { "id": "clx9t000000000staff00001", "name": "Lakshmi Devi", "category": "MAID" }, "checkInAt": "2026-10-29T02:30:00.000Z", "checkOutAt": null, "loggedBy": { "id": "clx9m0000000003sureshEH0", "name": "Suresh Kumar" } }
}
```
`staff.isInside` reflects the state **after** the action (`true` after CHECK_IN, `false` after CHECK_OUT).
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 PASSCODE_INVALID`.
- **Side effects:**
  - VISITOR: SSE `visitor.updated` (flat residents + guards). Notification `VISITOR_ARRIVED` to the flat's residents.
  - STAFF: Notification `STAFF_ENTRY` or `STAFF_EXIT` to the residents of every linked flat.

### 4.6 Pre-approvals

PreApproval status machine:
- `ACTIVE` to `USED`: `usedCount` reaches `maxUses`.
- `ACTIVE` to `CANCELLED`: DELETE.
- `ACTIVE` to `EXPIRED`: `validTo` has passed. The status is updated lazily when the pre-approval is listed or verified.
- All other statuses are terminal.

#### GET `/preapprovals`
- **Auth:** Bearer · **Society:** yes
- **Roles:** RESIDENT sees their own flat. ADMIN sees all. GUARD sees ACTIVE pre-approvals valid today (the "Expected" list) with `passcode` omitted (`null`) — guards still admit via `/gate/verify`.
- **Query:** `status?` (PreApprovalStatus), `limit?`.
- **200:** `{ "items": PreApproval[] }`, newest first.

#### POST `/preapprovals`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT. The flat is always the caller's flat.
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `type` | VisitorType | no | default `GUEST` |
| `guestName` | string | yes | 1–80 chars |
| `guestPhone` | string | no | `^[0-9]{10,15}$` |
| `validFrom` | ISODateTime | no | default now. May be in the past by at most 5 min |
| `validTo` | ISODateTime | no | default `validFrom + 24h`. Must be > `validFrom` and ≤ `validFrom + 30 days` |
| `maxUses` | integer | no | 1–10, default 1 |

- **201:** `PreApproval` with a server-generated `passcode` and `status: "ACTIVE"`.
```json
{ "id": "clx9p0000000preapproval01", "type": "GUEST", "guestName": "Kavya Shah", "guestPhone": "9811122233", "passcode": "135790", "validFrom": "2026-10-29T04:30:00.000Z", "validTo": "2026-10-30T04:30:00.000Z", "maxUses": 1, "usedCount": 0, "status": "ACTIVE", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" }, "createdBy": { "id": "clx9m0000000002rohanEH00", "name": "Rohan Mehta" }, "createdAt": "2026-10-29T04:30:00.000Z" }
```
- **Errors:** `400 VALIDATION_ERROR`, `403 FORBIDDEN`.

#### DELETE `/preapprovals/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT of the pre-approval's flat. Others get `404`.
- **Behavior:** a soft cancel. `ACTIVE` changes to `CANCELLED`.
- **200:** `PreApproval` (status `CANCELLED`).
- **Errors:** `403`, `404`, `422 INVALID_TRANSITION` (not ACTIVE).

### 4.7 Staff (daily help)

#### GET `/staff`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member. `passcode` is returned only to ADMIN.
- **Query:** `flatId?` (staff linked to that flat), `category?`, `isActive?` (`"true"|"false"`; default: ADMIN sees all, others see active only).
- **Reference list.** Returns all matching rows sorted by name ascending.
- **200:** `{ "items": Staff[] }`

#### POST `/staff`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `name` | string | yes | 1–80 chars |
| `phone` | string | no | `^[0-9]{10,15}$` |
| `category` | StaffCategory | yes | |
| `photoUrl` | string | no | http(s) URL, max 500 |
| `flatIds` | string[] | no | 0–50 flats in this society, else `404 NOT_FOUND` |

- **Behavior:** the server generates a unique 6-digit `passcode` (see 4.5) and sets `isActive` = true.
- **201:** `Staff`, with `passcode` included because the caller is ADMIN.
- **Errors:** `400`, `403`, `404`.

#### PATCH `/staff/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body** (at least one): `name?` (1–80), `phone?` (string|null), `category?`, `photoUrl?` (string|null), `isActive?` (boolean).
- Deactivating staff who are inside does not auto-check them out. Their passcode stops working at the gate.
- **200:** `Staff` · **Errors:** `400`, `403`, `404`.

#### POST `/staff/:id/flats`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN (any flat), or RESIDENT (`flatId` must equal the caller's flat, else `403 FORBIDDEN`). GUARD gets `403`.
- **Body:** `flatId`: string, required.
- **Behavior:** idempotent. Linking a flat that is already linked returns 200 with no change.
- **200:** `Staff`
- **Errors:** `400`, `403`, `404` (staff or flat).
- Unlinking is not in v1.

#### GET `/staff/:id/attendance`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member.
- **Query:** `date?` (IST day of `checkInAt`), `limit?`.
- **200:** `{ "items": StaffAttendance[] }`, sorted by `checkInAt` descending.
- **Errors:** `404`.

### 4.8 Notices

#### GET `/notices`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member
- **Query:** `category?`, `limit?`.
- **Order:** `isPinned desc`, then `createdAt desc`.
- **200:** `{ "items": Notice[] }`
```json
{ "items": [ { "id": "clx9n000000000notice0001", "title": "Water supply shutdown", "body": "Water supply will be off on Sunday 10am–2pm for tank cleaning.", "category": "MAINTENANCE", "isPinned": true, "createdBy": { "id": "clx9m0000000001ananyaEH0", "name": "Ananya Rao" }, "createdAt": "2026-10-28T06:00:00.000Z", "updatedAt": "2026-10-28T06:00:00.000Z" } ] }
```

#### POST `/notices`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `title` | string | yes | 1–120 chars |
| `body` | string | yes | 1–5000 chars |
| `category` | NoticeCategory | no | default `GENERAL` |
| `isPinned` | boolean | no | default `false` |

- **201:** `Notice`
- **Errors:** `400`, `403`.
- **Side effects:** SSE `notice.created` to all ACTIVE members. Notification `NOTICE_POSTED` to all ACTIVE members except the author.

#### PATCH `/notices/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body** (at least one): `title?`, `body?`, `category?`, `isPinned?`, with the same constraints as POST.
- **200:** `Notice` · **Errors:** `400`, `403`, `404`. No events.

#### DELETE `/notices/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **204** no body. This is a hard delete. · **Errors:** `403`, `404`.

### 4.9 Polls

#### GET `/polls`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member
- **Query:** `limit?`.
- **200:** `{ "items": Poll[] }`, newest first. Results (vote counts) are always visible.
```json
{ "items": [ { "id": "clx9q000000000poll000001", "question": "Should we install EV chargers in the basement?", "closesAt": "2026-11-15T18:29:59.000Z", "isClosed": false, "options": [ { "id": "clx9o0000000000option001", "text": "Yes", "votes": 12 }, { "id": "clx9o0000000000option002", "text": "No", "votes": 3 } ], "totalVotes": 15, "myVoteOptionId": "clx9o0000000000option001", "createdBy": { "id": "clx9m0000000001ananyaEH0", "name": "Ananya Rao" }, "createdAt": "2026-10-20T06:00:00.000Z" } ] }
```

#### POST `/polls`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `question` | string | yes | 1–200 chars |
| `options` | string[] | yes | 2–10 items, each 1–100 chars, unique (case-insensitive) |
| `closesAt` | ISODateTime | no | must be in the future |

- **201:** `Poll` (all votes 0).
- **Errors:** `400`, `403`.
- **Side effects:** Notification `POLL_CREATED` to all ACTIVE residents.

#### POST `/polls/:id/vote`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT (one vote per membership; votes cannot be changed).
- **Body:** `optionId`: string, required. It must belong to this poll, else `400 VALIDATION_ERROR`.
- **200:** `Poll` (updated counts and `myVoteOptionId`).
- **Errors:** `400`, `403`, `404`, `409 ALREADY_VOTED`, `422 POLL_CLOSED`.

### 4.10 Helpdesk (tickets)

#### Ticket state machine

| From | Allowed to | Who |
|---|---|---|
| `OPEN` | `IN_PROGRESS`, `RESOLVED` | ADMIN |
| `OPEN` | `CLOSED` | ADMIN, or RESIDENT of ticket's flat (withdraw) |
| `IN_PROGRESS` | `OPEN`, `RESOLVED` | ADMIN |
| `IN_PROGRESS` | `CLOSED` | ADMIN, or RESIDENT of ticket's flat |
| `RESOLVED` | `CLOSED` | ADMIN, or RESIDENT of ticket's flat |
| `RESOLVED` | `OPEN` (reopen) | ADMIN, or RESIDENT of ticket's flat |
| `CLOSED` | none (terminal) | |

- Entering `RESOLVED` sets `resolvedAt` = now. Reopening to `OPEN` clears it.
- Setting the same status as the current one is a no-op (200).
- Any other change returns `422 INVALID_TRANSITION`.

#### GET `/tickets`
- **Auth:** Bearer · **Society:** yes
- **Roles:** RESIDENT sees tickets whose `flat` is the caller's flat. ADMIN sees all. GUARD gets `403`.
- **Query:** `status?` (single value or comma-separated), `category?`, `limit?`.
- **200:** `{ "items": Ticket[] }`, newest first, **without** `comments`.

#### POST `/tickets`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT, ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `title` | string | yes | 1–120 chars |
| `description` | string | yes | 1–2000 chars |
| `category` | TicketCategory | yes | |
| `priority` | TicketPriority | no | default `MEDIUM` |
| `flatId` | string | no | ADMIN only (optional; null = common area). For a RESIDENT it is ignored, because the flat is always the caller's |

- **201:** `Ticket` with `status: "OPEN"` and `comments: []`.
- **Errors:** `400`, `403`, `404` (flat).
- **Side effects:** Notification `TICKET_CREATED` to all ACTIVE admins (except the author, if the author is an admin).

#### GET `/tickets/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT (own flat, others get `404`), ADMIN.
- **200:** `Ticket` **including** `comments` (oldest first).
```json
{ "id": "clx9k000000000ticket0001", "title": "Kitchen sink leaking", "description": "Water leaking under the sink since morning.", "category": "PLUMBING", "priority": "HIGH", "status": "IN_PROGRESS", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" }, "raisedBy": { "id": "clx9m0000000002rohanEH00", "name": "Rohan Mehta" }, "assignedTo": { "id": "clx9m0000000001ananyaEH0", "name": "Ananya Rao" }, "resolvedAt": null, "commentCount": 1, "comments": [ { "id": "clx9c0000000000comment01", "body": "Plumber scheduled for 4pm.", "author": { "id": "clx9m0000000001ananyaEH0", "name": "Ananya Rao", "role": "ADMIN" }, "createdAt": "2026-10-29T05:00:00.000Z" } ], "createdAt": "2026-10-29T04:00:00.000Z", "updatedAt": "2026-10-29T05:00:00.000Z" }
```

#### PATCH `/tickets/:id`
- **Auth:** Bearer · **Society:** yes
- **Body (ADMIN)**, at least one field:

| Field | Type | Constraints |
|---|---|---|
| `status` | TicketStatus | per state machine |
| `priority` | TicketPriority | |
| `category` | TicketCategory | |
| `assignedToId` | string \| null | ACTIVE ADMIN or GUARD membership in this society (else `404 NOT_FOUND`); `null` unassigns |

- **Body (RESIDENT of ticket's flat):** only `status`, limited to `CLOSED` or reopening `RESOLVED` to `OPEN`. Any other field returns `403 FORBIDDEN`.
- **200:** `Ticket` (with `comments`).
- **Errors:** `400`, `403`, `404`, `422 INVALID_TRANSITION`.
- **Side effects:** on a status change, Notification `TICKET_UPDATED` to the raiser (if the raiser is not the caller). On assignment, Notification `TICKET_UPDATED` to the new assignee.

#### POST `/tickets/:id/comments`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT (own flat, others get `404`), ADMIN.
- **Body:** `body`: string, required, 1–2000 chars. Comments are allowed in any status.
- **201:** `TicketComment`
- **Errors:** `400`, `403`, `404`.
- **Side effects:** Notification `TICKET_COMMENT`:
  - If the author is not the raiser, it goes to the raiser.
  - If the author is the raiser, it goes to the assignee, or to all ACTIVE admins if the ticket is unassigned.

### 4.11 Amenities

#### GET `/amenities`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member. ADMIN sees active and inactive amenities. Others see `isActive = true` only.
- **Reference list.** Returns all matching rows sorted by name ascending.
- **200:** `{ "items": Amenity[] }`
```json
{ "items": [ { "id": "clx9e00000000amenity0001", "name": "Clubhouse", "description": "Party hall, seats 60", "openTime": "09:00", "closeTime": "22:00", "slotMinutes": 60, "capacity": 1, "pricePerSlot": 50000, "isActive": true, "createdAt": "2026-10-01T05:00:00.000Z" } ] }
```

#### POST `/amenities`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `name` | string | yes | 1–80 chars, unique per society (else `409 CONFLICT`) |
| `description` | string | no | max 500 |
| `openTime` | string | yes | `^([01][0-9]|2[0-3]):[0-5][0-9]$` |
| `closeTime` | string | yes | same pattern; must be > `openTime` (no overnight hours) |
| `slotMinutes` | integer | yes | 15–480; `closeTime - openTime >= slotMinutes` |
| `capacity` | integer | yes | 1–500 |
| `pricePerSlot` | integer | no | paise, ≥ 0, default 0 |
| `isActive` | boolean | no | default `true` |

- **201:** `Amenity` · **Errors:** `400`, `403`, `409`.

#### PATCH `/amenities/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body:** any subset of the POST fields (at least one). Cross-field rules are checked against the merged result.
- Existing bookings are not changed or cancelled by edits.
- **200:** `Amenity` · **Errors:** `400`, `403`, `404`, `409`.

#### GET `/amenities/:id/availability`
- **Auth:** Bearer · **Society:** yes · **Roles:** any member (non-admins get `404` for inactive amenities)
- **Query:** `date` (required, `YYYY-MM-DD`, IST).
- **Behavior:**
  - Slots start at `openTime` IST on that date and step by `slotMinutes` while `slotStart + slotMinutes <= closeTime`. Times are returned in UTC.
  - `booked` counts CONFIRMED bookings with exactly that `startAt`.
  - Past slots are included. Clients should disable slots where `startAt <= now`.
- **200**
```json
{ "items": [ { "startAt": "2026-10-30T03:30:00.000Z", "endAt": "2026-10-30T04:30:00.000Z", "booked": 0, "capacity": 1, "available": 1 } ] }
```
- **Errors:** `400` (missing or bad date), `404`.

### 4.12 Bookings

#### GET `/bookings`
- **Auth:** Bearer · **Society:** yes
- **Roles:** RESIDENT sees their own flat's bookings. ADMIN sees all. GUARD gets `403`.
- **Query:** `amenityId?`, `date?` (IST day of `startAt`), `status?`, `limit?`.
- **Order:** `startAt desc`.
- **200:** `{ "items": Booking[] }`

#### POST `/bookings`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT, ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `amenityId` | string | yes | amenity in this society |
| `startAt` | ISODateTime | yes | must equal a slot start from availability |
| `flatId` | string | ADMIN: yes | ADMIN books on behalf of a flat. Ignored for RESIDENT (the caller's own flat is used) |

- **Validation order:**
  1. Amenity exists, else `404`. Amenity is active, else `422 AMENITY_INACTIVE`.
  2. `startAt` is a slot boundary within hours on its IST day, else `422 SLOT_INVALID`.
  3. `startAt > now`, else `422 SLOT_IN_PAST`.
  4. The flat has no CONFIRMED booking for the same amenity and `startAt`, else `409 CONFLICT`.
  5. CONFIRMED bookings for the slot are fewer than `capacity`, else `409 SLOT_FULL`.
- Checks 4 and 5 run in a serializable transaction (or with a row lock on the amenity) to prevent overbooking.
- `endAt` = `startAt + slotMinutes`. Payment for `pricePerSlot` is out of scope in v1 (display only).
- **201:** `Booking` with `status: "CONFIRMED"`.
- **Errors:** `400`, `403`, `404`, `409 CONFLICT`, `409 SLOT_FULL`, `422 AMENITY_INACTIVE`, `422 SLOT_INVALID`, `422 SLOT_IN_PAST`.

#### DELETE `/bookings/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT (own flat, others get `404`), ADMIN.
- **Behavior:** soft cancel. `CONFIRMED` changes to `CANCELLED`.
- **200:** `Booking`
- **Errors:** `403`, `404`, `422 INVALID_TRANSITION` (already cancelled), `422 SLOT_IN_PAST` (`startAt <= now`).

### 4.13 Billing

`OVERDUE` is derived. An `UNPAID` invoice whose `dueDate` is earlier than today (IST) is returned and persisted as `OVERDUE`. The server updates it lazily on reads, and the `period`/`status` filters see the updated value.

#### GET `/invoices`
- **Auth:** Bearer · **Society:** yes
- **Roles:** RESIDENT sees their own flat. ADMIN sees all. GUARD gets `403`.
- **Query:** `status?` (InvoiceStatus), `period?` (`YYYY-MM`), `flatId?` (ADMIN only), `limit?`.
- **Order:** `period desc`, then flat label ascending.
- **200:** `{ "items": Invoice[] }`
```json
{ "items": [ { "id": "clx9i000000000invoice001", "period": "2026-10", "amount": 350000, "dueDate": "2026-10-10", "status": "PAID", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" }, "payments": [ { "id": "clx9y000000000payment001", "invoiceId": "clx9i000000000invoice001", "amount": 350000, "method": "UPI", "reference": "MOCK-UPI-7F3K9Q2L", "paidBy": { "id": "clx9m0000000002rohanEH00", "name": "Rohan Mehta" }, "paidAt": "2026-10-05T07:12:00.000Z" } ], "createdAt": "2026-10-01T05:00:00.000Z" } ] }
```

#### POST `/invoices/generate`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `period` | string | yes | `^[0-9]{4}-(0[1-9]|1[0-2])$` |
| `amount` | integer | yes | paise, 1 – 100,000,000 |
| `dueDate` | string | yes | `YYYY-MM-DD`, valid date |

- **Behavior:** creates one `UNPAID` invoice for **every flat** in the society that does not yet have one for `period`. Flats that already have one are skipped. The operation is idempotent per period.
- **201**
```json
{ "created": 8, "skipped": 0 }
```
- **Errors:** `400`, `403`.
- **Side effects:** Notification `INVOICE_GENERATED` to the ACTIVE residents of each flat that got an invoice.

#### POST `/invoices/:id/pay`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT of the invoice's flat (others get `404`), ADMIN (records an offline payment).
- **Body:** `method`: PaymentMethod, required. `CASH` is allowed for ADMIN only (a RESIDENT gets `403 FORBIDDEN`).
- **Behavior:** this is a mock gateway and always succeeds. In one transaction it:
  - creates a Payment with `amount` = invoice amount (full payment only), `reference = "MOCK-<METHOD>-<8 random A-Z0-9>"`, `paidBy` = caller and `paidAt` = now;
  - sets the invoice to `PAID`.
- `UNPAID` and `OVERDUE` invoices are both payable.
- **200:** `Invoice` (status `PAID`, with `payments`).
- **Errors:** `400`, `403`, `404`, `409 ALREADY_PAID`.
- **Side effects:** Notification `PAYMENT_RECEIVED` to the flat's ACTIVE residents (receipt) and to all ACTIVE admins, excluding the payer.

#### GET `/expenses`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Query:** `category?`, `month?` (`YYYY-MM`, filters `spentOn`), `limit?`.
- **Order:** `spentOn desc`, then `createdAt desc`.
- **200:** `{ "items": Expense[] }`

#### POST `/expenses`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `category` | ExpenseCategory | yes | |
| `amount` | integer | yes | paise, 1 – 100,000,000 |
| `vendor` | string | no | max 120 |
| `note` | string | no | max 500 |
| `spentOn` | string | yes | `YYYY-MM-DD`, not in the future (IST) |

- **201:** `Expense` · **Errors:** `400`, `403`.

#### GET `/reports/summary`
- **Auth:** Bearer · **Society:** yes · **Roles:** ADMIN
- **200:** `ReportSummary` (field definitions in section 3).
```json
{
  "visitorsToday": 14,
  "pendingApprovals": 2,
  "insideNow": 3,
  "openTickets": 4,
  "collectionRate": 63,
  "totalDue": 1050000,
  "totalCollected": 1750000,
  "expensesThisMonth": 4280000,
  "residents": 2,
  "flats": 8,
  "recentVisitors": [ /* up to 5 Visitor */ ],
  "sosActive": 0
}
```

### 4.14 SOS

State machine: `RAISED` can go to `ACKNOWLEDGED` or `RESOLVED`. `ACKNOWLEDGED` can go to `RESOLVED`. `RESOLVED` is terminal. Anything else returns `422 INVALID_TRANSITION`.

#### GET `/sos`
- **Auth:** Bearer · **Society:** yes
- **Roles:** GUARD and ADMIN see all. RESIDENT sees only alerts they raised.
- **Query:** `status?` (single value or comma-separated, e.g. `RAISED,ACKNOWLEDGED`), `limit?`.
- **200:** `{ "items": SosAlert[] }`, newest first.

#### POST `/sos`
- **Auth:** Bearer · **Society:** yes · **Roles:** RESIDENT. `flat` is the caller's flat.
- **Body**

| Field | Type | Req | Constraints |
|---|---|---|---|
| `type` | SosType | yes | |
| `message` | string | no | max 300 |

- **201:** `SosAlert` with `status: "RAISED"`.
```json
{ "id": "clx9z000000000sosalert01", "type": "MEDICAL", "message": "Elderly parent fainted", "status": "RAISED", "flat": { "id": "clx9f0000000000a101000000", "number": "101", "blockName": "A", "label": "A-101" }, "raisedBy": { "id": "clx9m0000000002rohanEH00", "name": "Rohan Mehta", "phone": "9000000002" }, "acknowledgedBy": null, "acknowledgedAt": null, "resolvedAt": null, "createdAt": "2026-10-29T04:30:00.000Z" }
```
- **Errors:** `400`, `403`. Duplicate active alerts are not blocked, because emergencies must never be rejected.
- **Side effects:** SSE `sos.raised` to all ACTIVE guards and admins, and to the raiser. Notification `SOS_RAISED` to all ACTIVE guards and admins.

#### PATCH `/sos/:id`
- **Auth:** Bearer · **Society:** yes · **Roles:** GUARD, ADMIN
- **Body:** `status`: `"ACKNOWLEDGED" | "RESOLVED"`, required.
- **Behavior:**
  - `ACKNOWLEDGED` sets `acknowledgedBy` = caller and `acknowledgedAt` = now.
  - `RESOLVED` sets `resolvedAt` = now. If the alert goes straight from RAISED to RESOLVED, it also sets `acknowledgedBy` and `acknowledgedAt` = caller and now.
- **200:** `SosAlert`
- **Errors:** `400`, `403`, `404`, `422 INVALID_TRANSITION`.
- **Side effects:** SSE `sos.updated` to guards, admins and the raiser. Notification `SOS_UPDATED` to the raiser.

### 4.15 Notifications (user-scoped, no `X-Society-Id`)

#### GET `/notifications`
- **Auth:** Bearer · **Society:** no
- Returns the caller's notifications across all societies.
- **Query:** `unread?` (`"true"` = only `readAt = null`), `limit?`.
- **200:** `{ "items": Notification[], "unreadCount": number }`, newest first. `unreadCount` is the total unread count, independent of `limit` and `unread`.
```json
{ "items": [ { "id": "clx9w00000000notif000001", "type": "VISITOR_REQUESTED", "title": "Visitor at the gate", "body": "Arjun (QuickKart) is waiting at the gate for A-101.", "data": { "societyId": "clx9s00000000emeraldhts0", "visitorId": "clx9v00000000visitor0001" }, "societyId": "clx9s00000000emeraldhts0", "readAt": null, "createdAt": "2026-10-29T04:30:00.000Z" } ], "unreadCount": 1 }
```

#### POST `/notifications/:id/read`
- **Auth:** Bearer · **Society:** no
- Idempotent. If the notification is already read, `readAt` is unchanged.
- **200:** `Notification` · **Errors:** `404` (not the caller's).

#### POST `/notifications/read-all`
- **Auth:** Bearer · **Society:** no
- **200:** `{ "updated": 3 }` (number of rows newly marked read).

### 4.16 Health

#### GET `/health` (also `/api/v1/health`)
- **Auth:** public
- **200:** `{ "status": "ok", "time": "2026-10-29T04:30:00.000Z" }`

---

## 5. Realtime (SSE)

### 5.1 Connection
```
GET /api/v1/events?token=<jwt>&societyId=<societyId>
Accept: text/event-stream
```
- The server validates the token and checks for an ACTIVE membership in `societyId` **before** opening the stream. If either check fails, it replies with normal JSON errors:
  - `400 VALIDATION_ERROR` if a param is missing;
  - `401 UNAUTHORIZED` if the token is bad;
  - `403 FORBIDDEN` if there is no membership.
- On success the server sends `200` with these headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.
- On connect it sends `retry: 5000` followed by the comment `: connected`.
- **Heartbeat:** the comment line `: ping` every **25 s**.
- **No replay:** there are no `id:` fields and `Last-Event-ID` is not supported. Clients refetch the relevant lists when they reconnect.
- Each message is `event: <name>\ndata: <single-line JSON>\n\n`. `data` is the **bare object** shown below, not wrapped.
- One stream per (user, active society). When the user switches society, the client closes the stream and opens a new one.
- If the membership becomes INACTIVE, the server closes the stream on the next event or heartbeat.

```
retry: 5000
: connected

event: visitor.requested
data: {"id":"clx9v00000000visitor0001","type":"DELIVERY","name":"Arjun","status":"PENDING_APPROVAL", ...}

: ping
```

### 5.2 Events

| Event | `data` | Emitted when | Recipients (ACTIVE memberships of the stream's society) |
|---|---|---|---|
| `visitor.requested` | `Visitor` | POST `/visitors` | RESIDENT members of that visitor's flat |
| `visitor.updated` | `Visitor` | Any visitor status change: decision, check-in, check-out, collect, expiry sweeper, gate pre-approval entry | RESIDENT members of that flat **and** all GUARD members |
| `sos.raised` | `SosAlert` | POST `/sos` | All GUARD and ADMIN members **and** the raiser |
| `sos.updated` | `SosAlert` | PATCH `/sos/:id` | All GUARD and ADMIN members **and** the raiser |
| `notice.created` | `Notice` | POST `/notices` | All members |
| `notification` | `Notification` | Any Notification row is created | The target user. Delivered on **every** open stream of that user, regardless of the stream's `societyId` |

Implementation: services publish to the in-process event bus (`EventEmitter`). The SSE hub keeps a registry of `{ userId, membershipId, societyId, role, flatId, res }` and fans each event out to the matching connections.

### 5.3 Notification types

| `type` | Recipients | Trigger | `data` |
|---|---|---|---|
| `MEMBERSHIP_ADDED` | added user | POST `/members` | `{ societyId, membershipId }` |
| `VISITOR_REQUESTED` | flat residents | POST `/visitors` | `{ societyId, visitorId }` |
| `VISITOR_ARRIVED` | flat residents | `/gate/verify` pre-approval entry | `{ societyId, visitorId, preApprovalId }` |
| `STAFF_ENTRY` / `STAFF_EXIT` | residents of linked flats | `/gate/verify` staff | `{ societyId, staffId, attendanceId }` |
| `NOTICE_POSTED` | all members except author | POST `/notices` | `{ societyId, noticeId }` |
| `POLL_CREATED` | all residents | POST `/polls` | `{ societyId, pollId }` |
| `TICKET_CREATED` | admins (except author) | POST `/tickets` | `{ societyId, ticketId }` |
| `TICKET_UPDATED` | raiser / new assignee | PATCH `/tickets/:id` | `{ societyId, ticketId, status }` |
| `TICKET_COMMENT` | see 4.10 | POST `/tickets/:id/comments` | `{ societyId, ticketId, commentId }` |
| `INVOICE_GENERATED` | residents of invoiced flats | POST `/invoices/generate` | `{ societyId, invoiceId, period }` |
| `PAYMENT_RECEIVED` | flat residents + admins (excluding payer) | POST `/invoices/:id/pay` | `{ societyId, invoiceId, paymentId }` |
| `SOS_RAISED` | guards + admins | POST `/sos` | `{ societyId, sosId, type }` |
| `SOS_UPDATED` | raiser | PATCH `/sos/:id` | `{ societyId, sosId, status }` |

`title` and `body` are human-readable English strings generated by the server. Clients may display them verbatim.

---

## 6. Seed / demo accounts

Society **Emerald Heights**, Bengaluru (Karnataka). Blocks `A`, `B`. Flats `A-101`…`A-104` and `B-201`…`B-204`.

| Role | Phone | Name | Flat |
|---|---|---|---|
| ADMIN | 9000000001 | Ananya Rao | none |
| RESIDENT | 9000000002 | Rohan Mehta | A-101 |
| RESIDENT | 9000000004 | Priya Iyer | B-201 |
| GUARD | 9000000003 | Suresh Kumar | none |

| Demo fixture | Passcode | Notes |
|---|---|---|
| Staff (MAID), linked to A-101 | `482913` | Guard verifies it to toggle CHECK_IN / CHECK_OUT |
| Pre-approval (GUEST) for A-101, created by Rohan Mehta | `135790` | Seeded ACTIVE with a long validity window (e.g. 30 days) and `maxUses` 10, so the demo can be repeated |

Also seeded: notices, one open poll, tickets, amenities (Clubhouse, Tennis Court, Swimming Pool), current-month invoices for all 8 flats, and expenses.

Login in dev:
1. `POST /auth/otp/request {"phone":"9000000003"}` returns `devCode`.
2. `POST /auth/otp/verify {"phone":"9000000003","code":"<devCode>"}` returns the token.
3. Send `X-Society-Id: <memberships[0].society.id>` on society-scoped calls.
