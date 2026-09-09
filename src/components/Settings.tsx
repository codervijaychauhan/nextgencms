import React, { useState } from 'react';
import { useTheme } from '../ThemeProvider';
import { auth } from '../lib/firebase';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Monitor, Shield, CheckCircle, AlertCircle, Loader2, Save, Key, Eye, EyeOff } from 'lucide-react';

export default function Settings() {
  const { theme, toggleTheme } = useTheme();
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [activeTab, setActiveTab] = useState<'application' | 'notifications' | 'security'>('application');

  // Password Change State
  const [passwordForm, setPasswordForm] = useState({ current: '', new: '', confirm: '' });
  const [showPasswords, setShowPasswords] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showCurrentPasswordInput, setShowCurrentPasswordInput] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }, 1000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    
    if (passwordForm.new !== passwordForm.confirm) {
      setPasswordError("New passwords don't match.");
      return;
    }

    if (passwordForm.new.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }

    setPasswordLoading(true);
    setPasswordError('');
    setPasswordSuccess('');

    try {
      if (showCurrentPasswordInput) {
        if (!passwordForm.current) {
          setPasswordError("Current password is required to verify your identity.");
          setPasswordLoading(false);
          return;
        }
        if (auth.currentUser.email) {
          const credential = EmailAuthProvider.credential(auth.currentUser.email, passwordForm.current);
          await reauthenticateWithCredential(auth.currentUser, credential);
        }
      }

      await updatePassword(auth.currentUser, passwordForm.new);
      setPasswordSuccess("Password updated successfully!");
      setPasswordForm({ current: '', new: '', confirm: '' });
      setShowCurrentPasswordInput(false);
    } catch (err: unknown) {
      console.error('Password update error:', err);
      const errObject = err && typeof err === 'object' ? (err as { code?: string; message?: string }) : null;
      const errorCode = errObject?.code || '';
      const errorMessage = errObject?.message || 'Failed to update password.';

      if (errorCode === 'auth/requires-recent-login') {
        setShowCurrentPasswordInput(true);
        setPasswordError("For security, updating your password requires verifying your credentials. Please enter your CURRENT password below, then click 'Update Password' again.");
      } else if (errorCode === 'auth/wrong-password') {
        setPasswordError("The current password you entered is incorrect.");
      } else if (errorCode === 'auth/weak-password') {
        setPasswordError("The password is too weak. Please use at least 6 characters.");
      } else {
        setPasswordError(errorMessage);
      }
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Account Settings</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your account preferences and application settings.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Navigation Rail */}
        <aside className="lg:col-span-3 space-y-1">
          <button 
            onClick={() => setActiveTab('application')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'application' 
                ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-sm' 
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <Monitor size={16} />
            Application
          </button>
          <button 
            onClick={() => setActiveTab('notifications')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'notifications' 
                ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-sm' 
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <Bell size={16} />
            Notifications
          </button>
          <button 
            onClick={() => setActiveTab('security')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'security' 
                ? 'bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-800 shadow-sm' 
                : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-900/50'
            }`}
          >
            <Shield size={16} />
            Security & Danger
          </button>
        </aside>

        {/* Main Settings Area */}
        <div className="lg:col-span-9 space-y-8">
          {activeTab === 'application' && (
            <section className="webapp-card animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Appearance & Localization</h2>
              </div>
              <div className="p-8 space-y-8">
                <div className="space-y-4">
                  <label className="data-label">Interface Theme</label>
                  <div className="flex gap-4">
                    <button 
                      onClick={() => theme !== 'light' && toggleTheme()}
                      className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                        theme === 'light' 
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/5 ring-1 ring-blue-500' 
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <SunIcon className={`mb-2 ${theme === 'light' ? 'text-blue-600' : 'text-zinc-400'}`} />
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Light Mode</p>
                      <p className="text-xs text-zinc-500">Classic high-visibility mode</p>
                    </button>
                    <button 
                      onClick={() => theme !== 'dark' && toggleTheme()}
                      className={`flex-1 p-4 rounded-xl border transition-all text-left ${
                        theme === 'dark' 
                          ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-500/5 ring-1 ring-blue-500' 
                          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <MoonIcon className={`mb-2 ${theme === 'dark' ? 'text-blue-600' : 'text-zinc-400'}`} />
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Dark Mode</p>
                      <p className="text-xs text-zinc-500">Better for low light environments</p>
                    </button>
                  </div>
                </div>

                <div className="space-y-4 pt-6 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="data-label">Preferred Language</label>
                      <select className="webapp-input w-full appearance-none">
                        <option>English (US)</option>
                        <option>Spanish (LatAm)</option>
                        <option>French (FR)</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="data-label">Timezone</label>
                      <select className="webapp-input w-full appearance-none">
                        <option>UTC (Coordinated Universal Time)</option>
                        <option>EST (Eastern Standard Time)</option>
                        <option>PST (Pacific Standard Time)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}

          {activeTab === 'notifications' && (
            <section className="webapp-card animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Communication Preferences</h2>
              </div>
              <div className="p-8 space-y-6">
                {[
                  { title: 'Email Reports', desc: 'Summary of weekly activity and logs.' },
                  { title: 'Security Alerts', desc: 'Immediate notification on login attempts.' },
                  { title: 'System Updates', desc: 'Updates about new features and maintenance.' }
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between py-2">
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">{item.title}</p>
                      <p className="text-xs text-zinc-500">{item.desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" defaultChecked={i === 1} />
                      <div className="w-9 h-5 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </section>
          )}

          {activeTab === 'security' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <section className="webapp-card overflow-hidden">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key size={18} className="text-zinc-400" />
                    <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Password Management</h2>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setShowPasswords(!showPasswords)}
                    className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-all"
                  >
                    {showPasswords ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                
                <form onSubmit={handlePasswordChange} className="p-8 space-y-6">
                  {passwordError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2">
                      <AlertCircle size={16} />
                      {passwordError}
                    </div>
                  )}
                  {passwordSuccess && (
                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                      <CheckCircle size={16} />
                      {passwordSuccess}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {showCurrentPasswordInput && (
                      <div className="md:col-span-2 space-y-2 animate-in fade-in slide-in-from-top-2 duration-200">
                        <label className="data-label text-amber-600 dark:text-amber-400 font-extrabold flex items-center gap-1.5">
                          <AlertCircle size={14} /> Current Password
                        </label>
                        <input 
                          type={showPasswords ? "text" : "password"} 
                          required
                          value={passwordForm.current}
                          onChange={(e) => setPasswordForm({...passwordForm, current: e.target.value})}
                          className="webapp-input w-full border-amber-500/50 focus:border-amber-500 ring-amber-500/10 placeholder-zinc-400"
                          placeholder="Verify who you are by typing your current password"
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="data-label">New Password</label>
                      <input 
                        type={showPasswords ? "text" : "password"} 
                        required
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm({...passwordForm, new: e.target.value})}
                        className="webapp-input w-full"
                        placeholder="At least 6 characters"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="data-label">Confirm New Password</label>
                      <input 
                        type={showPasswords ? "text" : "password"} 
                        required
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({...passwordForm, confirm: e.target.value})}
                        className="webapp-input w-full"
                        placeholder="Repeat new password"
                      />
                    </div>
                    <div className="md:col-span-2 flex items-center gap-2 mt-1">
                      <input 
                        type="checkbox" 
                        id="show-passwords-checkbox" 
                        checked={showPasswords}
                        onChange={() => setShowPasswords(!showPasswords)}
                        className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-4 h-4"
                      />
                      <label htmlFor="show-passwords-checkbox" className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 cursor-pointer select-none">
                        Show passwords
                      </label>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <button 
                      type="submit" 
                      disabled={passwordLoading}
                      className="webapp-button-primary min-w-[160px] flex items-center justify-center gap-2"
                    >
                      {passwordLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                      Update Password
                    </button>
                  </div>
                </form>
              </section>

              <section className="webapp-card">
                <div className="p-6 border-b border-zinc-200 dark:border-zinc-800">
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Security & Access</h2>
                </div>
                <div className="p-8 space-y-4 text-center">
                  <Shield size={48} className="mx-auto text-zinc-200 dark:text-zinc-800 mb-2" />
                  <p className="text-sm font-bold text-zinc-900 dark:text-white">Two-Factor Authentication</p>
                  <p className="text-xs text-zinc-500 max-w-sm mx-auto">Enhance your account security by enabling two-factor authentication or updating your recovery methods.</p>
                  <button className="webapp-button-secondary mt-2">Manage Security Settings</button>
                </div>
              </section>

              <section className="webapp-card border-red-200 dark:border-red-900/30 shadow-red-500/5">
                <div className="p-6 bg-red-50 dark:bg-red-500/5 border-b border-red-100 dark:border-red-900/20">
                  <h2 className="text-sm font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Danger Zone</h2>
                </div>
                <div className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Delete Account</h3>
                    <p className="text-xs text-zinc-500 mt-1 max-w-md">Permanently delete your account and all associated data. This action is irreversible.</p>
                  </div>
                  <button className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-all shadow-sm active:scale-95">
                    Delete Account
                  </button>
                </div>
              </section>
            </div>
          )}

          <div className="pt-4 flex items-center justify-between gap-4">
            <div className="flex-1">
              <AnimatePresence>
                {saveStatus === 'success' && (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="text-xs font-bold text-emerald-600 flex items-center gap-1.5">
                    <CheckCircle size={14} /> Settings updated.
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="webapp-button-primary min-w-[140px] flex items-center justify-center gap-2"
            >
              {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SunIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon({ className }: { className: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}
