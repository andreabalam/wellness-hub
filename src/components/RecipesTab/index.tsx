import { useState, useCallback, useMemo, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Recipe, DietTag } from '../../data/recipes'
import { BUILTIN_RECIPES, DIET_TAGS } from '../../data/recipes'
import { useRecipeStore, useTrackerStore, useHiddenRecipeStore, useGroceryCatalogStore, builtinRecipeCacheStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import { reportError } from '../../lib/errorLog'
import { showToast } from '../../lib/toast'
import { mergeRecipes, applyIdMap } from '../../lib/recipeSync'
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

/** Request to open a specific recipe (from the tracker's 📖 badge).
 *  `seq` changes on every request so repeat opens of the same recipe re-fire. */
export interface OpenRecipeRequest { id?: number; name: string; seq: number }

export default function RecipesTab({ user, openRequest }: {
  user?: User | null
  openRequest?: OpenRecipeRequest | null
}) {
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
  const [dietFilter, setDietFilter] = useState<DietTag | 'all'>('all')
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
      const remote = await sync.fetchBuiltinRecipes().catch(() => null)
      // null = no user or the fetch failed; only a successful fetch is safe to
      // merge/prune against (an error must not wipe synced recipes).
      let userRecipes: Recipe[] | null = null
      if (user) {
        try { userRecipes = await sync.fetchUserRecipes(user.id) }
        catch (err) { reportError('recipe-sync:pull', err) }
      }
      if (cancelled) return

      if (remote) {
        // Full DB catalog replaces the static fallback
        setBuiltinRecipes(remote)
        // Cache for the tracker's log-food search (read-only consumer)
        builtinRecipeCacheStore.save(remote)
      }

      if (userRecipes === null) {
        // No successful user fetch — keep whatever is local, untouched.
        setCustomRecipes(store.getRecipes())
        setLoading(false)
        return
      }

      // Merge against the DB: prune recipes deleted on other devices, push
      // never-synced local ones. See mergeRecipes for the id-as-tombstone rule.
      const { merged, toPush } = mergeRecipes(store.getRecipes(), userRecipes)

      let finalMerged = merged
      if (user && toPush.length) {
        const idMap = new Map<number, number>() // old placeholder id → new DB id
        await Promise.all(toPush.map(async r => {
          const dbId = await sync.upsertUserRecipe(user.id, r)
            .catch(err => { reportError('recipe-sync:push', err); return null })
          if (dbId != null && dbId !== r.id) idMap.set(r.id!, dbId)
        }))
        if (cancelled) return
        finalMerged = applyIdMap(merged, idMap)
      }

      // Persist the reconciled set to localStorage so custom recipes survive
      // reloads, work offline, and appear in JSON backups; prunes are dropped here.
      store.saveRecipes(finalMerged)
      setCustomRecipes(finalMerged)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [user?.id])

  // Open-from-tracker: when a 📖 badge is tapped, expand the linked recipe.
  // Resolve by id first; ids can go stale after the first sync (placeholder →
  // DB id swap), so fall back to a case-insensitive name match. When nothing
  // matches (e.g. recipe deleted or hidden), surface the name as a search so
  // the user sees why.
  const [autoOpenName, setAutoOpenName] = useState<string | null>(null)
  useEffect(() => {
    if (!openRequest) return
    // Read the store live — customRecipes state can lag localStorage when the
    // request arrives right after external writes (sync, another tab's upsert)
    const all = [
      ...store.getRecipes(),
      ...(builtinRecipes.length ? builtinRecipes : builtinRecipeCacheStore.getAll()),
    ]
    const match =
      (openRequest.id != null ? all.find(r => r.id === openRequest.id) : undefined) ??
      all.find(r => r.name.toLowerCase() === openRequest.name.toLowerCase())
    const visible = match && !(match.id != null && !match.custom && hiddenIds.includes(match.id))
    /* eslint-disable react-hooks/set-state-in-effect */
    if (match && visible) {
      // The matched recipe may exist in localStorage but not in the rendered
      // list yet — state is seeded at mount, and without Supabase there is no
      // fetch effect to re-merge it. Inject it so there is a card to expand.
      if (match.custom) {
        setCustomRecipes(prev => prev.some(r => r.id === match.id) ? prev : [...prev, match])
      } else {
        setBuiltinRecipes(prev => prev.some(r => r.id === match.id) ? prev : [...prev, match])
      }
      setFilter('all')
      setQuery('')
      setAutoOpenName(match.name.toLowerCase())
    } else {
      setQuery(openRequest.name)
      setAutoOpenName(null)
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openRequest?.seq])

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
          if (dbId == null) {
            // DB write failed — the recipe is saved locally and the next sign-in
            // sync will retry the push. Treat null as a hard failure: do NOT keep
            // believing it synced, and surface it to the user + the error log.
            showToast(reportError('recipe-save', new Error(`recipe sync failed: ${r.name}`)), 'error')
          } else if (dbId !== r.id) {
            // Swap the local placeholder id for the DB-assigned one. Runs for both
            // new recipes and updates whose id was still a placeholder, so repeated
            // edits update the same row instead of inserting duplicates.
            store.deleteRecipe(r.id!)
            store.addRecipe({ ...r, id: dbId })
            setCustomRecipes(prev => prev.map(x => x.id === r.id ? { ...r, id: dbId } : x))
          }
        }
      } catch (err) {
        showToast(reportError('recipe-save', err), 'error')
      }
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

  // True when at least one visible recipe carries a diet tag — gates the diet filter row
  const hasDietTags = useMemo(
    () => [...customRecipes, ...visibleBuiltins].some(r => r.dietTag),
    [customRecipes, visibleBuiltins]
  )

  // Displayed recipes
  const visibleRecipes = useMemo<Recipe[]>(() => {
    const q = query.trim().toLowerCase()
    const applyDiet = (list: Recipe[]) =>
      dietFilter === 'all' ? list : list.filter(r => r.dietTag === dietFilter)

    // When searching, scan everything (built-in + custom) regardless of filter
    if (q) {
      const all = [...customRecipes, ...visibleBuiltins]
      return applyDiet(all.filter(r =>
        r.name.toLowerCase().includes(q) ||
        (r.tag  ?? '').toLowerCase().includes(q) ||
        (r.type ?? '').toLowerCase().includes(q) ||
        r.ings.some(([ing]) => ing.toLowerCase().includes(q))
      ))
    }

    if (activeFilter === 'all') return applyDiet([...customRecipes, ...visibleBuiltins])
    return applyDiet([...customRecipes.filter(r => r.cat === activeFilter), ...visibleBuiltins.filter(r => r.cat === activeFilter)])
  }, [query, activeFilter, dietFilter, visibleBuiltins, customRecipes])

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

      {/* Dietary approach filter — only shown when some recipes are diet-tagged */}
      {activeFilter !== 'grocery' && hasDietTags && (
        <div className="flex flex-wrap gap-6 mb-12 items-center">
          <button
            className={`rfbtn rfbtn--sm${dietFilter === 'all' ? ' active' : ''}`}
            onClick={() => setDietFilter('all')}
          >
            All diets
          </button>
          {DIET_TAGS.map(d => (
            <button
              key={d.id}
              className={`rfbtn rfbtn--sm${dietFilter === d.id ? ' active' : ''}`}
              onClick={() => setDietFilter(dietFilter === d.id ? 'all' : d.id)}
            >
              {d.label}
            </button>
          ))}
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
                autoOpen={autoOpenName === r.name.toLowerCase()}
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
