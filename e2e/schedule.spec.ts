import { test, expect } from '@playwright/test'

test.describe('Schedule tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows Monday by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Monday' })).toHaveClass(/active/)
    // Multiple day panels exist in the DOM; check the first visible one
    await expect(page.locator('.pbanner').first()).toBeVisible()
    await expect(page.locator('.pbanner').first()).toContainText('Cognitive peak: 11 AM - 1 PM')
  })

  test('switching days updates the peak banner', async ({ page }) => {
    await page.getByRole('button', { name: 'Wednesday' }).click()
    await expect(page.getByText(/Leave headphones out/)).toBeVisible()
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

  test('PEAK block is visible in timeline', async ({ page }) => {
    // All day panels share the same blocks in DOM; check at least one is visible
    await expect(page.getByText('Deep work block').first()).toBeVisible()
  })
})
