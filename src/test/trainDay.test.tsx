/**
 * TrainDay — the Train tab's day card (moved from Tracker › Workout):
 * session list, other-activity form, Oura readiness + sync, notes, date nav.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../lib/supabase', () => ({ supabase: {} }))

vi.mock('../lib/oura', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return {
    ...orig,
    fetchOuraReadiness: vi.fn().mockResolvedValue(null),
    fetchOuraWorkouts: vi.fn().mockResolvedValue([]),
  }
})

import * as oura from '../lib/oura'
import TrainDay from '../components/WorkoutsTab/TrainDay'
import type { WorkoutSession } from '../data/tracker'

const mockOura = oura as unknown as Record<string, ReturnType<typeof vi.fn>>
const DATE = new Date('2026-06-15T12:00:00Z')

const ls: Record<string, string> = {}

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
  vi.stubGlobal('alert', vi.fn())
  vi.clearAllMocks()
})
afterEach(() => vi.unstubAllGlobals())

describe('TrainDay', () => {
  const base = {
    sessions: [] as WorkoutSession[],
    initialWkNotes: '',
    ouraConnected: false,
    date: DATE,
    isToday: true,
    onShiftDate: vi.fn(),
    onSave: vi.fn(),
  }

  it('requires a session type before logging', () => {
    render(<TrainDay {...base} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('＋ Other activity'))
    fireEvent.click(screen.getByText('+ Log activity'))
    expect(window.alert).toHaveBeenCalled()
  })

  it('appends a manual session with minutes + kcal via onSave', () => {
    const onSave = vi.fn()
    render(<TrainDay {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('＋ Other activity'))
    fireEvent.click(screen.getByText('Pilates'))
    const [minInput, kcalInput] = screen.getAllByRole('spinbutton')
    fireEvent.change(minInput, { target: { value: '45' } })
    fireEvent.change(kcalInput, { target: { value: '220' } })
    fireEvent.click(screen.getByText('+ Log activity'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        workout: 'pilates',
        wkSessions: [
          expect.objectContaining({ src: 'manual', type: 'pilates', min: 45, kcal: 220 }),
        ],
      }),
    )
  })

  it('renders the session list with per-session meta and totals', () => {
    const sessions: WorkoutSession[] = [
      { id: 'oura-1', src: 'oura', type: 'zone2', label: 'walking', min: 40, kcal: 180 },
      { id: 'manual-2', src: 'manual', type: 'pilates', min: 35, kcal: 140 },
    ]
    render(<TrainDay {...base} sessions={sessions} />)
    expect(screen.getByText(/40 min · 180 kcal/)).toBeInTheDocument()
    expect(screen.getByText(/35 min · 140 kcal/)).toBeInTheDocument()
    expect(screen.getByText(/2 sessions · 1 h 15 m · 320 kcal burned/)).toBeInTheDocument()
  })

  it('removing an oura session tombstones it and saves the rest', () => {
    const onSave = vi.fn()
    const sessions: WorkoutSession[] = [
      { id: 'oura-w1', src: 'oura', type: 'zone2', min: 40 },
      { id: 'manual-2', src: 'manual', type: 'pilates', min: 35 },
    ]
    render(<TrainDay {...base} sessions={sessions} onSave={onSave} />)
    fireEvent.click(screen.getAllByTitle('Remove session')[0])
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        wkSessions: [expect.objectContaining({ id: 'manual-2' })],
        workout: 'pilates',
      }),
    )
    expect(JSON.parse(ls['whub_oura_dismissed_v1'])['2026-06-15']).toContain('oura-w1')
  })

  it('loads a cached readiness badge on mount when connected', async () => {
    ls['whub_oura_readiness_v1'] = JSON.stringify({
      '2026-06-15': { score: 82, contributors: { hrv_balance: 70, recovery_index: 90 } },
    })
    render(<TrainDay {...base} ouraConnected />)
    expect(await screen.findByText('82')).toBeInTheDocument()
  })

  it('sync button imports Oura workouts into the session list', async () => {
    mockOura.fetchOuraReadiness.mockResolvedValue({
      score: 75,
      contributors: { hrv_balance: 60, recovery_index: 80 },
    })
    mockOura.fetchOuraWorkouts.mockResolvedValue([
      {
        id: 'w9',
        activity: 'pilates',
        start_datetime: '2026-06-15T16:00:00Z',
        end_datetime: '2026-06-15T16:45:00Z',
        calories: 210,
        average_heart_rate: 110,
      },
    ])
    render(<TrainDay {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    expect(await screen.findByText('75')).toBeInTheDocument()
    // The shared sync hook writes straight to the tracker store
    await waitFor(() =>
      expect(JSON.parse(ls['whub_tracker_v3'] ?? '{}')['2026-06-15']).toEqual(
        expect.objectContaining({
          wkSessions: [
            expect.objectContaining({
              id: 'oura-w9',
              src: 'oura',
              type: 'pilates',
              min: 45,
              kcal: 210,
              avgHr: 110,
            }),
          ],
        }),
      ),
    )
  })

  it('shows an error toast when the Oura sync throws', async () => {
    mockOura.fetchOuraWorkouts.mockRejectedValue(new Error('network down'))
    mockOura.fetchOuraReadiness.mockResolvedValue(null)
    render(<TrainDay {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    await waitFor(() => expect(mockOura.fetchOuraWorkouts).toHaveBeenCalled())
  })

  it('shows a notice when Oura has no workout data', async () => {
    mockOura.fetchOuraWorkouts.mockResolvedValue([])
    mockOura.fetchOuraReadiness.mockResolvedValue(null)
    render(<TrainDay {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    await waitFor(() => expect(mockOura.fetchOuraWorkouts).toHaveBeenCalled())
  })

  it('date nav: ‹ shifts back, › is disabled on today and a past day says "Logging for"', () => {
    const onShiftDate = vi.fn()
    const { rerender } = render(<TrainDay {...base} onShiftDate={onShiftDate} />)
    expect(screen.getByText('Today')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next day' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Previous day' }))
    expect(onShiftDate).toHaveBeenCalledWith(-1)
    rerender(<TrainDay {...base} isToday={false} onShiftDate={onShiftDate} />)
    expect(screen.getByText('Logging for')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next day' }))
    expect(onShiftDate).toHaveBeenCalledWith(1)
  })

  it('cancel closes the other-activity form; notes save on blur', () => {
    const onSave = vi.fn()
    render(<TrainDay {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('＋ Other activity'))
    fireEvent.click(screen.getByText('Cancel'))
    expect(screen.queryByText('+ Log activity')).toBeNull()
    const notes = screen.getByPlaceholderText(/How did it feel/)
    fireEvent.change(notes, { target: { value: 'Felt strong' } })
    fireEvent.blur(notes)
    expect(onSave).toHaveBeenCalledWith({ wkNotes: 'Felt strong' })
  })

  it('renders plan content passed as children', () => {
    render(
      <TrainDay {...base}>
        <div>Day 1 · Glutes</div>
      </TrainDay>,
    )
    expect(screen.getByText('Day 1 · Glutes')).toBeInTheDocument()
  })
})
