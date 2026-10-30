// Flow 1: a new person registers, says they already know Juz 30 during
// onboarding, and lands on a dashboard holding today's tasks: the first new page
// and reviews drawn from Juz 30.
import { test, expect, API, countsFor, createAccount, signIn } from './support/test.js'

let counter = 0

test('register, pick Juz 30 in onboarding, and see today\'s tasks', async ({ page, request }) => {
  const email = `e2e-onboarding-${Date.now()}-${counter++}@example.com`

  await page.goto('/register')
  await page.getByLabel('Full Name').fill('New Reader')
  await page.getByLabel('Email Address').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('e2e-password-1')
  await page.getByLabel('Confirm Password').fill('e2e-password-1')
  await page.getByRole('button', { name: 'Create Account' }).click()

  await expect(page).toHaveURL(/\/onboarding$/)
  await page.getByRole('button', { name: "Let's Begin" }).click()

  // The Juz grid is the default tab; its tiles are labelled 1…30.
  await page.getByRole('button', { name: '30', exact: true }).click()
  await expect(page.getByText('1 Juz selected')).toBeVisible()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Generate My Plan' }).click()
  await page.getByRole('button', { name: 'Start My Journey' }).click()

  await expect(page).toHaveURL(/\/dashboard$/)
  // The default plan is one new page a day from the start of the mushaf, every
  // day a working day, so today always has page 1 to memorize…
  const newCard = page.getByText('Page 1', { exact: true })
  await expect(newCard).toBeVisible()
  // …and the known pages (582–604) come back as reviews.
  const reviewPages = page.getByText(/^Page (58[2-9]|59\d|60[0-4])$/)
  await expect(reviewPages.first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark as Complete' }).first()).toBeVisible()

  // And the server holds exactly Juz 30: 23 pages, for this account.
  const token = await page.evaluate(() => localStorage.getItem('token'))
  const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })
  const { data: user } = await me.json()
  expect(user.onboardingComplete).toBe(true)
  expect((await countsFor(request, user._id)).UserProgress).toBe(23)
})

// A failed save says why, not just "try again": here the server could not put
// back what it had written (L-18), so some pages may already be saved and the
// person is told to send the same selection again — which then finishes.
test('a failed onboarding save says why, and sending it again finishes', async ({ page, request }) => {
  const account = await createAccount(request, { label: 'onboarding-partial' })
  await signIn(page, account)
  await page.goto('/onboarding')
  await page.getByRole('button', { name: "Let's Begin" }).click()
  await page.getByRole('button', { name: '30', exact: true }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Generate My Plan' }).click()

  await page.route('**/api/progress/onboarding', (route) => route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ success: false, code: 'ONBOARDING_PARTIAL', message: 'Onboarding failed part-way' }),
  }), { times: 1 })
  await page.getByRole('button', { name: 'Start My Journey' }).click()
  await expect(page.getByText(/some of your pages may already be marked memorized/)).toBeVisible()
  await expect(page).toHaveURL(/\/onboarding$/)

  await page.getByRole('button', { name: 'Start My Journey' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  expect((await countsFor(request, account.id)).UserProgress).toBe(23)
})
