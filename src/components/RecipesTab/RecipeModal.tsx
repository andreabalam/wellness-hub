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
      style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 600, margin: '0 auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>
            {isEdit
              ? <>Edit my <em style={{ fontStyle: 'italic', color: 'var(--purple-light)' }}>Recipe</em></>
              : <>Add my <em style={{ fontStyle: 'italic', color: 'var(--purple-light)' }}>Recipe</em></>
            }
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }}>×</button>
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
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {allTags.map(tag => (
              <button key={tag} onClick={() => setCat(tag)} style={chipStyle(cat === tag, 'var(--purple)')}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="tinput" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag (e.g. Sauce, Side...)" style={{ flex: 1 }} />
            <button onClick={addTag} style={{ background: 'var(--purple)', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add tag</button>
          </div>
        </FieldRow>

        {/* Prep time */}
        <FieldRow label="Prep time">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {PREP_TIME_PRESETS.map(t => (
              <button key={t} onClick={() => setPrepTime(prepTime === t ? '' : t)} style={chipStyle(prepTime === t, 'var(--teal)')}>
                {t}
              </button>
            ))}
          </div>
          <input
            className="tinput" value={prepTime} onChange={e => setPrepTime(e.target.value)}
            placeholder="Or type custom time, e.g. 25 min"
            style={{ marginTop: 2 }}
          />
        </FieldRow>

        {/* Health tag */}
        <FieldRow label="Health tag">
          <div style={{ display: 'flex', gap: 8 }}>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 6 }}>
            {([['kcal', kcal, setKcal], ['prot g', prot, setProt], ['carb g', carb, setCarb], ['fat g', fat, setFat], ['fiber g', fib, setFib]] as [string, string, (v: string) => void][]).map(([ph, val, set]) => (
              <input key={ph} className="tnum" type="number" min="0" placeholder={ph} value={val} onChange={e => set(e.target.value)} />
            ))}
          </div>
        </FieldRow>

        {/* Ingredients */}
        <FieldRow label="Ingredients">
          {ings.map(([n, a], i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 4 }}>
              <span style={{ flex: 2, fontSize: 13, color: 'var(--text)' }}>{n}</span>
              <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)', fontFamily: 'monospace' }}>{a}</span>
              <button onClick={() => setIngs(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="tinput" value={ingName} onChange={e => setIngName(e.target.value)} placeholder="Ingredient" style={{ flex: 2 }}
              onKeyDown={e => e.key === 'Enter' && addIng()} />
            <input className="tinput" value={ingAmt} onChange={e => setIngAmt(e.target.value)} placeholder="Amount" style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addIng()} />
            <button onClick={addIng} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '7px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>+</button>
          </div>
        </FieldRow>

        {/* Steps */}
        <FieldRow label="Steps">
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 8px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 4 }}>
              <div style={{ width: 18, height: 18, borderRadius: '50%', background: 'var(--purple)', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</div>
              <span style={{ flex: 1, fontSize: 13, color: 'var(--text)', lineHeight: 1.4 }}>{s}</span>
              <button onClick={() => setSteps(prev => prev.filter((_, j) => j !== i))} style={{ background: 'none', border: 'none', color: 'var(--muted2)', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="tinput" value={stepTxt} onChange={e => setStepTxt(e.target.value)} placeholder="Add a step..." style={{ flex: 1 }}
              onKeyDown={e => e.key === 'Enter' && addStep()} />
            <button onClick={addStep} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '7px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer' }}>+</button>
          </div>
        </FieldRow>

        {/* Tip */}
        <FieldRow label="Tip / notes (optional)">
          <textarea className="tinput" rows={2} value={tip} onChange={e => setTip(e.target.value)} placeholder="Any notes, variations, or tips..." style={{ resize: 'vertical' }} />
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
              style={{ marginTop: 8, width: '100%', maxHeight: 160, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border2)' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
              onLoad={e => { (e.target as HTMLImageElement).style.display = 'block' }}
            />
          )}
        </FieldRow>

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={save} className="tbtn" style={{ flex: 1, background: 'var(--purple)', color: '#fff' }}>
            {isEdit ? 'Save changes' : 'Save recipe'}
          </button>
          <button onClick={onClose} style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 8, padding: '10px 18px', fontSize: 13, fontFamily: 'sans-serif', color: 'var(--muted)', cursor: 'pointer' }}>Cancel</button>
        </div>
        {msg && <div style={{ marginTop: 10, fontSize: 13, textAlign: 'center', color: msgOk ? 'var(--green-light)' : 'var(--coral-light)' }}>{msg}</div>}
      </div>
    </div>
  )
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 7 }}>{label}</div>
      {children}
    </div>
  )
}
