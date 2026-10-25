import type { PhaseSuggestion } from '../../lib/cyclePhase'
import { startOuraOAuth } from '../../lib/oura'

export const PHASE_COLOR: Record<PhaseSuggestion['phase'], string> = {
  Menstrual: 'var(--purple)',
  Follicular: 'var(--green)',
  Ovulatory: 'var(--amber)',
  Luteal: 'var(--coral)',
}

function fmtDay(key: string): string {
  return new Date(key + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

interface Props {
  suggestion: PhaseSuggestion | null
  /** 1-based plan week for the current phase, or null when the plan has no matching week */
  week: number | null
  todayKey: string
  ouraConnected: boolean
  tagScopeMissing: boolean
  /** Scrolls to today's day card; absent when today's card isn't shown */
  onJumpToday?: () => void
  onPeriodStarted: () => void
}

/** "Today" banner: where you are in your cycle and which plan week that maps to. */
export default function CycleToday({
  suggestion,
  week,
  todayKey,
  ouraConnected,
  tagScopeMissing,
  onJumpToday,
  onPeriodStarted,
}: Props) {
  const color = suggestion ? PHASE_COLOR[suggestion.phase] : 'var(--border2)'

  let source: string | null = null
  if (suggestion) {
    if (suggestion.anchorEstimated)
      source = `This cycle's start (${fmtDay(suggestion.anchorDate)}) is estimated from your average cycle length - log your period in Oura to keep it accurate.`
    else if (suggestion.source === 'oura-tag')
      source = `Counting from your period logged in Oura on ${fmtDay(suggestion.anchorDate)}.`
    else source = `Counting from the period start you marked on ${fmtDay(suggestion.anchorDate)}.`
    if (suggestion.tempShift)
      source += ` Temperature rise on ${fmtDay(suggestion.tempShift)} confirms ovulation has passed.`
  }

  return (
    <div className="cycle-today" style={{ borderColor: color }}>
      {suggestion ? (
        <>
          <div className="cycle-today__label">Today · cycle day {suggestion.cycleDay}</div>
          <div className="cycle-today__phase" style={{ color }}>
            {suggestion.phase} phase{week != null && <> → Week {week}</>}
          </div>
          <div className="cycle-today__src">{source}</div>
        </>
      ) : (
        <>
          <div className="cycle-today__label">Cycle sync</div>
          <div className="cycle-today__src">
            No period logged yet. Log it in the Oura app
            {!ouraConnected && ' (connect Oura in the Oura tab)'} or tap below, and this plan will
            open on the right week automatically.
          </div>
        </>
      )}
      {tagScopeMissing && (
        <div className="cycle-today__src">
          Reading your Oura period log needs an updated permission -{' '}
          <button className="link-btn" onClick={() => startOuraOAuth()}>
            reconnect Oura
          </button>
          .
        </div>
      )}
      <div className="cycle-today__actions">
        {onJumpToday && (
          <button className="btn btn--teal btn--sm" onClick={onJumpToday}>
            Today's workout ↓
          </button>
        )}
        {(!suggestion || suggestion.anchorEstimated || suggestion.anchorDate !== todayKey) && (
          <button className="btn btn--ghost btn--sm" onClick={onPeriodStarted}>
            My period started today
          </button>
        )}
      </div>
    </div>
  )
}
