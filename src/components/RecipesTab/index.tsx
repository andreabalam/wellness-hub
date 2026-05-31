import { useState, useCallback, useMemo, useEffect } from 'react'
import type { Recipe } from '../../data/recipes'
import { useRecipeStore, useTrackerStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import RecipeCard from './RecipeCard'
import RecipeModal from './RecipeModal'
import GroceryPanel from './GroceryPanel'

type Filter = 'all' | 'breakfast' | 'smoothie' | 'lunch' | 'dinner' | 'dessert' | 'snack' | 'ferments' | 'drinks' | 'custom' | 'grocery'

const FILTER_BTNS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'smoothie', label: 'Smoothies' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'snack', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'ferments', label: 'Ferments' },
]

export default function RecipesTab() {
  const store        = useRecipeStore()
  const trackerStore = useTrackerStore()

  /** Map of recipe name (lowercase) → number of times logged in the tracker */
  const cookCounts = useMemo<Record<string, number>>(() => {
    const all = trackerStore.getAll()
    const counts: Record<string, number> = {}
    for (const day of Object.values(all)) {
      for (const entry of day.foods ?? []) {
        const key = entry.n.toLowerCase()
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
    return counts
  }, [trackerStore])

  const [filter, setFilter]         = useState<Filter>('all')
  const [customTag, setCustomTag]   = useState<string | null>(null)
  const [showModal, setShowModal]   = useState(false)
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => store.getRecipes())
  const [customTags, setCustomTags] = useState<string[]>(() => store.getTags())
  const [query, setQuery]           = useState('')
  const [builtinRecipes, setBuiltinRecipes] = useState<Recipe[]>([])
  // When supabase isn't configured there's nothing to load — start in error state
  const [loading, setLoading]       = useState(!supabase ? false : true)
  const [loadError, setLoadError]   = useState(!supabase)

  // Fetch built-in + user recipes from Supabase on mount
  useEffect(() => {
    if (!supabase) return  // already initialised as error state above
    let cancelled = false
    ;(async () => {
      const [remote, user] = await Promise.all([
        sync.fetchBuiltinRecipes().catch(() => null),
        (async () => {
          try {
            const { data: { user: u } } = await supabase!.auth.getUser()
            return u ? sync.fetchUserRecipes(u.id).catch(() => []) : []
          } catch { return [] as Recipe[] }
        })(),
      ])
      if (cancelled) return
      if (remote) {
        setBuiltinRecipes(remote)
        setLoadError(false)
      } else {
        setLoadError(true)
      }
      if (user.length) {
        // Merge: DB custom recipes take priority over localStorage
        setCustomRecipes(user)
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const activeFilter: Filter = filter

  const refreshCustom = useCallback(() => {
    setCustomRecipes(store.getRecipes())
    setCustomTags(store.getTags())
  }, [store])

  const handleSave = async (r: Recipe) => {
    // Always save to localStorage immediately
    store.addRecipe(r)
    refreshCustom()
    // Also save to Supabase when logged in
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const dbId = await sync.upsertUserRecipe(user.id, r)
          if (dbId) {
            // Update the recipe's id to the DB-assigned one and refresh
            store.deleteRecipe(r.id!)
            store.addRecipe({ ...r, id: dbId })
            refreshCustom()
          }
        }
      } catch { /* offline — localStorage copy is sufficient */ }
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this recipe?')) return
    store.deleteRecipe(id)
    refreshCustom()
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await sync.deleteUserRecipe(id)
      } catch { /* offline */ }
    }
  }

  const handleAddTag = (tag: string) => {
    store.addTag(tag)
    refreshCustom()
  }

  // Displayed recipes
  const visibleRecipes = useMemo<Recipe[]>(() => {
    const q = query.trim().toLowerCase()

    // When searching, scan everything (built-in + custom) regardless of filter
    if (q) {
      const all = [...builtinRecipes, ...customRecipes]
      return all.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.tag  ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q) ||
        r.ings.some(([ing]) => ing.toLowerCase().includes(q))
      )
    }

    if (activeFilter === 'custom') {
      return customTag ? customRecipes.filter(r => r.cat === customTag) : customRecipes
    }
    if (activeFilter === 'all') return builtinRecipes
    return builtinRecipes.filter(r => r.cat === activeFilter)
  }, [query, activeFilter, customTag, builtinRecipes, customRecipes])

  const tagsInUse = useMemo(() => [...new Set(customRecipes.map(r => r.cat))], [customRecipes])

  return (
    <>
      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12, alignItems: 'center' }}>
        {FILTER_BTNS.map(btn => (
          <button
            key={btn.id}
            className={`rfbtn${activeFilter === btn.id ? ' active' : ''}`}
            onClick={() => { setFilter(btn.id); setCustomTag(null) }}
          >
            {btn.label}
          </button>
        ))}
        <button
          className={`rfbtn${activeFilter === 'custom' ? ' active' : ''}`}
          style={{ borderColor: activeFilter === 'custom' ? undefined : 'var(--purple)', color: activeFilter === 'custom' ? undefined : 'var(--purple-light)' }}
          onClick={() => { setFilter('custom'); setCustomTag(null) }}
        >
          ⭐ My Recipes
        </button>
        <button
          className={`rfbtn${activeFilter === 'grocery' ? ' active' : ''}`}
          style={{ borderColor: activeFilter === 'grocery' ? undefined : 'var(--green2)', color: activeFilter === 'grocery' ? undefined : 'var(--green-light)' }}
          onClick={() => setFilter('grocery')}
        >
          🛒 Grocery
        </button>
      </div>

      {/* Custom tag sub-filter */}
      {activeFilter === 'custom' && tagsInUse.length > 0 && (
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
      {activeFilter !== 'grocery' && (
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
      </div>

      {/* Grocery panel */}
      {activeFilter === 'grocery' && <GroceryPanel />}

      {/* Recipe grid */}
      {activeFilter !== 'grocery' && (
        <div className="rgrid">
          {loading ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted2)', fontSize: 13, gridColumn: '1/-1' }}>
              Loading recipes…
            </div>
          ) : loadError && filter !== 'custom' && !query.trim() ? (
            <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted2)', fontSize: 13, fontStyle: 'italic', gridColumn: '1/-1' }}>
              Could not load recipes — check your connection and refresh.
            </div>
          ) : visibleRecipes.length === 0 ? (
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
                cookCount={cookCounts[r.name.toLowerCase()] ?? 0}
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
