import { z } from 'zod';
import { atLeastOne, boolStr, date, id, limit, optPhone, optUrl, str } from '../../middleware/validate.js';

const category = z.enum(['MAID', 'COOK', 'DRIVER', 'NANNY', 'CLEANER', 'GARDENER', 'OTHER']);

export const listStaffQuery = z.object({ flatId: id.optional(), category: category.optional(), isActive: boolStr.optional() });
export const createStaffBody = z.object({
  name: str(1, 80), phone: optPhone, category, photoUrl: optUrl, flatIds: z.array(id).max(50).optional(),
});
export const updateStaffBody = z.object({
  name: str(1, 80).optional(), phone: optPhone, category: category.optional(), photoUrl: optUrl, isActive: z.boolean().optional(),
}).refine(atLeastOne, 'At least one field is required');
export const linkFlatBody = z.object({ flatId: id });
export const attendanceQuery = z.object({ date: date.optional(), limit });

export type ListStaffQuery = z.infer<typeof listStaffQuery>;
export type CreateStaffBody = z.infer<typeof createStaffBody>;
export type UpdateStaffBody = z.infer<typeof updateStaffBody>;
export type AttendanceQuery = z.infer<typeof attendanceQuery>;
