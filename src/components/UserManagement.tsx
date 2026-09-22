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
  Copy, Share2, MessageCircle, ExternalLink, Send,
  IdCard, Network, UserCog, Check,
  ChevronDown, ChevronRight, Eye, EyeOff,
  ClipboardList, Layers, Building2, Gift, Wallet, MessageSquare,
  TrendingUp, Vote, Flag, Database, SlidersHorizontal, Lock, BarChart3
} from 'lucide-react';
import { useTableColumns, ColumnDef } from '../hooks/useTableColumns';
import { TableColumnManager } from './common/TableColumnManager';

type UserColumnKey =
  | 'profile'
  | 'email'
  | 'voterId'
  | 'status'
  | 'role'
  | 'reporting'
  | 'createdAt'
  | 'actions';

const DEFAULT_USER_COLUMNS: ColumnDef<UserColumnKey>[] = [
  { id: 'profile', label: 'User Profile', category: 'Account', required: true, defaultVisible: true, minWidth: '180px' },
  { id: 'email', label: 'Email Address', category: 'Contact', defaultVisible: true, minWidth: '160px' },
  { id: 'voterId', label: 'EPIC / Voter ID', category: 'Identity', defaultVisible: false, minWidth: '130px' },
  { id: 'status', label: 'Status', category: 'Status', defaultVisible: true, minWidth: '100px' },
  { id: 'role', label: 'Assigned Role', category: 'Security', defaultVisible: true, minWidth: '130px' },
  { id: 'reporting', label: 'Hierarchy / Reporting', category: 'Organization', defaultVisible: false, minWidth: '150px' },
  { id: 'createdAt', label: 'Join Date', category: 'General', defaultVisible: true, minWidth: '120px' },
  { id: 'actions', label: 'Actions', category: 'Controls', required: true, defaultVisible: true, minWidth: '140px' },
];

interface UserData {
  uid: string;
  id?: string;
  username: string;
  name?: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'volunteer' | 'guest';
  createdAt?: any;
  created_at?: any;
  createdBy?: string;
  created_by?: string;
  bio?: string;
  disabled?: boolean;
  parentAdminId?: string | null;
  parent_admin_id?: string | null;
  adminId?: string;
  parentManagerId?: string | null;
  parent_manager_id?: string | null;
  managerId?: string | null;
  voterId?: string;
  voter_id?: string;
  voterDocId?: string;
  voter_doc_id?: string;
  permissions?: {
    [key: string]: string; // e.g., { voters: 'vcud', demographics: 'v' }
  };
  rights?: {
    [key: string]: string;
  };
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  boothId?: string;
  state_id?: string;
  district_id?: string;
  constituency_id?: string;
  assigned_booths?: string[];
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
  stateId: string;
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber?: string;
  constituencyId: string;
  districtId: string;
  stateId: string;
  constituencyName?: string;
  districtName?: string;
}

const normalizeId = (id: any): string => {
  if (id === null || id === undefined) return '';
  return String(id).trim().replace(/\.0$/, '');
};

