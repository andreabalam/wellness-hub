import { test, expect } from '@playwright/test'
import { SCHEDULE_BLOCKS } from '../src/data/schedule'

const FAKE_USER = JSON.stringify({
  id: 'e2e-test-id',
  email: 'test@e2e.com',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
})

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
})

test('edit with pre-existing v1 schedule data', async ({ page }) => {
  // Seed v1 data (old format) — simulates a user upgrading from old code
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
    // Simulate old v1 data with a custom title
    const v1Blocks = [
      {
        id: 'default-8:00-Wake',
        time: '08:00',
        title: 'ORIGINAL TITLE',
        dur: '5 min',
        color: 'green',
        whyTxt: 'test',
        desc: '',
        phase: 'Morning',
      },
    ]
    localStorage.setItem('whub_schedule_v1', JSON.stringify(v1Blocks))
  })
  await page.reload()

  await page
    .locator('button')
    .filter({ hasText: /Schedule/ })
    .first()
    .click()
  await page.waitForTimeout(500)

  // Should show the v1 title in timeline
  const firstTitle = await page.locator('.ttitle').first().textContent()
  console.log('V1 data shows in timeline:', firstTitle)

  // Edit it
  await page.locator('button').filter({ hasText: '✎ Edit schedule' }).click()
  await page.waitForTimeout(400)

  await page.locator('button[title="Edit"]').first().click()
  await page.waitForTimeout(200)
  const input = page.getByPlaceholder('Block name')
  await input.clear()
  await input.fill('UPDATED V1 TITLE')
  await page.locator('text=Save block').first().click()
  await page.waitForTimeout(300)
  await page.locator('text=Done').click()
  await page.waitForTimeout(300)

  const afterEdit = await page.locator('.ttitle').first().textContent()
  console.log('After edit:', afterEdit)

  await page.screenshot({ path: '/tmp/v1-after-edit.png' })
})

test('edit shows immediately without needing to switch days', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    localStorage.clear()
  })
  await page.reload()

  await page
    .locator('button')
    .filter({ hasText: /Schedule/ })
    .first()
    .click()
  await page.waitForTimeout(400)

  const dayBefore = await page.locator('.ttitle').first().textContent()
  console.log('Before:', dayBefore)

  // Open editor, scope = This day only (default)
  await page.locator('button').filter({ hasText: '✎ Edit schedule' }).click()
  await page.waitForTimeout(400)

  // Confirm scope default
  const scopeStyle = await page
    .locator('button', { hasText: 'This day only' })
    .evaluate(el => window.getComputedStyle(el).background)
  console.log(
    'This day only background:',
    scopeStyle.includes('58') ? 'TEAL (active)' : 'NOT ACTIVE',
  )

  // Make the edit
  await page.locator('button[title="Edit"]').first().click()
  await page.waitForTimeout(200)
  await page.getByPlaceholder('Block name').fill('SCHEDULE EDIT TEST')
  await page.locator('text=Save block').first().click()
  await page.waitForTimeout(300)

  // Check the editor list updated
  const editorList = await page.locator('.tcard-s .ttr').first().textContent()
  console.log('Editor first block after save:', editorList)

  // Close
  await page.locator('text=Done').click()
  await page.waitForTimeout(300)

  // Check timeline
  const dayAfter = await page.locator('.ttitle').first().textContent()
  console.log('After:', dayAfter)

  if (dayAfter !== 'SCHEDULE EDIT TEST') {
    console.log('BUG: timeline did not update!')
    await page.screenshot({ path: '/tmp/bug-timeline.png' })
    // Dump localStorage state
    const ls = await page.evaluate(() => ({
      v1: localStorage.getItem('whub_schedule_v1'),
      v2: localStorage.getItem('whub_schedule_v2'),
    }))
    console.log('localStorage v1 length:', ls.v1?.length)
    console.log('localStorage v2 length:', ls.v2?.length)
    if (ls.v2) {
      const v2 = JSON.parse(ls.v2)
      const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()]
      console.log('v2 today blocks first title:', v2[todayKey]?.[0]?.title)
    }
  }
})
