/**
 * Human-readable message from a failed `supabase.functions.invoke` call.
 * FunctionsHttpError's own message is a generic "non-2xx status code"; the
 * server's reason (e.g. the daily AI limit) is in the Response on `.context`.
 */
export async function functionErrorMessage(error: unknown, fallback: string): Promise<string> {
  try {
    const ctx = (error as { context?: Response } | null)?.context
    if (ctx && typeof ctx.json === 'function') {
      const body = (await ctx.clone().json()) as { error?: unknown }
      if (typeof body?.error === 'string' && body.error) return body.error
    }
  } catch {
    /* no JSON body */
  }
  return fallback
}
