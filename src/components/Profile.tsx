import React, { useState, useEffect } from 'react';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Camera, Save, Loader2, CheckCircle, AlertCircle, 
  ShieldCheck, Mail, ShieldAlert
} from 'lucide-react';

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', color: 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950' },
  { id: 'admin', label: 'Admin', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { id: 'manager', label: 'Manager', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { id: 'volunteer', label: 'Karyakarta', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'guest', label: 'Guest', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700' },
] as const;

export default function Profile() {
  const { user, profile, refreshProfile, isSuperAdmin } = useAuth();
  
  const [username, setUsername] = useState(profile?.username || (profile as any)?.name || user?.displayName || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [verifiedMessage, setVerifiedMessage] = useState('');

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || (profile as any).name || user?.displayName || '');
      setBio(profile.bio || '');
    }
  }, [profile, user]);

  const currentRole = ROLES.find(r => r.id === profile?.role) || ROLES[3];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      // 1. Update Firebase Auth display name if username changed
      if (username && username !== user.displayName) {
        await updateProfile(user, { displayName: username });
      }

      // 2. Update via SQL REST API
      await apiFetch(`/api/users/${user.uid || profile?.uid || profile?.id}`, {
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
      <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Public Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your personal profile details and account settings.</p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Profile Card */}
        <section className="webapp-card">
          <div className="p-6 md:p-8 space-y-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6 pb-6 border-b border-zinc-100 dark:border-zinc-800/80">
              <div className="relative group shrink-0">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-800 shadow-md text-white text-2xl md:text-3xl font-bold">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    (username || profile?.username || user?.email || 'U')[0]?.toUpperCase()
                  )}
                </div>
                <button className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-lg transition-all active:scale-90" title="Change Avatar">
                  <Camera size={13} />
                </button>
              </div>

              <div className="space-y-3 flex-1 min-w-0">
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2 justify-center sm:justify-start">
                    {username || profile?.username || 'User Profile'}
                    {isSuperAdmin && <ShieldCheck size={18} className="text-amber-500 shrink-0" />}
                  </h2>
                  <p className="text-sm text-zinc-500 truncate flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                    <Mail size={13} className="text-zinc-400 shrink-0" />
                    {user?.email || profile?.email}
                  </p>
                </div>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${currentRole.color}`}>
                    {currentRole.label}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    profile?.disabled ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                  }`}>
                    {profile?.disabled ? 'Suspended' : 'Active Account'}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                    user?.emailVerified ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}>
                    {user?.emailVerified ? 'Email Verified' : 'Awaiting Email Verification'}
                  </span>
                </div>

                {!user?.emailVerified && (
                  <div className="flex flex-col gap-1 items-center sm:items-start pt-1">
                    <button onClick={handleResendVerification} className="text-[11px] font-bold text-blue-600 hover:underline uppercase tracking-wide">
                      Resend Verification Link
                    </button>
                    {verifiedMessage && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                        <CheckCircle size={12} /> {verifiedMessage}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Identity Form */}
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 ml-1">Full Name</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="webapp-input w-full"
                    placeholder="Your Full Name"
                  />
                </div>
                <div className="space-y-2">
                  <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 ml-1">Email Address</label>
                  <input
                    type="email"
                    disabled
                    value={user?.email || profile?.email || ''}
                    className="webapp-input w-full bg-zinc-50 dark:bg-zinc-950/50 text-zinc-400 cursor-not-allowed"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 ml-1">Bio / Notes</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="webapp-input w-full resize-none p-3.5"
                  placeholder="Tell us about yourself or your operational duties..."
                />
              </div>

              <div className="pt-4 flex items-center justify-between gap-4 border-t border-zinc-100 dark:border-zinc-800/80">
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
