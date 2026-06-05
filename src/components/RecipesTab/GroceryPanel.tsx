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

function buildNutri(srv: string, cal: string, p: string, c: string, f: string, fi: string): NutriInfo | undefined {
  const calN = parseFloat(cal)
  const pN   = parseFloat(p)
  const cN   = parseFloat(c)
  const fN   = parseFloat(f)
  if (isNaN(calN) || isNaN(pN) || isNaN(cN) || isNaN(fN)) return undefined
  const fiN = parseFloat(fi)
  return {
    srv: srv.trim() || '100g',
    cal: Math.round(calN),
    p:   Math.round(pN * 10) / 10,
    c:   Math.round(cN * 10) / 10,
    f:   Math.round(fN * 10) / 10,
    fi:  !isNaN(fiN) ? Math.round(fiN * 10) / 10 : undefined,
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

  const startEdit = () => { setEditVal(item.n); setEditing(true) }

  const commitEdit = () => {
    const trimmed = editVal.trim()
    if (trimmed && trimmed !== item.n) onEdit(item.id, trimmed)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="gitem" style={{ gap: 6 }} onClick={e => e.stopPropagation()}>
        <input
          className="tinput"
          value={editVal}
          onChange={e => setEditVal(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter')  { e.preventDefault(); commitEdit() }
            if (e.key === 'Escape') { setEditing(false); setEditVal(item.n) }
          }}
          autoFocus
          style={{ flex: 1, fontSize: 13, padding: '3px 7px' }}
        />
        <button
          aria-label="Save"
          onClick={commitEdit}
          style={{
            background: 'var(--green)', border: 'none', borderRadius: 5,
            color: '#fff', cursor: 'pointer', fontSize: 12, padding: '3px 8px',
            fontFamily: 'sans-serif', flexShrink: 0,
          }}
        >✓</button>
        <button
          aria-label="Cancel edit"
          onClick={() => { setEditing(false); setEditVal(item.n) }}
          style={{
            background: 'none', border: '1px solid var(--border2)', borderRadius: 5,
            color: 'var(--muted)', cursor: 'pointer', fontSize: 12, padding: '3px 7px',
            fontFamily: 'sans-serif', flexShrink: 0,
          }}
        >✕</button>
      </div>
    )
  }

  return (
    <div
      className={`gitem${checked ? ' gchecked' : ''}`}
      onClick={() => onToggle(item.n)}
    >
      <div className="gcheck">✓</div>
      <span style={{ flex: 1 }}>
        {item.n}
        {item.nutri && (
          <span style={{
            display: 'block', fontSize: 10,
            fontFamily: '"DM Mono", monospace',
            color: 'var(--muted2)', marginTop: 1, lineHeight: 1.4,
          }}>
            {item.nutri.srv} · {item.nutri.cal} kcal · {item.nutri.p}g P · {item.nutri.c}g C · {item.nutri.f}g F
            {item.nutri.fi != null ? ` · ${item.nutri.fi}g fi` : ''}
          </span>
        )}
      </span>
      <button
        aria-label={`Edit ${item.n}`}
        title="Edit"
        onClick={e => { e.stopPropagation(); startEdit() }}
        style={{
          background: 'none', border: 'none', color: 'var(--muted2)',
          cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: '0 3px',
          flexShrink: 0, opacity: 0.7,
        }}
      >✎</button>
      <button
        aria-label={`Remove ${item.n}`}
        onClick={e => { e.stopPropagation(); onRemove(item.id) }}
        style={{
          background: 'none', border: 'none', color: 'var(--muted2)',
          cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
          flexShrink: 0,
        }}
      >×</button>
    </div>
  )
}

// ── Main component ───────────────────────────────────────────────

