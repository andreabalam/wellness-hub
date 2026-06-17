import { memo } from 'react'

const StarRow = memo(function StarRow({
  value,
  onChange,
  emoji,
  lowLabel,
  highLabel,
}: {
  value: number
  onChange: (v: number) => void
  emoji: string
  lowLabel?: string
  highLabel?: string
}) {
  return (
    <div>
      <div className="flex gap-6">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            onClick={() => onChange(i === value ? 0 : i)}
            style={{
              width: 30,
              height: 30,
              borderRadius: 6,
              border: `1px solid ${i <= value ? 'var(--purple)' : 'var(--border)'}`,
              background: i <= value ? 'rgba(138,106,184,0.18)' : 'var(--bg3)',
              cursor: 'pointer',
              fontSize: 15,
              transition: 'all .15s',
            }}
          >
            {i <= value ? emoji : '·'}
          </button>
        ))}
      </div>
      {(lowLabel || highLabel) && (
        <div className="flex-between text-2xs text-muted2 mt-4" style={{ maxWidth: 174 }}>
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      )}
    </div>
  )
})

export default StarRow
