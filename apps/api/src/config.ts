import { z } from 'zod';
import { pino } from 'pino';

try { process.loadEnvFile(); } catch { /* no .env file: rely on the real environment */ }

const Env = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:8080,http://localhost:5173')
    .transform(s => s.split(',').map(x => x.trim()).filter(Boolean)),
  EXPOSE_DEV_OTP: z.enum(['true', 'false']).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment:', parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; '));
  process.exit(1);
}
const env = parsed.data;
const exposeDevOtp = env.EXPOSE_DEV_OTP ? env.EXPOSE_DEV_OTP === 'true' : env.NODE_ENV !== 'production';

export const config = Object.freeze({ ...env, exposeDevOtp });

export const logger = pino({
  level: config.LOG_LEVEL,
  redact: ['req.headers.authorization', '*.code', '*.codeHash', '*.passcode', '*.token'],
});

if (config.NODE_ENV === 'production' && exposeDevOtp) {
  logger.fatal('EXPOSE_DEV_OTP must not be enabled in production');
  process.exit(1);
}

export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const VISITOR_PENDING_TTL_MS = 10 * 60_000;
export const SWEEP_INTERVAL_MS = 60_000;
export const SSE_HEARTBEAT_MS = 25_000;
