import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

// Accessibility smoke tests. We assert there are no serious/critical violations
// for the structural rules B6 addresses (roles, names, ARIA wiring, nested
// interactives). `color-contrast` is excluded — it's a separate, design-token
// level effort and would otherwise mask regressions in the rules we care about.
async function scan(page: import('@playwright/test').Page) {
  const results = await new AxeBuilder({ page }).disableRules(['color-contrast']).analyze()
  return results.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
}

test.describe('accessibility smoke', () => {
  test('default (tracker) view has no serious/critical a11y violations', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav.tabs')).toBeVisible()
    const violations = await scan(page)
    expect(violations.map(v => v.id)).toEqual([])
  })

  test('tab bar exposes proper tab semantics', async ({ page }) => {
    await page.goto('/')
    const tablist = page.getByRole('tablist', { name: /main sections/i })
    await expect(tablist).toBeVisible()
    // Each tab is a real tab with a selected state; one is selected at a time.
    const selected = page.getByRole('tab', { selected: true })
    await expect(selected).toHaveCount(1)
  })

  test('workouts view (content rendered) has no serious/critical violations', async ({ page }) => {
    await page.goto('/')
    await page
      .locator('nav.tabs')
      .getByRole('tab', { name: /Workouts/i })
      .click()
    await expect(page.getByText('3×/week Template')).toBeVisible()
    const violations = await scan(page)
    expect(violations.map(v => v.id)).toEqual([])
  })
})
