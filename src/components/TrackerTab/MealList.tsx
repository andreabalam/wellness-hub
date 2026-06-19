import type { FoodEntry } from '../../data/tracker'
import { hungerIcon, hungerLabel } from '../../data/tracker'

interface Props {
  foods: FoodEntry[]
  /** Index of the row currently being edited (highlighted), or null. */
  editIndex: number | null
  onEdit: (i: number) => void
  onRemove: (i: number) => void
  onOpenRecipe?: (id: number | undefined, name: string) => void
  /** Resolves the recipe a logged meal links to (by id, or name-matched). */
  recipeLinkId?: (f: FoodEntry) => number | undefined
}

/** The day's logged meals, with edit / remove controls and recipe/satiety badges. */
export default function MealList({
  foods,
  editIndex,
  onEdit,
  onRemove,
  onOpenRecipe,
  recipeLinkId,
}: Props) {
  return (
    <div className="mb-12" style={{ minHeight: 30 }}>
      {foods.length === 0 ? (
        <div className="text-base text-muted2 italic" style={{ padding: '3px 0' }}>
          No meals logged yet.
        </div>
      ) : (
        foods.map((f, i) => {
          const linkId = recipeLinkId ? recipeLinkId(f) : f.r
          return (
            <div
              key={i}
              className={`food-log-item ${editIndex === i ? 'food-log-item--editing' : ''}`}
            >
              <div className="flex-1">
                <div className="text-base text-default">
                  {f.n}
                  {linkId != null ? (
                    <button
                      className="recipe-link-badge"
                      title="Open recipe"
                      onClick={() => onOpenRecipe?.(linkId, f.n)}
                    >
                      📖
                    </button>
                  ) : null}
                  {f.s && f.s !== 1 ? (
                    <span className="text-muted2 text-2xs" style={{ marginLeft: 5 }}>
                      ×{f.s} srv
                    </span>
                  ) : null}
                  {f.sat ? (
                    <button
                      className="satiety-badge"
                      title="Satiety — tap to edit"
                      onClick={() => onEdit(i)}
                    >
                      🍽 {f.sat}/7
                    </button>
                  ) : null}
                  {f.hunger ? (
                    <span className="hunger-tag" title={`${hungerLabel(f.hunger)} hunger`}>
                      {hungerIcon(f.hunger)}
                    </span>
                  ) : null}
                </div>
                <div className="food-log-meta">
                  {f.k} kcal · {f.p}g P · {f.c}g C · {f.f}g F{f.fi ? ` · ${f.fi}g fiber` : ''}
                </div>
              </div>
              <button
                onClick={() => onEdit(i)}
                title="Edit"
                className={`food-edit-btn ${editIndex === i ? 'active' : ''}`}
              >
                ✏
              </button>
              <button onClick={() => onRemove(i)} className="food-remove-btn">
                ×
              </button>
            </div>
          )
        })
      )}
    </div>
  )
}
