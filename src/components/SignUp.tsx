import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import Logo from './Logo';
import { 
  UserPlus, 
  Chrome, 
  Loader2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  X 
} from 'lucide-react';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError('');
    try {
      googleProvider.setCustomParameters({ prompt: 'select_account' });
      await setPersistence(auth, browserLocalPersistence);
      await signInWithPopup(auth, googleProvider);
      await refreshProfile();
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Google registration error:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage || 'Failed to sign up with Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      await setPersistence(auth, browserLocalPersistence);
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: username });
      
      try {
        await api.post('/api/auth/sync', { name: username });
      } catch (err: unknown) {
        console.warn('Sync on signup notice:', err);
      }

      await refreshProfile();
      navigate('/dashboard');
    } catch (err: unknown) {
      console.error('Registration error:', err);
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : '';
      
      if (errorCode === 'auth/email-already-in-use') {
        setError('This email is already associated with an account. Try signing in instead.');
      } else if (errorCode === 'auth/weak-password') {
        setError('Password is too weak. Please use at least 6 characters.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(errorMessage || 'Failed to create account. Please try again.');
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
        className="w-full max-w-[400px] space-y-6"
      >
        <div className="text-center space-y-2 mb-2">
          <Logo size={36} className="mx-auto mb-2" />
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Create account</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Join NextGen CMS to get started</p>
        </div>

        <div className="webapp-card p-6 sm:p-7 space-y-5">
          <button
            onClick={handleGoogleSignUp}
            disabled={loading}
            className="webapp-button-secondary w-full flex items-center justify-center gap-2.5 py-2.5"
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

          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                className="p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium flex items-start justify-between gap-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button 
                  type="button" 
                  onClick={() => setError('')} 
                  className="text-red-500 hover:text-red-700 dark:hover:text-red-300 opacity-60 hover:opacity-100 transition-opacity"
                  title="Dismiss error"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Name</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="webapp-input w-full"
                placeholder="Your name"
                autoComplete="name"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="webapp-input w-full"
                placeholder="name@example.com"
                autoComplete="email"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Password</label>
              <div className="relative flex items-center">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="webapp-input w-full pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded"
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider ml-1">Confirm Password</label>
              <div className="relative flex items-center">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="webapp-input w-full pr-10"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors rounded"
                  title={showConfirmPassword ? "Hide password" : "Show password"}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="webapp-button-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <UserPlus size={18} />}
              Create Account
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-500 dark:text-zinc-400 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-900 dark:text-white font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}

