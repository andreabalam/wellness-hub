import { describe, it, expect } from 'vitest'
import { countsAsWorkout, weekStart, workoutWeekStats } from '../lib/workoutWeeks'
import { EMPTY_DAY } from '../data/tracker'
import type { DayData, WorkoutSession } from '../data/tracker'

const manual = (type = 'full-body'): WorkoutSession => ({
  id: `manual-${type}`,
  src: 'manual',
  type,
  min: 30,
})
const oura = (min: number): WorkoutSession => ({
  id: `oura-${min}`,
  src: 'oura',
  type: 'zone2',
  min,
})
const day = (...sessions: WorkoutSession[]): DayData => ({
  ...EMPTY_DAY,
  foods: [],
  wkSessions: sessions,
})

// Sunday 2026-10-25 → its week starts Monday 2026-10-19
const TODAY = new Date('2026-10-25T12:00:00')

describe('countsAsWorkout', () => {
  it('counts manual and real Oura workouts, not rest days or short auto-detections', () => {
    expect(countsAsWorkout(manual())).toBe(true)
    expect(countsAsWorkout(manual('rest'))).toBe(false)
    expect(countsAsWorkout(oura(25))).toBe(true)
    expect(countsAsWorkout(oura(6))).toBe(false)
  })
})

describe('weekStart', () => {
  it('returns the Monday of the week (Sunday belongs to the week before)', () => {
    expect(weekStart('2026-10-25')).toBe('2026-10-19')
    expect(weekStart('2026-10-19')).toBe('2026-10-19')
    expect(weekStart(TODAY)).toBe('2026-10-19')
    expect(weekStart('2027-01-01')).toBe('2026-12-28') // across a year boundary
  })
})

describe('workoutWeekStats', () => {
  it('is all zero with no history', () => {
    expect(workoutWeekStats({}, TODAY)).toEqual({
      totalWeeks: 0,
      currentStreak: 0,
      longestStreak: 0,
      thisWeek: 0,
      byWeek: {},
    })
  })

  it('counts this week and a streak running into it', () => {
    const s = workoutWeekStats(
      {
        '2026-10-20': day(manual(), oura(40)),
        '2026-10-22': day(oura(5)), // too short — ignored
        '2026-10-14': day(manual()),
        '2026-10-06': day(manual()),
      },
      TODAY,
    )
    expect(s.thisWeek).toBe(2)
    expect(s.currentStreak).toBe(3)
    expect(s.totalWeeks).toBe(3)
    expect(s.byWeek['2026-10-19']).toBe(2)
  })

  it('an empty current week does not break the streak yet', () => {
    const s = workoutWeekStats({ '2026-10-14': day(manual()), '2026-10-07': day(manual()) }, TODAY)
    expect(s.thisWeek).toBe(0)
    expect(s.currentStreak).toBe(2)
  })

  it('a missed full week resets the current streak but keeps the longest', () => {
    const s = workoutWeekStats(
      {
        '2026-10-20': day(manual()),
        // nothing in the week of Oct 12
        '2026-10-06': day(manual()),
        '2026-09-29': day(manual()),
        '2026-09-22': day(manual()),
      },
      TODAY,
    )
    expect(s.currentStreak).toBe(1)
    expect(s.longestStreak).toBe(3)
    expect(s.totalWeeks).toBe(4)
  })

  it('ignores weeks that only have rest days', () => {
    const s = workoutWeekStats({ '2026-10-20': day(manual('rest')) }, TODAY)
    expect(s.totalWeeks).toBe(0)
  })

  it('counts legacy single-slot workouts', () => {
    const legacy: DayData = { ...EMPTY_DAY, foods: [], workout: 'pilates' }
    expect(workoutWeekStats({ '2026-10-20': legacy }, TODAY).thisWeek).toBe(1)
  })
})
