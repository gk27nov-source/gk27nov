import React, { useState, useMemo } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Product } from '../../types/inventory';
import { AddEditProductModal } from './AddEditProductModal';
import {
  Package,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  MoreVertical,
  Building2,
  ArrowUpDown,
  FileSpreadsheet,
  Boxes,
} from 'lucide-react';

interface ProductMasterViewProps {
  onOpenTransactionModal?: (product?: Product) => void;
}

export const ProductMasterView: React.FC<ProductMasterViewProps> = ({
  onOpenTransactionModal,
}) => {
  const {
    products,
    categories,
    stores,
    deleteProduct,
    bulkImportProducts,
  } = useInventory();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [csvUploadError, setCsvUploadError] = useState<string | null>(null);

  // Filtered products list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // Search
      const matchesSearch =
        searchQuery === '' ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.supplierName?.toLowerCase().includes(searchQuery.toLowerCase());

      // Category
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;

      // Stock status
      let matchesStatus = true;
      if (stockStatusFilter === 'low_stock') {
        matchesStatus = p.currentStock > 0 && p.currentStock <= p.reorderLevel;
      } else if (stockStatusFilter === 'out_of_stock') {
        matchesStatus = p.currentStock <= 0;
      } else if (stockStatusFilter === 'in_stock') {
        matchesStatus = p.currentStock > p.reorderLevel;
      }

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, searchQuery, selectedCategory, stockStatusFilter]);

  // Export to CSV
  const handleExportCSV = () => {
    const headers = [
      'SKU',
      'Name',
      'Category',
      'Subcategory',
      'Brand',
      'Unit',
      'HSN Code',
      'GST Rate (%)',
      'Purchase Price',
      'Selling Price',
      'Physical Stock',
      'Reserved Stock',
      'Available Stock',
      'Reorder Level',
      'Preferred Supplier',
      'Storage Location',
      'Status',
    ];

    const rows = filteredProducts.map((p) => [
      `"${p.sku}"`,
      `"${p.name.replace(/"/g, '""')}"`,
      `"${p.category}"`,
      `"${p.subcategory || ''}"`,
      `"${p.brand || ''}"`,
      p.unit,
      p.hsnCode || '',
      p.gstRate,
      p.purchasePrice,
      p.sellingPrice,
      p.currentStock,
      p.reservedStock,
      p.availableStock,
      p.reorderLevel,
      `"${p.supplierName || ''}"`,
      `"${p.storageLocation || ''}"`,
      p.status,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Product_Master_Catalog_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Import CSV
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const text = evt.target?.result as string;
        const lines = text.split('\n').filter((l) => l.trim().length > 0);
        if (lines.length < 2) {
          setCsvUploadError('CSV file has no data rows.');
          return;
        }

        const itemsToImport: Partial<Product>[] = [];
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
          if (cols[0] && cols[1]) {
            itemsToImport.push({
              sku: cols[0],
              name: cols[1],
              category: cols[2] || 'General Components',
              subcategory: cols[3] || '',
              brand: cols[4] || '',
              unit: (cols[5] as any) || 'PCS',
              hsnCode: cols[6] || '85044090',
              gstRate: Number(cols[7] || 18),
              purchasePrice: Number(cols[8] || 0),
              sellingPrice: Number(cols[9] || 0),
              openingStock: Number(cols[10] || 0),
              reorderLevel: Number(cols[13] || 10),
              supplierName: cols[14] || '',
              storageLocation: cols[15] || 'Main Aisle',
            });
          }
        }

        const count = await bulkImportProducts(itemsToImport);
        setCsvUploadError(null);
        alert(`Successfully imported ${count} products from CSV.`);
      } catch (err: any) {
        setCsvUploadError(err.message || 'Error parsing CSV file');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleDelete = async (prod: Product) => {
    if (confirm(`Are you sure you want to remove product ${prod.name} (${prod.sku})?`)) {
      try {
        await deleteProduct(prod.id);
      } catch (err: any) {
        alert(err.message || 'Could not delete product');
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Boxes className="h-5 w-5 text-blue-600" />
            Product & Item Master Catalog
          </h2>
          <p className="text-xs text-slate-500">
            Complete central database of stock items, technical specifications, and location balances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Export CSV */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Export CSV
          </button>

          {/* Import CSV */}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-xs hover:bg-slate-50 transition-colors">
            <Upload className="h-4 w-4 text-slate-500" />
            Import CSV
            <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
          </label>

          {/* Add Product Button */}
          <button
            type="button"
            onClick={() => {
              setEditingProduct(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </button>
        </div>
      </div>

      {csvUploadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
          {csvUploadError}
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SKU, product name, barcode, brand, or vendor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Categories ({categories.length})</option>
            {categories.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Level Filter */}
          <select
            value={stockStatusFilter}
            onChange={(e) => setStockStatusFilter(e.target.value as any)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-blue-500 focus:outline-hidden"
          >
            <option value="all">All Stock Statuses</option>
            <option value="in_stock">In Stock (Normal)</option>
            <option value="low_stock">⚠️ Low Stock (At or below reorder)</option>
            <option value="out_of_stock">🚨 Out of Stock (0 units)</option>
          </select>
        </div>
      </div>

      {/* Catalog Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-50/75 text-slate-600">
              <tr>
                <th className="py-3 px-4 font-semibold">SKU & Item Details</th>
                <th className="py-3 px-3 font-semibold">Category / Brand</th>
                <th className="py-3 px-3 font-semibold text-right">Cost (INR)</th>
                <th className="py-3 px-3 font-semibold text-right">Selling (INR)</th>
                <th className="py-3 px-3 font-semibold text-center">Physical Stock</th>
                <th className="py-3 px-3 font-semibold text-center">Reserved</th>
                <th className="py-3 px-3 font-semibold text-center">Available</th>
                <th className="py-3 px-3 font-semibold">Location</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-slate-500">
                    <Package className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                    No products match the selected search or filter criteria.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const isZero = product.currentStock <= 0;
                  const isLow = product.currentStock > 0 && product.currentStock <= product.reorderLevel;

                  return (
                    <tr key={product.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* SKU & Name */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 font-bold text-slate-600">
                            <Package className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 hover:text-blue-600">
                              {product.name}
                            </div>
                            <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
                              <span className="font-medium text-slate-700">{product.sku}</span>
                              {product.hsnCode && <span>• HSN: {product.hsnCode}</span>}
                              {product.gstRate > 0 && <span>• GST: {product.gstRate}%</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Category & Brand */}
                      <td className="py-3 px-3">
                        <div className="font-medium text-slate-800">{product.category}</div>
                        <div className="text-[11px] text-slate-500">{product.brand || 'Generic'}</div>
                      </td>

                      {/* Cost */}
                      <td className="py-3 px-3 text-right font-medium text-slate-700">
                        ₹{product.purchasePrice.toLocaleString('en-IN')}
                      </td>

                      {/* Selling */}
                      <td className="py-3 px-3 text-right font-semibold text-slate-900">
                        ₹{product.sellingPrice.toLocaleString('en-IN')}
                      </td>

                      {/* Physical Stock */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`font-bold ${
                            isZero
                              ? 'text-red-600'
                              : isLow
                              ? 'text-amber-600'
                              : 'text-slate-900'
                          }`}
                        >
                          {product.currentStock} {product.unit}
                        </span>
                        {isLow && (
                          <div className="text-[10px] text-amber-600">
                            Reorder: {product.reorderLevel}
                          </div>
                        )}
                      </td>

                      {/* Reserved */}
                      <td className="py-3 px-3 text-center text-slate-600">
                        {product.reservedStock > 0 ? (
                          <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">
                            {product.reservedStock} {product.unit}
                          </span>
                        ) : (
                          '0'
                        )}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-3 text-center font-bold">
                        <span className={product.availableStock > 0 ? 'text-emerald-700' : 'text-slate-400'}>
                          {product.availableStock} {product.unit}
                        </span>
                      </td>

                      {/* Location */}
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          {product.storageLocation || 'Main Warehouse'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            <XCircle className="h-3 w-3" />
                            Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                            <AlertTriangle className="h-3 w-3" />
                            Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3 w-3" />
                            In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Quick Transaction */}
                          {onOpenTransactionModal && (
                            <button
                              type="button"
                              onClick={() => onOpenTransactionModal(product)}
                              title="Record Stock Issue or Receipt"
                              className="rounded p-1.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 transition-colors"
                            >
                              <ArrowUpDown className="h-3.5 w-3.5" />
                            </button>
                          )}

                          {/* Edit Product */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(product);
                              setIsAddModalOpen(true);
                            }}
                            title="Edit Product"
                            className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition-colors"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>

                          {/* Delete Product */}
                          <button
                            type="button"
                            onClick={() => handleDelete(product)}
                            title="Delete Product"
                            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

        {/* Footer Summary */}
        <div className="flex flex-col gap-2 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            Showing <strong className="font-semibold text-slate-800">{filteredProducts.length}</strong> of{' '}
            <strong className="font-semibold text-slate-800">{products.length}</strong> total products in master catalog
          </div>
          <div className="flex items-center gap-4">
            <span>
              Total Filtered Stock: <strong className="font-semibold text-slate-800">{filteredProducts.reduce((acc, p) => acc + p.currentStock, 0)} units</strong>
            </span>
            <span>
              Filtered Valuation: <strong className="font-semibold text-emerald-700">₹{filteredProducts.reduce((acc, p) => acc + p.currentStock * p.purchasePrice, 0).toLocaleString('en-IN')}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <AddEditProductModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingProduct(null);
        }}
        productToEdit={editingProduct}
      />
    </div>
  );
};
