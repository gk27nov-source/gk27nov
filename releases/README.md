# Release manifests

One file per production candidate, named `releases/vX.Y.Z.md`. Each file is a
short, factual record of one specific commit that was verified as a release
candidate — not a design document, not a changelog entry (that's
`CHANGELOG.md`), and never a place for secrets.

## When to create one

Right before tagging a release candidate (see `RELEASE-TAGGING.md`), once
`npm run release:check` has passed on `main` at the commit you intend to tag.
The manifest documents the commit *before* the tag is pushed, so `git commit
-> verify -> write manifest -> tag -> push tag` is the order, not the reverse.

## Template

```markdown
# vX.Y.Z

- **Version:** vX.Y.Z
- **Git commit:** <full 40-char SHA>
- **Date:** YYYY-MM-DD
- **Test result:** <pass/fail counts, e.g. "153 passed, 0 failed (dispatch 64, sync 35, due 54)">
- **Build result:** <pass/fail, e.g. "succeeded">
- **Release notes:** <one or two sentences, or a link to the matching CHANGELOG.md section>
- **Production status:** <Pending / Published YYYY-MM-DD / Rolled back YYYY-MM-DD, see previous>
```

## What never goes in a release manifest

- Secrets, tokens, API keys, passwords, or credential-bearing URLs.
- `.env` values of any kind.
- Anything that isn't already safe to read in a public GitHub repository —
  treat every file under `releases/` as if it were public, because a
  manifest's whole purpose is to be a plain, shareable record of what shipped
  and when.

## Updating `Production status`

A manifest is not rewritten to change its history — it is *updated in place*
only for the `Production status` field, as the one thing about a release that
legitimately changes after the fact (candidate → published → later rolled
back). Everything else in the file (commit, test/build result, date) is a
record of what was true at verification time and does not change.

## Relationship to git tags

A release manifest and a git tag point at the same commit and should be
created together, but they answer different questions:

- The **tag** (`vX.Y.Z`) is the immutable, cryptographically-addressable
  pointer Git and AI Studio actually use.
- The **manifest** is the human-readable "what was this, when was it
  verified, did it ship" record that's easy to read without running git
  commands.

See `RELEASE-TAGGING.md` for the tagging rules themselves.
