---
name: pr
description: Create a GitHub pull request with a detailed AI-written description. Reads every commit on the current branch, assesses the actual diff, and writes a clear summary of what changed and why — no boilerplate. Use when you want to open a PR without writing the description yourself.
user-invocable: true
allowed-tools:
  - Bash(git *)
  - Bash(gh *)
---

# /pr — Create a pull request with an AI-written description

Arguments: `$ARGUMENTS` (optional base branch, e.g. `main`. Defaults to `main`.)

---

## Your job

Read every commit on this branch, understand what actually changed, and write a PR description that a reviewer would find genuinely useful — not boilerplate. Then open the PR.

---

## Steps

### 1. Establish the range

```bash
git rev-parse --abbrev-ref HEAD          # current branch
git log --oneline main..HEAD             # commits going in
```

If the branch is already at `main`, or has no commits ahead, stop and tell the user there's nothing to open a PR for.

Check whether a remote tracking branch exists and if it's up to date:
```bash
git status -sb
```
If commits exist locally but haven't been pushed, push first:
```bash
git push -u origin HEAD
```

### 2. Read the changes

Gather the full picture — do these in parallel:

```bash
git log main..HEAD --format="%H %s"          # commit list with subjects
git diff main...HEAD --stat                   # files changed + line counts
git diff main...HEAD                          # full diff (ground truth)
```

If the diff is very large (>600 lines), read it in sections per file rather than truncating.

### 3. Assess — think before you write

Before drafting, mentally answer:

- **What problem does this solve or what feature does it add?** (one sentence)
- **What are the meaningful changes?** Group logically — don't just list files. E.g. "added Edge Function + client call + migration" is one coherent change, not three.
- **Are there any risks, limitations, or things a reviewer should scrutinize?** (missing error handling, a workaround, a known rough edge)
- **How would someone verify this works?** (what to click, what to check in the DB, what to watch for)

### 4. Draft the PR

Title: short (≤70 chars), describes the outcome not the mechanism. E.g. "Add photo meal logging via HuggingFace + USDA" not "Update analyzeFood.ts and deploy edge function."

Body structure:

```
## What changed

<2-5 bullet points. Each bullet covers a coherent unit of change — not a file.
Lead with the user-visible or system-visible effect. Add one clause of WHY if
it isn't obvious. Skip anything that's obvious from the title.>

## Details worth noting

<Only include this section if there's something a reviewer should specifically
look at: a workaround, a subtle side-effect, a known limitation, a dependency
on an external secret/config, a migration that needs to run. Omit if nothing stands out.>

## How to verify

<Concrete steps. What to open, what to click, what to check. Mention any
secrets or environment setup required. If the change is infrastructure-only
(migration, deploy), say what to check in the dashboard.>
```

Rules:
- No filler phrases ("This PR introduces…", "In this commit…", "As part of this change…")
- No restating the title
- Bullets are complete sentences but tight — cut adjectives that add no information
- If a commit message is already perfectly descriptive, reuse its language

### 5. Create the PR

```bash
gh pr create --title "<title>" --body "$(cat <<'EOF'
<body>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
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
