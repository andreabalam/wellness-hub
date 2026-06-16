import { useState, useRef, useCallback, useMemo } from 'react'
import { PRESET_CATS, normalizeCat, catLabel, DIET_TAGS } from '../../data/recipes'
import type { Recipe, DietTag } from '../../data/recipes'
import { supabase } from '../../lib/supabase'
import {
  importRecipeFromFile,
  importRecipeFromUrl,
  ACCEPTED_EXT,
  type ExtractedRecipe,
} from '../../lib/recipeImport'
import {
  computeRecipeMacros,
  makeCachedUsdaLookup,
  type IngredientResolution,
} from '../../lib/recipeMacros'

interface Props {
  customTags: string[]
  /** Names of all existing recipes — used to prevent duplicate titles */
  existingNames?: string[]
  /** When set, the modal pre-populates fields for editing an existing recipe */
  initialRecipe?: Recipe
  onSave: (r: Recipe) => void
  onAddTag: (tag: string) => void
  onClose: () => void
}

const PREP_TIME_PRESETS = ['5 min', '10 min', '15 min', '20 min', '30 min', '45 min', '1 hr+', 'Prep ahead', 'Meal prep']

/** Strip the trailing "g" from macro strings like "35g" → "35" */
function stripG(s: string | undefined): string {
  if (!s) return ''
  const n = parseInt(s)
  return isNaN(n) || n === 0 ? '' : String(n)
}

type ImportState = 'idle' | 'loading' | 'done' | 'error'

