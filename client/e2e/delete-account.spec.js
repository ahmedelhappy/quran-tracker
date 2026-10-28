// Flow 5: delete the account from Settings. The person is signed out, cannot
// sign back in, and the API holds nothing of theirs any more — progress,
// notes, bookmarks, to-dos or the account itself.
import { test, expect, API, createAccount, signIn, countsFor } from './support/test.js'

test('deleting the account signs out, blocks sign-in and leaves no data behind', async ({ page, request }) => {
  const account = await createAccount(request, {
    label: 'delete',
    onboard: { memorizedPages: [1, 2, 3], dailyNewPages: 1 },
  })
  const headers = { Authorization: `Bearer ${account.token}` }
  // Something in every kind of store the account can write to.
  for (const [path, data] of [
    ['annotations', { pageNumber: 2, verseKey: '2:3', kind: 'note', text: 'to revise' }],
    ['bookmarks', { pageNumber: 2, label: 'Al-Baqarah' }],
    ['todos', { text: 'Review page 2 after Fajr' }],
  ]) {
    const res = await request.post(`${API}/${path}`, { headers, data })
    expect(res.ok(), `${path}: ${await res.text()}`).toBe(true)
  }
  const before = await countsFor(request, account.id)
  expect(before).toMatchObject({ User: 1, UserProgress: 3, Annotation: 1, Bookmark: 1, Todo: 1 })

  await signIn(page, account)
  await page.goto('/settings')
  await page.getByRole('button', { name: 'Delete Account' }).click()
  await page.getByRole('button', { name: 'Yes, Delete' }).click()

  // Signed out and off the protected page. Where it lands races: the app
  // navigates to the landing page while the protected route, seeing no user,
  // redirects to /login. Either way nobody is signed in.
  await expect(page).toHaveURL(/\/(login)?$/)
  expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull()

  // The old token is dead, and the password no longer opens anything.
  expect((await request.get(`${API}/auth/me`, { headers })).status()).toBe(401)
  await page.goto('/login')
  await page.getByLabel('Email Address').fill(account.email)
  await page.getByLabel('Password', { exact: true }).fill(account.password)
  await page.getByRole('button', { name: 'Log In' }).click()
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  await expect(page).toHaveURL(/\/login$/)

  const after = await countsFor(request, account.id)
  // Every model that can hold a user's data is in the count: the admin endpoint
  // refuses (and countsFor fails) if one has no reference to a user it can follow.
  for (const [model, count] of Object.entries(after)) expect(count, model).toBe(0)
})
