/**
 * E2E tests for the recipe import UI.
 *
 * The full file-upload flow (calling the edge function via supabase.auth.getSession)
 * requires live Supabase credentials which are not available in CI.  These tests
 * cover the static UI: import zone visibility, file input attributes, and the
 * sign-in gate message that appears when supabase is null.
 *
 * The actual extraction logic (preparePayload, importRecipeFromFile) is covered
 * by unit tests in src/test/recipeImport.test.ts.
 */
import { test, expect } from '@playwright/test'

test.describe('Recipe import UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        '__e2e_user__',
        JSON.stringify({
          id: 'e2e-test-id',
          email: 'test@e2e.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '',
        }),
      )
    })
    await page.goto('/')
    await page.evaluate(() => {
      localStorage.clear()
    })
    await page.reload()
    await page.getByRole('tab', { name: /Recipes/i }).click()
  })

  test('import zone is visible when opening "Add my recipe" modal', async ({ page }) => {
    await page.getByRole('button', { name: /add my recipe/i }).click()
    await expect(page.locator('.import-zone')).toBeVisible()
  })

  test('file input has correct accept attribute', async ({ page }) => {
    await page.getByRole('button', { name: /add my recipe/i }).click()
    const input = page.locator('[data-testid="recipe-file-input"]')
    await expect(input).toHaveAttribute('accept', /\.pdf/)
    await expect(input).toHaveAttribute('accept', /\.txt/)
    await expect(input).toHaveAttribute('accept', /\.png/)
  })

  test('import zone shows drop affordance text', async ({ page }) => {
    await page.getByRole('button', { name: /add my recipe/i }).click()
    await expect(page.locator('.import-zone__cta')).toContainText(/Drop a file|browse/i)
    await expect(page.locator('.import-zone__hint')).toContainText('PDF')
  })

  test('import zone is hidden in edit mode', async ({ page }) => {
    // Seed a custom recipe so there is something to edit
    await page.evaluate(() => {
      localStorage.setItem(
        'whub_custom_recipes_v1',
        JSON.stringify([
          {
            id: 1001,
            name: 'My Salad',
            cat: 'meal',
            type: 'Meal',
            color: 'var(--green)',
            sc: 'cg',
            tag: 'Fresh',
            prepL: '5 min',
            prepC: 'var(--green)',
            hk: 200,
            hp: '10g',
            hc: '20g',
            hf: '5g',
            mk: 200,
            mp: '10g',
            mc: '20g',
            mf: '5g',
            ings: [],
            steps: [],
            tip: '',
            custom: true,
            source: 'user',
          },
        ]),
      )
    })
    await page.reload()
    await page.getByRole('tab', { name: /Recipes/i }).click()

    // Expand the recipe card and click Edit
    const card = page.locator('.rcard').first()
    await card.click()
    await page.getByRole('button', { name: /edit recipe/i }).click()

    // Edit modal should NOT have an import zone
    await expect(page.locator('.import-zone')).not.toBeVisible()
    // But the save button should say "Save changes"
    await expect(page.getByText('Save changes')).toBeVisible()
  })

  test('uploading a file without supabase shows sign-in error', async ({ page }) => {
    // In E2E, supabase is null (no env vars), so any file upload shows the gate.
    await page.getByRole('button', { name: /add my recipe/i }).click()

    // Create a tiny in-memory file and set it on the hidden input
    const fileInput = page.locator('[data-testid="recipe-file-input"]')
    await fileInput.setInputFiles({
      name: 'recipe.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Step 1: do stuff'),
    })

    // The sign-in gate message should appear
    await expect(page.locator('.import-error')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('.import-error')).toContainText(/sign in/i)
  })
})
