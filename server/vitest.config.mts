import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Only the TypeScript sources: a previous `npm run build` leaves compiled
    // copies of these same tests in dist/, which cannot run under vitest.
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    // The suite talks to a real MongoDB and shares one connection, so files run
    // one at a time rather than fighting over the same database.
    fileParallelism: false,
    hookTimeout: 30_000,
    testTimeout: 30_000,
  },
});
