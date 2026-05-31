import { useState } from 'react'

/**
 * Shown when a new service-worker version is waiting to activate.
 * The callback is provided by the SW registration (see main.tsx).
 */
export default function UpdatePrompt({ onUpdate }: { onUpdate: (() => void) | null }) {
  const [dismissed, setDismissed] = useState(false)

  if (!onUpdate || dismissed) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'var(--bg2)',
        border: '1px solid var(--teal)',
        borderRadius: 12,
        padding: '12px 18px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        fontFamily: '"DM Sans", sans-serif',
        fontSize: 13,
        color: 'var(--text)',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ color: 'var(--teal-light)' }}>✦</span>
      <span>New version available</span>
      <button
        onClick={() => { onUpdate(); setDismissed(true) }}
        style={{
          background: 'var(--teal)',
          border: 'none',
          borderRadius: 7,
          padding: '5px 14px',
          fontSize: 12,
          color: '#fff',
          cursor: 'pointer',
          fontFamily: '"DM Mono", monospace',
        }}
      >
        Update
      </button>
      <button
        onClick={() => setDismissed(true)}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--muted2)',
          cursor: 'pointer',
          fontSize: 16,
          lineHeight: 1,
          padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}
