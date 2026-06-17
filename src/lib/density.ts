/**
 * Caloric density coloring — the Noom Green / Yellow / Orange system.
 * Density = kcal ÷ grams. The color informs, it never prohibits: there is no
 * "red", no warning styling, just a small dot.
 *
 * Cutoffs (per the Noom doc):
 *   solids — Green < 1.0 cal/g, Yellow 1.0–2.4, Orange > 2.4
 *   drinks — Green < 0.4 cal/g, Yellow 0.4–0.5, Orange > 0.5
 */

export type DensityTier = 'green' | 'yellow' | 'orange'

const CUTOFFS = {
  solid: { green: 1.0, yellow: 2.4 },
  drink: { green: 0.4, yellow: 0.5 },
}

/** Tier from a known cal/g density. */
export function densityTierFor(calPerG: number, isDrink = false): DensityTier {
  const c = isDrink ? CUTOFFS.drink : CUTOFFS.solid
  if (calPerG < c.green) return 'green'
  if (calPerG <= c.yellow) return 'yellow'
  return 'orange'
}

/** Tier from kcal + grams. Returns null when grams is unknown/zero (no badge shown). */
export function densityTier(kcal: number, grams: number, isDrink = false): DensityTier | null {
  if (!grams || grams <= 0 || kcal < 0) return null
  return densityTierFor(kcal / grams, isDrink)
}

export const DENSITY_COLORS: Record<DensityTier, string> = {
  green: 'var(--green)',
  yellow: 'var(--amber)',
  orange: 'var(--coral)',
}

export const DENSITY_LABELS: Record<DensityTier, string> = {
  green: 'Low calorie density',
  yellow: 'Medium calorie density',
  orange: 'High calorie density',
}

/** Recipe categories that should use the lower drink cutoffs. */
export function isDrinkCategory(cat: string): boolean {
  return cat === 'smoothie' || cat === 'drinks'
}
