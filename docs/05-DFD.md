# 05 — Data Flow Diagrams (DFD)

> Conforms to `00-PROJECT-BRIEF.md`. Entities and field names match brief §6; endpoints match brief §7.
> Notation: Yourdon/DeMarco, drawn with Mermaid flowcharts.

## 0. Notation

| Symbol | Mermaid shape | Meaning |
|---|---|---|
| External entity | rectangle `E["Resident"]` | Person or system outside Gatekeeper that sends/receives data |
| Process | circle `P(("3.0 Gate"))` | Transforms data. Numbered hierarchically (3.0 → 3.1, 3.2 …) |
| Data store | cylinder `D[("D5 Visitors")]` | Data at rest (PostgreSQL table group, or in-memory registry `M1`) |
| Data flow | labelled arrow | Named packet of data; composition in §6 dictionary |

Rules followed: every process has at least one input and one output; data stores are only touched by processes
(never directly by external entities); flows between external entities are not modelled (the guard relaying a
visitor's spoken passcode is modelled as Visitor → 3.0, because the data enters the system through the guard's device).

---

## 1. Level 0 — Context diagram

```mermaid
flowchart LR
  RES["Resident"]
  GRD["Guard"]
  ADM["Society Admin"]
  VIS["Visitor"]
  STF["Staff / Daily help"]
  PAY["Payment Gateway (mock)"]
  PRO["Prospect"]

  SYS(("0<br/>Gatekeeper<br/>System"))

  PRO -->|"page requests, phone + OTP, new society details"| SYS
  SYS -->|"marketing content, auth token, admin membership"| PRO

  RES -->|"phone + OTP, visitor decisions, pre-approvals, tickets, bookings, votes, SOS, payment requests"| SYS
  SYS -->|"approval requests, passcodes, notices, polls, invoices, receipts, booking confirmations, notifications"| RES

  GRD -->|"walk-in details, check-in / check-out, gate passcodes, SOS acknowledgements"| SYS
  SYS -->|"approval outcomes, passcode verification result, SOS alerts, flat resident list"| GRD

  ADM -->|"society structure, members, notices, polls, amenity definitions, invoice runs, expenses, ticket updates"| SYS
  SYS -->|"dashboard KPIs, member lists, tickets, SOS alerts, visitor log"| ADM

  VIS -->|"identity details, pre-approval passcode (via guard device)"| SYS
  SYS -->|"entry decision (via guard device)"| VIS

  STF -->|"staff passcode (via guard device)"| SYS
  SYS -->|"entry or exit recorded (via guard device)"| STF

  SYS -->|"charge request: amount, method"| PAY
  PAY -->|"payment result: reference, status"| SYS
```

Notes
- **Prospect** consumes the static marketing site. A prospect becomes an Admin by logging in with OTP and calling
  `POST /societies` (caller becomes `ADMIN`). There is no lead-capture API in v1; `/contact` is static content.
- **Payment Gateway (mock)** is an in-process function in v1 (ADR-006 in `06-HLD.md`); it is drawn as an external
  entity because a real gateway will replace it behind the same flow.
- **SMS provider** is out of scope v1 — OTPs reach the user via `devCode` in non-production only.

---

## 2. Data stores

