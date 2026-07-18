import { useState, useEffect, type Dispatch, type SetStateAction } from 'react'
import type { CustomBlock } from '../../data/schedule'
import { BLOCK_COLORS, sortByTime, normalizeTime } from '../../data/schedule'

type Scope = 'day' | 'all'

interface Props {
  blocks: CustomBlock[]
  onChange: (blocks: CustomBlock[]) => void
  onSaveAll?: (blocks: CustomBlock[]) => void
  onClose: () => void
  onReset: () => void
  onResetAll?: () => void
}

const EMPTY_FORM: Omit<CustomBlock, 'id'> = {
  time: '09:00',
  title: '',
  dur: '30 min',
  color: 'green',
  whyTxt: '',
  desc: '',
  phase: '',
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
  const clamped = isNaN(n) ? 30 : unit === 'hr' ? Math.min(n, 24) : n
  return { num: clamped, unit }
}

function BlockForm({ form, setForm, onSave, onCancel }: BlockFormProps) {
  const init = parseDurForm(form.dur)
  const [durNum, setDurNum] = useState(init.num)
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
    <div className="blk-inline-form">
      <label className="blk-form-label w-full mb-8">
        Time
        <input
          type="time"
          value={form.time}
          onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
          className="blk-form-input"
        />
      </label>
      <label className="blk-form-label w-full mb-8">
        Duration
        <div className="flex gap-6">
          <input
            type="number"
            min={0}
            max={durUnit === 'hr' ? 24 : undefined}
            value={durNum}
            onChange={e => applyNum(e.target.value)}
            className="blk-form-input form-num-sm"
          />
          <select
            value={durUnit}
            onChange={e => applyUnit(e.target.value as 'min' | 'hr')}
            className="blk-form-input flex-1"
          >
            <option value="min">minutes</option>
            <option value="hr">hours</option>
          </select>
        </div>
      </label>

      <label className="blk-form-label w-full">
        Title *
        <input
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Block name"
          className="blk-form-input"
        />
      </label>

      <div className="blk-form-row my-8">
        <label className="blk-form-label flex-1">
          Section header
          <input
            value={form.phase}
            onChange={e => setForm(f => ({ ...f, phase: e.target.value }))}
            placeholder="e.g. Morning routine"
            className="blk-form-input"
          />
        </label>
        <label className="blk-form-label flex-1">
          Badge label
          <input
            value={form.whyTxt}
            onChange={e => setForm(f => ({ ...f, whyTxt: e.target.value }))}
            placeholder="e.g. focus, nutrition"
            className="blk-form-input"
          />
        </label>
      </div>

      {/* Color picker */}
      <div className="mb-8">
        <div className="text-xs text-muted mb-6">Color</div>
        <div className="flex gap-8">
          {BLOCK_COLORS.map(c => (
            <button
              key={c.key}
              onClick={() => setForm(f => ({ ...f, color: c.key }))}
              title={c.label}
              className={`color-swatch ${form.color === c.key ? 'active' : ''}`}
              style={{
                background: c.hex,
                ...(form.color === c.key
                  ? { outline: `2px solid ${c.hex}`, outlineOffset: 2 }
                  : {}),
              }}
            />
          ))}
        </div>
      </div>

      <label className="blk-form-label w-full">
        Description
        <textarea
          value={form.desc}
          onChange={e => setForm(f => ({ ...f, desc: e.target.value }))}
          placeholder="Why this block matters…"
          rows={3}
          className="blk-form-input resize-vertical"
        />
      </label>

      <div className="blk-form-actions">
        <button
          onClick={onSave}
          disabled={!canSave}
          className="action-btn"
          style={{ background: 'var(--teal)', color: '#fff' }}
        >
          Save block
        </button>
        <button
          onClick={onCancel}
          className="action-btn"
          style={{ background: 'var(--bg3)', color: 'var(--muted)' }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

export default function ScheduleEditor({
  blocks,
  onChange,
  onSaveAll = () => {},
  onClose,
  onReset,
  onResetAll = () => {},
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingNew, setAddingNew] = useState(false)
  const [form, setForm] = useState<Omit<CustomBlock, 'id'>>(EMPTY_FORM)
  const [scope, setScope] = useState<Scope>('day')

  // Close on Escape (matches the click-outside affordance)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // ── helpers ──────────────────────────────────────────────────────

  const save = (updated: CustomBlock[], autoSort = true) => {
    const result = autoSort ? sortByTime(updated) : updated
    if (scope === 'all') onSaveAll(result)
    else onChange(result)
  }

  const startEdit = (b: CustomBlock) => {
    setAddingNew(false)
    setEditingId(b.id)
    setForm({
      time: normalizeTime(b.time),
      title: b.title,
      dur: b.dur,
      color: b.color,
      whyTxt: b.whyTxt,
      desc: b.desc,
      phase: b.phase,
    })
  }

  const startAdd = () => {
    setEditingId(null)
    setAddingNew(true)
    setForm(EMPTY_FORM)
  }

  const cancelForm = () => {
    setEditingId(null)
    setAddingNew(false)
  }

  const commitEdit = () => {
    if (!form.title.trim()) return
    const updated = blocks.map(b => (b.id === editingId ? { ...b, ...form } : b))
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
    save(next, false) // manual reorder — don't auto-sort
  }

  const resetToDefault = () => {
    if (scope === 'all') onResetAll()
    else onReset()
    onClose()
  }

  // ── render ───────────────────────────────────────────────────────

  return (
    <div
      className="modal-overlay"
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-panel modal-panel--lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-editor-title"
      >
        {/* Header */}
        <div className="modal-header modal-header--center">
          <div className="modal-title" id="schedule-editor-title">
            Edit <em className="italic text-teal">Schedule</em>
          </div>
          <button onClick={onClose} className="modal-close">
            ×
          </button>
        </div>

        {/* Scope toggle */}
        <div className="scope-toggle">
          {(['day', 'all'] as const).map(s => (
            <button
              key={s}
              onClick={() => setScope(s)}
              style={{
                flex: 1,
                padding: '6px 0',
                fontSize: 12,
                borderRadius: 6,
                border: 'none',
                background: scope === s ? 'var(--teal)' : 'transparent',
                color: scope === s ? '#fff' : 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'sans-serif',
                fontWeight: scope === s ? 500 : 400,
                transition: 'all .15s',
              }}
            >
              {s === 'day' ? 'This day only' : 'All 7 days'}
            </button>
          ))}
        </div>
        <div className="text-xs text-muted mb-16 lh-15">
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
                <div
                  className="font-mono text-muted2 uppercase text-2xs"
                  style={{ letterSpacing: '.1em', margin: '10px 0 4px', paddingLeft: 4 }}
                >
                  {b.phase}
                </div>
              )}

              {/* Block row */}
              <div
                className="block-list-item"
                style={{
                  background: isEditing ? 'var(--bg)' : 'var(--bg3)',
                  border: `1px solid ${isEditing ? 'var(--teal)' : 'var(--border)'}`,
                }}
              >
                <div className="block-list-dot" style={{ background: c.hex }} />
                <div className="block-list-info">
                  <span className="block-list-title">{b.title}</span>
                  <span className="block-list-meta">{b.time}</span>
                  {b.dur && (
                    <span className="text-muted2" style={{ fontSize: 11, marginLeft: 6 }}>
                      {b.dur}
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div className="block-list-actions">
                  <IconBtn title="Move up" onClick={() => move(i, -1)} disabled={i === 0}>
                    ↑
                  </IconBtn>
                  <IconBtn
                    title="Move down"
                    onClick={() => move(i, 1)}
                    disabled={i === blocks.length - 1}
                  >
                    ↓
                  </IconBtn>
                  <IconBtn title="Edit" onClick={() => (isEditing ? cancelForm() : startEdit(b))}>
                    ✎
                  </IconBtn>
                  <IconBtn title="Delete" onClick={() => del(b.id)} danger>
                    ✕
                  </IconBtn>
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && (
                <BlockForm
                  key={b.id}
                  form={form}
                  setForm={setForm}
                  onSave={commitEdit}
                  onCancel={cancelForm}
                />
              )}
            </div>
          )
        })}

        {/* Add new block form */}
        {addingNew && (
          <div className="mt-8">
            <BlockForm
              key="new"
              form={form}
              setForm={setForm}
              onSave={commitAdd}
              onCancel={cancelForm}
            />
          </div>
        )}

        {/* Add block button */}
        {!addingNew && (
          <button onClick={startAdd} className="add-block-btn">
            + Add block
          </button>
        )}

        {/* Footer */}
        <div className="editor-footer">
          <button onClick={resetToDefault} className="editor-reset-btn">
            Reset to default
          </button>
          <button
            onClick={onClose}
            className="action-btn"
            style={{ background: 'var(--teal)', color: '#fff' }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  title,
}: {
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
      className={`icon-btn${danger ? ' icon-btn--danger' : ''}`}
    >
      {children}
    </button>
  )
}
