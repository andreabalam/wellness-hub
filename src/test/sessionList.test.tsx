import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkoutSessionList, MedSessionList } from '../components/TrackerTab/SessionList'
import type { MedSession, WorkoutSession } from '../data/tracker'

describe('WorkoutSessionList', () => {
  it('renders every optional meta field and the em-dash fallback for zero minutes', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'manual-1',
        src: 'manual',
        type: 'legacy-wk',
        min: 0,
        avgHr: 120,
        maxHr: 150,
        note: 'felt strong',
      },
    ]
    render(<WorkoutSessionList sessions={sessions} onRemove={vi.fn()} />)
    expect(screen.getByText(/—/)).toBeInTheDocument()
    expect(screen.getByText(/120 bpm avg/)).toBeInTheDocument()
    expect(screen.getByText(/150 bpm max/)).toBeInTheDocument()
    expect(screen.getByText(/felt strong/)).toBeInTheDocument()
  })

  it('fires onRemove for the clicked session', () => {
    const onRemove = vi.fn()
    const s: WorkoutSession = { id: 'x', src: 'manual', type: 'pilates', min: 30 }
    render(<WorkoutSessionList sessions={[s]} onRemove={onRemove} />)
    fireEvent.click(screen.getByTitle('Remove session'))
    expect(onRemove).toHaveBeenCalledWith(s)
  })
})

describe('MedSessionList', () => {
  it('fires onRemove for the clicked session', () => {
    const onRemove = vi.fn()
    const s: MedSession = { id: 'x', src: 'manual', min: 10, style: 'Silent' }
    render(<MedSessionList sessions={[s]} onRemove={onRemove} />)
    fireEvent.click(screen.getByTitle('Remove session'))
    expect(onRemove).toHaveBeenCalledWith(s)
  })
})
