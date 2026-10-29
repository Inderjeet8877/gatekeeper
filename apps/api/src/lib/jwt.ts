import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { unauthorized } from './errors.js';

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, config.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): { sub: string } {
  try {
    const p = jwt.verify(token, config.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof p === 'string' || typeof p.sub !== 'string') throw new Error('bad payload');
    return { sub: p.sub };
  } catch {
    throw unauthorized('Invalid or expired token');
  }
}
