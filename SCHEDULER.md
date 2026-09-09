# Scheduled reminders — setup

The three events a browser can never raise:

| Event | Fires when | Cadence | Sweep |
|---|---|---|---|
| `invoice_due` | 3 days before an invoice's due date | once per invoice, ever | `invoices` |
| `payment_reminder` | while an invoice is past due | once a week | `invoices` |
| `task_overdue` | within 24h of a task's due date, or past it | once per task per day | `tasks` |
| `sla_at_risk` | a ticket has consumed 80% of its SLA | twice per ticket: at-risk, then breached | `sla` |

A single-page app only emits events while somebody has a tab open, so none of
these ever happened before. That is why "Payment Reminder Broadcast" sat wired
to `callback_requested` and nobody noticed it had never fired.

The cadence is carried entirely by the idempotency key each sweep produces —
include the date and it can fire daily, omit it and it fires once ever, bucket
it by week and it nudges weekly. The dispatcher refuses a repeat inside its
window, so the key IS the policy. `server/due.test.ts` asserts each one.

---

## 1. The one prerequisite that is easy to miss

The sweep reads Firestore with the Admin SDK, which needs **Application Default
Credentials** — unlike ID-token verification, which needs only the project id.

**On Cloud Run (which is what AI Studio runs):** the service account attached to
the service must hold the **Cloud Datastore User** role (`roles/datastore.user`).
Nothing else to configure — ADC comes from the metadata server.

```bash
# Find the service account your Cloud Run service runs as, then:
gcloud projects add-iam-policy-binding spatial-sound-mxjsq \
  --member="serviceAccount:YOUR-SERVICE-ACCOUNT@spatial-sound-mxjsq.iam.gserviceaccount.com" \
  --role="roles/datastore.user"
```

**Locally:** either

```bash
gcloud auth application-default login
```

or point at a service-account key:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
```

If this is missing, the endpoint returns 500 with a message naming credentials —
it does not fail silently.

## 2. Secrets

```
SWEEP_TOKEN=<openssl rand -hex 32>
```

Set it in AI Studio's secrets panel. **Unset means sweeps are disabled** — the
endpoint answers 503 and no reminder fires. Failing closed is deliberate: this
endpoint makes the platform message real customers.

Optional:

```
INVOICE_REMINDER_LEAD_DAYS=3
```

## 3. Rebind the two mis-bound rules

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\key.json"
node scripts/rebind-rules.mjs org_smart_hub_01              # dry run
node scripts/rebind-rules.mjs org_smart_hub_01 --apply
```

| Rule | Was | Now |
|---|---|---|
| Payment Reminder Broadcast | `callback_requested` | `invoice_due` |
| Complaint Escalation & SLA Alert | `new_complaint` | `sla_at_risk` |

`callback_requested` is then free for a rule that genuinely means a callback.
Safe to run twice — a rule already on the target event is left alone.

## 4. The three Cloud Scheduler jobs

`APP_URL` is your Cloud Run service URL.

```bash
APP=https://your-service-url.run.app
TOKEN=your-sweep-token

# Invoices — daily at 09:00 IST. Morning, so a reminder does not arrive at 3am.
gcloud scheduler jobs create http sbah-invoice-sweep \
  --location=asia-south1 \
  --schedule="0 9 * * *" --time-zone="Asia/Kolkata" \
  --uri="$APP/api/internal/sweep" --http-method=POST \
  --headers="Content-Type=application/json,X-Sweep-Token=$TOKEN" \
  --message-body='{"kind":"invoices"}' \
  --attempt-deadline=300s

# Tasks — hourly at :15. The daily idempotency key means at most one nudge
# per task per day, however often this runs.
gcloud scheduler jobs create http sbah-task-sweep \
  --location=asia-south1 \
  --schedule="15 * * * *" --time-zone="Asia/Kolkata" \
  --uri="$APP/api/internal/sweep" --http-method=POST \
  --headers="Content-Type=application/json,X-Sweep-Token=$TOKEN" \
  --message-body='{"kind":"tasks"}' \
  --attempt-deadline=300s

# SLA — every 30 minutes, so an 80% threshold is caught close to when it is
# crossed rather than up to an hour later.
gcloud scheduler jobs create http sbah-sla-sweep \
  --location=asia-south1 \
  --schedule="*/30 * * * *" --time-zone="Asia/Kolkata" \
  --uri="$APP/api/internal/sweep" --http-method=POST \
  --headers="Content-Type=application/json,X-Sweep-Token=$TOKEN" \
  --message-body='{"kind":"sla"}' \
  --attempt-deadline=300s
```

Run one immediately to check it:

```bash
gcloud scheduler jobs run sbah-invoice-sweep --location=asia-south1
```

## 5. Verify by hand first

```bash
# No token — expect 401
curl -i -X POST "$APP/api/internal/sweep" \
  -H 'Content-Type: application/json' -d '{"kind":"invoices"}'

# With token — expect a report
curl -X POST "$APP/api/internal/sweep" \
  -H 'Content-Type: application/json' -H "X-Sweep-Token: $TOKEN" \
  -d '{"kind":"invoices"}'
```

A healthy response:

```json
{
  "ok": true,
  "report": {
    "kind": "invoices",
    "organizationsScanned": 1,
    "candidates": 2,
    "dispatched": 2,
    "suppressed": 0,
    "failed": 0,
    "errors": [],
    "durationMs": 1840
  }
}
```

Reading the report:

- **`organizationsScanned: 0`** — no `settings` documents exist. Sign in to the
  app once so the seed is written. (Organisations are enumerated from the
  `settings` collection, one document per org; there is no populated
  `organizations` collection to read yet.)
- **`candidates: 0`** — nothing is due, or the status strings in your data do
  not match what the sweep filters on. It expects invoices in
  `Sent | Unpaid | Pending | Partially Paid | Overdue | Draft`, tasks in
  `Not Started | In Progress | On Hold`, tickets in
  `New | Assigned | In Progress | Waiting for Customer`. Check these first.
- **`candidates > 0, dispatched: 0`** — no enabled rule subscribes to the event.
  Run the rebind script (step 3).
- **`suppressed > 0`** — duplicates correctly refused. Expected on a re-run.
- **`failed > 0`** — the response is **HTTP 207**, so the scheduler job shows as
  unhealthy rather than quietly succeeding. `errors[]` names each rule.

## 6. Costs to watch

Each sweep reads every open invoice, task and ticket per organisation. At pilot
scale that is a few hundred document reads a day — inside the Firestore free
tier. The SLA sweep is the heaviest because it runs 48 times a day; if the
ticket table grows large, narrow its query with a `dueDate` range and add the
composite index.

The costs that actually scale with your customers' customers are WhatsApp
conversations and SMS, not Firestore. Set a Cloud Billing budget alert before
turning the schedulers on.
