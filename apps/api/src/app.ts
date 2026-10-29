import crypto from 'node:crypto';
import express, { Router, type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { config, logger } from './config.js';
import { requireAuth } from './middleware/auth.js';
import { requireMember } from './middleware/tenancy.js';
import { validate } from './middleware/validate.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { router as authRouter } from './modules/auth/auth.routes.js';
import { router as meRouter } from './modules/me/me.routes.js';
import { router as societyRouter, createSocietyHandler } from './modules/society/society.routes.js';
import { createSocietyBody } from './modules/society/society.schemas.js';
import { router as membersRouter } from './modules/members/members.routes.js';
import { router as visitorsRouter } from './modules/visitors/visitors.routes.js';
import { router as preapprovalsRouter } from './modules/preapprovals/preapprovals.routes.js';
import { router as staffRouter } from './modules/staff/staff.routes.js';
import { router as noticesRouter } from './modules/notices/notices.routes.js';
import { router as pollsRouter } from './modules/polls/polls.routes.js';
import { router as ticketsRouter } from './modules/tickets/tickets.routes.js';
import { router as amenitiesRouter } from './modules/amenities/amenities.routes.js';
import { router as billingRouter } from './modules/billing/billing.routes.js';
import { router as sosRouter } from './modules/sos/sos.routes.js';
import { router as notificationsRouter } from './modules/notifications/notifications.routes.js';
import { router as eventsRouter } from './modules/events/events.routes.js';

const httpLogger = pinoHttp({
  logger,
  genReqId: (req, res) => {
    const id = (req.headers['x-request-id'] as string | undefined) || crypto.randomUUID();
    res.setHeader('X-Request-Id', id);
    return id;
  },
  // Never log query strings: /events carries the JWT in ?token=.
  serializers: { req: req => ({ id: req.id, method: req.method, url: String(req.url).split('?')[0] }) },
});

export function createApp(): Express {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGINS }));
  app.use(express.json({ limit: '100kb' }));
  app.use(httpLogger);
  app.get(['/health', '/api/v1/health'], (_req, res) => { res.json({ status: 'ok', time: new Date().toISOString() }); });

  const v1 = Router();
  v1.use('/auth', authRouter);
  v1.use(eventsRouter);
  v1.use(requireAuth);
  v1.use(meRouter);
  v1.use(notificationsRouter);
  v1.post('/societies', validate({ body: createSocietyBody }), createSocietyHandler);
  v1.use(requireMember);
  v1.use(societyRouter, membersRouter, visitorsRouter, preapprovalsRouter, staffRouter, noticesRouter,
    pollsRouter, ticketsRouter, amenitiesRouter, billingRouter, sosRouter);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
