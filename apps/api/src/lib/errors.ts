export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) { super(message); this.name = 'AppError'; }
}

export const badRequest = (msg: string, details?: unknown) => new AppError(400, 'VALIDATION_ERROR', msg, details);
export const unauthorized = (msg = 'Authentication required') => new AppError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'You are not allowed to do this') => new AppError(403, 'FORBIDDEN', msg);
export const notFound = (what: string) => new AppError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, msg: string, details?: unknown) => new AppError(409, code, msg, details);
export const unprocessable = (code: string, msg: string, details?: unknown) => new AppError(422, code, msg, details);

export const invalidTransition = (from: string, to: string) =>
  unprocessable('INVALID_TRANSITION', `Cannot move from ${from} to ${to}`, { from, to });

/** Throws 422 INVALID_TRANSITION unless `to` is listed for `from`. */
export function assertTransition<S extends string>(table: Record<S, readonly S[]>, from: S, to: S): void {
  if (!table[from].includes(to)) throw invalidTransition(from, to);
}
