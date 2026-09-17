# Production smoke test

Run immediately after publishing, against the live production URL. This is
the last check before calling a release complete — it exists to catch
anything that differs between the AI Studio preview environment and actual
production (different secrets, different Firestore data, different Cloud
Run scaling behavior) that `PREVIEW-VERIFICATION.md` couldn't have caught.

Keep this list in sync with `PREVIEW-VERIFICATION.md`'s module list — smoke
test is the same shape, run against production instead of preview, and
narrower (spot-check the golden path per module, not exhaustive).

## Before starting

- [ ] `GET /api/health` on the production URL returns `200`,
      `"status":"ok"`
- [ ] Open browser DevTools (Console + Network tabs) before touching
      anything else, so early errors aren't missed

## Per-module golden-path check

- [ ] **Authentication** — sign in with a real account; confirm claims
      (`orgId`, role) are recognized and the correct organization's data
      loads
- [ ] **Dashboard** — figures render, n8n status indicator shows a real
      state (not stuck loading)
- [ ] **Customers** — list loads; open one record
- [ ] **Leads** — list loads; open one record
- [ ] **Inventory** — module loads; stock figures render
- [ ] **Invoices** — list loads; open one invoice
- [ ] **Tasks** — list loads
- [ ] **Communications** — view loads
- [ ] **Callback Request** — submit one "Log Callback Request"; confirm it
      appears in the communications log and the automation fires (or is
      correctly reported as suppressed/disabled, per n8n config)
- [ ] **Automation Centre** — rule list loads; trigger-event bindings for
      "Payment Reminder Broadcast" (`invoice_due`) and "Complaint Escalation
      & SLA Alert" (`sla_at_risk`) show correctly
- [ ] **Payment Reminder** — confirm the rule is bound to `invoice_due` (not
      `callback_requested`)
- [ ] **Complaint Escalation** — confirm the rule is bound to `sla_at_risk`
      (not `new_complaint`)
- [ ] **n8n dispatch** — one manual test trigger reaches its expected
      outcome (delivered, or cleanly suppressed — never silently swallowed)
- [ ] **Gemini Chat** — one prompt gets a live response
- [ ] **Email Draft** (`generate-draft`) — produces output
- [ ] **Document Summary** (`summarize-doc`) — produces output
- [ ] **Settings** — loads; n8n webhook URL field shows the production
      destination, not a local one
- [ ] **Documents** — list loads
- [ ] **Employees** — list loads
- [ ] **Complaints** — list loads

## Cross-cutting checks

- [ ] **`/api/health`** — re-check after exercising the modules above (not
      just once at the start)
- [ ] **Browser console** — no critical errors accumulated during the pass
- [ ] **Network tab** — no unexpected 4xx/5xx on requests the app made
      during normal use
- [ ] **Firebase access** — Firestore reads/writes succeeded throughout
      (no OFFLINE indicator, no permission-denied errors)
- [ ] **n8n response** — the destination reached during this pass is the
      correct production n8n host, confirmed by checking the actual
      execution appeared in n8n's own editor/execution log if n8n is
      enabled

## Outcome

All boxes checked → release complete. Update `releases/vX.Y.Z.md`'s
`Production status` field to `Published <date>`.

Any box fails → this is a production incident, not a checklist item to
retry. Follow `ROLLBACK.md`.
