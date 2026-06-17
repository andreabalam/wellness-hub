/**
 * Craving swap suggestions (Noom doc, Section 3). When a craving hits, a swap
 * satisfies the same sensory need with a lower-density option. Pure static data.
 */

export type CravingType = 'sweet' | 'crunchy' | 'savory'

export interface Swap {
  craving: CravingType
  from: string
  to: string
}

export const CRAVING_TYPES: CravingType[] = ['sweet', 'crunchy', 'savory']

export const SWAPS: Swap[] = [
  { craving: 'sweet', from: 'Candy', to: 'Fresh or frozen berries' },
  { craving: 'sweet', from: 'Ice cream', to: 'Greek yogurt + honey' },
  { craving: 'sweet', from: 'Cookies', to: 'Medjool date with nut butter' },
  { craving: 'crunchy', from: 'Potato chips', to: 'Roasted chickpeas or kale chips' },
  { craving: 'crunchy', from: 'Crackers', to: 'Cucumber or bell-pepper slices' },
  { craving: 'crunchy', from: 'Pretzels', to: 'Air-popped popcorn' },
  { craving: 'savory', from: 'Pizza', to: 'Stuffed portobello mushroom' },
  { craving: 'savory', from: 'French fries', to: 'Roasted potato wedges' },
  { craving: 'savory', from: 'Chips & dip', to: 'Veggies + hummus' },
]

/** Swaps for a given craving type. */
export function swapsFor(craving: CravingType): Swap[] {
  return SWAPS.filter(s => s.craving === craving)
}
