import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Mail, CheckCircle, Loader2, AlertCircle } from 'lucide-react';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      try {
        // Build dynamic action code settings linking back to custom /reset-password route
        const actionCodeSettings = {
          url: `${window.location.protocol}//${window.location.host}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(auth, email, actionCodeSettings);
      } catch (innerErr: unknown) {
        console.warn('ActionCodeSettings failed, falling back to standard reset link:', innerErr);
        // Fall back to standard template reset link if custom redirect URL is not whitelisted in Firebase
        await sendPasswordResetEmail(auth, email);
      }
      setMessage('A reset link has been sent to your email. Please check your inbox and spam folder. Follow the link to set a new password.');
    } catch (err: unknown) {
      console.error('Password reset error:', err);
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : '';
      
      if (errorCode === 'auth/user-not-found') {
        setError('No account found with this email address.');
      } else if (errorCode === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(errorMessage || 'Failed to send reset link.');
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
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Reset password</h1>
          <p className="text-sm text-zinc-500">Enter your email and we'll send you a link</p>
        </div>

        <div className="webapp-card p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {message && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-600 dark:text-emerald-400 text-xs font-medium flex items-center gap-2">
              <CheckCircle size={14} />
              {message}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <button
              type="submit"
              disabled={loading}
              className="webapp-button-primary w-full flex items-center justify-center gap-2 py-2.5 mt-2"
            >
              {loading ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
              Send reset link
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-zinc-500 font-medium">
          Remembered your password?{' '}
          <Link to="/login" className="text-zinc-900 dark:text-white font-bold hover:underline">
            Sign in
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
