import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { PurchaseOrder, GoodsReceipt } from '../../types/inventory';
import { CreatePurchaseOrderModal } from './CreatePurchaseOrderModal';
import { CreateGRNModal } from './CreateGRNModal';
import {
  ShoppingCart,
  Truck,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  Calendar,
  Building2,
  ChevronRight,
  ArrowDownRight,
  Boxes,
} from 'lucide-react';

export const StockInView: React.FC = () => {
  const { purchaseOrders, goodsReceipts } = useInventory();

  const [subTab, setSubTab] = useState<'pos' | 'grns'>('pos');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPoModalOpen, setIsPoModalOpen] = useState(false);
  const [isGrnModalOpen, setIsGrnModalOpen] = useState(false);
  const [activePoForGrn, setActivePoForGrn] = useState<PurchaseOrder | null>(null);
  const [selectedPoDetails, setSelectedPoDetails] = useState<PurchaseOrder | null>(null);

  const filteredPOs = purchaseOrders.filter(
    (po) =>
      po.poNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      po.destinationStoreName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredGRNs = goodsReceipts.filter(
    (grn) =>
      grn.grnNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      grn.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (grn.poNumber && grn.poNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
      grn.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: PurchaseOrder['status']) => {
    switch (status) {
      case 'Received':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Partially Received':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Approved':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Sent':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'Draft':
        return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'Cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-slate-100 text-slate-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-blue-600" />
            Procurement & Stock Inward (PO & GRN)
          </h2>
          <p className="text-xs text-slate-500">
            Manage purchase orders, inward goods receipts, inspection notes, and inventory additions
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setActivePoForGrn(null);
              setIsGrnModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            <Truck className="h-4 w-4 text-emerald-600" />
            Inward Goods Receipt (GRN)
          </button>

          <button
            type="button"
            onClick={() => setIsPoModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Purchase Order
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSubTab('pos')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              subTab === 'pos'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Purchase Orders ({purchaseOrders.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('grns')}
            className={`rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
              subTab === 'grns'
                ? 'bg-blue-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            Goods Receipt Notes ({goodsReceipts.length})
          </button>
        </div>

        <div className="relative w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search PO / GRN / Supplier..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-8 pr-3 py-1.5 text-xs focus:border-blue-500 focus:outline-hidden"
          />
        </div>
      </div>

      {/* View Content: Purchase Orders */}
      {subTab === 'pos' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">PO Number</th>
                  <th className="py-3 px-3 font-semibold">Supplier</th>
                  <th className="py-3 px-3 font-semibold">Destination Store</th>
                  <th className="py-3 px-3 font-semibold text-center">Items Ordered</th>
                  <th className="py-3 px-3 font-semibold text-right">PO Total (INR)</th>
                  <th className="py-3 px-3 font-semibold">Expected Delivery</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPOs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      <ShoppingCart className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      No Purchase Orders found.
                    </td>
                  </tr>
                ) : (
                  filteredPOs.map((po) => {
                    const totalOrdered = po.items.reduce((acc, i) => acc + i.orderedQty, 0);
                    const totalReceived = po.items.reduce((acc, i) => acc + i.receivedQty, 0);
                    const isFullyReceived = po.status === 'Received';

                    return (
                      <tr key={po.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <button
                            type="button"
                            onClick={() => setSelectedPoDetails(po)}
                            className="font-mono font-semibold text-blue-700 hover:underline"
                          >
                            {po.poNumber}
                          </button>
                          <div className="text-[11px] text-slate-500">
                            {new Date(po.createdAt).toLocaleDateString('en-IN')}
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <div className="font-semibold text-slate-900">{po.supplierName}</div>
                          <div className="text-[11px] text-slate-500">{po.supplierEmail}</div>
                        </td>

                        <td className="py-3 px-3 text-slate-700">
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span>{po.destinationStoreName}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 text-center">
                          <div className="font-semibold text-slate-800">
                            {po.items.length} items
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {totalReceived} / {totalOrdered} received
                          </div>
                        </td>

                        <td className="py-3 px-3 text-right font-bold text-slate-900">
                          ₹{po.grandTotal.toLocaleString('en-IN')}
                        </td>

                        <td className="py-3 px-3 text-slate-600">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-400" />
                            <span>{new Date(po.expectedDeliveryDate).toLocaleDateString('en-IN')}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadge(
                              po.status
                            )}`}
                          >
                            {po.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isFullyReceived && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActivePoForGrn(po);
                                  setIsGrnModalOpen(true);
                                }}
                                className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
                              >
                                <Truck className="h-3.5 w-3.5" />
                                Receive Goods
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => setSelectedPoDetails(po)}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50 transition-colors"
                            >
                              Inspect
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View Content: Goods Receipt Notes */}
      {subTab === 'grns' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">GRN Number</th>
                  <th className="py-3 px-3 font-semibold">PO Reference</th>
                  <th className="py-3 px-3 font-semibold">Supplier</th>
                  <th className="py-3 px-3 font-semibold">Warehouse Store</th>
                  <th className="py-3 px-3 font-semibold text-center">Accepted Qty (Stock In)</th>
                  <th className="py-3 px-3 font-semibold">Invoice / DC Ref</th>
                  <th className="py-3 px-3 font-semibold">Inspector</th>
                  <th className="py-3 px-4 font-semibold">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredGRNs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-slate-500">
                      <Truck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      No Goods Receipt Notes generated yet.
                    </td>
                  </tr>
                ) : (
                  filteredGRNs.map((grn) => {
                    const totalAccepted = grn.items.reduce((acc, i) => acc + i.acceptedQty, 0);

                    return (
                      <tr key={grn.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 font-mono font-semibold text-emerald-700">
                          {grn.grnNumber}
                        </td>

                        <td className="py-3 px-3">
                          <span className="font-mono text-blue-700 font-medium">
                            {grn.poNumber || 'Direct Shipment'}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-medium text-slate-900">
                          {grn.supplierName}
                        </td>

                        <td className="py-3 px-3 text-slate-700">
                          {grn.storeName}
                        </td>

                        <td className="py-3 px-3 text-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 font-bold text-emerald-800">
                            <ArrowDownRight className="h-3 w-3" />
                            +{totalAccepted} units ({grn.items.length} SKUs)
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-[11px] text-slate-600">
                          {grn.supplierInvoiceNo || grn.deliveryChallanNo || 'N/A'}
                        </td>

                        <td className="py-3 px-3 text-slate-600">
                          {grn.receivedByName}
                        </td>

                        <td className="py-3 px-4 text-slate-500">
                          {new Date(grn.createdAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* PO Detail View Modal */}
      {selectedPoDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Purchase Order: {selectedPoDetails.poNumber}
                </h3>
                <p className="text-xs text-slate-500">
                  Vendor: {selectedPoDetails.supplierName} • Destination: {selectedPoDetails.destinationStoreName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPoDetails(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar text-xs">
              <table className="w-full text-left">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="py-2 px-3 font-semibold">Product</th>
                    <th className="py-2 px-3 font-semibold text-center">Ordered</th>
                    <th className="py-2 px-3 font-semibold text-center">Received</th>
                    <th className="py-2 px-3 font-semibold text-right">Unit Rate</th>
                    <th className="py-2 px-3 font-semibold text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedPoDetails.items.map((item, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-slate-900">{item.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{item.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 text-center font-medium">
                        {item.orderedQty} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-emerald-700">
                        {item.receivedQty} {item.unit}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        ₹{item.unitPrice.toLocaleString('en-IN')}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                        ₹{item.totalAmount.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="pt-3 border-t border-slate-200 text-right space-y-1">
                <div>Subtotal: ₹{selectedPoDetails.subtotal.toLocaleString('en-IN')}</div>
                <div>GST: ₹{selectedPoDetails.taxTotal.toLocaleString('en-IN')}</div>
                <div className="text-sm font-bold text-blue-700">
                  Grand Total: ₹{selectedPoDetails.grandTotal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                Created on {new Date(selectedPoDetails.createdAt).toLocaleDateString('en-IN')} by {selectedPoDetails.createdByName}
              </span>
              <button
                type="button"
                onClick={() => setSelectedPoDetails(null)}
                className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-slate-900"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <CreatePurchaseOrderModal
        isOpen={isPoModalOpen}
        onClose={() => setIsPoModalOpen(false)}
      />

      <CreateGRNModal
        isOpen={isGrnModalOpen}
        onClose={() => {
          setIsGrnModalOpen(false);
          setActivePoForGrn(null);
        }}
        preselectedPo={activePoForGrn}
      />
    </div>
  );
};
