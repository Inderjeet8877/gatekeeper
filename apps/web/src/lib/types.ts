// Shapes from docs/08-API-SPEC.md §3
export type ISODateTime = string;
export type ISODate = string;
export type Paise = number;

export type Role = 'ADMIN' | 'RESIDENT' | 'GUARD';
export type ResidentType = 'OWNER' | 'TENANT' | 'FAMILY';
export type MembershipStatus = 'ACTIVE' | 'INACTIVE';
export type VisitorType = 'GUEST' | 'DELIVERY' | 'CAB' | 'SERVICE';
export type VisitorStatus =
  | 'PENDING_APPROVAL' | 'APPROVED' | 'DENIED' | 'EXPIRED'
  | 'CHECKED_IN' | 'CHECKED_OUT' | 'LEFT_AT_GATE' | 'COLLECTED';
export type PreApprovalStatus = 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED';
export type StaffCategory = 'MAID' | 'COOK' | 'DRIVER' | 'NANNY' | 'CLEANER' | 'GARDENER' | 'OTHER';
export type NoticeCategory = 'GENERAL' | 'MAINTENANCE' | 'EVENT' | 'URGENT';
export type TicketCategory = 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'SECURITY' | 'LIFT' | 'PARKING' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type BookingStatus = 'CONFIRMED' | 'CANCELLED';
export type InvoiceStatus = 'UNPAID' | 'PAID' | 'OVERDUE';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'CASH';
export type ExpenseCategory = 'SECURITY' | 'HOUSEKEEPING' | 'ELECTRICITY' | 'WATER' | 'REPAIRS' | 'SALARIES' | 'OTHER';
export type SosType = 'MEDICAL' | 'FIRE' | 'THEFT' | 'OTHER';
export type SosStatus = 'RAISED' | 'ACKNOWLEDGED' | 'RESOLVED';

export interface ActorRef { id: string; name: string }
export interface FlatRef { id: string; number: string; blockName: string; label: string }
type FlatNested = { id: string; number: string; block: { id: string; name: string } };

export interface User {
  id: string; phone: string; name: string; email: string | null; avatarUrl: string | null; createdAt: ISODateTime;
}
export interface Membership {
  id: string; role: Role; status: MembershipStatus; residentType: ResidentType | null;
  society: { id: string; name: string; city: string };
  flat: FlatNested | null;
  createdAt: ISODateTime;
}
export interface Society {
  id: string; name: string; addressLine: string; city: string; state: string; pincode: string;
  logoUrl: string | null; createdAt: ISODateTime;
}
export interface Block { id: string; name: string; flatCount: number; createdAt: ISODateTime }
export interface Flat {
  id: string; number: string; floor: number | null; block: { id: string; name: string };
  label: string; residentCount: number; createdAt: ISODateTime;
}
export interface Member {
  id: string; role: Role; status: MembershipStatus; residentType: ResidentType | null;
  flat: FlatNested | null; user: { id: string; name: string; phone: string }; createdAt: ISODateTime;
}
export interface Visitor {
  id: string; type: VisitorType; name: string; phone: string | null; company: string | null;
  vehicleNo: string | null; photoUrl: string | null; purpose: string | null; status: VisitorStatus;
  flat: FlatRef; preApprovalId: string | null; loggedBy: ActorRef; decidedBy: ActorRef | null;
  decidedAt: ISODateTime | null; checkInAt: ISODateTime | null; checkOutAt: ISODateTime | null;
  expiresAt: ISODateTime | null; createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface PreApproval {
  id: string; type: VisitorType; guestName: string; guestPhone: string | null; passcode: string | null;
  validFrom: ISODateTime; validTo: ISODateTime; maxUses: number; usedCount: number;
  status: PreApprovalStatus; flat: FlatRef; createdBy: ActorRef; createdAt: ISODateTime;
}
export interface Staff {
  id: string; name: string; phone: string | null; category: StaffCategory; passcode: string | null;
  photoUrl: string | null; isActive: boolean; flats: FlatRef[]; isInside: boolean; createdAt: ISODateTime;
}
export interface StaffAttendance {
  id: string; staff: { id: string; name: string; category: StaffCategory };
  checkInAt: ISODateTime; checkOutAt: ISODateTime | null; loggedBy: ActorRef;
}
export interface Notice {
  id: string; title: string; body: string; category: NoticeCategory; isPinned: boolean;
  createdBy: ActorRef; createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface Poll {
  id: string; question: string; closesAt: ISODateTime | null; isClosed: boolean;
  options: { id: string; text: string; votes: number }[]; totalVotes: number;
  myVoteOptionId: string | null; createdBy: ActorRef; createdAt: ISODateTime;
}
export interface TicketComment {
  id: string; body: string; author: { id: string; name: string; role: Role }; createdAt: ISODateTime;
}
export interface Ticket {
  id: string; title: string; description: string; category: TicketCategory; priority: TicketPriority;
  status: TicketStatus; flat: FlatRef | null; raisedBy: ActorRef; assignedTo: ActorRef | null;
  resolvedAt: ISODateTime | null; commentCount: number; comments?: TicketComment[];
  createdAt: ISODateTime; updatedAt: ISODateTime;
}
export interface Amenity {
  id: string; name: string; description: string | null; openTime: string; closeTime: string;
  slotMinutes: number; capacity: number; pricePerSlot: Paise; isActive: boolean; createdAt: ISODateTime;
}
export interface AvailabilitySlot {
  startAt: ISODateTime; endAt: ISODateTime; booked: number; capacity: number; available: number;
}
export interface Booking {
  id: string; amenity: { id: string; name: string }; flat: FlatRef; bookedBy: ActorRef;
  startAt: ISODateTime; endAt: ISODateTime; status: BookingStatus; createdAt: ISODateTime;
}
export interface Payment {
  id: string; invoiceId: string; amount: Paise; method: PaymentMethod; reference: string;
  paidBy: ActorRef | null; paidAt: ISODateTime;
}
export interface Invoice {
  id: string; period: string; amount: Paise; dueDate: ISODate; status: InvoiceStatus;
  flat: FlatRef; payments: Payment[]; createdAt: ISODateTime;
}
export interface Expense {
  id: string; category: ExpenseCategory; amount: Paise; vendor: string | null; note: string | null;
  spentOn: ISODate; createdBy: ActorRef; createdAt: ISODateTime;
}
export interface ReportSummary {
  visitorsToday: number; pendingApprovals: number; insideNow: number; openTickets: number;
  collectionRate: number; totalDue: Paise; totalCollected: Paise; expensesThisMonth: Paise;
  residents: number; flats: number; recentVisitors: Visitor[]; sosActive: number;
}
export interface SosAlert {
  id: string; type: SosType; message: string | null; status: SosStatus; flat: FlatRef | null;
  raisedBy: { id: string; name: string; phone: string }; acknowledgedBy: ActorRef | null;
  acknowledgedAt: ISODateTime | null; resolvedAt: ISODateTime | null; createdAt: ISODateTime;
}
export interface Notification {
  id: string; type: string; title: string; body: string; data: Record<string, unknown> | null;
  societyId: string | null; readAt: ISODateTime | null; createdAt: ISODateTime;
}

export type List<T> = { items: T[] };
export interface AuthResponse { token: string; user: User; memberships: Membership[] }
export type GateVerifyResult =
  | { kind: 'VISITOR'; visitor: Visitor }
  | { kind: 'STAFF'; action: 'CHECK_IN' | 'CHECK_OUT'; staff: Staff; attendance: StaffAttendance };
