import React, { useState } from 'react';
import { Quotation, Invoice, Organization } from '../../types';
import { formatCurrency } from './invoiceUtils';
import {
  X,
  MessageSquare,
  Mail,
  Copy,
  Check,
  ExternalLink,
  Printer,
  Smartphone,
  Send,
  FileText,
} from 'lucide-react';

interface ShareWithCustomerModalProps {
  document: Quotation | Invoice;
  type: 'quotation' | 'invoice';
  organization: Organization;
  onClose: () => void;
  onOpenPrintView: () => void;
}

export const ShareWithCustomerModal: React.FC<ShareWithCustomerModalProps> = ({
  document,
  type,
  organization,
  onClose,
  onOpenPrintView,
}) => {
  const [activeTab, setActiveTab] = useState<'whatsapp' | 'email' | 'summary'>('whatsapp');
  const [copied, setCopied] = useState<string | null>(null);

  // Recipient info
  const [phoneNumber, setPhoneNumber] = useState(document.customerPhone || '');
  const [emailAddress, setEmailAddress] = useState(document.customerEmail || '');

  const isInvoice = type === 'invoice';
  const docNumber = isInvoice ? (document as Invoice).invoiceNumber : (document as Quotation).quotationNumber;
  const docTitle = isInvoice ? 'Tax Invoice' : 'Commercial Quotation';
  const dateField = isInvoice
    ? `Issue Date: ${(document as Invoice).issueDate} | Due Date: ${(document as Invoice).dueDate}`
    : `Date: ${(document as Quotation).date} | Valid Until: ${(document as Quotation).validUntil}`;

  // Generate WhatsApp Message
  const generateWhatsAppMessage = () => {
    let text = `*${organization.name}*\n`;
    text += `📄 *${docTitle}: ${docNumber}*\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `Dear *${document.customerName}* (${document.companyName || 'Valued Customer'}),\n\n`;
    text += `Please find the details for your ${docTitle.toLowerCase()} below:\n\n`;
    text += `🗓️ ${dateField}\n\n`;
    text += `*Items & Services:*\n`;

    document.items.forEach((item, index) => {
      text += `${index + 1}. ${item.description} (Qty: ${item.quantity}) - ${formatCurrency(item.total, document.currency)}\n`;
    });

    text += `\nSubtotal: ${formatCurrency(document.subtotal, document.currency)}\n`;
    text += `GST / Taxes: ${formatCurrency(document.taxTotal, document.currency)}\n`;
    if (document.discountTotal > 0) {
      text += `Discount: -${formatCurrency(document.discountTotal, document.currency)}\n`;
    }
    text += `*Grand Total: ${formatCurrency(document.grandTotal, document.currency)}*\n`;

    if (isInvoice) {
      const inv = document as Invoice;
      if (inv.amountPaid > 0) {
        text += `Amount Paid: ${formatCurrency(inv.amountPaid, inv.currency)}\n`;
        text += `*Balance Due: ${formatCurrency(inv.balanceDue, inv.currency)}*\n`;
      }
      text += `\n*Payment Instructions:*\n`;
      text += `Bank: HDFC Bank | A/C: 50200049281726\nIFSC: HDFC0000240 | UPI ID: apexsolutions@hdfcbank\n`;
    }

    text += `\nFor queries, feel free to reply directly or contact us at ${organization.phone}.\n`;
    text += `\nThank you for choosing ${organization.legalName || organization.name}!`;

    return text;
  };

  // Generate Email Content
  const emailSubject = `[${organization.name}] ${docTitle} ${docNumber} for ${document.companyName || document.customerName}`;

  const generateEmailBody = () => {
    let body = `Dear ${document.customerName},\n\n`;
    body += `We hope this message finds you well.\n\n`;
    body += `Please find attached the details of ${docTitle} ${docNumber} issued by ${organization.legalName || organization.name}.\n\n`;
    body += `--------------------------------------------------\n`;
    body += `${docTitle.toUpperCase()} DETAILS:\n`;
    body += `Document No: ${docNumber}\n`;
    body += `${dateField}\n`;
    body += `Customer: ${document.customerName} | ${document.companyName}\n`;
    if (document.customerGst) body += `GSTIN: ${document.customerGst}\n`;
    body += `--------------------------------------------------\n\n`;
    body += `LINE ITEMS:\n`;

    document.items.forEach((item, idx) => {
      body += `${idx + 1}. ${item.description}\n   Qty: ${item.quantity} | Rate: ${formatCurrency(item.unitPrice, document.currency)} | GST: ${item.taxRate}% | Total: ${formatCurrency(item.total, document.currency)}\n`;
    });

    body += `\n--------------------------------------------------\n`;
    body += `Subtotal: ${formatCurrency(document.subtotal, document.currency)}\n`;
    body += `Taxes (GST): ${formatCurrency(document.taxTotal, document.currency)}\n`;
    if (document.discountTotal > 0) {
      body += `Discount: -${formatCurrency(document.discountTotal, document.currency)}\n`;
    }
    body += `GRAND TOTAL: ${formatCurrency(document.grandTotal, document.currency)}\n`;

    if (isInvoice) {
      const inv = document as Invoice;
      body += `Amount Paid: ${formatCurrency(inv.amountPaid, inv.currency)}\n`;
      body += `BALANCE DUE: ${formatCurrency(inv.balanceDue, inv.currency)}\n\n`;
      body += `PAYMENT BANK DETAILS:\n`;
      body += `Account Name: Apex Business Automations Pvt. Ltd.\n`;
      body += `Bank: HDFC Bank Ltd.\n`;
      body += `Account Number: 50200049281726\n`;
      body += `IFSC Code: HDFC0000240\n`;
      body += `UPI ID: apexsolutions@hdfcbank\n`;
    }

    body += `\nNotes / Terms:\n${document.terms || 'Payment as per agreement.'}\n\n`;
    body += `Warm regards,\n`;
    body += `Accounts & Operations Team\n`;
    body += `${organization.legalName || organization.name}\n`;
    body += `Phone: ${organization.phone} | Email: ${organization.email}\n`;
    body += `Website: ${organization.website}`;

    return body;
  };

  const [customWhatsAppMsg, setCustomWhatsAppMsg] = useState(generateWhatsAppMessage());
  const [customEmailBody, setCustomEmailBody] = useState(generateEmailBody());

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2500);
  };

  const handleSendWhatsApp = () => {
    const cleanPhone = phoneNumber.replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(customWhatsAppMsg);
    const url = cleanPhone
      ? `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://api.whatsapp.com/send?text=${encoded}`;
    window.open(url, '_blank');
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent(emailSubject);
    const body = encodeURIComponent(customEmailBody);
    const mailto = `mailto:${emailAddress}?subject=${subject}&body=${body}`;
    window.open(mailto, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/75">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                Share {docTitle} With Customer
              </h2>
              <p className="text-xs text-slate-500">
                {docNumber} • {document.customerName} ({document.companyName})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 px-6 bg-white gap-2">
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'whatsapp'
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4 text-emerald-500" />
            <span>WhatsApp Share</span>
          </button>
          <button
            onClick={() => setActiveTab('email')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'email'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Mail className="w-4 h-4 text-blue-500" />
            <span>Email Draft</span>
          </button>
          <button
            onClick={() => setActiveTab('summary')}
            className={`flex items-center gap-2 py-3 px-4 text-sm font-semibold border-b-2 transition-all ${
              activeTab === 'summary'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <FileText className="w-4 h-4 text-purple-500" />
            <span>Quick Summary</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
          {activeTab === 'whatsapp' && (
            <div className="space-y-4">
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>
                    Direct WhatsApp sharing opens WhatsApp Web or your desktop app with the itemized breakdown ready to send.
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Customer Mobile / WhatsApp Number
                </label>
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="+91 98201 12345"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    WhatsApp Message Preview (Editable)
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(customWhatsAppMsg, 'whatsapp')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-emerald-600 font-medium transition-colors"
                  >
                    {copied === 'whatsapp' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={customWhatsAppMsg}
                  onChange={(e) => setCustomWhatsAppMsg(e.target.value)}
                  className="w-full p-3 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onOpenPrintView}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Preview Official PDF</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(customWhatsAppMsg, 'whatsapp')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied === 'whatsapp' ? 'Copied' : 'Copy'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendWhatsApp}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-all"
                  >
                    <MessageSquare className="w-4 h-4" />
                    <span>Open WhatsApp & Send</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'email' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Recipient Email
                </label>
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  placeholder="accounts@customer.com"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1.5">
                  Email Subject
                </label>
                <input
                  type="text"
                  readOnly
                  value={emailSubject}
                  className="w-full px-3.5 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                    Email Body Content
                  </label>
                  <button
                    type="button"
                    onClick={() => handleCopy(customEmailBody, 'email')}
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-medium transition-colors"
                  >
                    {copied === 'email' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-blue-600">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Email</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  rows={8}
                  value={customEmailBody}
                  onChange={(e) => setCustomEmailBody(e.target.value)}
                  className="w-full p-3 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={onOpenPrintView}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all"
                >
                  <Printer className="w-4 h-4 text-slate-500" />
                  <span>Preview PDF</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(customEmailBody, 'email')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                  >
                    <Copy className="w-4 h-4" />
                    <span>{copied === 'email' ? 'Copied' : 'Copy Body'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSendEmail}
                    className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all"
                  >
                    <Mail className="w-4 h-4" />
                    <span>Open Mail App & Send</span>
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'summary' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex justify-between items-center text-sm border-b border-slate-200 pb-2">
                  <span className="font-semibold text-slate-700">{docTitle}</span>
                  <span className="font-mono font-bold text-slate-900">{docNumber}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Customer</span>
                    <span className="font-medium text-slate-800">{document.customerName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Company</span>
                    <span className="font-medium text-slate-800">{document.companyName}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Status</span>
                    <span className="font-semibold text-slate-800">{document.status}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Total Amount</span>
                    <span className="font-bold text-slate-900">
                      {formatCurrency(document.grandTotal, document.currency)}
                    </span>
                  </div>
                  {isInvoice && (
                    <>
                      <div>
                        <span className="text-slate-400 block">Amount Paid</span>
                        <span className="font-medium text-emerald-600">
                          {formatCurrency((document as Invoice).amountPaid, document.currency)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Balance Due</span>
                        <span className="font-bold text-red-600">
                          {formatCurrency((document as Invoice).balanceDue, document.currency)}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const quickSummary = `${docTitle} ${docNumber} for ${document.customerName} (${document.companyName}) - Total: ${formatCurrency(document.grandTotal, document.currency)}${isInvoice ? `, Balance: ${formatCurrency((document as Invoice).balanceDue, document.currency)}` : ''}`;
                    handleCopy(quickSummary, 'summary');
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 rounded-xl transition-all"
                >
                  {copied === 'summary' ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600" />
                      <span className="text-emerald-600">Copied to Clipboard!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy 1-Line Summary</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
