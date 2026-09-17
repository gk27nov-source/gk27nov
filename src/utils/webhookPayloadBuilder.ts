/**
 * Webhook Payload Builder for n8n and Business Hub Automations
 * Formats rich, ready-to-dispatch payloads with:
 *  - email (standardized recipient email)
 *  - contactNumber / phone (international format for WhatsApp API)
 *  - whatsappMessage / bodyMessage (ready-to-send markdown for WhatsApp)
 *  - emailSubject & emailBody (ready-to-send formatted email content)
 *  - All relevant domain metadata and entity fields
 */

export interface WebhookContextOptions {
  organizationName?: string;
  organizationEmail?: string;
  organizationPhone?: string;
  organizationId?: string;
  triggeredByName?: string;
  triggeredByEmail?: string;
  targetWebhookUrl?: string;
}

export interface CompleteWebhookPayload {
  // Core event metadata
  event: string;
  eventName: string;
  timestamp: string;
  source: string;
  organization: string;
  organizationId: string;
  triggeredBy: string;
  triggeredByEmail: string;
  /** Whatever identifies the underlying record — lead id, ticket number, invoice number, etc. */
  recordId: string;

  // Contact Details for WhatsApp and Email nodes in n8n
  email: string;
  emailAddress: string;
  customerEmail: string;
  recipientEmail: string;
  recipientName: string;
  recipientRole: 'customer' | 'lead' | 'employee' | 'admin' | 'partner';

  contactNumber: string;
  phone: string;
  whatsappNumber: string;
  mobileNumber: string;
  phoneFormatted: string;

  // Ready-to-use Body Messages
  whatsappMessage: string;
  bodyMessage: string;
  emailSubject: string;
  emailBody: string;
  emailHtml: string;
  shortMessage: string;

  // Key event data spread directly for easy n8n variable access (e.g. $json.amount, $json.status)
  [key: string]: any;
}

/**
 * Standardize telephone numbers to international format (E.164-compatible)
 */
export function sanitizePhoneNumber(
  phoneStr?: string
): { international: string; formatted: string } | null {
  // Returns null rather than a default number.
  //
  // This function used to fall back to '+919820194821' when the phone was
  // blank. That did not make a dispatch succeed — it made it succeed at the
  // WRONG PERSON: a customer record with no phone silently sent that
  // customer's WhatsApp message to whoever owns that number, with nothing in
  // the logs to say so. An automation that refuses to fire is a bug you can
  // see; an automation that messages a stranger is an incident you cannot.
  if (!phoneStr || phoneStr.trim() === '') {
    return null;
  }

  const raw = phoneStr.trim();
  // Strip spaces, dashes, parentheses
  let digits = raw.replace(/[^\d+]/g, '');

  if (digits.startsWith('+')) {
    // Already has country code
    const numOnly = digits.slice(1);
    return {
      international: digits,
      formatted: `+${numOnly.slice(0, 2)} ${numOnly.slice(2, 7)} ${numOnly.slice(7)}`.trim(),
    };
  }

  // If 10 digits (typical Indian mobile), prefix +91
  if (digits.length === 10) {
    return {
      international: `+91${digits}`,
      formatted: `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`,
    };
  }

  // Otherwise ensure leading plus
  return {
    international: `+${digits}`,
    formatted: `+${digits}`,
  };
}

/**
 * Standardize email address with fallback
 */
export function sanitizeEmail(emailStr?: string): string | null {
  // Same reasoning as sanitizePhoneNumber. The previous default was
  // 'contact@apexsolutions.in', and the caller's own fallback chain ended in
  // 'rajesh.mehra@mehra-logistics.com' — a real customer from the seed data.
  // A record with no email addressed its message to that person.
  if (!emailStr || !emailStr.includes('@')) {
    return null;
  }
  const trimmed = emailStr.trim().toLowerCase();
  // Minimal shape check: something before the @, a dot-bearing domain after.
  return /^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(trimmed) ? trimmed : null;
}

/**
 * Raised when an event cannot be addressed to anybody. The dispatcher catches
 * this and records a visible Failed log entry, so the operator learns that the
 * record is missing contact details.
 */
export class MissingContactError extends Error {
  constructor(
    public readonly event: string,
    public readonly detail: string
  ) {
    super(`Cannot dispatch "${event}": ${detail}`);
    this.name = 'MissingContactError';
  }
}

/**
 * Format currency in Indian Rupee standard
 */
