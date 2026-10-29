import { i18nReady } from './i18n'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { installStaleChunkReload } from './utils/staleChunkReload'
import './index.css'

// Before any lazy chunk can fail (the active language's is already on its way,
// but a failure only arrives after this module has run).
installStaleChunkReload()

// After the active language's strings have arrived (they are a chunk of their
// own). It settles even if they could not be fetched: i18next has already
// retried by then, and the app is still better than a blank page.
i18nReady.finally(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>,
  )
})
