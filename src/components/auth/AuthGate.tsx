import React from 'react';
import { ShieldAlert, Loader2, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AuthModal } from './AuthModal';

/**
 * Decides whether the application shell may render at all.
 *
 * Previously `App.tsx` rendered the full workspace unconditionally and offered
 * sign-in as an optional modal, while `AppContext` booted with the Super Admin
 * profile already loaded. Anyone with the URL had full access to customer
 * GSTINs, invoice bank details and staff contact numbers.
 *
 * Now nothing renders until identity is resolved, and an account that no
 * administrator has provisioned gets a dead end rather than a default role.
 */
export const AuthGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authStatus, logout } = useApp();

  if (authStatus === 'ready') return <>{children}</>;

  if (authStatus === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-xs font-medium">Checking your session...</p>
        </div>
      </div>
    );
  }

  if (authStatus === 'unprovisioned') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-amber-50">
            <ShieldAlert className="h-5 w-5 text-amber-600" />
          </div>
          <h1 className="text-base font-bold text-slate-900">Account not yet provisioned</h1>
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            You are signed in, but this account has not been assigned to an organisation. An
            administrator needs to grant you a role before you can open the workspace.
          </p>
          <p className="mt-3 rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
            Administrators: assign a role and organisation with{' '}
            <code className="font-mono text-slate-700">scripts/set-claims.mjs</code>. The user must
            then sign out and back in, because claims are written into the ID token when it is
            issued.
          </p>
          <button
            onClick={logout}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // signed-out — the sign-in card, with no way to dismiss past it.
  return <AuthModal isOpen isGate onClose={() => undefined} />;
};
