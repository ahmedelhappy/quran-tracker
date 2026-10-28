// Flow 4: change the daily goal and the rest days in Settings, and the week
// plan on the dashboard follows: two new pages a day, and tomorrow a rest day.
import { test, expect, API, createAccount, signIn, clearOfUtcMidnight } from './support/test.js'

const DAY_MS = 86400000
// The labels the app uses: the week plan's date heading, and the Settings
// checkbox for a weekday. "Today" is the UTC day, as on the server.
const dayHeading = (date) => date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' })
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

test('a new daily goal and rest day show up in the week plan', async ({ page, request }, testInfo) => {
  // "Today", "tomorrow" and the rest-day weekday below must be the server's too.
  await clearOfUtcMidnight(testInfo)
  const account = await createAccount(request, {
    label: 'plan',
    onboard: { dailyNewPages: 1 },
    profile: { offDays: [] },
  })
  const now = Date.now()
  const tomorrow = new Date(now + DAY_MS)
  const dayAfter = new Date(now + 2 * DAY_MS)

  await signIn(page, account)
  await page.goto('/settings?tab=memorization')

  await page.getByRole('button', { name: '2', exact: true }).click()
  // The checkboxes are "available" days: unticking one makes it a rest day.
  const tomorrowBox = page.getByLabel(SHORT_DAYS[tomorrow.getUTCDay()], { exact: true })
  await expect(tomorrowBox).toBeChecked()
  await tomorrowBox.uncheck()
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(page.getByText('Plan updated!')).toBeVisible()

  // Saved on the server, not just on screen.
  const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${account.token}` } })
  const { data: user } = await me.json()
  expect(user.dailyNewPages).toBe(2)
  expect(user.offDays).toEqual([tomorrow.getUTCDay()])

  await page.goto('/dashboard')
  await page.getByRole('button', { name: 'This Week' }).click()

  const dayCard = (date) => page.locator('div.overflow-hidden', { has: page.getByText(dayHeading(date), { exact: true }) })
  await expect(dayCard(new Date(now))).toContainText('Pages 1, 2')
  await expect(dayCard(tomorrow)).toContainText('Rest Day')
  await expect(dayCard(tomorrow)).not.toContainText('Pages')
  // The rest day does not eat pages: the plan picks up where today left off.
  await expect(dayCard(dayAfter)).toContainText('Pages 3, 4')
})
