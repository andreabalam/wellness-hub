/**
 * RecipeCard — share flow, caloric-density dot, badge variants and the
 * expand/collapse control. These are the branches the broad components.test
 * RecipeCard block doesn't reach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { Recipe } from '../data/recipes'

const buildShareUrl = vi.fn()
vi.mock('../lib/recipeShare', () => ({ buildShareUrl: (...a: unknown[]) => buildShareUrl(...a) }))

import RecipeCard from '../components/RecipesTab/RecipeCard'

function recipe(over: Partial<Recipe>): Recipe {
  return {
    id: 1,
    cat: 'meal',
    type: 'Meal',
    color: 'var(--green)',
    sc: 'cg',
    name: 'Card Dish',
    tag: 'tasty',
    prepL: '10 min',
    prepC: 'var(--green)',
    hk: 400,
    hp: '20g',
    hc: '30g',
    hf: '10g',
    hfi: '5g',
    mk: 400,
    mp: '20g',
    mc: '30g',
    mf: '10g',
    ings: [['Egg', '2']],
    steps: ['Cook'],
    tip: '',
    custom: false,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  buildShareUrl.mockResolvedValue('https://hub.example/#/r/tok')
})
afterEach(() => {
  // @ts-expect-error cleanup test doubles
  delete navigator.share
  // @ts-expect-error cleanup test doubles
  delete navigator.clipboard
})

describe('RecipeCard — share', () => {
  it('copies a link to the clipboard when Web Share is unavailable', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    render(<RecipeCard recipe={recipe({})} />)
    fireEvent.click(screen.getByLabelText('Share recipe'))
    expect(await screen.findByText('Link copied!')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith('https://hub.example/#/r/tok')
  })

  it('uses the native share sheet when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<RecipeCard recipe={recipe({ name: 'Shared Dish' })} />)
    fireEvent.click(screen.getByLabelText('Share recipe'))
    await waitFor(() => expect(share).toHaveBeenCalled())
  })

  it('ignores an aborted share sheet', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('cancel', 'AbortError'))
    Object.defineProperty(navigator, 'share', { value: share, configurable: true })
    render(<RecipeCard recipe={recipe({})} />)
    fireEvent.click(screen.getByLabelText('Share recipe'))
    await waitFor(() => expect(share).toHaveBeenCalled())
    expect(screen.queryByText('Could not create link')).not.toBeInTheDocument()
  })

  it('shows an error message when link creation fails', async () => {
    buildShareUrl.mockRejectedValue(new Error('encode failed'))
    render(<RecipeCard recipe={recipe({})} />)
    fireEvent.click(screen.getByLabelText('Share recipe'))
    expect(await screen.findByText('Could not create link')).toBeInTheDocument()
  })
})

describe('RecipeCard — badges & expand', () => {
  it('renders a caloric-density dot when grams/serving is known', () => {
    render(<RecipeCard recipe={recipe({ gramsPerServing: 200, hk: 600 })} />)
    expect(document.querySelector('.density-dot')).toBeTruthy()
  })

  it('renders an explicit Indulgent health badge', () => {
    render(<RecipeCard recipe={recipe({ healthTag: 'indulgent' })} />)
    expect(screen.getByText(/Indulgent/)).toBeInTheDocument()
  })

  it('auto-detects a Healthy badge for a light meal', () => {
    render(<RecipeCard recipe={recipe({ cat: 'meal', hk: 350 })} />)
    expect(screen.getByText(/Healthy/)).toBeInTheDocument()
  })

  it('shows a diet-tag badge and a cook counter', () => {
    render(<RecipeCard recipe={recipe({ dietTag: 'vegan' })} cookCount={3} />)
    expect(screen.getByText('Vegan')).toBeInTheDocument()
    expect(screen.getByText(/×3/)).toBeInTheDocument()
  })

  it('expands and collapses via the hint button', () => {
    render(<RecipeCard recipe={recipe({})} />)
    const hint = screen.getByText('tap to see recipe')
    fireEvent.click(hint)
    expect(screen.getByText('tap to collapse')).toBeInTheDocument()
  })

  it('auto-opens when the autoOpen prop is set', () => {
    render(<RecipeCard recipe={recipe({})} autoOpen />)
    expect(screen.getByText('tap to collapse')).toBeInTheDocument()
  })
})
