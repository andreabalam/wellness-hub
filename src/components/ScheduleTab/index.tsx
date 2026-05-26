import { useState } from 'react'
import { SCHEDULE_BLOCKS, SCHEDULE_DAYS } from '../../data/schedule'

export default function ScheduleTab() {
  const [activeDay, setActiveDay] = useState(0)
  const [openRows, setOpenRows] = useState<Set<number>>(new Set())

  const toggleRow = (i: number) => {
    setOpenRows(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })
  }

  return (
    <>
      <nav className="dnav">
        {SCHEDULE_DAYS.map((d, i) => (
          <button
            key={d.day}
            className={`dbtn${activeDay === i ? ' active' : ''}`}
            onClick={() => setActiveDay(i)}
          >
            {d.day}
          </button>
        ))}
      </nav>

      {SCHEDULE_DAYS.map((d, di) => (
        <div key={d.day} style={{ display: activeDay === di ? 'block' : 'none' }}>
          <div className="pbanner">
            <span>○</span>
            <span>
              <strong>Cognitive peak: 11 AM - 1 PM.</strong> {d.peak}
            </span>
          </div>

          <div className="tl">
            {SCHEDULE_BLOCKS.map((b, bi) => {
              const isOpen = openRows.has(bi)
              const isLast = bi === SCHEDULE_BLOCKS.length - 1
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
                          <span className={`twhy ${b.why}`}>{b.whyTxt}</span>
                        </div>
                        {isOpen && <div className="tdet">{b.desc}</div>}
                      </div>
                    </div>
                  </div>
                  {b.bridge && (
                    <div className="dbridge">{b.bridge}</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
