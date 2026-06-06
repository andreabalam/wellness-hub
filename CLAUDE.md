# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # dev server at http://localhost:5173/wellness-hub/
npm run build        # type-check + production build → dist/
npm run deploy       # build + publish to GitHub Pages (gh-pages branch)

npm test                    # unit tests (Vitest, run once)
npm run test:watch          # unit tests in watch mode
npm run test:coverage       # unit tests with lcov coverage report
npm run test:e2e            # E2E tests (Playwright, Chromium, auto-starts dev server)
npx playwright test --ui    # E2E tests in interactive UI mode

# Run a single unit test file
npx vitest run src/test/tracker.test.ts

# Run a single E2E spec
npx playwright test e2e/tracker.spec.ts
```

Unit tests live in `src/test/` and use jsdom — no browser. E2E tests live in `e2e/` and run against the real dev server (port 5173). `sync.ts` and `AuthButton.tsx` are excluded from unit coverage because they're covered by E2E.

## Architecture

### Local-first with optional Supabase sync

All user data lives in `localStorage` — the app works fully offline. Supabase (Postgres + Auth) is an optional cloud backup. The sync pattern is:

- **Reads always come from localStorage** via the stores in `src/hooks/useStore.ts`
- **Writes go to localStorage first**, then fire-and-forget to Supabase via `tryPush()`
- **Bidirectional sync** runs once on sign-in (`syncAll` in `App.tsx`): pull remote → merge → push merged back. Merge rules: remote wins for tracker days; union for recipes/tags/grocery/food library (local-only items are never lost)

### Data layer

`src/data/` holds TypeScript types and static constants only — no I/O:
- `tracker.ts` — `FoodEntry`, `DayData`, `QuickFood`, macro targets, preset foods
- `recipes.ts` — `Recipe` type + built-in recipe list (fallback when Supabase unavailable)
- `schedule.ts`, `grocery.ts`, `workouts.ts` — types and static data for their tabs

`src/hooks/useStore.ts` — plain store objects (`trackerStore`, `recipeStore`, etc.) that read/write localStorage and call `tryPush`. Also exports React hook wrappers (`useTrackerStore`, etc.) and `importRemoteData` used by the sync flow.

`src/lib/sync.ts` — all Supabase I/O. Pure push/pull functions, no localStorage access. Supabase tables: `tracker_days`, `recipes`, `custom_recipes` (legacy), `custom_tags`, `grocery_checked`, `food_library`, `schedule_blocks`, `med_guides`, `grocery_catalog` (public read).

`src/lib/supabase.ts` — exports a nullable `supabase` client. It's `null` when env vars are missing (unit tests, dev without `.env.local`). All call sites guard with `if (!supabase) return`.

### Supabase Edge Functions

Located in `supabase/functions/`. Each function is a Deno TypeScript module. The existing `oura-proxy` function is the reference pattern: verify JWT via Supabase client, read user settings, proxy external API, return JSON with CORS headers.

Secrets are set in Supabase Dashboard → Edge Functions → Secrets (never in code).

### UI structure

`App.tsx` owns the tab switcher and auth/sync state. Four tabs: `TrackerTab`, `RecipesTab`, `WorkoutsTab`, `ScheduleTab`. Each tab is a directory under `src/components/`. Tabs are always mounted (except `TrackerTab` which lazy-mounts on active to avoid expensive date calculations on load).

Styling is in less in `src/index.less`. CSS custom properties (`--teal`, `--amber`, `--coral`, etc.) are the design tokens. No CSS framework, no CSS modules — all styles are global.

### PWA

Configured via `vite-plugin-pwa` in `vite.config.ts`. Service worker uses Workbox with `prompt` registration (user is asked before a new SW activates). The `UpdatePrompt` component handles the "new version available" UI. Base path is `/wellness-hub/` for GitHub Pages hosting.

### Key data shapes

```ts
// A logged food entry (FoodEntry in tracker.ts)
{ n: string; k: number; p: number; c: number; f: number; fi: number; s?: number }
// n=name, k=kcal, p=protein(g), c=carbs(g), f=fat(g), fi=fiber(g), s=servings

// A full day (DayData in tracker.ts) — stored as tracker_days.data in Supabase
{ foods: FoodEntry[]; workout: string|null; wkNotes: string;
  energy: number; mood: number; sleep: number;
  phase: string; notes: string; medMin: number; medStyle: string }

// localStorage key for tracker data
'whub_tracker_v3'  // Record<YYYY-MM-DD, DayData>
```

### Environment

Requires `.env.local` for local development:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_OURA_CLIENT_ID=...   # Oura OAuth app client_id (public — safe to embed in JS)
```

The app degrades gracefully without these — auth and sync are disabled, everything else works.

### Oura OAuth — Edge Function secrets

Three secrets must be set in Supabase Dashboard → Edge Functions → Secrets
(required by both `oura-exchange` and `oura-proxy`):

| Secret | Description |
|---|---|
| `OURA_CLIENT_ID` | OAuth client ID from cloud.ouraring.com/oauth/applications |
| `OURA_CLIENT_SECRET` | OAuth client secret — never in client code |
| `OURA_ENCRYPT_KEY` | 32-byte AES key, base64-encoded. Generate: `openssl rand -base64 32` |

The `OURA_ENCRYPT_KEY` encrypts access and refresh tokens at rest in `user_settings`.
Only the Edge Functions can decrypt them; the database and browser never see plaintext tokens.

## Plans

Active implementation plans are in `plan/`. Check there before starting significant features.
