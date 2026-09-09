import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { motion } from 'motion/react';
import { Lock, CheckCircle, Loader2, AlertCircle, Save, ArrowLeft } from 'lucide-react';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [userEmail, setUserEmail] = useState('');

  const oobCode = searchParams.get('oobCode');

  useEffect(() => {
    if (!oobCode) {
      setError('Invalid or missing reset code. Please request a new link.');
      setLoading(false);
      return;
    }

    const verifyCode = async () => {
      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        setUserEmail(email);
        setLoading(false);
      } catch (err: unknown) {
        console.error('Code verification error:', err);
        setError('This reset link has expired or has already been used.');
        setLoading(false);
      }
    };

    verifyCode();
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oobCode) return;
    
    if (newPassword !== confirmPassword) {
      return setError('Passwords do not match.');
    }
    
    if (newPassword.length < 6) {
      return setError('Password must be at least 6 characters.');
    }

    setSubmitting(true);
    setError('');

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setMessage('Your password has been successfully reset. You can now use your email and new password to log in.');
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: unknown) {
      console.error('Password confirm error:', err);
      const errorCode = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : '';
      const errorMessage = err && typeof err === 'object' && 'message' in err ? (err as { message?: string }).message : '';
      
      if (errorCode === 'auth/expired-action-code') {
        setError('This reset link has expired. Please request a new one.');
      } else if (errorCode === 'auth/invalid-action-code') {
        setError('This reset link is invalid. It may have already been used.');
      } else if (errorCode === 'auth/weak-password') {
        setError('The password is too weak. Please use at least 6 characters.');
      } else if (errorCode === 'auth/operation-not-allowed') {
        setError('Email/Password credentials are not enabled in this Firebase Project. Please go to your Firebase Console -> Authentication -> Sign-in method and enable the "Email/Password" provider.');
      } else {
        setError(errorMessage || 'Failed to reset password.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-blue-500" size={32} />
          <p className="text-sm text-zinc-500 font-medium">Verifying reset code...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-[400px] space-y-6"
      >
        <div className="text-center space-y-2 mb-2">
          <div className="w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center text-blue-500 mx-auto mb-4">
            <Lock size={24} />
          </div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Set new password</h1>
          <p className="text-sm text-zinc-500">Creating a new password for <span className="font-bold text-zinc-700 dark:text-zinc-300">{userEmail}</span></p>
        </div>

        <div className="webapp-card p-8 space-y-6">
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          {message && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
              <CheckCircle size={16} />
              {message}
            </div>
          )}

          {!message && !error && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="data-label ml-1">New Password</label>
                <input
                  type="password"
                  required
                  autoFocus
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="webapp-input w-full"
                  placeholder="At least 6 characters"
                />
              </div>

              <div className="space-y-1.5">
                <label className="data-label ml-1">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="webapp-input w-full"
                  placeholder="Repeat your password"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="webapp-button-primary w-full flex items-center justify-center gap-2 py-3 mt-4"
              >
                {submitting ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Reset Password
              </button>
            </form>
          )}

          {(message || error) && (
            <Link 
              to="/login" 
              className="webapp-button-secondary w-full flex items-center justify-center gap-2 py-3 mt-2"
            >
              <ArrowLeft size={18} />
              Back to Sign In
            </Link>
          )}
        </div>
      </motion.div>
    </div>
  );
}
