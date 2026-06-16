/**
 * Unit tests for src/lib/recipeImport.ts
 * Tests the client-side helpers: preparePayload, readAsText, readAsBase64,
 * and importRecipeFromFile (with fetch mocked).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  preparePayload,
  readAsText,
  readAsBase64,
  importRecipeFromFile,
  importRecipeFromUrl,
  importRecipeFromText,
  ACCEPTED_EXT,
  ACCEPTED_MIME,
  type ExtractedRecipe,
} from '../lib/recipeImport'

// ── FileReader stub ───────────────────────────────────────────────
//
// jsdom's FileReader does not implement readAsText/readAsDataURL
// so we provide a minimal stub that calls onload synchronously.

class FakeFileReader {
  result: string | ArrayBuffer | null = null
  onload:  ((e: ProgressEvent) => void) | null = null
  onerror: ((e: ProgressEvent) => void) | null = null

  readAsText(file: File) {
    // Return file name as text for simple identification in tests
    this.result = (file as unknown as { _fakeText?: string })._fakeText ?? file.name
    this.onload?.({} as ProgressEvent)
  }

  readAsDataURL(file: File) {
    const mime = file.type || 'application/octet-stream'
    this.result = `data:${mime};base64,FAKEB64==`
    this.onload?.({} as ProgressEvent)
  }

  // Not needed for these tests, but present for completeness
  readAsArrayBuffer(_file: File) {
    this.result = new ArrayBuffer(0)
    this.onload?.({} as ProgressEvent)
  }
}

beforeEach(() => {
  vi.stubGlobal('FileReader', FakeFileReader)
  vi.stubGlobal('fetch', vi.fn())
})

// ── Helpers ───────────────────────────────────────────────────────

function makeFile(name: string, type: string, fakeText?: string): File {
  const f = new File([''], name, { type })
  if (fakeText) Object.assign(f, { _fakeText: fakeText })
  return f
}

const EXTRACTED: ExtractedRecipe = {
  name: 'Avocado Toast', cat: 'breakfast', tag: 'Quick', prepTime: '10 min',
  ings: [['Avocado', '1'], ['Bread', '2 slices']],
  steps: ['Mash avocado', 'Toast bread'],
  tip: 'Add chilli flakes', kcal: 320, protein: '8g', carbs: '30g', fat: '18g',
  dietTag: 'vegetarian',
}

// ═════════════════════════════════════════════════════════════════
// ACCEPTED_EXT / ACCEPTED_MIME exports
// ═════════════════════════════════════════════════════════════════

describe('exports', () => {
  it('ACCEPTED_EXT includes pdf, txt, jpg, png, webp', () => {
    expect(ACCEPTED_EXT).toContain('.pdf')
    expect(ACCEPTED_EXT).toContain('.txt')
    expect(ACCEPTED_EXT).toContain('.jpg')
    expect(ACCEPTED_EXT).toContain('.png')
    expect(ACCEPTED_EXT).toContain('.webp')
  })

  it('ACCEPTED_MIME includes image/jpeg', () => {
    expect(ACCEPTED_MIME).toContain('image/jpeg')
  })
})

// ═════════════════════════════════════════════════════════════════
// readAsText
// ═════════════════════════════════════════════════════════════════

describe('readAsText', () => {
  it('resolves with the file text content', async () => {
    const file = makeFile('recipe.txt', 'text/plain', 'my recipe text')
    const text = await readAsText(file)
    expect(text).toBe('my recipe text')
  })
})

// ═════════════════════════════════════════════════════════════════
// readAsBase64
// ═════════════════════════════════════════════════════════════════

describe('readAsBase64', () => {
  it('resolves with raw base64 (data URL prefix stripped)', async () => {
    const file = makeFile('photo.jpg', 'image/jpeg')
    const b64 = await readAsBase64(file)
    expect(b64).toBe('FAKEB64==')
    expect(b64).not.toContain('data:')
    expect(b64).not.toContain(';base64,')
  })
})

// ═════════════════════════════════════════════════════════════════
// preparePayload
// ═════════════════════════════════════════════════════════════════

describe('preparePayload', () => {
  it('returns type "text" for .txt files', async () => {
    const file = makeFile('recipe.txt', 'text/plain', 'Step 1: mix')
    const payload = await preparePayload(file)
    expect(payload.type).toBe('text')
    expect((payload as { content: string }).content).toContain('Step 1: mix')
  })

  it('returns type "image" with correct mimeType for .png files', async () => {
    const file = makeFile('photo.png', 'image/png')
    const payload = await preparePayload(file)
    expect(payload.type).toBe('image')
    expect((payload as { mimeType: string }).mimeType).toBe('image/png')
  })

  it('returns type "image" for .jpg files', async () => {
    const file = makeFile('photo.jpg', 'image/jpeg')
    const payload = await preparePayload(file)
    expect(payload.type).toBe('image')
    expect((payload as { mimeType: string }).mimeType).toBe('image/jpeg')
  })

  it('returns type "image" for .webp files', async () => {
    const file = makeFile('photo.webp', 'image/webp')
    const payload = await preparePayload(file)
    expect(payload.type).toBe('image')
    expect((payload as { mimeType: string }).mimeType).toBe('image/webp')
  })

  it('returns type "pdf" with base64 content for .pdf files', async () => {
    const file = makeFile('recipe.pdf', 'application/pdf', '%PDF-1.4 fake')
    const payload = await preparePayload(file)
    expect(payload.type).toBe('pdf')
    expect((payload as { content: string }).content.length).toBeGreaterThan(0)
  })

  it('truncates text content to MAX_TEXT_CHARS (40 000 chars)', async () => {
    const longText = 'x'.repeat(60_000)
    const file = makeFile('big.txt', 'text/plain', longText)
    const payload = await preparePayload(file)
    expect((payload as { content: string }).content.length).toBeLessThanOrEqual(40_000)
  })

  it('guesses mime from extension when file.type is empty', async () => {
    const file = makeFile('recipe.txt', '') // no type
    const payload = await preparePayload(file)
    expect(payload.type).toBe('text')
  })

  it('throws for unsupported file types', async () => {
    const file = makeFile('doc.docx', 'application/vnd.openxmlformats')
    await expect(preparePayload(file)).rejects.toThrow(/unsupported file type/i)
  })
})

// ═════════════════════════════════════════════════════════════════
// importRecipeFromFile
// ═════════════════════════════════════════════════════════════════

describe('importRecipeFromFile', () => {
  const TOKEN = 'fake-access-token'
  const URL   = 'https://xyz.supabase.co'

  it('returns ExtractedRecipe on a 200 response', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'Avocado Toast recipe')
    const result = await importRecipeFromFile(file, TOKEN, URL)
    expect(result.name).toBe('Avocado Toast')
    expect(result.cat).toBe('breakfast')
    expect(result.ings).toHaveLength(2)
    expect(result.dietTag).toBe('vegetarian')
  })

  it('sends Authorization header with the access token', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'test')
    await importRecipeFromFile(file, TOKEN, URL)
    const [_, init] = vi.mocked(fetch).mock.calls[0]
    expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${TOKEN}` })
  })

  it('throws with server error message on 422', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Could not parse recipe' }), { status: 422 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'garbage')
    await expect(importRecipeFromFile(file, TOKEN, URL)).rejects.toThrow('Could not parse recipe')
  })

  it('throws generic message when error body is not JSON', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('Internal Server Error', { status: 500 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'test')
    await expect(importRecipeFromFile(file, TOKEN, URL)).rejects.toThrow(/500/)
  })

  it('throws when response has no recipe field', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ something: 'else' }), { status: 200 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'test')
    await expect(importRecipeFromFile(file, TOKEN, URL)).rejects.toThrow(/invalid response/i)
  })

  it('posts to the correct edge function URL', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    const file = makeFile('recipe.txt', 'text/plain', 'test')
    await importRecipeFromFile(file, TOKEN, URL)
    const [url] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${URL}/functions/v1/recipe-import`)
  })
})

// ═════════════════════════════════════════════════════════════════
// importRecipeFromUrl
// ═════════════════════════════════════════════════════════════════

describe('importRecipeFromUrl', () => {
  const TOKEN = 'fake-access-token'
  const URL   = 'https://xyz.supabase.co'

  it('sends a url payload to the edge function', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    const result = await importRecipeFromUrl('https://example.com/recipe', TOKEN, URL)
    expect(result.name).toBe('Avocado Toast')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${URL}/functions/v1/recipe-import`)
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      type: 'url', content: 'https://example.com/recipe',
    })
  })

  it('trims surrounding whitespace from the URL', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    await importRecipeFromUrl('  https://example.com/recipe  ', TOKEN, URL)
    const [, init] = vi.mocked(fetch).mock.calls[0]
    expect(JSON.parse((init as RequestInit).body as string).content).toBe('https://example.com/recipe')
  })

  it('rejects non-http(s) input without calling fetch', async () => {
    await expect(importRecipeFromUrl('ftp://example.com', TOKEN, URL)).rejects.toThrow(/valid http/i)
    await expect(importRecipeFromUrl('not a url', TOKEN, URL)).rejects.toThrow(/valid http/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('propagates server error messages', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'No readable content found at that URL' }), { status: 422 })
    )
    await expect(importRecipeFromUrl('https://example.com', TOKEN, URL))
      .rejects.toThrow('No readable content found at that URL')
  })
})

// ═════════════════════════════════════════════════════════════════
// importRecipeFromText
// ═════════════════════════════════════════════════════════════════

describe('importRecipeFromText', () => {
  const TOKEN = 'fake-access-token'
  const URL   = 'https://xyz.supabase.co'

  it('sends a trimmed text payload to the edge function', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ recipe: EXTRACTED }), { status: 200 })
    )
    const result = await importRecipeFromText('  Avocado Toast\nMash, toast  ', TOKEN, URL)
    expect(result.name).toBe('Avocado Toast')
    const [url, init] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe(`${URL}/functions/v1/recipe-import`)
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.type).toBe('text')
    expect(body.content).toBe('Avocado Toast\nMash, toast')
  })

  it('rejects empty text without calling fetch', async () => {
    await expect(importRecipeFromText('   ', TOKEN, URL)).rejects.toThrow(/paste some recipe text/i)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('propagates server error messages', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Could not parse recipe from response' }), { status: 422 })
    )
    await expect(importRecipeFromText('garbage', TOKEN, URL))
      .rejects.toThrow('Could not parse recipe from response')
  })
})
