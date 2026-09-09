import React, { useState } from 'react';
import { useInventory } from '../../context/InventoryContext';
import { WarehouseStore } from '../../types/inventory';
import { X, Building2, MapPin, User, Phone, Mail, CheckCircle } from 'lucide-react';

interface AddStoreModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeToEdit?: WarehouseStore | null;
}

export const AddStoreModal: React.FC<AddStoreModalProps> = ({
  isOpen,
  onClose,
  storeToEdit,
}) => {
  const { addStore, updateStore } = useInventory();

  const [formData, setFormData] = useState({
    storeCode: storeToEdit ? storeToEdit.storeCode : `WH-${Date.now().toString().slice(-3)}`,
    name: storeToEdit ? storeToEdit.name : '',
    address: storeToEdit ? storeToEdit.address : '',
    city: storeToEdit ? storeToEdit.city : 'Bengaluru',
    state: storeToEdit ? storeToEdit.state : 'Karnataka',
    pincode: storeToEdit ? storeToEdit.pincode : '560058',
    managerName: storeToEdit ? storeToEdit.managerName : '',
    contactPhone: storeToEdit ? storeToEdit.contactPhone : '+91 98450 11223',
    contactEmail: storeToEdit ? storeToEdit.contactEmail : 'store@businesshub.com',
    isMainWarehouse: storeToEdit ? storeToEdit.isMainWarehouse : false,
    status: storeToEdit ? storeToEdit.status : ('Active' as const),
  });

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.storeCode.trim()) {
      setError('Warehouse name and store code are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      if (storeToEdit) {
        await updateStore(storeToEdit.id, formData);
      } else {
        await addStore(formData);
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save store');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {storeToEdit ? 'Edit Warehouse Store' : 'Register New Warehouse / Store'}
              </h3>
              <p className="text-xs text-slate-500">
                Add physical depot, fulfillment hub, or regional store facility
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Store Code *
              </label>
              <input
                type="text"
                required
                value={formData.storeCode}
                onChange={(e) => setFormData({ ...formData, storeCode: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono font-medium focus:border-blue-500 focus:outline-hidden"
                placeholder="e.g. WH-BOM"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Store Name *
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                placeholder="e.g. Peenya Central Warehouse"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Physical Street Address
            </label>
            <input
              type="text"
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              placeholder="Plot No, Industrial Estate, Road..."
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">City</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">State</label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Pincode</label>
              <input
                type="text"
                value={formData.pincode}
                onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Store Manager In-Charge
              </label>
              <input
                type="text"
                value={formData.managerName}
                onChange={(e) => setFormData({ ...formData, managerName: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
                placeholder="Manager Name"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Phone
              </label>
              <input
                type="text"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs focus:border-blue-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-800">
              <input
                type="checkbox"
                checked={formData.isMainWarehouse}
                onChange={(e) => setFormData({ ...formData, isMainWarehouse: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              Designate as Primary / Main Central Warehouse
            </label>
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
              {storeToEdit ? 'Save Warehouse' : 'Register Store'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
