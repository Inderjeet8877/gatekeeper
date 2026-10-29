import { execSync } from 'node:child_process';

/**
 * Vitest globalSetup: bring the dedicated test database (URL computed in vitest.config.ts) up to the latest
 * migration. Non-destructive by design: every test file builds its own society and uses random phones, so
 * runs never depend on an empty DB. Use `npx prisma migrate reset` against gatekeeper_test manually to wipe it.
 */
export default function setup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: process.env.GK_TEST_DATABASE_URL },
  });
}
