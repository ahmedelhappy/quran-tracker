// Flow 3: in the Library, highlight a verse on page 50 and leave a note on it.
// Both survive a reload, and another account opening the same page sees neither.
import { test, expect, createAccount, signIn } from './support/test.js'

// A verse's first word. A plain click only selects a verse; its actions open on
// the secondary gesture — right-click (press-and-hold on touch).
const verse = (page, key) => page.locator(`[data-verse-key="${key}"][data-word-position="1"]`)

test('a highlight and a note persist across a reload and stay private', async ({ page, request, newIsolatedContext }) => {
  const alice = await createAccount(request, { label: 'alice', onboard: { dailyNewPages: 1 } })
  await signIn(page, alice)
  await page.goto('/library?page=50')

  const ayah2 = verse(page, '3:2')
  await expect(ayah2).toBeVisible()

  await ayah2.click({ button: 'right' })
  await page.getByRole('button', { name: 'Yellow highlight' }).click()
  await expect(page.getByText('Highlight saved')).toBeVisible()

  await ayah2.click({ button: 'right' })
  await page.getByRole('button', { name: 'Add a note' }).click()
  await page.getByPlaceholder('Write a note for this verse…').fill('Pairs with 2:255 — revise together')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Note saved')).toBeVisible()

  await page.reload()
  await expect(ayah2).toBeVisible()
  // Every word of the verse carries the colour, not just the one clicked.
  await expect(page.locator('[data-verse-key="3:2"].is-hl-yellow')).not.toHaveCount(0)
  await expect(page.locator('[data-verse-key="3:1"].is-hl-yellow')).toHaveCount(0)
  await page.getByRole('button', { name: 'This verse has a note — open it' }).click()
  await expect(page.getByPlaceholder('Write a note for this verse…')).toHaveValue('Pairs with 2:255 — revise together')

  // Someone else, on the same page in a separate browser profile.
  const bob = await createAccount(request, { label: 'bob', onboard: { dailyNewPages: 1 } })
  const bobPage = await (await newIsolatedContext()).newPage()
  await signIn(bobPage, bob)
  await bobPage.goto('/library?page=50')
  await expect(verse(bobPage, '3:2')).toBeVisible()
  await expect(bobPage.locator('.is-hl-yellow')).toHaveCount(0)
  await expect(bobPage.getByRole('button', { name: 'This verse has a note — open it' })).toHaveCount(0)
})
