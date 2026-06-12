---
name: pr
description: Create a GitHub pull request with a detailed AI-written description. Reads every commit on the current branch, assesses the actual diff, and writes a clear summary of what changed and why — no boilerplate. Use when you want to open a PR without writing the description yourself.
user-invocable: true
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
  - Bash(npm *)
  - Bash(npx *)
---

# /pr — Create a pull request with an AI-written description

Arguments: `$ARGUMENTS` (optional base branch, e.g. `main`. Defaults to `main`.)

---

## Your job

Verify the branch passes all project checks, then read every commit on this branch, understand what actually changed, and write a PR description that fills in the project's PR template. Then open the PR.

A PR is only opened from a green branch — if any check fails, the PR is not created until the failures are fixed.

---

## Steps

### 1. Establish the range

```bash
git rev-parse --abbrev-ref HEAD          # current branch
git log --oneline main..HEAD             # commits going in
```

If the branch is already at `main`, or has no commits ahead, stop and tell the user there's nothing to open a PR for.

Check whether a remote tracking branch exists and is up to date:
```bash
git status -sb
```
Note whether commits need pushing — but do NOT push yet. Push only happens in step 6, after all checks pass.

### 2. Verify the branch is green

Run all project checks before writing anything. The fast checks first, in parallel:

```bash
npm run lint     # ESLint
npm test         # unit tests (Vitest)
npm run build    # type-check + production build
```

If all three pass, run the E2E suite (slowest — it auto-starts the dev server):

```bash
npm run test:e2e
```

**If any check fails:**
- Do NOT create the PR.
- Show the user the failing output (the actual errors, not just "lint failed").
- If the failures are small and clearly caused by this branch's changes (a type error, a lint violation, a test broken by the diff), fix them, re-run the failed check to confirm, and commit the fix on this branch before continuing.
- If the failures are substantial, ambiguous, or pre-existing on `main` (verify with `git stash` / checking the base branch if unsure), stop and report — let the user decide how to proceed.

Only continue to step 3 when every check passes.

### 3. Read the changes

Gather the full picture — do these in parallel:

```bash
git log main..HEAD --format="%H %s"          # commit list with subjects
git diff main...HEAD --stat                   # files changed + line counts
git diff main...HEAD                          # full diff (ground truth)
```

If the diff is very large (>600 lines), read it in sections per file rather than truncating.

### 4. Assess — think before you write

Before drafting, mentally answer:

- **What problem does this solve or what feature does it add?** (one sentence)
- **What are the meaningful changes?** Group logically — don't just list files. E.g. "added Edge Function + client call + migration" is one coherent change, not three.
- **Are there any risks, limitations, or things a reviewer should scrutinize?** (missing error handling, a workaround, a known rough edge)
- **Were tests added or updated?** Look at the diff for new or changed test files.
- **Does the diff touch UI components?** If yes, a screenshot should be attached.
- **Are there any secrets, credentials, or `.env` values in the diff?**

### 5. Draft the PR

Title: short (≤70 chars), describes the outcome not the mechanism. E.g. "Add photo meal logging via HuggingFace + USDA" not "Update analyzeFood.ts and deploy edge function."

Body: use **exactly** this template — no extra sections, no reordering:

```
## What changed and why

<2-5 bullet points. Each bullet covers a coherent unit of change — not a file.
Lead with the user-visible or system-visible effect. Add one clause of WHY if
it isn't obvious. Skip anything that's obvious from the title.

If there's something a reviewer should specifically look at (a workaround, a
subtle side-effect, a known limitation, a migration that must run, an external
secret required), add it as an extra bullet with a "Note:" prefix.>

## Tests
- [x_or_space] Tests added / updated
- [x_or_space] All checks pass (lint, unit tests, build, E2E)

## Checklist
- [x_or_space] No secrets committed
- [x_or_space] Screenshot attached (if UI changed)
```

**Checkbox rules** — replace `x_or_space` with the correct value:
- `Tests added / updated`: check `[x]` if the diff contains new or modified test files (files under `src/test/`, `e2e/`, or named `*.test.*` / `*.spec.*`).
- `All tests pass`: always `[x]` — step 2 ran the full suite and you cannot reach this step otherwise.
- `No secrets committed`: check `[x]` if the diff contains no API keys, tokens, passwords, or `.env` values. Leave `[ ]` only if you actually see something suspicious.
- `Screenshot attached`: check `[x]` only if the user has already attached a screenshot. Leave `[ ]` if the diff touches UI components (the reviewer needs to attach one); omit the note entirely if the diff is backend/infra only with no UI changes.

Rules:
- No filler phrases ("This PR introduces…", "In this commit…", "As part of this change…")
- No restating the title
- Bullets are complete sentences but tight — cut adjectives that add no information
- If a commit message is already perfectly descriptive, reuse its language
- Do NOT add sections beyond the three in the template

### 6. Push and create the PR

If commits haven't been pushed yet (noted in step 1, or new fix commits from step 2):

```bash
git push -u origin HEAD
```

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Return the PR URL to the user.

---

## Edge cases

- **Draft PR**: if `$ARGUMENTS` contains `draft`, add `--draft` flag.
- **Different base**: if `$ARGUMENTS` names a branch other than `main`, use that as the base for both `git diff` and `gh pr create --base`.
- **PR already exists**: `gh pr view` will show it — tell the user and offer to update the description instead with `gh pr edit`.
- **Nothing pushed / no remote**: push first, then create. If push fails (no remote), tell the user.
