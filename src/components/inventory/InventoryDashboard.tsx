import React from 'react';
import { useInventory } from '../../context/InventoryContext';
import { useApp } from '../../context/AppContext';
import {
  Package,
  AlertTriangle,
  XCircle,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Truck,
  ShoppingCart,
  RefreshCw,
  Clock,
  Layers,
  Building2,
  FileCheck,
  ChevronRight,
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
  AreaChart,
  Area,
} from 'recharts';

export const InventoryDashboard: React.FC = () => {
  const {
    products,
    categories,
    stores,
    stockTransactions,
    purchaseOrders,
    lowStockProducts,
    outOfStockProducts,
    totalStockQuantity,
    totalStockValue,
    pendingPurchaseOrdersCount,
    setActiveInventoryTab,
    setSelectedStoreFilter,
  } = useInventory();

  const { currentOrg } = useApp();

  // Stock value by Category
  const categoryValueData = React.useMemo(() => {
    return categories.map((cat) => {
      const catProducts = products.filter((p) => p.category === cat.name);
      const totalVal = catProducts.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0);
      const totalQty = catProducts.reduce((acc, p) => acc + p.currentStock, 0);
      return {
        name: cat.name.split('&')[0].trim(),
        value: totalVal,
        quantity: totalQty,
        productCount: catProducts.length,
      };
    }).filter((d) => d.value > 0 || d.productCount > 0);
  }, [categories, products]);

  // Warehouse store distribution
  const storeDistributionData = React.useMemo(() => {
    return stores.map((store) => {
      let storeQty = 0;
      let storeVal = 0;
      products.forEach((p) => {
        const sLevel = p.storeStocks?.[store.id]?.physicalStock || 0;
        storeQty += sLevel;
        storeVal += sLevel * p.purchasePrice;
      });
      return {
        name: store.name.split(' ')[0],
        fullName: store.name,
        quantity: storeQty,
        value: storeVal,
      };
    });
  }, [stores, products]);

  // Stock In vs Stock Out trend (past 7 days or sample dates)
  const stockMovementData = [
    { day: 'Mon', inQty: 18, outQty: 8, valIn: 145000, valOut: 72000 },
    { day: 'Tue', inQty: 32, outQty: 14, valIn: 210000, valOut: 115000 },
    { day: 'Wed', inQty: 10, outQty: 22, valIn: 85000, valOut: 168000 },
    { day: 'Thu', inQty: 45, outQty: 19, valIn: 380000, valOut: 142000 },
    { day: 'Fri', inQty: 25, outQty: 28, valIn: 195000, valOut: 215000 },
    { day: 'Sat', inQty: 12, outQty: 15, valIn: 98000, valOut: 89000 },
    { day: 'Sun', inQty: 0, outQty: 4, valIn: 0, valOut: 24000 },
  ];

  const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

  const recentTransactions = stockTransactions.slice(0, 7);

  return (
    <div className="space-y-6 pb-12">
      {/* Top Banner with Alert if critical stock items exist */}
      {(outOfStockProducts.length > 0 || lowStockProducts.length > 0) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-amber-900">
                  Inventory Replenishment Notice
                </h2>
                <p className="text-xs text-amber-700">
                  <strong className="font-semibold">{outOfStockProducts.length}</strong> items are out of stock and{' '}
                  <strong className="font-semibold">{lowStockProducts.length}</strong> items are below reorder threshold.
                  Automated webhooks and low-stock triggers are active.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveInventoryTab('products')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-xs hover:bg-amber-700 transition-colors"
              >
                Review Items
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setActiveInventoryTab('purchase-orders')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-medium text-amber-900 hover:bg-amber-100/50 transition-colors"
              >
                Generate PO
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Products */}
        <div
          id="kpi-total-products"
          onClick={() => setActiveInventoryTab('products')}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-blue-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Catalog SKUs
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Package className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {products.length}
            </span>
            <span className="text-xs font-medium text-slate-500">
              across {categories.length} categories
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Physical Stock Units:</span>
            <span className="font-semibold text-slate-800">{totalStockQuantity.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Stock Valuation */}
        <div
          id="kpi-stock-value"
          onClick={() => setActiveInventoryTab('reports')}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-emerald-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Inventory Value (INR)
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-emerald-700">
              ₹{totalStockValue.toLocaleString('en-IN')}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Across {stores.length} Depots / Stores</span>
            <span className="font-semibold text-emerald-600">Active Valuation</span>
          </div>
        </div>

        {/* Stock Alerts (Low & Out) */}
        <div
          id="kpi-stock-alerts"
          onClick={() => setActiveInventoryTab('products')}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-amber-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Stock Warnings
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-3">
            <div>
              <span className="text-2xl font-bold tracking-tight text-amber-600">
                {lowStockProducts.length}
              </span>
              <span className="ml-1 text-xs text-slate-500">Low</span>
            </div>
            <div className="border-l border-slate-200 pl-3">
              <span className="text-2xl font-bold tracking-tight text-red-600">
                {outOfStockProducts.length}
              </span>
              <span className="ml-1 text-xs text-slate-500">Stockout</span>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Reorder Thresholds:</span>
            <span className="font-semibold text-amber-700">Action Needed</span>
          </div>
        </div>

        {/* Purchase Orders Pending */}
        <div
          id="kpi-purchase-orders"
          onClick={() => setActiveInventoryTab('purchase-orders')}
          className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-indigo-300 hover:shadow-md"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Pending Purchases
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-indigo-700">
              {pendingPurchaseOrdersCount}
            </span>
            <span className="text-xs font-medium text-slate-500">POs Awaiting Receipt</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-500">
            <span>Total POs Issued:</span>
            <span className="font-semibold text-slate-800">{purchaseOrders.length}</span>
          </div>
        </div>
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Chart: Stock In vs Stock Out Movement */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-8">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Stock Movements: Receipts vs Consumptions
              </h3>
              <p className="text-xs text-slate-500">
                Weekly velocity of goods received (PO / GRN) vs sales dispatch & service tickets
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                <span className="text-slate-600">Stock Receipts (In)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Stock Issues (Out)</span>
              </div>
            </div>
          </div>

          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stockMovementData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                <Tooltip
                  formatter={(value: any, name: any) => [
                    `${value} units`,
                    name === 'inQty' ? 'Stock In (Purchases/Receipts)' : 'Stock Out (Sales/Tickets)',
                  ]}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                />
                <Area type="monotone" dataKey="inQty" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorIn)" />
                <Area type="monotone" dataKey="outQty" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOut)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Chart: Valuation by Category */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-4 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Stock Valuation by Category
            </h3>
            <p className="text-xs text-slate-500">
              Capital distribution across product classifications
            </p>
          </div>

          <div className="h-56 w-full my-2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryValueData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {categoryValueData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Stock Value']}
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-1.5 pt-2 border-t border-slate-100">
            {categoryValueData.slice(0, 4).map((cat, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="text-slate-600 truncate max-w-[130px]">{cat.name}</span>
                </div>
                <span className="font-semibold text-slate-800">₹{cat.value.toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Warehouse Distribution & Low Stock Table Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Warehouse Storage Breakdown */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Warehouse / Store Distribution
              </h3>
              <p className="text-xs text-slate-500">
                Stock volume and location holding values
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveInventoryTab('stores')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              View All
            </button>
          </div>

          <div className="mt-4 divide-y divide-slate-100">
            {storeDistributionData.map((st, idx) => {
              const pct = totalStockQuantity > 0 ? Math.round((st.quantity / totalStockQuantity) * 100) : 0;
              return (
                <div key={idx} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-slate-400" />
                      <span className="font-medium text-slate-800">{st.fullName}</span>
                    </div>
                    <span className="font-semibold text-slate-900">
                      ₹{st.value.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-medium text-slate-600">
                      {st.quantity} units ({pct}%)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs lg:col-span-7">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Reorder Threshold & Stock Alert Watchlist
              </h3>
              <p className="text-xs text-slate-500">
                Items requiring immediate purchase order placement
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveInventoryTab('products')}
              className="text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              Manage Catalog
            </button>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">SKU / Item</th>
                  <th className="py-2.5 px-3 font-semibold">Physical Stock</th>
                  <th className="py-2.5 px-3 font-semibold">Reorder Level</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {[...outOfStockProducts, ...lowStockProducts].slice(0, 5).map((prod) => {
                  const isZero = prod.currentStock <= 0;
                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3">
                        <div className="font-medium text-slate-900 line-clamp-1">{prod.name}</div>
                        <div className="font-mono text-[11px] text-slate-500">{prod.sku}</div>
                      </td>
                      <td className="py-2.5 px-3 font-bold">
                        <span className={isZero ? 'text-red-600' : 'text-amber-600'}>
                          {prod.currentStock} {prod.unit}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {prod.reorderLevel} {prod.unit}
                      </td>
                      <td className="py-2.5 px-3">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            <XCircle className="h-3 w-3" />
                            Out of Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => setActiveInventoryTab('purchase-orders')}
                          className="rounded-md bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 hover:bg-blue-600 hover:text-white transition-colors"
                        >
                          Order
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Recent Stock Transactions Ledger */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Live Stock Transactions Ledger
            </h3>
            <p className="text-xs text-slate-500">
              Complete audit trail of inventory debits, credits, transfers, and adjustments
            </p>
          </div>
          <button
            type="button"
            onClick={() => setActiveInventoryTab('transactions')}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            View Full Ledger
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-slate-500">
              <tr>
                <th className="py-2.5 px-3 font-semibold">Txn ID</th>
                <th className="py-2.5 px-3 font-semibold">Type</th>
                <th className="py-2.5 px-3 font-semibold">Product / SKU</th>
                <th className="py-2.5 px-3 font-semibold">Quantity</th>
                <th className="py-2.5 px-3 font-semibold">Location / Store</th>
                <th className="py-2.5 px-3 font-semibold">Reference</th>
                <th className="py-2.5 px-3 font-semibold">User</th>
                <th className="py-2.5 px-3 font-semibold">Date & Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentTransactions.map((txn) => {
                const isIn = txn.direction === 'in';
                return (
                  <tr key={txn.id} className="hover:bg-slate-50/50">
                    <td className="py-3 px-3 font-mono font-medium text-slate-800">
                      {txn.transactionNumber}
                    </td>
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
                    <td className="py-3 px-3">
                      <div className="font-medium text-slate-900">{txn.productName}</div>
                      <div className="font-mono text-[11px] text-slate-500">{txn.sku}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`font-semibold ${isIn ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isIn ? '+' : '-'}{txn.quantity} {txn.unit}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">
                      {txn.destinationStoreName || txn.sourceStoreName || 'Central Warehouse'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700">
                        {txn.referenceNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600">{txn.userName}</td>
                    <td className="py-3 px-3 text-slate-400">
                      {new Date(txn.timestamp).toLocaleDateString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
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
