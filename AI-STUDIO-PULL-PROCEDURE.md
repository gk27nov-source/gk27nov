# AI Studio pull-only procedure

AI Studio is a **consumer** of the canonical repository, never an author of
it. This document is the repeatable procedure for pulling a verified release
into AI Studio for preview. It is written to be followed by a human operating
AI Studio's own UI/tooling; nothing here runs automatically from Claude Code.

## The one rule everything else follows from

```
GitHub gk27nov-source/gk27nov, branch main, is the single source of truth.
AI Studio may fetch, pull, build, test, preview, and publish.
AI Studio must never push, force push, commit, or rewrite history.
```

AI Studio's push URL for this repository must remain in the disabled state:

```
PUSH_DISABLED_PULL_ONLY
```

If AI Studio's own UI ever offers to push, commit, or otherwise write back to
`gk27nov-source/gk27nov`, decline it and treat that as a signal to re-check
this configuration — it should not be possible, and if it becomes possible
that is itself the incident to investigate, not something to act on.

## Procedure

Run in this order. Each step assumes the previous one succeeded.

### 1. Fetch and verify origin state

```bash
git fetch origin
```

(Here "origin" means whichever remote name AI Studio's environment uses for
`gk27nov-source/gk27nov` — confirm with `git remote -v` rather than assuming
the name matches this document's examples, per the naming confusion this
project has already hit once with a remote literally named `origin` pointing
at the *wrong*, non-canonical repository in other checkouts.)

```bash
git remote get-url origin
# must print: https://github.com/gk27nov-source/gk27nov.git (or the SSH equivalent)
```

If it prints anything else, **stop**. Do not proceed with a pull from the
wrong repository.

### 2. Verify the working tree is clean before touching it

```bash
git status --porcelain
```

Must be empty. If AI Studio's own environment has uncommitted local edits
(from its own editor, or a stale previous pull), that is a divergence from
"AI Studio never authors changes" and needs to be resolved by discarding
those local edits — never by committing or pushing them — before continuing.

### 3. Bring the working tree to the exact target commit

The target is either:
- the latest `origin/main`, for an ongoing "always preview what's current"
  setup, or
- a specific tagged release (`vX.Y.Z`), when previewing a specific,
  already-decided release candidate — the more common case once
  `RELEASE-TAGGING.md` is in use.

```bash
# Latest main:
git checkout main
git reset --hard origin/main

# A specific tagged release:
git fetch origin --tags
git checkout vX.Y.Z
```

`git reset --hard` here is safe specifically because step 2 already
confirmed there is nothing local to lose, and this resets AI Studio's own
checkout to match the canonical remote — it does not touch the remote
itself. This is the one place in this whole workflow `reset --hard` is
appropriate, precisely because AI Studio's copy is disposable and the
remote is not.

### 4. Verify HEAD

```bash
git rev-parse HEAD
```

Confirm this matches the commit SHA recorded in the `releases/vX.Y.Z.md`
manifest (or `origin/main`'s current SHA, for a rolling preview). If it
doesn't match, stop and re-run step 3 rather than previewing an unexpected
commit.

### 5. Install dependencies

```bash
npm ci
```

Prefer `npm ci` over `npm install` where a lockfile is present and trusted
in that environment. (Note: this repository's own `.gitignore` excludes
`package-lock.json` — generated on a different OS than this project's own
dev machine has caused problems before, per `DEPLOY.md`. If AI Studio's
build environment needs a lockfile, it generates its own; `npm install` is
the fallback if no lockfile exists in that environment.)

### 6. Run verification inside AI Studio's own environment too

```bash
npm run verify
```

Don't rely solely on verification that happened elsewhere (Claude Code's
local run, or CI). Different environment, different Node/npm version,
different OS — run it again here. This is cheap and catches the class of
bug that only shows up in the actual preview/publish environment.

### 7. Start the preview

Use AI Studio's own preview mechanism (not `npm run dev` directly — AI
Studio typically wraps this with its own port/proxy handling). Once the
preview is up, move to `PREVIEW-VERIFICATION.md`.

## Explicitly prohibited in this procedure

- `git push` (any form, to any branch)
- `git commit` (AI Studio's own editor must not be used to make source
  changes that get committed from this environment)
- `git rebase` of anything already on the remote
- `git push --force` / `--force-with-lease`
- Creating a new repository, or pointing AI Studio at any repository other
  than `gk27nov-source/gk27nov`

If AI Studio's environment needs a change to the code, the change is made in
Claude Code / localhost, verified, committed, and merged to `main` through
the normal flow (`DEPLOYMENT-WORKFLOW.md`) — then pulled here. Never the
other way around.
