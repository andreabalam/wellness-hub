export interface Recipe {
  id?: number
  cat: string
  type: string
  color: string
  sc: string
  name: string
  tag: string
  prepL: string
  prepC: string
  /** Approximate prep/cook time shown on the card badge, e.g. "15 min", "30 min" */
  prepTime?: string
  /** Explicit health classification for the badge */
  healthTag?: 'healthy' | 'indulgent'
  /** Optional image URL shown when the card is expanded */
  image?: string
  /** Optional recipe source / reference URL shown when the card is expanded */
  link?: string
  hk: number
  hp: string
  hc: string
  hf: string
  hfi?: string
  mk: number
  mp: string
  mc: string
  mf: string
  ings: [string, string][]
  steps: string[]
  tip: string
  custom?: boolean
  /** Who created this recipe: 'builtin' | 'dr_emily' | 'user' */
  source?: 'builtin' | 'dr_emily' | 'user'
  /**
   * DB id of the built-in recipe this was forked from.
   * Set when the user edits a default recipe — the original stays untouched.
   */
  defaultId?: number
  /**
   * When true, this default recipe is hidden for this user.
   * Hidden defaults do not appear in the recipe list but can be restored.
   */
  hidden?: boolean
}

export const PRESET_CATS = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments', 'snack', 'drinks', 'sauce', 'side']

/**
 * One default recipe per category, chosen by best protein-to-calorie ratio.
 * Breakfast=2, Smoothie=5, Lunch=9, Dinner=13, Dessert=22, Ferments=24, Snack=45.
 */
export const DEFAULT_RECIPE_IDS = [2, 5, 9, 13, 22, 24, 45] as const

/**
 * Built-in/public recipes have been removed — the tab shows only the signed-in
 * user's own recipes (loaded from the `recipes` DB table where user_id = their id).
 * Guests see an empty state with a prompt to sign in.
 */
export const BUILTIN_RECIPES: Recipe[] = []
