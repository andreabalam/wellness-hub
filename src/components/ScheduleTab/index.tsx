import { useState, useCallback, useMemo } from 'react'
import type { User } from '@supabase/supabase-js'
import { customToScheduleBlock, DAY_KEYS, DAY_LABELS, sortByTime } from '../../data/schedule'
import type { CustomBlock, DayKey, WeekSchedule } from '../../data/schedule'
import { scheduleStore, useUserSettingsStore } from '../../hooks/useStore'
import { generateWeekIcs, downloadIcs } from '../../lib/ics'
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

function loadWeek(): WeekSchedule {
  return scheduleStore.getWeek()
}

/** Re-prefix block IDs for a target day (strips any existing day prefix first). */
function rebrandForDay(blocks: CustomBlock[], day: DayKey): CustomBlock[] {
  return blocks.map(b => ({
    ...b,
    id: `${day}-${b.id.replace(/^(mon|tue|wed|thu|fri|sat|sun)-/, '')}`,
  }))
}

// ── Component ────────────────────────────────────────────────────

export default function ScheduleTab({ user }: { user?: User | null }) {
  const settingsStore = useUserSettingsStore()

  const todayKey = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'][new Date().getDay()] as DayKey

  const [weekSchedule, setWeekSchedule] = useState<WeekSchedule>(loadWeek)
  const [selectedDay, setSelectedDay] = useState<DayKey>(todayKey)
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())
  const [showEditor, setShowEditor] = useState(false)
  const [showExport, setShowExport] = useState(false)
  const [startDate, setStartDate] = useState(todayStr)
  const [endDate, setEndDate] = useState(oneMonthOut)
  const [peakStart, setPeakStart] = useState(() => settingsStore.get().cognitivePeakStart)
  const [peakEnd, setPeakEnd] = useState(() => settingsStore.get().cognitivePeakEnd)
  const [editingPeak, setEditingPeak] = useState(false)

  // The blocks for the currently selected day
  const blocks = weekSchedule[selectedDay]

  const savePeak = () => {
    settingsStore.set({ cognitivePeakStart: peakStart, cognitivePeakEnd: peakEnd })
    setEditingPeak(false)
  }

  const toggleRow = (i: number) => {
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  const handleBlocksChange = useCallback(
    (updated: CustomBlock[]) => {
      scheduleStore.saveDay(selectedDay, updated)
      setWeekSchedule(prev => ({ ...prev, [selectedDay]: updated }))
      setOpenRows(new Set())
    },
    [selectedDay],
  )

  const handleResetDay = useCallback(() => {
    const fresh = scheduleStore.resetDay(selectedDay)
    setWeekSchedule(prev => ({ ...prev, [selectedDay]: fresh }))
  }, [selectedDay])

  const handleResetAll = useCallback(() => {
    const fresh = scheduleStore.resetWeek()
    setWeekSchedule(fresh)
  }, [])

  const handleSaveAll = useCallback((updated: CustomBlock[]) => {
    const sorted = sortByTime(updated)
    const newWeek = Object.fromEntries(
      DAY_KEYS.map(d => [d, rebrandForDay(sorted, d)]),
    ) as WeekSchedule
    scheduleStore.saveWeek(newWeek)
    setWeekSchedule(newWeek)
    setOpenRows(new Set())
  }, [])

  const handleExport = () => {
    const weekBlocks = Object.fromEntries(
      DAY_KEYS.map(d => [d, weekSchedule[d].map(customToScheduleBlock)]),
    ) as Record<DayKey, ReturnType<typeof customToScheduleBlock>[]>
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const ics = generateWeekIcs(weekBlocks, start, end)
    downloadIcs(ics, `wellness-schedule-${startDate}.ics`)
  }

  // Convert CustomBlocks → ScheduleBlocks for rendering
  const renderBlocks = blocks.map(customToScheduleBlock)

  // Day-modified indicator: a day gets a dot when its fingerprint differs from the majority
  const dayModified = useMemo(() => {
    const fp = (d: DayKey) => weekSchedule[d].map(b => `${b.time}|${b.title}`).join(',')
    const counts: Record<string, number> = {}
    for (const d of DAY_KEYS) {
      const f = fp(d)
      counts[f] = (counts[f] ?? 0) + 1
    }
    const majorityFp = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ''
    return Object.fromEntries(DAY_KEYS.map(d => [d, fp(d) !== majorityFp])) as Record<
      DayKey,
      boolean
    >
  }, [weekSchedule])

  if (!user) {
    return (
      <div className="guest-gate">
        <div className="guest-gate-icon">🗓</div>
        <div className="guest-gate-title">
          Your <em className="text-teal">Schedule</em>
        </div>
        <div className="guest-gate-body">Sign in to save your schedule.</div>
      </div>
    )
  }

  return (
    <>
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-8 mb-18 flex-wrap">
        <button onClick={() => setShowEditor(true)} className="toolbar-btn">
          ✎ Edit schedule
        </button>
        <button
          onClick={() => setShowExport(s => !s)}
          className="toolbar-btn"
          style={{
            background: showExport ? 'rgba(58,144,144,0.12)' : undefined,
            border: `1px solid ${showExport ? 'var(--teal)' : 'var(--border2)'}`,
            color: showExport ? 'var(--teal-light)' : undefined,
          }}
        >
          📅 Export .ics
        </button>
      </div>

      {/* ── Day selector ── */}

      {/* ── Day selector ── */}
      <div className="flex gap-4 mb-16 inner-tab-bar" style={{ marginTop: 0 }}>
        {DAY_KEYS.map(day => (
          <button
            key={day}
            onClick={() => {
              setSelectedDay(day)
              setShowEditor(false)
              setOpenRows(new Set())
            }}
            className="inner-tab"
            style={{
              padding: '8px 14px',
              color: selectedDay === day ? 'var(--teal-light)' : 'var(--muted)',
              borderBottom: `2px solid ${selectedDay === day ? 'var(--teal)' : 'transparent'}`,
            }}
          >
            {DAY_LABELS[day]}
            {dayModified[day] && <span className="day-tab-indicator" />}
          </button>
        ))}
      </div>

      {/* ── ICS export panel ── */}
      {showExport && (
        <div className="sched-export-panel flex flex-wrap gap-12 items-start">
          <div>
            <div className="sched-export-lbl">From</div>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="blk-form-input"
              style={{ width: 'auto' }}
            />
          </div>
          <div>
            <div className="sched-export-lbl">To</div>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={e => setEndDate(e.target.value)}
              className="blk-form-input"
              style={{ width: 'auto' }}
            />
          </div>
          <button
            onClick={handleExport}
            className="action-btn"
            style={{ background: 'var(--teal)', color: '#fff' }}
          >
            Download .ics
          </button>
          <div className="text-xs text-muted2 w-full lh-15">
            Exports the full week schedule as{' '}
            <strong className="text-muted">recurring weekly events</strong>, one per day. Import the
            file into Apple Calendar, Google Calendar, or Outlook.
          </div>
        </div>
      )}

      {/* ── Timeline ── */}
      <div className="pbanner flex-between gap-8">
        <div className="flex items-center gap-8">
          <span>○</span>
          {editingPeak ? (
            <span className="flex items-center gap-6 flex-wrap">
              <strong>Cognitive peak:</strong>
              <input
                aria-label="Peak start time"
                type="time"
                value={peakStart}
                onChange={e => setPeakStart(e.target.value)}
                className="peak-time-input"
              />
              <span>–</span>
              <input
                aria-label="Peak end time"
                type="time"
                value={peakEnd}
                onChange={e => setPeakEnd(e.target.value)}
                className="peak-time-input"
              />
              <button onClick={savePeak} className="peak-save-btn">
                Save
              </button>
              <button onClick={() => setEditingPeak(false)} className="peak-cancel-btn">
                Cancel
              </button>
            </span>
          ) : (
            <span>
              <strong>
                Cognitive peak: {formatPeakTime(peakStart)} – {formatPeakTime(peakEnd)}.
              </strong>
            </span>
          )}
        </div>
        {!editingPeak && (
          <button
            aria-label="Edit cognitive peak"
            onClick={() => setEditingPeak(true)}
            className="peak-edit-btn"
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
              <div className={`trow${isOpen ? ' open' : ''}`} onClick={() => toggleRow(bi)}>
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
          onSaveAll={handleSaveAll}
          onReset={handleResetDay}
          onResetAll={handleResetAll}
          onClose={() => setShowEditor(false)}
        />
      )}
    </>
  )
}
