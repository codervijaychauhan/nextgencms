import React, { useState, useEffect } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth as firebaseAuth } from '../lib/firebase';
import { useAuth } from '../AuthProvider';
import { api } from '../lib/api';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, Shield, ShieldCheck, Mail, Calendar, Search, Loader2, 
  AlertCircle, CheckCircle, Edit2, Trash2, 
  UserX, UserCheck, Key, Plus, X, Save,
  Copy, Share2, MessageCircle, ExternalLink, Send
} from 'lucide-react';

interface UserData {
  uid: string;
  username: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'volunteer' | 'guest';
  createdAt?: any;
  bio?: string;
  disabled?: boolean;
  permissions?: {
    [key: string]: string; // e.g., { voters: 'vcud', demographics: 'v' }
  };
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  boothId?: string;
}

interface IndiaState {
  id: string;
  name: string;
}

interface IndiaDistrict {
  id: string;
  name: string;
  stateId: string;
}

interface IndiaConstituency {
  id: string;
  name: string;
  districtId: string;
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber: string;
  constituencyId: string;
}

const MODULES = [
  { id: 'voters', label: 'Voters Registry', description: 'Access to voter records and registration' },
  { id: 'demographics', label: 'Demographics', description: 'State, District, and Booth settings' },
  { id: 'elections', label: 'Election Setup', description: 'Manage election years and political parties' },
  { id: 'surveys', label: 'Voter Surveys', description: 'Record and analyze voter sentiments' },
  { id: 'survey_campaigns', label: 'Survey Campaigns', description: 'Manage survey campaigns and assignments' },
  { id: 'users', label: 'User Management', description: 'Administer system users and roles' },
  { id: 'benefits', label: 'Benefits Distribution', description: 'Track government and party aid benefits distributed to voters' },
  { id: 'volunteers', label: 'Karyakartas Roster', description: 'Manage volunteers, tasks, and tracking' },
  { id: 'booths', label: 'Booth Management', description: 'Map volunteers to booth levels and manage Karyakartas' },
  { id: 'predictions', label: 'Analytics', description: 'Interactive projection models and polling data analysis' },
  { id: 'finance', label: 'Budget & Finance Tracker', description: 'Track campaign expenses, donations, and budget allocation per admin context' },
  { id: 'whatsapp', label: 'WB Sender (WhatsApp)', description: 'Create, manage, and dispatch dynamic WhatsApp template broadcasts' },
  { id: 'mandals', label: 'Mandal Management', description: 'Manage administrative sub-districts (Mandals) and assign presidents' }
];

const PERMISSION_TYPES = [
  { id: 'v', label: 'View', color: 'text-blue-500' },
  { id: 'c', label: 'Create', color: 'text-emerald-500' },
  { id: 'u', label: 'Update', color: 'text-amber-500' },
  { id: 'd', label: 'Delete', color: 'text-red-500' },
];

