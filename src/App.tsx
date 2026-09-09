import React, { useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { InventoryProvider } from './context/InventoryContext';
import { Navbar } from './components/layout/Navbar';
import { Sidebar } from './components/layout/Sidebar';
import { AuthModal } from './components/auth/AuthModal';
import { AiAssistantDrawer } from './components/common/AiAssistantDrawer';
import { DashboardView } from './components/dashboard/DashboardView';
import { CustomersView } from './components/customers/CustomersView';
import { LeadsView } from './components/leads/LeadsView';
import { ComplaintsView } from './components/complaints/ComplaintsView';
import { TasksView } from './components/tasks/TasksView';
import { AutomationCenterView } from './components/automation/AutomationCenterView';
import { CommunicationsView } from './components/communications/CommunicationsView';
import { DocumentsView } from './components/documents/DocumentsView';
import { ReportsView } from './components/reports/ReportsView';
import { EmployeesView } from './components/employees/EmployeesView';
import { SettingsView } from './components/settings/SettingsView';
import { NotificationsView } from './components/notifications/NotificationsView';
import { InvoicesQuotesView } from './components/invoices/InvoicesQuotesView';
import { InventoryModule } from './components/inventory/InventoryModule';

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
          {renderCurrentView()}
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
      <InventoryProvider>
        <MainLayout />
      </InventoryProvider>
    </AppProvider>
  );
}
