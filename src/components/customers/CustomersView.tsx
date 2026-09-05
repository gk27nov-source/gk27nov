import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import { Customer, CustomerCategory } from '../../types';
import {
  Users,
  Search,
  Filter,
  Plus,
  Download,
  Upload,
  Edit2,
  Trash2,
  Phone,
  MessageSquare,
  Mail,
  Building,
  MapPin,
  ExternalLink,
  ChevronRight,
  FileText,
  Clock,
  Send,
  X,
  AlertTriangle,
  Check,
} from 'lucide-react';

export const CustomersView: React.FC = () => {
  const {
    customers,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    importCustomersFromCSV,
    employees,
    currentUser,
    communications,
    sendCommunication,
    documents,
    leads,
    complaints,
    setActiveTab,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  const [selectedCustomerForProfile, setSelectedCustomerForProfile] = useState<Customer | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  // Quick message modal
  const [commTargetCustomer, setCommTargetCustomer] = useState<Customer | null>(null);
  const [commChannel, setCommChannel] = useState<'whatsapp' | 'email'>('whatsapp');
  const [commMessage, setCommMessage] = useState('');
  const [commSubject, setCommSubject] = useState('');

  // CSV file input ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const initialFormState = {
    customerId: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    fullName: '',
    companyName: '',
    mobileNumber: '',
    whatsappNumber: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pinCode: '',
    category: 'Regular' as CustomerCategory,
    industry: 'Enterprise Technology',
    source: 'Website' as const,
    assignedEmployeeId: employees[0]?.uid || '',
    assignedEmployeeName: employees[0]?.displayName || '',
    status: 'Active' as const,
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const matchesSearch =
        c.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.customerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.mobileNumber.includes(searchQuery);

      const matchesCategory = selectedCategory === 'All' || c.category === selectedCategory;
      const matchesStatus = selectedStatus === 'All' || c.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [customers, searchQuery, selectedCategory, selectedStatus]);

  // CSV Export handler
  const handleExportCSV = () => {
    const headers = [
      'Customer ID',
      'Full Name',
      'Company Name',
      'Mobile',
      'WhatsApp',
      'Email',
      'Address',
      'City',
      'State',
      'PIN',
      'Category',
      'Industry',
      'Source',
      'Assigned Employee',
      'Status',
      'Notes',
    ];

    const rows = filteredCustomers.map((c) => [
      `"${c.customerId}"`,
      `"${c.fullName}"`,
      `"${c.companyName}"`,
      `"${c.mobileNumber}"`,
      `"${c.whatsappNumber}"`,
      `"${c.email}"`,
      `"${c.address}"`,
      `"${c.city}"`,
      `"${c.state}"`,
      `"${c.pinCode}"`,
      `"${c.category}"`,
      `"${c.industry}"`,
      `"${c.source}"`,
      `"${c.assignedEmployeeName}"`,
      `"${c.status}"`,
      `"${c.notes || ''}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Import handler
  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length <= 1) return;

      const newCustomers: any[] = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.replace(/^"|"$/g, '').trim());
        if (cols[1]) {
          newCustomers.push({
            customerId: cols[0] || `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
            fullName: cols[1],
            companyName: cols[2] || 'Enterprise',
            mobileNumber: cols[3] || '+91 90000 00000',
            whatsappNumber: cols[4] || cols[3] || '+91 90000 00000',
            email: cols[5] || 'contact@example.com',
            address: cols[6] || 'City Industrial Center',
            city: cols[7] || 'Bengaluru',
            state: cols[8] || 'Karnataka',
            pinCode: cols[9] || '560001',
            category: (cols[10] as CustomerCategory) || 'Regular',
            industry: cols[11] || 'Commercial Services',
            source: 'Website' as const,
            assignedEmployeeId: employees[0]?.uid || '',
            assignedEmployeeName: employees[0]?.displayName || 'Manager',
            status: 'Active' as const,
            notes: cols[15] || 'Imported via CSV',
          });
        }
      }

      if (newCustomers.length > 0) {
        await importCustomersFromCSV(newCustomers);
        alert(`Successfully imported ${newCustomers.length} customers!`);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openAddModal = () => {
    setFormData({
      ...initialFormState,
      customerId: `CUST-${Math.floor(1000 + Math.random() * 9000)}`,
    });
    setEditingCustomer(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (c: Customer) => {
    setEditingCustomer(c);
    setFormData({
      customerId: c.customerId,
      fullName: c.fullName,
      companyName: c.companyName,
      mobileNumber: c.mobileNumber,
      whatsappNumber: c.whatsappNumber,
      email: c.email,
      address: c.address,
      city: c.city,
      state: c.state,
      pinCode: c.pinCode,
      category: c.category,
      industry: c.industry,
      source: c.source as any,
      assignedEmployeeId: c.assignedEmployeeId,
      assignedEmployeeName: c.assignedEmployeeName,
      status: c.status as any,
      notes: c.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const employee = employees.find((emp) => emp.uid === formData.assignedEmployeeId);
    const assignedName = employee ? employee.displayName : formData.assignedEmployeeName || 'Assigned Staff';

    if (editingCustomer) {
      await updateCustomer(editingCustomer.id, {
        ...formData,
        assignedEmployeeName: assignedName,
      });
    } else {
      await addCustomer({
        ...formData,
        assignedEmployeeName: assignedName,
      });
    }
    setIsAddModalOpen(false);
  };

  const handleSendComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commTargetCustomer || !commMessage.trim()) return;

    await sendCommunication({
      customerId: commTargetCustomer.id,
      customerName: commTargetCustomer.fullName,
      channel: commChannel,
      type: 'outgoing',
      subject: commChannel === 'email' ? commSubject || 'Important update from our team' : undefined,
      message: commMessage,
      sentById: currentUser?.uid || 'user_admin',
      sentByName: currentUser?.displayName || 'Support Team',
    });

    setCommTargetCustomer(null);
    setCommMessage('');
    setCommSubject('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Customer CRM</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-blue-100 text-blue-800 rounded-full">
              {customers.length} Accounts
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Enterprise relationship directory, contact profiles, communication trails and documents.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Hidden file input for CSV */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImportCSV}
            accept=".csv"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
            title="Import Customers from CSV"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import CSV
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-2 text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl border border-slate-200 transition-colors flex items-center gap-1.5"
            title="Export CSV"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export CSV
          </button>
          {currentUser?.role !== 'viewer' && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Customer
            </button>
          )}
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search by name, company, ID, mobile, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Category Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Categories</option>
              <option value="Enterprise">Enterprise</option>
              <option value="VIP">VIP</option>
              <option value="Regular">Regular</option>
              <option value="Wholesale">Wholesale</option>
              <option value="Retail">Retail</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Archived">Archived</option>
            </select>
          </div>
        </div>
      </div>

      {/* Customers Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">Customer</th>
                <th className="py-3 px-4">Company</th>
                <th className="py-3 px-4">Contact</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Assigned Rep</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No customers match your current filter.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="hover:bg-slate-50/80 transition-colors group cursor-pointer"
                    onClick={() => setSelectedCustomerForProfile(customer)}
                  >
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-2">
                        {customer.fullName}
                      </div>
                      <div className="text-[10px] text-blue-600 font-mono font-medium">
                        {customer.customerId}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{customer.companyName}</div>
                      <div className="text-[10px] text-slate-400">{customer.industry}</div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="text-slate-800 font-medium">{customer.mobileNumber}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[150px]">{customer.email}</div>
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-semibold text-[10px] ${
                          customer.category === 'Enterprise'
                            ? 'bg-purple-100 text-purple-700'
                            : customer.category === 'VIP'
                            ? 'bg-amber-100 text-amber-800'
                            : customer.category === 'Wholesale'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {customer.category}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-slate-700 font-medium">
                      {customer.assignedEmployeeName}
                    </td>

                    <td className="py-3 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          customer.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            customer.status === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'
                          }`}
                        />
                        {customer.status}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setCommTargetCustomer(customer);
                            setCommChannel('whatsapp');
                          }}
                          className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                          title="Quick WhatsApp message"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => {
                            setCommTargetCustomer(customer);
                            setCommChannel('email');
                          }}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Send Email"
                        >
                          <Mail className="w-3.5 h-3.5" />
                        </button>

                        {currentUser?.role !== 'viewer' && (
                          <button
                            onClick={() => openEditModal(customer)}
                            className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            title="Edit customer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {(currentUser?.role === 'super_admin' || currentUser?.role === 'business_admin' || currentUser?.role === 'manager') && (
                          <button
                            onClick={() => setCustomerToDelete(customer)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete customer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detailed Customer Profile Drawer / Modal */}
      {selectedCustomerForProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Drawer Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50/60">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-900">{selectedCustomerForProfile.fullName}</h2>
                  <span className="px-2.5 py-0.5 rounded-full font-bold text-xs bg-blue-100 text-blue-800">
                    {selectedCustomerForProfile.customerId}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full font-semibold text-xs bg-purple-100 text-purple-700">
                    {selectedCustomerForProfile.category}
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <Building className="w-3.5 h-3.5 text-slate-400" />
                  <span>{selectedCustomerForProfile.companyName}</span>
                  <span>•</span>
                  <span>{selectedCustomerForProfile.industry}</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setCommTargetCustomer(selectedCustomerForProfile);
                    setCommChannel('whatsapp');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  WhatsApp
                </button>
                <button
                  onClick={() => {
                    setCommTargetCustomer(selectedCustomerForProfile);
                    setCommChannel('email');
                  }}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                >
                  <Mail className="w-3.5 h-3.5" />
                  Email
                </button>
                <button
                  onClick={() => setSelectedCustomerForProfile(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Profile Tabs & Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Primary Contact & Location Card */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-400 uppercase">Contact Information</div>
                  <div className="mt-2 space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Phone className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-semibold">{selectedCustomerForProfile.mobileNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700">
                      <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{selectedCustomerForProfile.whatsappNumber}</span>
                    </div>
                    <div className="flex items-center gap-2 text-slate-700 truncate">
                      <Mail className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{selectedCustomerForProfile.email}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-400 uppercase">Address & Location</div>
                  <div className="mt-2 text-xs text-slate-700 space-y-1">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                      <div>
                        <div>{selectedCustomerForProfile.address}</div>
                        <div className="font-semibold mt-0.5">
                          {selectedCustomerForProfile.city}, {selectedCustomerForProfile.state} - {selectedCustomerForProfile.pinCode}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80">
                  <div className="text-xs font-semibold text-slate-400 uppercase">Account Details</div>
                  <div className="mt-2 text-xs text-slate-700 space-y-1">
                    <div>
                      <span className="text-slate-400">Assigned Rep: </span>
                      <span className="font-semibold">{selectedCustomerForProfile.assignedEmployeeName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Lead Source: </span>
                      <span>{selectedCustomerForProfile.source}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Created: </span>
                      <span>{new Date(selectedCustomerForProfile.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Customer Notes */}
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/70">
                <div className="text-xs font-bold text-amber-900 uppercase">Key Account Notes & Operational Context</div>
                <p className="mt-1 text-xs text-slate-700 whitespace-pre-wrap">
                  {selectedCustomerForProfile.notes || 'No special notes recorded.'}
                </p>
              </div>

              {/* Communications History */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Communication Trail & Message History
                </h3>
                <div className="space-y-2">
                  {communications.filter((comm) => comm.customerId === selectedCustomerForProfile.id).length === 0 ? (
                    <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400">
                      No communications logged yet for this account.
                    </div>
                  ) : (
                    communications
                      .filter((comm) => comm.customerId === selectedCustomerForProfile.id)
                      .map((comm) => (
                        <div
                          key={comm.id}
                          className="p-3 bg-white rounded-xl border border-slate-200 text-xs flex items-start justify-between gap-4"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                                  comm.channel === 'whatsapp'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {comm.channel}
                              </span>
                              <span className="font-semibold text-slate-900">
                                {comm.templateName || comm.subject || 'Direct Message'}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                by {comm.sentByName}
                              </span>
                            </div>
                            <p className="mt-1 text-slate-700">{comm.message}</p>
                          </div>
                          <div className="text-[10px] text-slate-400 shrink-0">
                            {new Date(comm.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Linked Support Tickets */}
              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Linked Support Tickets ({complaints.filter((c) => c.customerId === selectedCustomerForProfile.id).length})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {complaints
                    .filter((c) => c.customerId === selectedCustomerForProfile.id)
                    .map((ticket) => (
                      <div key={ticket.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-slate-900">{ticket.ticketNumber}</span>
                          <span className="px-2 py-0.5 bg-red-100 text-red-700 font-semibold rounded-full text-[10px]">
                            {ticket.priority}
                          </span>
                        </div>
                        <div className="text-slate-600 line-clamp-2">{ticket.description}</div>
                        <div className="text-[10px] text-slate-400 pt-1 flex justify-between">
                          <span>Status: {ticket.status}</span>
                          <span>SLA: {ticket.slaHours}h</span>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Customer Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <h3 className="font-bold text-slate-900 text-base">
                {editingCustomer ? 'Edit Customer Information' : 'Add New Customer Account'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer ID</label>
                  <input
                    type="text"
                    required
                    value={formData.customerId}
                    onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rajesh Mehra"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Mehra Logistics Pvt Ltd"
                    value={formData.companyName}
                    onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Logistics & Supply Chain"
                    value={formData.industry}
                    onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number</label>
                  <input
                    type="tel"
                    required
                    placeholder="+91 98450 12345"
                    value={formData.mobileNumber}
                    onChange={(e) => setFormData({ ...formData, mobileNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">WhatsApp Number</label>
                  <input
                    type="tel"
                    placeholder="+91 98450 12345"
                    value={formData.whatsappNumber}
                    onChange={(e) => setFormData({ ...formData, whatsappNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    placeholder="contact@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as CustomerCategory })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Enterprise">Enterprise</option>
                    <option value="VIP">VIP</option>
                    <option value="Regular">Regular</option>
                    <option value="Wholesale">Wholesale</option>
                    <option value="Retail">Retail</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Source</label>
                  <select
                    value={formData.source}
                    onChange={(e) => setFormData({ ...formData, source: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Website">Website</option>
                    <option value="Referral">Referral</option>
                    <option value="LinkedIn">LinkedIn</option>
                    <option value="Expo">Expo / Conference</option>
                    <option value="Cold Call">Cold Call</option>
                    <option value="Social Media">Social Media</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Employee</label>
                  <select
                    value={formData.assignedEmployeeId}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.uid === e.target.value);
                      setFormData({
                        ...formData,
                        assignedEmployeeId: e.target.value,
                        assignedEmployeeName: emp?.displayName || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName} ({emp.role})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="Plot 42, Tech Park, Industrial Corridor"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="Bengaluru"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="Karnataka"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">PIN Code</label>
                  <input
                    type="text"
                    placeholder="560001"
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Notes & Follow-up Context</label>
                <textarea
                  rows={3}
                  placeholder="Contract terms, telemetry needs, preferred communication hours..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors shadow-xs"
                >
                  {editingCustomer ? 'Update Customer' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {customerToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 p-6 max-w-md w-full space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="p-2 bg-red-100 rounded-full">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-slate-900 text-base">Archive / Delete Customer</h3>
            </div>
            <p className="text-xs text-slate-600">
              Are you sure you want to remove <strong>{customerToDelete.fullName}</strong> ({customerToDelete.companyName})? This will be recorded in the audit trail.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setCustomerToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteCustomer(customerToDelete.id);
                  setCustomerToDelete(null);
                }}
                className="px-4 py-2 text-xs font-bold bg-red-600 hover:bg-red-700 text-white rounded-lg shadow-2xs"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick WhatsApp / Email Dispatch Modal */}
      {commTargetCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-center gap-2">
                {commChannel === 'whatsapp' ? (
                  <MessageSquare className="w-5 h-5 text-emerald-600" />
                ) : (
                  <Mail className="w-5 h-5 text-blue-600" />
                )}
                <h3 className="font-bold text-slate-900 text-sm">
                  Send {commChannel === 'whatsapp' ? 'WhatsApp' : 'Email'} to {commTargetCustomer.fullName}
                </h3>
              </div>
              <button onClick={() => setCommTargetCustomer(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendComm} className="p-6 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-[11px] text-slate-500">Destination:</div>
                <div className="font-semibold text-slate-800 mt-0.5">
                  {commChannel === 'whatsapp' ? commTargetCustomer.whatsappNumber : commTargetCustomer.email}
                </div>
              </div>

              {commChannel === 'email' && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Account review and follow-up"
                    value={commSubject}
                    onChange={(e) => setCommSubject(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={5}
                  required
                  placeholder={
                    commChannel === 'whatsapp'
                      ? 'Hello Rajesh ji, reaching out regarding your account...'
                      : 'Dear Rajesh,\n\nThank you for partnering with us...'
                  }
                  value={commMessage}
                  onChange={(e) => setCommMessage(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setCommTargetCustomer(null)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-5 py-2 font-bold text-white rounded-lg flex items-center gap-1.5 shadow-xs ${
                    commChannel === 'whatsapp' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  <Send className="w-3.5 h-3.5" />
                  Dispatch {commChannel === 'whatsapp' ? 'WhatsApp' : 'Email'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
