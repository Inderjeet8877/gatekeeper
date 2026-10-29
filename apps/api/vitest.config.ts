import { defineConfig } from 'vitest/config';

try { process.loadEnvFile(); } catch { /* no .env */ }

// Tests run against a dedicated database on the same server: TEST_DATABASE_URL, or DATABASE_URL with db name gatekeeper_test.
const base = process.env.DATABASE_URL ?? 'postgresql://gatekeeper:gatekeeper@localhost:5433/gatekeeper';
const testUrl = process.env.TEST_DATABASE_URL ?? (() => { const u = new URL(base); u.pathname = '/gatekeeper_test'; return u.toString(); })();
process.env.GK_TEST_DATABASE_URL = testUrl; // read by tests/setup.ts (globalSetup runs in this process)

export default defineConfig({
  test: {
    globalSetup: ['tests/setup.ts'],
    env: {
      DATABASE_URL: testUrl,
      NODE_ENV: 'test',
      LOG_LEVEL: 'silent',
      JWT_SECRET: process.env.JWT_SECRET ?? 'test-secret-test-secret-test-secret-123',
    },
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