const ROLES = [
  { id: 'super_admin', label: 'Super Admin', color: 'bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950' },
  { id: 'admin', label: 'Admin', color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' },
  { id: 'manager', label: 'Manager', color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' },
  { id: 'volunteer', label: 'Karyakarta', color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' },
  { id: 'guest', label: 'Guest', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200 dark:border-zinc-700' },
] as const;

const OWNER_EMAIL = 'vijaychauhanofficial01@gmail.com';

export default function UserManagement() {
  const { user, isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true; // super_admin has all rights
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };
  
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Modals state
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'demographics' | 'permissions'>('details');
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [manualResetUser, setManualResetUser] = useState<UserData | null>(null);
  const [manualPassword, setManualPassword] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [createdInviteInfo, setCreatedInviteInfo] = useState<{ email: string; name: string; role: string; inviteLink: string } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [newUser, setNewUser] = useState({ 
    username: '', 
    email: '', 
    role: 'volunteer' as UserData['role'],
    permissions: {} as Record<string, string>,
    stateId: '',
    districtId: '',
    constituencyId: '',
    boothId: ''
  });

  // Hierarchy Data
  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);

  // Multi-select state selectors and handlers for both editing user and new user
  const selectedEditUserStates = editingUser?.stateId ? editingUser.stateId.split(',').filter(Boolean) : [];
  const selectedEditUserDistricts = editingUser?.districtId ? editingUser.districtId.split(',').filter(Boolean) : [];
  const selectedEditUserConstituencies = editingUser?.constituencyId ? editingUser.constituencyId.split(',').filter(Boolean) : [];
  const selectedEditUserBooths = editingUser?.boothId ? editingUser.boothId.split(',').filter(Boolean) : [];

  const handleEditUserStatesChange = async (stateIds: string[]) => {
    if (!editingUser) return;
    const stateIdStr = stateIds.join(',');
    setEditingUser({
      ...editingUser,
      stateId: stateIdStr,
      districtId: '',
      constituencyId: '',
      boothId: ''
    });
    setDistricts([]);
    setConstituencies([]);
    setBooths([]);
    if (stateIds.length > 0) {
      await fetchDistricts(stateIdStr);
    }
  };

  const handleEditUserDistrictsChange = async (districtIds: string[]) => {
    if (!editingUser) return;
    const districtIdStr = districtIds.join(',');
    setEditingUser({
      ...editingUser,
      districtId: districtIdStr,
      constituencyId: '',
      boothId: ''
    });
    setConstituencies([]);
    setBooths([]);
    if (districtIds.length > 0 && editingUser.stateId) {
      await fetchConstituencies(editingUser.stateId, districtIdStr);
    }
  };

  const handleEditUserConstituenciesChange = async (constituencyIds: string[]) => {
    if (!editingUser) return;
    const constituencyIdStr = constituencyIds.join(',');
    setEditingUser({
      ...editingUser,
      constituencyId: constituencyIdStr,
      boothId: ''
    });
    setBooths([]);
    if (constituencyIds.length > 0 && editingUser.stateId && editingUser.districtId) {
      await fetchBooths(editingUser.stateId, editingUser.districtId, constituencyIdStr);
    }
  };

  const handleEditUserBoothsChange = (boothIds: string[]) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      boothId: boothIds.join(',')
    });
  };



  const handleResetPassword = async (email: string) => {
    setActionLoading(email);
    try {
      try {
        // Build dynamic action code settings linking back to custom /reset-password route
        const actionCodeSettings = {
          url: `${window.location.protocol}//${window.location.host}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(firebaseAuth, email, actionCodeSettings);
      } catch (innerErr: unknown) {
        console.warn('ActionCodeSettings failed, falling back to standard reset link:', innerErr);
        // Fall back to standard template reset link if custom redirect URL is not whitelisted in Firebase
        await sendPasswordResetEmail(firebaseAuth, email);
      }
      setSuccessMessage(`A secure password reset link has been sent to ${email}.`);
      setManualResetUser(null);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to send reset email.';
      console.error('Password reset error:', err);
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const handleManualPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualResetUser || !manualPassword) return;

    if (manualPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setActionLoading('manual_reset');
    try {
      const idToken = await firebaseAuth.currentUser?.getIdToken();
      const response = await fetch('/api/admin/reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          uid: manualResetUser.uid,
          newPassword: manualPassword
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to reset password');

      setSuccessMessage(`Password for "${manualResetUser.email}" has been manually updated.`);
      setManualResetUser(null);
      setManualPassword('');
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to manually reset password.';
      console.error('Manual reset error:', err);
      setError(errorMessage);
    } finally {
      setActionLoading(null);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const fetchedUsers = await api.get<UserData[]>('/api/users');
      setUsers(fetchedUsers);
    } catch (err: unknown) {
      console.error('Error fetching users:', err);
      setError('Insufficient permissions to view users.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch demographics
  const fetchStates = async () => {
    try {
      const snap = await api.get<IndiaState[]>('/api/states');
      setStates(snap);
    } catch (err) {
      console.error('Error fetching states:', err);
    }
  };

  const fetchDistricts = async (stateId: string) => {
    if (!stateId) {
      setDistricts([]);
      return;
    }
    try {
      const dists = await api.get<IndiaDistrict[]>('/api/districts');
      setDistricts(dists.map((d: any) => ({ ...d, stateId: d.state_id || d.stateId })));
      return dists;
    } catch (err) {
      console.error('Error fetching districts:', err);
    }
  };

  const fetchConstituencies = async (stateId: string, districtId: string) => {
    if (!stateId || !districtId) {
      setConstituencies([]);
      return;
    }
    try {
      const consts = await api.get<IndiaConstituency[]>('/api/constituencies');
      setConstituencies(consts.map((c: any) => ({ ...c, stateId: c.state_id || c.stateId, districtId: c.district_id || c.districtId })));
      return consts;
    } catch (err) {
      console.error('Error fetching constituencies:', err);
    }
  };

  const fetchBooths = async (stateId: string, districtId: string, constituencyId: string) => {
    if (!stateId || !districtId || !constituencyId) {
      setBooths([]);
      return;
    }
    try {
      const bths = await api.get<IndiaBooth[]>('/api/booths');
      setBooths(bths.map((b: any) => ({ ...b, boothNumber: b.booth_number || b.boothNumber, constituencyId: b.constituency_id || b.constituencyId })));
      return bths;
    } catch (err) {
      console.error('Error fetching booths:', err);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchStates();
    }
  }, [isAdmin]);

  // Preload hierarchical metadata when edit modal opens
  useEffect(() => {
    const handlePreload = async () => {
      if (editingUser) {
        if (editingUser.stateId) {
          const loadedDists = await fetchDistricts(editingUser.stateId);
          if (editingUser.districtId) {
            const loadedConsts = await fetchConstituencies(editingUser.stateId, editingUser.districtId);
            if (editingUser.constituencyId) {
              await fetchBooths(editingUser.stateId, editingUser.districtId, editingUser.constituencyId);
            }
          }
        }
      }
    };
    handlePreload();
  }, [editingUser?.uid]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    
    setActionLoading('updating');
    try {
      await api.put(`/api/users/${editingUser.uid}`, {
        name: editingUser.username,
        role: editingUser.role,
        permissions: editingUser.permissions || {},
        disabled: Boolean(editingUser.disabled)
      });
      
      setUsers(users.map(u => u.uid === editingUser.uid ? editingUser : u));
      setSuccessMessage(`User "${editingUser.username}" updated successfully.`);
      setEditingUser(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      console.error('Update error:', err);
      setError('Failed to update user profile.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading('creating');
    setError('');
    try {
      const payload = {
        name: newUser.username,
        email: newUser.email,
        role: newUser.role,
        permissions: newUser.permissions,
        rights: newUser.permissions,
        state_id: newUser.stateId || null,
        district_id: newUser.districtId || null,
        constituency_id: newUser.constituencyId || null,
        booth_id: newUser.boothId || null,
        assigned_booths: newUser.boothId ? [newUser.boothId] : []
      };
      
      const res = await api.post<{ success: boolean; inviteLink: string; email: string; name: string; role: string }>('/api/users/invite', payload);
      
      setIsAddModalOpen(false);
      setCreatedInviteInfo({
        email: newUser.email,
        name: newUser.username,
        role: newUser.role,
        inviteLink: res.inviteLink || `${window.location.origin}/login?email=${encodeURIComponent(newUser.email)}`
      });

      // Refresh users from database
      const updatedUsers = await api.get<UserData[]>('/api/users');
      if (Array.isArray(updatedUsers)) {
        setUsers(updatedUsers);
      }

      setSuccessMessage(`Invitation link generated successfully for ${newUser.email}.`);
      setNewUser({ 
        username: '', 
        email: '', 
        role: 'volunteer', 
        permissions: {},
        stateId: '',
        districtId: '',
        constituencyId: '',
        boothId: ''
      });
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      console.error('Create error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to create user invitation.';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleUserStatus = async (targetUserId: string, currentStatus: boolean) => {
    if (targetUserId === user?.uid) {
      setError("You cannot disable your own account.");
      return;
    }
    setActionLoading(targetUserId);
    try {
      await api.put(`/api/users/${targetUserId}`, { disabled: !currentStatus });
      setUsers(users.map(u => u.uid === targetUserId ? { ...u, disabled: !currentStatus } : u));
      setSuccessMessage(`User status updated.`);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      console.error('Toggle status error:', err);
      setError('Failed to update user status.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!userToDelete) return;

    if (userToDelete.uid === user?.uid) {
      setError("You cannot delete your own account.");
      setUserToDelete(null);
      return;
    }
    
    if (userToDelete.email === OWNER_EMAIL) {
      setError("Security Violation: The root Super Admin cannot be deleted.");
      setUserToDelete(null);
      return;
    }

    setActionLoading(userToDelete.uid);
    try {
      await api.delete(`/api/users/${userToDelete.uid}`);
      setUsers(users.filter(u => u.uid !== userToDelete.uid));
      setSuccessMessage(`User "${userToDelete.email}" deleted successfully.`);
      setUserToDelete(null);
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      console.error('Delete error:', err);
      setError('Failed to delete user account.');
    } finally {
      setActionLoading(null);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 mb-4 ring-8 ring-red-500/5">
          <Shield size={32} />
        </div>
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Access Restricted</h1>
        <p className="text-sm text-zinc-500 mt-2 max-w-md">You do not have the required permissions to access User Management.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
            <Users className="text-zinc-400" />
            User Management
          </h1>
          <p className="text-sm text-zinc-500 mt-1">Manage user accounts, roles, and access controls from a centralized dashboard.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <div className="relative flex-1 sm:w-72">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
            <input 
              type="text" 
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="webapp-input w-full pl-10 h-10 text-sm"
            />
          </div>
          {hasRight('users', 'c') && (
            <button 
              onClick={() => setIsAddModalOpen(true)}
              className="webapp-button-primary h-10 px-5 flex items-center justify-center gap-2 whitespace-nowrap shadow-sm"
            >
              <Plus size={16} />
              Invite People
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <AnimatePresence>
        {(error || successMessage) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-2 mb-4">
                <AlertCircle size={16} />
                {error}
                <button onClick={() => setError('')} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
              </div>
            )}
            {successMessage && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2 mb-4">
                <CheckCircle size={16} />
                {successMessage}
                <button onClick={() => setSuccessMessage('')} className="ml-auto opacity-50 hover:opacity-100"><X size={14} /></button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Users Table */}
      <div className="webapp-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 data-label">User Profile</th>
                <th className="px-6 py-4 data-label">Email</th>
                <th className="px-6 py-4 data-label text-center">Status</th>
                <th className="px-6 py-4 data-label">Assigned Role</th>
                <th className="px-6 py-4 data-label">Join Date</th>
                <th className="px-6 py-4 data-label text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-zinc-300 dark:text-zinc-700" size={32} />
                    <p className="mt-4 text-sm text-zinc-500">Retrieving system users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-20 text-center text-zinc-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr 
                    key={u.uid} 
                    onClick={() => {
                      if (u.email === OWNER_EMAIL && user?.email !== OWNER_EMAIL) return;
                      setEditingUser(u); 
                      setActiveTab('details');
                    }}
                    className={`group hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors cursor-pointer ${u.disabled ? 'opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20' : ''}`}
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-900 dark:text-zinc-100 text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0">
                          {u.username?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 leading-none">
                            {u.username || 'Unspecified Name'}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {u.uid === user?.uid && <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded border border-blue-500/20 font-bold">CURRENT</span>}
                            {u.email === OWNER_EMAIL && <span className="text-[9px] bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 px-1.5 py-0.5 rounded font-black tracking-tighter">OWNER</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                        <Mail size={13} className="text-zinc-400 shrink-0" />
                        {u.email}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${u.disabled ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
                        {u.disabled ? 'Suspended' : 'Active'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const role = ROLES.find(r => r.id === u.role) || ROLES[4];
                        return (
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border w-fit ${role.color}`}>
                            {u.role === 'super_admin' && <ShieldCheck size={12} />}
                            {role.label}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Calendar size={14} className="opacity-70" />
                        {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {hasRight('users', 'u') && (
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => { setEditingUser(u); setActiveTab('details'); }}
                              className={`p-2 rounded-lg transition-all ${u.email === OWNER_EMAIL && user?.email !== OWNER_EMAIL
                                ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                                : 'text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
                              title="Edit Profile"
                              disabled={u.email === OWNER_EMAIL && user?.email !== OWNER_EMAIL}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button 
                              onClick={() => { setEditingUser(u); setActiveTab('demographics'); }}
                              className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                              title="Edit Election Setting"
                            >
                              <Shield size={16} />
                            </button>
                            <button 
                              onClick={() => { setEditingUser(u); setActiveTab('permissions'); }}
                              className="p-2 text-zinc-400 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-500/10 rounded-lg transition-all"
                              title="Edit Permissions"
                            >
                              <ShieldCheck size={16} />
                            </button>
                          </div>
                        )}
                        {hasRight('users', 'u') && (
                          <button 
                            onClick={() => {
                              setCreatedInviteInfo({
                                email: u.email,
                                name: u.username,
                                role: u.role,
                                inviteLink: `${window.location.origin}/login?email=${encodeURIComponent(u.email)}`
                              });
                            }}
                            className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                            title="Share / Copy Direct Login Link"
                          >
                            <Share2 size={16} />
                          </button>
                        )}
                        {hasRight('users', 'u') && (
                          <button 
                            onClick={() => { setError(''); setManualResetUser(u); }}
                            className={`p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all`}
                            title="Reset User Password"
                          >
                            <Key size={16} />
                          </button>
                        )}
                        {hasRight('users', 'u') && (
                          <button 
                            onClick={() => toggleUserStatus(u.uid, u.disabled || false)}
                            className={`p-2 rounded-lg transition-all ${u.disabled 
                              ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10' 
                              : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'} ${
                                u.uid === user?.uid || u.email === OWNER_EMAIL ? 'opacity-20 cursor-not-allowed' : ''
                              }`}
                            title={u.disabled ? "Enable Account" : "Disable Account"}
                            disabled={u.uid === user?.uid || u.email === OWNER_EMAIL}
                          >
                            {u.disabled ? <UserCheck size={16} /> : <UserX size={16} />}
                          </button>
                        )}
                        {hasRight('users', 'd') && (
                          <button 
                            onClick={() => setUserToDelete(u)}
                            className={`p-2 rounded-lg transition-all ${
                              u.uid === user?.uid || u.email === OWNER_EMAIL 
                              ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed' 
                              : 'text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                            }`}
                            title="Delete User"
                            disabled={u.uid === user?.uid || u.email === OWNER_EMAIL}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      <AnimatePresence>
        {manualResetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => { setManualResetUser(null); setManualPassword(''); setError(''); }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative webapp-card w-full max-w-sm shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Security Actions</h3>
                <button onClick={() => { setManualResetUser(null); setManualPassword(''); setError(''); }} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
                  <X size={20} />
                </button>
              </div>
              
              <div className="p-8 space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{manualResetUser.email}</p>
                  <p className="text-xs text-zinc-500">Choose how to reset this user's password.</p>
                </div>

                {error && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold space-y-2 text-left">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={14} />
                      <div className="flex-1 leading-snug">
                        {error}
                      </div>
                    </div>
                    {error.includes('Identity Toolkit') && (
                      <div className="pt-2 border-t border-red-500/10 text-[10px] text-zinc-600 dark:text-zinc-400 font-normal leading-relaxed">
                        <p className="font-bold text-red-500 dark:text-red-400 mb-1">How to enable this feature:</p>
                        Manual admin password overrides require the Google Cloud Identity Toolkit API to be active. Click the button below to enable it for your project:
                        <a 
                          href="https://console.cloud.google.com/apis/library/identitytoolkit.googleapis.com?project=gen-lang-client-0108797473" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-block mt-2 px-3 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-700 dark:text-red-300 font-bold rounded-lg transition-all text-center w-full"
                        >
                          Enable Identity Toolkit API ↗
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Option 1: Send Email (Recommended) */}
                <div className="space-y-4">
                  <button 
                    onClick={() => handleResetPassword(manualResetUser.email)}
                    disabled={actionLoading === manualResetUser.email}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-left group"
                  >
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform">
                      <Mail size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-zinc-900 dark:text-white">Send Reset Email</p>
                      <p className="text-[10px] text-zinc-500">User will receive a link to reset safely.</p>
                    </div>
                  </button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-100 dark:border-zinc-800"></span></div>
                    <div className="relative flex justify-center text-[10px] uppercase font-bold text-zinc-400"><span className="bg-white dark:bg-zinc-950 px-2 tracking-widest">OR</span></div>
                  </div>

                  {/* Option 2: Manual Update (Advanced) */}
                  <form onSubmit={handleManualPasswordReset} className="space-y-4">
                    <div className="space-y-2">
                      <label className="data-label ml-1">Manual Password Update (Admin)</label>
                      <div className="flex gap-2">
                        <input 
                          type="password" 
                          value={manualPassword}
                          onChange={(e) => setManualPassword(e.target.value)}
                          className="webapp-input flex-1 py-2 text-sm"
                          placeholder="Min 6 chars"
                        />
                        <button 
                          type="submit" 
                          disabled={actionLoading === 'manual_reset' || !manualPassword}
                          className="webapp-button-primary px-3 py-2"
                          title="Override Password"
                        >
                          {actionLoading === 'manual_reset' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                        </button>
                      </div>
                      <p className="text-[9px] text-zinc-500 leading-tight">This will set or override the user's password, allowing them to sign in via email/password even if they registered via Google.</p>
                    </div>
                  </form>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setUserToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative webapp-card w-full max-w-sm shadow-2xl p-8 flex flex-col items-center text-center space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 ring-8 ring-red-500/5">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Delete User Account?</h3>
                <p className="text-sm text-zinc-500 mt-2">
                  Are you sure you want to remove <span className="font-bold text-zinc-900 dark:text-zinc-100">{userToDelete.email}</span>? 
                  This action is permanent and only removes their profile record.
                </p>
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button 
                  onClick={() => setUserToDelete(null)}
                  className="webapp-button-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteUser}
                  disabled={actionLoading === userToDelete.uid}
                  className="webapp-button-primary bg-red-600 hover:bg-red-700 border-red-600 flex-1 flex items-center justify-center gap-2"
                >
                  {actionLoading === userToDelete.uid ? <Loader2 className="animate-spin" size={16} /> : <Trash2 size={16} />}
                  Delete Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit User Modal */}
      <AnimatePresence>
        {editingUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setEditingUser(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative webapp-card w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-10 shrink-0">
                <div className="min-w-0">
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate">Config: {editingUser.username || 'User'}</h3>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">{editingUser.email}</p>
                </div>
                <button onClick={() => setEditingUser(null)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 shrink-0">
                  <X size={20} />
                </button>
              </div>

              {/* Functional Tabs */}
              <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 px-4 shrink-0 overflow-x-auto no-scrollbar">
                {[
                  { id: 'details', label: 'Identity', icon: Users },
                  { id: 'demographics', label: 'Election Setting', icon: Shield },
                  { id: 'permissions', label: 'Rights', icon: ShieldCheck },
                ].map((tab: { id: 'details' | 'demographics' | 'permissions'; label: string; icon: React.ElementType }) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${
                      activeTab === tab.id 
                        ? 'border-blue-600 text-blue-600 bg-white dark:bg-zinc-900/40' 
                        : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                    }`}
                  >
                    <tab.icon size={14} />
                    {tab.label}
                  </button>
                ))}
              </div>

              <form onSubmit={handleUpdateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                  {activeTab === 'details' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      <div className="space-y-2">
                        <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Profile Name</label>
                        <input 
                          type="text" 
                          value={editingUser.username}
                          onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                          className="webapp-input w-full"
                          placeholder="Full Name"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Email Address</label>
                        <input 
                          type="email" 
                          value={editingUser.email}
                          readOnly
                          className="webapp-input w-full bg-zinc-50 dark:bg-zinc-800/50 cursor-not-allowed text-zinc-500"
                        />
                        <p className="text-[10px] text-zinc-400 font-medium">Email address is linked to the user account security and is read-only.</p>
                      </div>
                      <div className="space-y-2">
                        <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Assigned Role</label>
                        <select 
                          value={editingUser.role}
                          disabled={editingUser.email === OWNER_EMAIL}
                          onChange={(e) => setEditingUser({...editingUser, role: e.target.value as UserData['role']})}
                          className={`webapp-input w-full appearance-none ${editingUser.email === OWNER_EMAIL ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
                        >
                          {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                        </select>
                        {editingUser.email === OWNER_EMAIL && <p className="text-[10px] text-zinc-500 font-medium italic border-l-2 border-blue-500 pl-2 mt-2">Owner account roles cannot be modified for security reasons.</p>}
                      </div>
                      <div className="space-y-2">
                        <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Public Bio</label>
                        <textarea 
                          rows={3}
                          value={editingUser.bio || ''}
                          onChange={(e) => setEditingUser({...editingUser, bio: e.target.value})}
                          className="webapp-input w-full resize-none p-4"
                          placeholder="Notes about this user..."
                        />
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'demographics' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="bg-blue-50 dark:bg-blue-900-10 p-4 rounded-xl border border-blue-100 dark:border-blue-900-20">
                        <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium font-medium leading-relaxed flex items-center gap-2">
                          <CheckCircle size={14} className="text-blue-500" />
                          Election Setting defines what data this user can manage. Choose one or multiple regions.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Assigned State(s)</label>
                          <MultiSelectDropdown
                            label="State"
                            options={states.map(s => ({ id: s.id, name: s.name }))}
                            selectedIds={selectedEditUserStates}
                            onChange={handleEditUserStatesChange}
                            placeholder="Global Control (All States)"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Assigned District(s)</label>
                          <MultiSelectDropdown
                            label="District"
                            options={districts.map(d => ({ id: d.id, name: d.name }))}
                            selectedIds={selectedEditUserDistricts}
                            onChange={handleEditUserDistrictsChange}
                            placeholder="State-wide Control (All Districts)"
                            disabled={selectedEditUserStates.length === 0}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Assigned Constituency(s)</label>
                          <MultiSelectDropdown
                            label="Constituency"
                            options={constituencies.map(c => ({ id: c.id, name: c.name }))}
                            selectedIds={selectedEditUserConstituencies}
                            onChange={handleEditUserConstituenciesChange}
                            placeholder="District-wide Control (All Constituencies)"
                            disabled={selectedEditUserDistricts.length === 0}
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase ml-1">Assigned Booth(s)</label>
                          <MultiSelectDropdown
                            label="Booth"
                            options={booths.map(b => ({ id: b.id, name: `${b.boothNumber} - ${b.name}` }))}
                            selectedIds={selectedEditUserBooths}
                            onChange={handleEditUserBoothsChange}
                            placeholder="Constituency-wide Control (All Booths)"
                            disabled={selectedEditUserConstituencies.length === 0}
                          />
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'permissions' && (
                    <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                      <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800">
                        <p className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                          Define granular access for each system module. Roles like Super Admin inherit all permissions by default.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pr-2">
                        {MODULES.map((module) => {
                          const currentPerms = editingUser.permissions?.[module.id] || '';
                          const allPermsString = PERMISSION_TYPES.map(t => t.id).join('');
                          const isModuleActive = currentPerms.length === allPermsString.length;
                          return (
                            <div key={module.id} className={`p-4 rounded-xl border transition-all ${isModuleActive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-transparent border-zinc-100 dark:border-zinc-800'}`}>
                              <div className="flex items-center justify-between mb-4">
                                <div className="min-w-0">
                                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider truncate">{module.label}</h4>
                                  <p className="text-[9px] text-zinc-500 mt-1 truncate">{module.description}</p>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const perms = editingUser.permissions || {};
                                    setEditingUser({
                                      ...editingUser,
                                      permissions: { ...perms, [module.id]: isModuleActive ? '' : allPermsString }
                                    });
                                  }}
                                  className={`text-[9px] font-black uppercase px-2 py-1 rounded transition-colors whitespace-nowrap ${
                                    isModuleActive 
                                      ? 'bg-emerald-500 text-white' 
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-400 hover:text-zinc-600'
                                  }`}
                                >
                                  {isModuleActive ? 'Admin Mode' : 'Custom'}
                                </button>
                              </div>
                              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                {PERMISSION_TYPES.map((type) => {
                                  const isActive = currentPerms.includes(type.id);
                                  return (
                                    <button
                                      key={type.id}
                                      type="button"
                                      onClick={() => {
                                        const perms = editingUser.permissions || {};
                                        const oldVal = perms[module.id] || '';
                                        const newVal = oldVal.includes(type.id) 
                                          ? oldVal.replace(type.id, '') 
                                          : (oldVal + type.id);
                                        const sortedNewVal = PERMISSION_TYPES.map(t => t.id).filter(tid => newVal.includes(tid)).join('');
                                        setEditingUser({
                                          ...editingUser,
                                          permissions: { ...perms, [module.id]: sortedNewVal }
                                        });
                                      }}
                                      className={`webapp-button-secondary py-2 text-[10px] font-black border transition-all flex items-center justify-center min-w-[3.5rem] ${
                                        isActive 
                                          ? 'bg-zinc-900 border-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-lg' 
                                          : 'opacity-30 hover:opacity-100'
                                      }`}
                                    >
                                      {type.label.toUpperCase()}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 sticky bottom-0 z-10 shrink-0">
                  <button 
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="webapp-button-secondary text-xs"
                  >
                    Discard Changes
                  </button>
                  <button 
                    type="submit" 
                    disabled={actionLoading === 'updating'}
                    className="webapp-button-primary bg-zinc-900 hover:bg-zinc-800 border-zinc-900 flex items-center gap-2 px-8 min-w-[140px] justify-center"
                  >
                    {actionLoading === 'updating' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                    Apply Settings
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsAddModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative webapp-card w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-10 shrink-0">
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Generate Invitation</h3>
                <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 shrink-0">
                  <X size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-8 space-y-6 overflow-y-auto flex-1 custom-scrollbar">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="data-label text-zinc-700 dark:text-zinc-300 font-bold">Full Name</label>
                      <input 
                        type="text" 
                        required
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        className="webapp-input w-full"
                        placeholder="e.g. John Smith"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="data-label text-zinc-700 dark:text-zinc-300 font-bold">Email Address</label>
                      <input 
                        type="email" 
                        required
                        value={newUser.email}
                        onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                        className="webapp-input w-full"
                        placeholder="john@organization.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="data-label text-zinc-700 dark:text-zinc-300 font-bold">System Role</label>
                      <select 
                        value={newUser.role}
                        onChange={(e) => setNewUser({...newUser, role: e.target.value as UserData['role']})}
                        className="webapp-input w-full appearance-none"
                      >
                        {ROLES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
                      </select>
                    </div>

                    {/* Note: Demographics, Election setting and modular permissions are omitted from registration - can be added later via Edit Settings capability */}
                  </div>
                </div>
                <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 shrink-0 sticky bottom-0 z-10 flex flex-col gap-3">
                  <div className="flex gap-3">
                    <button 
                      type="button" 
                      onClick={() => setIsAddModalOpen(false)}
                      className="webapp-button-secondary flex-1 py-3 text-xs"
                    >
                      Discard
                    </button>
                    <button 
                      type="submit" 
                      disabled={actionLoading === 'creating'}
                      className="webapp-button-primary flex-1 flex items-center justify-center gap-2 py-3 shadow-lg"
                    >
                      {actionLoading === 'creating' ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                      Invite User
                    </button>
                  </div>
                  <p className="text-[9px] text-zinc-500 text-center italic leading-tight">New users must sign up with this exact email to claim their pre-configured settings.</p>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Generated Invite Link Modal */}
        {createdInviteInfo && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="webapp-card w-full max-w-md overflow-hidden shadow-2xl border-emerald-500/20"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-emerald-500/5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">Invitation Ready</h3>
                    <p className="text-xs text-zinc-500">Share this link with {createdInviteInfo.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setCreatedInviteInfo(null)}
                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-zinc-900 dark:text-white">{createdInviteInfo.name}</p>
                    <p className="text-[11px] text-zinc-500">{createdInviteInfo.email}</p>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    {createdInviteInfo.role}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <label className="data-label text-zinc-700 dark:text-zinc-300 font-bold">Direct Invitation URL</label>
                  <div className="flex items-center gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={createdInviteInfo.inviteLink}
                      className="webapp-input w-full text-xs font-mono select-all bg-zinc-100 dark:bg-zinc-900"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(createdInviteInfo.inviteLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2500);
                      }}
                      className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${
                        copiedLink 
                          ? 'bg-emerald-600 text-white' 
                          : 'webapp-button-secondary'
                      }`}
                    >
                      {copiedLink ? <CheckCircle size={14} /> : <Copy size={14} />}
                      {copiedLink ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                </div>

                <div className="pt-2 flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      const msg = `Hello ${createdInviteInfo.name}, you have been invited to NextGen CMS as ${createdInviteInfo.role}. Click here to access your account: ${createdInviteInfo.inviteLink}`;
                      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`, '_blank');
                    }}
                    className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <MessageCircle size={16} />
                    Share via WhatsApp
                  </button>

                  <button 
                    onClick={() => {
                      const subject = `Invitation to NextGen CMS - ${createdInviteInfo.role}`;
                      const body = `Hello ${createdInviteInfo.name},\n\nYou have been invited to join the NextGen CMS system as a ${createdInviteInfo.role}.\n\nPlease click the secure link below to login:\n${createdInviteInfo.inviteLink}\n\nBest regards,\nNextGen CMS Team`;
                      window.open(`mailto:${createdInviteInfo.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`, '_blank');
                    }}
                    className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <Mail size={16} />
                    Send via Email Client
                  </button>
                </div>
              </div>

              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                <button 
                  onClick={() => setCreatedInviteInfo(null)}
                  className="webapp-button-primary px-6 py-2 text-xs"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Reusable, beautiful MultiSelectDropdown component with search, check-boxes, and Select All / Clear All actions
function MultiSelectDropdown({
  label,
  options,
  selectedIds,
  onChange,
  placeholder,
  disabled = false
}: {
  label: string;
  options: { id: string; name: string; detail?: string }[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase()) ||
    (opt.detail && opt.detail.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter(x => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectedNames = options
    .filter(opt => selectedIds.includes(opt.id))
    .map(opt => opt.name);

  let buttonText = placeholder;
  if (selectedIds.length > 0) {
    if (selectedIds.length === options.length && options.length > 0) {
      buttonText = `All ${label}s Selected (${selectedIds.length})`;
    } else {
      buttonText = `(${selectedIds.length}) ${selectedNames.join(', ')}`;
    }
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="webapp-input w-full flex items-center justify-between text-left py-2 px-3.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[38px]"
      >
        <span className="truncate pr-4 font-semibold text-zinc-700 dark:text-zinc-200">
          {buttonText}
        </span>
        <span className="text-[9px] text-zinc-400 font-bold shrink-0">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-64 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
          {/* Search bar */}
          <div className="p-2 border-b border-zinc-100 dark:border-zinc-800/60 flex gap-2 shrink-0 bg-zinc-50/50 dark:bg-zinc-950/30">
            <input
              type="text"
              placeholder={`Search ${label}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="webapp-input w-full py-1 px-2.5 text-xs rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Action buttons */}
          <div className="px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between bg-zinc-50/25 dark:bg-zinc-950/15 shrink-0 text-[10px]">
            <button
              type="button"
              onClick={() => {
                const allIds = options.map(o => o.id);
                onChange(allIds);
              }}
              className="text-blue-600 dark:text-blue-400 font-bold hover:underline"
            >
              Select All
            </button>
            <button
              type="button"
              onClick={() => {
                onChange([]);
              }}
              className="text-zinc-500 dark:text-zinc-400 font-bold hover:underline"
            >
              Clear All
            </button>
          </div>

          {/* List of checkboxes */}
          <div className="overflow-y-auto flex-1 max-h-44 custom-scrollbar">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 italic">
                No matching {label.toLowerCase()}s found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedIds.includes(opt.id);
                return (
                  <label
                    key={opt.id}
                    className="flex items-center gap-2.5 py-2 px-4 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer text-xs font-semibold select-none text-zinc-700 dark:text-zinc-300 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.id)}
                      className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 border-zinc-300 dark:border-zinc-700 dark:bg-zinc-850"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-zinc-900 dark:text-zinc-100">
                        {opt.name}
                      </p>
                      {opt.detail && (
                        <p className="text-[10px] text-zinc-400 truncate dark:text-zinc-500">
                          {opt.detail}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
