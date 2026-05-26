# My Wellness Hub

Personal wellness tracker — schedule, workouts, recipes, and daily logging.

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:5173/wellness-hub/](http://localhost:5173/wellness-hub/).

## Running tests

**Unit tests** (Vitest — no browser needed):

```bash
npm test                  # run once
npm run test:watch        # watch mode
npm run test:coverage     # with coverage report
```

**E2E tests** (Playwright — runs against the dev server):

```bash
npm run test:e2e          # headless Chromium
npx playwright test --ui  # interactive UI mode
```

The E2E suite starts the dev server automatically. Make sure `npm install` has been run and port `5173` is free.

## Other commands

| Command | What it does |
|---|---|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | Build + publish to GitHub Pages (`gh-pages` branch) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright, Chromium) |

## Supabase sync (optional)

Sign in with a magic link to back up and sync data across devices. Without credentials the app works fully offline using `localStorage`.

1. Create a free project at [supabase.com](https://supabase.com)
2. Copy `.env.local.example` → `.env.local` and fill in your URL + anon key
3. Run the SQL in `.env.local.example` (or see below) in the Supabase SQL editor
4. Add your app URLs to **Authentication → URL Configuration → Redirect URLs**:
   - `https://andreabalam.github.io/wellness-hub/`
   - `http://localhost:5173/wellness-hub/`

<details>
<summary>SQL setup</summary>

```sql
create table tracker_days (
  user_id uuid references auth.users not null,
  date text not null, data jsonb not null default '{}',
  updated_at timestamptz default now(),
  primary key (user_id, date)
);
alter table tracker_days enable row level security;
create policy "own rows" on tracker_days
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table custom_recipes (
  user_id uuid references auth.users not null,
  recipe_id bigint not null, data jsonb not null,
  updated_at timestamptz default now(),
  primary key (user_id, recipe_id)
);
alter table custom_recipes enable row level security;
create policy "own rows" on custom_recipes
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table custom_tags (
  user_id uuid primary key references auth.users,
  tags text[] not null default '{}', updated_at timestamptz default now()
);
alter table custom_tags enable row level security;
create policy "own row" on custom_tags
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table grocery_checked (
  user_id uuid primary key references auth.users,
  checked text[] not null default '{}', updated_at timestamptz default now()
);
alter table grocery_checked enable row level security;
create policy "own row" on grocery_checked
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```
</details>

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — service worker + web manifest (Workbox)
- [Supabase](https://supabase.com) — optional magic-link auth + Postgres sync (RLS per user)
- Local-first — data lives in `localStorage`, Supabase is an async backup
- Export / import via JSON backup (Recipes tab → Export data)

## PWA

The app installs as a standalone PWA on desktop and mobile (Chrome, Edge, Safari).

- **Offline-first** — all build assets and Google Fonts are precached by the service worker.
- **Update prompt** — when a new version deploys, a banner appears offering a one-click reload.
- **Icons** live in `public/`. To regenerate them after changing the design:
  ```bash
  node scripts/generate-icons.cjs
  ```
