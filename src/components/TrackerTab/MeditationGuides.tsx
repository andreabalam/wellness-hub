import { useState } from 'react'
import type { MedGuide } from '../../lib/sync'
import * as sync from '../../lib/sync'
import { supabase } from '../../lib/supabase'
import { safeGet, safeSet } from '../../lib/storage'
import { MED_GUIDES_KEY } from '../../hooks/useStore'

const DEFAULT_GUIDES: MedGuide[] = [
  {
    title: 'Guided Meditation · Session 1',
    url: 'https://www.youtube.com/watch?v=_nfMuLIpRus&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=1',
  },
  {
    title: 'Guided Meditation · Session 2',
    url: 'https://www.youtube.com/watch?v=UFFx_b-rpOE&list=PLSGCbLKMPkC1I1jnlSKIqCllxhRu2fNTN&index=2',
  },
]

function loadGuides(): MedGuide[] {
  return safeGet<MedGuide[]>(MED_GUIDES_KEY, DEFAULT_GUIDES)
}

async function saveGuides(g: MedGuide[]) {
  safeSet(MED_GUIDES_KEY, g)
  if (!supabase) return
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (user)
      sync.pushMedGuides(user.id, g).catch(() => {
        /* offline */
      })
  } catch {
    /* ignore */
  }
}

/** Editable list of favorite meditation guide links. Persists to localStorage
 *  (and Supabase when signed in) independently of the day's tracker data. */
export default function MeditationGuides() {
  const [guides, setGuides] = useState<MedGuide[]>(loadGuides)
  const [newGuideTitle, setNewGuideTitle] = useState('')
  const [newGuideUrl, setNewGuideUrl] = useState('')
  const [showAddGuide, setShowAddGuide] = useState(false)

  const addGuide = () => {
    const url = newGuideUrl.trim()
    if (!url) return
    const title = newGuideTitle.trim() || url
    const updated = [...guides, { title, url }]
    setGuides(updated)
    saveGuides(updated)
    setNewGuideTitle('')
    setNewGuideUrl('')
    setShowAddGuide(false)
  }

  const removeGuide = (i: number) => {
    const updated = guides.filter((_, j) => j !== i)
    setGuides(updated)
    saveGuides(updated)
  }

  return (
    <div className="tcard">
      <div className="flex-between mb-10">
        <div className="tlabel" style={{ color: 'var(--gold)', marginBottom: 0 }}>
          Favorite Guides
        </div>
        <button
          onClick={() => setShowAddGuide(v => !v)}
          className={`open-toggle-btn ${showAddGuide ? 'text-muted2' : 'text-teal'}`}
        >
          {showAddGuide ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {guides.length === 0 && !showAddGuide && (
        <div className="text-sm text-muted2 italic mb-6">No guides saved yet.</div>
      )}

      <div className={`flex flex-col gap-6 ${showAddGuide ? 'mb-10' : ''}`}>
        {guides.map((g, i) => (
          <div key={i} className="guide-row">
            <span className="text-base" style={{ color: 'var(--gold)' }}>
              ▶
            </span>
            <a href={g.url} target="_blank" rel="noopener noreferrer" className="guide-link">
              {g.title}
            </a>
            <button onClick={() => removeGuide(i)} title="Remove" className="item-icon-btn text-lg">
              ×
            </button>
          </div>
        ))}
      </div>

      {showAddGuide && (
        <div className="flex flex-col gap-6">
          <input
            className="tinput"
            value={newGuideTitle}
            onChange={e => setNewGuideTitle(e.target.value)}
            placeholder="Title (e.g. Morning Calm · 13 min)"
          />
          <input
            className="tinput"
            value={newGuideUrl}
            onChange={e => setNewGuideUrl(e.target.value)}
            placeholder="URL"
            onKeyDown={e => e.key === 'Enter' && addGuide()}
          />
          <button onClick={addGuide} className="tbtn btn-gold">
            Add guide
          </button>
        </div>
      )}
    </div>
  )
}
