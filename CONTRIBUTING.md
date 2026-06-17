# Contributing

## Branch workflow

**Never commit directly to `main`.** Every change — even a one-line fix — goes
through a feature branch and a pull request. A local pre-commit hook and branch
protection both enforce this.

```bash
git checkout -b feat/<short-name>     # or fix/, chore/, docs/
# …make changes…
git commit -m "…"                     # pre-commit hook runs lint + coverage
git push -u origin feat/<short-name>
gh pr create --base main              # or open the PR in the UI
```

Branch prefixes: `feat/`, `fix/`, `chore/`, `docs/`.

## Before you push

The pre-commit hook (installed by `npm install` via `scripts/setup-hooks.sh`)
runs automatically and will block the commit if any of these fail:

- direct commit to `main`
- a staged `.env` / `.env.local` file, or a likely secret in the diff
- `npm run lint` (errors only — warnings are allowed)
- `npm run test:coverage` (unit tests + coverage thresholds)

You can run the full set yourself first:

```bash
npm run lint
npm run typecheck
npm run test:coverage
npm run build
npm run test:e2e        # optional locally; runs in CI on PRs
```

## What CI checks

On every PR to `main`:

- **`ci.yml`** — lint, typecheck, unit tests with coverage thresholds, build,
  and an advisory `npm audit` (non-blocking).
- **`e2e.yml`** — Playwright E2E (Chromium). Deploy to GitHub Pages happens only
  on push to `main` after a merge, never on PRs.

Coverage thresholds live in `vite.config.ts` (lines/statements/functions 85%,
branches 75%). `sync.ts` and a few Supabase/UI-heavy files are excluded there
because they're covered by E2E instead.

## Tests

- **Unit tests** live in `src/test/` and run in jsdom — no browser.
- **E2E tests** live in `e2e/` and run against the real dev server (port 5173).
- Pure logic and store behavior belong in unit tests; full user flows belong in
  E2E. See `docs/ARCHITECTURE.md` for the data layer being tested.

## Secrets

Never commit `.env*` files or keys. Local development uses `.env.local` (see the
README / `CLAUDE.md`). Supabase Edge Function secrets live in the Supabase
dashboard, never in code. Database migrations under `supabase/` are git-ignored
and applied manually to the Supabase project.

## Pull request checklist

- [ ] Branched off `main` (not committing to `main`)
- [ ] `npm run lint`, `npm run typecheck`, `npm run test:coverage`, `npm run build` pass
- [ ] Tests added/updated for the change
- [ ] No secrets committed; screenshot attached if the UI changed
