import { WORKOUT_PLAN, WORKOUT_PLAN_VERSION } from '../data/workouts'
import type { WorkoutWeek } from '../data/workouts'
import { workoutPlanStore } from './useStore'

/**
 * The plan a signed-in user follows: their saved plan when it's on the
 * current plan version, else the built-in one (an outdated saved plan is
 * ignored so new releases reach everyone). Shared by Train and Insights.
 */
export function activeWorkoutPlan(): WorkoutWeek[] {
  const stored = workoutPlanStore.get()
  return stored?.planData?.[0]?.v === WORKOUT_PLAN_VERSION ? stored.planData : WORKOUT_PLAN
}
