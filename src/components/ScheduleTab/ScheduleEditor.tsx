import { useState, type Dispatch, type SetStateAction } from 'react'
import type { CustomBlock } from '../../data/schedule'
import { BLOCK_COLORS, SCHEDULE_BLOCKS, defaultToCustomBlock } from '../../data/schedule'
import { scheduleStore } from '../../hooks/useStore'

interface Props {
  blocks: CustomBlock[]
  onChange: (blocks: CustomBlock[]) => void
  onClose: () => void
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

function BlockForm({ form, setForm, onSave, onCancel }: BlockFormProps) {
  return (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--teal)', borderRadius: 10, padding: 14, marginTop: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
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
          <input
            value={form.dur}
            onChange={e => setForm(f => ({ ...f, dur: e.target.value }))}
            placeholder="e.g. 30 min, 1 hr"
            style={inputStyle}
          />
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '8px 0' }}>
        <label style={labelStyle}>
          Section header <span style={{ color: 'var(--muted2)' }}>(optional)</span>
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

      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={onSave} disabled={!form.title.trim()} style={{ ...actionBtn, background: 'var(--teal)', color: '#fff', opacity: form.title.trim() ? 1 : 0.5 }}>
          Save block
        </button>
        <button onClick={onCancel} style={{ ...actionBtn, background: 'var(--bg3)', color: 'var(--muted)' }}>
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ScheduleEditor({ blocks, onChange, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [form, setForm]           = useState<Omit<CustomBlock, 'id'>>(EMPTY_FORM)

  // ── helpers ──────────────────────────────────────────────────────

  const save = (updated: CustomBlock[]) => {
    scheduleStore.saveBlocks(updated)
    onChange(updated)
  }

  const startEdit = (b: CustomBlock) => {
    setAddingNew(false)
    setEditingId(b.id)
    setForm({ time: b.time, title: b.title, dur: b.dur, color: b.color, whyTxt: b.whyTxt, desc: b.desc, phase: b.phase })
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
    if (!window.confirm('Delete this block?')) return
    save(blocks.filter(b => b.id !== id))
    if (editingId === id) setEditingId(null)
  }

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...blocks]
    const swap = idx + dir
    if (swap < 0 || swap >= next.length) return
    ;[next[idx], next[swap]] = [next[swap], next[idx]]
    save(next)
  }

  const resetToDefault = () => {
    if (!window.confirm('Reset to the built-in schedule? All your changes will be removed.')) return
    scheduleStore.reset()
    onChange(SCHEDULE_BLOCKS.map(defaultToCustomBlock))
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

        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.5 }}>
          Reorder, edit, or delete blocks. Changes apply to every weekday.
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
              {isEditing && <BlockForm form={form} setForm={setForm} onSave={commitEdit} onCancel={cancelForm} />}
            </div>
          )
        })}

        {/* Add new block form */}
        {addingNew && (
          <div style={{ marginTop: 8 }}>
            <BlockForm form={form} setForm={setForm} onSave={commitAdd} onCancel={cancelForm} />
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
