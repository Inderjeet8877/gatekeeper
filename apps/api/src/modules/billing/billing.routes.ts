import { Router } from 'express';
import { validate } from '../../middleware/validate.js';
import { requireRole } from '../../middleware/rbac.js';
import {
  createExpenseBody, generateInvoicesBody, listExpensesQuery, listInvoicesQuery, payBody,
  type ListExpensesQuery, type ListInvoicesQuery,
} from './billing.schemas.js';
import * as svc from './billing.service.js';

export const router = Router();
const admin = requireRole('ADMIN');

router.get('/invoices', requireRole('RESIDENT', 'ADMIN'), validate({ query: listInvoicesQuery }), async (req, res) => {
  res.json({ items: await svc.listInvoices(req.member!, req.q as ListInvoicesQuery) });
});

router.post('/invoices/generate', admin, validate({ body: generateInvoicesBody }), async (req, res) => {
  res.status(201).json(await svc.generateInvoices(req.member!, req.body));
});

router.post('/invoices/:id/pay', requireRole('RESIDENT', 'ADMIN'), validate({ body: payBody }), async (req, res) => {
  res.json(await svc.payInvoice(req.member!, req.params.id as string, req.body));
});

router.get('/expenses', admin, validate({ query: listExpensesQuery }), async (req, res) => {
  res.json({ items: await svc.listExpenses(req.member!, req.q as ListExpensesQuery) });
});

router.post('/expenses', admin, validate({ body: createExpenseBody }), async (req, res) => {
  res.status(201).json(await svc.createExpense(req.member!, req.body));
});

router.get('/reports/summary', admin, async (req, res) => {
  res.json(await svc.getSummary(req.member!));
});
