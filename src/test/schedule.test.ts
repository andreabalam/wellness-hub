import { describe, it, expect } from 'vitest'
import {
  SCHEDULE_BLOCKS, BLOCK_COLORS,
  colorDef, customToScheduleBlock, defaultToCustomBlock,
} from '../data/schedule'
import type { CustomBlock } from '../data/schedule'

// ── SCHEDULE_BLOCKS ──────────────────────────────────────────────

describe('SCHEDULE_BLOCKS', () => {
  it('has 15 blocks', () => {
    expect(SCHEDULE_BLOCKS).toHaveLength(15)
  })

  it('every block has a time, title, dur, dot, why, desc', () => {
    SCHEDULE_BLOCKS.forEach(b => {
      expect(b.time).toMatch(/^\d{1,2}:\d{2}( [AP]M)?$/)
      expect(b.title).toBeTruthy()
      expect(b.dur).toBeTruthy()
      expect(b.dot).toBeTruthy()
      expect(b.why).toBeTruthy()
      expect(b.desc.length).toBeGreaterThan(20)
    })
  })

  it('dot classes are valid CSS class names', () => {
    const validDots = ['cg', 'ca', 'cc', 'cp', 'ct', 'cb', 'cgr', 'cgo']
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

// ── BLOCK_COLORS ─────────────────────────────────────────────────

describe('BLOCK_COLORS', () => {
  it('has 6 color entries', () => {
    expect(BLOCK_COLORS).toHaveLength(6)
  })

  it('every color has key, label, dot, why, hex', () => {
    BLOCK_COLORS.forEach(c => {
      expect(c.key).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.dot).toMatch(/^c/)
      expect(c.why).toMatch(/^w/)
      expect(c.hex).toMatch(/^#[0-9a-f]{6}$/i)
    })
  })

  it('includes green, teal, amber, gold, purple, gray', () => {
    const keys = BLOCK_COLORS.map(c => c.key)
    expect(keys).toContain('green')
    expect(keys).toContain('teal')
    expect(keys).toContain('amber')
    expect(keys).toContain('gold')
    expect(keys).toContain('purple')
    expect(keys).toContain('gray')
  })
})

// ── colorDef ─────────────────────────────────────────────────────

describe('colorDef', () => {
  it('returns correct def for "green"', () => {
    const c = colorDef('green')
    expect(c.key).toBe('green')
    expect(c.dot).toBe('cg')
    expect(c.why).toBe('wg')
  })

  it('returns correct def for "teal"', () => {
    const c = colorDef('teal')
    expect(c.key).toBe('teal')
    expect(c.dot).toBe('ct')
    expect(c.why).toBe('wt')
  })

  it('returns correct def for "amber"', () => {
    expect(colorDef('amber').dot).toBe('ca')
  })

  it('returns correct def for "gold"', () => {
    expect(colorDef('gold').dot).toBe('cgo')
  })

  it('returns correct def for "purple"', () => {
    expect(colorDef('purple').dot).toBe('cp')
  })

  it('returns correct def for "gray"', () => {
    expect(colorDef('gray').dot).toBe('cgr')
  })

  it('falls back to first color (green) for unknown key', () => {
    const c = colorDef('unknown-xyz')
    expect(c).toBe(BLOCK_COLORS[0])
    expect(c.key).toBe('green')
  })
})

// ── customToScheduleBlock ────────────────────────────────────────

const SAMPLE_CUSTOM: CustomBlock = {
  id: 'test-1',
  time: '09:00',
  title: 'Deep Work',
  dur: '90 min',
  color: 'teal',
  whyTxt: 'focus',
  desc: 'Focus session',
  phase: 'Morning',
}

describe('customToScheduleBlock', () => {
  it('preserves time, title, desc, whyTxt', () => {
    const sb = customToScheduleBlock(SAMPLE_CUSTOM)
    expect(sb.time).toBe('09:00')
    expect(sb.title).toBe('Deep Work')
    expect(sb.desc).toBe('Focus session')
    expect(sb.whyTxt).toBe('focus')
  })

  it('maps non-empty phase string', () => {
    expect(customToScheduleBlock(SAMPLE_CUSTOM).phase).toBe('Morning')
  })

  it('maps empty phase to null', () => {
    expect(customToScheduleBlock({ ...SAMPLE_CUSTOM, phase: '' }).phase).toBeNull()
  })

  it('maps color key to correct dot and why CSS classes', () => {
    const sb = customToScheduleBlock(SAMPLE_CUSTOM)
    expect(sb.dot).toBe('ct')
    expect(sb.why).toBe('wt')
  })

  it('maps green color correctly', () => {
    const sb = customToScheduleBlock({ ...SAMPLE_CUSTOM, color: 'green' })
    expect(sb.dot).toBe('cg')
    expect(sb.why).toBe('wg')
  })

  it('maps unknown color key to green fallback', () => {
    const sb = customToScheduleBlock({ ...SAMPLE_CUSTOM, color: 'nope' })
    expect(sb.dot).toBe('cg')
  })

  it('sets bridge to null', () => {
    expect(customToScheduleBlock(SAMPLE_CUSTOM).bridge).toBeNull()
  })

  it('replaces empty dur with "—"', () => {
    expect(customToScheduleBlock({ ...SAMPLE_CUSTOM, dur: '' }).dur).toBe('—')
  })

  it('passes through non-empty dur unchanged', () => {
    expect(customToScheduleBlock(SAMPLE_CUSTOM).dur).toBe('90 min')
  })

  it('propagates id to the ScheduleBlock', () => {
    expect(customToScheduleBlock(SAMPLE_CUSTOM).id).toBe('test-1')
  })
})

// ── defaultToCustomBlock ─────────────────────────────────────────

describe('defaultToCustomBlock', () => {
  it('preserves title, whyTxt, desc', () => {
    const sb = SCHEDULE_BLOCKS[0]
    const cb = defaultToCustomBlock(sb, 0)
    expect(cb.title).toBe(sb.title)
    expect(cb.whyTxt).toBe(sb.whyTxt)
    expect(cb.desc).toBe(sb.desc)
  })

  it('pads single-digit hour to HH:MM', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], time: '8:00' }, 0)
    expect(cb.time).toBe('08:00')
  })

  it('leaves already-padded time unchanged', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], time: '11:00' }, 0)
    expect(cb.time).toBe('11:00')
  })

  it('converts "—" dur to empty string', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dur: '—' }, 0)
    expect(cb.dur).toBe('')
  })

  it('passes through non-dash dur unchanged', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dur: '30 min' }, 0)
    expect(cb.dur).toBe('30 min')
  })

  it('converts dot class "ct" to color key "teal"', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'ct' }, 0)
    expect(cb.color).toBe('teal')
  })

  it('converts dot class "ca" to color key "amber"', () => {
    expect(defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'ca' }, 0).color).toBe('amber')
  })

  it('converts dot class "cgo" to color key "gold"', () => {
    expect(defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'cgo' }, 0).color).toBe('gold')
  })

  it('converts dot class "cp" to color key "purple"', () => {
    expect(defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'cp' }, 0).color).toBe('purple')
  })

  it('converts dot class "cgr" to color key "gray"', () => {
    expect(defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'cgr' }, 0).color).toBe('gray')
  })

  it('converts dot class "cg" to color key "green"', () => {
    expect(defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], dot: 'cg' }, 0).color).toBe('green')
  })

  it('converts null phase to empty string', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], phase: null }, 0)
    expect(cb.phase).toBe('')
  })

  it('preserves non-null phase string', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], phase: 'Ramp-up' }, 0)
    expect(cb.phase).toBe('Ramp-up')
  })

  it('uses existing block id when present', () => {
    const sb = { ...SCHEDULE_BLOCKS[0], id: 'my-id' }
    const cb = defaultToCustomBlock(sb, 3)
    expect(cb.id).toBe('my-id')
  })

  it('generates fallback id "default-{idx}" when block has no id', () => {
    const { id: _, ...noId } = SCHEDULE_BLOCKS[0]
    const cb = defaultToCustomBlock(noId as typeof SCHEDULE_BLOCKS[0], 7)
    expect(cb.id).toBe('default-7')
  })

  it('falls back to 09:00 for time without colon', () => {
    const cb = defaultToCustomBlock({ ...SCHEDULE_BLOCKS[0], time: 'invalid' }, 0)
    expect(cb.time).toBe('09:00')
  })
})
