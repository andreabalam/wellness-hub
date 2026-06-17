/**
 * Centralized error reporting.
 *
 * Two responsibilities:
 *  1. Persist a structured log to Supabase (`client_error_log`) for the project
 *     owner to review later — best-effort, never throws, never blocks the UI.
 *  2. Provide the single generic, user-safe message so call sites never leak
 *     technical detail (stack traces, raw API errors) to the user.
 *
 * Design constraints:
 *  - Self-contained: a failure inside the logger must not surface to the user or
 *    recurse (it must not call itself).
 *  - Deduped/rate-limited: repeated identical errors (same context+message within
 *    a short window) are logged once, so a tight failing loop can't storm the DB.
 *  - Degrades gracefully when Supabase is not configured (tests / signed-out /
 *    offline): it just logs to the console.
 */
import { supabase } from './supabase'
import * as sync from './sync'

/** The only error string users should ever see. */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again later.'

export type Severity = 'error' | 'warn'

interface ReportOptions {
  severity?: Severity
}

/** How long (ms) to suppress a repeat of the same context+message. */
const DEDUPE_WINDOW_MS = 10_000
const recentLogs = new Map<string, number>()

function normalizeError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack }
  }
  if (typeof error === 'string') return { message: error }
  try {
    return { message: JSON.stringify(error) }
  } catch {
    return { message: String(error) }
  }
}

function appVersion(): string | null {
  try {
    return typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : null
  } catch {
    return null
  }
}

function userAgent(): string | null {
  return typeof navigator !== 'undefined' ? navigator.userAgent : null
}

/**
 * Report an error: log it to the console, persist it to Supabase (best-effort),
 * and return the generic user-facing message so the caller can display it.
 *
 * `context` identifies where the error came from, e.g. 'syncAll:push',
 * 'ErrorBoundary:Tracker', 'oura-sync'.
 */
export function reportError(context: string, error: unknown, opts: ReportOptions = {}): string {
  const severity = opts.severity ?? 'error'
  const { message, stack } = normalizeError(error)

  // Dedupe identical reports within the window so a failing loop can't storm the
  // console or the DB — a repeated error is fully silent until the window passes.
  const key = `${context}::${message}`
  const now = Date.now()
  const last = recentLogs.get(key)
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return GENERIC_ERROR_MESSAGE
  recentLogs.set(key, now)
  // Opportunistic cleanup so the map can't grow unbounded.
  if (recentLogs.size > 200) {
    for (const [k, t] of recentLogs) {
      if (now - t >= DEDUPE_WINDOW_MS) recentLogs.delete(k)
    }
  }

  // Console breadcrumb (suppressed selectively in tests via setup.ts).
  if (severity === 'warn') console.warn(`[${context}]`, error)
  else console.error(`[${context}]`, error)

  // Best-effort persistence — fire-and-forget, never throws, never recurses.
  void persist({ context, message, stack, severity })

  return GENERIC_ERROR_MESSAGE
}

async function persist(args: {
  context: string
  message: string
  stack?: string
  severity: Severity
}): Promise<void> {
  if (!supabase) return // not configured (tests / dev without .env.local)
  try {
    let userId: string | null = null
    try {
      const { data } = await supabase.auth.getUser()
      userId = data.user?.id ?? null
    } catch {
      /* signed out / offline — log anonymously */
    }

    await sync.pushErrorLog({
      userId,
      context: args.context,
      message: args.message,
      stack: args.stack ?? null,
      severity: args.severity,
      appVersion: appVersion(),
      userAgent: userAgent(),
    })
  } catch (err) {
    // Swallow: the logger must never throw or report its own failure (no recursion).
    console.error('[errorLog] failed to persist:', err)
  }
}

/** Test-only: reset the dedupe cache between cases. */
export function _resetErrorLogDedupe(): void {
  recentLogs.clear()
}
