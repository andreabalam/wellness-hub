import { test, expect, devices } from '@playwright/test'

// The schedule sheet's close button must be reachable on a phone: full-size
// tap target, not covered by anything, inside the viewport.
const { defaultBrowserType: _browser, ...iPhone } = devices['iPhone 13']
test.use(iPhone)

test('schedule sheet close button is tappable on a phone', async ({ page }) => {
  await page.addInitScript(() =>
    sessionStorage.setItem(
      '__e2e_user__',
      JSON.stringify({
        id: 'e2e-test-id',
        email: 'test@e2e.com',
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '',
      }),
    ),
  )
  await page.goto('/')
  await page.getByRole('button', { name: 'Open schedule →' }).click()
  const close = page.getByRole('button', { name: 'Close schedule' })
  await expect(close).toBeVisible()
  const box = (await close.boundingBox())!
  expect(box.width).toBeGreaterThanOrEqual(44)
  expect(box.height).toBeGreaterThanOrEqual(44)
  expect(box.y).toBeGreaterThanOrEqual(0)
  await close.tap()
  await expect(page.getByRole('dialog', { name: 'Schedule' })).toBeHidden()
})
