import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Quotation, InvoiceItem, QuotationStatus } from '../../types';
import { formatCurrency } from './invoiceUtils';
import { X, Plus, Trash2, Calculator, Check, AlertCircle } from 'lucide-react';

interface QuotationModalProps {
  quotation?: Quotation | null;
  onClose: () => void;
  onSaved?: (savedQuote: Quotation) => void;
}

export const QuotationModal: React.FC<QuotationModalProps> = ({
  quotation,
  onClose,
  onSaved,
}) => {
  const { customers, addQuotation, updateQuotation, quotations } = useApp();

  const isEditing = !!quotation;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(quotation?.customerId || '');
  const [customerName, setCustomerName] = useState(quotation?.customerName || '');
  const [companyName, setCompanyName] = useState(quotation?.companyName || '');
  const [customerEmail, setCustomerEmail] = useState(quotation?.customerEmail || '');
  const [customerPhone, setCustomerPhone] = useState(quotation?.customerPhone || '');
  const [customerAddress, setCustomerAddress] = useState(quotation?.customerAddress || '');
  const [customerGst, setCustomerGst] = useState(quotation?.customerGst || '');

  const [quotationNumber, setQuotationNumber] = useState(
    quotation?.quotationNumber ||
      `QT-${new Date().getFullYear()}-${String(quotations.length + 1).padStart(3, '0')}`
  );
  const [date, setDate] = useState(
    quotation?.date || new Date().toISOString().split('T')[0]
  );
  const [validUntil, setValidUntil] = useState(
    quotation?.validUntil ||
      new Date(Date.now() + 21 * 86400000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<QuotationStatus>(quotation?.status || 'Draft');
  const [currency] = useState<string>(quotation?.currency || 'INR');

  const [items, setItems] = useState<InvoiceItem[]>(
    quotation?.items || [
      {
        id: `item_${Date.now()}_1`,
        description: 'Automated CRM & Workflow Integration Package',
        quantity: 1,
        unitPrice: 45000,
        taxRate: 18,
        discount: 0,
        total: 53100,
      },
    ]
  );

  const [notes, setNotes] = useState(
    quotation?.notes ||
      'Includes remote onboarding, cloud system setup, and 1 year technical warranty.'
  );
  const [terms, setTerms] = useState(
    quotation?.terms ||
      '1. 50% advance on approval, remaining 50% upon deployment.\n2. Quotation valid for 21 days from date of issue.\n3. Taxes calculated under standard GST guidelines.'
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill when customer is picked from CRM
  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    const matched = customers.find((c) => c.id === customerId);
    if (matched) {
      setCustomerName(matched.fullName);
      setCompanyName(matched.companyName || '');
      setCustomerEmail(matched.email || '');
      setCustomerPhone(matched.mobileNumber || '');
      setCustomerAddress(
        `${matched.address || ''} ${matched.city || ''} ${matched.state || ''} ${matched.pinCode || ''}`.trim()
      );
      setCustomerGst(matched.gstNumber || '');
    }
  };

  // Recalculate item total when qty, price, tax, or discount changes
  const updateItem = (
    index: number,
    field: keyof InvoiceItem,
    value: string | number
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const target = { ...copy[index], [field]: value };

      const qty = Number(target.quantity) || 0;
      const price = Number(target.unitPrice) || 0;
      const discount = Number(target.discount) || 0;
      const taxRate = Number(target.taxRate) || 0;

      const baseAmount = Math.max(0, qty * price - discount);
      const taxAmount = (baseAmount * taxRate) / 100;
      target.total = Math.round(baseAmount + taxAmount);

      copy[index] = target;
      return copy;
    });
  };

  const addItem = () => {
    const newItem: InvoiceItem = {
      id: `item_${Date.now()}_${items.length + 1}`,
      description: '',
      quantity: 1,
      unitPrice: 10000,
      taxRate: 18,
      discount: 0,
      total: 11800,
    };
    setItems([...items, newItem]);
  };

  const removeItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Overall totals
  const subtotal = items.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.unitPrice)), 0);
  const discountTotal = items.reduce((sum, item) => sum + Number(item.discount || 0), 0);
  const taxTotal = items.reduce((sum, item) => {
    const base = Math.max(0, Number(item.quantity) * Number(item.unitPrice) - Number(item.discount || 0));
    return sum + (base * Number(item.taxRate)) / 100;
  }, 0);
  const grandTotal = Math.round(subtotal - discountTotal + taxTotal);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Customer name is required.');
      return;
    }
    if (items.some((it) => !it.description.trim())) {
      setError('All items must have a description.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      if (isEditing && quotation) {
        await updateQuotation(quotation.id, {
          quotationNumber,
          customerId: selectedCustomerId || undefined,
          customerName,
          companyName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerGst,
          date,
          validUntil,
          status,
          currency,
          items,
          subtotal,
          taxTotal: Math.round(taxTotal),
          discountTotal,
          grandTotal,
          notes,
          terms,
        });
        if (onSaved) {
          onSaved({
            ...quotation,
            quotationNumber,
            customerName,
            companyName,
            customerEmail,
            customerPhone,
            customerAddress,
            customerGst,
            date,
            validUntil,
            status,
            currency,
            items,
            subtotal,
            taxTotal: Math.round(taxTotal),
            discountTotal,
            grandTotal,
            notes,
            terms,
          });
        }
      } else {
        const created = await addQuotation({
          quotationNumber,
          customerId: selectedCustomerId || undefined,
          customerName,
          companyName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerGst,
          date,
          validUntil,
          status,
          currency,
          items,
          subtotal,
          taxTotal: Math.round(taxTotal),
          discountTotal,
          grandTotal,
          notes,
          terms,
          createdBy: 'user',
          createdByName: 'User',
        });
        if (onSaved) onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save quotation');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-6 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/75 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? `Edit Quotation ${quotation.quotationNumber}` : 'Create New Quotation'}
              </h2>
              <p className="text-xs text-slate-500">
                Generate and estimate formal proposal costs with dynamic GST & line items
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1 text-sm">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Customer Selection & Meta */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-1">
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Link to CRM Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              >
                <option value="">-- Manual / Custom Customer --</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.fullName} ({c.companyName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Quotation # *
              </label>
              <input
                type="text"
                required
                value={quotationNumber}
                onChange={(e) => setQuotationNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as QuotationStatus)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none"
              >
                <option value="Draft">Draft</option>
                <option value="Sent">Sent to Customer</option>
                <option value="Accepted">Accepted</option>
                <option value="Rejected">Rejected</option>
                <option value="Expired">Expired</option>
                <option value="Converted">Converted to Invoice</option>
              </select>
            </div>
          </div>

          {/* Customer Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer Name *</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="e.g. Rajesh Narang"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Narang Pharma Pvt Ltd"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="name@company.com"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Phone / WhatsApp</label>
              <input
                type="text"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+91 98200 12345"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-500 mb-1">Billing Address</label>
              <input
                type="text"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
                placeholder="Street address, City, State, PIN"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Customer GSTIN</label>
              <input
                type="text"
                value={customerGst}
                onChange={(e) => setCustomerGst(e.target.value.toUpperCase())}
                placeholder="29AABCU9603R1ZM"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-800"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Valid Until</label>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Line Items & Pricing
              </span>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Item</span>
              </button>
            </div>

            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-700 font-bold uppercase tracking-wider border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-2 w-20 text-center">Qty</th>
                    <th className="py-2.5 px-2 w-28 text-right">Unit Price (₹)</th>
                    <th className="py-2.5 px-2 w-20 text-center">GST %</th>
                    <th className="py-2.5 px-2 w-24 text-right">Discount (₹)</th>
                    <th className="py-2.5 px-3 w-28 text-right">Total (₹)</th>
                    <th className="py-2.5 px-2 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.id} className="hover:bg-slate-50/60">
                      <td className="p-2">
                        <input
                          type="text"
                          required
                          value={item.description}
                          onChange={(e) => updateItem(index, 'description', e.target.value)}
                          placeholder="Item name / service description"
                          className="w-full px-2.5 py-1.5 border border-slate-200 rounded-lg text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-center text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(index, 'unitPrice', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-right font-mono text-xs"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={item.taxRate}
                          onChange={(e) => updateItem(index, 'taxRate', Number(e.target.value))}
                          className="w-full px-1 py-1.5 border border-slate-200 rounded-lg text-center text-xs"
                        >
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          min="0"
                          value={item.discount}
                          onChange={(e) => updateItem(index, 'discount', Number(e.target.value))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-right font-mono text-xs"
                        />
                      </td>
                      <td className="p-2 text-right font-mono font-bold text-slate-800">
                        {formatCurrency(item.total, currency)}
                      </td>
                      <td className="p-2 text-center">
                        {items.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeItem(index)}
                            className="p-1 text-slate-400 hover:text-red-600 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Calculations Summary */}
            <div className="flex justify-end pt-2">
              <div className="w-72 bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Subtotal:</span>
                  <span className="font-mono font-semibold">{formatCurrency(subtotal, currency)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>GST (18% / Standard):</span>
                  <span className="font-mono font-semibold">{formatCurrency(Math.round(taxTotal), currency)}</span>
                </div>
                {discountTotal > 0 && (
                  <div className="flex justify-between text-emerald-600">
                    <span>Discount:</span>
                    <span className="font-mono font-semibold">-{formatCurrency(discountTotal, currency)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                  <span>Grand Total:</span>
                  <span className="font-mono text-purple-700">{formatCurrency(grandTotal, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Client Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Special project remarks or customer notes..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Terms & Conditions
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, delivery schedule, warranty..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-6 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Quotation Changes' : 'Generate Quotation'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
