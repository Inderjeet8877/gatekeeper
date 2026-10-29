import { z } from 'zod';
import { limit, optStr, statusList } from '../../middleware/validate.js';

export const listSosQuery = z.object({ status: statusList(z.enum(['RAISED', 'ACKNOWLEDGED', 'RESOLVED'])).optional(), limit });
export const raiseSosBody = z.object({ type: z.enum(['MEDICAL', 'FIRE', 'THEFT', 'OTHER']), message: optStr(300) });
export const updateSosBody = z.object({ status: z.enum(['ACKNOWLEDGED', 'RESOLVED']) });

export type ListSosQuery = z.infer<typeof listSosQuery>;
export type RaiseSosBody = z.infer<typeof raiseSosBody>;
