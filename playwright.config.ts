import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 4 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173/wellness-hub/',
    trace: 'on-first-retry',
    // Don't wait longer than 10 s for any element to appear
    actionTimeout: 10_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173/wellness-hub/',
    reuseExistingServer: !process.env.CI,
  },
})
