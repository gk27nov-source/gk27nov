import { getConfig } from './config';
import { dispatchToN8n, DispatchRefused, type DispatchResult } from './dispatch';
import { todayInZone } from './dates';
import { findDueInvoices, findDueTasks, findSlaAtRisk, type DueItem } from './due';

/**
 * Scheduled sweeps.
 *
 * These are the events a single-page app can never raise. The browser only
 * emits an event while somebody has a tab open, so "three days before the due
 * date" and "this ticket has burned 80% of its SLA" simply never happened —
 * which is why the invoice reminder rule sat wired to the wrong trigger and
 * nobody noticed it had never fired.
 *
 * Run by Cloud Scheduler against POST /api/internal/sweep.
 *
 * Rule resolution happens HERE, on the server, reading the automations
 * collection directly. Phase 2 could not do that: the rules were in
 * localStorage. Now they are in Firestore, so a sweep resolves them the same
 * way the client does — including firing every matching rule, not just the
 * first.
 */

export type SweepKind = 'invoices' | 'tasks' | 'sla';

export interface SweepReport {
  kind: SweepKind;
  organizationsScanned: number;
  candidates: number;
  dispatched: number;
  suppressed: number;
  failed: number;
  errors: string[];
  durationMs: number;
}

interface AutomationRuleDoc {
  id: string;
  name?: string;
  triggerEvent?: string;
  isEnabled?: boolean;
  targetWebhookUrl?: string;
}

/** Lazily loaded so the server still boots without Firestore credentials. */
async function getDb() {
  const appMod = await import('firebase-admin/app');
  const fsMod = await import('firebase-admin/firestore');

  const app =
    appMod.getApps().length > 0
      ? appMod.getApp()
      : appMod.initializeApp({ projectId: getConfig().firebaseProjectId });

  return fsMod.getFirestore(app);
}

type Db = Awaited<ReturnType<typeof getDb>>;

/**
 * Which organisations exist.
 *
 * Derived from the `settings` collection, where the client writes one document
 * per organisation keyed by its id. There is no populated `organizations`
 * collection to read — the org profile is still client-side state — so this is
 * the reliable enumeration today.
 */
async function listOrganizations(db: Db): Promise<string[]> {
  const snap = await db.collection('settings').get();
  return snap.docs.map((d) => d.id).filter(Boolean);
}

async function loadRules(db: Db, orgId: string, event: string): Promise<AutomationRuleDoc[]> {
  const snap = await db
    .collection('automations')
    .where('organizationId', '==', orgId)
    .where('triggerEvent', '==', event)
    .where('isEnabled', '==', true)
    .get();
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) }) as AutomationRuleDoc);
}

/** Record the outcome, exactly as the client does, so both appear in one log. */
async function writeLog(
  db: Db,
  orgId: string,
  rule: AutomationRuleDoc,
  event: string,
  payload: Record<string, unknown>,
  result: DispatchResult | { success: false; error: string; durationMs: number; attempts: number }
): Promise<void> {
  const id = `log_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  try {
    await db
      .collection('automationLogs')
      .doc(id)
      .set({
        id,
        organizationId: orgId,
        ruleId: rule.id,
        automationName: rule.name ?? `Scheduled: ${event}`,
        triggerEvent: event,
        status: result.success ? 'Success' : 'Failed',
        timestamp: new Date().toISOString(),
        durationMs: result.durationMs ?? 0,
        httpStatus: 'statusCode' in result ? (result.statusCode ?? 0) : 0,
        retryCount: Math.max(0, (result.attempts ?? 1) - 1),
        payload,
        responseMessage: 'response' in result && result.response ? JSON.stringify(result.response).slice(0, 2000) : null,
        errorMessage: result.error ?? null,
        source: 'scheduler',
      });
  } catch (err) {
    console.error('[sweep] could not write log entry', err);
  }
}

/**
 * Fan one due record out to every rule subscribed to its event.
 *
 * Returns how many were sent, suppressed as duplicates, and failed.
 */
async function dispatchItem(
  db: Db,
  orgId: string,
  event: string,
  rules: AutomationRuleDoc[],
  item: DueItem<Record<string, unknown>>,
  orgProfile: Record<string, unknown>
): Promise<{ sent: number; suppressed: number; failed: number; errors: string[] }> {
  let sent = 0;
  let suppressed = 0;
  let failed = 0;
  const errors: string[] = [];

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    source: 'Smart Business Automation Hub (scheduler)',
    organizationId: orgId,
    organization: orgProfile,
    // Server-initiated work is attributed to the scheduler, explicitly. It is
    // not attributed to a person who happens to be in the database.
    triggeredBy: { uid: 'system:scheduler', email: '', role: 'system' },
    ...item.record,
    ...item.extra,
  };

  for (const rule of rules) {
    try {
      const result = await dispatchToN8n({
        ruleId: rule.id,
        ruleName: rule.name,
        requestedUrl: rule.targetWebhookUrl,
        payload,
        idempotency: item.idempotency,
      });

      if (result.status === 'skipped') suppressed++;
      else if (result.success) sent++;
      else {
        failed++;
        if (result.error) errors.push(`${rule.name ?? rule.id}: ${result.error}`);
      }

      if (result.status !== 'skipped') {
        await writeLog(db, orgId, rule, event, payload, result);
      }
    } catch (err) {
      // DispatchRefused is a configuration fault — an unconfigured webhook, a
      // host outside the allowlist. Log it and keep going: one broken rule must
      // not stop the sweep for every other organisation.
      failed++;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${rule.name ?? rule.id}: ${message}`);
      if (!(err instanceof DispatchRefused)) {
        console.error('[sweep] unexpected dispatch failure', err);
      }
      await writeLog(db, orgId, rule, event, payload, {
        success: false,
        error: message,
        durationMs: 0,
        attempts: 0,
      });
    }
  }

  return { sent, suppressed, failed, errors };
}

