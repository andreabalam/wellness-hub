import { useState } from 'react'
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
  onPeriodStarted: () => void
  /** Phase set by hand for today (tracker day phase); overrides the estimate */
  manualPhase: string
  /** Set today's phase; '' clears it back to the estimate */
  onPhaseChange: (p: string) => void
}

const PHASES = Object.keys(PHASE_COLOR) as PhaseSuggestion['phase'][]

/**
 * One-line strip in the Train day card: today's cycle phase and the plan week
 * it maps to. Where the estimate comes from, changing the phase and marking a
 * period start sit behind "Details" (always shown while no phase is known).
 */
export default function CycleToday({
  suggestion,
  week,
  todayKey,
  ouraConnected,
  tagScopeMissing,
  onPeriodStarted,
  manualPhase,
  onPhaseChange,
}: Props) {
  const [picking, setPicking] = useState(false)
  const [open, setOpen] = useState(false)
  const manual = (PHASES as string[]).includes(manualPhase)
    ? (manualPhase as PhaseSuggestion['phase'])
    : null
  const phase = manual ?? suggestion?.phase ?? null
  const color = phase ? PHASE_COLOR[phase] : 'var(--border2)'

  let source: string | null = null
  if (manual) {
    source = 'You set today’s phase.'
    if (suggestion && suggestion.phase !== manual)
      source += ` The estimate says ${suggestion.phase.toLowerCase()}.`
  } else if (suggestion) {
    if (suggestion.anchorEstimated)
      source = `This cycle's start (${fmtDay(suggestion.anchorDate)}) is estimated from your average cycle length - log your period in Oura to keep it accurate.`
    else if (suggestion.source === 'oura-tag')
      source = `Counting from your period logged in Oura on ${fmtDay(suggestion.anchorDate)}.`
    else source = `Counting from the period start you marked on ${fmtDay(suggestion.anchorDate)}.`
    if (suggestion.tempShift)
      source += ` Temperature rise on ${fmtDay(suggestion.tempShift)} confirms ovulation has passed.`
  }

  const details = (
    <>
      {source && <div className="cycle-today__src">{source}</div>}
      {picking ? (
        <div className="cycle-today__picker" role="group" aria-label="Today's phase">
          {PHASES.map(p => (
            <button
              key={p}
              type="button"
              className="phase-btn"
              aria-pressed={phase === p}
              style={{
                border: `1px solid ${phase === p ? PHASE_COLOR[p] : 'var(--border)'}`,
                color: phase === p ? PHASE_COLOR[p] : 'var(--muted)',
                background: 'var(--bg3)',
              }}
              onClick={() => {
                onPhaseChange(p)
                setPicking(false)
              }}
            >
              {p}
            </button>
          ))}
          {manual && (
            <button
              type="button"
              className="link-btn"
              onClick={() => {
                onPhaseChange('')
                setPicking(false)
              }}
            >
              Use the estimate
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          className="link-btn cycle-today__change"
          onClick={() => setPicking(true)}
        >
          {phase ? 'Not right? Change phase' : 'Set phase by hand'}
        </button>
      )}
      {(!suggestion || suggestion.anchorEstimated || suggestion.anchorDate !== todayKey) && (
        <div className="cycle-today__actions">
          <button className="btn btn--ghost btn--sm" onClick={onPeriodStarted}>
            My period started today
          </button>
        </div>
      )}
    </>
  )

  return (
    <div className="cycle-today" style={{ borderColor: color }}>
      {phase ? (
        <div className="cycle-today__line">
          <span className="cycle-today__phase" style={{ color }}>
            {phase} phase{week != null && <> → Week {week}</>}
          </span>
          {suggestion && (
            <span className="cycle-today__label">cycle day {suggestion.cycleDay}</span>
          )}
          <button
            type="button"
            className="link-btn cycle-today__toggle"
            aria-expanded={open}
            onClick={() => setOpen(o => !o)}
          >
            {open ? 'Hide' : 'Details'}
          </button>
        </div>
      ) : (
        <>
          <div className="cycle-today__label">Cycle sync</div>
          <div className="cycle-today__src">
            No period logged yet. Log it in the Oura app
            {!ouraConnected && ' (connect Oura in Insights)'} or tap below, and this plan will open
            on the right week automatically.
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
      {(!phase || open) && details}
    </div>
  )
}
