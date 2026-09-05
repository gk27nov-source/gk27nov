import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, Invoice } from '../../types';
import { formatCurrency } from './invoiceUtils';
import { QuotationModal } from './QuotationModal';
import { InvoiceModal } from './InvoiceModal';
import { ShareWithCustomerModal } from './ShareWithCustomerModal';
import { DocumentPrintViewModal } from './DocumentPrintViewModal';
import { RecordPaymentModal } from './RecordPaymentModal';
import {
  FileText,
  Calculator,
  Plus,
  Search,
  Share2,
  Printer,
  CreditCard,
  ArrowRightCircle,
  MoreVertical,
  CheckCircle2,
  Clock,
  AlertCircle,
  Building,
  Calendar,
  Edit2,
  Trash2,
  TrendingUp,
  Receipt,
  Wallet,
  ArrowUpRight,
} from 'lucide-react';

export const InvoicesQuotesView: React.FC = () => {
  const {
    quotations,
    invoices,
    currentOrg,
    convertQuotationToInvoice,
    deleteQuotation,
    deleteInvoice,
    recordInvoicePayment,
  } = useApp();

  // Active sub-tab
  const [activeSubTab, setActiveSubTab] = useState<'all' | 'quotations' | 'invoices'>('quotations');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modals state
  const [quotationModalOpen, setQuotationModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<Quotation | null>(null);

  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [prefillQuotationId, setPrefillQuotationId] = useState<string | undefined>();

  const [shareModalDoc, setShareModalDoc] = useState<{
    document: Quotation | Invoice;
    type: 'quotation' | 'invoice';
  } | null>(null);

  const [printModalDoc, setPrintModalDoc] = useState<{
    document: Quotation | Invoice;
    type: 'quotation' | 'invoice';
  } | null>(null);

  const [paymentModalInvoice, setPaymentModalInvoice] = useState<Invoice | null>(null);

  // Financial Metrics Calculation
  const metrics = useMemo(() => {
    const totalInvoiced = invoices.reduce((sum, inv) => sum + inv.grandTotal, 0);
    const totalPaid = invoices.reduce((sum, inv) => sum + (inv.amountPaid || 0), 0);
    const totalBalanceDue = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const overdueInvoices = invoices.filter((inv) => inv.status === 'Overdue' || (inv.balanceDue > 0 && new Date(inv.dueDate) < new Date()));

    const activePipelineValue = quotations
      .filter((q) => q.status === 'Sent' || q.status === 'Draft' || q.status === 'Accepted')
      .reduce((sum, q) => sum + q.grandTotal, 0);

    const convertedQuotesCount = quotations.filter((q) => q.status === 'Converted').length;

    return {
      totalInvoiced,
      totalPaid,
      totalBalanceDue,
      overdueCount: overdueInvoices.length,
      activePipelineValue,
      convertedQuotesCount,
      collectionRate: totalInvoiced > 0 ? Math.round((totalPaid / totalInvoiced) * 100) : 100,
    };
  }, [invoices, quotations]);

  // Filtered Quotations
  const filteredQuotations = useMemo(() => {
    return quotations.filter((q) => {
      const matchesSearch =
        q.quotationNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (q.companyName && q.companyName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [quotations, searchQuery, statusFilter]);

  // Filtered Invoices
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      const matchesSearch =
        inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inv.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (inv.companyName && inv.companyName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, searchQuery, statusFilter]);

  const handleConvertQuotation = async (quotationId: string) => {
    try {
      const inv = await convertQuotationToInvoice(quotationId);
      setActiveSubTab('invoices');
      setPrintModalDoc({ document: inv, type: 'invoice' });
    } catch (err: any) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <Receipt className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">Quotations & Invoicing</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Manage commercial estimates, GST invoices, customer sharing, and live payments
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 self-stretch sm:self-auto">
          <button
            onClick={() => {
              setEditingQuotation(null);
              setQuotationModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-all shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>New Quotation</span>
          </button>

          <button
            onClick={() => {
              setEditingInvoice(null);
              setPrefillQuotationId(undefined);
              setInvoiceModalOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Invoiced</span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-slate-900">
            {formatCurrency(metrics.totalInvoiced)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="font-semibold text-slate-700">{invoices.length}</span>
            <span>invoices issued</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Received</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-emerald-600">
            {formatCurrency(metrics.totalPaid)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="font-semibold text-emerald-700">{metrics.collectionRate}%</span>
            <span>collection rate</span>
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Receivables Due</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-amber-600">
            {formatCurrency(metrics.totalBalanceDue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            {metrics.overdueCount > 0 ? (
              <span className="text-red-600 font-semibold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" /> {metrics.overdueCount} overdue
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">All accounts on schedule</span>
            )}
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Quotation Pipeline</span>
            <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl font-black text-purple-700">
            {formatCurrency(metrics.activePipelineValue)}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-slate-500">
            <span className="font-semibold text-purple-700">{metrics.convertedQuotesCount}</span>
            <span>converted to invoice</span>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Navigation & Search Bar */}
        <div className="p-5 border-b border-slate-200 flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-50/50">
          {/* Sub-tabs */}
          <div className="flex items-center p-1 bg-slate-200/60 rounded-xl self-start">
            <button
              onClick={() => {
                setActiveSubTab('quotations');
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'quotations'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              <span>Quotations</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-purple-100 text-purple-800">
                {quotations.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('invoices');
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'invoices'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Tax Invoices</span>
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-100 text-blue-800">
                {invoices.length}
              </span>
            </button>

            <button
              onClick={() => {
                setActiveSubTab('all');
                setStatusFilter('ALL');
              }}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                activeSubTab === 'all'
                  ? 'bg-white text-slate-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>All Documents</span>
            </button>
          </div>

          {/* Search & Status Filters */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by doc #, customer..."
                className="w-full pl-9 pr-3.5 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none"
            >
              <option value="ALL">All Statuses</option>
              {activeSubTab === 'quotations' ? (
                <>
                  <option value="Draft">Draft</option>
                  <option value="Sent">Sent</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Converted">Converted</option>
                  <option value="Expired">Expired</option>
                </>
              ) : (
                <>
                  <option value="Sent">Sent</option>
                  <option value="Paid">Paid</option>
                  <option value="Partially Paid">Partially Paid</option>
                  <option value="Overdue">Overdue</option>
                  <option value="Draft">Draft</option>
                </>
              )}
            </select>
          </div>
        </div>

        {/* Content: Quotations Tab */}
        {(activeSubTab === 'quotations' || activeSubTab === 'all') && (
          <div className={activeSubTab === 'all' ? 'mb-8 border-b border-slate-200' : ''}>
            {activeSubTab === 'all' && (
              <div className="px-6 py-3 bg-purple-50/50 border-b border-purple-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-800 flex items-center gap-2">
                  <Calculator className="w-4 h-4" /> Commercial Quotations ({filteredQuotations.length})
                </span>
                <button
                  onClick={() => {
                    setEditingQuotation(null);
                    setQuotationModalOpen(true);
                  }}
                  className="text-xs font-semibold text-purple-700 hover:underline"
                >
                  + Add Quote
                </button>
              </div>
            )}

            {filteredQuotations.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <Calculator className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">No quotations found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Create a quotation to propose pricing and send proposals via WhatsApp or Email.
                </p>
                <button
                  onClick={() => {
                    setEditingQuotation(null);
                    setQuotationModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Quotation
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Quotation #</th>
                      <th className="py-3 px-4">Customer & Company</th>
                      <th className="py-3 px-4">Date & Validity</th>
                      <th className="py-3 px-4">Items</th>
                      <th className="py-3 px-4 text-right">Grand Total</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredQuotations.map((quote) => (
                      <tr key={quote.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">
                          {quote.quotationNumber}
                        </td>
                        <td className="py-3 px-4">
                          <p className="font-semibold text-slate-900">{quote.customerName}</p>
                          <p className="text-slate-500 text-[11px]">{quote.companyName}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            <span>{quote.date}</span>
                          </div>
                          <p className="text-[11px] text-slate-400">Valid: {quote.validUntil}</p>
                        </td>
                        <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                          <span className="font-medium text-slate-800">{quote.items.length} items:</span>{' '}
                          {quote.items.map((i) => i.description).join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                          {formatCurrency(quote.grandTotal, quote.currency)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                              quote.status === 'Accepted'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : quote.status === 'Converted'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : quote.status === 'Sent'
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : quote.status === 'Expired' || quote.status === 'Rejected'
                                ? 'bg-red-50 text-red-700 border border-red-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {quote.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Share button */}
                            <button
                              onClick={() => setShareModalDoc({ document: quote, type: 'quotation' })}
                              title="Share via WhatsApp or Email"
                              className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>

                            {/* Print / Preview button */}
                            <button
                              onClick={() => setPrintModalDoc({ document: quote, type: 'quotation' })}
                              title="Preview and Print PDF"
                              className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                              <Printer className="w-4 h-4" />
                            </button>

                            {/* Convert to Invoice button */}
                            {quote.status !== 'Converted' ? (
                              <button
                                onClick={() => handleConvertQuotation(quote.id)}
                                title="Convert to Tax Invoice"
                                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                                <span>To Invoice</span>
                              </button>
                            ) : (
                              <span className="text-[10px] text-slate-400 italic">
                                {quote.convertedInvoiceNumber || 'Invoiced'}
                              </span>
                            )}

                            {/* Edit */}
                            <button
                              onClick={() => {
                                setEditingQuotation(quote);
                                setQuotationModalOpen(true);
                              }}
                              title="Edit Quotation"
                              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete */}
                            <button
                              onClick={() => {
                                if (window.confirm(`Delete quotation ${quote.quotationNumber}?`)) {
                                  deleteQuotation(quote.id);
                                }
                              }}
                              title="Delete Quotation"
                              className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
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
            )}
          </div>
        )}

        {/* Content: Invoices Tab */}
        {(activeSubTab === 'invoices' || activeSubTab === 'all') && (
          <div>
            {activeSubTab === 'all' && (
              <div className="px-6 py-3 bg-blue-50/50 border-b border-blue-100 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-800 flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Tax Invoices ({filteredInvoices.length})
                </span>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setPrefillQuotationId(undefined);
                    setInvoiceModalOpen(true);
                  }}
                  className="text-xs font-semibold text-blue-700 hover:underline"
                >
                  + Add Invoice
                </button>
              </div>
            )}

            {filteredInvoices.length === 0 ? (
              <div className="p-12 text-center text-slate-500">
                <FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-semibold text-slate-700">No invoices found</p>
                <p className="text-xs text-slate-400 mt-1">
                  Issue GST tax invoices to bill clients and collect payments.
                </p>
                <button
                  onClick={() => {
                    setEditingInvoice(null);
                    setPrefillQuotationId(undefined);
                    setInvoiceModalOpen(true);
                  }}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  <Plus className="w-4 h-4" /> Create Invoice
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Invoice #</th>
                      <th className="py-3 px-4">Customer & Company</th>
                      <th className="py-3 px-4">Issue & Due Date</th>
                      <th className="py-3 px-4 text-right">Invoice Total</th>
                      <th className="py-3 px-4 text-right">Paid / Balance</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-normal">
                    {filteredInvoices.map((inv) => {
                      const isOverdue = inv.status === 'Overdue' || (inv.balanceDue > 0 && new Date(inv.dueDate) < new Date());
                      return (
                        <tr key={inv.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">
                            {inv.invoiceNumber}
                            {inv.quotationNumber && (
                              <p className="text-[10px] text-slate-400 font-normal">From {inv.quotationNumber}</p>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-semibold text-slate-900">{inv.customerName}</p>
                            <p className="text-slate-500 text-[11px]">{inv.companyName}</p>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-400" />
                              <span>Issued: {inv.issueDate}</span>
                            </div>
                            <p className={`text-[11px] font-medium ${isOverdue ? 'text-red-600 font-semibold' : 'text-slate-500'}`}>
                              Due: {inv.dueDate} {isOverdue && '⚠️'}
                            </p>
                          </td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 text-sm">
                            {formatCurrency(inv.grandTotal, inv.currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono">
                            <p className="text-emerald-600 font-semibold">
                              Paid: {formatCurrency(inv.amountPaid, inv.currency)}
                            </p>
                            {inv.balanceDue > 0 ? (
                              <p className="text-red-600 font-bold text-[11px]">
                                Due: {formatCurrency(inv.balanceDue, inv.currency)}
                              </p>
                            ) : (
                              <p className="text-slate-400 text-[10px]">Settled</p>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                                inv.status === 'Paid'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : inv.status === 'Partially Paid'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : inv.status === 'Overdue' || isOverdue
                                  ? 'bg-red-50 text-red-700 border border-red-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {inv.status === 'Paid' && <CheckCircle2 className="w-3 h-3" />}
                              {inv.status}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Share with Customer */}
                              <button
                                onClick={() => setShareModalDoc({ document: inv, type: 'invoice' })}
                                title="Share via WhatsApp or Email"
                                className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>

                              {/* Preview / Print PDF */}
                              <button
                                onClick={() => setPrintModalDoc({ document: inv, type: 'invoice' })}
                                title="Preview and Print PDF"
                                className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>

                              {/* Record Payment */}
                              {inv.balanceDue > 0 && (
                                <button
                                  onClick={() => setPaymentModalInvoice(inv)}
                                  title="Record Payment"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  <span>Pay</span>
                                </button>
                              )}

                              {/* Edit */}
                              <button
                                onClick={() => {
                                  setEditingInvoice(inv);
                                  setInvoiceModalOpen(true);
                                }}
                                title="Edit Invoice"
                                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete */}
                              <button
                                onClick={() => {
                                  if (window.confirm(`Delete invoice ${inv.invoiceNumber}?`)) {
                                    deleteInvoice(inv.id);
                                  }
                                }}
                                title="Delete Invoice"
                                className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quotation Create / Edit Modal */}
      {quotationModalOpen && (
        <QuotationModal
          quotation={editingQuotation}
          onClose={() => {
            setQuotationModalOpen(false);
            setEditingQuotation(null);
          }}
          onSaved={(saved) => {
            setPrintModalDoc({ document: saved, type: 'quotation' });
          }}
        />
      )}

      {/* Invoice Create / Edit Modal */}
      {invoiceModalOpen && (
        <InvoiceModal
          invoice={editingInvoice}
          initialQuotationId={prefillQuotationId}
          onClose={() => {
            setInvoiceModalOpen(false);
            setEditingInvoice(null);
            setPrefillQuotationId(undefined);
          }}
          onSaved={(saved) => {
            setPrintModalDoc({ document: saved, type: 'invoice' });
          }}
        />
      )}

      {/* Share Modal */}
      {shareModalDoc && (
        <ShareWithCustomerModal
          document={shareModalDoc.document}
          type={shareModalDoc.type}
          organization={currentOrg}
          onClose={() => setShareModalDoc(null)}
          onOpenPrintView={() => {
            const current = shareModalDoc;
            setShareModalDoc(null);
            setPrintModalDoc(current);
          }}
        />
      )}

      {/* Print View Modal */}
      {printModalDoc && (
        <DocumentPrintViewModal
          document={printModalDoc.document}
          type={printModalDoc.type}
          organization={currentOrg}
          onClose={() => setPrintModalDoc(null)}
          onOpenShareModal={() => {
            const current = printModalDoc;
            setPrintModalDoc(null);
            setShareModalDoc(current);
          }}
        />
      )}

      {/* Record Payment Modal */}
      {paymentModalInvoice && (
        <RecordPaymentModal
          invoice={paymentModalInvoice}
          onClose={() => setPaymentModalInvoice(null)}
          onRecord={async (amount, method, ref, notes) => {
            await recordInvoicePayment(paymentModalInvoice.id, amount, method, ref, notes);
            setPaymentModalInvoice(null);
          }}
        />
      )}
    </div>
  );
};
