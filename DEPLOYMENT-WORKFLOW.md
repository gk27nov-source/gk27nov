# Deployment workflow

The permanent, safe release process for Smart Business Automation Hub. This
document is the index — each stage links to the document that owns its
detail. Read this top-to-bottom once, then use the linked documents when
actually executing a stage.

```
DEVELOPMENT
Claude Code / localhost
        |
        v
LOCAL VERIFICATION
lint + tests + build            (npm run verify)
        |
        v
CANONICAL SOURCE
GitHub gk27nov-source/gk27nov / main
        |
        v
RELEASE TAG
vX.Y.Z
        |
        v
AI STUDIO
PULL ONLY
        |
        v
PREVIEW
verification
        |
        v
HUMAN APPROVAL
        |
        v
PRODUCTION
Publish
        |
        v
SMOKE TEST
        |
        v
RELEASE COMPLETE
```

## The one rule everything else exists to enforce

**GitHub `main` on `gk27nov-source/gk27nov` is the single source of truth.**

AI Studio may: fetch, pull, build, test, preview, publish.
AI Studio must never: push, force push, commit source changes, rewrite
GitHub history, or become a second canonical repository.

If any step below seems to require AI Studio to push or commit, that step is
wrong — stop and re-read `AI-STUDIO-PULL-PROCEDURE.md`.

## Stage 1 — Development

Where: Claude Code, `localhost:3000`, on a feature/integration branch off
`main` (never committing directly to `main` for anything non-trivial).

Nothing here is release-gated — this is normal day-to-day work.

## Stage 2 — Local verification

```bash
npm run verify
```

= `npm run lint && npm test && npm run build`. Must pass before anything in
this stage is considered done. This is the same command CI
(`.github/workflows/ci.yml`) runs on every push/PR to `main` — running it
locally first just means CI confirms rather than discovers.

## Stage 3 — Canonical source (GitHub `main`)

Merge to `main` on the canonical repository — `gk27nov-source/gk27nov`
(confirm the remote name with `git remote -v`; it is **not** always named
`origin` in every checkout of this project — see the note in
`AI-STUDIO-PULL-PROCEDURE.md`). Fast-forward only; no force push, ever.

## Stage 4 — Release tag

```bash
npm run release:check
```

Runs `scripts/pre-release-check.mjs` (repository/secret hygiene) followed by
`npm run verify` (application correctness). Both must pass on the exact
commit about to be tagged, on `main`, on the canonical remote.

Then follow `RELEASE-TAGGING.md`'s procedure: pick the version number using
semantic versioning (PATCH/MINOR/MAJOR — MAJOR is never automatic), write
`releases/vX.Y.Z.md` and the `CHANGELOG.md` section, create an annotated
tag, push **only the tag**. This step requires explicit human approval —
tagging and pushing a tag are write actions.

## Stage 5 — AI Studio pull

Follow `AI-STUDIO-PULL-PROCEDURE.md` exactly. AI Studio fetches the tagged
commit (or `main`, for a rolling preview), never authors anything.

## Stage 6 — Preview verification

Follow `PREVIEW-VERIFICATION.md`'s checklist against the live AI Studio
preview. Ends with the line `READY FOR PRODUCTION APPROVAL` if everything
passes — and stops there.

## Stage 7 — Human approval gate

**Production publication never happens automatically from Claude Code, and
never happens as a side effect of any script in this repository.**

Once `PREVIEW-VERIFICATION.md` reports `READY FOR PRODUCTION APPROVAL`, a
human operator reviews the preview, the release manifest
(`releases/vX.Y.Z.md`), and the changelog entry, and makes an explicit,
separate decision to publish. There is no command in this repository that
performs this step — it happens in AI Studio's own publish UI, by a human,
on purpose.

## Stage 8 — Production (publish)

Performed by the human operator, in AI Studio, using AI Studio's own publish
mechanism. Not scripted here, deliberately.

## Stage 9 — Smoke test

Immediately after publish, run `PRODUCTION-SMOKE-TEST.md` against the live
production URL. A release is not complete until this passes.

## Stage 10 — Release complete

Update `releases/vX.Y.Z.md`'s `Production status` to `Published <date>`.
The release is done.

## If something goes wrong

At any stage: `ROLLBACK.md`. Rollback goes through this same process with an
older tag as the target — it is not a bypass or shortcut path.

## Document map

| Document | Owns |
|---|---|
| `DEPLOYMENT-WORKFLOW.md` (this file) | The overall flow, stage by stage |
| `RELEASE-TAGGING.md` | Semantic versioning rules, tag creation procedure |
| `releases/README.md` + `releases/vX.Y.Z.md` | Per-release verification record |
| `CHANGELOG.md` | What shipped in each tagged release |
| `AI-STUDIO-PULL-PROCEDURE.md` | How AI Studio pulls a release, pull-only |
| `PREVIEW-VERIFICATION.md` | What to check in the AI Studio preview |
| `PRODUCTION-SMOKE-TEST.md` | What to check after publishing |
| `ROLLBACK.md` | How to safely roll back a bad release |
| `scripts/pre-release-check.mjs` | Automated repository/secret-hygiene gate |
| `.github/workflows/ci.yml` | Automated verify-only CI on push/PR to `main` |
| `docs/DEVELOPMENT_AND_DEPLOYMENT.md`, `DEPLOY.md` | Older, narrower docs from before this workflow existed — see the note below |

### Note on the older docs

`docs/DEVELOPMENT_AND_DEPLOYMENT.md` and `DEPLOY.md` predate this workflow
and this repository's current canonical-remote decision; parts of them (in
particular, references to `smart_business_automation_hub` as the canonical
repository) are now stale. They still contain accurate, useful detail about
the two-Google-Cloud-project architecture (Cloud Run in one project,
Firebase in another) and the Cloud Run environment variables production
needs — that operational detail isn't duplicated here. Where they conflict
with this document on *process* (which repo is canonical, how releases are
made), this document and `RELEASE-TAGGING.md` / `AI-STUDIO-PULL-PROCEDURE.md`
are authoritative.
