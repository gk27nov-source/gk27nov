import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Task, TaskPriority, TaskStatus } from '../../types';
import {
  CheckSquare,
  Search,
  Filter,
  Plus,
  Calendar,
  Clock,
  User,
  LayoutGrid,
  List,
  CalendarDays,
  CheckCircle2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  X,
  Building,
} from 'lucide-react';

const TASK_STATUSES: TaskStatus[] = ['Not Started', 'In Progress', 'On Hold', 'Completed'];

export const TasksView: React.FC = () => {
  const { tasks, addTask, updateTask, deleteTask, employees, customers, currentUser } = useApp();

  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState<string>('All');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form State
  const initialFormState = {
    taskName: '',
    description: '',
    relatedType: 'customer' as const,
    relatedId: customers[0]?.id || '',
    relatedName: customers[0]?.fullName || '',
    assignedToId: employees[0]?.uid || '',
    assignedToName: employees[0]?.displayName || '',
    priority: 'Medium' as TaskPriority,
    dueDate: new Date(Date.now() + 86400000 * 3).toISOString().slice(0, 10),
    status: 'Not Started' as TaskStatus,
    completionPercentage: 0,
    notes: '',
  };

  const [formData, setFormData] = useState(initialFormState);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchesSearch =
        t.taskName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.assignedToName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.relatedName && t.relatedName.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesPriority = filterPriority === 'All' || t.priority === filterPriority;
      const matchesStatus = filterStatus === 'All' || t.status === filterStatus;

      return matchesSearch && matchesPriority && matchesStatus;
    });
  }, [tasks, searchQuery, filterPriority, filterStatus]);

  const openAddModal = () => {
    setFormData(initialFormState);
    setEditingTask(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (t: Task) => {
    setEditingTask(t);
    setFormData({
      taskName: t.taskName,
      description: t.description,
      relatedType: t.relatedType || 'customer',
      relatedId: t.relatedId || '',
      relatedName: t.relatedName || '',
      assignedToId: t.assignedToId,
      assignedToName: t.assignedToName,
      priority: t.priority,
      dueDate: t.dueDate,
      status: t.status,
      completionPercentage: t.completionPercentage,
      notes: t.notes || '',
    });
    setIsAddModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emp = employees.find((e) => e.uid === formData.assignedToId);
    const assignedName = emp ? emp.displayName : formData.assignedToName || 'Team Staff';

    if (editingTask) {
      await updateTask(editingTask.id, {
        ...formData,
        assignedToName: assignedName,
      });
    } else {
      await addTask({
        ...formData,
        assignedToName: assignedName,
      });
    }
    setIsAddModalOpen(false);
  };

  const advanceTaskStatus = (task: Task, newStatus: TaskStatus) => {
    const pct = newStatus === 'Completed' ? 100 : newStatus === 'In Progress' ? 50 : 0;
    updateTask(task.id, {
      status: newStatus,
      completionPercentage: pct,
      completedDate: newStatus === 'Completed' ? new Date().toISOString() : undefined,
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Task & Operations Hub</h1>
            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-100 text-emerald-800 rounded-full">
              {tasks.filter((t) => t.status !== 'Completed').length} Incomplete
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Workload distribution, deadline tracking, milestone progress, and team delegation.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">List</span>
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === 'calendar' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Calendar</span>
            </button>
          </div>

          {currentUser?.role !== 'viewer' && (
            <button
              onClick={openAddModal}
              className="px-4 py-2 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              New Task
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
            placeholder="Search tasks, assignee, related client..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-slate-50 focus:bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Priority Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>Priority:</span>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white font-medium text-slate-700 focus:outline-none"
            >
              <option value="All">All Statuses</option>
              {TASK_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Kanban Board View */}
      {viewMode === 'kanban' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {TASK_STATUSES.map((status) => {
            const statusTasks = filteredTasks.filter((t) => t.status === status);

            return (
              <div
                key={status}
                className="bg-slate-100/70 rounded-2xl border border-slate-200/80 p-3 flex flex-col"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-slate-800">{status}</span>
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-slate-200 text-slate-700">
                      {statusTasks.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-2.5 flex-1 min-h-[400px]">
                  {statusTasks.length === 0 ? (
                    <div className="h-28 border-2 border-dashed border-slate-200 rounded-xl flex items-center justify-center text-[11px] text-slate-400">
                      Empty column
                    </div>
                  ) : (
                    statusTasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs hover:shadow-md transition-all space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-bold text-xs text-slate-900 leading-tight">
                            {task.taskName}
                          </h4>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase ${
                              task.priority === 'High'
                                ? 'bg-red-100 text-red-700'
                                : task.priority === 'Medium'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {task.priority}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-600 line-clamp-2">{task.description}</p>

                        {task.relatedName && (
                          <div className="text-[10px] text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                            <Building className="w-3 h-3" />
                            <span className="truncate">{task.relatedName}</span>
                          </div>
                        )}

                        {/* Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[10px] text-slate-500 font-medium">
                            <span>Progress</span>
                            <span>{task.completionPercentage}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${task.completionPercentage}%` }}
                            />
                          </div>
                        </div>

                        {/* Assignee & Due Date */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                          <span className="text-slate-500 font-medium truncate max-w-[100px]">
                            {task.assignedToName}
                          </span>

                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <Clock className="w-3 h-3" />
                            <span>{task.dueDate}</span>
                          </div>
                        </div>

                        {/* Stage quick move */}
                        <div className="pt-1 flex items-center justify-between">
                          <select
                            value={task.status}
                            onChange={(e) => advanceTaskStatus(task, e.target.value as TaskStatus)}
                            className="text-[10px] bg-slate-50 border border-slate-200 rounded py-0.5 px-1 text-slate-700"
                          >
                            {TASK_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                → {s}
                              </option>
                            ))}
                          </select>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(task)}
                              className="p-1 text-slate-400 hover:text-slate-700"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => deleteTask(task.id)}
                              className="p-1 text-slate-400 hover:text-red-600"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50/80 border-b border-slate-200 font-semibold text-slate-700 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Task Name</th>
                  <th className="py-3 px-4">Related Record</th>
                  <th className="py-3 px-4">Priority</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4">Progress</th>
                  <th className="py-3 px-4">Assigned To</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTasks.map((task) => (
                  <tr key={task.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-900">{task.taskName}</div>
                      <div className="text-[11px] text-slate-500 line-clamp-1">{task.description}</div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{task.relatedName || '—'}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          task.priority === 'High'
                            ? 'bg-red-100 text-red-700'
                            : task.priority === 'Medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {task.priority}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-700">{task.dueDate}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: `${task.completionPercentage}%` }}
                          />
                        </div>
                        <span className="text-[11px] font-semibold text-slate-700">
                          {task.completionPercentage}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-800">{task.assignedToName}</td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded-full font-semibold text-[10px] bg-slate-100 text-slate-700">
                        {task.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(task)}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="p-1 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900">Upcoming Task Deadlines Timeline</h3>
            <span className="text-xs text-slate-500">Sorted by Due Date</span>
          </div>

          <div className="space-y-3">
            {filteredTasks
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .map((t) => (
                <div
                  key={t.id}
                  className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100/70 border border-slate-200 rounded-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl text-center shrink-0 w-14">
                      <div className="text-[10px] uppercase font-bold text-blue-600">
                        {new Date(t.dueDate).toLocaleString('default', { month: 'short' })}
                      </div>
                      <div className="text-base font-extrabold text-slate-900 leading-none">
                        {new Date(t.dueDate).getDate()}
                      </div>
                    </div>

                    <div>
                      <div className="font-bold text-xs text-slate-900">{t.taskName}</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Assigned to: {t.assignedToName} {t.relatedName ? `• ${t.relatedName}` : ''}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${
                        t.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {t.priority}
                    </span>
                    <span className="text-xs font-semibold text-slate-700">{t.status}</span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Add / Edit Task Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-emerald-50/40">
              <h3 className="font-bold text-slate-900 text-base">
                {editingTask ? 'Edit Task Details' : 'Create New Operational Task'}
              </h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Schedule warehouse safety audit & IoT check"
                  value={formData.taskName}
                  onChange={(e) => setFormData({ ...formData, taskName: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Task Description & Deliverables</label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide explicit instructions or checklist expectations..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Related Client / Customer</label>
                  <select
                    value={formData.relatedId}
                    onChange={(e) => {
                      const cust = customers.find((c) => c.id === e.target.value);
                      setFormData({
                        ...formData,
                        relatedId: e.target.value,
                        relatedName: cust ? cust.fullName : '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">None (Internal Company Task)</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName} ({c.companyName})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Assigned Employee</label>
                  <select
                    value={formData.assignedToId}
                    onChange={(e) => {
                      const emp = employees.find((x) => x.uid === e.target.value);
                      setFormData({
                        ...formData,
                        assignedToId: e.target.value,
                        assignedToName: emp?.displayName || '',
                      });
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {employees.map((emp) => (
                      <option key={emp.uid} value={emp.uid}>
                        {emp.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as TaskPriority })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    required
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TaskStatus })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {TASK_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Completion Percentage ({formData.completionPercentage}%)
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={10}
                    value={formData.completionPercentage}
                    onChange={(e) => setFormData({ ...formData, completionPercentage: Number(e.target.value) })}
                    className="w-full mt-2"
                  />
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
                  className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg shadow-xs"
                >
                  {editingTask ? 'Update Task' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
