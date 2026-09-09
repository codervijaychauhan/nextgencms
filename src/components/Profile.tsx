import React, { useState, useEffect } from 'react';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { User, Camera, Save, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function Profile() {
  const { user, profile, refreshProfile } = useAuth();
  const [username, setUsername] = useState(profile?.username || user?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedMessage, setVerifiedMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setUsername(profile.username);
      setBio(profile.bio);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      // 1. Update Firebase Auth display name if username changed
      if (username !== user.displayName) {
        await updateProfile(user, { displayName: username });
      }

      // 2. Update via SQL REST API
      await apiFetch(`/api/users/${user.uid}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: username,
          bio
        })
      });

      await refreshProfile();
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: unknown) {
      console.error('Update profile error:', err);
      setSaveStatus('error');
      const msg = err instanceof Error ? err.message : 'Failed to update profile.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResendVerification = async () => {
    if (!user) return;
    try {
      await sendEmailVerification(user);
      setVerifiedMessage('Verification email sent!');
      setErrorMessage('');
      setTimeout(() => setVerifiedMessage(''), 5000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send verification email.';
      setErrorMessage(msg);
      setVerifiedMessage('');
      setTimeout(() => setErrorMessage(''), 5000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Public Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your personal information and how others see you.</p>
      </div>

      <div className="max-w-4xl space-y-8">
        {/* Identity Section */}
        <section className="webapp-card">
          <div className="p-8 space-y-10">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-8 pb-10 border-b border-zinc-100 dark:border-zinc-800/50">
                <div className="relative group">
                  <div className="w-24 h-24 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-zinc-200 dark:border-zinc-700 shadow-inner">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <User size={32} className="text-zinc-400 dark:text-zinc-600" />
                    )}
                  </div>
                  <button className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-lg transition-all active:scale-90">
                    <Camera size={14} />
                  </button>
                </div>
                <div className="space-y-4 flex-1">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">{username || 'User'}</h3>
                    <p className="text-sm text-zinc-500">{user?.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950`}>
                      {profile?.role?.replace('_', ' ') || 'Guest'}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${
                      user?.emailVerified ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                    }`}>
                      {user?.emailVerified ? 'Email Verified' : 'Awaiting Verification'}
                    </span>
                    {!user?.emailVerified && (
                      <div className="flex flex-col gap-1 items-start mt-1">
                        <button onClick={handleResendVerification} className="text-[10px] font-bold text-blue-600 hover:underline uppercase tracking-wide text-left">
                          Resend Verification Email
                        </button>
                        {verifiedMessage && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                            <CheckCircle size={10} /> {verifiedMessage}
                          </span>
                        )}
                        {errorMessage && !saveStatus && (
                          <span className="text-[10px] font-semibold text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={10} /> {errorMessage}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <form onSubmit={handleSave} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="data-label ml-1">Full Name</label>
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="webapp-input w-full"
                      placeholder="Your Name"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="data-label ml-1">Email Address</label>
                    <input
                      type="email"
                      disabled
                      value={user?.email || ''}
                      className="webapp-input w-full bg-zinc-50 dark:bg-zinc-950/50 text-zinc-400 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="data-label ml-1">Bio</label>
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    rows={4}
                    className="webapp-input w-full resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div className="pt-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <AnimatePresence>
                      {saveStatus === 'success' && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                          <CheckCircle size={14} /> Profile updated successfully.
                        </motion.div>
                      )}
                      {saveStatus === 'error' && (
                        <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs font-bold text-red-500 flex items-center gap-1.5">
                          <AlertCircle size={14} /> {errorMessage}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="webapp-button-primary min-w-[140px] flex items-center justify-center gap-2"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </div>
    );
}
