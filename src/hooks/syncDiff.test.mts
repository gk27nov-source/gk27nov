/**
 * Tests for the collection diff engine.
 *
 * This is the piece of the Firestore migration that would do real damage if it
 * were wrong. It decides, from two array snapshots, exactly which documents to
 * write and which to delete — so a bug here means either silent data loss (a
 * spurious delete) or a write storm (documents rewritten on every render).
 *
 * The function under test is pure, so this needs no React and no Firebase.
 *
 * Run:  npx tsx src/hooks/syncDiff.test.mts
 */

import { computeDiff, stripUndefined } from './useSyncedCollection';

let passed = 0;
const failures: string[] = [];

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed++;
    console.log(`  ok    ${name}`);
  } else {
    failures.push(`${name}${detail ? ` — ${detail}` : ''}`);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

interface Row {
  id: string;
  name: string;
  amount?: number;
}
const byId = (r: Row) => r.id;

const a: Row = { id: 'c1', name: 'Rajesh Narang' };
const b: Row = { id: 'c2', name: 'Bhavna Joshi' };
const c: Row = { id: 'c3', name: 'Sanjay Thapar' };

console.log('\nThe cases that would corrupt data');

{
  // The most important one. Every remote snapshot re-sets the array; if an
  // unchanged array produced writes, the listener and the writer would feed
  // each other forever.
  const d = computeDiff([a, b], [a, b], byId);
  check('an unchanged array writes nothing', d.upserts.length === 0 && d.removals.length === 0);
}

{
  // Same contents, different array identity — React state updates do this
  // constantly.
  const d = computeDiff([a, b], [{ ...a }, { ...b }], byId);
  check('cloned-but-identical rows write nothing', d.upserts.length === 0, JSON.stringify(d));
}

{
  const d = computeDiff([a, b], [b, a], byId);
  check('reordering alone writes nothing', d.upserts.length === 0 && d.removals.length === 0);
}

{
  const d = computeDiff([], [], byId);
  check('empty to empty writes nothing', d.upserts.length === 0 && d.removals.length === 0);
}

console.log('\nOrdinary mutations');

{
  const d = computeDiff([a, b], [c, a, b], byId);
  check('an insert writes exactly the new row', d.upserts.length === 1 && d.upserts[0].id === 'c3');
  check('an insert deletes nothing', d.removals.length === 0);
}

{
  const edited = { ...b, name: 'Bhavna J.' };
  const d = computeDiff([a, b], [a, edited], byId);
  check('an edit writes only the edited row', d.upserts.length === 1 && d.upserts[0].id === 'c2');
  check('an edit deletes nothing', d.removals.length === 0);
}

{
  const d = computeDiff([a, b, c], [a, c], byId);
  check('a delete removes exactly one id', d.removals.length === 1 && d.removals[0] === 'c2');
  check('a delete writes nothing', d.upserts.length === 0);
}

{
  const d = computeDiff([a, b], [{ ...a, amount: 100 }, c], byId);
  check('a mixed change upserts the edit and the insert', d.upserts.length === 2);
  check('and removes the dropped row', d.removals.length === 1 && d.removals[0] === 'c2');
}

console.log('\nField-level sensitivity');

{
  // A partial payment changes one number; it must be written.
  const inv = { id: 'inv_01', name: 'INV-1', amount: 0 };
  const paid = { id: 'inv_01', name: 'INV-1', amount: 88500 };
  const d = computeDiff([inv], [paid], byId);
  check('a numeric change is detected', d.upserts.length === 1 && d.upserts[0].amount === 88500);
}

{
  // Adding a field counts as a change.
  const d = computeDiff([a], [{ ...a, amount: 1 }], byId);
  check('an added field is detected', d.upserts.length === 1);
}

{
  // Removing a field counts as a change too — otherwise a cleared value would
  // never reach Firestore.
  const withField = { ...a, amount: 1 };
  const d = computeDiff([withField], [a], byId);
  check('a removed field is detected', d.upserts.length === 1, JSON.stringify(d));
}

console.log('\nAlternative key, as used for staff records');

{
  interface Staff {
    uid: string;
    displayName: string;
  }
  const byUid = (s: Staff) => s.uid;
  const s1: Staff = { uid: 'user_super_01', displayName: 'Vikram Malhotra' };
  const s2: Staff = { uid: 'user_staff_04', displayName: 'Ananya Iyer' };

  const same = computeDiff([s1, s2], [s1, s2], byUid);
  check('uid-keyed rows compare correctly', same.upserts.length === 0 && same.removals.length === 0);

  const renamed = computeDiff([s1, s2], [s1, { ...s2, displayName: 'Ananya I.' }], byUid);
  check('a uid-keyed edit is detected', renamed.upserts.length === 1);
  check('and it is keyed by uid, not id', byUid(renamed.upserts[0]) === 'user_staff_04');

  const removed = computeDiff([s1, s2], [s1], byUid);
  check('a uid-keyed delete returns the uid', removed.removals[0] === 'user_staff_04');
}

console.log('\nBulk cases');

{
  // A CSV import of 1000 customers.
  const many: Row[] = Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}`, name: `Customer ${i}` }));
  const d = computeDiff([], many, byId);
  check('a bulk import upserts every row', d.upserts.length === 1000);
  check('a bulk import deletes nothing', d.removals.length === 0);

  const one = many.map((r) => (r.id === 'c500' ? { ...r, name: 'Edited' } : r));
  const d2 = computeDiff(many, one, byId);
  check('one edit inside 1000 rows writes exactly one', d2.upserts.length === 1, String(d2.upserts.length));

  const d3 = computeDiff(many, [], byId);
  check('clearing 1000 rows removes 1000 ids', d3.removals.length === 1000);
}

/* ------------------------------------------------------------------ *
 * stripUndefined — the guard for the bug that took activityLogs and
 * automationLogs offline in production. Firestore refuses `undefined` and
 * aborts the ENTIRE batch, so one optional field that happens to be unset
 * silently loses every document written alongside it.
 * ------------------------------------------------------------------ */
{
  const stripped = stripUndefined({ id: 'act_1', action: 'create', oldValue: undefined });
  check('an undefined key is dropped', !('oldValue' in (stripped as object)));
  check('the other keys survive', (stripped as { action?: string }).action === 'create');

  const nulls = stripUndefined({ errorMessage: null, httpStatus: 0, ok: false });
  check('null is kept — it is a real value, not an absence', 'errorMessage' in (nulls as object));
  check('zero is kept', (nulls as { httpStatus?: number }).httpStatus === 0);
  check('false is kept', (nulls as { ok?: boolean }).ok === false);

  const nested = stripUndefined({ payload: { phone: undefined, email: 'a@b.c' } });
  check(
    'nested undefined is dropped too',
    !('phone' in ((nested as { payload: object }).payload as object))
  );
  check(
    'nested siblings survive',
    (nested as { payload: { email?: string } }).payload.email === 'a@b.c'
  );

  const arr = stripUndefined({ items: [{ a: undefined, b: 1 }, { b: 2 }] });
  check('arrays are walked', !('a' in ((arr as { items: object[] }).items[0] as object)));
  check('array length is preserved', (arr as { items: unknown[] }).items.length === 2);

  const when = new Date('2026-01-01T00:00:00.000Z');
  const dated = stripUndefined({ when });
  check('a Date is passed through, not flattened', (dated as { when: Date }).when instanceof Date);

  check('a bare undefined stays undefined', stripUndefined(undefined) === undefined);
  check('a primitive is returned as-is', stripUndefined('x') === 'x');
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('All sync-diff tests passed.');
process.exit(0);
