import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const CLIENT_DIR = fileURLToPath(new URL('.', import.meta.url))

// A build bakes the API's address into the bundle (services/api.js), so one
// made without it would ship a site whose every sign-in fails. Stop the build
// instead. `vite` (dev) and Vitest are not builds and keep the localhost
// fallback. loadEnv sees both the shell's environment and client/.env*.
const requireApiUrl = (mode) => {
  const url = loadEnv(mode, CLIENT_DIR, 'VITE_').VITE_API_URL?.trim()
  const hint = 'Set it to the API\'s base URL, e.g. VITE_API_URL=https://<your-api-host>/api ' +
    '(in client/.env for a local build, in the hosting project\'s environment variables for a deploy).'
  if (!url) throw new Error(`VITE_API_URL is not set, so this build would not know where the API is.\n${hint}`)
  let parsed
  try { parsed = new URL(url) } catch { parsed = null }
  if (!parsed || !/^https?:$/.test(parsed.protocol)) {
    throw new Error(`VITE_API_URL is not an http(s) URL: "${url}".\n${hint}`)
  }
}

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  if (command === 'build') requireApiUrl(mode)
  return {
    plugins: [react()],
    // Vitest reads this block; `vite build` ignores it. Unit tests sit next to the
    // code they cover (src/**/*.test.js); the Playwright flows in e2e/ are a
    // separate runner and must not be picked up here.
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      restoreMocks: true,
    },
  }
})
