# Deploying the current build

The live site at `smart-business-automation-hub.ai.studio` is still the code
from before any of this work: no sign-in gate, the Super Admin profile loaded
on page load, and every figure on the dashboard hardcoded. It also talks to
`spatial-sound-mxjsq`, the AI Studio project you do not own.

Everything since then exists only on your machine. This is how it gets out.

The data on the live site today is the fictional seed set, so nothing real is
exposed right now. That stops being true the moment anyone enters a real
customer into it — which is exactly what a demo invites.

---

## The shape of what you are deploying

One thing is unusual and worth holding in your head, because two steps below
only make sense once you see it:

**The Cloud Run service lives in `spatial-sound-mxjsq`. The Firebase project
the app uses is `smart-business-automation-hub`.** Two different Google Cloud
projects.

That is fine, and it is not a workaround:

- **Auth and Firestore** are reached by the *browser*, using the client config
  in `firebase-applet-config.json`. The hosting project is irrelevant to them.
- **Token verification on the server** needs only `FIREBASE_PROJECT_ID`. The
  Admin SDK fetches Google's public signing certificates and checks the
  signature itself — no credentials.
- **The scheduled sweeps** are the exception. They read Firestore with the
  Admin SDK, which needs real credentials for the project holding the data.
  That is a cross-project grant, and it is step 5.

You cannot host this on Firebase Hosting in the new project instead: Hosting on
the Spark plan serves static files, and this app needs its Express server for
`/api/gemini/chat` and `/api/webhooks/n8n/dispatch`. AI Studio's Cloud Run is
the pragmatic host.

---

## 1. Authorized domains, on the NEW project

Before anything is deployed. Otherwise the new build lands and nobody can sign
in, and you will think the deploy broke it.

```
https://console.firebase.google.com/project/smart-business-automation-hub/authentication/settings
```

Under **Authorized domains**, add both:

```
smart-business-automation-hub.ai.studio
smart-business-automation-hub-785323626323.asia-southeast1.run.app
```

You are the owner of this project, so **Add domain** works here — unlike the
Starter Tier project, where it refused all day.

## 2. Check the config file is the new project's

```powershell
(Get-Content "$HOME\sbah-final\firebase-applet-config.json" | ConvertFrom-Json).projectId
```

Must print `smart-business-automation-hub`. This file is what ships in the
bundle; if it still says `spatial-sound-mxjsq`, the deployed app will talk to
the old project and none of today's work will show.

## 3. Deploy

Push `$HOME\sbah-final` through AI Studio the same way you have before.

Do not ship these — they are local-only and would break the deployment:

- `.env` — Cloud Run gets its own values in step 4. `N8N_ALLOWED_HOSTS` in a
  committed file is also the sort of thing that quietly goes stale.
- `SSL_KEY_FILE` / `SSL_CERT_FILE` — those exist for the mkcert setup in
  LOCAL-DEV.md. On Cloud Run they would make the server speak HTTPS to a proxy
  that is already terminating TLS, and every request would fail.
- `package-lock.json` — it was generated on Linux here and has bitten this
  project twice already.

## 4. Environment variables, in AI Studio's secrets panel

```
FIREBASE_PROJECT_ID       smart-business-automation-hub
N8N_AUTH_TYPE             none
GEMINI_API_KEY            (already set — leave it)
```

Then **one of the two n8n blocks below** — read the next section first and pick
deliberately, because the default choice here is now wrong for your setup.

Add when you get to them:

```
SWEEP_TOKEN               openssl rand -hex 32   — unset means no reminder ever fires
N8N_INCOMING_SECRET       openssl rand -hex 32   — unset means /incoming answers 503
```

Both fail closed on purpose. An unset `SWEEP_TOKEN` disables the endpoint that
makes the platform message real customers; leaving that open by default would
be the wrong way round.

### 4a. The n8n problem this deploy creates

Your Settings document lives in Firestore, and **local and production read the
same one**. It currently holds your local n8n URL:

```
http://localhost:5678/webhook/17735715-e0df-4114-9c63-7fbe216dc0a2
```

On Cloud Run, `localhost` is the *container itself*. There is no n8n there. So
the deployed server resolves a webhook URL like this
(`resolveWebhookUrl` in `server/dispatch.ts`):

1. `N8N_RULE_URLS[ruleId]` — server-pinned, unset
2. the Settings URL, **if its host is in `N8N_ALLOWED_HOSTS`** — `localhost`
   will not be, and must not be
3. `N8N_WEBHOOK_URL` — the server's own default

Which means: if you leave `N8N_WEBHOOK_URL` unset, every dispatch in production
is refused. The automation you just got working locally will not work live.
That is the fallback added for exactly this case, and it only helps if you set
it.

