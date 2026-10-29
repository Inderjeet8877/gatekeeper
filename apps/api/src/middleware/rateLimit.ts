import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { AppError } from '../lib/errors.js';

export const otpRequestLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: req => `${String(req.body?.phone ?? '')}:${ipKeyGenerator(req.ip ?? '')}`,
  handler: (_req, _res, next) => next(new AppError(429, 'RATE_LIMITED', 'Too many OTP requests, please try again later')),
});
