# AI Studio preview verification checklist

Run after `AI-STUDIO-PULL-PROCEDURE.md` completes and the preview is live,
before requesting production approval. Every item should be checked by a
human against the actual running preview — this is not a script, because
several items (browser console, visual correctness, sign-in flow) aren't
reliably automatable from outside the browser session.

## Server

- [ ] `GET /api/health` returns `200`
- [ ] Response body has `"status":"ok"`
- [ ] Response body has `"geminiConfigured":true` (if `false`, `GEMINI_API_KEY`
      is not configured in this environment — confirm whether that's expected)

## Authentication

- [ ] Google authentication works (sign-in completes, returns to the app)
- [ ] Custom claims are read correctly: sign in as a user with claims set
      via `scripts/set-claims.mjs`, confirm the app recognizes them
- [ ] `orgId` (the `organizationId` custom claim) is recognized — the signed-in
      user lands in the correct organization's data, not empty/wrong-org state
- [ ] `super_admin` role is recognized — role-gated UI/actions are available
- [ ] A user with no claims set is handled gracefully (not a crash)

## Firebase

- [ ] Firestore initializes without error (sidebar/status shows LIVE, not
      OFFLINE)
- [ ] A read against at least one collection succeeds (e.g. Dashboard loads
      real figures, not stuck on a loading state)

## Gemini

- [ ] Gemini Chat responds to a prompt (not the "[Offline AI Mode]" fallback,
      unless `GEMINI_API_KEY` is intentionally unset in this environment)
- [ ] Draft generation (`/api/gemini/generate-draft`) produces output
- [ ] Document summary (`/api/gemini/summarize-doc`) produces output

## n8n

- [ ] The configured n8n destination is a **production** host, not
      `localhost` / `127.0.0.1`
- [ ] The configured n8n destination is a **production** `/webhook/` URL,
      not a `/webhook-test/` URL
- [ ] A manual "Ping n8n Webhook" (or equivalent test trigger) reaches the
      expected outcome — either a real delivery (if n8n is enabled and
      reachable) or a clearly-labeled "Suppressed"/disabled state (if not) —
      never a silent failure reported as success

## Application modules load

- [ ] Dashboard
- [ ] Customers
- [ ] Leads
- [ ] Inventory
- [ ] Invoices & Quotes
- [ ] Tasks
- [ ] Communications
- [ ] Automation Center
- [ ] Complaints
- [ ] Documents
- [ ] Employees
- [ ] Settings
- [ ] Notifications
- [ ] Reports

Each should load without a blank screen, an unhandled error boundary, or a
stuck spinner.

## Browser console

- [ ] Open DevTools console, reload the app, and exercise the modules above
- [ ] No **critical** errors (uncaught exceptions, failed critical resource
      loads, React error boundaries triggering)
- [ ] Note any warnings for the record, but a warning alone does not block
      this checklist — use judgment on severity

## Outcome

If every box above is checked: the preview is verified. Print (or state, for
a human-driven checklist) exactly this line and stop — do not publish from
here:

```
READY FOR PRODUCTION APPROVAL
```

Publication is a separate, explicit, human-approved action — see
`DEPLOYMENT-WORKFLOW.md`'s "Human approval" stage. This checklist's job ends
at producing that line, not at clicking publish.

If any box fails: do not proceed to approval. Fix the underlying issue back
in Claude Code / localhost, go through `npm run release:check` again, land
it on `main`, tag a new candidate, and re-pull into AI Studio. Do not patch
the issue inside AI Studio's own editor — that would make AI Studio an
authoring source, which is the one thing this whole workflow exists to
prevent.
