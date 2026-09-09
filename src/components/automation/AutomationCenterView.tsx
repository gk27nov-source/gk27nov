import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AutomationRule, AutomationLog } from '../../types';
import {
  Cpu,
  Zap,
  Play,
  CheckCircle2,
  AlertTriangle,
  Settings,
  RefreshCw,
  ExternalLink,
  Eye,
  Check,
  X,
  Send,
  AlertCircle,
  Activity,
  ArrowRight,
  Sparkles,
  Info,
  Copy,
  RotateCw,
} from 'lucide-react';
import { CONNECTED_N8N_WEBHOOK_URL } from '../../data/seedData';
import { N8N_WEBHOOK_PROD_URL, N8N_WEBHOOK_TEST_URL } from '../../config/appConfig';

export const AutomationCenterView: React.FC = () => {
  const {
    automations,
    toggleAutomationRule,
    updateAutomationRule,
    automationLogs,
    triggerAutomationRule,
    testLiveWebhook,
    retryAutomationLog,
    switchWebhookMode,
    runWebhookDiagnostics,
    settings,
    updateSettings,
  } = useApp();

  const [selectedLog, setSelectedLog] = useState<AutomationLog | null>(null);
  const [testingRuleId, setTestingRuleId] = useState<string | null>(null);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPinging, setIsPinging] = useState(false);
  const [isDiagnosing, setIsDiagnosing] = useState(false);
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [diagnosticResult, setDiagnosticResult] = useState<any | null>(null);
  const [pingResult, setPingResult] = useState<{
    success: boolean;
    message: string;
    diagnosticHint?: string;
    n8nHint?: string;
    statusCode?: number;
  } | null>(null);

  // STEP 6: Temporary Debug Info for Test Trigger
  const [testTriggerDebug, setTestTriggerDebug] = useState<{
    event: string;
    webhookUrl: string;
    httpStatus: number | string;
    response: string;
    error: string;
  } | null>(null);

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [ruleWebhookUrls, setRuleWebhookUrls] = useState<Record<string, string>>({});
  const [retryWebhookUrl, setRetryWebhookUrl] = useState<string>('');

  // Settings state for n8n Webhook configuration
  const currentTargetUrl = settings.n8nWebhookUrl || CONNECTED_N8N_WEBHOOK_URL;
  const isTestMode = currentTargetUrl.includes('/webhook-test/');

  const [n8nWebhookUrl, setN8nWebhookUrl] = useState(currentTargetUrl);
  const [n8nApiKey, setN8nApiKey] = useState(settings.n8nApiKey || '');
  const [n8nAuthType, setN8nAuthType] = useState<'none' | 'bearer' | 'header'>(
    settings.n8nAuthType || 'none'
  );
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Copy webhook URL to clipboard
  const handleCopyUrl = () => {
    navigator.clipboard.writeText(currentTargetUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  // Live Ping trigger
  const handleLivePing = async () => {
    setIsPinging(true);
    setPingResult(null);
    try {
      const res = await testLiveWebhook('dashboard_manual_ping', {
        triggeredFrom: 'AutomationCenterView',
        message: 'Live connection verification from Apex Business Hub',
      });
      setPingResult(res);
    } catch (e: any) {
      setPingResult({
        success: false,
        message: e.message || 'Ping failed',
        statusCode: 500,
      });
    } finally {
      setIsPinging(false);
    }
  };

  // Run full diagnosis on both Production and Test endpoints
  const handleRunDiagnostics = async () => {
    setIsDiagnosing(true);
    setDiagnosticResult(null);
    try {
      const result = await runWebhookDiagnostics();
      setDiagnosticResult(result);
    } catch (e: any) {
      setDiagnosticResult({
        success: false,
        error: e.message || 'Diagnostic failed to complete',
      });
    } finally {
      setIsDiagnosing(false);
    }
  };

  // Toggle between Production and Test Webhook URLs
  const handleToggleMode = async () => {
    setIsSwitchingMode(true);
    try {
      const targetMode = isTestMode ? 'production' : 'test';
      await switchWebhookMode(targetMode);
      setN8nWebhookUrl(
        targetMode === 'test'
          ? currentTargetUrl.replace('/webhook/', '/webhook-test/')
          : currentTargetUrl.replace('/webhook-test/', '/webhook/')
      );
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // Test live webhook trigger on a specific rule
  const handleTestTrigger = async (rule: AutomationRule) => {
    if (!rule.isEnabled) {
      setPingResult({
        success: false,
        message: `Rule "${rule.name}" is currently disabled. Toggle the switch to Enabled to allow webhook execution.`,
        diagnosticHint: 'The blue toggle switch on each automation card controls whether events dispatch webhooks.',
        statusCode: 403,
      });
      setTestTriggerDebug({
        event: rule.triggerEvent,
        webhookUrl: rule.targetWebhookUrl || currentTargetUrl,
        httpStatus: 403,
        response: 'None (Request Blocked: Rule Disabled)',
        error: `Rule "${rule.name}" is disabled. Toggle switch to Enabled.`,
      });
      return;
    }

    setTestingRuleId(rule.id);
    try {
      const log = await triggerAutomationRule(rule.id);
      const targetUrl = log.targetWebhookUrl || rule.targetWebhookUrl || currentTargetUrl;
      const respStr = log.responseMessage
        ? (typeof log.responseMessage === 'object' ? JSON.stringify(log.responseMessage, null, 2) : String(log.responseMessage))
        : (log.status === 'Success' ? 'HTTP 200 OK - Workflow triggered' : JSON.stringify(log.payload, null, 2));
      const errStr = log.errorMessage || (log.status === 'Success' ? 'None' : 'Failed to dispatch to n8n');

      setTestTriggerDebug({
        event: log.triggerEvent || rule.triggerEvent,
        webhookUrl: targetUrl,
        httpStatus: log.httpStatus || (log.status === 'Success' ? 200 : 500),
        response: respStr,
        error: errStr,
      });

      if (log.status === 'Failed' || log.status === 'Blocked') {
        setPingResult({
          success: false,
          message: log.errorMessage || `Rule "${rule.name}" failed to dispatch to n8n`,
          diagnosticHint: log.diagnosticHint,
          n8nHint: log.n8nHint,
          statusCode: log.httpStatus,
        });
      } else {
        setPingResult({
          success: true,
          message: `Rule "${rule.name}" dispatched successfully to n8n (HTTP ${log.httpStatus})`,
        });
      }
    } catch (e: any) {
      setTestTriggerDebug({
        event: rule.triggerEvent,
        webhookUrl: rule.targetWebhookUrl || currentTargetUrl,
        httpStatus: 500,
        response: 'None',
        error: e.message || 'Trigger failed',
      });
      setPingResult({
        success: false,
        message: e.message || 'Trigger failed',
      });
    } finally {
      setTimeout(() => setTestingRuleId(null), 500);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings({
      n8nWebhookUrl,
      n8nApiKey,
      n8nAuthType,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      setIsConfigOpen(false);
    }, 1200);
  };

  // Determine if the recent calls hit a 404 Inactive state
  const latestLog = automationLogs[0];
  const isWorkflowInactive =
    (latestLog &&
      latestLog.status === 'Failed' &&
      (latestLog.httpStatus === 404 ||
        latestLog.errorMessage?.includes('Inactive') ||
        latestLog.diagnosticHint?.includes('Inactive'))) ||
    (pingResult &&
      !pingResult.success &&
      (pingResult.statusCode === 404 || pingResult.message?.includes('404')));

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
            Real-time event dispatcher triggering your external n8n workflows for WhatsApp, email alerts, and task automations.
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
            {isPinging ? 'Pinging n8n...' : 'Test Webhook Now'}
          </button>

          <button
            onClick={handleRunDiagnostics}
            disabled={isDiagnosing}
            className="px-3.5 py-2 text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 disabled:opacity-50"
          >
            {isDiagnosing ? (
              <RotateCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Activity className="w-3.5 h-3.5 text-emerald-600" />
            )}
            {isDiagnosing ? 'Diagnosing...' : 'Diagnose Endpoint'}
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

      {/* Primary Webhook Health & Live Connection Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Configured n8n Endpoint
              </span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isTestMode
                    ? 'bg-amber-100 text-amber-800 border border-amber-200'
                    : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isTestMode ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                />
                {isTestMode ? 'Test Mode (/webhook-test/)' : 'Production Mode (/webhook/)'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono font-semibold text-slate-800 bg-slate-100 px-2.5 py-1.5 rounded-lg break-all">
                {currentTargetUrl}
              </code>
              <button
                onClick={handleCopyUrl}
                title="Copy webhook URL"
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors"
              >
                {copiedUrl ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              </button>
              <a
                href="https://deepika18.app.n8n.cloud"
                target="_blank"
                rel="noreferrer"
                title="Open n8n cloud canvas"
                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-colors flex items-center gap-1 text-xs font-semibold"
              >
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">Open n8n</span>
              </a>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleToggleMode}
              disabled={isSwitchingMode}
              className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-indigo-700 bg-slate-50 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors flex items-center gap-1.5"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isSwitchingMode ? 'animate-spin' : ''}`} />
              {isTestMode ? 'Switch to Production Webhook' : 'Switch to Test Webhook'}
            </button>
          </div>
        </div>

        {/* Step-by-Step Resolution Banner when workflow is Inactive in n8n */}
        {isWorkflowInactive && (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-amber-900">
                  Action Required in n8n: Workflow is currently INACTIVE (HTTP 404)
                </h4>
                <p className="text-xs text-amber-800">
                  n8n cloud returns <strong className="font-mono">404 "Workflow is not active"</strong> for production webhooks until the workflow switch is turned on in n8n.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-xs">
              <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                <span className="font-bold text-amber-900 block mb-0.5">1. Open n8n Canvas</span>
                <p className="text-slate-600">
                  Go to{' '}
                  <a
                    href="https://deepika18.app.n8n.cloud"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-600 underline font-medium"
                  >
                    deepika18.app.n8n.cloud
                  </a>{' '}
                  and open your workflow.
                </p>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                <span className="font-bold text-amber-900 block mb-0.5">2. Toggle Switch to Active</span>
                <p className="text-slate-600">
                  In the top-right header of your n8n workflow canvas, flip the switch from{' '}
                  <span className="font-bold text-red-600">Inactive</span> to{' '}
                  <span className="font-bold text-emerald-600">Active</span> and save.
                </p>
              </div>

              <div className="bg-white/80 p-3 rounded-lg border border-amber-200">
                <span className="font-bold text-amber-900 block mb-0.5">3. Verify Connection</span>
                <p className="text-slate-600">
                  Click <strong className="text-indigo-700">Test Webhook Now</strong> above to confirm n8n receives the live payload with HTTP 200 OK.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Ping Feedback Banner */}
        {pingResult && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              pingResult.success
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            <div className="flex items-start sm:items-center gap-2">
              {pingResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5 sm:mt-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5 sm:mt-0" />
              )}
              <div>
                <span className="font-semibold">{pingResult.message}</span>
                {pingResult.diagnosticHint && (
                  <p className="text-[11px] text-red-700 mt-0.5 font-medium">
                    {pingResult.diagnosticHint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 text-[11px]">
              {pingResult.statusCode && (
                <span className="font-mono bg-white/70 px-2 py-0.5 rounded border">
                  HTTP {pingResult.statusCode}
                </span>
              )}
              <span className="font-mono text-slate-500">
                {new Date().toLocaleTimeString()}
              </span>
            </div>
          </div>
        )}

        {/* Live Diagnostics Modal / Dropdown */}
        {diagnosticResult && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-slate-800">
                <Activity className="w-4 h-4 text-emerald-600" />
                Live n8n Diagnostic Scan Results
              </div>
              <button
                onClick={() => setDiagnosticResult(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Production Endpoint</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      (diagnosticResult.production?.statusCode || diagnosticResult.productionProbe?.statusCode) === 200
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    HTTP {diagnosticResult.production?.statusCode || diagnosticResult.productionProbe?.statusCode || 'Error'}
                  </span>
                </div>
                <code className="text-[10px] text-slate-500 block break-all font-mono">
                  {diagnosticResult.production?.url || diagnosticResult.productionUrl}
                </code>
                <p className="text-[11px] text-slate-600 pt-1">
                  Status: {diagnosticResult.production?.isActive ? 'Active (Ready)' : 'Inactive in n8n (HTTP 404)'}
                </p>
                {diagnosticResult.production?.hint && (
                  <p className="text-[10px] text-slate-500 italic pt-0.5">
                    {diagnosticResult.production.hint}
                  </p>
                )}
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-700 flex items-center justify-between">
                  <span>Test Endpoint</span>
                  <span
                    className={`font-mono text-[10px] font-bold px-1.5 py-0.5 rounded ${
                      (diagnosticResult.test?.statusCode || diagnosticResult.testProbe?.statusCode) === 200
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    HTTP {diagnosticResult.test?.statusCode || diagnosticResult.testProbe?.statusCode || 'Error'}
                  </span>
                </div>
                <code className="text-[10px] text-slate-500 block break-all font-mono">
                  {diagnosticResult.test?.url || diagnosticResult.testUrl}
                </code>
                <p className="text-[11px] text-slate-600 pt-1">
                  Status: {diagnosticResult.test?.isListening ? 'Listening on Canvas' : 'Not listening on canvas'}
                </p>
                {diagnosticResult.test?.hint && (
                  <p className="text-[10px] text-slate-500 italic pt-0.5">
                    {diagnosticResult.test.hint}
                  </p>
                )}
              </div>
            </div>

            {(diagnosticResult.recommendedAction || diagnosticResult.recommendation) && (
              <div className="p-3 bg-indigo-50/70 border border-indigo-100 rounded-lg text-indigo-900 space-y-2">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Next Step Recommendation:</span>
                    <p className="text-[11px] mt-0.5">
                      {diagnosticResult.recommendedAction || diagnosticResult.recommendation}
                    </p>
                  </div>
                </div>

                {Array.isArray(diagnosticResult.solutionSteps) && (
                  <div className="pl-6 space-y-1 pt-1 border-t border-indigo-100/60">
                    {diagnosticResult.solutionSteps.map((step: string, idx: number) => (
                      <div key={idx} className="text-[11px] text-indigo-950 font-medium">
                        {step}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pre-configured Automations Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-600" />
            Configured Workflow Automations
          </h2>
          <span className="text-xs text-slate-500">
            Click "Test Trigger" on any card to simulate business events
          </span>
        </div>

        {/* STEP 6: Temporary Debug Info Display for Test Trigger */}
        {testTriggerDebug && (
          <div
            id="diagnostic-test-trigger-panel"
            className="mb-4 p-4 bg-slate-900 text-slate-100 rounded-2xl border-2 border-indigo-500 shadow-xl font-mono text-xs space-y-3"
          >
            <div className="flex items-center justify-between border-b border-slate-700 pb-2">
              <div className="flex items-center gap-2 font-bold text-indigo-400 text-xs">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>DIAGNOSTIC MODE — TEST TRIGGER DEBUG INFO</span>
              </div>
              <button
                onClick={() => setTestTriggerDebug(null)}
                className="text-slate-400 hover:text-white text-[11px] underline cursor-pointer"
              >
                Clear Debug Info
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Event:</span>
                <span className="text-emerald-400 font-bold text-sm">{testTriggerDebug.event}</span>
              </div>

              <div className="bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">HTTP status:</span>
                <span
                  className={`font-bold text-sm ${
                    testTriggerDebug.httpStatus === 200 || testTriggerDebug.httpStatus === '200'
                      ? 'text-emerald-400'
                      : 'text-rose-400'
                  }`}
                >
                  {testTriggerDebug.httpStatus}
                </span>
              </div>

              <div className="md:col-span-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Webhook URL:</span>
                <span className="text-cyan-300 break-all select-all font-mono text-xs">
                  {testTriggerDebug.webhookUrl}
                </span>
              </div>

              <div className="md:col-span-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Response:</span>
                <pre className="mt-1 p-2 bg-slate-950 text-amber-300 rounded text-[11px] font-mono overflow-x-auto max-h-36 whitespace-pre-wrap">
                  {testTriggerDebug.response}
                </pre>
              </div>

              <div className="md:col-span-2 bg-slate-800/80 p-2.5 rounded-lg border border-slate-700/60">
                <span className="text-slate-400 text-[10px] uppercase font-bold block mb-0.5">Error:</span>
                <span
                  className={
                    testTriggerDebug.error === 'None'
                      ? 'text-slate-400 font-sans text-xs'
                      : 'text-rose-400 font-bold font-sans text-xs'
                  }
                >
                  {testTriggerDebug.error}
                </span>
              </div>
            </div>

            {/* n8n Workflow Inactive / 404 Resolution Assistant */}
            {(testTriggerDebug.httpStatus === 404 ||
              testTriggerDebug.httpStatus === '404' ||
              testTriggerDebug.response.includes('not registered') ||
              testTriggerDebug.response.includes('workflow must be active') ||
              testTriggerDebug.error.includes('404')) && (
              <div className="p-3 bg-amber-950/70 border border-amber-500/60 rounded-xl space-y-2.5 mt-2 font-sans">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>Root Cause: n8n Workflow Inactive (HTTP 404)</span>
                  </div>
                  <a
                    href="https://deepika18.app.n8n.cloud"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-300 bg-indigo-900/60 hover:bg-indigo-800/80 px-2 py-0.5 rounded border border-indigo-700 transition-colors"
                  >
                    <span>Open n8n Editor</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                <div className="text-[11px] text-slate-200 space-y-1">
                  <p>
                    The n8n webhook returned <code className="text-rose-300 bg-black/40 px-1 py-0.5 rounded font-mono">404 Webhook not registered</code> because production webhook endpoints are disabled when a workflow is <strong>Inactive</strong>.
                  </p>
                  <p className="font-semibold text-amber-200">
                    Fix in 2 steps:
                  </p>
                  <ol className="list-decimal list-inside pl-1 text-[11px] text-slate-300 space-y-0.5">
                    <li>Open your workflow in <a href="https://deepika18.app.n8n.cloud" target="_blank" rel="noreferrer" className="text-indigo-300 underline font-medium">deepika18.app.n8n.cloud</a> and switch the toggle at top-right to <strong>Active</strong> (green).</li>
                    <li>If you created a new workflow or a new Webhook node, paste its Production Webhook URL below:</li>
                  </ol>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <input
                    type="url"
                    value={retryWebhookUrl || testTriggerDebug.webhookUrl}
                    onChange={(e) => setRetryWebhookUrl(e.target.value)}
                    placeholder="https://deepika18.app.n8n.cloud/webhook/..."
                    className="flex-1 px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs font-mono text-cyan-300 placeholder:text-slate-600 focus:outline-none focus:border-indigo-500"
                  />
                  <button
                    onClick={async () => {
                      const finalUrl = (retryWebhookUrl || testTriggerDebug.webhookUrl).trim();
                      if (!finalUrl) return;
                      await updateSettings({ n8nWebhookUrl: finalUrl });
                      const matchedRule = automations.find((r) => r.triggerEvent === testTriggerDebug.event) || automations[0];
                      if (matchedRule) {
                        await updateAutomationRule(matchedRule.id, { targetWebhookUrl: finalUrl });
                        handleTestTrigger({ ...matchedRule, targetWebhookUrl: finalUrl });
                      }
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Save & Retry Trigger</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {automations.map((rule) => {
            const ruleUrl = rule.targetWebhookUrl || currentTargetUrl;
            const isEditingThisRule = editingRuleId === rule.id;

            return (
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

                <div className="space-y-2.5 pt-3 border-t border-slate-100 text-xs">
                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">Trigger Event:</span>
                    <span className="font-mono text-[11px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold">
                      {rule.triggerEvent}
                    </span>
                  </div>

                  {/* Webhook Endpoint Display & Inline Editor */}
                  <div className="pt-1 text-slate-500">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-[11px] text-slate-600">Webhook Endpoint:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (isEditingThisRule) {
                            setEditingRuleId(null);
                          } else {
                            setEditingRuleId(rule.id);
                            if (!ruleWebhookUrls[rule.id]) {
                              setRuleWebhookUrls((prev) => ({
                                ...prev,
                                [rule.id]: ruleUrl,
                              }));
                            }
                          }
                        }}
                        className="text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer"
                      >
                        {isEditingThisRule ? 'Cancel' : 'Edit URL'}
                      </button>
                    </div>

                    {isEditingThisRule ? (
                      <div className="flex gap-1.5 mt-1">
                        <input
                          type="url"
                          value={ruleWebhookUrls[rule.id] ?? ruleUrl}
                          onChange={(e) =>
                            setRuleWebhookUrls((prev) => ({ ...prev, [rule.id]: e.target.value }))
                          }
                          className="flex-1 px-2 py-1 text-[11px] border border-slate-300 rounded font-mono text-slate-800 focus:outline-indigo-500"
                          placeholder="https://deepika18.app.n8n.cloud/webhook/..."
                        />
                        <button
                          type="button"
                          onClick={async () => {
                            const newUrl = ruleWebhookUrls[rule.id]?.trim();
                            if (newUrl) {
                              await updateAutomationRule(rule.id, { targetWebhookUrl: newUrl });
                            }
                            setEditingRuleId(null);
                          }}
                          className="px-2 py-1 text-[10px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded cursor-pointer"
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <span
                        className="text-[10px] font-mono text-slate-600 truncate block bg-slate-50 px-2 py-1 rounded border border-slate-200/70"
                        title={ruleUrl}
                      >
                        {ruleUrl}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-slate-500">
                    <span className="font-medium">Runs / Success:</span>
                    <span className="font-semibold text-slate-700">
                      {rule.executionCount ?? (rule.successCount + rule.failureCount)} runs ({rule.successCount} ok)
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[10px] text-slate-400">
                      Last run:{' '}
                      {new Date(rule.lastRun || rule.lastTriggeredAt || new Date().toISOString()).toLocaleTimeString(
                        [],
                        { hour: '2-digit', minute: '2-digit' }
                      )}
                    </span>

                    <button
                      onClick={() => handleTestTrigger(rule)}
                      disabled={testingRuleId === rule.id}
                      className="px-2.5 py-1 text-[11px] font-bold bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 text-slate-700 rounded-lg transition-colors flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
                    >
                      <Play className={`w-3 h-3 ${testingRuleId === rule.id ? 'animate-spin' : ''}`} />
                      <span>{testingRuleId === rule.id ? 'Firing...' : 'Test Trigger'}</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Webhook Execution Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-bold text-sm text-slate-900">Live n8n Webhook Dispatch Logs</h3>
            <p className="text-xs text-slate-500">
              Complete audit trail of dispatched payloads, latency, and responses from n8n
            </p>
          </div>
          <span className="text-xs text-slate-500 font-mono">Proxy: /api/webhooks/n8n/trigger</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Event Trigger</th>
                <th className="py-3 px-4">Workflow Rule</th>
                <th className="py-3 px-4">Dispatched At</th>
                <th className="py-3 px-4">Status & Code</th>
                <th className="py-3 px-4">Latency</th>
                <th className="py-3 px-4 text-right">Actions</th>
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
                automationLogs.map((log) => {
                  const isInactiveError =
                    log.httpStatus === 404 ||
                    log.errorMessage?.includes('Inactive') ||
                    log.diagnosticHint?.includes('Inactive');

                  return (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-indigo-700 font-semibold">
                        {log.triggerEvent}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {log.automationName || log.ruleName}
                      </td>
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(log.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                            log.status === 'Success'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : log.status === 'Blocked'
                              ? 'bg-slate-100 text-slate-700 border border-slate-300'
                              : isInactiveError
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {log.status === 'Success' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          ) : log.status === 'Blocked' ? (
                            <AlertCircle className="w-3 h-3 text-slate-500" />
                          ) : isInactiveError ? (
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                          ) : (
                            <AlertCircle className="w-3 h-3 text-red-600" />
                          )}
                          {log.status === 'Success'
                            ? 'Delivered (200)'
                            : log.status === 'Blocked'
                            ? 'Blocked (Disabled)'
                            : isInactiveError
                            ? 'n8n Inactive (404)'
                            : `Failed (${log.httpStatus || 500})`}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">
                        {log.durationMs || log.executionDurationMs || 0} ms
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {log.status === 'Failed' && (
                            <button
                              onClick={() => retryAutomationLog(log.id)}
                              title="Retry Webhook Dispatch"
                              className="px-2 py-1 text-[11px] font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-lg flex items-center gap-1"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedLog(log)}
                            className="px-2.5 py-1 text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            Inspect
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
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
                <h3 className="font-bold text-slate-900 text-sm">
                  Webhook Payload & Response Details
                </h3>
                <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                  Event: {selectedLog.triggerEvent} | Dispatched: {new Date(selectedLog.timestamp).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Endpoint Information */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Target Webhook URL
                </span>
                <code className="text-xs font-mono text-slate-800 block break-all">
                  {selectedLog.targetWebhookUrl || currentTargetUrl}
                </code>
                <div className="flex items-center gap-2 pt-1">
                  <span className="text-slate-500 font-medium">HTTP Code:</span>
                  <span
                    className={`font-mono font-bold px-1.5 py-0.5 rounded text-[11px] ${
                      selectedLog.status === 'Success'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {selectedLog.httpStatus || (selectedLog.status === 'Success' ? 200 : 500)}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-500 font-medium">Duration:</span>
                  <span className="font-mono text-slate-700">{selectedLog.durationMs || 0} ms</span>
                </div>
              </div>

              {/* Diagnostic Hint if failed */}
              {(selectedLog.diagnosticHint || selectedLog.errorMessage) && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1.5 text-amber-900">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Diagnostics & Recommended Fix:</span>
                  </div>
                  <p className="text-xs">
                    {selectedLog.diagnosticHint || selectedLog.errorMessage}
                  </p>
                  {selectedLog.n8nHint && (
                    <div className="p-2 bg-white/80 rounded border border-amber-200 text-[11px] text-slate-700">
                      <strong>n8n Steps:</strong> {selectedLog.n8nHint}
                    </div>
                  )}
                </div>
              )}

              {/* Highlighted Business Parameters */}
              <div className="p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-xl space-y-2">
                <div className="text-[11px] font-bold text-indigo-950 uppercase tracking-wider">
                  Key Extracted Parameters
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700">
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Contact / WhatsApp Phone
                    </span>
                    <span className="font-mono font-bold text-emerald-700">
                      {selectedLog.payload?.contactNumber ||
                        selectedLog.payload?.phone ||
                        selectedLog.payload?.whatsappNumber ||
                        'N/A'}
                    </span>
                  </div>
                  <div className="bg-white p-2 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Recipient Email
                    </span>
                    <span className="font-mono font-bold text-indigo-700">
                      {selectedLog.payload?.email ||
                        selectedLog.payload?.customerEmail ||
                        'N/A'}
                    </span>
                  </div>
                </div>
                {(selectedLog.payload?.bodyMessage ||
                  selectedLog.payload?.whatsappMessage) && (
                  <div className="bg-white p-2.5 rounded-lg border border-indigo-100">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">
                      Body Content
                    </span>
                    <p className="text-slate-800 text-xs whitespace-pre-line bg-slate-50 p-2 rounded border border-slate-200">
                      {selectedLog.payload?.bodyMessage || selectedLog.payload?.whatsappMessage}
                    </p>
                  </div>
                )}
              </div>

              {/* Dispatched Payload */}
              <div>
                <div className="font-bold text-slate-700 mb-1">Dispatched Payload (JSON)</div>
                <pre className="p-3 bg-slate-900 text-emerald-400 rounded-xl font-mono text-[11px] overflow-x-auto max-h-48">
                  {JSON.stringify(selectedLog.payload, null, 2)}
                </pre>
              </div>

              {/* Response Message */}
              {selectedLog.responseMessage && (
                <div>
                  <div className="font-bold text-slate-700 mb-1">Server Response</div>
                  <pre className="p-3 bg-slate-100 text-slate-800 rounded-xl font-mono text-[11px] overflow-x-auto max-h-36">
                    {selectedLog.responseMessage}
                  </pre>
                </div>
              )}

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
              <button
                onClick={() => setIsConfigOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
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
                  placeholder={N8N_WEBHOOK_PROD_URL}
                  value={n8nWebhookUrl}
                  onChange={(e) => setN8nWebhookUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <div className="flex items-center gap-2 mt-1.5">
                  <button
                    type="button"
                    onClick={() => setN8nWebhookUrl(N8N_WEBHOOK_PROD_URL)}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    Set Production URL
                  </button>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => setN8nWebhookUrl(N8N_WEBHOOK_TEST_URL)}
                    className="text-[11px] text-indigo-600 hover:underline font-semibold"
                  >
                    Set Test URL
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Authentication Type
                </label>
                <select
                  value={n8nAuthType}
                  onChange={(e) => setN8nAuthType(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="none">None (Standard n8n default)</option>
                  <option value="bearer">Header Auth / Bearer Token</option>
                  <option value="header">Custom X-API-Key</option>
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Most n8n Webhook nodes use Authentication: None by default.
                </p>
              </div>

              {n8nAuthType !== 'none' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    API Key / Secret Token
                  </label>
                  <input
                    type="password"
                    placeholder="Enter secret token"
                    value={n8nApiKey}
                    onChange={(e) => setN8nApiKey(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )}

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
