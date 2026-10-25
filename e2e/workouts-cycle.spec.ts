import { test, expect } from '@playwright/test'

// Cycle sync on the Workouts tab, anchored on a manual "Menstrual" tracker day.
// (Oura-tag anchors are covered by unit tests — the E2E mock user has no
// Supabase session, so Oura always reads as disconnected here.)

const MOCK_USER = JSON.stringify({
  id: 'e2e-test-id',
  email: 'test@e2e.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
})

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

test.describe('Workouts tab — cycle sync', () => {
  test.use({ viewport: { width: 390, height: 844 } })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(user => sessionStorage.setItem('__e2e_user__', user), MOCK_USER)
    await page.goto('/')
    await page.evaluate(periodDay => {
      localStorage.clear()
      localStorage.setItem(
        'whub_body_stats_v1',
        JSON.stringify({ weightKg: 60, cycleType: 'regular' }),
      )
      localStorage.setItem(
        'whub_tracker_v3',
        // A full DayData record — the tracker store rejects partial days.
        JSON.stringify({
          [periodDay]: {
            foods: [],
            workout: null,
            wkNotes: '',
            energy: 0,
            mood: 0,
            sleep: 0,
            stress: 0,
            water: 0,
            phase: 'Menstrual',
            notes: '',
            medMin: 0,
            medStyle: '',
          },
        }),
      )
    }, daysAgo(18))
    await page.reload()
    await page
      .locator('nav.tabs')
      .getByRole('tab', { name: /Workouts/i })
      .click()
  })

  test('opens on the luteal week and jumps to today', async ({ page }) => {
    const panel = page.locator('#panel-workouts')
    await expect(panel.getByText('Today · cycle day 19')).toBeVisible()
    await expect(panel.getByText('Luteal phase → Week 4')).toBeVisible()
    await panel.getByRole('button', { name: /Today's workout/ }).click()
    await expect(page.locator('#day-card-today')).toBeInViewport()
  })

  test('"My period started today" moves the plan to Week 1', async ({ page }) => {
    const panel = page.locator('#panel-workouts')
    await panel.getByRole('button', { name: 'My period started today' }).click()
    await expect(panel.getByText('Menstrual phase → Week 1')).toBeVisible()
    await page.reload()
    await page
      .locator('nav.tabs')
      .getByRole('tab', { name: /Workouts/i })
      .click()
    await expect(panel.getByText('Today · cycle day 1')).toBeVisible()
  })
})
