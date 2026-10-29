import { createApp } from './app.js';
import { config, logger, SWEEP_INTERVAL_MS } from './config.js';
import { prisma } from './db.js';
import { hub } from './events.js';
import * as visitors from './modules/visitors/visitors.service.js';
import * as preapprovals from './modules/preapprovals/preapprovals.service.js';

const server = createApp().listen(config.PORT, () => logger.info({ port: config.PORT }, 'Gatekeeper API listening'));

// ponytail: setInterval in-process; with N replicas wrap the tick in pg_try_advisory_lock so one replica sweeps.
const sweeper = setInterval(() => {
  Promise.all([visitors.expireStale(), preapprovals.expireStale()]).catch(err => logger.error({ err }, 'sweep failed'));
}, SWEEP_INTERVAL_MS);
sweeper.unref();

function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  clearInterval(sweeper);
  hub.closeAll();
  server.close(() => { void prisma.$disconnect().finally(() => process.exit(0)); });
  setTimeout(() => process.exit(0), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
