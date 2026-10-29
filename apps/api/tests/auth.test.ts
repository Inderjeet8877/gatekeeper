import { describe, it, expect } from 'vitest';
import { prisma } from '../src/db.js';
import { api, as, login, newPhone } from './helpers.js';

const request = (phone: string) => api().post('/api/v1/auth/otp/request').send({ phone });
const verify = (body: object) => api().post('/api/v1/auth/otp/verify').send(body);

describe('TC-AUTH-01 request OTP', () => {
  it('returns sent + devCode and stores a bcrypt hash', async () => {
    const phone = newPhone();
    const r = await request(phone);
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ sent: true, devCode: expect.stringMatching(/^\d{6}$/) });
    const row = await prisma.otpCode.findFirstOrThrow({ where: { phone }, orderBy: { createdAt: 'desc' } });
    expect(row.codeHash).not.toBe(r.body.devCode);
    expect(row.attempts).toBe(0);
  });

  it('TC-AUTH-09 rejects bad phones', async () => {
    for (const phone of ['123', 'abcdefghij', '1234567890123456', undefined]) {
      const r = await api().post('/api/v1/auth/otp/request').send({ phone });
      expect(r.status).toBe(400);
      expect(r.body.error.code).toBe('VALIDATION_ERROR');
    }
  });

  it('TC-AUTH-02 rate limits the 6th request', async () => {
    const phone = newPhone();
    for (let i = 0; i < 5; i++) expect((await request(phone)).status).toBe(200);
    const r = await request(phone);
    expect(r.status).toBe(429);
    expect(r.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('TC-AUTH-03/12 verify OTP', () => {
  it('new phone: NAME_REQUIRED keeps the code valid, then creates the user', async () => {
    const phone = newPhone();
    const { body } = await request(phone);
    const r1 = await verify({ phone, code: body.devCode });
    expect(r1.status).toBe(422);
    expect(r1.body.error.code).toBe('NAME_REQUIRED');
    const r2 = await verify({ phone, code: body.devCode, name: 'New User' });
    expect(r2.status).toBe(200);
    expect(r2.body.user).toMatchObject({ phone, name: 'New User', email: null, avatarUrl: null });
    expect(r2.body.memberships).toEqual([]);
    expect(typeof r2.body.token).toBe('string');
  });

  it('TC-AUTH-11 a consumed code cannot be reused', async () => {
    const phone = newPhone();
    const { body } = await request(phone);
    expect((await verify({ phone, code: body.devCode, name: 'X' })).status).toBe(200);
    const again = await verify({ phone, code: body.devCode });
    expect(again.status).toBe(422);
    expect(again.body.error.code).toBe('OTP_INVALID');
  });

  it('TC-AUTH-04 wrong code -> OTP_INVALID with attemptsLeft, 5th miss -> 429, then locked', async () => {
    const phone = newPhone();
    const { body } = await request(phone);
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    for (let i = 1; i <= 4; i++) {
      const r = await verify({ phone, code: wrong });
      expect(r.status).toBe(422);
      expect(r.body.error).toMatchObject({ code: 'OTP_INVALID', details: { attemptsLeft: 5 - i } });
    }
    const fifth = await verify({ phone, code: wrong });
    expect(fifth.status).toBe(429);
    expect(fifth.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
    const correct = await verify({ phone, code: body.devCode, name: 'X' });
    expect(correct.status).toBe(429);
    expect(correct.body.error.code).toBe('OTP_TOO_MANY_ATTEMPTS');
  });

  it('parallel wrong guesses never exceed the attempt cap', async () => {
    const phone = newPhone();
    const { body } = await request(phone);
    const wrong = body.devCode === '000000' ? '111111' : '000000';
    await Promise.all(Array.from({ length: 8 }, () => verify({ phone, code: wrong })));
    const row = await prisma.otpCode.findFirstOrThrow({ where: { phone }, orderBy: { createdAt: 'desc' } });
    expect(row.attempts).toBe(5);
  });

  it('TC-AUTH-10 expired code -> OTP_EXPIRED', async () => {
    const phone = newPhone();
    const { body } = await request(phone);
    await prisma.otpCode.updateMany({ where: { phone, consumedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const r = await verify({ phone, code: body.devCode, name: 'X' });
    expect(r.status).toBe(422);
    expect(r.body.error.code).toBe('OTP_EXPIRED');
  });

  it('a newer request invalidates the earlier code', async () => {
    const phone = newPhone();
    const first = (await request(phone)).body.devCode;
    const second = (await request(phone)).body.devCode;
    if (first !== second) expect((await verify({ phone, code: first, name: 'X' })).body.error.code).toBe('OTP_INVALID');
    expect((await verify({ phone, code: second, name: 'X' })).status).toBe(200);
  });
});

describe('TC-AUTH-06/07/08 /me', () => {
  it('rejects missing and bad tokens', async () => {
    expect((await api().get('/api/v1/me')).status).toBe(401);
    const r = await api().get('/api/v1/me').set('Authorization', 'Bearer garbage');
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns and updates the profile; unknown keys stripped', async () => {
    const phone = newPhone();
    const l = await login(phone, 'Rohan');
    const me = as(l.token);
    expect((await me.get('/me')).body.user.name).toBe('Rohan');
    const r = await me.patch('/me', { name: 'Rohan M', email: 'r@example.com', phone: '9999999999' });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ name: 'Rohan M', email: 'r@example.com', phone });
    expect((await me.patch('/me', { email: 'bad' })).status).toBe(400);
    expect((await me.patch('/me', {})).status).toBe(400);
  });
});

describe('TC-SYS-01/02 health and errors', () => {
  it('health ok on both paths', async () => {
    for (const p of ['/health', '/api/v1/health']) {
      const r = await api().get(p);
      expect(r.status).toBe(200);
      expect(r.body.status).toBe('ok');
    }
  });

  it('malformed JSON -> 400 envelope', async () => {
    const r = await api().post('/api/v1/auth/otp/request').set('Content-Type', 'application/json').send('{bad');
    expect(r.status).toBe(400);
    expect(r.body.error.code).toBe('VALIDATION_ERROR');
  });
});
