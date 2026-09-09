#!/usr/bin/env node
/**
 * What is actually in Firestore, per collection, for one organisation.
 *
 * The sidebar's OFFLINE badge reports the worst status across fourteen
 * listeners, but not WHICH one failed — that detail is a console.warn inside
 * the browser, where the listener lives. This script cannot see that warning.
 * What it can do is show the state of the data itself, from the other side, and
 * that is usually enough to tell a rules problem from a missing-document one.
 *
 * It uses the Admin SDK, which BYPASSES security rules. So:
 *
 *   - A collection listed here with documents, while the app says offline,
 *     means the data is fine and the RULES are refusing the read.
 *   - A collection showing "missing" or 0 means the client never managed to
 *     write it — usually because the seeding write was denied.
 *
 * Usage (PowerShell):
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\serviceAccountKey.json"
 *   node scripts/check-sync.mjs org_smart_hub_01
 */

import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const orgId = process.argv[2] || 'org_smart_hub_01';

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  console.error('GOOGLE_APPLICATION_CREDENTIALS is not set. See the header of this file.');
  process.exit(1);
}

initializeApp({ credential: applicationDefault() });
const db = getFirestore();

/** The fourteen slices the sidebar's status is computed from. */
const COLLECTIONS = [
  'customers', 'leads', 'complaints', 'tasks', 'users', 'quotations', 'invoices',
  'documents', 'communications', 'automations', 'automationLogs', 'notifications',
  'activityLogs',
];

console.log(`\nOrganisation: ${orgId}\n`);

/* The settings document first — it is addressed directly by organisation id,
   and it is the one the client reads BEFORE it exists in order to seed it. */
const settingsRef = db.collection('settings').doc(orgId);
const settings = await settingsRef.get();

if (!settings.exists) {
  console.log('  settings          MISSING');
  console.log('                    The client could not create it. Its seeding write was denied.');
} else {
  const data = settings.data() ?? {};
  const stampedOrg = data.organizationId;
  console.log(`  settings          ok`);
  if (stampedOrg !== orgId) {
    console.log(`                    organizationId is "${stampedOrg}", expected "${orgId}".`);
    console.log('                    keepsOrg() in the rules will refuse every update to it.');
  }
  console.log(`                    n8nEnabled=${data.n8nEnabled}  n8nWebhookUrl=${data.n8nWebhookUrl || '(empty)'}`);
}

console.log('');

let anyEmpty = false;

for (const name of COLLECTIONS) {
  const snap = await db.collection(name).where('organizationId', '==', orgId).count().get();
  const n = snap.data().count;
  if (n === 0) anyEmpty = true;
  console.log(`  ${name.padEnd(18)}${n === 0 ? 'EMPTY' : `${n} document(s)`}`);
}

console.log('');

if (!settings.exists) {
  console.log('Read this as: the settings document is the failing slice.');
  console.log('Check that the published rules contain, under match /settings/{docId}:');
  console.log('    allow get: if canReachOrg(docId);');
  console.log('A rule of `allow get, list: if ownsExisting();` cannot work here — the');
  console.log('document does not exist yet, so resource is null and the read is denied');
  console.log('before the client ever gets the chance to create it.');
} else if (anyEmpty) {
  console.log('Read this as: an EMPTY collection above is the likely failing slice —');
  console.log('its seeding write was refused. Check that collection in the rules.');
} else {
  console.log('All fourteen slices hold data, so nothing is missing on the server.');
  console.log('An offline badge with this output means a READ is being refused, and');
  console.log('only the browser console names which one:');
  console.log('    F12 -> Console -> filter [sync]');
}

console.log('');
process.exit(0);
