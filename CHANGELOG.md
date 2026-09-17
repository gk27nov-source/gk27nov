# Changelog

All notable changes to Smart Business Automation Hub are recorded here, one
version section per tagged release. See `RELEASE-TAGGING.md` for how
versions are chosen and `releases/` for the per-version verification record.

This file only documents what shipped in a *tagged* release. Day-to-day
development on `integration/*` branches is not recorded here until it lands
on `main` and is tagged.

## [v1.0.0 (proposed)] — 2026-09-17

First tagged release under the formal release workflow (`DEPLOYMENT-WORKFLOW.md`).
Nothing before this point was version-tagged, so this entry covers the
verified state of `main` at commit `b809c37807355386cdb449739e2919ede81f341c`
as a whole, not a delta from a previous tag.

### Added

- "Log Callback Request" action in Communications, wired to a dedicated
  `callback_requested` automation rule (`auto_07`, "Customer Callback Request
  Alert"). The `callback_requested` event existed in seed data before this
  but nothing in the codebase ever fired it.
- `N8N_WEBHOOK_BASE_URL` accepted as an alias for `N8N_WEBHOOK_URL`, for n8n
  setups whose own documentation uses that name.
- Boot-time and in-app warnings when a configured n8n webhook URL is a
  `/webhook-test/` (editor-only) URL rather than a production `/webhook/`
  URL — surfaced in the sidebar status indicator, the dashboard status chip,
  the Automation Center, and Settings.
- Structured JSON dispatch logging (`server/dispatch.ts`), one line per
  attempt, with a fixed outcome vocabulary (`delivered`, `failed`,
  `disabled`, `duplicate`, `dry_run`) and webhook-URL redaction so a log
  line never carries the path segment that doubles as the webhook's own
  bearer token under `N8N_AUTH_TYPE=none`.
- `eventId` / `recordId` fields propagated through dispatch requests and
  webhook payloads, so a delivery can be traced end to end across the app,
  server logs, and n8n by one shared identifier.
- `scripts/pre-release-check.mjs` and `npm run release:check` — repository
  and secret-hygiene safety gate for production releases.
- `releases/`, `CHANGELOG.md`, `RELEASE-TAGGING.md`,
  `AI-STUDIO-PULL-PROCEDURE.md`, `PREVIEW-VERIFICATION.md`,
  `PRODUCTION-SMOKE-TEST.md`, `ROLLBACK.md`, and `DEPLOYMENT-WORKFLOW.md` —
  the release process itself.

### Changed

- "Payment Reminder Broadcast" (`auto_05`) trigger event corrected from
  `callback_requested` to `invoice_due` — the event the scheduled sweep
  actually raises three days before an invoice's due date.
- "Complaint Escalation & SLA Alert" (`auto_03`) trigger event corrected
  from `new_complaint` to `sla_at_risk` — a creation event can't express
  "crossed 80% of its SLA window"; only the scheduled sweep can.
- Manual "Test Trigger" (Automation Center) and the dashboard's manual
  automation ping no longer default to a real customer's or lead's contact
  details; both now use obviously-fake placeholder data
  (`automation-test@example.com`, `+10000000000`).
- Gemini model updated from `gemini-2.5-flash` to `gemini-3.6-flash` across
  `/api/gemini/chat`, `/api/gemini/generate-draft`, and
  `/api/gemini/summarize-doc` in `server.ts`.
- `N8N_SECRET`, `N8N_BASIC_USER`, and `N8N_BASIC_PASSWORD` documented as
  optional in `.env.example`, matching what `server/config.ts` already
  defaults them to when `N8N_AUTH_TYPE=none`.

### Fixed

- Invalid-date display in Stock Transfer Audit (was reading a field the
  record doesn't have) and in Notifications (same class of bug).
- The n8n webhook URL field in Settings no longer requires a value to save,
  with a "leave blank to disconnect" affordance replacing the previous
  forced-non-empty behavior.

### Security

- Removed hardcoded, secret-shaped API key literals that shipped in the
  client bundle: six `apiKey` string literals in `src/data/seedData.ts`'s
  seeded automation rules, the seeded `n8nApiKey` in `initialSettings`, and
  `SettingsView`'s form-default literal. All now default to an empty
  string; the real credential lives only in the server-side `N8N_SECRET`
  environment variable, never in seed data or the browser bundle.

### Automation

- Both known trigger-event mismatches between a rule's stated purpose and
  what it was actually bound to are now corrected (see Changed, above).
- The callback-request workflow is now a real, end-to-end feature rather
  than an event with a payload builder and a seeded rule but no way to
  fire it.

### Infrastructure

- No changes to Cloud Run, Firebase, or Docker configuration in this
  release. `Dockerfile`, `firebase.json`, and `.firebaserc` are unchanged
  from the deployment-file restoration that established the current
  baseline.
