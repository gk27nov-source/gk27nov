# Building the n8n side

Delivery is solved. At 11:39:26 the app posted to
`https://deepika18.app.n8n.cloud/webhook/8d2aa711-7061-44a4-9ad7-7f7cc2e5fbbe`
and n8n answered **HTTP 200**. That is the real status, from n8n, not the app's
opinion of itself.

What is left is the other half, and it has never been built: the workflow
receives the payload and stops at the Webhook node. Nothing sends a WhatsApp
message, nothing sends an email, and nothing composes a reply — so the app
shows a 200 with an empty response body, and no message arrives anywhere.

That is what "the webhook is not posting any response" is. Not a bug. An
unbuilt workflow.

---

## The app does the composing, not n8n

This matters, because it changes how much you have to build. The dispatcher
sends a payload with the message text **already written** for every event. You
are not writing templates in n8n; you are picking a field and handing it to a
sender node.

Every payload carries these, whatever the event:

| Field | What it holds |
|---|---|
| `event` | `new_lead`, `new_customer`, `new_complaint`, `task_overdue`, `invoice_due`, `document_uploaded` |
| `whatsappMessage` | Complete WhatsApp text, markdown-formatted, ready to send |
| `shortMessage` | One-line version, for SMS |
| `emailSubject` | Complete subject line |
| `emailBody` | Complete plain-text body |
| `emailHtml` | Same as HTML |
| `contactNumber` | Recipient phone, sanitised to international format |
| `customerEmail` | Recipient email |
| `recipientName` | Who it is addressed to |
| `recipientRole` | `customer` / `lead` / `employee` / `admin` / `partner` |
| `organizationName` | Your business name |
| `triggeredBy` | The signed-in user who caused the event |

Phone and email are aliased several ways (`phone`, `whatsappNumber`,
`mobileNumber`; `email`, `emailAddress`, `recipientEmail`) so that whichever
name an n8n node expects, it finds one. Event-specific fields — `amount`,
`invoiceNumber`, `ticketNumber`, `leadId` — are spread at the top level too, so
`{{ $json.amount }}` just works.

The payload is never sent to nobody: if neither a phone nor an email resolves,
the server refuses the dispatch with a 422 rather than substituting a
stand-in.

---

## 1. Make the workflow answer with something

Right now the Webhook node replies immediately with an empty body, which is
why the app's log shows a blank response next to its 200.

In the **Webhook** node, set **Respond** to `Using 'Respond to Webhook' node`.
Then add a **Respond to Webhook** node at the end of the workflow with a JSON
body:

```json
{
  "received": true,
  "event": "{{ $json.event }}",
  "workflow": "{{ $workflow.name }}",
  "executionId": "{{ $execution.id }}",
  "sentAt": "{{ $now }}"
}
```

Now the app's automation log shows that object as the response instead of
nothing, and the n8n execution id is right there when you need to trace one
dispatch back to one run.

Put this in last, after the sending nodes, so a 200 means the work actually
happened rather than only that the request arrived.

## 2. Route by event

Add a **Switch** node straight after the Webhook, on `{{ $json.event }}`, with
one output per event you care about. Six rules point at this one webhook, so
without a Switch every event runs every branch.

Start with `new_lead` alone. Get one path working end to end before adding the
other five — the same discipline that found the idempotency bug.

## 3. Send something

**WhatsApp** (WhatsApp Business Cloud node, or an HTTP Request to your
provider):

- To: `{{ $json.contactNumber }}`
- Body: `{{ $json.whatsappMessage }}`

**Email** (Gmail, SMTP, SendGrid — whichever you have):

- To: `{{ $json.customerEmail }}`
- Subject: `{{ $json.emailSubject }}`
- Body: `{{ $json.emailBody }}` (or `emailHtml` for an HTML node)

No templating needed in n8n. The strings are finished.

## 4. Activate, and check you are looking in the right place

The **Active** toggle, top-right, must be on. Production `/webhook/` URLs 404
while it is off — which is exactly the 404 you saw at 11:32.

Then watch **`deepika18.app.n8n.cloud/home/executions`**, not the workflow
canvas. Production runs never appear on the canvas; only test runs do. If the
executions list stays empty while the app reports 200, check that workflow's
Settings → **Save successful production executions**, which hides successful
runs when switched off.

---

## Optional: letting n8n talk back

If a workflow needs to report something back into the app — a delivery
receipt, a customer's reply — the app already exposes:

```
POST /api/webhooks/n8n/incoming
X-Hub-Secret: <N8N_INCOMING_SECRET>
```

It answers 503 until `N8N_INCOMING_SECRET` is set on the server, and 401 on a
wrong secret, compared in constant time. That is deliberate: an open endpoint
here would let anyone inject events into your organisation's data.

You do not need this for outbound WhatsApp and email. Only wire it if a
workflow genuinely has something to say back.

---

## One caveat about the live site

The deployed build is still the original pre-Phase-1 app — confirmed from its
own error wording and its hardcoded `89951fe9-…` fallback. The field names
above come from the current build.

Most fields are the same in both, but the current build wraps the payload in
an envelope that also carries `event`, `timestamp`, `source`, `triggeredBy`,
`organizationId`, `hasEmail` and `hasPhone` at the top level, and it removes
the hardcoded webhook fallback so the app can never silently call a dead
endpoint again.

So: build the workflow now against `{{ $json.whatsappMessage }}` and friends —
those hold in both. But deploy the current build before you rely on `event` for
Switch routing, or verify in an execution's input panel that the deployed
version is sending it.
