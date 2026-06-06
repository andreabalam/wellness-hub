import { test, expect } from '@playwright/test'

// ── Suite ────────────────────────────────────────────────────────────────────

test.describe('Tracker tab', () => {
  test.beforeEach(async ({ page }) => {
    // addInitScript runs before any page scripts on every navigation (including
    // page.reload()), so the DEV mock-user bypass in App.tsx always sees a user.
    await page.addInitScript(() => {
      sessionStorage.setItem('__e2e_user__', JSON.stringify({
        id: 'e2e-test-id', email: 'test@e2e.com',
        app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '',
      }))
    })
    await page.goto('/')
    await page.evaluate(() => { localStorage.clear() })
    await page.reload()
    // App defaults to Tracker tab → Food inner-tab is visible
  })

  test("shows today's date in the date label", async ({ page }) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    await expect(page.getByText(today)).toBeVisible()
  })

  test('macro bars start at zero', async ({ page }) => {
    await expect(page.getByText('0 / 1,380 kcal')).toBeVisible()
    await expect(page.getByText('1,380 kcal remaining')).toBeVisible()
  })

  test('logging a meal updates macro totals', async ({ page }) => {
    await page.getByPlaceholder('Meal name (e.g. Berry Oats)').fill('Test Oats')
    await page.getByPlaceholder('kcal').fill('350')
    await page.getByPlaceholder('prot').fill('18')
    await page.getByPlaceholder('carb').fill('42')
    await page.getByPlaceholder('fat').fill('12')
    await page.getByRole('button', { name: '+ Log food' }).click()

    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    // Use exact match — after logging, a quick-add button "Test Oats (350)" also appears
    await expect(page.getByText('Test Oats', { exact: true })).toBeVisible()
  })

  test('quick-add populates macros from a preset food', async ({ page }) => {
    // Navigate to yesterday and log Berry Oats so it appears in recent meals today
    await page.getByRole('button', { name: '‹ Prev' }).click()
    await page.getByPlaceholder('Meal name (e.g. Berry Oats)').fill('Berry Oats')
    await page.getByPlaceholder('kcal').fill('350')
    await page.getByPlaceholder('prot').fill('12')
    await page.getByPlaceholder('carb').fill('55')
    await page.getByPlaceholder('fat').fill('8')
    await page.getByRole('button', { name: '+ Log food' }).click()

    // Navigate back to today — Berry Oats is now in recent meals
    await page.getByRole('button', { name: 'Next ›' }).click()
    await page.getByRole('button', { name: /Berry Oats \(350\)/ }).click()

    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    // Use exact match to avoid matching the quick-add button text
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()
  })

  test('removing a logged meal updates the totals', async ({ page }) => {
    await page.getByPlaceholder('Meal name (e.g. Berry Oats)').fill('Berry Oats')
    await page.getByPlaceholder('kcal').fill('350')
    await page.getByPlaceholder('prot').fill('12')
    await page.getByPlaceholder('carb').fill('55')
    await page.getByPlaceholder('fat').fill('8')
    await page.getByRole('button', { name: '+ Log food' }).click()
    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()

    // Click the × remove button next to the logged meal
    await page.locator('button:has-text("×")').first().click()
    await expect(page.getByText('0 / 1,380 kcal')).toBeVisible()
  })

  test('logging a workout shows confirmation', async ({ page }) => {
    // Switch to the Workout inner tab — use exact: true to avoid matching "💪 Workouts" nav button
    await page.getByRole('button', { name: 'Workout', exact: true }).click()
    await page.getByRole('button', { name: 'Pilates' }).first().click()
    await page.getByRole('button', { name: '+ Log workout' }).click()
    await expect(page.getByText('✓ Session logged')).toBeVisible()
  })

  test('logging meditation shows confirmation', async ({ page }) => {
    // Switch to the Meditation inner tab (check-in and notes live here too)
    await page.getByRole('button', { name: 'Meditation', exact: true }).click()
    await page.getByRole('button', { name: '13 min' }).click()
    await page.getByRole('button', { name: 'Log meditation' }).click()
    await expect(page.getByText(/Done: 13 min/)).toBeVisible()
  })

  test('saving check-in shows saved feedback', async ({ page }) => {
    // The daily check-in card lives inside the Meditation inner tab
    await page.getByRole('button', { name: 'Meditation', exact: true }).click()
    await page.getByRole('button', { name: 'Save check-in' }).click()
    await expect(page.getByRole('button', { name: 'Saved!' })).toBeVisible()
  })

  test('date navigation goes to previous day', async ({ page }) => {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(today.getDate() - 1)
    const label = yesterday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })

    await page.getByRole('button', { name: '‹ Prev' }).click()
    await expect(page.getByText(label)).toBeVisible()
  })

  test('Next button returns to current date after going to previous day', async ({ page }) => {
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    await page.getByRole('button', { name: '‹ Prev' }).click()
    await expect(page.getByText(today)).not.toBeVisible()
    await page.getByRole('button', { name: 'Next ›' }).click()
    await expect(page.getByText(today)).toBeVisible()
  })

  test('food log data persists after navigating away and back', async ({ page }) => {
    await page.getByPlaceholder('Meal name (e.g. Berry Oats)').fill('Berry Oats')
    await page.getByPlaceholder('kcal').fill('350')
    await page.getByPlaceholder('prot').fill('12')
    await page.getByPlaceholder('carb').fill('55')
    await page.getByPlaceholder('fat').fill('8')
    await page.getByRole('button', { name: '+ Log food' }).click()
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()

    // Switch tab — TrackerTab unmounts, then remounts and re-reads localStorage
    await page.locator('nav.tabs').getByRole('button', { name: /Schedule/i }).click()
    await page.locator('nav.tabs').getByRole('button', { name: /Tracker/i }).click()

    await expect(page.getByText('350 / 1,380 kcal')).toBeVisible()
    await expect(page.getByText('Berry Oats', { exact: true })).toBeVisible()
  })

  test('week strip shows current week days', async ({ page }) => {
    // The strip should show M T W T F S S
    const strip = page.locator('#root').getByText('M').first()
    await expect(strip).toBeVisible()
  })

  // ── Reminders ─────────────────────────────────────────────────
  // RemindersSection lives inside the Meditation inner-tab of TrackerTab.

  async function goToMeditation(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'Meditation' }).click()
    await expect(page.getByPlaceholder('New reminder…')).toBeVisible()
  }

  test('Reminders section is visible in the Meditation inner-tab', async ({ page }) => {
    await goToMeditation(page)
    await expect(page.getByPlaceholder('New reminder…')).toBeVisible()
  })

  test('can add a reminder', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Drink water')
    await page.locator('.rem-add-btn').click()
    await expect(page.getByText('Drink water')).toBeVisible()
    // Input is cleared after adding
    await expect(page.getByPlaceholder('New reminder…')).toHaveValue('')
  })

  test('pressing Enter adds a reminder', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Take vitamins')
    await page.getByPlaceholder('New reminder…').press('Enter')
    await expect(page.getByText('Take vitamins')).toBeVisible()
  })

  test('checking a reminder marks it done', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Morning walk')
    await page.locator('.rem-add-btn').click()
    const checkBtn = page.getByRole('button', { name: 'Check reminder' })
    await checkBtn.click()
    await expect(page.getByRole('button', { name: 'Uncheck reminder' })).toBeVisible()
  })

  test('unchecking a reminder marks it undone', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Stretching')
    await page.locator('.rem-add-btn').click()
    await page.getByRole('button', { name: 'Check reminder' }).click()
    await page.getByRole('button', { name: 'Uncheck reminder' }).click()
    await expect(page.getByRole('button', { name: 'Check reminder' })).toBeVisible()
  })

  test('can delete a reminder', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Delete me')
    await page.locator('.rem-add-btn').click()
    await expect(page.getByText('Delete me')).toBeVisible()
    await page.getByRole('button', { name: 'Delete reminder' }).click()
    await expect(page.getByText('Delete me')).not.toBeVisible()
  })

  test('reminders persist after page reload', async ({ page }) => {
    await goToMeditation(page)
    await page.getByPlaceholder('New reminder…').fill('Persistent reminder')
    await page.locator('.rem-add-btn').click()
    await expect(page.getByText('Persistent reminder')).toBeVisible()

    await page.reload()
    // After reload, navigate back to Meditation tab to see the persisted reminder
    await page.getByRole('button', { name: 'Meditation' }).click()
    await expect(page.getByText('Persistent reminder')).toBeVisible()
  })

  test('empty input does not add a reminder', async ({ page }) => {
    await goToMeditation(page)
    const countBefore = await page.locator('[aria-label="Check reminder"]').count()
    // Button is disabled when input is empty — verify it's disabled, not just that click is a no-op
    await expect(page.locator('.rem-add-btn')).toBeDisabled()
    // Pressing Enter on the empty input should also be a no-op
    await page.getByPlaceholder('New reminder…').press('Enter')
    const countAfter = await page.locator('[aria-label="Check reminder"]').count()
    expect(countAfter).toBe(countBefore)
  })

  test('shows empty state when no reminders exist', async ({ page }) => {
    await goToMeditation(page)
    await expect(page.getByText(/No reminders yet/i)).toBeVisible()
  })
})
