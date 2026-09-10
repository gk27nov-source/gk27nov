import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  Settings,
  Building,
  Key,
  Database,
  Globe,
  Bell,
  CheckCircle2,
  Download,
  RotateCcw,
  Sparkles,
  Shield,
  Palette,
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const {
    currentOrg,
    settings,
    updateSettings,
    updateOrganization,
    customers,
    leads,
    complaints,
    tasks,
    communications,
    documents,
    resetSeedData,
  } = useApp();

  const [activeTab, setActiveTab] = useState<'profile' | 'integrations' | 'data'>('profile');

  // Business Profile form
  const [profileForm, setProfileForm] = useState({
    name: currentOrg.name,
    industry: currentOrg.industry,
    taxId: currentOrg.taxId || 'GSTIN-29AAACA1234F1Z5',
    supportEmail: currentOrg.supportEmail || 'support@apexsolutions.in',
    phone: currentOrg.phone || '+91 80 4123 9900',
    website: currentOrg.website || 'https://apexsolutions.in',
    currency: currentOrg.currency,
    timezone: currentOrg.timezone,
    address: 'Embassy Tech Village, Outer Ring Road, Bengaluru, Karnataka, 560103',
  });

  // Integrations form
  const [integrationForm, setIntegrationForm] = useState({
    n8nWebhookUrl: settings?.n8nWebhookUrl || currentOrg.n8nWebhookUrl,
    n8nApiKey: settings?.n8nApiKey || currentOrg.n8nApiKey || 'n8n_sec_89df201934ba',
    whatsappApiStatus: 'Connected (Meta Cloud API)',
    emailService: 'Verified (Google Workspace SMTP)',
    geminiModel: 'gemini-2.5-flash (Google GenAI)',
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateOrganization?.({
      name: profileForm.name,
      industry: profileForm.industry,
      taxId: profileForm.taxId,
      supportEmail: profileForm.supportEmail,
      phone: profileForm.phone,
      website: profileForm.website,
      currency: profileForm.currency,
      timezone: profileForm.timezone,
    });
    showToast('Business Profile successfully updated!');
  };

  const handleSaveIntegrations = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updateSettings) {
      await updateSettings({
        n8nWebhookUrl: integrationForm.n8nWebhookUrl,
        n8nApiKey: integrationForm.n8nApiKey,
      });
    }
    if (updateOrganization) {
      await updateOrganization({
        n8nWebhookUrl: integrationForm.n8nWebhookUrl,
        n8nApiKey: integrationForm.n8nApiKey,
      });
    }
    showToast('Connected n8n webhook and integration endpoints updated successfully!');
  };

  const handleExportFullBackup = () => {
    const backupData = {
      organization: currentOrg,
      exportTimestamp: new Date().toISOString(),
      schemaVersion: '1.0.0',
      data: {
        customers,
        leads,
        complaints,
        tasks,
        communications,
        documents,
      },
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute('href', dataStr);
    dlAnchor.setAttribute(
      'download',
      `SmartHub_Backup_${currentOrg.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    showToast('Complete Business Database JSON exported!');
  };

  const handleResetData = () => {
    if (window.confirm('Reset all demo records (customers, leads, complaints, tasks) to initial seed state?')) {
      resetSeedData();
      showToast('Database reset to fresh demo seed state.');
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-5xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Organization Settings & Integrations
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Company credentials, regional formatting, n8n webhook gateways, and data backups.
          </p>
        </div>

        {toastMessage && (
          <span className="px-3 py-1 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-full flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {toastMessage}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 text-xs font-semibold">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          Business Profile
        </button>

        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'integrations'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="w-4 h-4" />
          API & n8n Gateway
        </button>

        <button
          onClick={() => setActiveTab('data')}
          className={`px-4 py-2.5 border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === 'data'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          Data Backup & Reset
        </button>
      </div>

      {/* Tab 1: Business Profile */}
      {activeTab === 'profile' && (
        <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Company / Organization Name</label>
              <input
                type="text"
                required
                value={profileForm.name}
                onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Industry Vertical</label>
              <input
                type="text"
                required
                value={profileForm.industry}
                onChange={(e) => setProfileForm({ ...profileForm, industry: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">GSTIN / Tax ID Number</label>
              <input
                type="text"
                value={profileForm.taxId}
                onChange={(e) => setProfileForm({ ...profileForm, taxId: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Support Email</label>
              <input
                type="email"
                required
                value={profileForm.supportEmail}
                onChange={(e) => setProfileForm({ ...profileForm, supportEmail: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Support Hotline / Phone</label>
              <input
                type="text"
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Official Website URL</label>
              <input
                type="url"
                value={profileForm.website}
                onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Primary Display Currency</label>
              <select
                value={profileForm.currency}
                onChange={(e) => setProfileForm({ ...profileForm, currency: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="INR (₹)">INR (₹) - Indian Rupee</option>
                <option value="USD ($)">USD ($) - US Dollar</option>
                <option value="EUR (€)">EUR (€) - Euro</option>
                <option value="GBP (£)">GBP (£) - British Pound</option>
                <option value="AED (د.إ)">AED (د.إ) - UAE Dirham</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Operational Timezone</label>
              <select
                value={profileForm.timezone}
                onChange={(e) => setProfileForm({ ...profileForm, timezone: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Asia/Kolkata (IST +5:30)">Asia/Kolkata (IST +5:30)</option>
                <option value="Asia/Dubai (GST +4:00)">Asia/Dubai (GST +4:00)</option>
                <option value="Asia/Singapore (SGT +8:00)">Asia/Singapore (SGT +8:00)</option>
                <option value="America/New_York (EST -5:00)">America/New_York (EST -5:00)</option>
                <option value="Europe/London (GMT +0:00)">Europe/London (GMT +0:00)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Corporate Headquarters Address</label>
            <textarea
              rows={2}
              value={profileForm.address}
              onChange={(e) => setProfileForm({ ...profileForm, address: e.target.value })}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              type="submit"
              className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              Save Profile Changes
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Integrations & API */}
      {activeTab === 'integrations' && (
        <form onSubmit={handleSaveIntegrations} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-5 text-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900 mb-1">n8n Workflow Automation Gateway</h3>
            <p className="text-slate-500 text-xs">
              Direct connection URL for webhook dispatches when leads, tickets, and tasks change state.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Target n8n Webhook URL</label>
              <input
                type="url"
                placeholder="https://your-n8n-instance.com/webhook/business-hub"
                value={integrationForm.n8nWebhookUrl}
                onChange={(e) => setIntegrationForm({ ...integrationForm, n8nWebhookUrl: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                Leave blank to disconnect. The server falls back to N8N_WEBHOOK_URL when no URL is saved here.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">API Key / Authorization Secret</label>
              <input
                type="password"
                value={integrationForm.n8nApiKey}
                onChange={(e) => setIntegrationForm({ ...integrationForm, n8nApiKey: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Connected Services & Infrastructure</h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[11px]">AI Model Provider</div>
                <div className="font-bold text-slate-900 mt-0.5">{integrationForm.geminiModel}</div>
                <div className="text-emerald-600 font-semibold text-[10px] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Secure Server Proxy
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[11px]">WhatsApp Integration</div>
                <div className="font-bold text-slate-900 mt-0.5">{integrationForm.whatsappApiStatus}</div>
                <div className="text-emerald-600 font-semibold text-[10px] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Ready for Sending
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-slate-500 text-[11px]">Cloud Database & Storage</div>
                <div className="font-bold text-slate-900 mt-0.5">Cloud Firestore + Auth</div>
                <div className="text-emerald-600 font-semibold text-[10px] mt-1 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Multi-Tenant Partitioned
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100">
            <button
              type="submit"
              className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
            >
              Update Integrations
            </button>
          </div>
        </form>
      )}

      {/* Tab 3: Data Backup & Reset */}
      {activeTab === 'data' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6 text-xs">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Database Backup & Disaster Recovery</h3>
            <p className="text-slate-500 text-xs mt-0.5">
              Download your complete company database in structured JSON format anytime.
            </p>
          </div>

          <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl flex items-center justify-between">
            <div>
              <div className="font-bold text-blue-900 text-xs">Download Complete Workspace Archive</div>
              <div className="text-blue-700 text-[11px] mt-0.5">
                Includes {customers.length} Customers, {leads.length} Leads, {complaints.length} Tickets, and {tasks.length} Tasks.
              </div>
            </div>

            <button
              onClick={handleExportFullBackup}
              className="px-4 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download JSON
            </button>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-3">
            <h3 className="font-bold text-sm text-slate-900 text-red-600">Danger Zone: Demonstration Reset</h3>
            <p className="text-slate-500 text-xs">
              Re-initialize the hub state to fresh sample customer, lead, complaint, and automation data for demonstration purposes.
            </p>

            <button
              onClick={handleResetData}
              className="px-4 py-2 font-bold bg-white hover:bg-red-50 text-red-600 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset to Factory Demo Seed
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
