import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Lead, LeadStatus, Priority } from '../../types';
import { makeNameResolver } from '../../utils/people';
import {
  TrendingUp,
  Search,
  Filter,
  Plus,
  Calendar,
  AlertCircle,
  Sparkles,
  ArrowRight,
  MoreVertical,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  DollarSign,
  User,
  Building,
  Phone,
  Mail,
  Clock,
  LayoutGrid,
  List,
  X,
  Copy,
  Check,
} from 'lucide-react';

const PIPELINE_STAGES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
];

export const LeadsView: React.FC = () => {
  const { leads, addLead, updateLead, deleteLead, employees, currentUser, customers } = useApp();

  // Names resolved from the uid rather than the copy stored on each record.
  const nameOf = React.useMemo(() => makeNameResolver(employees), [employees]);

  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterStage, setFilterStage] = useState<string>('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  // AI Follow-up draft modal
  const [aiDraftTargetLead, setAiDraftTargetLead] = useState<Lead | null>(null);
  const [aiDraftContent, setAiDraftContent] = useState<string>('');
  const [isGeneratingAiDraft, setIsGeneratingAiDraft] = useState<boolean>(false);
  const [isCopied, setIsCopied] = useState(false);

  // Form State
  const initialFormState = {
    leadId: `LEAD-${Math.floor(1000 + Math.random() * 9000)}`,
    customerName: '',
    mobile: '',
    mobileNumber: '',
    email: '',
    company: '',
    source: 'Website' as const,
    requirement: '',
    estimatedValue: 250000,
    status: 'New' as LeadStatus,
    assignedToId: employees[0]?.uid || '',
    assignedToName: employees[0]?.displayName || '',
    assignedEmployeeId: employees[0]?.uid || '',
    assignedEmployeeName: employees[0]?.displayName || '',
    priority: 'Medium' as Priority,
    nextFollowupDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    nextFollowUpDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 10),
    notes: '',
    remarks: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Check if date is overdue
  const isOverdue = (dateStr?: string) => {
    if (!dateStr) return false;
    return new Date(dateStr) < new Date() && new Date(dateStr).toDateString() !== new Date().toDateString();
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      const matchesSearch =
        l.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.leadId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.requirement.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesPriority = filterPriority === 'All' || l.priority === filterPriority;
      const matchesStage = filterStage === 'All' || l.status === filterStage;

      return matchesSearch && matchesPriority && matchesStage;
    });
  }, [leads, searchQuery, filterPriority, filterStage]);

  const openAddModal = () => {
    setFormData({
      ...initialFormState,
      leadId: `LEAD-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setEditingLead(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (l: Lead) => {
    setEditingLead(l);
    setFormData({
      leadId: l.leadId,
      customerName: l.customerName,
      mobile: l.mobile || l.mobileNumber || '',
      mobileNumber: l.mobileNumber || l.mobile || '',
      email: l.email,
      company: l.company,
      source: l.source as any,
      requirement: l.requirement,
      estimatedValue: l.estimatedValue,
      status: l.status,
      assignedToId: l.assignedToId || l.assignedEmployeeId || employees[0]?.uid || '',
      assignedToName: l.assignedToName || l.assignedEmployeeName || employees[0]?.displayName || '',
      assignedEmployeeId: l.assignedEmployeeId || l.assignedToId || employees[0]?.uid || '',
      assignedEmployeeName: l.assignedEmployeeName || l.assignedToName || employees[0]?.displayName || '',
      priority: l.priority,
      nextFollowupDate: l.nextFollowupDate || l.nextFollowUpDate || '',
      nextFollowUpDate: l.nextFollowUpDate || l.nextFollowupDate || '',
      notes: l.notes || l.remarks || '',
      remarks: l.remarks || l.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find(
      (e) => e.uid === (formData.assignedEmployeeId || formData.assignedToId)
    );
    const assignedName = emp
      ? emp.displayName
      : formData.assignedEmployeeName || formData.assignedToName || 'Staff Rep';
    const assignedId = emp
      ? emp.uid
      : formData.assignedEmployeeId || formData.assignedToId || 'emp_1';
    const mobileVal = formData.mobileNumber || formData.mobile || '+91 98000 00000';
    const followupVal =
      formData.nextFollowUpDate ||
      formData.nextFollowupDate ||
      new Date().toISOString().slice(0, 10);
    const notesVal = formData.notes || formData.remarks || '';

    const payload = {
      ...formData,
      mobile: mobileVal,
      mobileNumber: mobileVal,
      assignedToId: assignedId,
      assignedToName: assignedName,
      assignedEmployeeId: assignedId,
      assignedEmployeeName: assignedName,
      nextFollowupDate: followupVal,
      nextFollowUpDate: followupVal,
      notes: notesVal,
      remarks: notesVal,
    };

    if (editingLead) {
      await updateLead(editingLead.id, payload);
    } else {
      await addLead(payload);
    }
    setIsAddModalOpen(false);
  };

  const advanceStage = (lead: Lead, newStatus: LeadStatus) => {
    updateLead(lead.id, { status: newStatus });
  };

  // Generate AI Follow-up using Gemini API
  const handleGenerateAiFollowUp = async (lead: Lead) => {
    setAiDraftTargetLead(lead);
    setIsGeneratingAiDraft(true);
    setAiDraftContent('');
    setIsCopied(false);

    try {
      const response = await fetch('/api/gemini/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: `You are an expert enterprise sales executive. Draft a persuasive, polite, and personalized follow-up message for a prospect with the following details:
Prospect Name: ${lead.customerName}
Company: ${lead.company}
Pipeline Stage: ${lead.status}
Requirement: ${lead.requirement}
Estimated Value: ₹${lead.estimatedValue.toLocaleString()}
Priority: ${lead.priority}
Next Follow-up Due: ${lead.nextFollowUpDate}

Provide two variations:
1) A crisp, professional WhatsApp follow-up (within 80 words with emoji accents).
2) An executive email message with a compelling subject line and clear call-to-action.`,
        }),
      });

      const data = await response.json();
      if (data.text) {
        setAiDraftContent(data.text);
      } else {
        setAiDraftContent(
          `*WhatsApp Draft:*\nHi ${lead.customerName}, hope you are doing great! Following up on your requirement for ${lead.requirement}. We have prepared the proposal for ${lead.company}. When is a good time for a 10-minute quick walkthrough this week?\n\n*Email Subject:* Proposal & Next Steps for ${lead.requirement} - ${lead.company}\n\nDear ${lead.customerName},\n\nThank you for sharing your operational requirements with our team. We have analyzed your needs and would love to review the customized solution.\n\nBest regards,\nSmart Business Team`
        );
      }
    } catch (err) {
      setAiDraftContent(
        `*WhatsApp Draft:*\nHi ${lead.customerName}, following up regarding ${lead.requirement} for ${lead.company}. Let me know if you would like to review the commercial proposal tomorrow!\n\n*Email Draft:*\nSubject: Quick follow-up on ${lead.requirement}\n\nDear ${lead.customerName},\n\nReaching out to see if you had a chance to look over our solution overview. Looking forward to connecting soon.`
      );
    } finally {
      setIsGeneratingAiDraft(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(aiDraftContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Leads & Sales Pipeline</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full">
              {leads.length} Opportunities
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Visual deal flow, automated follow-up reminders, and AI-powered sales communications.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Table</span>
            </button>
          </div>

          {currentUser?.role !== 'viewer' && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Lead
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search leads, company, requirement, ID..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 bg-slate-50 focus:bg-white"
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
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Stage Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Stage:</span>
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Stages</option>
              {PIPELINE_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' ? (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1250px]">
            {PIPELINE_STAGES.map((stage) => {
              const stageLeads = filteredLeads.filter((l) => l.status === stage);
              const stageValue = stageLeads.reduce((acc, curr) => acc + curr.estimatedValue, 0);

              return (
                <div
                  key={stage}
                  className="w-72 shrink-0 bg-slate-100/70 rounded-2xl border border-slate-200/80 p-3 flex flex-col"
                >
                  {/* Stage Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-slate-800">{stage}</span>
                      <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
                        {stageLeads.length}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-slate-500">
                      ₹{(stageValue / 1000).toFixed(0)}k
                    </span>
                  </div>

                  {/* Stage Cards */}
                  <div className="space-y-2.5 flex-1 min-h-[450px]">
                    {stageLeads.length === 0 ? (
                      <div className="h-32 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                        No deals here
                      </div>
                    ) : (
                      stageLeads.map((lead) => {
                        const overdue = isOverdue(lead.nextFollowUpDate);

                        return (
                          <div
                            key={lead.id}
                            className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-2.5 group"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div>
                                <span className="text-[10px] font-mono text-amber-600 font-semibold">
                                  {lead.leadId}
                                </span>
                                <h4 className="font-bold text-xs text-slate-900 leading-tight">
                                  {lead.customerName}
                                </h4>
                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                  <Building className="w-3 h-3 text-slate-400" />
                                  <span className="truncate">{lead.company}</span>
                                </div>
                              </div>

                              <span
                                className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                  lead.priority === 'High'
                                    ? 'bg-red-100 text-red-700'
                                    : lead.priority === 'Medium'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                              >
                                {lead.priority}
                              </span>
                            </div>

                            {/* Requirement */}
                            <p className="text-[11px] text-slate-600 line-clamp-2 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                              {lead.requirement}
                            </p>

                            {/* Deal Value & Follow up date */}
                            <div className="flex items-center justify-between text-[11px] pt-1">
                              <span className="font-extrabold text-slate-900">
                                ₹{lead.estimatedValue.toLocaleString()}
                              </span>
                              <div
                                className={`flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                                  overdue
                                    ? 'bg-red-100 text-red-700 animate-pulse'
                                    : 'bg-slate-100 text-slate-600'
                                }`}
                                title={overdue ? 'Follow-up Overdue!' : 'Next Follow-up'}
                              >
                                <Clock className="w-3 h-3" />
                                <span>{lead.nextFollowUpDate}</span>
                              </div>
                            </div>

                            {/* Rep & Action Bar */}
                            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 truncate max-w-[100px]">
                                {nameOf(lead.assignedEmployeeId || lead.assignedToId, lead.assignedEmployeeName)}
                              </span>

                              <div className="flex items-center gap-1">
                                {/* AI Draft Button */}
                                <button
                                  onClick={() => handleGenerateAiFollowUp(lead)}
                                  className="p-1 text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                                  title="Draft AI Follow-up Message"
                                >
                                  <Sparkles className="w-3.5 h-3.5" />
                                </button>

                                {/* Move Stage Selector */}
                                <select
                                  value={lead.status}
                                  onChange={(e) => advanceStage(lead, e.target.value as LeadStatus)}
                                  className="text-[10px] bg-slate-100 border-none rounded py-0.5 px-1 font-semibold text-slate-700 cursor-pointer"
                                >
                                  {PIPELINE_STAGES.map((s) => (
                                    <option key={s} value={s}>
                                      → {s}
                                    </option>
                                  ))}
                                </select>

                                <button
                                  onClick={() => openEditModal(lead)}
                                  className="p-1 text-slate-400 hover:text-slate-700"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Lead ID & Prospect</th>
                  <th className="py-3 px-4">Company</th>
                  <th className="py-3 px-4">Requirement</th>
                  <th className="py-3 px-4">Deal Value</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Follow-up Due</th>
                  <th className="py-3 px-4">Rep</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{lead.customerName}</div>
                      <div className="text-[10px] text-amber-600 font-mono">{lead.leadId}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{lead.company}</td>
                    <td className="py-3 px-4 max-w-xs truncate">{lead.requirement}</td>
                    <td className="py-3 px-4 font-bold text-slate-900">₹{lead.estimatedValue.toLocaleString()}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-amber-100 text-amber-800">
                        {lead.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[11px] font-semibold ${
                          isOverdue(lead.nextFollowUpDate) ? 'text-red-600' : 'text-slate-600'
                        }`}
                      >
                        {lead.nextFollowUpDate}
                      </span>
                    </td>
                    <td className="py-3 px-4">{nameOf(lead.assignedEmployeeId || lead.assignedToId, lead.assignedEmployeeName)}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleGenerateAiFollowUp(lead)}
                          className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg"
                          title="Draft AI Follow-up"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => openEditModal(lead)}
                          className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteLead(lead.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Lead Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingLead ? 'Edit Sales Opportunity' : 'Create New Lead Opportunity'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lead ID</label>
                  <input
                    type="text"
                    required
                    value={formData.leadId}
                    onChange={(e) => setFormData({ ...formData, leadId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Prospect / Contact Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singhania"
                    value={formData.customerName}
                    onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Singhania Logistics Hub"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98200 12345"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Work Email</label>
                  <input
                    type="email"
                    required
                    placeholder="vikram@singhania.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Estimated Value (₹)</label>
                  <input
                    type="number"
                    required
                    min={0}
                    value={formData.estimatedValue}
                    onChange={(e) => setFormData({ ...formData, estimatedValue: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Pipeline Stage</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as LeadStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Priority })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                    <option value="Low">Low Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Next Follow-Up Date</label>
                  <input
                    type="date"
                    required
                    value={formData.nextFollowUpDate}
                    onChange={(e) => setFormData({ ...formData, nextFollowUpDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Sales Rep</label>
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
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Requirement / Inquiry Details</label>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Needs 50 cloud IoT gateways with 24x7 telemetry monitoring..."
                  value={formData.requirement}
                  onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Sales Notes</label>
                <textarea
                  rows={2}
                  placeholder="Decision maker preferences, competitor quotes, timeline..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  className="px-5 py-2 font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-lg shadow-xs"
                >
                  {editingLead ? 'Update Lead' : 'Save Opportunity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AI Follow-up Message Generator Modal */}
      {aiDraftTargetLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-purple-50/50">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-600 animate-pulse" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Gemini AI Sales Follow-Up Draft for {aiDraftTargetLead.customerName}
                </h3>
              </div>
              <button onClick={() => setAiDraftTargetLead(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600 flex justify-between">
                <div>
                  <strong>Company:</strong> {aiDraftTargetLead.company} | <strong>Deal:</strong> ₹
                  {aiDraftTargetLead.estimatedValue.toLocaleString()}
                </div>
                <div>
                  <strong>Stage:</strong> {aiDraftTargetLead.status}
                </div>
              </div>

              {isGeneratingAiDraft ? (
                <div className="p-12 text-center space-y-3">
                  <Sparkles className="w-8 h-8 text-purple-600 animate-spin mx-auto" />
                  <p className="font-semibold text-slate-700">Gemini is synthesizing personalized follow-up...</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Generated Message Variations:</span>
                    <button
                      onClick={copyToClipboard}
                      className="px-2.5 py-1 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg flex items-center gap-1 font-semibold transition-colors"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'Copied to Clipboard' : 'Copy Text'}
                    </button>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 whitespace-pre-wrap font-sans text-xs max-h-72 overflow-y-auto leading-relaxed">
                    {aiDraftContent}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setAiDraftTargetLead(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
