import { test, expect } from '@playwright/test'

test.describe('Schedule tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Use the tab bar to avoid matching the in-page "✎ Edit schedule" button
    await page.locator('nav.tabs').getByRole('button', { name: /Schedule/i }).click()
  })

  test('shows the cognitive peak banner', async ({ page }) => {
    await expect(page.locator('.pbanner').first()).toBeVisible()
    await expect(page.locator('.pbanner').first()).toContainText('Cognitive peak: 11 AM - 1 PM')
  })

  test('timeline is populated with schedule blocks', async ({ page }) => {
    await expect(page.locator('.trow').first()).toBeVisible()
    // There should be multiple blocks
    await expect(page.locator('.trow')).toHaveCount(10)
  })

  test('clicking a schedule block expands its description', async ({ page }) => {
    const row = page.locator('.trow').first()
    await expect(row.locator('.tdet')).not.toBeVisible()
    await row.click()
    await expect(row.locator('.tdet')).toBeVisible()
  })

  test('clicking an open block collapses it', async ({ page }) => {
    const row = page.locator('.trow').first()
    await row.click()
    await expect(row.locator('.tdet')).toBeVisible()
    await row.click()
    await expect(row.locator('.tdet')).not.toBeVisible()
  })

  test('Deep work block is visible in timeline', async ({ page }) => {
    await expect(page.getByText('Deep work block').first()).toBeVisible()
  })

  test('Export .ics button reveals date range inputs', async ({ page }) => {
    await page.getByRole('button', { name: /Export .ics/i }).click()
    await expect(page.getByRole('button', { name: 'Download .ics' })).toBeVisible()
  })
})
