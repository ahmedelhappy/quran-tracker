// Builds the client against the e2e API and serves the build with
// `vite preview` — the production bundle, not the dev server, so the flows run
// the code that ships.
//
//   node e2e/support/web-server.js          (Playwright's webServer starts it)
//
// The build goes to node_modules/.cache/e2e-dist (ignored with node_modules),
// never to dist/, so an e2e run cannot leave a deployable build behind that
// points at a throwaway API.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, preview } from 'vite'

const CLIENT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const OUT_DIR = path.join(CLIENT_DIR, 'node_modules/.cache/e2e-dist')
const API_PORT = Number(process.env.E2E_API_PORT || 5140)
const WEB_PORT = Number(process.env.E2E_WEB_PORT || 5142)

// A variable already in the environment wins over client/.env, so a local
// .env pointing at the dev or production API cannot leak into this build.
process.env.VITE_API_URL = `http://127.0.0.1:${API_PORT}/api`

await build({
  root: CLIENT_DIR,
  logLevel: 'warn',
  build: { outDir: OUT_DIR, emptyOutDir: true },
})

// localhost, not 127.0.0.1: outside production the API's CORS allow-list takes
// any http://localhost:<port> origin.
const server = await preview({
  root: CLIENT_DIR,
  build: { outDir: OUT_DIR },
  preview: { host: 'localhost', port: WEB_PORT, strictPort: true },
})
server.printUrls()

const stop = () => server.close().finally(() => process.exit(0))
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
