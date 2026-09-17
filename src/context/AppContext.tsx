import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  UserProfile,
  Organization,
  Customer,
  Lead,
  Complaint,
  Task,
  DocumentItem,
  Communication,
  AppNotification,
  AutomationRule,
  AutomationLog,
  OrganizationSettings,
  ActivityLog,
  UserRole,
  LeadStage,
  ComplaintStatus,
  TaskStatus,
  Quotation,
  Invoice,
} from '../types';
import {
  initialOrganization,
  initialUsers,
  initialCustomers,
  initialLeads,
  initialComplaints,
  initialTasks,
  initialAutomationRules,
  initialAutomationLogs,
  initialDocuments,
  initialCommunications,
  initialNotifications,
  initialSettings,
  initialActivityLogs,
  initialQuotations,
  initialInvoices,
  DEMO_ORG_ID,
} from '../data/seedData';
import { buildWebhookPayload, MissingContactError } from '../utils/webhookPayloadBuilder';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { DEMO_MODE, assertDemoMode } from '../config/appMode';
import { useSyncedCollection, useSyncedDoc, type SyncStatus } from '../hooks/useSyncedCollection';

/** Stages of resolving who is signed in. See the state comment below. */
export type AuthStatus = 'loading' | 'signed-out' | 'unprovisioned' | 'ready';
import {
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

interface AppContextType {
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  authStatus: AuthStatus;
  isDemoMode: boolean;
  /** Whether data is live in Firestore, cached, or local-only. */
  syncStatus: SyncStatus;
  currentOrg: Organization;
  setCurrentOrg: (org: Organization) => void;
  switchRole: (role: UserRole) => void;
  customers: Customer[];
  leads: Lead[];
  complaints: Complaint[];
  tasks: Task[];
  employees: UserProfile[];
  quotations: Quotation[];
  invoices: Invoice[];
  documents: DocumentItem[];
  communications: Communication[];
  automations: AutomationRule[];
  automationLogs: AutomationLog[];
  notifications: AppNotification[];
  activityLogs: ActivityLog[];
  settings: OrganizationSettings;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  globalSearchQuery: string;
  setGlobalSearchQuery: (query: string) => void;
  isAiDrawerOpen: boolean;
  setIsAiDrawerOpen: (open: boolean) => void;

  // Actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Customer>;
  updateCustomer: (id: string, updates: Partial<Customer>) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
  importCustomersFromCSV: (newCustomers: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>[]) => Promise<number>;

  addLead: (lead: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Lead>;
  updateLead: (id: string, updates: Partial<Lead>) => Promise<void>;
  updateLeadStage: (id: string, stage: LeadStage) => Promise<void>;
  deleteLead: (id: string) => Promise<void>;

  addComplaint: (complaint: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'isOverdue'>) => Promise<Complaint>;
  updateComplaint: (id: string, updates: Partial<Complaint>) => Promise<void>;
  resolveComplaint: (id: string, resolution: string, feedback?: string, rating?: number) => Promise<void>;

  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Task>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  updateTaskStatus: (id: string, status: TaskStatus, percentage?: number) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  // Quotation & Invoice Management
  addQuotation: (quote: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Quotation>;
  updateQuotation: (id: string, updates: Partial<Quotation>) => Promise<void>;
  deleteQuotation: (id: string) => Promise<void>;
  convertQuotationToInvoice: (quotationId: string) => Promise<Invoice>;

  addInvoice: (inv: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => Promise<Invoice>;
  updateInvoice: (id: string, updates: Partial<Invoice>) => Promise<void>;
  deleteInvoice: (id: string) => Promise<void>;
  recordInvoicePayment: (
    invoiceId: string,
    amount: number,
    paymentMethod?: Invoice['paymentMethod'],
    reference?: string,
    notes?: string
  ) => Promise<void>;

  addDocument: (docItem: Omit<DocumentItem, 'id' | 'createdAt' | 'organizationId'>) => Promise<DocumentItem>;
  deleteDocument: (id: string) => Promise<void>;

  sendCommunication: (comm: Omit<Communication, 'id' | 'organizationId' | 'timestamp' | 'status'>) => Promise<void>;
  requestCallback: (input: { customerId?: string; leadId?: string; preferredTime?: string; reason?: string }) => Promise<void>;

  updateSettings: (newSettings: Partial<OrganizationSettings>) => Promise<void>;
  updateBusinessProfile: (orgUpdates: Partial<Organization>) => Promise<void>;

  addEmployee: (employee: Omit<UserProfile, 'uid' | 'createdAt' | 'organizationId'>) => Promise<UserProfile>;
  updateEmployee: (uid: string, updates: Partial<UserProfile>) => Promise<void>;

  toggleAutomationRule: (ruleId: string) => Promise<void>;
  triggerAutomationRule: (ruleId: string, customPayload?: Record<string, any>) => Promise<AutomationLog>;
  retryAutomationLog: (logId: string) => Promise<void>;
  testLiveWebhook: (
    customEvent?: string,
    customData?: Record<string, any>
  ) => Promise<{ success: boolean; message: string; durationMs?: number }>;
  dispatchWebhookEvent: (event: string, entityData: Record<string, any>, customRuleName?: string) => Promise<void>;
  logActivity: (
    action: ActivityLog['action'],
    module: ActivityLog['module'],
    recordId: string,
    recordTitle: string,
    oldValue?: string,
    newValue?: string
  ) => void;

  // Aliases for compatibility
  updateOrganization?: (orgUpdates: Partial<Organization>) => Promise<void>;
  resetSeedData?: () => Promise<void>;

  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;

  resetToSampleData: () => Promise<void>;
  logout: () => Promise<void>;
}

/**
 * Bearer header for calls to /api. Returns {} when nobody is signed in, and
 * lets the server decide whether to refuse — the client does not get to make
 * that call.
 */
async function apiAuthHeader(): Promise<Record<string, string>> {
  try {
    const token = await auth.currentUser?.getIdToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Turn the dispatch endpoint's auth rejections into something that names the
 * cause on THIS side of the wire.
 *
 * The server can only report what it did not receive: "Missing Authorization:
 * Bearer <Firebase ID token>". Read in the UI that sounds like the server is
 * misconfigured. It is not. It means apiAuthHeader() above found no Firebase
 * user and sent the request bare — and the reason for that is nearly always
 * one the client knows and the server cannot:
 *
 *   - a 1-click demo persona, which populates currentUser from seed data
 *     without ever authenticating against Firebase, so auth.currentUser is
 *     null and there is no token to attach;
 *   - or a real session that has lapsed.
 *
 * Left untranslated this costs an hour of looking at server configuration for
 * a problem that lives in the browser.
 */
function explainDispatchError(status: number, serverError: string | undefined): string | undefined {
  if (status !== 401 || !/missing authorization/i.test(serverError ?? '')) {
    return serverError;
  }
  return DEMO_MODE
    ? 'Not sent — the browser had no Firebase ID token to attach. You are signed in through a ' +
        '1-click demo persona, which does not authenticate against Firebase, while the server has ' +
        'DISPATCH_REQUIRE_AUTH switched on. Those two settings cannot both hold. For local persona ' +
        'testing set DISPATCH_REQUIRE_AUTH="false" in .env; to exercise the path production actually ' +
        'uses, remove VITE_DEMO_MODE from .env, restart, and sign in with a real account.'
    : 'Not sent — the browser had no Firebase ID token to attach, so no Authorization header went ' +
        'with the request. The Firebase session is not active. Sign out and sign back in.';
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'smart_hub_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from local storage or defaults
  // Starts signed OUT.
  //
  // This used to be `initialUsers[0]` — the Super Admin — so the application
  // booted fully authenticated as the highest-privileged user before any
  // credential was presented. Combined with an optional sign-in modal, that is
  // what made the deployed app readable by anyone with the URL.
  //
  // In a demo build the persona bypass can still put a user here; see
  // src/config/appMode.ts.
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(
    DEMO_MODE ? initialUsers[0] : null
  );

  /**
   * Where we are in resolving identity.
   *
   *  loading       — Firebase has not reported yet; render nothing decisive
   *  signed-out    — no Firebase user
   *  unprovisioned — signed in, but no employee record and no claims, so the
   *                  account belongs to no organisation and gets no access
   *  ready         — identity and organisation resolved
   */
  const [authStatus, setAuthStatus] = useState<AuthStatus>(
    DEMO_MODE ? 'ready' : 'loading'
  );

  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrganization);
  /**
   * Firestore sync is on only once identity is resolved.
   *
   * An unauthenticated read is denied by the security rules, and a demo build
   * has no real session at all — so demo mode stays entirely local rather than
   * writing personas and their edits into the real database.
   */
  const syncEnabled = !DEMO_MODE && authStatus === 'ready';
  const syncOrgId = currentUser?.organizationId || currentOrg.id;

  /*
   * Each slice below was `useState` seeded from localStorage, with a useEffect
   * writing it back. That made every record per-browser: invisible to a second
   * device, lost with a cleared cache, and unreadable by anything server-side.
   *
   * useSyncedCollection keeps the identical array-and-setter interface — so not
   * one of the mutation functions further down had to change — while persisting
   * to Firestore and subscribing for remote updates. localStorage is still
   * there, demoted to an explicit cache.
   */
  const [customers, setCustomers, customersSync] = useSyncedCollection<Customer>('customers', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_customers`,
    seed: initialCustomers,
  });
  const [leads, setLeads, leadsSync] = useSyncedCollection<Lead>('leads', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_leads`,
    seed: initialLeads,
  });
  const [complaints, setComplaints, complaintsSync] = useSyncedCollection<Complaint>('complaints', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_complaints`,
    seed: initialComplaints,
  });
  const [tasks, setTasks, tasksSync] = useSyncedCollection<Task>('tasks', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_tasks`,
    seed: initialTasks,
  });
  // Collection name is 'users', not 'employees': firestore.rules matches
  // /users/{userId} against request.auth.uid so that a person can maintain
  // their own profile. The document id must therefore be the uid.
  const [employees, setEmployees, employeesSync] = useSyncedCollection<UserProfile>('users', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_employees`,
    seed: initialUsers,
    getId: (u) => u.uid,
  });
  const [quotations, setQuotations, quotationsSync] = useSyncedCollection<Quotation>('quotations', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_quotations`,
    seed: initialQuotations,
  });
  const [invoices, setInvoices, invoicesSync] = useSyncedCollection<Invoice>('invoices', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_invoices`,
    seed: initialInvoices,
  });
  const [documents, setDocuments, documentsSync] = useSyncedCollection<DocumentItem>('documents', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_documents`,
    seed: initialDocuments,
  });
  const [communications, setCommunications, communicationsSync] = useSyncedCollection<Communication>('communications', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_communications`,
    seed: initialCommunications,
  });
  const [automations, setAutomations, automationsSync] = useSyncedCollection<AutomationRule>('automations', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_automations`,
    seed: initialAutomationRules,
  });
  const [automationLogs, setAutomationLogs, automationLogsSync] = useSyncedCollection<AutomationLog>('automationLogs', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_automationLogs`,
    seed: initialAutomationLogs,
  });
  const [notifications, setNotifications, notificationsSync] = useSyncedCollection<AppNotification>('notifications', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_notifications`,
    seed: initialNotifications,
  });
  const [activityLogs, setActivityLogs, activityLogsSync] = useSyncedCollection<ActivityLog>('activityLogs', {
    organizationId: syncOrgId,
    enabled: syncEnabled,
    cacheKey: `${LOCAL_STORAGE_KEY}_activityLogs`,
    seed: initialActivityLogs,
  });
  // Settings is a single document rather than a collection, keyed by the
  // organisation, so it gets the single-doc variant.
  const [settings, setSettings, settingsSync] = useSyncedDoc<OrganizationSettings>(
    'settings',
    syncOrgId,
    {
      organizationId: syncOrgId,
      enabled: syncEnabled,
      cacheKey: `${LOCAL_STORAGE_KEY}_settings`,
      seed: initialSettings,
    }
  );

  /**
   * Worst status across every slice, for the UI to surface.
   *
   * 'offline' matters: it means changes are staying in this browser. The old
   * behaviour was to fall back to localStorage silently, so a failed sync
   * looked exactly like a successful save.
   */
  const syncStatus: SyncStatus = [
    customersSync, leadsSync, complaintsSync, tasksSync, employeesSync, quotationsSync, invoicesSync, documentsSync, communicationsSync, automationsSync, automationLogsSync, notificationsSync, activityLogsSync, settingsSync,
  ].includes('offline')
    ? 'offline'
    : [customersSync, leadsSync, complaintsSync, tasksSync, employeesSync, quotationsSync, invoicesSync, documentsSync, communicationsSync, automationsSync, automationLogsSync, notificationsSync, activityLogsSync, settingsSync].every((x) => x === 'live')
      ? 'live'
      : 'cache';

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);

  // The fourteen localStorage write-back effects that used to live here are
  // gone: useSyncedCollection owns the cache now, alongside the Firestore
  // write it is actually there to perform.

  // Firebase auth state observer
  //
  // Two things changed here, both security-relevant:
  //
  // 1. Role and organizationId now come from CUSTOM CLAIMS on the ID token.
  //    Claims are signed by Firebase and cannot be altered by the client. The
  //    previous version assigned `role: 'business_admin'` in client code, so
  //    the role was whatever the browser said it was.
  //
  // 2. An unrecognised account gets NO access. The previous version created a
  //    business_admin profile in the demo organisation for any signed-in user,
  //    which meant any Google account became an admin of your data just by
  //    signing in. Provisioning is an administrator action, never a side
  //    effect of authenticating.
  //
  // The `employees` dependency was also removed. It caused the observer to
  // tear down and re-subscribe on every employee-list change, and the effect
  // wrote to that same list.
  /** Backoff counter for transient token-service failures. See the catch below. */
  const identityRetriesRef = useRef(0);

  useEffect(() => {
    if (DEMO_MODE) return; // personas own currentUser in demo builds

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        identityRetriesRef.current = 0;
        // The missing `else` branch: sign-out previously left the last user in
        // place, so the UI stayed authenticated after logging out.
        setCurrentUser(null);
        setAuthStatus('signed-out');
        return;
      }

      try {
        const token = await firebaseUser.getIdTokenResult();
        const claimRole = token.claims.role as UserRole | undefined;
        const claimOrg = token.claims.organizationId as string | undefined;

        if (!claimRole || !claimOrg) {
          // Signed in, but nobody has provisioned this account.
          setCurrentUser(null);
          setAuthStatus('unprovisioned');
          return;
        }

        setCurrentUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email ?? '',
          displayName:
            firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
          photoURL: firebaseUser.photoURL ?? undefined,
          role: claimRole,
          organizationId: claimOrg,
          organizationName: currentOrg.name,
          isActive: true,
          createdAt: firebaseUser.metadata.creationTime ?? new Date().toISOString(),
          lastLogin: new Date().toISOString(),
        });
        identityRetriesRef.current = 0;
        setAuthStatus('ready');
      } catch (err) {
        /*
          A failure here is NOT the same as "this account has no role".

          getIdTokenResult() hits the network, so a dropped connection, a
          sleeping laptop or an ad-blocker produces auth/network-request-failed
          — and the old code answered that by showing the "Account not yet
          provisioned" dead end, which is a lie: the claims may be perfectly
          fine, we just could not read them. Worse, it is a dead end, so the
          only way out was to sign out and back in.

          A network fault leaves the gate on 'loading' and retries with
          backoff. Only a token that genuinely carries no role reaches the
          unprovisioned branch above.
        */
        const code = (err as { code?: string } | null)?.code ?? '';
        const transient =
          code === 'auth/network-request-failed' ||
          code === 'auth/internal-error' ||
          code === 'auth/too-many-requests';

        if (transient && identityRetriesRef.current < 5) {
          const attempt = identityRetriesRef.current++;
          const delay = Math.min(1000 * 2 ** attempt, 15000);
          console.warn(
            `Could not reach the token service (${code}); retrying in ${delay}ms.`
          );
          setAuthStatus('loading');
          window.setTimeout(() => {
            void firebaseUser.getIdToken(true).catch(() => undefined);
          }, delay);
          return;
        }

        console.error('Could not resolve identity from the ID token', err);
        setCurrentUser(null);
        setAuthStatus(transient ? 'signed-out' : 'unprovisioned');
      }
    });

    return () => unsubscribe();
  }, [currentOrg.name]);

  // Helper to log audit activity
  const logActivity = useCallback(
    (action: ActivityLog['action'], module: ActivityLog['module'], recordId: string, recordTitle: string, oldValue?: string, newValue?: string) => {
      const newLog: ActivityLog = {
        id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        organizationId: currentOrg.id,
        userId: currentUser?.uid || 'system',
        userName: currentUser?.displayName || 'System Administrator',
        action,
        module,
        recordId,
        recordTitle,
        oldValue,
        newValue,
        // No `ipAddress` here. It used to be the literal '127.0.0.1' on every
        // entry, which makes an audit trail worse than useless — it looks
        // authoritative while telling you nothing. A real client IP can only
        // be observed server-side (X-Forwarded-For at the Express layer); a
        // browser-supplied value would be unverifiable anyway.
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentOrg.id, currentUser]
  );

  /**
   * Write the outcome of one dispatch: a log row always, a rule-counter bump,
   * and a notification when it failed.
   *
   * Extracted so that EVERY exit path records something. The old code built its
   * log entry inline from a parsed response body, which meant the failure paths
   * — the ones an operator most needs to see — wrote nothing at all.
   */
  const recordDispatchOutcome = useCallback(
    (o: {
      ruleId?: string;
      ruleName: string;
      event: string;
      payload: Record<string, any>;
      success: boolean;
      /** The dispatcher deduplicated this; nothing was sent. Not a success. */
      suppressed?: boolean;
      statusCode?: number;
      durationMs?: number;
      attempts?: number;
      responseMessage?: string;
      errorMessage?: string;
    }) => {
      const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

      const logEntry: AutomationLog = {
        id: `log_${stamp}`,
        organizationId: currentOrg.id,
        ruleId: o.ruleId,
        automationName: o.ruleName,
        triggerEvent: o.event as any,
        status: o.suppressed ? 'Suppressed' : o.success ? 'Success' : 'Failed',
        timestamp: new Date().toISOString(),
        durationMs: o.durationMs ?? 0,
        httpStatus: o.statusCode ?? (o.suppressed ? undefined : o.success ? 200 : 0),
        payload: o.payload,
        responseMessage:
          o.responseMessage ?? (!o.suppressed && o.success ? 'Delivered to n8n successfully' : undefined),
        errorMessage: o.errorMessage,
        retryCount: Math.max(0, (o.attempts ?? 1) - 1),
      };
      setAutomationLogs((prev) => [logEntry, ...prev]);

      if (o.ruleId) {
        setAutomations((prev) =>
          prev.map((r) =>
            r.id === o.ruleId
              ? {
                  ...r,
                  lastRun: new Date().toISOString(),
                  // A suppressed dispatch is counted as neither.
                  successCount:
                    !o.suppressed && o.success ? (r.successCount ?? 0) + 1 : r.successCount ?? 0,
                  failureCount:
                    !o.suppressed && !o.success ? (r.failureCount ?? 0) + 1 : r.failureCount ?? 0,
                }
              : r
          )
        );
      }

      // A duplicate is not an incident; do not raise a failure notification.
      if (!o.success && !o.suppressed) {
        setNotifications((prev) => [
          {
            id: `notif_${stamp}`,
            organizationId: currentOrg.id,
            title: `Automation failed: ${o.ruleName}`,
            message: o.errorMessage || 'Webhook execution failed',
            type: 'automation_failure',
            referenceId: logEntry.id,
            referenceType: 'automation',
            isRead: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
      }
    },
    [currentOrg.id]
  );

  // Helper to trigger n8n webhooks when an event occurs.
  //
  // Three changes from the previous implementation:
  //
  //  1. `.filter`, not `.find`. Every enabled rule subscribed to the event now
  //     fires. Before, only the first matched — any second rule on the same
  //     event was silently inert: no send, no log, no error.
  //
  //  2. No credential leaves the browser. The request carries the event, the
  //     payload and the rule; the server holds the secret and validates the
  //     destination against its own allowlist.
  //
  //  3. A failed dispatch is recorded. `await res.json()` used to sit inside
  //     the try, with the log entry built from the parsed body — so when the
  //     response was not JSON the parse threw, the whole write was skipped and
  //     the failure vanished. Logging now happens whatever the outcome.
  const dispatchWebhookEvent = useCallback(
    async (event: AutomationRule['triggerEvent'] | string, rawPayload: Record<string, any>, customRuleName?: string) => {
      if (!settings.n8nEnabled) return;

      const matchingRules = automations.filter((r) => r.isEnabled && r.triggerEvent === event);
      if (matchingRules.length === 0) return;

      // Build the payload once — it is identical for every rule on this event.
      let completePayload;
      try {
        completePayload = buildWebhookPayload(event as string, rawPayload, {
          organizationName: currentOrg.name,
          organizationId: currentOrg.id,
          organizationEmail: currentOrg.email,
          organizationPhone: currentOrg.phone,
          triggeredByName: currentUser?.displayName || 'Administrator',
          // No hardcoded address. If there is no authenticated actor the
          // payload says so rather than naming a real person's inbox.
          triggeredByEmail: currentUser?.email || '',
        });
      } catch (err) {
        // A record with no usable phone or email can no longer be dispatched to
        // a stand-in address. Record the refusal so the operator sees it.
        if (err instanceof MissingContactError) {
          recordDispatchOutcome({
            ruleId: matchingRules[0]?.id,
            ruleName: customRuleName || matchingRules[0]?.name || `Webhook Event: ${event}`,
            event,
            payload: rawPayload,
            success: false,
            errorMessage: err.message,
          });
          return;
        }
        throw err;
      }

      // One authentication token for the whole fan-out.
      let authHeader: Record<string, string> = {};
      try {
        const token = await auth.currentUser?.getIdToken();
        if (token) authHeader = { Authorization: `Bearer ${token}` };
      } catch {
        // Fall through unauthenticated — the server decides whether to refuse.
      }

      // Dispatch to every matching rule, in parallel. One rule failing must not
      // stop the others.
      await Promise.all(
        matchingRules.map(async (rule) => {
          const ruleName = customRuleName || rule.name || `Webhook Event: ${event}`;
          const startedAt = Date.now();

          try {
            const res = await fetch('/api/webhooks/n8n/dispatch', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', ...authHeader },
              body: JSON.stringify({
                event,
                payload: completePayload,
                ruleId: rule.id,
                ruleName,
                // Advisory only. The server ignores this unless the host is in
                // its allowlist, and never takes a credential from here.
                webhookUrl: rule.targetWebhookUrl || settings.n8nWebhookUrl || undefined,
              }),
            });

            // Check the response is actually JSON before parsing it. A proxy
            // error page or an SPA fallback is HTML, and parsing that is what
            // used to throw and swallow the whole log write.
            const contentType = res.headers.get('content-type') ?? '';
            if (!contentType.includes('application/json')) {
              throw new Error(
                `Server returned ${res.status} ${res.statusText || ''} as ${contentType || 'an unknown type'} ` +
                  `instead of JSON. Is /api reachable?`
              );
            }

            const data = await res.json();
            recordDispatchOutcome({
              ruleId: rule.id,
              ruleName,
              event,
              payload: completePayload,
              success: Boolean(data.success),
              suppressed: data.status === 'skipped',
              statusCode: data.statusCode,
              durationMs: data.durationMs ?? Date.now() - startedAt,
              attempts: data.attempts,
              responseMessage:
                typeof data.response === 'string' ? data.response : data.response ? JSON.stringify(data.response) : undefined,
              errorMessage: explainDispatchError(res.status, data.error),
            });
          } catch (err) {
            // Network failure, non-JSON response, anything. It gets logged.
            recordDispatchOutcome({
              ruleId: rule.id,
              ruleName,
              event,
              payload: completePayload,
              success: false,
              durationMs: Date.now() - startedAt,
              errorMessage: err instanceof Error ? err.message : String(err),
            });
          }
        })
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [automations, settings, currentOrg, currentUser]
  );

  // Switch role helper for instant RBAC demo testing.
  //
  // Guarded at the point of use, not merely hidden in the UI: this bypasses
  // authentication entirely, so it must be unreachable in a production build
  // even if some other component still calls it.
  const switchRole = useCallback(
    (role: UserRole) => {
      assertDemoMode('Switching role without signing in');
      const matched = initialUsers.find((u) => u.role === role);
      if (matched) {
        setCurrentUser(matched);
        setAuthStatus('ready');
      } else if (currentUser) {
        setCurrentUser({ ...currentUser, role });
      }
    },
    [currentUser]
  );

  // Customer Management
  const addCustomer = useCallback(
    async (customerData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
      const newCustomer: Customer = {
        ...customerData,
        id: `cust_${Date.now()}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setCustomers((prev) => [newCustomer, ...prev]);
      logActivity('create', 'customers', newCustomer.id, newCustomer.fullName, undefined, 'Added customer record');

      // Dispatch webhook with complete customer contact details
      dispatchWebhookEvent('new_customer', {
        customerId: newCustomer.customerId,
        customerName: newCustomer.fullName,
        fullName: newCustomer.fullName,
        company: newCustomer.companyName,
        companyName: newCustomer.companyName,
        email: newCustomer.email,
        contactNumber: newCustomer.whatsappNumber || newCustomer.mobileNumber,
        phone: newCustomer.whatsappNumber || newCustomer.mobileNumber,
        whatsappNumber: newCustomer.whatsappNumber || newCustomer.mobileNumber,
        address: `${newCustomer.address}, ${newCustomer.city}, ${newCustomer.state} - ${newCustomer.pinCode}`,
        category: newCustomer.category,
        tier: newCustomer.category,
        industry: newCustomer.industry,
        source: newCustomer.source,
        assignedTo: newCustomer.assignedEmployeeName,
        assignedEmployeeName: newCustomer.assignedEmployeeName,
      });

      return newCustomer;
    },
    [currentOrg.id, logActivity, dispatchWebhookEvent]
  );

  const updateCustomer = useCallback(
    async (id: string, updates: Partial<Customer>) => {
      setCustomers((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
            logActivity('update', 'customers', id, updated.fullName, undefined, 'Updated customer details');
            return updated;
          }
          return c;
        })
      );
    },
    [logActivity]
  );

  const deleteCustomer = useCallback(
    async (id: string) => {
      const target = customers.find((c) => c.id === id);
      setCustomers((prev) => prev.filter((c) => c.id !== id));
      if (target) {
        logActivity('delete', 'customers', id, target.fullName, 'Active', 'Deleted/Archived customer');
      }
    },
    [customers, logActivity]
  );

  const importCustomersFromCSV = useCallback(
    async (newCustomersData: Omit<Customer, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>[]) => {
      const createdCustomers: Customer[] = newCustomersData.map((data, index) => ({
        ...data,
        id: `cust_csv_${Date.now()}_${index}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      setCustomers((prev) => [...createdCustomers, ...prev]);
      logActivity('import', 'customers', 'bulk_import', `CSV Import (${createdCustomers.length} customers)`);
      return createdCustomers.length;
    },
    [currentOrg.id, logActivity]
  );

  // Lead Management
  const addLead = useCallback(
    async (leadData: Omit<Lead, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
      const newLead: Lead = {
        ...leadData,
        id: `lead_${Date.now()}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setLeads((prev) => [newLead, ...prev]);
      logActivity('create', 'leads', newLead.id, `${newLead.customerName} - ${newLead.company}`, undefined, `Created lead in ${newLead.status} stage`);

      // Notification
      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `New Lead: ${newLead.customerName}`,
        message: `${newLead.company} (${newLead.status}) - Estimated Value: ₹${newLead.estimatedValue.toLocaleString()}`,
        type: 'new_lead',
        referenceId: newLead.id,
        referenceType: 'lead',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Webhook with complete prospect details
      dispatchWebhookEvent('new_lead', {
        leadId: newLead.leadId,
        customerName: newLead.customerName,
        company: newLead.company,
        companyName: newLead.company,
        email: newLead.email,
        contactNumber: newLead.mobile || newLead.mobileNumber,
        phone: newLead.mobile || newLead.mobileNumber,
        whatsappNumber: newLead.mobile || newLead.mobileNumber,
        requirement: newLead.requirement,
        value: newLead.estimatedValue,
        estimatedValue: newLead.estimatedValue,
        status: newLead.status,
        priority: newLead.priority,
        source: newLead.source,
        assignedTo: newLead.assignedToName,
        assignedToName: newLead.assignedToName,
      });

      return newLead;
    },
    [currentOrg.id, logActivity, dispatchWebhookEvent]
  );

  const updateLead = useCallback(
    async (id: string, updates: Partial<Lead>) => {
      setLeads((prev) =>
        prev.map((l) => {
          if (l.id === id) {
            const updated = { ...l, ...updates, updatedAt: new Date().toISOString() };
            logActivity('update', 'leads', id, l.customerName, undefined, 'Updated lead information');
            return updated;
          }
          return l;
        })
      );
    },
    [logActivity]
  );

  const updateLeadStage = useCallback(
    async (id: string, stage: LeadStage) => {
      const target = leads.find((l) => l.id === id);
      const oldStage = target?.status;
      setLeads((prev) =>
        prev.map((l) => (l.id === id ? { ...l, status: stage, updatedAt: new Date().toISOString() } : l))
      );

      if (target) {
        logActivity('status_change', 'leads', id, target.customerName, oldStage, stage);
        dispatchWebhookEvent('lead_status_changed', {
          leadId: target.leadId,
          customerName: target.customerName,
          company: target.company,
          companyName: target.company,
          email: target.email,
          contactNumber: target.mobile || target.mobileNumber,
          phone: target.mobile || target.mobileNumber,
          whatsappNumber: target.mobile || target.mobileNumber,
          oldStage,
          newStage: stage,
          value: target.estimatedValue,
          estimatedValue: target.estimatedValue,
          priority: target.priority,
          assignedTo: target.assignedToName,
        });
      }
    },
    [leads, logActivity, dispatchWebhookEvent]
  );

  const deleteLead = useCallback(
    async (id: string) => {
      const target = leads.find((l) => l.id === id);
      setLeads((prev) => prev.filter((l) => l.id !== id));
      if (target) {
        logActivity('delete', 'leads', id, target.customerName, target.status, 'Deleted lead');
      }
    },
    [leads, logActivity]
  );

  // Complaints / Support Tickets
  const addComplaint = useCallback(
    async (complaintData: Omit<Complaint, 'id' | 'createdAt' | 'updatedAt' | 'organizationId' | 'isOverdue'>) => {
      const newTicket: Complaint = {
        ...complaintData,
        id: `comp_${Date.now()}`,
        organizationId: currentOrg.id,
        isOverdue: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setComplaints((prev) => [newTicket, ...prev]);
      logActivity('create', 'complaints', newTicket.id, `${newTicket.ticketNumber} (${newTicket.complaintType})`, undefined, 'Created complaint ticket');

      // Notification
      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `New Ticket: ${newTicket.ticketNumber} [${newTicket.priority}]`,
        message: `${newTicket.customerName}: ${newTicket.description.slice(0, 80)}...`,
        type: 'new_complaint',
        referenceId: newTicket.id,
        referenceType: 'complaint',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Webhook with complete ticket & contact details
      const matchedCustomer = customers.find(
        (c) => (newTicket.customerId && c.id === newTicket.customerId) || c.fullName === newTicket.customerName
      );
      const contactNumber = newTicket.customerPhone || matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || '+91 98201 94821';
      const email = matchedCustomer?.email || 'rajesh.mehra@mehra-logistics.com';
      const company = matchedCustomer?.companyName || 'Corporate Client';

      dispatchWebhookEvent('new_complaint', {
        ticketNumber: newTicket.ticketNumber,
        customerName: newTicket.customerName,
        company,
        companyName: company,
        email,
        contactNumber,
        phone: contactNumber,
        whatsappNumber: contactNumber,
        type: newTicket.complaintType,
        complaintType: newTicket.complaintType,
        description: newTicket.description,
        priority: newTicket.priority,
        slaHours: newTicket.slaHours,
        assignedTo: newTicket.assignedEmployeeName,
        assignedEmployeeName: newTicket.assignedEmployeeName,
      });

      return newTicket;
    },
    [currentOrg.id, customers, logActivity, dispatchWebhookEvent]
  );

  const updateComplaint = useCallback(
    async (id: string, updates: Partial<Complaint>) => {
      setComplaints((prev) =>
        prev.map((c) => {
          if (c.id === id) {
            const updated = { ...c, ...updates, updatedAt: new Date().toISOString() };
            logActivity('update', 'complaints', id, c.ticketNumber, undefined, 'Updated ticket details');
            return updated;
          }
          return c;
        })
      );
    },
    [logActivity]
  );

  const resolveComplaint = useCallback(
    async (id: string, resolution: string, feedback?: string, rating?: number) => {
      const target = complaints.find((c) => c.id === id);
      setComplaints((prev) =>
        prev.map((c) =>
          c.id === id
            ? {
                ...c,
                status: 'Resolved',
                resolution,
                resolutionDate: new Date().toISOString(),
                customerFeedback: feedback,
                rating: rating || 5,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );

      if (target) {
        const matchedCustomer = customers.find(
          (c) => (target.customerId && c.id === target.customerId) || c.fullName === target.customerName
        );
        const contactNumber = target.customerPhone || matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || '+91 98201 94821';
        const email = matchedCustomer?.email || 'rajesh.mehra@mehra-logistics.com';
        const company = matchedCustomer?.companyName || 'Corporate Client';

        logActivity('status_change', 'complaints', id, target.ticketNumber, target.status, 'Resolved');
        dispatchWebhookEvent('complaint_resolved', {
          ticketNumber: target.ticketNumber,
          customerName: target.customerName,
          company,
          companyName: company,
          email,
          contactNumber,
          phone: contactNumber,
          whatsappNumber: contactNumber,
          resolution,
          rating: rating || 5,
          complaintType: target.complaintType,
        });
      }
    },
    [complaints, customers, logActivity, dispatchWebhookEvent]
  );

  // Tasks
  const addTask = useCallback(
    async (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
      const newTask: Task = {
        ...taskData,
        id: `task_${Date.now()}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setTasks((prev) => [newTask, ...prev]);
      logActivity('create', 'tasks', newTask.id, newTask.taskName, undefined, `Assigned to ${newTask.assignedToName}`);

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `Task Assigned: ${newTask.taskName}`,
        message: `Due on ${newTask.dueDate} (Priority: ${newTask.priority})`,
        type: 'task_assigned',
        referenceId: newTask.id,
        referenceType: 'task',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      const matchedCustomer = customers.find(
        (c) => (newTask.relatedCustomerId && c.id === newTask.relatedCustomerId) || (newTask.relatedId && c.id === newTask.relatedId)
      );
      const contactNumber = matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || '+91 98201 94821';
      const email = currentUser?.email || '';

      dispatchWebhookEvent('new_task', {
        taskId: newTask.id,
        taskName: newTask.taskName,
        description: newTask.description,
        assignedTo: newTask.assignedToName,
        assignedToName: newTask.assignedToName,
        dueDate: newTask.dueDate,
        priority: newTask.priority,
        customerName: newTask.relatedName || matchedCustomer?.fullName || 'General Operations',
        company: matchedCustomer?.companyName || currentOrg.name,
        email,
        contactNumber,
        phone: contactNumber,
        whatsappNumber: contactNumber,
      });

      return newTask;
    },
    [currentOrg, currentUser, customers, logActivity, dispatchWebhookEvent]
  );

  const updateTask = useCallback(
    async (id: string, updates: Partial<Task>) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const updated = { ...t, ...updates, updatedAt: new Date().toISOString() };
            logActivity('update', 'tasks', id, t.taskName, undefined, 'Updated task details');
            return updated;
          }
          return t;
        })
      );
    },
    [logActivity]
  );

  const updateTaskStatus = useCallback(
    async (id: string, status: TaskStatus, percentage?: number) => {
      const target = tasks.find((t) => t.id === id);
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id === id) {
            const comp = status === 'Completed' ? 100 : percentage !== undefined ? percentage : t.completionPercentage;
            return {
              ...t,
              status,
              completionPercentage: comp,
              updatedAt: new Date().toISOString(),
            };
          }
          return t;
        })
      );

      if (target) {
        logActivity('status_change', 'tasks', id, target.taskName, target.status, status);
      }
    },
    [tasks, logActivity]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      const target = tasks.find((t) => t.id === id);
      setTasks((prev) => prev.filter((t) => t.id !== id));
      if (target) {
        logActivity('delete', 'tasks', id, target.taskName, target.status, 'Deleted task');
      }
    },
    [tasks, logActivity]
  );

  // Quotations Management
  const addQuotation = useCallback(
    async (quoteData: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
      const quoteNumber =
        quoteData.quotationNumber ||
        `QT-${new Date().getFullYear()}-${String(quotations.length + 1).padStart(3, '0')}`;
      const newQuote: Quotation = {
        ...quoteData,
        quotationNumber: quoteNumber,
        id: `quote_${Date.now()}`,
        organizationId: currentOrg.id,
        createdBy: currentUser?.uid || 'user_biz_admin_02',
        createdByName: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setQuotations((prev) => [newQuote, ...prev]);
      logActivity(
        'create',
        'quotations',
        newQuote.id,
        `${newQuote.quotationNumber} - ${newQuote.customerName}`,
        undefined,
        `Created quotation for ₹${newQuote.grandTotal.toLocaleString('en-IN')}`
      );

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `New Quotation: ${newQuote.quotationNumber}`,
        message: `Created for ${newQuote.customerName} (${newQuote.companyName}) - ₹${newQuote.grandTotal.toLocaleString('en-IN')}`,
        type: 'quotation_created',
        referenceId: newQuote.id,
        referenceType: 'quotation',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Webhook with complete quotation details
      dispatchWebhookEvent('quotation_created', {
        quotationId: newQuote.id,
        quotationNumber: newQuote.quotationNumber,
        customerName: newQuote.customerName,
        company: newQuote.companyName,
        companyName: newQuote.companyName,
        email: newQuote.customerEmail,
        contactNumber: newQuote.customerPhone,
        phone: newQuote.customerPhone,
        whatsappNumber: newQuote.customerPhone,
        grandTotal: newQuote.grandTotal,
        validUntil: newQuote.validUntil,
        status: newQuote.status,
        items: newQuote.items,
        createdBy: newQuote.createdByName,
      });

      return newQuote;
    },
    [currentOrg.id, currentUser, quotations.length, logActivity, dispatchWebhookEvent]
  );

  const updateQuotation = useCallback(
    async (id: string, updates: Partial<Quotation>) => {
      setQuotations((prev) =>
        prev.map((q) => {
          if (q.id === id) {
            const updated = { ...q, ...updates, updatedAt: new Date().toISOString() };
            logActivity(
              'update',
              'quotations',
              id,
              `${updated.quotationNumber} - ${updated.customerName}`,
              undefined,
              'Updated quotation details'
            );
            return updated;
          }
          return q;
        })
      );
    },
    [logActivity]
  );

  const deleteQuotation = useCallback(
    async (id: string) => {
      const target = quotations.find((q) => q.id === id);
      setQuotations((prev) => prev.filter((q) => q.id !== id));
      if (target) {
        logActivity(
          'delete',
          'quotations',
          id,
          `${target.quotationNumber} - ${target.customerName}`,
          target.status,
          'Deleted quotation'
        );
      }
    },
    [quotations, logActivity]
  );

  const convertQuotationToInvoice = useCallback(
    async (quotationId: string) => {
      const quote = quotations.find((q) => q.id === quotationId);
      if (!quote) throw new Error('Quotation not found');

      const invoiceNumber = `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
      const newInvoice: Invoice = {
        id: `inv_${Date.now()}`,
        invoiceNumber,
        quotationId: quote.id,
        quotationNumber: quote.quotationNumber,
        organizationId: currentOrg.id,
        customerId: quote.customerId,
        customerName: quote.customerName,
        companyName: quote.companyName,
        customerEmail: quote.customerEmail,
        customerPhone: quote.customerPhone,
        customerAddress: quote.customerAddress,
        customerGst: quote.customerGst,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
        items: [...quote.items],
        subtotal: quote.subtotal,
        taxTotal: quote.taxTotal,
        discountTotal: quote.discountTotal,
        grandTotal: quote.grandTotal,
        amountPaid: 0,
        balanceDue: quote.grandTotal,
        currency: quote.currency || 'INR',
        status: 'Sent',
        notes: `Converted from Quotation ${quote.quotationNumber}. ${quote.notes || ''}`.trim(),
        terms:
          quote.terms ||
          '1. Payment due within 15 days of invoice date.\n2. Bank Details: HDFC Bank, A/C: 50200049281726, IFSC: HDFC0000240.',
        createdBy: currentUser?.uid || 'user_biz_admin_02',
        createdByName: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setInvoices((prev) => [newInvoice, ...prev]);

      setQuotations((prev) =>
        prev.map((q) =>
          q.id === quotationId
            ? {
                ...q,
                status: 'Converted',
                convertedInvoiceId: newInvoice.id,
                convertedInvoiceNumber: newInvoice.invoiceNumber,
                updatedAt: new Date().toISOString(),
              }
            : q
        )
      );

      logActivity(
        'status_change',
        'quotations',
        quote.id,
        `${quote.quotationNumber} -> ${newInvoice.invoiceNumber}`,
        quote.status,
        `Converted to Invoice ${newInvoice.invoiceNumber}`
      );

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `Quotation Converted: ${quote.quotationNumber}`,
        message: `Tax Invoice ${newInvoice.invoiceNumber} created for ${newInvoice.customerName} (₹${newInvoice.grandTotal.toLocaleString('en-IN')})`,
        type: 'invoice_created',
        referenceId: newInvoice.id,
        referenceType: 'invoice',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Webhook for new invoice converted from quotation
      dispatchWebhookEvent('new_invoice', {
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        quotationNumber: quote.quotationNumber,
        customerName: newInvoice.customerName,
        company: newInvoice.companyName,
        companyName: newInvoice.companyName,
        email: newInvoice.customerEmail,
        contactNumber: newInvoice.customerPhone,
        phone: newInvoice.customerPhone,
        whatsappNumber: newInvoice.customerPhone,
        grandTotal: newInvoice.grandTotal,
        amountPaid: newInvoice.amountPaid,
        balanceDue: newInvoice.balanceDue,
        dueDate: newInvoice.dueDate,
        status: newInvoice.status,
      });

      return newInvoice;
    },
    [quotations, invoices.length, currentOrg.id, currentUser, logActivity, dispatchWebhookEvent]
  );

  // Invoices Management
  const addInvoice = useCallback(
    async (invData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt' | 'organizationId'>) => {
      const invoiceNumber =
        invData.invoiceNumber ||
        `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`;
      const amountPaid = invData.amountPaid || 0;
      const balanceDue = invData.grandTotal - amountPaid;
      let status: Invoice['status'] = invData.status || 'Sent';
      if (balanceDue <= 0 && amountPaid > 0) {
        status = 'Paid';
      } else if (amountPaid > 0 && balanceDue > 0) {
        status = 'Partially Paid';
      }

      const newInvoice: Invoice = {
        ...invData,
        invoiceNumber,
        amountPaid,
        balanceDue,
        status,
        id: `inv_${Date.now()}`,
        organizationId: currentOrg.id,
        createdBy: currentUser?.uid || 'user_biz_admin_02',
        createdByName: currentUser?.displayName || 'Admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setInvoices((prev) => [newInvoice, ...prev]);
      logActivity(
        'create',
        'invoices',
        newInvoice.id,
        `${newInvoice.invoiceNumber} - ${newInvoice.customerName}`,
        undefined,
        `Created invoice for ₹${newInvoice.grandTotal.toLocaleString('en-IN')}`
      );

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `New Invoice: ${newInvoice.invoiceNumber}`,
        message: `Issued to ${newInvoice.customerName} - ₹${newInvoice.grandTotal.toLocaleString('en-IN')} (Due: ${newInvoice.dueDate})`,
        type: 'invoice_created',
        referenceId: newInvoice.id,
        referenceType: 'invoice',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Dispatch webhook for newly created invoice
      dispatchWebhookEvent('new_invoice', {
        invoiceId: newInvoice.id,
        invoiceNumber: newInvoice.invoiceNumber,
        customerName: newInvoice.customerName,
        company: newInvoice.companyName,
        companyName: newInvoice.companyName,
        email: newInvoice.customerEmail,
        contactNumber: newInvoice.customerPhone,
        phone: newInvoice.customerPhone,
        whatsappNumber: newInvoice.customerPhone,
        grandTotal: newInvoice.grandTotal,
        amountPaid: newInvoice.amountPaid,
        balanceDue: newInvoice.balanceDue,
        dueDate: newInvoice.dueDate,
        status: newInvoice.status,
        items: newInvoice.items,
      });

      return newInvoice;
    },
    [invoices.length, currentOrg.id, currentUser, logActivity, dispatchWebhookEvent]
  );

  const updateInvoice = useCallback(
    async (id: string, updates: Partial<Invoice>) => {
      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === id) {
            const grandTotal = updates.grandTotal !== undefined ? updates.grandTotal : inv.grandTotal;
            const amountPaid = updates.amountPaid !== undefined ? updates.amountPaid : inv.amountPaid;
            const balanceDue = grandTotal - amountPaid;
            let status = updates.status || inv.status;
            if (balanceDue <= 0 && amountPaid > 0 && status !== 'Cancelled') {
              status = 'Paid';
            } else if (amountPaid > 0 && balanceDue > 0 && status !== 'Cancelled') {
              status = 'Partially Paid';
            }
            const updated: Invoice = {
              ...inv,
              ...updates,
              grandTotal,
              amountPaid,
              balanceDue,
              status,
              updatedAt: new Date().toISOString(),
            };
            logActivity(
              'update',
              'invoices',
              id,
              `${updated.invoiceNumber} - ${updated.customerName}`,
              undefined,
              'Updated invoice details'
            );
            return updated;
          }
          return inv;
        })
      );
    },
    [logActivity]
  );

  const deleteInvoice = useCallback(
    async (id: string) => {
      const target = invoices.find((inv) => inv.id === id);
      setInvoices((prev) => prev.filter((inv) => inv.id !== id));
      if (target) {
        logActivity(
          'delete',
          'invoices',
          id,
          `${target.invoiceNumber} - ${target.customerName}`,
          target.status,
          'Deleted invoice'
        );
      }
    },
    [invoices, logActivity]
  );

  const recordInvoicePayment = useCallback(
    async (
      invoiceId: string,
      amount: number,
      paymentMethod?: Invoice['paymentMethod'],
      reference?: string,
      notes?: string
    ) => {
      const target = invoices.find((inv) => inv.id === invoiceId);
      if (!target) throw new Error('Invoice not found');

      const newAmountPaid = (target.amountPaid || 0) + amount;
      const newBalanceDue = Math.max(0, target.grandTotal - newAmountPaid);
      const newStatus: Invoice['status'] = newBalanceDue <= 0 ? 'Paid' : 'Partially Paid';

      setInvoices((prev) =>
        prev.map((inv) => {
          if (inv.id === invoiceId) {
            return {
              ...inv,
              amountPaid: newAmountPaid,
              balanceDue: newBalanceDue,
              status: newStatus,
              paymentMethod: paymentMethod || inv.paymentMethod || 'Bank Transfer / NEFT',
              paymentReference: reference || inv.paymentReference,
              paidAt: new Date().toISOString(),
              notes: notes
                ? `${inv.notes ? inv.notes + '\n' : ''}[Payment of ₹${amount.toLocaleString('en-IN')}]: ${notes}`
                : inv.notes,
              updatedAt: new Date().toISOString(),
            };
          }
          return inv;
        })
      );

      logActivity(
        'status_change',
        'invoices',
        invoiceId,
        target.invoiceNumber,
        target.status,
        `Recorded payment of ₹${amount.toLocaleString('en-IN')}. New balance: ₹${newBalanceDue.toLocaleString('en-IN')}`
      );

      const notif: AppNotification = {
        id: `notif_${Date.now()}`,
        organizationId: currentOrg.id,
        title: `Payment Recorded: ${target.invoiceNumber}`,
        message: `₹${amount.toLocaleString('en-IN')} received from ${target.customerName}. Status: ${newStatus}`,
        type: 'payment_received',
        referenceId: target.id,
        referenceType: 'invoice',
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setNotifications((prev) => [notif, ...prev]);

      // Dispatch webhook for payment received
      dispatchWebhookEvent('payment_received', {
        invoiceId: target.id,
        invoiceNumber: target.invoiceNumber,
        customerName: target.customerName,
        company: target.companyName,
        companyName: target.companyName,
        email: target.customerEmail,
        contactNumber: target.customerPhone,
        phone: target.customerPhone,
        whatsappNumber: target.customerPhone,
        amountPaid: amount,
        grandTotal: target.grandTotal,
        balanceRemaining: newBalanceDue,
        balanceDue: newBalanceDue,
        paymentMethod: paymentMethod || 'Bank Transfer / NEFT',
        paymentReference: reference || 'N/A',
        status: newStatus,
      });
    },
    [invoices, currentOrg.id, logActivity, dispatchWebhookEvent]
  );

  // Documents
  const addDocument = useCallback(
    async (docData: Omit<DocumentItem, 'id' | 'createdAt' | 'organizationId'>) => {
      const newDoc: DocumentItem = {
        ...docData,
        id: `doc_${Date.now()}`,
        organizationId: currentOrg.id,
        createdAt: new Date().toISOString(),
      };

      setDocuments((prev) => [newDoc, ...prev]);
      logActivity('create', 'documents', newDoc.id, newDoc.name, undefined, `Uploaded ${newDoc.category} document`);

      const contactNumber = '+91 98201 94821';
      const email = currentUser?.email || '';

      dispatchWebhookEvent('document_uploaded', {
        documentId: newDoc.id,
        name: newDoc.name,
        category: newDoc.category,
        uploadedBy: newDoc.uploadedByName,
        customerName: newDoc.customerName || 'Document Repository',
        company: currentOrg.name,
        companyName: currentOrg.name,
        email,
        contactNumber,
        phone: contactNumber,
        whatsappNumber: contactNumber,
        fileSize: newDoc.fileSize,
      });

      return newDoc;
    },
    [currentOrg, currentUser, logActivity, dispatchWebhookEvent]
  );

  const deleteDocument = useCallback(
    async (id: string) => {
      const target = documents.find((d) => d.id === id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
      if (target) {
        logActivity('delete', 'documents', id, target.name, undefined, 'Deleted document');
      }
    },
    [documents, logActivity]
  );

  // Communications (WhatsApp & Email)
  const sendCommunication = useCallback(
    async (commData: Omit<Communication, 'id' | 'organizationId' | 'timestamp' | 'status'>) => {
      const newComm: Communication = {
        ...commData,
        id: `comm_${Date.now()}`,
        organizationId: currentOrg.id,
        status: 'sent',
        timestamp: new Date().toISOString(),
      };

      setCommunications((prev) => [newComm, ...prev]);
      logActivity(
        'create',
        'customers',
        newComm.customerId,
        newComm.customerName,
        undefined,
        `Dispatched ${newComm.channel.toUpperCase()} message: ${newComm.templateName || 'Direct Message'}`
      );

      const matchedCustomer = customers.find((c) => c.id === newComm.customerId);
      /*
        These two feed the webhook payload, and the server refuses a payload it
        cannot address (422). That guard was dead: both fell back to
        '+91 98201 94821' and 'customer@example.com', so every payload looked
        addressable and n8n was handed a real-looking stranger's number to
        message. Leaving them undefined lets the refusal work as intended.
      */
      const contactNumber =
        (newComm.channel === 'whatsapp' ? newComm.recipient : undefined) ||
        matchedCustomer?.whatsappNumber ||
        matchedCustomer?.mobileNumber ||
        undefined;
      const email =
        (newComm.channel === 'email' ? newComm.recipient : undefined) ||
        matchedCustomer?.email ||
        undefined;

      // Dispatch webhook for communication
      dispatchWebhookEvent('new_communication', {
        communicationId: newComm.id,
        channel: newComm.channel,
        customerName: newComm.customerName,
        company: matchedCustomer?.companyName || 'Valued Client',
        companyName: matchedCustomer?.companyName || 'Valued Client',
        recipient: newComm.recipient,
        email,
        contactNumber,
        phone: contactNumber,
        whatsappNumber: contactNumber,
        subject: newComm.subject,
        message: newComm.message,
        bodyMessage: newComm.message,
        templateName: newComm.templateName,
      });
    },
    [currentOrg.id, customers, logActivity, dispatchWebhookEvent]
  );

  // A customer/lead asking to be called back — the one business action this
  // app has a payload template and a seeded automation rule for, but never
  // actually fired: nothing called dispatchWebhookEvent('callback_requested',
  // ...) from anywhere. Logs an incoming 'call' communication (consistent
  // with how every other channel is recorded) and fires the webhook.
  const requestCallback = useCallback(
    async (input: { customerId?: string; leadId?: string; preferredTime?: string; reason?: string }) => {
      const matchedCustomer = customers.find((c) => c.id === input.customerId);
      const matchedLead = leads.find((l) => l.id === input.leadId);

      const customerName = matchedCustomer?.fullName || matchedLead?.customerName || 'Unknown Contact';
      const company = matchedCustomer?.companyName || matchedLead?.company || '';
      const contactNumber = matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || matchedLead?.mobile || undefined;
      const email = matchedCustomer?.email || matchedLead?.email || undefined;

      if (matchedCustomer) {
        const newComm: Communication = {
          id: `comm_${Date.now()}`,
          organizationId: currentOrg.id,
          customerId: matchedCustomer.id,
          customerName,
          channel: 'call',
          type: 'incoming',
          recipient: contactNumber,
          templateName: 'Callback Request',
          message: `Callback requested${input.preferredTime ? ` for ${input.preferredTime}` : ''}${
            input.reason ? ` — ${input.reason}` : ''
          }.`,
          sentById: currentUser?.uid || 'system',
          sentByName: currentUser?.displayName || 'Support Team',
          status: 'sent',
          timestamp: new Date().toISOString(),
        };
        setCommunications((prev) => [newComm, ...prev]);
      }

      logActivity(
        'create',
        'customers',
        input.customerId || input.leadId || 'unknown',
        customerName,
        undefined,
        'Logged customer callback request'
      );

      await dispatchWebhookEvent('callback_requested', {
        recordId: input.customerId || input.leadId,
        customerId: input.customerId,
        leadId: input.leadId,
        customerName,
        company,
        companyName: company,
        email,
        contactNumber,
        phone: contactNumber,
        whatsappNumber: contactNumber,
        preferredTime: input.preferredTime,
        reason: input.reason,
      });
    },
    [currentOrg.id, currentUser, customers, leads, logActivity, dispatchWebhookEvent]
  );

  // Settings & Profile
  const updateSettings = useCallback(
    async (newSettings: Partial<OrganizationSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings, updatedAt: new Date().toISOString() };
        logActivity('update', 'settings', 'org_settings', 'Integration & Webhook Settings', undefined, 'Saved configuration');
        return updated;
      });
    },
    [logActivity]
  );

  const updateBusinessProfile = useCallback(
    async (orgUpdates: Partial<Organization>) => {
      setCurrentOrg((prev) => {
        const updated = { ...prev, ...orgUpdates, updatedAt: new Date().toISOString() };
        logActivity('update', 'settings', prev.id, updated.name, undefined, 'Updated business organization profile');
        return updated;
      });
    },
    [logActivity]
  );

  // Employees Management
  const addEmployee = useCallback(
    async (employeeData: Omit<UserProfile, 'uid' | 'createdAt' | 'organizationId'>) => {
      const newEmployee: UserProfile = {
        ...employeeData,
        uid: `user_${Date.now()}`,
        organizationId: currentOrg.id,
        organizationName: currentOrg.name,
        createdAt: new Date().toISOString(),
      };

      setEmployees((prev) => [newEmployee, ...prev]);
      logActivity('create', 'users', newEmployee.uid, newEmployee.displayName, undefined, `Added staff with role ${newEmployee.role}`);
      return newEmployee;
    },
    [currentOrg.id, currentOrg.name, logActivity]
  );

  const updateEmployee = useCallback(
    async (uid: string, updates: Partial<UserProfile>) => {
      setEmployees((prev) =>
        prev.map((e) => {
          if (e.uid === uid) {
            const updated = { ...e, ...updates };
            logActivity('update', 'users', uid, updated.displayName, e.role, updated.role);
            return updated;
          }
          return e;
        })
      );
    },
    [logActivity]
  );

  // Automation rule toggling & testing
  const toggleAutomationRule = useCallback(
    async (ruleId: string) => {
      setAutomations((prev) =>
        prev.map((r) => {
          if (r.id === ruleId) {
            const toggled = { ...r, isEnabled: !r.isEnabled };
            logActivity('status_change', 'automations', r.id, r.name, r.isEnabled ? 'Enabled' : 'Disabled', toggled.isEnabled ? 'Enabled' : 'Disabled');
            return toggled;
          }
          return r;
        })
      );
    },
    [logActivity]
  );

  const triggerAutomationRule = useCallback(
    async (ruleId: string, customPayload?: Record<string, any>) => {
      const rule = automations.find((r) => r.id === ruleId);
      const targetUrl = rule?.targetWebhookUrl || settings.n8nWebhookUrl;
      const event = rule?.triggerEvent || 'manual_test';

      /*
        A single test id, reused as the record reference AND the idempotency
        key below.

        This payload used to carry `invoiceNumber: 'INV-2026-108'` and
        `ticketNumber: 'TKT-8901'` as hardcoded literals for EVERY event —
        which is wrong on its own (a new_lead does not have an invoice
        number), and had a second, worse consequence. The server derives an
        idempotency key from `payload.id ?? payload.invoiceNumber ?? ...`, so
        every click produced the identical key
        `org|new_lead|INV-2026-108`, and the dispatcher suppressed all of them
        as duplicates for six hours. Only the first click of the day ever
        reached n8n; the rest were recorded as Success with HTTP 200.
      */
      const testId = `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      /*
        Test data must be OBVIOUSLY fake, not "whichever real customer happens
        to be first in the list" — this used to default to `customers[0]` /
        `leads[0]`, so clicking Test Trigger on a live deployment could hand
        n8n a real customer's actual WhatsApp number and email, and a
        downstream WhatsApp/email node would message them a fabricated ticket
        or invoice. example.com is IANA-reserved for documentation and will
        never resolve to a real inbox or phone subscriber.
      */

      // Build context-aware test payload if customPayload is not supplied
      const rawPayload = customPayload || {
        testId,
        id: testId,
        recordId: testId,
        isTest: true,
        test: true,
        ruleName: rule?.name || 'Manual Test Trigger',
        customerName: 'Automation Test Contact',
        company: 'Test Automation Sandbox',
        companyName: 'Test Automation Sandbox',
        contactNumber: '+10000000000',
        phone: '+10000000000',
        whatsappNumber: '+10000000000',
        email: 'automation-test@example.com',
        requirement: 'Automated CRM integration & WhatsApp webhook pipeline testing',
        value: 125000,
        estimatedValue: 125000,
        ticketNumber: `TEST-${testId.slice(-6)}`,
        complaintType: 'Service Delivery',
        priority: 'High',
        slaHours: 24,
        taskName: 'Review n8n webhook workflow execution and customer notification',
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        invoiceNumber: `TEST-${testId.slice(-6)}`,
        grandTotal: 147500,
        amountPaid: 50000,
        balanceDue: 97500,
        triggeredBy: currentUser?.displayName || 'Administrator',
      };

      const completePayload = buildWebhookPayload(event, rawPayload, {
        organizationName: currentOrg.name,
        organizationId: currentOrg.id,
        organizationEmail: currentOrg.email,
        organizationPhone: currentOrg.phone,
        triggeredByName: currentUser?.displayName || 'Administrator',
        triggeredByEmail: currentUser?.email || '',
        targetWebhookUrl: targetUrl,
      });

      const startTime = Date.now();
      try {
        const res = await fetch('/api/webhooks/n8n/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await apiAuthHeader()) },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            event,
            ruleId: rule?.id,
            ruleName: rule?.name,
            payload: completePayload,
            /*
              An explicit key, unique per click.

              Without one the server derives a key from the payload, which for
              a manual test is the same every time. Deduplicating a Test
              Trigger defeats its only purpose: the button exists to send a
              request now and show what came back.
            */
            idempotencyKey: `manual:${rule?.id ?? 'none'}:${testId}`,
          }),
        });

        const data = await res.json();
        const durationMs = data.durationMs || Date.now() - startTime;
        const suppressed = data.status === 'skipped';
        const logEntry: AutomationLog = {
          id: `log_manual_${Date.now()}`,
          organizationId: currentOrg.id,
          ruleId: rule?.id,
          automationName: rule?.name || 'Manual Webhook Test',
          triggerEvent: event as any,
          status: suppressed ? 'Suppressed' : data.success ? 'Success' : 'Failed',
          timestamp: new Date().toISOString(),
          durationMs,
          // No invented status code. A suppressed dispatch never got one,
          // and claiming 200 is how this looked like a delivery.
          httpStatus: data.statusCode ?? (suppressed ? undefined : data.success ? 200 : 502),
          payload: completePayload,
          responseMessage: data.response
            ? typeof data.response === 'string'
              ? data.response
              : JSON.stringify(data.response)
            : suppressed
            ? undefined
            : data.success
            ? 'Webhook executed successfully'
            : undefined,
          errorMessage: explainDispatchError(res.status, data.error),
          retryCount: 0,
        };

        setAutomationLogs((prev) => [logEntry, ...prev]);

        if (rule) {
          setAutomations((prev) =>
            prev.map((r) =>
              r.id === rule.id
                ? {
                    ...r,
                    lastRun: new Date().toISOString(),
                    // A suppressed dispatch counts as neither. It was not
                    // delivered, and nothing failed.
                    successCount: !suppressed && data.success ? r.successCount + 1 : r.successCount,
                    failureCount: !suppressed && !data.success ? r.failureCount + 1 : r.failureCount,
                  }
                : r
            )
          );
        }

        return logEntry;
      } catch (err: any) {
        const errorLog: AutomationLog = {
          id: `log_err_${Date.now()}`,
          organizationId: currentOrg.id,
          ruleId: rule?.id,
          automationName: rule?.name || 'Manual Test',
          triggerEvent: event as any,
          status: 'Failed',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          httpStatus: 500,
          payload: completePayload,
          errorMessage: err.message,
          retryCount: 0,
        };
        setAutomationLogs((prev) => [errorLog, ...prev]);
        return errorLog;
      }
    },
    [automations, settings, currentOrg, currentUser]
  );

  const retryAutomationLog = useCallback(
    async (logId: string) => {
      const log = automationLogs.find((l) => l.id === logId);
      if (!log) return;

      const rule = automations.find((r) => r.id === log.ruleId);
      const targetUrl = rule?.targetWebhookUrl || settings.n8nWebhookUrl;

      try {
        const res = await fetch('/api/webhooks/n8n/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await apiAuthHeader()) },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            event: log.triggerEvent,
            payload: log.payload,
          }),
        });
        const data = await res.json();

        setAutomationLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? {
                  ...l,
                  status: data.success ? 'Success' : 'Failed',
                  httpStatus: data.statusCode || (data.success ? 200 : 500),
                  responseMessage: data.response
                    ? typeof data.response === 'string'
                      ? data.response
                      : JSON.stringify(data.response)
                    : data.success
                    ? 'Retried successfully'
                    : undefined,
                  errorMessage: explainDispatchError(res.status, data.error),
                  retryCount: l.retryCount + 1,
                  timestamp: new Date().toISOString(),
                }
              : l
          )
        );
      } catch (err: any) {
        setAutomationLogs((prev) =>
          prev.map((l) =>
            l.id === logId
              ? {
                  ...l,
                  status: 'Failed',
                  errorMessage: `Retry error: ${err.message}`,
                  retryCount: l.retryCount + 1,
                  timestamp: new Date().toISOString(),
                }
              : l
          )
        );
      }
    },
    [automationLogs, automations, settings]
  );

  // Live direct test to connected n8n webhook
  const testLiveWebhook = useCallback(
    async (customEvent?: string, customData?: Record<string, any>) => {
      const targetUrl = settings.n8nWebhookUrl;
      const eventName = customEvent || 'webhook_test_ping';
      const activeLeadsCount = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length;
      const pendingInvoices = invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
      const totalPendingBalance = pendingInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
      const totalRevenueCollected = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);

      // Clearly fake, never a real customer's contact details — see the same
      // reasoning in triggerAutomationRule above. This ping can reach a real
      // n8n workflow, and that workflow may message whatever contact the
      // payload names.
      const rawPayload = {
        event: eventName,
        eventId: `ping_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        recordId: 'ping',
        isTest: true,
        test: true,
        source: 'Smart Business Automation Hub',
        timestamp: new Date().toISOString(),
        organization: currentOrg.name,
        organizationId: currentOrg.id,
        triggeredBy: currentUser?.displayName || 'Administrator',
        userEmail: currentUser?.email || '',
        customerName: 'Automation Test Contact',
        company: 'Test Automation Sandbox',
        companyName: 'Test Automation Sandbox',
        email: 'automation-test@example.com',
        contactNumber: '+10000000000',
        phone: '+10000000000',
        whatsappNumber: '+10000000000',
        metrics: {
          activeLeadsCount,
          pendingInvoicesCount: pendingInvoices.length,
          totalPendingBalance,
          totalRevenueCollected,
          currency: 'INR',
        },
        webhookEndpoint: targetUrl,
        ...customData,
      };

      const completePayload = buildWebhookPayload(eventName, rawPayload, {
        organizationName: currentOrg.name,
        organizationId: currentOrg.id,
        organizationEmail: currentOrg.email,
        organizationPhone: currentOrg.phone,
        triggeredByName: currentUser?.displayName || 'Administrator',
        triggeredByEmail: currentUser?.email || '',
        targetWebhookUrl: targetUrl,
      });

      const startTime = Date.now();
      try {
        const res = await fetch('/api/webhooks/n8n/dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(await apiAuthHeader()) },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            event: eventName,
            payload: completePayload,
            // Same reasoning as the manual Test Trigger: a ping that gets
            // deduplicated has told you nothing about whether n8n is reachable.
            idempotencyKey: `ping:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
          }),
        });

        const data = await res.json();
        const durationMs = data.durationMs || Date.now() - startTime;
        const suppressed = data.status === 'skipped';

        const logEntry: AutomationLog = {
          id: `log_live_${Date.now()}`,
          organizationId: currentOrg.id,
          automationName: 'Connected n8n Webhook Ping',
          triggerEvent: eventName as any,
          status: suppressed ? 'Suppressed' : data.success ? 'Success' : 'Failed',
          timestamp: new Date().toISOString(),
          durationMs,
          httpStatus: data.statusCode ?? (suppressed ? undefined : data.success ? 200 : 502),
          payload: completePayload,
          responseMessage: data.response
            ? typeof data.response === 'string'
              ? data.response
              : JSON.stringify(data.response)
            : suppressed
            ? undefined
            : data.success
            ? 'Delivered to n8n webhook successfully'
            : undefined,
          errorMessage: explainDispatchError(res.status, data.error),
          retryCount: 0,
        };

        setAutomationLogs((prev) => [logEntry, ...prev]);

        return {
          success: Boolean(data.success),
          message: data.success
            ? `Successfully delivered payload to ${targetUrl}`
            : explainDispatchError(res.status, data.error) || 'Failed to dispatch to n8n webhook',
          durationMs,
        };
      } catch (err: any) {
        const durationMs = Date.now() - startTime;
        return {
          success: false,
          message: err.message || 'Network error triggering webhook',
          durationMs,
        };
      }
    },
    [leads, invoices, currentOrg, currentUser, settings]
  );

  // Notifications
  const markNotificationAsRead = useCallback(async (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  // Reset to default sample data
  const resetToSampleData = useCallback(async () => {
    setCustomers(initialCustomers);
    setLeads(initialLeads);
    setComplaints(initialComplaints);
    setTasks(initialTasks);
    setEmployees(initialUsers);
    setQuotations(initialQuotations);
    setInvoices(initialInvoices);
    setDocuments(initialDocuments);
    setCommunications(initialCommunications);
    setAutomations(initialAutomationRules);
    setAutomationLogs(initialAutomationLogs);
    setNotifications(initialNotifications);
    setActivityLogs(initialActivityLogs);
    setSettings(initialSettings);
    setCurrentOrg(initialOrganization);
    // Only a demo build may hand itself a signed-in Super Admin.
    if (DEMO_MODE) setCurrentUser(initialUsers[0]);

    localStorage.clear();
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
    setAuthStatus('signed-out');
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
      authStatus,
      isDemoMode: DEMO_MODE,
      syncStatus,
      setCurrentUser,
      currentOrg,
      setCurrentOrg,
      switchRole,
      customers,
      leads,
      complaints,
      tasks,
      employees,
      quotations,
      invoices,
      documents,
      communications,
      automations,
      automationLogs,
      notifications,
      activityLogs,
      settings,
      activeTab,
      setActiveTab,
      globalSearchQuery,
      setGlobalSearchQuery,
      isAiDrawerOpen,
      setIsAiDrawerOpen,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      importCustomersFromCSV,
      addLead,
      updateLead,
      updateLeadStage,
      deleteLead,
      addComplaint,
      updateComplaint,
      resolveComplaint,
      addTask,
      updateTask,
      updateTaskStatus,
      deleteTask,
      addQuotation,
      updateQuotation,
      deleteQuotation,
      convertQuotationToInvoice,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      recordInvoicePayment,
      addDocument,
      deleteDocument,
      sendCommunication,
      requestCallback,
      updateSettings,
      updateBusinessProfile,
      addEmployee,
      updateEmployee,
      toggleAutomationRule,
      triggerAutomationRule,
      retryAutomationLog,
      testLiveWebhook,
      dispatchWebhookEvent,
      logActivity,
      updateOrganization: updateBusinessProfile,
      resetSeedData: resetToSampleData,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      resetToSampleData,
      logout,
    }),
    [
      currentUser,
      authStatus,
      syncStatus,
      currentOrg,
      switchRole,
      customers,
      leads,
      complaints,
      tasks,
      employees,
      quotations,
      invoices,
      documents,
      communications,
      automations,
      automationLogs,
      notifications,
      activityLogs,
      settings,
      activeTab,
      globalSearchQuery,
      isAiDrawerOpen,
      addCustomer,
      updateCustomer,
      deleteCustomer,
      importCustomersFromCSV,
      addLead,
      updateLead,
      updateLeadStage,
      deleteLead,
      addComplaint,
      updateComplaint,
      resolveComplaint,
      addTask,
      updateTask,
      updateTaskStatus,
      deleteTask,
      addQuotation,
      updateQuotation,
      deleteQuotation,
      convertQuotationToInvoice,
      addInvoice,
      updateInvoice,
      deleteInvoice,
      recordInvoicePayment,
      addDocument,
      deleteDocument,
      sendCommunication,
      requestCallback,
      updateSettings,
      updateBusinessProfile,
      addEmployee,
      updateEmployee,
      toggleAutomationRule,
      triggerAutomationRule,
      retryAutomationLog,
      testLiveWebhook,
      dispatchWebhookEvent,
      logActivity,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      resetToSampleData,
      logout,
    ]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
