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
  const [selected, setSelected] = useState<Set<number>>(
    () => new Set(recipe.ings.map((_, i) => i))
  )
  const [cat, setCat] = useState<string>('My Custom Items')
  const [done, setDone] = useState(false)

  const toggle = (i: number) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })

  const toggleAll = () =>
    setSelected(prev =>
      prev.size === recipe.ings.length
        ? new Set()
        : new Set(recipe.ings.map((_, i) => i))
    )

  const handleAdd = () => {
    const items: GroceryCatalogItem[] = [...selected].map(i => ({
      id:  uid(),
      n:   recipe.ings[i][0],
      cat,
    }))
    onAdd(items)
    setDone(true)
    setTimeout(onClose, 900)
  }

  const allSelected   = selected.size === recipe.ings.length
  const noneSelected  = selected.size === 0

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px 16px',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border2)',
        borderRadius: 16, maxWidth: 480, width: '100%', padding: 28,
        maxHeight: '85vh', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 20, fontWeight: 400, color: 'var(--text)' }}>
              Add to <em style={{ fontStyle: 'italic', color: 'var(--green-light)' }}>Grocery</em>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>{recipe.name}</div>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer', flexShrink: 0 }}
          >
            ��
          </button>
        </div>

        {/* Select all / none toggle */}
        <button
          onClick={toggleAll}
          style={{
            background: 'none', border: '1px solid var(--border2)',
            borderRadius: 7, padding: '5px 12px', fontSize: 12,
            color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif',
            marginBottom: 12,
          }}
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>

        {/* Ingredient list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 20 }}>
          {recipe.ings.map(([name, amt], i) => {
            const isSelected = selected.has(i)
            return (
              <label
                key={i}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                  background: isSelected ? 'rgba(56,176,120,0.08)' : 'var(--bg3)',
                  border: `1px solid ${isSelected ? 'var(--green)' : 'var(--border)'}`,
                  transition: 'all .12s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(i)}
                  style={{ accentColor: 'var(--green)', width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--text)' }}>{name}</span>
                <span style={{ fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{amt}</span>
              </label>
            )
          })}
        </div>

        {/* Category picker */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>Add to category</div>
          <select
            value={cat}
            onChange={e => setCat(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--bg3)', border: '1px solid var(--border2)',
              borderRadius: 7, padding: '8px 10px', fontSize: 13,
              color: 'var(--text)', fontFamily: '"DM Sans",sans-serif',
              cursor: 'pointer', outline: 'none',
            }}
          >
            <option value="My Custom Items">My Custom Items</option>
            {GROCERY_CATEGORIES.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        {done ? (
          <div style={{ textAlign: 'center', fontSize: 14, color: 'var(--green-light)', padding: '8px 0' }}>
            ✓ {selected.size} item{selected.size !== 1 ? 's' : ''} added to grocery list!
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleAdd}
              disabled={noneSelected}
              style={{
                flex: 1, background: 'var(--green)', border: 'none',
                borderRadius: 8, padding: '10px 0', fontSize: 13,
                fontFamily: 'sans-serif', color: '#fff', cursor: noneSelected ? 'default' : 'pointer',
                fontWeight: 500, opacity: noneSelected ? 0.5 : 1,
              }}
            >
              Add {selected.size > 0 ? `${selected.size} ` : ''}item{selected.size !== 1 ? 's' : ''} to grocery
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'var(--bg3)', border: '1px solid var(--border2)',
                borderRadius: 8, padding: '10px 16px', fontSize: 13,
                fontFamily: 'sans-serif', color: 'var(--muted)', cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
