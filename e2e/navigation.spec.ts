import { test, expect } from '@playwright/test'

// Helper: target only the top-level tab bar buttons (avoids matching
// in-page buttons like "✎ Edit schedule" that also contain "Schedule")
const tabBar = (page: Parameters<typeof expect>[0]) =>
  (page as import('@playwright/test').Page).locator('nav.tabs')

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with Tracker tab active by default', async ({ page }) => {
    await expect(tabBar(page).getByRole('button', { name: /Tracker/i })).toHaveClass(/active/)
    await expect(page.getByText('My Daily Tracker')).toBeVisible()
  })

  test('switches to Schedule tab', async ({ page }) => {
    await tabBar(page).getByRole('button', { name: /Schedule/i }).click()
    await expect(tabBar(page).getByRole('button', { name: /Schedule/i })).toHaveClass(/active/)
    // Cognitive peak banner is the schedule's landmark element
    await expect(page.locator('.pbanner').first()).toBeVisible()
  })

  test('switches to Workouts tab', async ({ page }) => {
    await page.getByRole('button', { name: /Workouts/i }).click()
    await expect(page.getByText('Her Fat Loss')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Week 1' })).toBeVisible()
  })

  test('switches to Recipes tab', async ({ page }) => {
    await page.getByRole('button', { name: /Recipes/i }).click()
    await expect(page.getByRole('button', { name: '+ Add my recipe' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'All' })).toBeVisible()
  })

  test('switches to Tracker tab', async ({ page }) => {
    // Navigate away first, then switch back
    await tabBar(page).getByRole('button', { name: /Schedule/i }).click()
    await tabBar(page).getByRole('button', { name: /Tracker/i }).click()
    await expect(page.getByText('My Daily Tracker')).toBeVisible()
    await expect(page.getByRole('button', { name: 'TODAY' })).toBeVisible()
  })

  test('tabs retain their state when switching away and back', async ({ page }) => {
    // Go to Workouts, click Week 2
    await page.getByRole('button', { name: /Workouts/i }).click()
    await page.getByRole('button', { name: 'Week 2' }).click()
    await expect(page.getByText('Follicular Phase')).toBeVisible()

    // Switch away and back
    await tabBar(page).getByRole('button', { name: /Schedule/i }).click()
    await page.getByRole('button', { name: /Workouts/i }).click()
    // Week 2 content still showing (React state preserved)
    await expect(page.getByText('Follicular Phase')).toBeVisible()
  })
})
