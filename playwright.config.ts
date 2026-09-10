import { defineConfig } from '@playwright/test';

/**
 * Smoke/crawler suite only — this is not a full E2E harness. It runs against
 * whatever dev server is already listening on :3000 (VITE_DEMO_MODE=true, so
 * the app boots straight into the Super Admin persona with no login step).
 *
 * `webServer` is intentionally omitted: this project's server reads .env via
 * dotenv at process start, and flipping VITE_DEMO_MODE for a CI-managed
 * server would fight whatever the developer already has running locally.
 * Start `npm run dev` yourself before `npx playwright test`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
});
