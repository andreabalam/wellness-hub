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
}

export const PRESET_CATS = ['breakfast', 'smoothie', 'lunch', 'dinner', 'dessert', 'ferments', 'snack', 'drinks', 'sauce', 'side']