| ID | Store | Prisma models (tables) | Written by | Read by |
|---|---|---|---|---|
| D1 | Users | `User` | 1.0, 2.0 | 1.0, 2.0, 10.0 |
| D2 | OTP Codes | `OtpCode` | 1.0 | 1.0 |
| D3 | Society Structure | `Society`, `Block`, `Flat` | 2.0 | all processes |
| D4 | Memberships | `Membership` | 2.0 | 1.0 (tenancy), 3.0, 6.0, 10.0 |
| D5 | Visitors | `Visitor` | 3.0 | 3.0, 8.0 (KPIs) |
| D6 | Pre-approvals | `PreApproval` | 3.0 | 3.0 |
| D7 | Staff | `Staff`, `StaffFlat` | 4.0 | 3.0 (gate verify), 4.0 |
| D8 | Staff Attendance | `StaffAttendance` | 4.0 | 4.0 |
| D9 | Notices | `Notice` | 5.0 | 5.0 |
| D10 | Polls | `Poll`, `PollOption`, `PollVote` | 5.0 | 5.0 |
| D11 | Tickets | `Ticket`, `TicketComment` | 6.0 | 6.0, 8.0 (KPIs) |
| D12 | Amenities | `Amenity` | 7.0 | 7.0 |
| D13 | Amenity Bookings | `AmenityBooking` | 7.0 | 7.0 |
| D14 | Invoices | `Invoice` | 8.0 | 8.0 |
| D15 | Payments | `Payment` | 8.0 | 8.0 |
| D16 | Expenses | `Expense` | 8.0 | 8.0 |
| D17 | SOS Alerts | `SosAlert` | 9.0 | 9.0, 8.0 (KPIs) |
| D18 | Notifications | `Notification` | 10.0 | 10.0 |
| M1 | SSE Client Registry | in-memory `Map<societyId, Set<Client>>` (not persisted) | 10.0 | 10.0 |

### Process × store CRUD matrix

C = create, R = read, U = update, D = delete.

| Process | D1 | D2 | D3 | D4 | D5 | D6 | D7 | D8 | D9 | D10 | D11 | D12 | D13 | D14 | D15 | D16 | D17 | D18 | M1 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1.0 Authenticate | CRU | CRU | R | R | | | | | | | | | | | | | | | |
| 2.0 Society & Members | CR | | CR | CRU | | | | | | | | | | | | | | | |
| 3.0 Gate & Visitor | | | R | R | CRU | CRU | R | | | | | | | | | | | | |
| 4.0 Staff Attendance | | | R | | | | CRU | CRU | | | | | | | | | | | |
| 5.0 Community | | | | R | | | | | CRUD | CR | | | | | | | | | |
| 6.0 Helpdesk | | | R | R | | | | | | | CRU | | | | | | | | |
| 7.0 Amenity Booking | | | R | | | | | | | | | CRU | CRU | | | | | | |
| 8.0 Billing & Accounts | | | R | | R | | | | | | R | | | CRU | CR | CR | R | | |
| 9.0 Emergency SOS | | | R | | | | | | | | | | | | | | CRU | | |
| 10.0 Notify | R | | | R | | | | | | | | | | | | | | CRU | CRUD |

---

## 3. Level 1 — System decomposition

Level 1 is split into two diagrams for legibility. Both show the same process 10.0 and the same stores; together they
form the complete Level 1.

### 3.1 Level 1a — Identity, gate, safety

