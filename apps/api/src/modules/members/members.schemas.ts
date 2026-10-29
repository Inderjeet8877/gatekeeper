import { z } from 'zod';
import { atLeastOne, id, phone, str } from '../../middleware/validate.js';

const role = z.enum(['ADMIN', 'RESIDENT', 'GUARD']);
const status = z.enum(['ACTIVE', 'INACTIVE']);

export const listMembersQuery = z.object({ flatId: id.optional(), role: role.optional(), status: status.optional() });

export const addMemberBody = z.object({
  phone,
  name: str(1, 80),
  role,
  flatId: id.nullish(),
  residentType: z.enum(['OWNER', 'TENANT', 'FAMILY']).nullish(),
}).superRefine((b, ctx) => {
  if (b.role === 'RESIDENT' && !b.flatId) ctx.addIssue({ code: 'custom', path: ['flatId'], message: 'Required for RESIDENT' });
  if (b.role !== 'RESIDENT' && b.flatId) ctx.addIssue({ code: 'custom', path: ['flatId'], message: 'Only allowed for RESIDENT' });
  if (b.role !== 'RESIDENT' && b.residentType) ctx.addIssue({ code: 'custom', path: ['residentType'], message: 'Only allowed for RESIDENT' });
});

export const updateMemberBody = z.object({ status: status.optional(), role: role.optional() })
  .refine(atLeastOne, 'At least one field is required');

export type ListMembersQuery = z.infer<typeof listMembersQuery>;
export type AddMemberBody = z.infer<typeof addMemberBody>;
export type UpdateMemberBody = z.infer<typeof updateMemberBody>;
