import { z } from 'zod';
import { date, id, limit, optPhone, optStr, optUrl, statusList, str } from '../../middleware/validate.js';

export const VISITOR_STATUSES = ['PENDING_APPROVAL', 'APPROVED', 'DENIED', 'EXPIRED', 'CHECKED_IN', 'CHECKED_OUT', 'LEFT_AT_GATE', 'COLLECTED'] as const;

export const listVisitorsQuery = z.object({
  status: statusList(z.enum(VISITOR_STATUSES)).optional(),
  date: date.optional(),
  flatId: id.optional(),
  limit,
});

export const createVisitorBody = z.object({
  flatId: id,
  type: z.enum(['GUEST', 'DELIVERY', 'CAB', 'SERVICE']),
  name: str(1, 80),
  phone: optPhone,
  company: optStr(80),
  vehicleNo: optStr(20).transform(v => v?.toUpperCase() ?? v),
  purpose: optStr(200),
  photoUrl: optUrl,
});

export const decisionBody = z.object({ decision: z.enum(['APPROVE', 'DENY', 'LEAVE_AT_GATE']) });
export const gateVerifyBody = z.object({ passcode: z.string().trim().regex(/^[0-9]{6}$/, 'Must be 6 digits') });

export type ListVisitorsQuery = z.infer<typeof listVisitorsQuery>;
export type CreateVisitorBody = z.infer<typeof createVisitorBody>;
export type Decision = z.infer<typeof decisionBody>['decision'];