```mermaid
flowchart LR
  USR["Any user<br/>(Resident / Guard / Admin / Prospect)"]
  RES["Resident"]
  GRD["Guard"]
  ADM["Society Admin"]
  VIS["Visitor"]
  STF["Staff / Daily help"]

  P1(("1.0<br/>Authenticate"))
  P2(("2.0<br/>Manage Society<br/>and Members"))
  P3(("3.0<br/>Gate and Visitor<br/>Management"))
  P4(("4.0<br/>Staff<br/>Attendance"))
  P9(("9.0<br/>Emergency<br/>SOS"))
  P10(("10.0<br/>Notify<br/>(event bus + SSE)"))

  D1[("D1 Users")]
  D2[("D2 OTP Codes")]
  D3[("D3 Society Structure")]
  D4[("D4 Memberships")]
  D5[("D5 Visitors")]
  D6[("D6 Pre-approvals")]
  D7[("D7 Staff")]
  D8[("D8 Staff Attendance")]
  D17[("D17 SOS Alerts")]
  D18[("D18 Notifications")]
  M1[("M1 SSE Client Registry")]

  USR -->|"otp-request, otp-verify"| P1
  P1 -->|"token-bundle"| USR
  P1 <-->|"otp-record"| D2
  P1 <-->|"user-record"| D1
  D4 -->|"memberships"| P1
  P1 -->|"member-context"| P2
  P1 -->|"member-context"| P3

  ADM -->|"society-details, block, flat-batch, member-details"| P2
  USR -->|"society-details"| P2
  P2 -->|"society-structure, member-list"| ADM
  P2 <-->|"society, blocks, flats"| D3
  P2 <-->|"membership-record"| D4
  P2 -->|"user-record (new by phone)"| D1

  GRD -->|"walk-in, gate-action, gate-passcode"| P3
  P3 -->|"visitor-status, verify-result"| GRD
  VIS -->|"visitor-identity, gate-passcode"| P3
  RES -->|"visitor-decision, preapproval-request"| P3
  P3 -->|"passcode-slip, visitor-log"| RES
  P3 <-->|"visitor-record"| D5
  P3 <-->|"preapproval-record"| D6
  D3 -->|"flat"| P3
  P3 -->|"unmatched passcode"| P4
  P3 -->|"visitor-event"| P10

  STF -->|"gate-passcode"| P4
  ADM -->|"staff-profile, staff-flat-link"| P4
  RES -->|"staff-flat-link"| P4
  P4 -->|"attendance-history"| RES
  P4 -->|"attendance-result"| GRD
  P4 <-->|"staff-record"| D7
  P4 <-->|"attendance-record"| D8

  RES -->|"sos-request"| P9
  GRD -->|"sos-status-change"| P9
  ADM -->|"sos-status-change"| P9
  P9 <-->|"sos-record"| D17
  P9 -->|"sos-event"| P10

  D4 -->|"recipient memberships"| P10
  P10 <-->|"notification-record"| D18
  P10 <-->|"sse-client"| M1
  P10 -->|"sse-frame"| RES
  P10 -->|"sse-frame"| GRD
  P10 -->|"sse-frame"| ADM
  RES -->|"read-receipt"| P10
```

### 3.2 Level 1b — Community, helpdesk, amenities, finance

```mermaid
flowchart LR
  RES["Resident"]
  ADM["Society Admin"]
  PAY["Payment Gateway (mock)"]

  P5(("5.0<br/>Community<br/>Notices and Polls"))
  P6(("6.0<br/>Helpdesk"))
  P7(("7.0<br/>Amenity<br/>Booking"))
  P8(("8.0<br/>Billing and<br/>Accounts"))
  P10(("10.0<br/>Notify<br/>(event bus + SSE)"))

  D3[("D3 Society Structure")]
  D4[("D4 Memberships")]
  D5[("D5 Visitors")]
  D9[("D9 Notices")]
  D10[("D10 Polls")]
  D11[("D11 Tickets")]
  D12[("D12 Amenities")]
  D13[("D13 Amenity Bookings")]
  D14[("D14 Invoices")]
  D15[("D15 Payments")]
  D16[("D16 Expenses")]
  D17[("D17 SOS Alerts")]
  D18[("D18 Notifications")]

  ADM -->|"notice, poll-definition"| P5
  RES -->|"poll-vote"| P5
  P5 -->|"notice-list, poll-results"| RES
  P5 <-->|"notice-record"| D9
  P5 <-->|"poll-record, vote-record"| D10
  P5 -->|"notice-event"| P10

  RES -->|"ticket-request, ticket-comment"| P6
  ADM -->|"ticket-update, ticket-comment"| P6
  P6 -->|"ticket-thread"| RES
  P6 -->|"ticket-queue"| ADM
  P6 <-->|"ticket-record"| D11
  D4 -->|"assignee membership"| P6
  P6 -->|"ticket-event"| P10

  ADM -->|"amenity-definition"| P7
  RES -->|"availability-query, booking-request, booking-cancel"| P7
  P7 -->|"availability, booking-confirmation"| RES
  P7 -->|"booking-list"| ADM
  P7 <-->|"amenity-record"| D12
  P7 <-->|"booking-record"| D13
  P7 -->|"booking-event"| P10

  ADM -->|"invoice-run, expense"| P8
  RES -->|"pay-request"| P8
  P8 -->|"charge-request"| PAY
  PAY -->|"charge-result"| P8
  P8 -->|"invoice-list, receipt"| RES
  P8 -->|"kpi-summary, invoice-list, expense-list"| ADM
  D3 -->|"flats"| P8
  P8 <-->|"invoice-record"| D14
  P8 <-->|"payment-record"| D15
  P8 <-->|"expense-record"| D16
  D5 -->|"visitor counts"| P8
  D11 -->|"ticket counts"| P8
  D17 -->|"sos counts"| P8
  P8 -->|"billing-event"| P10

  D4 -->|"recipient memberships"| P10
  P10 <-->|"notification-record"| D18
  P10 -->|"sse-frame"| RES
  P10 -->|"sse-frame"| ADM
```

