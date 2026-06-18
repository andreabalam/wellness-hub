/**
 * OuraTab component tests.
 * All Oura API calls are mocked so tests run without a real Supabase session.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import type { User } from '@supabase/supabase-js'

// ── Mock Supabase as non-null so the !supabase guard in OuraTab doesn't
//    short-circuit to the connect screen before fetchAll can run ────
vi.mock('../lib/supabase', () => ({
  supabase: {},
}))

// ── Mock Oura API layer ───────────────────────────────────────────
vi.mock('../lib/oura', async importOriginal => {
  const orig = await importOriginal<typeof import('../lib/oura')>()
  return {
    ...orig,
    fetchOuraDailyActivity: vi.fn().mockResolvedValue(null),
    fetchOuraReadiness: vi.fn().mockResolvedValue(null),
    fetchOuraSleep: vi.fn().mockResolvedValue(null),
    fetchOuraSleepSession: vi.fn().mockResolvedValue(null),
    fetchOuraWorkouts: vi.fn().mockResolvedValue([]),
    fetchOuraSessions: vi.fn().mockResolvedValue([]),
    fetchOuraCardiovascularAge: vi.fn().mockResolvedValue(null),
    fetchOuraSpo2: vi.fn().mockResolvedValue(null),
    fetchOuraStress: vi.fn().mockResolvedValue(null),
    fetchOuraResilience: vi.fn().mockResolvedValue(null),
    fetchOuraWorkoutRoute: vi.fn().mockResolvedValue(null),
    startOuraOAuth: vi.fn(),
    exchangePendingCode: vi.fn().mockResolvedValue(undefined),
    disconnectOura: vi.fn().mockResolvedValue(undefined),
    isOuraConnected: vi.fn().mockResolvedValue(false),
  }
})

import OuraTab from '../components/OuraTab'

const FAKE_USER = { id: 'test-user-1', email: 'test@example.com' } as User

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
    vi.mocked(fetchOuraDailyActivity).mockRejectedValueOnce(new Error('No Oura account connected'))
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => {
      expect(screen.getByText('Connect Oura Ring')).toBeInTheDocument()
    })
  })

  it('Connect with Oura button is clickable', async () => {
    const { fetchOuraDailyActivity, startOuraOAuth } = await import('../lib/oura')
    vi.mocked(fetchOuraDailyActivity).mockRejectedValueOnce(new Error('No Oura account connected'))
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
        end_datetime: '2024-01-15T07:30:00Z',
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
        end_datetime: '2024-01-15T06:15:00Z',
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

// ── Fully-populated render — exercises every data card ────────────
describe('OuraTab — all metrics populated', () => {
  it('renders sleep, activity, spo2, stress, resilience and cardio-age cards', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.fetchOuraReadiness).mockResolvedValue({
      score: 80,
      contributors: {
        hrv_balance: 70,
        recovery_index: 75,
        sleep_balance: 80,
        resting_heart_rate: 85,
      },
      temperature_deviation: 0.1,
    } as any)
    vi.mocked(o.fetchOuraDailyActivity).mockResolvedValue({
      score: 85,
      active_calories: 420,
      total_calories: 2100,
      steps: 8200,
      equivalent_walking_distance: 6100,
      high_activity_time: 1200,
    } as any)
    vi.mocked(o.fetchOuraSleep).mockResolvedValue({
      score: 88,
      contributors: {
        deep_sleep: 90,
        efficiency: 92,
        rem_sleep: 80,
        restfulness: 85,
        total_sleep: 88,
      },
    } as any)
    vi.mocked(o.fetchOuraSleepSession).mockResolvedValue({
      average_hrv: 65,
      deep_sleep_duration: 5400,
      light_sleep_duration: 14400,
      rem_sleep_duration: 5400,
      total_sleep_duration: 27000,
      efficiency: 90,
      lowest_heart_rate: 50,
    } as any)
    vi.mocked(o.fetchOuraCardiovascularAge).mockResolvedValue({ vascular_age: 32 } as any)
    vi.mocked(o.fetchOuraSpo2).mockResolvedValue({ spo2_percentage: { average: 97 } } as any)
    vi.mocked(o.fetchOuraStress).mockResolvedValue({
      day_summary: 'restored',
      stress_high: 3600,
      recovery_high: 10800,
    } as any)
    vi.mocked(o.fetchOuraResilience).mockResolvedValue({
      level: 'solid',
      contributors: { daytime_recovery: 80, sleep_recovery: 85, stress_impact: 70 },
    } as any)

    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.getAllByText('80').length).toBeGreaterThan(0))
    expect(screen.getAllByText('88').length).toBeGreaterThan(0)
    expect(screen.getAllByText(/32/).length).toBeGreaterThan(0)
  })

  it('renders low/varied scores to exercise the color helpers', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.fetchOuraReadiness).mockResolvedValue({
      score: 45,
      contributors: { resting_heart_rate: 58 },
      temperature_deviation: -0.3,
    } as any)
    vi.mocked(o.fetchOuraDailyActivity).mockResolvedValue({ score: 65, steps: 3000 } as any)
    // sleep with contributors but NO session → exercises the contributors-only branch
    vi.mocked(o.fetchOuraSleep).mockResolvedValue({
      score: 72,
      contributors: {
        total_sleep: 70,
        deep_sleep: 65,
        rem_sleep: 60,
        efficiency: 88,
        restfulness: 75,
      },
    } as any)
    vi.mocked(o.fetchOuraSleepSession).mockResolvedValue(null)
    vi.mocked(o.fetchOuraSpo2).mockResolvedValue({ spo2_percentage: { average: 88 } } as any)
    vi.mocked(o.fetchOuraStress).mockResolvedValue({
      day_summary: 'normal',
      stress_high: 1800,
      recovery_high: 9000,
    } as any)
    vi.mocked(o.fetchOuraResilience).mockResolvedValue({
      level: 'limited',
      contributors: { daytime_recovery: 60, sleep_recovery: 70, stress_impact: 55 },
    } as any)
    vi.mocked(o.fetchOuraWorkouts).mockResolvedValue([
      {
        id: 'w9',
        activity: 'running',
        start_datetime: '2024-01-15T07:00:00Z',
        end_datetime: '2024-01-15T07:40:00Z',
        calories: 300,
        distance: 6000,
        average_heart_rate: 150,
        max_heart_rate: 175,
      } as any,
    ])
    vi.mocked(o.fetchOuraWorkoutRoute).mockResolvedValue({ id: 'w9', polyline: 'abc' } as any)
    vi.mocked(o.fetchOuraSessions).mockResolvedValue([
      {
        id: 's2',
        type: 'breathing',
        start_datetime: '2024-01-15T06:00:00Z',
        end_datetime: '2024-01-15T06:10:00Z',
        average_hrv: 50,
        average_heart_rate: 60,
        mood: 'bad',
      } as any,
    ])
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.getAllByText('45').length).toBeGreaterThan(0))
    expect(screen.getByText(/Restfulness/)).toBeInTheDocument()
  })
})

// ── Disconnect & OAuth exchange ───────────────────────────────────
describe('OuraTab — disconnect & oauth exchange', () => {
  beforeEach(async () => {
    // Reset all fetchers to null so leaked values from prior tests don't apply
    const o = await import('../lib/oura')
    for (const fn of [
      'fetchOuraDailyActivity',
      'fetchOuraReadiness',
      'fetchOuraSleep',
      'fetchOuraSleepSession',
      'fetchOuraCardiovascularAge',
      'fetchOuraSpo2',
      'fetchOuraStress',
      'fetchOuraResilience',
    ] as const)
      vi.mocked(o[fn]).mockResolvedValue(null as never)
    vi.mocked(o.fetchOuraWorkouts).mockResolvedValue([])
    vi.mocked(o.fetchOuraSessions).mockResolvedValue([])
  })

  it('clicking Disconnect returns to the connect screen', async () => {
    const o = await import('../lib/oura')
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => screen.getByText('Today'))
    fireEvent.click(screen.getByText('Disconnect'))
    await waitFor(() => expect(screen.getByText('Connect Oura Ring')).toBeInTheDocument())
    expect(vi.mocked(o.disconnectOura)).toHaveBeenCalled()
  })

  it('exchanges a pending OAuth code on mount', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.exchangePendingCode).mockResolvedValue(undefined)
    sessionStorage.setItem('oura_oauth_pending_code', 'code-123')
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => expect(vi.mocked(o.exchangePendingCode)).toHaveBeenCalled())
    sessionStorage.removeItem('oura_oauth_pending_code')
  })

  it('shows a connection error when the exchange fails', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.exchangePendingCode).mockRejectedValue(new Error('bad code'))
    sessionStorage.setItem('oura_oauth_pending_code', 'code-x')
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.getByText('bad code')).toBeInTheDocument())
    sessionStorage.removeItem('oura_oauth_pending_code')
  })

  it('surfaces a real (non-token) fetch error', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.fetchOuraReadiness).mockRejectedValue(new Error('Server exploded'))
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() => expect(screen.getByText(/Server exploded/)).toBeInTheDocument())
  })

  it('prompts reconnect on a scope error', async () => {
    const o = await import('../lib/oura')
    vi.mocked(o.fetchOuraReadiness).mockRejectedValue(
      new Error('Token is not authorized access readiness scope'),
    )
    render(<OuraTab user={FAKE_USER} />)
    await waitFor(() =>
      expect(screen.getByText(/missing required permissions/)).toBeInTheDocument(),
    )
  })
})
