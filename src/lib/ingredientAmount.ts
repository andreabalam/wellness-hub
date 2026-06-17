/**
 * Parse free-form ingredient amount strings ("1 cup", "200g", "2 large")
 * into grams using small curated unit, density, and per-piece weight tables.
 * Pure functions — no I/O. Tables are heuristic by design; anything that
 * doesn't resolve returns null and the caller surfaces it as skipped.
 */

export type AmountMethod = 'mass' | 'volume' | 'piece'

export interface ParsedAmount {
  grams: number
  method: AmountMethod
}

// ── Unit tables ───────────────────────────────────────────────────

/** Mass units → grams per unit */
const MASS_G: Record<string, number> = {
  g: 1,
  gr: 1,
  gram: 1,
  grams: 1,
  kg: 1000,
  kgs: 1000,
  kilogram: 1000,
  kilograms: 1000,
  mg: 0.001,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
}

/** Volume units → milliliters per unit */
const VOLUME_ML: Record<string, number> = {
  ml: 1,
  milliliter: 1,
  milliliters: 1,
  millilitre: 1,
  millilitres: 1,
  l: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  cup: 240,
  cups: 240,
  tbsp: 15,
  tbs: 15,
  tablespoon: 15,
  tablespoons: 15,
  tsp: 5,
  teaspoon: 5,
  teaspoons: 5,
}

/**
 * Density (g/ml) by ingredient-name keyword, for volume → mass conversion.
 * First matching keyword wins; default is 1.0 (water-like).
 */
const DENSITY: [string, number][] = [
  ['brown sugar', 0.93],
  ['powdered sugar', 0.56],
  ['flour', 0.53],
  ['oat', 0.4],
  ['cocoa', 0.52],
  ['sugar', 0.85],
  ['honey', 1.42],
  ['syrup', 1.33],
  ['molasses', 1.4],
  ['peanut butter', 1.01],
  ['almond butter', 1.01],
  ['tahini', 1.01],
  ['butter', 0.96],
  ['oil', 0.92],
  ['mayo', 0.95],
  ['rice', 0.85],
  ['quinoa', 0.85],
  ['lentil', 0.85],
  ['bean', 0.86],
  ['chickpea', 0.86],
  ['yogurt', 1.03],
  ['milk', 1.03],
  ['cream', 1.0],
  ['nut', 0.55],
  ['almond', 0.6],
  ['walnut', 0.5],
  ['seed', 0.65],
  ['spinach', 0.13],
  ['kale', 0.28],
  ['lettuce', 0.2],
  ['arugula', 0.08],
  ['berr', 0.62], // berry/berries
  ['cheese', 0.45], // shredded
]

/**
 * Typical edible weight in grams for one piece, by name keyword.
 * Used for bare counts ("2") and size-qualified counts ("1 large").
 */
const PIECE_G: [string, number][] = [
  ['egg white', 33],
  ['egg yolk', 17],
  ['egg', 50],
  ['banana', 118],
  ['apple', 182],
  ['avocado', 150],
  ['sweet potato', 130],
  ['potato', 170],
  ['onion', 110],
  ['shallot', 30],
  ['tomato', 123],
  ['carrot', 61],
  ['zucchini', 196],
  ['cucumber', 200],
  ['bell pepper', 120],
  ['pepper', 120],
  ['lemon', 58],
  ['lime', 44],
  ['orange', 131],
  ['peach', 150],
  ['pear', 178],
  ['mango', 200],
  ['kiwi', 75],
  ['date', 24], // medjool
  ['tortilla', 30],
  ['pita', 60],
  ['bagel', 100],
  ['chicken breast', 170],
  ['chicken thigh', 85],
  ['salmon fillet', 170],
  ['fillet', 170],
]

/** Count-style units → grams per unit (independent of ingredient name) */
const PIECE_UNIT_G: Record<string, number> = {
  clove: 3,
  cloves: 3,
  slice: 30,
  slices: 30,
  scoop: 30,
  scoops: 30,
  stalk: 40,
  stalks: 40,
  stick: 113,
  sticks: 113, // butter stick
  can: 400,
  cans: 400,
  handful: 30,
  handfuls: 30,
}

/** Size adjectives scale per-piece weights */
const SIZE_FACTOR: Record<string, number> = {
  small: 0.8,
  medium: 1,
  large: 1.2,
  big: 1.2,
  jumbo: 1.4,
  mini: 0.5,
}

