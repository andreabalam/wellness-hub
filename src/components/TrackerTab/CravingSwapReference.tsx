import { CRAVING_TYPES, swapsFor } from '../../data/swaps'

/** Browsable, collapsible reference of all craving → lower-density swaps. */
export default function CravingSwapReference() {
  return (
    <details className="swap-reference tcard">
      <summary>🔁 Craving swaps — lower-density picks that hit the same note</summary>
      {CRAVING_TYPES.map(c => (
        <div key={c}>
          <div className="swap-group-title">{c}</div>
          <ul className="swap-list">
            {swapsFor(c).map((s, i) => (
              <li key={i}>
                <span className="swap-from">{s.from}</span> →{' '}
                <span className="swap-to">{s.to}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </details>
  )
}
