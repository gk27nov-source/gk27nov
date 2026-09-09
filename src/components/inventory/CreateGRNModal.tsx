import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { GoodsReceiptItem, PurchaseOrder } from '../../types/inventory';
import { X, Truck, CheckCircle2, AlertCircle, Building2, Package } from 'lucide-react';

interface CreateGRNModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPo?: PurchaseOrder | null;
}

export const CreateGRNModal: React.FC<CreateGRNModalProps> = ({
  isOpen,
  onClose,
  preselectedPo,
}) => {
  const { purchaseOrders, stores, createGoodsReceipt, suppliers } = useInventory();

  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [supplierInvoiceNo, setSupplierInvoiceNo] = useState<string>('');
  const [deliveryChallanNo, setDeliveryChallanNo] = useState<string>('');
  const [storeId, setStoreId] = useState<string>('');
  const [inspectionRemarks, setInspectionRemarks] = useState<string>('Quality inspected, all items in working condition.');

  const [items, setItems] = useState<
    Array<{
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      orderedQty: number;
      receivedQty: number;
      acceptedQty: number;
      rejectedQty: number;
      unitPrice: number;
      remarks: string;
    }>
  >([]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Initialize from PO
  useEffect(() => {
    const po = preselectedPo || purchaseOrders.find((p) => p.id === selectedPoId) || purchaseOrders[0];
    if (po) {
      setSelectedPoId(po.id);
      setStoreId(po.destinationStoreId);
      setSupplierInvoiceNo(`INV-${Date.now().toString().slice(-4)}`);
      setDeliveryChallanNo(`DC-${Date.now().toString().slice(-4)}`);

      setItems(
        po.items.map((item) => {
          const remaining = Math.max(0, item.orderedQty - item.receivedQty);
          return {
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit,
            orderedQty: item.orderedQty,
            receivedQty: remaining,
            acceptedQty: remaining,
            rejectedQty: 0,
            unitPrice: item.unitPrice,
            remarks: 'Passed incoming inspection',
          };
        })
      );
    }
  }, [preselectedPo, purchaseOrders, selectedPoId, isOpen]);

  if (!isOpen) return null;

  const currentPo = purchaseOrders.find((p) => p.id === selectedPoId) || preselectedPo;
  const currentStore = stores.find((s) => s.id === storeId) || stores[0];

  const handleQtyChange = (index: number, field: 'receivedQty' | 'acceptedQty' | 'rejectedQty', val: number) => {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, [field]: Math.max(0, val) };
        if (field === 'receivedQty') {
          updated.acceptedQty = Math.max(0, val - updated.rejectedQty);
        } else if (field === 'acceptedQty') {
          updated.rejectedQty = Math.max(0, updated.receivedQty - val);
        } else if (field === 'rejectedQty') {
          updated.acceptedQty = Math.max(0, updated.receivedQty - val);
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStore) {
      setError('Please choose target warehouse store.');
      return;
    }

    const totalAccepted = items.reduce((acc, i) => acc + i.acceptedQty, 0);
    if (totalAccepted <= 0) {
      setError('At least one item must have an accepted quantity greater than zero to post goods receipt.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const grnNumber = `GRN-2026-${Date.now().toString().slice(-4)}`;

      const grnItems: GoodsReceiptItem[] = items.map((i) => ({
        productId: i.productId,
        productName: i.productName,
        sku: i.sku,
        unit: i.unit,
        orderedQty: i.orderedQty,
        receivedQty: i.receivedQty,
        acceptedQty: i.acceptedQty,
        rejectedQty: i.rejectedQty,
        unitPrice: i.unitPrice,
        remarks: i.remarks,
      }));

      await createGoodsReceipt({
        grnNumber,
        poId: currentPo?.id,
        poNumber: currentPo?.poNumber,
        supplierId: currentPo?.supplierId || suppliers[0]?.id || 'sup_01',
        supplierName: currentPo?.supplierName || suppliers[0]?.name || 'Supplier',
        storeId: currentStore.id,
        storeName: currentStore.name,
        deliveryChallanNo: deliveryChallanNo.trim() || undefined,
        supplierInvoiceNo: supplierInvoiceNo.trim() || undefined,
        items: grnItems,
        inspectionRemarks: inspectionRemarks.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to process Goods Receipt');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-3xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Goods Receipt Note (GRN) Inward Entry
              </h3>
              <p className="text-xs text-slate-500">
                Inspect inward shipment, accept verified stock, and auto-book ledger transactions
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
        <form onSubmit={handleSubmit} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Reference Details */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Link to Purchase Order
              </label>
              <select
                value={selectedPoId}
                onChange={(e) => setSelectedPoId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {purchaseOrders.map((po) => (
                  <option key={po.id} value={po.id}>
                    {po.poNumber} — {po.supplierName} ({po.status})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Target Warehouse Store *
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supplier Invoice No.
              </label>
              <input
                type="text"
                value={supplierInvoiceNo}
                onChange={(e) => setSupplierInvoiceNo(e.target.value)}
                placeholder="INV-9921"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Delivery Challan No.
              </label>
              <input
                type="text"
                value={deliveryChallanNo}
                onChange={(e) => setDeliveryChallanNo(e.target.value)}
                placeholder="DC-4412"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Item Inspection & Acceptance Table */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
              Physical Inspection & Verified Quantities
            </label>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900 text-sm">{item.productName}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-500">({item.sku})</span>
                    </div>
                    <span className="text-slate-500">
                      Ordered in PO: <strong className="text-slate-900">{item.orderedQty} {item.unit}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-600 mb-1">
                        Received Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.receivedQty}
                        onChange={(e) => handleQtyChange(idx, 'receivedQty', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-emerald-700 mb-1">
                        Accepted Qty (Stock In) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.acceptedQty}
                        onChange={(e) => handleQtyChange(idx, 'acceptedQty', Number(e.target.value))}
                        className="w-full rounded-lg border border-emerald-300 bg-emerald-50/50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 focus:border-emerald-500 focus:outline-hidden"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-rose-600 mb-1">
                        Rejected / Damaged Qty
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={item.rejectedQty}
                        onChange={(e) => handleQtyChange(idx, 'rejectedQty', Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-rose-700 font-semibold focus:border-blue-500 focus:outline-hidden"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inspection remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Store Inspection & Quality Certification Notes
            </label>
            <input
              type="text"
              value={inspectionRemarks}
              onChange={(e) => setInspectionRemarks(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Banner */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <p className="font-semibold">Automated Ledger Posting:</p>
            <p className="mt-0.5 text-emerald-700">
              Submitting this GRN will automatically credit physical and available stock in{' '}
              <strong>{currentStore?.name}</strong> and create verified "Purchase" stock transactions with full audit trails.
            </p>
          </div>

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
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle2 className="h-4 w-4" />
              Complete Goods Receipt
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
