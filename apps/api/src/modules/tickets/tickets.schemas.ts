import { z } from 'zod';
import { atLeastOne, id, limit, statusList, str } from '../../middleware/validate.js';

const category = z.enum(['PLUMBING', 'ELECTRICAL', 'CLEANING', 'SECURITY', 'LIFT', 'PARKING', 'OTHER']);
const priority = z.enum(['LOW', 'MEDIUM', 'HIGH']);
const status = z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']);

export const listTicketsQuery = z.object({
  status: statusList(status).optional(), category: category.optional(), limit,
});
export const createTicketBody = z.object({
  title: str(1, 120), description: str(1, 2000), category, priority: priority.default('MEDIUM'), flatId: id.nullish(),
});
export const updateTicketBody = z.object({
  status: status.optional(), priority: priority.optional(), category: category.optional(), assignedToId: id.nullable().optional(),
}).refine(atLeastOne, 'At least one field is required');
export const commentBody = z.object({ body: str(1, 2000) });

export type ListTicketsQuery = z.infer<typeof listTicketsQuery>;
export type CreateTicketBody = z.infer<typeof createTicketBody>;
export type UpdateTicketBody = z.infer<typeof updateTicketBody>;