const MODULES = [
  { id: 'voters', label: 'Voters', section: 'Main Navigation', icon: Users, description: 'Voter records and search' },
  { id: 'volunteers', label: 'Karyakartas', section: 'Main Navigation', icon: UserCheck, description: 'Karyakartas and field tasks' },
  { id: 'mandals', label: 'Mandals', section: 'Main Navigation', icon: Layers, description: 'Mandal units and presidents' },
  { id: 'booths', label: 'Booths', section: 'Main Navigation', icon: Building2, description: 'Booth mapping and agents' },
  { id: 'benefits', label: 'Benefits', section: 'Main Navigation', icon: Gift, description: 'Welfare and scheme benefits' },
  { id: 'finance', label: 'Finance', section: 'Main Navigation', icon: Wallet, description: 'Expenses and campaign finance' },
  { id: 'whatsapp', label: 'Broadcasts', section: 'Main Navigation', icon: MessageSquare, description: 'WhatsApp and SMS broadcasts' },
  { id: 'surveys', label: 'Surveys', section: 'Main Navigation', icon: Vote, description: 'Voter field surveys' },
  { id: 'predictions', label: 'Analytics', section: 'Main Navigation', icon: TrendingUp, description: 'Predictions and analytics' },
  { id: 'users', label: 'Users', section: 'Administration', icon: UserCog, description: 'User accounts and permissions' },
  { id: 'survey_campaigns', label: 'Surveys Setup', section: 'Administration', icon: ClipboardList, description: 'Questionnaires and campaigns' },
  { id: 'demographics', label: 'Demographics', section: 'Administration', icon: Flag, description: 'State, district, and booth settings' },
  { id: 'elections', label: 'Elections', section: 'Administration', icon: Database, description: 'Election years and parties' },
  { id: 'sentiment_comparison', label: 'Sentiment', section: 'Administration', icon: BarChart3, description: 'Admin sentiment comparison' }
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

const ADMIN_MODULE_IDS = ['users', 'survey_campaigns', 'demographics', 'elections', 'sentiment_comparison'];

const OWNER_EMAIL = 'vijaychauhanofficial01@gmail.com';

export default function UserManagement() {
  const { user, isAdmin, isSuperAdmin, profile, loading: authLoading } = useAuth();

  const hasRight = (moduleId: string, right: string) => {
    const currentEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (isSuperAdmin || currentEmail === OWNER_EMAIL) return true; // Only Super Admin / Owner has unrestricted access
    const perms = profile?.permissions?.[moduleId] || profile?.rights?.[moduleId] || '';
    return perms.includes(right);
  };

  const hasUserView = isSuperAdmin || hasRight('users', 'v');

  const canManageUser = (targetUser: UserData) => {
    const currentEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (currentEmail === OWNER_EMAIL || isSuperAdmin) return true;
    if (targetUser.email?.toLowerCase().trim() === OWNER_EMAIL) return false;
    const currentUid = user?.uid || profile?.uid || profile?.id;
    if ((currentUid && targetUser.uid === currentUid) || (targetUser.email && targetUser.email.toLowerCase().trim() === currentEmail)) return true;
    if (targetUser.role === 'super_admin' || targetUser.role === 'admin') return false;
    return true;
  };

  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [updatingRightsUid, setUpdatingRightsUid] = useState<string | null>(null);

  // Modals state
  const [editingUser, setEditingUser] = useState<UserData | null>(null);
  const [activeTab, setActiveTab] = useState<'details' | 'demographics' | 'permissions'>('details');
  const [addActiveTab, setAddActiveTab] = useState<'details' | 'demographics' | 'permissions'>('details');
  const [userToDelete, setUserToDelete] = useState<UserData | null>(null);
  const [manualResetUser, setManualResetUser] = useState<UserData | null>(null);
  const [manualPassword, setManualPassword] = useState('');
  const [showManualPassword, setShowManualPassword] = useState(false);
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
    boothId: '',
    parentAdminId: '',
    parentManagerId: '',
    voterId: '',
    voterDocId: ''
  });

  // Dynamic voter search & autocomplete
  const [voterQuery, setVoterQuery] = useState('');
  const [voterResults, setVoterResults] = useState<any[]>([]);
  const [isSearchingVoters, setIsSearchingVoters] = useState(false);

  // Table Column Manager with local persistence
  const userColumnManager = useTableColumns('users_table', DEFAULT_USER_COLUMNS);

  useEffect(() => {
    if (!voterQuery || voterQuery.trim().length < 2) {
      setVoterResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearchingVoters(true);
      try {
        const res = await api.get<{ data?: any[] } | any[]>(`/api/voters?search=${encodeURIComponent(voterQuery.trim())}&limit=8`);
        const list = (res as any)?.data || (Array.isArray(res) ? res : []);
        setVoterResults(list);
      } catch (e) {
        console.error('Error searching voters:', e);
      } finally {
        setIsSearchingVoters(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [voterQuery]);

  // Hierarchy Data
  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);

  // Open and normalize user profile edit modal
  const openEditModal = (u: UserData, tab: 'details' | 'demographics' | 'permissions' = 'details') => {
    setError('');
    const rawState = String(u.stateId || u.state_id || '').trim();
    const rawDistrict = String(u.districtId || u.district_id || '').trim();
    const rawConst = String(u.constituencyId || u.constituency_id || '').trim();

    let rawBoothsArr: string[] = [];
    if (Array.isArray(u.assigned_booths) && u.assigned_booths.length > 0) {
      rawBoothsArr = u.assigned_booths.map(normalizeId).filter(b => b && b !== '[]' && b !== 'null' && b !== 'undefined');
    } else if (u.boothId && u.boothId !== '[]' && u.boothId !== 'null' && u.boothId !== 'undefined') {
      rawBoothsArr = String(u.boothId).split(',').map(normalizeId).filter(b => b && b !== '[]' && b !== 'null' && b !== 'undefined');
    }

    const cleanState = (rawState && rawState !== 'null' && rawState !== 'undefined' && rawState !== '[]')
      ? rawState.split(',').map(normalizeId).filter(Boolean).join(',')
      : '';
    const cleanDistrict = (rawDistrict && rawDistrict !== 'null' && rawDistrict !== 'undefined' && rawDistrict !== '[]')
      ? rawDistrict.split(',').map(normalizeId).filter(Boolean).join(',')
      : '';
    const cleanConst = (rawConst && rawConst !== 'null' && rawConst !== 'undefined' && rawConst !== '[]')
      ? rawConst.split(',').map(normalizeId).filter(Boolean).join(',')
      : '';
    const cleanBoothsArr = rawBoothsArr.map(normalizeId).filter(Boolean);
    const cleanBooth = cleanBoothsArr.join(',');

    setEditingUser({
      ...u,
      uid: String(u.uid || u.id || ''),
      username: u.username || (u as any).name || '',
      email: u.email || '',
      role: u.role || 'volunteer',
      bio: u.bio || '',
      parentAdminId: u.parentAdminId || u.parent_admin_id || '',
      parent_admin_id: u.parentAdminId || u.parent_admin_id || '',
      parentManagerId: u.parentManagerId || u.parent_manager_id || '',
      parent_manager_id: u.parentManagerId || u.parent_manager_id || '',
      voterId: u.voterId || u.voter_id || '',
      voter_id: u.voterId || u.voter_id || '',
      voterDocId: u.voterDocId || u.voter_doc_id || '',
      voter_doc_id: u.voterDocId || u.voter_doc_id || '',
      stateId: cleanState,
      districtId: cleanDistrict,
      constituencyId: cleanConst,
      boothId: cleanBooth,
      state_id: cleanState,
      district_id: cleanDistrict,
      constituency_id: cleanConst,
      assigned_booths: cleanBoothsArr,
      permissions: u.permissions || (u as any).rights || {},
      disabled: Boolean(u.disabled)
    });
    setVoterQuery('');
    setVoterResults([]);
    setActiveTab(tab);
  };

  // Multi-select state selectors and handlers for editing user
  const selectedEditUserStates = (editingUser?.stateId || editingUser?.state_id)
    ? String(editingUser.stateId || editingUser.state_id).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')
    : [];
  const selectedEditUserDistricts = (editingUser?.districtId || editingUser?.district_id)
    ? String(editingUser.districtId || editingUser.district_id).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')
    : [];
  const selectedEditUserConstituencies = (editingUser?.constituencyId || editingUser?.constituency_id)
    ? String(editingUser.constituencyId || editingUser.constituency_id).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')
    : [];
  const selectedEditUserBooths = (editingUser?.boothId || (editingUser?.assigned_booths && editingUser.assigned_booths.length > 0))
    ? (editingUser.boothId
      ? String(editingUser.boothId).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')
      : (editingUser.assigned_booths || []).map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]'))
    : [];

  // Cascading filtered options for Election Setting dropdowns (Edit Modal)
  const availableStates = states.map(s => ({
    id: normalizeId(s.id),
    name: s.name
  }));

  const availableDistricts = districts.filter(d =>
    selectedEditUserStates.length === 0 || selectedEditUserStates.includes(normalizeId(d.stateId))
  ).map(d => {
    const parentState = states.find(s => normalizeId(s.id) === normalizeId(d.stateId));
    return {
      id: normalizeId(d.id),
      name: d.name,
      detail: parentState ? parentState.name : undefined
    };
  });

  const availableConstituencies = constituencies.filter(c => {
    const constDistId = normalizeId(c.districtId);
    const parentDistrict = districts.find(d => normalizeId(d.id) === constDistId);
    const constStateId = normalizeId(c.stateId || parentDistrict?.stateId || '');

    const matchState = selectedEditUserStates.length === 0 || selectedEditUserStates.includes(constStateId);
    const matchDistrict = selectedEditUserDistricts.length === 0 || (constDistId && selectedEditUserDistricts.includes(constDistId));
    return matchState && matchDistrict;
  }).map(c => {
    const parentDistrict = districts.find(d => normalizeId(d.id) === normalizeId(c.districtId));
    return {
      id: normalizeId(c.id),
      name: c.name,
      detail: parentDistrict ? parentDistrict.name : undefined
    };
  });

  const availableBooths = booths.filter(b => {
    const boothConstId = normalizeId(b.constituencyId);
    const parentConst = constituencies.find(c => normalizeId(c.id) === boothConstId);
    const boothDistId = normalizeId(b.districtId || parentConst?.districtId || '');
    const parentDistrict = districts.find(d => normalizeId(d.id) === boothDistId);
    const boothStateId = normalizeId(b.stateId || parentConst?.stateId || parentDistrict?.stateId || '');

    const matchState = selectedEditUserStates.length === 0 || (boothStateId && selectedEditUserStates.includes(boothStateId));
    const matchDistrict = selectedEditUserDistricts.length === 0 || (boothDistId && selectedEditUserDistricts.includes(boothDistId));
    const matchConst = selectedEditUserConstituencies.length === 0 || (boothConstId && selectedEditUserConstituencies.includes(boothConstId));
    return matchState && matchDistrict && matchConst;
  }).map(b => {
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(b.constituencyId));
    const constName = b.constituencyName || parentConst?.name;
    const bNumber = b.boothNumber ? (b.boothNumber.startsWith('#') ? b.boothNumber : `#${b.boothNumber}`) : '';
    return {
      id: normalizeId(b.id),
      name: `${bNumber ? `${bNumber} - ` : ''}${b.name}`,
      detail: constName ? `Constituency: ${constName}` : undefined
    };
  });

  // Multi-select state selectors and handlers for new user (Invite Modal)
  const selectedNewUserStates = newUser.stateId ? newUser.stateId.split(',').map(normalizeId).filter(Boolean) : [];
  const selectedNewUserDistricts = newUser.districtId ? newUser.districtId.split(',').map(normalizeId).filter(Boolean) : [];
  const selectedNewUserConstituencies = newUser.constituencyId ? newUser.constituencyId.split(',').map(normalizeId).filter(Boolean) : [];
  const selectedNewUserBooths = newUser.boothId ? newUser.boothId.split(',').map(normalizeId).filter(Boolean) : [];

  const availableNewDistricts = districts.filter(d =>
    selectedNewUserStates.length === 0 || selectedNewUserStates.includes(normalizeId(d.stateId))
  ).map(d => {
    const parentState = states.find(s => normalizeId(s.id) === normalizeId(d.stateId));
    return { id: normalizeId(d.id), name: d.name, detail: parentState ? parentState.name : undefined };
  });

  const availableNewConstituencies = constituencies.filter(c => {
    const constDistId = normalizeId(c.districtId);
    const parentDistrict = districts.find(d => normalizeId(d.id) === constDistId);
    const constStateId = normalizeId(c.stateId || parentDistrict?.stateId || '');

    const matchState = selectedNewUserStates.length === 0 || selectedNewUserStates.includes(constStateId);
    const matchDistrict = selectedNewUserDistricts.length === 0 || (constDistId && selectedNewUserDistricts.includes(constDistId));
    return matchState && matchDistrict;
  }).map(c => {
    const parentDistrict = districts.find(d => normalizeId(d.id) === normalizeId(c.districtId));
    return { id: normalizeId(c.id), name: c.name, detail: parentDistrict ? parentDistrict.name : undefined };
  });

  const availableNewBooths = booths.filter(b => {
    const boothConstId = normalizeId(b.constituencyId);
    const parentConst = constituencies.find(c => normalizeId(c.id) === boothConstId);
    const boothDistId = normalizeId(b.districtId || parentConst?.districtId || '');
    const parentDistrict = districts.find(d => normalizeId(d.id) === boothDistId);
    const boothStateId = normalizeId(b.stateId || parentConst?.stateId || parentDistrict?.stateId || '');

    const matchState = selectedNewUserStates.length === 0 || (boothStateId && selectedNewUserStates.includes(boothStateId));
    const matchDistrict = selectedNewUserDistricts.length === 0 || (boothDistId && selectedNewUserDistricts.includes(boothDistId));
    const matchConst = selectedNewUserConstituencies.length === 0 || (boothConstId && selectedNewUserConstituencies.includes(boothConstId));
    return matchState && matchDistrict && matchConst;
  }).map(b => {
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(b.constituencyId));
    const constName = b.constituencyName || parentConst?.name;
    const bNumber = b.boothNumber ? (b.boothNumber.startsWith('#') ? b.boothNumber : `#${b.boothNumber}`) : '';
    return {
      id: normalizeId(b.id),
      name: `${bNumber ? `${bNumber} - ` : ''}${b.name}`,
      detail: constName ? `Constituency: ${constName}` : undefined
    };
  });

  const handleEditUserStatesChange = (stateIds: string[]) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      stateId: stateIds.join(','),
      state_id: stateIds.join(',')
    });
  };

  const handleEditUserDistrictsChange = (districtIds: string[]) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      districtId: districtIds.join(','),
      district_id: districtIds.join(',')
    });
  };

  const handleEditUserConstituenciesChange = (constituencyIds: string[]) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      constituencyId: constituencyIds.join(','),
      constituency_id: constituencyIds.join(',')
    });
  };

  const handleEditUserBoothsChange = (boothIds: string[]) => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      boothId: boothIds.join(','),
      assigned_booths: boothIds
    });
  };

  const handleClearAllDemographics = () => {
    if (!editingUser) return;
    setEditingUser({
      ...editingUser,
      stateId: '',
      districtId: '',
      constituencyId: '',
      boothId: '',
      state_id: '',
      district_id: '',
      constituency_id: '',
      assigned_booths: []
    });
  };

  const handleResetPassword = async (email: string) => {
    setActionLoading(email);
    try {
      try {
        const actionCodeSettings = {
          url: `${window.location.protocol}//${window.location.host}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(firebaseAuth, email, actionCodeSettings);
      } catch (innerErr: unknown) {
        console.warn('ActionCodeSettings failed, falling back to standard reset link:', innerErr);
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
    setError('');
    try {
      const response = await api.post<{ success: boolean; message?: string }>('/api/admin/reset-password', {
        uid: manualResetUser.uid || (manualResetUser as any).id,
        email: manualResetUser.email,
        newPassword: manualPassword
      });

      setSuccessMessage(response?.message || `Password for "${manualResetUser.email}" has been manually updated.`);
      setManualResetUser(null);
      setManualPassword('');
      setShowManualPassword(false);
      setTimeout(() => setSuccessMessage(''), 4000);
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
      setUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
    } catch (err: unknown) {
      console.error('Error fetching users:', err);
      setError('Insufficient permissions to view users.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch all demographic hierarchy entities upfront
  const fetchAllDemographics = async () => {
    try {
      const [sts, dsts, csts, bths] = await Promise.all([
        api.get<any[]>('/api/states').catch(() => []),
        api.get<any[]>('/api/districts').catch(() => []),
        api.get<any[]>('/api/constituencies').catch(() => []),
        api.get<any[]>('/api/booths').catch(() => [])
      ]);

      const stateMap = new Map<string, string>();
      const parsedStates: IndiaState[] = (sts || []).map((s: any) => {
        const sid = normalizeId(s.id);
        const sname = s.name || `State #${sid}`;
        stateMap.set(sid, sname);
        return { id: sid, name: sname };
      });

      const distMap = new Map<string, { name: string; stateId: string }>();
      const parsedDistricts: IndiaDistrict[] = (dsts || []).map((d: any) => {
        const did = normalizeId(d.id);
        const dname = d.name || `District #${did}`;
        const stateId = normalizeId(d.state_id || d.stateId || '');
        distMap.set(did, { name: dname, stateId });
        return { id: did, name: dname, stateId };
      });

      const constMap = new Map<string, { name: string; districtId: string; stateId: string }>();
      const parsedConstituencies: IndiaConstituency[] = (csts || []).map((c: any) => {
        const cid = normalizeId(c.id);
        const cname = c.name || `Constituency #${cid}`;
        const rawDistId = normalizeId(c.district_id || c.districtId || '');
        const parentDist = distMap.get(rawDistId) || (dsts || []).find((d: any) => normalizeId(d.id) === rawDistId);
        const parentDistStateId = parentDist ? normalizeId((parentDist as any).stateId || (parentDist as any).state_id || '') : '';
        const stateId = normalizeId(c.state_id || c.stateId || parentDistStateId);
        constMap.set(cid, { name: cname, districtId: rawDistId, stateId });
        return { id: cid, name: cname, districtId: rawDistId, stateId };
      });

      const parsedBooths: IndiaBooth[] = (bths || []).map((b: any) => {
        const bid = normalizeId(b.id);
        const rawConstId = normalizeId(b.constituency_id || b.constituencyId || '');
        const parentConst = constMap.get(rawConstId) || (csts || []).find((c: any) => normalizeId(c.id) === rawConstId);
        const rawDistId = normalizeId(b.district_id || b.districtId || (parentConst as any)?.districtId || (parentConst as any)?.district_id || '');
        const parentDist = distMap.get(rawDistId) || (dsts || []).find((d: any) => normalizeId(d.id) === rawDistId);
        const rawStateId = normalizeId(b.state_id || b.stateId || (parentConst as any)?.stateId || (parentConst as any)?.state_id || (parentDist as any)?.stateId || (parentDist as any)?.state_id || '');
        const cName = b.constituency_name || (parentConst as any)?.name || '';
        const dName = b.district_name || (parentDist as any)?.name || '';
        const bNum = String(b.booth_number || b.boothNumber || '').trim();
        const bName = b.name || `Booth ${bNum ? `#${bNum}` : `#${bid}`}`;

        return {
          id: bid,
          name: bName,
          boothNumber: bNum,
          constituencyId: rawConstId,
          districtId: rawDistId,
          stateId: rawStateId,
          constituencyName: cName,
          districtName: dName
        };
      });

      setStates(parsedStates);
      setDistricts(parsedDistricts);
      setConstituencies(parsedConstituencies);
      setBooths(parsedBooths);
    } catch (err) {
      console.error('Error fetching demographics:', err);
    }
  };

  useEffect(() => {
    if (hasUserView) {
      fetchUsers();
      fetchAllDemographics();
    }
  }, [hasUserView, isAdmin, isSuperAdmin, profile]);

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setActionLoading('updating');
    try {
      const targetUid = editingUser.uid || (editingUser as any).id;
      const stateVal = (editingUser.stateId || editingUser.state_id || '').trim();
      const districtVal = (editingUser.districtId || editingUser.district_id || '').trim();
      const constVal = (editingUser.constituencyId || editingUser.constituency_id || '').trim();

      let boothArr: string[] = [];
      if (editingUser.boothId) {
        boothArr = String(editingUser.boothId).split(',').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]');
      } else if (Array.isArray(editingUser.assigned_booths)) {
        boothArr = editingUser.assigned_booths.map(String).map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]');
      }
      const boothVal = boothArr.length > 0 ? boothArr.join(',') : null;

      const payload = {
        name: editingUser.username || (editingUser as any).name || '',
        role: editingUser.role,
        bio: editingUser.bio || '',
        parent_admin_id: editingUser.parentAdminId || editingUser.parent_admin_id || null,
        parent_manager_id: editingUser.parentManagerId || editingUser.parent_manager_id || null,
        voter_id: editingUser.voterId || editingUser.voter_id || null,
        voter_doc_id: editingUser.voterDocId || editingUser.voter_doc_id || null,
        permissions: editingUser.permissions || {},
        rights: editingUser.permissions || {},
        state_id: (stateVal && stateVal !== 'null' && stateVal !== 'undefined' && stateVal !== '[]') ? stateVal : null,
        district_id: (districtVal && districtVal !== 'null' && districtVal !== 'undefined' && districtVal !== '[]') ? districtVal : null,
        constituency_id: (constVal && constVal !== 'null' && constVal !== 'undefined' && constVal !== '[]') ? constVal : null,
        booth_id: boothVal,
        assigned_booths: boothArr,
        disabled: Boolean(editingUser.disabled)
      };

      await api.put(`/api/users/${encodeURIComponent(targetUid)}`, payload);

      setSuccessMessage(`User "${editingUser.username || 'profile'}" updated successfully.`);
      setEditingUser(null);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: unknown) {
      console.error('Update error:', err);
      const msg = err instanceof Error ? err.message : 'Failed to update user profile.';
      setError(msg);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateSingleUserRight = async (targetUser: UserData, moduleId: string, rightKey: string) => {
    const isManageable = canManageUser(targetUser);
    if (!isManageable) return;

    const currentPerms = targetUser.permissions?.[moduleId] || targetUser.rights?.[moduleId] || '';
    const newPermsStr = currentPerms.includes(rightKey)
      ? currentPerms.replace(rightKey, '')
      : `${currentPerms}${rightKey}`;

    const updatedPermissions: Record<string, string> = {
      ...(targetUser.permissions || {}),
      ...(targetUser.rights || {}),
      [moduleId]: newPermsStr
    };
    if (!newPermsStr) {
      delete updatedPermissions[moduleId];
    }

    setUpdatingRightsUid(targetUser.uid);
    setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, permissions: updatedPermissions, rights: updatedPermissions } : u));

    try {
      await api.put(`/api/users/${encodeURIComponent(targetUser.uid)}`, {
        permissions: updatedPermissions,
        rights: updatedPermissions
      });
      setSuccessMessage(`Updated ${MODULES.find(m => m.id === moduleId)?.label || moduleId} rights for ${targetUser.username || targetUser.email}.`);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e: any) {
      console.error('Failed to update rights:', e);
      setError('Failed to update rights: ' + (e?.message || 'Server error'));
      await fetchUsers();
    } finally {
      setUpdatingRightsUid(null);
    }
  };

  const handleGrantModulePermission = async (targetUser: UserData, moduleId: string, rightsStr = 'vcud') => {
    const isManageable = canManageUser(targetUser);
    if (!isManageable) return;

    const updatedPermissions: Record<string, string> = {
      ...(targetUser.permissions || {}),
      ...(targetUser.rights || {}),
      [moduleId]: rightsStr
    };

    setUpdatingRightsUid(targetUser.uid);
    setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, permissions: updatedPermissions, rights: updatedPermissions } : u));

    try {
      await api.put(`/api/users/${encodeURIComponent(targetUser.uid)}`, {
        permissions: updatedPermissions,
        rights: updatedPermissions
      });
      setSuccessMessage(`Granted ${MODULES.find(m => m.id === moduleId)?.label || moduleId} rights to ${targetUser.username || targetUser.email}.`);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e: any) {
      console.error('Failed to grant rights:', e);
      setError('Failed to grant rights: ' + (e?.message || 'Server error'));
      await fetchUsers();
    } finally {
      setUpdatingRightsUid(null);
    }
  };

  const handleRevokeModulePermission = async (targetUser: UserData, moduleId: string) => {
    const isManageable = canManageUser(targetUser);
    if (!isManageable) return;

    const updatedPermissions: Record<string, string> = {
      ...(targetUser.permissions || {}),
      ...(targetUser.rights || {})
    };
    delete updatedPermissions[moduleId];

    setUpdatingRightsUid(targetUser.uid);
    setUsers(prev => prev.map(u => u.uid === targetUser.uid ? { ...u, permissions: updatedPermissions, rights: updatedPermissions } : u));

    try {
      await api.put(`/api/users/${encodeURIComponent(targetUser.uid)}`, {
        permissions: updatedPermissions,
        rights: updatedPermissions
      });
      setSuccessMessage(`Revoked ${MODULES.find(m => m.id === moduleId)?.label || moduleId} rights from ${targetUser.username || targetUser.email}.`);
      setTimeout(() => setSuccessMessage(''), 2000);
    } catch (e: any) {
      console.error('Failed to revoke rights:', e);
      setError('Failed to revoke rights: ' + (e?.message || 'Server error'));
      await fetchUsers();
    } finally {
      setUpdatingRightsUid(null);
    }
  };

  const handleBulkGrantModule = async (moduleId: string, targetList: UserData[], rightsStr = 'vcud') => {
    const manageableList = targetList.filter(u => canManageUser(u) && u.role !== 'super_admin');
    if (manageableList.length === 0) return;

    setActionLoading('bulk_rights');
    try {
      await Promise.all(
        manageableList.map(u => {
          const updated = { ...(u.permissions || {}), ...(u.rights || {}), [moduleId]: rightsStr };
          return api.put(`/api/users/${encodeURIComponent(u.uid)}`, { permissions: updated, rights: updated });
        })
      );
      setSuccessMessage(`Successfully granted ${MODULES.find(m => m.id === moduleId)?.label || moduleId} rights to ${manageableList.length} users.`);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e: any) {
      console.error('Failed bulk grant:', e);
      setError('Bulk update failed: ' + (e?.message || 'Server error'));
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkRevokeModule = async (moduleId: string, targetList: UserData[]) => {
    const manageableList = targetList.filter(u => canManageUser(u) && u.role !== 'super_admin');
    if (manageableList.length === 0) return;

    setActionLoading('bulk_rights');
    try {
      await Promise.all(
        manageableList.map(u => {
          const updated = { ...(u.permissions || {}), ...(u.rights || {}) };
          delete updated[moduleId];
          return api.put(`/api/users/${encodeURIComponent(u.uid)}`, { permissions: updated, rights: updated });
        })
      );
      setSuccessMessage(`Successfully revoked ${MODULES.find(m => m.id === moduleId)?.label || moduleId} rights from ${manageableList.length} users.`);
      await fetchUsers();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (e: any) {
      console.error('Failed bulk revoke:', e);
      setError('Bulk update failed: ' + (e?.message || 'Server error'));
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
        parent_admin_id: newUser.parentAdminId || null,
        parent_manager_id: newUser.parentManagerId || null,
        voter_id: newUser.voterId || null,
        voter_doc_id: newUser.voterDocId || null,
        permissions: newUser.permissions || {},
        rights: newUser.permissions || {},
        state_id: newUser.stateId || null,
        district_id: newUser.districtId || null,
        constituency_id: newUser.constituencyId || null,
        booth_id: newUser.boothId || null,
        assigned_booths: newUser.boothId ? newUser.boothId.split(',').map(s => s.trim()).filter(Boolean) : []
      };

      const res = await api.post<{ success: boolean; inviteLink: string; email: string; name: string; role: string }>('/api/users/invite', payload);

      // Automatically send setup / password reset email to the invited user
      let emailSent = false;
      try {
        const actionCodeSettings = {
          url: `${window.location.protocol}//${window.location.host}/reset-password`,
          handleCodeInApp: true,
        };
        await sendPasswordResetEmail(firebaseAuth, newUser.email, actionCodeSettings);
        emailSent = true;
      } catch (innerErr) {
        try {
          await sendPasswordResetEmail(firebaseAuth, newUser.email);
          emailSent = true;
        } catch (emailErr) {
          console.warn('Direct email dispatch note (user can use invite link directly):', emailErr);
        }
      }

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

      setSuccessMessage(
        emailSent
          ? `Invitation registered and password setup email sent to ${newUser.email}.`
          : `Invitation registered successfully for ${newUser.email}.`
      );
      setNewUser({
        username: '',
        email: '',
        role: 'volunteer',
        permissions: {},
        stateId: '',
        districtId: '',
        constituencyId: '',
        boothId: '',
        parentAdminId: '',
        parentManagerId: '',
        voterId: '',
        voterDocId: ''
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

  const availableAdmins = users.filter(u => u.role === 'admin' || u.role === 'super_admin');

  const getAvailableManagers = (parentAdminId?: string | null) => {
    if (parentAdminId) {
      return users.filter(u => u.role === 'manager' && (u.parentAdminId === parentAdminId || u.parent_admin_id === parentAdminId || u.adminId === parentAdminId));
    }
    return users.filter(u => u.role === 'manager');
  };

  const getAdminName = (id?: string | null) => {
    if (!id) return '';
    const found = users.find(u => u.uid === id || u.id === id);
    return found?.username || found?.name || id;
  };

  const getManagerName = (id?: string | null) => {
    if (!id) return '';
    const found = users.find(u => u.uid === id || u.id === id);
    return found?.username || found?.name || id;
  };

  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (u.voterId && u.voterId.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (u.voter_id && u.voter_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (authLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-8">
        <Loader2 className="animate-spin text-zinc-400 mb-4" size={36} />
        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">Loading user management workspace...</p>
      </div>
    );
  }

  if (!hasUserView) {
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
    <div className="space-y-6 w-full">
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Users
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {users.length} Users
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage user accounts, roles, and permissions.
          </p>
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
              Add User
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

      {/* Users Table & Mobile List */}
      <div className="webapp-card overflow-hidden">
        {/* Table Action Toolbar with Column Customizer */}
        <div className="px-6 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              Showing <strong className="text-zinc-900 dark:text-white">{filteredUsers.length}</strong> system accounts
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TableColumnManager columnManager={userColumnManager} tableName="Users" />
          </div>
        </div>

        {/* Table View (Desktop & Tablet) */}
        <div className="overflow-x-auto custom-scrollbar hidden md:block">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                {userColumnManager.visibleColumns.map(col => (
                  <th
                    key={col.id}
                    className={`px-6 py-4 data-label ${col.id === 'actions' ? 'text-right' : col.id === 'status' ? 'text-center' : ''}`}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={userColumnManager.visibleColumns.length || 1} className="px-6 py-20 text-center">
                    <Loader2 className="animate-spin mx-auto text-zinc-300 dark:text-zinc-700" size={32} />
                    <p className="mt-4 text-sm text-zinc-500">Retrieving system users...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={userColumnManager.visibleColumns.length || 1} className="px-6 py-20 text-center text-zinc-500">
                    No users found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const role = ROLES.find(r => r.id === u.role) || ROLES[4];
                  const isManageable = canManageUser(u);
                  return (
                    <tr
                      key={u.uid}
                      onClick={() => {
                        if (!isManageable) return;
                        openEditModal(u, 'details');
                      }}
                      className={`group transition-colors ${
                        isManageable
                          ? 'hover:bg-zinc-50 dark:hover:bg-zinc-900/40 cursor-pointer'
                          : 'opacity-70 cursor-not-allowed bg-zinc-50/20 dark:bg-zinc-900/10'
                      } ${u.disabled ? 'opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20' : ''}`}
                    >
                      {userColumnManager.visibleColumns.map(col => {
                        switch (col.id) {
                          case 'profile':
                            return (
                              <td key={col.id} className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-900 dark:text-zinc-100 text-xs border border-zinc-200 dark:border-zinc-700 shadow-xs">
                                    {u.username?.[0]?.toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs font-bold text-zinc-900 dark:text-white">
                                        {u.username || 'Unspecified Name'}
                                      </p>
                                      {u.uid === user?.uid && (
                                        <span className="text-[9px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-bold">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    {u.designation && (
                                      <p className="text-[10px] text-zinc-400 mt-0.5">
                                        {u.designation}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                            );
                          case 'email':
                            return (
                              <td key={col.id} className="px-6 py-4">
                                <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                                  <Mail size={13} className="text-zinc-400 shrink-0" />
                                  <span className="truncate">{u.email}</span>
                                </div>
                              </td>
                            );
                          case 'voterId':
                            return (
                              <td key={col.id} className="px-6 py-4">
                                {(u.voterId || u.voter_id) ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900/50">
                                    <IdCard size={12} />
                                    {u.voterId || u.voter_id}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 text-xs">—</span>
                                )}
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={col.id} className="px-6 py-4 text-center">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide ${
                                  u.disabled
                                    ? 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                    : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${u.disabled ? 'bg-zinc-400' : 'bg-emerald-500'}`} />
                                  {u.disabled ? 'Inactive' : 'Active'}
                                </span>
                              </td>
                            );
                          case 'role':
                            return (
                              <td key={col.id} className="px-6 py-4">
                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${
                                  u.role === 'super_admin'
                                    ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                                    : u.role === 'admin'
                                    ? 'bg-blue-50 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40'
                                    : u.role === 'manager'
                                    ? 'bg-purple-50 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40'
                                    : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                                }`}>
                                  <Shield size={12} />
                                  {role?.label || u.role}
                                </span>
                              </td>
                            );
                          case 'reporting': {
                            const mgr = users.find(x => x.uid === (u.parentManagerId || (u as any).parent_manager_id));
                            const adm = users.find(x => x.uid === (u.adminId || (u as any).admin_id));
                            return (
                              <td key={col.id} className="px-6 py-4 text-xs text-zinc-600 dark:text-zinc-400">
                                {mgr ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/50 px-2 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">
                                    <UserCog size={12} />
                                    {mgr.username || mgr.email}
                                  </span>
                                ) : adm ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                                    <Shield size={12} />
                                    {adm.username || adm.email}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 italic text-[11px]">Direct Super Admin</span>
                                )}
                              </td>
                            );
                          }
                          case 'createdAt':
                            return (
                              <td key={col.id} className="px-6 py-4 text-xs text-zinc-500 whitespace-nowrap">
                                {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                              </td>
                            );
                          case 'actions':
                            return (
                              <td key={col.id} className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-end gap-1">
                                  {hasRight('users', 'u') && isManageable && (
                                    <button
                                      onClick={() => {
                                        setCreatedInviteInfo({
                                          email: u.email,
                                          name: u.username || '',
                                          role: u.role || '',
                                          inviteLink: `${window.location.origin}/login?email=${encodeURIComponent(u.email)}`
                                        });
                                      }}
                                      className="p-2 text-zinc-400 hover:text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 rounded-lg transition-all"
                                      title="Share / Copy Direct Login Link"
                                    >
                                      <Share2 size={16} />
                                    </button>
                                  )}
                                  {hasRight('users', 'u') && isManageable && (
                                    <button
                                      onClick={() => { setError(''); setManualResetUser(u); }}
                                      className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-500/10 rounded-lg transition-all"
                                      title="Reset User Password"
                                    >
                                      <Key size={16} />
                                    </button>
                                  )}
                                  {hasRight('users', 'u') && isManageable && (
                                    <button
                                      onClick={() => toggleUserStatus(u.uid, u.disabled || false)}
                                      className={`p-2 rounded-lg transition-all ${u.disabled
                                        ? 'text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                                        : 'text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-500/10'} ${u.uid === user?.uid || u.email === OWNER_EMAIL ? 'opacity-20 cursor-not-allowed' : ''
                                        }`}
                                      title={u.disabled ? "Enable Account" : "Disable Account"}
                                      disabled={u.uid === user?.uid || u.email === OWNER_EMAIL}
                                    >
                                      {u.disabled ? <UserCheck size={16} /> : <UserX size={16} />}
                                    </button>
                                  )}
                                  {hasRight('users', 'd') && isManageable && (
                                    <button
                                      onClick={() => setUserToDelete(u)}
                                      className={`p-2 rounded-lg transition-all ${u.uid === user?.uid || u.email === OWNER_EMAIL
                                          ? 'text-zinc-200 dark:text-zinc-800 cursor-not-allowed'
                                          : 'text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10'
                                        }`}
                                      title="Delete User"
                                      disabled={u.uid === user?.uid || u.email === OWNER_EMAIL}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  )}
                                  {!isManageable && (
                                    <span className="p-2 text-zinc-300 dark:text-zinc-700" title="Protected account - Managed by Super Admin">
                                      <Shield size={16} />
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

    {/* Mobile View (Smartphones) */ }
    < div className = "md:hidden divide-y divide-zinc-100 dark:divide-zinc-800" >
    {
      loading?(
            <div className = "p-12 text-center" >
              <Loader2 className="animate-spin mx-auto text-zinc-400 mb-2" size={24} />
              <p className="text-xs text-zinc-500">Retrieving system users...</p>
            </div>
          ) : filteredUsers.length === 0 ? (
    <div className="p-8 text-center text-xs text-zinc-400">
      No users found matching your criteria.
    </div>
  ) : (
    filteredUsers.map((u) => {
      const role = ROLES.find(r => r.id === u.role) || ROLES[4];
      const isManageable = canManageUser(u);
      return (
        <div key={u.uid} className={`p-4 space-y-3 ${u.disabled ? 'opacity-60 bg-zinc-50/50 dark:bg-zinc-900/20' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-900 dark:text-zinc-100 text-sm border border-zinc-200 dark:border-zinc-700 shadow-sm shrink-0">
                {u.username?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">
                  {u.username || 'Unspecified Name'}
                </p>
                <p className="text-xs text-zinc-500 truncate flex items-center gap-1 mt-0.5">
                  <Mail size={11} className="shrink-0 text-zinc-400" />
                  {u.email}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(u.voterId || u.voter_id) && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/20 font-bold">
                      <IdCard size={9} />
                      {u.voterId || u.voter_id}
                    </span>
                  )}
                  {(u.parentManagerId || u.parent_manager_id) && (
                    <span className="inline-flex items-center gap-0.5 text-[8px] bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 rounded border border-purple-500/20 font-bold">
                      <UserCog size={9} />
                      {getManagerName(u.parentManagerId || u.parent_manager_id)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <span className={`shrink-0 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border ${u.disabled ? 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'}`}>
              {u.disabled ? 'Suspended' : 'Active'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest border ${role.color}`}>
              {u.role === 'super_admin' && <ShieldCheck size={11} />}
              {role.label}
            </span>
            <div className="flex items-center gap-1">
              {hasRight('users', 'u') && isManageable && (
                <>
                  <button
                    onClick={() => openEditModal(u, 'details')}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-300 rounded-lg text-xs"
                    title="Edit"
                  >
                    <Edit2 size={13} />
                  </button>
                  <button
                    onClick={() => openEditModal(u, 'demographics')}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-500 rounded-lg text-xs"
                    title="Election Setting"
                  >
                    <Shield size={13} />
                  </button>
                  <button
                    onClick={() => openEditModal(u, 'permissions')}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-purple-500 rounded-lg text-xs"
                    title="Permissions"
                  >
                    <ShieldCheck size={13} />
                  </button>
                  <button
                    onClick={() => { setError(''); setManualResetUser(u); }}
                    className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-blue-600 rounded-lg text-xs"
                    title="Reset Password"
                  >
                    <Key size={13} />
                  </button>
                </>
              )}
              {hasRight('users', 'd') && isManageable && u.uid !== user?.uid && u.email !== OWNER_EMAIL && (
                <button
                  onClick={() => setUserToDelete(u)}
                  className="p-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-red-500 rounded-lg text-xs"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              )}
              {!isManageable && (
                <span className="text-[10px] text-zinc-400 font-bold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  Super Admin Governed
                </span>
              )}
            </div>
          </div>
        </div>
      );
    })
  )
}
        </div >
      </div >

  {/* Password Reset Modal */ }
  <AnimatePresence>
{
  manualResetUser && (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={() => { setManualResetUser(null); setManualPassword(''); setShowManualPassword(false); setError(''); }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="relative webapp-card w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Key size={16} />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-white tracking-tight">Security Actions</h3>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Password Management</p>
            </div>
          </div>
          <button
            onClick={() => { setManualResetUser(null); setManualPassword(''); setShowManualPassword(false); setError(''); }}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">Target User Account:</p>
            <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100 truncate mt-0.5">{manualResetUser.email}</p>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold space-y-2 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="shrink-0 mt-0.5 text-red-500" size={14} />
                <div className="flex-1 leading-snug">
                  {error}
                </div>
              </div>
            </div>
          )}

          {/* Option 1: Send Email */}
          <div className="space-y-4">
            <button
              onClick={() => handleResetPassword(manualResetUser.email)}
              disabled={actionLoading === manualResetUser.email}
              className="w-full flex items-center gap-3.5 p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 transition-all text-left group cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                {actionLoading === manualResetUser.email ? <Loader2 className="animate-spin" size={18} /> : <Mail size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-zinc-900 dark:text-white">Send Password Reset Email</p>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Dispatches an email with a secure password reset link.</p>
              </div>
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-zinc-200 dark:border-zinc-800"></span></div>
              <div className="relative flex justify-center text-[10px] uppercase font-black text-zinc-400 dark:text-zinc-500"><span className="bg-white dark:bg-zinc-950 px-2 tracking-widest">OR MANUAL OVERRIDE</span></div>
            </div>

            {/* Option 2: Manual Update */}
            <form onSubmit={handleManualPasswordReset} className="space-y-3">
              <div className="space-y-2">
                <label className="data-label text-zinc-700 dark:text-zinc-300 font-bold flex items-center justify-between">
                  <span>Set New Password Manually</span>
                  <span className="text-[10px] text-zinc-400 font-normal">Min 6 characters</span>
                </label>
                <div className="relative">
                  <input
                    type={showManualPassword ? "text" : "password"}
                    value={manualPassword}
                    onChange={(e) => setManualPassword(e.target.value)}
                    className="webapp-input w-full py-2 pl-3 pr-10 text-xs"
                    placeholder="Enter new password"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowManualPassword(!showManualPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors p-0.5"
                    tabIndex={-1}
                    title={showManualPassword ? "Hide password" : "Show password"}
                  >
                    {showManualPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-tight">
                  Admins and Super Admins can directly set or reset user passwords in the system.
                </p>
              </div>

              <button
                type="submit"
                disabled={actionLoading === 'manual_reset' || !manualPassword || manualPassword.length < 6}
                className="webapp-button-primary w-full py-2.5 text-xs flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                {actionLoading === 'manual_reset' ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
                <span>Update Password</span>
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
      </AnimatePresence >

  {/* Delete Confirmation Modal */ }
  <AnimatePresence>
{
  userToDelete && (
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
  )
}
      </AnimatePresence >

  {/* Edit User Modal */ }
  <AnimatePresence>
{
  editingUser && (
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
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/60 px-4 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'details', label: 'Identity', icon: Users },
            { id: 'demographics', label: 'Election Setting', icon: Shield },
            { id: 'permissions', label: 'Rights', icon: ShieldCheck },
          ].map((tab: { id: 'details' | 'demographics' | 'permissions'; label: string; icon: React.ElementType }) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${activeTab === tab.id
                  ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 shadow-xs'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Profile Name</label>
                    <input
                      type="text"
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
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
                      className="webapp-input w-full bg-zinc-100/70 dark:bg-zinc-850 cursor-not-allowed text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                </div>

                {/* Linked Voter Registry Association */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <IdCard size={15} className="text-blue-600" />
                      Linked Voter Profile
                    </label>
                    {(editingUser.voterId || editingUser.voter_id) && (
                      <button
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, voterId: '', voter_id: '', voterDocId: '', voter_doc_id: '' })}
                        className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1"
                      >
                        <X size={12} />
                        Unlink Voter
                      </button>
                    )}
                  </div>

                  {(editingUser.voterId || editingUser.voter_id) ? (
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-blue-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{editingUser.voterId || editingUser.voter_id}</span>
                          <span>•</span>
                          <span>{editingUser.username || 'Linked Record'}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Voter registry association active.</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                        <Check size={11} /> Linked
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
                        <input
                          type="text"
                          value={voterQuery}
                          onChange={(e) => setVoterQuery(e.target.value)}
                          placeholder="Search by Voter Name, EPIC No., or Mobile..."
                          className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200"
                        />
                        {isSearchingVoters && (
                          <Loader2 size={13} className="animate-spin absolute right-3 top-3 text-zinc-400" />
                        )}
                      </div>

                      {voterResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 shadow-md">
                          {voterResults.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => {
                                setEditingUser({
                                  ...editingUser,
                                  voterId: v.voter_id,
                                  voter_id: v.voter_id,
                                  voterDocId: String(v.id),
                                  voter_doc_id: String(v.id),
                                  username: editingUser.username || v.name,
                                });
                                setVoterQuery('');
                                setVoterResults([]);
                              }}
                              className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-white">{v.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                  EPIC: <span className="text-blue-600 font-bold">{v.voter_id}</span> • Mobile: {v.mobile || '—'} • Booth: {v.booth_name || v.booth_number || '—'}
                                </p>
                              </div>
                              <button type="button" className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold">
                                Link
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Organizational Reporting Hierarchy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Network size={14} className="text-zinc-500" />
                        Reporting Admin
                      </label>
                      <select
                        value={editingUser.parentAdminId || editingUser.parent_admin_id || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, parentAdminId: e.target.value, parent_admin_id: e.target.value })}
                        className="webapp-input w-full appearance-none"
                      >
                        <option value="">None (Top-Level / Super Admin)</option>
                        {availableAdmins.map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.username} ({a.email})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-400">Sets the supervisory administrative parent context.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <UserCog size={14} className="text-purple-500" />
                      Reporting Manager
                    </label>
                    <select
                      value={editingUser.parentManagerId || editingUser.parent_manager_id || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, parentManagerId: e.target.value, parent_manager_id: e.target.value })}
                      className="webapp-input w-full appearance-none"
                    >
                      <option value="">None (Reports directly to Admin)</option>
                      {getAvailableManagers(editingUser.parentAdminId || editingUser.parent_admin_id).map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.username} ({m.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-zinc-400">Direct operational manager for Karyakartas.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Assigned Role</label>
                    <select
                      value={editingUser.role}
                      disabled={editingUser.email === OWNER_EMAIL || (!isSuperAdmin && (editingUser.role === 'super_admin' || editingUser.role === 'admin'))}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserData['role'] })}
                      className={`webapp-input w-full appearance-none ${editingUser.email === OWNER_EMAIL || (!isSuperAdmin && (editingUser.role === 'super_admin' || editingUser.role === 'admin')) ? 'opacity-60 cursor-not-allowed grayscale' : ''}`}
                    >
                      {(isSuperAdmin ? ROLES : ROLES.filter(r => r.id !== 'super_admin' && r.id !== 'admin')).map(r => (
                        <option key={r.id} value={r.id}>{r.label}</option>
                      ))}
                    </select>
                    {editingUser.email === OWNER_EMAIL && <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium italic border-l-2 border-blue-500 pl-2 mt-1">Owner account roles cannot be modified for security reasons.</p>}
                    {!isSuperAdmin && (editingUser.role === 'super_admin' || editingUser.role === 'admin') && <p className="text-[10px] text-amber-500 dark:text-amber-400 font-medium italic border-l-2 border-amber-500 pl-2 mt-1">Admin roles can only be altered by Super Admin.</p>}
                  </div>

                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Account Access Status</label>
                    <div className="flex items-center gap-3 pt-1">
                      <button
                        type="button"
                        onClick={() => setEditingUser({ ...editingUser, disabled: false })}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${!editingUser.disabled
                            ? 'bg-emerald-500/15 border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-xs ring-1 ring-emerald-500/30'
                            : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                          }`}
                      >
                        <UserCheck size={14} />
                        Active Access
                      </button>
                      <button
                        type="button"
                        disabled={editingUser.email === OWNER_EMAIL}
                        onClick={() => setEditingUser({ ...editingUser, disabled: true })}
                        className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 ${editingUser.disabled
                            ? 'bg-red-500/15 border-red-500/50 text-red-600 dark:text-red-400 shadow-xs ring-1 ring-red-500/30'
                            : 'bg-zinc-100 dark:bg-zinc-800/80 border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800'
                          }`}
                      >
                        <UserX size={14} />
                        Suspended
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Public Bio & Administrative Notes</label>
                  <textarea
                    rows={3}
                    value={editingUser.bio || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, bio: e.target.value })}
                    className="webapp-input w-full resize-none p-4 text-xs"
                    placeholder="Operational notes, duties, or identity remarks..."
                  />
                </div>
              </motion.div>
            )}

            {activeTab === 'demographics' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-blue-500/10 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-500/20 dark:border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={16} className="text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-900 dark:text-blue-200 font-bold">
                        Election Setting & Regional Scope Configuration
                      </p>
                      <p className="text-[10px] text-blue-700 dark:text-blue-300/90 font-medium">
                        Choose assigned geographical levels. Leave blank for unrestricted Global Admin access.
                      </p>
                    </div>
                  </div>
                  {(selectedEditUserStates.length > 0 || selectedEditUserDistricts.length > 0 || selectedEditUserConstituencies.length > 0 || selectedEditUserBooths.length > 0) && (
                    <button
                      type="button"
                      onClick={handleClearAllDemographics}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap self-start md:self-auto"
                    >
                      Reset to Global Scope
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned State(s)</label>
                      {selectedEditUserStates.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedEditUserStates.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="State"
                      options={availableStates}
                      selectedIds={selectedEditUserStates}
                      onChange={handleEditUserStatesChange}
                      placeholder="Global Control (All States)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned District(s)</label>
                      {selectedEditUserDistricts.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedEditUserDistricts.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="District"
                      options={availableDistricts}
                      selectedIds={selectedEditUserDistricts}
                      onChange={handleEditUserDistrictsChange}
                      placeholder="State-wide Control (All Districts)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned Constituency(s)</label>
                      {selectedEditUserConstituencies.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedEditUserConstituencies.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="Constituency"
                      options={availableConstituencies}
                      selectedIds={selectedEditUserConstituencies}
                      onChange={handleEditUserConstituenciesChange}
                      placeholder="District-wide Control (All)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned Booth(s)</label>
                      {selectedEditUserBooths.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedEditUserBooths.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="Booth"
                      options={availableBooths}
                      selectedIds={selectedEditUserBooths}
                      onChange={handleEditUserBoothsChange}
                      placeholder="Constituency-wide Control (All)"
                    />
                  </div>
                </div>

                {/* Scope Summary Badge Bar */}
                <div className="p-4 bg-zinc-100/70 dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase text-[10px]">Active Scope Summary:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedEditUserStates.length === 0 ? 'All States (Global)' : `${selectedEditUserStates.length} State(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedEditUserDistricts.length === 0 ? 'All Districts' : `${selectedEditUserDistricts.length} District(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedEditUserConstituencies.length === 0 ? 'All Constituencies' : `${selectedEditUserConstituencies.length} Constituency(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedEditUserBooths.length === 0 ? 'All Booths' : `${selectedEditUserBooths.length} Booth(s)`}
                  </span>
                </div>
              </motion.div>
            )}

            {activeTab === 'permissions' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-zinc-100/70 dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-2">
                      Module Permissions Matrix
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                      Configure access across Main Navigation and Administration modules. When access is revoked, modules are hidden from navigation and route access is blocked.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fullRights: Record<string, string> = { ...(editingUser.permissions || {}) };
                        const allPermsString = PERMISSION_TYPES.map(t => t.id).join('');
                        MODULES.forEach(m => {
                          fullRights[m.id] = allPermsString;
                        });
                        setEditingUser({ ...editingUser, permissions: fullRights });
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      Grant All Rights
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const clearedRights: Record<string, string> = { ...(editingUser.permissions || {}) };
                        MODULES.forEach(m => {
                          delete clearedRights[m.id];
                        });
                        setEditingUser({ ...editingUser, permissions: clearedRights });
                      }}
                      className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline whitespace-nowrap"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pr-2">
                  {MODULES.map((module) => {
                    const isAdminModule = ADMIN_MODULE_IDS.includes(module.id);
                    const currentPerms = editingUser.permissions?.[module.id] || '';
                    const allPermsString = PERMISSION_TYPES.map(t => t.id).join('');
                    const isModuleActive = currentPerms.length === allPermsString.length;

                    return (
                      <div
                        key={module.id}
                        className={`p-4 rounded-2xl border transition-all ${isModuleActive
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/25 border-emerald-500/40 dark:border-emerald-500/30'
                            : currentPerms.length > 0
                              ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3.5">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider truncate">{module.label}</h4>
                              <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border shrink-0 ${isAdminModule
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                }`}>
                                {isAdminModule ? 'ADMIN' : 'MAIN'}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{module.description}</p>
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
                            className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${isModuleActive
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs'
                                : currentPerms.length > 0
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                          >
                            {isModuleActive ? 'Full Access' : currentPerms.length > 0 ? 'Custom' : 'Revoked'}
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
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
                                className={`py-1.5 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${isActive
                                    ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500 dark:text-white shadow-xs'
                                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'
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
              className="webapp-button-primary flex items-center gap-2 px-8 min-w-[140px] justify-center shadow-lg"
            >
              {actionLoading === 'updating' ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Apply Settings
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
      </AnimatePresence >

  {/* Add User Modal */ }
  <AnimatePresence>
{
  isAddModalOpen && (
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
        className="relative webapp-card w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col h-[90vh] md:h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900 sticky top-0 z-10 shrink-0">
          <div className="min-w-0">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight truncate">Invite New User</h3>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">Configure Identity, Election Scope & Access Rights</p>
          </div>
          <button onClick={() => setIsAddModalOpen(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Functional Tabs */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-100/60 dark:bg-zinc-950/60 px-4 shrink-0 overflow-x-auto no-scrollbar">
          {[
            { id: 'details', label: 'Identity', icon: Users },
            { id: 'demographics', label: 'Election Setting', icon: Shield },
            { id: 'permissions', label: 'Rights', icon: ShieldCheck },
          ].map((tab: { id: 'details' | 'demographics' | 'permissions'; label: string; icon: React.ElementType }) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setAddActiveTab(tab.id)}
              className={`px-4 py-3 text-xs font-bold flex items-center gap-2 border-b-2 transition-all whitespace-nowrap ${addActiveTab === tab.id
                  ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 shadow-xs'
                  : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-900/40'
                }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleCreateUser} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar flex-1">
            {addActiveTab === 'details' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {/* Linked Voter Registry Selection */}
                <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-500/5 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-blue-900 dark:text-blue-300 flex items-center gap-1.5">
                      <IdCard size={15} className="text-blue-600" />
                      Link from Voter Directory (Optional)
                    </label>
                    {newUser.voterId && (
                      <button
                        type="button"
                        onClick={() => setNewUser({ ...newUser, voterId: '', voterDocId: '' })}
                        className="text-[11px] font-bold text-red-500 hover:underline flex items-center gap-1"
                      >
                        <X size={12} />
                        Unlink
                      </button>
                    )}
                  </div>

                  {newUser.voterId ? (
                    <div className="p-3 bg-white dark:bg-zinc-900 rounded-lg border border-blue-500/30 flex items-center justify-between">
                      <div>
                        <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                          <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{newUser.voterId}</span>
                          <span>•</span>
                          <span>{newUser.username}</span>
                        </div>
                        <p className="text-[10px] text-zinc-500 mt-0.5">Voter details automatically associated.</p>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                        <Check size={11} /> Linked
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
                        <input
                          type="text"
                          value={voterQuery}
                          onChange={(e) => setVoterQuery(e.target.value)}
                          placeholder="Search by Voter Name, EPIC No., or Mobile..."
                          className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-zinc-200"
                        />
                        {isSearchingVoters && (
                          <Loader2 size={13} className="animate-spin absolute right-3 top-3 text-zinc-400" />
                        )}
                      </div>

                      {voterResults.length > 0 && (
                        <div className="max-h-48 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-900 shadow-md">
                          {voterResults.map((v) => (
                            <div
                              key={v.id}
                              onClick={() => {
                                setNewUser({
                                  ...newUser,
                                  voterId: v.voter_id,
                                  voterDocId: String(v.id),
                                  username: newUser.username || v.name,
                                  email: newUser.email || v.email || '',
                                  stateId: newUser.stateId || v.state_id || '',
                                  districtId: newUser.districtId || v.district_id || '',
                                  constituencyId: newUser.constituencyId || v.constituency_id || '',
                                  boothId: newUser.boothId || v.booth_id || '',
                                });
                                setVoterQuery('');
                                setVoterResults([]);
                              }}
                              className="p-2.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 cursor-pointer flex items-center justify-between text-xs transition-colors"
                            >
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-white">{v.name}</p>
                                <p className="text-[10px] text-zinc-500 font-mono">
                                  EPIC: <span className="text-blue-600 font-bold">{v.voter_id}</span> • Mobile: {v.mobile || '—'} • Booth: {v.booth_name || v.booth_number || '—'}
                                </p>
                              </div>
                              <button type="button" className="px-2 py-1 bg-blue-600 text-white rounded text-[10px] font-bold">
                                Choose
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Full Name *</label>
                    <input
                      type="text"
                      required
                      value={newUser.username}
                      onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                      className="webapp-input w-full"
                      placeholder="e.g. Amit Kumar"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">Email Address *</label>
                    <input
                      type="email"
                      required
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="webapp-input w-full"
                      placeholder="user@example.com"
                    />
                  </div>
                </div>

                {/* Organizational Reporting Hierarchy */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isSuperAdmin && (
                    <div className="space-y-2">
                      <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                        <Network size={14} className="text-zinc-500" />
                        Reporting Admin
                      </label>
                      <select
                        value={newUser.parentAdminId}
                        onChange={(e) => setNewUser({ ...newUser, parentAdminId: e.target.value })}
                        className="webapp-input w-full appearance-none"
                      >
                        <option value="">None (Top-Level / Super Admin Context)</option>
                        {availableAdmins.map((a) => (
                          <option key={a.uid} value={a.uid}>
                            {a.username} ({a.email})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-zinc-400">Sets the supervisory administrative parent.</p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="data-label font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
                      <UserCog size={14} className="text-purple-500" />
                      Reporting Manager
                    </label>
                    <select
                      value={newUser.parentManagerId}
                      onChange={(e) => setNewUser({ ...newUser, parentManagerId: e.target.value })}
                      className="webapp-input w-full appearance-none"
                    >
                      <option value="">None (Reports directly to Admin)</option>
                      {getAvailableManagers(newUser.parentAdminId).map((m) => (
                        <option key={m.uid} value={m.uid}>
                          {m.username} ({m.email})
                        </option>
                      ))}
                    </select>
                    <p className="text-[10px] text-zinc-400">Direct operational manager for Karyakartas.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="data-label font-bold text-zinc-700 dark:text-zinc-300">System Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as UserData['role'] })}
                    className="webapp-input w-full appearance-none"
                  >
                    {(isSuperAdmin ? ROLES : ROLES.filter(r => r.id !== 'super_admin' && r.id !== 'admin')).map(r => (
                      <option key={r.id} value={r.id}>{r.label}</option>
                    ))}
                  </select>
                  {!isSuperAdmin && (
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium italic border-l-2 border-blue-500 pl-2 mt-1">
                      Admins can recruit Karyakartas, Managers, and Guests.
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            {addActiveTab === 'demographics' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-blue-500/10 dark:bg-blue-950/40 p-4 rounded-xl border border-blue-500/20 dark:border-blue-800/60 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <CheckCircle size={16} className="text-blue-500 shrink-0" />
                    <div>
                      <p className="text-xs text-blue-900 dark:text-blue-200 font-bold">
                        Election Setting & Regional Scope Configuration
                      </p>
                      <p className="text-[10px] text-blue-700 dark:text-blue-300/90 font-medium">
                        Choose assigned geographical levels. Leave blank for unrestricted scope.
                      </p>
                    </div>
                  </div>
                  {(selectedNewUserStates.length > 0 || selectedNewUserDistricts.length > 0 || selectedNewUserConstituencies.length > 0 || selectedNewUserBooths.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setNewUser({ ...newUser, stateId: '', districtId: '', constituencyId: '', boothId: '' })}
                      className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap self-start md:self-auto"
                    >
                      Reset to Global Scope
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned State(s)</label>
                      {selectedNewUserStates.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedNewUserStates.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="State"
                      options={availableStates}
                      selectedIds={selectedNewUserStates}
                      onChange={(ids) => setNewUser({ ...newUser, stateId: ids.join(',') })}
                      placeholder="Global Control (All States)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned District(s)</label>
                      {selectedNewUserDistricts.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedNewUserDistricts.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="District"
                      options={availableNewDistricts}
                      selectedIds={selectedNewUserDistricts}
                      onChange={(ids) => setNewUser({ ...newUser, districtId: ids.join(',') })}
                      placeholder="State-wide Control (All Districts)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned Constituency(s)</label>
                      {selectedNewUserConstituencies.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedNewUserConstituencies.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="Constituency"
                      options={availableNewConstituencies}
                      selectedIds={selectedNewUserConstituencies}
                      onChange={(ids) => setNewUser({ ...newUser, constituencyId: ids.join(',') })}
                      placeholder="District-wide Control (All)"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Assigned Booth(s)</label>
                      {selectedNewUserBooths.length > 0 && (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400">{selectedNewUserBooths.length} chosen</span>
                      )}
                    </div>
                    <MultiSelectDropdown
                      label="Booth"
                      options={availableNewBooths}
                      selectedIds={selectedNewUserBooths}
                      onChange={(ids) => setNewUser({ ...newUser, boothId: ids.join(',') })}
                      placeholder="Constituency-wide Control (All)"
                    />
                  </div>
                </div>

                {/* Scope Summary Badge Bar */}
                <div className="p-4 bg-zinc-100/70 dark:bg-zinc-900/80 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold text-zinc-500 dark:text-zinc-400 uppercase text-[10px]">Active Scope Summary:</span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedNewUserStates.length === 0 ? 'All States (Global)' : `${selectedNewUserStates.length} State(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedNewUserDistricts.length === 0 ? 'All Districts' : `${selectedNewUserDistricts.length} District(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedNewUserConstituencies.length === 0 ? 'All Constituencies' : `${selectedNewUserConstituencies.length} Constituency(s)`}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 font-semibold text-zinc-700 dark:text-zinc-200 shadow-xs">
                    {selectedNewUserBooths.length === 0 ? 'All Booths' : `${selectedNewUserBooths.length} Booth(s)`}
                  </span>
                </div>
              </motion.div>
            )}

            {addActiveTab === 'permissions' && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
                <div className="bg-zinc-100/70 dark:bg-zinc-900/80 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div>
                    <p className="text-xs text-zinc-900 dark:text-zinc-100 font-bold flex items-center gap-2">
                      Module Permissions Matrix
                    </p>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                      Configure access across Main Navigation and Administration modules. When access is revoked, modules are hidden from navigation and route access is blocked.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const fullRights: Record<string, string> = { ...(newUser.permissions || {}) };
                        const allPermsString = PERMISSION_TYPES.map(t => t.id).join('');
                        MODULES.forEach(m => {
                          fullRights[m.id] = allPermsString;
                        });
                        setNewUser({ ...newUser, permissions: fullRights });
                      }}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline whitespace-nowrap"
                    >
                      Grant All Rights
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">•</span>
                    <button
                      type="button"
                      onClick={() => {
                        const clearedRights: Record<string, string> = { ...(newUser.permissions || {}) };
                        MODULES.forEach(m => {
                          delete clearedRights[m.id];
                        });
                        setNewUser({ ...newUser, permissions: clearedRights });
                      }}
                      className="text-xs font-bold text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline whitespace-nowrap"
                    >
                      Revoke All
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pr-2">
                  {MODULES.map((module) => {
                    const isAdminModule = ADMIN_MODULE_IDS.includes(module.id);
                    const currentPerms = newUser.permissions?.[module.id] || '';
                    const allPermsString = PERMISSION_TYPES.map(t => t.id).join('');
                    const isModuleActive = currentPerms.length === allPermsString.length;

                    return (
                      <div
                        key={module.id}
                        className={`p-4 rounded-2xl border transition-all ${isModuleActive
                            ? 'bg-emerald-500/10 dark:bg-emerald-950/25 border-emerald-500/40 dark:border-emerald-500/30'
                            : currentPerms.length > 0
                              ? 'bg-blue-500/5 dark:bg-blue-950/20 border-blue-500/30'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                          }`}
                      >
                        <div className="flex items-center justify-between mb-3.5">
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-1.5">
                              <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider truncate">{module.label}</h4>
                              <span className={`text-[8px] font-black px-1.5 py-0.2 rounded border shrink-0 ${isAdminModule
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
                                }`}>
                                {isAdminModule ? 'ADMIN' : 'MAIN'}
                              </span>
                            </div>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{module.description}</p>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              const perms = newUser.permissions || {};
                              setNewUser({
                                ...newUser,
                                permissions: { ...perms, [module.id]: isModuleActive ? '' : allPermsString }
                              });
                            }}
                            className={`text-[9px] font-black uppercase px-2.5 py-1 rounded-lg transition-colors whitespace-nowrap ${isModuleActive
                                ? 'bg-emerald-600 dark:bg-emerald-500 text-white shadow-xs'
                                : currentPerms.length > 0
                                  ? 'bg-blue-600 text-white shadow-xs'
                                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                              }`}
                          >
                            {isModuleActive ? 'Full Access' : currentPerms.length > 0 ? 'Custom' : 'Revoked'}
                          </button>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
                          {PERMISSION_TYPES.map((type) => {
                            const isActive = currentPerms.includes(type.id);
                            return (
                              <button
                                key={type.id}
                                type="button"
                                onClick={() => {
                                  const perms = newUser.permissions || {};
                                  const oldVal = perms[module.id] || '';
                                  const newVal = oldVal.includes(type.id)
                                    ? oldVal.replace(type.id, '')
                                    : (oldVal + type.id);
                                  const sortedNewVal = PERMISSION_TYPES.map(t => t.id).filter(tid => newVal.includes(tid)).join('');
                                  setNewUser({
                                    ...newUser,
                                    permissions: { ...perms, [module.id]: sortedNewVal }
                                  });
                                }}
                                className={`py-1.5 rounded-lg text-[10px] font-black border transition-all flex items-center justify-center ${isActive
                                    ? 'bg-blue-600 border-blue-600 text-white dark:bg-blue-600 dark:border-blue-500 dark:text-white shadow-xs'
                                    : 'bg-zinc-50 dark:bg-zinc-800/60 border-zinc-200/80 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400 hover:border-zinc-300 dark:hover:border-zinc-600 hover:text-zinc-800 dark:hover:text-zinc-200'
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

          <div className="p-6 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3 shrink-0 sticky bottom-0 z-10">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="webapp-button-secondary text-xs"
            >
              Discard
            </button>
            <button
              type="submit"
              disabled={actionLoading === 'creating'}
              className="webapp-button-primary flex items-center gap-2 px-8 min-w-[140px] justify-center shadow-lg"
            >
              {actionLoading === 'creating' ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Generate Invitation
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
      </AnimatePresence >

  {/* Generated Invite Link Modal */ }
  <AnimatePresence>
{
  createdInviteInfo && (
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
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Share this link with {createdInviteInfo.name}</p>
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
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{createdInviteInfo.email}</p>
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
                className="webapp-input w-full text-xs font-mono select-all bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdInviteInfo.inviteLink);
                  setCopiedLink(true);
                  setTimeout(() => setCopiedLink(false), 2500);
                }}
                className={`px-3 py-2 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all ${copiedLink
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
  )
}
      </AnimatePresence >
    </div >
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

  const stringSelectedIds = selectedIds.map(normalizeId).filter(Boolean);

  const filteredOptions = options.filter(opt =>
    opt.name.toLowerCase().includes(search.toLowerCase()) ||
    (opt.detail && opt.detail.toLowerCase().includes(search.toLowerCase()))
  );

  const toggleOption = (id: string) => {
    const targetId = normalizeId(id);
    if (stringSelectedIds.includes(targetId)) {
      onChange(stringSelectedIds.filter(x => x !== targetId));
    } else {
      onChange([...stringSelectedIds, targetId]);
    }
  };

  const selectedOptions = options.filter(opt => stringSelectedIds.includes(normalizeId(opt.id)));
  const selectedNames = selectedOptions.map(opt => opt.name);

  let buttonText = placeholder;
  if (stringSelectedIds.length > 0) {
    if (stringSelectedIds.length === options.length && options.length > 0) {
      buttonText = `All ${options.length} ${label}s Selected`;
    } else if (selectedNames.length > 0) {
      buttonText = `(${stringSelectedIds.length}) ${selectedNames.slice(0, 2).join(', ')}${selectedNames.length > 2 ? ` +${selectedNames.length - 2} more` : ''}`;
    } else {
      buttonText = `${stringSelectedIds.length} ${label}(s) Selected`;
    }
  }

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className="webapp-input w-full flex items-center justify-between text-left py-2 px-3 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 disabled:opacity-50 disabled:cursor-not-allowed select-none min-h-[40px] shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
      >
        <div className="flex items-center gap-2 truncate pr-2">
          {stringSelectedIds.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[10px] font-black flex items-center justify-center shrink-0">
              {stringSelectedIds.length}
            </span>
          )}
          <span className={`truncate font-semibold ${stringSelectedIds.length > 0 ? 'text-zinc-900 dark:text-zinc-100' : 'text-zinc-400 dark:text-zinc-500'}`}>
            {buttonText}
          </span>
        </div>
        <span className="text-[9px] text-zinc-400 dark:text-zinc-500 font-bold shrink-0">
          {isOpen ? '▲' : '▼'}
        </span>
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col">
          {/* Search bar */}
          <div className="p-2.5 border-b border-zinc-100 dark:border-zinc-800 flex gap-2 shrink-0 bg-zinc-50 dark:bg-zinc-950">
            <input
              type="text"
              placeholder={`Search ${label}... (${options.length} total)`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="webapp-input w-full py-1.5 px-3 text-xs rounded-lg"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          </div>

          {/* Action buttons */}
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/50 shrink-0 text-xs font-bold">
            <button
              type="button"
              onClick={() => onChange(options.map(o => normalizeId(o.id)))}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
            >
              Select All ({options.length})
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:underline"
            >
              Clear
            </button>
          </div>

          {/* List of checkboxes */}
          <div className="overflow-y-auto flex-1 max-h-48 custom-scrollbar divide-y divide-zinc-100 dark:divide-zinc-800/50">
            {filteredOptions.length === 0 ? (
              <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-500 italic">
                No matching {label.toLowerCase()}s found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = stringSelectedIds.includes(normalizeId(opt.id));
                return (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 py-2.5 px-4 hover:bg-blue-50/80 dark:hover:bg-blue-900/20 cursor-pointer text-xs select-none transition-colors ${isChecked ? 'bg-blue-50/60 dark:bg-blue-900/25 text-blue-900 dark:text-blue-200' : 'text-zinc-700 dark:text-zinc-300'
                      }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(normalizeId(opt.id))}
                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-zinc-300 dark:border-zinc-700 dark:bg-zinc-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="truncate font-semibold text-zinc-900 dark:text-zinc-100">
                        {opt.name}
                      </p>
                      {opt.detail && (
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
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

