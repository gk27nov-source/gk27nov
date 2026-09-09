import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Communication } from '../../types';
import { makeNameResolver } from '../../utils/people';
import {
  MessageSquare,
  Mail,
  Send,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  User,
  Building,
  FileText,
  Copy,
  Check,
  AlertCircle,
} from 'lucide-react';

export const CommunicationsView: React.FC = () => {
  const {
    communications,
    sendCommunication,
    customers,
    currentUser,
    employees,
  } = useApp();

  // Names resolved from the uid rather than the copy stored on each record.
  const nameOf = React.useMemo(() => makeNameResolver(employees), [employees]);

  const [activeChannel, setActiveChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [templateName, setTemplateName] = useState<string>('Customer Welcome');
  const [subject, setSubject] = useState<string>('');
  const [messageText, setMessageText] = useState<string>(
    'Hello {{name}}, welcome to Apex Solutions! We look forward to partnering with your organization.'
  );

  const [isAiDrafting, setIsAiDrafting] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [isSentToast, setIsSentToast] = useState(false);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0];

  // Pre-configured WhatsApp Templates
  const whatsappTemplates = [
    {
      name: 'Customer Welcome',
      text: 'Hello {{name}}, welcome to our Smart Business network! We are committed to accelerating your operations with 24/7 dedicated support.',
    },
    {
      name: 'Lead Follow-up',
      text: 'Hi {{name}}, following up on our recent product demo for {{company}}. Would you have 10 minutes tomorrow to discuss customized pricing?',
    },
    {
      name: 'Appointment Confirmation',
      text: 'Dear {{name}}, this is to confirm our executive strategy meeting scheduled for tomorrow at 3:00 PM IST.',
    },
    {
      name: 'Complaint Acknowledgment',
      text: 'Hello {{name}}, we have logged your support ticket #{{ticket}} and assigned senior engineer {{rep}} to investigate immediately.',
    },
    {
      name: 'Complaint Resolution',
      text: 'Hi {{name}}, your ticket #{{ticket}} has been resolved! Please let us know your feedback or rating.',
    },
    {
      name: 'Payment Reminder',
      text: 'Dear {{name}}, a friendly reminder that invoice #INV-8910 for {{company}} is due for clearance. Thank you for your prompt attention.',
    },
    {
      name: 'Promotional Offer',
      text: 'Exclusive for {{company}}: Upgrade your industrial telemetry tier this month and receive 20% off all automation add-ons.',
    },
  ];

  // Email Templates
  const emailTemplates = [
    {
      name: 'Formal Welcome',
      subject: 'Welcome to Apex Solutions - Account Onboarding',
      text: `Dear {{name}},\n\nOn behalf of our entire leadership team, welcome to Apex Solutions. We are thrilled to partner with {{company}}.\n\nYour account manager is on standby to assist with any integrations, billing, or telemetry needs.\n\nWarm regards,\nClient Services Team`,
    },
    {
      name: 'Commercial Proposal',
      subject: 'Commercial Proposal & Scope of Work - {{company}}',
      text: `Dear {{name}},\n\nThank you for sharing your project goals. Please find attached our detailed technical proposal and SLA commitment for {{company}}.\n\nWe look forward to answering any questions during our upcoming review.\n\nSincerely,\nSales Division`,
    },
    {
      name: 'Complaint Resolution & Root Cause',
      subject: 'Support Resolution & Root-Cause Summary - Ticket #{{ticket}}',
      text: `Dear {{name}},\n\nWe have completed our investigation regarding your recent report for {{company}}. All corrective actions have been applied and tested.\n\nPlease review the resolution summary and feel free to reopen the ticket if any issues persist.\n\nBest regards,\nTechnical Support`,
    },
    {
      name: 'Invoice Clearance Notice',
      subject: 'Pending Invoice Statement - {{company}}',
      text: `Dear Accounts Department,\n\nPlease note that pending commercial invoice for {{company}} is due for processing. Kindly update our finance team once remittance has been completed.\n\nThank you,\nFinance & Accounts`,
    },
  ];

  const handleApplyTemplate = (tmpl: any) => {
    setTemplateName(tmpl.name);
    if (tmpl.subject) setSubject(tmpl.subject.replace('{{company}}', selectedCustomer?.companyName || 'your company'));

    let filled = tmpl.text
      .replace(/{{name}}/g, selectedCustomer?.fullName || 'Customer')
      .replace(/{{company}}/g, selectedCustomer?.companyName || 'Company')
      .replace(/{{ticket}}/g, 'TICK-2026-101')
      .replace(/{{rep}}/g, currentUser?.displayName || 'Support Lead');

    setMessageText(filled);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || !messageText.trim()) return;

    await sendCommunication({
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.fullName,
      channel: activeChannel,
      type: 'outgoing',
      templateName,
      subject: activeChannel === 'email' ? subject || 'Important Business Notice' : undefined,
      message: messageText,
      sentById: currentUser?.uid || 'admin_user',
      sentByName: currentUser?.displayName || 'Support Team',
    });

    setIsSentToast(true);
    setTimeout(() => setIsSentToast(false), 2500);
  };

  const handleGenerateWithAi = async () => {
    if (!draftPrompt.trim()) return;
    setIsAiDrafting(true);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `Draft a highly professional business communication for:
Customer Name: ${selectedCustomer.fullName}
Company: ${selectedCustomer.companyName}
Industry: ${selectedCustomer.industry}
Channel: ${activeChannel}
User Request: ${draftPrompt}

Provide only the final ready-to-send text message body.`,
        }),
      });

      const data = await response.json();
      if (data.text) {
        setMessageText(data.text);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAiDrafting(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Communications Center
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dispatch WhatsApp updates, multi-template business emails, and AI-composed client messages.
          </p>
        </div>

        {/* Channel Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            onClick={() => setActiveChannel('whatsapp')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeChannel === 'whatsapp'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            WhatsApp Dispatch
          </button>
          <button
            onClick={() => setActiveChannel('email')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeChannel === 'email'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            Email Dispatch
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Message Composer */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              {activeChannel === 'whatsapp' ? (
                <MessageSquare className="w-4 h-4 text-emerald-600" />
              ) : (
                <Mail className="w-4 h-4 text-blue-600" />
              )}
              Compose {activeChannel === 'whatsapp' ? 'WhatsApp Message' : 'Direct Email'}
            </h3>

            {isSentToast && (
              <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-bold flex items-center gap-1 animate-in fade-in">
                <CheckCircle2 className="w-3.5 h-3.5" /> Sent & Logged!
              </span>
            )}
          </div>

          <form onSubmit={handleSend} className="space-y-4 text-xs">
            {/* Select Recipient */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target Customer / Account</label>
              <select
                value={selectedCustomerId}
                onChange={(e) => setSelectedCustomerId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
              >
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} — {c.companyName} ({activeChannel === 'whatsapp' ? c.whatsappNumber : c.email})
                  </option>
                ))}
              </select>
            </div>

            {/* If Email, show subject */}
            {activeChannel === 'email' && (
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Account update, quarterly review, proposal"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* Quick Template Selector Chips */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1.5">Apply Standard Business Template</label>
              <div className="flex flex-wrap gap-1.5">
                {(activeChannel === 'whatsapp' ? whatsappTemplates : emailTemplates).map((tmpl) => (
                  <button
                    key={tmpl.name}
                    type="button"
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-semibold transition-colors"
                  >
                    {tmpl.name}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Draft Box */}
            <div className="p-3.5 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-600 animate-pulse" />
                  Gemini AI Message Generator
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. Draft a warm follow up regarding the pending IoT telemetry contract..."
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs bg-white border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button
                  type="button"
                  onClick={handleGenerateWithAi}
                  disabled={isAiDrafting || !draftPrompt.trim()}
                  className="px-3 py-1.5 text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors shrink-0 disabled:opacity-50"
                >
                  {isAiDrafting ? 'Writing...' : 'Generate'}
                </button>
              </div>
            </div>

            {/* Message Body */}
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Message Content</label>
              <textarea
                rows={7}
                required
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-sans leading-relaxed text-xs"
              />
            </div>

            <div className="flex justify-between items-center pt-2">
              <span className="text-[11px] text-slate-400">
                Dispatched via backend proxy to preserve provider credentials.
              </span>

              <button
                type="submit"
                className={`px-5 py-2 font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 ${
                  activeChannel === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Send className="w-3.5 h-3.5" />
                Dispatch {activeChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
              </button>
            </div>
          </form>
        </div>

        {/* Right Col: Live Communication History */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Recent Message Logs
            </h3>
            <span className="text-xs text-slate-400 font-mono">{communications.length} records</span>
          </div>

          <div className="mt-3 space-y-3 overflow-y-auto max-h-[540px] pr-1">
            {communications.map((c) => (
              <div
                key={c.id}
                className="p-3 bg-slate-50 hover:bg-slate-100/70 rounded-xl border border-slate-200/80 text-xs space-y-1 transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                        c.channel === 'whatsapp' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                      }`}
                    >
                      {c.channel}
                    </span>
                    <span className="font-semibold text-slate-900 truncate max-w-[120px]">{c.customerName}</span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {new Date(c.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                {c.subject && <div className="font-bold text-[11px] text-slate-800">{c.subject}</div>}

                <p className="text-[11px] text-slate-600 line-clamp-2">{c.message}</p>

                <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                  <span>Sent by: {nameOf(c.sentById, c.sentByName)}</span>
                  <span className="text-emerald-600 font-medium">Delivered</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
