import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Complaint, ComplaintPriority, ComplaintStatus, ComplaintType } from '../../types';
import {
  AlertCircle,
  Search,
  Filter,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  User,
  Phone,
  Mail,
  Building,
  Star,
  Edit2,
  Trash2,
  Check,
  X,
  Send,
  MessageSquare,
} from 'lucide-react';

const COMPLAINT_TYPES: ComplaintType[] = [
  'Delivery Delay',
  'Damaged Goods',
  'Billing Error',
  'Technical Issue',
  'Quality Problem',
  'Service Disruption',
  'Other',
];

const COMPLAINT_STATUSES: ComplaintStatus[] = [
  'New',
  'Assigned',
  'In Progress',
  'Waiting for Customer',
  'Resolved',
  'Closed',
];

export const ComplaintsView: React.FC = () => {
  const { complaints, addComplaint, updateComplaint, deleteComplaint, employees, currentUser, customers } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resolvingTicket, setResolvingTicket] = useState<Complaint | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState<number>(5);
  const [customerFeedbackText, setCustomerFeedbackText] = useState('');

  // Form State for new ticket
  const initialFormState = {
    ticketNumber: `TICK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
    customerId: customers[0]?.id || '',
    customerName: customers[0]?.fullName || '',
    mobileNumber: customers[0]?.mobileNumber || '',
    email: customers[0]?.email || '',
    complaintType: 'Technical Issue' as ComplaintType,
    description: '',
    priority: 'High' as ComplaintPriority,
    assignedEmployeeId: employees[0]?.uid || '',
    assignedEmployeeName: employees[0]?.displayName || '',
    status: 'New' as ComplaintStatus,
    slaHours: 24,
  };

  const [formData, setFormData] = useState(initialFormState);

  // SLA Calculation
  const isSlaBreached = (ticket: Complaint) => {
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') return false;
    const created = new Date(ticket.createdAt).getTime();
    const slaMs = ticket.slaHours * 3600 * 1000;
    return Date.now() - created > slaMs;
  };

  const getRemainingHours = (ticket: Complaint) => {
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') return 0;
    const created = new Date(ticket.createdAt).getTime();
    const slaMs = ticket.slaHours * 3600 * 1000;
    const remainingMs = slaMs - (Date.now() - created);
    return Math.max(0, Math.round(remainingMs / (3600 * 1000)));
  };

  const filteredComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const matchesSearch =
        c.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.complaintType.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = filterPriority === 'All' || c.priority === filterPriority;
      const matchesStatus = filterStatus === 'All' || c.status === filterStatus;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [complaints, searchQuery, filterPriority, filterStatus]);

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedCustomer = customers.find((c) => c.id === formData.customerId);
    const selectedEmployee = employees.find((emp) => emp.uid === formData.assignedEmployeeId);

    // Auto calculate SLA based on priority if needed
    let sla = formData.slaHours;
    if (formData.priority === 'Critical') sla = 8;
    else if (formData.priority === 'High') sla = 24;
    else if (formData.priority === 'Medium') sla = 48;
    else sla = 72;

    await addComplaint({
      ...formData,
      customerName: selectedCustomer ? selectedCustomer.fullName : formData.customerName,
      mobileNumber: selectedCustomer ? selectedCustomer.mobileNumber : formData.mobileNumber,
      email: selectedCustomer ? selectedCustomer.email : formData.email,
      assignedEmployeeName: selectedEmployee ? selectedEmployee.displayName : formData.assignedEmployeeName,
      slaHours: sla,
    });

    setIsAddModalOpen(false);
  };

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingTicket) return;

    await updateComplaint(resolvingTicket.id, {
      status: 'Resolved',
      resolutionDetails: resolutionText,
      rating: feedbackRating,
      customerFeedback: customerFeedbackText || 'Satisfied with the quick turnaround time.',
      resolvedDate: new Date().toISOString(),
    });

    setResolvingTicket(null);
    setResolutionText('');
    setCustomerFeedbackText('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Support Desk & SLA Tracker</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
              {complaints.filter((c) => c.status !== 'Resolved' && c.status !== 'Closed').length} Open
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Customer issue escalation, SLA countdowns, priority dispatch, and customer satisfaction logs.
          </p>
        </div>

        {currentUser?.role !== 'viewer' && (
          <button
            onClick={() => {
              setFormData({
                ...initialFormState,
                ticketNumber: `TICK-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`,
              });
              setIsAddModalOpen(true);
            }}
            className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Log New Ticket
          </button>
        )}
      </div>

      {/* SLA Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Critical Issues</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {complaints.filter((c) => c.priority === 'Critical' && c.status !== 'Resolved').length}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">8h SLA turnaround</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">SLA At Risk / Breached</div>
          <div className="text-2xl font-bold text-amber-600 mt-1">
            {complaints.filter((c) => isSlaBreached(c)).length}
          </div>
          <div className="text-[10px] text-amber-600 font-medium mt-0.5">Escalation triggered</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Avg Resolution Time</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">16.2 hrs</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-0.5">94% target achieved</div>
        </div>

        <div className="p-4 bg-white rounded-xl border border-slate-200">
          <div className="text-xs text-slate-500 font-medium">Average CSAT</div>
          <div className="text-2xl font-bold text-amber-500 mt-1">4.8 ★</div>
          <div className="text-[10px] text-slate-400 mt-0.5">Across resolved tickets</div>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search ticket #, customer, issue description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              {COMPLAINT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Support Tickets Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Ticket Number</th>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Issue Type & Description</th>
                <th className="py-3 px-4">Priority</th>
                <th className="py-3 px-4">SLA Clock</th>
                <th className="py-3 px-4">Assigned Rep</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredComplaints.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    No support tickets match your filter.
                  </td>
                </tr>
              ) : (
                filteredComplaints.map((ticket) => {
                  const breached = isSlaBreached(ticket);
                  const remaining = getRemainingHours(ticket);

                  return (
                    <tr key={ticket.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 font-mono">{ticket.ticketNumber}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(ticket.createdAt).toLocaleDateString()}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{ticket.customerName}</div>
                        <div className="text-[10px] text-slate-500">{ticket.mobileNumber}</div>
                      </td>

                      <td className="py-3 px-4 max-w-sm">
                        <div className="font-semibold text-slate-800">{ticket.complaintType}</div>
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-0.5">{ticket.description}</p>
                        {ticket.resolutionDetails && (
                          <div className="text-[10px] text-emerald-700 mt-1 font-medium bg-emerald-50 px-2 py-0.5 rounded">
                            Res: {ticket.resolutionDetails}
                          </div>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                            ticket.priority === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : ticket.priority === 'High'
                              ? 'bg-amber-100 text-amber-800'
                              : ticket.priority === 'Medium'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ticket.priority}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        {ticket.status === 'Resolved' || ticket.status === 'Closed' ? (
                          <span className="text-emerald-600 font-semibold text-[11px] flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                          </span>
                        ) : breached ? (
                          <span className="text-red-600 font-bold text-[11px] flex items-center gap-1 animate-pulse">
                            <AlertTriangle className="w-3.5 h-3.5" /> SLA Breached!
                          </span>
                        ) : (
                          <span className="text-slate-700 font-medium text-[11px] flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" /> {remaining}h remaining
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-slate-800 font-medium">
                        {ticket.assignedEmployeeName}
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            ticket.status === 'Resolved'
                              ? 'bg-emerald-50 text-emerald-700'
                              : ticket.status === 'In Progress'
                              ? 'bg-blue-50 text-blue-700'
                              : ticket.status === 'New'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {ticket.status}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {ticket.status !== 'Resolved' && ticket.status !== 'Closed' && (
                            <button
                              onClick={() => {
                                setResolvingTicket(ticket);
                                setResolutionText('');
                                setFeedbackRating(5);
                              }}
                              className="px-2.5 py-1 text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1 shadow-2xs"
                              title="Mark ticket as resolved"
                            >
                              <Check className="w-3 h-3" />
                              Resolve
                            </button>
                          )}

                          {currentUser?.role !== 'viewer' && (
                            <button
                              onClick={() => deleteComplaint(ticket.id)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete ticket"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
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

      {/* Log New Ticket Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-red-50/40">
              <h3 className="font-bold text-slate-900 text-base">Log New Customer Issue / Ticket</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ticket Number</label>
                  <input
                    type="text"
                    required
                    value={formData.ticketNumber}
                    onChange={(e) => setFormData({ ...formData, ticketNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Select Customer</label>
                  <select
                    value={formData.customerId}
                    onChange={(e) => {
                      const cust = customers.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        customerId: e.target.value,
                        customerName: cust?.fullName || '',
                        mobileNumber: cust?.mobileNumber || '',
                        email: cust?.email || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.companyName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Complaint Type</label>
                  <select
                    value={formData.complaintType}
                    onChange={(e) => setFormData({ ...formData, complaintType: e.target.value as ComplaintType })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {COMPLAINT_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority (Dictates SLA)</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as ComplaintPriority })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="Critical">Critical (8 Hours SLA)</option>
                    <option value="High">High (24 Hours SLA)</option>
                    <option value="Medium">Medium (48 Hours SLA)</option>
                    <option value="Low">Low (72 Hours SLA)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Support Staff</label>
                  <select
                    value={formData.assignedEmployeeId}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.uid === e.target.value);
                      setFormData({
                        ...formData,
                        assignedEmployeeId: e.target.value,
                        assignedEmployeeName: emp?.displayName || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Initial Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as ComplaintStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    <option value="New">New</option>
                    <option value="Assigned">Assigned</option>
                    <option value="In Progress">In Progress</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Description & Root Cause</label>
                <textarea
                  rows={4}
                  required
                  placeholder="Specific defect, invoice number, shipment tracking ID, or error message..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-xs"
                >
                  Create Support Ticket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ticket Resolution Modal */}
      {resolvingTicket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-emerald-50/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Resolve Ticket {resolvingTicket.ticketNumber}
                </h3>
              </div>
              <button onClick={() => setResolvingTicket(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="font-semibold text-slate-900">{resolvingTicket.customerName}</div>
                <div className="text-slate-500 mt-0.5">{resolvingTicket.description}</div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Resolution Summary & Corrective Action</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Sent replacement unit via express courier. Recalibrated telemetry sensors and verified with technician..."
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer CSAT Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFeedbackRating(star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`w-6 h-6 ${
                          star <= feedbackRating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-200'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 font-bold text-slate-700 text-sm">{feedbackRating} / 5 Stars</span>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Customer Feedback Note (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Excellent and rapid response from support team."
                  value={customerFeedbackText}
                  onChange={(e) => setCustomerFeedbackText(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setResolvingTicket(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  Confirm Resolution
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
