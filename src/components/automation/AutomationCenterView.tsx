import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AutomationRule, AutomationLog } from '../../types';
import {
  Cpu,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Settings,
  RefreshCw,
  ExternalLink,
  Code,
  Shield,
  Eye,
  Check,
  X,
  Plus,
  Send,
  AlertCircle,
} from 'lucide-react';

export const AutomationCenterView: React.FC = () => {
  const {
    automations,
    toggleAutomationRule,
    automationLogs,
    triggerAutomationRule,
    testLiveWebhook,
    settings,
    updateSettings,
    currentUser,
  } = useApp();

  const [selectedLog, setSelectedLog] = useState<AutomationLog | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ success: boolean; message: string } | null>(null);

  // Settings state for n8n Webhook configuration
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(
    settings.n8nWebhookUrl
  );
  // No placeholder secret. The API key used to default to a literal that
  // looked like a real credential; it is also no longer sent from the
  // browser at all — the server holds it in N8N_SECRET.
  const [n8nApiKey, setN8nApiKey] = useState(settings.n8nApiKey || '');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleLivePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await testLiveWebhook('dashboard_manual_ping', {
        triggeredFrom: 'AutomationCenterView',
        message: 'Live connection verification from Smart Business Hub',
      });
      setPingResult({ success: res.success, message: res.message });
    } catch (e: any) {
      setPingResult({ success: false, message: e.message || 'Ping failed' });
    } finally {
      setIsPinging(false);
      setTimeout(() => setPingResult(null), 6000);
    }
  };

  // Test live webhook trigger
  const handleTestTrigger = async (rule: AutomationRule) => {
    setTestingRuleId(rule.id);
    try {
      await triggerAutomationRule(rule.id);
    } catch (e) {
      console.error(e);
    } finally {
      setTimeout(() => setTestingRuleId(null), 600);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      n8nWebhookUrl,
      n8nApiKey,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsConfigOpen(false);
    }, 1200);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Automation Center & n8n Engine
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-indigo-100 text-indigo-800 rounded-full">
              {automations.filter((a) => a.isEnabled).length} Active Rules
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Trigger n8n workflows, auto-dispatch WhatsApp/Email notifications, and audit outgoing webhooks.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleLivePing}
            disabled={isPinging}
            className="px-3.5 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isPinging ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            {isPinging ? 'Pinging n8n...' : 'Test Connected Webhook'}
          </button>

          <button
            onClick={() => setIsConfigOpen(true)}
            className="px-3.5 py-2 text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            Webhook Config
          </button>
        </div>
      </div>

      {/* Ping Feedback Banner */}
      {pingResult && (
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between ${
            pingResult.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {pingResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <span>{pingResult.message}</span>
          </div>
          <span className="font-mono text-[11px] opacity-75">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* Pre-configured Automations Grid */}
      <div>
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-indigo-600" />
          Configured Workflow Automations
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((rule) => (
            <div
              key={rule.id}
              className={`p-5 bg-white rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                rule.isEnabled
                  ? 'border-slate-200 shadow-xs hover:border-indigo-300'
                  : 'border-slate-200/60 opacity-70 bg-slate-50/50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Cpu className="w-5 h-5" />
                  </div>

                  {/* Enable / Disable Toggle */}
                  <button
                    onClick={() => toggleAutomationRule(rule.id)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      rule.isEnabled ? 'bg-indigo-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        rule.isEnabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                <h3 className="font-bold text-sm text-slate-900 mt-3">{rule.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-2">{rule.description}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100 text-xs">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-medium">Trigger Event:</span>
                  <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    {rule.triggerEvent}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-500">
                  <span className="font-medium">Runs / Success:</span>
                  <span className="font-semibold text-slate-700">
                    {rule.executionCount ?? (rule.successCount + rule.failureCount)} runs ({rule.successCount} ok)
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-400">
                    Last run: {new Date(rule.lastRun || rule.lastTriggeredAt || new Date().toISOString()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>

                  <button
                    onClick={() => handleTestTrigger(rule)}
                    disabled={testingRuleId === rule.id}
                    className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                  >
                    <Play className={`w-3 h-3 ${testingRuleId === rule.id ? 'animate-spin' : ''}`} />
                    <span>{testingRuleId === rule.id ? 'Firing...' : 'Test Trigger'}</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Webhook Execution Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Live n8n Webhook Dispatch Logs</h3>
            <p className="text-xs text-slate-500">Audit trail of triggers, payloads, latency and HTTP responses</p>
          </div>
          <span className="text-xs text-slate-500 font-mono">Endpoint: /api/webhooks/n8n/trigger</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Event Trigger</th>
                <th className="py-3 px-4">Workflow Rule</th>
                <th className="py-3 px-4">Dispatched At</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Response Time</th>
                <th className="py-3 px-4 text-right">Payload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {automationLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No webhooks dispatched yet. Click "Test Trigger" on any rule above.
                  </td>
                </tr>
              ) : (
                automationLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4 font-mono text-indigo-700 font-medium">{log.triggerEvent}</td>
                    <td className="py-3 px-4 font-semibold text-slate-900">{log.automationName || log.ruleName}</td>
                    <td className="py-3 px-4 text-slate-500">
                      {new Date(log.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4">
                      {/*
                        Three outcomes, three colours. 'Suppressed' used to be
                        painted green as 'Success' — a duplicate that never left
                        the server, recorded as a delivered HTTP 200. Amber
                        because it is neither a delivery nor a fault.
                      */}
                      <span
                        title={log.status === 'Suppressed' ? log.errorMessage : undefined}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'Success'
                            ? 'bg-emerald-50 text-emerald-700'
                            : log.status === 'Suppressed'
                              ? 'bg-amber-50 text-amber-700'
                              : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {log.status === 'Success' ? (
                          <CheckCircle2 className="w-3 h-3" />
                        ) : log.status === 'Suppressed' ? (
                          <Clock className="w-3 h-3" />
                        ) : (
                          <AlertTriangle className="w-3 h-3" />
                        )}
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600">{log.durationMs || log.executionDurationMs || 0} ms</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelectedLog(log)}
                        className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 ml-auto"
                      >
                        <Eye className="w-3 h-3" />
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payload Inspection Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Webhook Payload & Response Details</h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">{selectedLog.triggerEvent}</p>
              </div>
              <button onClick={() => setSelectedLog(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              {/* Highlighted Automation Values */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider">
                  Automation & n8n Parameters
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Contact Number (WhatsApp)</span>
                    <span className="font-mono font-bold text-emerald-700">
                      {selectedLog.payload?.contactNumber || selectedLog.payload?.phone || selectedLog.payload?.whatsappNumber || 'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Recipient Email</span>
                    <span className="font-mono font-bold text-indigo-700">
                      {selectedLog.payload?.email || selectedLog.payload?.customerEmail || 'N/A'}
                    </span>
                  </div>
                </div>
                {(selectedLog.payload?.bodyMessage || selectedLog.payload?.whatsappMessage) && (
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Body Message (WhatsApp / Email Content)
                    </span>
                    <p className="text-slate-800 text-xs whitespace-pre-line bg-slate-50 p-2 rounded border border-slate-200">
                      {selectedLog.payload?.bodyMessage || selectedLog.payload?.whatsappMessage}
                    </p>
                  </div>
                )}
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1">Dispatched Payload (JSON)</div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>

              <div>
                <div className="font-bold text-slate-700 mb-1">Server Proxy Response</div>
                <pre className="p-3 bg-slate-100 text-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto">
                  {JSON.stringify(
                    {
                      status: selectedLog.status,
                      executionDurationMs: selectedLog.executionDurationMs,
                      response: selectedLog.response,
                      timestamp: selectedLog.timestamp,
                    },
                    null,
                    2
                  )}
                </pre>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  onClick={() => setSelectedLog(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg text-xs"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* n8n Webhook Configuration Modal */}
      {isConfigOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-indigo-50/40">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">Configure n8n Webhook Server</h3>
              </div>
              <button onClick={() => setIsConfigOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveConfig} className="p-6 space-y-4 text-xs">
              {saveSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl flex items-center gap-2 font-semibold">
                  <Check className="w-4 h-4 text-emerald-600" /> Settings updated successfully!
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Target n8n Webhook Endpoint URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://your-n8n-instance.com/webhook/business-hub"
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Backend proxies requests to this URL via POST with JSON payloads.
                </p>
                {n8nWebhookUrl?.includes('/webhook-test/') && (
                  <p className="mt-1.5 p-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-[11px] font-semibold">
                    This is an n8n TEST url — it only fires while the workflow is open in the n8n editor with
                    "Listen for test event" armed. That is exactly "only runs when I click Execute Workflow."
                    Use the workflow's Production URL (/webhook/, not /webhook-test/) and make sure the
                    workflow's Active toggle is on.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Webhook Authentication Secret / Bearer Token
                </label>
                <input
                  type="password"
                  placeholder="n8n_secret_token_123"
                  value={n8nApiKey}
                  onChange={(e) => setN8nApiKey(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Sent securely via the <code className="bg-slate-100 px-1 py-0.5 rounded">Authorization: Bearer</code> header from our backend.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsConfigOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-xs"
                >
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
