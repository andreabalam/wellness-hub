import { useState } from 'react'
import { PRESET_CATS } from '../../data/recipes'
import type { Recipe } from '../../data/recipes'

interface Props {
  customTags: string[]
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

export default function RecipeModal({ customTags, initialRecipe, onSave, onAddTag, onClose }: Props) {
  const isEdit = Boolean(initialRecipe)

  // Lazy initialisers: pre-fill from initialRecipe when editing
  const [name, setName]           = useState(() => initialRecipe?.name ?? '')
  const [tagLine, setTagLine]     = useState(() => initialRecipe?.tag ?? '')
  const [cat, setCat]             = useState(() => initialRecipe?.cat ?? 'dinner')
  const [newTag, setNewTag]       = useState('')
  const [prepTime, setPrepTime]   = useState(() => initialRecipe?.prepTime ?? initialRecipe?.prepL ?? '')
  const [healthTag, setHealthTag] = useState<'healthy' | 'indulgent' | ''>(() => initialRecipe?.healthTag ?? '')
  const [link, setLink]           = useState(() => initialRecipe?.link ?? '')
  const [image, setImage]         = useState(() => initialRecipe?.image ?? '')
  // Single macro set: read from hk/hp/hc/hf/hfi (the "per serving" set)
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
  const [tip, setTip]             = useState(() => initialRecipe?.tip ?? '')
  const [msg, setMsg]             = useState('')
  const [msgOk, setMsgOk]         = useState(true)

  const allTags = [...new Set([...PRESET_CATS, ...customTags])]

  const addTag = () => {
    const val = newTag.trim().toLowerCase()
    if (!val) return
    onAddTag(val)
    setCat(val)
    setNewTag('')
  }

  const addIng = () => {
    if (!ingName.trim()) return
    setIngs(prev => [...prev, [ingName.trim(), ingAmt.trim() || '—']])
    setIngName(''); setIngAmt('')
  }

  const addStep = () => {
    if (!stepTxt.trim()) return
    setSteps(prev => [...prev, stepTxt.trim()])
    setStepTxt('')
  }

  const save = () => {
    if (!name.trim()) { setMsg('Please enter a recipe name.'); setMsgOk(false); return }

    const hkVal = parseInt(kcal) || 0
    const recipe: Recipe = {
      // Preserve id when editing; generate a new one when creating
      id: initialRecipe?.id ?? Date.now(),
      // Carry forward fork/source metadata
      defaultId: initialRecipe?.defaultId,
      source: initialRecipe?.source ?? 'user',
      custom: true,
      cat,
      type: cat.charAt(0).toUpperCase() + cat.slice(1),
      color: initialRecipe?.color ?? 'var(--purple)',
      sc:    initialRecipe?.sc    ?? 'cp',
      name: name.trim(),
      tag: tagLine.trim() || 'My recipe',
      prepL: prepTime || 'Custom',
      prepC: 'var(--purple)',
      prepTime: prepTime || undefined,
      healthTag: (healthTag as 'healthy' | 'indulgent') || undefined,
      link: link.trim() || undefined,
      image: image.trim() || undefined,
      // Single macro set — both sizes share the same values
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

        {/* Name */}
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

        {/* Macros — single set per serving */}
        <FieldRow label="Macros per serving (optional)">
          <div className="macro-grid-5">
            {([['kcal', kcal, setKcal], ['prot g', prot, setProt], ['carb g', carb, setCarb], ['fat g', fat, setFat], ['fiber g', fib, setFib]] as [string, string, (v: string) => void][]).map(([ph, val, set]) => (
              <input key={ph} className="tnum" type="number" min="0" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
            ))}
          </div>
        </FieldRow>

        {/* Ingredients */}
        <FieldRow label="Ingredients">
          {ings.map(([n, a], i) => (
            <div key={i} className="ing-row">
              <span className="flex-1 text-base text-default">{n}</span>
              <span className="text-sm text-muted font-mono">{a}</span>
              <button onClick={() => setIngs(prev => prev.filter((_, j) => j !== i))} className="icon-delete">×</button>
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
              <span className="flex-1 text-base text-default lh-16">{s}</span>
              <button onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))} className="icon-delete">×</button>
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
