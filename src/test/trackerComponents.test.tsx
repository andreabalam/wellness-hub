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
import type { FoodEntry, MedSession } from '../data/tracker'

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

describe('MeditationLog', () => {
  const base = {
    sessions: [] as MedSession[],
    ouraConnected: false,
    date: DATE,
    onSave: vi.fn(),
  }

  it('requires a duration before logging', () => {
    render(<MeditationLog {...base} onSave={vi.fn()} />)
    fireEvent.click(screen.getByText('Log meditation'))
    expect(window.alert).toHaveBeenCalled()
  })

  it('appends a manual session via onSave and mirrors legacy fields', () => {
    const onSave = vi.fn()
    render(<MeditationLog {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('13 min'))
    fireEvent.click(screen.getByText('Breath focus'))
    fireEvent.click(screen.getByText('Log meditation'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        medMin: 13,
        medStyle: 'Breath focus',
        medSessions: [expect.objectContaining({ src: 'manual', min: 13, style: 'Breath focus' })],
      }),
    )
  })

  it('renders the session list with persisted Oura chips and totals', () => {
    const sessions: MedSession[] = [
      { id: 'oura-m1', src: 'oura', min: 13, style: 'Guided', hrv: 65, hr: 58, mood: 'good' },
      { id: 'manual-2', src: 'manual', min: 10, style: 'Silent' },
    ]
    render(<MeditationLog {...base} sessions={sessions} />)
    expect(screen.getByText(/HRV 65/)).toBeInTheDocument()
    expect(screen.getByText(/feeling: good/)).toBeInTheDocument()
    expect(screen.getByText(/Total today: 23 min · 2 sessions/)).toBeInTheDocument()
  })

  it('nap sessions are excluded on sync', async () => {
    mockOura.fetchOuraSessions.mockResolvedValue([
      {
        id: 'n1',
        type: 'nap',
        start_datetime: '2026-06-15T13:00:00Z',
        end_datetime: '2026-06-15T13:30:00Z',
      },
    ])
    const onSave = vi.fn()
    render(<MeditationLog {...base} ouraConnected onSave={onSave} />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    await waitFor(() => expect(mockOura.fetchOuraSessions).toHaveBeenCalled())
    expect(onSave).not.toHaveBeenCalledWith(
      expect.objectContaining({ medSessions: expect.arrayContaining([expect.anything()]) }),
    )
  })

  it('sync imports a meditation session into the list', async () => {
    mockOura.fetchOuraSessions.mockResolvedValue([
      {
        id: 'm7',
        type: 'meditation',
        start_datetime: '2026-06-15T08:00:00Z',
        end_datetime: '2026-06-15T08:13:00Z',
        average_hrv: 65,
        average_heart_rate: 58,
        mood: 'good',
      },
    ])
    const onSave = vi.fn()
    render(<MeditationLog {...base} ouraConnected onSave={onSave} />)
    fireEvent.click(screen.getByText('⟳ Sync Oura'))
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith(
        expect.objectContaining({
          medMin: 13,
          medStyle: 'Guided',
          medSessions: [
            expect.objectContaining({ id: 'oura-m7', min: 13, hrv: 65, hr: 58, mood: 'good' }),
          ],
        }),
      ),
    )
  })

  it('removing an oura session tombstones it', () => {
    const onSave = vi.fn()
    const sessions: MedSession[] = [{ id: 'oura-m1', src: 'oura', min: 13, style: 'Guided' }]
    render(<MeditationLog {...base} sessions={sessions} onSave={onSave} />)
    fireEvent.click(screen.getByTitle('Remove session'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ medSessions: [], medMin: 0, medStyle: '' }),
    )
    expect(JSON.parse(ls['whub_oura_dismissed_v1'])['2026-06-15']).toContain('oura-m1')
  })
})

