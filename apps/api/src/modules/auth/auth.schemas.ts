import { z } from 'zod';
import { phone, str } from '../../middleware/validate.js';

export const otpRequestBody = z.object({ phone });
export const verifyOtpBody = z.object({
  phone,
  code: z.string().trim().regex(/^[0-9]{6}$/, 'Must be 6 digits'),
  name: str(1, 80).optional(),
});
export type VerifyOtpBody = z.infer<typeof verifyOtpBody>;
