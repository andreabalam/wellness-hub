import { useState } from 'react'
import { GROCERY_DATA } from '../../data/grocery'
import { useGroceryStore } from '../../hooks/useStore'

const DOT_COLORS = { add: 'var(--green)', swap: 'var(--amber)', remove: 'var(--red)' } as const
const BADGE_CLS  = { add: 'gbadd', swap: 'gbswap', remove: 'gbrem' } as const

export default function GroceryPanel() {
  const store = useGroceryStore()
  const [checked, setChecked] = useState<string[]>(() => store.getChecked())

  const toggle = (name: string) => {
    store.toggle(name)
    setChecked(store.getChecked())
  }

  const clearAll = () => {
    store.clearAll()
    setChecked([])
  }

  return (
    <div>
      <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 4 }}>
        Your <em style={{ fontStyle: 'italic', color: 'var(--green-light)' }}>Grocery List</em>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Tap any item to check it off as you shop.</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {(['Keep', 'Add', 'Swap', 'Remove'] as const).map((lbl, i) => {
          const colors = ['var(--muted2)', 'var(--green)', 'var(--amber)', 'var(--red)']
          return (
            <span key={lbl} style={{ fontSize: 12, color: 'var(--muted)', fontFamily: '"DM Mono",monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i], display: 'inline-block' }} />
              {lbl}
            </span>
          )
        })}
        <button onClick={clearAll} style={{ marginLeft: 'auto', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '4px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}>
          Clear all
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {Object.entries(GROCERY_DATA).map(([cat, items]) => (
          <div key={cat} className="gcat">
            <div className="gcatlbl">{cat}</div>
            {items.map(item => {
              const isChecked = checked.includes(item.n)
              const dotColor = item.t ? DOT_COLORS[item.t] : 'var(--muted2)'
              return (
                <div
                  key={item.n}
                  className={`gitem${isChecked ? ' gchecked' : ''}`}
                  onClick={() => toggle(item.n)}
                >
                  <div className="gcheck">✓</div>
                  <div className="gdot" style={{ background: dotColor }} />
                  <span style={{ flex: 1 }}>{item.n}</span>
                  {item.t && (
                    <span className={`gbadge ${BADGE_CLS[item.t]}`}>{item.t}</span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
