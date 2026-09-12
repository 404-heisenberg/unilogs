import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': import.meta.dirname + '/src',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: false,
    // Vitest's default include also matches e2e/*.spec.ts — those are
    // Playwright tests, run separately via `npm run test:e2e`, not Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
