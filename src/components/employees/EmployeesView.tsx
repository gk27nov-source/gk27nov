import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AppUser, UserRole } from '../../types';
import {
  UserCheck,
  Search,
  Plus,
  Shield,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  AlertCircle,
  Edit2,
  Trash2,
  X,
} from 'lucide-react';

export const EmployeesView: React.FC = () => {
  const { employees, addEmployee, updateEmployee, leads, complaints, tasks, customers, currentUser } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<AppUser | null>(null);

  const initialFormState = {
    displayName: '',
    email: '',
    role: 'staff' as UserRole,
    mobile: '+91 98000 12345',
    department: 'Customer Support',
    isActive: true,
  };

  const [formData, setFormData] = useState(initialFormState);

  const filteredEmployees = employees.filter(
    (e) =>
      e.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (e.department && e.department.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const openAddModal = () => {
    setFormData(initialFormState);
    setEditingEmployee(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (emp: AppUser) => {
    setEditingEmployee(emp);
    setFormData({
      displayName: emp.displayName,
      email: emp.email,
      role: emp.role,
      // Was defaulted to '+91 98000 12345', so opening an edit dialog and
      // saving silently wrote a fake number onto a real person.
      mobile: emp.mobile || emp.phone || '',
      department: emp.department || 'Operations',
      isActive: emp.isActive,
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingEmployee) {
      await updateEmployee(editingEmployee.uid, {
        displayName: formData.displayName,
        email: formData.email,
        role: formData.role,
        mobile: formData.mobile,
        department: formData.department,
        isActive: formData.isActive,
      });
    } else {
      await addEmployee({
        displayName: formData.displayName,
        email: formData.email,
        role: formData.role,
        mobile: formData.mobile,
        department: formData.department,
        isActive: formData.isActive,
      });
    }
    setIsAddModalOpen(false);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Team & RBAC Management</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {employees.length} Staff Members
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Role assignments (Super Admin, Business Admin, Manager, Staff, Viewer) and individual operational performance.
          </p>
        </div>

        {currentUser?.role === 'super_admin' || currentUser?.role === 'business_admin' ? (
          <button
            onClick={openAddModal}
            className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Staff Member
          </button>
        ) : null}
      </div>

      {/* Employees Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEmployees.map((emp) => {
          // Calculate employee performance stats
          const empCustomersCount = customers.filter((c) => c.assignedEmployeeId === emp.uid).length;
          const empLeadsCount = leads.filter((l) => l.assignedToId === emp.uid || l.assignedEmployeeId === emp.uid).length;
          const empLeadsWon = leads.filter((l) => (l.assignedToId === emp.uid || l.assignedEmployeeId === emp.uid) && l.status === 'Won').length;
          const empComplaintsAssigned = complaints.filter((c) => c.assignedEmployeeId === emp.uid).length;
          const empComplaintsResolved = complaints.filter(
            (c) => c.assignedEmployeeId === emp.uid && (c.status === 'Resolved' || c.status === 'Closed')
          ).length;
          const empTasksCompleted = tasks.filter((t) => t.assignedToId === emp.uid && t.status === 'Completed').length;
          const empTasksPending = tasks.filter((t) => t.assignedToId === emp.uid && t.status !== 'Completed').length;

          return (
            <div
              key={emp.uid}
              className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between space-y-4 hover:border-blue-300 transition-all"
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                      {emp.displayName?.[0] || 'E'}
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-slate-900">{emp.displayName}</h3>
                      <div className="text-xs text-slate-500">{emp.department || 'Operations Team'}</div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      emp.role === 'super_admin'
                        ? 'bg-purple-100 text-purple-800'
                        : emp.role === 'business_admin'
                        ? 'bg-blue-100 text-blue-800'
                        : emp.role === 'manager'
                        ? 'bg-indigo-100 text-indigo-800'
                        : emp.role === 'staff'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {emp.role.replace('_', ' ')}
                  </span>
                </div>

                <div className="mt-3 space-y-1 text-xs text-slate-600">
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <span className="truncate">{emp.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                    {/*
                      This read `emp.mobile || '+91 98450 12345'`, and the seed
                      records carry `phone`, not `mobile` — so every one of the
                      five staff cards displayed the same invented number. A
                      placeholder that looks like a real phone number is worse
                      than a blank: somebody eventually dials it.
                    */}
                    {emp.mobile || emp.phone ? (
                      <a href={`tel:${(emp.mobile || emp.phone)!.replace(/[^\d+]/g, '')}`} className="hover:text-blue-600">
                        {emp.mobile || emp.phone}
                      </a>
                    ) : (
                      <span className="italic text-slate-400">No number on file</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Performance Telemetry Grid */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2 text-xs">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Operational Metrics
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                    <div className="font-bold text-slate-900 text-xs">
                      {empLeadsWon} / {empLeadsCount}
                    </div>
                    <div className="text-[9px] text-slate-400">Leads Won</div>
                  </div>

                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                    <div className="font-bold text-slate-900 text-xs">
                      {empComplaintsResolved} / {empComplaintsAssigned}
                    </div>
                    <div className="text-[9px] text-slate-400">Tickets Solved</div>
                  </div>

                  <div className="p-1.5 bg-white rounded-lg border border-slate-200/60">
                    <div className="font-bold text-slate-900 text-xs">
                      {empTasksCompleted}
                    </div>
                    <div className="text-[9px] text-slate-400">Tasks Done</div>
                  </div>
                </div>

                <div className="flex justify-between text-[11px] text-slate-500 pt-1">
                  <span>Accounts Handled: {empCustomersCount}</span>
                  <span className={empTasksPending > 2 ? 'text-amber-600 font-semibold' : 'text-slate-500'}>
                    Pending Tasks: {empTasksPending}
                  </span>
                </div>
              </div>

              {/* Footer Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                <span className="flex items-center gap-1.5 text-[11px] text-emerald-600 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Active Account
                </span>

                {(currentUser?.role === 'super_admin' || currentUser?.role === 'business_admin') && (
                  <button
                    onClick={() => openEditModal(emp)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors flex items-center gap-1 text-[11px] font-semibold"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingEmployee ? 'Edit Staff Member' : 'Register New Employee'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ananya Rao"
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Work Email</label>
                <input
                  type="email"
                  required
                  placeholder="ananya@company.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mobile / WhatsApp Number</label>
                <input
                  type="tel"
                  required
                  placeholder="+91 98450 12345"
                  value={formData.mobile}
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned RBAC Role</label>
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="super_admin">Super Admin</option>
                    <option value="business_admin">Business Admin</option>
                    <option value="manager">Manager</option>
                    <option value="staff">Staff Rep</option>
                    <option value="viewer">Viewer (Read-Only)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Department</label>
                  <select
                    value={formData.department}
                    onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Executive Management">Management</option>
                    <option value="Sales & Marketing">Sales & Marketing</option>
                    <option value="Customer Support">Customer Support</option>
                    <option value="Operations & Logistics">Operations</option>
                    <option value="IT & Infrastructure">IT & Infra</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-xs"
                >
                  {editingEmployee ? 'Update Member' : 'Register Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
