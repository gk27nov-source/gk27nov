import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { InventoryDashboard } from './InventoryDashboard';
import { ProductMasterView } from './ProductMasterView';
import { StockTransactionsView } from './StockTransactionsView';
import { StoresView } from './StoresView';
import { StockInView } from './StockInView';
import { StockOutView } from './StockOutView';
import { StockTransferAuditView } from './StockTransferAuditView';
import { InventoryReportsView } from './InventoryReportsView';
import { CreateStockTransactionModal } from './CreateStockTransactionModal';
import { Product } from '../../types/inventory';
import {
  LayoutDashboard,
  Boxes,
  ArrowUpDown,
  Building2,
  ShoppingCart,
  ArrowUpRight,
  ArrowRightLeft,
  FileSpreadsheet,
  Plus,
} from 'lucide-react';

export const InventoryModule: React.FC = () => {
  const { activeInventoryTab, setActiveInventoryTab, products, stores, stockTransactions } = useInventory();
  const [isTransactionModalOpen, setIsTransactionModalOpen] = useState(false);
  const [selectedProductForTxn, setSelectedProductForTxn] = useState<Product | null>(null);

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'products', label: 'Product Master', icon: Boxes },
    { id: 'transactions', label: 'Stock Ledger', icon: ArrowUpDown },
    { id: 'stores', label: 'Warehouses', icon: Building2 },
    { id: 'stock_in', label: 'Stock In (PO/GRN)', icon: ShoppingCart },
    { id: 'stock_out', label: 'Stock Out', icon: ArrowUpRight },
    { id: 'transfers', label: 'Transfers & Audits', icon: ArrowRightLeft },
    { id: 'reports', label: 'Valuation Reports', icon: FileSpreadsheet },
  ] as const;

  const handleOpenTransaction = (product?: Product) => {
    setSelectedProductForTxn(product || null);
    setIsTransactionModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Sub-navigation bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeInventoryTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveInventoryTab(tab.id as any)}
                className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => handleOpenTransaction()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-slate-800 transition-colors"
        >
          <ArrowUpDown className="h-4 w-4 text-blue-400" />
          <span>Record Stock Movement</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div>
        {activeInventoryTab === 'dashboard' && (
          <InventoryDashboard onNavigateTab={(tab) => setActiveInventoryTab(tab as any)} />
        )}

        {activeInventoryTab === 'products' && (
          <ProductMasterView onOpenTransactionModal={(p) => handleOpenTransaction(p)} />
        )}

        {activeInventoryTab === 'transactions' && (
          <StockTransactionsView onOpenNewTransaction={() => handleOpenTransaction()} />
        )}

        {activeInventoryTab === 'stores' && <StoresView />}

        {activeInventoryTab === 'stock_in' && <StockInView />}

        {activeInventoryTab === 'stock_out' && (
          <StockOutView onOpenIssueModal={() => handleOpenTransaction()} />
        )}

        {activeInventoryTab === 'transfers' && <StockTransferAuditView />}

        {activeInventoryTab === 'reports' && <InventoryReportsView />}
      </div>

      {/* Global Transaction Modal */}
      <CreateStockTransactionModal
        isOpen={isTransactionModalOpen}
        onClose={() => {
          setIsTransactionModalOpen(false);
          setSelectedProductForTxn(null);
        }}
        preselectedProduct={selectedProductForTxn}
      />
    </div>
  );
};
