/**
 * Tests for scheduled due-detection.
 *
 * This decides whether a real customer gets a message, and how often. The
 * cadence lives entirely in the idempotency key each function returns, so these
 * tests assert the keys as carefully as the selections: a key that changes when
 * it should not means the same customer is messaged every time the sweep runs.
 *
 * Pure functions, so no Firestore and no clock.
 *
 * Run:  npx tsx server/due.test.ts
 */

import { findDueInvoices, findDueTasks, findSlaAtRisk } from './due';
import { todayInZone, daysUntil, hoursUntil } from './dates';

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

const ORG = 'org_smart_hub_01';
const TODAY = '2026-09-15';

/* ------------------------------------------------------------------ */
console.log('\nTimezone correctness — where off-by-one-day bugs come from');

{
  // 18:30 UTC on the 14th is already 00:00 IST on the 15th. A sweep that used
  // UTC would think it was still the 14th and send every reminder a day early.
  const utcLate = new Date('2026-09-14T18:35:00Z');
  check('IST rolls over before UTC does', todayInZone('Asia/Kolkata', utcLate) === '2026-09-15',
    todayInZone('Asia/Kolkata', utcLate));
  check('the same instant is still the 14th in UTC', todayInZone('UTC', utcLate) === '2026-09-14');
}

check('daysUntil counts forward', daysUntil('2026-09-18', TODAY) === 3);
check('daysUntil is zero on the due date', daysUntil('2026-09-15', TODAY) === 0);
check('daysUntil goes negative once past', daysUntil('2026-08-30', TODAY) === -16);
check('daysUntil crosses a month boundary', daysUntil('2026-10-01', '2026-09-28') === 3);
check('daysUntil crosses a year boundary', daysUntil('2027-01-01', '2026-12-30') === 2);
check('daysUntil rejects junk', daysUntil('not-a-date', TODAY) === null);
check('hoursUntil reads a timestamp', Math.round(hoursUntil('2026-09-15T12:00:00Z', Date.parse('2026-09-15T06:00:00Z')) ?? 0) === 6);

/* ------------------------------------------------------------------ */
console.log('\nInvoices — which get chased, and how often');

const openInvoice = (over: Record<string, unknown> = {}) => ({
  id: 'inv_01',
  invoiceNumber: 'INV-2026-001',
  status: 'Partially Paid',
  dueDate: '2026-09-18',
  balanceDue: 113300,
  ...over,
});

{
  const r = findDueInvoices([openInvoice()], ORG, TODAY, 3);
  check('an invoice due in exactly the lead window fires', r.invoiceDue.length === 1);
  check('and it is not also chased as overdue', r.paymentReminder.length === 0);
  check(
    'its key carries no date, so it fires once ever',
    r.invoiceDue[0].idempotency === `invoice_due|${ORG}|INV-2026-001`,
    r.invoiceDue[0].idempotency
  );
}

{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-09-19' })], ORG, TODAY, 3);
  check('four days out does not fire yet', r.invoiceDue.length === 0);
}
{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-09-17' })], ORG, TODAY, 3);
  check('two days out does not fire again', r.invoiceDue.length === 0);
}
{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-09-15' })], ORG, TODAY, 3);
  check('the due date itself fires neither event', r.invoiceDue.length === 0 && r.paymentReminder.length === 0);
}

{
  // A settled invoice must never be chased, whatever its status label says.
  const r = findDueInvoices([openInvoice({ balanceDue: 0 })], ORG, TODAY, 3);
  check('a zero balance is never chased', r.invoiceDue.length === 0 && r.paymentReminder.length === 0);
}
{
  const r = findDueInvoices([openInvoice({ status: 'Paid', balanceDue: 5000 })], ORG, TODAY, 3);
  check('a Paid status is skipped', r.invoiceDue.length === 0);
}
{
  const r = findDueInvoices([openInvoice({ status: 'Cancelled', balanceDue: 5000 })], ORG, TODAY, 3);
  check('an unknown/closed status is skipped', r.invoiceDue.length === 0);
}
{
  const r = findDueInvoices([openInvoice({ balanceDue: undefined })], ORG, TODAY, 3);
  check('no balance figure means no claim', r.invoiceDue.length === 0 && r.paymentReminder.length === 0);
}

