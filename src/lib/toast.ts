/**
 * Tiny global toast bus.
 *
 * A module-level emitter so any code — React components, the class-based
 * ErrorBoundary, or plain lib functions — can surface a short user notice
 * without prop drilling. `<ToastHost>` (mounted once in App) renders them.
 */
export type ToastVariant = 'info' | 'error' | 'success'

export interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

type Listener = (toasts: ToastItem[]) => void

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<Listener>()

function emit() {
  for (const l of listeners) l(toasts)
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  listener(toasts)
  return () => { listeners.delete(listener) }
}

/** Show a toast; returns its id so callers can dismiss it early. */
export function showToast(message: string, variant: ToastVariant = 'info'): number {
  const id = nextId++
  toasts = [...toasts, { id, message, variant }]
  emit()
  return id
}

export function dismissToast(id: number): void {
  toasts = toasts.filter(t => t.id !== id)
  emit()
}

/** Test-only: clear all toasts and listeners. */
export function _resetToasts(): void {
  toasts = []
  listeners.clear()
}
