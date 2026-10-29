import { z } from 'zod';
import { id, str } from '../../middleware/validate.js';

export const createSocietyBody = z.object({
  name: str(2, 120),
  addressLine: str(1, 200),
  city: str(1, 80),
  state: str(1, 80),
  pincode: z.string().trim().regex(/^[1-9][0-9]{5}$/, 'Must be a 6-digit pincode'),
});
export const createBlockBody = z.object({ name: str(1, 20) });
export const listFlatsQuery = z.object({ blockId: id.optional() });
export const bulkFlatsBody = z.object({
  blockId: id,
  numbers: z.array(z.string().trim().min(1).max(10).regex(/^[A-Za-z0-9-]+$/, 'Letters, digits and dashes only')).min(1).max(200),
});

export type CreateSocietyBody = z.infer<typeof createSocietyBody>;
export type BulkFlatsBody = z.infer<typeof bulkFlatsBody>;
