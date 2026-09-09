export type UserRole = 'super_admin' | 'business_admin' | 'manager' | 'staff' | 'viewer';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  role: UserRole;
  organizationId: string;
  organizationName?: string;
  department?: string;
  phone?: string;
  mobile?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
  permissions?: string[];
}

export type AppUser = UserProfile;

export interface Organization {
  id: string;
  name: string;
  legalName?: string;
  logoUrl?: string;
  email: string;
  phone: string;
  website?: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  gstNumber?: string;
  industry: string;
  plan: 'starter' | 'professional' | 'enterprise';
  createdAt: string;
  updatedAt: string;
}

export type CustomerCategory = 'VIP' | 'Regular' | 'Enterprise' | 'Retail' | 'Wholesale';

export interface Customer {
  id: string;
  customerId: string; // e.g. CUST-1001
  organizationId: string;
  fullName: string;
  companyName: string;
  mobileNumber: string;
  whatsappNumber: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pinCode: string;
  category: CustomerCategory;
  industry: string;
  source: 'Website' | 'Referral' | 'LinkedIn' | 'Cold Call' | 'Expo' | 'Social Media' | 'Other';
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  status: 'Active' | 'Inactive' | 'Archived' | 'Lead';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeadStage = 'New' | 'Contacted' | 'Qualified' | 'Proposal Sent' | 'Negotiation' | 'Won' | 'Lost';
export type LeadStatus = LeadStage;
export type LeadPriority = 'High' | 'Medium' | 'Low';
export type Priority = LeadPriority;

export interface Lead {
  id: string;
  leadId: string; // e.g. LEAD-2024-001
  organizationId: string;
  customerName: string;
  company: string;
  mobile: string;
  mobileNumber?: string;
  email: string;
  requirement: string;
  estimatedValue: number;
  source: string;
  assignedToId: string;
  assignedToName: string;
  assignedEmployeeId?: string;
  assignedEmployeeName?: string;
  status: LeadStage;
  priority: LeadPriority;
  nextFollowupDate: string; // YYYY-MM-DD
  nextFollowUpDate?: string;
  notes?: string;
  remarks?: string;
  customerId?: string;
  createdAt: string;
  updatedAt: string;
}

export type ComplaintType =
  | 'Billing'
  | 'Billing Error'
  | 'Product Defect'
  | 'Damaged Goods'
  | 'Delivery Delay'
  | 'Customer Service'
  | 'Technical Bug'
  | 'Technical Issue'
  | 'Quality Problem'
  | 'Service Disruption'
  | 'Other';
export type ComplaintStatus = 'New' | 'Assigned' | 'In Progress' | 'Waiting for Customer' | 'Resolved' | 'Closed';
export type ComplaintPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Complaint {
  id: string;
  ticketNumber: string; // e.g. TKT-8081
  organizationId: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  complaintType: ComplaintType;
  description: string;
  dateReceived: string;
  priority: ComplaintPriority;
  assignedEmployeeId: string;
  assignedEmployeeName: string;
  status: ComplaintStatus;
  dueDate: string;
  resolution?: string;
  resolutionDate?: string;
  customerFeedback?: string;
  rating?: number; // 1 to 5
  slaHours: number;
  isOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus = 'Not Started' | 'In Progress' | 'On Hold' | 'Completed';
export type TaskPriority = 'Critical' | 'High' | 'Medium' | 'Low';

export interface Task {
  id: string;
  organizationId: string;
  taskName: string;
  description: string;
  assignedToId: string;
  assignedToName: string;
  relatedType?: 'customer' | 'lead' | 'complaint';
  relatedId?: string;
  relatedName?: string;
  relatedCustomerId?: string;
  relatedCustomerName?: string;
  relatedLeadId?: string;
  relatedLeadName?: string;
  priority: TaskPriority;
  dueDate: string;
  status: TaskStatus;
  completionPercentage: number; // 0-100
  notes?: string;
  completedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type DocumentCategory = 'Invoice' | 'Proposal' | 'Contract' | 'Support' | 'Customer Doc' | 'Receipt' | 'KYC' | 'Technical Spec' | 'General' | 'Other';

export interface DocumentItem {
  id: string;
  organizationId: string;
  name: string;
  title?: string;
  fileName?: string;
  category: DocumentCategory;
  fileType: string; // pdf, docx, xlsx, png, jpg
  fileSize: string;
  fileUrl: string;
  customerId?: string;
  customerName?: string;
  relatedCustomerId?: string;
  relatedCustomerName?: string;
  relatedLeadId?: string;
  relatedComplaintId?: string;
  relatedTaskId?: string;
  summary?: string;
  aiSummary?: string;
  uploadedById: string;
  uploadedByName: string;
  createdAt: string;
}

export type CommunicationChannel = 'email' | 'whatsapp' | 'call' | 'sms';

export interface Communication {
  id: string;
  organizationId: string;
  customerId: string;
  customerName: string;
  channel: CommunicationChannel;
  type: 'incoming' | 'outgoing';
  recipient?: string;
  templateName?: string;
  subject?: string;
  message: string;
  sentById: string;
  sentByName: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  timestamp: string;
}

export interface AppNotification {
  id: string;
  organizationId: string;
  userId?: string; // specific user or all in org
  title: string;
  message: string;
  type:
    | 'new_lead'
    | 'new_complaint'
    | 'task_assigned'
    | 'task_due'
    | 'task_overdue'
    | 'lead_followup'
    | 'sla_breach'
    | 'automation_failure'
    | 'system'
    | 'quotation_created'
    | 'invoice_created'
    | 'payment_received';
  referenceId?: string; // id of lead, task, ticket, etc
  referenceType?: 'lead' | 'complaint' | 'task' | 'customer' | 'automation' | 'quotation' | 'invoice';
  isRead: boolean;
  createdAt: string;
}

export interface AutomationRule {
  id: string;
  organizationId: string;
  name: string;
  description: string;
  triggerEvent: 
    | 'new_customer'
    | 'new_lead'
    | 'lead_status_changed'
    | 'new_complaint'
    | 'complaint_resolved'
    | 'new_task'
    | 'task_overdue'
    | 'document_uploaded'
    | 'followup_due'
    | 'callback_requested'
    | 'invoice_due'
    | 'invoice_overdue'
    | 'new_invoice'
    | 'new_quotation'
    | 'payment_received';
  isEnabled: boolean;
  targetWebhookUrl?: string;
  authType?: 'none' | 'bearer' | 'header';
  apiKey?: string;
  lastRun?: string;
  lastTriggeredAt?: string;
  nextRun?: string;
  successCount: number;
  failureCount: number;
  executionCount?: number;
  createdAt: string;
}

export interface AutomationLog {
  id: string;
  organizationId: string;
  ruleId?: string;
  ruleName?: string;
  automationName: string;
  triggerEvent: string;
  status: 'Success' | 'Failed' | 'Pending';
  timestamp: string;
  durationMs: number;
  executionDurationMs?: number;
  httpStatus?: number;
  payload: Record<string, any>;
  responseMessage?: string;
  response?: any;
  errorMessage?: string;
  targetWebhookUrl?: string;
  diagnosticHint?: string;
  n8nHint?: string;
  retryCount: number;
}

export interface OrganizationSettings {
  organizationId: string;
  n8nWebhookUrl: string;
  n8nApiKey: string;
  n8nAuthType: 'none' | 'bearer' | 'header';
  n8nEnabled: boolean;
  whatsappProvider: 'whatsapp_cloud_api' | 'n8n' | 'custom';
  whatsappPhoneNumberId?: string;
  whatsappAccessToken?: string;
  emailProvider: 'smtp' | 'n8n' | 'resend' | 'sendgrid';
  emailSenderAddress?: string;
  geminiModel: string;
  enableSlaAlerts: boolean;
  defaultSlaHours: number;
  dataRetentionDays: number;
  updatedAt: string;
}

export interface ActivityLog {
  id: string;
  organizationId: string;
  userId: string;
  userName: string;
  action: 'create' | 'update' | 'delete' | 'status_change' | 'import' | 'export' | 'automation_trigger' | 'login';
  module: 'customers' | 'leads' | 'complaints' | 'tasks' | 'documents' | 'automations' | 'settings' | 'users' | 'quotations' | 'invoices' | 'products' | 'stores' | 'suppliers' | 'inventory';
  recordId: string;
  recordTitle: string;
  oldValue?: string;
  newValue?: string;
  ipAddress?: string;
  timestamp: string;
}

export interface EmployeePerformance {
  userId: string;
  name: string;
  role: string;
  department: string;
  customersHandled: number;
  leadsAssigned: number;
  leadsConverted: number;
  conversionRate: number;
  complaintsAssigned: number;
  complaintsResolved: number;
  avgResolutionHours: number;
  tasksAssigned: number;
  tasksCompleted: number;
  overdueTasks: number;
  ratingScore: number;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number; // in percent, e.g. 0, 5, 12, 18, 28
  discount: number; // in percent or fixed amount
  total: number;
}

export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired' | 'Converted';

export interface Quotation {
  id: string;
  quotationNumber: string; // e.g. QT-2026-001
  organizationId: string;
  customerId?: string;
  customerName: string;
  companyName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerGst?: string;
  date: string; // YYYY-MM-DD
  validUntil: string; // YYYY-MM-DD
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  currency: string;
  status: QuotationStatus;
  notes?: string;
  terms?: string;
  convertedInvoiceId?: string;
  convertedInvoiceNumber?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Partially Paid' | 'Overdue' | 'Cancelled';

export interface Invoice {
  id: string;
  invoiceNumber: string; // e.g. INV-2026-001
  quotationId?: string;
  quotationNumber?: string;
  organizationId: string;
  customerId?: string;
  customerName: string;
  companyName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  customerGst?: string;
  issueDate: string; // YYYY-MM-DD
  dueDate: string; // YYYY-MM-DD
  items: InvoiceItem[];
  subtotal: number;
  taxTotal: number;
  discountTotal: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  currency: string;
  status: InvoiceStatus;
  paymentMethod?: 'UPI' | 'Bank Transfer / NEFT' | 'Credit Card' | 'Cheque' | 'Cash';
  paymentReference?: string;
  paidAt?: string;
  notes?: string;
  terms?: string;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export * from './inventory';


