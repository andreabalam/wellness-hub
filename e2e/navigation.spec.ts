import { test, expect } from '@playwright/test'

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with Schedule tab active', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Schedule/i })).toHaveClass(/active/)
    // Day nav is visible
    await expect(page.getByRole('button', { name: 'Monday' })).toBeVisible()
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
    await page.getByRole('button', { name: /Tracker/i }).click()
    await expect(page.getByText('My Daily Tracker')).toBeVisible()
    await expect(page.getByRole('button', { name: 'TODAY' })).toBeVisible()
  })

  test('tabs retain their state when switching away and back', async ({ page }) => {
    // Go to Workouts, click Week 2
    await page.getByRole('button', { name: /Workouts/i }).click()
    await page.getByRole('button', { name: 'Week 2' }).click()
    await expect(page.getByText('Follicular Phase')).toBeVisible()

    // Switch away and back
    await page.getByRole('button', { name: /Schedule/i }).click()
    await page.getByRole('button', { name: /Workouts/i }).click()
    // Week 2 content still showing (React state preserved)
    await expect(page.getByText('Follicular Phase')).toBeVisible()
  })
})
