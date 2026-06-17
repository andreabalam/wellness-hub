import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { GROCERY_DATA, GROCERY_CATEGORIES } from '../../data/grocery'
import type { GroceryCatalogItem, NutriInfo } from '../../data/grocery'
import { useGroceryStore, useGroceryCatalogStore } from '../../hooks/useStore'
import { searchUSDA } from '../../lib/foodSearch'

const SEEDED_KEY = 'whub_grocery_initialized_v1'

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

type LookupState = 'idle' | 'loading' | 'found' | 'not-found' | 'error'

function buildNutri(
  srv: string,
  cal: string,
  p: string,
  c: string,
  f: string,
  fi: string,
): NutriInfo | undefined {
  const calN = parseFloat(cal)
  const pN = parseFloat(p)
  const cN = parseFloat(c)
  const fN = parseFloat(f)
  if (isNaN(calN) || isNaN(pN) || isNaN(cN) || isNaN(fN)) return undefined
  const fiN = parseFloat(fi)
  return {
    srv: srv.trim() || '100g',
    cal: Math.round(calN),
    p: Math.round(pN * 10) / 10,
    c: Math.round(cN * 10) / 10,
    f: Math.round(fN * 10) / 10,
    fi: !isNaN(fiN) ? Math.round(fiN * 10) / 10 : undefined,
  }
}

// ── Row component ────────────────────────────────────────────────

interface RowProps {
  item: GroceryCatalogItem
  checked: boolean
  onToggle: (name: string) => void
  onEdit: (id: string, newName: string) => void
  onRemove: (id: string) => void
}

