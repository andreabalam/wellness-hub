import { useEffect, useState } from 'react'
import { subscribeToasts, dismissToast, type ToastItem } from '../../lib/toast'

const AUTO_DISMISS_MS = 5000

/**
 * Renders the global toast stack. Mount once near the app root. Toasts auto-
 * dismiss after a few seconds and can be dismissed early by clicking.
 */
export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([])

  useEffect(() => subscribeToasts(setToasts), [])

  useEffect(() => {
    if (toasts.length === 0) return
    const timers = toasts.map(t => setTimeout(() => dismissToast(t.id), AUTO_DISMISS_MS))
    return () => timers.forEach(clearTimeout)
  }, [toasts])

  if (toasts.length === 0) return null

  return (
    <div className="toast-host" role="status" aria-live="polite">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          className={`toast toast--${t.variant}`}
          onClick={() => dismissToast(t.id)}
        >
          {t.message}
        </button>
      ))}
    </div>
  )
}
