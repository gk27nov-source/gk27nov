import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Invoice, InvoiceItem, InvoiceStatus } from '../../types';
import { formatCurrency } from './invoiceUtils';
import { X, Plus, Trash2, FileText, Check, AlertCircle } from 'lucide-react';

interface InvoiceModalProps {
  invoice?: Invoice | null;
  initialQuotationId?: string;
  onClose: () => void;
  onSaved?: (savedInvoice: Invoice) => void;
}

export const InvoiceModal: React.FC<InvoiceModalProps> = ({
  invoice,
  initialQuotationId,
  onClose,
  onSaved,
}) => {
  const { customers, quotations, invoices, addInvoice, updateInvoice } = useApp();

  const isEditing = !!invoice;

  // Selected quotation for pre-fill
  const matchedQuote = initialQuotationId ? quotations.find((q) => q.id === initialQuotationId) : null;

  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(
    invoice?.customerId || matchedQuote?.customerId || ''
  );
  const [customerName, setCustomerName] = useState(
    invoice?.customerName || matchedQuote?.customerName || ''
  );
  const [companyName, setCompanyName] = useState(
    invoice?.companyName || matchedQuote?.companyName || ''
  );
  const [customerEmail, setCustomerEmail] = useState(
    invoice?.customerEmail || matchedQuote?.customerEmail || ''
  );
  const [customerPhone, setCustomerPhone] = useState(
    invoice?.customerPhone || matchedQuote?.customerPhone || ''
  );
  const [customerAddress, setCustomerAddress] = useState(
    invoice?.customerAddress || matchedQuote?.customerAddress || ''
  );
  const [customerGst, setCustomerGst] = useState(
    invoice?.customerGst || matchedQuote?.customerGst || ''
  );

  const [invoiceNumber, setInvoiceNumber] = useState(
    invoice?.invoiceNumber ||
      `INV-${new Date().getFullYear()}-${String(invoices.length + 1).padStart(3, '0')}`
  );
  const [issueDate, setIssueDate] = useState(
    invoice?.issueDate || new Date().toISOString().split('T')[0]
  );
  const [dueDate, setDueDate] = useState(
    invoice?.dueDate ||
      new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0]
  );
  const [status, setStatus] = useState<InvoiceStatus>(invoice?.status || 'Sent');
  const [currency] = useState<string>(invoice?.currency || 'INR');

  const [items, setItems] = useState<InvoiceItem[]>(
    invoice?.items ||
      matchedQuote?.items || [
        {
          id: `item_${Date.now()}_1`,
          description: 'Enterprise ERP & Cloud System Integration',
          quantity: 1,
          unitPrice: 85000,
          taxRate: 18,
          discount: 0,
          total: 100300,
        },
      ]
  );

  // Payments
  const [amountPaid, setAmountPaid] = useState<number>(invoice?.amountPaid || 0);
  const [paymentMethod, setPaymentMethod] = useState<Invoice['paymentMethod']>(
    invoice?.paymentMethod || 'Bank Transfer / NEFT'
  );
  const [paymentReference, setPaymentReference] = useState<string>(
    invoice?.paymentReference || ''
  );

  const [notes, setNotes] = useState(
    invoice?.notes ||
      (matchedQuote ? `Generated from Quotation ${matchedQuote.quotationNumber}.` : 'Thank you for your business!')
  );
  const [terms, setTerms] = useState(
    invoice?.terms ||
      '1. Payment due within 15 days of invoice date.\n2. Bank Details: HDFC Bank, A/C: 50200049281726, IFSC: HDFC0000240.\n3. Late payment surcharge: 1.5% per month.'
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-fill customer
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

  // Populate from quotation
  const handleQuoteSelect = (quoteId: string) => {
    const q = quotations.find((it) => it.id === quoteId);
    if (q) {
      setSelectedCustomerId(q.customerId || '');
      setCustomerName(q.customerName);
      setCompanyName(q.companyName || '');
      setCustomerEmail(q.customerEmail || '');
      setCustomerPhone(q.customerPhone || '');
      setCustomerAddress(q.customerAddress || '');
      setCustomerGst(q.customerGst || '');
      setItems([...q.items]);
      setNotes(`Converted from Quotation ${q.quotationNumber}. ${q.notes || ''}`.trim());
      if (q.terms) setTerms(q.terms);
    }
  };

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
      unitPrice: 15000,
      taxRate: 18,
      discount: 0,
      total: 17700,
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
  const balanceDue = Math.max(0, grandTotal - amountPaid);

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

    let calculatedStatus: InvoiceStatus = status;
    if (balanceDue <= 0 && amountPaid > 0 && status !== 'Cancelled') {
      calculatedStatus = 'Paid';
    } else if (amountPaid > 0 && balanceDue > 0 && status !== 'Cancelled') {
      calculatedStatus = 'Partially Paid';
    }

    try {
      if (isEditing && invoice) {
        await updateInvoice(invoice.id, {
          invoiceNumber,
          customerId: selectedCustomerId || undefined,
          customerName,
          companyName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerGst,
          issueDate,
          dueDate,
          status: calculatedStatus,
          currency,
          items,
          subtotal,
          taxTotal: Math.round(taxTotal),
          discountTotal,
          grandTotal,
          amountPaid,
          balanceDue,
          paymentMethod: amountPaid > 0 ? paymentMethod : undefined,
          paymentReference: amountPaid > 0 ? paymentReference : undefined,
          paidAt: amountPaid >= grandTotal ? new Date().toISOString() : undefined,
          notes,
          terms,
        });
        if (onSaved) {
          onSaved({
            ...invoice,
            invoiceNumber,
            customerName,
            companyName,
            customerEmail,
            customerPhone,
            customerAddress,
            customerGst,
            issueDate,
            dueDate,
            status: calculatedStatus,
            currency,
            items,
            subtotal,
            taxTotal: Math.round(taxTotal),
            discountTotal,
            grandTotal,
            amountPaid,
            balanceDue,
            notes,
            terms,
          });
        }
      } else {
        const created = await addInvoice({
          invoiceNumber,
          quotationId: matchedQuote?.id,
          quotationNumber: matchedQuote?.quotationNumber,
          customerId: selectedCustomerId || undefined,
          customerName,
          companyName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerGst,
          issueDate,
          dueDate,
          status: calculatedStatus,
          currency,
          items,
          subtotal,
          taxTotal: Math.round(taxTotal),
          discountTotal,
          grandTotal,
          amountPaid,
          balanceDue,
          paymentMethod: amountPaid > 0 ? paymentMethod : undefined,
          paymentReference: amountPaid > 0 ? paymentReference : undefined,
          paidAt: amountPaid >= grandTotal ? new Date().toISOString() : undefined,
          notes,
          terms,
          createdBy: 'user',
          createdByName: 'User',
        });
        if (onSaved) onSaved(created);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save invoice');
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
            <div className="p-2 rounded-xl bg-blue-100 text-blue-700">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {isEditing ? `Edit Invoice ${invoice.invoiceNumber}` : 'Create Tax Invoice'}
              </h2>
              <p className="text-xs text-slate-500">
                GST-compliant commercial tax invoice with itemized tax and payment tracking
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

          {/* Quick Preload from Quotations or CRM */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Import from Quotation
              </label>
              <select
                onChange={(e) => handleQuoteSelect(e.target.value)}
                defaultValue={initialQuotationId || ''}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none"
              >
                <option value="">-- None / Blank Invoice --</option>
                {quotations.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.quotationNumber} - {q.customerName} (₹{q.grandTotal.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Link to CRM Customer
              </label>
              <select
                value={selectedCustomerId}
                onChange={(e) => handleCustomerSelect(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
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
                Invoice # *
              </label>
              <input
                type="text"
                required
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs font-bold text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              />
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
                placeholder="e.g. Ramesh Chandra"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Company Name</label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Chandra Technologies"
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="finance@company.com"
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
                <label className="block text-xs font-medium text-slate-500 mb-1">Issue Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Payment Due</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Invoice Line Items
              </span>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
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

            {/* Calculations Summary & Payment Upfront */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Payment Status & Recording
                </span>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Amount Paid (₹)</label>
                    <input
                      type="number"
                      min="0"
                      max={grandTotal}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(Number(e.target.value))}
                      className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as InvoiceStatus)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Sent">Sent</option>
                      <option value="Paid">Paid</option>
                      <option value="Partially Paid">Partially Paid</option>
                      <option value="Overdue">Overdue</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>

                {amountPaid > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                      >
                        <option value="Bank Transfer / NEFT">Bank Transfer / NEFT</option>
                        <option value="UPI">UPI</option>
                        <option value="Credit / Debit Card">Credit / Debit Card</option>
                        <option value="Cheque">Cheque</option>
                        <option value="Cash">Cash</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Ref / UTR No.</label>
                      <input
                        type="text"
                        value={paymentReference}
                        onChange={(e) => setPaymentReference(e.target.value)}
                        placeholder="e.g. UTR49281923"
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs self-start">
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
                  <span className="font-mono text-blue-700">{formatCurrency(grandTotal, currency)}</span>
                </div>
                <div className="flex justify-between text-xs text-emerald-600 font-semibold pt-1">
                  <span>Amount Paid:</span>
                  <span className="font-mono">{formatCurrency(amountPaid, currency)}</span>
                </div>
                <div className="flex justify-between text-xs font-bold text-red-600 bg-red-50 p-1.5 rounded-lg border border-red-100">
                  <span>Balance Due:</span>
                  <span className="font-mono">{formatCurrency(balanceDue, currency)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Notes
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes to appear on invoice..."
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-1">
                Terms & Bank Info
              </label>
              <textarea
                rows={3}
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Payment terms, bank details..."
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
              className="inline-flex items-center gap-2 px-6 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition-colors disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{isEditing ? 'Save Invoice Changes' : 'Issue Tax Invoice'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
