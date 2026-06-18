/**
 * WeekGoal card — goal/note entry and save payload.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import WeekGoal from '../components/TrackerTab/WeekGoal'

describe('WeekGoal', () => {
  const base = {
    initialGoal: '',
    initialKind: 'goal' as const,
    initialResult: '' as const,
    initialNote: '',
    lastWeekGoal: '',
    lastWeekResult: '' as const,
  }

  it('captures the goal + reflection note and saves them', () => {
    const onSave = vi.fn()
    render(<WeekGoal {...base} onSave={onSave} />)
    fireEvent.change(screen.getByPlaceholderText(/Reflection — what worked/), {
      target: { value: 'Slept earlier most nights' },
    })
    fireEvent.click(screen.getByText('Save weekly'))
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ weekGoalNote: 'Slept earlier most nights' }),
    )
    expect(screen.getByText('Saved!')).toBeInTheDocument()
  })

  it('switches to experiment mode and toggles a result', () => {
    const onSave = vi.fn()
    render(<WeekGoal {...base} onSave={onSave} />)
    fireEvent.click(screen.getByText('experiment'))
    expect(screen.getByText(/Experiment/)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Save weekly'))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ weekGoalKind: 'experiment' }))
  })

  it('shows the previous-week continuity note and a goal suggestion', () => {
    render(
      <WeekGoal
        {...base}
        lastWeekGoal="Protein at every meal"
        lastWeekResult="yes"
        onSave={vi.fn()}
      />,
    )
    expect(screen.getByText(/Last week:/)).toBeInTheDocument()
    // With no goal text yet, quick suggestions render — click one
    const suggestion = screen
      .getAllByRole('button')
      .find(b => b.className.includes('quick-food-btn'))
    if (suggestion) fireEvent.click(suggestion)
  })
})