console.log('\n  overdue cadence');

{
  const three = findDueInvoices([openInvoice({ dueDate: '2026-09-12' })], ORG, TODAY, 3);
  const six = findDueInvoices([openInvoice({ dueDate: '2026-09-09' })], ORG, TODAY, 3);
  check('3 and 6 days overdue share one weekly key', three.paymentReminder[0].idempotency === six.paymentReminder[0].idempotency);
  check('the key is week 0', three.paymentReminder[0].idempotency.endsWith('|w0'), three.paymentReminder[0].idempotency);
}
{
  const six = findDueInvoices([openInvoice({ dueDate: '2026-09-09' })], ORG, TODAY, 3);
  const eight = findDueInvoices([openInvoice({ dueDate: '2026-09-07' })], ORG, TODAY, 3);
  check(
    'crossing into week 2 produces a NEW key, so one more nudge goes out',
    six.paymentReminder[0].idempotency !== eight.paymentReminder[0].idempotency
  );
  check('and that key is week 1', eight.paymentReminder[0].idempotency.endsWith('|w1'));
}
{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-08-01' })], ORG, TODAY, 3);
  check('45 days overdue reports the day count', r.paymentReminder[0].extra.daysOverdue === 45, String(r.paymentReminder[0].extra.daysOverdue));
  check('and sits in week 6', r.paymentReminder[0].idempotency.endsWith('|w6'));
}

{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-09-18' }), openInvoice({ id: 'inv_02', invoiceNumber: 'INV-2', dueDate: '2026-08-30' })], ORG, TODAY, 3);
  check('a mixed batch splits into both buckets', r.invoiceDue.length === 1 && r.paymentReminder.length === 1);
  check('and the keys name different invoices', r.invoiceDue[0].idempotency.includes('INV-2026-001') && r.paymentReminder[0].idempotency.includes('INV-2'));
}

{
  const r = findDueInvoices([openInvoice({ dueDate: '2026-09-20' })], ORG, TODAY, 5);
  check('the lead window is configurable', r.invoiceDue.length === 1);
}

/* ------------------------------------------------------------------ */
console.log('\nTasks — once per task per day');

const task = (over: Record<string, unknown> = {}) => ({
  id: 'task_01',
  title: 'Schedule onboarding call',
  status: 'Not Started',
  dueDate: '2026-09-15',
  ...over,
});

{
  const r = findDueTasks([task()], ORG, TODAY);
  check('a task due today fires', r.length === 1);
  check('its key includes the date, so it repeats daily not hourly', r[0].idempotency === `task_overdue|${ORG}|task_01|${TODAY}`, r[0].idempotency);
  check('and it is not flagged overdue yet', r[0].extra.isOverdue === false);
}
{
  const r = findDueTasks([task({ dueDate: '2026-09-16' })], ORG, TODAY);
  check('a task due tomorrow fires (24h warning)', r.length === 1);
}
{
  const r = findDueTasks([task({ dueDate: '2026-09-17' })], ORG, TODAY);
  check('a task due in two days does not', r.length === 0);
}
{
  const r = findDueTasks([task({ dueDate: '2026-09-10' })], ORG, TODAY);
  check('an overdue task fires', r.length === 1);
  check('and is flagged overdue', r[0].extra.isOverdue === true);
}
{
  const r = findDueTasks([task({ status: 'Completed' })], ORG, TODAY);
  check('a completed task is skipped', r.length === 0);
}
{
  const today = findDueTasks([task()], ORG, TODAY);
  const tomorrow = findDueTasks([task()], ORG, '2026-09-16');
  check('the next day produces a new key, so one more nudge', today[0].idempotency !== tomorrow[0].idempotency);
}

