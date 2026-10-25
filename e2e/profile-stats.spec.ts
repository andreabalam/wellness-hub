import { test, expect } from '@playwright/test'

const MOCK_USER = JSON.stringify({
  id: 'e2e-test-id',
  email: 'test@e2e.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
})

// ── Helpers ───────────────────────────────────────────────────────

/** Open Profile & targets from the Today header (the app opens on Today). */
async function openProfile(page: import('@playwright/test').Page) {
  await page.locator('nav.tabs').getByRole('tab', { name: /Today/i }).click()
  await page.getByRole('button', { name: /Profile & targets/ }).click()
  await expect(profileSheet(page)).toBeVisible()
}

/** The Profile & targets sheet — scopes lookups away from the mounted tabs behind it. */
function profileSheet(page: import('@playwright/test').Page) {
  return page.getByRole('dialog', { name: 'Profile & targets' })
}

// ── Suite ─────────────────────────────────────────────────────────

test.describe('ProfileStatsCard', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(user => {
      sessionStorage.setItem('__e2e_user__', user)
    }, MOCK_USER)
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
      localStorage.removeItem('whub_body_stats_v1')
    })
    await page.reload()
  })

  // ── Initial state ──────────────────────────────────────────────

  test('shows "+ Set up" on Today when no stats are configured', async ({ page }) => {
    await openProfile(page)
    await expect(profileSheet(page).getByRole('button', { name: '+ Set up' })).toBeVisible()
  })

  test('Food and Train no longer carry their own Profile card', async ({ page }) => {
    for (const tab of [/Food/i, /Train/i]) {
      await page.locator('nav.tabs').getByRole('tab', { name: tab }).click()
      await expect(page.locator('.view.active').getByText('Profile & Targets')).toHaveCount(0)
    }
  })

  // ── Opening the form ───────────────────────────────────────────

  test('clicking "+ Set up" opens the profile form', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(profileSheet(page).getByPlaceholder('65')).toBeVisible() // weight
    await expect(profileSheet(page).getByPlaceholder('1.70')).toBeVisible() // height (actual placeholder)
  })

  test('form has Body, Lifestyle and Goals sections', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    // Use exact:true — "Body" appears many times on page as a substring
    await expect(profileSheet(page).getByText('Body', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('Lifestyle', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('Goals', { exact: true })).toBeVisible()
  })

  // ── Saving stats ───────────────────────────────────────────────

  test('saving body stats shows the collapsed stat tiles', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()

    await profileSheet(page).getByPlaceholder('65').fill('70')
    await profileSheet(page).getByPlaceholder('1.70').fill('1.70')

    await profileSheet(page).getByRole('button', { name: 'Save' }).click()

    await expect(profileSheet(page).getByText('70 kg', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('Weight', { exact: true })).toBeVisible()
  })

  test('after saving, button label changes to "✎ Edit"', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('68')
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()
    await expect(profileSheet(page).getByRole('button', { name: '✎ Edit' })).toBeVisible()
  })

  // ── Editing ────────────────────────────────────────────────────

  test('clicking "✎ Edit" re-opens the form with current values', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'whub_body_stats_v1',
        JSON.stringify({
          weightKg: 72,
          heightM: 1.72,
          age: 30,
          biologicalSex: 'female',
          bodyFatPct: 22,
          cycleType: 'regular',
          equipment: 'Bodyweight only',
          fatLossRateKg: 0.5,
          macroSplit: 'balanced',
          tdeeKcal: 0,
          kcalTarget: 0,
          protRange: '',
          fatLossGoal: '',
          chronotype: 'bear',
        }),
      )
    })
    await page.reload()

    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '✎ Edit' }).click()
    await expect(profileSheet(page).getByPlaceholder('65')).toHaveValue('72')
  })

  test('"✕ Close" button closes the form without saving', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(profileSheet(page).getByPlaceholder('65')).toBeVisible()

    await profileSheet(page).getByRole('button', { name: '✕ Close' }).click()
    await expect(profileSheet(page).getByPlaceholder('65')).not.toBeVisible()
    await expect(profileSheet(page).getByRole('button', { name: '+ Set up' })).toBeVisible()
  })

  // ── Derived targets ────────────────────────────────────────────

  test('TDEE and daily calorie target tiles appear when TDEE is entered', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('70')
    // TDEE input — actual placeholder is "2 100" (with space), use substring match
    await profileSheet(page).locator('input[placeholder*="100"]').fill('2200')
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()

    await expect(profileSheet(page).getByText('TDEE', { exact: true })).toBeVisible()
    // Multiple elements contain "2,200 kcal" (macro bar, TDEE tile, kcal-target tile)
    await expect(profileSheet(page).getByText('~2,200 kcal', { exact: true }).first()).toBeVisible()
  })

  // ── Persistence ────────────────────────────────────────────────

  test('saved stats persist after page reload', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('69')
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()
    await expect(profileSheet(page).getByText('69 kg', { exact: true })).toBeVisible()

    await page.reload()
    await openProfile(page)
    await expect(profileSheet(page).getByText('69 kg', { exact: true })).toBeVisible()
  })

  // ── Fill from Oura button ─────────────────────────────────────

  test('"↺ Fill from Oura" button is visible when user is signed in', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(profileSheet(page).getByRole('button', { name: /Fill from Oura/i })).toBeVisible()
  })

  // ── Measurements section ───────────────────────────────────────

  test('form shows Measurements section', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(profileSheet(page).getByText('Measurements', { exact: true })).toBeVisible()
  })

  test('form shows cm and in toggle buttons, defaulting to cm', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(profileSheet(page).getByRole('button', { name: 'cm', exact: true })).toBeVisible()
    await expect(profileSheet(page).getByRole('button', { name: 'in', exact: true })).toBeVisible()
    // cm placeholder appears (75 for waist)
    await expect(profileSheet(page).getByPlaceholder('75')).toBeVisible()
  })

  test('switching to inches updates placeholders', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByRole('button', { name: 'in', exact: true }).click()
    await expect(profileSheet(page).getByPlaceholder('30')).toBeVisible()
    await expect(profileSheet(page).getByPlaceholder('37')).toBeVisible()
  })

  test('saving waist and glutes in cm shows tiles in collapsed grid', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('65') // weight (required for hasData)
    await profileSheet(page).getByPlaceholder('75').fill('80') // waist
    await profileSheet(page).getByPlaceholder('95').fill('100') // glutes
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()
    await expect(profileSheet(page).getByText('Waist', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('80 cm', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('Glutes', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('100 cm', { exact: true })).toBeVisible()
  })

  test('saving measurements in inches shows tiles with "in" suffix', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('65')
    await profileSheet(page).getByRole('button', { name: 'in', exact: true }).click()
    await profileSheet(page).getByPlaceholder('30').fill('30')
    await profileSheet(page).getByPlaceholder('37').fill('37')
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()
    await expect(profileSheet(page).getByText('30 in', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('37 in', { exact: true })).toBeVisible()
  })

  test('measurements persist after page reload', async ({ page }) => {
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '+ Set up' }).click()
    await profileSheet(page).getByPlaceholder('65').fill('65')
    await profileSheet(page).getByPlaceholder('75').fill('78')
    await profileSheet(page).getByPlaceholder('95').fill('97')
    await profileSheet(page).getByRole('button', { name: 'Save' }).click()
    await expect(profileSheet(page).getByText('78 cm', { exact: true })).toBeVisible()
    await page.reload()
    await openProfile(page)
    await expect(profileSheet(page).getByText('78 cm', { exact: true })).toBeVisible()
    await expect(profileSheet(page).getByText('97 cm', { exact: true })).toBeVisible()
  })

  test('editing re-opens form with previously saved measurements', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        'whub_body_stats_v1',
        JSON.stringify({
          weightKg: 65,
          waistCm: 82,
          glutesCm: 98,
          measurementUnit: 'cm',
          heightM: 1.65,
          bodyFatPct: 0,
          age: 0,
          biologicalSex: '',
          cycleType: 'none',
          equipment: '',
          chronotype: '',
          fatLossRateKg: 0,
          macroSplit: 'balanced',
          tdeeKcal: 0,
          kcalTarget: 0,
          protRange: '',
          fatLossGoal: '',
        }),
      )
    })
    await page.reload()
    await openProfile(page)
    await profileSheet(page).getByRole('button', { name: '✎ Edit' }).click()
    await expect(profileSheet(page).getByPlaceholder('75')).toHaveValue('82')
    await expect(profileSheet(page).getByPlaceholder('95')).toHaveValue('98')
  })
})
