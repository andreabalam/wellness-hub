import { memo } from 'react'

const MacroBar = memo(function MacroBar({
  label,
  sub,
  val,
  target,
  color,
  valColor,
  burned = 0,
}: {
  label: string
  sub?: string
  val: number
  target: number
  color: string
  valColor: string
  /** Workout kcal credited against intake (Calories row only): remaining = target − val + burned. */
  burned?: number
}) {
  // Net intake drives the fill and over-target colours so a workout visibly buys back headroom
  const net = Math.max(0, val - burned)
  const rawPct = target > 0 ? Math.round((net / target) * 100) : 0
  const pct = Math.min(100, rawPct)
  const barColor =
    label === 'Calories' && rawPct > 105 ? 'var(--red)' : rawPct > 95 ? 'var(--amber)' : color
  return (
    <div>
      <div className="macro-bar-header">
        <span className="macro-bar-label">
          {label}{' '}
          {sub && (
            <span className="text-muted2" style={{ fontSize: 10 }}>
              · {sub}
            </span>
          )}
        </span>
        <span className="macro-bar-val">
          <span style={{ color: valColor }}>
            {label === 'Calories' ? val.toLocaleString() : `${val}g`}
          </span>
          <span className="text-muted2">
            {' '}
            / {label === 'Calories' ? `${target.toLocaleString()} kcal` : `${target}g`}
          </span>
        </span>
      </div>
      <div className="macro-bar-track">
        <div className="macro-bar-fill" style={{ background: barColor, width: `${pct}%` }} />
      </div>
      {label === 'Calories' && (
        <div className="macro-bar-remaining">
          {burned > 0 && (
            <span className="text-coral" style={{ marginRight: 6 }}>
              +{burned.toLocaleString()} kcal from workouts ·
            </span>
          )}
          <span className="text-teal">{Math.max(0, target - val + burned).toLocaleString()}</span>{' '}
          kcal remaining
        </div>
      )}
    </div>
  )
})

export default MacroBar
