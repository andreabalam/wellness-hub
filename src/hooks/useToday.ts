import { useEffect, useState } from 'react'
import { dkey } from '../lib/dateKey'

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function msUntilNextDay(): number {
  const next = startOfToday()
  next.setDate(next.getDate() + 1)
  return next.getTime() - Date.now()
}

/**
 * Local midnight of the current day, kept current while the app stays open.
 *
 * A PWA on a phone resumes from memory for days without a reload, so a date
 * captured once at mount goes stale (yesterday's cycle phase, plan day, etc.).
 * This re-checks at midnight and whenever the app comes back to the
 * foreground. The returned Date keeps its identity until the day changes, so
 * it's safe in effect dependencies.
 */
export function useToday(): Date {
  const [today, setToday] = useState(startOfToday)

  useEffect(() => {
    const check = () => setToday(prev => (dkey(prev) === dkey(new Date()) ? prev : startOfToday()))
    let timer: ReturnType<typeof setTimeout>
    const schedule = () => {
      // +1 s so the timer lands safely after midnight, even with clock drift
      timer = setTimeout(() => {
        check()
        schedule()
      }, msUntilNextDay() + 1000)
    }
    schedule()
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', check)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', check)
    }
  }, [])

  return today
}

/**
 * Keep a "viewed day" state on today when the day rolls over: if the user was
 * looking at the old today, move them to the new one; a deliberately chosen
 * past day is left alone. Call during render with the setter.
 */
export function useFollowToday(today: Date, viewed: Date, setViewed: (d: Date) => void) {
  const [prev, setPrev] = useState(today)
  if (dkey(prev) !== dkey(today)) {
    setPrev(today)
    if (dkey(viewed) === dkey(prev)) setViewed(today)
  }
}