### 3.3 Level 1 process descriptions

| # | Process | Purpose | Main endpoints |
|---|---|---|---|
| 1.0 | Authenticate | OTP issue/verify, JWT issue, per-request token check and tenancy resolution (`X-Society-Id` → `req.member`) | `/auth/otp/request`, `/auth/otp/verify`, `/me` |
| 2.0 | Manage Society & Members | Create society (creator → ADMIN), blocks, bulk flats, add/patch memberships | `/societies`, `/society`, `/blocks`, `/flats`, `/members` |
| 3.0 | Gate & Visitor Management | Walk-in logging, resident decision, check-in/out, parcel collection, pre-approvals + passcode verify, expiry | `/visitors/*`, `/gate/verify`, `/preapprovals` |
| 4.0 | Staff Attendance | Staff profiles, flat links, passcode-driven attendance toggle | `/staff/*`, `/gate/verify` (staff branch) |
| 5.0 | Community | Notices (pinned/categorised), polls, one vote per membership | `/notices`, `/polls` |
| 6.0 | Helpdesk | Tickets, assignment, status lifecycle, comments | `/tickets/*` |
| 7.0 | Amenity Booking | Amenity definitions, slot availability, capacity-safe booking | `/amenities/*`, `/bookings` |
| 8.0 | Billing & Accounts | Monthly invoice generation, overdue marking, mock payment, expenses, KPIs | `/invoices/*`, `/expenses`, `/reports/summary` |
| 9.0 | Emergency SOS | Raise, acknowledge, resolve | `/sos` |
| 10.0 | Notify | In-process event bus → persist `Notification` rows + SSE fan-out | `/notifications/*`, `/events` |

---

## 4. Level 2 — Process 3.0 Gate & Visitor Management

Sub-processes:

| # | Sub-process | Trigger |
|---|---|---|
| 3.1 | Log walk-in | Guard `POST /visitors` |
| 3.2 | Dispatch approval request | after 3.1 commits |
| 3.3 | Record resident decision | Resident `POST /visitors/:id/decision` |
| 3.4 | Check in / check out | Guard `POST /visitors/:id/check-in`, `/check-out` |
| 3.5 | Expire stale requests | 60 s sweeper + lazy on read (pending > 10 min) |
| 3.6 | Issue pre-approval | Resident `POST /preapprovals` |
| 3.7 | Verify gate passcode | Guard `POST /gate/verify` |
| 3.8 | Cancel pre-approval | Resident `DELETE /preapprovals/:id` |
| 3.9 | Record parcel collection | Guard or resident `POST /visitors/:id/collect` |

### 4.1 Level 2-A — Walk-in approval

