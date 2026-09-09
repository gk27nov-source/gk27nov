import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useApp } from '../../context/AppContext';
import { StockTransaction } from '../../types/inventory';
import {
  ArrowUpRight,
  Plus,
  Search,
  AlertCircle,
  FileText,
  User,
  Building2,
  Package,
  Wrench,
  Receipt,
  Download,
} from 'lucide-react';

interface StockOutViewProps {
  onOpenIssueModal?: () => void;
}

export const StockOutView: React.FC<StockOutViewProps> = ({
  onOpenIssueModal,
}) => {
  const { stockTransactions, products, stores, issueStockForComplaint, issueStockForInvoice } = useInventory();
  const { complaints, invoices } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<'all' | 'Sale' | 'Stock Issue'>('all');
  const [isQuickIssueOpen, setIsQuickIssueOpen] = useState(false);

  // Quick Issue Form State
  const [issueType, setIssueType] = useState<'complaint' | 'invoice' | 'internal'>('complaint');
  const [selectedComplaintId, setSelectedComplaintId] = useState(complaints[0]?.id || '');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState(invoices[0]?.id || '');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || '');
  const [selectedStoreId, setSelectedStoreId] = useState(stores[0]?.id || '');
  const [issueQuantity, setIssueQuantity] = useState(1);
  const [issueRemarks, setIssueRemarks] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter only outgoing transactions
  const outgoingTransactions = stockTransactions.filter((txn) => {
    const isOut = txn.direction === 'out';
    const matchesCategory = selectedCategory === 'all' || txn.type === selectedCategory;
    const matchesSearch =
      searchQuery === '' ||
      txn.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      txn.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (txn.referenceNumber && txn.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      txn.remarks.toLowerCase().includes(searchQuery.toLowerCase());

    return isOut && matchesCategory && matchesSearch;
  });

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const handleQuickIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) {
      setError('Product selection is required');
      return;
    }
    if (issueQuantity <= 0) {
      setError('Quantity must be greater than zero');
      return;
    }
    if (selectedProduct.availableStock < issueQuantity) {
      setError(`Cannot issue ${issueQuantity} ${selectedProduct.unit}. Available unreserved stock is only ${selectedProduct.availableStock} ${selectedProduct.unit}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (issueType === 'complaint') {
        await issueStockForComplaint(
          selectedComplaintId,
          selectedProductId,
          issueQuantity,
          issueRemarks || undefined,
          selectedStoreId
        );
      } else if (issueType === 'invoice') {
        await issueStockForInvoice(
          selectedInvoiceId,
          selectedProductId,
          issueQuantity,
          issueRemarks || undefined,
          selectedStoreId
        );
      }

      setIsQuickIssueOpen(false);
      setIssueRemarks('');
      setIssueQuantity(1);
    } catch (err: any) {
      setError(err.message || 'Failed to issue stock');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpRight className="h-5 w-5 text-rose-600" />
            Stock Out & Dispatch Management
          </h2>
          <p className="text-xs text-slate-500">
            Fulfill client sales orders, dispatches, warranty replacements, and complaint service spare parts
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsQuickIssueOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-rose-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Direct Stock Issue
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ticket, invoice #, SKU, customer or remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Outward Movements</option>
            <option value="Sale">Direct Sales Dispatches</option>
            <option value="Stock Issue">Service & Complaint Issues</option>
          </select>
        </div>
      </div>

      {/* Outgoing Issues Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Txn / Issue ID</th>
                <th className="py-3 px-3 font-semibold">Classification</th>
                <th className="py-3 px-3 font-semibold">Product & SKU</th>
                <th className="py-3 px-3 font-semibold text-center">Deducted Qty</th>
                <th className="py-3 px-3 font-semibold text-right">Value (INR)</th>
                <th className="py-3 px-3 font-semibold">Source Warehouse</th>
                <th className="py-3 px-3 font-semibold">Reference Document</th>
                <th className="py-3 px-3 font-semibold">Issued By</th>
                <th className="py-3 px-4 font-semibold">Date & Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {outgoingTransactions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-slate-500">
                    <ArrowUpRight className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No stock outward dispatches found.
                  </td>
                </tr>
              ) : (
                outgoingTransactions.map((txn) => (
                  <tr key={txn.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono font-semibold text-rose-700">
                      {txn.transactionNumber}
                    </td>

                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-800">
                        {txn.referenceType === 'complaint' ? (
                          <Wrench className="h-3 w-3" />
                        ) : (
                          <Receipt className="h-3 w-3" />
                        )}
                        {txn.type}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-900">{txn.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{txn.sku}</div>
                    </td>

                    <td className="py-3 px-3 text-center">
                      <span className="text-sm font-bold text-rose-700">
                        -{txn.quantity} {txn.unit}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-right font-medium text-slate-900">
                      ₹{txn.totalValue.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3 px-3 text-slate-700">
                      {txn.sourceStoreName || 'Central Warehouse'}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-mono font-medium text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                        {txn.referenceNumber || 'N/A'}
                      </span>
                    </td>

                    <td className="py-3 px-3 text-slate-600">{txn.userName}</td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900 max-w-[200px] truncate">{txn.remarks}</div>
                      <div className="text-[11px] text-slate-500">
                        {new Date(txn.timestamp).toLocaleDateString('en-IN')}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Stock Issue Modal */}
      {isQuickIssueOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-600 text-white shadow-xs">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Direct Stock Issue & Deduction
                  </h3>
                  <p className="text-xs text-slate-500">
                    Deduct stock and link to customer invoice or complaint ticket
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsQuickIssueOpen(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickIssue} className="p-6 space-y-4 text-xs">
              {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                  {error}
                </div>
              )}

              {/* Issue Type Selector */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Issue Destination</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIssueType('complaint')}
                    className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 ${
                      issueType === 'complaint'
                        ? 'border-rose-600 bg-rose-50 text-rose-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Wrench className="h-4 w-4 text-rose-600" />
                    <span>Service Complaint Spare</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIssueType('invoice')}
                    className={`p-2.5 rounded-xl border font-semibold flex items-center gap-2 ${
                      issueType === 'invoice'
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <Receipt className="h-4 w-4 text-blue-600" />
                    <span>Customer Invoice</span>
                  </button>
                </div>
              </div>

              {/* Linked Record */}
              {issueType === 'complaint' ? (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Complaint / Ticket *
                  </label>
                  <select
                    value={selectedComplaintId}
                    onChange={(e) => setSelectedComplaintId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-rose-500 focus:outline-hidden"
                  >
                    {complaints.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.ticketNumber} — {c.customerName} ({c.title})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Select Customer Invoice *
                  </label>
                  <select
                    value={selectedInvoiceId}
                    onChange={(e) => setSelectedInvoiceId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                  >
                    {invoices.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.invoiceNumber} — {inv.customerName} (₹{inv.totalAmount.toLocaleString('en-IN')})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Product */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Product / Item to Issue *
                </label>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.availableStock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source Warehouse & Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Source Warehouse *
                  </label>
                  <select
                    value={selectedStoreId}
                    onChange={(e) => setSelectedStoreId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantity ({selectedProduct?.unit || 'Units'}) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={selectedProduct?.availableStock || 100}
                    value={issueQuantity}
                    onChange={(e) => setIssueQuantity(Math.max(1, Number(e.target.value)))}
                    className="w-full rounded-lg border border-slate-300 p-2 font-bold focus:border-blue-500 focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Reason / Notes</label>
                <input
                  type="text"
                  value={issueRemarks}
                  onChange={(e) => setIssueRemarks(e.target.value)}
                  placeholder="e.g. Field engineer replacement during client maintenance visit"
                  className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-slate-600">
                Current Available Stock: <strong className="text-slate-900">{selectedProduct?.availableStock} {selectedProduct?.unit}</strong>
                <span className="mx-2">•</span>
                Projected Post-Issue: <strong className="text-rose-700">{(selectedProduct?.availableStock || 0) - issueQuantity} {selectedProduct?.unit}</strong>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsQuickIssueOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-rose-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-rose-700 disabled:opacity-50"
                >
                  Confirm Stock Issue
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
