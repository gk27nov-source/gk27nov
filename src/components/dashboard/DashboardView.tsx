import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
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
    setActiveTab,
    setIsAiDrawerOpen,
  } = useApp();

  const [dateFilter, setDateFilter] = useState<'today' | '7d' | '30d' | 'this_month' | 'last_month' | 'custom'>('30d');
  const [aiQuickQuery, setAiQuickQuery] = useState('');

  // Compute 12 metrics
  const totalCustomers = customers.length;
  const newLeads = leads.filter((l) => l.status === 'New').length;
  const activeLeads = leads.filter((l) => l.status !== 'Won' && l.status !== 'Lost').length;
  const convertedLeads = leads.filter((l) => l.status === 'Won').length;

  const openComplaints = complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length;
  const resolvedComplaints = complaints.filter((c) => c.status === 'Resolved' || c.status === 'Closed').length;

  const pendingTasks = tasks.filter((t) => t.status !== 'Completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'Completed').length;

  const emailsSent = communications.filter((c) => c.channel === 'email').length + 84;
  const whatsAppSent = communications.filter((c) => c.channel === 'whatsapp').length + 215;

  const totalAutomationExecutions = automationLogs.length + 2400;
  const failedAutomations = automationLogs.filter((l) => l.status === 'Failed').length + 6;

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

  const monthlyCustomers = [
    { month: 'Oct', count: 4 },
    { month: 'Nov', count: 6 },
    { month: 'Dec', count: 8 },
    { month: 'Jan', count: 9 },
    { month: 'Feb', count: 12 },
    { month: 'Mar', count: customers.length },
  ];

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

      {/* 4 Primary Highlight KPI Cards (Theme Pattern) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div
          onClick={() => setActiveTab('customers')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Customers</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{totalCustomers}</h3>
            <span className="text-xs font-medium text-green-600">+12% ↑</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('leads')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Active Leads</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{activeLeads}</h3>
            <span className="text-xs font-medium text-blue-600">
              {leads.filter((l) => l.priority === 'High' || l.priority === 'Critical').length || 14} High Priority
            </span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('complaints')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Open Complaints</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">
              {openComplaints < 10 ? `0${openComplaints}` : openComplaints}
            </h3>
            <span className="text-xs font-medium text-red-600">2 Overdue SLA</span>
          </div>
        </div>

        <div
          onClick={() => setActiveTab('automation')}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-blue-300 transition-all cursor-pointer"
        >
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Auto Executions</p>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl font-bold text-slate-900">{(totalAutomationExecutions / 1000).toFixed(1)}k</h3>
            <span className="text-xs font-medium text-green-600">99.8% Success</span>
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
                  <span className="font-bold text-blue-900">₹14.1L</span>
                </div>

                <div className="p-2.5 bg-amber-50/80 border border-amber-100 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-amber-950 block">Qualified Discovery</span>
                    <span className="text-[10px] text-amber-700">Scoping in progress</span>
                  </div>
                  <span className="font-bold text-amber-900">₹11.6L</span>
                </div>

                <div className="p-2.5 bg-emerald-50/80 border border-emerald-100 rounded-lg flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-emerald-950 block">Closed Contracts</span>
                    <span className="text-[10px] text-emerald-700">Revenue booked</span>
                  </div>
                  <span className="font-bold text-emerald-900">₹10.3L</span>
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
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700">
                  +18% MoM
                </span>
              </div>

              <div className="h-40 flex items-end justify-between gap-3 pt-3 px-1">
                {monthlyCustomers.map((item, idx) => {
                  const maxVal = 14;
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
              <div className="rounded-lg bg-white/70 p-3 border border-blue-100 shadow-2xs">
                <p className="font-semibold text-xs text-amber-900 flex items-center gap-1.5">
                  ⚠️ 3 High Priority Leads
                </p>
                <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                  Vertex Corp and Global Systems follow-ups are overdue by 24h. Estimated deal value at risk: ₹12.5k.
                </p>
              </div>

              <div className="rounded-lg bg-white/70 p-3 border border-blue-100 shadow-2xs">
                <p className="font-semibold text-xs text-blue-900 flex items-center gap-1.5">
                  💡 Automation Opportunity
                </p>
                <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                  You spent 4 hours this week manually sending status reminders. Activate the n8n WhatsApp flow.
                </p>
              </div>

              <div className="rounded-lg bg-white/70 p-3 border border-blue-100 shadow-2xs">
                <p className="font-semibold text-xs text-emerald-900 flex items-center gap-1.5">
                  ✅ Productivity Peak
                </p>
                <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                  Team resolved 15% more tickets than last month. SLA breach rate is reduced to 2.1%.
                </p>
              </div>
            </div>

            {/* Quick Ask Input */}
            <form onSubmit={handleQuickAiSubmit} className="mt-4 flex items-center gap-2 rounded-lg bg-white p-2 border border-blue-100 shadow-2xs">
              <input
                type="text"
                value={aiQuickQuery}
                onChange={(e) => setAiQuickQuery(e.target.value)}
                placeholder="Ask AI anything..."
                className="flex-1 bg-transparent text-xs text-slate-800 focus:outline-none px-1"
              />
              <button
                type="submit"
                className="rounded-md bg-blue-600 hover:bg-blue-700 p-1.5 text-white transition-colors"
                title="Send query to Gemini AI"
              >
                <ArrowUpRight className="h-4 w-4" />
              </button>
            </form>
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
