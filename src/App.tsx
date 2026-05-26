import { useState } from 'react'
import ScheduleTab from './components/ScheduleTab'
import WorkoutsTab from './components/WorkoutsTab'
import RecipesTab from './components/RecipesTab'
import TrackerTab from './components/TrackerTab'

type Tab = 'schedule' | 'workouts' | 'recipes' | 'tracker'

const TABS: { id: Tab; label: string }[] = [
  { id: 'schedule', label: '📅 Schedule' },
  { id: 'workouts', label: '💪 Workouts' },
  { id: 'recipes',  label: '🍽 Recipes' },
  { id: 'tracker',  label: '📊 Tracker' },
]

export default function App() {
  const [active, setActive] = useState<Tab>('schedule')

  return (
    <>
      <header className="hdr">
        <div className="htitle">My <em>Wellness Hub</em></div>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab${active === t.id ? ' active' : ''}`}
              onClick={() => setActive(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <div className={`view${active === 'schedule' ? ' active' : ''}`}>
        <ScheduleTab />
      </div>
      <div className={`view${active === 'workouts' ? ' active' : ''}`}>
        <WorkoutsTab />
      </div>
      <div className={`view${active === 'recipes' ? ' active' : ''}`}>
        <RecipesTab />
      </div>
      <div className={`view${active === 'tracker' ? ' active' : ''}`}>
        {active === 'tracker' && <TrackerTab />}
      </div>
    </>
  )
}
