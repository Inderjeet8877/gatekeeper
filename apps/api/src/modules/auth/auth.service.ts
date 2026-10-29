import { prisma } from '../../db.js';
import { config, logger } from '../../config.js';
import { AppError, unprocessable } from '../../lib/errors.js';
import { generateOtp, hashOtp, compareOtp, OTP_TTL_MS, OTP_MAX_ATTEMPTS } from '../../lib/otp.js';
import { signToken } from '../../lib/jwt.js';
import { loadMemberships, userDTO } from '../me/me.service.js';
import type { VerifyOtpBody } from './auth.schemas.js';

const tooMany = () => new AppError(429, 'OTP_TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code');

export async function requestOtp(phone: string) {
  const now = new Date();
  await prisma.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { consumedAt: now } });
  const code = generateOtp();
  await prisma.otpCode.create({ data: { phone, codeHash: await hashOtp(code), expiresAt: new Date(now.getTime() + OTP_TTL_MS) } });
  if (!config.exposeDevOtp) return { sent: true };
  logger.info({ phone, devCode: code }, 'dev OTP');
  return { sent: true, devCode: code };
}

export async function verifyOtp({ phone, code, name }: VerifyOtpBody) {
  const otp = await prisma.otpCode.findFirst({ where: { phone, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!otp) throw unprocessable('OTP_INVALID', 'Invalid code');
  if (otp.attempts >= OTP_MAX_ATTEMPTS) throw tooMany();
  if (otp.expiresAt <= new Date()) throw unprocessable('OTP_EXPIRED', 'Code expired. Request a new one');

  // Reserve an attempt before the slow compare so parallel guesses can never exceed the cap.
  const reserved = await prisma.otpCode.updateMany({
    where: { id: otp.id, attempts: { lt: OTP_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } },
  });
  if (!reserved.count) throw tooMany();
  if (!(await compareOtp(code, otp.codeHash))) {
    const { attempts } = await prisma.otpCode.findUniqueOrThrow({ where: { id: otp.id }, select: { attempts: true } });
    if (attempts >= OTP_MAX_ATTEMPTS) throw tooMany();
    throw unprocessable('OTP_INVALID', 'Invalid code', { attemptsLeft: OTP_MAX_ATTEMPTS - attempts });
  }
  await prisma.otpCode.update({ where: { id: otp.id }, data: { attempts: { decrement: 1 } } });

  const existing = await prisma.user.findUnique({ where: { phone } });
  if (!existing && !name) throw unprocessable('NAME_REQUIRED', 'Name is required for a new account');

  const user = await prisma.$transaction(async tx => {
    const r = await tx.otpCode.updateMany({ where: { id: otp.id, consumedAt: null }, data: { consumedAt: new Date() } });
    if (!r.count) throw unprocessable('OTP_INVALID', 'Invalid code');
    return existing ?? tx.user.create({ data: { phone, name: name! } });
  });
  return { token: signToken(user.id), user: userDTO(user), memberships: await loadMemberships(user.id) };
}
