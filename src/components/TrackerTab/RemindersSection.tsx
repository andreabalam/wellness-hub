import { useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import type { Reminder } from '../../data/reminders'
import { useRemindersStore } from '../../hooks/useStore'
import { supabase } from '../../lib/supabase'
import * as sync from '../../lib/sync'
import { InlineEdit } from '../common'

interface Props {
  user?: User | null
}

function newReminder(text: string): Reminder {
  return {
    id: crypto.randomUUID(),
    text,
    checked: false,
    checkedAt: null,
    createdAt: new Date().toISOString(),
  }
}

async function tryUpsert(user: User | null | undefined, r: Reminder) {
  if (!supabase || !user) return
  try {
    await sync.upsertReminder(user.id, r)
  } catch {
    /* offline */
  }
}

async function tryDelete(user: User | null | undefined, id: string) {
  if (!supabase || !user) return
  try {
    await sync.deleteReminder(id)
  } catch {
    /* offline */
  }
}

export default function RemindersSection({ user }: Props) {
  const store = useRemindersStore()
  const [items, setItems] = useState<Reminder[]>(() => store.getAll())
  const [inputText, setInput] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)

  const commit = useCallback(
    (next: Reminder[]) => {
      store.save(next)
      setItems(next)
    },
    [store],
  )

  const handleAdd = useCallback(() => {
    const text = inputText.trim()
    if (!text) return
    const r = newReminder(text)
    commit([...items, r])
    setInput('')
    tryUpsert(user, r)
  }, [inputText, items, commit, user])

  const handleToggle = useCallback(
    (id: string) => {
      const now = new Date().toISOString()
      const next = items.map(r => {
        if (r.id !== id) return r
        const updated: Reminder = r.checked
          ? { ...r, checked: false, checkedAt: null }
          : { ...r, checked: true, checkedAt: now }
        tryUpsert(user, updated)
        return updated
      })
      commit(next)
    },
    [items, commit, user],
  )

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id)
  }, [])

  const handleSaveEdit = useCallback(
    (id: string, text: string) => {
      const next = items.map(r => (r.id === id ? { ...r, text } : r))
      commit(next)
      const updated = next.find(r => r.id === id)
      if (updated) tryUpsert(user, updated)
      setEditingId(null)
    },
    [items, commit, user],
  )

  const handleCancelEdit = useCallback(() => {
    setEditingId(null)
  }, [])

  const handleDelete = useCallback(
    (id: string) => {
      if (editingId === id) setEditingId(null)
      commit(items.filter(r => r.id !== id))
      tryDelete(user, id)
    },
    [items, commit, user, editingId],
  )

  const unchecked = items
    .filter(r => !r.checked)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const checked = items
    .filter(r => r.checked)
    .sort((a, b) => (b.checkedAt ?? '').localeCompare(a.checkedAt ?? ''))

  const renderRow = (r: Reminder) =>
    editingId === r.id ? (
      <InlineEdit
        key={r.id}
        initialValue={r.text}
        onSave={text => handleSaveEdit(r.id, text)}
        onCancel={handleCancelEdit}
        className="rem-edit-row"
        inputClassName="rem-edit-input"
        saveClassName="rem-save-btn"
        saveLabel="Save"
        cancelClassName="rem-icon-btn"
        cancelLabel="×"
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
    <details className="tcard mb-16 rem-details">
      <summary className="rem-summary">
        <span className="tlabel text-muted2">Reminders</span>
        {unchecked.length > 0 && <span className="rem-count">{unchecked.length}</span>}
      </summary>

      {unchecked.map(renderRow)}

      {unchecked.length > 0 && checked.length > 0 && <div className="divider-dashed" />}

      {checked.map(renderRow)}

      {items.length === 0 && (
        <div className="text-sm text-muted2 italic mb-10">No reminders yet — add one below.</div>
      )}

      <div className="rem-add-row">
        <input
          className="tinput flex-1"
          value={inputText}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAdd()}
          placeholder="New reminder…"
        />
        <button className="rem-add-btn" onClick={handleAdd} disabled={!inputText.trim()}>
          Add
        </button>
      </div>
    </details>
  )
}

// ── Single row ───────────────────────────────────────────────────
function ReminderRow({
  reminder: r,
  onToggle,
  onDelete,
  onEdit,
}: {
  reminder: Reminder
  onToggle: (id: string) => void
  onDelete: (id: string) => void
  onEdit: (id: string) => void
}) {
  return (
    <div className="rem-row">
      <button
        className={`rem-check${r.checked ? ' checked' : ''}`}
        onClick={() => onToggle(r.id)}
        aria-label={r.checked ? 'Uncheck reminder' : 'Check reminder'}
      >
        {r.checked ? '✓' : ''}
      </button>

      <span className={`rem-text${r.checked ? ' checked' : ''}`} onClick={() => onToggle(r.id)}>
        {r.text}
      </span>

      {!r.checked && (
        <button
          className="rem-icon-btn"
          onClick={() => onEdit(r.id)}
          aria-label="Edit reminder"
          style={{ fontSize: 13 }}
        >
          ✎
        </button>
      )}

      <button
        className="rem-icon-btn"
        onClick={() => onDelete(r.id)}
        aria-label="Delete reminder"
        style={{ fontSize: 16 }}
      >
        ×
      </button>
    </div>
  )
}
