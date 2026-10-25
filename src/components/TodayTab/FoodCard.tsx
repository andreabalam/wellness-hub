import type { DayData } from '../../data/tracker'
import { dayWorkoutSessions, workoutTotals } from '../../data/tracker'
import { macroTargets } from '../../hooks/macroTargets'
import MacroBar from '../TrackerTab/MacroBar'

/** Calories + protein so far vs target; the full log lives in the Food tab. */
export default function FoodCard({ day, onOpenFood }: { day: DayData; onOpenFood: () => void }) {
  const t = macroTargets()
  const kcal = Math.round(day.foods.reduce((s, f) => s + f.k, 0))
  const prot = Math.round(day.foods.reduce((s, f) => s + f.p, 0))
  const burned = workoutTotals(dayWorkoutSessions(day)).kcal
  return (
    <div className="tcard">
      <div className="flex-between mb-8">
        <div className="tlabel text-muted2" style={{ marginBottom: 0 }}>
          Food · {day.foods.length} item{day.foods.length === 1 ? '' : 's'}
        </div>
        <button type="button" className="btn btn--sm btn--teal" onClick={onOpenFood}>
          + Add food
        </button>
      </div>
      <div className="flex flex-col gap-10">
        <MacroBar
          label="Calories"
          val={kcal}
          target={t.kcal}
          color="var(--green)"
          valColor="var(--green-light)"
          burned={burned}
        />
        <MacroBar
          label="Protein"
          val={prot}
          target={t.prot}
          color="var(--blue)"
          valColor="var(--blue-light)"
        />
      </div>
    </div>
  )
}
