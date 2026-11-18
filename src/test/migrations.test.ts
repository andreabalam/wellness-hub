/**
 * Every Supabase table the app or an edge function touches must be created
 * and protected by row-level security in supabase/migrations — not only in
 * the dashboard, where it can't be reviewed or reproduced.
 */
import { describe, expect, it } from 'vitest'

const raw = (files: Record<string, unknown>) => Object.values(files).map(String).join('\n')

const migrations = raw(
  import.meta.glob('../../supabase/migrations/*.sql', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
).toLowerCase()

const code = raw({
  ...import.meta.glob(['../lib/**/*.ts', '../hooks/**/*.ts', '../components/**/*.tsx'], {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  ...import.meta.glob('../../supabase/functions/*/index.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
})

const tablesUsed = [...new Set([...code.matchAll(/\.from\(\s*'([a-z_]+)'\s*\)/g)].map(m => m[1]))]

describe('supabase migrations', () => {
  it('finds the tables the code uses', () => {
    expect(tablesUsed).toEqual(expect.arrayContaining(['tracker_days', 'recipes']))
  })

  it.each(tablesUsed)('%s is created, has RLS enabled and a policy', table => {
    const t = `(?:public\\.)?${table}`
    expect(migrations).toMatch(new RegExp(`create table (?:if not exists )?${t}\\b`))
    expect(migrations).toMatch(new RegExp(`alter table ${t}\\s+enable row level security`))
    expect(migrations).toMatch(new RegExp(`create policy [^;]* on ${t}\\b`))
  })
})
