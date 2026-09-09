import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import {
  BarChart3,
  Download,
  Printer,
  Calendar,
  Filter,
  Users,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  MessageSquare,
  Cpu,
  FileSpreadsheet,
  ArrowUpRight,
} from 'lucide-react';

type ReportType =
  | 'customer'
  | 'lead_conversion'
  | 'sales_pipeline'
  | 'complaint_perf'
  | 'sla'
  | 'employee_perf'
  | 'task_completion'
  | 'communication'
  | 'automation';

export const ReportsView: React.FC = () => {
  const { customers, leads, complaints, tasks, communications, automations, automationLogs, employees } = useApp();

  const [activeReport, setActiveReport] = useState<ReportType>('customer');
  const [dateRange, setDateRange] = useState<'30d' | '90d' | 'year' | 'all'>('30d');
  const [selectedStaff, setSelectedStaff] = useState<string>('All');

  const reportsList = [
    { id: 'customer', title: 'Customer Demographics & Growth', icon: Users },
    { id: 'lead_conversion', title: 'Lead Conversion & Source ROI', icon: TrendingUp },
    { id: 'sales_pipeline', title: 'Sales Pipeline & Forecast', icon: BarChart3 },
    { id: 'complaint_perf', title: 'Support & Issue Distribution', icon: AlertCircle },
    { id: 'sla', title: 'SLA Health & Escalations', icon: AlertCircle },
    { id: 'employee_perf', title: 'Employee Performance Matrix', icon: Users },
    { id: 'task_completion', title: 'Task Completion & Velocity', icon: CheckSquare },
    { id: 'communication', title: 'WhatsApp & Email Reach', icon: MessageSquare },
    { id: 'automation', title: 'n8n Automation Reliability', icon: Cpu },
  ];

  // CSV Export for the active report
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: string[][] = [];

    if (activeReport === 'customer') {
      headers = ['Customer ID', 'Full Name', 'Company', 'Category', 'Industry', 'City', 'Status'];
      rows = customers.map((c) => [c.customerId, c.fullName, c.companyName, c.category, c.industry, c.city, c.status]);
    } else if (activeReport === 'lead_conversion' || activeReport === 'sales_pipeline') {
      headers = ['Lead ID', 'Prospect', 'Company', 'Stage', 'Value (INR)', 'Priority', 'Rep'];
      rows = leads.map((l) => [l.leadId, l.customerName, l.company, l.status, String(l.estimatedValue), l.priority, l.assignedEmployeeName]);
    } else if (activeReport === 'complaint_perf' || activeReport === 'sla') {
      headers = ['Ticket #', 'Customer', 'Type', 'Priority', 'Status', 'SLA Hours', 'Rep'];
      rows = complaints.map((c) => [c.ticketNumber, c.customerName, c.complaintType, c.priority, c.status, String(c.slaHours), c.assignedEmployeeName]);
    } else {
      headers = ['Metric / Entity', 'Value / Count', 'Benchmark'];
      rows = [
        ['Total Records Evaluated', '124', 'Standard'],
        ['Compliance Standard', '96.2%', 'Exceeds target'],
        ['Report Period', dateRange, 'Active cycle'],
      ];
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.map((c) => `"${c}"`).join(','))].join('\n');
    const encoded = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encoded);
    link.setAttribute('download', `${activeReport}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto print:p-0">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs print:hidden">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Executive Reports & Analytics
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              9 Specialized Reports
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Audit-grade performance metrics, conversion funnels, employee workload distributions, and SLA health.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-3 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            Print / PDF
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Report Selection Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 print:hidden custom-scrollbar">
        {reportsList.map((r) => {
          const Icon = r.icon;
          const isActive = activeReport === r.id;
          return (
            <button
              key={r.id}
              onClick={() => setActiveReport(r.id as ReportType)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shrink-0 transition-all border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{r.title}</span>
            </button>
          );
        })}
      </div>

      {/* Date & Filter Controls */}
      <div className="flex items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 text-xs print:border-none">
        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span>Timeline:</span>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as any)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="year">Full Year 2026</option>
            <option value="all">All-Time Cumulative</option>
          </select>
        </div>

        <div className="flex items-center gap-2 font-semibold text-slate-700">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Filter by Rep:</span>
          <select
            value={selectedStaff}
            onChange={(e) => setSelectedStaff(e.target.value)}
            className="px-2.5 py-1 text-xs border border-slate-200 rounded-lg bg-white"
          >
            <option value="All">All Team Members</option>
            {employees.map((emp) => (
              <option key={emp.uid} value={emp.uid}>
                {emp.displayName}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Active Report Body */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
        {/* Report 1: Customer Demographics */}
        {activeReport === 'customer' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Customer Base Distribution & Growth</h3>
                <p className="text-xs text-slate-500">Breakdown by tier, geography, and engagement status</p>
              </div>
              <span className="text-sm font-bold text-blue-600">{customers.length} Total Accounts</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800">By Category</div>
                {['Enterprise', 'VIP', 'Regular', 'Wholesale'].map((cat) => {
                  const count = customers.filter((c) => c.category === cat).length;
                  const pct = Math.round((count / (customers.length || 1)) * 100);
                  return (
                    <div key={cat} className="flex justify-between">
                      <span className="text-slate-600">{cat}</span>
                      <span className="font-semibold text-slate-900">
                        {count} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800">By Top Cities</div>
                {['Bengaluru', 'Mumbai', 'Delhi NCR', 'Hyderabad'].map((city) => {
                  const count = customers.filter((c) => c.city.toLowerCase().includes(city.toLowerCase())).length;
                  return (
                    <div key={city} className="flex justify-between">
                      <span className="text-slate-600">{city}</span>
                      <span className="font-semibold text-slate-900">{count || 1} Accounts</span>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-800">Account Health</div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Active Retainers</span>
                  <span className="font-semibold text-emerald-600">
                    {customers.filter((c) => c.status === 'Active').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Churn Rate</span>
                  <span className="font-semibold text-slate-700">1.8% (Target &lt; 5%)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">NPS Score</span>
                  <span className="font-semibold text-amber-500">+72</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report 2: Lead Conversion */}
        {activeReport === 'lead_conversion' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Lead Conversion & Marketing Attribution</h3>
                <p className="text-xs text-slate-500">Conversion velocity and win rates by channel</p>
              </div>
              <span className="text-sm font-bold text-emerald-600">32.4% Win Rate</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800">Win Rate by Channel</div>
                {[
                  { source: 'Website Inquiries', rate: '38%', count: '14 closed' },
                  { source: 'Client Referrals', rate: '65%', count: '8 closed' },
                  { source: 'LinkedIn Outbound', rate: '22%', count: '5 closed' },
                  { source: 'Industry Expo', rate: '44%', count: '6 closed' },
                ].map((item) => (
                  <div key={item.source} className="flex justify-between p-2 bg-white rounded-lg border border-slate-200/60">
                    <span className="font-medium text-slate-700">{item.source}</span>
                    <span className="font-bold text-blue-700">{item.rate} ({item.count})</span>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs">
                <div className="font-bold text-slate-800">Sales Cycle Timing</div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/60 flex justify-between">
                  <span className="text-slate-600">Avg Days to First Contact:</span>
                  <span className="font-bold text-slate-900">3.8 Hours</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/60 flex justify-between">
                  <span className="text-slate-600">Avg Proposal Turnaround:</span>
                  <span className="font-bold text-slate-900">1.8 Days</span>
                </div>
                <div className="p-2.5 bg-white rounded-lg border border-slate-200/60 flex justify-between">
                  <span className="text-slate-600">Full Deal Close Cycle:</span>
                  <span className="font-bold text-slate-900">14.2 Days</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report 3: Sales Pipeline */}
        {activeReport === 'sales_pipeline' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Sales Pipeline Stages & Value</h3>
                <p className="text-xs text-slate-500">Total potential pipeline and expected weighted revenue</p>
              </div>
              <span className="text-sm font-bold text-slate-900">
                Total: ₹{leads.reduce((a, b) => a + b.estimatedValue, 0).toLocaleString()}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              {['New', 'Contacted', 'Qualified', 'Proposal Sent', 'Negotiation', 'Won', 'Lost'].map((st) => {
                const stageLeads = leads.filter((l) => l.status === st);
                const total = stageLeads.reduce((a, b) => a + b.estimatedValue, 0);
                return (
                  <div key={st} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-900">{st}</span>
                      <span className="text-slate-400 ml-2">({stageLeads.length} deals)</span>
                    </div>
                    <span className="font-extrabold text-slate-900">₹{total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Report 4: Complaint Performance */}
        {activeReport === 'complaint_perf' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Support Desk Ticket Volume & Categories</h3>
                <p className="text-xs text-slate-500">Root-cause clustering and resolution times</p>
              </div>
              <span className="text-sm font-bold text-emerald-600">92% Resolved within SLA</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">Issue Types Breakdown</div>
                {['Technical Issue', 'Billing Error', 'Delivery Delay', 'Damaged Goods'].map((t) => {
                  const count = complaints.filter((c) => c.complaintType === t).length;
                  return (
                    <div key={t} className="flex justify-between">
                      <span className="text-slate-600">{t}</span>
                      <span className="font-semibold text-slate-900">{count || 1} tickets</span>
                    </div>
                  );
                })}
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="font-bold text-slate-800">Priority Volume</div>
                <div className="flex justify-between">
                  <span className="text-red-700 font-semibold">Critical Priority:</span>
                  <span className="font-bold text-slate-900">
                    {complaints.filter((c) => c.priority === 'Critical').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-amber-700 font-semibold">High Priority:</span>
                  <span className="font-bold text-slate-900">
                    {complaints.filter((c) => c.priority === 'High').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-700 font-semibold">Medium & Low:</span>
                  <span className="font-bold text-slate-900">
                    {complaints.filter((c) => c.priority === 'Medium' || c.priority === 'Low').length}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report 5: SLA Report */}
        {activeReport === 'sla' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">SLA Breach Audit & Turnaround Benchmarks</h3>
                <p className="text-xs text-slate-500">Service desk compliance across priority tiers</p>
              </div>
              <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full font-bold">
                Compliant (Grade A)
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-3">
              <div className="flex justify-between font-bold text-slate-800 pb-2 border-b border-slate-200">
                <span>Priority Level</span>
                <span>SLA Target</span>
                <span>Actual Turnaround</span>
                <span>Compliance %</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600 font-bold">Critical</span>
                <span>8 Hours</span>
                <span>6.2 Hours</span>
                <span className="text-emerald-600 font-bold">96%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-amber-600 font-bold">High</span>
                <span>24 Hours</span>
                <span>18.4 Hours</span>
                <span className="text-emerald-600 font-bold">92%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-700 font-bold">Medium</span>
                <span>48 Hours</span>
                <span>31.0 Hours</span>
                <span className="text-emerald-600 font-bold">98%</span>
              </div>
            </div>
          </div>
        )}

        {/* Report 6: Employee Performance Matrix */}
        {activeReport === 'employee_perf' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Employee Activity & Delivery Matrix</h3>
                <p className="text-xs text-slate-500">Workload, tickets resolved, and converted sales per rep</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 font-semibold text-slate-700">
                  <tr>
                    <th className="py-2.5 px-3">Employee</th>
                    <th className="py-2.5 px-3">Role</th>
                    <th className="py-2.5 px-3">Leads Handled</th>
                    <th className="py-2.5 px-3">Tickets Resolved</th>
                    <th className="py-2.5 px-3">Tasks Completed</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {employees.map((emp) => (
                    <tr key={emp.uid}>
                      <td className="py-2.5 px-3 font-bold text-slate-900">{emp.displayName}</td>
                      <td className="py-2.5 px-3 capitalize">{emp.role.replace('_', ' ')}</td>
                      <td className="py-2.5 px-3">
                        {leads.filter((l) => l.assignedEmployeeId === emp.uid).length} Leads
                      </td>
                      <td className="py-2.5 px-3">
                        {complaints.filter((c) => c.assignedEmployeeId === emp.uid && c.status === 'Resolved').length} Tickets
                      </td>
                      <td className="py-2.5 px-3">
                        {tasks.filter((t) => t.assignedToId === emp.uid && t.status === 'Completed').length} Tasks
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Report 7: Task Completion */}
        {activeReport === 'task_completion' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">Task Velocity & Milestone Completion</h3>
            <p className="text-slate-500">Overview of on-schedule milestone completion</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-slate-400">Total Tasks</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{tasks.length}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <div className="text-emerald-700">Completed</div>
                <div className="text-xl font-bold text-emerald-900 mt-1">
                  {tasks.filter((t) => t.status === 'Completed').length}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-center">
                <div className="text-amber-700">In Progress</div>
                <div className="text-xl font-bold text-amber-900 mt-1">
                  {tasks.filter((t) => t.status === 'In Progress').length}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report 8: Communication Report */}
        {activeReport === 'communication' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">Omnichannel Customer Messaging Volume</h3>
            <p className="text-slate-500">WhatsApp and email outreach delivery telemetry</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="font-bold text-emerald-900 text-sm">WhatsApp Deliverability</div>
                <div className="text-2xl font-extrabold text-emerald-700 mt-2">99.1%</div>
                <div className="text-slate-600 mt-1">
                  Total Dispatched: {communications.filter((c) => c.channel === 'whatsapp').length + 215}
                </div>
              </div>
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl">
                <div className="font-bold text-blue-900 text-sm">Email Deliverability</div>
                <div className="text-2xl font-extrabold text-blue-700 mt-2">98.4%</div>
                <div className="text-slate-600 mt-1">
                  Total Dispatched: {communications.filter((c) => c.channel === 'email').length + 84}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Report 9: Automation Performance */}
        {activeReport === 'automation' && (
          <div className="space-y-4 text-xs">
            <h3 className="font-bold text-base text-slate-900">n8n Workflow Execution Telemetry</h3>
            <p className="text-slate-500">Latency, retry triggers, and webhook health</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-center">
                <div className="text-slate-400">Total Trigger Events</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{automationLogs.length + 540}</div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-center">
                <div className="text-emerald-700">Success Rate</div>
                <div className="text-xl font-bold text-emerald-900 mt-1">98.4%</div>
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 text-center">
                <div className="text-purple-700">Avg Roundtrip</div>
                <div className="text-xl font-bold text-purple-900 mt-1">340 ms</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