/* ------------------------------------------------------------------ */
console.log('\nSLA — threshold and breach, twice per ticket and no more');

const NOW = Date.parse('2026-09-15T12:00:00Z');
const ticket = (over: Record<string, unknown> = {}) => ({
  id: 'tkt_01',
  ticketNumber: 'TKT-8081',
  status: 'In Progress',
  slaHours: 10,
  // 10h SLA, 5h left = 50% consumed.
  dueDate: new Date(NOW + 5 * 3_600_000).toISOString(),
  ...over,
});

{
  const r = findSlaAtRisk([ticket()], ORG, NOW, 0.8);
  check('50% consumed does not alert', r.length === 0);
}
{
  // 1.5h left of a 10h SLA = 85% consumed.
  const r = findSlaAtRisk([ticket({ dueDate: new Date(NOW + 1.5 * 3_600_000).toISOString() })], ORG, NOW, 0.8);
  check('85% consumed alerts', r.length === 1);
  check('stage is at-risk, not breached', r[0].extra.slaStage === 'at-risk');
  check('the key names the stage', r[0].idempotency === `sla|${ORG}|tkt_01|at-risk`, r[0].idempotency);
}
{
  const r = findSlaAtRisk([ticket({ dueDate: new Date(NOW - 3600_000).toISOString() })], ORG, NOW, 0.8);
  check('past the due date alerts', r.length === 1);
  check('stage is breached', r[0].extra.slaStage === 'breached');
  check('breach has its OWN key, so it alerts a second time', r[0].idempotency === `sla|${ORG}|tkt_01|breached`);
}
{
  // Two sweeps thirty minutes apart, both while at-risk, must share a key.
  const a = findSlaAtRisk([ticket({ dueDate: new Date(NOW + 1.5 * 3_600_000).toISOString() })], ORG, NOW, 0.8);
  const b = findSlaAtRisk([ticket({ dueDate: new Date(NOW + 1.5 * 3_600_000).toISOString() })], ORG, NOW + 1800_000, 0.8);
  check('successive at-risk sweeps share one key', a[0].idempotency === b[0].idempotency);
}
{
  const r = findSlaAtRisk([ticket({ status: 'Resolved', dueDate: new Date(NOW - 3600_000).toISOString() })], ORG, NOW, 0.8);
  check('a resolved ticket is skipped', r.length === 0);
}
{
  const r = findSlaAtRisk([ticket({ slaHours: undefined })], ORG, NOW, 0.8);
  check('no SLA hours means no alert', r.length === 0);
}
{
  const r = findSlaAtRisk([ticket({ slaHours: 0 })], ORG, NOW, 0.8);
  check('a zero SLA does not divide by zero', r.length === 0);
}
{
  const r = findSlaAtRisk([ticket({ dueDate: new Date(NOW + 1.5 * 3_600_000).toISOString() })], ORG, NOW, 0.8);
  check('the consumed fraction is reported', r[0].extra.consumedFraction === 0.85, String(r[0].extra.consumedFraction));
}

/* ------------------------------------------------------------------ */
console.log('\nEmpty and malformed input');

check('no invoices, no work', findDueInvoices([], ORG, TODAY).invoiceDue.length === 0);
check('no tasks, no work', findDueTasks([], ORG, TODAY).length === 0);
check('no tickets, no work', findSlaAtRisk([], ORG, NOW).length === 0);
check('an invoice with no due date is skipped', findDueInvoices([openInvoice({ dueDate: undefined })], ORG, TODAY).invoiceDue.length === 0);
check('an invoice with no reference is skipped', findDueInvoices([openInvoice({ id: undefined, invoiceNumber: undefined })], ORG, TODAY).invoiceDue.length === 0);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  for (const f of failures) console.log(`  FAIL  ${f}`);
  process.exit(1);
}
console.log('All due-detection tests passed.');
process.exit(0);
