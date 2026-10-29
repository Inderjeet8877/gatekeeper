import { z } from 'zod';
import { id, isoDateTime, limit, str } from '../../middleware/validate.js';

export const listPollsQuery = z.object({ limit });
export const createPollBody = z.object({
  question: str(1, 200),
  options: z.array(str(1, 100)).min(2).max(10)
    .refine(o => new Set(o.map(x => x.toLowerCase())).size === o.length, 'Options must be unique'),
  closesAt: isoDateTime.refine(d => d > new Date(), 'Must be in the future').optional(),
});
export const voteBody = z.object({ optionId: id });

export type CreatePollBody = z.infer<typeof createPollBody>;
