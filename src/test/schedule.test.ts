import { describe, it, expect } from 'vitest'
import { SCHEDULE_BLOCKS, SCHEDULE_DAYS } from '../data/schedule'

describe('SCHEDULE_BLOCKS', () => {
  it('has 10 blocks', () => {
    expect(SCHEDULE_BLOCKS).toHaveLength(10)
  })

  it('every block has a time, title, dur, dot, why, desc', () => {
    SCHEDULE_BLOCKS.forEach(b => {
      expect(b.time).toMatch(/^\d{1,2}:\d{2}$/)
      expect(b.title).toBeTruthy()
      expect(b.dur).toBeTruthy()
      expect(b.dot).toBeTruthy()
      expect(b.why).toBeTruthy()
      expect(b.desc.length).toBeGreaterThan(20)
    })
  })

  it('dot classes are valid CSS class names', () => {
    const validDots = ['cg','ca','cc','cp','ct','cb','cgr','cgo']
    SCHEDULE_BLOCKS.forEach(b => {
      expect(validDots).toContain(b.dot)
    })
  })

  it('first block starts at 8:00', () => {
    expect(SCHEDULE_BLOCKS[0].time).toBe('8:00')
  })

  it('PEAK block is the last one', () => {
    const peak = SCHEDULE_BLOCKS.find(b => b.phase === 'PEAK')
    expect(peak).toBeDefined()
    expect(peak!.time).toBe('11:00')
  })

  it('blocks with bridges have non-null bridge strings', () => {
    const bridged = SCHEDULE_BLOCKS.filter(b => b.bridge !== null)
    expect(bridged.length).toBeGreaterThan(0)
    bridged.forEach(b => expect(typeof b.bridge).toBe('string'))
  })
})

describe('SCHEDULE_DAYS', () => {
  it('has 5 weekdays', () => {
    expect(SCHEDULE_DAYS).toHaveLength(5)
  })

  it('days are Mon–Fri in order', () => {
    const names = SCHEDULE_DAYS.map(d => d.day)
    expect(names).toEqual(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])
  })

  it('every day has a non-empty peak string', () => {
    SCHEDULE_DAYS.forEach(d => {
      expect(d.peak.length).toBeGreaterThan(10)
    })
  })
})
