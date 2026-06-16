import { useState, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Recipe } from '../data/recipes'
import { resolveShareToken } from '../lib/recipeShare'
import { recipeStore } from '../hooks/useStore'
import * as sync from '../lib/sync'
import RecipeCard from './RecipesTab/RecipeCard'

/**
 * Standalone landing page for a shared recipe link (`#/r/<token>`).
 * Renders a read-only recipe for anyone, and offers signed-in Wellness Hub
 * users a one-tap import into their own library.
 */
export default function SharedRecipeView({
  token,
  user,
  onExit,
}: {
  token: string
  user: User | null
  onExit: () => void
}) {
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined)  // undefined = loading
  const [importState, setImportState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle')

  useEffect(() => {
    let alive = true
    resolveShareToken(token).then(r => { if (alive) setRecipe(r) })
    return () => { alive = false }
  }, [token])

  const handleImport = async () => {
    if (!recipe || !user) return
    setImportState('saving')
    try {
      // Fresh local identity — never reuse the sharer's id/source
      const fresh: Recipe = { ...recipe, id: Date.now(), custom: true, source: 'user' }
      recipeStore.addRecipe(fresh)
      const dbId = await sync.upsertUserRecipe(user.id, fresh).catch(() => null)
      if (dbId != null) {
        recipeStore.saveRecipes(
          recipeStore.getRecipes().map(x => x.id === fresh.id ? { ...x, id: dbId } : x),
        )
      }
      setImportState('done')
    } catch {
      setImportState('error')
    }
  }

  return (
    <div className="shared-recipe-page">
      <div className="shared-recipe-head">
        <span className="shared-recipe-brand">🌿 Wellness Hub</span>
        <span className="shared-recipe-sub">Shared recipe</span>
      </div>

      {recipe === undefined ? (
        <div className="shared-recipe-msg">Loading recipe…</div>
      ) : recipe === null ? (
        <div className="shared-recipe-msg">
          This recipe link is invalid or damaged.
          <div><button className="btn btn--ghost btn--sm" onClick={onExit}>Open Wellness Hub</button></div>
        </div>
      ) : (
        <>
          <RecipeCard recipe={recipe} autoOpen />

          <div className="shared-recipe-actions">
            {user ? (
              importState === 'done' ? (
                <span className="shared-recipe-ok">✓ Added to your recipes</span>
              ) : (
                <button
                  className="btn btn--primary"
                  onClick={handleImport}
                  disabled={importState === 'saving'}
                >
                  {importState === 'saving' ? 'Adding…' : '＋ Import to my recipes'}
                </button>
              )
            ) : (
              <span className="shared-recipe-hint">Sign in to Wellness Hub to save this recipe.</span>
            )}
            {importState === 'error' && (
              <span className="shared-recipe-err">Could not import — please try again.</span>
            )}
            <button className="btn btn--ghost btn--sm" onClick={onExit}>Open Wellness Hub</button>
          </div>
        </>
      )}
    </div>
  )
}
