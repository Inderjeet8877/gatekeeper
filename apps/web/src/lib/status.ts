// Status + enum maps (docs/09 §4.7, §2.9)
import {
  Hourglass, Check, Ban, TimerOff, LogIn, LogOut, Package, PackageCheck, Ticket, CheckCheck, CircleX,
  CircleCheck, CircleSlash, CircleDot, CircleDashed, Archive, SignalLow, SignalMedium, SignalHigh,
  CalendarCheck, CalendarX, Clock, CircleAlert, Siren, ShieldCheck, UserRound, CarTaxiFront, Wrench,
  HeartPulse, Flame, ShieldAlert, TriangleAlert, Info, PartyPopper, OctagonAlert, Droplets, Zap, SprayCan,
  Shield, ArrowUpDown, ParkingMeter, CircleQuestionMark, House, ChefHat, Car, Baby, Sprout, Droplet, Hammer,
  Banknote, Receipt, Smartphone, CreditCard, Landmark, type LucideIcon,
} from 'lucide-react';

export type Tone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'gold';
export type Spec = { label: string; tone: Tone; icon: LucideIcon; pulse?: boolean };

export const STATUS = {
  visitor: {
    PENDING_APPROVAL: { label: 'Awaiting approval', tone: 'warning', icon: Hourglass, pulse: true },
    APPROVED: { label: 'Approved', tone: 'success', icon: Check },
    DENIED: { label: 'Denied', tone: 'danger', icon: Ban },
    EXPIRED: { label: 'Expired', tone: 'neutral', icon: TimerOff },
    CHECKED_IN: { label: 'Inside', tone: 'info', icon: LogIn },
    CHECKED_OUT: { label: 'Left', tone: 'neutral', icon: LogOut },
    LEFT_AT_GATE: { label: 'At the gate', tone: 'gold', icon: Package },
    COLLECTED: { label: 'Collected', tone: 'success', icon: PackageCheck },
  },
  preApproval: {
    ACTIVE: { label: 'Active', tone: 'success', icon: Ticket },
    USED: { label: 'Used', tone: 'neutral', icon: CheckCheck },
    CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: CircleX },
    EXPIRED: { label: 'Expired', tone: 'neutral', icon: TimerOff },
  },
  membership: {
    ACTIVE: { label: 'Active', tone: 'success', icon: CircleCheck },
    INACTIVE: { label: 'Inactive', tone: 'neutral', icon: CircleSlash },
  },
  ticket: {
    OPEN: { label: 'Open', tone: 'info', icon: CircleDot },
    IN_PROGRESS: { label: 'In progress', tone: 'warning', icon: CircleDashed },
    RESOLVED: { label: 'Resolved', tone: 'success', icon: CircleCheck },
    CLOSED: { label: 'Closed', tone: 'neutral', icon: Archive },
  },
  priority: {
    LOW: { label: 'Low', tone: 'neutral', icon: SignalLow },
    MEDIUM: { label: 'Medium', tone: 'warning', icon: SignalMedium },
    HIGH: { label: 'High', tone: 'danger', icon: SignalHigh },
  },
  booking: {
    CONFIRMED: { label: 'Confirmed', tone: 'success', icon: CalendarCheck },
    CANCELLED: { label: 'Cancelled', tone: 'neutral', icon: CalendarX },
  },
  invoice: {
    UNPAID: { label: 'Due', tone: 'info', icon: Clock },
    PAID: { label: 'Paid', tone: 'success', icon: Check },
    OVERDUE: { label: 'Overdue', tone: 'warning', icon: CircleAlert },
  },
  sos: {
    RAISED: { label: 'Active alert', tone: 'danger', icon: Siren, pulse: true },
    ACKNOWLEDGED: { label: 'Responding', tone: 'warning', icon: ShieldCheck },
    RESOLVED: { label: 'Resolved', tone: 'success', icon: CircleCheck },
  },
  staff: {
    ACTIVE: { label: 'Active', tone: 'success', icon: CircleCheck },
    INACTIVE: { label: 'Deactivated', tone: 'neutral', icon: CircleSlash },
    INSIDE: { label: 'Inside', tone: 'info', icon: LogIn },
    OUT: { label: 'Not in', tone: 'neutral', icon: LogOut },
  },
  poll: {
    OPEN: { label: 'Open', tone: 'info', icon: CircleDot },
    CLOSED: { label: 'Closed', tone: 'neutral', icon: Archive },
  },
} as const satisfies Record<string, Record<string, Spec>>;

type E = { label: string; icon: LucideIcon };
export const VISITOR_TYPE: Record<string, E> = {
  GUEST: { label: 'Guest', icon: UserRound }, DELIVERY: { label: 'Delivery', icon: Package },
  CAB: { label: 'Cab', icon: CarTaxiFront }, SERVICE: { label: 'Service', icon: Wrench },
};
export const SOS_TYPE: Record<string, E> = {
  MEDICAL: { label: 'Medical', icon: HeartPulse }, FIRE: { label: 'Fire', icon: Flame },
  THEFT: { label: 'Theft', icon: ShieldAlert }, OTHER: { label: 'Other', icon: TriangleAlert },
};
export const NOTICE_CAT: Record<string, E> = {
  GENERAL: { label: 'General', icon: Info }, MAINTENANCE: { label: 'Maintenance', icon: Wrench },
  EVENT: { label: 'Event', icon: PartyPopper }, URGENT: { label: 'Urgent', icon: OctagonAlert },
};
export const TICKET_CAT: Record<string, E> = {
  PLUMBING: { label: 'Plumbing', icon: Droplets }, ELECTRICAL: { label: 'Electrical', icon: Zap },
  CLEANING: { label: 'Cleaning', icon: SprayCan }, SECURITY: { label: 'Security', icon: Shield },
  LIFT: { label: 'Lift', icon: ArrowUpDown }, PARKING: { label: 'Parking', icon: ParkingMeter },
  OTHER: { label: 'Other', icon: CircleQuestionMark },
};
export const STAFF_CAT: Record<string, E> = {
  MAID: { label: 'Maid', icon: House }, COOK: { label: 'Cook', icon: ChefHat }, DRIVER: { label: 'Driver', icon: Car },
  NANNY: { label: 'Nanny', icon: Baby }, CLEANER: { label: 'Cleaner', icon: SprayCan },
  GARDENER: { label: 'Gardener', icon: Sprout }, OTHER: { label: 'Other', icon: UserRound },
};
export const EXPENSE_CAT: Record<string, E> = {
  SECURITY: { label: 'Security', icon: Shield }, HOUSEKEEPING: { label: 'Housekeeping', icon: SprayCan },
  ELECTRICITY: { label: 'Electricity', icon: Zap }, WATER: { label: 'Water', icon: Droplet },
  REPAIRS: { label: 'Repairs', icon: Hammer }, SALARIES: { label: 'Salaries', icon: Banknote },
  OTHER: { label: 'Other', icon: Receipt },
};
export const PAY_METHOD: Record<string, E> = {
  UPI: { label: 'UPI', icon: Smartphone }, CARD: { label: 'Card', icon: CreditCard },
  NETBANKING: { label: 'Net banking', icon: Landmark }, CASH: { label: 'Cash', icon: Banknote },
};

/** Overdue invoices > 30 days past due turn danger. */
export function invoiceSpec(status: keyof typeof STATUS.invoice, dueDate: string): Spec {
  const s = STATUS.invoice[status];
  if (status === 'OVERDUE' && Date.now() - new Date(`${dueDate}T00:00:00+05:30`).getTime() > 30 * 86_400_000) {
    return { ...s, tone: 'danger' };
  }
  return s;
}