export default function GroceryPanel({ user }: { user?: User | null }) {
  const store        = useGroceryStore()
  const catalogStore = useGroceryCatalogStore()

  const [checked,   setChecked]   = useState<string[]>(() => store.getChecked())
  const [userItems, setUserItems] = useState<GroceryCatalogItem[]>(() => catalogStore.getAll())

  // Add-item form state
  const [addName,     setAddName]     = useState('')
  const [addCat,      setAddCat]      = useState<string>(GROCERY_CATEGORIES[0])
  const [showAddForm, setShowAddForm] = useState(false)

  // Nutrition lookup state
  const [lookupState, setLookupState] = useState<LookupState>('idle')
  const [nutSrv, setNutSrv] = useState('')
  const [nutCal, setNutCal] = useState('')
  const [nutP,   setNutP]   = useState('')
  const [nutC,   setNutC]   = useState('')
  const [nutF,   setNutF]   = useState('')
  const [nutFi,  setNutFi]  = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const resetForm = useCallback(() => {
    setAddName('')
    setAddCat(GROCERY_CATEGORIES[0])
    setShowAddForm(false)
    setLookupState('idle')
    setNutSrv(''); setNutCal(''); setNutP(''); setNutC(''); setNutF(''); setNutFi('')
    abortRef.current?.abort()
  }, [])

  // Seed default items on first load for signed-in users
  useEffect(() => {
    if (!user) return
    if (localStorage.getItem(SEEDED_KEY)) return
    const seeds: GroceryCatalogItem[] = Object.entries(GROCERY_DATA).flatMap(([cat, items]) =>
      items.map(item => ({ id: uid(), n: item.n, cat, nutri: item.nutri }))
    )
    seeds.forEach(item => catalogStore.add(item))
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUserItems(catalogStore.getAll())
    localStorage.setItem(SEEDED_KEY, '1')
  }, [user, catalogStore])

  // Group items by category in GROCERY_CATEGORIES order, plus any custom categories
  const { orderedCats, byCategory } = useMemo(() => {
    const map: Record<string, GroceryCatalogItem[]> = {}
    for (const item of userItems) (map[item.cat] ??= []).push(item)
    const stdSet = new Set(GROCERY_CATEGORIES as readonly string[])
    const ordered = GROCERY_CATEGORIES.filter(c => map[c]?.length)
    const custom  = Object.keys(map).filter(c => !stdSet.has(c))
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

  const handleEditItem = useCallback((id: string, newName: string) => {
    catalogStore.update(id, { n: newName })
    setUserItems(catalogStore.getAll())
  }, [catalogStore])

  const handleRemoveItem = useCallback((id: string) => {
    catalogStore.remove(id)
    setUserItems(catalogStore.getAll())
  }, [catalogStore])

  // ── Guest gate ─────────────────────────────────────────────────
  if (!user) {
    return (
      <div style={{ textAlign: 'center', padding: '52px 24px' }}>
        <div style={{ fontSize: 40, marginBottom: 14 }}>🛒</div>
        <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 8 }}>
          Your <em style={{ fontStyle: 'italic', color: 'var(--green-light)' }}>Grocery List</em>
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', maxWidth: 300, margin: '0 auto', lineHeight: 1.6 }}>
          Sign in to manage your personalised grocery list.
        </div>
      </div>
    )
  }

  // ── Authenticated view ─────────────────────────────────────────
  return (
    <div>
      <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 4 }}>
        Your <em style={{ fontStyle: 'italic', color: 'var(--green-light)' }}>Grocery List</em>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
        Tap an item to check it off. Use ✎ to rename or × to remove.
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        <button
          onClick={clearAll}
          style={{
            marginLeft: 'auto', background: 'var(--bg3)',
            border: '1px solid var(--border2)', borderRadius: 7,
            padding: '4px 12px', fontSize: 12, color: 'var(--muted)',
            cursor: 'pointer', fontFamily: 'sans-serif',
          }}
        >
          Clear all
        </button>
      </div>

      {/* Add item */}
      <div style={{ marginBottom: 20 }}>
        {!showAddForm ? (
          <button
            aria-label="Add grocery item"
            onClick={() => setShowAddForm(true)}
            style={{
              background: 'var(--bg3)', border: '1px dashed var(--border2)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13,
              color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> Add item to my list
          </button>
        ) : (
          <div
            style={{
              background: 'var(--bg2)', border: '1px solid var(--border2)',
              borderRadius: 10, padding: 16,
              display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 420,
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--muted)', fontFamily: '"DM Mono",monospace' }}>Add item to grocery list</div>

            <input
              className="tinput"
              placeholder="Item name (e.g. Kimchi)"
              value={addName}
              onChange={e => setAddName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddItem()}
              autoFocus
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 11, color: 'var(--muted2)' }}>Category</div>
              <select
                value={addCat}
                onChange={e => setAddCat(e.target.value)}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 7, padding: '7px 10px', fontSize: 13,
                  color: 'var(--text)', fontFamily: '"DM Sans",sans-serif',
                  cursor: 'pointer', outline: 'none',
                }}
              >
                {GROCERY_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="My Custom Items">My Custom Items</option>
              </select>
            </div>

            {/* ── Nutrition section ── */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 11, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace' }}>
                  Nutrition <span style={{ opacity: 0.6 }}>(optional)</span>
                </div>
                <button
                  onClick={handleLookup}
                  disabled={!addName.trim() || lookupState === 'loading'}
                  aria-label="Look up nutrition from USDA"
                  style={{
                    background: 'var(--bg3)', border: '1px solid var(--border2)',
                    borderRadius: 6, padding: '3px 10px', fontSize: 11,
                    color: 'var(--muted)', cursor: !addName.trim() || lookupState === 'loading' ? 'default' : 'pointer',
                    fontFamily: 'sans-serif', flexShrink: 0,
                    opacity: !addName.trim() ? 0.5 : 1,
                    transition: 'opacity .15s',
                  }}
                >
                  {lookupState === 'loading' ? 'Looking up…' : '↻ USDA lookup'}
                </button>
              </div>

              {lookupState === 'found' && (
                <div style={{ fontSize: 11, color: 'var(--teal-light)', marginBottom: 6 }}>
                  ✓ Found — edit if needed
                </div>
              )}
              {lookupState === 'not-found' && (
                <div style={{ fontSize: 11, color: 'var(--muted2)', marginBottom: 6 }}>
                  No match found — enter manually
                </div>
              )}
              {lookupState === 'error' && (
                <div style={{ fontSize: 11, color: 'var(--coral-light)', marginBottom: 6 }}>
                  Lookup failed — enter manually
                </div>
              )}

              <input
                className="tinput"
                placeholder="Serving size (e.g. 100g, 1 cup)"
                value={nutSrv}
                onChange={e => setNutSrv(e.target.value)}
                aria-label="Serving size"
                style={{ fontSize: 12, marginBottom: 6 }}
              />

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 5 }}>
                {([
                  ['kcal', nutCal, setNutCal, 'Calories'],
                  ['P g',  nutP,   setNutP,   'Protein'],
                  ['C g',  nutC,   setNutC,   'Carbs'],
                  ['F g',  nutF,   setNutF,   'Fat'],
                  ['Fi g', nutFi,  setNutFi,  'Fiber'],
                ] as const).map(([label, val, setter, ariaLabel]) => (
                  <label key={label} style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 10, color: 'var(--muted2)', fontFamily: '"DM Mono",monospace', textAlign: 'center' }}>
                    {label}
                    <input
                      type="number"
                      min={0}
                      step="0.1"
                      value={val}
                      onChange={e => (setter as (v: string) => void)(e.target.value)}
                      aria-label={ariaLabel}
                      style={{
                        background: 'var(--bg3)', border: '1px solid var(--border)',
                        borderRadius: 5, padding: '4px 2px',
                        color: 'var(--text)', fontSize: 12, textAlign: 'center',
                        fontFamily: '"DM Mono",monospace', outline: 'none', width: '100%',
                      }}
                    />
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleAddItem}
                disabled={!addName.trim()}
                style={{
                  flex: 1, background: 'var(--green)', border: 'none',
                  borderRadius: 7, padding: '8px 0', fontSize: 13,
                  fontFamily: 'sans-serif', color: '#fff', cursor: 'pointer',
                  opacity: addName.trim() ? 1 : 0.5,
                }}
              >Add item</button>
              <button
                onClick={resetForm}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 7, padding: '8px 14px', fontSize: 13,
                  fontFamily: 'sans-serif', color: 'var(--muted)', cursor: 'pointer',
                }}
              >Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Item grid */}
      {orderedCats.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
          Your list is empty. Add items above.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
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
