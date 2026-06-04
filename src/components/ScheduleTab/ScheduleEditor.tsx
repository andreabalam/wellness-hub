import { useState, type Dispatch, type SetStateAction } from 'react'
import type { CustomBlock } from '../../data/schedule'
import { BLOCK_COLORS, sortByTime, normalizeTime } from '../../data/schedule'

type Scope = 'day' | 'all'

interface Props {
  blocks: CustomBlock[]
  onChange:   (blocks: CustomBlock[]) => void
  onSaveAll?:  (blocks: CustomBlock[]) => void
  onClose: () => void
  onReset: () => void
  onResetAll?: () => void
}

const EMPTY_FORM: Omit<CustomBlock, 'id'> = {
  time: '09:00', title: '', dur: '30 min', color: 'green',
  whyTxt: '', desc: '', phase: '',
}

// ── BlockForm — defined at module level to avoid re-creation on every render ─
interface BlockFormProps {
  form: Omit<CustomBlock, 'id'>
  setForm: Dispatch<SetStateAction<Omit<CustomBlock, 'id'>>>
  onSave: () => void
  onCancel: () => void
}

function parseDurForm(dur: string): { num: number; unit: 'min' | 'hr' } {
  if (!dur || dur === '—') return { num: 30, unit: 'min' }
  const hasHr = /hr|hour/i.test(dur)
  const n = parseInt(dur.match(/\d+/)?.[0] ?? '30', 10)
  const unit: 'min' | 'hr' = hasHr ? 'hr' : 'min'
  const clamped = isNaN(n) ? 30 : (unit === 'hr' ? Math.min(n, 24) : n)
  return { num: clamped, unit }
}

