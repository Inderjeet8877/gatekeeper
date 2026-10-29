import { z } from 'zod';
import { date, id, limit, optStr, period } from '../../middleware/validate.js';
import { istDateOf } from '../../lib/time.js';

const amount = z.number().int().min(1).max(100_000_000);
const expenseCategory = z.enum(['SECURITY', 'HOUSEKEEPING', 'ELECTRICITY', 'WATER', 'REPAIRS', 'SALARIES', 'OTHER']);

export const listInvoicesQuery = z.object({
  status: z.enum(['UNPAID', 'PAID', 'OVERDUE']).optional(), period: period.optional(), flatId: id.optional(), limit,
});
export const generateInvoicesBody = z.object({ period, amount, dueDate: date });
export const payBody = z.object({ method: z.enum(['UPI', 'CARD', 'NETBANKING', 'CASH']) });
export const listExpensesQuery = z.object({ category: expenseCategory.optional(), month: period.optional(), limit });
export const createExpenseBody = z.object({
  category: expenseCategory, amount, vendor: optStr(120), note: optStr(500),
  spentOn: date.refine(d => d <= istDateOf(new Date()), 'Cannot be in the future'),
});

export type ListInvoicesQuery = z.infer<typeof listInvoicesQuery>;
export type GenerateInvoicesBody = z.infer<typeof generateInvoicesBody>;
export type PayBody = z.infer<typeof payBody>;
export type ListExpensesQuery = z.infer<typeof listExpensesQuery>;
export type CreateExpenseBody = z.infer<typeof createExpenseBody>;
