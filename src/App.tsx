import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { InventoryProvider } from './context/InventoryContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AuthModal } from './components/auth/AuthModal';
import { AuthGate } from './components/auth/AuthGate';
import { AiAssistantDrawer } from './components/common/AiAssistantDrawer';

/*
  Route-level code splitting.

  Every one of the fourteen views used to be a static import, so the whole
  application — including the charting library that only Dashboard and Reports
  touch, and the inventory module nobody opens on their first visit — arrived
  in one bundle before anything could render. On the connections this is meant
  to run on, that first paint is the whole experience.

  Each view is now its own chunk, fetched when the tab is first opened and
  cached by the browser thereafter. Dashboard is deliberately NOT lazy: it is
  what loads on sign-in, so splitting it would only add a round trip in front
  of the very first screen.

  The views export named components, so each import is mapped to a default.
*/
import { DashboardView } from './components/dashboard/DashboardView';

const lazyView = <K extends string>(
  loader: () => Promise<Record<K, React.ComponentType>>,
  name: K
) => React.lazy(() => loader().then((m) => ({ default: m[name] })));

const CustomersView = lazyView(() => import('./components/customers/CustomersView'), 'CustomersView');
const LeadsView = lazyView(() => import('./components/leads/LeadsView'), 'LeadsView');
const ComplaintsView = lazyView(() => import('./components/complaints/ComplaintsView'), 'ComplaintsView');
const TasksView = lazyView(() => import('./components/tasks/TasksView'), 'TasksView');
const AutomationCenterView = lazyView(() => import('./components/automation/AutomationCenterView'), 'AutomationCenterView');
const CommunicationsView = lazyView(() => import('./components/communications/CommunicationsView'), 'CommunicationsView');
const DocumentsView = lazyView(() => import('./components/documents/DocumentsView'), 'DocumentsView');
const ReportsView = lazyView(() => import('./components/reports/ReportsView'), 'ReportsView');
const EmployeesView = lazyView(() => import('./components/employees/EmployeesView'), 'EmployeesView');
const SettingsView = lazyView(() => import('./components/settings/SettingsView'), 'SettingsView');
const NotificationsView = lazyView(() => import('./components/notifications/NotificationsView'), 'NotificationsView');
const InvoicesQuotesView = lazyView(() => import('./components/invoices/InvoicesQuotesView'), 'InvoicesQuotesView');
const InventoryModule = lazyView(() => import('./components/inventory/InventoryModule'), 'InventoryModule');

/** Shown while a view's chunk is in flight. Deliberately quiet. */
const ViewLoading: React.FC = () => (
  <div className="flex h-full min-h-[60vh] items-center justify-center">
    <div className="flex flex-col items-center gap-3 text-slate-400">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
      <span className="text-xs font-medium">Loading…</span>
    </div>
  </div>
);

const MainLayout: React.FC = () => {
  const { activeTab, currentUser } = useApp();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  // Render the current view according to activeTab
  const renderCurrentView = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardView />;
      case 'customers':
        return <CustomersView />;
      case 'leads':
        return <LeadsView />;
      case 'invoices':
      case 'quotations':
        return <InvoicesQuotesView />;
      case 'inventory':
        return <InventoryModule />;
      case 'complaints':
        return <ComplaintsView />;
      case 'tasks':
        return <TasksView />;
      case 'automation':
        return <AutomationCenterView />;
      case 'communications':
        return <CommunicationsView />;
      case 'documents':
        return <DocumentsView />;
      case 'reports':
        return <ReportsView />;
      case 'employees':
        return <EmployeesView />;
      case 'settings':
        return <SettingsView />;
      case 'notifications':
        return <NotificationsView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 font-sans text-slate-800 antialiased selection:bg-blue-500 selection:text-white">
      {/* Sidebar for Desktop & Drawer for Mobile */}
      <Sidebar
        isMobileOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Global Navigation Header */}
        <Navbar
          onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
          onOpenAuthModal={() => setIsAuthModalOpen(true)}
        />

        {/* View Content Body */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          <React.Suspense fallback={<ViewLoading />}>{renderCurrentView()}</React.Suspense>
        </main>
      </div>

      {/* Global AI Assistant Drawer */}
      <AiAssistantDrawer />

      {/* Firebase Authentication / Switch Persona Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      {/*
        AuthGate sits INSIDE AppProvider (it needs auth state) but OUTSIDE
        InventoryProvider — InventoryProvider opens Firestore onSnapshot
        listeners on mount, and those are exactly the reads that returned
        permission-denied while nobody was signed in. Mounting it only after
        identity resolves means the listeners attach with a real token.
      */}
      <AuthGate>
        <InventoryProvider>
          <MainLayout />
        </InventoryProvider>
      </AuthGate>
    </AppProvider>
  );
}
