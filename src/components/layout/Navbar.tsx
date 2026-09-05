import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import {
  Search,
  Bell,
  Sparkles,
  User,
  Shield,
  Check,
  RotateCcw,
  LogOut,
  ChevronDown,
  Menu,
  Building2,
  ExternalLink,
} from 'lucide-react';
import { GlobalSearchModal } from '../common/GlobalSearchModal';

interface NavbarProps {
  onToggleMobileSidebar: () => void;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleMobileSidebar, onOpenAuthModal }) => {
  const {
    currentUser,
    currentOrg,
    switchRole,
    notifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    setIsAiDrawerOpen,
    resetToSampleData,
    logout,
    setActiveTab,
  } = useApp();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isRoleMenuOpen, setIsRoleMenuOpen] = useState(false);
  const [isNotifMenuOpen, setIsNotifMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const roles: { role: UserRole; label: string; desc: string }[] = [
    { role: 'super_admin', label: 'Super Admin', desc: 'Full cross-organization & infrastructure access' },
    { role: 'business_admin', label: 'Business Admin', desc: 'Manage organization, staff, automations & settings' },
    { role: 'manager', label: 'Manager', desc: 'Lead pipeline, approvals & customer escalations' },
    { role: 'staff', label: 'Staff', desc: 'Customer support, tasks & ticket execution' },
    { role: 'viewer', label: 'Viewer', desc: 'Read-only analytics and audit compliance' },
  ];

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-8 bg-white border-b border-slate-200">
        {/* Left: Mobile Menu & Global Search Bar */}
        <div className="flex items-center gap-3 flex-1 max-w-xl">
          <button
            onClick={onToggleMobileSidebar}
            className="p-2 text-slate-600 rounded-lg lg:hidden hover:bg-slate-100"
            aria-label="Toggle Navigation"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div
            onClick={() => setIsSearchOpen(true)}
            className="relative flex items-center w-full max-w-sm cursor-pointer group"
          >
            <Search className="absolute left-3 w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors shrink-0" />
            <div className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-400 group-hover:border-slate-300 transition-all flex items-center justify-between">
              <span className="hidden sm:inline">Search records, leads, tickets...</span>
              <span className="sm:hidden">Search...</span>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 text-[10px] font-semibold text-slate-400 bg-slate-50 border border-slate-200 rounded">
                ⌘K
              </kbd>
            </div>
          </div>
        </div>

        {/* Right: Actions, AI Assistant, Role Switcher, Notifications, Profile */}
        <div className="flex items-center gap-2 sm:gap-3.5">
          {/* Gemini AI Status / Quick Trigger Pill */}
          <button
            onClick={() => setIsAiDrawerOpen(true)}
            className="flex h-9 items-center gap-2 rounded-full bg-indigo-50 px-3.5 text-indigo-600 border border-indigo-100 hover:bg-indigo-100/70 transition-colors shadow-2xs"
            title="Ask Gemini AI"
          >
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline">Gemini AI Online</span>
            <span className="text-xs font-bold uppercase tracking-wider sm:hidden">AI</span>
          </button>

          {/* Role Switcher Pill (for quick RBAC previewing) */}
          <div className="relative">
            <button
              onClick={() => setIsRoleMenuOpen(!isRoleMenuOpen)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors"
              title="Switch RBAC Role"
            >
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span className="hidden md:inline capitalize">{currentUser?.role.replace('_', ' ')}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isRoleMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsRoleMenuOpen(false)}
              >
                <div className="px-3 py-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Test Role-Based Access (RBAC)
                </div>
                {roles.map((r) => (
                  <button
                    key={r.role}
                    onClick={() => switchRole(r.role)}
                    className="flex items-start w-full px-3 py-2 text-left text-xs hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                        {r.label}
                        {currentUser?.role === r.role && <Check className="w-3.5 h-3.5 text-emerald-600" />}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">{r.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Notifications Bell */}
          <div className="relative">
            <button
              onClick={() => setIsNotifMenuOpen(!isNotifMenuOpen)}
              className="relative p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 flex items-center justify-center w-4 h-4 text-[10px] font-bold text-white bg-red-500 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>

            {isNotifMenuOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between px-4 py-2 border-b border-slate-100">
                  <div className="font-semibold text-sm text-slate-900">Notifications ({unreadCount} unread)</div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllNotificationsAsRead}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {notifications.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 8).map((notif) => (
                      <div
                        key={notif.id}
                        onClick={() => {
                          markNotificationAsRead(notif.id);
                          if (notif.referenceType === 'complaint') setActiveTab('complaints');
                          if (notif.referenceType === 'lead') setActiveTab('leads');
                          if (notif.referenceType === 'task') setActiveTab('tasks');
                          if (notif.referenceType === 'automation') setActiveTab('automation');
                          setIsNotifMenuOpen(false);
                        }}
                        className={`p-3 text-xs cursor-pointer hover:bg-slate-50 transition-colors flex items-start gap-2.5 ${
                          !notif.isRead ? 'bg-blue-50/40 font-medium' : ''
                        }`}
                      >
                        <div
                          className={`w-2 h-2 mt-1.5 rounded-full shrink-0 ${
                            !notif.isRead ? 'bg-blue-600' : 'bg-transparent'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="text-slate-900 font-semibold">{notif.title}</div>
                          <div className="text-slate-600 mt-0.5 line-clamp-2">{notif.message}</div>
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(notif.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="px-4 py-2 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setActiveTab('notifications');
                      setIsNotifMenuOpen(false);
                    }}
                    className="text-xs text-blue-600 hover:underline font-medium"
                  >
                    View all notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Profile / Menu */}
          <div className="relative">
            <button
              onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
              className="flex items-center gap-2 p-1.5 text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-linear-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                {currentUser?.displayName?.[0] || 'U'}
              </div>
              <div className="hidden lg:block text-left">
                <div className="text-xs font-semibold text-slate-900 leading-tight">
                  {currentUser?.displayName || 'User'}
                </div>
                <div className="text-[10px] text-slate-500 capitalize leading-tight">
                  {currentUser?.role.replace('_', ' ')}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
            </button>

            {isUserMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-60 bg-white border border-slate-200 rounded-xl shadow-xl py-2 z-50 animate-in fade-in zoom-in-95 duration-100"
                onClick={() => setIsUserMenuOpen(false)}
              >
                <div className="px-4 py-2 border-b border-slate-100">
                  <div className="font-semibold text-xs text-slate-900">{currentUser?.displayName}</div>
                  <div className="text-[11px] text-slate-500 truncate">{currentUser?.email}</div>
                  <div className="text-[10px] mt-1 inline-block px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded font-medium">
                    {currentOrg.name}
                  </div>
                </div>

                <div className="py-1">
                  <button
                    onClick={() => setActiveTab('settings')}
                    className="flex items-center w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <Building2 className="w-4 h-4 mr-2 text-slate-400" />
                    Organization & Settings
                  </button>

                  <button
                    onClick={onOpenAuthModal}
                    className="flex items-center w-full px-4 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <User className="w-4 h-4 mr-2 text-slate-400" />
                    Login / Switch Account
                  </button>

                  <button
                    onClick={resetToSampleData}
                    className="flex items-center w-full px-4 py-2 text-xs text-amber-700 hover:bg-amber-50"
                  >
                    <RotateCcw className="w-4 h-4 mr-2 text-amber-500" />
                    Reload Sample Data (10+10+10+10)
                  </button>
                </div>

                <div className="border-t border-slate-100 pt-1">
                  <button
                    onClick={logout}
                    className="flex items-center w-full px-4 py-2 text-xs text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="w-4 h-4 mr-2 text-red-500" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Global Search Modal */}
      <GlobalSearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
    </>
  );
};
