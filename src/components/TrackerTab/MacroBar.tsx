import { memo } from 'react'

const MacroBar = memo(function MacroBar({
  label,
  sub,
  val,
  target,
  color,
  valColor,
}: {
  label: string
  sub?: string
  val: number
  target: number
  color: string
  valColor: string
}) {
  const pct = Math.min(100, Math.round((val / target) * 100))
  const barColor =
    label === 'Calories' && pct > 105 ? 'var(--red)' : pct > 95 ? 'var(--amber)' : color
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
          <span className="text-teal">{Math.max(0, target - val).toLocaleString()}</span> kcal
          remaining
        </div>
      )}
    </div>
  )
})

export default MacroBar
