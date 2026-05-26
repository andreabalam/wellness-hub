import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App'

// Register service worker and expose the update callback globally so
// App.tsx can pass it to <UpdatePrompt />.
// `registerType: 'prompt'` means the new SW waits — calling updateSW()
// skips waiting and reloads to activate the new version.
let swUpdateCallback: (() => void) | null = null

const updateSW = registerSW({
  onNeedRefresh() {
    // A new SW is waiting; let the app know.
    if (typeof window.__swOnUpdate === 'function') {
      window.__swOnUpdate(() => updateSW(true))
    } else {
      swUpdateCallback = () => updateSW(true)
      window.__swPendingUpdate = swUpdateCallback
    }
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline.')
  },
})

// Attach so App.tsx can pick it up
window.__swPendingUpdate = swUpdateCallback

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
