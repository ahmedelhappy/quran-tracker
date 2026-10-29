// Flow 6: when today's plan cannot be loaded, the dashboard says so with Retry
// (not "no new memorization today"), and Retry brings the plan once the API
// answers again (M-14).
import { test, expect, createAccount, signIn } from './support/test.js'

test('a failed plan shows an error with Retry, and Retry loads it', async ({ page, request }) => {
  const pages = Array.from({ length: 23 }, (_, i) => 582 + i)
  const account = await createAccount(request, {
    label: 'retry',
    onboard: { memorizedPages: pages, dailyNewPages: 1 },
    profile: { offDays: [] },
  })
  await signIn(page, account)

  // The plan's request fails with a 500 until `down` is cleared; the preflight
  // and every other request go through as usual.
  let down = true
  await page.route('**/api/progress/today**', (route) => {
    if (!down || route.request().method() === 'OPTIONS') return route.fallback()
    return route.fulfill({
      status: 500,
      headers: { 'access-control-allow-origin': '*' },
      contentType: 'application/json',
      body: '{"success":false,"message":"down"}',
    })
  })
  await page.goto('/dashboard')

  const alert = page.getByRole('alert').filter({ hasText: "Couldn't load today's plan" })
  await expect(alert).toBeVisible()
  await expect(page.getByText('No new memorization today.')).toHaveCount(0)

  down = false
  await alert.getByRole('button', { name: 'Retry' }).click()
  await expect(alert).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark as Complete' }).first()).toBeVisible()
})
