import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Product, StockTransaction } from '../../types/inventory';
import {
  X,
  ArrowUpDown,
  ArrowDownRight,
  ArrowUpRight,
  AlertCircle,
  Building2,
  Package,
  FileText,
  CheckCircle,
} from 'lucide-react';

interface CreateStockTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedProduct?: Product | null;
}

export const CreateStockTransactionModal: React.FC<CreateStockTransactionModalProps> = ({
  isOpen,
  onClose,
  preselectedProduct,
}) => {
  const { products, stores, createStockTransaction } = useInventory();

  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [transactionType, setTransactionType] = useState<StockTransaction['type']>('Stock Receipt');
  const [quantity, setQuantity] = useState<number>(1);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [referenceType, setReferenceType] = useState<StockTransaction['referenceType']>('manual');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (preselectedProduct) {
      setSelectedProductId(preselectedProduct.id);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }

    if (stores.length > 0 && !selectedStoreId) {
      setSelectedStoreId(stores[0].id);
    }
  }, [preselectedProduct, products, stores, selectedProductId, selectedStoreId]);

  if (!isOpen) return null;

  const currentProduct = products.find((p) => p.id === selectedProductId);

  // Determine direction based on type
  const isIncoming =
    transactionType === 'Purchase' ||
    transactionType === 'Stock Receipt' ||
    transactionType === 'Sales Return' ||
    transactionType === 'Opening Stock';

  const direction: 'in' | 'out' = isIncoming ? 'in' : 'out';

  // Projected stock preview
  const currentPhysical = currentProduct?.currentStock || 0;
  const projectedStock = direction === 'in' ? currentPhysical + quantity : currentPhysical - quantity;
  const willCauseNegative = direction === 'out' && projectedStock < 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) {
      setError('Please choose an item from the product master.');
      return;
    }
    if (quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (!remarks.trim()) {
      setError('Audit remarks are mandatory for all stock ledger transactions.');
      return;
    }
    if (willCauseNegative) {
      setError(`Cannot complete transaction: Requested deduction of ${quantity} ${currentProduct.unit} exceeds physical available stock of ${currentPhysical} ${currentProduct.unit}.`);
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      await createStockTransaction({
        type: transactionType,
        productId: currentProduct.id,
        quantity,
        direction,
        storeId: selectedStoreId,
        referenceType,
        referenceNumber: referenceNumber.trim() || undefined,
        remarks: remarks.trim(),
        unitPrice: currentProduct.purchasePrice,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process stock transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ArrowUpDown className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Stock Transaction</h3>
              <p className="text-xs text-slate-500">
                Audited stock issue, manual receipt, or adjustment entry
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Transaction Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Classification *
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[
                { type: 'Stock Receipt', label: 'Stock Receipt (In)', icon: ArrowDownRight, in: true },
                { type: 'Stock Issue', label: 'Stock Issue (Out)', icon: ArrowUpRight, in: false },
                { type: 'Purchase', label: 'Direct Purchase (In)', icon: ArrowDownRight, in: true },
                { type: 'Sale', label: 'Direct Sale (Out)', icon: ArrowUpRight, in: false },
                { type: 'Damaged Stock', label: 'Damage Scrap (Out)', icon: ArrowUpRight, in: false },
                { type: 'Stock Adjustment', label: 'Adjustment (In/Out)', icon: ArrowUpDown, in: false },
              ].map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setTransactionType(opt.type as any)}
                  className={`flex items-center gap-1.5 rounded-lg border p-2 text-xs font-medium transition-all text-left ${
                    transactionType === opt.type
                      ? 'border-blue-600 bg-blue-50/70 text-blue-800 font-semibold'
                      : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon
                    className={`h-3.5 w-3.5 ${
                      transactionType === opt.type
                        ? 'text-blue-600'
                        : opt.in
                        ? 'text-emerald-500'
                        : 'text-amber-500'
                    }`}
                  />
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Product Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Product / SKU *
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500 font-medium"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) — Current: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          {/* Warehouse Store & Quantity */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Warehouse / Store Location *
              </label>
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.city})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Quantity to {direction === 'in' ? 'Add' : 'Deduct'} ({currentProduct?.unit || 'Units'}) *
              </label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Reference Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reference Document Type
              </label>
              <select
                value={referenceType}
                onChange={(e) => setReferenceType(e.target.value as any)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                <option value="manual">Manual Entry</option>
                <option value="invoice">Customer Invoice</option>
                <option value="quotation">Approved Quotation</option>
                <option value="complaint">Complaint / Service Ticket</option>
                <option value="goods_receipt">Goods Receipt Note (GRN)</option>
                <option value="audit">Cycle Count Audit</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Reference / Document Number
              </label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="e.g. INV-2026-081 or TKT-2026-104"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Audit Remarks */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Audit Remarks / Reason *
            </label>
            <input
              type="text"
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Replaced burnt motor coil for customer warranty ticket or Supplier dispatch"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Live Impact Preview Card */}
          {currentProduct && (
            <div className={`rounded-xl border p-4 text-xs ${
              willCauseNegative
                ? 'border-red-300 bg-red-50/70 text-red-900'
                : 'border-blue-200 bg-blue-50/50 text-blue-950'
            }`}>
              <div className="font-semibold mb-1 flex items-center justify-between">
                <span>Transaction Impact Projection:</span>
                <span className={`font-bold ${direction === 'in' ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {direction === 'in' ? `+${quantity}` : `-${quantity}`} {currentProduct.unit}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-blue-200/60 text-center">
                <div>
                  <div className="text-slate-500 text-[11px]">Previous Stock</div>
                  <div className="font-semibold text-slate-900">{currentPhysical} {currentProduct.unit}</div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">Movement</div>
                  <div className={`font-bold ${direction === 'in' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {direction === 'in' ? '+' : '-'}{quantity}
                  </div>
                </div>
                <div>
                  <div className="text-slate-500 text-[11px]">New Projected Stock</div>
                  <div className={`font-bold text-sm ${willCauseNegative ? 'text-red-600' : 'text-blue-700'}`}>
                    {projectedStock} {currentProduct.unit}
                  </div>
                </div>
              </div>
              {willCauseNegative && (
                <p className="mt-2 text-red-600 font-medium">
                  ⚠️ Negative stock is strictly prohibited by system governance rules.
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || willCauseNegative}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Book Transaction
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
