// Thin fetch client for docs/08-API-SPEC.md. Shapes below are copied from spec §3 (only what the app reads).
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');
/** Admin web console, shown to admin-only accounts. */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL || 'http://localhost:8080';

export class ApiError extends Error {
  constructor(public code: string, message: string, public status = 0, public details?: any) {
    super(message);
  }
}

/** Mutable auth context, owned by session.tsx. */
export const auth = {
  token: null as string | null,
  societyId: null as string | null,
  onUnauthorized: () => {},
};

type Opts = { method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'; body?: unknown; society?: boolean };

export async function api<T>(path: string, { method = 'GET', body, society = true }: Opts = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth.token) headers.Authorization = `Bearer ${auth.token}`;
  if (society && auth.societyId) headers['X-Society-Id'] = auth.societyId;
  let res: Response;
  try {
    res = await fetch(API_URL + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError('NETWORK', "Couldn't reach Gatekeeper. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const e = json?.error;
    if (res.status === 401 && auth.token) auth.onUnauthorized();
    throw new ApiError(e?.code ?? 'INTERNAL_ERROR', e?.message ?? `Request failed (${res.status}).`, res.status, e?.details);
  }
  return json as T;
}

export const errMsg = (e: unknown) =>
  e instanceof ApiError
    ? e.status === 403
      ? "You don't have access to this. Ask the society admin if you need it."
      : e.message
    : "Couldn't reach Gatekeeper. Check your connection and try again.";

/** Build a query string, dropping empty values. */
export const qs = (p: Record<string, string | number | undefined | null>) => {
  const s = Object.entries(p)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join('&');
  return s ? `?${s}` : '';
};

// ---- shapes (spec §3) ----
export type Role = 'ADMIN' | 'RESIDENT' | 'GUARD';
export type VisitorType = 'GUEST' | 'DELIVERY' | 'CAB' | 'SERVICE';
export type VisitorStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'DENIED' | 'EXPIRED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'LEFT_AT_GATE' | 'COLLECTED';
export type SosType = 'MEDICAL' | 'FIRE' | 'THEFT' | 'OTHER';
export type TicketCategory = 'PLUMBING' | 'ELECTRICAL' | 'CLEANING' | 'SECURITY' | 'LIFT' | 'PARKING' | 'OTHER';
export type TicketPriority = 'LOW' | 'MEDIUM' | 'HIGH';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'CASH';
export type StaffCategory = 'MAID' | 'COOK' | 'DRIVER' | 'NANNY' | 'CLEANER' | 'GARDENER' | 'OTHER';
export type NoticeCategory = 'GENERAL' | 'MAINTENANCE' | 'EVENT' | 'URGENT';

export type List<T> = { items: T[] };
export interface ActorRef { id: string; name: string }
export interface FlatRef { id: string; number: string; blockName: string; label: string }
export interface User { id: string; phone: string; name: string; email: string | null; avatarUrl: string | null }
export interface Membership {
  id: string; role: Role; status: 'ACTIVE' | 'INACTIVE'; residentType: 'OWNER' | 'TENANT' | 'FAMILY' | null;
  society: { id: string; name: string; city: string };
  flat: { id: string; number: string; block: { id: string; name: string } } | null;
}
export interface AuthResult { token: string; user: User; memberships: Membership[] }
export interface Block { id: string; name: string; flatCount: number }
export interface Flat { id: string; number: string; block: { id: string; name: string }; label: string; residentCount: number }
export interface Visitor {
  id: string; type: VisitorType; name: string; phone: string | null; company: string | null; vehicleNo: string | null;
  purpose: string | null; status: VisitorStatus; flat: FlatRef; preApprovalId: string | null; loggedBy: ActorRef;
  decidedBy: ActorRef | null; decidedAt: string | null; checkInAt: string | null; checkOutAt: string | null;
  expiresAt: string | null; createdAt: string;
}
export interface PreApproval {
  id: string; type: VisitorType; guestName: string; guestPhone: string | null; passcode: string | null;
  validFrom: string; validTo: string; maxUses: number; usedCount: number;
  status: 'ACTIVE' | 'USED' | 'CANCELLED' | 'EXPIRED'; flat: FlatRef; createdBy: ActorRef; createdAt: string;
}
export interface Staff {
  id: string; name: string; phone: string | null; category: StaffCategory; isActive: boolean; flats: FlatRef[]; isInside: boolean;
}
export interface StaffAttendance { id: string; staff: { id: string; name: string; category: StaffCategory }; checkInAt: string; checkOutAt: string | null; loggedBy: ActorRef }
export interface Notice { id: string; title: string; body: string; category: NoticeCategory; isPinned: boolean; createdBy: ActorRef; createdAt: string }
export interface Poll {
  id: string; question: string; closesAt: string | null; isClosed: boolean;
  options: { id: string; text: string; votes: number }[]; totalVotes: number; myVoteOptionId: string | null; createdAt: string;
}
export interface TicketComment { id: string; body: string; author: { id: string; name: string; role: Role }; createdAt: string }
export interface Ticket {
  id: string; title: string; description: string; category: TicketCategory; priority: TicketPriority; status: TicketStatus;
  flat: FlatRef | null; raisedBy: ActorRef; assignedTo: ActorRef | null; commentCount: number; comments?: TicketComment[];
  createdAt: string; updatedAt: string;
}
export interface Amenity {
  id: string; name: string; description: string | null; openTime: string; closeTime: string; slotMinutes: number;
  capacity: number; pricePerSlot: number; isActive: boolean;
}
export interface Slot { startAt: string; endAt: string; booked: number; capacity: number; available: number }
export interface Booking { id: string; amenity: { id: string; name: string }; flat: FlatRef; startAt: string; endAt: string; status: 'CONFIRMED' | 'CANCELLED' }
export interface Payment { id: string; amount: number; method: PaymentMethod; reference: string; paidAt: string }
export interface Invoice { id: string; period: string; amount: number; dueDate: string; status: 'UNPAID' | 'PAID' | 'OVERDUE'; flat: FlatRef; payments: Payment[] }
export interface SosAlert {
  id: string; type: SosType; message: string | null; status: 'RAISED' | 'ACKNOWLEDGED' | 'RESOLVED'; flat: FlatRef | null;
  raisedBy: { id: string; name: string; phone: string }; acknowledgedBy: ActorRef | null; acknowledgedAt: string | null;
  resolvedAt: string | null; createdAt: string;
}
export interface Notification { id: string; type: string; title: string; body: string; readAt: string | null; createdAt: string }
export type GateResult =
  | { kind: 'VISITOR'; visitor: Visitor }
  | { kind: 'STAFF'; action: 'CHECK_IN' | 'CHECK_OUT'; staff: Staff; attendance: StaffAttendance };