```mermaid
flowchart LR
  GRD["Guard"]
  VIS["Visitor"]
  RES["Resident (of target flat)"]

  P31(("3.1<br/>Log walk-in"))
  P32(("3.2<br/>Dispatch approval<br/>request"))
  P33(("3.3<br/>Record resident<br/>decision"))
  P34(("3.4<br/>Check in /<br/>check out"))
  P35(("3.5<br/>Expire stale<br/>requests"))
  P10(("10.0<br/>Notify"))

  D3[("D3 Society Structure")]
  D5[("D5 Visitors")]

  VIS -->|"visitor-identity"| P31
  GRD -->|"walk-in (flatId, type, name, phone, vehicleNo, purpose)"| P31
  D3 -->|"flat (must belong to society)"| P31
  P31 -->|"visitor-record status=PENDING_APPROVAL"| D5
  P31 -->|"visitor-status"| GRD
  P31 -->|"new visitor"| P32
  P32 -->|"visitor.requested event (target: flat residents)"| P10
  P10 -->|"sse-frame visitor.requested + notification"| RES

  RES -->|"visitor-decision APPROVE or DENY"| P33
  D5 -->|"pending visitor"| P33
  P33 -->|"status, decidedById, decidedAt"| D5
  P33 -->|"visitor.updated event (target: flat + guards)"| P10
  P10 -->|"sse-frame visitor.updated"| GRD

  GRD -->|"gate-action check-in or check-out"| P34
  D5 -->|"APPROVED or CHECKED_IN visitor"| P34
  P34 -->|"status, checkInAt or checkOutAt"| D5
  P34 -->|"visitor.updated event"| P10
  P34 -->|"entry decision"| VIS

  D5 -->|"pending older than 10 min"| P35
  P35 -->|"status=EXPIRED"| D5
  P35 -->|"visitor.updated event"| P10
```

### 4.2 Level 2-B — Pre-approval passcode

```mermaid
flowchart LR
  RES["Resident"]
  VIS["Visitor (invited guest)"]
  GRD["Guard"]

  P36(("3.6<br/>Issue<br/>pre-approval"))
  P37(("3.7<br/>Verify gate<br/>passcode"))
  P38(("3.8<br/>Cancel<br/>pre-approval"))
  P35(("3.5<br/>Expire stale<br/>requests"))
  P4(("4.0<br/>Staff<br/>Attendance"))
  P10(("10.0<br/>Notify"))

  D5[("D5 Visitors")]
  D6[("D6 Pre-approvals")]
  D7[("D7 Staff")]

  RES -->|"preapproval-request (guestName, type, validFrom, validTo, maxUses)"| P36
  D6 -->|"ACTIVE passcodes in society"| P36
  D7 -->|"staff passcodes in society"| P36
  P36 -->|"preapproval-record status=ACTIVE"| D6
  P36 -->|"passcode-slip (6-digit passcode)"| RES
  RES -.->|"shares passcode out of band"| VIS

  VIS -->|"gate-passcode"| P37
  GRD -->|"gate-passcode"| P37
  D6 -->|"matching ACTIVE pre-approval"| P37
  P37 -->|"usedCount+1, status=USED when exhausted"| D6
  P37 -->|"visitor-record status=CHECKED_IN, preApprovalId"| D5
  P37 -->|"verify-result kind=VISITOR"| GRD
  P37 -->|"visitor.updated event (target: flat)"| P10
  P37 -->|"unmatched passcode"| P4
  P4 -->|"verify-result kind=STAFF"| GRD

  RES -->|"cancel request"| P38
  P38 -->|"status=CANCELLED"| D6

  D6 -->|"ACTIVE past validTo"| P35
  P35 -->|"status=EXPIRED"| D6
```

The dotted arrow is outside the system boundary (resident shares the passcode by phone/message) and is shown only for
readability.

### 4.3 Level 2-C — Delivery "leave at gate"

```mermaid
flowchart LR
  GRD["Guard"]
  DLV["Visitor (delivery agent)"]
  RES["Resident"]

  P31(("3.1<br/>Log walk-in<br/>type=DELIVERY"))
  P33(("3.3<br/>Record resident<br/>decision"))
  P39(("3.9<br/>Record parcel<br/>collection"))
  P10(("10.0<br/>Notify"))

  D5[("D5 Visitors")]

  DLV -->|"visitor-identity (name, company)"| P31
  GRD -->|"walk-in type=DELIVERY"| P31
  P31 -->|"visitor-record status=PENDING_APPROVAL"| D5
  P31 -->|"visitor.requested event"| P10
  P10 -->|"sse-frame visitor.requested"| RES

  RES -->|"visitor-decision LEAVE_AT_GATE"| P33
  D5 -->|"pending DELIVERY visitor"| P33
  P33 -->|"status=LEFT_AT_GATE"| D5
  P33 -->|"visitor.updated event (target: flat + guards)"| P10
  P10 -->|"sse-frame: hold parcel at gate"| GRD

  GRD -->|"collect action (parcel handed over)"| P39
  RES -->|"collect action (confirms pickup)"| P39
  D5 -->|"LEFT_AT_GATE visitor"| P39
  P39 -->|"status=COLLECTED, checkOutAt"| D5
  P39 -->|"visitor.updated event"| P10
```

