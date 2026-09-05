import React from 'react';
import { Quotation, Invoice, Organization } from '../../types';
import { formatCurrency, numberToWordsINR } from './invoiceUtils';
import { Printer, Share2, X, Building, CheckCircle2, AlertCircle } from 'lucide-react';

interface DocumentPrintViewModalProps {
  document: Quotation | Invoice;
  type: 'quotation' | 'invoice';
  organization: Organization;
  onClose: () => void;
  onOpenShareModal: () => void;
}

export const DocumentPrintViewModal: React.FC<DocumentPrintViewModalProps> = ({
  document,
  type,
  organization,
  onClose,
  onOpenShareModal,
}) => {
  const isInvoice = type === 'invoice';
  const docNumber = isInvoice ? (document as Invoice).invoiceNumber : (document as Quotation).quotationNumber;
  const docTitle = isInvoice ? 'TAX INVOICE' : 'COMMERCIAL QUOTATION';

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      {/* Container */}
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden my-4 flex flex-col max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none print:m-0">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 print:hidden shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Document Preview</span>
            <span className="font-mono text-sm font-bold text-slate-800">{docNumber}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onOpenShareModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share With Customer</span>
            </button>

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-8 sm:p-12 overflow-y-auto print:p-8 bg-white text-slate-800 text-sm flex-1">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b-2 border-slate-800 pb-6 mb-6">
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 rounded-lg bg-blue-600 text-white font-black text-lg">
                  <Building className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">
                    {organization.legalName || organization.name}
                  </h1>
                  <p className="text-xs font-semibold text-slate-500">
                    {organization.industry || 'Business Automation & Enterprise Systems'}
                  </p>
                </div>
              </div>
              <div className="text-xs text-slate-600 space-y-0.5 leading-relaxed">
                <p>{organization.address}</p>
                <p>{organization.city}, {organization.state} - {organization.pinCode}</p>
                <p className="font-semibold text-slate-800">GSTIN: {organization.gstNumber}</p>
                <p>Email: {organization.email} | Phone: {organization.phone}</p>
                <p>Website: {organization.website}</p>
              </div>
            </div>

            <div className="text-left sm:text-right">
              <div className="inline-block px-3 py-1 bg-slate-900 text-white text-xs font-black tracking-widest uppercase rounded mb-2">
                {docTitle}
              </div>
              <div className="text-xs space-y-1">
                <p className="font-mono text-base font-bold text-slate-900">{docNumber}</p>
                <p className="text-slate-600">
                  <span className="text-slate-400">Date: </span>
                  <span className="font-medium">{isInvoice ? (document as Invoice).issueDate : (document as Quotation).date}</span>
                </p>
                <p className="text-slate-600">
                  <span className="text-slate-400">{isInvoice ? 'Due Date: ' : 'Valid Until: '}</span>
                  <span className="font-medium text-slate-900">{isInvoice ? (document as Invoice).dueDate : (document as Quotation).validUntil}</span>
                </p>
                {isInvoice && (document as Invoice).quotationNumber && (
                  <p className="text-slate-600">
                    <span className="text-slate-400">Ref Quote: </span>
                    <span className="font-medium font-mono">{(document as Invoice).quotationNumber}</span>
                  </p>
                )}
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wide border">
                  {document.status === 'Paid' || document.status === 'Accepted' ? (
                    <span className="text-emerald-700 bg-emerald-50 border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> {document.status}
                    </span>
                  ) : document.status === 'Overdue' ? (
                    <span className="text-red-700 bg-red-50 border-red-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> OVERDUE
                    </span>
                  ) : (
                    <span className="text-slate-700 bg-slate-100 border-slate-300 px-2 py-0.5 rounded-full">
                      {document.status}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Billed To / Customer Block */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 border border-slate-200 rounded-xl p-4 mb-6 text-xs">
            <div>
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Billed To / Buyer Details
              </span>
              <p className="text-sm font-bold text-slate-900">{document.customerName}</p>
              <p className="font-semibold text-slate-700">{document.companyName}</p>
              <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                {document.customerAddress || 'Address on file'}
              </p>
              {document.customerGst && (
                <p className="font-mono font-bold text-slate-800 mt-1">GSTIN: {document.customerGst}</p>
              )}
            </div>

            <div className="sm:text-right">
              <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Contact & Place of Supply
              </span>
              <p className="text-slate-700 font-medium">Phone: {document.customerPhone || 'N/A'}</p>
              <p className="text-slate-700 font-medium">Email: {document.customerEmail || 'N/A'}</p>
              <p className="text-slate-600 mt-1">Place of Supply: {organization.state} (29)</p>
              <p className="text-slate-500">Reverse Charge: No</p>
            </div>
          </div>

          {/* Items Table */}
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left border border-slate-200 rounded-lg overflow-hidden text-xs">
              <thead className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-12 text-center">#</th>
                  <th className="py-2.5 px-3">Item / Service Description</th>
                  <th className="py-2.5 px-3 text-center w-16">Qty</th>
                  <th className="py-2.5 px-3 text-right w-24">Rate</th>
                  <th className="py-2.5 px-3 text-center w-20">GST %</th>
                  <th className="py-2.5 px-3 text-right w-28">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-normal">
                {document.items.map((item, idx) => (
                  <tr key={item.id || idx} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 text-center text-slate-400 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3">
                      <p className="font-semibold text-slate-800">{item.description}</p>
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium text-slate-700">{item.quantity}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                      {formatCurrency(item.unitPrice, document.currency)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-medium text-slate-600">{item.taxRate}%</td>
                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                      {formatCurrency(item.total, document.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Calculations */}
          <div className="flex flex-col sm:flex-row justify-between gap-6 mb-6">
            <div className="flex-1 space-y-3">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <span className="font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  Amount in Words
                </span>
                <p className="font-semibold text-slate-800 italic">
                  {numberToWordsINR(document.grandTotal)}
                </p>
              </div>

              {/* Payment Bank Details */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs">
                <span className="font-bold text-slate-700 uppercase tracking-wider block mb-1">
                  Bank & Electronic Transfer Details
                </span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600 mt-1">
                  <p><span className="text-slate-400">Account Name:</span> {organization.legalName}</p>
                  <p><span className="text-slate-400">Bank:</span> HDFC Bank Ltd.</p>
                  <p><span className="text-slate-400">A/C Number:</span> <span className="font-mono font-bold text-slate-800">50200049281726</span></p>
                  <p><span className="text-slate-400">IFSC Code:</span> <span className="font-mono font-bold text-slate-800">HDFC0000240</span></p>
                  <p><span className="text-slate-400">UPI ID / VPA:</span> <span className="font-mono font-bold text-blue-700">apexsolutions@hdfcbank</span></p>
                  <p><span className="text-slate-400">Branch:</span> Koramangala, Bengaluru</p>
                </div>
              </div>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between py-1 text-slate-600">
                <span>Subtotal</span>
                <span className="font-mono font-semibold">{formatCurrency(document.subtotal, document.currency)}</span>
              </div>
              <div className="flex justify-between py-1 text-slate-600">
                <span>GST (CGST 9% + SGST 9%)</span>
                <span className="font-mono font-semibold">{formatCurrency(document.taxTotal, document.currency)}</span>
              </div>
              {document.discountTotal > 0 && (
                <div className="flex justify-between py-1 text-emerald-600 font-medium">
                  <span>Discount</span>
                  <span className="font-mono">-{formatCurrency(document.discountTotal, document.currency)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-slate-800 text-sm font-black text-slate-900">
                <span>Grand Total</span>
                <span className="font-mono text-base">{formatCurrency(document.grandTotal, document.currency)}</span>
              </div>

              {isInvoice && (
                <div className="border-t border-slate-200 pt-2 space-y-1.5">
                  <div className="flex justify-between py-1 text-slate-600">
                    <span>Amount Paid</span>
                    <span className="font-mono font-semibold text-emerald-600">
                      {formatCurrency((document as Invoice).amountPaid, document.currency)}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 font-bold text-slate-900 bg-amber-50 p-2 rounded-lg border border-amber-200">
                    <span>Balance Due</span>
                    <span className="font-mono text-amber-900">
                      {formatCurrency((document as Invoice).balanceDue, document.currency)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terms & Signatures */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-slate-200 pt-6 text-xs text-slate-600">
            <div>
              <p className="font-bold text-slate-700 mb-1">Terms & Conditions:</p>
              <p className="whitespace-pre-line leading-relaxed text-slate-500">
                {document.terms || '1. Goods / Services once confirmed are non-refundable.\n2. Interest @ 18% p.a. charged on overdue invoices.\n3. Subject to Bengaluru jurisdiction.'}
              </p>
            </div>

            <div className="sm:text-right flex flex-col justify-between items-start sm:items-end">
              <span className="font-semibold text-slate-700">For {organization.legalName}</span>
              <div className="mt-8 border-t border-slate-300 pt-1 w-48 text-center text-slate-400">
                Authorized Signatory
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
