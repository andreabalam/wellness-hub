import { useState } from 'react'

/**
 * Shown when a new service-worker version is waiting to activate.
 * The callback is provided by the SW registration (see main.tsx).
 */
export default function UpdatePrompt({ onUpdate }: { onUpdate: (() => void) | null }) {
  const [dismissed, setDismissed] = useState(false)

  if (!onUpdate || dismissed) return null

  return (
    <div className="update-prompt">
      <span className="text-teal">✦</span>
      <span>New version available</span>
      <button
        className="update-prompt__update-btn"
        onClick={() => {
          onUpdate()
          setDismissed(true)
        }}
      >
        Update
      </button>
      <button className="update-prompt__dismiss-btn" onClick={() => setDismissed(true)}>
        ×
      </button>
    </div>
  )
}
