import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Search, User, Shield, Phone, Mail, AlertCircle, CheckSquare, TrendingUp, X } from 'lucide-react';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({ isOpen, onClose }) => {
  const { customers, leads, complaints, tasks, setActiveTab } = useApp();
  const [searchTerm, setSearchTerm] = useState('');

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return { customers: [], leads: [], complaints: [], tasks: [] };
    const term = searchTerm.toLowerCase();

    return {
      customers: customers.filter(
        (c) =>
          c.fullName.toLowerCase().includes(term) ||
          c.companyName.toLowerCase().includes(term) ||
          c.customerId.toLowerCase().includes(term) ||
          c.email.toLowerCase().includes(term) ||
          c.mobileNumber.includes(term)
      ).slice(0, 5),
      leads: leads.filter(
        (l) =>
          l.customerName.toLowerCase().includes(term) ||
          l.company.toLowerCase().includes(term) ||
          l.leadId.toLowerCase().includes(term) ||
          l.email.toLowerCase().includes(term) ||
          l.requirement.toLowerCase().includes(term)
      ).slice(0, 5),
      complaints: complaints.filter(
        (c) =>
          c.ticketNumber.toLowerCase().includes(term) ||
          c.customerName.toLowerCase().includes(term) ||
          c.description.toLowerCase().includes(term) ||
          c.complaintType.toLowerCase().includes(term)
      ).slice(0, 5),
      tasks: tasks.filter(
        (t) =>
          t.taskName.toLowerCase().includes(term) ||
          t.description.toLowerCase().includes(term) ||
          t.assignedToName.toLowerCase().includes(term)
      ).slice(0, 5),
    };
  }, [searchTerm, customers, leads, complaints, tasks]);

  if (!isOpen) return null;

  const totalResults =
    searchResults.customers.length +
    searchResults.leads.length +
    searchResults.complaints.length +
    searchResults.tasks.length;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        {/* Search Header */}
        <div className="flex items-center px-4 py-3 border-b border-slate-200 gap-3">
          <Search className="w-5 h-5 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search by customer, lead, ticket, task, email, mobile..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-full text-slate-800 placeholder-slate-400 bg-transparent text-base focus:outline-none"
          />
          {searchTerm && (
            <button onClick={() => setSearchTerm('')} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded hover:bg-slate-200"
          >
            ESC
          </button>
        </div>

        {/* Results Area */}
        <div className="max-h-96 overflow-y-auto p-4 space-y-4">
          {!searchTerm.trim() ? (
            <div className="text-center py-8 text-slate-400 text-sm">
              Type to search across Customers, Leads, Tickets, and Tasks...
            </div>
          ) : totalResults === 0 ? (
            <div className="text-center py-8 text-slate-500 text-sm">
              No matching records found for "{searchTerm}"
            </div>
          ) : (
            <>
              {/* Customers */}
              {searchResults.customers.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-blue-500" /> Customers ({searchResults.customers.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.customers.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setActiveTab('customers');
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-blue-50/70 border border-transparent hover:border-blue-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm text-slate-900">{c.fullName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-blue-600">{c.customerId}</span>
                            <span>•</span>
                            <span>{c.companyName}</span>
                            <span>•</span>
                            <span>{c.mobileNumber}</span>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-slate-100 text-slate-600">
                          {c.category}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leads */}
              {searchResults.leads.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-amber-500" /> Leads ({searchResults.leads.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.leads.map((l) => (
                      <div
                        key={l.id}
                        onClick={() => {
                          setActiveTab('leads');
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-amber-50/70 border border-transparent hover:border-amber-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm text-slate-900">{l.customerName} - {l.company}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-amber-600">{l.leadId}</span>
                            <span>•</span>
                            <span>Est: ₹{l.estimatedValue.toLocaleString()}</span>
                            <span>•</span>
                            <span>{l.requirement}</span>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800">
                          {l.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Complaints */}
              {searchResults.complaints.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 text-red-500" /> Support Tickets ({searchResults.complaints.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.complaints.map((comp) => (
                      <div
                        key={comp.id}
                        onClick={() => {
                          setActiveTab('complaints');
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-red-50/70 border border-transparent hover:border-red-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm text-slate-900">{comp.ticketNumber}: {comp.complaintType}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>{comp.customerName}</span>
                            <span>•</span>
                            <span className="truncate max-w-xs">{comp.description}</span>
                          </div>
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                            comp.priority === 'Critical'
                              ? 'bg-red-100 text-red-700'
                              : comp.priority === 'High'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {comp.priority}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Tasks */}
              {searchResults.tasks.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" /> Tasks ({searchResults.tasks.length})
                  </div>
                  <div className="space-y-1">
                    {searchResults.tasks.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => {
                          setActiveTab('tasks');
                          onClose();
                        }}
                        className="flex items-center justify-between p-2.5 rounded-lg hover:bg-emerald-50/70 border border-transparent hover:border-emerald-100 cursor-pointer transition-colors"
                      >
                        <div>
                          <div className="font-medium text-sm text-slate-900">{t.taskName}</div>
                          <div className="text-xs text-slate-500 flex items-center gap-2 mt-0.5">
                            <span>Assigned: {t.assignedToName}</span>
                            <span>•</span>
                            <span>Due: {t.dueDate}</span>
                          </div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-100 text-emerald-800">
                          {t.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex justify-between items-center">
          <span>Press ESC or click outside to dismiss</span>
          <span>Fast Global Lookup</span>
        </div>
      </div>
    </div>
  );
};
