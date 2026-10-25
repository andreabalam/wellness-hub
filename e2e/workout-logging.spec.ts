import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

// Logging sets on a phone: start a plan workout, log sets, leave mid-workout,
// resume after a reload, finish, and see it on Today.

const MOCK_USER = JSON.stringify({
  id: 'e2e-test-id',
  email: 'test@e2e.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
})

async function openTrain(page: Page) {
  await page.locator('nav.tabs').getByRole('tab', { name: /Train/i }).click()
}

test.describe('Train tab — set logging (mobile)', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(user => sessionStorage.setItem('__e2e_user__', user), MOCK_USER)
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await openTrain(page)
  })

  test('log sets, resume after reload, finish, see it on Today', async ({ page }) => {
    const panel = page.locator('#panel-workouts')
    // First plan day with exercises ("Start workout" when it happens to be today)
    await panel
      .getByRole('button', { name: /Start workout|Log this workout/ })
      .first()
      .click()

    const logger = page.getByRole('dialog', { name: 'Log workout' })
    await expect(logger).toBeVisible()
    // The first weighted exercise (some plan days open with a timed warm-up)
    const card = logger
      .locator('.logger-ex')
      .filter({ has: page.getByLabel('Set 1 kg', { exact: true }) })
      .first()

    await card.getByLabel('Set 1 reps', { exact: true }).fill('12')
    await card.getByLabel('Set 1 kg', { exact: true }).fill('20')
    await card.getByRole('button', { name: 'Set 1 done' }).click()
    // Ticking a set carries its numbers into the next one
    await expect(card.getByLabel('Set 2 kg', { exact: true })).toHaveValue('20')
    await card.getByRole('button', { name: 'More Set 2 kg' }).click()
    await expect(card.getByLabel('Set 2 kg', { exact: true })).toHaveValue('20.5')
    await card.getByRole('button', { name: 'Set 2 done' }).click()

    // Leave mid-workout and come back after a reload
    await logger.getByRole('button', { name: 'Close logger' }).click()
    await expect(logger).toBeHidden()
    await page.reload()
    await openTrain(page)
    await panel.getByRole('button', { name: /Resume workout/ }).click()
    await expect(card.getByLabel('Set 1 reps', { exact: true })).toHaveValue('12')
    await expect(card.getByRole('button', { name: 'Set 1 done' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    await logger.getByRole('button', { name: /Finish workout · 2\// }).click()
    await expect(page.getByText(/Workout saved · 1 exercise, 2 sets/)).toBeVisible()
    await expect(panel.getByText('✓ Logged · 2 sets')).toBeVisible()

    // The day card's activity list shows the sets; the weeks counter picks it up
    const summary = panel.getByText('1 exercise · 2 sets · 486 kg')
    await expect(summary).toBeVisible()
    await summary.click()
    await expect(panel.getByText('12×20, 12×20.5 kg')).toBeVisible()
    await expect(panel.locator('.week-counter__tile').nth(2)).toContainText('1')

    // Today shows a read-only line that links back to Train
    await page.locator('nav.tabs').getByRole('tab', { name: /Today/i }).click()
    await expect(page.locator('.train-summary')).toContainText('2 sets')
    await page.getByRole('button', { name: 'Open Train →' }).click()
    await expect(panel).toBeVisible()
  })

  test('finishing with no ticked sets keeps the logger open', async ({ page }) => {
    await page
      .locator('#panel-workouts')
      .getByRole('button', { name: /Start workout|Log this workout/ })
      .first()
      .click()
    const logger = page.getByRole('dialog', { name: 'Log workout' })
    await logger.getByRole('button', { name: /Finish workout/ }).click()
    await expect(page.getByText(/Tick ✓ on the sets you did/)).toBeVisible()
    await expect(logger).toBeVisible()
  })
})
