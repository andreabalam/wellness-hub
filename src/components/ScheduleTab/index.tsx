import { useState, useCallback } from 'react'
import { SCHEDULE_BLOCKS, customToScheduleBlock, defaultToCustomBlock } from '../../data/schedule'
import type { CustomBlock } from '../../data/schedule'
import { scheduleStore, useUserSettingsStore } from '../../hooks/useStore'
import { generateIcs, downloadIcs } from '../../lib/ics'
import ScheduleEditor from './ScheduleEditor'

// ── Helpers ──────────────────────────────────────────────────────

function formatPeakTime(t: string): string {
  const [h, m] = t.split(':').map(Number)
  const period = h < 12 ? 'AM' : 'PM'
  const hour12 = h % 12 || 12
  return m === 0 ? `${hour12} ${period}` : `${hour12}:${String(m).padStart(2, '0')} ${period}`
}

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function oneMonthOut() {
  const d = new Date()
  d.setMonth(d.getMonth() + 1)
  return d.toISOString().split('T')[0]
}

/** Return the blocks to render: custom if saved, otherwise built-in defaults */
function loadBlocks(): CustomBlock[] {
  const stored = scheduleStore.getBlocks()
  if (stored) return stored
  return SCHEDULE_BLOCKS.map(defaultToCustomBlock)
}

// ── Component ────────────────────────────────────────────────────

