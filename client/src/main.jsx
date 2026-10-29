import { i18nReady } from './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { installStaleChunkReload } from './utils/staleChunkReload'
import { installGlobalErrorHandlers } from './utils/reportError'
import './index.css'

// Before any lazy chunk is requested.
installStaleChunkReload()
// Uncaught errors and unhandled rejections go to the same hook as the error
// boundaries' (utils/reportError.js — where an error service would be wired).
installGlobalErrorHandlers()

// After the active language's strings have arrived (they are a file of their
// own). It settles even if they could not be fetched, or never answered (each
// try is cut after a few seconds): i18n.js has retried by
// then and fallen back to English, or, if English failed too, the app renders
// with raw keys and a toast that says why — still better than a blank page.
i18nReady.finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
