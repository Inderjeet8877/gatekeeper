// docs/09 §4.7 shared status map (lucide-react-native variant).
import {
  Hourglass, Check, Ban, TimerOff, LogIn, LogOut, Package, PackageCheck, Ticket, CheckCheck, CircleX,
  CircleCheck, CircleDot, CircleDashed, Archive, SignalLow, SignalMedium, SignalHigh,
  CalendarCheck, CalendarX, Clock, CircleAlert, Siren, ShieldCheck, Lock, type LucideIcon,
  ArrowUpDown, CircleHelp, Droplets, Shield, SprayCan, SquareParking, Zap,
} from 'lucide-react-native';
import type { TicketCategory } from './api';
import type { StatusTone as Tone } from './theme';

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
    IN: { label: 'Inside', tone: 'info', icon: LogIn },
    OUT: { label: 'Not in', tone: 'neutral', icon: LogOut },
  },
  poll: {
    OPEN: { label: 'Open', tone: 'info', icon: CircleDot },
    CLOSED: { label: 'Closed', tone: 'neutral', icon: Lock },
  },
} as const satisfies Record<string, Record<string, Spec>>;

export const TICKET_ICON: Record<TicketCategory, LucideIcon> = {
  PLUMBING: Droplets, ELECTRICAL: Zap, CLEANING: SprayCan, SECURITY: Shield, LIFT: ArrowUpDown, PARKING: SquareParking, OTHER: CircleHelp,
};
