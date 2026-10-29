import { z } from 'zod';
import { atLeastOne, limit, str } from '../../middleware/validate.js';

const category = z.enum(['GENERAL', 'MAINTENANCE', 'EVENT', 'URGENT']);

export const listNoticesQuery = z.object({ category: category.optional(), limit });
export const createNoticeBody = z.object({
  title: str(1, 120), body: str(1, 5000), category: category.default('GENERAL'), isPinned: z.boolean().default(false),
});
export const updateNoticeBody = z.object({
  title: str(1, 120).optional(), body: str(1, 5000).optional(), category: category.optional(), isPinned: z.boolean().optional(),
}).refine(atLeastOne, 'At least one field is required');

export type ListNoticesQuery = z.infer<typeof listNoticesQuery>;
export type CreateNoticeBody = z.infer<typeof createNoticeBody>;
export type UpdateNoticeBody = z.infer<typeof updateNoticeBody>;
