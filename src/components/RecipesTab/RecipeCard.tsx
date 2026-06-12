import { useState, useEffect, useRef, memo } from 'react'
import type { Recipe } from '../../data/recipes'

interface Props {
  recipe: Recipe
  cookCount?: number
  /** When this flips true, the card expands and scrolls into view (open-from-tracker) */
  autoOpen?: boolean
  /** Called when the user clicks Edit — parent opens an edit modal */
  onEdit?: (recipe: Recipe) => void
  /** Called when the user clicks Delete (custom recipes only) */
  onDelete?: (id: number) => void
  /** Called when the user clicks Hide (built-in / default recipes only) */
  onHide?: (id: number) => void
  /** Called when the user clicks 🍳 Cook — parent renders CookingMode */
  onCook?: (recipe: Recipe) => void
  /** Called when the user clicks 🛒 Grocery — parent opens ingredient picker */
  onGrocery?: (recipe: Recipe) => void
}

/** Auto-detects a health badge when no explicit healthTag is set.
 *  Priority: Indulgent → High Calorie → Healthy → (no badge)
 */
function autoBadge(r: Recipe): { label: string; color: string } | null {
  type Tier = { indulgent?: number; highCal?: number; healthy?: number }
  const tiers: Record<string, Tier> = {
    breakfast: { highCal: 500,              healthy: 400 },
    smoothie:  { highCal: 500,              healthy: 350 },
    meal:      { highCal: 600,              healthy: 500 },
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

export default memo(function RecipeCard({
  recipe: r,
  cookCount = 0,
  autoOpen = false,
  onEdit,
  onDelete,
  onHide,
  onCook,
  onGrocery,
}: Props) {
  const [open, setOpen] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const isFerment = r.cat === 'ferments'

  useEffect(() => {
    if (!autoOpen) return
    setOpen(true)
    // scrollIntoView is missing in jsdom — optional call keeps tests happy
    cardRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
  }, [autoOpen])

  // Badge: prep time string — use explicit prepTime if set, otherwise fall back to prepL
  const timeBadgeLabel = r.prepTime ?? r.prepL
  const timeBadgeColor = r.custom ? 'var(--purple)' : r.prepC

  // Health tag badge — explicit field wins, auto-detection as fallback
  const healthBadge = r.healthTag
    ? r.healthTag === 'healthy'
      ? { label: 'Healthy', color: 'var(--green)' }
      : { label: 'Indulgent', color: 'var(--purple)' }
    : autoBadge(r)

  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div ref={cardRef} className={`rcard${open ? ' open' : ''}`} onClick={() => setOpen(o => !o)}>
      <div className="rctop">
        {/* Top row: category type (left) + badge cluster (right) */}
        <div className="rctr">
          <span className="rctype" style={{ color: r.color }}>
            {r.type}{r.custom ? ' · My recipe' : ''}
          </span>

          {/* Badge cluster — all chips sit together in the top-right corner */}
          <div className="badge-cluster">
            {/* Prep time / custom badge */}
            <span className="rcbadge" style={{ color: timeBadgeColor, borderColor: timeBadgeColor, margin: 0 }}>
              {r.custom ? 'Custom' : timeBadgeLabel}
            </span>

            {/* Health tag badge */}
            {healthBadge && (
              <span className="dyn-badge" style={{ border: `1px solid ${healthBadge.color}`, color: healthBadge.color }}>
                {healthBadge.label === 'Healthy' ? '✦ ' : healthBadge.label === 'Indulgent' ? '✧ ' : '⚠ '}
                {healthBadge.label}
              </span>
            )}

            {/* Cook counter */}
            {cookCount > 0 && (
              <span title={`Cooked ${cookCount} time${cookCount !== 1 ? 's' : ''}`} className="dyn-badge" style={{ border: '1px solid var(--teal)', color: 'var(--teal-light)' }}>
                🍳 ×{cookCount}
              </span>
            )}
          </div>
        </div>

        <div className="rcname">{r.name}</div>
        <div className="rctag">{r.tag}</div>

        <div className="mrow">
          <div className="mv">
            <span className="mvv text-green">{r.hk}</span>
            <span className="mvl">kcal</span>
          </div>
          <div className="mv">
            <span className="mvv text-blue">{r.hp}</span>
            <span className="mvl">protein</span>
          </div>
          <div className="mv">
            <span className="mvv text-amber">{r.hc}</span>
            <span className="mvl">carbs</span>
          </div>
          <div className="mv">
            <span className="mvv text-coral">{r.hf}</span>
            <span className="mvl">fat</span>
          </div>
          {r.hfi && r.hfi !== '0g' && (
            <div className="mv">
              <span className="mvv text-teal">{r.hfi}</span>
              <span className="mvl">fiber</span>
            </div>
          )}
        </div>

        {isFerment && (
          <div className="text-xs text-muted italic mt-6">
            Per serving. Probiotic benefit is the primary value.
          </div>
        )}
      </div>

      <div className="rchint">{open ? 'tap to collapse' : 'tap to see recipe'}</div>

      <div className="rcbody">
        {/* Image */}
        {r.image && (
          <img src={r.image} alt={r.name} className="recipe-card-img" onClick={stop} />
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
            onClick={stop}
            className="recipe-link"
          >
            🔗 {r.link}
          </a>
        )}

        {/* ── Action bar ────────────────────────────────────────── */}
        <div className="rcard-actions" onClick={stop}>
          {/* Primary actions */}
          {onEdit && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onEdit(r)}
              aria-label="Edit recipe"
            >
              ✎ Edit
            </button>
          )}

          {onCook && r.steps.length > 0 && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onCook(r)}
              aria-label="Cook this recipe"
            >
              🍳 Cook
            </button>
          )}

          {onGrocery && r.ings.length > 0 && (
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onGrocery(r)}
              aria-label="Add ingredients to grocery list"
            >
              🛒 Grocery
            </button>
          )}

          {/* Destructive actions pushed to the right */}
          <div className="rcard-actions__right">
            {r.custom && onDelete && r.id != null && (
              <button
                className="btn btn--danger btn--sm"
                onClick={() => onDelete(r.id!)}
                aria-label="Delete recipe"
              >
                Delete recipe
              </button>
            )}

            {!r.custom && onHide && r.id != null && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => onHide(r.id!)}
                aria-label="Hide this suggestion"
                style={{ color: 'var(--muted2)', borderColor: 'var(--border)' }}
              >
                Hide
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
