import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

export { OTP_TTL_MS, OTP_MAX_ATTEMPTS } from '../config.js';
export const generateOtp = () => crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
export const hashOtp = (code: string) => bcrypt.hash(code, 10);
export const compareOtp = (code: string, hash: string) => bcrypt.compare(code, hash);