function GroceryItemRow({ item, checked, onToggle, onEdit, onRemove }: RowProps) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState(item.n)

  const startEdit = () => {
    setEditVal(item.n)
    setEditing(true)
  }

  const commitEdit = () => {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== item.n) onEdit(item.id, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="gitem gap-6" onClick={e => e.stopPropagation()}>
        <input
          className="tinput gitem-edit-input"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commitEdit()
            }
            if (e.key === 'Escape') {
              setEditing(false)
              setEditVal(item.n)
            }
          }}
          autoFocus
        />
        <button aria-label="Save" onClick={commitEdit} className="edit-confirm-btn">
          ✓
        </button>
        <button
          aria-label="Cancel edit"
          onClick={() => {
            setEditing(false)
            setEditVal(item.n)
          }}
          className="edit-discard-btn"
        >
          ✕
        </button>
      </div>
    )
  }

  return (
    <div className={`gitem${checked ? ' gchecked' : ''}`} onClick={() => onToggle(item.n)}>
      <div className="gcheck">✓</div>
      <span className="flex-1">
        {item.n}
        {item.nutri && (
          <span className="item-nutri">
            {item.nutri.srv} · {item.nutri.cal} kcal · {item.nutri.p}g P · {item.nutri.c}g C ·{' '}
            {item.nutri.f}g F{item.nutri.fi != null ? ` · ${item.nutri.fi}g fi` : ''}
          </span>
        )}
      </span>
      <button
        aria-label={`Edit ${item.n}`}
        title="Edit"
        onClick={e => {
          e.stopPropagation()
          startEdit()
        }}
        className="item-icon-btn"
        style={{ fontSize: 12 }}
      >
        ✎
      </button>
      <button
        aria-label={`Remove ${item.n}`}
        onClick={e => {
          e.stopPropagation()
          onRemove(item.id)
        }}
        className="item-icon-btn"
        style={{ fontSize: 14, padding: '0 2px' }}
      >
        ×
      </button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function GroceryPanel({ user }: { user?: User | null }) {
  const store = useGroceryStore()
  const catalogStore = useGroceryCatalogStore()

  const [checked, setChecked] = useState<string[]>(() => store.getChecked())
  const [userItems, setUserItems] = useState<GroceryCatalogItem[]>(() => catalogStore.getAll())

  // Add-item form state
  const [addName, setAddName] = useState('')
  const [addCat, setAddCat] = useState<string>(GROCERY_CATEGORIES[0])
  const [showAddForm, setShowAddForm] = useState(false)

  // Nutrition lookup state
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const [nutSrv, setNutSrv] = useState('')
  const [nutCal, setNutCal] = useState('')
  const [nutP, setNutP] = useState('')
  const [nutC, setNutC] = useState('')
  const [nutF, setNutF] = useState('')
  const [nutFi, setNutFi] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const resetForm = useCallback(() => {
    setAddName('')
    setAddCat(GROCERY_CATEGORIES[0])
    setShowAddForm(false)
    setLookupState('idle')
    setNutSrv('')
    setNutCal('')
    setNutP('')
    setNutC('')
    setNutF('')
    setNutFi('')
    abortRef.current?.abort()
  }, [])

  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(SEEDED_KEY)) return
    const seeds: GroceryCatalogItem[] = Object.entries(GROCERY_DATA).flatMap(([cat, items]) =>
      items.map(item => ({ id: uid(), n: item.n, cat, nutri: item.nutri })),
    )
    seeds.forEach(item => catalogStore.add(item))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserItems(catalogStore.getAll())
    localStorage.setItem(SEEDED_KEY, '1')
  }, [user, catalogStore])

  const { orderedCats, byCategory } = useMemo(() => {
    const map: Record<string, GroceryCatalogItem[]> = {}
    for (const item of userItems) (map[item.cat] ??= []).push(item)
    const stdSet = new Set(GROCERY_CATEGORIES as readonly string[])
    const ordered = GROCERY_CATEGORIES.filter(c => map[c]?.length)
    const custom = Object.keys(map).filter(c => !stdSet.has(c))
    return { orderedCats: [...ordered, ...custom], byCategory: map }
  }, [userItems])

  const toggle = (name: string) => {
    store.toggle(name)
    setChecked(store.getChecked())
  }

  const clearAll = () => {
    store.clearAll()
    setChecked([])
  }

  const handleLookup = useCallback(async () => {
    const name = addName.trim()
    if (!name) return
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLookupState('loading')
    try {
      const result = await searchUSDA(name, abortRef.current.signal)
      if (result) {
        setNutSrv(result.srv)
        setNutCal(String(result.cal))
        setNutP(String(result.p))
        setNutC(String(result.c))
        setNutF(String(result.f))
        setNutFi(result.fi != null ? String(result.fi) : '')
        setLookupState('found')
      } else {
        setLookupState('not-found')
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setLookupState('error')
    }
  }, [addName])

  const handleAddItem = useCallback(() => {
    const name = addName.trim()
    if (!name) return
    const nutri = buildNutri(nutSrv, nutCal, nutP, nutC, nutF, nutFi)
    catalogStore.add({ id: uid(), n: name, cat: addCat, nutri })
    setUserItems(catalogStore.getAll())
    resetForm()
  }, [addName, addCat, nutSrv, nutCal, nutP, nutC, nutF, nutFi, catalogStore, resetForm])

  const handleEditItem = useCallback(
    (id: string, newName: string) => {
      catalogStore.update(id, { n: newName })
      setUserItems(catalogStore.getAll())
    },
    [catalogStore],
  )

  const handleRemoveItem = useCallback(
    (id: string) => {
      catalogStore.remove(id)
      setUserItems(catalogStore.getAll())
    },
    [catalogStore],
  )

  // ── Guest gate ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div className="guest-gate">
        <div className="guest-gate-icon">🛒</div>
        <div className="guest-gate-title">
          Your <em className="text-green">Grocery List</em>
        </div>
        <div className="guest-gate-body">Sign in to manage your personalised grocery list.</div>
      </div>
    )
  }

  // ── Authenticated view ─────────────────────────────────────────
  return (
    <div>
      <div className="guest-gate-title mb-4">
        Your <em className="text-green">Grocery List</em>
      </div>
      <div className="text-base text-muted mb-14">
        Tap an item to check it off. Use ✎ to rename or × to remove.
      </div>

      <div className="grocery-toolbar">
        <button className="grocery-clear-btn" onClick={clearAll}>
          Clear all
        </button>
      </div>

      {/* Add item */}
      <div className="mb-20">
        {!showAddForm ? (
          <button
            aria-label="Add grocery item"
            className="add-trigger"
            onClick={() => setShowAddForm(true)}
          >
            <span className="text-lg" style={{ lineHeight: 1 }}>
              +
            </span>{' '}
            Add item to my list
          </button>
        ) : (
          <div className="add-form">
            <div className="add-form-hdr">Add item to grocery list</div>

            <input
              className="tinput"
              placeholder="Item name (e.g. Kimchi)"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              autoFocus
            />

            <div className="flex flex-col gap-4">
              <div className="text-xs text-muted2">Category</div>
              <select
                className="form-select"
                value={addCat}
                onChange={e => setAddCat(e.target.value)}
              >
                {GROCERY_CATEGORIES.map(c => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="My Custom Items">My Custom Items</option>
              </select>
            </div>

            {/* ── Nutrition section ── */}
            <div className="nutri-section">
              <div className="nutri-header">
                <div className="nutri-label">
                  Nutrition <span style={{ opacity: 0.6 }}>(optional)</span>
                </div>
                <button
                  className="nutri-lookup-btn"
                  onClick={handleLookup}
                  disabled={!addName.trim() || lookupState === 'loading'}
                  aria-label="Look up nutrition from USDA"
                >
                  {lookupState === 'loading' ? 'Looking up…' : '↻ USDA lookup'}
                </button>
              </div>

              {lookupState === 'found' && (
                <div className="nutri-status found">✓ Found — edit if needed</div>
              )}
              {lookupState === 'not-found' && (
                <div className="nutri-status not-found">No match found — enter manually</div>
              )}
              {lookupState === 'error' && (
                <div className="nutri-status error">Lookup failed — enter manually</div>
              )}

              <input
                className="tinput"
                placeholder="Serving size (e.g. 100g, 1 cup)"
                value={nutSrv}
                onChange={e => setNutSrv(e.target.value)}
                aria-label="Serving size"
                style={{ fontSize: 12, marginBottom: 6 }}
              />

              <div className="nutri-grid">
                {(
                  [
                    ['kcal', nutCal, setNutCal, 'Calories'],
                    ['P g', nutP, setNutP, 'Protein'],
                    ['C g', nutC, setNutC, 'Carbs'],
                    ['F g', nutF, setNutF, 'Fat'],
                    ['Fi g', nutFi, setNutFi, 'Fiber'],
                  ] as const
                ).map(([label, val, setter, ariaLabel]) => (
                  <label key={label} className="nutri-field">
                    {label}
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={val}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      aria-label={ariaLabel}
                      className="nutri-input"
                    />
                  </label>
                ))}
              </div>
            </div>

            <div className="add-actions">
              <button className="add-submit" onClick={handleAddItem} disabled={!addName.trim()}>
                Add item
              </button>
              <button className="add-cancel" onClick={resetForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Item grid */}
      {orderedCats.length === 0 ? (
        <div className="grocery-empty">Your list is empty. Add items above.</div>
      ) : (
        <div className="grocery-grid">
          {orderedCats.map(cat => (
            <div key={cat} className="gcat">
              <div className="gcatlbl">{cat}</div>
              {(byCategory[cat] ?? []).map(item => (
                <GroceryItemRow
                  key={item.id}
                  item={item}
                  checked={checked.includes(item.n)}
                  onToggle={toggle}
                  onEdit={handleEditItem}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
