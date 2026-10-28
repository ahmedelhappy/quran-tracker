// What every flow shares: a browser that cannot reach the internet, accounts
// made straight through the API, and a way to sign a page in as one of them.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test as base, expect } from '@playwright/test'

const API_PORT = Number(process.env.E2E_API_PORT || 5140)
const ADMIN_PORT = Number(process.env.E2E_ADMIN_PORT || 5141)
export const API = `http://127.0.0.1:${API_PORT}/api`
const ADMIN = `http://127.0.0.1:${ADMIN_PORT}`

const FIXTURES = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../fixtures')
const QURAN_COM_PAGE = /^https:\/\/api\.quran\.com\/api\/v4\/verses\/by_page\/(\d+)\?/

// First-run tours and hints would sit on top of what a flow clicks.
const SEEN_KEYS = ['seenDashboardTour', 'seenLibraryTour', 'seenMemorizeGuide', 'seenVerseActionsHint', 'seenVerseTap', 'seenVerseTapCue']

let counter = 0
const uniqueEmail = (label) => `e2e-${label}-${process.pid}-${Date.now()}-${counter++}@example.com`

// Only the app and its API are reachable. Mushaf pages a flow reads come from
// committed api.quran.com responses (e2e/fixtures/quran-com: the reader's own
// /verses/by_page request, recorded once and trimmed to the fields
// services/mushafApi.js reads); everything else
// outside — Google Fonts, audio, tafsir, the daily verse — fails at once, as
// offline, so no flow depends on a third party being up. The app already has a
// fallback for each of those. Used for every context a flow opens, including a
// second user's.
export const isolate = async (context, baseURL) => {
  await context.route('**/*', (route) => {
    const url = route.request().url()
    if (url.startsWith(baseURL) || url.startsWith(`http://127.0.0.1:${API_PORT}/`)) return route.continue()
    const page = url.match(QURAN_COM_PAGE)?.[1]
    const fixture = page && path.join(FIXTURES, 'quran-com', `page-${page}.json`)
    if (fixture && fs.existsSync(fixture)) {
      return route.fulfill({ contentType: 'application/json', body: fs.readFileSync(fixture) })
    }
    return route.abort('internetdisconnected')
  })
  await context.addInitScript((keys) => {
    for (const key of keys) localStorage.setItem(key, '1')
  }, SEEN_KEYS)
  return context
}

export const test = base.extend({
  context: async ({ context, baseURL }, provide) => {
    await provide(await isolate(context, baseURL))
  },
  // A second, separate browser profile (another person on another device).
  newIsolatedContext: async ({ browser, baseURL }, provide) => {
    const opened = []
    await provide(async () => {
      const context = await isolate(await browser.newContext({ baseURL }), baseURL)
      opened.push(context)
      return context
    })
    await Promise.all(opened.map((c) => c.close()))
  },
})

export { expect }

// Keeps a flow inside one UTC day. The server decides "today" each time it is
// asked, and a flow that reads the date itself (the week plan's headings) or
// undoes what it just did (the undo window ends at 00:00Z) breaks if midnight
// falls between two of those moments. A flow cannot outlast its 60 s timeout,
// so one that starts with more than 90 s left in the day finishes in it; one
// that starts later waits for the new day first. Call it before the flow
// creates anything: onboarding dates pages relative to "today" too.
const DAY_MS = 86_400_000
const MIDNIGHT_MARGIN_MS = 90_000
export const clearOfUtcMidnight = async (testInfo, now = Date.now()) => {
  const left = DAY_MS - (now % DAY_MS)
  if (left > MIDNIGHT_MARGIN_MS) return 0
  const wait = left + 1000
  testInfo.setTimeout(testInfo.timeout + wait)
  await new Promise((resolve) => setTimeout(resolve, wait))
  return wait
}

// Registers an account through the API. `onboard` also finishes onboarding
// (optionally with pages already memorized), so a flow can start on the
// dashboard instead of walking the wizard again.
export const createAccount = async (request, { label = 'user', onboard, profile } = {}) => {
  const email = uniqueEmail(label)
  const password = 'e2e-password-1'
  const res = await request.post(`${API}/auth/register`, { data: { name: `E2E ${label}`, email, password } })
  expect(res.status(), await res.text()).toBe(201)
  const { data } = await res.json()
  const account = { id: data._id, email, password, token: data.token }
  const authorization = { Authorization: `Bearer ${account.token}` }
  if (onboard) {
    const done = await request.post(`${API}/progress/onboarding`, { headers: authorization, data: onboard })
    expect(done.status(), await done.text()).toBe(200)
  }
  if (profile) {
    const saved = await request.put(`${API}/auth/profile`, { headers: authorization, data: profile })
    expect(saved.status(), await saved.text()).toBe(200)
  }
  return account
}

// Puts the account's token where the app keeps it, before the first page script
// runs. Only once per tab: an init script runs on every load, and putting the
// token back after the app has signed out (or deleted the account) would undo
// exactly what a flow is checking.
export const signIn = async (page, account) => {
  await page.addInitScript((token) => {
    if (sessionStorage.getItem('e2e-signed-in')) return
    sessionStorage.setItem('e2e-signed-in', '1')
    localStorage.setItem('token', token)
  }, account.token)
}

// How many documents each model still holds for a user (the e2e API's admin
// port; see e2e/support/api-server.cjs).
export const countsFor = async (request, userId) => {
  const res = await request.get(`${ADMIN}/counts/${userId}`)
  expect(res.ok(), await res.text()).toBe(true)
  return res.json()
}
