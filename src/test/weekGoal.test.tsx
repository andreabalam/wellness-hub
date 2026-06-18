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
})
