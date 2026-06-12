import { describe, it, expect, vi, beforeEach } from 'vitest'
import { parseNutritionLabel } from '../lib/analyzeFood'

// ── parseNutritionLabel ───────────────────────────────────────────

describe('parseNutritionLabel', () => {
  it('extracts all five macros from a clean label', () => {
    const text = `
Nutrition Facts
Serving Size 1 cup (240g)
Amount Per Serving
Calories 250
Total Fat 9g
Total Carbohydrate 30g
Dietary Fiber 4g
Protein 12g
`
    const result = parseNutritionLabel(text)
    expect(result.kcal).toBe(250)
    expect(result.fat).toBe(9)
    expect(result.carbs).toBe(30)
    expect(result.fiber).toBe(4)
    expect(result.protein).toBe(12)
    expect(result.servings).toBe(1)
  })

  it('returns high confidence when 3+ macros found', () => {
    const text = 'Calories 300\nTotal Fat 10g\nTotal Carbohydrate 40g\nProtein 15g'
    expect(parseNutritionLabel(text).confidence).toBe('high')
  })

  it('returns medium confidence when 2 macros found', () => {
    const text = 'Calories 300\nTotal Fat 10g'
    expect(parseNutritionLabel(text).confidence).toBe('medium')
  })

  it('returns low confidence when fewer than 2 macros found', () => {
    const text = 'Some random text without nutrition info'
    expect(parseNutritionLabel(text).confidence).toBe('low')
  })

  it('returns zero for macros not present in text', () => {
    const text = 'Calories 200\nTotal Fat 5g'
    const result = parseNutritionLabel(text)
    expect(result.carbs).toBe(0)
    expect(result.fiber).toBe(0)
    expect(result.protein).toBe(0)
  })

  it('handles decimal values in macros', () => {
    const text = 'Calories 150\nTotal Fat 3.5g\nTotal Carbohydrate 22.7g\nProtein 8.2g'
    const result = parseNutritionLabel(text)
    expect(result.fat).toBe(4)     // Math.round(3.5)
    expect(result.carbs).toBe(23)  // Math.round(22.7)
    expect(result.protein).toBe(8) // Math.round(8.2)
  })

  it('always sets servings to 1', () => {
    const text = 'Calories 100\nTotal Fat 2g\nTotal Carbohydrate 10g\nProtein 5g'
    expect(parseNutritionLabel(text).servings).toBe(1)
  })

  it('includes label-specific notes', () => {
    const text = 'Calories 100\nTotal Fat 2g\nTotal Carbohydrate 10g\nProtein 5g'
    expect(parseNutritionLabel(text).notes).toContain('label')
  })
})

// ── analyzeImage routing ──────────────────────────────────────────

vi.mock('tesseract.js', () => ({
  default: {
    recognize: vi.fn(),
  },
}))

vi.mock('../lib/supabase', () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}))

import Tesseract from 'tesseract.js'
import { supabase } from '../lib/supabase'
import { analyzeImage } from '../lib/analyzeFood'

// Also mock resizeImage and isNutritionLabel internals by controlling Tesseract output
const mockRecognize = vi.mocked(Tesseract.recognize)
const mockInvoke    = vi.mocked((supabase as NonNullable<typeof supabase>).functions.invoke)

// Stub URL.createObjectURL / revokeObjectURL for jsdom
beforeEach(() => {
  vi.clearAllMocks()
  // Default: invoke resolves to empty (fire-and-forget calls won't throw)
  mockInvoke.mockResolvedValue({ data: null, error: null } as never)
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:mock')
  globalThis.URL.revokeObjectURL = vi.fn()

  // Stub canvas so resizeImage returns a minimal data URL
  const mockCanvas = {
    width: 0, height: 0,
    getContext: () => ({ drawImage: vi.fn() }),
    toDataURL: () => 'data:image/jpeg;base64,/9j/AAAA',
  }
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement
    return document.createElement(tag)
  })

  // Stub Image
  class MockImage {
    onload?: () => void
    onerror?: () => void
    width = 100; height = 100
    set src(_: string) { setTimeout(() => this.onload?.(), 0) }
  }
  vi.stubGlobal('Image', MockImage)
})

describe('analyzeImage — label path', () => {
  it('runs a single OCR pass and skips the Edge Function for analysis', async () => {
    const labelText = 'Nutrition Facts\nCalories 250\nTotal Fat 9g\nTotal Carbohydrate 30g\nProtein 12g\nDietary Fiber 4g'
    mockRecognize.mockResolvedValueOnce({ data: { text: labelText } } as never)

    const statusMessages: string[] = []
    const result = await analyzeImage(new File([''], 'label.jpg', { type: 'image/jpeg' }), m => statusMessages.push(m))

    expect(statusMessages).toContain('Detecting…')
    expect(statusMessages).toContain('Reading label…')
    expect(result.kcal).toBe(250)
    expect(result.protein).toBe(12)
    expect(mockRecognize).toHaveBeenCalledTimes(1)
    // Edge Function should only be called for logging (fire-and-forget), not for analysis
    expect(mockInvoke).toHaveBeenCalledWith('analyze-food-photo', expect.objectContaining({ body: expect.objectContaining({ mode: 'label' }) }))
  })
})

describe('analyzeImage — food photo path', () => {
  it('calls Edge Function with mode photo when no label keywords detected', async () => {
    // Thumbnail scan finds no label keywords
    mockRecognize.mockResolvedValueOnce({ data: { text: 'some random words no nutrition here' } } as never)

    const mockResult = {
      name: 'Pizza', kcal: 266, protein: 11, carbs: 33, fat: 10, fiber: 2,
      servings: 1, confidence: 'high', notes: 'Serving size defaulted to 200 g',
    }
    mockInvoke.mockResolvedValueOnce({ data: mockResult, error: null } as never)

    const statusMessages: string[] = []
    const result = await analyzeImage(new File([''], 'pizza.jpg', { type: 'image/jpeg' }), m => statusMessages.push(m))

    expect(statusMessages).toContain('Identifying food…')
    expect(mockInvoke).toHaveBeenCalledWith('analyze-food-photo', expect.objectContaining({
      body: expect.objectContaining({ mode: 'photo' }),
    }))
    expect(result.name).toBe('Pizza')
    expect(result.kcal).toBe(266)
  })

  it('throws when Edge Function returns an error', async () => {
    mockRecognize.mockResolvedValueOnce({ data: { text: '' } } as never)
    mockInvoke.mockResolvedValueOnce({ data: null, error: new Error('500') } as never)

    await expect(
      analyzeImage(new File([''], 'photo.jpg', { type: 'image/jpeg' }), () => {})
    ).rejects.toThrow('Food analysis failed')
  })
})