`LEAVE_AT_GATE` is only valid when `type = DELIVERY` (otherwise 422 `INVALID_TRANSITION`). Collection sets
`checkOutAt` as the collection time.

---

## 5. Level 2 — Process 1.0 Authenticate (OTP)

```mermaid
flowchart LR
  USR["Any user"]
  CLI["Client app (web / mobile)"]

  P11(("1.1<br/>Validate and<br/>throttle phone"))
  P12(("1.2<br/>Generate and<br/>store OTP"))
  P13(("1.3<br/>Deliver OTP"))
  P14(("1.4<br/>Verify code"))
  P15(("1.5<br/>Resolve user"))
  P16(("1.6<br/>Issue token and<br/>load memberships"))
  P17(("1.7<br/>Authenticate<br/>request (JWT)"))
  P18(("1.8<br/>Resolve tenancy<br/>(X-Society-Id)"))

  D1[("D1 Users")]
  D2[("D2 OTP Codes")]
  D3[("D3 Society Structure")]
  D4[("D4 Memberships")]

  USR -->|"otp-request (phone)"| P11
  P11 -->|"valid phone"| P12
  P11 -->|"429 RATE_LIMITED"| USR
  P12 -->|"invalidate previous unconsumed codes"| D2
  P12 -->|"otp-record (codeHash, expiresAt=now+5m, attempts=0)"| D2
  P12 -->|"plain code (memory only)"| P13
  P13 -->|"devCode (non-production only) or SMS (roadmap)"| USR

  USR -->|"otp-verify (phone, code, name)"| P14
  D2 -->|"latest unconsumed otp-record"| P14
  P14 -->|"attempts+1, consumedAt on success"| D2
  P14 -->|"422 OTP_INVALID, 422 OTP_EXPIRED, 429 OTP_TOO_MANY_ATTEMPTS"| USR
  P14 -->|"verified phone"| P15
  D1 -->|"user by phone"| P15
  P15 -->|"new user (phone, name)"| D1
  P15 -->|"user"| P16
  D4 -->|"ACTIVE memberships"| P16
  D3 -->|"society, flat, block"| P16
  P16 -->|"token-bundle (token, user, memberships)"| USR

  CLI -->|"Authorization: Bearer token"| P17
  P17 -->|"req.user = sub"| P18
  CLI -->|"X-Society-Id"| P18
  D4 -->|"ACTIVE membership (userId, societyId)"| P18
  P18 -->|"member-context (req.member)"| CLI
```

Key rules (detail in `07-LLD.md` §6.1):
- Code: 6 digits via `crypto.randomInt`, stored only as bcrypt hash, 5-minute expiry, max 5 verify attempts.
- An attempt is reserved atomically **before** the bcrypt compare (and released on a match), so parallel guesses
  cannot exceed the cap.
- New user without `name` → 422 `NAME_REQUIRED`; the OTP is **not** consumed so the client can resubmit with a name.
- 1.7/1.8 run on every protected request (middleware); `member-context` is consumed by processes 2.0–10.0.

---

## 6. Level 2 — Process 8.0 Billing & Accounts

