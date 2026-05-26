# Wellness Hub — Migration & Enhancement Plan

## Current State
Single `my_wellness_hub.html` (~1,686 lines). Data in localStorage:
- `whub_tracker_v1` — daily food/workout/meditation/check-in logs
- `whub_custom_recipes_v1` — user-added recipes
- `whub_custom_tags_v1` — user-defined tags
- `whub_grocery_v1` — grocery checkbox states

---

## Phase 1 — React Migration

### Option A: Vite + React SPA ✅ Recommended
- Zero-config GitHub Pages deploy (`base` in `vite.config.ts`, `gh-pages` package)
- Vitest built-in for unit tests
- Fast HMR, small bundle
- **Con:** Client-side routing needs hash mode or 404.html trick for GH Pages

### Option B: Next.js (static export)
- `output: 'export'` for GitHub Pages
- Better file-based structure out of the box
- **Con:** Overkill for a personal SPA; adds build complexity; no SSR benefit here

**Recommendation: Option A (Vite + React + TypeScript)**

### Migration approach
1. `npm create vite@latest wellness-hub-app -- --template react-ts`
2. Extract data constants (SCHEDULE_BLOCKS, wkPlan, RECIPES, GROCERY) into `src/data/`
3. One component per tab: `ScheduleTab`, `WorkoutsTab`, `RecipesTab`, `TrackerTab`
4. Replace localStorage raw calls with a `useStore` hook (same 4 keys, same shape)
5. Keep `my_wellness_hub.html` in repo root until tests pass

---

## Phase 2 — Testing

### Unit tests: Vitest + React Testing Library
- Test pure logic: macro calculations, date helpers, recipe filter, food-log totals
- Test localStorage read/write via `useStore` hook with mocked storage
- ~20-30 focused tests

### E2E tests: Playwright ✅ Recommended over Cypress
- Faster, free, better multi-browser, works well with Vite dev server
- Scenarios: log a meal → macro bars update; add custom recipe → appears in filter; grocery check persists; tracker date nav

### Option: Cypress
- Larger install, slower, but more familiar to some teams
- **Con:** Free tier has limitations for CI; overkill for a personal project

**Recommendation: Playwright**

---

## Phase 3 — PWA

### vite-plugin-pwa (Workbox) ✅ Recommended
- `npm i -D vite-plugin-pwa`
- Generates `manifest.json` + service worker automatically
- Offline strategy: cache-first for app shell, network-first for Supabase API calls
- Installable on iOS (Add to Home Screen) and Android/Chrome

---

## Phase 4 — Supabase Sync

### Auth approach

| Option | Pros | Cons |
|---|---|---|
| **Magic link (email)** ✅ | Simple, secure, no password | Requires email each login |
| Anonymous session | Zero friction | Data lost if browser cleared |
| Google OAuth | One-click | More setup |

**Recommendation: Magic link** — you own the data, one-time setup.

### Schema (4 tables, match existing localStorage keys)

```sql
tracker_logs    (user_id, date, data jsonb)
custom_recipes  (user_id, id, data jsonb)
custom_tags     (user_id, tags jsonb)
grocery_state   (user_id, checked jsonb)
```

### Sync strategy: local-first

```
localStorage (instant, offline)
    ↓ on connect / on change
Supabase (truth for cross-device sync)
```

- On app load: pull Supabase → merge into localStorage (Supabase wins on conflict)
- On every write: write localStorage first (instant UI), then upsert Supabase async
- Offline: queue writes, flush on reconnect via `navigator.onLine` event

### Hosting: GitHub Pages stays unchanged
Supabase is a separate free-tier project. No change to deploy pipeline.

---

## Execution order

```
Phase 1: Vite + React migration       ~2-3 sessions
Phase 2: Unit + E2E tests             ~1-2 sessions
Phase 3: PWA (manifest + SW)          ~0.5 session
Phase 4: Supabase auth + sync         ~1-2 sessions
```

---

## Setup guide (post-implementation)

Will be generated as `SETUP.md` after Phase 4. Will cover:
1. Fork / clone repo
2. Create free Supabase project → copy `SUPABASE_URL` + `ANON_KEY`
3. Run `npm i && npm run dev`
4. Create `.env.local` with Supabase keys
5. Deploy to GitHub Pages (`npm run deploy`)
6. Install as PWA on phone
7. Sign in via magic link email
