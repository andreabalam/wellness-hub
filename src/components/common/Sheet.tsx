import { useEffect } from 'react'
import type { ReactNode } from 'react'

/** Full-screen sheet (Schedule from Today, Profile & targets from the user menu). */
export default function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="cooking-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <div className="cooking-topbar">
        <button
          type="button"
          className="cooking-topbar__back"
          aria-label={`Close ${title.toLowerCase()}`}
          onClick={onClose}
        >
          ✕
        </button>
        <span className="logger__title">{title}</span>
      </div>
      <div className="today-schedule-sheet">{children}</div>
    </div>
  )
}