Do not "fix" this by putting the cloud URL into Settings — that breaks local
dev, and you are back to one document that cannot be right for both.

**Option A — n8n live in production.** Requires the workflow to exist and be
*activated* on `deepika18.app.n8n.cloud`, not just locally. Copy its
production `/webhook/` URL (the Webhook node shows Test and Production URLs
separately) and set:

```
N8N_ENABLED               true
N8N_ALLOWED_HOSTS         deepika18.app.n8n.cloud
N8N_WEBHOOK_URL           https://deepika18.app.n8n.cloud/webhook/<id>
```

Local keeps using localhost from Settings; production ignores it and uses this.
The server logs a `[dispatch] Host "localhost" is not in N8N_ALLOWED_HOSTS …
using this server's N8N_WEBHOOK_URL instead` line each time, which is expected
and is the thing to grep for if you doubt which URL was used.

**Option B — deploy without n8n, turn it on later.**

```
N8N_ENABLED               false
```

Everything else goes live: the sign-in gate, the real dashboard figures, the
Firestore migration, all of Phase 4. Automation dispatches return
`status: 'skipped'` and the Automation Center logs them as **Suppressed** in
amber — honestly reported as not-sent, not a fake green tick. That distinction
is the fix from the diagnostic pass; this is it doing its job.

Pick B if the workflow is not published on the cloud instance yet. Deploying
with `N8N_ENABLED=true` and no reachable n8n just means every automation shows
a red Failed.

## 5. The cross-project grant, for scheduled sweeps

Skip this until you actually turn the schedulers on — but nothing in
SCHEDULER.md works without it.

The Cloud Run service runs as a service account belonging to
`spatial-sound-mxjsq`. It needs permission to read Firestore in
`smart-business-automation-hub`. You own the second project, so you can grant
it:

```bash
gcloud projects add-iam-policy-binding smart-business-automation-hub \
  --member="serviceAccount:YOUR-CLOUD-RUN-SA@spatial-sound-mxjsq.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

Find the actual service account on the Cloud Run service's detail page, under
Security. If this is missing, `/api/internal/sweep` returns 500 with a message
naming credentials — it does not fail silently.

## 6. Verify, in this order

Each step tells you something the next one assumes.

```bash
curl https://smart-business-automation-hub.ai.studio/api/health
```

Expect `{"status":"ok", ... "geminiConfigured":true}`. If this returns HTML,
the server did not start and everything below is noise.

Then in a browser:

1. **You are asked to sign in.** If the workspace loads without asking, the old
   build is still live — that is the single most important thing to confirm.
2. Sign in. The dashboard opens.
3. **Bottom-left says LIVE**, not OFFLINE. Firestore is reachable with the
   deployed origin.
4. Dashboard figures match what you see locally — same project, same data.
5. **Ping n8n Webhook**, and read the result against what you chose in 4a:
   - Option A: expect a green **Success** with a real HTTP status, and a
     matching execution in the n8n cloud editor. If the execution count does
     not move, the dispatch did not reach n8n whatever the app says.
   - Option B: expect amber **Suppressed**, reason `N8N_ENABLED is false on the
     server`. That is the correct result, not a failure.
   - A `/webhook-test/` URL is refused outright in production regardless — that
     path only answers while the n8n editor is armed. Confirmed baked in: the
     build folds the check to `if (true)`.

## 7. If it goes wrong

AI Studio keeps previous revisions; roll back to the one before this deploy.
Nothing here touches Firestore data or the security rules, so a rollback costs
you the new build and nothing else.

The two failures worth recognising on sight:

- **`auth/unauthorized-domain` on the live site** — step 1 was skipped, or the
  hostname is spelled differently from what is in the list.
- **Signed in, but everything empty and OFFLINE** — the deployed bundle carries
  the old `firebase-applet-config.json`. Step 2.

---

## Then

- **n8n**: publish the workflow, swap Settings to the `/webhook/` URL, and add
  the nodes that actually send something. Right now the payload arrives and
  stops at the Webhook node.
- **SCHEDULER.md**: `SWEEP_TOKEN`, the grant in step 5, `rebind-rules.mjs`
  (two rules are still bound to events that cannot express what their own
  descriptions promise), then the three Cloud Scheduler jobs. Use
  `--location=asia-southeast1` to match the service.
- **`npm run test:rules`**: 35 tests, never once run — the emulator JAR could
  not be downloaded from this environment. Needs Java. The rules changed twice
  on 8 September, and they are the only thing standing between a signed-in user
  and someone else's organisation.
