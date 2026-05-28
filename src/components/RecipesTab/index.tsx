import { useState, useCallback } from 'react'
import { ALL_RECIPES } from '../../data/recipes'
import type { Recipe } from '../../data/recipes'
import { useRecipeStore, exportAllData, importAllData } from '../../hooks/useStore'
import RecipeCard from './RecipeCard'
import RecipeModal from './RecipeModal'
import GroceryPanel from './GroceryPanel'

type Filter = 'all' | 'breakfast' | 'smoothie' | 'lunch' | 'dinner' | 'dessert' | 'ferments' | 'custom' | 'grocery'

const FILTER_BTNS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'smoothie', label: 'Smoothies' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'ferments', label: 'Ferments' },
]

export default function RecipesTab() {
  const store = useRecipeStore()
  const [filter, setFilter]         = useState<Filter>('all')
  const [customTag, setCustomTag]   = useState<string | null>(null)
  const [showModal, setShowModal]   = useState(false)
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => store.getRecipes())
  const [customTags, setCustomTags] = useState<string[]>(() => store.getTags())
  const [query, setQuery]           = useState('')

  const refreshCustom = useCallback(() => {
    setCustomRecipes(store.getRecipes())
    setCustomTags(store.getTags())
  }, [store])

  const handleSave = (r: Recipe) => {
    store.addRecipe(r)
    refreshCustom()
  }

  const handleDelete = (id: number) => {
    if (!window.confirm('Delete this recipe?')) return
    store.deleteRecipe(id)
    refreshCustom()
  }

  const handleAddTag = (tag: string) => {
    store.addTag(tag)
    refreshCustom()
  }

  // Displayed recipes
  const visibleRecipes: Recipe[] = (() => {
    const q = query.trim().toLowerCase()

    // When searching, scan everything (built-in + custom) regardless of filter
    if (q) {
      const all = [...ALL_RECIPES, ...customRecipes]
      return all.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.tag  ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q) ||
        r.ings.some(([ing]) => ing.toLowerCase().includes(q))
      )
    }

    if (filter === 'custom') {
      return customTag ? customRecipes.filter(r => r.cat === customTag) : customRecipes
    }
    if (filter === 'all') return ALL_RECIPES
    return ALL_RECIPES.filter(r => r.cat === filter)
  })()

  const tagsInUse = [...new Set(customRecipes.map(r => r.cat))]

  // Export
  const handleExport = () => {
    const data = JSON.stringify(exportAllData(), null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `wellness_hub_backup_${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const ok = importAllData(ev.target?.result as string)
      if (ok) { alert('Data imported! Reloading...'); location.reload() }
      else alert('Import failed. Make sure you are using a backup file exported from this Hub.')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {FILTER_BTNS.map(btn => (
          <button
            key={btn.id}
            className={`rfbtn${filter === btn.id ? ' active' : ''}`}
            onClick={() => { setFilter(btn.id); setCustomTag(null) }}
          >
            {btn.label}
          </button>
        ))}
        <button
          className={`rfbtn${filter === 'custom' ? ' active' : ''}`}
          style={{ borderColor: filter === 'custom' ? undefined : 'var(--purple)', color: filter === 'custom' ? undefined : 'var(--purple-light)' }}
          onClick={() => { setFilter('custom'); setCustomTag(null) }}
        >
          ⭐ My Recipes
        </button>
        <button
          className={`rfbtn${filter === 'grocery' ? ' active' : ''}`}
          style={{ borderColor: filter === 'grocery' ? undefined : 'var(--green2)', color: filter === 'grocery' ? undefined : 'var(--green-light)' }}
          onClick={() => setFilter('grocery')}
        >
          🛒 Grocery
        </button>
      </div>

      {/* Custom tag sub-filter */}
      {filter === 'custom' && tagsInUse.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--purple)', borderRadius: 9, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--purple-light)', fontFamily: '"DM Mono",monospace', marginRight: 4 }}>Filter by tag:</span>
          <button
            onClick={() => setCustomTag(null)}
            style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: '1px solid var(--purple)', background: 'rgba(138,106,184,0.12)', color: 'var(--purple-light)', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            All my recipes
          </button>
          {tagsInUse.map(tag => (
            <button
              key={tag}
              onClick={() => setCustomTag(tag)}
              style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6, border: `1px solid ${customTag === tag ? 'var(--purple)' : 'var(--border)'}`, background: customTag === tag ? 'rgba(138,106,184,0.12)' : 'var(--bg3)', color: customTag === tag ? 'var(--purple-light)' : 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}
            >
              {tag.charAt(0).toUpperCase() + tag.slice(1)}
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {filter !== 'grocery' && (
        <div style={{ position: 'relative', marginBottom: 14 }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted2)', pointerEvents: 'none' }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search recipes, ingredients…"
            style={{
              width: '100%',
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 9, padding: '9px 36px 9px 34px',
              color: 'var(--text)', fontSize: 13,
              fontFamily: '"DM Sans", sans-serif', outline: 'none',
              transition: 'border-color .2s',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--green)')}
            onBlur={e  => (e.target.style.borderColor = 'var(--border2)')}
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              style={{
                position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', color: 'var(--muted2)',
                cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18, alignItems: 'center' }}>
        <button
          onClick={() => setShowModal(true)}
          style={{ background: 'var(--purple)', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 13, fontFamily: 'sans-serif', color: '#fff', cursor: 'pointer', fontWeight: 500 }}
        >
          + Add my recipe
        </button>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 7 }}>
          <button onClick={handleExport} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 13px', fontSize: 12, fontFamily: '"DM Mono",monospace', color: 'var(--muted)', cursor: 'pointer' }}>
            ↓ Export data
          </button>
          <label style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 13px', fontSize: 12, fontFamily: '"DM Mono",monospace', color: 'var(--muted)', cursor: 'pointer' }}>
            ↑ Import data
            <input type="file" accept=".json" style={{ display: 'none' }} onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Grocery panel */}
      {filter === 'grocery' && <GroceryPanel />}

      {/* Recipe grid */}
      {filter !== 'grocery' && (
        <div className="rgrid">
          {visibleRecipes.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted2)', fontSize: 13, fontStyle: 'italic', gridColumn: '1/-1' }}>
              {query.trim()
                ? <>No recipes found for <strong style={{ color: 'var(--text)' }}>"{query.trim()}"</strong>.</>
                : <>No custom recipes yet. Tap <strong style={{ color: 'var(--purple-light)' }}>+ Add my recipe</strong> to create your first one.</>
              }
            </div>
          ) : (
            visibleRecipes.map((r, i) => (
              <RecipeCard
                key={r.custom ? r.id : i}
                recipe={r}
                onDelete={r.custom ? handleDelete : undefined}
              />
            ))
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <RecipeModal
          customTags={customTags}
          onSave={handleSave}
          onAddTag={handleAddTag}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
