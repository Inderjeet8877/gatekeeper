import crypto from 'node:crypto';
import type { Tx } from '../db.js';
import { AppError } from './errors.js';

/** 6-digit code unique across ACTIVE pre-approvals and all staff of the society (07 §6.3). */
export async function generateUniquePasscode(tx: Tx, societyId: string): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    const [pa, st] = await Promise.all([
      tx.preApproval.findFirst({ where: { societyId, passcode: code, status: 'ACTIVE' }, select: { id: true } }),
      tx.staff.findFirst({ where: { societyId, passcode: code }, select: { id: true } }),
    ]);
    if (!pa && !st) return code;
  }
  // ponytail: ACTIVE pre-approval uniqueness is app-checked; add the partial unique index from 03 §3.6 if collisions are ever observed.
  throw new AppError(500, 'INTERNAL_ERROR', 'Could not allocate a passcode, please retry');
}
