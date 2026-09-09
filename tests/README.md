# Security-rules tests

35 assertions against `firestore.rules`, run on the Firestore emulator.

**These have not been executed.** They were written here but could not be run:
this sandbox blocks `storage.googleapis.com`, which is where the Firestore
emulator JAR is downloaded from. Run them locally before deploying the rules —
they are the verification for the privilege-escalation fix, so do not skip them.

```bash
npm install --save-dev firebase-tools @firebase/rules-unit-testing firebase
npx firebase emulators:exec --only firestore --project demo-sbah "node tests/rules.test.mjs"
```

Expect `35 passed, 0 failed`. A failure names the assertion.

What they prove:

- **Escalation is closed.** A staff user cannot write `role` or
  `organizationId` to their own `users/{uid}` document, while still being able
  to change their display name. This was the hole: the old rules allowed
  self-update on the same document every other rule read the role from.
- **Tenant isolation.** No cross-org reads; a record cannot be created stamped
  with another organisation's id; an existing record cannot be re-stamped.
- **Role ladder.** viewer reads only; staff writes but cannot delete; manager
  deletes operational records; business_admin owns configuration.
- **Automation config is admin-only** — it decides where customer messages are
  sent, so staff cannot repoint a webhook.
- **Audit trail is server-written.** Nobody, including business_admin, can
  forge or erase an `automationLogs` entry. Previously any non-viewer could
  create, update and delete them.
- **Financial guards.** Staff cannot delete invoices; a paid invoice cannot be
  deleted at all.
- **Notifications** can be marked read but not rewritten.
- **Unauthenticated, and signed-in-without-claims, get nothing.**
