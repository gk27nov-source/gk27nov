import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { WarehouseStore } from '../../types/inventory';
import { AddStoreModal } from './AddStoreModal';
import {
  Building2,
  Plus,
  MapPin,
  User,
  Phone,
  Mail,
  Boxes,
  TrendingUp,
  ShieldCheck,
  Edit2,
  Package,
  ChevronRight,
} from 'lucide-react';

export const StoresView: React.FC = () => {
  const { stores, products } = useInventory();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<WarehouseStore | null>(null);
  const [inspectedStore, setInspectedStore] = useState<WarehouseStore | null>(null);

  // Compute store stock stats
  const storeStats = React.useMemo(() => {
    return stores.map((store) => {
      const storedProducts = products
        .map((p) => {
          const sStock = p.storeStocks?.[store.id];
          const physical = sStock?.physicalStock || 0;
          return {
            product: p,
            physicalStock: physical,
            availableStock: sStock?.availableStock || physical,
            storageLocation: sStock?.storageLocation || p.storageLocation || 'Bay 1',
            value: physical * p.purchasePrice,
          };
        })
        .filter((item) => item.physicalStock > 0);

      const totalQty = storedProducts.reduce((acc, item) => acc + item.physicalStock, 0);
      const totalVal = storedProducts.reduce((acc, item) => acc + item.value, 0);

      return {
        store,
        storedProducts,
        totalQty,
        totalVal,
        skuCount: storedProducts.length,
      };
    });
  }, [stores, products]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Store & Warehouse Management
          </h2>
          <p className="text-xs text-slate-500">
            Multi-depot inventory locations, fulfillment hubs, regional stock holdings, and managers
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingStore(null);
            setIsAddModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Warehouse / Store
        </button>
      </div>

      {/* Stores Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-2">
        {storeStats.map(({ store, storedProducts, totalQty, totalVal, skuCount }) => (
          <div
            key={store.id}
            className={`rounded-2xl border bg-white p-6 shadow-xs transition-all hover:shadow-md ${
              store.isMainWarehouse ? 'border-blue-300 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            {/* Store Top */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl font-bold ${
                  store.isMainWarehouse ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700'
                }`}>
                  <Building2 className="h-6 w-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-slate-900">{store.name}</h3>
                    {store.isMainWarehouse && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold text-blue-800">
                        <ShieldCheck className="h-3 w-3" />
                        Main Hub
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                    <span>{store.storeCode}</span>
                    <span>•</span>
                    <span className="text-slate-600">{store.city}, {store.state}</span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setEditingStore(store);
                  setIsAddModalOpen(true);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                <Edit2 className="h-4 w-4" />
              </button>
            </div>

            {/* Metrics */}
            <div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 border border-slate-100">
              <div>
                <span className="text-[11px] font-medium text-slate-500">Total Stock Holding</span>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {totalQty.toLocaleString('en-IN')} <span className="text-xs font-normal text-slate-500">units ({skuCount} SKUs)</span>
                </div>
              </div>
              <div>
                <span className="text-[11px] font-medium text-slate-500">Inventory Valuation</span>
                <div className="text-base font-bold text-emerald-700 mt-0.5">
                  ₹{totalVal.toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            {/* Manager Contact & Address */}
            <div className="mt-4 space-y-2 text-xs text-slate-600 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                <span className="truncate">{store.address}, {store.city} - {store.pincode}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>Manager: <strong className="text-slate-800 font-semibold">{store.managerName || 'Operations In-charge'}</strong></span>
                </div>
                {store.contactPhone && (
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-500">
                    <Phone className="h-3 w-3" />
                    <span>{store.contactPhone}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Inspect Inventory Button */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {storedProducts.length > 0 ? `${storedProducts.length} unique catalog items in stock` : 'No physical stock presently held'}
              </span>
              <button
                type="button"
                onClick={() => setInspectedStore(store)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Inspect Stock
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Inspected Store Stock Items Modal / Drawer */}
      {inspectedStore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {inspectedStore.name} — Stock Ledger
                </h3>
                <p className="text-xs text-slate-500">
                  {inspectedStore.storeCode} • {inspectedStore.city} • Manager: {inspectedStore.managerName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setInspectedStore(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700"
              >
                ✕
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">SKU / Item</th>
                    <th className="py-2.5 px-3 font-semibold">Bay / Shelf</th>
                    <th className="py-2.5 px-3 font-semibold text-center">Physical Stock</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Valuation (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {products
                    .filter((p) => (p.storeStocks?.[inspectedStore.id]?.physicalStock || 0) > 0)
                    .map((prod) => {
                      const qty = prod.storeStocks?.[inspectedStore.id]?.physicalStock || 0;
                      const loc = prod.storeStocks?.[inspectedStore.id]?.storageLocation || prod.storageLocation || 'Main Aisle';
                      const val = qty * prod.purchasePrice;
                      return (
                        <tr key={prod.id} className="hover:bg-slate-50/60">
                          <td className="py-2.5 px-3">
                            <div className="font-semibold text-slate-900">{prod.name}</div>
                            <div className="font-mono text-[11px] text-slate-500">{prod.sku}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">{loc}</td>
                          <td className="py-2.5 px-3 text-center font-bold text-slate-900">
                            {qty} {prod.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-semibold text-emerald-700">
                            ₹{val.toLocaleString('en-IN')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-3 text-right">
              <button
                type="button"
                onClick={() => setInspectedStore(null)}
                className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Store Modal */}
      <AddStoreModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingStore(null);
        }}
        storeToEdit={editingStore}
      />
    </div>
  );
};
