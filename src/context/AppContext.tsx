import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
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
  CONNECTED_N8N_WEBHOOK_URL,
} from '../data/seedData';
import { buildWebhookPayload } from '../utils/webhookPayloadBuilder';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
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

  updateSettings: (newSettings: Partial<OrganizationSettings>) => Promise<void>;
  updateBusinessProfile: (orgUpdates: Partial<Organization>) => Promise<void>;

  addEmployee: (employee: Omit<UserProfile, 'uid' | 'createdAt' | 'organizationId'>) => Promise<UserProfile>;
  updateEmployee: (uid: string, updates: Partial<UserProfile>) => Promise<void>;

  toggleAutomationRule: (ruleId: string) => Promise<void>;
  updateAutomationRule: (ruleId: string, updates: Partial<AutomationRule>) => Promise<void>;
  triggerAutomationRule: (ruleId: string, customPayload?: Record<string, any>) => Promise<AutomationLog>;
  retryAutomationLog: (logId: string) => Promise<void>;
  testLiveWebhook: (
    customEvent?: string,
    customData?: Record<string, any>
  ) => Promise<{
    success: boolean;
    message: string;
    durationMs?: number;
    diagnosticHint?: string;
    n8nHint?: string;
    statusCode?: number;
  }>;
  switchWebhookMode: (mode: 'production' | 'test') => Promise<void>;
  runWebhookDiagnostics: (customUrl?: string) => Promise<any>;
  dispatchWebhookEvent: (event: string, entityData: Record<string, any>, customRuleName?: string) => Promise<void>;
  triggerAutomation: (
    eventType: string,
    payload: Record<string, any>,
    options?: { ruleId?: string; customRuleName?: string; isTestTrigger?: boolean }
  ) => Promise<{
    success: boolean;
    status: 'Success' | 'Failed' | 'Blocked';
    httpStatus?: number;
    durationMs: number;
    log?: AutomationLog;
    response?: any;
    errorMessage?: string;
    diagnosticHint?: string;
    n8nHint?: string;
  }>;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'smart_hub_state_v1';

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Load initial state from local storage or defaults
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    return initialUsers[0]; // Default logged in as Super Admin for instant exploration
  });

  const [currentOrg, setCurrentOrg] = useState<Organization>(initialOrganization);
  const [customers, setCustomers] = useState<Customer[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_customers`);
    return saved ? JSON.parse(saved) : initialCustomers;
  });

  const [leads, setLeads] = useState<Lead[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_leads`);
    return saved ? JSON.parse(saved) : initialLeads;
  });

  const [complaints, setComplaints] = useState<Complaint[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_complaints`);
    return saved ? JSON.parse(saved) : initialComplaints;
  });

  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_tasks`);
    return saved ? JSON.parse(saved) : initialTasks;
  });

  const [employees, setEmployees] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_employees`);
    return saved ? JSON.parse(saved) : initialUsers;
  });

  const [quotations, setQuotations] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_quotations`);
    return saved ? JSON.parse(saved) : initialQuotations;
  });

  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_invoices`);
    return saved ? JSON.parse(saved) : initialInvoices;
  });

  const [documents, setDocuments] = useState<DocumentItem[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_documents`);
    return saved ? JSON.parse(saved) : initialDocuments;
  });

  const [communications, setCommunications] = useState<Communication[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_communications`);
    return saved ? JSON.parse(saved) : initialCommunications;
  });

  const [automations, setAutomations] = useState<AutomationRule[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_automations`);
    if (saved) {
      try {
        const parsed: AutomationRule[] = JSON.parse(saved);
        return parsed.map((rule) => {
          let cleanUrl = rule.targetWebhookUrl;
          if (
            !cleanUrl ||
            cleanUrl.includes('apexsolutions.com') ||
            cleanUrl.includes('yourdomain.com') ||
            cleanUrl.includes('localhost') ||
            cleanUrl.includes('127.0.0.1') ||
            cleanUrl.includes('angoori.app.n8n.cloud')
          ) {
            cleanUrl = CONNECTED_N8N_WEBHOOK_URL;
          }

          let event = rule.triggerEvent;
          if (rule.id === 'auto_01') event = 'new_lead';
          else if (rule.id === 'auto_02') event = 'new_customer';
          else if (rule.id === 'auto_03') event = 'new_complaint';
          else if (rule.id === 'auto_04') event = 'task_overdue';
          else if (rule.id === 'auto_05') event = 'invoice_due';
          else if (rule.id === 'auto_06') event = 'document_uploaded';

          return {
            ...rule,
            targetWebhookUrl: cleanUrl,
            triggerEvent: event,
            authType: rule.authType || 'none',
            apiKey: rule.apiKey || '',
          };
        });
      } catch {
        return initialAutomationRules;
      }
    }
    return initialAutomationRules;
  });

  const [automationLogs, setAutomationLogs] = useState<AutomationLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_automationLogs`);
    return saved ? JSON.parse(saved) : initialAutomationLogs;
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_notifications`);
    return saved ? JSON.parse(saved) : initialNotifications;
  });

  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_activityLogs`);
    return saved ? JSON.parse(saved) : initialActivityLogs;
  });

  const [settings, setSettings] = useState<OrganizationSettings>(() => {
    const saved = localStorage.getItem(`${LOCAL_STORAGE_KEY}_settings`);
    if (saved) {
      try {
        const parsed: OrganizationSettings = JSON.parse(saved);
        if (
          !parsed.n8nWebhookUrl ||
          parsed.n8nWebhookUrl.includes('apexsolutions.com') ||
          parsed.n8nWebhookUrl.includes('yourdomain.com') ||
          parsed.n8nWebhookUrl.includes('localhost') ||
          parsed.n8nWebhookUrl.includes('127.0.0.1') ||
          parsed.n8nWebhookUrl.includes('angoori.app.n8n.cloud')
        ) {
          parsed.n8nWebhookUrl = CONNECTED_N8N_WEBHOOK_URL;
        }
        return parsed;
      } catch {
        return initialSettings;
      }
    }
    return initialSettings;
  });

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [globalSearchQuery, setGlobalSearchQuery] = useState<string>('');
  const [isAiDrawerOpen, setIsAiDrawerOpen] = useState<boolean>(false);

  // Sync to local storage for instant durability
  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_customers`, JSON.stringify(customers));
  }, [customers]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_leads`, JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_complaints`, JSON.stringify(complaints));
  }, [complaints]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_tasks`, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_employees`, JSON.stringify(employees));
  }, [employees]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_quotations`, JSON.stringify(quotations));
  }, [quotations]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_invoices`, JSON.stringify(invoices));
  }, [invoices]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_documents`, JSON.stringify(documents));
  }, [documents]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_communications`, JSON.stringify(communications));
  }, [communications]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_automations`, JSON.stringify(automations));
  }, [automations]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_automationLogs`, JSON.stringify(automationLogs));
  }, [automationLogs]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_notifications`, JSON.stringify(notifications));
  }, [notifications]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_activityLogs`, JSON.stringify(activityLogs));
  }, [activityLogs]);

  useEffect(() => {
    localStorage.setItem(`${LOCAL_STORAGE_KEY}_settings`, JSON.stringify(settings));
  }, [settings]);

  // Firebase auth state observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (firebaseUser) {
        // Map to existing profile or create a Business Admin profile
        const matched = employees.find((e) => e.uid === firebaseUser.uid || e.email === firebaseUser.email);
        if (matched) {
          setCurrentUser(matched);
        } else {
          const newUser: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || 'user@example.com',
            displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'Business Admin',
            photoURL: firebaseUser.photoURL || undefined,
            role: 'business_admin',
            organizationId: DEMO_ORG_ID,
            organizationName: currentOrg.name,
            isActive: true,
            createdAt: new Date().toISOString(),
          };
          setCurrentUser(newUser);
          setEmployees((prev) => [newUser, ...prev]);
        }
      }
    });

    return () => unsubscribe();
  }, [employees, currentOrg.name]);

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
        ipAddress: typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'client-session',
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentOrg.id, currentUser]
  );

  // Central Reusable Webhook Dispatcher
  const triggerAutomation = useCallback(
    async (
      eventType: string,
      payload: Record<string, any>,
      options: { ruleId?: string; customRuleName?: string; isTestTrigger?: boolean } = {}
    ): Promise<{
      success: boolean;
      status: 'Success' | 'Failed' | 'Blocked';
      httpStatus?: number;
      durationMs: number;
      log?: AutomationLog;
      response?: any;
      errorMessage?: string;
      diagnosticHint?: string;
      n8nHint?: string;
    }> => {
      console.log(`[AutomationDispatcher] 🚀 Received Event: "${eventType}" (isTestTrigger: ${!!options.isTestTrigger})`);

      // 1. Event Routing / Alias Normalization to guarantee all 6 workflows match
      let canonicalEvent = eventType;
      if (eventType === 'new_task') canonicalEvent = 'task_overdue';
      if (eventType === 'new_invoice' || eventType === 'payment_reminder') canonicalEvent = 'invoice_due';

      // 2. Identify the matching workflow rule(s)
      let targetRules: AutomationRule[] = [];
      if (options.ruleId) {
        const specificRule = automations.find((r) => r.id === options.ruleId);
        if (specificRule) targetRules = [specificRule];
      } else {
        targetRules = automations.filter(
          (r) => r.triggerEvent === eventType || r.triggerEvent === canonicalEvent
        );
      }

      console.log(
        `[AutomationDispatcher] 🔍 Matched Workflows for "${canonicalEvent}":`,
        targetRules.map((r) => `${r.name} (${r.isEnabled ? 'ENABLED' : 'DISABLED'})`)
      );

      // 3. Workflow Enable / Disable Enforcement
      if (targetRules.length > 0) {
        if (options.ruleId) {
          const rule = targetRules[0];
          if (!rule.isEnabled) {
            console.warn(`[AutomationDispatcher] 🛑 Blocked: Workflow "${rule.name}" is disabled.`);
            const blockedLog: AutomationLog = {
              id: `log_blocked_${Date.now()}`,
              organizationId: currentOrg.id,
              ruleId: rule.id,
              ruleName: rule.name,
              automationName: rule.name,
              triggerEvent: canonicalEvent,
              status: 'Blocked',
              timestamp: new Date().toISOString(),
              durationMs: 0,
              httpStatus: 403,
              payload,
              targetWebhookUrl: settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL,
              errorMessage: `Workflow "${rule.name}" is currently disabled. Execution was blocked.`,
              diagnosticHint: 'Toggle the switch to "Enabled" in the Automation Centre to allow webhook execution.',
              retryCount: 0,
            };
            setAutomationLogs((prev) => [blockedLog, ...prev]);
            return {
              success: false,
              status: 'Blocked',
              httpStatus: 403,
              durationMs: 0,
              log: blockedLog,
              errorMessage: `Workflow "${rule.name}" is currently disabled. Toggle the switch to Enabled to activate webhook dispatches.`,
              diagnosticHint: 'Toggle the switch to "Enabled" in the Automation Centre.',
            };
          }
        } else {
          // For real business events: filter to only enabled rules
          const enabledRules = targetRules.filter((r) => r.isEnabled);
          if (enabledRules.length === 0) {
            const disabledRule = targetRules[0];
            console.warn(`[AutomationDispatcher] 🛑 Real event "${canonicalEvent}" blocked: Workflow "${disabledRule?.name}" is disabled.`);
            const blockedLog: AutomationLog = {
              id: `log_blocked_${Date.now()}`,
              organizationId: currentOrg.id,
              ruleId: disabledRule?.id,
              ruleName: disabledRule?.name || `Automation: ${canonicalEvent}`,
              automationName: disabledRule?.name || `Automation: ${canonicalEvent}`,
              triggerEvent: canonicalEvent,
              status: 'Blocked',
              timestamp: new Date().toISOString(),
              durationMs: 0,
              httpStatus: 403,
              payload,
              targetWebhookUrl: settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL,
              errorMessage: `Workflow "${disabledRule?.name || canonicalEvent}" is disabled. Webhook execution blocked.`,
              diagnosticHint: 'Toggle this automation to "Enabled" in the Automation Centre to process events.',
              retryCount: 0,
            };
            setAutomationLogs((prev) => [blockedLog, ...prev]);
            return {
              success: false,
              status: 'Blocked',
              httpStatus: 403,
              durationMs: 0,
              log: blockedLog,
              errorMessage: `Workflow "${disabledRule?.name || canonicalEvent}" is currently disabled. Execution blocked.`,
            };
          }
          targetRules = enabledRules;
        }
      } else {
        // No matching workflow configured; check global n8nEnabled
        if (!settings.n8nEnabled) {
          console.warn(`[AutomationDispatcher] 🛑 No workflow configured for "${canonicalEvent}" and global n8n is disabled.`);
          return {
            success: false,
            status: 'Blocked',
            durationMs: 0,
            errorMessage: `No automation workflow is configured or enabled for event "${canonicalEvent}".`,
          };
        }
      }

      // 4. Determine Rules to execute
      const rulesToExecute = targetRules.length > 0 ? targetRules : [null];
      let lastResult = {
        success: false,
        status: 'Failed' as 'Success' | 'Failed' | 'Blocked',
        durationMs: 0,
        httpStatus: 500,
        errorMessage: 'Execution failed',
        diagnosticHint: undefined as string | undefined,
        n8nHint: undefined as string | undefined,
        response: undefined as any,
        log: undefined as AutomationLog | undefined,
      };

      for (const activeRule of rulesToExecute) {
        // 5. Retrieve production n8n webhook URL
        let targetUrl =
          activeRule?.targetWebhookUrl &&
          activeRule.targetWebhookUrl !== CONNECTED_N8N_WEBHOOK_URL &&
          !activeRule.targetWebhookUrl.includes('apexsolutions.com') &&
          !activeRule.targetWebhookUrl.includes('yourdomain.com') &&
          !activeRule.targetWebhookUrl.includes('localhost') &&
          !activeRule.targetWebhookUrl.includes('127.0.0.1') &&
          !activeRule.targetWebhookUrl.includes('angoori.app.n8n.cloud')
            ? activeRule.targetWebhookUrl
            : settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;

        const ruleName = options.customRuleName || activeRule?.name || `Webhook Event: ${canonicalEvent}`;
        const apiKey = activeRule?.apiKey || settings.n8nApiKey || '';
        const authType = activeRule?.authType || settings.n8nAuthType || 'none';

        // STEP 3: Strict Validation Check - DO NOT HIDE ERRORS
        const checkUrl = targetUrl ? String(targetUrl).trim() : '';
        const isInvalidUrl =
          !checkUrl ||
          checkUrl === 'undefined' ||
          checkUrl === 'null' ||
          checkUrl.includes('localhost') ||
          checkUrl.includes('127.0.0.1') ||
          checkUrl.includes('/webhook-test/');

        if (isInvalidUrl) {
          let problemReason = 'Webhook URL is undefined, null, or empty.';
          if (checkUrl.includes('/webhook-test/')) {
            problemReason = `Webhook URL "${checkUrl}" contains "/webhook-test/". n8n test webhooks only execute for a single manual test when "Listen for test event" is active in n8n. You must configure the production URL containing "/webhook/".`;
          } else if (checkUrl.includes('localhost') || checkUrl.includes('127.0.0.1')) {
            problemReason = `Webhook URL "${checkUrl}" points to localhost/127.0.0.1, which cannot be reached from the cloud container.`;
          }

          console.error('n8n Webhook Error:', problemReason);

          const invalidLog: AutomationLog = {
            id: `log_invalid_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            organizationId: currentOrg.id,
            ruleId: activeRule?.id,
            ruleName,
            automationName: ruleName,
            triggerEvent: canonicalEvent,
            status: 'Failed',
            timestamp: new Date().toISOString(),
            durationMs: 0,
            executionDurationMs: 0,
            httpStatus: 400,
            payload,
            targetWebhookUrl: checkUrl,
            errorMessage: problemReason,
            diagnosticHint: 'Correct the webhook endpoint URL in the Automation Centre or Settings. Do not use test endpoints (/webhook-test/) or localhost.',
            retryCount: 0,
          };
          setAutomationLogs((prev) => [invalidLog, ...prev]);

          lastResult = {
            success: false,
            status: 'Failed',
            httpStatus: 400,
            durationMs: 0,
            log: invalidLog,
            errorMessage: problemReason,
            diagnosticHint: 'Invalid webhook URL configuration.',
            n8nHint: 'Set production webhook URL without /webhook-test/',
            response: null,
          };
          continue;
        }

        // 6. Build Payload conforming to requirement: { event, source, timestamp, data, ... }
        const completePayload = buildWebhookPayload(canonicalEvent, payload, {
          organizationName: currentOrg.name,
          organizationId: currentOrg.id,
          organizationEmail: currentOrg.email,
          organizationPhone: currentOrg.phone,
          triggeredByName: currentUser?.displayName || 'Administrator',
          triggeredByEmail: currentUser?.email || 'automation@apexsolutions.in',
          targetWebhookUrl: targetUrl,
        });

        // STEP 2: Temporary Diagnostic Logs immediately before sending webhook
        console.log("AUTOMATION DEBUG");
        console.log("Event:", canonicalEvent);
        console.log("Workflow:", ruleName);
        console.log("Webhook URL:", targetUrl);
        console.log("HTTP Method:", "POST");
        console.log("Payload:", completePayload);

        // 7. POST JSON to n8n via server-side proxy
        const startTime = Date.now();
        try {
          const res = await fetch('/api/webhooks/n8n/trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              webhookUrl: targetUrl,
              apiKey,
              authType,
              event: canonicalEvent,
              payload: completePayload,
            }),
          });

          let data: any = {};
          const contentType = res.headers.get('content-type') || '';
          if (contentType.includes('application/json')) {
            data = await res.json();
          } else {
            const text = await res.text();
            data = {
              success: res.ok,
              statusCode: res.status,
              durationMs: Date.now() - startTime,
              response: text.slice(0, 500),
              error: res.ok ? undefined : `Non-JSON server response (HTTP ${res.status})`,
            };
          }

          const durationMs = data.durationMs || Date.now() - startTime;
          const responseBody = data.response !== undefined ? data.response : data;

          // STEP 2: Log the response and errors
          console.log("n8n Status:", data.statusCode || res.status);
          console.log("n8n Response:", responseBody);

          if (!res.ok || !data.success) {
            console.error("n8n Webhook Error:", data.error || `HTTP ${data.statusCode || res.status}`);
          }

          // 8. Record in state/audit log
          const logEntry: AutomationLog = {
            id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            organizationId: currentOrg.id,
            ruleId: activeRule?.id,
            ruleName,
            automationName: ruleName,
            triggerEvent: canonicalEvent,
            status: data.success ? 'Success' : 'Failed',
            timestamp: new Date().toISOString(),
            durationMs,
            executionDurationMs: durationMs,
            httpStatus: data.statusCode || (data.success ? 200 : res.status || 500),
            payload: completePayload,
            targetWebhookUrl: targetUrl,
            diagnosticHint: data.diagnosticHint,
            n8nHint: data.n8nHint,
            responseMessage: data.response
              ? typeof data.response === 'string'
                ? data.response
                : JSON.stringify(data.response)
              : data.success
              ? 'Delivered to n8n successfully'
              : undefined,
            errorMessage: data.error,
            retryCount: 0,
          };

          setAutomationLogs((prev) => [logEntry, ...prev]);

          // Update execution counts and lastRun on rule
          if (activeRule) {
            setAutomations((prev) =>
              prev.map((r) =>
                r.id === activeRule.id
                  ? {
                      ...r,
                      lastRun: new Date().toISOString(),
                      lastTriggeredAt: new Date().toISOString(),
                      successCount: data.success ? r.successCount + 1 : r.successCount,
                      failureCount: !data.success ? r.failureCount + 1 : r.failureCount,
                      executionCount: (r.executionCount ?? (r.successCount + r.failureCount)) + 1,
                    }
                  : r
              )
            );
          }

          // Trigger failure notification if needed
          if (!data.success) {
            const isInactive =
              data.statusCode === 404 ||
              (data.error && data.error.includes('Inactive')) ||
              (data.diagnosticHint && data.diagnosticHint.includes('Inactive'));
            const failureNotif: AppNotification = {
              id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              organizationId: currentOrg.id,
              title: isInactive ? 'n8n Workflow Needs Activation' : `Automation Failed: ${ruleName}`,
              message: isInactive
                ? 'Your n8n workflow is currently INACTIVE in n8n cloud. Toggle it to "Active" in the top-right of your n8n canvas to receive live events.'
                : data.error || 'Webhook execution failed',
              type: 'automation_failure',
              referenceId: logEntry.id,
              referenceType: 'automation',
              isRead: false,
              createdAt: new Date().toISOString(),
            };
            setNotifications((prev) => [failureNotif, ...prev]);
          }

          lastResult = {
            success: !!data.success,
            status: data.success ? 'Success' : 'Failed',
            httpStatus: data.statusCode || (data.success ? 200 : res.status || 500),
            durationMs,
            log: logEntry,
            response: data.response,
            errorMessage: data.error,
            diagnosticHint: data.diagnosticHint,
            n8nHint: data.n8nHint,
          };
        } catch (err: any) {
          const durationMs = Date.now() - startTime;
          console.error('[AutomationDispatcher] ❌ Network Error:', err);
          const errorLog: AutomationLog = {
            id: `log_err_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            organizationId: currentOrg.id,
            ruleId: activeRule?.id,
            ruleName,
            automationName: ruleName,
            triggerEvent: canonicalEvent,
            status: 'Failed',
            timestamp: new Date().toISOString(),
            durationMs,
            executionDurationMs: durationMs,
            httpStatus: 500,
            payload: completePayload,
            targetWebhookUrl: targetUrl,
            errorMessage: err.message || 'Network error during dispatch',
            retryCount: 0,
          };
          setAutomationLogs((prev) => [errorLog, ...prev]);
          lastResult = {
            success: false,
            status: 'Failed',
            httpStatus: 500,
            durationMs,
            log: errorLog,
            errorMessage: err.message || 'Network error during dispatch',
            diagnosticHint: undefined,
            n8nHint: undefined,
            response: undefined,
          };
        }
      }

      return lastResult;
    },
    [automations, settings, currentOrg, currentUser]
  );

  // Reusable helper calling central triggerAutomation
  const dispatchWebhookEvent = useCallback(
    async (event: AutomationRule['triggerEvent'] | string, rawPayload: Record<string, any>, customRuleName?: string) => {
      await triggerAutomation(event as string, rawPayload, { customRuleName });
    },
    [triggerAutomation]
  );

  // Switch role helper for instant RBAC demo testing
  const switchRole = useCallback((role: UserRole) => {
    const matched = initialUsers.find((u) => u.role === role);
    if (matched) {
      setCurrentUser(matched);
    } else if (currentUser) {
      setCurrentUser({ ...currentUser, role });
    }
  }, [currentUser]);

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
      const email = currentUser?.email || 'priya.sharma@apexsolutions.in';

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
      const email = currentUser?.email || 'admin@apexsolutions.in';

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
      const contactNumber =
        newComm.channel === 'whatsapp'
          ? newComm.recipient || matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || '+91 98201 94821'
          : matchedCustomer?.whatsappNumber || matchedCustomer?.mobileNumber || '+91 98201 94821';
      const email =
        newComm.channel === 'email'
          ? newComm.recipient || matchedCustomer?.email || 'customer@example.com'
          : matchedCustomer?.email || 'customer@example.com';

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

  // Settings & Profile
  const updateSettings = useCallback(
    async (newSettings: Partial<OrganizationSettings>) => {
      setSettings((prev) => {
        const updated = { ...prev, ...newSettings, updatedAt: new Date().toISOString() };
        logActivity('update', 'settings', 'org_settings', 'Integration & Webhook Settings', undefined, 'Saved configuration');
        return updated;
      });

      if (newSettings.n8nWebhookUrl) {
        const newUrl = newSettings.n8nWebhookUrl;
        setAutomations((prev) =>
          prev.map((rule) => ({
            ...rule,
            targetWebhookUrl: newUrl,
          }))
        );
      }
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

  const updateAutomationRule = useCallback(
    async (ruleId: string, updates: Partial<AutomationRule>) => {
      setAutomations((prev) =>
        prev.map((r) => {
          if (r.id === ruleId) {
            const updated = { ...r, ...updates };
            logActivity(
              'update',
              'automations',
              r.id,
              r.name,
              undefined,
              `Updated webhook endpoint: ${updates.targetWebhookUrl || 'rule settings'}`
            );
            return updated;
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
      const event = rule?.triggerEvent || 'manual_test';

      const sampleCustomer = customers[0];
      const sampleLead = leads[0];

      // Build context-aware test payload if customPayload is not supplied
      const rawPayload = customPayload || {
        testId: `test_${Date.now()}`,
        ruleId: rule?.id,
        ruleName: rule?.name || 'Manual Test Trigger',
        customerName: sampleCustomer?.fullName || sampleLead?.customerName || 'Vikram Singhania',
        company: sampleCustomer?.companyName || sampleLead?.company || 'Singhania Logistics Ltd',
        companyName: sampleCustomer?.companyName || sampleLead?.company || 'Singhania Logistics Ltd',
        contactNumber: sampleCustomer?.whatsappNumber || sampleLead?.mobile || '+91 98201 94821',
        phone: sampleCustomer?.whatsappNumber || sampleLead?.mobile || '+91 98201 94821',
        whatsappNumber: sampleCustomer?.whatsappNumber || sampleLead?.mobile || '+91 98201 94821',
        email: sampleCustomer?.email || sampleLead?.email || 'vikram@singhanialogistics.com',
        requirement: 'Automated CRM integration & WhatsApp webhook pipeline testing',
        value: 125000,
        estimatedValue: 125000,
        ticketNumber: 'TKT-8901',
        complaintType: 'Service Delivery',
        priority: 'High',
        slaHours: 24,
        taskName: 'Review n8n webhook workflow execution and customer notification',
        dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        invoiceNumber: 'INV-2026-108',
        grandTotal: 147500,
        amountPaid: 50000,
        balanceDue: 97500,
        triggeredBy: currentUser?.displayName || 'Administrator',
      };

      const result = await triggerAutomation(event, rawPayload, {
        ruleId,
        customRuleName: rule?.name,
        isTestTrigger: true,
      });

      if (result.log) {
        return result.log;
      }

      // Fallback log in case no log was returned
      const fallbackLog: AutomationLog = {
        id: `log_res_${Date.now()}`,
        organizationId: currentOrg.id,
        ruleId: rule?.id,
        ruleName: rule?.name || 'Manual Test Trigger',
        automationName: rule?.name || 'Manual Test Trigger',
        triggerEvent: event as any,
        status: result.status,
        timestamp: new Date().toISOString(),
        durationMs: result.durationMs,
        executionDurationMs: result.durationMs,
        httpStatus: result.httpStatus || 200,
        payload: rawPayload,
        targetWebhookUrl: rule?.targetWebhookUrl || settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL,
        errorMessage: result.errorMessage,
        diagnosticHint: result.diagnosticHint,
        n8nHint: result.n8nHint,
        retryCount: 0,
      };
      return fallbackLog;
    },
    [automations, customers, leads, currentUser, currentOrg.id, settings.n8nWebhookUrl, triggerAutomation]
  );

  const retryAutomationLog = useCallback(
    async (logId: string) => {
      const log = automationLogs.find((l) => l.id === logId);
      if (!log) return;

      const rule = automations.find((r) => r.id === log.ruleId);
      const targetUrl = rule?.targetWebhookUrl || settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;

      try {
        const res = await fetch('/api/webhooks/n8n/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            apiKey: rule?.apiKey || settings.n8nApiKey,
            authType: rule?.authType || settings.n8nAuthType,
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
                  errorMessage: data.error,
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
      const targetUrl = settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;
      const eventName = customEvent || 'webhook_test_ping';
      const activeLeadsCount = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length;
      const pendingInvoices = invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
      const totalPendingBalance = pendingInvoices.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
      const totalRevenueCollected = invoices.reduce((sum, i) => sum + (i.amountPaid || 0), 0);

      const sampleCustomer = customers[0];

      const rawPayload = {
        event: eventName,
        source: 'Smart Business Automation Hub',
        timestamp: new Date().toISOString(),
        organization: currentOrg.name,
        organizationId: currentOrg.id,
        triggeredBy: currentUser?.displayName || 'Administrator',
        userEmail: currentUser?.email || 'automation@apexsolutions.in',
        customerName: sampleCustomer?.fullName || 'Vikram Singhania',
        company: sampleCustomer?.companyName || 'Singhania Logistics Ltd',
        companyName: sampleCustomer?.companyName || 'Singhania Logistics Ltd',
        email: sampleCustomer?.email || 'vikram@singhanialogistics.com',
        contactNumber: sampleCustomer?.whatsappNumber || '+91 98201 94821',
        phone: sampleCustomer?.whatsappNumber || '+91 98201 94821',
        whatsappNumber: sampleCustomer?.whatsappNumber || '+91 98201 94821',
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
        triggeredByEmail: currentUser?.email || 'automation@apexsolutions.in',
        targetWebhookUrl: targetUrl,
      });

      const startTime = Date.now();
      try {
        const res = await fetch('/api/webhooks/n8n/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            apiKey: settings.n8nApiKey,
            authType: settings.n8nAuthType,
            event: eventName,
            payload: completePayload,
          }),
        });

        let data: any = {};
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          data = await res.json();
        } else {
          const text = await res.text();
          data = {
            success: res.ok,
            statusCode: res.status,
            durationMs: Date.now() - startTime,
            response: text.slice(0, 500),
            error: res.ok ? undefined : `Non-JSON server response (HTTP ${res.status})`,
          };
        }
        const durationMs = data.durationMs || Date.now() - startTime;

        const logEntry: AutomationLog = {
          id: `log_live_${Date.now()}`,
          organizationId: currentOrg.id,
          automationName: 'Connected n8n Webhook Ping',
          triggerEvent: eventName as any,
          status: data.success ? 'Success' : 'Failed',
          timestamp: new Date().toISOString(),
          durationMs,
          httpStatus: data.statusCode || (data.success ? 200 : 502),
          payload: completePayload,
          targetWebhookUrl: targetUrl,
          diagnosticHint: data.diagnosticHint,
          n8nHint: data.n8nHint,
          responseMessage: data.response
            ? typeof data.response === 'string'
              ? data.response
              : JSON.stringify(data.response)
            : data.success
            ? 'Delivered to n8n webhook successfully'
            : undefined,
          errorMessage: data.error,
          retryCount: 0,
        };

        setAutomationLogs((prev) => [logEntry, ...prev]);

        return {
          success: Boolean(data.success),
          message: data.success
            ? `Successfully delivered payload to ${targetUrl}`
            : data.error || 'Failed to dispatch to n8n webhook',
          diagnosticHint: data.diagnosticHint,
          n8nHint: data.n8nHint,
          statusCode: data.statusCode,
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
    [leads, invoices, currentOrg, currentUser, customers, settings]
  );

  // Switch between Production and Test webhook URLs in 1 click
  const switchWebhookMode = useCallback(
    async (mode: 'production' | 'test') => {
      const currentUrl = settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;
      let newUrl = currentUrl;
      if (mode === 'test' && currentUrl.includes('/webhook/')) {
        newUrl = currentUrl.replace('/webhook/', '/webhook-test/');
      } else if (mode === 'production' && currentUrl.includes('/webhook-test/')) {
        newUrl = currentUrl.replace('/webhook-test/', '/webhook/');
      }

      await updateSettings({ n8nWebhookUrl: newUrl });
      setAutomations((prev) =>
        prev.map((rule) => {
          let ruleUrl = rule.targetWebhookUrl || newUrl;
          if (mode === 'test' && ruleUrl.includes('/webhook/')) {
            ruleUrl = ruleUrl.replace('/webhook/', '/webhook-test/');
          } else if (mode === 'production' && ruleUrl.includes('/webhook-test/')) {
            ruleUrl = ruleUrl.replace('/webhook-test/', '/webhook/');
          }
          return { ...rule, targetWebhookUrl: ruleUrl };
        })
      );
    },
    [settings.n8nWebhookUrl, updateSettings]
  );

  // Run full connectivity diagnostic on n8n
  const runWebhookDiagnostics = useCallback(
    async (customUrl?: string) => {
      const url = customUrl || settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;
      try {
        const res = await fetch('/api/webhooks/n8n/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ webhookUrl: url }),
        });
        const data = await res.json();
        return data;
      } catch (err: any) {
        return {
          success: false,
          error: err.message,
          recommendedAction: 'Could not communicate with local backend proxy.',
        };
      }
    },
    [settings.n8nWebhookUrl]
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
    setCurrentUser(initialUsers[0]);

    localStorage.clear();
  }, []);

  const logout = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    setCurrentUser(null);
  }, []);

  const value = useMemo(
    () => ({
      currentUser,
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
      updateSettings,
      updateBusinessProfile,
      addEmployee,
      updateEmployee,
      toggleAutomationRule,
      updateAutomationRule,
      triggerAutomationRule,
      triggerAutomation,
      retryAutomationLog,
      testLiveWebhook,
      switchWebhookMode,
      runWebhookDiagnostics,
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
      updateSettings,
      updateBusinessProfile,
      addEmployee,
      updateEmployee,
      toggleAutomationRule,
      updateAutomationRule,
      triggerAutomationRule,
      triggerAutomation,
      retryAutomationLog,
      testLiveWebhook,
      switchWebhookMode,
      runWebhookDiagnostics,
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
