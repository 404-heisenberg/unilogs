import { config } from 'dotenv';
import { defineConfig } from 'vitest/config';

config({ path: '.env.test', quiet: true });

if (process.env.NODE_ENV !== 'test') {
  throw new Error('NODE_ENV must be set to test before running the test suite');
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be set before running the test suite');
}

let databaseName: string;
try {
  databaseName = decodeURIComponent(new URL(testDatabaseUrl).pathname).replace(/^\//, '');
} catch {
  throw new Error('TEST_DATABASE_URL must be a valid PostgreSQL connection URL');
}

if (!/(^|[_-])test([_-]|$)/i.test(databaseName)) {
  throw new Error('TEST_DATABASE_URL must target a database with test in its name');
}

process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    globalSetup: ['./tests/global-setup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/validateEntry.ts'],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      thresholds: {
        statements: 50,
        branches: 40,
        functions: 50,
        lines: 50,
      },
    },
  },
});
