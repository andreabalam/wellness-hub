import { useState } from 'react'
import { HUNGER_TYPES } from '../../data/tracker'
import { CRAVING_TYPES, swapsFor } from '../../data/swaps'
import type { CravingType } from '../../data/swaps'

interface Props {
  /** Currently-selected hunger type id ('' = none). Owned by the food form. */
  fHunger: string
  onHungerChange: (id: string) => void
}

/**
 * Optional "what kind of hunger?" picker. When a mouth/emotional hunger is
 * selected it offers craving swaps. `craving` is local UI state (not logged).
 */
export default function HungerCravingPicker({ fHunger, onHungerChange }: Props) {
  const [craving, setCraving] = useState<CravingType | null>(null)

  return (
    <div className="mb-8">
      <div className="text-xs text-muted2 mb-6">What kind of hunger? (optional)</div>
      <div className="flex flex-wrap gap-6">
        {HUNGER_TYPES.map(h => (
          <button
            key={h.id}
            onClick={() => {
              onHungerChange(fHunger === h.id ? '' : h.id)
              setCraving(null)
            }}
            className={`hunger-chip${fHunger === h.id ? ' active' : ''}`}
          >
            {h.icon} {h.label}
          </button>
        ))}
      </div>
      {(fHunger === 'mouth' || fHunger === 'emotional') && (
        <div className="craving-helper">
          <div className="text-2xs text-muted2 mb-6">
            Craving something? A swap can hit the same note:
          </div>
          <div className="flex flex-wrap gap-6">
            {CRAVING_TYPES.map(c => (
              <button
                key={c}
                onClick={() => setCraving(craving === c ? null : c)}
                className={`craving-chip${craving === c ? ' active' : ''}`}
              >
                {c}
              </button>
            ))}
          </div>
          {craving && (
            <ul className="swap-list">
              {swapsFor(craving).map((s, i) => (
                <li key={i}>
                  <span className="swap-from">{s.from}</span> →{' '}
                  <span className="swap-to">{s.to}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
