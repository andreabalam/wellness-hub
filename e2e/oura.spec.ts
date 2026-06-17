import { test, expect } from '@playwright/test'

// Shared mock user injected before every test
const MOCK_USER = JSON.stringify({
  id: 'e2e-test-id',
  email: 'test@e2e.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
})

test.describe('Oura tab — unauthenticated', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('Oura tab is visible in the nav bar', async ({ page }) => {
    await expect(page.locator('nav.tabs').getByRole('button', { name: /Oura/i })).toBeVisible()
  })

  test('shows sign-in gate for unauthenticated users', async ({ page }) => {
    await page.locator('nav.tabs').getByRole('button', { name: /Oura/i }).click()
    await expect(page.getByText(/Sign in to view your Oura dashboard/i)).toBeVisible()
  })
})

test.describe('Oura tab — authenticated, no token', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(user => {
      sessionStorage.setItem('__e2e_user__', user)
    }, MOCK_USER)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.locator('nav.tabs').getByRole('button', { name: /Oura/i }).click()
  })

  test('shows OAuth connect screen instead of PAT form', async ({ page }) => {
    // Must show the new OAuth button, never the old PAT input
    await expect(page.getByRole('button', { name: /Connect with Oura/i })).toBeVisible()
    await expect(page.locator('input[type="password"]')).not.toBeVisible()
    await expect(page.locator('input[placeholder*="PAT"]')).not.toBeVisible()
    await expect(page.locator('input[placeholder*="token"]')).not.toBeVisible()
  })

  test('connect screen shows the ring emoji and title', async ({ page }) => {
    await expect(page.getByText('Connect Oura Ring')).toBeVisible()
  })

  test('connect screen explains OAuth flow', async ({ page }) => {
    await expect(page.getByText(/redirected to Oura/i)).toBeVisible()
  })

  test('connect screen shows security note about encrypted tokens', async ({ page }) => {
    await expect(page.getByText(/AES-256 encrypted/i)).toBeVisible()
  })

  test('Connect with Oura button initiates OAuth redirect', async ({ page }) => {
    // When VITE_OURA_CLIENT_ID is set, clicking the button stores OAuth state in
    // sessionStorage and redirects to Oura. In E2E we intercept the navigation.
    let redirected = false
    page.on('request', req => {
      if (req.url().includes('ouraring.com/oauth/authorize')) redirected = true
    })

    // Don't await — navigation away from app is expected
    page
      .getByRole('button', { name: /Connect with Oura/i })
      .click()
      .catch(() => {})
    // Give the redirect a moment to fire
    await page.waitForTimeout(500)

    // sessionStorage should have the CSRF state set before navigation
    const state = await page
      .evaluate(() => sessionStorage.getItem('oura_oauth_state'))
      .catch(() => null)
    // Either the redirect happened (Oura URL) or state was stored (redirect blocked by missing clientId)
    // Either outcome proves the button was handled correctly — no silent failure
    const url = page.url()
    const isHandled = redirected || url.includes('ouraring.com') || state !== null
    expect(isHandled).toBe(true)
  })
})

test.describe('Oura tab — OAuth callback handling', () => {
  test.beforeEach(async ({ page }) => {
    // Both __e2e_user__ and oura_oauth_state must be in sessionStorage before
    // any navigation so consumeOAuthCallback() (which now runs at state-init
    // time) can validate them. oura_oauth_state is harmless during the initial
    // goto('/') because consumeOAuthCallback() returns early when ?code= is absent.
    await page.addInitScript(user => {
      sessionStorage.setItem('__e2e_user__', user)
      sessionStorage.setItem('oura_oauth_state', 'test-state-value')
    }, MOCK_USER)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
  })

  test('app detects ?code=&state= params on load and switches to Oura tab', async ({ page }) => {
    await page.goto('?code=fake-auth-code&state=test-state-value')

    // consumeOAuthCallback() should switch the app to the Oura tab
    await expect(page.locator('nav.tabs').getByRole('button', { name: /Oura/i })).toHaveClass(
      /active/,
      { timeout: 5000 },
    )

    // consumeOAuthCallback clears the query string with history.replaceState —
    // if this passes, the callback ran successfully (state matched, code consumed)
    await expect(page).not.toHaveURL(/[?&]code=/)
  })

  test('mismatched state param is ignored — no tab switch', async ({ page }) => {
    // No matching state in sessionStorage → callback is a CSRF attempt, ignore it
    await page.goto('?code=fake-code&state=wrong-state')
    // Should stay on Tracker tab (default), not switch to Oura
    await expect(page.locator('nav.tabs').getByRole('button', { name: /Tracker/i })).toHaveClass(
      /active/,
    )
  })
})
