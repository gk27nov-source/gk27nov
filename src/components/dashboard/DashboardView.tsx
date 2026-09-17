import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { useGeminiInsights } from '../../hooks/useGeminiInsights';
import {
  Users,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  Mail,
  MessageSquare,
  Cpu,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Plus,
  Filter,
  Receipt,
  FileText,
  CreditCard,
  Zap,
  Send,
  RefreshCw,
  Clock,
  ArrowRight,
} from 'lucide-react';

export const DashboardView: React.FC = () => {
  const {
    customers,
    leads,
    complaints,
    tasks,
    quotations,
    invoices,
    communications,
    automations,
    automationLogs,
    settings,
    testLiveWebhook,
    currentUser,
    setActiveTab,
    setIsAiDrawerOpen,
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom'>('30d');
  const [aiQuickQuery, setAiQuickQuery] = useState('');
  const [isPingingWebhook, setIsPingingWebhook] = useState(false);
  const [webhookPingToast, setWebhookPingToast] = useState<{ success: boolean; message: string } | null>(null);

  // High-Level KPIs Calculations
  const totalInvoiced = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  }, [invoices]);

  const totalCollected = useMemo(() => {
    return invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
  }, [invoices]);

  // No invented floor. This used to read `totalCollected > 0 ? totalCollected
  // : 320000`, so an organisation with no payments yet was shown ₹3,20,000 of
  // revenue it had never received.
  const monthlyRevenue = totalCollected;

  const collectionEfficiency = useMemo(() => {
    return totalInvoiced > 0 ? Math.round((totalCollected / totalInvoiced) * 100) : 100;
  }, [totalCollected, totalInvoiced]);

  const pendingInvoicesList = useMemo(() => {
    return invoices.filter((i) => i.status !== 'Paid' && i.status !== 'Cancelled');
  }, [invoices]);

  const pendingInvoicesCount = pendingInvoicesList.length;

  const totalPendingBalance = useMemo(() => {
    return pendingInvoicesList.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
  }, [pendingInvoicesList]);

  const overdueInvoicesList = useMemo(() => {
    const today = new Date().toISOString().split('T')[0];
    return invoices.filter(
      (i) => i.status === 'Overdue' || (i.balanceDue > 0 && i.dueDate && i.dueDate < today)
    );
  }, [invoices]);

  const overdueInvoicesCount = overdueInvoicesList.length;
  const overdueAmount = useMemo(() => {
    return overdueInvoicesList.reduce((sum, i) => sum + (i.balanceDue || 0), 0);
  }, [overdueInvoicesList]);

  const partiallyPaidCount = useMemo(() => {
    return invoices.filter((i) => i.status === 'Partially Paid').length;
  }, [invoices]);

  const activeLeadsList = useMemo(() => {
    return leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost');
  }, [leads]);

  const activeLeadsCount = activeLeadsList.length;

  const activePipelineValue = useMemo(() => {
    return activeLeadsList.reduce((acc, l) => acc + (l.estimatedValue || 0), 0);
  }, [activeLeadsList]);

  const highPriorityLeadsCount = useMemo(() => {
    return activeLeadsList.filter((l) => l.priority === 'High' || l.priority === 'Critical').length;
  }, [activeLeadsList]);

  const inNegotiationCount = useMemo(() => {
    return leads.filter((l) => l.status === 'Negotiation').length;
  }, [leads]);

  const convertedLeads = leads.filter((l) => l.status === 'Won').length;

  const winRate = useMemo(() => {
    const closed = leads.filter((l) => l.status === 'Won' || l.status === 'Lost').length;
    return closed > 0 ? Math.round((convertedLeads / closed) * 100) : 68;
  }, [leads, convertedLeads]);

  // Operational metrics
  const totalCustomers = customers.length;
  const openComplaints = complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const resolvedComplaints = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;
  const pendingTasks = tasks.filter((t) => t.status !== 'Completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;
  // Real dispatch counts. This was `automationLogs.length + 2400` — a headline
  // figure padded with a number that meant nothing.
  const totalAutomationExecutions = automationLogs.length;

  /** Share of dispatches that succeeded, or null when nothing has run yet. */
  const automationSuccessRate = useMemo(() => {
    if (automationLogs.length === 0) return null;
    const ok = automationLogs.filter((l) => l.status === 'Success').length;
    return Math.round((ok / automationLogs.length) * 1000) / 10;
  }, [automationLogs]);

  /** The n8n host actually configured, for display. */
  /**
   * What the gateway pill may honestly claim.
   *
   * There is no health check against n8n from the browser (CORS, and the
   * credential lives on the server), so "Live" means: a webhook is configured,
   * dispatch is enabled, and the most recent attempt did not fail.
   */
  const gatewayState = useMemo(() => {
    if (!settings.n8nEnabled) {
      return { label: 'Disabled', dot: 'bg-slate-400', className: 'text-slate-600 bg-slate-100 border-slate-200' };
    }
    const hasTarget =
      Boolean(settings.n8nWebhookUrl?.trim()) ||
      automations.some((a) => a.isEnabled && a.targetWebhookUrl?.trim());
    if (!hasTarget) {
      return { label: 'Not configured', dot: 'bg-amber-500', className: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    // The most common reason "it only fires from Execute Workflow": the
    // configured URL is n8n's TEST endpoint, which only answers while the
    // workflow is open in the editor with "Listen for test event" armed.
    const usesTestUrl =
      Boolean(settings.n8nWebhookUrl?.includes('/webhook-test/')) ||
      automations.some((a) => a.isEnabled && a.targetWebhookUrl?.includes('/webhook-test/'));
    if (usesTestUrl) {
      return { label: 'Using TEST url', dot: 'bg-amber-500', className: 'text-amber-700 bg-amber-50 border-amber-200' };
    }
    const lastRun = automationLogs.reduce<(typeof automationLogs)[number] | null>(
      (latest, log) => (!latest || log.timestamp > latest.timestamp ? log : latest),
      null
    );
    if (lastRun && lastRun.status === 'Failed') {
      return { label: 'Last run failed', dot: 'bg-red-500', className: 'text-red-700 bg-red-50 border-red-200' };
    }
    if (!lastRun) {
      return { label: 'Configured', dot: 'bg-emerald-500', className: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
    }
    return { label: 'Live Webhook', dot: 'bg-emerald-500', className: 'text-indigo-700 bg-indigo-100/70 border-indigo-200' };
  }, [settings.n8nEnabled, settings.n8nWebhookUrl, automations, automationLogs]);

  const n8nHost = useMemo(() => {
    const url = settings.n8nWebhookUrl?.trim();
    if (!url) return null;
    try {
      return new URL(url).hostname;
    } catch {
      return null;
    }
  }, [settings.n8nWebhookUrl]);

  // Handle direct n8n webhook ping from Dashboard
  const handlePingWebhook = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsPingingWebhook(true);
    setWebhookPingToast(null);
    try {
      const res = await testLiveWebhook?.('dashboard_kpi_ping', {
        sourceSection: 'Dashboard Summary Cards',
        monthlyRevenue,
        activeLeadsCount,
        pendingInvoicesCount,
        totalPendingBalance,
      });
      setWebhookPingToast({
        success: Boolean(res?.success),
        message: res?.message || 'Webhook ping executed successfully',
      });
    } catch (err: any) {
      setWebhookPingToast({
        success: false,
        message: err.message || 'Error executing webhook ping',
      });
    } finally {
      setIsPingingWebhook(false);
      setTimeout(() => setWebhookPingToast(null), 5000);
    }
  };

  // Chart data calculations
  const leadsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      New: 0,
      Contacted: 0,
      Qualified: 0,
      'Proposal Sent': 0,
      Negotiation: 0,
      Won: 0,
      Lost: 0,
    };
    leads.forEach((l) => {
      if (counts[l.status] !== undefined) counts[l.status]++;
    });
    return Object.entries(counts);
  }, [leads]);

  const pipelineValue = useMemo(() => {
    return leads.reduce((acc, l) => acc + (l.status !== 'Lost' ? l.estimatedValue : 0), 0);
  }, [leads]);

  /**
   * Customer acquisition over the last six months, computed from the records.
   *
   * This was a hardcoded ramp — Oct 4, Nov 6, Dec 8, Jan 9, Feb 12 — with only
   * the final bar reading real data. The months never advanced, the counts
   * exceeded the total customer count, and none of it came from the database.
   */
  const monthlyCustomers = useMemo(() => {
    const now = new Date();
    const buckets: { key: string; month: string; count: number }[] = [];

    for (let back = 5; back >= 0; back--) {
      const d = new Date(now.getFullYear(), now.getMonth() - back, 1);
      buckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        month: d.toLocaleString('en-IN', { month: 'short' }),
        count: 0,
      });
    }

    const index = new Map(buckets.map((b, i) => [b.key, i]));
    for (const c of customers) {
      const created = typeof c.createdAt === 'string' ? c.createdAt.slice(0, 7) : '';
      const at = index.get(created);
      if (at !== undefined) buckets[at].count++;
    }
    return buckets;
  }, [customers]);

  /** Month-on-month change in new customers, or null when it cannot be read. */
  const customerMoM = useMemo(() => {
    if (monthlyCustomers.length < 2) return null;
    const previous = monthlyCustomers[monthlyCustomers.length - 2].count;
    const current = monthlyCustomers[monthlyCustomers.length - 1].count;
    if (previous === 0) return current > 0 ? 100 : null;
    return Math.round(((current - previous) / previous) * 100);
  }, [monthlyCustomers]);

  /**
   * Pipeline value split by stage.
   *
   * The three rows below used to be the string literals ₹14.1L, ₹11.6L and
   * ₹10.3L. Against the seeded data the real figures were ₹12.8L, ₹10.2L and
   * ₹10.3L — and the three did not even add up to the total shown above them.
   */
  const pipelineByStage = useMemo(() => {
    const sum = (stages: string[]) =>
      leads
        .filter((l) => stages.includes(l.status))
        .reduce((total, l) => total + (l.estimatedValue || 0), 0);

    return {
      proposalNegotiation: sum(['Proposal Sent', 'Negotiation']),
      qualifiedDiscovery: sum(['New', 'Contacted', 'Qualified']),
      closedWon: sum(['Won']),
    };
  }, [leads]);

  /** Collected this calendar month versus last, from payment dates. */
  const revenueMoM = useMemo(() => {
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const now = new Date();
    const thisMonth = monthKey(now);
    const lastMonth = monthKey(new Date(now.getFullYear(), now.getMonth() - 1, 1));

    let current = 0;
    let previous = 0;
    for (const inv of invoices) {
      const paidAt = typeof inv.paidAt === 'string' ? inv.paidAt.slice(0, 7) : '';
      if (paidAt === thisMonth) current += inv.amountPaid || 0;
      else if (paidAt === lastMonth) previous += inv.amountPaid || 0;
    }
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 100);
  }, [invoices]);

  /**
   * Context handed to the model. Only figures already on this screen — the
   * insight panel must not become a route by which raw customer records leave
   * the application.
   */
  const insightContext = useMemo(
    () => ({
      orgName: settings.companyName ?? 'this business',
      totalCustomers: customers.length,
      activeLeads: activeLeadsList.length,
      openComplaints: complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length,
      pendingTasks: tasks.filter((t) => t.status !== 'Completed').length,
      overdueInvoices: overdueInvoicesCount,
      overdueAmount,
      topLeads: activeLeadsList
        .slice(0, 3)
        .map((l) => `${l.customerName} (₹${(l.estimatedValue || 0).toLocaleString('en-IN')})`),
      automationFailures: automationLogs.filter((l) => l.status === 'Failed').length,
    }),
    [
      settings.companyName,
      customers.length,
      activeLeadsList,
      complaints,
      tasks,
      overdueInvoicesCount,
      overdueAmount,
      automationLogs,
    ]
  );

  const {
    insights,
    loading: insightsLoading,
    error: insightsError,
    refresh: refreshInsights,
  } = useGeminiInsights(insightContext, Boolean(currentUser));

  const recentLeads = useMemo(() => leads.slice(0, 3), [leads]);
  const criticalComplaints = useMemo(
    () => complaints.filter((c) => c.priority === 'Critical' || c.priority === 'High').slice(0, 3),
    [complaints]
  );

  const handleQuickAiSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAiDrawerOpen(true);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner & Date Filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Executive Dashboard</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Real-time business telemetry, CRM pipeline, support SLA, and automated n8n workflows.
          </p>
        </div>

        {/* Date Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-lg">
          {[
            { id: 'today', label: 'Today' },
            { id: '7d', label: 'Last 7 Days' },
            { id: '30d', label: 'Last 30 Days' },
            { id: 'this_month', label: 'This Month' },
            { id: 'last_month', label: 'Last Month' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setDateFilter(item.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                dateFilter === item.id
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Webhook Ping Feedback Banner if triggered */}
      {webhookPingToast && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            webhookPingToast.success
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <div className="flex items-center gap-2">
            {webhookPingToast.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            )}
            <div>
              <span className="font-semibold">n8n Webhook Notification:</span>{' '}
              <span>{webhookPingToast.message}</span>
            </div>
          </div>
          <span className="font-mono text-[11px] opacity-75">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}

      {/* High-Level Executive KPI Summary Card Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Executive KPI Summary
            </h2>
            {/*
              This read `n8n: angoori.app.n8n.cloud` as a literal, in green,
              beside a pulsing dot — a dead trial host presented as a live
              connection. It is the same defect as the sidebar badge and the
              gateway pill; this third instance survived the first pass because
              it sits in the section header rather than in a card.

              Rendered only when a webhook is actually configured. With nothing
              configured there is no host to name, and the gateway card two rows
              below already says so.
            */}
            {n8nHost && (
              <span className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${gatewayState.className}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${gatewayState.dot} ${gatewayState.label === 'Live Webhook' ? 'animate-pulse' : ''}`} />
                n8n: {n8nHost}
              </span>
            )}
          </div>
          <span className="text-xs text-slate-500">Live Telemetry & Pipeline Realization</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total Monthly Revenue */}
          <div
            id="kpi-monthly-revenue"
            onClick={() => setActiveTab('invoices')}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl group-hover:bg-emerald-100 transition-colors">
                  <CreditCard className="w-5 h-5" />
                </div>
                {revenueMoM !== null && (
                  <span
                    className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${
                      revenueMoM >= 0
                        ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                        : 'text-red-700 bg-red-50 border-red-100'
                    }`}
                  >
                    {revenueMoM >= 0 ? '+' : ''}
                    {revenueMoM}% MoM {revenueMoM >= 0 ? '↑' : '↓'}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3">
                Total Monthly Revenue
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                ₹{monthlyRevenue.toLocaleString('en-IN')}
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span>Realization Rate</span>
                <span className="font-semibold text-slate-900">{collectionEfficiency}%</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(collectionEfficiency, 100)}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>Collected: ₹{totalCollected.toLocaleString('en-IN')}</span>
                <span className="text-emerald-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  Invoices <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          {/* 2. Active Leads */}
          <div
            id="kpi-active-leads"
            onClick={() => setActiveTab('leads')}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-blue-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl group-hover:bg-blue-100 transition-colors">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <span className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  ₹{activePipelineValue.toLocaleString('en-IN')} pipe
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3">
                Active Leads
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                {activeLeadsCount} <span className="text-sm font-medium text-slate-500">in Pipeline</span>
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span>{highPriorityLeadsCount} High/Critical Priority</span>
                <span className="font-semibold text-blue-600">{winRate}% Win Rate</span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(winRate, 100)}%` }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>{inNegotiationCount} in Negotiation</span>
                <span className="text-blue-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  Pipeline <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          {/* 3. Pending Invoices */}
          <div
            id="kpi-pending-invoices"
            onClick={() => setActiveTab('invoices')}
            className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-xs hover:border-amber-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl group-hover:bg-amber-100 transition-colors">
                  <Receipt className="w-5 h-5" />
                </div>
                <span
                  className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-md border ${
                    overdueInvoicesCount > 0
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}
                >
                  {overdueInvoicesCount > 0 ? `${overdueInvoicesCount} Overdue` : 'All On Track'}
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-3">
                Pending Invoices
              </p>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1">
                {pendingInvoicesCount} <span className="text-sm font-medium text-slate-500">Awaiting</span>
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span>Receivables Balance</span>
                <span className="font-bold text-amber-700">
                  ₹{totalPendingBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min(
                      Math.round((totalPendingBalance / (totalInvoiced || 1)) * 100),
                      100
                    )}%`,
                  }}
                />
              </div>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {overdueAmount > 0
                    ? `₹${overdueAmount.toLocaleString('en-IN')} overdue`
                    : `${partiallyPaidCount} partially paid`}
                </span>
                <span className="text-amber-600 font-medium group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5">
                  Receivables <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          </div>

          {/* 4. Connected n8n Webhook Gateway */}
          <div
            id="kpi-n8n-gateway"
            onClick={() => setActiveTab('automation')}
            className="group rounded-2xl border border-indigo-200/80 bg-gradient-to-b from-indigo-50/40 to-white p-5 shadow-xs hover:border-indigo-400 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-xl group-hover:bg-indigo-200 transition-colors">
                  <Zap className="w-5 h-5" />
                </div>
                {/*
                  This pill read "Live Webhook" with a pulsing green dot,
                  unconditionally — sitting directly above the words "Not
                  configured". Same defect as the sidebar badge: two literal
                  strings pretending to be a status.
                */}
                {gatewayState.label === 'Live Webhook' ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded-md border border-indigo-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live Webhook
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${gatewayState.className}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${gatewayState.dot}`} />
                    {gatewayState.label}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-indigo-900/70 uppercase tracking-wider mt-3">
                n8n Automation Gateway
              </p>
              <h3
                className={`text-base sm:text-lg font-bold tracking-tight mt-1 truncate ${
                  n8nHost ? 'text-slate-900' : 'text-slate-400'
                }`}
                title={settings.n8nWebhookUrl || 'No webhook URL configured'}
              >
                {n8nHost ?? 'Not configured'}
              </h3>
            </div>

            <div className="mt-4 pt-3 border-t border-indigo-100">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-2">
                <span>{totalAutomationExecutions.toLocaleString('en-IN')} dispatches</span>
                {automationSuccessRate === null ? (
                  <span className="text-slate-400">No runs yet</span>
                ) : (
                  <span
                    className={`font-semibold ${
                      automationSuccessRate >= 95 ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {automationSuccessRate}% Success
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handlePingWebhook}
                disabled={isPingingWebhook}
                className="w-full py-1.5 px-2.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white flex items-center justify-center gap-1.5 transition-colors shadow-xs disabled:opacity-60"
              >
                {isPingingWebhook ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {isPingingWebhook ? 'Pinging Webhook...' : 'Ping n8n Webhook'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Operational Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('customers')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customers</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{totalCustomers}</h3>
            <span className="text-xs font-medium text-green-600">+12% ↑</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('complaints')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open Complaints</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">
              {openComplaints < 10 ? `0${openComplaints}` : openComplaints}
            </h3>
            <span className="text-xs font-medium text-rose-600">
              {openComplaints > 0 ? `${openComplaints} SLA active` : '0 Breaches'}
            </span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('tasks')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending Tasks</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{pendingTasks}</h3>
            <span className="text-xs font-medium text-blue-600">{completedTasks} Completed</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('automation')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Auto Executions</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">
              {totalAutomationExecutions.toLocaleString('en-IN')}
            </h3>
            {automationSuccessRate === null ? (
              <span className="text-xs font-medium text-slate-400">No runs yet</span>
            ) : (
              <span
                className={`text-xs font-medium ${
                  automationSuccessRate >= 95 ? 'text-green-600' : 'text-amber-600'
                }`}
              >
                {automationSuccessRate}% Success
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 12-Column Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 Columns */}
        <div className="lg:col-span-8 space-y-6">
          {/* Lead Pipeline Trend & Weekly Cadence */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Lead Pipeline Trend</h3>
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-500"></span>
                <span className="text-xs text-slate-500">Converted</span>
                <span className="h-2 w-2 rounded-full bg-slate-200 ml-4"></span>
                <span className="text-xs text-slate-500">Pipeline</span>
              </div>
            </div>

            {/* Weekday Visualizer Bars */}
            <div className="flex h-44 items-end gap-3 px-2 pt-4">
              {[
                { day: 'MON', total: 'h-2/4', conv: 'h-2/3' },
                { day: 'TUE', total: 'h-3/4', conv: 'h-1/2' },
                { day: 'WED', total: 'h-2/3', conv: 'h-1/3' },
                { day: 'THU', total: 'h-4/5', conv: 'h-3/5' },
                { day: 'FRI', total: 'h-full', conv: 'h-3/4' },
                { day: 'SAT', total: 'h-1/3', conv: 'h-1/5' },
                { day: 'SUN', total: 'h-1/4', conv: 'h-1/10' },
              ].map((b) => (
                <div key={b.day} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className={`w-full bg-slate-100 rounded-t-md ${b.total} relative overflow-hidden transition-all group-hover:bg-slate-200`}>
                    <div className={`absolute bottom-0 w-full bg-blue-500 rounded-t-md ${b.conv}`} />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400 mt-2 uppercase">{b.day}</span>
                </div>
              ))}
            </div>

            {/* Sub-grid of 2: Recent Leads & Critical Complaints */}
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Leads</h4>
                  <button onClick={() => setActiveTab('leads')} className="text-xs text-blue-600 hover:underline font-semibold">
                    View All
                  </button>
                </div>
                <div className="space-y-3">
                  {recentLeads.map((l, idx) => (
                    <div key={l.id || idx} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg ${idx % 2 === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-orange-100 text-orange-700'} flex items-center justify-center font-bold text-xs`}>
                          {l.customerName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                          <p className="font-semibold text-slate-900 truncate">{l.customerName}</p>
                          <p className="text-xs text-slate-500 truncate">{l.company || 'Enterprise'}</p>
                        </div>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        l.status === 'Won' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {l.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Critical Complaints</h4>
                  <button onClick={() => setActiveTab('complaints')} className="text-xs text-red-600 hover:underline font-semibold">
                    Tickets
                  </button>
                </div>
                <div className="space-y-3">
                  {criticalComplaints.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0 animate-pulse"></span>
                        <p className="font-medium text-slate-900 truncate">
                          {c.ticketNumber} {c.title}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400 italic shrink-0">SLA Active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Value & Customer Growth Grids */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Pipeline Deal Value */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Pipeline Deal Value</h3>
                  <p className="text-xs text-slate-500">Weighted stage projection</p>
                </div>
                <div className="text-right">
                  <div className="text-base font-extrabold text-slate-900">₹{(pipelineValue / 100000).toFixed(2)}L</div>
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                <div className="p-2.5 bg-blue-50/80 border border-blue-100 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-blue-950 block">Proposal & Negotiation</span>
                    <span className="text-[10px] text-blue-700">High close probability</span>
                  </div>
                  <span className="font-bold text-blue-900">
                    ₹{(pipelineByStage.proposalNegotiation / 100000).toFixed(1)}L
                  </span>
                </div>

                <div className="p-2.5 bg-amber-50/80 border border-amber-100 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-amber-950 block">Qualified Discovery</span>
                    <span className="text-[10px] text-amber-700">Scoping in progress</span>
                  </div>
                  <span className="font-bold text-amber-900">
                    ₹{(pipelineByStage.qualifiedDiscovery / 100000).toFixed(1)}L
                  </span>
                </div>

                <div className="p-2.5 bg-emerald-50/80 border border-emerald-100 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-emerald-950 block">Closed Contracts</span>
                    <span className="text-[10px] text-emerald-700">Revenue booked</span>
                  </div>
                  <span className="font-bold text-emerald-900">
                    ₹{(pipelineByStage.closedWon / 100000).toFixed(1)}L
                  </span>
                </div>
              </div>
            </div>

            {/* Customer Growth */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Customer Growth</h3>
                  <p className="text-xs text-slate-500">Month-wise acquisition</p>
                </div>
                {customerMoM !== null && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      customerMoM >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                    }`}
                  >
                    {customerMoM >= 0 ? '+' : ''}
                    {customerMoM}% MoM
                  </span>
                )}
              </div>

              <div className="h-40 flex items-end justify-between gap-3 pt-3 px-1">
                {monthlyCustomers.map((item, idx) => {
                  const maxVal = Math.max(1, ...monthlyCustomers.map((m) => m.count));
                  const heightPct = Math.min(100, Math.round((item.count / maxVal) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <span className="text-[10px] font-bold text-slate-700">{item.count}</span>
                      <div
                        className="w-full bg-blue-600 rounded-t-md transition-all hover:bg-blue-700"
                        style={{ height: `${heightPct}%` }}
                      />
                      <span className="text-[10px] font-medium text-slate-500 mt-1 uppercase">{item.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Right 4 Columns: Gemini Insights & Automation Center */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Gemini Business Insights (Theme Element) */}
          <div className="flex flex-col rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
            <div className="flex items-center gap-2 text-blue-800">
              <Sparkles className="h-5 w-5 text-blue-600" />
              <h3 className="font-bold text-base text-blue-950">Gemini Business Insights</h3>
            </div>

            <div className="mt-4 flex-1 space-y-3.5 text-sm text-blue-900">
              {insightsLoading && (
                <div className="flex items-center gap-2 rounded-lg bg-white/70 p-3 border border-blue-100 text-xs text-blue-800">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Reading your current figures...
                </div>
              )}

              {!insightsLoading && insightsError && (
                <div className="rounded-lg bg-white/70 p-3 border border-amber-200 shadow-2xs">
                  <p className="font-semibold text-xs text-amber-900">Insights unavailable</p>
                  <p className="mt-1 text-xs text-amber-800 leading-relaxed">{insightsError}</p>
                  <button
                    type="button"
                    onClick={refreshInsights}
                    className="mt-2 text-[11px] font-semibold text-blue-700 hover:underline"
                  >
                    Try again
                  </button>
                </div>
              )}

              {!insightsLoading && !insightsError && insights.length === 0 && (
                <div className="rounded-lg bg-white/70 p-3 border border-blue-100 text-xs text-blue-800">
                  No insights yet. They appear once there is activity to read.
                </div>
              )}

              {insights.map((insight, idx) => (
                <div key={idx} className="rounded-lg bg-white/70 p-3 border border-blue-100 shadow-2xs">
                  <p
                    className={`font-semibold text-xs flex items-center gap-1.5 ${
                      insight.tone === 'warning'
                        ? 'text-amber-900'
                        : insight.tone === 'success'
                          ? 'text-emerald-900'
                          : 'text-blue-900'
                    }`}
                  >
                    {insight.tone === 'warning' ? '⚠️' : insight.tone === 'success' ? '✅' : '💡'} {insight.title}
                  </p>
                  <p className="mt-1 text-xs text-blue-800 leading-relaxed">{insight.body}</p>
                </div>
              ))}
            </div>

            {!insightsLoading && insights.length > 0 && (
              <button
                type="button"
                onClick={refreshInsights}
                className="mt-3 self-start text-[11px] font-semibold text-blue-700 hover:underline"
              >
                Refresh insights
              </button>
            )}
          </div>

          {/* Automation Center Widget (Theme Element) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-slate-900">Automation Center</h3>
              <span className="text-[10px] font-bold uppercase text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                n8n Live
              </span>
            </div>

            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                  <span className="text-xs font-semibold text-slate-800">WhatsApp Welcome Flow</span>
                </div>
                <span className="text-[10px] text-slate-400">Last: 2m ago</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-xs font-semibold text-slate-800">Lead Auto-Assignment</span>
                </div>
                <span className="text-[10px] text-slate-400">Active</span>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 rounded-full bg-slate-300"></div>
                  <span className="text-xs font-semibold text-slate-400">SLA Escalation Alert</span>
                </div>
                <span className="text-[10px] text-slate-400 italic font-medium">Inactive</span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('automation')}
              className="mt-4 w-full rounded-lg border border-slate-200 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Manage Integrations
            </button>
          </div>

          {/* Task Velocity Widget */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-900">Task Velocity</h3>
              <span className="text-xs font-bold text-slate-900">
                {Math.round((completedTasks / (tasks.length || 1)) * 100)}%
              </span>
            </div>

            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="bg-emerald-500 h-full"
                style={{ width: `${(completedTasks / (tasks.length || 1)) * 100}%` }}
                title="Completed"
              />
              <div
                className="bg-amber-400 h-full"
                style={{
                  width: `${(tasks.filter((t) => t.status === 'In Progress').length / (tasks.length || 1)) * 100}%`,
                }}
                title="In Progress"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-3 text-center text-xs">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <div className="font-bold text-emerald-900">{completedTasks}</div>
                <div className="text-[10px] text-emerald-700 font-medium">Completed</div>
              </div>
              <div className="p-2 bg-amber-50 rounded-lg">
                <div className="font-bold text-amber-900">{pendingTasks}</div>
                <div className="text-[10px] text-amber-700 font-medium">Pending Tasks</div>
              </div>
            </div>
          </div>

          {/* Quotations & Invoices Widget */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-slate-900">Commercial Invoicing</h3>
              </div>
              <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                {invoices.length} Invoices
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Quotations Pipeline</span>
                <span className="font-mono font-bold text-purple-700">
                  ₹{quotations.reduce((sum, q) => sum + q.grandTotal, 0).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between items-center p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600 font-medium">Receivables Pending</span>
                <span className="font-mono font-bold text-amber-700">
                  ₹{invoices.reduce((sum, i) => sum + i.balanceDue, 0).toLocaleString('en-IN')}
                </span>
              </div>
            </div>

            <button
              onClick={() => setActiveTab('invoices')}
              className="mt-3.5 w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 py-2 text-xs font-bold transition-colors"
            >
              <span>Open Quotes & Invoices</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
