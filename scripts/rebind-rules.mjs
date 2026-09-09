#!/usr/bin/env node
/**
 * Rebind the two automation rules that are wired to the wrong trigger.
 *
 * Both were found during the audit: each rule's own description states a
 * time-based condition, while its triggerEvent is a creation event that can
 * never express one. So neither has ever fired the way it was written.
 *
 *   Payment Reminder Broadcast
 *     description: "...payment link reminder 3 days before invoice due date"
 *     was: callback_requested   →   now: invoice_due
 *
 *   Complaint Escalation & SLA Alert
 *     description: "...when critical support ticket crosses 80% SLA threshold"
 *     was: new_complaint        →   now: sla_at_risk
 *
 * Both target events only exist because the scheduler now raises them.
 *
 * Setup:
 *   Firebase console -> Project settings -> Service accounts
 *     -> Generate new private key. Save it OUTSIDE the repo.
 *   export GOOGLE_APPLICATION_CREDENTIALS=/absolute/path/to/key.json
 *
 * Usage:
 *   node scripts/rebind-rules.mjs <organizationId>            # show what would change
 *   node scripts/rebind-rules.mjs <organizationId> --apply    # write it
 *
 * It is safe to run twice: a rule already on the target event is left alone.
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const REBINDS = [
  { match: /payment reminder/i, from: 'callback_requested', to: 'invoice_due' },
  { match: /complaint escalation|sla alert/i, from: 'new_complaint', to: 'sla_at_risk' },
];

const [orgId, ...flags] = process.argv.slice(2);
const apply = flags.includes('--apply');

if (!orgId) {
  console.error('Usage: node scripts/rebind-rules.mjs <organizationId> [--apply]');
  process.exit(1);
}
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See the header of this file.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

const snap = await db.collection('automations').where('organizationId', '==', orgId).get();

if (snap.empty) {
  console.error(`No automation rules found for organisation "${orgId}".`);
  console.error('Sign in to the app once so the seed data is written, then run this again.');
  process.exit(1);
}

console.log(`\n${snap.size} rule(s) in ${orgId}:\n`);

let changes = 0;

for (const docSnap of snap.docs) {
  const rule = docSnap.data();
  const name = rule.name ?? docSnap.id;
  const event = rule.triggerEvent ?? '(none)';

  const rebind = REBINDS.find((r) => r.match.test(String(name)));

  if (!rebind) {
    console.log(`  ·  ${name.padEnd(38)} ${event}`);
    continue;
  }
  if (event === rebind.to) {
    console.log(`  ok ${name.padEnd(38)} ${event}  (already correct)`);
    continue;
  }
  if (event !== rebind.from) {
    console.log(
      `  ?  ${name.padEnd(38)} ${event}  (expected "${rebind.from}" — leaving it alone)`
    );
    continue;
  }

  changes++;
  console.log(`  →  ${name.padEnd(38)} ${event}  ->  ${rebind.to}`);
  if (apply) {
    await docSnap.ref.update({ triggerEvent: rebind.to, updatedAt: new Date().toISOString() });
  }
}

console.log('');
if (changes === 0) {
  console.log('Nothing to change.');
} else if (apply) {
  console.log(`Applied ${changes} rebind(s).`);
  console.log('\nThose rules now fire only when the scheduler raises their event, so make sure');
  console.log('the Cloud Scheduler jobs exist — see SCHEDULER.md.');
} else {
  console.log(`${changes} rebind(s) pending. Re-run with --apply to write them.`);
}
process.exit(0);
