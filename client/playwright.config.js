import { defineConfig, devices } from '@playwright/test'

// End-to-end flows: the production build (vite preview) against the real API on
// a throwaway in-memory MongoDB — see e2e/support/. `npm run test:e2e` starts
// both, runs the flows and stops them.
//
// Ports are fixed so the build can be pointed at the API; none of them is a
// default anything else here uses (5000 API, 5173 dev server, 4173 preview).
const API_PORT = Number(process.env.E2E_API_PORT || 5140)
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 5141)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5142)
const ports = { E2E_API_PORT: String(API_PORT), E2E_ADMIN_PORT: String(ADMIN_PORT), E2E_WEB_PORT: String(WEB_PORT) }
const isCI = !!process.env.CI
// E2E_REUSE_SERVERS=1 keeps stacks you started yourself (node e2e/support/*) —
// handy while writing a flow. Off by default, so a run never tests a stale build.
const reuse = !isCI && process.env.E2E_REUSE_SERVERS === '1'

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  forbidOnly: isCI,
  // A flow that fails is reported, not retried into a pass locally; CI gets one
  // retry (with a trace) so a runner hiccup is told apart from a real failure.
  // A flow that only passed on its retry is still flagged: the github reporter
  // puts its first failure on the run as an annotation, and the html report
  // (uploaded after every CI run) keeps that attempt's trace.
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : 3,
  reporter: isCI ? [['list'], ['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Locally, an installed Chrome saves downloading Playwright's browser:
        // PW_CHROME_PATH="C:/Program Files/Google/Chrome/Application/chrome.exe".
        // Unset (CI), Playwright's own Chromium is used — `npx playwright install chromium`.
        launchOptions: process.env.PW_CHROME_PATH ? { executablePath: process.env.PW_CHROME_PATH } : {},
      },
    },
  ],
  webServer: [
    {
      command: 'node e2e/support/api-server.cjs',
      url: `http://127.0.0.1:${API_PORT}/health`,
      env: ports,
      // A cold CI cache downloads mongod first.
      timeout: 180_000,
      reuseExistingServer: reuse,
      // Lets the API stop mongod itself on Linux/macOS (Windows always hard-kills).
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    {
      command: 'node e2e/support/web-server.js',
      url: `http://localhost:${WEB_PORT}`,
      env: ports,
      timeout: 180_000,
      reuseExistingServer: reuse,
      gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
  ],
})
