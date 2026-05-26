import { useState } from 'react'
import { PRESET_CATS } from '../../data/recipes'
import type { Recipe } from '../../data/recipes'

interface Props {
  customTags: string[]
  onSave: (r: Recipe) => void
  onAddTag: (tag: string) => void
  onClose: () => void
}

export default function RecipeModal({ customTags, onSave, onAddTag, onClose }: Props) {
  const [name, setName]       = useState('')
  const [tagLine, setTagLine] = useState('')
  const [cat, setCat]         = useState('dinner')
  const [newTag, setNewTag]   = useState('')
  const [kcal, setKcal]       = useState('')
  const [prot, setProt]       = useState('')
  const [carb, setCarb]       = useState('')
  const [fat, setFat]         = useState('')
  const [fib, setFib]         = useState('')
  const [ings, setIngs]       = useState<[string, string][]>([])
  const [ingName, setIngName] = useState('')
  const [ingAmt, setIngAmt]   = useState('')
  const [steps, setSteps]     = useState<string[]>([])
  const [stepTxt, setStepTxt] = useState('')
  const [tip, setTip]         = useState('')
  const [msg, setMsg]         = useState('')
  const [msgOk, setMsgOk]     = useState(true)

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
    const recipe: Recipe = {
      id: Date.now(), custom: true, cat,
      type: cat.charAt(0).toUpperCase() + cat.slice(1),
      color: 'var(--purple)', sc: 'cp',
      name: name.trim(),
      tag: tagLine.trim() || 'My recipe',
      prepL: 'Custom', prepC: 'var(--purple)',
      hk: parseInt(kcal) || 0,
      hp: `${parseInt(prot) || 0}g`,
      hc: `${parseInt(carb) || 0}g`,
      hf: `${parseInt(fat) || 0}g`,
      hfi: `${parseInt(fib) || 0}g`,
      mk: 0, mp: '0g', mc: '0g', mf: '0g',
      ings, steps, tip: tip.trim(),
    }
    onSave(recipe)
    setMsg('Recipe saved!')
    setMsgOk(true)
    setTimeout(onClose, 900)
  }

  return (
    <div
      style={{ display: 'block', position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 600, margin: '0 auto', padding: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>
            Add my <em style={{ fontStyle: 'italic', color: 'var(--purple-light)' }}>Recipe</em>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Name */}
        <FieldRow label="Recipe name *">
          <input className="tinput" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Mango Chia Pudding" />
        </FieldRow>

        {/* Tagline */}
        <FieldRow label="Short description">
          <input className="tinput" value={tagLine} onChange={e => setTagLine(e.target.value)} placeholder="e.g. Prep night before · 5 min" />
        </FieldRow>

        {/* Category */}
        <FieldRow label="Category (pick one or create your own)">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setCat(tag)}
                style={{
                  fontSize: 12, padding: '4px 11px', borderRadius: 7,
                  border: `1px solid ${cat === tag ? 'var(--purple)' : 'var(--border)'}`,
                  background: cat === tag ? 'rgba(138,106,184,0.15)' : 'var(--bg3)',
                  color: cat === tag ? 'var(--purple-light)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: 'sans-serif', transition: 'all .15s',
                }}
              >
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input className="tinput" value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="New tag (e.g. Snack, Sauce...)" style={{ flex: 1 }} />
            <button onClick={addTag} style={{ background: 'var(--purple)', border: 'none', borderRadius: 7, padding: '7px 14px', fontSize: 12, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>Add tag</button>
          </div>
        </FieldRow>

        {/* Macros */}
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

        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={save} className="tbtn" style={{ flex: 1, background: 'var(--purple)', color: '#fff' }}>Save recipe</button>
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
