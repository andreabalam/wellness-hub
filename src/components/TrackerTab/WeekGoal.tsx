import { useState } from 'react'
import { WEEK_GOAL_SUGGESTIONS } from '../../data/tracker'
import type { WeekGoalKind, WeekGoalResult } from '../../data/tracker'

const WEEK_RESULT_LABEL: Record<string, string> = { yes: 'Yes', partial: 'Partially', no: 'No' }

export interface WeekGoalPayload {
  weekGoal: string
  weekGoalKind: WeekGoalKind
  weekGoalResult: WeekGoalResult | ''
  weekGoalNote: string
}

interface Props {
  /** Seed values for the current week's Monday anchor (parent re-keys per week). */
  initialGoal: string
  initialKind: WeekGoalKind
  initialResult: WeekGoalResult | ''
  initialNote: string
  /** Previous week's goal/result for the continuity note. */
  lastWeekGoal: string
  lastWeekResult: WeekGoalResult | ''
  onSave: (payload: WeekGoalPayload) => void
}

/** Weekly goal / experiment card. Persists on the week's Monday anchor (parent). */
export default function WeekGoal({
  initialGoal,
  initialKind,
  initialResult,
  initialNote,
  lastWeekGoal,
  lastWeekResult,
  onSave,
}: Props) {
  const [weekGoal, setWeekGoal] = useState(initialGoal)
  const [weekGoalKind, setWeekGoalKind] = useState<WeekGoalKind>(initialKind)
  const [weekGoalResult, setWeekGoalResult] = useState<WeekGoalResult | ''>(initialResult)
  const [weekGoalNote, setWeekGoalNote] = useState(initialNote)
  const [weekSaved, setWeekSaved] = useState(false)

  const save = () => {
    onSave({ weekGoal, weekGoalKind, weekGoalResult, weekGoalNote })
    setWeekSaved(true)
    setTimeout(() => setWeekSaved(false), 1600)
  }

  return (
    <div className="tcard">
      <div className="flex-between mb-8">
        <div className="tlabel" style={{ color: 'var(--green-light)', marginBottom: 0 }}>
          Weekly goal
        </div>
        <div className="flex gap-6">
          {(['goal', 'experiment'] as WeekGoalKind[]).map(k => (
            <button
              key={k}
              onClick={() => setWeekGoalKind(k)}
              className={`rfbtn${weekGoalKind === k ? ' active' : ''}`}
              style={{ textTransform: 'capitalize' }}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {lastWeekGoal && (
        <div className="last-week-note">
          Last week: “{lastWeekGoal}”
          {lastWeekResult ? ` — ${WEEK_RESULT_LABEL[lastWeekResult]}` : ''}
        </div>
      )}

      <div className="text-sm text-muted mb-6">
        {weekGoalKind === 'goal' ? "This week's SMART goal" : 'Experiment — “If I…, then…”'}
      </div>
      <textarea
        className="tinput resize-vertical mb-8"
        rows={2}
        value={weekGoal}
        onChange={e => setWeekGoal(e.target.value)}
        placeholder={
          weekGoalKind === 'goal'
            ? 'e.g. Protein at every meal'
            : 'e.g. If I prep 3 lunches on Sunday, then I eat out less'
        }
      />

      {!weekGoal && (
        <div className="flex flex-wrap gap-6 mb-8">
          {WEEK_GOAL_SUGGESTIONS.map(s => (
            <button key={s} onClick={() => setWeekGoal(s)} className="quick-food-btn">
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="text-sm text-muted mb-6">
        {weekGoalKind === 'goal' ? 'Did you hit it?' : 'Result'}
      </div>
      <div className="flex gap-6 mb-8">
        {(['yes', 'partial', 'no'] as WeekGoalResult[]).map(r => (
          <button
            key={r}
            onClick={() => setWeekGoalResult(weekGoalResult === r ? '' : r)}
            className={`rfbtn${weekGoalResult === r ? ' active' : ''}`}
          >
            {WEEK_RESULT_LABEL[r]}
          </button>
        ))}
      </div>

      <textarea
        className="tinput resize-vertical mb-8"
        rows={2}
        value={weekGoalNote}
        onChange={e => setWeekGoalNote(e.target.value)}
        placeholder="Reflection — what worked, what got in the way…"
      />

      <button onClick={save} className={`tbtn tbtn--secondary ${weekSaved ? 'saved' : ''}`}>
        {weekSaved ? 'Saved!' : 'Save weekly'}
      </button>
    </div>
  )
}
