import { useState, useCallback, useMemo, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Recipe } from '../../data/recipes'
import { BUILTIN_RECIPES } from '../../data/recipes'
import { useRecipeStore, useTrackerStore, useHiddenRecipeStore, useGroceryCatalogStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import RecipeCard from './RecipeCard'
import RecipeModal from './RecipeModal'
import GroceryPanel from './GroceryPanel'
import CookingMode from './CookingMode'
import GroceryIngredientModal from './GroceryIngredientModal'

type Filter = 'all' | 'breakfast' | 'smoothie' | 'meal' | 'dessert' | 'snack' | 'ferments' | 'drinks' | 'grocery'

const FILTER_BTNS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'smoothie', label: 'Smoothies' },
  { id: 'meal', label: 'Meals' },
  { id: 'dessert', label: 'Dessert' },
  { id: 'snack', label: 'Snacks' },
  { id: 'drinks', label: 'Drinks' },
  { id: 'ferments', label: 'Ferments' },
]

export default function RecipesTab({ user }: { user?: User | null }) {
  const isAuth = !!user
  const store        = useRecipeStore()
  const trackerStore = useTrackerStore()
  const hiddenStore  = useHiddenRecipeStore()
  const catalogStore = useGroceryCatalogStore()

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
  const [showModal, setShowModal]   = useState(false)
  const [cookingRecipe, setCookingRecipe]   = useState<Recipe | null>(null)
  const [groceryRecipe, setGroceryRecipe]   = useState<Recipe | null>(null)
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null)
  const [customRecipes, setCustomRecipes] = useState<Recipe[]>(() => store.getRecipes())
  const [customTags, setCustomTags] = useState<string[]>(() => store.getTags())
  const [query, setQuery]           = useState('')
  // Seed with the static fallback so the UI is never empty without Supabase.
  // If Supabase is configured, the effect below upgrades this to the full DB catalog.
  const [builtinRecipes, setBuiltinRecipes] = useState<Recipe[]>(BUILTIN_RECIPES)
  const [hiddenIds, setHiddenIds]   = useState<number[]>(() => hiddenStore.getAll())
  const [loading, setLoading]       = useState(false)
  const [loadError]   = useState(false)

  // When Supabase is available, upgrade the static fallback to the full DB catalog.
  // Re-runs when the signed-in user changes so sign-in on any device loads their recipes.
  useEffect(() => {
    if (!supabase) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [remote, userRecipes] = await Promise.all([
        sync.fetchBuiltinRecipes().catch(() => null),
        user ? sync.fetchUserRecipes(user.id).catch(() => []) : Promise.resolve([] as Recipe[]),
      ])
      if (cancelled) return
      if (remote) {
        // Full DB catalog replaces the static fallback
        setBuiltinRecipes(remote)
      }
      // If fetch failed we silently keep the static fallback — no error banner
      if (userRecipes.length) {
        // Merge: keep any localStorage-only recipes (not yet synced or failed to sync)
        setCustomRecipes(prev => {
          const dbIds = new Set(userRecipes.map(r => r.id))
          const localOnly = prev.filter(r => r.id != null && !dbIds.has(r.id))
          return [...userRecipes, ...localOnly]
        })
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const activeFilter: Filter = filter

  const handleSave = async (r: Recipe) => {
    // Check React state (not just localStorage) — on a fresh device, DB-loaded recipes
    // live in state only; using only localStorage would misidentify updates as new recipes.
    const isUpdate = r.id != null && customRecipes.some(x => x.id === r.id)
    const existingLocal = store.getRecipes()

    if (isUpdate) {
      // Update localStorage only if the recipe was there (it may be DB-only on a fresh device)
      if (existingLocal.some(x => x.id === r.id)) {
        store.saveRecipes(existingLocal.map(x => x.id === r.id ? r : x))
      } else {
        store.addRecipe(r)
      }
      // Replace in React state — preserves Supabase-loaded recipes not in localStorage
      setCustomRecipes(prev => prev.map(x => x.id === r.id ? r : x))
    } else {
      store.addRecipe(r)
      // Prepend to React state — preserves all existing recipes
      setCustomRecipes(prev => [r, ...prev])
    }
    setCustomTags(store.getTags())

    // Sync to Supabase when logged in
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const dbId = await sync.upsertUserRecipe(user.id, r)
          if (dbId && !isUpdate) {
            // Swap the local-generated id for the DB-assigned one
            store.deleteRecipe(r.id!)
            store.addRecipe({ ...r, id: dbId })
            setCustomRecipes(prev => prev.map(x => x.id === r.id ? { ...r, id: dbId } : x))
          }
        }
      } catch { /* offline — localStorage copy is sufficient */ }
    }
  }

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this recipe?')) return
    store.deleteRecipe(id)
    setCustomRecipes(prev => prev.filter(r => r.id !== id))
    if (supabase) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await sync.deleteUserRecipe(id)
      } catch { /* offline */ }
    }
  }

  const handleAddTag = (tag: string) => {
    store.addTag(tag)
    setCustomTags(store.getTags())
  }

  /**
   * Edit handler — forks built-in recipes before opening the modal.
   * A fork is a custom copy with `defaultId` pointing to the original.
   * If the user already has a fork for this built-in, open that instead.
   */
  const handleEdit = useCallback((recipe: Recipe) => {
    if (!recipe.custom && recipe.id != null) {
      // Check if a fork already exists in customRecipes
      const existingFork = store.getRecipes().find(r => r.defaultId === recipe.id)
      if (existingFork) {
        setEditRecipe(existingFork)
      } else {
        // Create an in-memory fork — it will be saved by handleSave
        const fork: Recipe = {
          ...recipe,
          id:        Date.now(),
          defaultId: recipe.id,
          source:    'user',
          custom:    true,
          color:     'var(--purple)',
          sc:        'cp',
          tag:       recipe.tag ?? 'My recipe',
          prepL:     recipe.prepTime ?? recipe.prepL ?? 'Custom',
          prepC:     'var(--purple)',
        }
        setEditRecipe(fork)
      }
    } else {
      setEditRecipe(recipe)
    }
    setShowModal(true)
  }, [store])

  const handleCook = useCallback((recipe: Recipe) => {
    setCookingRecipe(recipe)
  }, [])

  const handleHide = useCallback((id: number) => {
    hiddenStore.hide(id)
    setHiddenIds(hiddenStore.getAll())
  }, [hiddenStore])

  const handleRestoreAll = useCallback(() => {
    hiddenStore.restoreAll()
    setHiddenIds([])
  }, [hiddenStore])

  const handleGrocery = useCallback((recipe: Recipe) => {
    setGroceryRecipe(recipe)
  }, [])

  // Built-in recipes excluding the ones the user has hidden
  const visibleBuiltins = useMemo(
    () => builtinRecipes.filter(r => r.id == null || !hiddenIds.includes(r.id)),
    [builtinRecipes, hiddenIds]
  )

  const filterCounts = useMemo<Record<string, number>>(() => {
    const all = [...customRecipes, ...visibleBuiltins]
    const counts: Record<string, number> = { all: all.length }
    for (const r of all) {
      if (r.cat) counts[r.cat] = (counts[r.cat] ?? 0) + 1
    }
    return counts
  }, [customRecipes, visibleBuiltins])

  // Displayed recipes
  const visibleRecipes = useMemo<Recipe[]>(() => {
    const q = query.trim().toLowerCase()

    // When searching, scan everything (built-in + custom) regardless of filter
    if (q) {
      const all = [...customRecipes, ...visibleBuiltins]
      return all.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.tag  ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q) ||
        r.ings.some(([ing]) => ing.toLowerCase().includes(q))
      )
    }

    if (activeFilter === 'all') return [...customRecipes, ...visibleBuiltins]
    return [...customRecipes.filter(r => r.cat === activeFilter), ...visibleBuiltins.filter(r => r.cat === activeFilter)]
  }, [query, activeFilter, visibleBuiltins, customRecipes])

  if (!user) {
    return (
      <div className="guest-gate-cta">
        <div className="guest-gate-cta__icon">📖</div>
        <div className="guest-gate-title">
          Sign in to save <em className="text-purple">Recipes</em>
        </div>
        <div className="guest-gate-body">
          Create, save and organise your personal recipes. Your collection stays private and syncs across devices.
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Filter bar */}
      <div className="flex flex-wrap gap-6 mb-12 items-center">
        {FILTER_BTNS.map(btn => (
          <button
            key={btn.id}
            className={`rfbtn${activeFilter === btn.id ? ' active' : ''}`}
            onClick={() => setFilter(btn.id)}
          >
            {btn.label}
            {!!filterCounts[btn.id] && (
              <span className="rfbtn-count">{filterCounts[btn.id]}</span>
            )}
          </button>
        ))}
        <button
          className={`rfbtn${activeFilter === 'grocery' ? ' active' : ' rfbtn--green'}`}
          onClick={() => setFilter('grocery')}
        >
          🛒 Grocery
        </button>
      </div>

      {/* Search */}
      {activeFilter !== 'grocery' && (
        <div className="recipe-search-wrap">
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
            className="recipe-search-icon"
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search recipes, ingredients…"
            className="recipe-search-input"
          />
          {query && (
            <button onClick={() => setQuery('')} className="recipe-search-clear">×</button>
          )}
        </div>
      )}

      {/* Action bar — only visible to signed-in users and not on the grocery view */}
      {isAuth && activeFilter !== 'grocery' && (
        <div className="flex flex-wrap gap-8 mb-18 items-center">
          <button onClick={() => setShowModal(true)} className="btn btn--secondary btn--md">
            + Add my recipe
          </button>
        </div>
      )}

      {/* Grocery panel */}
      {activeFilter === 'grocery' && <GroceryPanel user={user} />}

      {/* Restore hidden banner — shown when the user has hidden built-in recipes */}
      {hiddenIds.length > 0 && activeFilter !== 'grocery' && (
        <div role="status" aria-label="restore hidden recipes" className="ai-badge mb-14">
          <span>{hiddenIds.length} suggestion{hiddenIds.length !== 1 ? 's' : ''} hidden</span>
          <button onClick={handleRestoreAll} className="ai-badge__dismiss">
            Restore all
          </button>
        </div>
      )}

      {/* Recipe grid */}
      {activeFilter !== 'grocery' && (
        <div className="rgrid">
          {loading ? (
            <div className="empty-state">Loading recipes…</div>
          ) : loadError && !query.trim() ? (
            <div className="empty-state">
              Could not load recipes — check your connection and refresh.
            </div>
          ) : visibleRecipes.length === 0 ? (
            <div className="empty-state">
              {query.trim()
                ? <>No recipes found for <strong className="text-default">"{query.trim()}"</strong>.</>
                : isAuth
                  ? <>No recipes yet. Tap <strong className="text-purple">+ Add my recipe</strong> to create your first one.</>
                  : <>Sign in to add and view your recipes.</>
              }
            </div>
          ) : (
            visibleRecipes.map((r, i) => (
              <RecipeCard
                key={r.custom ? r.id : i}
                recipe={r}
                cookCount={cookCounts[r.name.toLowerCase()] ?? 0}
                onEdit={handleEdit}
                onDelete={r.custom ? handleDelete : undefined}
                onHide={!r.custom && r.id != null ? handleHide : undefined}
                onCook={r.steps.length > 0 ? handleCook : undefined}
                onGrocery={r.ings.length > 0 ? handleGrocery : undefined}
              />
            ))
          )}
        </div>
      )}

      {/* Add / Edit modal */}
      {showModal && (
        <RecipeModal
          customTags={customTags}
          existingNames={[...builtinRecipes, ...customRecipes].map(r => r.name)}
          initialRecipe={editRecipe ?? undefined}
          onSave={handleSave}
          onAddTag={handleAddTag}
          onClose={() => { setShowModal(false); setEditRecipe(null) }}
        />
      )}

      {/* Cooking mode overlay */}
      {cookingRecipe && (
        <CookingMode
          recipe={cookingRecipe}
          onClose={() => setCookingRecipe(null)}
        />
      )}

      {/* Grocery ingredient picker */}
      {groceryRecipe && (
        <GroceryIngredientModal
          recipe={groceryRecipe}
          onAdd={items => {
            items.forEach(item => catalogStore.add(item))
          }}
          onClose={() => setGroceryRecipe(null)}
        />
      )}
    </>
  )
}
