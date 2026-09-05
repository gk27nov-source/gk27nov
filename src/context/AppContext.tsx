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
} from '../data/seedData';
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
  triggerAutomationRule: (ruleId: string, customPayload?: Record<string, any>) => Promise<AutomationLog>;
  retryAutomationLog: (logId: string) => Promise<void>;

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
    return saved ? JSON.parse(saved) : initialAutomationRules;
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
    return saved ? JSON.parse(saved) : initialSettings;
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
        ipAddress: '127.0.0.1',
        timestamp: new Date().toISOString(),
      };
      setActivityLogs((prev) => [newLog, ...prev]);
    },
    [currentOrg.id, currentUser]
  );

  // Helper to trigger n8n webhook when an event occurs
  const dispatchWebhookEvent = useCallback(
    async (event: AutomationRule['triggerEvent'], payload: Record<string, any>, customRuleName?: string) => {
      const activeRule = automations.find((r) => r.isEnabled && r.triggerEvent === event);
      if (!activeRule && !settings.n8nEnabled) return;

      const targetUrl = activeRule?.targetWebhookUrl || settings.n8nWebhookUrl;
      const apiKey = activeRule?.apiKey || settings.n8nApiKey;
      const authType = activeRule?.authType || settings.n8nAuthType;
      const ruleName = customRuleName || activeRule?.name || `Webhook Event: ${event}`;

      try {
        const res = await fetch('/api/webhooks/n8n/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            apiKey,
            authType,
            event,
            payload,
          }),
        });

        const data = await res.json();
        const logEntry: AutomationLog = {
          id: `log_${Date.now()}`,
          organizationId: currentOrg.id,
          ruleId: activeRule?.id,
          automationName: ruleName,
          triggerEvent: event,
          status: data.success ? 'Success' : 'Failed',
          timestamp: new Date().toISOString(),
          durationMs: data.durationMs || 150,
          httpStatus: data.statusCode || (data.success ? 200 : 500),
          payload,
          responseMessage: data.response ? JSON.stringify(data.response) : (data.success ? 'Executed' : undefined),
          errorMessage: data.error,
          retryCount: 0,
        };

        setAutomationLogs((prev) => [logEntry, ...prev]);

        // Update counts on rule
        if (activeRule) {
          setAutomations((prev) =>
            prev.map((r) =>
              r.id === activeRule.id
                ? {
                    ...r,
                    lastRun: new Date().toISOString(),
                    successCount: data.success ? r.successCount + 1 : r.successCount,
                    failureCount: !data.success ? r.failureCount + 1 : r.failureCount,
                  }
                : r
            )
          );
        }

        // Trigger notification on failure
        if (!data.success) {
          const failureNotif: AppNotification = {
            id: `notif_${Date.now()}`,
            organizationId: currentOrg.id,
            title: `Automation Failed: ${ruleName}`,
            message: data.error || 'Webhook execution failed',
            type: 'automation_failure',
            referenceId: logEntry.id,
            referenceType: 'automation',
            isRead: false,
            createdAt: new Date().toISOString(),
          };
          setNotifications((prev) => [failureNotif, ...prev]);
        }
      } catch (err: any) {
        console.warn('Could not dispatch webhook:', err);
      }
    },
    [automations, settings, currentOrg.id]
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

      // Dispatch webhook
      dispatchWebhookEvent('new_customer', {
        customerId: newCustomer.customerId,
        name: newCustomer.fullName,
        company: newCustomer.companyName,
        mobile: newCustomer.mobileNumber,
        email: newCustomer.email,
        assignedTo: newCustomer.assignedEmployeeName,
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

      // Webhook
      dispatchWebhookEvent('new_lead', {
        leadId: newLead.leadId,
        customerName: newLead.customerName,
        company: newLead.company,
        requirement: newLead.requirement,
        value: newLead.estimatedValue,
        status: newLead.status,
        assignedTo: newLead.assignedToName,
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
          oldStage,
          newStage: stage,
          value: target.estimatedValue,
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

      // Webhook
      dispatchWebhookEvent('new_complaint', {
        ticketNumber: newTicket.ticketNumber,
        customer: newTicket.customerName,
        type: newTicket.complaintType,
        priority: newTicket.priority,
        slaHours: newTicket.slaHours,
        assignedTo: newTicket.assignedEmployeeName,
      });

      return newTicket;
    },
    [currentOrg.id, logActivity, dispatchWebhookEvent]
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
        logActivity('status_change', 'complaints', id, target.ticketNumber, target.status, 'Resolved');
        dispatchWebhookEvent('complaint_resolved', {
          ticketNumber: target.ticketNumber,
          customer: target.customerName,
          resolution,
          rating,
        });
      }
    },
    [complaints, logActivity, dispatchWebhookEvent]
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

      dispatchWebhookEvent('new_task', {
        taskId: newTask.id,
        taskName: newTask.taskName,
        assignedTo: newTask.assignedToName,
        dueDate: newTask.dueDate,
        priority: newTask.priority,
      });

      return newTask;
    },
    [currentOrg.id, logActivity, dispatchWebhookEvent]
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

      return newQuote;
    },
    [currentOrg.id, currentUser, quotations.length, logActivity]
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

      return newInvoice;
    },
    [quotations, invoices.length, currentOrg.id, currentUser, logActivity]
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

      return newInvoice;
    },
    [invoices.length, currentOrg.id, currentUser, logActivity]
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
    },
    [invoices, currentOrg.id, logActivity]
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

      dispatchWebhookEvent('document_uploaded', {
        documentId: newDoc.id,
        name: newDoc.name,
        category: newDoc.category,
        uploadedBy: newDoc.uploadedByName,
      });

      return newDoc;
    },
    [currentOrg.id, logActivity, dispatchWebhookEvent]
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
    },
    [currentOrg.id, logActivity]
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
      const payload = customPayload || {
        testId: `test_${Date.now()}`,
        ruleName: rule?.name || 'Manual Test Trigger',
        triggeredBy: currentUser?.displayName,
        sampleCustomer: customers[0]?.fullName,
        sampleLead: leads[0]?.customerName,
      };

      const startTime = Date.now();
      try {
        const res = await fetch('/api/webhooks/n8n/trigger', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: targetUrl,
            apiKey: rule?.apiKey || settings.n8nApiKey,
            authType: rule?.authType || settings.n8nAuthType,
            event: rule?.triggerEvent || 'manual_test',
            payload,
          }),
        });

        const data = await res.json();
        const durationMs = data.durationMs || Date.now() - startTime;
        const logEntry: AutomationLog = {
          id: `log_manual_${Date.now()}`,
          organizationId: currentOrg.id,
          ruleId: rule?.id,
          automationName: rule?.name || 'Manual Webhook Test',
          triggerEvent: rule?.triggerEvent || 'manual_test',
          status: data.success ? 'Success' : 'Failed',
          timestamp: new Date().toISOString(),
          durationMs,
          httpStatus: data.statusCode || (data.success ? 200 : 502),
          payload,
          responseMessage: data.response ? JSON.stringify(data.response) : (data.success ? 'Webhook executed successfully' : undefined),
          errorMessage: data.error,
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
                    successCount: data.success ? r.successCount + 1 : r.successCount,
                    failureCount: !data.success ? r.failureCount + 1 : r.failureCount,
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
          triggerEvent: rule?.triggerEvent || 'manual_test',
          status: 'Failed',
          timestamp: new Date().toISOString(),
          durationMs: Date.now() - startTime,
          httpStatus: 500,
          payload,
          errorMessage: err.message,
          retryCount: 0,
        };
        setAutomationLogs((prev) => [errorLog, ...prev]);
        return errorLog;
      }
    },
    [automations, settings, currentOrg.id, currentUser, customers, leads]
  );

  const retryAutomationLog = useCallback(
    async (logId: string) => {
      const log = automationLogs.find((l) => l.id === logId);
      if (!log) return;

      const rule = automations.find((r) => r.id === log.ruleId);
      const targetUrl = rule?.targetWebhookUrl || settings.n8nWebhookUrl;

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
                  responseMessage: data.response ? JSON.stringify(data.response) : (data.success ? 'Retried successfully' : undefined),
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
      triggerAutomationRule,
      retryAutomationLog,
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
      triggerAutomationRule,
      retryAutomationLog,
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
