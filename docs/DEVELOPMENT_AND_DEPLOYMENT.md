# Smart Business Automation Hub — Development & Deployment

## Architecture

```
Local Development (Claude Code / your editor)
        |
        v
GitHub — gk27nov-source/smart_business_automation_hub  (canonical, origin)
        |
        v
CI (.github/workflows/ci.yml) — lint, tests, build on every push/PR to main
        |
        v
Manual publish through AI Studio  (see "Deployment" below — this step is
NOT automatic yet)
        |
        v
Production: smart-business-automation-hub.ai.studio
            (Cloud Run, project spatial-sound-mxjsq)
```

Two Google Cloud projects are involved, and that split is intentional, not
a misconfiguration — see `DEPLOY.md` for the full reasoning:

- **`spatial-sound-mxjsq`** — owned by AI Studio (Starter Tier). Hosts the
  Cloud Run service that serves the app and its Express API.
- **`smart-business-automation-hub`** — owned by you. Holds Firebase Auth
  and Firestore, reached directly from the browser via
  `firebase-applet-config.json`.

## Local Development

### Clone

```bash
git clone https://github.com/gk27nov-source/smart_business_automation_hub.git
cd smart_business_automation_hub
git checkout main
```

### Install dependencies

The project ships a `bun.lock`, so Bun is the package manager it was built
against. `npm install` also works (this is how it was validated in this
session, since Bun wasn't available on that machine) — just don't commit
the `package-lock.json` it generates; `.gitignore` already excludes it
because a Linux-generated lockfile has broken this project's deploy twice
before.

```bash
bun install        # preferred
# or
npm install
```

### Configure environment

Copy the example file and fill in real values — **never commit the
result**:

```bash
cp .env.example .env
```

See "Environment Variables" below for what each one does. For the
1-click demo personas instead of real sign-in, also see
`.env.demo.example`.

### Start localhost:3000

```bash
npm run dev
```

Signing in with a real account from plain `http://localhost:3000` fails
with `auth/unauthorized-domain` — this project's Firebase Auth authorized
domains are locked by AI Studio's Starter Tier and cannot include
`localhost`. Read `LOCAL-DEV.md` for the local-HTTPS workaround (mkcert),
or use the 1-click demo personas (`VITE_DEMO_MODE=true` in `.env`) to
develop without real auth.

## Git Workflow

```bash
git checkout main
git pull origin main
git checkout -b feature/whatever-you-are-doing

# make changes with Claude Code, test locally

git add <specific files>       # avoid `git add -A` blindly — review what's staged
git commit -m "..."
git push -u origin feature/whatever-you-are-doing
```

Open a pull request against `main` on GitHub. CI (lint, unit tests,
production build) runs automatically. Merge once it's green and you've
reviewed the diff.

Do not commit directly to `main` for anything non-trivial — branch, PR,
review, merge.

## Deployment

**This is the part that is still manual.** As of this document, pushing to
`main` does **not** automatically deploy anywhere. The actual publish step,
per `DEPLOY.md`:

1. Confirm the new Google Cloud project's authorized domains include the
   production hostnames (one-time, already done if you followed
   `DEPLOY.md`).
2. Confirm `firebase-applet-config.json` has `projectId: "smart-business-automation-hub"`.
3. Publish the current working tree through AI Studio's own UI/tool —
   the same way it's always been done for this project.
4. Set the environment variables listed below in AI Studio's secrets
   panel (they are not read from any committed file in production).
5. Verify per the checklist in `DEPLOY.md` section 6.

If AI Studio's project settings offer a "Connect to GitHub" / continuous
deployment option pointed at this repository, enabling it would close the
gap between "merged to main" and "live" — check AI Studio's dashboard for
this project to see whether that's available on your plan. Until then,
treat a merge to `main` as "ready to publish," not "published."

## Environment Variables

Names only — see `.env.example` for the full annotated list, and never
put real values in git.

| Variable | Where it's set |
|---|---|
| `FIREBASE_PROJECT_ID` | `.env` locally; AI Studio secrets in production |
| `GEMINI_API_KEY` | `.env` locally; AI Studio secrets in production (already configured there) |
| `N8N_ENABLED` | `.env` locally; AI Studio secrets in production |
| `N8N_WEBHOOK_URL` | `.env` locally; AI Studio secrets in production — **must** be set for production automations to fire, since the app's Settings document (Firestore) is shared between local and prod, and `localhost` URLs saved there are correctly ignored on Cloud Run |
| `N8N_ALLOWED_HOSTS` | `.env` locally; AI Studio secrets in production |
| `N8N_AUTH_TYPE`, `N8N_SECRET`, `N8N_AUTH_HEADER_NAME`, `N8N_BASIC_USER`, `N8N_BASIC_PASSWORD` | `.env` locally; AI Studio secrets in production, as needed by the auth type chosen |
| `N8N_INCOMING_SECRET` | AI Studio secrets in production only — disables `/api/webhooks/n8n/incoming` until set |
| `SWEEP_TOKEN` | AI Studio secrets in production only — disables `/api/internal/sweep` (scheduled reminders) until set |
| `DISPATCH_REQUIRE_AUTH` | `.env` locally (usually `false` for demo-persona testing); **must** be `true` in production |
| `VITE_DEMO_MODE` | `.env` locally only — never set in production; leaving it on there would remove the sign-in gate entirely |
| `INVOICE_REMINDER_LEAD_DAYS` | Optional, both environments |

GitHub Actions secrets: none required for the current CI workflow — it
only lints, tests, and builds, none of which need real credentials.

## Rollback

**Git side** — revert to any previous commit on `main`:

```bash
git log --oneline main          # find the commit to restore
git revert <bad-commit-sha>     # preferred: adds a new commit undoing it
# or, only if the bad commit was never deployed:
git reset --hard <good-commit-sha>
git push --force-with-lease origin main
```

**Production side** — per `DEPLOY.md`, AI Studio keeps previous revisions
of the Cloud Run service. Roll back to the revision before the bad deploy
from AI Studio's own interface; this does not touch Firestore data or
security rules.

## Important

- The GitHub repository **`gk27nov-source/smart_business_automation_hub`**
  is the single source of truth. Do not maintain parallel local folders as
  separate "versions" — branch and merge instead.
- A second remote, `gk27nov-source/gk27nov` (referred to as `aistudio` in
  some local checkouts), predates this unification and is running
  significantly older code. Do not develop against it. See the note in
  the repository's README/PR description for its current status.
- Never commit `.env`, `.env.local`, or any file containing real API keys,
  service-account JSON, or webhook secrets.
