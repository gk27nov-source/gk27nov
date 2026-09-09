import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { StockTransaction } from '../../types/inventory';
import {
  ArrowUpDown,
  ArrowDownRight,
  ArrowUpRight,
  Search,
  Filter,
  Download,
  Calendar,
  Building2,
  Package,
  User,
  FileText,
  FileCheck,
  CheckCircle2,
} from 'lucide-react';

interface StockTransactionsViewProps {
  onOpenNewTransaction?: () => void;
}

export const StockTransactionsView: React.FC<StockTransactionsViewProps> = ({
  onOpenNewTransaction,
}) => {
  const { stockTransactions, stores, products } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState<'all' | 'in' | 'out'>('all');
  const [selectedStore, setSelectedStore] = useState('all');
  const [activeTransaction, setActiveTransaction] = useState<StockTransaction | null>(null);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return stockTransactions.filter((txn) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        txn.transactionNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.productName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (txn.referenceNumber && txn.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase())) ||
        txn.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        txn.remarks.toLowerCase().includes(searchQuery.toLowerCase());

      // Type
      const matchesType = selectedType === 'all' || txn.type === selectedType;

      // Direction
      const matchesDirection = selectedDirection === 'all' || txn.direction === selectedDirection;

      // Store
      const matchesStore =
        selectedStore === 'all' ||
        txn.sourceStoreId === selectedStore ||
        txn.destinationStoreId === selectedStore;

      return matchesSearch && matchesType && matchesDirection && matchesStore;
    });
  }, [stockTransactions, searchQuery, selectedType, selectedDirection, selectedStore]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'Transaction ID',
      'Date & Time',
      'Type',
      'Direction',
      'SKU',
      'Product Name',
      'Quantity',
      'Unit',
      'Unit Price (INR)',
      'Total Value (INR)',
      'Source Store',
      'Destination Store',
      'Ref Type',
      'Ref Number',
      'Previous Stock',
      'New Stock',
      'User',
      'Remarks',
    ];

    const rows = filteredTransactions.map((t) => [
      `"${t.transactionNumber}"`,
      `"${t.timestamp}"`,
      `"${t.type}"`,
      t.direction.toUpperCase(),
      `"${t.sku}"`,
      `"${t.productName.replace(/"/g, '""')}"`,
      t.quantity,
      t.unit,
      t.unitPrice,
      t.totalValue,
      `"${t.sourceStoreName || ''}"`,
      `"${t.destinationStoreName || ''}"`,
      t.referenceType,
      `"${t.referenceNumber || ''}"`,
      t.previousStock,
      t.newStock,
      `"${t.userName}"`,
      `"${t.remarks.replace(/"/g, '""')}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Stock_Transactions_Ledger_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const typesList = [
    'Opening Stock',
    'Purchase',
    'Sale',
    'Stock Issue',
    'Stock Receipt',
    'Stock Transfer',
    'Stock Adjustment',
    'Damaged Stock',
    'Expired Stock',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-blue-600" />
            Stock Ledger & Audit Transactions
          </h2>
          <p className="text-xs text-slate-500">
            Immutable log of all physical inventory movements, debit issues, credit receipts, and adjustments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export Ledger
          </button>

          {onOpenNewTransaction && (
            <button
              type="button"
              onClick={onOpenNewTransaction}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
            >
              <ArrowUpDown className="h-4 w-4" />
              New Transaction Entry
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by transaction ID, product, SKU, reference, user, remarks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Direction Filter */}
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setSelectedDirection('all')}
              className={`rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedDirection === 'all' ? 'bg-white text-slate-900 shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedDirection('in')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedDirection === 'in' ? 'bg-emerald-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowDownRight className="h-3 w-3" />
              Receipts (In)
            </button>
            <button
              type="button"
              onClick={() => setSelectedDirection('out')}
              className={`flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition-all ${
                selectedDirection === 'out' ? 'bg-rose-600 text-white shadow-xs font-semibold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="h-3 w-3" />
              Issues (Out)
            </button>
          </div>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Movement Types</option>
            {typesList.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Warehouse Store Filter */}
          <select
            value={selectedStore}
            onChange={(e) => setSelectedStore(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Warehouses / Depots</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">Txn ID & Date</th>
                <th className="py-3 px-3 font-semibold">Type</th>
                <th className="py-3 px-3 font-semibold">Product & SKU</th>
                <th className="py-3 px-3 font-semibold text-center">Movement Qty</th>
                <th className="py-3 px-3 font-semibold text-center">Stock Balance</th>
                <th className="py-3 px-3 font-semibold text-right">Value (INR)</th>
                <th className="py-3 px-3 font-semibold">Warehouse / Store</th>
                <th className="py-3 px-3 font-semibold">Ref Document</th>
                <th className="py-3 px-3 font-semibold">User</th>
                <th className="py-3 px-4 font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    <ArrowUpDown className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No stock transactions match the specified filter criteria.
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((txn) => {
                  const isIn = txn.direction === 'in';
                  return (
                    <tr
                      key={txn.id}
                      onClick={() => setActiveTransaction(txn)}
                      className="hover:bg-slate-50/80 cursor-pointer transition-colors"
                    >
                      {/* Txn ID & Date */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-semibold text-blue-700">
                          {txn.transactionNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(txn.timestamp).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </td>

                      {/* Type Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isIn ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {isIn ? <ArrowDownRight className="h-3 w-3" /> : <ArrowUpRight className="h-3 w-3" />}
                          {txn.type}
                        </span>
                      </td>

                      {/* Product Name & SKU */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 max-w-[200px] truncate">
                          {txn.productName}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">{txn.sku}</div>
                      </td>

                      {/* Movement Qty */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`text-sm font-bold ${
                            isIn ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {isIn ? '+' : '-'}{txn.quantity} {txn.unit}
                        </span>
                      </td>

                      {/* Stock Balance Evolution */}
                      <td className="py-3 px-3 text-center text-[11px] text-slate-600">
                        <span className="text-slate-400">{txn.previousStock}</span>
                        <span className="mx-1 text-slate-300">→</span>
                        <strong className="font-bold text-slate-900">{txn.newStock} {txn.unit}</strong>
                      </td>

                      {/* Value */}
                      <td className="py-3 px-3 text-right font-medium text-slate-800">
                        ₹{(txn.totalValue || 0).toLocaleString('en-IN')}
                      </td>

                      {/* Store */}
                      <td className="py-3 px-3 text-slate-700">
                        <div className="flex items-center gap-1 text-[11px]">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{txn.destinationStoreName || txn.sourceStoreName || 'Central Warehouse'}</span>
                        </div>
                      </td>

                      {/* Reference Document */}
                      <td className="py-3 px-3">
                        {txn.referenceNumber ? (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-800">
                            {txn.referenceNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* User */}
                      <td className="py-3 px-3 text-slate-600 text-[11px]">
                        {txn.userName}
                      </td>

                      {/* Remarks */}
                      <td className="py-3 px-4 text-slate-600 max-w-[220px] truncate text-[11px]">
                        {txn.remarks}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing <strong className="font-semibold text-slate-800">{filteredTransactions.length}</strong> of{' '}
            <strong className="font-semibold text-slate-800">{stockTransactions.length}</strong> ledger records
          </div>
          <div className="flex items-center gap-4">
            <span className="text-emerald-700 font-semibold">
              Receipts: +{filteredTransactions.filter((t) => t.direction === 'in').reduce((acc, t) => acc + t.quantity, 0)} units
            </span>
            <span className="text-rose-700 font-semibold">
              Issues: -{filteredTransactions.filter((t) => t.direction === 'out').reduce((acc, t) => acc + t.quantity, 0)} units
            </span>
          </div>
        </div>
      </div>

      {/* Transaction Detail Modal */}
      {activeTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                  activeTransaction.direction === 'in' ? 'bg-emerald-600' : 'bg-rose-600'
                }`}>
                  {activeTransaction.direction === 'in' ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Transaction {activeTransaction.transactionNumber}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeTransaction.type} • {activeTransaction.direction.toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveTransaction(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="font-semibold text-slate-900 text-sm">{activeTransaction.productName}</div>
                <div className="font-mono text-slate-500 mt-0.5">SKU: {activeTransaction.sku}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-slate-500">Movement Quantity</div>
                  <div className={`text-base font-bold ${activeTransaction.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {activeTransaction.direction === 'in' ? '+' : '-'}{activeTransaction.quantity} {activeTransaction.unit}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500">Total Transaction Value</div>
                  <div className="text-base font-bold text-slate-900">
                    ₹{activeTransaction.totalValue.toLocaleString('en-IN')}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500">Stock Before / After</div>
                  <div className="font-medium text-slate-800">
                    {activeTransaction.previousStock} {activeTransaction.unit} → <strong className="font-bold">{activeTransaction.newStock} {activeTransaction.unit}</strong>
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500">Warehouse Location</div>
                  <div className="font-medium text-slate-800">
                    {activeTransaction.destinationStoreName || activeTransaction.sourceStoreName || 'Central Warehouse'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500">Reference Type & No.</div>
                  <div className="font-mono font-medium text-blue-700">
                    {activeTransaction.referenceType}: {activeTransaction.referenceNumber || 'N/A'}
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="text-slate-500">Authorized Operator</div>
                  <div className="font-medium text-slate-800">
                    {activeTransaction.userName}
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100">
                <div className="text-slate-500 mb-1 font-medium">Audit Remarks:</div>
                <div className="rounded-lg bg-slate-50 p-3 text-slate-800 italic">
                  "{activeTransaction.remarks}"
                </div>
              </div>

              <div className="text-[11px] text-slate-400 text-right pt-2">
                Recorded at: {new Date(activeTransaction.timestamp).toLocaleString('en-IN')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
