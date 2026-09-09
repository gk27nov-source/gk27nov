# Phase 4 — honesty in the UI, and a first paint worth having

Phases 1–3 dealt with things that were wrong underneath: nobody had to sign in,
state never left the browser, the scheduled events never fired. Phase 4 is
about the surface — the places where the interface asserted something it had no
way of knowing, and the weight of the bundle that carried it.

Nothing here changes the Firebase, AI Studio or n8n configuration.

---

## 1. The sidebar badge that was always green

`Sidebar.tsx` rendered this, unconditionally:

```tsx
<span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
n8n Webhook Online
```

Two literal strings and a pulsing green dot. It said "online" with n8n switched
off in Settings, with no webhook URL saved, and while every dispatch in the log
was failing. The "AI Ready" label next to it was the same.

It now derives from state that exists:

| What is true | Badge |
|---|---|
| `n8nEnabled` is false | grey — **n8n Disabled** |
| enabled, but no URL saved on Settings or any enabled rule | amber — **n8n Not Configured** |
| configured, most recent log entry failed | red — **n8n Last Run Failed** (rule and error in the tooltip) |
| configured, nothing dispatched yet | green, no pulse — **n8n Configured** |
| configured, last dispatch succeeded | green, pulsing — **n8n Webhook Online** (timestamp in the tooltip) |

There is no health ping to n8n and there cannot be one from the browser: CORS
blocks it, and the credential lives on the server. So "online" here means
*configured, and the last thing we sent did not fail* — the strongest claim the
client can honestly make. The right-hand label now shows the real Firestore
sync state (Live / Cached / Offline) instead of "AI Ready".

## 2. Five staff, one phone number

`EmployeesView.tsx` rendered `emp.mobile || '+91 98450 12345'`. The user records
carry `phone`, not `mobile` — so the fallback won every time and all five staff
cards displayed the same made-up number.

Now: `emp.mobile || emp.phone`, rendered as a `tel:` link, and *No number on
file* in grey italics when there is neither. A placeholder shaped like a real
phone number is worse than a blank, because eventually somebody dials it.

The edit dialog had the same defect one step further along — it pre-filled
`'+91 98000 12345'`, so opening a colleague's record and pressing Save wrote a
fake number onto a real person. It pre-fills empty now.

## 3. One manager, two names

Two invoices carried `createdBy: 'user_mgr_03'` with
`createdByName: 'Rohan Verma'`, while user_mgr_03 is **Rohit Kulkarni**
everywhere else. The same person, two names, depending on the screen.

The stored copy is fixed in the seed data, but the shape of the bug matters
more than the instance: every record in this application denormalises a name
next to a uid, so renaming anyone in Team & RBAC leaves the old name on every
record they ever touched.

`src/utils/people.ts` adds a resolver with one rule — **the uid is the truth,
the stored name is the fallback**:

```ts
const nameOf = useMemo(() => makeNameResolver(employees), [employees]);
// …
{nameOf(task.assignedToId, task.assignedToName)}
```

If the uid resolves to somebody on the team, their current name is shown. If it
resolves to nobody — they left, or the record predates them — the stored name is
all there is, so that is shown. Wired into Tasks, Customers, Leads and
Communications.

## 4. The dashboard stopped making things up

Covered in the code but worth listing, since these were the figures a visitor
would read first:

- `+18.4% MoM`, `+18% MoM` — now computed from `createdAt` across six rolling months
- `99.8% Success` (twice) — now the real ratio from the automation log
- `angoori.app.n8n.cloud` — now the host from the configured webhook URL
- `₹14.1L / ₹11.6L / ₹10.3L` bar chart with `maxVal = 14` — now real monthly revenue, scaled to it
- a `320000` revenue floor and a `+ 2400` padding added to the execution count — both removed

And the three "Gemini Business Insights" cards, which were fixed paragraphs
naming *Vertex Corp* and *Global Systems* — companies that exist nowhere in the
data — and quoting "₹12.5k" in an application where everything else is in
lakhs. `useGeminiInsights` now asks the model over the endpoint that was
already deployed and working, and when it cannot — no key, no network, a
refusal — it says so on the panel. It does not fall back to invented text: a
plausible-looking insight that nobody generated is worse than an empty panel,
because it gets acted on.

## 5. Documents that were never stored

The upload form reads a file, saves `fileUrl: '#'`, and discards it. The
Download button showed a *"Preparing download…"* toast and did nothing. The
seed rows point at `example.com`, a reserved domain that will never serve
anything.

There is no storage bucket behind this module. Rather than pretend:

- Download is a real link when the record points at a real file, and a disabled
  button with *"No file stored for this record"* otherwise.
- Saving an upload now says plainly that the record was catalogued but the file
  was not uploaded.
- A record with no file gets `fileSize: '—'` and `fileType: 'unknown'`, not the
  invented `1.2 MB` / `application/pdf` it used to get.

**This is the one item in Phase 4 that is a missing feature rather than a
fixed bug.** Wiring Firebase Storage is a contained piece of work — a bucket,
storage rules matching the Firestore ones, and an upload call — but it needs its
own deploy step, so it is called out here rather than done quietly.

## 6. Two invented contacts that defeated a server guard

`server.ts` refuses a webhook payload it cannot address:

```ts
if (!hasEmail && !hasPhone) return res.status(422).json({ … });
```

That guard was dead. Two call sites filled the gap before it could fire —
`AppContext` fell back to `'+91 98201 94821'` / `'customer@example.com'` when a
customer had no contact details, and `InventoryContext` did the same with
`'client@example.com'`. Every payload looked addressable, so n8n was handed a
real-looking stranger's number and told to message it.

Both now pass `undefined`, and the refusal works. The message *templates* in
`webhookPayloadBuilder` print "not on file" instead of a fabricated number,
for the same reason: a WhatsApp message telling a salesperson to call
+91 98201 94821 within 15 minutes is a real phone call to a real stranger.

## 7. First paint

The whole application arrived in one 2 MB bundle before anything could render.

```
before   index.js                     2,005 kB   (494 kB gzip)   — everything

after    index.js                       268 kB    (68 kB gzip)
         vendor-react.js                194 kB    (61 kB gzip)
         vendor-firebase.js             695 kB   (172 kB gzip)
         ─────────────────────────────────────────────────────
         first paint                  1,157 kB   (300 kB gzip)   −39%

         vendor-charts.js               406 kB   (117 kB gzip)   Inventory only
         InventoryModule.js             159 kB    (29 kB gzip)   on demand
         + 12 more view chunks       4.6–92 kB each              on demand
```

Two changes. `App.tsx` loads each view through `React.lazy`, behind a
`Suspense` boundary with a quiet spinner — Dashboard deliberately stays eager,
since it is what renders on sign-in and splitting it would only put a round trip
in front of the first screen. And `vite.config.ts` pulls Firebase, React and
Recharts into their own chunks: they download in parallel rather than in
sequence, and they stay in cache across deploys, where before a one-line copy
change forced a fresh 700 kB of Firebase down the wire.

Recharts is imported only by the inventory module, so its 406 kB is never
fetched by someone who does not open Inventory.

---

## Still open

- **Firebase Storage for documents** — section 5. The only missing feature, not
  a bug.
- **`npm run test:rules`** — 35 tests written against the security rules,
  never run here: the emulator JAR download is blocked from this environment.
  Needs Java on your machine. Run it before deploying rules.
- The pitch deck items you listed: contact details on slide 14, co-founders on
  slide 13, verify the MSME figures, validate the pricing, add screenshots.
