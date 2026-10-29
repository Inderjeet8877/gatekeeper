# 04 — Entity Relationship Diagram

> Mirrors `apps/api/prisma/schema.prisma` (canonical) and `03-DATA-DICTIONARY.md`.
> 24 models, 17 enums. Split into three diagrams; `Society`, `Flat` and `Membership` reappear as stubs (id only) where referenced.
> Physical names are snake_case (`Visitor` → `visitors`, `loggedById` → `logged_by_id`); diagrams use Prisma names.
> Optional FK = `o|` on the parent side. Actor fields (`…ById`) all point to `Membership`.

## 1. Core / Tenancy

```mermaid
erDiagram
    User ||--o{ Membership : "has"
    User ||--o{ Notification : "receives"
    Society ||--o{ Block : "has"
    Society ||--o{ Flat : "has"
    Block ||--o{ Flat : "contains"
    Society ||--o{ Membership : "has members"
    Flat |o--o{ Membership : "home of (RESIDENT)"
    Society |o--o{ Notification : "context of"

    User {
        string id PK
        string phone UK "10-15 digits"
        string name
        string email "nullable"
        string avatarUrl "nullable"
        datetime createdAt
        datetime updatedAt
    }
    OtpCode {
        string id PK
        string phone "indexed, no FK"
        string codeHash "bcrypt"
        datetime expiresAt
        int attempts "default 0"
        datetime consumedAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
    Society {
        string id PK
        string name
        string addressLine
        string city
        string state
        string pincode
        string logoUrl "nullable"
        datetime createdAt
        datetime updatedAt
    }
    Block {
        string id PK
        string societyId FK "UK(societyId,name)"
        string name
        datetime createdAt
        datetime updatedAt
    }
    Flat {
        string id PK
        string societyId FK
        string blockId FK "UK(blockId,number)"
        string number
        int floor "nullable"
        datetime createdAt
        datetime updatedAt
    }
    Membership {
        string id PK
        string userId FK "UK(userId,societyId)"
        string societyId FK
        Role role
        string flatId FK "nullable; required if RESIDENT"
        ResidentType residentType "nullable"
        MembershipStatus status "default ACTIVE"
        datetime createdAt
        datetime updatedAt
    }
    Notification {
        string id PK
        string userId FK "-> User"
        string societyId FK "nullable"
        string type
        string title
        string body
        json data "nullable"
        datetime readAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
```

## 2. Gate, Staff & SOS

```mermaid
erDiagram
    Society ||--o{ Visitor : "has"
    Flat ||--o{ Visitor : "visited"
    PreApproval |o--o{ Visitor : "admits"
    Membership ||--o{ Visitor : "loggedBy (guard)"
    Membership |o--o{ Visitor : "decidedBy (resident)"
    Society ||--o{ PreApproval : "has"
    Flat ||--o{ PreApproval : "invites for"
    Membership ||--o{ PreApproval : "createdBy"
    Society ||--o{ Staff : "employs"
    Staff ||--o{ StaffFlat : "works at"
    Flat ||--o{ StaffFlat : "served by"
    Staff ||--o{ StaffAttendance : "attends"
    Society ||--o{ StaffAttendance : "has"
    Membership ||--o{ StaffAttendance : "loggedBy (guard)"
    Society ||--o{ SosAlert : "has"
    Flat |o--o{ SosAlert : "origin"
    Membership ||--o{ SosAlert : "raisedBy"
    Membership |o--o{ SosAlert : "acknowledgedBy"

    Society {
        string id PK
    }
    Flat {
        string id PK
    }
    Membership {
        string id PK
    }

    Visitor {
        string id PK
        string societyId FK
        string flatId FK
        VisitorType type
        string name
        string phone "nullable"
        string company "nullable"
        string vehicleNo "nullable"
        string photoUrl "nullable"
        string purpose "nullable"
        VisitorStatus status "default PENDING_APPROVAL"
        string preApprovalId FK "nullable"
        string loggedById FK
        string decidedById FK "nullable"
        datetime decidedAt "nullable"
        datetime checkInAt "nullable"
        datetime checkOutAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
    PreApproval {
        string id PK
        string societyId FK
        string flatId FK
        string createdById FK
        VisitorType type
        string guestName
        string guestPhone "nullable"
        string passcode "6 digits; unique among ACTIVE (app)"
        datetime validFrom
        datetime validTo
        int maxUses "default 1"
        int usedCount "default 0"
        PreApprovalStatus status "default ACTIVE"
        datetime createdAt
        datetime updatedAt
    }
    Staff {
        string id PK
        string societyId FK "UK(societyId,passcode)"
        string name
        string phone "nullable"
        StaffCategory category
        string passcode "6 digits"
        string photoUrl "nullable"
        boolean isActive "default true"
        datetime createdAt
        datetime updatedAt
    }
    StaffFlat {
        string id PK
        string staffId FK "UK(staffId,flatId)"
        string flatId FK
        datetime createdAt
    }
    StaffAttendance {
        string id PK
        string staffId FK
        string societyId FK
        datetime checkInAt
        datetime checkOutAt "nullable"
        string loggedById FK
        datetime createdAt
        datetime updatedAt
    }
    SosAlert {
        string id PK
        string societyId FK
        string flatId FK "nullable"
        string raisedById FK
        SosType type
        string message "nullable"
        SosStatus status "default RAISED"
        string acknowledgedById FK "nullable"
        datetime acknowledgedAt "nullable"
        datetime resolvedAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
```

