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
    // Disable Supabase for E2E: empty env (process env beats .env.local in
    // Vite) → the client is null, matching CI where .env.local doesn't exist.
    // This keeps local and CI runs identical and network-hermetic. Do NOT
    // point this at a fake URL instead — supabase-js hangs (not rejects) on
    // unreachable hosts, deadlocking the app's loading states.
    env: {
      VITE_SUPABASE_URL:      '',
      VITE_SUPABASE_ANON_KEY: '',
    },
  },
})
