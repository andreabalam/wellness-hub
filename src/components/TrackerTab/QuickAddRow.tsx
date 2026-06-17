import type { FoodEntry } from '../../data/tracker'

interface Props {
  recentMeals: FoodEntry[]
  onQuickAdd: (f: FoodEntry) => void
}

/** Quick-add buttons for the most-recently-logged meals. */
export default function QuickAddRow({ recentMeals, onQuickAdd }: Props) {
  return (
    <>
      <div className="text-xs text-muted2 mb-6">Quick-add from recent meals:</div>
      <div className="flex flex-wrap gap-6 mb-8">
        {recentMeals.length === 0 ? (
          <span className="text-muted2 italic text-2xs">Meals you log will appear here.</span>
        ) : (
          recentMeals.map((f, i) => (
            <button key={i} onClick={() => onQuickAdd(f)} className="quick-food-btn">
              {f.n} ({f.k}
              {f.s && f.s !== 1 ? ` ×${f.s}srv` : ''})
            </button>
          ))
        )}
      </div>
    </>
  )
}