## 3. Community & Finance

```mermaid
erDiagram
    Society ||--o{ Notice : "has"
    Membership ||--o{ Notice : "createdBy"
    Society ||--o{ Poll : "has"
    Membership ||--o{ Poll : "createdBy"
    Poll ||--o{ PollOption : "offers"
    Poll ||--o{ PollVote : "collects"
    PollOption ||--o{ PollVote : "chosen in"
    Membership ||--o{ PollVote : "casts"
    Society ||--o{ Ticket : "has"
    Flat |o--o{ Ticket : "concerns"
    Membership ||--o{ Ticket : "raisedBy"
    Membership |o--o{ Ticket : "assignedTo"
    Ticket ||--o{ TicketComment : "thread"
    Society ||--o{ TicketComment : "has"
    Membership ||--o{ TicketComment : "author"
    Society ||--o{ Amenity : "offers"
    Amenity ||--o{ AmenityBooking : "booked as"
    Society ||--o{ AmenityBooking : "has"
    Flat ||--o{ AmenityBooking : "books"
    Membership ||--o{ AmenityBooking : "bookedBy"
    Society ||--o{ Invoice : "bills"
    Flat ||--o{ Invoice : "billed"
    Invoice ||--o{ Payment : "settled by"
    Society ||--o{ Payment : "receives"
    Membership |o--o{ Payment : "paidBy"
    Society ||--o{ Expense : "spends"
    Membership ||--o{ Expense : "createdBy"

    Society {
        string id PK
    }
    Flat {
        string id PK
    }
    Membership {
        string id PK
    }

    Notice {
        string id PK
        string societyId FK
        string title
        string body
        NoticeCategory category "default GENERAL"
        boolean isPinned "default false"
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }
    Poll {
        string id PK
        string societyId FK
        string question
        datetime closesAt "nullable"
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }
    PollOption {
        string id PK
        string pollId FK
        string text
        datetime createdAt
    }
    PollVote {
        string id PK
        string pollId FK "UK(pollId,membershipId)"
        string optionId FK
        string membershipId FK
        datetime createdAt
    }
    Ticket {
        string id PK
        string societyId FK
        string flatId FK "nullable"
        string raisedById FK
        string assignedToId FK "nullable"
        TicketCategory category
        string title
        string description
        TicketPriority priority "default MEDIUM"
        TicketStatus status "default OPEN"
        datetime resolvedAt "nullable"
        datetime createdAt
        datetime updatedAt
    }
    TicketComment {
        string id PK
        string ticketId FK
        string societyId FK "added beyond brief"
        string authorId FK
        string body
        datetime createdAt
    }
    Amenity {
        string id PK
        string societyId FK
        string name
        string description "nullable"
        string openTime "HH:mm"
        string closeTime "HH:mm"
        int slotMinutes
        int capacity "default 1"
        int pricePerSlot "paise, default 0"
        boolean isActive "default true"
        datetime createdAt
        datetime updatedAt
    }
    AmenityBooking {
        string id PK
        string amenityId FK
        string societyId FK
        string flatId FK
        string bookedById FK
        datetime startAt
        datetime endAt
        BookingStatus status "default CONFIRMED"
        datetime createdAt
        datetime updatedAt
    }
    Invoice {
        string id PK
        string societyId FK
        string flatId FK "UK(flatId,period)"
        string period "YYYY-MM"
        int amount "paise"
        date dueDate
        InvoiceStatus status "default UNPAID"
        datetime createdAt
        datetime updatedAt
    }
    Payment {
        string id PK
        string invoiceId FK
        string societyId FK
        int amount "paise"
        PaymentMethod method
        string reference
        string paidById FK "nullable"
        datetime paidAt "default now"
        datetime createdAt
    }
    Expense {
        string id PK
        string societyId FK
        ExpenseCategory category
        int amount "paise"
        string vendor "nullable"
        string note "nullable"
        date spentOn
        string createdById FK
        datetime createdAt
        datetime updatedAt
    }
```