```mermaid
flowchart LR
  ADM["Society Admin"]
  RES["Resident"]
  PAY["Payment Gateway (mock)"]

  P81(("8.1<br/>Generate<br/>invoices"))
  P82(("8.2<br/>Mark overdue<br/>(lazy)"))
  P83(("8.3<br/>List<br/>invoices"))
  P84(("8.4<br/>Process<br/>payment"))
  P85(("8.5<br/>Record<br/>expense"))
  P86(("8.6<br/>Compute<br/>KPI summary"))
  P10(("10.0<br/>Notify"))

  D3[("D3 Society Structure")]
  D5[("D5 Visitors")]
  D11[("D11 Tickets")]
  D14[("D14 Invoices")]
  D15[("D15 Payments")]
  D16[("D16 Expenses")]
  D17[("D17 SOS Alerts")]

  ADM -->|"invoice-run (period, amount, dueDate)"| P81
  D3 -->|"all flats in society"| P81
  D14 -->|"existing flat+period pairs"| P81
  P81 -->|"invoice-record status=UNPAID (new pairs only)"| D14
  P81 -->|"invoice-run-result (created, skipped)"| ADM
  P81 -->|"billing-event: invoice generated (target: flat residents)"| P10

  D14 -->|"UNPAID with dueDate before today IST"| P82
  P82 -->|"status=OVERDUE"| D14
  P82 -->|"current statuses"| P83
  ADM -->|"invoice-query (status, period)"| P83
  RES -->|"invoice-query"| P83
  D14 -->|"invoices (scoped: own flat or all)"| P83
  P83 -->|"invoice-list"| RES
  P83 -->|"invoice-list"| ADM

  RES -->|"pay-request (invoiceId, method)"| P84
  ADM -->|"pay-request (method=CASH)"| P84
  D14 -->|"UNPAID or OVERDUE invoice"| P84
  P84 -->|"charge-request (amount, method)"| PAY
  PAY -->|"charge-result (reference, SUCCESS)"| P84
  P84 -->|"status=PAID"| D14
  P84 -->|"payment-record"| D15
  P84 -->|"receipt"| RES
  P84 -->|"billing-event: payment received"| P10

  ADM -->|"expense (category, amount, vendor, note, spentOn)"| P85
  P85 -->|"expense-record"| D16
  D16 -->|"expense-list"| P85
  P85 -->|"expense-list"| ADM

  ADM -->|"summary-query"| P86
  P82 -->|"fresh statuses"| P86
  D14 -->|"billed, paid, outstanding"| P86
  D15 -->|"collected this month"| P86
  D16 -->|"month expenses"| P86
  D5 -->|"visitors today, pending, inside now, recent 5"| P86
  D11 -->|"open tickets"| P86
  D17 -->|"active SOS"| P86
  P86 -->|"kpi-summary"| ADM
```

Key rules (detail in `07-LLD.md` §6.6–§6.8 and §7.12):
- 8.1 creates one invoice for **every flat** in the society for the period; existing `(flatId, period)` rows are skipped
  (`@@unique([flatId, period])` + `createMany({ skipDuplicates: true })`) → re-running is idempotent.
- 8.4 is full-payment only; the `PAID` transition is a conditional update (`status IN (UNPAID, OVERDUE)`), so a double
  click cannot create two payments. `CASH` may only be recorded by an admin.
- All amounts are integer paise.

---

## 7. Data-flow dictionary

Notation (DeMarco): `=` is composed of, `+` and, `( )` optional, `{ }` zero-or-more, `[ a | b ]` one of.

