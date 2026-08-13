import { expect, test } from '@playwright/test'

test('keeps library and study controls usable on a phone', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByRole('button', { name: 'Open library' }).click()
  await expect(page.getByRole('navigation', { name: 'Study library' })).toBeVisible()
  await page.getByRole('navigation', { name: 'Study library' }).getByRole('button', { name: /Architecture vs Organization/ }).click()
  await expect(page.getByRole('heading', { name: 'Architecture vs Organization' })).toBeVisible()

  await page.getByRole('button', { name: /Study/ }).click()
  await expect(page.getByLabel('Answer choices')).toBeVisible()
  await expect(page.getByLabel('Answer choices').getByRole('button')).toHaveCount(4)
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByLabel('Answer choices').getByRole('button').first().click()
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Leave' }).click()

  await page.getByLabel('More actions').click()
  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'New card' })).toBeVisible()
  await page.getByRole('dialog', { name: 'New card' }).getByRole('button', { name: 'Cancel' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
