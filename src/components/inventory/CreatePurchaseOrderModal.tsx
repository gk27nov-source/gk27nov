import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { PurchaseOrderItem } from '../../types/inventory';
import { X, ShoppingCart, Plus, Trash2, CheckCircle, DollarSign, Calendar, Building2 } from 'lucide-react';

interface CreatePurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CreatePurchaseOrderModal: React.FC<CreatePurchaseOrderModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { products, suppliers, stores, createPurchaseOrder } = useInventory();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [storeId, setStoreId] = useState(stores[0]?.id || '');
  const [expectedDate, setExpectedDate] = useState(
    new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [remarks, setRemarks] = useState('');
  const [items, setItems] = useState<
    Array<{
      productId: string;
      orderedQty: number;
      unitPrice: number;
      taxPercent: number;
    }>
  >([
    {
      productId: products[0]?.id || '',
      orderedQty: 10,
      unitPrice: products[0]?.purchasePrice || 1000,
      taxPercent: products[0]?.gstRate || 18,
    },
  ]);

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentSupplier = suppliers.find((s) => s.id === supplierId) || suppliers[0];
  const currentStore = stores.find((s) => s.id === storeId) || stores[0];

  const handleAddItem = () => {
    const defaultProd = products[0];
    setItems([
      ...items,
      {
        productId: defaultProd?.id || '',
        orderedQty: 5,
        unitPrice: defaultProd?.purchasePrice || 1000,
        taxPercent: defaultProd?.gstRate || 18,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setItems(
      items.map((item, i) => {
        if (i !== index) return item;
        if (field === 'productId') {
          const matched = products.find((p) => p.id === value);
          return {
            ...item,
            productId: value,
            unitPrice: matched?.purchasePrice || item.unitPrice,
            taxPercent: matched?.gstRate || item.taxPercent,
          };
        }
        return { ...item, [field]: value };
      })
    );
  };

  // Totals calculation
  let subtotal = 0;
  let taxTotal = 0;
  const processedItems: PurchaseOrderItem[] = items.map((item) => {
    const prod = products.find((p) => p.id === item.productId);
    const lineTotal = item.orderedQty * item.unitPrice;
    const lineTax = (lineTotal * item.taxPercent) / 100;
    subtotal += lineTotal;
    taxTotal += lineTax;

    return {
      productId: item.productId,
      productName: prod?.name || 'Item',
      sku: prod?.sku || 'SKU',
      orderedQty: item.orderedQty,
      receivedQty: 0,
      unit: prod?.unit || 'PCS',
      unitPrice: item.unitPrice,
      taxPercent: item.taxPercent,
      totalAmount: lineTotal + lineTax,
    };
  });

  const grandTotal = subtotal + taxTotal;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (processedItems.length === 0) {
      setError('Please add at least one line item to the PO.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const poNumber = `PO-2026-${Date.now().toString().slice(-4)}`;

      await createPurchaseOrder({
        poNumber,
        supplierId: currentSupplier.id,
        supplierName: currentSupplier.name,
        supplierEmail: currentSupplier.email,
        supplierPhone: currentSupplier.phone,
        destinationStoreId: currentStore.id,
        destinationStoreName: currentStore.name,
        items: processedItems,
        subtotal,
        taxTotal,
        grandTotal,
        status: 'Sent',
        expectedDeliveryDate: expectedDate,
        remarks: remarks.trim() || undefined,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to generate Purchase Order');
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Generate Purchase Order (PO)
              </h3>
              <p className="text-xs text-slate-500">
                Procure stock from authorized suppliers and dispatch n8n notification
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

          {/* Supplier & Store Header */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Vendor / Supplier *
              </label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.supplierCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Destination Warehouse *
              </label>
              <select
                value={storeId}
                onChange={(e) => setStoreId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
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
                Expected Delivery Date *
              </label>
              <input
                type="date"
                required
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Purchase Order Items
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-12 gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 items-center text-xs"
                >
                  <div className="col-span-5">
                    <label className="block text-[10px] text-slate-500 mb-1 font-medium">
                      Product
                    </label>
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemChange(idx, 'productId', e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-1 font-medium">
                      Qty
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.orderedQty}
                      onChange={(e) => handleItemChange(idx, 'orderedQty', Math.max(1, Number(e.target.value)))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-[10px] text-slate-500 mb-1 font-medium">
                      Rate (₹)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(idx, 'unitPrice', Number(e.target.value))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
                    />
                  </div>

                  <div className="col-span-2 text-right">
                    <label className="block text-[10px] text-slate-500 mb-1 font-medium">
                      Line Total
                    </label>
                    <div className="font-semibold text-slate-800 pt-1">
                      ₹{(item.orderedQty * item.unitPrice * (1 + item.taxPercent / 100)).toFixed(0)}
                    </div>
                  </div>

                  <div className="col-span-1 text-center pt-4">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      disabled={items.length <= 1}
                      className="text-slate-400 hover:text-red-600 disabled:opacity-30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              PO Notes / Instructions
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Urgent requirement for Q3 production batch. Deliver with test certificates."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
            />
          </div>

          {/* Financial Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs">
            <div className="flex justify-between py-1 text-slate-600">
              <span>Subtotal:</span>
              <span className="font-medium">₹{subtotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-1 text-slate-600">
              <span>Applicable GST (avg. 18%):</span>
              <span className="font-medium">₹{taxTotal.toLocaleString('en-IN')}</span>
            </div>
            <div className="flex justify-between py-1.5 border-t border-slate-200 text-sm font-bold text-slate-900">
              <span>PO Total Payable:</span>
              <span className="text-blue-700">₹{grandTotal.toLocaleString('en-IN')}</span>
            </div>
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
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <CheckCircle className="h-4 w-4" />
              Issue & Dispatch PO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