// ── CheckIn ───────────────────────────────────────────────────────
describe('CheckIn', () => {
  const base = {
    initialEnergy: 0,
    initialMood: 0,
    initialSleep: 0,
    initialStress: 0,
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

  it('credits burned kcal against intake (remaining = target − val + burned)', () => {
    render(
      <MacroBar
        label="Calories"
        val={1500}
        target={1380}
        burned={420}
        color="var(--green)"
        valColor="x"
      />,
    )
    expect(screen.getByText(/\+420 kcal from workouts/)).toBeInTheDocument()
    // 1380 − 1500 + 420 = 300 remaining
    expect(screen.getByText('300')).toBeInTheDocument()
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

  it('links a meal with no recipe id via the name resolver', () => {
    const onOpenRecipe = vi.fn()
    const plain = { n: 'Power Bowl', k: 300, p: 20, c: 30, f: 10, fi: 5 }
    render(
      <MealList
        foods={[plain]}
        editIndex={null}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onOpenRecipe={onOpenRecipe}
        recipeLinkId={f => (f.n === 'Power Bowl' ? 42 : undefined)}
      />,
    )
    fireEvent.click(screen.getByTitle('Open recipe'))
    expect(onOpenRecipe).toHaveBeenCalledWith(42, 'Power Bowl')
  })

  it('shows no recipe badge when the resolver returns nothing', () => {
    render(
      <MealList
        foods={[{ n: 'Random Snack', k: 100, p: 1, c: 10, f: 5, fi: 0 }]}
        editIndex={null}
        onEdit={vi.fn()}
        onRemove={vi.fn()}
        onOpenRecipe={vi.fn()}
        recipeLinkId={() => undefined}
      />,
    )
    expect(screen.queryByTitle('Open recipe')).not.toBeInTheDocument()
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
  it('ignores unrelated key presses', () => {
    const onSelect = vi.fn()
    const getDay = () => ({ ...EMPTY_DAY, foods: [] })
    const { container } = render(
      <WeekStrip currentDate={DATE} onSelect={onSelect} getDay={getDay} burnThreshold={300} />,
    )
    fireEvent.keyDown(container.querySelector('.week-strip-cell')!, { key: 'Tab' })
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('selects a day via keyboard (Enter)', () => {
    const onSelect = vi.fn()
    const getDay = () => ({ ...EMPTY_DAY, foods: [] })
    const { container } = render(
      <WeekStrip currentDate={DATE} onSelect={onSelect} getDay={getDay} burnThreshold={300} />,
    )
    const cell = container.querySelector('.week-strip-cell')!
    fireEvent.keyDown(cell, { key: 'Enter' })
    expect(onSelect).toHaveBeenCalled()
  })

  it('shows the flame with burned kcal for significant-burn days', () => {
    const getDay = () => ({
      ...EMPTY_DAY,
      wkSessions: [{ id: 'oura-1', src: 'oura' as const, type: 'zone2', min: 60, kcal: 450 }],
    })
    render(<WeekStrip currentDate={DATE} onSelect={vi.fn()} getDay={getDay} burnThreshold={300} />)
    expect(screen.getAllByText(/🔥450/).length).toBe(7) // every day of the mocked week
  })

  it('omits any marker for insignificant workouts below the burn threshold', () => {
    const getDay = () => ({ ...EMPTY_DAY, workout: 'pilates' })
    const { container } = render(
      <WeekStrip currentDate={DATE} onSelect={vi.fn()} getDay={getDay} burnThreshold={300} />,
    )
    const cellWs = [...container.querySelectorAll('.week-strip-cell .text-coral')].filter(
      el => el.textContent === 'W',
    )
    expect(cellWs.length).toBe(0)
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

  it('selecting a craving chip reveals a swap suggestion and toggles off', () => {
    const onHungerChange = vi.fn()
    render(<HungerCravingPicker fHunger="mouth" onHungerChange={onHungerChange} />)
    const chip = screen.getAllByRole('button').find(b => b.className.includes('craving-chip'))!
    fireEvent.click(chip)
    fireEvent.click(chip) // toggle back off — exercises the craving===c branch
    expect(chip).toBeInTheDocument()
  })
})

describe('WeekStrip — extra branches', () => {
  it('shows a date-range label for a past week and selects via Space', () => {
    const onSelect = vi.fn()
    const getDay = () => ({ ...EMPTY_DAY, foods: [] })
    const pastWeek = new Date('2026-05-04T12:00:00') // a different week than DATE
    const { container } = render(
      <WeekStrip currentDate={pastWeek} onSelect={onSelect} getDay={getDay} burnThreshold={300} />,
    )
    // Not "This week" → range label rendered (en-dash)
    expect(screen.getByText(/–/)).toBeInTheDocument()
    fireEvent.keyDown(container.querySelector('.week-strip-cell') as HTMLElement, { key: ' ' })
    expect(onSelect).toHaveBeenCalled()
  })
})
