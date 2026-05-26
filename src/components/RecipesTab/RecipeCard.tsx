import { useState } from 'react'
import type { Recipe } from '../../data/recipes'

interface Props {
  recipe: Recipe
  onDelete?: (id: number) => void
}

export default function RecipeCard({ recipe: r, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const isFerment = r.cat === 'ferments'

  return (
    <div className={`rcard${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="rctop">
        <div className="rctr">
          <span className="rctype" style={{ color: r.color }}>
            {r.type}{r.custom ? ' · My recipe' : ''}
          </span>
          <span className="rcbadge" style={{ color: r.prepC, borderColor: r.prepC }}>
            {r.custom ? 'Custom' : r.prepL}
          </span>
        </div>
        <div className="rcname">{r.name}</div>
        <div className="rctag">{r.tag}</div>

        <div className="mrow">
          <div className="mv">
            <span className="mvv" style={{ color: 'var(--green-light)' }}>{r.hk}</span>
            <span className="mvl">{r.custom ? 'kcal' : 'her kcal'}</span>
          </div>
          <div className="mv">
            <span className="mvv" style={{ color: 'var(--blue-light)' }}>{r.hp}</span>
            <span className="mvl">protein</span>
          </div>
          <div className="mv">
            <span className="mvv" style={{ color: 'var(--amber-light)' }}>{r.hc}</span>
            <span className="mvl">carbs</span>
          </div>
          <div className="mv">
            <span className="mvv" style={{ color: 'var(--coral-light)' }}>{r.hf}</span>
            <span className="mvl">fat</span>
          </div>
          {r.hfi && r.hfi !== '0g' && (
            <div className="mv">
              <span className="mvv" style={{ color: 'var(--teal-light)' }}>{r.hfi}</span>
              <span className="mvl">fiber</span>
            </div>
          )}
          {!r.custom && !isFerment && (
            <div className="mv" style={{ borderLeft: '1px solid var(--border)', paddingLeft: 8 }}>
              <span className="mvv" style={{ color: 'var(--green-light)' }}>{r.mk}</span>
              <span className="mvl">him kcal</span>
            </div>
          )}
        </div>

        {isFerment && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>
            Per serving. Probiotic benefit is the primary value.
          </div>
        )}
      </div>

      <div className="rchint">{open ? 'tap to collapse' : 'tap to see recipe'}</div>

      <div className="rcbody">
        {r.ings.length > 0 && (
          <>
            <div className="rbtit">Ingredients{!r.custom ? ' (serves 2)' : ''}</div>
            <ul className="inglist">
              {r.ings.map(([name, amt], i) => (
                <li key={i}>
                  <span>{name}</span>
                  <span className="ingamt">{amt}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {r.steps.length > 0 && (
          <>
            <div className="rbtit">Method</div>
            {r.steps.map((step, i) => (
              <div key={i} className="rstep">
                <div className={`rnum ${r.sc}`}>{i + 1}</div>
                <div className="rtxt">{step}</div>
              </div>
            ))}
          </>
        )}

        {r.tip && <div className="rtip">{r.tip}</div>}

        {r.custom && onDelete && r.id != null && (
          <button
            onClick={e => { e.stopPropagation(); onDelete(r.id!) }}
            style={{
              marginTop: 12, width: '100%', background: 'none',
              border: '1px solid var(--red)', borderRadius: 7, padding: 6,
              fontSize: 12, color: 'var(--red-light)', cursor: 'pointer',
              fontFamily: 'sans-serif',
            }}
          >
            Delete recipe
          </button>
        )}
      </div>
    </div>
  )
}
