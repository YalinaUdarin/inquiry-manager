import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Test files share one test database, so run them one at a time to stop
    // them from wiping each other's data mid-test.
    fileParallelism: false,
  },
});