/** Amounts that mean "negligible / unmeasurable" — skipped without guessing */
const NON_AMOUNTS =
  /^(—|-|to taste|a? ?pinch( of)?|a? ?dash( of)?|a? ?splash( of)?|some|optional|as needed)$/

const UNICODE_FRACTIONS: Record<string, string> = {
  '¼': '1/4',
  '½': '1/2',
  '¾': '3/4',
  '⅓': '1/3',
  '⅔': '2/3',
  '⅛': '1/8',
  '⅜': '3/8',
  '⅝': '5/8',
  '⅞': '7/8',
}

// ── Parsing ───────────────────────────────────────────────────────

/** "1 1/2" → 1.5, "3/4" → 0.75, "2" → 2. Null when no leading number. */
function parseQuantity(s: string): { qty: number; rest: string } | null {
  // range: "1-2" or "1 – 2" → midpoint (only when both sides are plain numbers)
  const range = s.match(/^(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)(?=\s|$)(.*)$/)
  if (range) {
    return { qty: (parseFloat(range[1]) + parseFloat(range[2])) / 2, rest: range[3].trim() }
  }
  // mixed fraction: "1 1/2"
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)(.*)$/)
  if (mixed) {
    return {
      qty: parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]),
      rest: mixed[4].trim(),
    }
  }
  // plain fraction: "1/2"
  const frac = s.match(/^(\d+)\/(\d+)(.*)$/)
  if (frac) {
    return { qty: parseInt(frac[1]) / parseInt(frac[2]), rest: frac[3].trim() }
  }
  // decimal / integer
  const num = s.match(/^(\d+(?:\.\d+)?)(.*)$/)
  if (num) {
    return { qty: parseFloat(num[1]), rest: num[2].trim() }
  }
  return null
}

function keywordLookup(name: string, table: [string, number][]): number | null {
  for (const [kw, val] of table) {
    if (name.includes(kw)) return val
  }
  return null
}

function densityFor(name: string): number {
  return keywordLookup(name, DENSITY) ?? 1.0
}

function pieceWeightFor(name: string): number | null {
  return keywordLookup(name, PIECE_G)
}

/**
 * Parse an ingredient's amount string into grams.
 * `name` disambiguates volume density and per-piece weight.
 * Returns null when the amount can't be resolved to a weight.
 */
export function parseIngredientAmount(amount: string, name: string): ParsedAmount | null {
  let s = amount.trim().toLowerCase()
  const n = name.trim().toLowerCase()
  if (!s || NON_AMOUNTS.test(s)) return null

  for (const [uni, ascii] of Object.entries(UNICODE_FRACTIONS)) {
    // "1½" → "1 1/2" so the mixed-fraction regex matches
    s = s
      .replace(new RegExp(`(\\d)${uni}`, 'g'), `$1 ${ascii}`)
      .replace(new RegExp(uni, 'g'), ascii)
  }

  const q = parseQuantity(s)
  // unit with no number ("cup of oats") → quantity 1
  const qty = q?.qty ?? 1
  const rest = (q ? q.rest : s).replace(/^of\s+/, '')
  if (qty <= 0) return null

  // "fl oz" must be checked before "oz" tokenization
  const flOz = rest.match(/^fl\.?\s*oz/)
  if (flOz) return { grams: round1(qty * 30 * densityFor(n)), method: 'volume' }

  const unit = rest.split(/[\s.]+/)[0] ?? ''

  if (unit in MASS_G) return { grams: round1(qty * MASS_G[unit]), method: 'mass' }

  if (unit in VOLUME_ML) {
    return { grams: round1(qty * VOLUME_ML[unit] * densityFor(n)), method: 'volume' }
  }

  if (unit in PIECE_UNIT_G) return { grams: round1(qty * PIECE_UNIT_G[unit]), method: 'piece' }

  // bare count, optionally size-qualified: "2", "1 large", "3 medium"
  if (unit === '' || unit in SIZE_FACTOR) {
    if (!q) return null // no number and no recognizable unit
    const piece = pieceWeightFor(n)
    if (piece == null) return null
    const factor = SIZE_FACTOR[unit] ?? 1
    return { grams: round1(qty * piece * factor), method: 'piece' }
  }

  return null
}

function round1(x: number): number {
  return Math.round(x * 10) / 10
}