async function orgProfileFor(db: Db, orgId: string): Promise<Record<string, unknown>> {
  try {
    const snap = await db.collection('organizations').doc(orgId).get();
    if (snap.exists) return { id: orgId, ...(snap.data() as object) };
  } catch {
    /* organisations may not be populated; the settings doc is enough */
  }
  try {
    const snap = await db.collection('settings').doc(orgId).get();
    const data = (snap.data() ?? {}) as Record<string, unknown>;
    return { id: orgId, name: data.companyName ?? data.name, email: data.supportEmail, phone: data.supportPhone };
  } catch {
    return { id: orgId };
  }
}

/* ------------------------------------------------------------------ *
 * The three sweeps
 * ------------------------------------------------------------------ */

export async function runSweep(kind: SweepKind): Promise<SweepReport> {
  const started = Date.now();
  const report: SweepReport = {
    kind,
    organizationsScanned: 0,
    candidates: 0,
    dispatched: 0,
    suppressed: 0,
    failed: 0,
    errors: [],
    durationMs: 0,
  };

  const db = await getDb();
  const orgIds = await listOrganizations(db);
  report.organizationsScanned = orgIds.length;

  for (const orgId of orgIds) {
    const profile = await orgProfileFor(db, orgId);
    const today = todayInZone();

    try {
      if (kind === 'invoices') {
        const snap = await db.collection('invoices').where('organizationId', '==', orgId).get();
        const invoices = snap.docs.map((d) => d.data() as Record<string, unknown>);
        const { invoiceDue, paymentReminder } = findDueInvoices(
          invoices,
          orgId,
          today,
          getConfig().invoiceLeadDays
        );

        for (const [event, items] of [
          ['invoice_due', invoiceDue],
          ['payment_reminder', paymentReminder],
        ] as const) {
          if (items.length === 0) continue;
          const rules = await loadRules(db, orgId, event);
          if (rules.length === 0) continue; // nothing subscribed; not an error
          report.candidates += items.length;
          for (const item of items) {
            const r = await dispatchItem(db, orgId, event, rules, item, profile);
            report.dispatched += r.sent;
            report.suppressed += r.suppressed;
            report.failed += r.failed;
            report.errors.push(...r.errors);
          }
        }
      } else if (kind === 'tasks') {
        const snap = await db.collection('tasks').where('organizationId', '==', orgId).get();
        const items = findDueTasks(snap.docs.map((d) => d.data() as Record<string, unknown>), orgId, today);
        if (items.length === 0) continue;
        const rules = await loadRules(db, orgId, 'task_overdue');
        if (rules.length === 0) continue;
        report.candidates += items.length;
        for (const item of items) {
          const r = await dispatchItem(db, orgId, 'task_overdue', rules, item, profile);
          report.dispatched += r.sent;
          report.suppressed += r.suppressed;
          report.failed += r.failed;
          report.errors.push(...r.errors);
        }
      } else {
        const snap = await db.collection('complaints').where('organizationId', '==', orgId).get();
        const items = findSlaAtRisk(snap.docs.map((d) => d.data() as Record<string, unknown>), orgId, Date.now());
        if (items.length === 0) continue;
        const rules = await loadRules(db, orgId, 'sla_at_risk');
        if (rules.length === 0) continue;
        report.candidates += items.length;
        for (const item of items) {
          const r = await dispatchItem(db, orgId, 'sla_at_risk', rules, item, profile);
          report.dispatched += r.sent;
          report.suppressed += r.suppressed;
          report.failed += r.failed;
          report.errors.push(...r.errors);
        }
      }
    } catch (err) {
      // One organisation failing must not abort the sweep for the rest.
      const message = err instanceof Error ? err.message : String(err);
      report.errors.push(`org ${orgId}: ${message}`);
      console.error(`[sweep:${kind}] organisation ${orgId} failed`, err);
    }
  }

  report.durationMs = Date.now() - started;
  return report;
}
