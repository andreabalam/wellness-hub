/**
 * Today ↔ Oura workouts: the workout card imports on open, shows when the day
 * last synced, has a manual sync, and picks up writes made by another tab.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

vi.mock('../lib/oura', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return {
    ...orig,
    isOuraConnected: vi.fn().mockResolvedValue(true),
    fetchOuraReadiness: vi.fn().mockResolvedValue(null),
    fetchOuraWorkouts: vi.fn().mockResolvedValue([]),
  }
})

import * as oura from '../lib/oura'
import TodayTab from '../components/TodayTab'
import { trackerStore } from '../hooks/useStore'
import { dkey } from '../components/TrackerTab/dateKey'

const mockOura = oura as unknown as Record<string, ReturnType<typeof vi.fn>>
const USER = { id: 'u1' } as User
const ls: Record<string, string> = {}

const PILATES = {
  id: 'w1',
  activity: 'pilates',
  start_datetime: '2026-06-15T16:00:00Z',
  end_datetime: '2026-06-15T16:45:00Z',
  calories: 210,
}

beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => ls[k] ?? null,
    setItem: (k: string, v: string) => {
      ls[k] = v
    },
    removeItem: (k: string) => {
      delete ls[k]
    },
    clear: () => Object.keys(ls).forEach(k => delete ls[k]),
  })
  vi.clearAllMocks()
  mockOura.isOuraConnected.mockResolvedValue(true)
  mockOura.fetchOuraReadiness.mockResolvedValue(null)
  mockOura.fetchOuraWorkouts.mockResolvedValue([])
})
afterEach(() => vi.unstubAllGlobals())

const renderToday = () =>
  render(
    <TodayTab
      user={USER}
      date={new Date()}
      onDateChange={() => {}}
      onOpenFood={() => {}}
      onOpenTrain={() => {}}
    />,
  )

describe('TodayTab — Oura workout sync', () => {
  it('auto-imports the day on open and shows when it synced', async () => {
    mockOura.fetchOuraWorkouts.mockResolvedValue([PILATES])
    renderToday()
    expect(await screen.findByText(/^Oura synced /)).toBeInTheDocument()
    expect(screen.getByText('45 min · 210 kcal')).toBeInTheDocument()
  })

  it('manual sync forces a fresh import even inside the auto-import window', async () => {
    renderToday()
    await screen.findByText(/^Oura synced /)
    expect(screen.getByText('Nothing logged')).toBeInTheDocument()
    mockOura.fetchOuraWorkouts.mockResolvedValue([PILATES])
    fireEvent.click(screen.getByRole('button', { name: 'Sync workouts from Oura' }))
    await waitFor(() => expect(screen.getByText('45 min · 210 kcal')).toBeInTheDocument())
    expect(mockOura.fetchOuraWorkouts).toHaveBeenCalledTimes(2)
  })

  it('re-renders when another tab writes the day', async () => {
    renderToday()
    await screen.findByText(/^Oura synced /)
    const key = dkey(new Date())
    act(() => {
      trackerStore.setDay(key, {
        ...trackerStore.getDay(key),
        wkSessions: [{ id: 'm1', src: 'manual', type: 'walk', min: 30 }],
      })
    })
    expect(screen.queryByText('Nothing logged')).toBeNull()
    expect(screen.getByText('30 min')).toBeInTheDocument()
  })

  it('opens Profile & targets in a sheet', () => {
    renderToday()
    fireEvent.click(screen.getByRole('button', { name: /Profile & targets/ }))
    expect(screen.getByRole('dialog', { name: 'Profile & targets' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '+ Set up' })).toBeInTheDocument()
  })
})