| Flow | Composition |
|---|---|
| otp-request | phone |
| otp-verify | phone + code + (name) |
| otp-record | phone + codeHash + expiresAt + attempts + (consumedAt) |
| token-bundle | token + user + {membership + society + (flat + block)} |
| user-record | id + phone + name + (email) + (avatarUrl) |
| member-context | membershipId + userId + societyId + role + (flatId) + (residentType) |
| memberships | {membershipId + role + status + societyId + (flatId)} |
| society-details | name + addressLine + city + state + pincode |
| block | name |
| flat-batch | blockId + {number} |
| member-details | phone + name + role + (flatId) + (residentType) |
| membership-record | userId + societyId + role + (flatId) + (residentType) + status |
| member-list | {membership + user + (flat)} |
| society-structure | society + {block + {flat}} |
| visitor-identity | name + (phone) + (company) + (vehicleNo) + (photoUrl) |
| walk-in | flatId + type + visitor-identity + (purpose) |
| visitor-record | id + societyId + flatId + type + visitor-identity + (purpose) + status + (preApprovalId) + loggedById + (decidedById) + (decidedAt) + (checkInAt) + (checkOutAt) |
| visitor-status | visitorId + status + (updatedAt) |
| visitor-decision | visitorId + [ APPROVE \| DENY \| LEAVE_AT_GATE ] |
| gate-action | visitorId + [ check-in \| check-out \| collect ] |
| visitor-log | {visitor-record} |
| gate-passcode | passcode (6 digits) |
| verify-result | [ kind=VISITOR + visitor-record \| kind=STAFF + action + staff + attendance-record \| PASSCODE_INVALID + reason ] |
| preapproval-request | flatId (implicit) + (type) + guestName + (guestPhone) + (validFrom) + (validTo) + (maxUses) |
| preapproval-record | id + societyId + flatId + createdById + type + guestName + (guestPhone) + passcode + validFrom + validTo + maxUses + usedCount + status |
| passcode-slip | passcode + guestName + validFrom + validTo |
| staff-profile | name + (phone) + category + (photoUrl) + (isActive) |
| staff-record | staff-profile + passcode + {flatId} |
| staff-flat-link | staffId + flatId |
| attendance-record | staffId + societyId + checkInAt + (checkOutAt) + loggedById |
| attendance-result | staff + attendance-record + [ CHECK_IN \| CHECK_OUT ] |
| staff-notification | [ STAFF_ENTRY \| STAFF_EXIT ] + staffId + attendanceId (to residents of linked flats) |
| attendance-history | {attendance-record} |
| notice | title + body + category + (isPinned) |
| notice-record | notice + id + createdById + createdAt |
| poll-definition | question + {option text}(2..10) + (closesAt) |
| poll-vote | pollId + optionId |
| poll-results | poll + {option + voteCount} + (myOptionId) |
| ticket-request | category + title + description + (priority) |
| ticket-update | ticketId + (status) + (assignedToId) + (priority) |
| ticket-comment | ticketId + body |
| ticket-record | id + societyId + (flatId) + raisedById + (assignedToId) + category + title + description + priority + status + (resolvedAt) |
| ticket-thread | ticket-record + {comment + author} |
| amenity-definition | name + (description) + openTime + closeTime + slotMinutes + capacity + pricePerSlot + (isActive) |
| availability-query | amenityId + date |
| availability | {startAt + endAt + booked + capacity + available} |
| booking-request | amenityId + startAt + (flatId, admin only) |
| booking-record | id + amenityId + societyId + flatId + bookedById + startAt + endAt + status |
| booking-confirmation | booking-record + amenity name |
| invoice-run | period (YYYY-MM) + amount (paise) + dueDate |
| invoice-run-result | created + skipped |
| invoice-record | id + societyId + flatId + period + amount + dueDate + status |
| invoice-query | (status) + (period) + (limit) |
| pay-request | invoiceId + method |
| charge-request | amount + method + invoiceId |
| charge-result | reference + status |
| payment-record | invoiceId + societyId + amount + method + reference + (paidById) + paidAt |
| receipt | payment-record + invoice-record |
| expense | category + amount + (vendor) + (note) + spentOn |
| summary-query | (none — always the current IST month) |
| kpi-summary | visitorsToday + pendingApprovals + insideNow + openTickets + collectionRate + totalDue + totalCollected + expensesThisMonth + residents + flats + {recent visitor-record}(0..5) + sosActive |
| sos-request | type + (message) |
| sos-record | id + societyId + (flatId) + raisedById + type + (message) + status + (acknowledgedById) + (acknowledgedAt) + (resolvedAt) |
| sos-status-change | sosId + [ ACKNOWLEDGED \| RESOLVED ] |
| *-event (visitor, sos, notice, ticket, booking, billing) | eventName + target + payload |
| target | societyId + (flatId) + ({role}) + ({userId}) + (exceptUserId) |
| notification-record | userId + (societyId) + type + title + body + (data) + (readAt) |
| sse-client | userId + membershipId + role + (flatId) + response stream |
| sse-frame | `event:` eventName + `data:` JSON payload |
| read-receipt | [ notificationId \| all ] |
