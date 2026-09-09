/**
 * Security-rules tests for Smart Business Automation Hub.
 *
 * Run: npx firebase emulators:exec --only firestore --project demo-sbah \
 *        "node rules.test.mjs"
 *
 * The point of these is not coverage — it is to prove that the specific holes
 * found in the previous rules are actually closed, and that ordinary work still
 * works afterwards.
 */

import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const ORG = 'org_smart_hub_01';
const OTHER_ORG = 'org_rival_02';

let passed = 0;
const failures = [];

async function check(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok    ${name}`);
  } catch (err) {
    failures.push(`${name} — ${err.message?.split('\n')[0] ?? err}`);
    console.log(`  FAIL  ${name}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-sbah',
  firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
});

/** A signed-in client carrying role + organizationId as custom claims. */
const as = (uid, role, organizationId = ORG) =>
  testEnv.authenticatedContext(uid, { role, organizationId }).firestore();

const anon = () => testEnv.unauthenticatedContext().firestore();

// Seed data bypassing rules, so tests exercise reads/writes not setup.
await testEnv.withSecurityRulesDisabled(async (ctx) => {
  const d = ctx.firestore();
  await setDoc(doc(d, 'users/u_staff'), {
    organizationId: ORG, role: 'staff', displayName: 'Ananya Iyer', email: 'a@x.test',
  });
  await setDoc(doc(d, 'users/u_admin'), {
    organizationId: ORG, role: 'business_admin', displayName: 'Pooja Sharma', email: 'p@x.test',
  });
  await setDoc(doc(d, 'customers/c_ours'), { organizationId: ORG, fullName: 'Rajesh Narang' });
  await setDoc(doc(d, 'customers/c_theirs'), { organizationId: OTHER_ORG, fullName: 'Someone Else' });
  await setDoc(doc(d, 'invoices/inv_unpaid'), { organizationId: ORG, invoiceNumber: 'INV-1', amountPaid: 0 });
  await setDoc(doc(d, 'invoices/inv_paid'), { organizationId: ORG, invoiceNumber: 'INV-2', amountPaid: 88500 });
  await setDoc(doc(d, 'automationLogs/log_1'), { organizationId: ORG, status: 'Success' });
  await setDoc(doc(d, 'automations/auto_1'), { organizationId: ORG, name: 'Lead Follow-up', isEnabled: true });
  await setDoc(doc(d, 'notifications/n_1'), { organizationId: ORG, title: 'Hi', isRead: false });
  await setDoc(doc(d, 'settings/app'), { organizationId: ORG, n8nWebhookUrl: 'https://x.test/webhook/a' });
  await setDoc(doc(d, 'organizations/' + ORG), { name: 'Apex Industrial Solutions' });
});

console.log('\nPrivilege escalation — the hole that mattered most');

await check('staff CANNOT write role to their own user doc', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'users/u_staff'), { role: 'super_admin' }))
);

await check('staff CANNOT move themselves to another organisation', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'users/u_staff'), { organizationId: OTHER_ORG }))
);

await check('staff CAN still update their own display name', () =>
  assertSucceeds(updateDoc(doc(as('u_staff', 'staff'), 'users/u_staff'), { displayName: 'Ananya I.' }))
);

await check('staff CANNOT create a user record at all', () =>
  assertFails(setDoc(doc(as('u_staff', 'staff'), 'users/u_new'), { organizationId: ORG, role: 'staff' }))
);

await check('business_admin CAN create a user record in own org', () =>
  assertSucceeds(setDoc(doc(as('u_admin', 'business_admin'), 'users/u_new2'), {
    organizationId: ORG, role: 'staff', displayName: 'New Hire',
  }))
);

await check('business_admin CANNOT plant a user in another org', () =>
  assertFails(setDoc(doc(as('u_admin', 'business_admin'), 'users/u_new3'), {
    organizationId: OTHER_ORG, role: 'staff',
  }))
);

console.log('\nTenant isolation');

await check('staff CAN read a customer in own org', () =>
  assertSucceeds(getDoc(doc(as('u_staff', 'staff'), 'customers/c_ours')))
);

await check('staff CANNOT read a customer in another org', () =>
  assertFails(getDoc(doc(as('u_staff', 'staff'), 'customers/c_theirs')))
);

await check('staff CANNOT create a customer stamped with another org', () =>
  assertFails(setDoc(doc(as('u_staff', 'staff'), 'customers/c_evil'), {
    organizationId: OTHER_ORG, fullName: 'Injected',
  }))
);