function BlockForm({ form, setForm, onSave, onCancel }: BlockFormProps) {
  const init = parseDurForm(form.dur)
  const [durNum,  setDurNum]  = useState(init.num)
  const [durUnit, setDurUnit] = useState<'min' | 'hr'>(init.unit)

  const applyNum = (raw: string) => {
    const parsed = parseInt(raw)
    const n = isNaN(parsed) ? 0 : Math.max(0, durUnit === 'hr' ? Math.min(parsed, 24) : parsed)
    setDurNum(n)
    setForm(f => ({ ...f, dur: `${n} ${durUnit}` }))
  }

  const applyUnit = (unit: 'min' | 'hr') => {
    const n = unit === 'hr' ? Math.min(durNum, 24) : durNum
    setDurUnit(unit)
    setDurNum(n)
    setForm(f => ({ ...f, dur: `${n} ${unit}` }))
  }

  const canSave = form.title.trim() !== '' && durNum > 0

  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--teal)', borderRadius: 10, padding: 14, marginTop: 6 }}>
      <div className="blk-form-row">
        <label style={labelStyle}>
          Time
          <input
            type="time"
            value={form.time}
            onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Duration
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="number"
              min={0}
              max={durUnit === 'hr' ? 24 : undefined}
              value={durNum}
              onChange={e => applyNum(e.target.value)}
              style={{ ...inputStyle, width: 64, flex: 'none' }}
            />
            <select
              value={durUnit}
              onChange={e => applyUnit(e.target.value as 'min' | 'hr')}
              style={{ ...inputStyle, flex: 1 }}
            >
              <option value="min">minutes</option>
              <option value="hr">hours</option>
            </select>
          </div>
        </label>
      </div>

      <label style={labelStyle}>
        Title *
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Block name"
          style={inputStyle}
        />
      </label>

      <div className="blk-form-row" style={{ margin: '8px 0' }}>
        <label style={labelStyle}>
          Section header
          <input
            value={form.phase}
            onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
            placeholder="e.g. Morning routine"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Badge label
          <input
            value={form.whyTxt}
            onChange={e => setForm(f => ({ ...f, whyTxt: e.target.value }))}
            placeholder="e.g. focus, nutrition"
            style={inputStyle}
          />
        </label>
      </div>

      {/* Color picker */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>Color</div>
        <div style={{ display: 'flex', gap: 7 }}>
          {BLOCK_COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => setForm(f => ({ ...f, color: c.key }))}
              title={c.label}
              style={{
                width: 24, height: 24, borderRadius: '50%',
                background: c.hex, border: 'none', cursor: 'pointer',
                outline: form.color === c.key ? `2px solid ${c.hex}` : 'none',
                outlineOffset: 2,
                transform: form.color === c.key ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform .15s',
              }}
            />
          ))}
        </div>
      </div>

      <label style={labelStyle}>
        Description
        <textarea
          value={form.desc}
          onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
          placeholder="Why this block matters…"
          rows={3}
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>

      <div className="blk-form-actions">
        <button onClick={onSave} disabled={!canSave} style={{ ...actionBtn, background: 'var(--teal)', color: '#fff', opacity: canSave ? 1 : 0.5 }}>
          Save block
        </button>
        <button onClick={onCancel} style={{ ...actionBtn, background: 'var(--bg3)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ScheduleEditor({ blocks, onChange, onSaveAll = () => {}, onClose, onReset, onResetAll = () => {} }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [form, setForm]           = useState<Omit<CustomBlock, 'id'>>(EMPTY_FORM)
  const [scope, setScope]         = useState<Scope>('day')

  // ── helpers ──────────────────────────────────────────────────────

  const save = (updated: CustomBlock[], autoSort = true) => {
    const result = autoSort ? sortByTime(updated) : updated
    if (scope === 'all') onSaveAll(result)
    else onChange(result)
  }

  const startEdit = (b: CustomBlock) => {
    setAddingNew(false)
    setEditingId(b.id)
    setForm({ time: normalizeTime(b.time), title: b.title, dur: b.dur, color: b.color, whyTxt: b.whyTxt, desc: b.desc, phase: b.phase })
  }

  const startAdd = () => {
    setEditingId(null)
    setAddingNew(true)
    setForm(EMPTY_FORM)
  }

  const cancelForm = () => { setEditingId(null); setAddingNew(false) }

  const commitEdit = () => {
    if (!form.title.trim()) return
    const updated = blocks.map(b => b.id === editingId ? { ...b, ...form } : b)
    save(updated)
    setEditingId(null)
  }

  const commitAdd = () => {
    if (!form.title.trim()) return
    const newBlock: CustomBlock = { id: `custom-${Date.now()}`, ...form }
    save([...blocks, newBlock])
    setAddingNew(false)
    setForm(EMPTY_FORM)
  }

  const del = (id: string) => {
    save(blocks.filter(b => b.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...blocks]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    save(next, false)  // manual reorder — don't auto-sort
  }

  const resetToDefault = () => {
    if (scope === 'all') onResetAll()
    else onReset()
    onClose()
  }

  // ── render ───────────────────────────────────────────────────────

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', overflowY: 'auto', padding: '24px 16px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 16, maxWidth: 620, margin: '0 auto', padding: 26 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)' }}>
            Edit <em style={{ fontStyle: 'italic', color: 'var(--teal-light)' }}>Schedule</em>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: 'var(--muted)', cursor: 'pointer' }}>×</button>
        </div>

        {/* Scope toggle */}
        <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 8, padding: 3, border: '1px solid var(--border)', marginBottom: 14 }}>
          {(['day', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                flex: 1, padding: '6px 0', fontSize: 12, borderRadius: 6, border: 'none',
                background: scope === s ? 'var(--teal)' : 'transparent',
                color: scope === s ? '#fff' : 'var(--muted)',
                cursor: 'pointer', fontFamily: 'sans-serif',
                fontWeight: scope === s ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {s === 'day' ? 'This day only' : 'All 7 days'}
            </button>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          {scope === 'day'
            ? 'Changes apply to this day only.'
            : 'Changes will overwrite the schedule for all 7 days.'}
        </div>

        {/* Block list */}
        {blocks.map((b, i) => {
          const c = BLOCK_COLORS.find(col => col.key === b.color) ?? BLOCK_COLORS[0]
          const isEditing = editingId === b.id
          return (
            <div key={b.id} style={{ marginBottom: 4 }}>
              {/* Phase header */}
              {b.phase && (
                <div style={{ fontSize: 10, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', letterSpacing: '.1em', textTransform: 'uppercase', margin: '10px 0 4px', paddingLeft: 4 }}>
                  {b.phase}
                </div>
              )}

              {/* Block row */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 10px',
                background: isEditing ? 'var(--bg)' : 'var(--bg3)',
                border: `1px solid ${isEditing ? 'var(--teal)' : 'var(--border)'}`,
                borderRadius: 9, transition: 'border-color .15s',
              }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.hex, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{b.title}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 8, fontFamily: '"DM Mono",monospace' }}>{b.time}</span>
                  {b.dur && <span style={{ fontSize: 11, color: 'var(--muted2)', marginLeft: 6 }}>{b.dur}</span>}
                </div>
                {/* Actions */}
                <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                  <IconBtn title="Move up"   onClick={() => move(i, -1)} disabled={i === 0}>↑</IconBtn>
                  <IconBtn title="Move down" onClick={() => move(i, 1)}  disabled={i === blocks.length - 1}>↓</IconBtn>
                  <IconBtn title="Edit"      onClick={() => isEditing ? cancelForm() : startEdit(b)}>✎</IconBtn>
                  <IconBtn title="Delete"    onClick={() => del(b.id)} danger>✕</IconBtn>
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && <BlockForm key={b.id} form={form} setForm={setForm} onSave={commitEdit} onCancel={cancelForm} />}
            </div>
          )
        })}

        {/* Add new block form */}
        {addingNew && (
          <div style={{ marginTop: 8 }}>
            <BlockForm key="new" form={form} setForm={setForm} onSave={commitAdd} onCancel={cancelForm} />
          </div>
        )}

        {/* Add block button */}
        {!addingNew && (
          <button
            onClick={startAdd}
            style={{ width: '100%', marginTop: 12, padding: '10px 0', background: 'var(--bg3)', border: '1px dashed var(--border2)', borderRadius: 9, color: 'var(--muted)', fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            + Add block
          </button>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={resetToDefault}
            style={{ background: 'none', border: 'none', color: 'var(--muted2)', fontSize: 12, cursor: 'pointer', fontFamily: '"DM Mono",monospace', textDecoration: 'underline' }}
          >
            Reset to default
          </button>
          <button onClick={onClose} style={{ ...actionBtn, background: 'var(--teal)', color: '#fff' }}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────

function IconBtn({ children, onClick, disabled, danger, title }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  title?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 6,
        border: '1px solid var(--border)',
        background: 'var(--bg2)',
        color: danger ? 'var(--coral-light)' : 'var(--muted)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.3 : 1,
        fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity .15s',
      }}
    >
      {children}
    </button>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 11, color: 'var(--muted)', marginBottom: 4,
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg2)', border: '1px solid var(--border2)',
  borderRadius: 7, padding: '7px 10px',
  color: 'var(--text)', fontSize: 13,
  fontFamily: '"DM Sans", sans-serif', outline: 'none', width: '100%',
}

const actionBtn: React.CSSProperties = {
  padding: '8px 20px', borderRadius: 8, border: 'none',
  fontSize: 13, cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 500,
}
