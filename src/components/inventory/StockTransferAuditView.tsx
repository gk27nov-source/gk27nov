import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { StockTransfer, StockAudit } from '../../types/inventory';
import {
  ArrowRightLeft,
  ClipboardCheck,
  Plus,
  Building2,
  Package,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  Search,
  Truck,
  ArrowRight,
  X,
} from 'lucide-react';

export const StockTransferAuditView: React.FC = () => {
  const {
    stores,
    products,
    stockTransfers,
    stockAudits,
    createStockTransfer,
    completeStockTransfer,
    cancelStockTransfer,
    createStockAudit,
    reconcileStockAudit,
  } = useInventory();

  const [activeTab, setActiveTab] = useState<'transfer' | 'audit'>('transfer');

  // Transfer Modal State
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [sourceStoreId, setSourceStoreId] = useState(stores[0]?.id || '');
  const [destStoreId, setDestStoreId] = useState(stores[1]?.id || stores[0]?.id || '');
  const [transferProductId, setTransferProductId] = useState(products[0]?.id || '');
  const [transferQty, setTransferQty] = useState(1);
  const [transferRemarks, setTransferRemarks] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // Audit Modal State
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [auditStoreId, setAuditStoreId] = useState(stores[0]?.id || '');
  const [auditCounts, setAuditCounts] = useState<{ [productId: string]: number }>({});
  const [auditRemarks, setAuditRemarks] = useState('Quarterly cycle count inspection');
  const [auditError, setAuditError] = useState<string | null>(null);

  const selectedTransferProduct = products.find((p) => p.id === transferProductId) || products[0];

  // Initiate Transfer
  const handleInitiateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (sourceStoreId === destStoreId) {
      setTransferError('Source and destination stores must be different.');
      return;
    }
    if (transferQty <= 0) {
      setTransferError('Quantity must be greater than zero.');
      return;
    }

    const sourceStore = stores.find((s) => s.id === sourceStoreId);
    const destStore = stores.find((s) => s.id === destStoreId);

    try {
      setTransferError(null);
      const transferNumber = `TRF-2026-${Date.now().toString().slice(-4)}`;

      await createStockTransfer({
        transferNumber,
        sourceStoreId,
        sourceStoreName: sourceStore?.name || 'Source Store',
        destinationStoreId: destStoreId,
        destinationStoreName: destStore?.name || 'Destination Store',
        items: [
          {
            productId: selectedTransferProduct.id,
            productName: selectedTransferProduct.name,
            sku: selectedTransferProduct.sku,
            quantity: transferQty,
            unit: selectedTransferProduct.unit,
            unitPrice: selectedTransferProduct.purchasePrice,
          },
        ],
        status: 'In-Transit',
        remarks: transferRemarks || undefined,
      });

      setIsTransferModalOpen(false);
      setTransferRemarks('');
      setTransferQty(1);
    } catch (err: any) {
      setTransferError(err.message || 'Failed to initiate transfer');
    }
  };

  // Complete Transfer
  const handleCompleteTransfer = async (transfer: StockTransfer) => {
    try {
      await completeStockTransfer(transfer.id);
    } catch (err: any) {
      alert(err.message || 'Failed to complete transfer');
    }
  };

  // Cancel Transfer
  const handleCancelTransfer = async (transfer: StockTransfer) => {
    const confirmed = window.confirm(
      `Cancel transfer "${transfer.transferNumber}"? Any goods already deducted from ${transfer.sourceStoreName} will be automatically restocked into inventory.`
    );
    if (!confirmed) return;
    try {
      await cancelStockTransfer(transfer.id, 'Cancelled by inventory controller');
    } catch (err: any) {
      alert(err.message || 'Failed to cancel transfer');
    }
  };

  // Start Audit
  const handleStartAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    const auditStore = stores.find((s) => s.id === auditStoreId);

    const auditItems = products.map((p) => {
      const systemStock = p.storeStocks?.[auditStoreId]?.physicalStock || 0;
      const physicalCount = auditCounts[p.id] !== undefined ? auditCounts[p.id] : systemStock;
      const variance = physicalCount - systemStock;

      return {
        productId: p.id,
        productName: p.name,
        sku: p.sku,
        unit: p.unit,
        systemStock,
        physicalCount,
        variance,
        reconciled: false,
      };
    });

    try {
      setAuditError(null);
      const auditNumber = `AUDIT-2026-${Date.now().toString().slice(-4)}`;

      await createStockAudit({
        auditNumber,
        storeId: auditStoreId,
        storeName: auditStore?.name || 'Store',
        auditDate: new Date().toISOString().split('T')[0],
        status: 'In-Progress',
        items: auditItems,
        remarks: auditRemarks,
      });

      setIsAuditModalOpen(false);
    } catch (err: any) {
      setAuditError(err.message || 'Failed to initiate audit');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5 text-blue-600" />
            Stock Transfers & Physical Audits
          </h2>
          <p className="text-xs text-slate-500">
            Facilitate multi-warehouse inventory transit and periodic physical cycle count reconciliation
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === 'transfer' ? (
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New Inter-Store Transfer
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setIsAuditModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-purple-700 transition-colors"
            >
              <ClipboardCheck className="h-4 w-4" />
              Start Physical Cycle Count
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('transfer')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'transfer'
              ? 'bg-blue-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ArrowRightLeft className="h-4 w-4" />
          Inter-Warehouse Transfers ({stockTransfers.length})
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
            activeTab === 'audit'
              ? 'bg-purple-600 text-white shadow-xs'
              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
          }`}
        >
          <ClipboardCheck className="h-4 w-4" />
          Physical Stock Audits ({stockAudits.length})
        </button>
      </div>

      {/* Inter-Warehouse Transfers Tab */}
      {activeTab === 'transfer' && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                <tr>
                  <th className="py-3 px-4 font-semibold">Transfer Ref</th>
                  <th className="py-3 px-3 font-semibold">Source Warehouse</th>
                  <th className="py-3 px-3 font-semibold">Destination Warehouse</th>
                  <th className="py-3 px-3 font-semibold">Items & Qty</th>
                  <th className="py-3 px-3 font-semibold">Status</th>
                  <th className="py-3 px-3 font-semibold">Initiated</th>
                  <th className="py-3 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stockTransfers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-500">
                      <Truck className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                      No inter-store transfers recorded yet.
                    </td>
                  </tr>
                ) : (
                  stockTransfers.map((trf) => (
                    <tr key={trf.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-3 px-4 font-mono font-semibold text-blue-700">
                        {trf.transferNumber}
                      </td>

                      <td className="py-3 px-3 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{trf.sourceStoreName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-800 font-medium">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-slate-400" />
                          <span>{trf.destinationStoreName}</span>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        {trf.items.map((it, idx) => (
                          <div key={idx} className="font-semibold text-slate-900">
                            {it.productName} ({it.quantity} {it.unit})
                          </div>
                        ))}
                      </td>

                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                            trf.status === 'Completed' || trf.status === 'Received'
                              ? 'bg-emerald-100 text-emerald-800'
                              : trf.status === 'Cancelled'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {trf.status === 'Completed' || trf.status === 'Received' ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : trf.status === 'Cancelled' ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {trf.status}
                        </span>
                      </td>

                      <td className="py-3 px-3 text-slate-500">
                        {new Date(trf.dispatchedAt).toLocaleDateString('en-IN')}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {(trf.status === 'In-Transit' || trf.status === 'In Transit' || trf.status === 'Approved' || trf.status === 'Pending') && (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleCompleteTransfer(trf)}
                              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-xs"
                            >
                              <Check className="h-3 w-3" />
                              Receive
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCancelTransfer(trf)}
                              className="inline-flex items-center gap-1 rounded-md bg-rose-50 border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
                              title="Cancel transfer & reverse stock"
                            >
                              <X className="h-3 w-3" />
                              Cancel
                            </button>
                          </div>
                        )}
                        {(trf.status === 'Completed' || trf.status === 'Received') && (
                          <span className="text-[11px] font-medium text-emerald-700">Received</span>
                        )}
                        {trf.status === 'Cancelled' && (
                          <span className="text-[11px] font-medium text-rose-600">Cancelled</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Audits Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {stockAudits.map((audit) => {
            const totalVariance = audit.items.reduce((acc, i) => acc + i.variance, 0);

            return (
              <div key={audit.id} className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-purple-700 text-sm">{audit.auditNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        audit.status === 'Reconciled' ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                      }`}>
                        {audit.status}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Warehouse: <strong className="text-slate-800">{audit.storeName}</strong> • Conducted on {audit.auditDate}
                    </div>
                  </div>

                  {audit.status === 'In-Progress' && (
                    <button
                      type="button"
                      onClick={() => reconcileStockAudit(audit.id)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Reconcile Discrepancies to Ledger
                    </button>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="py-2 px-3 font-semibold">SKU & Item</th>
                        <th className="py-2 px-3 font-semibold text-center">System Ledger Stock</th>
                        <th className="py-2 px-3 font-semibold text-center">Physical Counted Stock</th>
                        <th className="py-2 px-3 font-semibold text-center">Variance / Discrepancy</th>
                        <th className="py-2 px-3 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {audit.items.map((item, idx) => (
                        <tr key={idx}>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-slate-900">{item.productName}</span>{' '}
                            <span className="font-mono text-slate-400">({item.sku})</span>
                          </td>
                          <td className="py-2 px-3 text-center text-slate-700">
                            {item.systemStock} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-center font-bold text-slate-900">
                            {item.physicalCount} {item.unit}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {item.variance === 0 ? (
                              <span className="text-emerald-600 font-semibold">0 (Exact)</span>
                            ) : item.variance > 0 ? (
                              <span className="text-blue-600 font-bold">+{item.variance} (Surplus)</span>
                            ) : (
                              <span className="text-rose-600 font-bold">{item.variance} (Shortage)</span>
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {item.reconciled ? (
                              <span className="text-[11px] text-emerald-700 font-medium">Reconciled</span>
                            ) : (
                              <span className="text-[11px] text-amber-700 font-medium">Pending Sync</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Transfer Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="h-5 w-5 text-blue-600" />
                Inter-Warehouse Stock Transfer
              </h3>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInitiateTransfer} className="p-6 space-y-4 text-xs">
              {transferError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                  {transferError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source Store *</label>
                  <select
                    value={sourceStoreId}
                    onChange={(e) => setSourceStoreId(e.target.value)}
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
                  <label className="block font-semibold text-slate-700 mb-1">Destination Store *</label>
                  <select
                    value={destStoreId}
                    onChange={(e) => setDestStoreId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Item to Transfer *</label>
                <select
                  value={transferProductId}
                  onChange={(e) => setTransferProductId(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.sku}) — Available: {p.availableStock} {p.unit}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Quantity ({selectedTransferProduct?.unit || 'Units'}) *
                </label>
                <input
                  type="number"
                  min="1"
                  value={transferQty}
                  onChange={(e) => setTransferQty(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-lg border border-slate-300 p-2 font-bold focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Remarks / Vehicle</label>
                <input
                  type="text"
                  value={transferRemarks}
                  onChange={(e) => setTransferRemarks(e.target.value)}
                  placeholder="e.g. Dispatched via Logistics Van KA-04-E-1192"
                  className="w-full rounded-lg border border-slate-300 p-2 focus:border-blue-500 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-blue-700"
                >
                  Dispatch Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Audit Modal */}
      {isAuditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5 text-purple-600" />
                Physical Stock Count & Audit Sheet
              </h3>
              <button
                type="button"
                onClick={() => setIsAuditModalOpen(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleStartAudit} className="p-6 space-y-4 text-xs overflow-y-auto flex-1 custom-scrollbar">
              {auditError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                  {auditError}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Target Warehouse *</label>
                  <select
                    value={auditStoreId}
                    onChange={(e) => setAuditStoreId(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-purple-500 focus:outline-hidden"
                  >
                    {stores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Audit Name / Notes</label>
                  <input
                    type="text"
                    value={auditRemarks}
                    onChange={(e) => setAuditRemarks(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 p-2 focus:border-purple-500 focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold uppercase tracking-wider text-slate-600 mb-2">
                  Verify Physical Stock in Hand
                </label>
                <div className="space-y-2">
                  {products.map((p) => {
                    const sysStock = p.storeStocks?.[auditStoreId]?.physicalStock || 0;
                    const enteredCount = auditCounts[p.id] !== undefined ? auditCounts[p.id] : sysStock;

                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg border border-slate-200 p-2.5 bg-slate-50/50"
                      >
                        <div>
                          <div className="font-semibold text-slate-900">{p.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">
                            {p.sku} • System Stock: {sysStock} {p.unit}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <label className="text-[11px] text-slate-600">Physical Count:</label>
                          <input
                            type="number"
                            min="0"
                            value={enteredCount}
                            onChange={(e) =>
                              setAuditCounts({
                                ...auditCounts,
                                [p.id]: Math.max(0, Number(e.target.value)),
                              })
                            }
                            className="w-20 rounded-md border border-slate-300 bg-white p-1 text-center font-bold text-xs focus:border-purple-500 focus:outline-hidden"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAuditModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-purple-600 px-5 py-2 font-semibold text-white shadow-xs hover:bg-purple-700"
                >
                  Save Stock Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
