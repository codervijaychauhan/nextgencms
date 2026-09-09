import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup,
  updateProfile,
  sendEmailVerification,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserPlus, Chrome, Loader2, AlertCircle } from 'lucide-react';

export default function SignUp() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
        className="w-full max-w-[380px] space-y-6"
      >
        <div className="text-center space-y-2 mb-2">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Create account</h1>
          <p className="text-sm text-zinc-500">Join our community to get started</p>
        </div>

        <div className="webapp-card p-6 space-y-6">
          <button
            onClick={handleGoogleSignUp}
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

          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Name</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="webapp-input w-full"
                placeholder="Your name"
              />
            </div>

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
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="webapp-input w-full"
                placeholder="••••••••"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider ml-1">Confirm Password</label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="webapp-input w-full"
                placeholder="••••••••"
              />
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

        <p className="text-center text-xs text-zinc-500 font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-zinc-900 dark:text-white font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
