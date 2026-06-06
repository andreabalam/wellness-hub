/**
 * OuraTab component tests.
 * All Oura API calls are mocked so tests run without a real Supabase session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

// ── Mock Oura API layer ───────────────────────────────────────────
vi.mock('../lib/oura', async (importOriginal) => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return {
    ...orig,
    fetchOuraDailyActivity:    vi.fn().mockResolvedValue(null),
    fetchOuraReadiness:        vi.fn().mockResolvedValue(null),
    fetchOuraSleep:            vi.fn().mockResolvedValue(null),
    fetchOuraSleepSession:     vi.fn().mockResolvedValue(null),
    fetchOuraWorkouts:         vi.fn().mockResolvedValue([]),
    fetchOuraSessions:         vi.fn().mockResolvedValue([]),
    fetchOuraCardiovascularAge:vi.fn().mockResolvedValue(null),
    fetchOuraSpo2:             vi.fn().mockResolvedValue(null),
    fetchOuraStress:           vi.fn().mockResolvedValue(null),
    fetchOuraResilience:       vi.fn().mockResolvedValue(null),
    fetchOuraWorkoutRoute:     vi.fn().mockResolvedValue(null),
    startOuraOAuth:            vi.fn(),
    exchangePendingCode:       vi.fn().mockResolvedValue(undefined),
    disconnectOura:            vi.fn().mockResolvedValue(undefined),
    isOuraConnected:           vi.fn().mockResolvedValue(false),
  }
})

import OuraTab from '../components/OuraTab'

const FAKE_USER = { id: 'test-user-1', email: 'test@example.com' } as User

const ls: Record<string, string> = {}
beforeEach(() => {
  Object.keys(ls).forEach(k => delete ls[k])
  vi.stubGlobal('localStorage', {
    getItem:    (k: string) => ls[k] ?? null,
    setItem:    (k: string, v: string) => { ls[k] = v },
    removeItem: (k: string) => { delete ls[k] },
    clear:      () => Object.keys(ls).forEach(k => delete ls[k]),
  })
})
afterEach(() => {
  vi.unstubAllGlobals()
})

// ── Guest gate ────────────────────────────────────────────────────
describe('OuraTab — guest', () => {
  it('shows sign-in prompt when no user', () => {
    render(<OuraTab user={null} />)
    expect(screen.getByText('Sign in to view your Oura dashboard.')).toBeInTheDocument()
  })
})

// ── Connect screen ────────────────────────────────────────────────
describe('OuraTab — connect screen', () => {
  it('shows connect prompt when no Oura token (noToken state)', async () => {
    // Mock fetchAll to trigger noToken via the NO_TOKEN_MSGS error path
    const { fetchOuraDailyActivity } = await import('../lib/oura')
    vi.mocked(fetchOuraDailyActivity).mockRejectedValueOnce(
      new Error('No Oura account connected')
    )
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('Connect Oura Ring')).toBeInTheDocument()
    })
  })

  it('Connect with Oura button is clickable', async () => {
    const { fetchOuraDailyActivity, startOuraOAuth } = await import('../lib/oura')
    vi.mocked(fetchOuraDailyActivity).mockRejectedValueOnce(
      new Error('No Oura account connected')
    )
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Connect Oura Ring'))
    fireEvent.click(screen.getByText('Connect with Oura'))
    expect(vi.mocked(startOuraOAuth)).toHaveBeenCalled()
  })
})

// ── Authenticated / empty data ────────────────────────────────────
describe('OuraTab — authenticated with empty data', () => {
  it('shows date navigation with "Today" label', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument()
    })
  })

  it('shows prev/next date nav buttons', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    expect(screen.getByText('←')).toBeInTheDocument()
    expect(screen.getByText('→')).toBeInTheDocument()
    expect(screen.getByText('↺')).toBeInTheDocument()
  })

  it('shows "No data" placeholders when all API calls return null', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      const empties = screen.getAllByText('No data')
      expect(empties.length).toBeGreaterThan(0)
    })
  })

  it('shows Disconnect link', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    expect(screen.getByText('Disconnect')).toBeInTheDocument()
  })

  it('clicking ← navigates to yesterday', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    fireEvent.click(screen.getByText('←'))
    await waitFor(() => {
      expect(screen.getByText('Yesterday')).toBeInTheDocument()
    })
  })

  it('clicking → is disabled when viewing today', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    const nextBtn = screen.getByText('→')
    // Next button is disabled when already on today
    expect(nextBtn).toBeDisabled()
  })

  it('navigating back shows Today button', async () => {
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    fireEvent.click(screen.getByText('←'))
    await waitFor(() => {
      // A "Today" shortcut button appears when not viewing today
      const todayBtns = screen.getAllByText('Today')
      expect(todayBtns.length).toBeGreaterThan(0)
    })
  })

  it('clicking refresh button calls fetchAll again', async () => {
    const { fetchOuraDailyActivity } = await import('../lib/oura')
    const spy = vi.mocked(fetchOuraDailyActivity)
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    const callsBefore = spy.mock.calls.length
    fireEvent.click(screen.getByText('↺'))
    await waitFor(() => {
      expect(spy.mock.calls.length).toBeGreaterThan(callsBefore)
    })
  })
})

// ── With score data ───────────────────────────────────────────────
describe('OuraTab — with readiness data', () => {
  it('shows readiness score when API returns data', async () => {
    const { fetchOuraReadiness } = await import('../lib/oura')
    vi.mocked(fetchOuraReadiness).mockResolvedValue({
      score: 82,
      contributors: {
        hrv_balance: 80,
        recovery_index: 75,
        sleep_balance: 85,
        resting_heart_rate: 90,
      },
      temperature_deviation: 0.2,
    } as import('../lib/oura').OuraReadiness)

    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('82')).toBeInTheDocument()
    })
  })
})

// ── Workouts data ─────────────────────────────────────────────────
describe('OuraTab — with workout data', () => {
  it('shows workout activity and duration', async () => {
    const { fetchOuraWorkouts } = await import('../lib/oura')
    vi.mocked(fetchOuraWorkouts).mockResolvedValue([
      {
        id: 'w1',
        activity: 'running',
        start_datetime: '2024-01-15T07:00:00Z',
        end_datetime:   '2024-01-15T07:30:00Z',
        calories: 250,
        distance: 5000,
        average_heart_rate: 155,
        max_heart_rate: 175,
      } as import('../lib/oura').OuraWorkout,
    ])

    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('Running')).toBeInTheDocument()
    })
    expect(screen.getByText('30m')).toBeInTheDocument()
    expect(screen.getByText('250 kcal')).toBeInTheDocument()
  })
})

// ── Session data ──────────────────────────────────────────────────
describe('OuraTab — with session data', () => {
  it('shows meditation session duration', async () => {
    const { fetchOuraSessions } = await import('../lib/oura')
    vi.mocked(fetchOuraSessions).mockResolvedValue([
      {
        id: 's1',
        type: 'meditation',
        start_datetime: '2024-01-15T06:00:00Z',
        end_datetime:   '2024-01-15T06:15:00Z',
        mood: 'good',
        average_hrv: 45,
        average_heart_rate: 62,
      } as import('../lib/oura').OuraSession,
    ])

    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('Meditation')).toBeInTheDocument()
    })
    expect(screen.getByText('15m')).toBeInTheDocument()
  })
})
