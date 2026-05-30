import { useState, memo } from 'react'
import type { Recipe } from '../../data/recipes'

interface Props {
  recipe: Recipe
  cookCount?: number
  onDelete?: (id: number) => void
}

/** Auto-detects a health badge when no explicit healthTag is set.
 *  Priority: Indulgent → High Calorie → Healthy → (no badge)
 */
function autoBadge(r: Recipe): { label: string; color: string } | null {
  type Tier = { indulgent?: number; highCal?: number; healthy?: number }
  const tiers: Record<string, Tier> = {
    breakfast: { highCal: 500,              healthy: 400 },
    smoothie:  { highCal: 500,              healthy: 350 },
    lunch:     { highCal: 600,              healthy: 500 },
    dinner:    { highCal: 600,              healthy: 500 },
    snack:     { highCal: 300,              healthy: 200 },
    dessert:   { indulgent: 250                          },
  }
  const t = tiers[r.cat]
  if (!t) return null
  if (t.indulgent !== undefined && r.hk >= t.indulgent)
    return { label: 'Indulgent', color: 'var(--purple)' }
  if (t.highCal !== undefined && r.hk >= t.highCal)
    return { label: 'High Calorie', color: 'var(--amber)' }
  if (t.healthy !== undefined && r.hk <= t.healthy)
    return { label: 'Healthy', color: 'var(--green)' }
  return null
}

export default memo(function RecipeCard({ recipe: r, cookCount = 0, onDelete }: Props) {
  const [open, setOpen] = useState(false)
  const isFerment = r.cat === 'ferments'

  // Badge: prep time string — use explicit prepTime if set, otherwise fall back to prepL
  const timeBadgeLabel = r.prepTime ?? r.prepL
  const timeBadgeColor = r.custom ? 'var(--purple)' : r.prepC

  // Health tag badge — explicit field wins, auto-detection as fallback
  const healthBadge = r.healthTag
    ? r.healthTag === 'healthy'
      ? { label: 'Healthy', color: 'var(--green)' }
      : { label: 'Indulgent', color: 'var(--purple)' }
    : autoBadge(r)

  return (
    <div className={`rcard${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="rctop">
        {/* Top row: category type (left) + badge cluster (right) */}
        <div className="rctr">
          <span className="rctype" style={{ color: r.color }}>
            {r.type}{r.custom ? ' · My recipe' : ''}
          </span>

          {/* Badge cluster — all chips sit together in the top-right corner */}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {/* Prep time / custom badge */}
            <span className="rcbadge" style={{ color: timeBadgeColor, borderColor: timeBadgeColor, margin: 0 }}>
              {r.custom ? 'Custom' : timeBadgeLabel}
            </span>

            {/* Health tag badge */}
            {healthBadge && (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 5,
                border: `1px solid ${healthBadge.color}`,
                color: healthBadge.color, fontFamily: '"DM Mono",monospace',
                whiteSpace: 'nowrap',
              }}>
                {healthBadge.label === 'Healthy' ? '✦ ' : healthBadge.label === 'Indulgent' ? '✧ ' : '⚠ '}
                {healthBadge.label}
              </span>
            )}

            {/* Cook counter */}
            {cookCount > 0 && (
              <span title={`Cooked ${cookCount} time${cookCount !== 1 ? 's' : ''}`} style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 5,
                border: '1px solid var(--teal)', color: 'var(--teal-light)',
                fontFamily: '"DM Mono",monospace', whiteSpace: 'nowrap',
              }}>
                🍳 ×{cookCount}
              </span>
            )}
          </div>
        </div>

        <div className="rcname">{r.name}</div>
        <div className="rctag">{r.tag}</div>

        <div className="mrow">
          <div className="mv">
            <span className="mvv" style={{ color: 'var(--green-light)' }}>{r.hk}</span>
            <span className="mvl">kcal</span>
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
        </div>

        {isFerment && (
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 5, fontStyle: 'italic' }}>
            Per serving. Probiotic benefit is the primary value.
          </div>
        )}
      </div>

      <div className="rchint">{open ? 'tap to collapse' : 'tap to see recipe'}</div>

      <div className="rcbody">
        {/* Image */}
        {r.image && (
          <img
            src={r.image}
            alt={r.name}
            style={{ width: '100%', borderRadius: 8, marginBottom: 14, objectFit: 'cover', maxHeight: 220 }}
            onClick={e => e.stopPropagation()}
          />
        )}

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

        {/* Reference link */}
        {r.link && (
          <a
            href={r.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            style={{
              display: 'block', marginTop: 10, fontSize: 12,
              color: 'var(--blue-light)', textDecoration: 'none',
              borderTop: '1px solid var(--border)', paddingTop: 10,
              wordBreak: 'break-all',
            }}
          >
            🔗 {r.link}
          </a>
        )}

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
})
