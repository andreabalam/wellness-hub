import { test, expect } from '@playwright/test'

// Helper: target only the top-level tab bar buttons
const tabBar = (page: Parameters<typeof expect>[0]) =>
  (page as import('@playwright/test').Page).locator('nav.tabs')

test.describe('Tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('loads with Today active by default', async ({ page }) => {
    await expect(tabBar(page).getByRole('tab', { name: /Today/i })).toHaveClass(/active/)
    // Today shows an auth gate for unauthenticated users
    await expect(page.getByText(/Sign in to see/i)).toBeVisible()
  })

  test('has four tabs: Today, Food, Train and Insights', async ({ page }) => {
    await expect(tabBar(page).getByRole('tab')).toHaveText([/Today/, /Food/, /Train/, /Insights/])
  })

  test('switches to Train tab', async ({ page }) => {
    await page.getByRole('tab', { name: /Train/i }).click()
    // Guest users see the male full-body template (no auth required)
    await expect(page.getByText('3×/week Template')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Week 1' })).toBeVisible()
  })

  test('Food › Recipes & grocery shows the recipes sign-in gate', async ({ page }) => {
    await tabBar(page).getByRole('tab', { name: /Food/i }).click()
    await page.getByRole('tab', { name: 'Recipes & grocery' }).click()
    // Unauthenticated users see the sign-in gate (no filter bar)
    await expect(page.getByText(/Create, save and organise your personal recipes/i)).toBeVisible()
    await expect(page.locator('input[placeholder*="Search recipes"]')).not.toBeVisible()
  })

  test('switches to Food tab', async ({ page }) => {
    await tabBar(page).getByRole('tab', { name: /Food/i }).click()
    // Food shows the auth gate for unauthenticated users
    await expect(page.getByText(/Sign in to use/i)).toBeVisible()
  })

  test('switches to Insights showing its sign-in gate when unauthenticated', async ({ page }) => {
    await tabBar(page)
      .getByRole('tab', { name: /Insights/i })
      .click()
    await expect(tabBar(page).getByRole('tab', { name: /Insights/i })).toHaveClass(/active/)
    await expect(page.getByText(/Sign in to see Insights/i)).toBeVisible()
  })

  test('tabs retain their state when switching away and back', async ({ page }) => {
    // Go to Train, click Week 2
    await page.getByRole('tab', { name: /Train/i }).click()
    await page.getByRole('button', { name: 'Week 2' }).click()
    // Guest users see the male template; Week 2 is "Progressive Overload"
    await expect(page.getByText(/Progressive Overload/)).toBeVisible()

    // Switch away and back
    await tabBar(page)
      .getByRole('tab', { name: /Insights/i })
      .click()
    await page.getByRole('tab', { name: /Train/i }).click()
    // Week 2 content still showing (React state preserved)
    await expect(page.getByText(/Progressive Overload/)).toBeVisible()
  })
})