export default function RecipeModal({ customTags, existingNames = [], initialRecipe, onSave, onAddTag, onClose }: Props) {
  const isEdit = Boolean(initialRecipe)

  // ── Recipe form state ─────────────────────────────────────────
  const [name, setName]           = useState(() => initialRecipe?.name ?? '')
  const [tagLine, setTagLine]     = useState(() => initialRecipe?.tag ?? '')
  const [cat, setCat]             = useState(() => initialRecipe?.cat ?? 'meal')
  const [newTag, setNewTag]       = useState('')
  const [prepTime, setPrepTime]   = useState(() => initialRecipe?.prepTime ?? initialRecipe?.prepL ?? '')
  const [healthTag, setHealthTag] = useState<'healthy' | 'indulgent' | ''>(() => initialRecipe?.healthTag ?? '')
  const [dietTag, setDietTag]     = useState<DietTag | ''>(() => initialRecipe?.dietTag ?? '')
  const [gramsPerServing, setGramsPerServing] = useState<number | undefined>(() => initialRecipe?.gramsPerServing)
  const [link, setLink]           = useState(() => initialRecipe?.link ?? '')
  const [image, setImage]         = useState(() => initialRecipe?.image ?? '')
  const [kcal, setKcal]           = useState(() => initialRecipe ? String(initialRecipe.hk || '') : '')
  const [prot, setProt]           = useState(() => stripG(initialRecipe?.hp))
  const [carb, setCarb]           = useState(() => stripG(initialRecipe?.hc))
  const [fat, setFat]             = useState(() => stripG(initialRecipe?.hf))
  const [fib, setFib]             = useState(() => stripG(initialRecipe?.hfi))
  const [ings, setIngs]           = useState<[string, string][]>(() => initialRecipe?.ings ?? [])
  const [ingName, setIngName]     = useState('')
  const [ingAmt, setIngAmt]       = useState('')
  const [steps, setSteps]         = useState<string[]>(() => initialRecipe?.steps ?? [])
  const [stepTxt, setStepTxt]     = useState('')
  const [editingStep, setEditingStep] = useState<number | null>(null)
  const [editStepTxt, setEditStepTxt] = useState('')
  const [tip, setTip]             = useState(() => initialRecipe?.tip ?? '')
  const [msg, setMsg]             = useState('')
  const [msgOk, setMsgOk]         = useState(true)

  // ── Import state ──────────────────────────────────────────────
  const [importState, setImportState] = useState<ImportState>('idle')
  const [importError, setImportError] = useState('')
  const [importUrl, setImportUrl]     = useState('')
  const [dragging, setDragging]       = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Macro calculation state (manual recipes only) ─────────────
  const [servings, setServings]   = useState('1')
  const [calcState, setCalcState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [calcRows, setCalcRows]   = useState<IngredientResolution[]>([])
  const [calcError, setCalcError] = useState('')

  const allTags = useMemo(() => [...new Set([...PRESET_CATS, ...customTags])], [customTags])

  // ── Import helpers ────────────────────────────────────────────

  const applyImport = useCallback((r: ExtractedRecipe) => {
    if (r.name)     setName(r.name)
    // Only accept categories that exist as filter chips — the AI is asked for a
    // valid one but isn't guaranteed to comply; anything unknown becomes 'meal'
    if (r.cat) {
      const c = normalizeCat(r.cat)
      setCat(allTags.includes(c) ? c : 'meal')
    }
    if (r.tag)      setTagLine(r.tag)
    if (r.prepTime) setPrepTime(r.prepTime)
    if (r.ings?.length)   setIngs(r.ings)
    if (r.steps?.length)  setSteps(r.steps)
    if (r.tip)      setTip(r.tip)
    if (r.kcal)     setKcal(String(r.kcal))
    if (r.protein)  setProt(r.protein.replace(/g$/i, ''))
    if (r.carbs)    setCarb(r.carbs.replace(/g$/i, ''))
    if (r.fat)      setFat(r.fat.replace(/g$/i, ''))
    if (r.fiber)     setFib(r.fiber.replace(/g$/i, ''))
    if (r.healthTag) {
      const tag = String(r.healthTag).toLowerCase().trim()
      if (tag === 'healthy' || tag === 'indulgent') setHealthTag(tag)
    }
    if (r.dietTag) {
      const d = String(r.dietTag).toLowerCase().trim()
      const match = DIET_TAGS.find(dt => dt.id === d)
      if (match) setDietTag(match.id)
    }
    if (r.link)      setLink(r.link)
  }, [allTags])

  const handleFile = useCallback(async (file: File) => {
    if (!file) return
    if (!supabase) {
      setImportState('error')
      setImportError('Sign in to use file import.')
      return
    }
    setImportState('loading')
    setImportError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setImportState('error')
        setImportError('Sign in to use file import.')
        return
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const recipe = await importRecipeFromFile(file, session.access_token, supabaseUrl)
      applyImport(recipe)
      setImportState('done')
    } catch (err) {
      setImportState('error')
      setImportError(err instanceof Error ? err.message : 'Import failed — please try again.')
    }
  }, [applyImport])

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ''    // reset so the same file can be re-selected
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  const handleUrl = useCallback(async () => {
    const url = importUrl.trim()
    if (!url) return
    if (!/^https?:\/\/.+/i.test(url)) {
      setImportState('error')
      setImportError('Enter a valid http(s) URL.')
      return
    }
    if (!supabase) {
      setImportState('error')
      setImportError('Sign in to use URL import.')
      return
    }
    setImportState('loading')
    setImportError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setImportState('error')
        setImportError('Sign in to use URL import.')
        return
      }
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const recipe = await importRecipeFromUrl(url, session.access_token, supabaseUrl)
      applyImport(recipe)
      setImportState('done')
    } catch (err) {
      setImportState('error')
      setImportError(err instanceof Error ? err.message : 'Import failed — please try again.')
    }
  }, [importUrl, applyImport])

  // ── Recipe form helpers ────────────────────────────────────────

  const addTag = () => {
    const val = newTag.trim().toLowerCase()
    if (!val) return
    onAddTag(val)
    setCat(val)
    setNewTag('')
  }

  /** A stale resolution list is misleading — drop it when ingredients change */
  const resetCalc = () => {
    setCalcState('idle')
    setCalcRows([])
    setCalcError('')
    setGramsPerServing(undefined)   // stale once ingredients change
  }

  const addIng = () => {
    if (!ingName.trim()) return
    setIngs(prev => [...prev, [ingName.trim(), ingAmt.trim() || '—']])
    setIngName(''); setIngAmt('')
    resetCalc()
  }

  const calcMacros = async () => {
    if (!ings.length || calcState === 'loading') return
    setCalcState('loading')
    setCalcError('')
    try {
      const result = await computeRecipeMacros(
        ings,
        parseInt(servings) || 1,
        makeCachedUsdaLookup(),
      )
      setCalcRows(result.rows)
      if (!result.matched) {
        setCalcState('error')
        setCalcError('No ingredients could be matched — fill in the macros manually.')
        return
      }
      // Capture grams/serving from the resolved rows for the caloric-density dot
      const totalGrams = result.rows.reduce((sum, r) => sum + (r.grams ?? 0), 0)
      const div = parseInt(servings) || 1
      setGramsPerServing(totalGrams > 0 ? Math.round(totalGrams / div) : undefined)
      setKcal(String(result.totals.k))
      setProt(String(result.totals.p))
      setCarb(String(result.totals.c))
      setFat(String(result.totals.f))
      setFib(result.totals.fi > 0 ? String(result.totals.fi) : '')
      setCalcState('done')
    } catch {
      setCalcState('error')
      setCalcError('Food database unavailable — check your connection and try again.')
    }
  }

  const addStep = () => {
    if (!stepTxt.trim()) return
    setSteps(prev => [...prev, stepTxt.trim()])
    setStepTxt('')
  }

  const moveStep = (idx: number, dir: -1 | 1) => {
    setSteps(prev => {
      const swap = idx + dir
      if (swap < 0 || swap >= prev.length) return prev
      const next = [...prev]
      ;[next[idx], next[swap]] = [next[swap], next[idx]]
      return next
    })
    setEditingStep(null)
  }

  const startEditStep = (idx: number) => {
    setEditingStep(idx)
    setEditStepTxt(steps[idx])
  }

  const commitEditStep = () => {
    if (editingStep === null) return
    const txt = editStepTxt.trim()
    setSteps(prev => txt ? prev.map((s, i) => i === editingStep ? txt : s) : prev)
    setEditingStep(null)
  }

  const save = () => {
    if (!name.trim()) { setMsg('Please enter a recipe name.'); setMsgOk(false); return }

    // Duplicate title check — skip for edits where the name hasn't changed
    const trimmedName = name.trim().toLowerCase()
    const originalName = initialRecipe?.name.toLowerCase()
    if (trimmedName !== originalName) {
      const isDuplicate = existingNames.some(n => n.toLowerCase() === trimmedName)
      if (isDuplicate) {
        setMsg('A recipe with this name already exists. Please use a different title.')
        setMsgOk(false)
        return
      }
    }

    const hkVal = parseInt(kcal) || 0
    const safeCat = normalizeCat(cat)   // never save an empty or removed category
    const recipe: Recipe = {
      id: initialRecipe?.id ?? Date.now(),
      defaultId: initialRecipe?.defaultId,
      source: initialRecipe?.source ?? 'user',
      custom: true,
      cat: safeCat,
      type: catLabel(safeCat),
      color: initialRecipe?.color ?? 'var(--purple)',
      sc:    initialRecipe?.sc    ?? 'cp',
      name: name.trim(),
      tag: tagLine.trim() || 'My recipe',
      prepL: prepTime || 'Custom',
      prepC: 'var(--purple)',
      prepTime: prepTime || undefined,
      healthTag: (healthTag as 'healthy' | 'indulgent') || undefined,
      dietTag: dietTag || undefined,
      gramsPerServing,
      link: link.trim() || undefined,
      image: image.trim() || undefined,
      hk: hkVal,
      hp: `${parseInt(prot) || 0}g`,
      hc: `${parseInt(carb) || 0}g`,
      hf: `${parseInt(fat) || 0}g`,
      hfi: fib ? `${parseInt(fib) || 0}g` : undefined,
      mk: hkVal,
      mp: `${parseInt(prot) || 0}g`,
      mc: `${parseInt(carb) || 0}g`,
      mf: `${parseInt(fat) || 0}g`,
      ings, steps, tip: tip.trim(),
    }
    onSave(recipe)
    setMsg(isEdit ? 'Changes saved!' : 'Recipe saved!')
    setMsgOk(true)
    setTimeout(onClose, 900)
  }

  const chipStyle = (active: boolean, color: string) => ({
    fontSize: 12, padding: '4px 12px', borderRadius: 7,
    border: `1px solid ${active ? color : 'var(--border)'}`,
    background: active ? `${color}22` : 'var(--bg3)',
    color: active ? color : 'var(--muted)',
    cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all .15s',
  })

  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal-panel">
        <div className="modal-header modal-header--center">
          <div className="modal-title">
            {isEdit
              ? <>Edit my <em className="italic text-purple">Recipe</em></>
              : <>Add my <em className="italic text-purple">Recipe</em></>
            }
          </div>
          <button onClick={onClose} className="modal-close">×</button>
        </div>

        {/* ── Import from file (new recipes only) ────────────────── */}
        {!isEdit && (
          <div className="import-section">
            {importState === 'done' ? (
              <div className="import-success" role="status">
                <span className="import-success__icon">✓</span>
                <span>Recipe extracted — review the fields below and save when ready.</span>
                <button
                  className="import-success__redo"
                  onClick={() => setImportState('idle')}
                  title="Import a different file"
                >
                  ↺
                </button>
              </div>
            ) : (
              <>
                <div
                  className={`import-zone${dragging ? ' import-zone--dragging' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={onDrop}
                  onClick={() => importState !== 'loading' && fileInputRef.current?.click()}
                  role="button"
                  aria-label="Import recipe from file"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={ACCEPTED_EXT}
                    onChange={onFileInput}
                    style={{ display: 'none' }}
                    data-testid="recipe-file-input"
                  />

                  {importState === 'loading' ? (
                    <div className="import-zone__loading">
                      <span className="import-spinner" aria-label="Extracting recipe" />
                      <span className="import-zone__loading-text">Extracting recipe with AI…</span>
                    </div>
                  ) : (
                    <div className="import-zone__body">
                      <span className="import-zone__icon">📎</span>
                      <span className="import-zone__cta">
                        Drop a file or <span className="import-zone__link">browse</span>
                      </span>
                      <span className="import-zone__hint">PDF · TXT · JPG · PNG · WebP</span>
                    </div>
                  )}
                </div>

                <div className="import-url-row">
                  <span className="import-url-or">or paste a link</span>
                  <div className="import-url-field">
                    <input
                      className="tinput"
                      type="url"
                      inputMode="url"
                      value={importUrl}
                      onChange={e => setImportUrl(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleUrl() } }}
                      placeholder="https://example.com/recipe"
                      disabled={importState === 'loading'}
                      data-testid="recipe-url-input"
                    />
                    <button
                      type="button"
                      className="tbtn tbtn--purple"
                      onClick={handleUrl}
                      disabled={importState === 'loading' || !importUrl.trim()}
                    >
                      Import
                    </button>
                  </div>
                </div>

                {importState === 'error' && (
                  <div className="import-error" role="alert">
                    {importError}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Recipe name ──────────────────────────────────────────── */}
        <FieldRow label="Recipe name *">
          <input className="tinput" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mango Chia Pudding" />
        </FieldRow>

        {/* Tagline */}
        <FieldRow label="Short description">
          <input className="tinput" value={tagLine} onChange={e => setTagLine(e.target.value)} placeholder="e.g. High protein · gluten free" />
        </FieldRow>

        {/* Category */}
        <FieldRow label="Category (pick one or create your own)">
          <div className="flex flex-wrap gap-6 mb-8">
            {allTags.map(tag => (
              <button key={tag} onClick={() => setCat(tag)} style={chipStyle(cat === tag, 'var(--purple)')}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-6">
            <input className="tinput flex-1" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag (e.g. Sauce, Side...)" />
            <button onClick={addTag} className="btn-add-tag">Add tag</button>
          </div>
        </FieldRow>

        {/* Prep time */}
        <FieldRow label="Prep time">
          <div className="flex flex-wrap gap-6 mb-6">
            {PREP_TIME_PRESETS.map(t => (
              <button key={t} onClick={() => setPrepTime(prepTime === t ? '' : t)} style={chipStyle(prepTime === t, 'var(--teal)')}>
                {t}
              </button>
            ))}
          </div>
          <input
            className="tinput mt-4" value={prepTime} onChange={e => setPrepTime(e.target.value)}
            placeholder="Or type custom time, e.g. 25 min"
          />
        </FieldRow>

        {/* Health tag */}
        <FieldRow label="Health tag">
          <div className="flex gap-8">
            <button onClick={() => setHealthTag(healthTag === 'healthy' ? '' : 'healthy')} style={chipStyle(healthTag === 'healthy', 'var(--green)')}>
              ✦ Healthy
            </button>
            <button onClick={() => setHealthTag(healthTag === 'indulgent' ? '' : 'indulgent')} style={chipStyle(healthTag === 'indulgent', 'var(--purple)')}>
              ✧ Indulgent
            </button>
          </div>
        </FieldRow>

        {/* Diet tag */}
        <FieldRow label="Dietary approach (optional)">
          <div className="flex flex-wrap gap-6">
            {DIET_TAGS.map(d => (
              <button
                key={d.id}
                onClick={() => setDietTag(dietTag === d.id ? '' : d.id)}
                style={chipStyle(dietTag === d.id, 'var(--teal)')}
              >
                {d.label}
              </button>
            ))}
          </div>
        </FieldRow>

        {/* Macros */}
        <FieldRow label="Macros per serving (optional)">
          <div className="macro-grid-5">
            {([['kcal', kcal, setKcal], ['prot g', prot, setProt], ['carb g', carb, setCarb], ['fat g', fat, setFat], ['fiber g', fib, setFib]] as [string, string, (v: string) => void][]).map(([ph, val, set]) => (
              <input key={ph} className="tnum" type="number" min="0" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
            ))}
          </div>

          {/* Calculate from ingredients — manual recipes only, not file imports */}
          {importState !== 'done' && (
            <div className="macro-calc">
              <div className="macro-calc__controls">
                <label className="macro-calc__servings">
                  Servings
                  <input
                    className="tnum" type="number" min="1" value={servings}
                    onChange={e => setServings(e.target.value)}
                    aria-label="Servings the recipe makes"
                  />
                </label>
                <button
                  className="macro-calc__btn"
                  onClick={calcMacros}
                  disabled={!ings.length || calcState === 'loading'}
                  title={ings.length ? 'Look up each ingredient in the USDA food database' : 'Add ingredients below first'}
                >
                  {calcState === 'loading'
                    ? <><span className="import-spinner import-spinner--sm" aria-hidden />Calculating…</>
                    : '⚡ Calculate from ingredients'}
                </button>
              </div>

              {calcState === 'error' && <div className="import-error" role="alert">{calcError}</div>}

              {calcRows.length > 0 && calcState !== 'loading' && (
                <div className="macro-calc__rows">
                  {calcRows.map((r, i) => (
                    <div key={i} className={`macro-calc__row macro-calc__row--${r.status}`}>
                      {r.status === 'ok' && <>✓ {r.ing} · {r.amount} → {r.matchName} · {r.grams}g · {r.kcal} kcal</>}
                      {r.status === 'no-amount' && <>⚠ {r.ing} · {r.amount} — amount unclear, skipped</>}
                      {r.status === 'no-match' && <>✗ {r.ing} — no food database match, skipped</>}
                    </div>
                  ))}
                  {calcState === 'done' && (
                    <div className="macro-calc__note">Estimated from USDA data — review before saving.</div>
                  )}
                </div>
              )}
            </div>
          )}
        </FieldRow>

        {/* Ingredients */}
        <FieldRow label="Ingredients">
          {ings.map(([n, a], i) => (
            <div key={i} className="ing-row">
              <span className="flex-1 text-base text-default">{n}</span>
              <span className="text-sm text-muted font-mono">{a}</span>
              <button onClick={() => { setIngs(prev => prev.filter((_, j) => j !== i)); resetCalc() }} className="icon-delete">×</button>
            </div>
          ))}
          <div className="flex gap-6">
            <input className="tinput flex-1" value={ingName} onChange={e => setIngName(e.target.value)} placeholder="Ingredient"
              onKeyDown={e => e.key === 'Enter' && addIng()} style={{ flex: 2 }} />
            <input className="tinput" value={ingAmt} onChange={e => setIngAmt(e.target.value)} placeholder="Amount"
              onKeyDown={e => e.key === 'Enter' && addIng()} style={{ flex: 1 }} />
            <button onClick={addIng} className="icon-add-btn">+</button>
          </div>
        </FieldRow>

        {/* Steps */}
        <FieldRow label="Steps">
          {steps.map((s, i) => (
            <div key={i} className="step-row">
              <div className="step-num">{i + 1}</div>
              {editingStep === i ? (
                <input
                  className="tinput flex-1"
                  value={editStepTxt}
                  autoFocus
                  onChange={e => setEditStepTxt(e.target.value)}
                  onBlur={commitEditStep}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitEditStep()
                    if (e.key === 'Escape') setEditingStep(null)
                  }}
                />
              ) : (
                <span
                  className="flex-1 text-base text-default lh-16"
                  title="Click to edit"
                  style={{ cursor: 'text' }}
                  onClick={() => startEditStep(i)}
                >
                  {s}
                </span>
              )}
              <button onClick={() => moveStep(i, -1)} disabled={i === 0} title="Move up" className="icon-btn">↑</button>
              <button onClick={() => moveStep(i, 1)} disabled={i === steps.length - 1} title="Move down" className="icon-btn">↓</button>
              <button onClick={() => { setEditingStep(null); setSteps(prev => prev.filter((_, j) => j !== i)) }} className="icon-delete">×</button>
            </div>
          ))}
          <div className="flex gap-6">
            <input className="tinput flex-1" value={stepTxt} onChange={e => setStepTxt(e.target.value)} placeholder="Add a step..."
              onKeyDown={e => e.key === 'Enter' && addStep()} />
            <button onClick={addStep} className="icon-add-btn">+</button>
          </div>
        </FieldRow>

        {/* Tip */}
        <FieldRow label="Tip / notes (optional)">
          <textarea className="tinput resize-vertical" rows={2} value={tip} onChange={e => setTip(e.target.value)} placeholder="Any notes, variations, or tips..." />
        </FieldRow>

        {/* Link */}
        <FieldRow label="Reference link (optional) — shown when recipe is opened">
          <input className="tinput" value={link} onChange={e => setLink(e.target.value)} placeholder="https://..." />
        </FieldRow>

        {/* Image */}
        <FieldRow label="Image URL (optional) — shown when recipe is opened">
          <input className="tinput" value={image} onChange={e => setImage(e.target.value)} placeholder="https://... (direct image link)" />
          {image.trim() && (
            <img
              src={image.trim()} alt="preview"
              className="recipe-preview-img"
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              onLoad={e => { (e.target as HTMLImageElement).style.display = 'block' }}
            />
          )}
        </FieldRow>

        <div className="flex gap-8 mt-4">
          <button onClick={save} className="tbtn flex-1" style={{ background: 'var(--purple)', color: '#fff' }}>
            {isEdit ? 'Save changes' : 'Save recipe'}
          </button>
          <button onClick={onClose} className="cancel-btn">Cancel</button>
        </div>
        {msg && <div className={`mt-10 text-base text-center ${msgOk ? 'text-green' : 'text-coral'}`}>{msg}</div>}
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="field-row">
      <div className="field-label">{label}</div>
      {children}
    </div>
  )
}
