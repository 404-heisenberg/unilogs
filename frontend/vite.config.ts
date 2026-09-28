import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
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
    // Coverage instrumentation slows userEvent-heavy page tests; the 5s
    // default made them time out when the whole suite runs in parallel.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      // Measure every source file, not only the ones a test happens to import,
      // so untested pages show up as 0% instead of disappearing from the report.
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/test/**',
        // Generated shadcn/Radix wrappers — third-party markup, not our logic.
        'src/components/ui/**',
        'src/main.tsx',
        'src/**/*.d.ts',
        // Dev-only fixture for /share/demo, never shipped to a real report.
        'src/lib/sharedReportDemo.ts',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      // A few points under the measured figures (69.5 / 61.7 / 63.2 / 70.6 at
      // #285) so CI catches a real drop without failing on noise.
      thresholds: {
        statements: 65,
        branches: 57,
        functions: 58,
        lines: 65,
      },
    },
  },
});
