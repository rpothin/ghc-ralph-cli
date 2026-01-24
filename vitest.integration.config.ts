import { defineConfig } from 'vitest/config';

/**
 * Integration test configuration
 *
 * These tests require external setup (e.g., running the CLI first to generate artifacts).
 * Run with: npm run test:integration
 */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/**/*.test.ts'],
    exclude: ['node_modules/', 'dist/'],
    testTimeout: 60000, // Integration tests may take longer
  },
});
