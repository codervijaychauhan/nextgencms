import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  X,
  Mail,
  Lock,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }

    const msgParam = searchParams.get('msg') || searchParams.get('message');
    const registered = searchParams.get('registered');
    const reset = searchParams.get('reset');

    if (msgParam) {
      setSuccessMessage(msgParam);
    } else if (registered) {
      setSuccessMessage('Account registered successfully! Please sign in to continue.');
    } else if (reset) {
      setSuccessMessage('Password reset successfully! Please sign in with your new password.');
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMessage('');

    // 1. Try Firebase Auth
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      setSuccessMessage('Login successful! Redirecting to workspace...');
      await refreshProfile();
      setTimeout(() => navigate('/dashboard'), 400);
      return;
    } catch (firebaseErr: unknown) {
      console.log('Firebase login attempt evaluated, checking database authentication...');
    }

    // 2. Fallback to Local MSSQL Database Password check
    try {
      const res = await api.post<{ success: boolean; token: string; user: any }>('/api/auth/local-login', {
        email: email.trim(),
        password: password
      });

      if (res && res.token) {
        localStorage.setItem('nextgen_local_token', res.token);
        setSuccessMessage('Login successful! Redirecting to workspace...');
        await refreshProfile();
        setTimeout(() => navigate('/dashboard'), 400);
        return;
      }
    } catch (localErr: any) {
      console.error('Local login error:', localErr);
      setError(localErr.message || 'Invalid email or password. Please verify credentials or continue with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    setSuccessMessage('');

    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      setSuccessMessage('Google authentication verified! Redirecting...');
      await refreshProfile();
      setTimeout(() => navigate('/dashboard'), 400);
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : '';
      
      if (errorCode === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled: The authentication popup was closed.');
      } else if (errorCode === 'auth/popup-blocked') {
        setError(`Popup blocked: Please allow popups for ${window.location.hostname} in your browser settings.`);
      } else if (errorCode === 'auth/unauthorized-domain') {
        setError(`Domain unauthorized: Please add "${window.location.hostname}" to Authorized Domains in Firebase Console (Authentication > Settings > Authorized Domains).`);
      } else if (errorCode === 'auth/operation-not-allowed') {
        setError('Google Provider is not enabled in Firebase Console.');
      } else if (errorCode === 'auth/cancelled-popup-request') {
        setError('Only one popup request is allowed at a time.');
      } else {
        setError(errorMessage || 'Failed to sign in with Google. Please verify your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col justify-center items-center bg-[#f8fafc] dark:bg-[#0a0f1d] text-zinc-900 dark:text-zinc-100 p-4 sm:p-6 md:p-8 transition-colors duration-200 relative overflow-x-hidden">
      
      {/* Ambient background soft glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Single Centered Authentication Card */}
      <main className="w-full max-w-[420px] my-auto z-10 space-y-5">
        
        {/* Card Container */}
        <div className="webapp-card p-6 sm:p-7 space-y-4.5 bg-white dark:bg-[#0f172a] border border-zinc-200/90 dark:border-slate-800/90 rounded-2xl shadow-[0_4px_24px_-4px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)]">
          
          <div className="text-center pb-1">
            <Logo size={42} className="mx-auto" />
          </div>

          {/* Google OAuth Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 text-zinc-800 dark:text-zinc-200 border border-zinc-300 dark:border-zinc-700/80 rounded-xl text-xs font-bold transition-all shadow-xs active:scale-[0.99] disabled:opacity-60"
          >
            {/* Google Brand Colored SVG */}
            <svg width="17" height="17" viewBox="0 0 24 24" className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            Continue with Google
          </button>

          {/* Classic Divider */}
          <div className="relative flex items-center py-0.5">
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
            <span className="flex-shrink mx-3 text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest bg-transparent">
              or continue with email
            </span>
            <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800"></div>
          </div>

          {/* Error Notification Alert */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="p-3 bg-red-500/10 border border-red-500/25 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-500" />
                  <span className="break-words leading-relaxed">{error}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setError('')} 
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300 opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </motion.div>
            )}

            {/* Success Notification Alert */}
            {successMessage && (
              <motion.div 
                initial={{ opacity: 0, y: -6, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -6, height: 0 }}
                className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-start justify-between gap-2"
              >
                <div className="flex items-start gap-2 min-w-0">
                  <CheckCircle2 size={15} className="shrink-0 mt-0.5 text-emerald-500" />
                  <span className="break-words leading-relaxed">{successMessage}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setSuccessMessage('')} 
                  className="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300 opacity-60 hover:opacity-100 transition-opacity p-0.5 shrink-0"
                  title="Dismiss"
                >
                  <X size={13} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-3.5">
            
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider block ml-0.5">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail size={15} className="absolute left-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="webapp-input w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl"
                  placeholder="name@organization.com"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-0.5">
                <label className="text-[11px] font-bold text-zinc-600 dark:text-zinc-300 uppercase tracking-wider">
                  Password
                </label>
                <Link 
                  to="/forgot-password" 
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 hover:underline uppercase tracking-wider"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative flex items-center">
                <Lock size={15} className="absolute left-3.5 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="webapp-input w-full pl-10 pr-10 py-2.5 text-xs rounded-xl font-medium tracking-normal"
                  placeholder="••••••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded-lg"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me Option */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800"
                />
                <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Keep me signed in</span>
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-zinc-900 hover:bg-zinc-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-sm hover:shadow active:scale-[0.99] transition-all disabled:opacity-50 mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={15} />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Bottom Link */}
        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Don't have an account yet?{' '}
          <Link to="/signup" className="text-zinc-900 dark:text-white font-bold hover:underline">
            Create an account
          </Link>
        </p>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-[420px] text-center text-[11px] text-zinc-400 dark:text-zinc-500 space-y-1 z-10 pt-4 pb-2">
        <div className="flex items-center justify-center gap-1.5 text-zinc-500 dark:text-zinc-400 font-medium text-[10px]">
          <ShieldCheck size={12} className="text-emerald-500" />
          <span>256-bit SSL Encrypted • NextGen CMS v2.4</span>
        </div>
        <div>© 2026 NextGen CMS Platform. All rights reserved.</div>
      </footer>

    </div>
  );
}



