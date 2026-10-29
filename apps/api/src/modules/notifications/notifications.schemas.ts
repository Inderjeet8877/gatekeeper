import { z } from 'zod';
import { boolStr, limit } from '../../middleware/validate.js';

export const listNotificationsQuery = z.object({ unread: boolStr.optional(), limit });
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuery>;
