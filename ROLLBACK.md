# Rollback

Rollback is always to a known-good, already-tagged commit — never a guess,
never "whatever was live yesterday" from memory. If the version you're
rolling back to doesn't have a tag and a `releases/vX.Y.Z.md` manifest, it
isn't a valid rollback target; tag it retroactively first isn't an option
either (see `RELEASE-TAGGING.md` — a tag records what was verified *before*
publication, not after the fact).

## Absolute rules

- **Never force push `main`.**
- **Never delete history.** A bad release stays in the git log; rollback
  adds to history, it doesn't erase it.
- **Never rewrite GitHub history** (no `rebase`, no `filter-branch`, no
  history-editing of any kind on the canonical repository).
- **Never move an existing tag** — including the tag being rolled back
  *from*. It stays exactly where it is, permanently marking "this was
  published, and later rolled back," which is itself useful history.

Rollback must preserve complete git history. If you can't explain how a
rollback step preserves history, it's the wrong step.

## Example scenario

```
Current (published, now broken):   v1.1.0
Previous known good:               v1.0.0
```

## Procedure

Rollback goes through the **same controlled deployment process** as any
other release — it is not a special bypass path. The only difference is the
target commit is an older tag instead of a new one.

1. **Confirm the previous known-good tag and commit:**
   ```bash
   git fetch aistudio --tags
   git rev-parse v1.0.0
   ```
   Cross-check against `releases/v1.0.0.md` — the manifest's recorded commit
   SHA must match what the tag resolves to.

2. **Do not touch `main` directly yet.** Decide the rollback's own version
   number first. Rolling back is itself a release — typically a new PATCH
   (e.g. `v1.1.1`) whose content is "identical to v1.0.0," not a reset of
   `main` back to the old commit. This keeps `main`'s history linear and
   forward-only, and keeps the "what does `main` currently point to"
   question simple.

   ```bash
   git checkout main
   git pull aistudio main
   git checkout -b rollback/v1.1.1-revert-to-v1.0.0
   git revert --no-commit v1.0.0..v1.1.0
   git commit -m "revert: roll back to v1.0.0 behavior (see ROLLBACK.md)"
   ```
   `git revert` (not `reset --hard`) specifically because it produces new
   commits that undo the bad change, rather than moving `main`'s pointer
   backward — this is what "preserve complete history" means in practice.
   If the revert has conflicts, resolve them by hand against what v1.0.0
   actually contained, don't guess.

3. **Run the full release process on this branch:**
   ```bash
   npm run release:check
   ```
   A rollback is not exempt from verification — if anything, it deserves
   more scrutiny, since it's happening under pressure.

4. **Merge to `main` through the normal flow**, get `main` to a new commit,
   fast-forward only (per `DEPLOYMENT-WORKFLOW.md`).

5. **Tag it** (`v1.1.1`, or whatever the decided number is), write its
   `releases/v1.1.1.md` manifest noting in the release notes that this is a
   rollback and what it reverts.

6. **Pull into AI Studio** (`AI-STUDIO-PULL-PROCEDURE.md`), verify the
   preview (`PREVIEW-VERIFICATION.md`), get human approval, publish.

7. **Run `PRODUCTION-SMOKE-TEST.md` again** against production. A rollback
   isn't done until it's been smoke-tested like any other release.

8. **Update both manifests:**
   - `releases/v1.1.0.md` — `Production status: Rolled back <date>, see v1.1.1`
   - `releases/v1.1.1.md` — `Production status: Published <date>`

## If Cloud Run/AI Studio has its own revision history

AI Studio/Cloud Run typically keeps previous deployed revisions and can
roll traffic back to one directly from its own console, faster than a full
git-level rollback. That's a legitimate **emergency mitigation** to stop
active harm immediately — but it is not a substitute for the git-level
rollback above. If production traffic is moved back to an old revision this
way, the git-level rollback (steps 1–8) still needs to happen afterward, so
that `main`, the tags, and what's actually running in production agree
again. An AI-Studio-side revision rollback with no matching git rollback
leaves the canonical repository lying about what's live — exactly the
divergence this whole workflow exists to prevent.
