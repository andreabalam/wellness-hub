import { describe, it, expect, beforeEach } from 'vitest'
import {
  showToast,
  dismissToast,
  subscribeToasts,
  _resetToasts,
  type ToastItem,
} from '../lib/toast'

describe('toast bus', () => {
  beforeEach(() => _resetToasts())

  it('notifies subscribers when a toast is shown', () => {
    let latest: ToastItem[] = []
    subscribeToasts(t => {
      latest = t
    })
    showToast('hello', 'info')
    expect(latest).toHaveLength(1)
    expect(latest[0]).toMatchObject({ message: 'hello', variant: 'info' })
  })

  it('defaults to the info variant', () => {
    let latest: ToastItem[] = []
    subscribeToasts(t => {
      latest = t
    })
    showToast('plain')
    expect(latest[0].variant).toBe('info')
  })

  it('dismisses a toast by id', () => {
    let latest: ToastItem[] = []
    subscribeToasts(t => {
      latest = t
    })
    const id = showToast('bye', 'error')
    expect(latest).toHaveLength(1)
    dismissToast(id)
    expect(latest).toHaveLength(0)
  })

  it('unsubscribe stops notifications', () => {
    let calls = 0
    const unsub = subscribeToasts(() => {
      calls++
    })
    expect(calls).toBe(1) // immediate emit on subscribe
    unsub()
    showToast('after unsub')
    expect(calls).toBe(1)
  })

  it('assigns unique ids to stacked toasts', () => {
    let latest: ToastItem[] = []
    subscribeToasts(t => {
      latest = t
    })
    const a = showToast('one')
    const b = showToast('two')
    expect(a).not.toBe(b)
    expect(latest.map(t => t.id)).toEqual([a, b])
  })
})
