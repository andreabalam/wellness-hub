import { useState, useCallback, useRef, useEffect } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Reminder } from '../../data/reminders'
import { useRemindersStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'

interface Props {
  user?: User | null
}

function newReminder(text: string): Reminder {
  return {
    id:        crypto.randomUUID(),
    text,
    checked:   false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
  }
}

async function tryUpsert(user: User | null | undefined, r: Reminder) {
  if (!supabase || !user) return
  try { await sync.upsertReminder(user.id, r) } catch { /* offline */ }
}

async function tryDelete(user: User | null | undefined, id: string) {
  if (!supabase || !user) return
  try { await sync.deleteReminder(id) } catch { /* offline */ }
}

export default function RemindersSection({ user }: Props) {
  const store = useRemindersStore()
  const [items, setItems]       = useState<Reminder[]>(() => store.getAll())
  const [inputText, setInput]   = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')

  const commit = useCallback((next: Reminder[]) => {
    store.save(next)
    setItems(next)
  }, [store])

  const handleAdd = useCallback(() => {
    const text = inputText.trim()
    if (!text) return
    const r = newReminder(text)
    commit([...items, r])
    setInput('')
    tryUpsert(user, r)
  }, [inputText, items, commit, user])

  const handleToggle = useCallback((id: string) => {
    const now = new Date().toISOString()
    const next = items.map(r => {
      if (r.id !== id) return r
      const updated: Reminder = r.checked
        ? { ...r, checked: false, checkedAt: null }
        : { ...r, checked: true,  checkedAt: now  }
      tryUpsert(user, updated)
      return updated
    })
    commit(next)
  }, [items, commit, user])

  const handleStartEdit = useCallback((id: string, text: string) => {
    setEditingId(id)
    setEditText(text)
  }, [])

  const handleSaveEdit = useCallback((id: string) => {
    const text = editText.trim()
    if (!text) return
    const next = items.map(r => r.id === id ? { ...r, text } : r)
    commit(next)
    const updated = next.find(r => r.id === id)
    if (updated) tryUpsert(user, updated)
    setEditingId(null)
    setEditText('')
  }, [editText, items, commit, user])

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
    setEditText('')
  }, [])

  const handleDelete = useCallback((id: string) => {
    if (editingId === id) setEditingId(null)
    commit(items.filter(r => r.id !== id))
    tryDelete(user, id)
  }, [items, commit, user, editingId])

  // Sort: unchecked (oldest first) then checked (most recently checked first)
  const unchecked = items
    .filter(r => !r.checked)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const checked = items
    .filter(r => r.checked)
    .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))

  const renderRow = (r: Reminder) =>
    editingId === r.id ? (
      <EditRow
        key={r.id}
        text={editText}
        onChange={setEditText}
        onSave={() => handleSaveEdit(r.id)}
        onCancel={handleCancelEdit}
      />
    ) : (
      <ReminderRow
        key={r.id}
        reminder={r}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onEdit={handleStartEdit}
      />
    )

  return (
    <div className="tcard" style={{ marginBottom: 16 }}>
      <div className="tlabel" style={{ color: 'var(--muted2)', marginBottom: 10 }}>Reminders</div>

      {unchecked.map(renderRow)}

      {unchecked.length > 0 && checked.length > 0 && (
        <div style={{ borderTop: '1px dashed var(--border2)', margin: '8px 0' }} />
      )}

      {checked.map(renderRow)}

      {items.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--muted2)', fontStyle: 'italic', marginBottom: 10 }}>
          No reminders yet — add one below.
        </div>
      )}

      {/* Add input */}
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <input
          className="tinput"
          value={inputText}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New reminder…"
          style={{ flex: 1, padding: '7px 10px', fontSize: 13 }}
        />
        <button
          onClick={handleAdd}
          disabled={!inputText.trim()}
          style={{
            background: inputText.trim() ? 'var(--teal)' : 'var(--bg3)',
            border: '1px solid var(--border2)',
            color: inputText.trim() ? '#fff' : 'var(--muted)',
            borderRadius: 8, padding: '7px 14px', fontSize: 13,
            cursor: inputText.trim() ? 'pointer' : 'default',
            transition: 'all .15s', flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// ── Inline edit row ──────────────────────────────────────────────
function EditRow({ text, onChange, onSave, onCancel }: {
  text: string
  onChange: (v: string) => void
  onSave: () => void
  onCancel: () => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <input
        ref={ref}
        value={text}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSave()
          if (e.key === 'Escape') onCancel()
        }}
        style={{
          flex: 1, background: 'var(--bg3)', border: '1px solid var(--teal)',
          borderRadius: 6, padding: '4px 8px', color: 'var(--text)',
          fontSize: 13, fontFamily: '"DM Sans", sans-serif', outline: 'none',
        }}
      />
      <button
        onClick={onSave}
        disabled={!text.trim()}
        aria-label="Save edit"
        style={{
          background: 'var(--teal)', border: 'none', borderRadius: 6,
          color: '#fff', fontSize: 11, padding: '4px 10px',
          cursor: text.trim() ? 'pointer' : 'default',
          opacity: text.trim() ? 1 : 0.5,
        }}
      >
        Save
      </button>
      <button
        onClick={onCancel}
        aria-label="Cancel edit"
        style={{
          background: 'none', border: 'none', color: 'var(--muted2)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
        }}
      >
        ×
      </button>
    </div>
  )
}

// ── Single row ───────────────────────────────────────────────────
function ReminderRow({ reminder: r, onToggle, onDelete, onEdit }: {
  reminder: Reminder
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit:   (id: string, text: string) => void
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* Checkbox */}
      <button
        onClick={() => onToggle(r.id)}
        aria-label={r.checked ? 'Uncheck reminder' : 'Check reminder'}
        style={{
          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
          border: `2px solid ${r.checked ? 'var(--teal)' : 'var(--border2)'}`,
          background: r.checked ? 'var(--teal)' : 'transparent',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, color: '#fff', transition: 'all .15s',
        }}
      >
        {r.checked ? '✓' : ''}
      </button>

      {/* Text */}
      <span
        onClick={() => onToggle(r.id)}
        style={{
          flex: 1, fontSize: 13, cursor: 'pointer',
          color: r.checked ? 'var(--muted2)' : 'var(--text)',
          textDecoration: r.checked ? 'line-through' : 'none',
          userSelect: 'none',
        }}
      >
        {r.text}
      </span>

      {/* Edit */}
      {!r.checked && (
        <button
          onClick={() => onEdit(r.id, r.text)}
          aria-label="Edit reminder"
          style={{
            background: 'none', border: 'none', color: 'var(--muted2)',
            cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: '0 2px',
            opacity: 0.6, transition: 'opacity .15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
        >
          ✎
        </button>
      )}

      {/* Delete */}
      <button
        onClick={() => onDelete(r.id)}
        aria-label="Delete reminder"
        style={{
          background: 'none', border: 'none', color: 'var(--muted2)',
          cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: '0 2px',
          opacity: 0.6, transition: 'opacity .15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
        onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
      >
        ×
      </button>
    </div>
  )
}
