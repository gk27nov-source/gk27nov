import React, { useState, useEffect } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { Product, UnitOfMeasurement } from '../../types/inventory';
import { X, Package, Layers, Hash, DollarSign, Building2, MapPin, CheckCircle, Image as ImageIcon } from 'lucide-react';

interface AddEditProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  productToEdit?: Product | null;
}

const UNITS: UnitOfMeasurement[] = ['PCS', 'KG', 'LTR', 'BOX', 'MTR', 'SET', 'ROLL', 'PACK', 'UNIT'];

export const AddEditProductModal: React.FC<AddEditProductModalProps> = ({
  isOpen,
  onClose,
  productToEdit,
}) => {
  const { addProduct, updateProduct, categories, stores, suppliers } = useInventory();

  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    category: '',
    subcategory: '',
    brand: '',
    description: '',
    unit: 'PCS' as UnitOfMeasurement,
    barcode: '',
    hsnCode: '85044090',
    gstRate: 18,
    purchasePrice: 0,
    sellingPrice: 0,
    minStockLevel: 5,
    maxStockLevel: 100,
    reorderLevel: 10,
    openingStock: 0,
    supplierName: '',
    storageLocation: 'Main Aisle - Rack A',
    imageUrl: '',
    status: 'Active' as 'Active' | 'Inactive',
    initialStoreId: '',
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (productToEdit) {
      setFormData({
        sku: productToEdit.sku,
        name: productToEdit.name,
        category: productToEdit.category,
        subcategory: productToEdit.subcategory || '',
        brand: productToEdit.brand || '',
        description: productToEdit.description || '',
        unit: productToEdit.unit,
        barcode: productToEdit.barcode || '',
        hsnCode: productToEdit.hsnCode || '85044090',
        gstRate: productToEdit.gstRate,
        purchasePrice: productToEdit.purchasePrice,
        sellingPrice: productToEdit.sellingPrice,
        minStockLevel: productToEdit.minStockLevel,
        maxStockLevel: productToEdit.maxStockLevel,
        reorderLevel: productToEdit.reorderLevel,
        openingStock: productToEdit.openingStock || 0,
        supplierName: productToEdit.supplierName || '',
        storageLocation: productToEdit.storageLocation || '',
        imageUrl: productToEdit.imageUrl || '',
        status: productToEdit.status,
        initialStoreId: stores[0]?.id || '',
      });
    } else {
      setFormData({
        sku: `SKU-${Date.now().toString().slice(-5)}`,
        name: '',
        category: categories[0]?.name || 'Industrial Sensors',
        subcategory: '',
        brand: '',
        description: '',
        unit: 'PCS',
        barcode: `890${Date.now().toString().slice(-9)}`,
        hsnCode: '85044090',
        gstRate: 18,
        purchasePrice: 1000,
        sellingPrice: 1500,
        minStockLevel: 5,
        maxStockLevel: 100,
        reorderLevel: 10,
        openingStock: 0,
        supplierName: suppliers[0]?.name || '',
        storageLocation: 'Main Aisle - Rack A',
        imageUrl: '',
        status: 'Active',
        initialStoreId: stores[0]?.id || '',
      });
    }
    setError(null);
  }, [productToEdit, isOpen, categories, stores, suppliers]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.sku.trim()) {
      setError('Product Name and SKU are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (productToEdit) {
        await updateProduct(productToEdit.id, {
          sku: formData.sku.toUpperCase(),
          name: formData.name.trim(),
          category: formData.category,
          subcategory: formData.subcategory.trim(),
          brand: formData.brand.trim(),
          description: formData.description.trim(),
          unit: formData.unit,
          barcode: formData.barcode.trim(),
          hsnCode: formData.hsnCode.trim(),
          gstRate: Number(formData.gstRate),
          purchasePrice: Number(formData.purchasePrice),
          sellingPrice: Number(formData.sellingPrice),
          minStockLevel: Number(formData.minStockLevel),
          maxStockLevel: Number(formData.maxStockLevel),
          reorderLevel: Number(formData.reorderLevel),
          supplierName: formData.supplierName,
          storageLocation: formData.storageLocation,
          imageUrl: formData.imageUrl,
          status: formData.status,
        });
      } else {
        await addProduct({
          sku: formData.sku.toUpperCase(),
          name: formData.name.trim(),
          category: formData.category,
          subcategory: formData.subcategory.trim(),
          brand: formData.brand.trim(),
          description: formData.description.trim(),
          unit: formData.unit,
          barcode: formData.barcode.trim(),
          hsnCode: formData.hsnCode.trim(),
          gstRate: Number(formData.gstRate),
          purchasePrice: Number(formData.purchasePrice),
          sellingPrice: Number(formData.sellingPrice),
          minStockLevel: Number(formData.minStockLevel),
          maxStockLevel: Number(formData.maxStockLevel),
          reorderLevel: Number(formData.reorderLevel),
          openingStock: Number(formData.openingStock),
          supplierName: formData.supplierName,
          storageLocation: formData.storageLocation,
          imageUrl: formData.imageUrl,
          status: formData.status,
          initialStoreId: formData.initialStoreId,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save product');
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
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {productToEdit ? 'Edit Product Master' : 'Create New Product / SKU'}
              </h3>
              <p className="text-xs text-slate-500">
                Configure item classification, pricing, tax, reorder levels, and location
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
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          {/* Section 1: Basic Identity */}
          <div className="space-y-4">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Layers className="h-4 w-4 text-blue-600" />
              1. Product Identification & Categorization
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product SKU / Code *
                </label>
                <input
                  type="text"
                  required
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-medium uppercase focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. SEN-PT100-PRO"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product / Item Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Industrial Platinum RTD Sensor PT-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Subcategory</label>
                <input
                  type="text"
                  value={formData.subcategory}
                  onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Temperature RTDs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Brand / Make</label>
                <input
                  type="text"
                  value={formData.brand}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. Honeywell / Siemens"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description / Technical Specifications
              </label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                placeholder="Detailed technical specifications, tolerance ratings, application areas..."
              />
            </div>
          </div>

          {/* Section 2: Units, Tax & Compliance */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Hash className="h-4 w-4 text-emerald-600" />
              2. Unit of Measurement & Tax Compliance
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Unit (UOM)
                </label>
                <select
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value as UnitOfMeasurement })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">HSN Code</label>
                <input
                  type="text"
                  value={formData.hsnCode}
                  onChange={(e) => setFormData({ ...formData, hsnCode: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="e.g. 85044090"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">GST Rate (%)</label>
                <select
                  value={formData.gstRate}
                  onChange={(e) => setFormData({ ...formData, gstRate: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value={0}>0% (Exempt)</option>
                  <option value={5}>5%</option>
                  <option value={12}>12%</option>
                  <option value={18}>18% (Standard)</option>
                  <option value={28}>28%</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Barcode / EAN-13
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="8901234567890"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Pricing & Costing */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <DollarSign className="h-4 w-4 text-indigo-600" />
              3. Commercial Pricing & Valuation
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Purchase / Cost Price (INR) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-xs font-semibold text-slate-900 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Used for inventory valuation & GRN costing</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Selling / Billing Price (INR) *
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs text-slate-400">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={formData.sellingPrice}
                    onChange={(e) => setFormData({ ...formData, sellingPrice: Number(e.target.value) })}
                    className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-xs font-semibold text-blue-700 focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">Default base price in Quotations & Invoices</p>
              </div>
            </div>
          </div>

          {/* Section 4: Stock Levels & Reorder Thresholds */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-amber-600" />
              4. Inventory Thresholds & Storage Location
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Min Stock Level
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.minStockLevel}
                  onChange={(e) => setFormData({ ...formData, minStockLevel: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Reorder Level *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={formData.reorderLevel}
                  onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
                  className="w-full rounded-lg border border-amber-300 bg-amber-50/40 px-3 py-2 text-xs font-bold text-amber-900 focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Max Stock Level
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.maxStockLevel}
                  onChange={(e) => setFormData({ ...formData, maxStockLevel: Number(e.target.value) })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Storage Location (Rack/Bin)
                </label>
                <input
                  type="text"
                  value={formData.storageLocation}
                  onChange={(e) => setFormData({ ...formData, storageLocation: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                  placeholder="Aisle 3 - Shelf B2"
                />
              </div>
            </div>

            {/* Opening Stock (Only during creation) */}
            {!productToEdit && (
              <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
                <h5 className="text-xs font-bold text-blue-900 mb-2">
                  Initial Opening Stock Recording
                </h5>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-medium text-blue-800 mb-1">
                      Opening Physical Stock ({formData.unit})
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.openingStock}
                      onChange={(e) => setFormData({ ...formData, openingStock: Number(e.target.value) })}
                      className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs font-semibold focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    />
                    <p className="mt-1 text-[11px] text-blue-600">
                      An audited Opening Stock transaction will be automatically booked.
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-blue-800 mb-1">
                      Target Warehouse / Depot
                    </label>
                    <select
                      value={formData.initialStoreId}
                      onChange={(e) => setFormData({ ...formData, initialStoreId: e.target.value })}
                      className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                    >
                      {stores.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name} ({st.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 5: Supplier & Status */}
          <div className="space-y-4 pt-4 border-t border-slate-200">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
              <MapPin className="h-4 w-4 text-purple-600" />
              5. Preferred Supplier & Active Status
            </h4>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Preferred Supplier
                </label>
                <select
                  value={formData.supplierName}
                  onChange={(e) => setFormData({ ...formData, supplierName: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">Select Supplier</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.supplierCode})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Catalog Status</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                >
                  <option value="Active">Active (Available for Orders & Invoices)</option>
                  <option value="Inactive">Inactive (Archived)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
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
              {productToEdit ? 'Save Changes' : 'Create Product Master'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
