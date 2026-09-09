import React from 'react';
import { useApp } from '../../context/AppContext';
import { useInventory } from '../../context/InventoryContext';
import {
  LayoutDashboard,
  Users,
  TrendingUp,
  AlertCircle,
  CheckSquare,
  Cpu,
  MessageSquare,
  FileText,
  BarChart3,
  Sparkles,
  Bell,
  UserCheck,
  Settings,
  X,
  Zap,
  Receipt,
  Boxes,
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const {
    activeTab,
    setActiveTab,
    currentUser,
    currentOrg,
    leads,
    complaints,
    tasks,
    quotations,
    invoices,
    notifications,
    automations,
    automationLogs,
    settings,
    syncStatus,
    setIsAiDrawerOpen,
  } = useApp();

  const openComplaintsCount = complaints.filter(
    (c) => c.status !== 'Resolved' && c.status !== 'Closed'
  ).length;

  const activeLeadsCount = leads.filter(
    (l) => l.status !== 'Won' && l.status !== 'Lost'
  ).length;

  const pendingTasksCount = tasks.filter((t) => t.status !== 'Completed').length;
  const unreadNotifCount = notifications.filter((n) => !n.isRead).length;
  const activeAutomationsCount = automations.filter((a) => a.isEnabled).length;
  const pendingInvoicesCount = invoices.filter((inv) => inv.status !== 'Paid' && inv.status !== 'Cancelled').length;

  const { products } = useInventory();
  const lowStockCount = products.filter((p) => p.currentStock <= p.reorderLevel).length;

  /**
   * The integration badge used to read "n8n Webhook Online" with a green pulse,
   * unconditionally — it was two literal strings, not a status. It stayed green
   * with n8n disabled, with no webhook URL saved, and while every dispatch was
   * failing. Now it reports what is actually true.
   *
   * There is no health ping to n8n: the browser cannot reach the webhook
   * directly (CORS, and the credential lives on the server), so "online" here
   * means "configured, and the last dispatch we attempted did not fail" —
   * which is the strongest claim the client can honestly make.
   */
  const integration = React.useMemo(() => {
    if (!settings.n8nEnabled) {
      return { label: 'n8n Disabled', dot: 'bg-slate-400', pulse: false, title: 'Automation dispatch is switched off in Settings.' };
    }
    const hasTarget =
      Boolean(settings.n8nWebhookUrl?.trim()) ||
      automations.some((a) => a.isEnabled && a.targetWebhookUrl?.trim());
    if (!hasTarget) {
      return { label: 'n8n Not Configured', dot: 'bg-amber-500', pulse: false, title: 'No webhook URL saved. Add one in Settings, or per rule in Automations.' };
    }
    const lastRun = automationLogs.reduce<(typeof automationLogs)[number] | null>(
      (latest, log) => (!latest || log.timestamp > latest.timestamp ? log : latest),
      null
    );
    if (lastRun && lastRun.status === 'Failed') {
      return { label: 'n8n Last Run Failed', dot: 'bg-red-500', pulse: false, title: `${lastRun.automationName}: ${lastRun.errorMessage ?? 'dispatch failed'}` };
    }
    if (!lastRun) {
      return { label: 'n8n Configured', dot: 'bg-emerald-500', pulse: false, title: 'Webhook saved. Nothing has been dispatched yet.' };
    }
    return { label: 'n8n Webhook Online', dot: 'bg-emerald-500', pulse: true, title: `Last dispatch succeeded at ${new Date(lastRun.timestamp).toLocaleString('en-IN')}.` };
  }, [settings.n8nEnabled, settings.n8nWebhookUrl, automations, automationLogs]);

  /** Live / cached / offline, from the Firestore listeners rather than a guess. */
  const sync =
    syncStatus === 'live'
      ? { label: 'Live', className: 'text-indigo-600', title: 'Synced with Firestore in real time.' }
      : syncStatus === 'cache'
        ? { label: 'Cached', className: 'text-amber-600', title: 'Showing cached data while the connection settles.' }
        : { label: 'Offline', className: 'text-red-600', title: 'Not reaching Firestore — changes are staying in this browser.' };

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'customers', label: 'Customers', icon: Users },
    {
      id: 'leads',
      label: 'Leads',
      icon: TrendingUp,
      badge: activeLeadsCount > 0 ? activeLeadsCount : undefined,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'invoices',
      label: 'Quotes & Invoices',
      icon: Receipt,
      badge: pendingInvoicesCount > 0 ? `${pendingInvoicesCount} Due` : undefined,
      badgeColor: 'bg-blue-100 text-blue-800 font-semibold',
    },
    {
      id: 'inventory',
      label: 'Inventory & Store',
      icon: Boxes,
      badge: lowStockCount > 0 ? `${lowStockCount} Low` : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 font-semibold',
    },
    {
      id: 'complaints',
      label: 'Complaints',
      icon: AlertCircle,
      badge: openComplaintsCount > 0 ? openComplaintsCount : undefined,
      badgeColor: 'bg-red-100 text-red-700 font-bold',
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      badge: pendingTasksCount > 0 ? pendingTasksCount : undefined,
      badgeColor: 'bg-emerald-100 text-emerald-800',
    },
    {
      id: 'automation',
      label: 'Automation',
      icon: Cpu,
      badge: activeAutomationsCount > 0 ? `${activeAutomationsCount} On` : undefined,
      badgeColor: 'bg-indigo-100 text-indigo-800',
    },
    { id: 'communications', label: 'Communications', icon: MessageSquare },
    { id: 'documents', label: 'Documents', icon: FileText },
    { id: 'reports', label: 'Reports', icon: BarChart3 },
    {
      id: 'ai-assistant',
      label: 'AI Assistant',
      icon: Sparkles,
      isAiTrigger: true,
      badge: 'Gemini',
      badgeColor: 'bg-purple-100 text-purple-700',
    },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadNotifCount > 0 ? unreadNotifCount : undefined,
      badgeColor: 'bg-red-500 text-white',
    },
    { id: 'employees', label: 'Employees', icon: UserCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const handleSelect = (id: string, isAiTrigger?: boolean) => {
    if (isAiTrigger) {
      setIsAiDrawerOpen(true);
      onCloseMobile();
      return;
    }
    setActiveTab(id);
    onCloseMobile();
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white text-slate-700">
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-base shadow-xs">
            S
          </div>
          <div className="leading-tight overflow-hidden">
            <span className="font-bold text-slate-900 text-sm tracking-tight block truncate">SmartHub AI</span>
            <span className="text-[10px] font-semibold text-blue-600 tracking-wider uppercase block truncate">Automation Hub</span>
          </div>
        </div>
        <button
          onClick={onCloseMobile}
          className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg lg:hidden"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 p-3.5 overflow-y-auto custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id, item.isAiTrigger)}
              className={`flex items-center justify-between w-full px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-700 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`h-4.5 w-4.5 ${
                    isActive ? 'text-blue-700' : item.isAiTrigger ? 'text-purple-600' : 'text-slate-500'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className={`px-2 py-0.5 text-[11px] rounded-full font-semibold ${
                  item.badgeColor || (isActive ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600')
                }`}>
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer User & Workspace Card */}
      <div className="border-t border-slate-200 p-3.5 space-y-2">
        <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
          <div className="h-8 w-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0">
            {currentUser?.displayName ? currentUser.displayName.slice(0, 2).toUpperCase() : 'AD'}
          </div>
          <div className="overflow-hidden flex-1 min-w-0">
            <p className="truncate text-xs font-semibold text-slate-900">{currentUser?.displayName || 'Admin User'}</p>
            <p className="truncate text-[10px] text-slate-500">{currentOrg?.name || 'Smart Business Hub'}</p>
          </div>
        </div>

        {/* Integration Status Badge */}
        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5 font-medium" title={integration.title}>
            <span className={`h-2 w-2 rounded-full ${integration.dot} ${integration.pulse ? 'animate-pulse' : ''}`} />
            {integration.label}
          </span>
          <span className={`text-[10px] font-semibold uppercase ${sync.className}`} title={sync.title}>
            {sync.label}
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white z-20">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex flex-col w-72 max-w-xs h-full bg-white shadow-xl z-10 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
};
