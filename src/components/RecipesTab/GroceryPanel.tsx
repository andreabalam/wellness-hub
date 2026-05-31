import { useState, useEffect, useCallback } from 'react'
import { GROCERY_DATA, GROCERY_CATEGORIES } from '../../data/grocery'
import type { GroceryItem, GroceryCatalogItem } from '../../data/grocery'
import { useGroceryStore, useGroceryCatalogStore } from '../../hooks/useStore'
import { isConfigured } from '../../lib/supabase'
import { pullGroceryCatalog } from '../../lib/sync'

const DOT_COLORS = { add: 'var(--green)', swap: 'var(--amber)', remove: 'var(--red)' } as const
const BADGE_CLS  = { add: 'gbadd', swap: 'gbswap', remove: 'gbrem' } as const

// ── small helpers ────────────────────────────────────────────────

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

interface GroceryItemRowProps {
  item: GroceryItem
  checked: boolean
  onToggle: (name: string) => void
  onRemove?: () => void
}

function GroceryItemRow({ item, checked, onToggle, onRemove }: GroceryItemRowProps) {
  const dotColor = item.t ? DOT_COLORS[item.t] : 'var(--muted2)'
  return (
    <div
      className={`gitem${checked ? ' gchecked' : ''}`}
      onClick={() => onToggle(item.n)}
      style={{ position: 'relative' }}
    >
      <div className="gcheck">✓</div>
      <div className="gdot" style={{ background: dotColor }} />
      <span style={{ flex: 1 }}>
        {item.n}
        {item.nutri && (
          <span style={{
            display: 'block',
            fontSize: 10,
            fontFamily: '"DM Mono", monospace',
            color: 'var(--muted2)',
            marginTop: 1,
            lineHeight: 1.4,
          }}>
            {item.nutri.srv} · {item.nutri.cal} kcal · {item.nutri.p}g P · {item.nutri.c}g C · {item.nutri.f}g F{item.nutri.fi != null ? ` · ${item.nutri.fi}g fi` : ''}
          </span>
        )}
      </span>
      {item.t && (
        <span className={`gbadge ${BADGE_CLS[item.t]}`}>{item.t}</span>
      )}
      {onRemove && (
        <button
          aria-label={`Remove ${item.n}`}
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{
            background: 'none', border: 'none', color: 'var(--muted2)',
            cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      )}
    </div>
  )
}

// ── main component ───────────────────────────────────────────────

export default function GroceryPanel() {
  const store        = useGroceryStore()
  const catalogStore = useGroceryCatalogStore()

  const [checked, setChecked]         = useState<string[]>(() => store.getChecked())
  const [userItems, setUserItems]     = useState<GroceryCatalogItem[]>(() => catalogStore.getAll())
  // Catalog: start with the static fallback, upgrade to the remote version if available
  const [catalog, setCatalog]         = useState<Record<string, GroceryItem[]>>(GROCERY_DATA)

  // Add-item form state
  const [addName, setAddName]         = useState('')
  const [addCat, setAddCat]           = useState<string>(GROCERY_CATEGORIES[0])
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (!isConfigured) return
    let active = true
    pullGroceryCatalog()
      .then(remote => { if (active && remote) setCatalog(remote) })
      .catch(() => { /* network unavailable or table not yet created — use static fallback */ })
    return () => { active = false }
  }, [])

  const toggle = (name: string) => {
    store.toggle(name)
    setChecked(store.getChecked())
  }

  const clearAll = () => {
    store.clearAll()
    setChecked([])
  }

  const handleAddItem = useCallback(() => {
    const name = addName.trim()
    if (!name) return
    const item: GroceryCatalogItem = { id: uid(), n: name, cat: addCat }
    catalogStore.add(item)
    setUserItems(catalogStore.getAll())
    setAddName('')
    setShowAddForm(false)
  }, [addName, addCat, catalogStore])

  const handleRemoveItem = useCallback((id: string) => {
    catalogStore.remove(id)
    setUserItems(catalogStore.getAll())
  }, [catalogStore])

  // Merge user items into their matching standard categories;
  // items with non-standard cats collect under a "My Custom Items" bucket.
  const standardCats = new Set<string>(Object.keys(GROCERY_DATA))
  const userByStdCat: Record<string, GroceryCatalogItem[]> = {}
  const userCustomItems: GroceryCatalogItem[] = []

  for (const item of userItems) {
    if (standardCats.has(item.cat)) {
      ;(userByStdCat[item.cat] ??= []).push(item)
    } else {
      userCustomItems.push(item)
    }
  }

  return (
    <div>
      <div style={{ fontFamily: '"DM Serif Display",serif', fontSize: 22, fontWeight: 400, color: 'var(--text)', marginBottom: 4 }}>
        Your <em style={{ fontStyle: 'italic', color: 'var(--green-light)' }}>Grocery List</em>
      </div>
      <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>Tap any item to check it off as you shop.</div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14, alignItems: 'center' }}>
        {(['Keep', 'Add', 'Swap', 'Remove'] as const).map((lbl, i) => {
          const colors = ['var(--muted2)', 'var(--green)', 'var(--amber)', 'var(--red)']
          return (
            <span key={lbl} style={{ fontSize: 12, color: 'var(--muted)', fontFamily: '"DM Mono",monospace', display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: colors[i], display: 'inline-block' }} />
              {lbl}
            </span>
          )
        })}
        <button
          onClick={clearAll}
          style={{ marginLeft: 'auto', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 7, padding: '4px 12px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}
        >
          Clear all
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: 12 }}>
        {/* Static catalog + user items merged per category */}
        {Object.entries(catalog).map(([cat, items]) => (
          <div key={cat} className="gcat">
            <div className="gcatlbl">{cat}</div>
            {items.map(item => (
              <GroceryItemRow
                key={item.n}
                item={item}
                checked={checked.includes(item.n)}
                onToggle={toggle}
              />
            ))}
            {/* User-added items for this standard category */}
            {(userByStdCat[cat] ?? []).map(ui => (
              <GroceryItemRow
                key={ui.id}
                item={{ n: ui.n, nutri: ui.nutri }}
                checked={checked.includes(ui.n)}
                onToggle={toggle}
                onRemove={() => handleRemoveItem(ui.id)}
              />
            ))}
          </div>
        ))}

        {/* User-added items whose category doesn't match any standard category */}
        {userCustomItems.length > 0 && (
          <div className="gcat">
            <div className="gcatlbl">My Custom Items</div>
            {userCustomItems.map(ui => (
              <GroceryItemRow
                key={ui.id}
                item={{ n: ui.n, nutri: ui.nutri }}
                checked={checked.includes(ui.n)}
                onToggle={toggle}
                onRemove={() => handleRemoveItem(ui.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Add item section */}
      <div style={{ marginTop: 20 }}>
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
              borderRadius: 10, padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
              maxWidth: 420,
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
                {GROCERY_CATEGORIES.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="My Custom Items">My Custom Items</option>
              </select>
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
              >
                Add item
              </button>
              <button
                onClick={() => { setShowAddForm(false); setAddName('') }}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border2)',
                  borderRadius: 7, padding: '8px 14px', fontSize: 13,
                  fontFamily: 'sans-serif', color: 'var(--muted)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
