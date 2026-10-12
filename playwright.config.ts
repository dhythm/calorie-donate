import { tmpdir } from 'node:os';
import path from 'node:path';
import { defineConfig } from '@playwright/test';

// Every run starts from an empty single-user data file.
const dataFile = path.join(
  tmpdir(),
  `calorie-donate-e2e-${process.pid}-${Date.now()}.json`,
);

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
    env: { CALORIE_DONATE_DATA_FILE: dataFile, CALORIE_ESTIMATOR: 'mock' },
  },
});
