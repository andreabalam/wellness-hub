import { useState } from 'react'
import type { QuickFood } from '../../data/tracker'
import { parseFoodLog, parseFoodLogLocal } from '../../lib/foodImport'

interface Props {
  /** Current food library — used by the offline parse fallback. */
  foodLib: QuickFood[]
  /** Add the reviewed rows to the day (parent filters, persists, updates the library). */
  onAdd: (rows: QuickFood[]) => void
}

/**
 * Paste-to-log: parse a pasted block of meals (AI parser, with an offline
 * fallback) into reviewable/editable rows before logging them.
 */
export default function PasteToLog({ foodLib, onAdd }: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'idle' | 'parsing' | 'error'>('idle')
  const [error, setError] = useState('')
  const [rows, setRows] = useState<QuickFood[] | null>(null)

  const close = () => {
    setOpen(false)
    setText('')
    setRows(null)
    setStatus('idle')
    setError('')
  }

  const runParse = async () => {
    const t = text.trim()
    if (!t) return
    setStatus('parsing')
    setError('')
    try {
      const parsed = await parseFoodLog(t)
      if (!Array.isArray(parsed) || parsed.length === 0)
        throw new Error('No foods found in that text')
      setRows(parsed)
      setStatus('idle')
    } catch (err) {
      // Fall back to the offline parser (explicit macros + food-library matches).
      const local = parseFoodLogLocal(t, foodLib)
      if (local.length) {
        setRows(local)
        setStatus('idle')
      } else {
        setStatus('error')
        setError(err instanceof Error ? err.message : 'Could not read any foods from that text.')
      }
    }
  }

  const updateRow = (i: number, patch: Partial<QuickFood>) => {
    setRows(rs => rs?.map((r, j) => (j === i ? { ...r, ...patch } : r)) ?? rs)
  }

  const removeRow = (i: number) => {
    setRows(rs => rs?.filter((_, j) => j !== i) ?? rs)
  }

  const add = () => {
    onAdd(rows ?? [])
    close()
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="paste-log-toggle"
        data-testid="paste-log-toggle"
      >
        📋 Paste meals to log
      </button>
    )
  }

  return (
    <div className="paste-log-panel">
      {rows === null ? (
        <>
          <textarea
            className="tinput resize-vertical w-full"
            rows={5}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={
              'Paste meals — one per line. e.g.\nGreek yogurt with berries\nChicken salad, 420 cal\nBerry Oats 350 18 42 12 9'
            }
            disabled={status === 'parsing'}
            data-testid="paste-log-input"
          />
          {status === 'error' && (
            <div className="paste-log-error" role="alert">
              {error}
            </div>
          )}
          <div className="flex gap-6 justify-end mt-8">
            <button onClick={close} className="paste-log-cancel">
              Cancel
            </button>
            <button
              onClick={runParse}
              disabled={status === 'parsing' || !text.trim()}
              className="tbtn tbtn--teal"
              style={{ width: 'auto' }}
            >
              {status === 'parsing' ? 'Parsing…' : 'Parse'}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="text-xs text-muted2 mb-6">Review and edit before logging:</div>
          {rows.length === 0 ? (
            <div className="text-2xs text-muted2 italic mb-8">Nothing left to add.</div>
          ) : (
            rows.map((r, i) => (
              <div key={i} className="paste-log-row">
                <input
                  className="tinput flex-1"
                  value={r.n}
                  onChange={e => updateRow(i, { n: e.target.value })}
                  placeholder="Food name"
                />
                <div className="paste-log-macros">
                  {(
                    [
                      ['kcal', 'k'],
                      ['P', 'p'],
                      ['C', 'c'],
                      ['F', 'f'],
                      ['Fi', 'fi'],
                    ] as [string, keyof QuickFood][]
                  ).map(([ph, key]) => (
                    <input
                      key={key}
                      className="tnum"
                      type="number"
                      min="0"
                      placeholder={ph}
                      value={r[key] as number}
                      onChange={e =>
                        updateRow(i, { [key]: Math.max(0, parseInt(e.target.value) || 0) })
                      }
                    />
                  ))}
                </div>
                <button onClick={() => removeRow(i)} className="food-remove-btn" title="Remove">
                  ×
                </button>
              </div>
            ))
          )}
          <div className="flex gap-6 justify-end mt-8">
            <button onClick={close} className="paste-log-cancel">
              Cancel
            </button>
            <button
              onClick={add}
              disabled={!rows.some(r => r.n.trim() && r.k > 0)}
              className="tbtn tbtn--teal"
              style={{ width: 'auto' }}
              data-testid="paste-log-add"
            >
              + Add {rows.filter(r => r.n.trim() && r.k > 0).length} food
              {rows.filter(r => r.n.trim() && r.k > 0).length === 1 ? '' : 's'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
