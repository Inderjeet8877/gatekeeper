import { z } from 'zod';
import { isoDateTime, limit, optPhone, str } from '../../middleware/validate.js';

const DAY = 24 * 3_600_000;

export const listPreApprovalsQuery = z.object({ status: z.enum(['ACTIVE', 'USED', 'CANCELLED', 'EXPIRED']).optional(), limit });

export const createPreApprovalBody = z.object({
  type: z.enum(['GUEST', 'DELIVERY', 'CAB', 'SERVICE']).default('GUEST'),
  guestName: str(1, 80),
  guestPhone: optPhone,
  validFrom: isoDateTime.optional(),
  validTo: isoDateTime.optional(),
  maxUses: z.number().int().min(1).max(10).default(1),
}).transform((b, ctx) => {
  const validFrom = b.validFrom ?? new Date();
  const validTo = b.validTo ?? new Date(validFrom.getTime() + DAY);
  if (validFrom.getTime() < Date.now() - 5 * 60_000) ctx.addIssue({ code: 'custom', path: ['validFrom'], message: 'Cannot be more than 5 minutes in the past' });
  if (validTo <= validFrom) ctx.addIssue({ code: 'custom', path: ['validTo'], message: 'Must be after validFrom' });
  if (validTo.getTime() > validFrom.getTime() + 30 * DAY) ctx.addIssue({ code: 'custom', path: ['validTo'], message: 'Must be within 30 days of validFrom' });
  return { ...b, validFrom, validTo };
});

export type ListPreApprovalsQuery = z.infer<typeof listPreApprovalsQuery>;
export type CreatePreApprovalBody = z.infer<typeof createPreApprovalBody>;
