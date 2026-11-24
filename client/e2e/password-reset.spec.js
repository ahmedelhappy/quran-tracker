// Flow 9: a forgotten password (H-06). From the sign-in page, ask for a link;
// the confirmation reads the same for an address with no account; the emailed
// link (taken from the e2e API's capture transport) opens the reset page, which
// wipes the token from the URL; the new password signs in, the old one and the
// old session do not, and the link is dead once used.
import { test, expect, API, createAccount, resetLinkFor } from './support/test.js'

test('a forgotten password is reset from the emailed link, and only the new one signs in', async ({ page, request, baseURL }) => {
  const account = await createAccount(request, { label: 'reset', onboard: { dailyNewPages: 1 } })
  const oldSession = { Authorization: `Bearer ${account.token}` }

  await page.goto('/login')
  await page.getByLabel('Email Address').fill(account.email)
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  // What was typed on the sign-in form came along.
  await expect(page.getByLabel('Email Address')).toHaveValue(account.email)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  const confirmation = page.getByRole('main').getByRole('status')
  await expect(confirmation).toHaveText(`${account.email}If an account exists for this address, we've sent it a link to reset the password. The link works once, for 30 minutes. If nothing arrives in a few minutes, check your spam folder.`)
  const known = await confirmation.textContent()

  // An address with no account gets the very same answer.
  await page.getByRole('button', { name: 'Use a different email' }).click()
  const stranger = `nobody-${Date.now()}@example.com`
  await page.getByLabel('Email Address').fill(stranger)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(confirmation).toHaveText(known.replace(account.email, stranger))

  // The email goes out after the reply, so wait for the capture to have it.
  let link
  await expect.poll(async () => {
    try { link = await resetLinkFor(request, account.email) } catch { link = null }
    return link
  }).toBeTruthy()
  const url = new URL(link)
  expect(url.origin).toBe(new URL(baseURL).origin)
  expect(url.pathname).toBe('/reset-password')
  expect(url.search).toBe('')
  expect(url.hash).toMatch(/^#token=[A-Za-z0-9_-]{43}$/)

  await page.goto(link)
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()
  // The token is gone from the address bar (and this history entry).
  await expect(page).toHaveURL(/\/reset-password$/)
  expect(await page.evaluate(() => window.location.hash)).toBe('')
  await expect(page.locator('meta[name="referrer"]')).toHaveAttribute('content', 'no-referrer')

  const newPassword = 'brand-new-pass-1'
  await page.getByLabel('New Password').fill(newPassword)
  await page.getByLabel('Confirm Password').fill(newPassword)
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText('Your password has been reset. Sign in with your new password.')).toBeVisible()

  // Every session from before the reset has ended.
  // (Polled: the request context has sat idle through the UI steps, and the
  // API may have closed its kept-alive socket — a reset there is not an answer.)
  await expect.poll(() => request.get(`${API}/auth/me`, { headers: oldSession }).then((r) => r.status(), () => null)).toBe(401)

  // The old password no longer opens the account…
  await page.getByLabel('Email Address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.locator('#login-error')).toHaveText('Invalid email or password')
  // …the new one does.
  await page.getByLabel('Password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  // Let the sign-in's own navigation finish before leaving (WebKit otherwise
  // reports the next goto as interrupted by it).
  await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toBeVisible()

  // The link worked once: opening it again ends on "ask for a new one".
  await page.goto(link)
  await page.getByLabel('New Password').fill('third-password-1')
  await page.getByLabel('Confirm Password').fill('third-password-1')
  await page.getByRole('button', { name: 'Set new password' }).click()
  await expect(page.getByRole('heading', { name: "This link can't be used" })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute('href', '/forgot-password')
})
