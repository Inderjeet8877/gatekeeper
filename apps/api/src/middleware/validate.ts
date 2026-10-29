import type { RequestHandler } from 'express';
import { z, type ZodTypeAny } from 'zod';

export const validate = ({ body, query }: { body?: ZodTypeAny; query?: ZodTypeAny }): RequestHandler =>
  (req, _res, next) => {
    if (body) req.body = body.parse(req.body ?? {});
    if (query) req.q = query.parse(req.query);
    next();
  };

// Shared schema pieces (08 §1.4: strings trimmed; empty optional string -> null).
const emptyToNull = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? null : v);
export const str = (min: number, max: number) => z.string().trim().min(min).max(max);
export const optStr = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullish());
export const phone = z.string().trim().regex(/^[0-9]{10,15}$/, 'Must be 10-15 digits');
export const optPhone = z.preprocess(emptyToNull, phone.nullish());
export const optUrl = z.preprocess(emptyToNull,
  z.string().trim().max(500).url().refine(u => /^https?:\/\//i.test(u), 'Must be an http(s) URL').nullish());
export const id = z.string().trim().min(1).max(64);
export const limit = z.coerce.number().int().min(1).max(200).default(50);
export const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD')
  .refine(s => !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().startsWith(s), 'Invalid date');
export const period = z.string().regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/, 'Must be YYYY-MM');
export const hhmm = z.string().regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, 'Must be HH:mm');
export const isoDateTime = z.string().datetime({ offset: true }).transform(s => new Date(s));
export const boolStr = z.enum(['true', 'false']).transform(s => s === 'true');
export const statusList = <E extends z.ZodEnum<[string, ...string[]]>>(e: E) =>
  z.string().transform(s => s.split(',').map(x => x.trim())).pipe(z.array(e).min(1));
export const atLeastOne = <T extends Record<string, unknown>>(o: T) => Object.values(o).some(v => v !== undefined);
