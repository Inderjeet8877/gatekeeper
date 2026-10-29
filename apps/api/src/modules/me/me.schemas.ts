import { z } from 'zod';
import { atLeastOne, str } from '../../middleware/validate.js';

export const updateMeBody = z.object({
  name: str(1, 80).optional(),
  email: z.string().trim().email().max(254).nullable().optional(),
}).refine(atLeastOne, 'At least one field is required');
export type UpdateMeBody = z.infer<typeof updateMeBody>;