await check('staff CAN create a customer stamped with own org', () =>
  assertSucceeds(setDoc(doc(as('u_staff', 'staff'), 'customers/c_new'), {
    organizationId: ORG, fullName: 'New Customer',
  }))
);

await check('staff CANNOT re-stamp an existing customer into another org', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'customers/c_ours'), { organizationId: OTHER_ORG }))
);

await check('super_admin CAN reach another organisation', () =>
  assertSucceeds(getDoc(doc(as('u_root', 'super_admin', ORG), 'customers/c_theirs')))
);

console.log('\nRole ladder');

await check('viewer CANNOT create a customer', () =>
  assertFails(setDoc(doc(as('u_view', 'viewer'), 'customers/c_v'), { organizationId: ORG, fullName: 'X' }))
);

await check('viewer CAN read a customer', () =>
  assertSucceeds(getDoc(doc(as('u_view', 'viewer'), 'customers/c_ours')))
);

await check('staff CANNOT delete a customer (manager and up only)', () =>
  assertFails(deleteDoc(doc(as('u_staff', 'staff'), 'customers/c_ours')))
);

await check('manager CAN delete a customer', () =>
  assertSucceeds(deleteDoc(doc(as('u_mgr', 'manager'), 'customers/c_new')))
);

console.log('\nAutomation configuration — controls where customer messages go');

await check('staff CANNOT change an automation rule', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'automations/auto_1'), {
    targetWebhookUrl: 'https://attacker.test/webhook/x',
  }))
);

await check('business_admin CAN change an automation rule', () =>
  assertSucceeds(updateDoc(doc(as('u_admin', 'business_admin'), 'automations/auto_1'), {
    targetWebhookUrl: 'https://ours.test/webhook/x',
  }))
);

await check('staff CANNOT change the org n8n webhook in settings', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'settings/app'), {
    n8nWebhookUrl: 'https://attacker.test/webhook/y',
  }))
);

console.log('\nAudit trail is server-written only');

await check('manager CAN read automation logs', () =>
  assertSucceeds(getDoc(doc(as('u_mgr', 'manager'), 'automationLogs/log_1')))
);

await check('staff CANNOT read automation logs', () =>
  assertFails(getDoc(doc(as('u_staff', 'staff'), 'automationLogs/log_1')))
);

await check('staff CAN append an automation log (the client records them)', () =>
  assertSucceeds(setDoc(doc(as('u_staff', 'staff'), 'automationLogs/log_new'), {
    organizationId: ORG, status: 'Success',
  }))
);

await check('nobody can ALTER an existing automation log', () =>
  assertFails(updateDoc(doc(as('u_admin', 'business_admin'), 'automationLogs/log_1'), {
    status: 'Failed',
  }))
);

await check('business_admin CANNOT erase an automation log', () =>
  assertFails(deleteDoc(doc(as('u_admin', 'business_admin'), 'automationLogs/log_1')))
);

console.log('\nFinancial records');

await check('staff CANNOT delete an invoice', () =>
  assertFails(deleteDoc(doc(as('u_staff', 'staff'), 'invoices/inv_unpaid')))
);

await check('business_admin CANNOT delete a PAID invoice', () =>
  assertFails(deleteDoc(doc(as('u_admin', 'business_admin'), 'invoices/inv_paid')))
);

await check('business_admin CAN delete an unpaid invoice', () =>
  assertSucceeds(deleteDoc(doc(as('u_admin', 'business_admin'), 'invoices/inv_unpaid')))
);

console.log('\nNotifications');

await check('member CAN mark a notification read', () =>
  assertSucceeds(updateDoc(doc(as('u_staff', 'staff'), 'notifications/n_1'), { isRead: true }))
);

await check('member CANNOT rewrite a notification title', () =>
  assertFails(updateDoc(doc(as('u_staff', 'staff'), 'notifications/n_1'), { title: 'Tampered' }))
);

console.log('\nUnauthenticated and unclaimed access');

await check('anonymous CANNOT read a customer', () =>
  assertFails(getDoc(doc(anon(), 'customers/c_ours')))
);

await check('anonymous CANNOT read the organisation', () =>
  assertFails(getDoc(doc(anon(), 'organizations/' + ORG)))
);

await check('signed in with NO claims gets nothing', () =>
  assertFails(getDoc(doc(testEnv.authenticatedContext('u_bare').firestore(), 'customers/c_ours')))
);

await check('unlisted collection is denied even to super_admin', () =>
  assertFails(setDoc(doc(as('u_root', 'super_admin'), 'secretStuff/x'), { organizationId: ORG }))
);

await testEnv.cleanup();

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('All security-rules tests passed.');
process.exit(0);
