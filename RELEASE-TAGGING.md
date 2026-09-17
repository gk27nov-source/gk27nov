# Git tagging strategy

This document defines how production releases are tagged. It is a design
document — no tag is created by this file existing. Creating a tag is a
separate, explicit, approved action (see "Procedure" below).

## Versioning: semantic versioning

```
vMAJOR.MINOR.PATCH

v1.0.0
v1.0.1
v1.1.0
v2.0.0
```

| Bump  | When |
|-------|------|
| PATCH | Bug fixes, no behavior change a caller/operator should need to know about. |
| MINOR | Backward-compatible features — something new was added, nothing existing broke. |
| MAJOR | Breaking changes — an existing API, webhook payload shape, environment variable, or documented behavior changed incompatibly. |

**A MAJOR version is never created automatically.** Bumping to a new MAJOR
version requires an explicit human decision, stated as such at tag time —
never inferred from a diffstat or commit message by tooling.

Since nothing before this workflow was tagged, the first release starts at
`v1.0.0` rather than being computed as a bump from an untracked history.

## What a tag points to

A production release tag **always** points to a commit that is:

1. On `main`, on the canonical repository (`gk27nov-source/gk27nov`, remote
   `aistudio` in this checkout — verify with `git remote -v`, don't assume
   the name).
2. The exact commit that passed `npm run release:check` immediately before
   tagging — not a later commit, not an approximation of one.
3. Recorded in a `releases/vX.Y.Z.md` manifest (see `releases/README.md`)
   created in the same sitting as the tag.

## Tag type: annotated, always

```bash
git tag -a v1.0.0 -m "v1.0.0 — <one-line summary>" <commit-sha>
```

Never a lightweight tag (`git tag v1.0.0` with no `-a`/`-m`). An annotated
tag carries its own commit-like object — tagger, date, and message — which
is what makes "what exactly was v1.0.0 and when was it cut" answerable
without cross-referencing anything else.

## Absolute rules

- **Never move an existing tag.** A published tag (`v1.0.0`, etc.) is
  immutable. If a mistake is discovered after tagging, the fix is a new
  PATCH release (`v1.0.1`) that points at a new commit — not `git tag -f`
  on the old one.
- **Never force-update a release tag.** `git push --force` (or `-f`) on a
  tag ref is never performed. If a tag push is rejected because the tag
  already exists on the remote, that means it was already published — stop
  and investigate rather than forcing.
- **Never tag a commit that hasn't passed `npm run release:check`.**
- **Never tag on any branch other than `main`.**
- **Never tag on any remote other than the canonical one.**

## Procedure (manual, approval-gated)

1. Confirm current branch is `main` and `git status` is clean.
2. `git fetch aistudio` (or whichever remote is canonical — re-verify, don't
   assume) and confirm local `main` matches `aistudio/main` exactly (no
   ahead/behind).
3. `npm run release:check`. All checks must pass. If anything fails, stop —
   do not tag a commit that failed verification.
4. Decide the version number using the PATCH/MINOR/MAJOR rules above. State
   the reasoning (what changed, why it's that bump) — this is a human
   decision, written down, not silently inferred.
5. Write `releases/vX.Y.Z.md` (see `releases/README.md` for the template)
   and the matching `CHANGELOG.md` section, if not already drafted.
6. Create the annotated tag on the verified commit:
   ```bash
   git tag -a vX.Y.Z -m "vX.Y.Z — <summary>" <commit-sha>
   ```
7. Push **only the tag**, never a branch, in the same action:
   ```bash
   git push aistudio vX.Y.Z
   ```
   This is a distinct, explicit push — not a side effect of pushing `main`.
8. Verify: `git ls-remote --tags aistudio` shows the new tag pointing at the
   expected commit SHA.

Steps 6–8 require explicit human approval before execution, same as any
other write to the canonical repository. This document does not authorize
running them on its own.

## Relationship to AI Studio

AI Studio pulls from `main`, not from a tag directly (see
`AI-STUDIO-PULL-PROCEDURE.md`) — tags are this project's own record of what
was verified and when, addressed to the humans and tooling operating the
release process, not a mechanism AI Studio itself reads. What AI Studio
previews and eventually publishes is always traceable back to a tagged
commit because tagging happens at the same commit `main` is fast-forwarded
to, never after the fact on a moving target.