export function formatCurrency(amount: number = 0): string {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

/**
 * Generate event-specific WhatsApp and Email message templates
 */
export function generateMessagesForEvent(
  event: string,
  data: Record<string, any>,
  orgName: string = 'Apex Business Solutions'
): {
  eventName: string;
  whatsappMessage: string;
  emailSubject: string;
  emailBody: string;
  emailHtml: string;
  shortMessage: string;
} {
  const customerName = data.customerName || data.name || data.fullName || 'Valued Customer';
  const company = data.company || data.companyName || 'Business Partner';
  // These are the contact details printed INSIDE the message body, not the
  // address it is delivered to (that goes through sanitizePhoneNumber /
  // sanitizeEmail, which refuse rather than invent). They used to fall back to
  // '+91 98201 94821' and 'customer@example.com' — so a lead with no phone on
  // file produced a WhatsApp message telling a salesperson to call a number
  // belonging to a stranger. Say what is true instead.
  const phone = data.contactNumber || data.phone || data.mobile || 'not on file';
  const email = data.email || 'not on file';

  switch (event) {
    case 'new_lead': {
      const requirement = data.requirement || 'Enterprise Solution Consulting';
      const value = formatCurrency(data.value || data.estimatedValue || 250000);
      const rep = data.assignedTo || data.assignedToName || 'Senior Account Executive';
      const leadId = data.leadId || `LEAD-${Date.now().toString().slice(-4)}`;

      const whatsappMessage = `*🚀 New Sales Lead Registered - ${orgName}*

• *Lead Reference*: ${leadId}
• *Customer*: ${customerName}
• *Company*: ${company}
• *Contact Phone*: ${phone}
• *Email*: ${email}
• *Requirement*: ${requirement}
• *Estimated Pipeline*: ${value}
• *Priority*: ${data.priority || 'High'}
• *Assigned Specialist*: ${rep}

👉 *Action Required*: Contact lead via WhatsApp or direct call within 15 minutes to initiate technical discovery.`;

      const emailSubject = `[${orgName} CRM] New Qualified Lead: ${customerName} (${company}) - ${value}`;
      const emailBody = `Dear ${rep},

A new prospective client lead has been captured and assigned to your portfolio in the Smart Business Hub.

LEAD DETAILS:
- Reference ID: ${leadId}
- Prospect Name: ${customerName}
- Organization: ${company}
- Contact Phone: ${phone}
- Email Address: ${email}
- Project Scope: ${requirement}
- Estimated Contract Value: ${value}
- Current Stage: ${data.status || 'New'} (${data.priority || 'High'} Priority)

NEXT STEPS:
1. Review the prospect requirements in the CRM dashboard.
2. Initiate contact via WhatsApp message or introductory phone call.
3. Schedule an introductory requirement scoping session.

Best regards,
${orgName} Automated CRM Dispatcher`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #2563eb; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">🚀 New Sales Lead: ${customerName}</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">${company} &bull; Pipeline Value: ${value}</p>
  </div>
  <div style="padding: 24px;">
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <tr><td style="padding: 8px 0; color: #64748b;">Contact Name:</td><td style="padding: 8px 0; font-weight: bold;">${customerName}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Mobile / WhatsApp:</td><td style="padding: 8px 0; font-weight: bold; color: #2563eb;">${phone}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Email Address:</td><td style="padding: 8px 0;">${email}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Project Scope:</td><td style="padding: 8px 0;">${requirement}</td></tr>
      <tr><td style="padding: 8px 0; color: #64748b;">Assigned Rep:</td><td style="padding: 8px 0; font-weight: bold;">${rep}</td></tr>
    </table>
  </div>
</div>`;

      return {
        eventName: 'New Sales Lead Notification',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `New Lead: ${customerName} (${company}) - ${value}. Assigned to ${rep}.`,
      };
    }

    case 'new_customer': {
      const custId = data.customerId || `CUST-${Date.now().toString().slice(-4)}`;
      const rep = data.assignedTo || data.assignedEmployeeName || 'Customer Success Team';

      const whatsappMessage = `*🎉 Welcome to ${orgName}!*

Dear *${customerName}*,
We are pleased to welcome *${company}* as our valued partner! Your account has been officially onboarded into our enterprise portal.

• *Customer ID*: ${custId}
• *Registered Mobile*: ${phone}
• *Registered Email*: ${email}
• *Dedicated Relationship Manager*: ${rep}
• *Account Status*: Active & Verified

We are committed to delivering exceptional solutions for your team. Please save this number for quick WhatsApp support anytime.`;

      const emailSubject = `Welcome to ${orgName} - Account Reference #${custId}`;
      const emailBody = `Dear ${customerName},

Welcome to ${orgName}!

We are delighted to confirm that your commercial account for ${company} is now officially registered in our systems under Customer ID #${custId}.

ACCOUNT DETAILS:
- Account ID: ${custId}
- Primary Contact: ${customerName}
- Company: ${company}
- Support WhatsApp: ${phone}
- Dedicated Relationship Manager: ${rep}

Our team is dedicated to providing you with seamless service, transparent billing, and rapid technical support. If you require any assistance, simply reply directly to this email or reach out to your relationship manager.

Warm regards,
Client Relations Team
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: linear-gradient(135deg, #10b981, #059669); padding: 24px; color: white;">
    <h2 style="margin: 0; font-size: 22px;">Welcome to ${orgName}!</h2>
    <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Account #${custId} is now active</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 15px; line-height: 1.6;">Dear <strong>${customerName}</strong>,<br/>Thank you for partnering with us. Your organization <strong>${company}</strong> is now fully onboarded.</p>
    <div style="background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin: 16px 0;">
      <p style="margin: 4px 0; font-size: 13px;"><strong>Customer Reference:</strong> ${custId}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Assigned Manager:</strong> ${rep}</p>
      <p style="margin: 4px 0; font-size: 13px;"><strong>Support Contact:</strong> ${phone}</p>
    </div>
  </div>
</div>`;

      return {
        eventName: 'New Customer Onboarding',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Welcome to ${orgName}! Account #${custId} for ${company} is active.`,
      };
    }

    case 'new_complaint': {
      const ticket = data.ticketNumber || `TKT-${Date.now().toString().slice(-4)}`;
      const type = data.type || data.complaintType || 'Service Inquiry';
      const priority = data.priority || 'High';
      const sla = data.slaHours || 4;
      const engineer = data.assignedTo || data.assignedEmployeeName || 'Tier-2 Support Desk';

      const whatsappMessage = `*🚨 Support Ticket Registered: #${ticket}*

Dear *${customerName}* (${company}),
We have received your support ticket regarding: _"${type}"_.

• *Ticket Number*: ${ticket}
• *Category*: ${type}
• *Priority*: ${priority}
• *SLA Target*: ${sla} Hours
• *Assigned Engineer*: ${engineer}
• *Status*: Under Investigation

_Our engineering team is actively working on resolving this issue within our service level agreement. You will receive real-time updates as progress is made._`;

      const emailSubject = `[Support Desk] Ticket Created: #${ticket} [${priority}] - ${type}`;
      const emailBody = `Dear ${customerName},

Thank you for reaching out. We have logged your service inquiry into our ticketing system.

TICKET SUMMARY:
- Ticket Reference: #${ticket}
- Customer: ${customerName} (${company})
- Category: ${type}
- Priority: ${priority}
- SLA Commitment: Resolution targeted within ${sla} hours
- Assigned Specialist: ${engineer}

We treat every customer request with the utmost urgency. If you have additional logs, screenshots, or context to share, please reply to this email keeping the subject line intact.

Best regards,
Customer Support Operations
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #dc2626; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">Support Ticket #${ticket} Registered</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Priority: ${priority} &bull; SLA: ${sla} Hours</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
    <p style="font-size: 14px; color: #334155;">Your issue regarding <strong>${type}</strong> has been assigned to <strong>${engineer}</strong>.</p>
  </div>
</div>`;

      return {
        eventName: 'Support Ticket Creation',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Support Ticket #${ticket} logged for ${customerName}. SLA target: ${sla} hours.`,
      };
    }

    case 'complaint_resolved': {
      const ticket = data.ticketNumber || `TKT-${Date.now().toString().slice(-4)}`;
      const resolution = data.resolution || 'Investigation completed and corrected.';
      const rating = data.rating ? `${data.rating}/5 Stars` : '5/5 Stars';

      const whatsappMessage = `*✅ Support Ticket Resolved: #${ticket}*

Dear *${customerName}*,
We are pleased to inform you that support ticket *#${ticket}* has been officially *RESOLVED*.

• *Resolution Summary*: ${resolution}
• *Customer Satisfaction Rating*: ${rating}
• *Organization*: ${orgName}

Thank you for your patience and collaboration while our team resolved this matter. If you require further assistance, simply reply to this chat!`;

      const emailSubject = `[Support Desk] Ticket #${ticket} Has Been Resolved - ${orgName}`;
      const emailBody = `Dear ${customerName},

We are writing to confirm that support ticket #${ticket} has been closed as RESOLVED.

RESOLUTION NOTES:
${resolution}

We continuously strive to improve our service quality. If you believe this issue has not been fully addressed, reply to this email within 48 hours to automatically reopen your ticket.

Sincerely,
Quality Assurance & Support
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #16a34a; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">Ticket #${ticket} Resolved</h2>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
    <p style="font-size: 14px; color: #334155;">${resolution}</p>
  </div>
</div>`;

      return {
        eventName: 'Support Ticket Resolution',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Ticket #${ticket} for ${customerName} has been resolved successfully.`,
      };
    }

    case 'new_invoice':
    case 'invoice_due':
    case 'payment_reminder': {
      const invNum = data.invoiceNumber || `INV-2026-${Date.now().toString().slice(-3)}`;
      const total = formatCurrency(data.grandTotal || data.amount || 141600);
      const balance = formatCurrency(data.balanceDue !== undefined ? data.balanceDue : data.grandTotal || 141600);
      const due = data.dueDate || new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];

      const whatsappMessage = `*📄 Invoice Notification: #${invNum}*

Dear *${customerName}* (${company}),
A tax invoice has been generated for your recent services from *${orgName}*.

• *Invoice Number*: ${invNum}
• *Total Invoiced*: ${total}
• *Balance Due*: ${balance}
• *Payment Due Date*: ${due}
• *Current Status*: ${data.status || 'Sent / Awaiting Payment'}

🏦 *Bank Transfer Details*:
• Bank: HDFC Bank Ltd.
• A/C No: 50200049281726
• IFSC: HDFC0000240
• Account Name: ${orgName}

Please reply with the UTR transaction receipt once the transfer is processed.`;

      const emailSubject = `Tax Invoice #${invNum} from ${orgName} - ${balance} Due by ${due}`;
      const emailBody = `Dear ${customerName},

Please find attached the official Tax Invoice #${invNum} issued to ${company}.

INVOICE BREAKDOWN:
- Invoice Reference: #${invNum}
- Invoiced To: ${customerName} (${company})
- Contact Phone: ${phone}
- Total Invoice Amount: ${total}
- Outstanding Balance: ${balance}
- Payment Due Date: ${due}

PAYMENT INSTRUCTIONS:
Please credit the balance amount via NEFT / RTGS / IMPS to:
- Bank: HDFC Bank Ltd.
- Account Number: 50200049281726
- IFSC Code: HDFC0000240
- Account Name: ${orgName}

For questions or billing reconciliations, reply directly to this email.

Best regards,
Finance & Accounts Department
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #4338ca; padding: 22px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">Tax Invoice #${invNum}</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">Total Due: <strong>${balance}</strong> &bull; Due: ${due}</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
    <p style="font-size: 14px; color: #334155;">Your invoice from ${orgName} is now ready for settlement.</p>
  </div>
</div>`;

      return {
        eventName: 'Tax Invoice Dispatch',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Invoice #${invNum} for ${balance} generated for ${customerName}. Due: ${due}.`,
      };
    }

    case 'payment_received': {
      const invNum = data.invoiceNumber || `INV-2026-${Date.now().toString().slice(-3)}`;
      const amount = formatCurrency(data.amountPaid || data.amount || 141600);
      const remaining = formatCurrency(data.balanceRemaining || data.balanceDue || 0);
      const method = data.paymentMethod || 'NEFT / Bank Transfer';
      const ref = data.reference || data.paymentReference || `TXN-${Date.now().toString().slice(-6)}`;

      const whatsappMessage = `*💰 Payment Confirmation Receipt: #${invNum}*

Dear *${customerName}*,
We gratefully acknowledge receipt of your payment to *${orgName}*.

• *Invoice Number*: ${invNum}
• *Amount Received*: ${amount}
• *Payment Mode*: ${method}
• *Reference*: ${ref}
• *Remaining Balance*: ${remaining}

Thank you for your prompt settlement and ongoing business partnership!`;

      const emailSubject = `Payment Acknowledged: ${amount} Received for Invoice #${invNum} - ${orgName}`;
      const emailBody = `Dear ${customerName},

We have successfully processed and reconciled your payment of ${amount} for Invoice #${invNum}.

TRANSACTION RECEIPT:
- Invoice Ref: #${invNum}
- Billed To: ${customerName} (${company})
- Amount Credited: ${amount}
- Payment Method: ${method}
- Bank Reference ID: ${ref}
- Outstanding Balance: ${remaining}

Your account ledger has been updated accordingly. Thank you for your business.

Warm regards,
Accounts Receivable Team
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #059669; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">Payment Received: ${amount}</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Invoice #${invNum} &bull; ${company}</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
    <p style="font-size: 14px; color: #334155;">Thank you! Your payment of ${amount} has been safely credited.</p>
  </div>
</div>`;

      return {
        eventName: 'Payment Receipt Confirmation',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Payment of ${amount} received for Invoice #${invNum} from ${customerName}.`,
      };
    }

    case 'quotation_created': {
      const qNum = data.quotationNumber || `QT-2026-${Date.now().toString().slice(-3)}`;
      const total = formatCurrency(data.grandTotal || 354000);
      const validUntil = data.validUntil || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

      const whatsappMessage = `*💼 Formal Quotation Ready: #${qNum}*

Dear *${customerName}* (${company}),
We have completed your formal quotation for commercial services:

• *Quotation Reference*: ${qNum}
• *Total Estimate*: ${total} (inclusive of GST)
• *Validity*: Until ${validUntil}
• *Issued By*: ${orgName}

Please review the commercial proposal and let us know if you have any questions or are ready to proceed.`;

      const emailSubject = `Commercial Quotation #${qNum} from ${orgName} - ${total}`;
      const emailBody = `Dear ${customerName},

Thank you for your interest in ${orgName}. We have prepared formal Quotation #${qNum} for ${company}.

PROPOSAL OVERVIEW:
- Quotation Number: #${qNum}
- Client: ${customerName} (${company})
- Total Amount: ${total}
- Proposal Validity: ${validUntil}

Please reply to this email with your confirmation or any modifications you require.

Best regards,
Commercial Sales Team
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #2563eb; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">Quotation #${qNum}</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Grand Total: ${total} &bull; Valid until ${validUntil}</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Dear <strong>${customerName}</strong>,</p>
    <p style="font-size: 14px; color: #334155;">Your formal commercial proposal is ready for evaluation.</p>
  </div>
</div>`;

      return {
        eventName: 'Commercial Quotation Dispatch',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Quotation #${qNum} for ${total} issued to ${customerName} (${company}).`,
      };
    }

    case 'new_task':
    case 'task_overdue': {
      const taskName = data.taskName || data.name || 'Critical Action Item';
      const assignedTo = data.assignedTo || data.assignedToName || 'Operations Team';
      const due = data.dueDate || new Date().toISOString().split('T')[0];
      const priority = data.priority || 'High';
      const isOverdue = event === 'task_overdue';

      const whatsappMessage = `*${isOverdue ? '⚠️ Task Overdue Alert' : '📋 Task Assigned Alert'}*

• *Task*: ${taskName}
• *Assigned Specialist*: ${assignedTo}
• *Due Date*: ${due}
• *Priority Level*: ${priority}
• *Related Entity*: ${customerName} (${company})
• *Organization*: ${orgName}

👉 *Action*: Please update progress and log completion in the Business Hub portal.`;

      const emailSubject = `[${isOverdue ? 'OVERDUE' : 'Task Assigned'}] ${taskName} (Due: ${due}) [${priority}]`;
      const emailBody = `Dear ${assignedTo},

${isOverdue ? 'CRITICAL NOTICE: The following task is now past its designated SLA deadline.' : 'You have been assigned a new operational task in the Business Hub.'}

TASK SPECIFICATIONS:
- Task: ${taskName}
- Assigned To: ${assignedTo}
- Due Date: ${due}
- Priority: ${priority}
- Client Reference: ${customerName} (${company})

Please complete or update the status in the portal today.

Regards,
Task Coordination Engine
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: ${isOverdue ? '#b91c1c' : '#4f46e5'}; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">${isOverdue ? '⚠️ Task Overdue' : '📋 Task Assigned'}: ${taskName}</h2>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Assigned to: <strong>${assignedTo}</strong> &bull; Due: <strong>${due}</strong></p>
  </div>
</div>`;

      return {
        eventName: isOverdue ? 'Task Overdue Escalation' : 'New Task Assignment',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Task Alert: ${taskName} assigned to ${assignedTo} (Due: ${due}).`,
      };
    }

    case 'document_uploaded': {
      const docName = data.documentName || data.name || 'Compliance_Document.pdf';
      const category = data.category || 'General Document';
      const uploader = data.uploadedBy || data.uploadedByName || 'Portal User';

      const whatsappMessage = `*📁 Secure Document Uploaded - ${orgName}*

• *Document*: ${docName}
• *Category*: ${category}
• *Related Customer*: ${customerName} (${company})
• *Uploaded By*: ${uploader}
• *Security Status*: Encrypted & Stored

The document is ready for review and verified processing in the document center.`;

      const emailSubject = `[Document Hub] New Document Uploaded: ${docName} (${category})`;
      const emailBody = `Hello Team,

A new document has been uploaded to the Smart Business Hub:
- File Name: ${docName}
- Category: ${category}
- Associated Account: ${customerName} (${company})
- Uploaded By: ${uploader}
- Timestamp: ${new Date().toLocaleString()}

Access the document center to review the file.

Regards,
Document Management System
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: #0284c7; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">📁 Document Uploaded: ${docName}</h2>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Uploaded by <strong>${uploader}</strong> for <strong>${customerName}</strong> (${company}).</p>
  </div>
</div>`;

      return {
        eventName: 'Document Upload Notification',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Document ${docName} uploaded for ${customerName}.`,
      };
    }

    case 'new_communication': {
      const channel = data.channel || 'whatsapp';
      const subject = data.subject || 'Direct Customer Notification';
      const msg = data.message || 'Direct message content.';

      const whatsappMessage = `*💬 Communication Logged (${channel.toUpperCase()})*

• *Customer*: ${customerName} (${company})
• *Contact*: ${phone} | ${email}
• *Subject*: ${subject}

*Message Body*:
${msg}`;

      const emailSubject = `[Communication] ${subject} - ${customerName}`;
      const emailBody = `Customer: ${customerName} (${company})\nChannel: ${channel}\n\nMessage:\n${msg}`;
      const emailHtml = `<p><strong>${customerName}:</strong> ${msg}</p>`;

      return {
        eventName: 'Customer Communication Dispatched',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Communication to ${customerName}: ${subject}`,
      };
    }

    case 'callback_requested': {
      const preferred = data.preferredTime || 'Within 2 hours';
      const reason = data.reason || 'Contract Terms Clarification';

      const whatsappMessage = `*📞 Customer Callback Requested*

• *Customer*: ${customerName}
• *Company*: ${company}
• *Direct Phone*: ${phone}
• *Preferred Time*: ${preferred}
• *Reason / Topic*: ${reason}

👉 Please dial the customer at their preferred contact number promptly.`;

      const emailSubject = `[Urgent Callback] ${customerName} (${company}) - ${phone}`;
      const emailBody = `Customer Callback Request:\nCustomer: ${customerName}\nPhone: ${phone}\nTime: ${preferred}\nReason: ${reason}`;
      const emailHtml = `<p>Callback request from <strong>${customerName}</strong>: ${phone} (${preferred})</p>`;

      return {
        eventName: 'Customer Callback Request',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Callback requested by ${customerName} (${phone}) - ${preferred}.`,
      };
    }

    case 'low_stock_alert':
    case 'out_of_stock_alert': {
      const isOutOfStock = event === 'out_of_stock_alert' || Number(data.currentStock || 0) <= 0;
      const sku = data.sku || 'SKU-ITEM';
      const productName = data.productName || data.name || 'Industrial Component';
      const currentStock = Number(data.currentStock ?? 0);
      const reorderLevel = Number(data.reorderLevel ?? 10);
      const unit = data.unit || 'PCS';
      const storeName = data.storeName || 'Peenya Central Warehouse';
      const supplierName = data.supplierName || 'Preferred Vendor';
      const suggestedQty = Number(data.suggestedReorderQty || data.suggestedQty || Math.max(reorderLevel * 2, 20));

      const whatsappMessage = `*${isOutOfStock ? '🚨 CRITICAL: OUT OF STOCK ALERT' : '⚠️ INVENTORY ALERT: LOW STOCK DETECTED'}*
• *Product*: ${productName} (${sku})
• *Current Stock*: ${currentStock} ${unit}
• *Reorder Threshold*: ${reorderLevel} ${unit}
• *Store / Location*: ${storeName}
• *Primary Supplier*: ${supplierName}
• *Suggested Purchase Order Qty*: ${suggestedQty} ${unit}
• *Organization*: ${orgName}

👉 *Action*: Please generate a Purchase Order immediately in the Store Management module.`;

      const emailSubject = `[${isOutOfStock ? 'CRITICAL OUT OF STOCK' : 'LOW STOCK ALERT'}] ${productName} (${sku}) at ${storeName}`;
      const emailBody = `Attention Inventory Management Team,

${isOutOfStock ? 'CRITICAL STOCKOUT NOTICE: The following item is completely out of stock!' : 'The inventory level for the following item has dropped to or below its minimum reorder threshold.'}

INVENTORY STATUS:
- Item SKU: ${sku}
- Item Description: ${productName}
- Current Physical Stock: ${currentStock} ${unit}
- Reorder Level: ${reorderLevel} ${unit}
- Warehouse Store: ${storeName}
- Primary Supplier: ${supplierName}
- Recommended Purchase Quantity: ${suggestedQty} ${unit}

Please initiate replenishment through the Store Management portal.

Best regards,
Store Inventory Automation
${orgName}`;

      const emailHtml = `
<div style="font-family: Arial, sans-serif; color: #0f172a; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
  <div style="background: ${isOutOfStock ? '#dc2626' : '#ea580c'}; padding: 20px; color: white;">
    <h2 style="margin: 0; font-size: 20px;">${isOutOfStock ? '🚨 Out of Stock' : '⚠️ Low Stock'}: ${productName}</h2>
    <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">SKU: ${sku} &bull; Current: ${currentStock} ${unit}</p>
  </div>
  <div style="padding: 24px;">
    <p style="font-size: 14px;">Store: <strong>${storeName}</strong> &bull; Reorder Level: <strong>${reorderLevel} ${unit}</strong></p>
    <p style="font-size: 14px;">Recommended Reorder: <strong>${suggestedQty} ${unit}</strong> from <strong>${supplierName}</strong></p>
  </div>
</div>`;

      return {
        eventName: isOutOfStock ? 'Out of Stock Escalation' : 'Low Stock Replenishment Alert',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Stock Alert: ${productName} (${sku}) at ${currentStock} ${unit} (Reorder level: ${reorderLevel}).`,
      };
    }

    case 'purchase_order_created': {
      const poNumber = data.poNumber || 'PO-2026-001';
      const supplier = data.supplierName || 'Schneider Industrial';
      const grandTotal = formatCurrency(data.grandTotal || 0);
      const deliveryDate = data.expectedDeliveryDate || 'Upcoming';
      const storeName = data.destinationStoreName || 'Central Warehouse';

      const whatsappMessage = `*📦 New Purchase Order Issued - ${orgName}*
• *PO Number*: ${poNumber}
• *Vendor / Supplier*: ${supplier}
• *Total Order Value*: ${grandTotal} (inc. GST)
• *Destination Store*: ${storeName}
• *Expected Delivery*: ${deliveryDate}

👉 PO has been logged in ERP. Awaiting vendor dispatch and Goods Receipt (GRN).`;

      const emailSubject = `Purchase Order #${poNumber} Issued to ${supplier} - ${grandTotal}`;
      const emailBody = `Dear ${supplier},

Please find Purchase Order #${poNumber} issued by ${orgName}.
- Order Value: ${grandTotal}
- Delivery Location: ${storeName}
- Expected Delivery: ${deliveryDate}

Kindly confirm receipt and dispatch schedule.

Warm regards,
Procurement Department
${orgName}`;

      const emailHtml = `<div><h2>Purchase Order #${poNumber}</h2><p>Total: ${grandTotal} to ${supplier}</p></div>`;

      return {
        eventName: 'Purchase Order Generation',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `PO #${poNumber} for ${grandTotal} created for ${supplier}.`,
      };
    }

    case 'goods_received': {
      const grnNumber = data.grnNumber || 'GRN-2026-001';
      const poNumber = data.poNumber || 'PO Reference';
      const supplier = data.supplierName || 'Industrial Vendor';
      const store = data.storeName || 'Central Warehouse';
      const itemsCount = data.itemsCount || (Array.isArray(data.items) ? data.items.length : 1);

      const whatsappMessage = `*✅ Goods Receipt Note (GRN) Verified - Stock Increased*
• *GRN Number*: ${grnNumber}
• *Reference PO*: ${poNumber}
• *Supplier*: ${supplier}
• *Store / Warehouse*: ${store}
• *Items Received & Inspected*: ${itemsCount} line items
• *Inventory Status*: Physical stock balance automatically updated in system

👉 Accounts and Store Managers have been notified.`;

      const emailSubject = `[GRN Completed] #${grnNumber} Stock Updated at ${store} (Ref: ${poNumber})`;
      const emailBody = `Goods Receipt Note #${grnNumber} has been verified and stock has been automatically increased at ${store}.\nSupplier: ${supplier}\nRef PO: ${poNumber}`;
      const emailHtml = `<div><h2>GRN #${grnNumber} Verified</h2><p>Stock updated at ${store}</p></div>`;

      return {
        eventName: 'Goods Receipt Note Processed',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `GRN #${grnNumber} processed. Stock updated at ${store}.`,
      };
    }

    case 'stock_transfer_created':
    case 'stock_transfer_approved': {
      const trfNumber = data.transferNumber || 'TRF-2026-001';
      const source = data.sourceStoreName || 'Source Warehouse';
      const destination = data.destinationStoreName || 'Destination Depot';
      const isApproved = event === 'stock_transfer_approved';

      const whatsappMessage = `*🔄 Stock Transfer ${isApproved ? 'Approved & In Transit' : 'Initiated'}*
• *Transfer Ref*: ${trfNumber}
• *Origin Store*: ${source}
• *Destination Store*: ${destination}
• *Status*: ${isApproved ? 'In Transit / Dispatched' : 'Pending Authorization'}
• *Initiated By*: ${data.initiatedByName || 'Store Manager'}

👉 ${isApproved ? 'Destination store manager should verify on receipt.' : 'Authorization required from warehouse supervisor.'}`;

      const emailSubject = `[Stock Transfer ${isApproved ? 'Approved' : 'Initiated'}] #${trfNumber}: ${source} ➔ ${destination}`;
      const emailBody = `Stock Transfer #${trfNumber}\nFrom: ${source}\nTo: ${destination}\nStatus: ${isApproved ? 'Approved & Dispatched' : 'Pending Approval'}`;
      const emailHtml = `<div><h2>Stock Transfer #${trfNumber}</h2><p>${source} ➔ ${destination}</p></div>`;

      return {
        eventName: isApproved ? 'Stock Transfer Approved' : 'Stock Transfer Initiated',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Transfer #${trfNumber}: ${source} ➔ ${destination} (${isApproved ? 'In Transit' : 'Pending'}).`,
      };
    }

    case 'stock_adjustment':
    case 'stock_audit_completed': {
      const refNumber = data.adjustmentNumber || data.auditNumber || 'AUD-2026-001';
      const store = data.storeName || 'Peenya Central Warehouse';
      const reason = data.reason || 'Periodic Physical Stock Audit';
      const discVal = formatCurrency(Math.abs(data.totalDiscrepancyValue || 0));

      const whatsappMessage = `*📊 Stock Audit & Adjustment Recorded*
• *Reference*: ${refNumber}
• *Warehouse*: ${store}
• *Reason / Scope*: ${reason}
• *Discrepancy Impact*: ${discVal}
• *Approved By*: ${data.approvedByName || 'Audit Supervisor'}

👉 System stock quantities have been adjusted and audit trail locked.`;

      const emailSubject = `[Stock Audit Reconciled] #${refNumber} for ${store}`;
      const emailBody = `Stock audit / adjustment #${refNumber} has been authorized for ${store}.\nDiscrepancy: ${discVal}\nReason: ${reason}`;
      const emailHtml = `<div><h2>Stock Reconciled #${refNumber}</h2><p>Store: ${store}</p></div>`;

      return {
        eventName: 'Stock Audit & Reconciliation Completed',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Audit #${refNumber} reconciled for ${store}.`,
      };
    }

    case 'stock_reserved':
    case 'stock_released': {
      const isRelease = event === 'stock_released';
      const resNum = data.reservationNumber || 'RES-2026-001';
      const client = data.customerName || 'Client';
      const refDoc = data.referenceNumber || 'Quotation/Order';

      const whatsappMessage = `*🔒 Stock Allocation ${isRelease ? 'Released' : 'Reserved'}*
• *Reservation*: ${resNum}
• *Status*: ${isRelease ? 'Stock Released to Available Pool' : 'Stock Locked & Reserved'}
• *Customer*: ${client}
• *Reference Document*: ${refDoc}
• *Organization*: ${orgName}

👉 ${isRelease ? 'Units are now available for other customer orders.' : 'Available stock decreased; physical inventory safely reserved.'}`;

      const emailSubject = `[Inventory Reservation ${isRelease ? 'Released' : 'Locked'}] #${resNum} for ${client}`;
      const emailBody = `Stock reservation #${resNum} has been ${isRelease ? 'released' : 'reserved'} for ${client} against ${refDoc}.`;
      const emailHtml = `<div><h2>Reservation #${resNum}</h2><p>${client} - ${isRelease ? 'Released' : 'Active'}</p></div>`;

      return {
        eventName: isRelease ? 'Stock Reservation Released' : 'Stock Reservation Allocated',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Reservation #${resNum} ${isRelease ? 'released' : 'allocated'} for ${client}.`,
      };
    }

    case 'stock_issued_complaint': {
      const ticketNum = data.ticketNumber || 'TKT-8901';
      const partName = data.productName || 'Spare Part';
      const qty = data.quantity || 1;
      const unit = data.unit || 'PCS';
      const client = data.customerName || 'Client Site';

      const whatsappMessage = `*🛠️ Spare Part Consumed for Service Ticket*
• *Service Ticket*: ${ticketNum}
• *Customer / Site*: ${client}
• *Material / Spare*: ${partName}
• *Quantity Consumed*: ${qty} ${unit}
• *Issued By*: ${data.issuedBy || 'Maintenance Engineer'}

👉 Stock subtracted from service store. Activity linked to complaint ticket history.`;

      const emailSubject = `[Service Consumption] ${qty} ${unit} of ${partName} Issued to ${ticketNum}`;
      const emailBody = `Material consumption recorded for ticket ${ticketNum} at ${client}.\nItem: ${partName}\nQty: ${qty} ${unit}`;
      const emailHtml = `<div><h2>Service Stock Consumption</h2><p>${ticketNum} - ${partName} (${qty} ${unit})</p></div>`;

      return {
        eventName: 'Service Spare Part Issued',
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Service item ${partName} (${qty} ${unit}) issued to ${ticketNum}.`,
      };
    }

    default: {
      // General / test / ping event
      const customMsg = data.message || `Automated event payload dispatched from ${orgName} Business Hub.`;

      const whatsappMessage = `*⚡ Automation Webhook Verified - ${orgName}*

• *Event*: ${event}
• *Triggered By*: ${data.triggeredBy || 'Administrator'}
• *Recipient Phone*: ${phone}
• *Recipient Email*: ${email}
• *Message*: ${customMsg}
• *System Status*: All 8 CRM webhook pipelines connected & healthy

_Ready for execution on n8n workflows._`;

      const emailSubject = `[${orgName} Webhook] Event '${event}' Dispatched Successfully`;
      const emailBody = `Hello,\n\nThe automation webhook for event '${event}' was successfully triggered.\n\nPayload Summary:\n- Recipient: ${customerName}\n- Phone: ${phone}\n- Email: ${email}\n- Details: ${customMsg}\n\nRegards,\n${orgName} Automation Engine`;
      const emailHtml = `<p>Webhook event <strong>${event}</strong> dispatched to ${email} / ${phone}.</p>`;

      return {
        eventName: `Webhook Event: ${event}`,
        whatsappMessage,
        emailSubject,
        emailBody,
        emailHtml,
        shortMessage: `Webhook event '${event}' executed for ${customerName}.`,
      };
    }
  }
}

/**
 * Main Builder: Consolidates entity data, contacts, and messages into the standard n8n webhook payload
 */
export function buildWebhookPayload(
  event: string,
  entityData: Record<string, any> = {},
  options: WebhookContextOptions = {}
): CompleteWebhookPayload {
  const orgName = options.organizationName || 'Apex Business Solutions';
  const orgId = options.organizationId || 'org_apex_01';
  const triggeredByName = options.triggeredByName || 'System Automation';
  // No personal-email fallback. An event with no authenticated actor is a bug
  // in the caller, not something to paper over with somebody's address.
  const triggeredByEmail = options.triggeredByEmail || '';

  // 1. Resolve Contact Phone (WhatsApp)
  //
  // Falling back to the ORGANISATION's own number is legitimate — internal
  // notifications such as task_overdue are addressed to the business itself.
  // Falling back to a literal is not, and that literal is now gone.
  const rawPhone =
    entityData.contactNumber ||
    entityData.phone ||
    entityData.whatsappNumber ||
    entityData.mobileNumber ||
    entityData.mobile ||
    entityData.customerPhone ||
    options.organizationPhone;

  const phone = sanitizePhoneNumber(rawPhone);

  // 2. Resolve Contact Email
  const rawEmail =
    entityData.email ||
    entityData.emailAddress ||
    entityData.customerEmail ||
    entityData.recipientEmail ||
    options.organizationEmail;

  const cleanEmail = sanitizeEmail(rawEmail);

  // An event needs at least one usable channel. If neither resolves, refuse
  // loudly instead of dispatching a payload addressed to nobody — or worse, to
  // a hardcoded stand-in.
  if (!phone && !cleanEmail) {
    throw new MissingContactError(
      event,
      'the record carries no usable phone number or email address, and the organisation has none configured either'
    );
  }

  // Unresolved channels go out as empty strings, never as a stand-in address.
  // An n8n workflow should branch on `hasPhone` / `hasEmail` rather than
  // assuming both are present.
  const cleanPhone = phone?.international ?? '';
  const formattedPhone = phone?.formatted ?? '';
  const emailForPayload = cleanEmail ?? '';

  // 3. Resolve Recipient Name
  const recipientName =
    entityData.customerName ||
    entityData.fullName ||
    entityData.name ||
    entityData.assignedTo ||
    entityData.assignedToName ||
    'Valued Customer';

  // 4. Generate Body Messages
  const generated = generateMessagesForEvent(
    event,
    {
      ...entityData,
      contactNumber: formattedPhone,
      email: emailForPayload,
      customerName: recipientName,
    },
    orgName
  );

  // 5. Assemble Complete Payload
  const completePayload: CompleteWebhookPayload = {
    // Event Metadata
    event,
    eventName: generated.eventName,
    timestamp: new Date().toISOString(),
    source: 'Smart Business Automation Hub',
    organization: orgName,
    organizationId: orgId,
    triggeredBy: triggeredByName,
    triggeredByEmail: triggeredByEmail,
    // A single, event-agnostic id an n8n node can log or key a lookup on,
    // without needing to know whether this particular event calls it leadId,
    // ticketNumber, invoiceNumber, or something else.
    recordId: String(
      entityData.recordId ??
        entityData.id ??
        entityData.leadId ??
        entityData.customerId ??
        entityData.ticketNumber ??
        entityData.invoiceNumber ??
        entityData.quotationId ??
        entityData.taskId ??
        entityData.documentId ??
        entityData.communicationId ??
        ''
    ),

    // Primary Contact Fields for WhatsApp Nodes in n8n
    contactNumber: cleanPhone,
    phone: cleanPhone,
    whatsappNumber: cleanPhone,
    mobileNumber: cleanPhone,
    phoneFormatted: formattedPhone,

    // Primary Email Fields for Email / SMTP / Gmail Nodes in n8n
    email: emailForPayload,
    emailAddress: emailForPayload,
    customerEmail: emailForPayload,
    recipientEmail: emailForPayload,
    // Explicit channel availability, so a workflow branches instead of
    // silently sending to an empty address.
    hasPhone: Boolean(phone),
    hasEmail: Boolean(cleanEmail),
    recipientName,
    recipientRole:
      event.includes('task') || event.includes('employee')
        ? 'employee'
        : event.includes('lead')
        ? 'lead'
        : 'customer',

    // Pre-formatted Body Messages
    whatsappMessage: generated.whatsappMessage,
    bodyMessage: generated.whatsappMessage, // Universal body field
    emailSubject: generated.emailSubject,
    emailBody: generated.emailBody,
    emailHtml: generated.emailHtml,
    shortMessage: generated.shortMessage,

    // Spread entity data at root level for seamless $json expression mapping
    ...entityData,

    // Also preserve dedicated entity object
    eventData: { ...entityData },
  };

  return completePayload;
}
