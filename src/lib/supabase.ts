import { createClient } from '@supabase/supabase-js'
import type { SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL  as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * Supabase client — null when env vars are not set (dev without .env.local,
 * unit test environment). All call sites guard with `if (!supabase) return`.
 */
export const supabase: SupabaseClient | null =
  url && key ? createClient(url, key) : null

export const isConfigured = !!(url && key)