## 4. Relationships

On delete: **Cascade** = child rows removed; **NoAction** = delete refused while referenced (restrict semantics, checked at end of statement); **SetNull** = FK cleared.

| # | From (child) | To (parent) | Cardinality (parent : child) | FK | On delete |
|---|---|---|---|---|---|
| 1 | Membership | User | 1 : 0..N | memberships.user_id | Cascade |
| 2 | Notification | User | 1 : 0..N | notifications.user_id | Cascade |
| 3 | Block | Society | 1 : 0..N | blocks.society_id | Cascade |
| 4 | Flat | Society | 1 : 0..N | flats.society_id | Cascade |
| 5 | Flat | Block | 1 : 0..N | flats.block_id | Cascade |
| 6 | Membership | Society | 1 : 0..N | memberships.society_id | Cascade |
| 7 | Membership | Flat | 0..1 : 0..N | memberships.flat_id | NoAction |
| 8 | Notification | Society | 0..1 : 0..N | notifications.society_id | Cascade |
| 9 | Visitor | Society | 1 : 0..N | visitors.society_id | Cascade |
| 10 | Visitor | Flat | 1 : 0..N | visitors.flat_id | NoAction |
| 11 | Visitor | PreApproval | 0..1 : 0..N | visitors.pre_approval_id | SetNull |
| 12 | Visitor | Membership (loggedBy) | 1 : 0..N | visitors.logged_by_id | NoAction |
| 13 | Visitor | Membership (decidedBy) | 0..1 : 0..N | visitors.decided_by_id | SetNull |
| 14 | PreApproval | Society | 1 : 0..N | pre_approvals.society_id | Cascade |
| 15 | PreApproval | Flat | 1 : 0..N | pre_approvals.flat_id | Cascade |
| 16 | PreApproval | Membership (createdBy) | 1 : 0..N | pre_approvals.created_by_id | NoAction |
| 17 | Staff | Society | 1 : 0..N | staff.society_id | Cascade |
| 18 | StaffFlat | Staff | 1 : 0..N | staff_flats.staff_id | Cascade |
| 19 | StaffFlat | Flat | 1 : 0..N | staff_flats.flat_id | Cascade |
| 20 | StaffAttendance | Staff | 1 : 0..N | staff_attendance.staff_id | Cascade |
| 21 | StaffAttendance | Society | 1 : 0..N | staff_attendance.society_id | Cascade |
| 22 | StaffAttendance | Membership (loggedBy) | 1 : 0..N | staff_attendance.logged_by_id | NoAction |
| 23 | SosAlert | Society | 1 : 0..N | sos_alerts.society_id | Cascade |
| 24 | SosAlert | Flat | 0..1 : 0..N | sos_alerts.flat_id | SetNull |
| 25 | SosAlert | Membership (raisedBy) | 1 : 0..N | sos_alerts.raised_by_id | NoAction |
| 26 | SosAlert | Membership (acknowledgedBy) | 0..1 : 0..N | sos_alerts.acknowledged_by_id | SetNull |
| 27 | Notice | Society | 1 : 0..N | notices.society_id | Cascade |
| 28 | Notice | Membership (createdBy) | 1 : 0..N | notices.created_by_id | NoAction |
| 29 | Poll | Society | 1 : 0..N | polls.society_id | Cascade |
| 30 | Poll | Membership (createdBy) | 1 : 0..N | polls.created_by_id | NoAction |
| 31 | PollOption | Poll | 1 : 0..N | poll_options.poll_id | Cascade |
| 32 | PollVote | Poll | 1 : 0..N | poll_votes.poll_id | Cascade |
| 33 | PollVote | PollOption | 1 : 0..N | poll_votes.option_id | Cascade |
| 34 | PollVote | Membership (voter) | 1 : 0..N (max 1 per poll) | poll_votes.membership_id | Cascade |
| 35 | Ticket | Society | 1 : 0..N | tickets.society_id | Cascade |
| 36 | Ticket | Flat | 0..1 : 0..N | tickets.flat_id | SetNull |
| 37 | Ticket | Membership (raisedBy) | 1 : 0..N | tickets.raised_by_id | NoAction |
| 38 | Ticket | Membership (assignedTo) | 0..1 : 0..N | tickets.assigned_to_id | SetNull |
| 39 | TicketComment | Ticket | 1 : 0..N | ticket_comments.ticket_id | Cascade |
| 40 | TicketComment | Society | 1 : 0..N | ticket_comments.society_id | Cascade |
| 41 | TicketComment | Membership (author) | 1 : 0..N | ticket_comments.author_id | NoAction |
| 42 | Amenity | Society | 1 : 0..N | amenities.society_id | Cascade |
| 43 | AmenityBooking | Amenity | 1 : 0..N | amenity_bookings.amenity_id | Cascade |
| 44 | AmenityBooking | Society | 1 : 0..N | amenity_bookings.society_id | Cascade |
| 45 | AmenityBooking | Flat | 1 : 0..N | amenity_bookings.flat_id | Cascade |
| 46 | AmenityBooking | Membership (bookedBy) | 1 : 0..N | amenity_bookings.booked_by_id | NoAction |
| 47 | Invoice | Society | 1 : 0..N | invoices.society_id | Cascade |
| 48 | Invoice | Flat | 1 : 0..N (max 1 per period) | invoices.flat_id | NoAction |
| 49 | Payment | Invoice | 1 : 0..N | payments.invoice_id | NoAction |
| 50 | Payment | Society | 1 : 0..N | payments.society_id | Cascade |
| 51 | Payment | Membership (paidBy) | 0..1 : 0..N | payments.paid_by_id | SetNull |
| 52 | Expense | Society | 1 : 0..N | expenses.society_id | Cascade |
| 53 | Expense | Membership (createdBy) | 1 : 0..N | expenses.created_by_id | NoAction |

