import { daysUntil, hoursUntil } from './dates';

/**
 * Which records are due for a reminder right now.
 *
 * Pure and separate from Firestore on purpose. This is the part that decides
 * whether a real customer gets messaged, and how often — so it needs to be
 * testable directly, without a database, an emulator or a clock.
 *
 * Every function returns the records to act on plus an idempotency key. The key
 * is what encodes the CADENCE: include the date and it can fire once a day,
 * omit it and it fires once ever, bucket it by week and it fires weekly. The
 * dispatcher refuses a repeat within its window, so the key is the whole policy.
 */

export interface DueItem<T> {
  record: T;
  /** Stable across repeated sweeps that should NOT re-send. */
  idempotency: string;
  /** Extra context merged into the outgoing payload. */
  extra: Record<string, unknown>;
}

/* ------------------------------------------------------------------ *
 * Invoices
 * ------------------------------------------------------------------ */

export interface InvoiceLike {
  id?: string;
  invoiceNumber?: string;
  status?: string;
  dueDate?: string;
  balanceDue?: number;
  amountPaid?: number;
  grandTotal?: number;
}

/** Statuses that still owe money. A paid or cancelled invoice is never chased. */
const OPEN_INVOICE_STATUSES = new Set([
  'Sent',
  'Unpaid',
  'Pending',
  'Partially Paid',
  'Overdue',
  'Draft',
]);

export interface InvoiceSweepResult<T> {
  /** Approaching the due date — fires once per invoice, ever. */
  invoiceDue: DueItem<T>[];
  /** Past the due date — fires once a week while it stays unpaid. */
  paymentReminder: DueItem<T>[];
}

export function findDueInvoices<T extends InvoiceLike>(
  invoices: T[],
  orgId: string,
  today: string,
  leadDays = 3
): InvoiceSweepResult<T> {
  const invoiceDue: DueItem<T>[] = [];
  const paymentReminder: DueItem<T>[] = [];

  for (const inv of invoices) {
    if (inv.status && !OPEN_INVOICE_STATUSES.has(inv.status)) continue;

    // The balance is the authority, not the status label: a record marked
    // "Partially Paid" that has since been settled must not be chased.
    const balance = typeof inv.balanceDue === 'number' ? inv.balanceDue : undefined;
    if (balance !== undefined && balance <= 0) continue;
    if (balance === undefined) continue; // nothing to claim without a figure

    const days = daysUntil(inv.dueDate, today);
    if (days === null) continue;

    const ref = inv.invoiceNumber ?? inv.id ?? '';
    if (!ref) continue;

    if (days === leadDays) {
      // No date in the key: this is the one-time "your invoice is coming due".
      invoiceDue.push({
        record: inv,
        idempotency: `invoice_due|${orgId}|${ref}`,
        extra: { daysUntilDue: days },
      });
    } else if (days < 0) {
      // Weekly while overdue, so a customer is nudged rather than messaged
      // every single day for a month.
      const week = Math.floor(Math.abs(days) / 7);
      paymentReminder.push({
        record: inv,
        idempotency: `payment_reminder|${orgId}|${ref}|w${week}`,
        extra: { daysOverdue: Math.abs(days) },
      });
    }
  }

  return { invoiceDue, paymentReminder };
}

/* ------------------------------------------------------------------ *
 * Tasks
 * ------------------------------------------------------------------ */

export interface TaskLike {
  id?: string;
  title?: string;
  status?: string;
  dueDate?: string;
  priority?: string;
}

const OPEN_TASK_STATUSES = new Set(['Not Started', 'In Progress', 'On Hold']);

/**
 * Tasks due within a day, or already past. Fires once per task per calendar
 * day — the sweep runs hourly, so the date in the key is what stops twenty-four
 * identical nudges.
 */
export function findDueTasks<T extends TaskLike>(tasks: T[], orgId: string, today: string): DueItem<T>[] {
  const out: DueItem<T>[] = [];

  for (const task of tasks) {
    if (task.status && !OPEN_TASK_STATUSES.has(task.status)) continue;

    const days = daysUntil(task.dueDate, today);
    if (days === null || days > 1) continue;

    const ref = task.id ?? '';
    if (!ref) continue;

    out.push({
      record: task,
      idempotency: `task_overdue|${orgId}|${ref}|${today}`,
      extra: { daysUntilDue: days, isOverdue: days < 0 },
    });
  }

  return out;
}

/* ------------------------------------------------------------------ *
 * Support tickets
 * ------------------------------------------------------------------ */

export interface ComplaintLike {
  id?: string;
  ticketNumber?: string;
  status?: string;
  dueDate?: string;
  slaHours?: number;
  priority?: string;
}

const OPEN_COMPLAINT_STATUSES = new Set([
  'New',
  'Assigned',
  'In Progress',
  'Waiting for Customer',
]);

/**
 * Tickets that have consumed `threshold` of their SLA window — 80% by default,
 * matching what the existing escalation rule's own description promises.
 *
 * Two occasions per ticket, and no more: crossing the threshold, then breaching.
 * The stage is in the idempotency key, so a sweep every thirty minutes does not
 * produce a manager alert every thirty minutes.
 */
export function findSlaAtRisk<T extends ComplaintLike>(
  complaints: T[],
  orgId: string,
  now: number,
  threshold = 0.8
): DueItem<T>[] {
  const out: DueItem<T>[] = [];

  for (const ticket of complaints) {
    if (ticket.status && !OPEN_COMPLAINT_STATUSES.has(ticket.status)) continue;

    const slaHours = typeof ticket.slaHours === 'number' ? ticket.slaHours : null;
    if (!slaHours || slaHours <= 0) continue;

    const remaining = hoursUntil(ticket.dueDate, now);
    if (remaining === null) continue;

    const consumed = (slaHours - remaining) / slaHours;
    if (consumed < threshold) continue;

    const ref = ticket.id ?? ticket.ticketNumber ?? '';
    if (!ref) continue;

    const stage = remaining <= 0 ? 'breached' : 'at-risk';
    out.push({
      record: ticket,
      idempotency: `sla|${orgId}|${ref}|${stage}`,
      extra: {
        slaStage: stage,
        hoursRemaining: Math.round(remaining * 10) / 10,
        consumedFraction: Math.round(consumed * 100) / 100,
      },
    });
  }

  return out;
}
