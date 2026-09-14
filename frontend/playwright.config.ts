import { defineConfig, devices } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Reuses the same backend/.env.test a contributor already has from running the
// backend's own integration tests (see backend/tests/ and its
// TEST_DATABASE_URL) rather than inventing a second, parallel env file just
// for E2E. `TEST_DATABASE_URL` becomes the backend server's `DATABASE_URL`
// below so E2E runs against the same disposable test database, never a real
// dev or production one. Parsed by hand instead of pulling in `dotenv`
// (a backend-only dependency) for four key=value lines.
function readEnvFile(filePath: string): Record<string, string> {
  let contents: string;
  try {
    contents = readFileSync(filePath, 'utf-8');
  } catch {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of contents.split('\n')) {
    const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = (match[2] ?? '').trim().replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const backendDir = path.resolve(import.meta.dirname, '../backend');
const backendEnv = readEnvFile(path.join(backendDir, '.env.test'));

// CI sets these as real environment variables (see .github/workflows/ci.yml);
// local runs fall back to backend/.env.test, same file used by `npm test` in
// backend/. Either way this must point at a disposable test database, never
// the Neon dev branch backend/.env normally uses.
const testDatabaseUrl = process.env.TEST_DATABASE_URL ?? backendEnv.TEST_DATABASE_URL;
const betterAuthSecret = process.env.BETTER_AUTH_SECRET ?? backendEnv.BETTER_AUTH_SECRET;

if (!testDatabaseUrl || !betterAuthSecret) {
  throw new Error(
    'TEST_DATABASE_URL and BETTER_AUTH_SECRET must be set before running E2E tests. ' +
      'Copy backend/.env.test.example to backend/.env.test (see backend/tests/ for the matching Postgres container), ' +
      'or set both in the environment.',
  );
}

const FRONTEND_PORT = 5173;
const BACKEND_PORT = 3000;
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`;
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  // Higher than Playwright's 5s default: a real signup goes through password
  // hashing and a real database round trip, not a mocked instant response,
  // and the very first request after a cold backend start can take a few
  // seconds on its own. E2E is the slow, thorough layer by design — this
  // suite already accepts multi-second tests, so a tight assertion timeout
  // buys nothing but flakiness.
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: FRONTEND_URL,
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'npm run dev',
      cwd: backendDir,
      url: `${BACKEND_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(BACKEND_PORT),
        DATABASE_URL: testDatabaseUrl,
        BETTER_AUTH_SECRET: betterAuthSecret,
        CORS_ORIGIN: FRONTEND_URL,
        BETTER_AUTH_URL: BACKEND_URL,
      },
    },
    {
      command: 'npm run dev',
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        VITE_API_URL: BACKEND_URL,
      },
    },
  ],
});
