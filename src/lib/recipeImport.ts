/**
 * Client-side helpers for importing a recipe from a PDF, image, or text file.
 * File content is read in-browser, then sent to the recipe-import Edge Function
 * which calls Claude to extract structured recipe data.
 */

export interface ExtractedRecipe {
  name: string
  cat: string
  tag: string
  prepTime: string
  ings: [string, string][]
  steps: string[]
  tip: string
  kcal?: number | null
  protein?: string | null
  carbs?: string | null
  fat?: string | null
  fiber?: string | null
  healthTag?: 'healthy' | 'indulgent' | null | string
  dietTag?: string | null
  link?: string
}

export const ACCEPTED_EXT = '.pdf,.txt,.jpg,.jpeg,.png,.webp'
export const ACCEPTED_MIME = 'application/pdf,text/plain,image/jpeg,image/png,image/webp'

// Characters sent for text content (keeps Claude context small and latency low)
const MAX_TEXT_CHARS = 40_000

type Payload =
  | { type: 'text'; content: string }
  | { type: 'image'; content: string; mimeType: string }
  | { type: 'pdf'; content: string }
  | { type: 'url'; content: string }

// ── Public API ────────────────────────────────────────────────────

/**
 * Read a File and convert it to the payload shape expected by the edge function.
 * - .txt  → plain text
 * - .pdf  → base64-encoded bytes; Claude reads the PDF natively server-side
 * - image → base64-encoded bytes (data URL prefix stripped)
 *
 * PDFs are sent as-is rather than parsed in-browser: client-side PDF text
 * extraction (pdfjs-dist) crashes on mobile Safari, and Claude's native PDF
 * support reads layout and scanned pages better than naive text extraction.
 */
export async function preparePayload(file: File): Promise<Payload> {
  const mime = file.type || guessMime(file.name)

  if (mime === 'application/pdf') {
    const base64 = await readAsBase64(file)
    return { type: 'pdf', content: base64 }
  }

  if (mime === 'text/plain') {
    const text = await readAsText(file)
    return { type: 'text', content: text.slice(0, MAX_TEXT_CHARS) }
  }

  if (mime.startsWith('image/')) {
    const base64 = await readAsBase64(file)
    return { type: 'image', content: base64, mimeType: mime }
  }

  throw new Error(`Unsupported file type: ${file.name}. Please use PDF, TXT, JPG, PNG, or WebP.`)
}

/**
 * Full import flow: read file → call edge function → return ExtractedRecipe.
 * Throws on network errors, bad file types, or when the AI cannot parse the content.
 */
export async function importRecipeFromFile(
  file: File,
  accessToken: string,
  supabaseUrl: string,
): Promise<ExtractedRecipe> {
  const payload = await preparePayload(file)
  return postImport(payload, accessToken, supabaseUrl)
}

/**
 * Import a recipe from pasted plain text. The text is sent straight to the
 * edge function's text path — the same one used for .txt files — and parsed
 * by Claude into a structured recipe.
 */
export async function importRecipeFromText(
  text: string,
  accessToken: string,
  supabaseUrl: string,
): Promise<ExtractedRecipe> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Paste some recipe text first.')
  return postImport(
    { type: 'text', content: trimmed.slice(0, MAX_TEXT_CHARS) },
    accessToken,
    supabaseUrl,
  )
}

/**
 * Import a recipe from a web page URL. The page is fetched and parsed
 * server-side by the edge function (browsers can't fetch most recipe sites
 * directly because of CORS).
 */
export async function importRecipeFromUrl(
  url: string,
  accessToken: string,
  supabaseUrl: string,
): Promise<ExtractedRecipe> {
  const trimmed = url.trim()
  if (!/^https?:\/\/.+/i.test(trimmed)) {
    throw new Error('Enter a valid http(s) URL.')
  }
  return postImport({ type: 'url', content: trimmed }, accessToken, supabaseUrl)
}

/** POST a prepared payload to the recipe-import edge function. */
async function postImport(
  payload: Payload,
  accessToken: string,
  supabaseUrl: string,
): Promise<ExtractedRecipe> {
  const res = await fetch(`${supabaseUrl}/functions/v1/recipe-import`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Import failed (${res.status})`)
  }

  const data = (await res.json()) as { recipe?: ExtractedRecipe }
  if (!data.recipe) throw new Error('Invalid response from import service')
  return data.recipe
}

// ── File reading helpers ──────────────────────────────────────────

export function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

export function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const base64 = dataUrl.split(',')[1] ?? '' // strip "data:…;base64,"
      resolve(base64)
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

// ── Internal helpers ──────────────────────────────────────────────

function guessMime(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
  }
  return map[ext] ?? 'application/octet-stream'
}
