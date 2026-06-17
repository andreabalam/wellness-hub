# Architecture

A short orientation to how data flows. For commands and contribution rules see
the [README](../README.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## Local-first, with optional Supabase sync

All user data lives in `localStorage` — the app works fully offline. Supabase
(Postgres + magic-link auth) is an **optional** cloud backup; the app degrades
gracefully when it isn't configured (no `.env.local`).

- **Reads** always come from `localStorage`, via the stores in
  `src/hooks/useStore.ts`.
- **Writes** go to `localStorage` first, then fire-and-forget to Supabase via
  `tryPush`. A failed push is logged and flips a persisted **sync-pending flag**
  (`syncStatusStore`) so the UI can show "changes not synced" and the next full
  sync reconciles it.
- **Bidirectional sync** (`syncAll` in `App.tsx`) runs once on sign-in: pull
  remote → merge in memory → write merged to `localStorage` → push merged back.

### Layers

| File | Responsibility |
|---|---|
| `src/data/*` | Types + static constants only (no I/O) |
| `src/hooks/useStore.ts` | Stores that read/write `localStorage` and call `tryPush`; sync-status flag; export/import |
| `src/lib/sync.ts` | All Supabase I/O — pure push/pull, no `localStorage` |
| `src/lib/recipeSync.ts` | Pure custom-recipe merge logic (tested in isolation) |
| `src/lib/storage.ts` | `safeGet`/`safeSet` — the single guarded `localStorage` boundary |
| `src/lib/errorLog.ts` | `reportError` — generic user message + persisted log |

## Merge rules (`syncAll`)

Conflicts are resolved per data type:

- **Tracker days** — remote wins per day. Local days are re-read immediately
  before the write so an edit made *during* the pull window isn't clobbered.
- **Tags, grocery checks** — union (set).
- **Food library** — remote wins per food name; local-only names kept.
- **Reminders, grocery catalog** — union by id; remote wins per id; local-only kept.
- **Week schedule, med guides** — remote wins; fall back to local if no remote copy.
- **User settings** — remote wins; local is pushed only if there's no remote copy.
- **Body stats, workout plan** — remote wins; pulled only.

A single in-flight guard prevents two `syncAll` runs from interleaving, and the
push phase is separated from the pull phase so a push failure flips the pending
flag without losing the pulled data.

## Custom recipes: the id is the tombstone

Custom recipes sync through `RecipesTab` (which also loads the built-in catalog),
using `mergeRecipes` in `src/lib/recipeSync.ts`. The recipe **id** encodes sync
state, so no separate tombstone table is needed:

- A **placeholder id** (`Date.now()`, ~1.7e12) was generated locally and never
  synced → push it; Postgres assigns a real id, which is swapped in locally.
- A **real (small) DB id** present locally but **absent from a _successful_ DB
  fetch** means the recipe was deleted on another device → prune it locally
  (don't resurrect it).
- An id present in both → the DB row wins.

The merge only prunes when the fetch **succeeded** — `fetchUserRecipes` throws on
error rather than returning `[]`, so a network blip can't wipe synced recipes.

## Error handling

Any caught error calls `reportError(context, error)` (`src/lib/errorLog.ts`),
which shows the user a single generic message ("Something went wrong. Please try
again later.") and best-effort persists a structured row to the `client_error_log`
table for the project owner to review (insert-only RLS; no read policy). The
helper dedupes repeats and never throws or recurses.

## Backups

`exportAllData` / `importAllData` (`src/hooks/useStore.ts`) produce/consume a
single JSON file covering every `localStorage` key (tracker, recipes, tags,
grocery, food library, reminders, med guides, body stats, workout plan, settings,
schedule). The format is versioned (`whub_v2`); older `whub_v1` backups still
import.

## Supabase migrations

SQL migrations live under `supabase/` (git-ignored) and are applied manually to
the Supabase project. Tables use row-level security scoped per `user_id`.
