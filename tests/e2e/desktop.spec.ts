import { expect, test, type Locator, type Page } from '@playwright/test'

test.describe.configure({ mode: 'serial' })

test('supports the complete library workflow', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
  await expect(page.locator('.home-today')).toContainText('2 decks')
  await expect(page.getByText(/due today/)).toBeVisible()

  await page.getByRole('button', { name: 'Folder', exact: true }).click()
  await fillDialog(page, 'New folder', { Name: 'E2E Folder' }, 'Create folder')
  await expect(page.getByRole('heading', { name: 'E2E Folder' })).toBeVisible()

  await chooseMore(page, 'Rename')
  await fillDialog(page, 'Rename folder', { Name: 'E2E Folder Renamed' }, 'Save')
  await expect(page.getByRole('heading', { name: 'E2E Folder Renamed' })).toBeVisible()

  await chooseMore(page, 'Move')
  await page.getByRole('dialog', { name: 'Move to' }).getByRole('button', { name: 'Library' }).click()

  await page.getByRole('button', { name: 'Deck', exact: true }).click()
  await fillDialog(page, 'New deck', { Name: 'E2E Deck' }, 'Create deck')
  await expect(page.getByRole('heading', { name: 'E2E Deck' })).toBeVisible()
  await expect(page.getByText('No cards yet')).toBeVisible()

  await page.getByRole('button', { name: 'Card', exact: true }).click()
  await fillDialog(
    page,
    'New card',
    { Front: 'What does a deterministic test avoid?', Back: '**Flaky timing**' },
    'Save card',
  )
  await expect(page.getByText('What does a deterministic test avoid?')).toBeVisible()
  await expect(page.getByText('Flaky timing')).toBeVisible()

  const card = cardWithText(page, 'What does a deterministic test avoid?')
  await card.getByRole('button', { name: 'Edit' }).click()
  await fillDialog(
    page,
    'Edit card',
    { Front: 'What does a stable test avoid?', Back: '**Flaky timing**' },
    'Save card',
  )
  await expect(page.getByText('What does a stable test avoid?')).toBeVisible()

  await page.getByRole('button', { name: 'Import', exact: true }).click()
  const importDialog = page.getByRole('dialog', { name: 'Import cards' })
  await importDialog.getByRole('textbox', { name: 'Cards' }).fill(
    'What keeps persistence authoritative?\n- **SQLite**\n\nWhat validates server input?\n- **Zod**',
  )
  await importDialog.getByRole('button', { name: 'Import', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Imported 2 cards')
  await expect(page.getByText('What keeps persistence authoritative?')).toBeVisible()

  await page.getByRole('button', { name: 'New', exact: false }).click()
  await expect(page.getByText('What validates server input?')).toBeVisible()
  await page.getByRole('button', { name: 'New', exact: false }).click()

  await cardWithText(page, 'What does a stable test avoid?').getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog', { name: 'Delete card?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('What does a stable test avoid?')).toHaveCount(0)

  await chooseMore(page, 'Rename')
  await fillDialog(page, 'Rename deck', { Name: 'E2E Deck Renamed' }, 'Save')
  await expect(page.getByRole('heading', { name: 'E2E Deck Renamed' })).toBeVisible()

  await chooseMore(page, 'Move')
  await page.getByRole('dialog', { name: 'Move to' }).getByRole('button', { name: 'Library' }).click()

  await chooseMore(page, 'Delete')
  await page.getByRole('dialog', { name: 'Delete deck?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()

  await page.getByLabel('Folders and decks').getByRole('button', { name: /E2E Folder Renamed/ }).click()
  await chooseMore(page, 'Delete')
  await page.getByRole('dialog', { name: 'Delete folder?' }).getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: /E2E Folder Renamed/ })).toHaveCount(0)
})

test('records answers and supports keyboard study controls', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Decks with cards due').getByRole('button', { name: /Architecture vs Organization/ }).click()

  await expect(page.getByRole('heading', { name: 'Architecture vs Organization' })).toBeVisible()
  await expect(page.locator('.deck-overview__summary')).toContainText('due')
  await page.getByRole('button', { name: /Study \d+/ }).click()

  await expect(page.getByLabel('Answer choices')).toBeVisible()
  await expect(page.getByLabel('Answer choices').getByRole('button')).toHaveCount(4)
  await page.keyboard.press('1')
  await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(page.getByText(/Round 1/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('heading', { name: 'Architecture vs Organization' })).toBeVisible()
})

function cardWithText(page: Page, text: string): Locator {
  return page.getByRole('article').filter({ hasText: text })
}

async function chooseMore(page: Page, name: string) {
  const button = page.locator('.actions-menu').getByRole('button', { name, exact: true })
  if (!(await button.isVisible())) {
    await page.getByLabel('More actions').click()
  }
  await button.click()
}

async function fillDialog(
  page: Page,
  title: string,
  fields: Record<string, string>,
  action: string,
) {
  const dialog = page.getByRole('dialog', { name: title })
  await expect(dialog).toBeVisible()
  for (const [label, value] of Object.entries(fields)) {
    await dialog.getByRole('textbox', { name: new RegExp(`^${label}`) }).fill(value)
  }
  await dialog.getByRole('button', { name: action, exact: true }).click()
  await expect(dialog).toBeHidden()
}
