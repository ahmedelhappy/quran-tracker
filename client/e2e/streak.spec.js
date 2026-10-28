// Flow 2: completing a review starts the streak on the dashboard, and undoing
// it takes the streak back to where it was — on screen and on the server.
import { test, expect, API, createAccount, signIn } from './support/test.js'

// A task card is the bordered row that holds "Page N".
const taskCard = (page, pageNumber) => page.locator('div.border-s-4', {
  has: page.getByText(`Page ${pageNumber}`, { exact: true }),
})

test('complete a review, see the streak start, undo it and see it go back', async ({ page, request }) => {
  // Juz 30 known and every day a working day: today has reviews from it.
  const pages = Array.from({ length: 23 }, (_, i) => 582 + i)
  const account = await createAccount(request, {
    label: 'streak',
    onboard: { memorizedPages: pages, dailyNewPages: 1 },
    profile: { offDays: [] },
  })
  await signIn(page, account)
  await page.goto('/dashboard')

  const chip = page.locator('[data-tour="streak"]')
  await expect(chip).toContainText('Start your streak today')

  // The first review card on today's list.
  const first = page.getByText(/^Page (58[2-9]|59\d|60[0-4])$/).first()
  await expect(first).toBeVisible()
  const pageNumber = Number((await first.textContent()).replace('Page ', ''))
  const card = taskCard(page, pageNumber)

  await card.getByRole('button', { name: 'Mark as Complete' }).click()
  await expect(card.getByText('✓ Done')).toBeVisible()
  await expect(chip).toContainText('1 day streak')

  const streakOnServer = async () => {
    const res = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${account.token}` } })
    return (await res.json()).data.currentStreak
  }
  expect(await streakOnServer()).toBe(1)

  await card.getByRole('button', { name: 'Undo' }).click()
  await expect(card.getByRole('button', { name: 'Mark as Complete' })).toBeVisible()
  await expect(chip).toContainText('Start your streak today')
  expect(await streakOnServer()).toBe(0)
})