export default function ScheduleTab() {
  const settingsStore = useUserSettingsStore()

  const [blocks, setBlocks]         = useState<CustomBlock[]>(loadBlocks)
  const [openRows, setOpenRows]     = useState<Set<number>>(new Set())
  const [showEditor, setShowEditor] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [startDate, setStartDate]   = useState(todayStr)
  const [endDate, setEndDate]       = useState(oneMonthOut)
  const [peakStart, setPeakStart]   = useState(() => settingsStore.get().cognitivePeakStart)
  const [peakEnd,   setPeakEnd]     = useState(() => settingsStore.get().cognitivePeakEnd)
  const [editingPeak, setEditingPeak] = useState(false)

  const savePeak = () => {
    settingsStore.set({ cognitivePeakStart: peakStart, cognitivePeakEnd: peakEnd })
    setEditingPeak(false)
  }

  const isCustom = !!scheduleStore.getBlocks()

  const toggleRow = (i: number) => {
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })
  }

  const handleBlocksChange = useCallback((updated: CustomBlock[]) => {
    setBlocks(updated)
    setOpenRows(new Set())   // collapse all on edit
  }, [])

  const handleExport = () => {
    const scheduleBlocks = blocks.map(customToScheduleBlock)
    const start = new Date(startDate + 'T00:00:00')
    const end   = new Date(endDate   + 'T00:00:00')
    const ics = generateIcs(scheduleBlocks, start, end)
    downloadIcs(ics, `wellness-schedule-${startDate}.ics`)
  }

  // Convert CustomBlocks → ScheduleBlocks for rendering
  const renderBlocks = blocks.map(customToScheduleBlock)

  return (
    <>
      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        {isCustom && (
          <span style={{ fontSize: 10, fontFamily: '"DM Mono",monospace', color: 'var(--teal-light)', background: 'rgba(58,144,144,0.12)', border: '1px solid var(--teal)', borderRadius: 5, padding: '2px 8px', letterSpacing: '.05em' }}>
            custom
          </span>
        )}
        <button
          onClick={() => setShowEditor(true)}
          style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 14px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer', fontFamily: '"DM Mono",monospace' }}
        >
          ✎ Edit schedule
        </button>
        <button
          onClick={() => setShowExport(s => !s)}
          style={{ background: showExport ? 'rgba(58,144,144,0.12)' : 'var(--bg2)', border: `1px solid ${showExport ? 'var(--teal)' : 'var(--border2)'}`, borderRadius: 8, padding: '6px 14px', fontSize: 12, color: showExport ? 'var(--teal-light)' : 'var(--muted)', cursor: 'pointer', fontFamily: '"DM Mono",monospace' }}
        >
          📅 Export .ics
        </button>
      </div>

      {/* ── ICS export panel ── */}
      {showExport && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--teal)', borderRadius: 12, padding: '16px 18px', marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>From</div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>To</div>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              style={dateInputStyle}
            />
          </div>
          <div>
            <button onClick={handleExport} style={{ background: 'var(--teal)', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif', fontWeight: 500 }}>
              Download .ics
            </button>
          </div>
          <div style={{ flexBasis: '100%', fontSize: 11, color: 'var(--muted2)', lineHeight: 1.5 }}>
            Exports {renderBlocks.length} blocks as <strong style={{ color: 'var(--muted)' }}>recurring Mon–Fri events</strong>. Import the file into Apple Calendar, Google Calendar, or Outlook.
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="pbanner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>○</span>
          {editingPeak ? (
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <strong>Cognitive peak:</strong>
              <input
                aria-label="Peak start time"
                type="time"
                value={peakStart}
                onChange={e => setPeakStart(e.target.value)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--teal)', borderRadius: 5, padding: '2px 6px', color: 'var(--text)', fontSize: 12, fontFamily: '"DM Mono",monospace', outline: 'none', colorScheme: 'dark' }}
              />
              <span>–</span>
              <input
                aria-label="Peak end time"
                type="time"
                value={peakEnd}
                onChange={e => setPeakEnd(e.target.value)}
                style={{ background: 'var(--bg3)', border: '1px solid var(--teal)', borderRadius: 5, padding: '2px 6px', color: 'var(--text)', fontSize: 12, fontFamily: '"DM Mono",monospace', outline: 'none', colorScheme: 'dark' }}
              />
              <button onClick={savePeak} style={{ background: 'var(--teal)', border: 'none', borderRadius: 5, padding: '3px 10px', fontSize: 11, color: '#fff', cursor: 'pointer', fontFamily: 'sans-serif' }}>Save</button>
              <button onClick={() => setEditingPeak(false)} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: 'sans-serif' }}>Cancel</button>
            </span>
          ) : (
            <span>
              <strong>Cognitive peak: {formatPeakTime(peakStart)} – {formatPeakTime(peakEnd)}.</strong>
            </span>
          )}
        </div>
        {!editingPeak && (
          <button
            aria-label="Edit cognitive peak"
            onClick={() => setEditingPeak(true)}
            style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--muted)', cursor: 'pointer', fontFamily: '"DM Mono",monospace', padding: '2px 4px', flexShrink: 0 }}
          >
            ✎
          </button>
        )}
      </div>

      <div className="tl">
        {renderBlocks.map((b, bi) => {
          const isOpen = openRows.has(bi)
          const isLast = bi === renderBlocks.length - 1
          return (
            <div key={bi}>
              {b.phase && <div className="phdr">{b.phase}</div>}
              <div
                className={`trow${isOpen ? ' open' : ''}`}
                onClick={() => toggleRow(bi)}
              >
                <div className="ttime">{b.time}</div>
                <div className="tline">
                  <div className={`tdot ${b.dot}`} />
                  {!isLast && <div className={`tvl ${b.dot}`} />}
                </div>
                <div className="tcnt">
                  <div className="tcard-s">
                    <div className="ttr">
                      <span className="ttitle">{b.title}</span>
                      <span className="tbadge">{b.dur}</span>
                      {b.whyTxt && <span className={`twhy ${b.why}`}>{b.whyTxt}</span>}
                    </div>
                    {isOpen && <div className="tdet">{b.desc}</div>}
                  </div>
                </div>
              </div>
              {b.bridge && <div className="dbridge">{b.bridge}</div>}
            </div>
          )
        })}
      </div>

      {/* ── Editor modal ── */}
      {showEditor && (
        <ScheduleEditor
          blocks={blocks}
          onChange={handleBlocksChange}
          onClose={() => {
            setShowEditor(false)
            setBlocks(loadBlocks())   // reload in case reset was triggered
          }}
        />
      )}
    </>
  )
}

const dateInputStyle: React.CSSProperties = {
  background: 'var(--bg3)', border: '1px solid var(--border2)',
  borderRadius: 7, padding: '7px 10px',
  color: 'var(--text)', fontSize: 13,
  fontFamily: '"DM Sans", sans-serif', outline: 'none',
  colorScheme: 'dark',
}
