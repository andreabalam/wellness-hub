/**
 * Unit tests for the extracted TrackerTab sub-components, focusing on the
 * Oura-sync paths and branch edges that the big integration test doesn't reach.
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
    fetchOuraSessions: vi.fn().mockResolvedValue([]),
    fetchOuraSleep: vi.fn().mockResolvedValue(null),
    fetchOuraStress: vi.fn().mockResolvedValue(null),
  }
})

import * as oura from '../lib/oura'
import WorkoutLog from '../components/TrackerTab/WorkoutLog'
import MeditationLog from '../components/TrackerTab/MeditationLog'
import CheckIn from '../components/TrackerTab/CheckIn'
import SatietyRow from '../components/TrackerTab/SatietyRow'
import StarRow from '../components/TrackerTab/StarRow'
import MacroBar from '../components/TrackerTab/MacroBar'
import MealList from '../components/TrackerTab/MealList'
import QuickAddRow from '../components/TrackerTab/QuickAddRow'
import WeekStrip from '../components/TrackerTab/WeekStrip'
import HungerCravingPicker from '../components/TrackerTab/HungerCravingPicker'
import { EMPTY_DAY } from '../data/tracker'
import type { FoodEntry } from '../data/tracker'

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

// ── WorkoutLog ────────────────────────────────────────────────────
describe('WorkoutLog', () => {
  const base = {
    initialSession: null,
    initialWkNotes: '',
    savedWorkout: null,
    savedWkNotes: '',
    phaseNote: 'Follicular note',
    ouraConnected: false,
    date: DATE,
    onSave: vi.fn(),
  }

  it('requires a session before logging', () => {
    render(<WorkoutLog {...base} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('+ Log workout'))
    expect(window.alert).toHaveBeenCalled()
  })

  it('logs the selected session via onSave', () => {
    const onSave = vi.fn()
    render(<WorkoutLog {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('Pilates'))
    fireEvent.click(screen.getByText('+ Log workout'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ workout: 'pilates' }))
  })

  it('shows the "Session logged" summary for a saved workout', () => {
    render(
      <WorkoutLog
        {...base}
        initialSession="pilates"
        savedWorkout="pilates"
        savedWkNotes="felt great"
      />,
    )
    expect(screen.getByText(/Session logged/)).toBeInTheDocument()
  })

  it('loads a cached readiness badge on mount when connected', async () => {
    ls['whub_oura_readiness_v1'] = JSON.stringify({
      '2026-06-15': { score: 82, contributors: { hrv_balance: 70, recovery_index: 90 } },
    })
    render(<WorkoutLog {...base} ouraConnected />)
    expect(await screen.findByText('82')).toBeInTheDocument()
  })

  it('syncs workout + readiness from Oura', async () => {
    mockOura.fetchOuraReadiness.mockResolvedValue({
      score: 75,
      contributors: { hrv_balance: 60, recovery_index: 80 },
    })
    mockOura.fetchOuraWorkouts.mockResolvedValue([
      {
        activity: 'pilates',
        start_datetime: '2026-06-15T16:00:00Z',
        end_datetime: '2026-06-15T16:45:00Z',
        average_heart_rate: 110,
      },
    ])
    render(<WorkoutLog {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    expect(await screen.findByText('75')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByText(/avg HR 110 bpm/)).toBeInTheDocument())
  })

  it('shows a notice when Oura has no workout data', async () => {
    mockOura.fetchOuraWorkouts.mockResolvedValue([])
    mockOura.fetchOuraReadiness.mockResolvedValue(null)
    render(<WorkoutLog {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    await waitFor(() => expect(mockOura.fetchOuraWorkouts).toHaveBeenCalled())
  })
})

// ── MeditationLog ─────────────────────────────────────────────────
describe('MeditationLog', () => {
  const base = {
    initialMedMin: 0,
    initialMedStyle: '',
    savedMedMin: 0,
    savedMedStyle: '',
    ouraConnected: false,
    date: DATE,
    onSave: vi.fn(),
  }

  it('requires a duration before logging', () => {
    render(<MeditationLog {...base} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('Log meditation'))
    expect(window.alert).toHaveBeenCalled()
  })

  it('logs the selected duration + style', () => {
    const onSave = vi.fn()
    render(<MeditationLog {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('13 min'))
    fireEvent.click(screen.getByText('Log meditation'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ medMin: 13 }))
  })

  it('shows the "Done" summary from saved values', () => {
    render(<MeditationLog {...base} savedMedMin={20} savedMedStyle="Breath focus" />)
    expect(screen.getByText(/Done: 20 min - Breath focus/)).toBeInTheDocument()
  })

  it('syncs a meditation session from Oura', async () => {
    mockOura.fetchOuraSessions.mockResolvedValue([
      {
        type: 'meditation',
        start_datetime: '2026-06-15T08:00:00Z',
        end_datetime: '2026-06-15T08:13:00Z',
        average_hrv: 65,
        average_heart_rate: 58,
        mood: 'good',
      },
    ])
    render(<MeditationLog {...base} ouraConnected />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    expect(await screen.findByText(/HRV 65/)).toBeInTheDocument()
  })
})

// ── CheckIn ───────────────────────────────────────────────────────
describe('CheckIn', () => {
  const base = {
    initialEnergy: 0,
    initialMood: 0,
    initialSleep: 0,
    initialStress: 0,
    phase: '',
    onSetPhase: vi.fn(),
    ouraConnected: false,
    date: DATE,
    onSave: vi.fn(),
  }

  it('saves check-in values', () => {
    const onSave = vi.fn()
    render(<CheckIn {...base} onSave={onSave} initialEnergy={3} />)
    fireEvent.click(screen.getByText('Save check-in'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ energy: 3 }))
  })

  it('toggles a cycle phase', () => {
    const onSetPhase = vi.fn()
    render(<CheckIn {...base} onSetPhase={onSetPhase} />)
    fireEvent.click(screen.getByText('Follicular'))
    expect(onSetPhase).toHaveBeenCalledWith('Follicular')
  })

  it('auto-fills sleep + stress from Oura on hover when connected', async () => {
    mockOura.fetchOuraSleep.mockResolvedValue({ score: 88 })
    mockOura.fetchOuraStress.mockResolvedValue({ day_summary: 'restored' })
    const { container } = render(<CheckIn {...base} ouraConnected />)
    fireEvent.mouseEnter(container.querySelector('.tcard')!)
    await waitFor(() => expect(mockOura.fetchOuraSleep).toHaveBeenCalled())
  })
})

// ── Small presentational components ───────────────────────────────
describe('SatietyRow', () => {
  it('selects and clears a value (toggle)', () => {
    const onChange = vi.fn()
    render(<SatietyRow value={4} onChange={onChange} />)
    fireEvent.click(screen.getByText('4')) // active → clears to 0
    expect(onChange).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getByText('6'))
    expect(onChange).toHaveBeenCalledWith(6)
  })
})

describe('StarRow', () => {
  it('renders without labels and toggles a star', () => {
    const onChange = vi.fn()
    const { container } = render(<StarRow value={0} onChange={onChange} emoji="E" />)
    const btns = container.querySelectorAll('button')
    fireEvent.click(btns[2])
    expect(onChange).toHaveBeenCalledWith(3)
  })
})

describe('MacroBar', () => {
  it('shows red/amber bar colors past targets', () => {
    const { rerender } = render(
      <MacroBar label="Calories" val={1500} target={1380} color="var(--green)" valColor="x" />,
    )
    expect(screen.getByText(/remaining/)).toBeInTheDocument()
    rerender(
      <MacroBar label="Protein" sub="muscle" val={108} target={110} color="b" valColor="x" />,
    )
    expect(screen.getByText('Protein')).toBeInTheDocument()
  })
})

describe('MealList', () => {
  const food: FoodEntry = {
    n: 'Oats',
    k: 350,
    p: 18,
    c: 42,
    f: 12,
    fi: 9,
    sat: 5,
    r: 7,
    hunger: 'physical',
  }
  it('renders badges and fires edit/remove/open-recipe', () => {
    const onEdit = vi.fn()
    const onRemove = vi.fn()
    const onOpenRecipe = vi.fn()
    render(
      <MealList
        foods={[food]}
        editIndex={null}
        onEdit={onEdit}
        onRemove={onRemove}
        onOpenRecipe={onOpenRecipe}
      />,
    )
    fireEvent.click(screen.getByTitle('Open recipe'))
    expect(onOpenRecipe).toHaveBeenCalledWith(7, 'Oats')
    fireEvent.click(screen.getByText(/🍽 5\/7/))
    expect(onEdit).toHaveBeenCalled()
  })
})

describe('QuickAddRow', () => {
  it('adds a recent meal', () => {
    const onQuickAdd = vi.fn()
    const f: FoodEntry = { n: 'Soup', k: 300, p: 10, c: 40, f: 8, fi: 6, s: 2 }
    render(<QuickAddRow recentMeals={[f]} onQuickAdd={onQuickAdd} />)
    fireEvent.click(screen.getByText(/Soup/))
    expect(onQuickAdd).toHaveBeenCalledWith(f)
  })
})

describe('WeekStrip', () => {
  it('selects a day via keyboard (Enter)', () => {
    const onSelect = vi.fn()
    const getDay = () => ({ ...EMPTY_DAY, foods: [] })
    const { container } = render(
      <WeekStrip currentDate={DATE} onSelect={onSelect} getDay={getDay} />,
    )
    const cell = container.querySelector('.week-strip-cell')!
    fireEvent.keyDown(cell, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalled()
  })
})

describe('HungerCravingPicker', () => {
  it('shows craving swaps for emotional hunger', () => {
    const onHungerChange = vi.fn()
    const { rerender } = render(<HungerCravingPicker fHunger="" onHungerChange={onHungerChange} />)
    fireEvent.click(screen.getByText(/Emotional/i))
    expect(onHungerChange).toHaveBeenCalled()
    rerender(<HungerCravingPicker fHunger="emotional" onHungerChange={onHungerChange} />)
    // craving chips appear
    expect(screen.getByText(/Craving something/)).toBeInTheDocument()
  })
})