Many-to-many: **Staff ↔ Flat** via `StaffFlat`. `OtpCode` has no FK (matched to `User` by phone only).

## 5. Notes

- **Tenancy hub.** `Society` is the root of every tenant-owned row. A hard delete of a Society cascades to everything beneath it in one statement (verified on Postgres 16); `User` rows survive because users span societies.
- **Actor = Membership.** Every `…ById` points at `Membership`, so the same person acting in two societies leaves two distinct actor ids. Required actor refs use NoAction (members with history must be deactivated, not deleted); optional ones (`decidedById`, `assignedToId`, `acknowledgedById`, `paidById`) use SetNull.
- **Why `TicketComment.societyId`.** Without it, comments are two cascade hops from Society while their author memberships are one hop, and the author FK check fires first and blocks the Society delete. The extra column fixes that and satisfies the tenancy rule.
- **History is protected from flat deletion.** Visitors, invoices (and their payments) and resident memberships block deleting a flat (NoAction). Pre-approvals, bookings and staff links are transient and cascade. Tickets and SOS alerts keep the record and null the flat.
- **Self-consistency rules the DB can't express** (enforced in services): `Flat.societyId = Block.societyId`; `PollVote.optionId` belongs to `pollId`; every referenced flat/membership/staff shares the row's `societyId`; ACTIVE pre-approval passcodes are unique per society and don't collide with staff passcodes.
