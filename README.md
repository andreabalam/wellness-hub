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
| `npm run lint` | ESLint — exits non-zero on errors, warns only |
| `npm run typecheck` | Type-check with `tsc -b` (no emit) |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | E2E tests (Playwright, Chromium) |

## CI / CD

| Trigger | Workflow | What it does |
|---|---|---|
| Pull request → `main` | `ci.yml` | Lint, typecheck, unit tests + coverage thresholds, build, advisory `npm audit` |
| Pull request → `main` | `e2e.yml` | E2E tests (Chromium) — catches regressions before merge |
| Push to `main` (merge) | `e2e.yml` | E2E tests → deploy to GitHub Pages if green |

Dependency updates (minor/patch, grouped) and GitHub Actions bumps are proposed weekly by [Dependabot](.github/dependabot.yml); major framework upgrades are done deliberately as separate PRs.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch workflow and [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how local-first sync works.

## Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) — service worker + web manifest (Workbox)
- [Supabase](https://supabase.com) — optional magic-link auth + Postgres sync (RLS per user)
- Local-first — data lives in `localStorage`, Supabase is an async backup
- Export / import via JSON backup (Recipes tab → Export data)
