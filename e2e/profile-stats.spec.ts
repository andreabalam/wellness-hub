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

/** Ensure we're on the Tracker food inner-tab (the default). */
async function goToTrackerStats(page: import('@playwright/test').Page) {
  await expect(page.getByRole('button', { name: '+ Log food' })).toBeVisible()
}

/** Switch to the Workouts tab. */
async function goToWorkoutsStats(page: import('@playwright/test').Page) {
  await page
    .locator('nav.tabs')
    .getByRole('button', { name: /Workouts/i })
    .click()
}

/**
 * Return a locator scoped to the currently active tab view.
 * Both TrackerTab and WorkoutsTab are always mounted (CSS-toggled), so
 * without scoping, getByText / getByPlaceholder can find duplicate elements
 * in the hidden tab and trip Playwright's strict-mode check.
 */
function activeView(page: import('@playwright/test').Page) {
  return page.locator('.view.active')
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

  test('shows "+ Set up" button in Tracker tab when no stats are configured', async ({ page }) => {
    await goToTrackerStats(page)
    await expect(activeView(page).getByRole('button', { name: '+ Set up' })).toBeVisible()
  })

  test('shows "+ Set up" button in Workouts tab when no stats are configured', async ({ page }) => {
    await goToWorkoutsStats(page)
    await expect(activeView(page).getByRole('button', { name: '+ Set up' })).toBeVisible()
  })

  // ── Opening the form ───────────────────────────────────────────

  test('clicking "+ Set up" opens the profile form', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(activeView(page).getByPlaceholder('65')).toBeVisible() // weight
    await expect(activeView(page).getByPlaceholder('1.70')).toBeVisible() // height (actual placeholder)
  })

  test('form has Body, Lifestyle and Goals sections', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    // Use exact:true — "Body" appears many times on page as a substring
    await expect(activeView(page).getByText('Body', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('Lifestyle', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('Goals', { exact: true })).toBeVisible()
  })

  // ── Saving stats ───────────────────────────────────────────────

  test('saving body stats shows the collapsed stat tiles', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()

    await activeView(page).getByPlaceholder('65').fill('70')
    await activeView(page).getByPlaceholder('1.70').fill('1.70')

    await activeView(page).getByRole('button', { name: 'Save' }).click()

    await expect(activeView(page).getByText('70 kg', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('Weight', { exact: true })).toBeVisible()
  })

  test('after saving, button label changes to "✎ Edit"', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('68')
    await activeView(page).getByRole('button', { name: 'Save' }).click()
    await expect(activeView(page).getByRole('button', { name: '✎ Edit' })).toBeVisible()
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

    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '✎ Edit' }).click()
    await expect(activeView(page).getByPlaceholder('65')).toHaveValue('72')
  })

  test('"✕ Close" button closes the form without saving', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(activeView(page).getByPlaceholder('65')).toBeVisible()

    await activeView(page).getByRole('button', { name: '✕ Close' }).click()
    await expect(activeView(page).getByPlaceholder('65')).not.toBeVisible()
    await expect(activeView(page).getByRole('button', { name: '+ Set up' })).toBeVisible()
  })

  // ── Shared data between tabs ───────────────────────────────────

  test('stats saved in Tracker are reflected in Workouts tab', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('75')
    await activeView(page).getByRole('button', { name: 'Save' }).click()

    await goToWorkoutsStats(page)
    // Use exact:true so the summary line "75 kg · …" doesn't cause a strict violation
    await expect(activeView(page).getByText('75 kg', { exact: true })).toBeVisible()
  })

  test('stats saved in Workouts are reflected in Tracker tab', async ({ page }) => {
    await goToWorkoutsStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('63')
    await activeView(page).getByRole('button', { name: 'Save' }).click()

    await page
      .locator('nav.tabs')
      .getByRole('button', { name: /Tracker/i })
      .click()
    await goToTrackerStats(page)
    await expect(activeView(page).getByText('63 kg', { exact: true })).toBeVisible()
  })

  // ── Derived targets ────────────────────────────────────────────

  test('TDEE and daily calorie target tiles appear when TDEE is entered', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('70')
    // TDEE input — actual placeholder is "2 100" (with space), use substring match
    await activeView(page).locator('input[placeholder*="100"]').fill('2200')
    await activeView(page).getByRole('button', { name: 'Save' }).click()

    await expect(activeView(page).getByText('TDEE', { exact: true })).toBeVisible()
    // Multiple elements contain "2,200 kcal" (macro bar, TDEE tile, kcal-target tile)
    await expect(activeView(page).getByText('~2,200 kcal', { exact: true }).first()).toBeVisible()
  })

  // ── Persistence ────────────────────────────────────────────────

  test('saved stats persist after page reload', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('69')
    await activeView(page).getByRole('button', { name: 'Save' }).click()
    await expect(activeView(page).getByText('69 kg', { exact: true })).toBeVisible()

    await page.reload()
    await expect(activeView(page).getByText('69 kg', { exact: true })).toBeVisible()
  })

  // ── Fill from Oura button ─────────────────────────────────────

  test('"↺ Fill from Oura" button is visible when user is signed in', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(activeView(page).getByRole('button', { name: /Fill from Oura/i })).toBeVisible()
  })

  // ── Measurements section ───────────────────────────────────────

  test('form shows Measurements section', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(activeView(page).getByText('Measurements', { exact: true })).toBeVisible()
  })

  test('form shows cm and in toggle buttons, defaulting to cm', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await expect(activeView(page).getByRole('button', { name: 'cm' })).toBeVisible()
    await expect(activeView(page).getByRole('button', { name: 'in' })).toBeVisible()
    // cm placeholder appears (75 for waist)
    await expect(activeView(page).getByPlaceholder('75')).toBeVisible()
  })

  test('switching to inches updates placeholders', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByRole('button', { name: 'in' }).click()
    await expect(activeView(page).getByPlaceholder('30')).toBeVisible()
    await expect(activeView(page).getByPlaceholder('37')).toBeVisible()
  })

  test('saving waist and glutes in cm shows tiles in collapsed grid', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('65') // weight (required for hasData)
    await activeView(page).getByPlaceholder('75').fill('80') // waist
    await activeView(page).getByPlaceholder('95').fill('100') // glutes
    await activeView(page).getByRole('button', { name: 'Save' }).click()
    await expect(activeView(page).getByText('Waist', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('80 cm', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('Glutes', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('100 cm', { exact: true })).toBeVisible()
  })

  test('saving measurements in inches shows tiles with "in" suffix', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('65')
    await activeView(page).getByRole('button', { name: 'in' }).click()
    await activeView(page).getByPlaceholder('30').fill('30')
    await activeView(page).getByPlaceholder('37').fill('37')
    await activeView(page).getByRole('button', { name: 'Save' }).click()
    await expect(activeView(page).getByText('30 in', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('37 in', { exact: true })).toBeVisible()
  })

  test('measurements persist after page reload', async ({ page }) => {
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '+ Set up' }).click()
    await activeView(page).getByPlaceholder('65').fill('65')
    await activeView(page).getByPlaceholder('75').fill('78')
    await activeView(page).getByPlaceholder('95').fill('97')
    await activeView(page).getByRole('button', { name: 'Save' }).click()
    await expect(activeView(page).getByText('78 cm', { exact: true })).toBeVisible()
    await page.reload()
    await expect(activeView(page).getByText('78 cm', { exact: true })).toBeVisible()
    await expect(activeView(page).getByText('97 cm', { exact: true })).toBeVisible()
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
    await goToTrackerStats(page)
    await activeView(page).getByRole('button', { name: '✎ Edit' }).click()
    await expect(activeView(page).getByPlaceholder('75')).toHaveValue('82')
    await expect(activeView(page).getByPlaceholder('95')).toHaveValue('98')
  })
})
