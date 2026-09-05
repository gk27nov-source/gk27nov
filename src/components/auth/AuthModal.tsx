import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { UserRole } from '../../types';
import { auth, googleProvider } from '../../firebase/config';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import {
  X,
  Mail,
  Lock,
  User,
  Building,
  Shield,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  KeyRound,
} from 'lucide-react';
import { initialUsers } from '../../data/seedData';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { setCurrentUser, switchRole } = useApp();
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('business_admin');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        setCurrentUser({
          uid: fbUser.uid,
          email: fbUser.email || email,
          displayName: fbUser.displayName || email.split('@')[0],
          role: 'business_admin',
          organizationId: 'org_smart_hub_01',
          organizationName: organizationName || 'My Business',
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        setSuccessMsg('Successfully logged in!');
        setTimeout(onClose, 800);
      } else if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const fbUser = userCredential.user;
        await updateProfile(fbUser, { displayName });

        setCurrentUser({
          uid: fbUser.uid,
          email: fbUser.email || email,
          displayName: displayName || 'New User',
          role: selectedRole,
          organizationId: `org_${Date.now()}`,
          organizationName: organizationName || 'My Business Enterprise',
          isActive: true,
          createdAt: new Date().toISOString(),
        });
        setSuccessMsg('Account and organization created successfully!');
        setTimeout(onClose, 800);
      } else if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        setSuccessMsg('Password reset instructions sent to your email address.');
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const fbUser = result.user;
      setCurrentUser({
        uid: fbUser.uid,
        email: fbUser.email || '',
        displayName: fbUser.displayName || 'Google User',
        photoURL: fbUser.photoURL || undefined,
        role: 'business_admin',
        organizationId: 'org_smart_hub_01',
        organizationName: 'Apex Industrial Solutions',
        isActive: true,
        createdAt: new Date().toISOString(),
      });
      setSuccessMsg('Signed in with Google!');
      setTimeout(onClose, 800);
    } catch (err: any) {
      setErrorMsg(err.message || 'Google Sign-In failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemoSwitch = (role: UserRole) => {
    switchRole(role);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              {mode === 'login' ? 'Sign In to Workspace' : mode === 'signup' ? 'Create New Business Account' : 'Reset Password'}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Smart Business Automation Hub</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="p-3 text-xs bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Quick Demo Personas */}
          <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl">
            <div className="text-[11px] font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              1-Click Demo Personas (Instant Access)
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('super_admin')}
                className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-md shadow-2xs transition-colors truncate"
              >
                Super Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('business_admin')}
                className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-md shadow-2xs transition-colors truncate"
              >
                Biz Admin
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('manager')}
                className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-md shadow-2xs transition-colors truncate"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('staff')}
                className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-md shadow-2xs transition-colors truncate"
              >
                Staff Rep
              </button>
              <button
                type="button"
                onClick={() => handleQuickDemoSwitch('viewer')}
                className="px-2 py-1 text-[11px] font-semibold bg-white text-slate-700 hover:bg-blue-600 hover:text-white border border-slate-200 rounded-md shadow-2xs transition-colors truncate"
              >
                Viewer (Read-Only)
              </button>
            </div>
          </div>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-200 w-full" />
            <span className="bg-white px-2 text-[10px] text-slate-400 uppercase font-semibold tracking-wider absolute">
              Or Real Firebase Auth
            </span>
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'signup' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Your Full Name</label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Chandra"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Company / Organization Name</label>
                  <div className="relative">
                    <Building className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Chandra Technologies Ltd."
                      value={organizationName}
                      onChange={(e) => setOrganizationName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Initial Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="business_admin">Business Admin (Full control of company)</option>
                    <option value="manager">Manager (Sales & customer success)</option>
                    <option value="staff">Staff (Support & tasks)</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Work Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  placeholder="admin@yourcompany.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => setMode('forgot')}
                      className="text-[11px] text-blue-600 hover:underline"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium text-xs rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-4"
            >
              {loading ? (
                <span>Authenticating...</span>
              ) : (
                <>
                  <span>
                    {mode === 'login' ? 'Sign In to Hub' : mode === 'signup' ? 'Create Business Account' : 'Send Reset Link'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Google Sign-in */}
          {mode !== 'forgot' && (
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full py-2 px-3 bg-white hover:bg-slate-50 border border-slate-300 text-slate-700 font-medium text-xs rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>Continue with Google Sign-In</span>
            </button>
          )}

          {/* Switch Mode Footer */}
          <div className="text-center text-xs text-slate-500 pt-2 border-t border-slate-100">
            {mode === 'login' ? (
              <p>
                Don't have an organization account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('signup')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign Up
                </button>
              </p>
            ) : (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="font-semibold text-blue-600 hover:underline"
                >
                  Sign In
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
