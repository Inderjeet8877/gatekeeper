import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { otpRequestLimiter } from '../../middleware/rateLimit.js';
import { otpRequestBody, verifyOtpBody } from './auth.schemas.js';
import * as svc from './auth.service.js';

export const router = Router();

router.post('/otp/request', otpRequestLimiter, validate({ body: otpRequestBody }), async (req, res) => {
  res.json(await svc.requestOtp(req.body.phone));
});

router.post('/otp/verify', validate({ body: verifyOtpBody }), async (req, res) => {
  res.json(await svc.verifyOtp(req.body));
});
