import React, { useState, useEffect } from 'react';
import { updateProfile, sendEmailVerification } from 'firebase/auth';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Camera, Save, Loader2, CheckCircle, AlertCircle, 
  ShieldCheck, Mail, Shield, Users, UserCheck, 
  Network, Crown, MapPin, Building2, Vote, IdCard,
  Briefcase, CheckCircle2, ChevronRight, Hash, Phone, ExternalLink,
  ClipboardList, BarChart3
} from 'lucide-react';

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' },
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

  // Demographics lookup cache
  const [demographics, setDemographics] = useState<{
    states: Record<string, string>;
    districts: Record<string, string>;
    constituencies: Record<string, string>;
  }>({
    states: {},
    districts: {},
    constituencies: {}
  });

  useEffect(() => {
    if (profile) {
      setUsername(profile.username || (profile as any).name || user?.displayName || '');
      setBio(profile.bio || '');
    }
  }, [profile, user]);

  useEffect(() => {
    // Load demographic names for human-readable territory display
    const loadDemographicNames = async () => {
      try {
        const [statesRes, districtsRes, constRes] = await Promise.all([
          apiFetch<any[]>('/api/states').catch(() => []),
          apiFetch<any[]>('/api/districts').catch(() => []),
          apiFetch<any[]>('/api/constituencies').catch(() => [])
        ]);

        const stateMap: Record<string, string> = {};
        if (Array.isArray(statesRes)) {
          statesRes.forEach(s => { if (s?.id) stateMap[s.id] = s.name || s.id; });
        }

        const distMap: Record<string, string> = {};
        if (Array.isArray(districtsRes)) {
          districtsRes.forEach(d => { if (d?.id) distMap[d.id] = d.name || d.id; });
        }

        const constMap: Record<string, string> = {};
        if (Array.isArray(constRes)) {
          constRes.forEach(c => { if (c?.id) constMap[c.id] = c.name || c.id; });
        }

        setDemographics({
          states: stateMap,
          districts: distMap,
          constituencies: constMap
        });
      } catch (err) {
        console.warn('Failed to load demographic metadata:', err);
      }
    };

    loadDemographicNames();
  }, []);

  const currentRole = ROLES.find(r => r.id === profile?.role) || ROLES[3];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setIsSaving(true);
    setSaveStatus('idle');
    setErrorMessage('');

    try {
      if (username && username !== user.displayName) {
        await updateProfile(user, { displayName: username });
      }

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

  // Hierarchy Data Extraction
  const userRole = profile?.role || 'volunteer';
  const isUserSuperAdmin = isSuperAdmin || userRole === 'super_admin';
  const isUserAdmin = userRole === 'admin';
  const isUserManager = userRole === 'manager';

  const assignedAdminName = profile?.parentAdminName || profile?.parent_admin_name;
  const assignedAdminEmail = profile?.parentAdminEmail || profile?.parent_admin_email;
  const assignedAdminId = profile?.parentAdminId || profile?.parent_admin_id;

  const assignedManagerName = profile?.parentManagerName || profile?.parent_manager_name;
  const assignedManagerEmail = profile?.parentManagerEmail || profile?.parent_manager_email;
  const assignedManagerId = profile?.parentManagerId || profile?.parent_manager_id;

  const linkedVoterId = profile?.voterId || profile?.voter_id;

  // Assigned Scope
  const assignedState = profile?.stateId || profile?.state_id || '';
  const assignedDistrict = profile?.districtId || profile?.district_id || '';
  const assignedConstituency = profile?.constituencyId || profile?.constituency_id || '';
  const assignedBooths = Array.isArray(profile?.assigned_booths) ? profile.assigned_booths : (profile?.boothId ? String(profile.boothId).split(',').filter(Boolean) : []);

  const stateDisplayName = demographics.states[assignedState] || assignedState;
  const districtDisplayName = demographics.districts[assignedDistrict] || assignedDistrict;
  const constDisplayName = demographics.constituencies[assignedConstituency] || assignedConstituency;

  return (
    <div className="space-y-6 w-full pb-12">
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Profile
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {profile?.role ? profile.role.replace('_', ' ') : 'Account'}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Account details, hierarchy, and assigned territory.
          </p>
        </div>
      </div>

      {/* 1. Profile Overview Header Card */}
      <section className="webapp-card overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600/10 via-indigo-600/10 to-purple-600/10 dark:from-blue-950/40 dark:via-indigo-950/40 dark:to-purple-950/40 p-6 md:p-8 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-6">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center overflow-hidden border-2 border-white dark:border-zinc-800 shadow-xl text-white text-2xl md:text-3xl font-bold">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                ) : (
                  (username || profile?.username || user?.email || 'U')[0]?.toUpperCase()
                )}
              </div>
              <button 
                className="absolute -bottom-2 -right-2 p-2 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white shadow-lg transition-all active:scale-90" 
                title="Change Avatar"
              >
                <Camera size={13} />
              </button>
            </div>

            <div className="space-y-3 flex-1 min-w-0">
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2 justify-center sm:justify-start">
                  {username || profile?.username || 'User Profile'}
                  {isUserSuperAdmin && <Crown size={20} className="text-amber-500 shrink-0" />}
                  {isUserAdmin && !isUserSuperAdmin && <ShieldCheck size={18} className="text-blue-500 shrink-0" />}
                </h2>
                <p className="text-sm text-zinc-500 truncate flex items-center justify-center sm:justify-start gap-1.5 mt-0.5 font-medium">
                  <Mail size={14} className="text-zinc-400 shrink-0" />
                  {user?.email || profile?.email}
                </p>
              </div>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <span className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider border flex items-center gap-1.5 ${currentRole.color}`}>
                  {isUserSuperAdmin ? <Crown size={13} /> : <Briefcase size={13} />}
                  {currentRole.label}
                </span>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                  profile?.disabled ? 'bg-red-500/10 text-red-600 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${profile?.disabled ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                  {profile?.disabled ? 'Suspended' : 'Active Account'}
                </span>
                <span className={`px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider border flex items-center gap-1.5 ${
                  user?.emailVerified ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                }`}>
                  <CheckCircle2 size={13} />
                  {user?.emailVerified ? 'Email Verified' : 'Awaiting Email Verification'}
                </span>
              </div>

              {!user?.emailVerified && (
                <div className="flex flex-col gap-1 items-center sm:items-start pt-1">
                  <button onClick={handleResendVerification} className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline uppercase tracking-wide">
                    Resend Verification Email
                  </button>
                  {verifiedMessage && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                      <CheckCircle size={13} /> {verifiedMessage}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 2. REPORTING HIERARCHY & LEADERSHIP (Key Requirement) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <Network size={18} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Reporting Line & Hierarchy</h2>
              <p className="text-xs text-zinc-500">Your organizational reporting chain, assigned Administrator, and Team Manager</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card A: Assigned Administrator */}
          <div className="webapp-card p-5 space-y-4 border-l-4 border-l-blue-500 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                  <Shield size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
                    Supervisory Level
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Assigned Administrator (Admin)
                  </h3>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                Admin Supervisor
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-800 space-y-2">
              {isUserSuperAdmin ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Crown size={15} /> Apex Authority (Super Administrator)
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    You hold root campaign and multi-tenant authority. You report directly to central leadership.
                  </p>
                </div>
              ) : isUserAdmin ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                    <ShieldCheck size={15} /> Organization Administrator
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    You are an Organization Administrator reporting directly to the Super Admin.
                  </p>
                </div>
              ) : (assignedAdminName || assignedAdminEmail || assignedAdminId) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">
                        {assignedAdminName || (assignedAdminEmail ? assignedAdminEmail.split('@')[0] : 'Campaign Administrator')}
                      </p>
                      {assignedAdminEmail && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} className="text-zinc-400" />
                          {assignedAdminEmail}
                        </p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Active Lead
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Central Campaign Administration
                  </p>
                  <p className="text-xs text-zinc-500">
                    Assigned under general organizational headquarters.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card B: Assigned Team Manager */}
          <div className="webapp-card p-5 space-y-4 border-l-4 border-l-purple-500 relative overflow-hidden">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/20">
                  <Users size={20} />
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider">
                    Direct Management
                  </span>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                    Assigned Team Manager (Manager)
                  </h3>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                Team Leader
              </span>
            </div>

            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-100 dark:border-zinc-800 space-y-2">
              {isUserSuperAdmin || isUserAdmin ? (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Not Applicable (Admin Tier)
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    As an Administrator, you manage team managers and karyakartas directly.
                  </p>
                </div>
              ) : isUserManager ? (
                <div className="space-y-1">
                  <p className="text-sm font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                    <UserCheck size={15} /> Field Team Manager (Self)
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    You lead booth volunteers and karyakartas reporting to your designated Administrator.
                  </p>
                </div>
              ) : (assignedManagerName || assignedManagerEmail || assignedManagerId) ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">
                        {assignedManagerName || (assignedManagerEmail ? assignedManagerEmail.split('@')[0] : 'Assigned Team Manager')}
                      </p>
                      {assignedManagerEmail && (
                        <p className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                          <Mail size={12} className="text-zinc-400" />
                          {assignedManagerEmail}
                        </p>
                      )}
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                      Team Lead
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                    Direct Admin Supervision
                  </p>
                  <p className="text-xs text-zinc-500">
                    No intermediary manager assigned. You report directly to your assigned Administrator.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 3. ASSIGNED TERRITORY & VOTER PROFILE */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Territory & Scope */}
        <section className="webapp-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <MapPin size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Assigned Operational Scope</h3>
              <p className="text-[11px] text-zinc-500">Demographic territory and booth authorization</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">State</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {stateDisplayName || 'All States'}
                </span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">District</span>
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  {districtDisplayName || 'All Districts'}
                </span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1">Constituency</span>
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {constDisplayName || (isUserSuperAdmin ? 'Global / Unrestricted' : 'All Constituencies')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Assigned Booths</span>
                <span className="text-[10px] font-black text-blue-600 dark:text-blue-400">
                  {assignedBooths.length > 0 ? `${assignedBooths.length} Booths` : (isUserSuperAdmin || isUserAdmin ? 'All Booths' : 'Unrestricted')}
                </span>
              </div>
              {assignedBooths.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {assignedBooths.map((b, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                      Booth #{b}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-zinc-500">
                  {isUserSuperAdmin || isUserAdmin ? 'Full administrative access across all polling stations.' : 'No specific booth restrictions applied.'}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Voter / EPIC Link */}
        <section className="webapp-card p-6 space-y-4">
          <div className="flex items-center gap-2.5 pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <IdCard size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Voter ID & Karyakarta Profile</h3>
              <p className="text-[11px] text-zinc-500">Official electoral identity binding</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">EPIC / Voter ID Number</span>
                {linkedVoterId ? (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Linked
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-zinc-200 dark:bg-zinc-800 text-zinc-500">
                    Unlinked
                  </span>
                )}
              </div>

              {linkedVoterId ? (
                <div className="space-y-1">
                  <p className="text-base font-mono font-black text-zinc-900 dark:text-white tracking-wider">
                    {linkedVoterId}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Your account is registered as a verified campaign karyakarta voter in the electoral database.
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    No Voter ID (EPIC) is linked to this account yet.
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    Contact your Administrator or Manager in User Management to bind your Voter ID number.
                  </p>
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-1 text-xs text-zinc-600 dark:text-zinc-400">
              <p className="font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Vote size={14} /> Karyakarta Field Operational Access
              </p>
              <p className="text-[11px] leading-relaxed">
                Your assigned role, manager, and administrator govern the survey forms, voter verification modules, and booth operations available to you.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* 4. Edit Personal Profile Form */}
      <section className="webapp-card">
        <div className="p-6 md:p-8 space-y-6">
          <div className="pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Account Details</h3>
            <p className="text-xs text-zinc-500">Update your public display name and operational responsibilities note.</p>
          </div>

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
              <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 ml-1">Bio / Operational Notes</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="webapp-input w-full resize-none p-3.5"
                placeholder="Tell us about your field assignments or operational notes..."
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
  );
}
