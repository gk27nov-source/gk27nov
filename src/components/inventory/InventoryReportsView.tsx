import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import {
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Building2,
  TrendingUp,
  Package,
  Boxes,
  PieChart as PieChartIcon,
  BarChart3,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

export const InventoryReportsView: React.FC = () => {
  const { products, stores, stockTransactions, categories } = useInventory();
  const [reportType, setReportType] = useState<'valuation' | 'low_stock' | 'store_wise' | 'movement'>('valuation');

  // Total valuation
  const totalValuation = products.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
  const totalUnits = products.reduce((acc, p) => acc + p.currentStock, 0);

  // Category breakdown for chart
  const categoryChartData = categories.map((cat) => {
    const catProducts = products.filter((p) => p.category === cat.name);
    const value = catProducts.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
    const units = catProducts.reduce((acc, p) => acc + p.currentStock, 0);
    return {
      name: cat.name,
      value,
      units,
    };
  });

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  // Store-wise chart data
  const storeChartData = stores.map((s) => {
    let storeUnits = 0;
    let storeValue = 0;

    products.forEach((p) => {
      const stock = p.storeStocks?.[s.id]?.physicalStock || 0;
      storeUnits += stock;
      storeValue += stock * p.purchasePrice;
    });

    return {
      name: s.name.replace(' Warehouse', '').replace(' Regional Hub', ''),
      units: storeUnits,
      value: storeValue,
    };
  });

  // Low stock products
  const lowStockProducts = products.filter((p) => p.currentStock <= p.reorderLevel);

  // Export report
  const handleExportReport = () => {
    const headers = [
      'SKU',
      'Item Name',
      'Category',
      'Current Stock',
      'Unit',
      'Reorder Level',
      'Purchase Price',
      'Inventory Value',
      'Storage Location',
    ];

    const rows = products.map((p) => [
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      p.currentStock,
      p.unit,
      p.reorderLevel,
      p.purchasePrice,
      p.currentStock * p.purchasePrice,
      `"${p.storageLocation || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Inventory_Valuation_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Inventory Analytics & Valuation Reports
          </h2>
          <p className="text-xs text-slate-500">
            Comprehensive financial valuation, stock-turnover ratios, and warehouse reorder analytics
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportReport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
        >
          <Download className="h-4 w-4 text-slate-500" />
          Export Valuation Report
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Total Capital in Stock</span>
          <div className="mt-1 text-xl font-bold text-emerald-700">
            ₹{totalValuation.toLocaleString('en-IN')}
          </div>
          <span className="text-[11px] text-slate-400">At weighted purchase cost</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Physical Stock Count</span>
          <div className="mt-1 text-xl font-bold text-slate-900">
            {totalUnits.toLocaleString('en-IN')} units
          </div>
          <span className="text-[11px] text-slate-400">Across {products.length} catalog SKUs</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Replenishment Alerts</span>
          <div className="mt-1 text-xl font-bold text-amber-600">
            {lowStockProducts.length} items
          </div>
          <span className="text-[11px] text-amber-600 font-medium">Require immediate PO creation</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-xs font-medium text-slate-500">Active Storage Locations</span>
          <div className="mt-1 text-xl font-bold text-blue-600">
            {stores.length} Depots
          </div>
          <span className="text-[11px] text-slate-400">Central & regional fulfillment</span>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Category Valuation Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-blue-600" />
            Inventory Capital by Product Category
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Financial capital distribution across electrical, hardware, and automation items
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryChartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {categoryChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Valuation']}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Store Breakdown Chart */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-emerald-600" />
            Warehouse Depot Stock Holding Comparison
          </h3>
          <p className="text-xs text-slate-500 mb-4">
            Total physical inventory volume deployed in each distribution facility
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={storeChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(val: any, name: string) => [
                    name === 'units' ? `${val} Units` : `₹${Number(val).toLocaleString('en-IN')}`,
                    name === 'units' ? 'Physical Units' : 'Valuation',
                  ]}
                />
                <Bar dataKey="units" fill="#2563eb" radius={[6, 6, 0, 0]} name="units" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Critical Replenishment Schedule Table */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Stock Replenishment & Reorder Priority List
            </h3>
            <p className="text-xs text-slate-500">
              SKUs that have reached or fallen below safety stock thresholds
            </p>
          </div>
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            {lowStockProducts.length} Items Critical
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">SKU & Item</th>
                <th className="py-2.5 px-3 font-semibold">Category</th>
                <th className="py-2.5 px-3 font-semibold text-center">Physical Stock</th>
                <th className="py-2.5 px-3 font-semibold text-center">Reorder Threshold</th>
                <th className="py-2.5 px-3 font-semibold text-center">Deficit Units</th>
                <th className="py-2.5 px-3 font-semibold">Preferred Supplier</th>
                <th className="py-2.5 px-3 font-semibold text-right">Unit Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lowStockProducts.map((p) => {
                const deficit = Math.max(0, p.reorderLevel - p.currentStock + 10);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="font-mono text-[11px] text-slate-500">{p.sku}</div>
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{p.category}</td>
                    <td className="py-2.5 px-3 text-center">
                      <span className={`font-bold ${p.currentStock === 0 ? 'text-red-600' : 'text-amber-600'}`}>
                        {p.currentStock} {p.unit}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-center text-slate-700">
                      {p.reorderLevel} {p.unit}
                    </td>
                    <td className="py-2.5 px-3 text-center font-bold text-rose-700">
                      +{deficit} units needed
                    </td>
                    <td className="py-2.5 px-3 text-slate-700">{p.supplierName || 'Primary Vendor'}</td>
                    <td className="py-2.5 px-3 text-right font-medium text-slate-900">
                      ₹{p.purchasePrice.toLocaleString('en-IN')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
