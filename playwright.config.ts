import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  // The app stores one user's data, so specs share state and run in order.
  workers: 1,
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: {
    command:
      'pnpm --filter @calorie-donate/web start --port 3100 --hostname 127.0.0.1',
    url: 'http://127.0.0.1:3100/api/health',
    reuseExistingServer: false,
    // Every run starts from an empty in-memory PGlite database, the same
    // setup agents use, so no PostgreSQL server is needed.
    env: {
      DATABASE_URL: '',
      PGLITE_DATA_DIR: 'memory://',
      CALORIE_ESTIMATOR: 'mock',
    },
  },
});
