// Flow 8: the keyboard alone (M-12). A dialog opened with Enter takes focus,
// keeps Tab inside, closes on Escape and hands focus back to what opened it;
// and the mushaf's verses can be selected, their actions opened and put away,
// and the page turned, without a pointer. Real key presses throughout; focus is
// placed on a starting control directly only where a flow would otherwise
// depend on the browser's Tab settings (Safari skips buttons by default).
import { test, expect, createAccount, signIn } from './support/test.js'

const focused = (page) => page.evaluate(() => {
  const a = document.activeElement
  return {
    name: a?.getAttribute('aria-label') || a?.textContent?.trim() || '',
    verse: a?.getAttribute('data-verse-key') ?? null,
    inDialog: !!a?.closest('[role="dialog"], [role="alertdialog"]'),
    inActions: !!a?.closest('[aria-labelledby="verse-actions-ref"]'),
  }
})

test('a dialog opened from the keyboard traps focus, closes on Escape and returns focus', async ({ page, request }) => {
  const account = await createAccount(request, { label: 'keyboard-dialog', onboard: { memorizedPages: [582, 583], dailyNewPages: 1 } })
  await signIn(page, account)
  await page.goto('/dashboard')

  const trigger = page.getByRole('button', { name: 'How to memorize', exact: true })
  await expect(trigger).toBeVisible()
  await trigger.focus()
  await page.keyboard.press('Enter')

  const dialog = page.getByRole('dialog', { name: 'How to memorize a page' })
  await expect(dialog).toBeVisible()
  await expect(dialog).toHaveAttribute('aria-modal', 'true')
  expect((await focused(page)).inDialog).toBe(true)
  // The page behind is out of reach while it is open.
  const behindInert = () => page.evaluate(() => !!document.getElementById('main-content')?.closest('[inert]'))
  expect(await behindInert()).toBe(true)

  // More presses than the dialog has stops, both ways: focus never leaves it.
  for (const key of ['Tab', 'Tab', 'Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab', 'Shift+Tab']) {
    await page.keyboard.press(key)
    expect((await focused(page)).inDialog, `after ${key}`).toBe(true)
  }

  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(trigger).toBeFocused()
  expect(await behindInert()).toBe(false)
})

test('a verse is selected, its actions opened and put away, and the page turned, by keyboard', async ({ page, request }) => {
  const account = await createAccount(request, { label: 'keyboard-library', onboard: { dailyNewPages: 1 } })
  await signIn(page, account)
  await page.goto('/library?page=50')

  const anchor = page.locator('.mushaf-word[role="button"][data-verse-key="3:2"]')
  await expect(anchor).toBeVisible()
  await expect(anchor).toHaveAccessibleName('Surah Aal-Imran, ayah 2')
  // The glyphs are private-use codepoints: none of them is exposed.
  await expect(page.locator('.mushaf-word > span:not([aria-hidden="true"])')).toHaveCount(0)

  // Tab moves verse to verse, in reading order.
  await page.locator('.mushaf-word[role="button"][data-verse-key="3:1"]').focus()
  await page.keyboard.press('Tab')
  await expect(anchor).toBeFocused()

  // Enter selects, as a click does…
  await page.keyboard.press('Enter')
  await expect(anchor).toHaveAttribute('aria-pressed', 'true')
  // …and Enter again opens the verse's actions, with focus in them.
  await page.keyboard.press('Enter')
  const actions = page.getByRole('group', { name: /Aal-Imran.*2/ })
  await expect(actions).toBeVisible()
  await expect.poll(async () => (await focused(page)).inActions).toBe(true)

  // Escape puts them away and focus back on the verse, still selected.
  await page.keyboard.press('Escape')
  await expect(actions).toHaveCount(0)
  await expect(anchor).toBeFocused()
  await expect(anchor).toHaveAttribute('aria-pressed', 'true')

  // The search box: "/" opens it as a modal dialog, Escape returns focus.
  await page.keyboard.press('/')
  const search = page.getByRole('dialog', { name: /search/i })
  await expect(search).toBeVisible()
  await expect(search.getByRole('combobox')).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(search).toHaveCount(0)
  await expect(anchor).toBeFocused()

  // An RTL book: ArrowLeft goes FORWARD, in both languages.
  await page.keyboard.press('Escape')
  await page.keyboard.press('ArrowLeft')
  await expect(page).toHaveURL(/page=51/)
})
