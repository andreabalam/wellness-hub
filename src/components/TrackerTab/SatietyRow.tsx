import { memo } from 'react'

/** Optional 1–7 Noom satiety selector. value 0 = unset; tapping the active cell clears it. */
const SatietyRow = memo(function SatietyRow({
  value,
  onChange,
}: {
  value: number
  onChange: (v: number) => void
}) {
  return (
    <div>
      <div className="flex gap-4">
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <button
            key={i}
            onClick={() => onChange(i === value ? 0 : i)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              fontSize: 12,
              border: `1px solid ${i === value ? 'var(--teal)' : 'var(--border)'}`,
              background: i === value ? 'rgba(74,158,158,0.18)' : 'var(--bg3)',
              color: i === value ? 'var(--teal-light)' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            {i}
          </button>
        ))}
      </div>
      <div className="flex-between text-2xs text-muted2 mt-4" style={{ maxWidth: 206 }}>
        <span>Ravenous</span>
        <span>Out of commission</span>
      </div>
    </div>
  )
})

export default SatietyRow
