/** Date → 'YYYY-MM-DD' key used across the tracker (UTC split, matches stored keys). */
export function dkey(d: Date) {
  return d.toISOString().split('T')[0]
}
