import { useState } from 'react'
import { GROCERY_CATEGORIES } from '../../data/grocery'
import type { GroceryCatalogItem } from '../../data/grocery'
import type { Recipe } from '../../data/recipes'

interface Props {
  recipe: Recipe
  onAdd: (items: GroceryCatalogItem[]) => void
  onClose: () => void
}

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

export default function GroceryIngredientModal({ recipe, onAdd, onClose }: Props) {
  // All ingredients selected by default
  const [selected, setSelected] = useState<Set<number>>(() => new Set(recipe.ings.map((_, i) => i)))
  const [cat, setCat] = useState<string>('My Custom Items')
  const [done, setDone] = useState(false)

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const toggleAll = () =>
    setSelected(prev =>
      prev.size === recipe.ings.length ? new Set() : new Set(recipe.ings.map((_, i) => i)),
    )

  const handleAdd = () => {
    const items: GroceryCatalogItem[] = [...selected].map(i => ({
      id: uid(),
      n: recipe.ings[i][0],
      cat,
    }))
    onAdd(items)
    setDone(true)
    setTimeout(onClose, 900)
  }

  const allSelected = selected.size === recipe.ings.length
  const noneSelected = selected.size === 0

  return (
    <div
      className="modal-overlay--centered"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-panel modal-panel--sm w-full">
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ fontSize: 20 }}>
              Add to <em className="italic text-green">Grocery</em>
            </div>
            <div className="text-sm text-muted mt-4">{recipe.name}</div>
          </div>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>

        {/* Select all / none toggle */}
        <button onClick={toggleAll} className="btn btn--ghost btn--sm mb-12">
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>

        {/* Ingredient list */}
        <div className="flex flex-col gap-6 mb-20">
          {recipe.ings.map(([name, amt], i) => {
            const isSelected = selected.has(i)
            return (
              <label
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  background: isSelected ? 'rgba(56,176,120,0.08)' : 'var(--bg3)',
                  border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`,
                  transition: 'all .12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(i)}
                  className="ingredient-checkbox"
                />
                <span className="flex-1 text-base text-default">{name}</span>
                <span className="text-sm text-muted font-mono">{amt}</span>
              </label>
            )
          })}
        </div>

        {/* Category picker */}
        <div className="mb-20">
          <div className="field-label">Add to category</div>
          <select value={cat} onChange={e => setCat(e.target.value)} className="form-select">
            <option value="My Custom Items">My Custom Items</option>
            {GROCERY_CATEGORIES.map(c => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        {/* Actions */}
        {done ? (
          <div className="text-md text-green text-center p-8">
            ✓ {selected.size} item{selected.size !== 1 ? 's' : ''} added to grocery list!
          </div>
        ) : (
          <div className="flex gap-8">
            <button
              onClick={handleAdd}
              disabled={noneSelected}
              className="btn btn--primary btn--md flex-1"
            >
              Add {selected.size > 0 ? `${selected.size} ` : ''}item{selected.size !== 1 ? 's' : ''}{' '}
              to grocery
            </button>
            <button onClick={onClose} className="btn btn--ghost btn--md">
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
