import React, { useState } from 'react';
import { Invoice } from '../../types';
import { formatCurrency } from './invoiceUtils';
import { X, Check, CreditCard, AlertCircle } from 'lucide-react';

interface RecordPaymentModalProps {
  invoice: Invoice;
  onClose: () => void;
  onRecord: (
    amount: number,
    method: Invoice['paymentMethod'],
    ref?: string,
    notes?: string
  ) => Promise<void>;
}

export const RecordPaymentModal: React.FC<RecordPaymentModalProps> = ({
  invoice,
  onClose,
  onRecord,
}) => {
  const [amount, setAmount] = useState<number>(invoice.balanceDue);
  const [method, setMethod] = useState<Invoice['paymentMethod']>('Bank Transfer / NEFT');
  const [reference, setReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setError('Payment amount must be greater than zero.');
      return;
    }
    if (amount > invoice.balanceDue) {
      setError(`Payment amount cannot exceed balance due (${formatCurrency(invoice.balanceDue, invoice.currency)}).`);
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await onRecord(amount, method, reference, notes);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to record payment');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/75">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Record Payment</h2>
              <p className="text-xs text-slate-500 font-mono">Invoice: {invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="p-5 bg-slate-50/50 border-b border-slate-100 space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">Customer</span>
            <span className="font-semibold text-slate-800">{invoice.customerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Invoice Grand Total</span>
            <span className="font-mono font-semibold text-slate-800">
              {formatCurrency(invoice.grandTotal, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Already Paid</span>
            <span className="font-mono font-semibold text-emerald-600">
              {formatCurrency(invoice.amountPaid, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between pt-1 border-t border-slate-200 text-sm font-bold">
            <span className="text-slate-900">Current Balance Due</span>
            <span className="font-mono text-red-600">
              {formatCurrency(invoice.balanceDue, invoice.currency)}
            </span>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="font-semibold text-slate-700">Payment Amount (₹) *</label>
              <button
                type="button"
                onClick={() => setAmount(invoice.balanceDue)}
                className="text-[11px] font-medium text-blue-600 hover:underline"
              >
                Pay Full Balance
              </button>
            </div>
            <input
              type="number"
              required
              min="1"
              max={invoice.balanceDue}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm font-bold text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Method *</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as Invoice['paymentMethod'])}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none"
            >
              <option value="Bank Transfer / NEFT">Bank Transfer / NEFT / RTGS</option>
              <option value="UPI">UPI (Google Pay, PhonePe, Paytm)</option>
              <option value="Credit / Debit Card">Credit / Debit Card</option>
              <option value="Cheque">Cheque</option>
              <option value="Cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Reference / UTR / Cheque Number</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. UTR102938472 or UPI/291839"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-800 focus:bg-white focus:outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Payment Notes (Optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Received via NEFT from HDFC corporate account"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Confirm & Record</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
