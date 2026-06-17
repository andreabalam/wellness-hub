import Tesseract from 'tesseract.js'
import { supabase } from './supabase'

export interface PhotoAnalysisResult {
  name: string
  kcal: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  servings: number
  confidence: 'high' | 'medium' | 'low'
  notes: string
}

// Keywords present in standard US Nutrition Facts panels
const LABEL_KEYWORDS = [
  'calories',
  'total fat',
  'serving size',
  'total carbohydrate',
  'dietary fiber',
  'nutrition facts',
  'amount per serving',
]

// ── Image utilities ───────────────────────────────────────────────

export function resizeImage(file: File | Blob, maxPx: number, quality = 0.8): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = reject
    img.src = url
  })
}

function dataURLtoBlob(dataUrl: string): Blob {
  const [header, data] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
  const bytes = atob(data)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

// ── Label detection ───────────────────────────────────────────────

function looksLikeLabel(ocrText: string): boolean {
  const lower = ocrText.toLowerCase()
  return LABEL_KEYWORDS.filter(kw => lower.includes(kw)).length >= 2
}

// ── Nutrition label parser ────────────────────────────────────────

export function parseNutritionLabel(text: string): PhotoAnalysisResult {
  const t = text.toLowerCase()

  const kcal = parseInt(t.match(/calories[^\d]*(\d+)/)?.[1] ?? '0')
  const fat = parseFloat(t.match(/total fat[^\d]*(\d+(?:\.\d+)?)/)?.[1] ?? '0')
  const carbs = parseFloat(t.match(/total carbohydrate[^\d]*(\d+(?:\.\d+)?)/)?.[1] ?? '0')
  const fiber = parseFloat(t.match(/dietary fiber[^\d]*(\d+(?:\.\d+)?)/)?.[1] ?? '0')
  // Match "Protein" not preceded by another nutrient line — keep it simple
  const protein = parseFloat(t.match(/\bprotein[^\d]*(\d+(?:\.\d+)?)/)?.[1] ?? '0')

  const found = [kcal, fat, carbs, protein].filter(v => v > 0).length
  const confidence: 'high' | 'medium' | 'low' = found >= 3 ? 'high' : found >= 2 ? 'medium' : 'low'

  // Best-effort name: first all-caps line before "Nutrition Facts"
  const nameMatch = text.match(/^([A-Z][A-Za-z0-9 &,'-]+)\r?\n/m)
  const name = nameMatch?.[1]?.trim() ?? 'Packaged food'

  return {
    name,
    kcal,
    protein: Math.round(protein),
    carbs: Math.round(carbs),
    fat: Math.round(fat),
    fiber: Math.round(fiber),
    servings: 1,
    confidence,
    notes: 'Values read from nutrition label — adjust servings if you ate a different amount.',
  }
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// ── Main entry point ──────────────────────────────────────────────

export async function analyzeImage(
  file: File,
  onStatus: (msg: string) => void,
): Promise<PhotoAnalysisResult> {
  onStatus('Detecting…')

  // Resize once — large enough for OCR to read label text, small enough to
  // upload. Canvas can fail on formats the browser can't decode (e.g. HEIC in
  // Chromium); fall back to the raw file for OCR and FileReader for upload.
  const resized: string | null = await resizeImage(file, 900).catch(() => null)

  // Single OCR pass, shared by label detection and label parsing
  let ocrText = ''
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(resized ? dataURLtoBlob(resized) : file, 'eng')
    ocrText = text
  } catch (err) {
    console.error('[analyzeFood] OCR failed — treating as food photo:', err)
  }

  if (looksLikeLabel(ocrText)) {
    onStatus('Reading label…')
    const result = parseNutritionLabel(ocrText)

    // Log to Edge Function — fire-and-forget; no image is sent
    supabase?.functions
      .invoke('analyze-food-photo', {
        body: { mode: 'label', result },
      })
      .catch(() => {})

    return result
  }

  onStatus('Identifying food…')
  if (!supabase) throw new Error('Supabase not configured — cannot analyze food photos.')

  const base64 = resized ?? (await fileToDataURL(file))
  // The fallback path keeps the original format — tell the API what it really is
  const mimeType = base64.match(/^data:([^;,]+)/)?.[1] ?? 'image/jpeg'

  const { data, error } = await supabase.functions.invoke('analyze-food-photo', {
    body: { mode: 'photo', image: base64, mimeType },
  })

  if (error) {
    // FunctionsHttpError carries the Response in .context — surface the server's reason
    let detail = ''
    try {
      const ctx = (error as { context?: Response }).context
      detail = ((await ctx?.json()) as { error?: string } | undefined)?.error ?? ''
    } catch {
      /* no JSON body */
    }
    console.error('[analyzeFood] analyze-food-photo failed:', error, detail)
    throw new Error(
      detail
        ? `Food analysis failed: ${detail}`
        : 'Food analysis failed — please fill in manually.',
    )
  }
  return data as PhotoAnalysisResult
}
