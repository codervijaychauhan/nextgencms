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
import { motion } from 'motion/react';
import { LogIn, Chrome, Loader2, AlertCircle } from 'lucide-react';

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  useEffect(() => {
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setEmail(emailParam);
    }
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // 1. Try Firebase Auth
    try {
      await setPersistence(auth, browserLocalPersistence);
      await signInWithEmailAndPassword(auth, email, password);
      await refreshProfile();
      navigate('/dashboard');
      return;
    } catch (firebaseErr: unknown) {
      console.log('Firebase login attempted, checking local database...');
    }

    // 2. Fallback to Local MSSQL Database Password check
    try {
      const res = await api.post<{ success: boolean; token: string; user: any }>('/api/auth/local-login', {
        email: email.trim(),
        password: password
      });

      if (res && res.token) {
        localStorage.setItem('nextgen_local_token', res.token);
        await refreshProfile();
        navigate('/dashboard');
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
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      await refreshProfile();
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Google sign in error:', err);
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : '';
      
      if (errorCode === 'auth/popup-closed-by-user') {
        setError('Sign-in cancelled: The Google sign-in window was closed before completing login.');
      } else if (errorCode === 'auth/popup-blocked') {
        setError('Popup blocked: Please allow popups for localhost:3000 in your browser settings.');
      } else if (errorCode === 'auth/unauthorized-domain') {
        setError('Domain unauthorized: "localhost" is not authorized in your Firebase Project. Go to Firebase Console -> Authentication -> Settings -> Authorized domains -> Add "localhost".');
      } else if (errorCode === 'auth/operation-not-allowed') {
        setError('Google Provider is not enabled in your Firebase Project. Please go to Firebase Console -> Authentication -> Sign-in method -> Enable "Google".');
      } else if (errorCode === 'auth/cancelled-popup-request') {
        setError('Only one popup request is allowed at a time.');
      } else {
        setError(errorMessage || 'Failed to sign in with Google. Please check your internet connection or enable Google provider in Firebase Console.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[380px] space-y-6"
      >
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Welcome back</h1>
          <p className="text-sm text-zinc-500">Sign in to your account to continue</p>
        </div>

        <div className="webapp-card p-6 space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="webapp-button-secondary w-full flex items-center justify-center gap-2 py-2.5"
          >
            <Chrome size={18} />
            Continue with Google
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-200 dark:border-zinc-800"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white dark:bg-zinc-900 px-3 text-[10px] font-bold text-zinc-400 uppercase tracking-widest leading-none">or</span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="webapp-input w-full"
                placeholder="name@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between ml-1">
                <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">Password</label>
                <Link to="/forgot-password" size="sm" className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-widest">
                  Forgot?
                </Link>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="webapp-input w-full"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="webapp-button-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
              Sign In
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-500 font-medium">
          Don't have an account?{' '}
          <Link to="/signup" className="text-zinc-900 dark:text-white font-bold hover:underline">
            Sign up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
