import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  MapPin, 
  X, 
  Save, 
  Layers, 
  Phone, 
  User, 
  AlertCircle, 
  Inbox,
  Users,
  ChevronRight,
  ArrowLeft,
  Shield,
  Award,
  Briefcase,
  Globe,
  SlidersHorizontal,
  UserCheck,
  Star,
  Network,
  Building2,
  LayoutGrid,
  List,
  ExternalLink,
  FolderPlus,
  Flag,
  Heart,
  Megaphone,
  Sparkles,
  Check,
  Lock,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { handleFirestoreError, OperationType } from '../lib/errorHandling';

// Local TypeScript interfaces
interface Mandal {
  id: string;
  name: string;
  mandalCode: string;
  presidentName?: string;
  presidentPhone?: string;
  voterCount?: number;
  realVoterCount?: number;
  boothCount?: number;
  memberCount?: number;
  committeeCount?: number;
  population?: number;
  stateId: string;
  stateName?: string;
  districtId: string;
  districtName?: string;
  constituencyId: string;
  constituencyName?: string;
  adminId?: string;
  admin_id?: string;
  adminName?: string;
  admin_name?: string;
  adminEmail?: string;
  admin_email?: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

interface MandalMember {
  id: string;
  name: string;
  phone?: string;
  categoryKey: string;
  voterId?: string;
  designation?: string;
  adminId?: string;
  admin_id?: string;
  createdAt: unknown;
  updatedAt?: unknown;
}

interface Voter {
  id: string;
  voterId: string;
  name: string;
  mobile?: string;
  relationName?: string;
  gender?: string;
  age?: number;
  boothId?: string;
}

interface StateData {
  id: string;
  name: string;
}

interface DistrictData {
  id: string;
  name: string;
  stateId: string;
}

interface ConstituencyData {
  id: string;
  name: string;
  stateId: string;
  districtId: string;
}

interface Volunteer {
  id: string;
  name: string;
  mobile: string;
  voterId?: string;
  voter_id?: string;
  adminId: string;
  admin_id?: string;
  status?: string;
  assignedBoothId?: string;
  assignedBoothName?: string;
  assignedBoothNumber?: string;
  village?: string;
  performanceRating?: number;
}

export interface MandalDirectory {
  id: string;
  mandalId: string;
  adminId: string;
  categoryKey: string;
  label: string;
  englishLabel: string;
  targetCount: number;
  icon?: string;
  colorClass?: string;
  isCustom?: boolean;
}

// Icon choices for directories
export const DIRECTORY_ICON_CHOICES = [
  { name: 'Users', label: 'Users / Members', icon: Users },
  { name: 'Shield', label: 'Shield / Office Bearers', icon: Shield },
  { name: 'Award', label: 'Award / Leadership', icon: Award },
  { name: 'Briefcase', label: 'Briefcase / Coordinator', icon: Briefcase },
  { name: 'Globe', label: 'Globe / Regional', icon: Globe },
  { name: 'SlidersHorizontal', label: 'Sliders / Cells & Convenors', icon: SlidersHorizontal },
  { name: 'UserCheck', label: 'UserCheck / Representatives', icon: UserCheck },
  { name: 'Star', label: 'Star / Special Wing', icon: Star },
  { name: 'Heart', label: 'Heart / Welfare Wing', icon: Heart },
  { name: 'Megaphone', label: 'Megaphone / Publicity', icon: Megaphone },
  { name: 'Flag', label: 'Flag / Morcha', icon: Flag },
  { name: 'Building2', label: 'Building / Urban Unit', icon: Building2 },
  { name: 'MapPin', label: 'MapPin / Village Center', icon: MapPin },
  { name: 'Layers', label: 'Layers / Executive', icon: Layers },
  { name: 'Sparkles', label: 'Sparkles / Youth & IT', icon: Sparkles }
];

export const resolveDirectoryIcon = (name?: string) => {
  if (!name) return Users;
  const found = DIRECTORY_ICON_CHOICES.find(ic => ic.name.toLowerCase() === name.toLowerCase());
  if (found) return found.icon;
  if (name.includes('Shield')) return Shield;
  if (name.includes('Award')) return Award;
  if (name.includes('Briefcase')) return Briefcase;
  if (name.includes('Globe')) return Globe;
  if (name.includes('Sliders')) return SlidersHorizontal;
  if (name.includes('UserCheck')) return UserCheck;
  if (name.includes('MapPin')) return MapPin;
  if (name.includes('Layers')) return Layers;
  return Users;
};

// Color presets for custom directories
export const DIRECTORY_COLOR_PRESETS = [
  { label: 'Blue', value: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20', dotClass: 'bg-blue-500' },
  { label: 'Amber', value: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20', dotClass: 'bg-amber-500' },
  { label: 'Emerald', value: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20', dotClass: 'bg-emerald-500' },
  { label: 'Purple', value: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20', dotClass: 'bg-purple-500' },
  { label: 'Rose', value: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20', dotClass: 'bg-rose-500' },
  { label: 'Indigo', value: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20', dotClass: 'bg-indigo-500' },
  { label: 'Teal', value: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20', dotClass: 'bg-teal-500' },
  { label: 'Orange', value: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20', dotClass: 'bg-orange-500' },
  { label: 'Cyan', value: 'text-cyan-500 bg-cyan-50 dark:bg-cyan-950/20', dotClass: 'bg-cyan-500' },
];

export const DESIGNATION_PRESETS = [
  'अध्यक्ष (President)',
  'उपाध्यक्ष (Vice President)',
  'महामंत्री (General Secretary)',
  'संयोजक (Convenor)',
  'सह-संयोजक (Co-Convenor)',
  'प्रभारी (In-charge)',
  'कोषाध्यक्ष (Treasurer)',
  'कार्यसमिति सदस्य (Executive Member)'
];

// Design-approved 8 categories matching the uploaded document
const MANDAL_CATEGORIES = [
  {
    key: 'office_bearers',
    label: 'मण्डल पदाधिकारी व कार्यसमिति सदस्य',
    englishLabel: 'Mandal Office Bearers & Executive Committee Members',
    targetCount: 45,
    icon: Shield,
    colorClass: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20'
  },
  {
    key: 'morcha_leaders',
    label: 'मोर्चा के अध्यक्ष व महामंत्री',
    englishLabel: 'Morcha Presidents & General Secretaries',
    targetCount: 21,
    icon: Award,
    colorClass: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20'
  },
  {
    key: 'district_representatives',
    label: 'मण्डल से जिला में पदाधिकारी व कार्यसमिति सदस्य',
    englishLabel: 'Mandal to District Office Bearers & Executive Members',
    targetCount: 8,
    icon: Layers,
    colorClass: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20'
  },
  {
    key: 'morcha_coordinators',
    label: 'मण्डल से जिला में मोर्चों में व प्रकोष्ठ में संयोजक / सह-संयोजक',
    englishLabel: 'Convenor / Co-convenor in Morchas & Cells (Mandal to District)',
    targetCount: 10,
    icon: Briefcase,
    colorClass: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20'
  },
  {
    key: 'state_representatives',
    label: 'मण्डल से प्रदेश भाजपा, मोर्चा एवं प्रकोष्ठ',
    englishLabel: 'Mandal to State BJP, Morcha & Cells',
    targetCount: 10,
    icon: Globe,
    colorClass: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20'
  },
  {
    key: 'cell_convenors',
    label: 'सभी प्रकोष्ठों के संयोजक',
    englishLabel: 'Convenors of all Cells',
    targetCount: 17,
    icon: SlidersHorizontal,
    colorClass: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
  },
  {
    key: 'former_representatives',
    label: 'चुने हुए पूर्व प्रतिनिधि',
    englishLabel: 'Elected Former Representatives',
    targetCount: 20,
    icon: UserCheck,
    colorClass: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20'
  },
  {
    key: 'gram_kendra_pramukh',
    label: 'ग्राम केन्द्र प्रमुख',
    englishLabel: 'Gram Kendra Pramukh (Village Center Chiefs)',
    targetCount: 15,
    icon: MapPin,
    colorClass: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20'
  }
];

export const CORE_KEYS = [
  'office_bearers',
  'morcha_leaders',
  'district_representatives',
  'morcha_coordinators',
  'state_representatives',
  'cell_convenors',
  'former_representatives',
  'gram_kendra_pramukh'
];

export const DEFAULT_DIRECTORIES: MandalDirectory[] = MANDAL_CATEGORIES.map(c => ({
  id: `core_${c.key}`,
  mandalId: '',
  adminId: 'default',
  categoryKey: c.key,
  label: c.label,
  englishLabel: c.englishLabel,
  targetCount: c.targetCount,
  icon: c.key === 'cell_convenors' ? 'SlidersHorizontal' : (c.key === 'former_representatives' ? 'UserCheck' : (c.key === 'district_representatives' ? 'Layers' : (c.key === 'morcha_coordinators' ? 'Briefcase' : (c.key === 'state_representatives' ? 'Globe' : (c.key === 'gram_kendra_pramukh' ? 'MapPin' : (c.key === 'morcha_leaders' ? 'Award' : 'Shield')))))),
  colorClass: c.colorClass,
  isCustom: false
}));

export default function MandalManagement() {
  const { user, isSuperAdmin, isAdmin, profile, hasPermission } = useAuth();

  // Permission rights check - superadmin, admin, and user all have full CRUD access
  const isAuthorized = isSuperAdmin || isAdmin || profile?.role === 'user' || !!user;
  const canView = isAuthorized || hasPermission('mandals', 'v');
  const canCreate = isAuthorized || hasPermission('mandals', 'c');
  const canUpdate = isAuthorized || hasPermission('mandals', 'u');
  const canDelete = isAuthorized || hasPermission('mandals', 'd');

  // Component states
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [states, setStates] = useState<StateData[]>([]);
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [constituencies, setConstituencies] = useState<ConstituencyData[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [adminFilter, setAdminFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterConstituency, setFilterConstituency] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');

  // Modal / Form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingId, setEditingId] = useState('');
  
  // Mandal Form fields
  const [name, setName] = useState('');
  const [mandalCode, setMandalCode] = useState('');
  const [presidentName, setPresidentName] = useState('');
  const [presidentPhone, setPresidentPhone] = useState('');
  const [voterCount, setVoterCount] = useState<number | ''>('');
  const [population, setPopulation] = useState<number | ''>('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [selectedConstituency, setSelectedConstituency] = useState('');
  const [selectedVolunteerId, setSelectedVolunteerId] = useState('custom');
  const [formAdminId, setFormAdminId] = useState<string>('');

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState('');

  // Mandal Voters Modal state
  const [selectedMandalForVoters, setSelectedMandalForVoters] = useState<Mandal | null>(null);
  const [mandalVoters, setMandalVoters] = useState<any[]>([]);
  const [loadingMandalVoters, setLoadingMandalVoters] = useState(false);
  const [mandalVoterSearch, setMandalVoterSearch] = useState('');
  const [mandalVoterFilter, setMandalVoterFilter] = useState<'all' | 'karyakarta' | 'beneficiary' | 'voted'>('all');

  const openMandalVoters = async (mandal: Mandal) => {
    setSelectedMandalForVoters(mandal);
    setLoadingMandalVoters(true);
    setMandalVoterSearch('');
    setMandalVoterFilter('all');
    try {
      const res = await api.get<any>(`/api/voters?mandalId=${encodeURIComponent(mandal.id)}&limit=500`);
      const raw = Array.isArray(res) ? res : (res?.data || []);
      setMandalVoters(raw);
    } catch (err) {
      console.error('Failed to load mandal voters:', err);
      setMandalVoters([]);
    } finally {
      setLoadingMandalVoters(false);
    }
  };

  // --- MEMBER/LIST MANAGEMENT STATES ---
  const [selectedMandalForMembers, setSelectedMandalForMembers] = useState<Mandal | null>(null);
  const [members, setMembers] = useState<MandalMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MandalMember | null>(null);
  
  // Custom & Core Directories State
  const [customDirectories, setCustomDirectories] = useState<MandalDirectory[]>(DEFAULT_DIRECTORIES);
  const [customDirsLoading, setCustomDirsLoading] = useState(false);
  const [directoryFilterTab, setDirectoryFilterTab] = useState<'all' | 'core' | 'custom'>('all');
  const [isDirModalOpen, setIsDirModalOpen] = useState(false);
  const [editingDir, setEditingDir] = useState<MandalDirectory | null>(null);
  const [dirFormLabel, setDirFormLabel] = useState('');
  const [dirFormEnglishLabel, setDirFormEnglishLabel] = useState('');
  const [dirFormTargetCount, setDirFormTargetCount] = useState<number | ''>(15);
  const [dirFormIcon, setDirFormIcon] = useState('Users');
  const [dirFormColor, setDirFormColor] = useState('text-blue-500 bg-blue-50 dark:bg-blue-950/20');

  // Permission rights check - superadmin, admin, and user all have full CRUD access on directory lists
  const canManageDirectories = isAuthorized || canUpdate || canCreate;

  // Member Form fields
  const [memberFormCategory, setMemberFormCategory] = useState('');
  const [memberFormName, setMemberFormName] = useState('');
  const [memberFormPhone, setMemberFormPhone] = useState('');
  const [memberFormVoterId, setMemberFormVoterId] = useState('');
  const [memberFormDesignation, setMemberFormDesignation] = useState('');
  
  // Member modal mode: Karyakarta Link, Voter Link, or Manual Entry
  const [memberModalTab, setMemberModalTab] = useState<'karyakarta' | 'voter' | 'manual'>('karyakarta');
  const [karyakartaSearchText, setKaryakartaSearchText] = useState('');
  const [selectedKaryakartaForLink, setSelectedKaryakartaForLink] = useState<Volunteer | null>(null);
  const [directoryMemberSearch, setDirectoryMemberSearch] = useState('');
  const [directoryMemberFilter, setDirectoryMemberFilter] = useState<'all' | 'karyakarta' | 'other'>('all');

  // Voter list linkage search fields
  const [isVoterSearchOpen, setIsVoterSearchOpen] = useState(false);
  const [constituencyVoters, setConstituencyVoters] = useState<Voter[]>([]);
  const [voterSearching, setVoterSearching] = useState(false);
  const [voterSearchText, setVoterSearchText] = useState('');
  const [selectedVoterForLink, setSelectedVoterForLink] = useState<Voter | null>(null);

  // Active expanded list key in members detail view
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>('office_bearers');

  // Dynamic directory categories for this mandal
  const allCategories = useMemo(() => {
    const list = customDirectories.length > 0 ? customDirectories : DEFAULT_DIRECTORIES;
    return list.map(cd => ({
      key: cd.categoryKey,
      label: cd.label,
      englishLabel: cd.englishLabel,
      targetCount: cd.targetCount,
      icon: resolveDirectoryIcon(cd.icon),
      iconName: cd.icon || 'Users',
      colorClass: cd.colorClass || 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
      isCustom: cd.isCustom !== undefined ? cd.isCustom : !CORE_KEYS.includes(cd.categoryKey),
      id: cd.id,
      adminId: cd.adminId,
      rawDir: cd
    }));
  }, [customDirectories]);

  // Dynamic total target quota across all directories
  const totalTargetQuota = useMemo(() => {
    return allCategories.reduce((sum, c) => sum + (Number(c.targetCount) || 0), 0);
  }, [allCategories]);

  // Overall completion percentage
  const completionRate = useMemo(() => {
    if (totalTargetQuota === 0) return 0;
    return Math.min(100, Math.round((members.length / totalTargetQuota) * 100));
  }, [members.length, totalTargetQuota]);

  // Helper: check if a member is an active karyakarta
  const isMemberKaryakarta = (member: MandalMember) => {
    return volunteers.some(v => 
      (v.voterId && member.voterId && v.voterId.trim().toLowerCase() === member.voterId.trim().toLowerCase()) ||
      (v.mobile && member.phone && v.mobile.replace(/\D/g, '') === member.phone.replace(/\D/g, '') && v.mobile.length >= 10) ||
      (v.name && member.name && v.name.trim().toLowerCase() === member.name.trim().toLowerCase())
    );
  };

  // Load admins list for Super Admin
  useEffect(() => {
    if (!user) return;
    if (isSuperAdmin) {
      api.get<any[]>('/api/admin/hierarchy?all=true')
        .then(res => {
          const list = Array.isArray(res) ? res : ((res as any)?.results || []);
          const admList = list.map((item: any) => item.admin || item).filter(Boolean);
          if (admList.length > 0) {
            setAdmins(admList);
          } else {
            api.get<any[]>('/api/users').then(users => {
              setAdmins(Array.isArray(users) ? users.filter((u: any) => u.role === 'admin' || u.role === 'super_admin') : []);
            }).catch(() => {});
          }
        })
        .catch(() => {
          api.get<any[]>('/api/users').then(users => {
            setAdmins(Array.isArray(users) ? users.filter((u: any) => u.role === 'admin' || u.role === 'super_admin') : []);
          }).catch(() => {});
        });
    }
  }, [user, isSuperAdmin]);

  // Helper to resolve human-readable Admin name
  const getAdminName = (admId?: string, admName?: string, admEmail?: string) => {
    if (admName && !admName.startsWith('usr_') && !admName.startsWith('admin_')) return admName;
    const found = admins.find(a => String(a.id || a.uid) === String(admId) || a.email === admEmail || a.email === admId);
    if (found) return found.name || found.username || found.email?.split('@')[0];
    if (admEmail) return admEmail.split('@')[0];
    if (admId) return admId.length > 12 ? `${admId.slice(0, 10)}...` : admId;
    return 'Campaign Admin';
  };

  // Helper to resolve real-time committee count for any Mandal (localStorage + DB sync)
  const getMandalCommitteeCount = (mandal: Mandal) => {
    try {
      const cached = localStorage.getItem(`mandal_custom_dirs_${mandal.id}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length >= 0) return parsed.length;
      }
    } catch {}
    return Number(mandal.committeeCount !== undefined && mandal.committeeCount !== null ? mandal.committeeCount : 8);
  };

  // Fetch initial configuration / metadata
  useEffect(() => {
    const loadStaticData = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Fetch States
        const statesList = await api.get<any[]>('/api/states').catch(() => []);
        setStates(statesList.map(s => ({ ...s, id: String(s.id) })));

        // 2. Fetch Districts
        const districtsList = await api.get<any[]>('/api/districts').catch(() => []);
        setDistricts(districtsList.map(d => ({ ...d, id: String(d.id), stateId: String(d.state_id || d.stateId || '') })));

        // 3. Fetch Constituencies
        const constituenciesList = await api.get<any[]>('/api/constituencies').catch(() => []);
        setConstituencies(constituenciesList.map(c => ({ 
          ...c, 
          id: String(c.id), 
          stateId: String(c.state_id || c.stateId || ''), 
          districtId: String(c.district_id || c.districtId || '') 
        })));
      } catch (err) {
        console.error('Error loading metadata:', err);
        setError('Failed to load demographic metadata.');
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      loadStaticData();
    }
  }, [user, isAdmin]);

  // Load volunteers/karyakartas for President assignment (scoped to active admin)
  useEffect(() => {
    if (!user) return;
    const loadVolunteers = async () => {
      try {
        const url = adminFilter !== 'All' ? `/api/volunteers?adminId=${adminFilter}` : '/api/volunteers';
        const volList = await api.get<any[]>(url).catch(() => []);
        setVolunteers(volList.map((v: any) => ({
          ...v,
          id: String(v.id),
          voterId: v.voter_id || v.voterId || '',
          adminId: v.admin_id || v.adminId || '',
          assignedBoothName: v.assigned_booth_name || v.assignedBoothName || '',
          assignedBoothNumber: v.assigned_booth_number || v.assignedBoothNumber || '',
          village: v.village || '',
          status: v.status || 'Active'
        })));
      } catch (e) {
        console.error('Error loading volunteers for mandals:', e);
      }
    };
    loadVolunteers();
  }, [user, adminFilter]);

  // Fetch Directories for selected Mandal (Visible across the mandal to all users)
  const fetchCustomDirectories = async (mandalId: string) => {
    try {
      setCustomDirsLoading(true);
      const storageKey = `mandal_custom_dirs_${mandalId}`;
      
      let localCached: MandalDirectory[] = [];
      const rawCached = localStorage.getItem(storageKey);
      if (rawCached) {
        try {
          localCached = JSON.parse(rawCached);
          if (Array.isArray(localCached) && localCached.length > 0) {
            setCustomDirectories(localCached);
          }
        } catch {}
      } else {
        setCustomDirectories(DEFAULT_DIRECTORIES);
      }

      try {
        const apiDirs = await api.get<any[]>(`/api/mandals/${mandalId}/directories`);
        if (Array.isArray(apiDirs) && apiDirs.length > 0) {
          const mapped: MandalDirectory[] = apiDirs.map((d: any) => ({
            id: String(d.id),
            mandalId: String(d.mandal_id || d.mandalId || mandalId),
            adminId: String(d.admin_id || d.adminId || 'default'),
            categoryKey: d.category_key || d.categoryKey,
            label: d.label,
            englishLabel: d.english_label || d.englishLabel || d.label,
            targetCount: Number(d.target_count || d.targetCount || 10),
            icon: d.icon || 'Users',
            colorClass: d.color_class || d.colorClass || 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
            isCustom: d.is_custom !== undefined ? Boolean(d.is_custom) : !CORE_KEYS.includes(d.category_key || d.categoryKey)
          }));
          setCustomDirectories(mapped);
          localStorage.setItem(storageKey, JSON.stringify(mapped));
          setMandals(mPrev => mPrev.map(m => m.id === mandalId ? { ...m, committeeCount: mapped.length } : m));
          return;
        }
      } catch (e) {
        // Cached version in localCached is active
      }
    } catch (err) {
      console.error('Error in fetchCustomDirectories:', err);
    } finally {
      setCustomDirsLoading(false);
    }
  };

  // Open directory modal
  const openDirModal = (dir?: MandalDirectory) => {
    if (dir) {
      setEditingDir(dir);
      setDirFormLabel(dir.label);
      setDirFormEnglishLabel(dir.englishLabel);
      setDirFormTargetCount(dir.targetCount);
      setDirFormIcon(dir.icon || 'Users');
      setDirFormColor(dir.colorClass || 'text-blue-500 bg-blue-50 dark:bg-blue-950/20');
    } else {
      setEditingDir(null);
      setDirFormLabel('');
      setDirFormEnglishLabel('');
      setDirFormTargetCount(15);
      setDirFormIcon('Users');
      setDirFormColor('text-blue-500 bg-blue-50 dark:bg-blue-950/20');
    }
    setIsDirModalOpen(true);
  };

  // Save directory (persists to backend & localStorage fallback)
  const handleSaveDirectory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMandalForMembers) return;
    if (!dirFormLabel.trim()) {
      setError('Directory title is required.');
      return;
    }

    const effectiveAdmin = selectedMandalForMembers.adminId || user?.uid || profile?.adminId || 'default';
    const targetCountNum = Number(dirFormTargetCount) || 10;
    const storageKey = `mandal_custom_dirs_${selectedMandalForMembers.id}`;

    try {
      setError('');
      setSuccess('');

      if (editingDir) {
        const payload = {
          id: editingDir.id,
          mandal_id: selectedMandalForMembers.id,
          category_key: editingDir.categoryKey,
          label: dirFormLabel.trim(),
          english_label: dirFormEnglishLabel.trim() || dirFormLabel.trim(),
          target_count: targetCountNum,
          icon: dirFormIcon,
          color_class: dirFormColor,
          admin_id: effectiveAdmin
        };

        try {
          await api.put(`/api/mandals/directories/${editingDir.id}`, payload);
        } catch (err) {
          try {
            await api.post(`/api/mandals/${selectedMandalForMembers.id}/directories`, payload);
          } catch (e) {
            console.warn('API directory update fallback:', e);
          }
        }

        setCustomDirectories(prev => {
          const baseList = prev.length > 0 ? prev : DEFAULT_DIRECTORIES;
          const exists = baseList.some(d => d.id === editingDir.id || d.categoryKey === editingDir.categoryKey);
          let updated: MandalDirectory[];
          if (exists) {
            updated = baseList.map(d => (d.id === editingDir.id || d.categoryKey === editingDir.categoryKey) ? {
              ...d,
              label: payload.label,
              englishLabel: payload.english_label,
              targetCount: targetCountNum,
              icon: payload.icon,
              colorClass: payload.color_class
            } : d);
          } else {
            updated = [...baseList, {
              id: editingDir.id,
              mandalId: selectedMandalForMembers.id,
              adminId: effectiveAdmin,
              categoryKey: editingDir.categoryKey,
              label: payload.label,
              englishLabel: payload.english_label,
              targetCount: targetCountNum,
              icon: payload.icon,
              colorClass: payload.color_class,
              isCustom: editingDir.isCustom
            }];
          }
          localStorage.setItem(storageKey, JSON.stringify(updated));
          return updated;
        });

        setSuccess(`Directory "${payload.label}" updated successfully.`);
      } else {
        const catKey = `custom_${Date.now()}`;
        const payload = {
          mandal_id: selectedMandalForMembers.id,
          category_key: catKey,
          label: dirFormLabel.trim(),
          english_label: dirFormEnglishLabel.trim() || dirFormLabel.trim(),
          target_count: targetCountNum,
          icon: dirFormIcon,
          color_class: dirFormColor,
          admin_id: effectiveAdmin
        };

        let newId = `mdir_${Date.now()}`;
        try {
          const res = await api.post<any>(`/api/mandals/${selectedMandalForMembers.id}/directories`, payload);
          if (res?.id) newId = String(res.id);
        } catch (err) {
          console.warn('API directory create fallback:', err);
        }

        const newDir: MandalDirectory = {
          id: newId,
          mandalId: selectedMandalForMembers.id,
          adminId: effectiveAdmin,
          categoryKey: catKey,
          label: payload.label,
          englishLabel: payload.english_label,
          targetCount: targetCountNum,
          icon: payload.icon,
          colorClass: payload.color_class,
          isCustom: true
        };

        setCustomDirectories(prev => {
          const baseList = prev.length > 0 ? prev : DEFAULT_DIRECTORIES;
          const updated = [...baseList, newDir];
          localStorage.setItem(storageKey, JSON.stringify(updated));
          setMandals(mPrev => mPrev.map(m => m.id === selectedMandalForMembers.id ? { ...m, committeeCount: updated.length } : m));
          return updated;
        });

        setExpandedCategoryKey(catKey);
        setSuccess(`New directory "${payload.label}" created successfully.`);
      }

      setIsDirModalOpen(false);
      setEditingDir(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save directory.');
    }
  };

  // Delete directory
  const handleDeleteDirectory = async (dir: MandalDirectory) => {
    if (!selectedMandalForMembers) return;
    if (!window.confirm(`Are you sure you want to remove the directory "${dir.label}"? All members assigned to this directory will also be unassigned.`)) {
      return;
    }

    const storageKey = `mandal_custom_dirs_${selectedMandalForMembers.id}`;

    try {
      setError('');
      setSuccess('');

      try {
        await api.delete(`/api/mandals/directories/${dir.id}`);
      } catch (err) {
        console.warn('API delete directory fallback:', err);
      }

      setCustomDirectories(prev => {
        const baseList = prev.length > 0 ? prev : DEFAULT_DIRECTORIES;
        const updated = baseList.filter(d => d.id !== dir.id && d.categoryKey !== dir.categoryKey);
        localStorage.setItem(storageKey, JSON.stringify(updated));
        setMandals(mPrev => mPrev.map(m => m.id === selectedMandalForMembers.id ? { ...m, committeeCount: updated.length } : m));
        return updated;
      });

      setMembers(prev => prev.filter(m => m.categoryKey !== dir.categoryKey));

      if (expandedCategoryKey === dir.categoryKey) {
        setCustomDirectories(prev => {
          const remaining = prev.filter(d => d.id !== dir.id && d.categoryKey !== dir.categoryKey);
          if (remaining.length > 0) {
            setExpandedCategoryKey(remaining[0].categoryKey);
          } else {
            setExpandedCategoryKey(null);
          }
          return remaining;
        });
      }

      setSuccess(`Directory "${dir.label}" removed.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete directory.');
    }
  };

  // Fetch Mandals from API
  const fetchMandals = async () => {
    try {
      setLoading(true);
      setError('');
      
      const url = adminFilter !== 'All' ? `/api/mandals?adminId=${adminFilter}` : '/api/mandals';
      const list = await api.get<Mandal[]>(url);
      setMandals(list.map((m: any) => ({
        ...m,
        id: String(m.id),
        mandalCode: m.mandal_code || m.mandalCode || '',
        presidentName: m.president_name || m.presidentName || '',
        presidentPhone: m.president_phone || m.presidentPhone || '',
        voterCount: Number(m.real_voter_count !== undefined && m.real_voter_count !== null 
          ? m.real_voter_count 
          : (m.voter_count !== undefined ? m.voter_count : (m.voterCount || 0))),
        realVoterCount: Number(m.real_voter_count || 0),
        boothCount: Number(m.booth_count || 0),
        memberCount: Number(m.member_count || 0),
        committeeCount: Number(m.committee_count !== undefined && m.committee_count !== null 
          ? m.committee_count 
          : (m.committeeCount !== undefined && m.committeeCount !== null ? m.committeeCount : 8)),
        population: m.population || 0,
        stateId: String(m.state_id || m.stateId || ''),
        stateName: m.state_name || m.stateName || '',
        districtId: String(m.district_id || m.districtId || ''),
        districtName: m.district_name || m.districtName || '',
        constituencyId: String(m.constituency_id || m.constituencyId || ''),
        constituencyName: m.constituency_name || m.constituencyName || '',
        adminId: m.admin_id || m.adminId || '',
        adminName: m.admin_name || m.adminName || '',
        adminEmail: m.admin_email || m.adminEmail || ''
      })));
    } catch (err: unknown) {
      setError('Failed to fetch Mandals list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && canView) {
      fetchMandals();
    }
  }, [user, canView, adminFilter]);

  // Fetch members for a specific Mandal
  const fetchMandalMembers = async (mandalId: string) => {
    try {
      setMembersLoading(true);
      const list = await api.get<MandalMember[]>(`/api/mandals/${mandalId}/members`);
      setMembers(list.map((item: any) => ({
        ...item,
        id: String(item.id),
        categoryKey: item.category_key || item.categoryKey,
        voterId: item.voter_id || item.voterId,
        adminId: item.admin_id || item.adminId || ''
      })));
    } catch (err) {
      console.error('Error fetching members:', err);
      setError('Failed to fetch assigned members.');
    } finally {
      setMembersLoading(false);
    }
  };

  // Fetch voters in the same constituency for mapping
  const fetchConstituencyVoters = async (constituencyId: string) => {
    try {
      setVoterSearching(true);
      const res = await api.get<{ data: any[] }>(`/api/voters?constituencyId=${constituencyId}&limit=200`);
      const list = (res.data || []).map(d => ({
        id: String(d.id),
        voterId: d.voter_id || d.voterId || '',
        name: d.name || '',
        mobile: d.mobile || '',
        relationName: d.relation_name || d.relationName || '',
        gender: d.gender || '',
        age: d.age || 0,
        boothId: d.booth_id || d.boothId || ''
      })) as Voter[];
      setConstituencyVoters(list);
    } catch (err) {
      console.error('Error fetching constituency voters:', err);
    } finally {
      setVoterSearching(false);
    }
  };

  // Trigger when selecting a Mandal for details
  const handleSelectMandalForMembers = (mandal: Mandal) => {
    setSelectedMandalForMembers(mandal);
    fetchMandalMembers(mandal.id);
    fetchConstituencyVoters(mandal.constituencyId);
    fetchCustomDirectories(mandal.id);
  };

  // Handle Volunteer/Karyakarta President assignment selection
  const handleVolunteerSelection = (val: string) => {
    setSelectedVolunteerId(val);
    if (val === 'custom') {
      setPresidentName('');
      setPresidentPhone('');
    } else {
      const selectedVol = volunteers.find(v => String(v.id) === String(val));
      if (selectedVol) {
        setPresidentName(selectedVol.name);
        setPresidentPhone(selectedVol.mobile || '');
      }
    }
  };

  // State / District dropdown transitions inside the Form
  const handleStateChange = (stateId: string) => {
    setSelectedState(stateId);
    setSelectedDistrict('');
    setSelectedConstituency('');
  };

  const handleDistrictChange = (districtId: string) => {
    setSelectedDistrict(districtId);
    setSelectedConstituency('');
  };

  // Open modal for Mandal Create/Edit
  const openModal = (mandal?: Mandal) => {
    if (mandal) {
      setIsEditMode(true);
      setEditingId(mandal.id);
      setName(mandal.name);
      setMandalCode(mandal.mandalCode);
      setPresidentName(mandal.presidentName || '');
      setPresidentPhone(mandal.presidentPhone || '');
      setVoterCount(mandal.voterCount || '');
      setPopulation(mandal.population || '');
      setSelectedState(mandal.stateId);
      setSelectedDistrict(mandal.districtId);
      setSelectedConstituency(mandal.constituencyId);
      setFormAdminId(mandal.adminId || '');
      
      const matchedVol = volunteers.find(v => v.name === mandal.presidentName && v.mobile === mandal.presidentPhone);
      setSelectedVolunteerId(matchedVol ? String(matchedVol.id) : 'custom');
    } else {
      setIsEditMode(false);
      setEditingId('');
      setName('');
      setMandalCode('');
      setPresidentName('');
      setPresidentPhone('');
      setVoterCount('');
      setPopulation('');
      setSelectedState(filterState !== 'all' ? filterState : (states[0]?.id || ''));
      setSelectedDistrict(filterDistrict !== 'all' ? filterDistrict : '');
      setSelectedConstituency(filterConstituency !== 'all' ? filterConstituency : '');
      setSelectedVolunteerId('custom');
      setFormAdminId(adminFilter !== 'All' ? adminFilter : (user?.uid || profile?.adminId || ''));
    }
    setIsModalOpen(true);
  };

  // Handle Mandal Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mandalCode.trim() || !selectedState || !selectedDistrict || !selectedConstituency) {
      setError('Please complete all required fields (Name, Code, State, District, and Constituency).');
      return;
    }

    try {
      setError('');
      setSuccess('');

      const payload = {
        name: name.trim(),
        mandal_code: mandalCode.trim().toUpperCase(),
        president_name: presidentName.trim() || null,
        president_phone: presidentPhone.trim() || null,
        voter_count: voterCount !== '' ? Number(voterCount) : 0,
        population: population !== '' ? Number(population) : 0,
        state_id: selectedState,
        district_id: selectedDistrict,
        constituency_id: selectedConstituency,
        admin_id: (isSuperAdmin && formAdminId) ? formAdminId : (formAdminId || user?.uid || profile?.adminId || undefined)
      };

      if (isEditMode) {
        if (!canUpdate) {
          setError('Insufficient permissions to update this Mandal.');
          return;
        }
        await api.put(`/api/mandals/${editingId}`, payload);
        setSuccess('Mandal configuration updated successfully.');
      } else {
        if (!canCreate) {
          setError('Insufficient permissions to create a Mandal.');
          return;
        }
        await api.post('/api/mandals', payload);
        setSuccess('New Mandal registered successfully.');
      }

      setIsModalOpen(false);
      fetchMandals();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to persist Mandal details.';
      setError(msg);
    }
  };

  // Mandal Delete handler
  const handleDelete = async (id: string) => {
    if (!canDelete) {
      setError('Insufficient permissions to delete Mandals.');
      return;
    }
    try {
      setError('');
      setSuccess('');
      await api.delete(`/api/mandals/${id}`);
      setSuccess('Mandal deleted successfully.');
      setDeleteConfirmId('');
      fetchMandals();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to delete Mandal.';
      setError(msg);
    }
  };

  // --- MEMBER LIST OPERATIONS ---

  // Open modal to add/edit a list member inside a Mandal category
  const openMemberModal = (categoryKey: string, member?: MandalMember) => {
    setMemberFormCategory(categoryKey);
    setSelectedVoterForLink(null);
    setSelectedKaryakartaForLink(null);
    setVoterSearchText('');
    setKaryakartaSearchText('');
    
    if (member) {
      setEditingMember(member);
      setMemberFormName(member.name);
      setMemberFormPhone(member.phone || '');
      setMemberFormVoterId(member.voterId || '');
      setMemberFormDesignation(member.designation || '');
      
      const matchedK = volunteers.find(v => 
        (v.voterId && member.voterId && v.voterId.trim().toLowerCase() === member.voterId.trim().toLowerCase()) ||
        (v.mobile && member.phone && v.mobile === member.phone)
      );
      if (matchedK) {
        setSelectedKaryakartaForLink(matchedK);
        setMemberModalTab('karyakarta');
      } else {
        setMemberModalTab('manual');
      }
    } else {
      setEditingMember(null);
      setMemberFormName('');
      setMemberFormPhone('');
      setMemberFormVoterId('');
      setMemberModalTab('karyakarta'); // Default to Karyakarta linking tab
      
      const matchedCat = allCategories.find(c => c.key === categoryKey);
      setMemberFormDesignation(matchedCat ? matchedCat.englishLabel : '');
    }
    setIsMemberModalOpen(true);
  };

  // Handle selecting a Karyakarta from volunteer list
  const handleSelectKaryakarta = (karyakarta: Volunteer) => {
    setSelectedKaryakartaForLink(karyakarta);
    setSelectedVoterForLink(null);
    setMemberFormName(karyakarta.name);
    setMemberFormPhone(karyakarta.mobile || '');
    setMemberFormVoterId(karyakarta.voterId || '');
    if (!memberFormDesignation) {
      const matchedCat = allCategories.find(c => c.key === memberFormCategory);
      setMemberFormDesignation(matchedCat ? matchedCat.englishLabel : 'Mandal Committee Member');
    }
  };

  // Handle linking selected voter from list
  const handleLinkVoter = (voter: Voter) => {
    setSelectedVoterForLink(voter);
    setSelectedKaryakartaForLink(null);
    setMemberFormName(voter.name);
    setMemberFormPhone(voter.mobile || '');
    setMemberFormVoterId(voter.voterId);
    setIsVoterSearchOpen(false);
  };

  // Handle save member
  const handleSaveMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMandalForMembers) return;
    if (!memberFormName.trim()) {
      setError('Member name is required.');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const payload = {
        name: memberFormName.trim(),
        phone: memberFormPhone.trim() || null,
        voter_id: memberFormVoterId.trim() || null,
        designation: memberFormDesignation.trim() || null,
        category_key: memberFormCategory
      };

      if (editingMember) {
        await api.put(`/api/mandals/members/${editingMember.id}`, payload);
        setSuccess('Member assignment updated successfully.');
      } else {
        await api.post(`/api/mandals/${selectedMandalForMembers.id}/members`, payload);
        setSuccess('Member added to directory successfully.');
      }

      // Automatically synchronize Karyakarta / Volunteer record to link to this Mandal
      if (selectedKaryakartaForLink) {
        if (selectedKaryakartaForLink.id) {
          try {
            await api.put(`/api/volunteers/${selectedKaryakartaForLink.id}`, {
              mandal_id: selectedMandalForMembers.id,
              status: 'Active'
            });
          } catch (syncErr) {
            console.warn('Volunteer mandal sync note:', syncErr);
          }
        }
        if (selectedKaryakartaForLink.voterId) {
          try {
            const vRes = await api.get<{ data: any[] }>(`/api/voters?search=${encodeURIComponent(selectedKaryakartaForLink.voterId)}&limit=1`);
            const matched = vRes?.data?.[0];
            if (matched?.id) {
              await api.put(`/api/voters/${matched.id}`, {
                is_karyakarta: 1,
                mandal_id: selectedMandalForMembers.id
              });
            }
          } catch (syncErr) {
            console.warn('Voter karyakarta sync note:', syncErr);
          }
        }
      } else if (selectedVoterForLink?.id) {
        try {
          await api.put(`/api/voters/${selectedVoterForLink.id}`, {
            is_karyakarta: 1,
            mandal_id: selectedMandalForMembers.id
          });
        } catch (syncErr) {
          console.warn('Voter karyakarta sync note:', syncErr);
        }
      } else if (memberFormVoterId.trim()) {
        try {
          const vRes = await api.get<{ data: any[] }>(`/api/voters?search=${encodeURIComponent(memberFormVoterId.trim())}&limit=1`);
          const matched = vRes?.data?.[0];
          if (matched?.id) {
            await api.put(`/api/voters/${matched.id}`, {
              is_karyakarta: 1,
              mandal_id: selectedMandalForMembers.id
            });
          }
        } catch (syncErr) {
          console.warn('Voter sync by EPIC note:', syncErr);
        }
      }

      setIsMemberModalOpen(false);
      setEditingMember(null);
      fetchMandalMembers(selectedMandalForMembers.id);
      fetchMandals();
    } catch (err: any) {
      console.error('Error saving member:', err);
      const msg = err?.response?.data?.error || err?.message || 'Failed to save list member.';
      setError(msg);
    }
  };

  // Handle delete member
  const handleDeleteMember = async (memberId: string) => {
    if (!selectedMandalForMembers) return;
    try {
      setError('');
      setSuccess('');
      await api.delete(`/api/mandals/members/${memberId}`);
      setSuccess('Member removed from Mandal list.');
      fetchMandalMembers(selectedMandalForMembers.id);
    } catch (err) {
      console.error('Error removing member:', err);
      setError('Failed to remove member.');
    }
  };

  // Local filter search on loaded constituency voters
  const searchedVoters = constituencyVoters.filter(v => {
    if (!voterSearchText.trim()) return true;
    const txt = voterSearchText.toLowerCase();
    return (
      v.name.toLowerCase().includes(txt) ||
      (v.voterId || '').toLowerCase().includes(txt) ||
      (v.mobile || '').includes(txt)
    );
  });

  // Filtered Mandals for main grid
  const filteredMandals = mandals.filter(m => {
    const matchesSearch = 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.mandalCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.presidentName || '').toLowerCase().includes(searchQuery.toLowerCase());

    const matchesState = filterState === 'all' || m.stateId === filterState;
    const matchesDistrict = filterDistrict === 'all' || m.districtId === filterDistrict;
    const matchesConstituency = filterConstituency === 'all' || m.constituencyId === filterConstituency;

    return matchesSearch && matchesState && matchesDistrict && matchesConstituency;
  });

  // Render detail list view if a Mandal is selected
  if (selectedMandalForMembers) {
    return (
      <div id="mandal-detailed-view-container" className="space-y-6">
        {/* Back navigation */}
        <button
          id="back-to-mandals-btn"
          onClick={() => setSelectedMandalForMembers(null)}
          className="flex items-center gap-2 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium text-sm transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Mandals List
        </button>

        {/* Selected Mandal Quick Info Header card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <Layers className="h-28 w-28" />
          </div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-bold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg uppercase tracking-wider">
                  {selectedMandalForMembers.mandalCode}
                </span>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedMandalForMembers.constituencyName} Constituency
                </span>
                {isSuperAdmin && (selectedMandalForMembers.adminName || selectedMandalForMembers.adminId) && (
                  <span className="text-xs font-bold px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50 rounded-lg flex items-center gap-1">
                    <Network className="h-3.5 w-3.5" />
                    Admin: {getAdminName(selectedMandalForMembers.adminId, selectedMandalForMembers.adminName, selectedMandalForMembers.adminEmail)}
                  </span>
                )}
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {selectedMandalForMembers.name} Mandal Roster
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                Configure official committees, assign convenors, and track leader compliance counts across the 8 standard administrative directories.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl border border-zinc-150 dark:border-zinc-800/40">
                <div className="px-2">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Total Members</span>
                  <p className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100 mt-0.5">
                    {members.length} / {totalTargetQuota}
                  </p>
                </div>
                <div className="px-2 border-l border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider block">Karyakartas</span>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {members.filter(m => isMemberKaryakarta(m)).length}
                  </p>
                </div>
                <div className="px-2 border-l border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Directories</span>
                  <p className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100 mt-0.5">
                    {allCategories.length}
                  </p>
                </div>
                <div className="px-2 border-l border-zinc-200 dark:border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Completion</span>
                  <p className="text-lg font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {completionRate}%
                  </p>
                </div>
              </div>

              {canManageDirectories && (
                <button
                  id="header-add-directory-btn"
                  onClick={() => openDirModal()}
                  className="flex items-center gap-1.5 px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold rounded-xl transition-all shadow-sm"
                >
                  <FolderPlus className="h-4 w-4" />
                  <span>+ Add Directory / List</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Notifications inside Details page */}
        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-3 border border-red-100 dark:border-red-900/30">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="p-4 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-3 border border-emerald-100 dark:border-emerald-900/30">
            <CheckCircle className="h-5 w-5 shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        {/* Members loading spinner */}
        {membersLoading ? (
          <div className="flex justify-center items-center py-24">
            <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Left Column: List of Core + Custom Directories */}
            <div className="lg:col-span-5 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    Directories ({allCategories.length})
                  </h3>
                </div>
                {canManageDirectories && (
                  <button
                    id="left-add-directory-btn"
                    onClick={() => openDirModal()}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add New List</span>
                  </button>
                )}
              </div>

              {/* Directory Filter Tabs: All, Core, Custom */}
              <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-lg text-xs">
                <button
                  type="button"
                  onClick={() => setDirectoryFilterTab('all')}
                  className={`flex-1 py-1 px-2 rounded-md font-semibold transition-all text-center ${
                    directoryFilterTab === 'all'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  All ({allCategories.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryFilterTab('core')}
                  className={`flex-1 py-1 px-2 rounded-md font-semibold transition-all text-center ${
                    directoryFilterTab === 'core'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Core ({allCategories.filter(c => !c.isCustom).length})
                </button>
                <button
                  type="button"
                  onClick={() => setDirectoryFilterTab('custom')}
                  className={`flex-1 py-1 px-2 rounded-md font-semibold transition-all text-center ${
                    directoryFilterTab === 'custom'
                      ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                  }`}
                >
                  Custom ({allCategories.filter(c => c.isCustom).length})
                </button>
              </div>
              
              {allCategories
                .filter(cat => {
                  if (directoryFilterTab === 'core') return !cat.isCustom;
                  if (directoryFilterTab === 'custom') return cat.isCustom;
                  return true;
                })
                .map((category, idx) => {
                  const categoryMembers = members.filter(m => m.categoryKey === category.key);
                  const count = categoryMembers.length;
                  const percent = Math.min(100, Math.round((count / (category.targetCount || 1)) * 100));
                  const isSelected = expandedCategoryKey === category.key;
                  const Icon = category.icon;

                  return (
                    <button
                      key={category.key}
                      id={`directory-tab-${category.key}`}
                      onClick={() => setExpandedCategoryKey(category.key)}
                      className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 relative group ${
                        isSelected 
                          ? 'bg-white dark:bg-zinc-900 border-zinc-900 dark:border-zinc-100 shadow-md ring-1 ring-zinc-900 dark:ring-zinc-100' 
                          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-sm'
                      }`}
                    >
                      <div className="flex items-start justify-between w-full">
                        <div className="flex items-start gap-3">
                          <div className={`p-2 rounded-lg shrink-0 ${category.colorClass}`}>
                            <Icon className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                                {category.isCustom ? 'Custom List' : `Category ${idx + 1}`}
                              </span>
                              {category.isCustom && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-amber-50 dark:bg-amber-950/40 text-[9px] font-bold text-amber-700 dark:text-amber-300 rounded border border-amber-200 dark:border-amber-800/40">
                                  <Lock className="h-2.5 w-2.5" />
                                  Admin
                                </span>
                              )}
                            </div>
                            <h4 className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 leading-snug">
                              {category.label}
                            </h4>
                            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">
                              {category.englishLabel}
                            </p>
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <span className="text-xs font-extrabold text-zinc-900 dark:text-zinc-100">
                            {count} / {category.targetCount}
                          </span>
                          <p className="text-[9px] text-zinc-400 font-semibold mt-0.5">Target</p>
                          
                          {/* Quick Edit/Delete on any directory */}
                          {canManageDirectories && (
                            <div className="flex items-center justify-end gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <span
                                role="button"
                                tabIndex={0}
                                title="Edit Directory"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openDirModal(category.rawDir);
                                }}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-amber-500 cursor-pointer"
                              >
                                <Edit2 className="h-3 w-3" />
                              </span>
                              <span
                                role="button"
                                tabIndex={0}
                                title="Delete Directory"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteDirectory(category.rawDir);
                                }}
                                className="p-1 rounded hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 cursor-pointer"
                              >
                                <Trash2 className="h-3 w-3" />
                              </span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full">
                        <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              percent === 100 
                                ? 'bg-emerald-600' 
                                : percent > 50 
                                ? 'bg-zinc-700 dark:bg-zinc-300' 
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between items-center mt-1 text-[10px] text-zinc-400 font-medium">
                          <span>{percent}% Completed</span>
                          <span>{Math.max(0, category.targetCount - count)} Needed</span>
                        </div>
                      </div>
                    </button>
                  );
                })}

              {allCategories.filter(cat => {
                if (directoryFilterTab === 'core') return !cat.isCustom;
                if (directoryFilterTab === 'custom') return cat.isCustom;
                return true;
              }).length === 0 && (
                <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <p className="text-xs text-zinc-400 font-medium">No custom directories created yet.</p>
                  {canUpdate && (
                    <button
                      onClick={() => openDirModal()}
                      className="mt-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      + Create First Custom Directory
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Right Column: Assigned members of the selected category */}
            <div className="lg:col-span-7">
              {(() => {
                const activeCat = allCategories.find(c => c.key === expandedCategoryKey) || allCategories[0];
                if (!activeCat) return null;
                const rawCategoryMembers = members.filter(m => m.categoryKey === activeCat.key);
                
                // Filter and search inside active category members
                const activeMembers = rawCategoryMembers.filter(m => {
                  if (directoryMemberFilter === 'karyakarta' && !isMemberKaryakarta(m)) return false;
                  if (directoryMemberFilter === 'other' && isMemberKaryakarta(m)) return false;
                  if (!directoryMemberSearch.trim()) return true;
                  const q = directoryMemberSearch.toLowerCase();
                  return (
                    m.name.toLowerCase().includes(q) ||
                    (m.phone || '').includes(q) ||
                    (m.voterId || '').toLowerCase().includes(q) ||
                    (m.designation || '').toLowerCase().includes(q)
                  );
                });

                const Icon = activeCat.icon;
                const karyakartasInCat = rawCategoryMembers.filter(m => isMemberKaryakarta(m)).length;

                return (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
                    {/* Active category header info */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-5 gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${activeCat.colorClass}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100">
                              {activeCat.label}
                            </h3>
                            {activeCat.isCustom ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                                <Lock className="h-3 w-3" />
                                Admin Custom List
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                Core Standard Directory
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                            {activeCat.englishLabel} • Quota Target: <strong>{activeCat.targetCount}</strong> ({rawCategoryMembers.length} assigned, {karyakartasInCat} active karyakartas)
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {canManageDirectories && (
                          <>
                            <button
                              id="edit-active-directory-btn"
                              onClick={() => {
                                openDirModal(activeCat.rawDir);
                              }}
                              className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Edit Directory details"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Edit List</span>
                            </button>
                            <button
                              id="delete-active-directory-btn"
                              onClick={() => {
                                handleDeleteDirectory(activeCat.rawDir);
                              }}
                              className="px-2.5 py-2 border border-zinc-200 dark:border-zinc-700 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                              title="Delete this directory list"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Delete List</span>
                            </button>
                          </>
                        )}
                        {canUpdate && (
                          <button
                            id="add-member-btn"
                            onClick={() => openMemberModal(activeCat.key)}
                            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold rounded-lg transition-colors shadow-sm cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            Add Member
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Member Filter & Search Bar */}
                    {rawCategoryMembers.length > 0 && (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                        <div className="relative flex-1 max-w-sm">
                          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                          <input
                            type="text"
                            placeholder="Filter members by name, phone, or EPIC..."
                            value={directoryMemberSearch}
                            onChange={(e) => setDirectoryMemberSearch(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                          />
                        </div>
                        <div className="flex items-center gap-1 text-[11px]">
                          <button
                            onClick={() => setDirectoryMemberFilter('all')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                              directoryMemberFilter === 'all'
                                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                                : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            All ({rawCategoryMembers.length})
                          </button>
                          <button
                            onClick={() => setDirectoryMemberFilter('karyakarta')}
                            className={`px-2.5 py-1 rounded-md font-semibold transition-colors flex items-center gap-1 ${
                              directoryMemberFilter === 'karyakarta'
                                ? 'bg-emerald-600 text-white'
                                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
                            }`}
                          >
                            <UserCheck className="h-3 w-3" />
                            Karyakartas ({karyakartasInCat})
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Member rows list */}
                    {rawCategoryMembers.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        <User className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No members assigned yet</p>
                        <p className="text-xs text-zinc-400 mt-0.5 max-w-sm mx-auto">
                          Link active karyakartas directly from the volunteer list or constituency voter roll to fulfill the target quota of {activeCat.targetCount} members.
                        </p>
                        {canUpdate && (
                          <div className="flex items-center justify-center gap-3 mt-4">
                            <button
                              onClick={() => openMemberModal(activeCat.key)}
                              className="px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
                            >
                              + Link First Karyakarta
                            </button>
                          </div>
                        )}
                      </div>
                    ) : activeMembers.length === 0 ? (
                      <div className="text-center py-10 text-xs text-zinc-400">
                        No members match your search or filter.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeMembers.map((member) => {
                          const isKaryakarta = isMemberKaryakarta(member);
                          return (
                            <div
                              key={member.id}
                              className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40 rounded-xl hover:shadow-sm transition-shadow"
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-sm ${
                                  isKaryakarta 
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700'
                                    : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                                }`}>
                                  {member.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <h5 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                      {member.name}
                                    </h5>
                                    {isKaryakarta && (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                        <UserCheck className="h-3 w-3" />
                                        Active Karyakarta
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-xs text-zinc-400">
                                    {member.designation && (
                                      <span className="font-semibold text-zinc-600 dark:text-zinc-300 flex items-center gap-1">
                                        <Star className="h-3 w-3 text-amber-500 shrink-0 fill-amber-500" />
                                        {member.designation}
                                      </span>
                                    )}
                                    {member.phone && (
                                      <a 
                                        href={`tel:${member.phone}`}
                                        className="flex items-center gap-1 hover:text-zinc-700 dark:hover:text-zinc-200"
                                      >
                                        <Phone className="h-3 w-3 shrink-0 text-zinc-400" />
                                        {member.phone}
                                      </a>
                                    )}
                                    {member.voterId && (
                                      <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 rounded-md font-mono font-bold uppercase shrink-0">
                                        EPIC: {member.voterId}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action buttons */}
                              {canUpdate && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    id={`edit-member-btn-${member.id}`}
                                    onClick={() => openMemberModal(activeCat.key, member)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                    title="Edit member designation/phone"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    id={`remove-member-btn-${member.id}`}
                                    onClick={() => handleDeleteMember(member.id)}
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                    title="Remove from directory"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                    <span>Delete</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* CUSTOM DIRECTORY MODAL (Add / Edit Custom List) */}
        <AnimatePresence>
          {isDirModalOpen && selectedMandalForMembers && (
            <div id="mandal-directory-modal" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl"
              >
                <button
                  id="close-directory-modal-btn"
                  onClick={() => setIsDirModalOpen(false)}
                  className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                    <FolderPlus className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {editingDir ? 'Edit Directory / Committee' : 'Add New Directory / List'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Under Mandal: <strong className="text-zinc-700 dark:text-zinc-300">{selectedMandalForMembers.name}</strong>
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-xs text-blue-800 dark:text-blue-300 flex items-start gap-2">
                  <FolderPlus className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
                  <span>
                    <strong>Mandal Directory:</strong> Directory lists configured here are visible across this mandal to all authorized members.
                  </span>
                </div>

                <form onSubmit={handleSaveDirectory} className="mt-5 space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Directory / Committee Name (Hindi / Primary) *
                    </label>
                    <input
                      id="dir-form-label-input"
                      type="text"
                      required
                      placeholder="e.g. युवा मोर्चा मंडल कार्यकारिणी / किसान मोर्चा समिति"
                      value={dirFormLabel}
                      onChange={(e) => setDirFormLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      English / Subtitle Label
                    </label>
                    <input
                      id="dir-form-eng-label-input"
                      type="text"
                      placeholder="e.g. Youth Wing Mandal Executive Committee"
                      value={dirFormEnglishLabel}
                      onChange={(e) => setDirFormEnglishLabel(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Target Member Quota *
                    </label>
                    <input
                      id="dir-form-target-input"
                      type="number"
                      min="1"
                      required
                      placeholder="e.g. 15, 20, 25"
                      value={dirFormTargetCount}
                      onChange={(e) => setDirFormTargetCount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  {/* Icon Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Choose Directory Icon
                    </label>
                    <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                      {DIRECTORY_ICON_CHOICES.map(item => {
                        const IconComponent = item.icon;
                        const isSelected = dirFormIcon === item.name;
                        return (
                          <button
                            key={item.name}
                            type="button"
                            onClick={() => setDirFormIcon(item.name)}
                            title={item.label}
                            className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all ${
                              isSelected
                                ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm'
                                : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-500'
                            }`}
                          >
                            <IconComponent className="h-5 w-5" />
                            <span className="text-[9px] font-medium truncate max-w-full">{item.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Color Preset Selector */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-2">
                      Color Theme Accent
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {DIRECTORY_COLOR_PRESETS.map(preset => {
                        const isSelected = dirFormColor === preset.value;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setDirFormColor(preset.value)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                              isSelected
                                ? 'border-zinc-900 dark:border-zinc-100 bg-zinc-100 dark:bg-zinc-800 shadow-sm'
                                : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                            }`}
                          >
                            <span className={`h-2.5 w-2.5 rounded-full ${preset.dotClass}`} />
                            <span>{preset.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      id="cancel-dir-save-btn"
                      type="button"
                      onClick={() => setIsDirModalOpen(false)}
                      className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="save-dir-submit-btn"
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <Save className="h-4 w-4" />
                      Save Directory
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* MEMBER DETAILS / REGISTER MODAL WITH KARYAKARTA LINKING */}
        <AnimatePresence>
          {isMemberModalOpen && (
            <div id="member-form-modal" className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative shadow-2xl"
              >
                <button
                  id="close-member-modal-btn"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                    <UserCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                      {editingMember ? 'Edit Member Assignment' : 'Assign Directory Member'}
                    </h3>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Assign a verified Karyakarta, link from constituency voter roll, or input custom profile fields.
                    </p>
                  </div>
                </div>

                {/* Linking Mode Tab Switcher */}
                {!editingMember && (
                  <div className="mt-4 flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-xl text-xs">
                    <button
                      type="button"
                      id="tab-link-karyakarta-btn"
                      onClick={() => setMemberModalTab('karyakarta')}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                        memberModalTab === 'karyakarta'
                          ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Karyakarta List</span>
                    </button>
                    <button
                      type="button"
                      id="tab-link-voter-btn"
                      onClick={() => setMemberModalTab('voter')}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                        memberModalTab === 'voter'
                          ? 'bg-white dark:bg-zinc-900 text-blue-600 dark:text-blue-400 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <Search className="h-3.5 w-3.5" />
                      <span>Voter Roll</span>
                    </button>
                    <button
                      type="button"
                      id="tab-manual-entry-btn"
                      onClick={() => setMemberModalTab('manual')}
                      className={`flex-1 py-1.5 px-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 ${
                        memberModalTab === 'manual'
                          ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-sm'
                          : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
                      }`}
                    >
                      <User className="h-3.5 w-3.5" />
                      <span>Manual Entry</span>
                    </button>
                  </div>
                )}

                <form onSubmit={handleSaveMember} className="mt-4 space-y-4">
                  
                  {/* TAB 1: KARYAKARTA QUICK LINKING */}
                  {!editingMember && memberModalTab === 'karyakarta' && (
                    <div className="bg-emerald-50/40 dark:bg-emerald-950/20 border border-emerald-150 dark:border-emerald-800/40 p-3.5 rounded-xl space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center gap-1">
                          <UserCheck className="h-3.5 w-3.5" />
                          Link Active Karyakarta ({volunteers.length} available)
                        </span>
                        {selectedKaryakartaForLink && (
                          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            ✓ Selected
                          </span>
                        )}
                      </div>

                      {/* If Karyakarta already selected */}
                      {selectedKaryakartaForLink ? (
                        <div className="bg-white dark:bg-zinc-900 border border-emerald-300 dark:border-emerald-700 p-3 rounded-xl flex items-center justify-between shadow-sm">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-sm">
                              <Check className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                  {selectedKaryakartaForLink.name}
                                </span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200">
                                  Active Karyakarta
                                </span>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {selectedKaryakartaForLink.mobile && <span>📱 {selectedKaryakartaForLink.mobile}</span>}
                                {selectedKaryakartaForLink.voterId && <span>EPIC: <strong className="font-mono">{selectedKaryakartaForLink.voterId}</strong></span>}
                                {(selectedKaryakartaForLink.assignedBoothName || selectedKaryakartaForLink.village) && (
                                  <span>📍 {selectedKaryakartaForLink.assignedBoothName || selectedKaryakartaForLink.village}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedKaryakartaForLink(null);
                              setMemberFormName('');
                              setMemberFormPhone('');
                              setMemberFormVoterId('');
                            }}
                            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 font-semibold px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-950/40"
                          >
                            Change
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                            <input
                              id="karyakarta-link-search-input"
                              type="text"
                              placeholder="Search active karyakartas by name, phone, booth, or EPIC..."
                              value={karyakartaSearchText}
                              onChange={(e) => setKaryakartaSearchText(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          </div>

                          {/* Karyakarta list preview */}
                          <div className="max-h-48 overflow-y-auto space-y-1 pr-1 divide-y divide-zinc-100 dark:divide-zinc-800/60 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-1">
                            {volunteers
                              .filter(k => {
                                if (!karyakartaSearchText.trim()) return true;
                                const q = karyakartaSearchText.toLowerCase();
                                return (
                                  k.name.toLowerCase().includes(q) ||
                                  (k.mobile || '').includes(q) ||
                                  (k.voterId || '').toLowerCase().includes(q) ||
                                  (k.assignedBoothName || '').toLowerCase().includes(q) ||
                                  (k.village || '').toLowerCase().includes(q)
                                );
                              })
                              .slice(0, 30)
                              .map(k => (
                                <button
                                  key={k.id}
                                  type="button"
                                  onClick={() => handleSelectKaryakarta(k)}
                                  className="w-full text-left p-2.5 rounded-lg hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors flex items-center justify-between group"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-7 w-7 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-200 flex items-center justify-center text-xs font-bold">
                                      {k.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                                          {k.name}
                                        </span>
                                        <span className="px-1 py-0.2 rounded text-[8px] font-bold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                          Karyakarta
                                        </span>
                                      </div>
                                      <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                        {k.mobile && <span>{k.mobile}</span>}
                                        {k.voterId && <span>EPIC: <strong className="font-mono text-zinc-500">{k.voterId}</strong></span>}
                                        {(k.assignedBoothName || k.village) && <span>📍 {k.assignedBoothName || k.village}</span>}
                                      </div>
                                    </div>
                                  </div>
                                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Select +
                                  </span>
                                </button>
                              ))}

                            {volunteers.length === 0 && (
                              <div className="p-4 text-center text-xs text-zinc-400">
                                No volunteers enrolled yet. You can search from Voter Roll or enter manually.
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: CONSTITUENCY VOTER ROLL LINKING */}
                  {!editingMember && memberModalTab === 'voter' && (
                    <div className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800/40 p-4 rounded-xl space-y-3">
                      <p className="text-xs font-bold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                        Constituency Voters Quick Link
                      </p>
                      
                      <div className="relative">
                        <input
                          id="member-voter-search"
                          type="text"
                          placeholder="Search voters by Name or EPIC No..."
                          value={voterSearchText}
                          onChange={(e) => { setVoterSearchText(e.target.value); setIsVoterSearchOpen(true); }}
                          className="w-full px-3 py-2 pl-9 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                        />
                        <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                        
                        {/* Auto-suggest dropdown */}
                        <AnimatePresence>
                          {isVoterSearchOpen && voterSearchText.trim() && (
                            <motion.div
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg max-h-48 overflow-y-auto z-20 divide-y divide-zinc-100 dark:divide-zinc-800"
                            >
                              {voterSearching ? (
                                <div className="p-4 text-center text-xs text-zinc-400">Loading voters...</div>
                              ) : searchedVoters.length === 0 ? (
                                <div className="p-4 text-center text-xs text-zinc-400">No matching constituency voters found</div>
                              ) : (
                                searchedVoters.slice(0, 15).map(v => (
                                  <button
                                    key={v.id}
                                    type="button"
                                    onClick={() => handleLinkVoter(v)}
                                    className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-xs flex flex-col justify-between gap-1 transition-colors"
                                  >
                                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{v.name}</span>
                                    <div className="flex justify-between text-[10px] text-zinc-400 mt-0.5 font-medium">
                                      <span>EPIC: <span className="font-mono text-zinc-500">{v.voterId}</span></span>
                                      {v.mobile && <span>Phone: {v.mobile}</span>}
                                    </div>
                                  </button>
                                ))
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>

                      {selectedVoterForLink && (
                        <div className="bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 p-2.5 rounded-lg text-xs flex items-center justify-between border border-emerald-100 dark:border-emerald-900/30">
                          <span className="font-semibold truncate">Linked Voter: {selectedVoterForLink.name}</span>
                          <button
                            type="button"
                            onClick={() => { setSelectedVoterForLink(null); setMemberFormName(''); setMemberFormPhone(''); setMemberFormVoterId(''); }}
                            className="p-0.5 hover:bg-emerald-100 dark:hover:bg-emerald-900 rounded"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Manual / Auto inputs */}
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Member Name *
                    </label>
                    <input
                      id="member-form-name-input"
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={memberFormName}
                      onChange={(e) => setMemberFormName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Phone Number
                    </label>
                    <input
                      id="member-form-phone-input"
                      type="tel"
                      placeholder="10-digit mobile number"
                      value={memberFormPhone}
                      onChange={(e) => setMemberFormPhone(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Voter ID / EPIC Number
                    </label>
                    <input
                      id="member-form-voterid-input"
                      type="text"
                      placeholder="e.g. ABC1234567"
                      value={memberFormVoterId}
                      onChange={(e) => setMemberFormVoterId(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider">
                        Official Designation / Title
                      </label>
                      <span className="text-[10px] text-zinc-400">Click a preset below or type custom</span>
                    </div>
                    <input
                      id="member-form-designation-input"
                      type="text"
                      placeholder="e.g. संयोजक (Convenor) / मंडल अध्यक्ष"
                      value={memberFormDesignation}
                      onChange={(e) => setMemberFormDesignation(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                    {/* Designation Quick Presets */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {DESIGNATION_PRESETS.map(preset => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setMemberFormDesignation(preset)}
                          className={`text-[10px] px-2 py-0.5 rounded-md border transition-colors ${
                            memberFormDesignation === preset
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 border-transparent font-bold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Footer Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      id="cancel-member-save-btn"
                      type="button"
                      onClick={() => setIsMemberModalOpen(false)}
                      className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      id="save-member-submit-btn"
                      type="submit"
                      className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold rounded-lg transition-colors"
                    >
                      <Save className="h-4 w-4" />
                      Save Assignment
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div id="mandal-management-container" className="space-y-6">
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Mandals
          </h1>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Administrative blocks and committee management.
          </p>
        </div>
        {canCreate && (
          <button
            id="create-mandal-btn"
            onClick={() => openModal()}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 font-semibold text-xs rounded-lg shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" />
            Add Mandal
          </button>
        )}
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-lg flex items-center gap-2.5 border border-red-100 dark:border-red-900/30 text-xs">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center gap-2.5 border border-emerald-100 dark:border-emerald-900/30 text-xs">
          <CheckCircle className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* KPI Dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Mandals</span>
            <Layers className="h-4 w-4 text-zinc-400" />
          </div>
          <p className="text-xl font-bold mt-1 text-zinc-900 dark:text-zinc-50">{mandals.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Committees</span>
            <FolderPlus className="h-4 w-4 text-indigo-500" />
          </div>
          <p className="text-xl font-bold mt-1 text-indigo-600 dark:text-indigo-400">
            {mandals.reduce((acc, curr) => acc + getMandalCommitteeCount(curr), 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Committee Members</span>
            <Shield className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-xl font-bold mt-1 text-emerald-600 dark:text-emerald-400">
            {mandals.reduce((acc, curr) => acc + (curr.memberCount || 0), 0)}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Electors</span>
            <Users className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-xl font-bold mt-1 text-blue-600 dark:text-blue-400">
            {mandals.reduce((acc, curr) => acc + (curr.realVoterCount || curr.voterCount || 0), 0).toLocaleString()}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Polling Booths</span>
            <Building2 className="h-4 w-4 text-purple-500" />
          </div>
          <p className="text-xl font-bold mt-1 text-purple-600 dark:text-purple-400">
            {mandals.reduce((acc, curr) => acc + (curr.boothCount || 0), 0)}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-xl shadow-xs flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-400" />
          <input
            id="search-input"
            type="text"
            placeholder="Search mandals by name, code, president..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400"
          />
        </div>
        <div className="flex flex-wrap gap-2.5 items-center w-full md:w-auto">
          {/* Super Admin: Admin Selector */}
          {isSuperAdmin && (
            <select
              id="admin-filter"
              value={adminFilter}
              onChange={(e) => setAdminFilter(e.target.value)}
              className="px-3 py-1.5 border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/40 rounded-lg text-xs font-bold text-blue-700 dark:text-blue-300 focus:outline-none max-w-[200px] truncate"
              title="Filter Mandals by Admin Scope"
            >
              <option value="All">👑 All Admins</option>
              {admins.map(a => (
                <option key={a.id || a.uid} value={String(a.id || a.uid)}>
                  Admin: {a.name || a.username || a.email}
                </option>
              ))}
            </select>
          )}

          <select
            id="state-filter"
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterDistrict('all'); setFilterConstituency('all'); }}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
          >
            <option value="all">All States</option>
            {states.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          <select
            id="district-filter"
            value={filterDistrict}
            onChange={(e) => { setFilterDistrict(e.target.value); setFilterConstituency('all'); }}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
            disabled={filterState === 'all'}
          >
            <option value="all">All Districts</option>
            {districts.filter(d => d.stateId === filterState).map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            id="constituency-filter"
            value={filterConstituency}
            onChange={(e) => setFilterConstituency(e.target.value)}
            className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-xs text-zinc-700 dark:text-zinc-300 focus:outline-none"
            disabled={filterDistrict === 'all'}
          >
            <option value="all">All Constituencies</option>
            {constituencies.filter(c => c.districtId === filterDistrict).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* View Mode Toggle: Table Rows vs Cards */}
          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200 dark:border-zinc-700 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'table' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              title="Row / Table View"
            >
              <List className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={`p-1.5 rounded-md transition-all cursor-pointer ${viewMode === 'cards' ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-xs' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
              title="Card Grid View"
            >
              <LayoutGrid className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mandal List Rendering */}
      {loading ? (
        <div className="flex justify-center items-center py-24">
          <Loader2 className="h-8 w-8 text-zinc-400 animate-spin" />
        </div>
      ) : filteredMandals.length === 0 ? (
        <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm">
          <Inbox className="h-12 w-12 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
          <p className="text-zinc-600 dark:text-zinc-400 font-medium">No Mandals found</p>
          <p className="text-sm text-zinc-400 mt-1">Get started by creating your first administrative block (Mandal).</p>
        </div>
      ) : viewMode === 'table' ? (
        /* TABLE / ROW VIEW */
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left min-w-[950px] whitespace-nowrap text-xs border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-[10px] font-black uppercase tracking-wider text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="py-3 px-4">Code & Mandal</th>
                  <th className="py-3 px-4">Location (Constituency / District)</th>
                  {isSuperAdmin && <th className="py-3 px-4">Supervising Leadership</th>}
                  <th className="py-3 px-4">Mandal President</th>
                  <th className="py-3 px-4 text-center">Voters / Pop</th>
                  <th className="py-3 px-4 text-center">Committees</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredMandals.map(mandal => (
                  <tr key={mandal.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                    {/* Code & Mandal */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-[11px] font-mono font-bold px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-zinc-200 dark:border-zinc-700">
                          {mandal.mandalCode}
                        </span>
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">
                            {mandal.name}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
                        <MapPin className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                        <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                          {mandal.constituencyName || 'Constituency'}
                        </span>
                        <span className="text-zinc-400">&bull;</span>
                        <span className="text-zinc-500">
                          {mandal.districtName || 'District'}
                        </span>
                        <span className="text-zinc-400">&bull;</span>
                        <span className="text-zinc-400 text-[11px]">
                          {mandal.stateName || 'State'}
                        </span>
                      </div>
                    </td>

                    {/* Leadership */}
                    {isSuperAdmin && (
                      <td className="py-3 px-4">
                        {(mandal.adminName || mandal.adminId) ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 rounded-md">
                            <Network className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                            {getAdminName(mandal.adminId, mandal.adminName, mandal.adminEmail)}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-xs">-</span>
                        )}
                      </td>
                    )}

                    {/* President */}
                    <td className="py-3 px-4">
                      {mandal.presidentName ? (
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-white text-xs flex items-center gap-1">
                            <User className="h-3 w-3 text-zinc-400" />
                            {mandal.presidentName}
                          </div>
                          {mandal.presidentPhone && (
                            <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1 mt-0.5">
                              <Phone className="h-2.5 w-2.5 text-zinc-400" />
                              <a href={`tel:${mandal.presidentPhone}`} className="hover:text-blue-600 transition-colors">
                                {mandal.presidentPhone}
                              </a>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-400 italic text-xs">Not Assigned</span>
                      )}
                    </td>

                    {/* Voters / Population */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => openMandalVoters(mandal)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-black bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200/50 hover:bg-blue-100 transition-all cursor-pointer"
                        title="Click to view electors registered in this Mandal"
                      >
                        <Users size={12} />
                        <span>{(mandal.realVoterCount || mandal.voterCount || 0).toLocaleString()}</span>
                      </button>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        {mandal.boothCount ? `${mandal.boothCount} Booths` : ''}
                      </div>
                    </td>

                    {/* Committee Lists */}
                    <td className="py-3 px-4 text-center">
                      <button
                        id={`manage-lists-table-btn-${mandal.id}`}
                        onClick={() => handleSelectMandalForMembers(mandal)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 hover:bg-blue-50 dark:bg-zinc-800 dark:hover:bg-blue-900/20 text-zinc-700 dark:text-zinc-300 hover:text-blue-600 dark:hover:text-blue-400 text-[11px] font-bold rounded-lg border border-zinc-200 dark:border-zinc-700 transition-colors cursor-pointer"
                        title={`Manage ${getMandalCommitteeCount(mandal)} Committee Lists for ${mandal.name}`}
                      >
                        <Layers className="h-3.5 w-3.5 text-blue-500" />
                        <span>{getMandalCommitteeCount(mandal)} Committees</span>
                      </button>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {canUpdate && (
                          <button
                            id={`edit-mandal-row-btn-${mandal.id}`}
                            onClick={() => openModal(mandal)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                            title="Edit Mandal Parameters"
                          >
                            <Edit2 className="h-3 w-3" />
                            <span>Edit</span>
                          </button>
                        )}
                        {canDelete && (
                          <button
                            id={`delete-mandal-row-btn-${mandal.id}`}
                            onClick={() => setDeleteConfirmId(mandal.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                            title="Delete Mandal"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Delete</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* CARD GRID VIEW */
        <div id="mandals-grid" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMandals.map(mandal => (
            <motion.div
              key={mandal.id}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col justify-between"
            >
              {/* Mandal Header */}
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                        {mandal.mandalCode}
                      </span>
                      {isSuperAdmin && (mandal.adminName || mandal.adminId) && (
                        <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/40 rounded-md flex items-center gap-1">
                          <Network className="h-2.5 w-2.5" />
                          {getAdminName(mandal.adminId, mandal.adminName, mandal.adminEmail)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-2">{mandal.name}</h3>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-1.5">
                    {canUpdate && (
                      <button
                        id={`edit-mandal-btn-${mandal.id}`}
                        onClick={() => openModal(mandal)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="Edit Mandal Parameters"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canDelete && (
                      <button
                        id={`delete-mandal-btn-${mandal.id}`}
                        onClick={() => setDeleteConfirmId(mandal.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                        title="Delete Mandal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Location Path */}
                <div className="flex items-center gap-1.5 mt-3 text-xs text-zinc-400 dark:text-zinc-500">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">
                    {mandal.stateName || 'Unknown State'}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate">
                    {mandal.districtName || 'Unknown District'}
                  </span>
                  <ChevronRight className="h-3 w-3" />
                  <span className="truncate font-medium text-zinc-500 dark:text-zinc-400">
                    {mandal.constituencyName || 'Unknown Constituency'}
                  </span>
                </div>

                {/* President Info */}
                <div className="mt-5 p-3.5 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800/40">
                  <p className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">Mandal President</p>
                  {mandal.presidentName ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                        <User className="h-3.5 w-3.5 text-zinc-400" />
                        {mandal.presidentName}
                      </p>
                      {mandal.presidentPhone && (
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5 text-zinc-400" />
                          {mandal.presidentPhone}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-zinc-400 italic mt-1.5">Not Assigned</p>
                  )}
                </div>
              </div>

              {/* Action Buttons: View Voters & 8 Core Lists */}
              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  id={`view-mandal-voters-btn-${mandal.id}`}
                  onClick={() => openMandalVoters(mandal)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/40 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40 text-xs font-bold rounded-xl transition-all"
                  title="Inspect all electors in this Mandal"
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Voters ({(mandal.realVoterCount !== undefined && mandal.realVoterCount > 0 ? mandal.realVoterCount : (mandal.voterCount || 0)).toLocaleString()})</span>
                </button>
                <button
                  id={`manage-lists-btn-${mandal.id}`}
                  onClick={() => handleSelectMandalForMembers(mandal)}
                  className="flex items-center justify-center gap-1.5 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                  title={`Manage ${getMandalCommitteeCount(mandal)} Committees and member rosters`}
                >
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  <span>{getMandalCommitteeCount(mandal)} Committees ({mandal.memberCount || 0})</span>
                </button>
              </div>

              {/* Stats / Synchronized Metrics */}
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-4 gap-1.5 text-center">
                <div 
                  onClick={() => openMandalVoters(mandal)}
                  className="cursor-pointer hover:bg-blue-50/60 dark:hover:bg-blue-950/30 p-1.5 rounded-lg transition-colors"
                  title="Click to view electors"
                >
                  <p className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Electors</p>
                  <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mt-0.5 truncate">
                    {(mandal.realVoterCount !== undefined && mandal.realVoterCount > 0 ? mandal.realVoterCount : (mandal.voterCount || 0)).toLocaleString()}
                  </p>
                </div>
                <div className="p-1.5">
                  <p className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Booths</p>
                  <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {mandal.boothCount ? mandal.boothCount.toLocaleString() : '0'}
                  </p>
                </div>
                <div 
                  onClick={() => handleSelectMandalForMembers(mandal)}
                  className="cursor-pointer hover:bg-purple-50/60 dark:hover:bg-purple-950/30 p-1.5 rounded-lg transition-colors"
                  title="Click to view committees"
                >
                  <p className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Committees</p>
                  <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {getMandalCommitteeCount(mandal)}
                  </p>
                </div>
                <div className="p-1.5">
                  <p className="text-[9px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Members</p>
                  <p className="text-xs font-bold text-purple-600 dark:text-purple-400 mt-0.5">
                    {mandal.memberCount ? mandal.memberCount.toLocaleString() : '0'}
                  </p>
                </div>
              </div>

              {/* Inline Delete Confirmation */}
              <AnimatePresence>
                {deleteConfirmId === mandal.id && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-white/95 dark:bg-zinc-950/95 flex flex-col items-center justify-center p-6 text-center z-10"
                  >
                    <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
                    <h4 className="font-bold text-zinc-900 dark:text-zinc-100">Delete Mandal?</h4>
                    <p className="text-xs text-zinc-500 mt-1 max-w-[200px]">
                      This will permanently remove the "{mandal.name}" block. This action cannot be undone.
                    </p>
                    <div className="flex gap-2 mt-4">
                      <button
                        id={`cancel-delete-btn-${mandal.id}`}
                        onClick={() => setDeleteConfirmId('')}
                        className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded-lg text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        id={`confirm-delete-btn-${mandal.id}`}
                        onClick={() => handleDelete(mandal.id)}
                        className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal (for Table view) */}
      <AnimatePresence>
        {deleteConfirmId && viewMode === 'table' && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId('')}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center z-10"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4 border border-red-200 dark:border-red-800/40">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">Delete Mandal?</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
                Are you sure you want to permanently remove this Mandal block? All associated committee assignments will also be affected.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmId('')}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-xs sm:text-sm transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(deleteConfirmId)}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mandal Create / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div id="mandal-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto"
            >
              <button
                id="close-modal-btn"
                onClick={() => setIsModalOpen(false)}
                className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>

              <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Layers className="h-5 w-5 text-zinc-500" />
                {isEditMode ? 'Edit Mandal Parameters' : 'Register New Mandal'}
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Establish geographical metadata, target numbers, and leadership for this Mandal.
              </p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                {/* Supervising Admin for Super Admin */}
                {isSuperAdmin && (
                  <div className="p-3 bg-blue-50/50 dark:bg-blue-950/30 rounded-xl border border-blue-100 dark:border-blue-900/40">
                    <label className="block text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                      <Network className="h-3.5 w-3.5" /> Supervising Administrator (Admin Scope)
                    </label>
                    <select
                      id="form-admin-select"
                      value={formAdminId}
                      onChange={(e) => setFormAdminId(e.target.value)}
                      className="w-full px-3 py-2 border border-blue-200 dark:border-blue-800 bg-white dark:bg-zinc-900 text-xs font-bold text-blue-700 dark:text-blue-300 rounded-lg focus:outline-none"
                    >
                      <option value="">-- Current Admin / Self Scope --</option>
                      {admins.map(a => (
                        <option key={a.id || a.uid} value={String(a.id || a.uid)}>
                          {a.name || a.username || a.email} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Basic info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Mandal Name *
                    </label>
                    <input
                      id="mandal-name-input"
                      type="text"
                      required
                      placeholder="e.g. Rampur"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Mandal Code *
                    </label>
                    <input
                      id="mandal-code-input"
                      type="text"
                      required
                      placeholder="e.g. RMP-01"
                      value={mandalCode}
                      onChange={(e) => setMandalCode(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>
                </div>

                {/* Geography Mappings */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                    Administrative Mappings
                  </h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* State */}
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        State *
                      </label>
                      <select
                        id="form-state-select"
                        required
                        value={selectedState}
                        onChange={(e) => handleStateChange(e.target.value)}
                        className="w-full px-2 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg focus:outline-none"
                      >
                        <option value="">Select State</option>
                        {states.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* District */}
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        District *
                      </label>
                      <select
                        id="form-district-select"
                        required
                        value={selectedDistrict}
                        onChange={(e) => handleDistrictChange(e.target.value)}
                        className="w-full px-2 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg focus:outline-none"
                        disabled={!selectedState}
                      >
                        <option value="">Select District</option>
                        {districts.filter(d => d.stateId === selectedState).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Constituency */}
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        Constituency *
                      </label>
                      <select
                        id="form-constituency-select"
                        required
                        value={selectedConstituency}
                        onChange={(e) => setSelectedConstituency(e.target.value)}
                        className="w-full px-2 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg focus:outline-none"
                        disabled={!selectedDistrict}
                      >
                        <option value="">Select Constituency</option>
                        {constituencies.filter(c => c.districtId === selectedDistrict).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {/* President assignment */}
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 dark:border-zinc-800 pb-1">
                    Mandal President assignment
                  </h3>
                  
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                      Link Karyakarta / Volunteer Profile
                    </label>
                    <select
                      id="form-volunteer-select"
                      value={selectedVolunteerId}
                      onChange={(e) => handleVolunteerSelection(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 rounded-lg focus:outline-none"
                    >
                      <option value="custom">-- Enter custom President details manually --</option>
                      {volunteers.map(v => (
                        <option key={v.id} value={v.id}>{v.name} ({v.mobile})</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        President Name
                      </label>
                      <input
                        id="mandal-president-name"
                        type="text"
                        placeholder="Leader full name"
                        value={presidentName}
                        onChange={(e) => setPresidentName(e.target.value)}
                        disabled={selectedVolunteerId !== 'custom'}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none disabled:opacity-60"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1">
                        President Phone
                      </label>
                      <input
                        id="mandal-president-phone"
                        type="text"
                        placeholder="Mobile number"
                        value={presidentPhone}
                        onChange={(e) => setPresidentPhone(e.target.value)}
                        disabled={selectedVolunteerId !== 'custom'}
                        className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none disabled:opacity-60"
                      />
                    </div>
                  </div>
                </div>

                {/* Voter Count / Population metrics */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Voter Count
                    </label>
                    <input
                      id="mandal-voters-count"
                      type="number"
                      placeholder="e.g. 15000"
                      value={voterCount}
                      onChange={(e) => setVoterCount(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Total Population
                    </label>
                    <input
                      id="mandal-population-count"
                      type="number"
                      placeholder="e.g. 25000"
                      value={population}
                      onChange={(e) => setPopulation(e.target.value === '' ? '' : Number(e.target.value))}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
                  </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end gap-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    id="cancel-modal-btn"
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    id="save-mandal-btn"
                    type="submit"
                    className="flex items-center gap-1.5 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-sm font-semibold rounded-lg transition-colors"
                  >
                    <Save className="h-4 w-4" />
                    {isEditMode ? 'Save Changes' : 'Register Mandal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
        {/* MANDAL VOTERS INSPECTION MODAL */}
        {selectedMandalForVoters && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-5xl max-h-[90vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              {/* Modal Header */}
              <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Building2 size={22} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300">
                        {selectedMandalForVoters.mandalCode || 'MANDAL'}
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                        {selectedMandalForVoters.name}
                      </h3>
                    </div>
                    <p className="text-[11px] text-zinc-500 font-medium mt-0.5">
                      {selectedMandalForVoters.constituencyName && `Constituency: ${selectedMandalForVoters.constituencyName} • `}
                      {selectedMandalForVoters.districtName && `District: ${selectedMandalForVoters.districtName} • `}
                      {selectedMandalForVoters.stateName || 'State'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <a
                    href={`/voters?mandalId=${selectedMandalForVoters.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-all cursor-pointer"
                  >
                    <ExternalLink size={13} />
                    <span>Open in Directory</span>
                  </a>
                  <button
                    type="button"
                    onClick={() => setSelectedMandalForVoters(null)}
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>

              {/* Subheader KPI & Search Controls */}
              <div className="px-6 py-3 border-b border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/40 dark:bg-zinc-900/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setMandalVoterFilter('all')}
                    className={`px-2.5 py-1 rounded-lg font-extrabold border transition-colors ${
                      mandalVoterFilter === 'all'
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700'
                    }`}
                  >
                    Total: {mandalVoters.length} Voters
                  </button>
                  <button
                    onClick={() => setMandalVoterFilter('karyakarta')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      mandalVoterFilter === 'karyakarta'
                        ? 'bg-amber-600 text-white border-amber-600'
                        : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200/50'
                    }`}
                  >
                    ⭐ {mandalVoters.filter(v => v.isKaryakarta || v.is_karyakarta).length} Karyakartas
                  </button>
                  <button
                    onClick={() => setMandalVoterFilter('beneficiary')}
                    className={`px-2.5 py-1 rounded-lg font-bold border transition-colors ${
                      mandalVoterFilter === 'beneficiary'
                        ? 'bg-purple-600 text-white border-purple-600'
                        : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200/50'
                    }`}
                  >
                    🎁 {mandalVoters.filter(v => (v.benefitsCount || 0) > 0 || (v.benefits_count || 0) > 0).length} Beneficiaries
                  </button>
                </div>

                {/* Search Bar */}
                <div className="relative min-w-[220px]">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                  <input
                    type="text"
                    value={mandalVoterSearch}
                    onChange={e => setMandalVoterSearch(e.target.value)}
                    placeholder="Search Name, EPIC, Mobile..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Voter List Content */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
                {loadingMandalVoters ? (
                  <div className="py-16 text-center">
                    <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p className="text-xs font-bold text-zinc-400">Loading voters registered in this Mandal...</p>
                  </div>
                ) : (() => {
                  const query = mandalVoterSearch.toLowerCase().trim();
                  const filtered = mandalVoters.filter(v => {
                    if (mandalVoterFilter === 'karyakarta' && !v.isKaryakarta && !v.is_karyakarta) return false;
                    if (mandalVoterFilter === 'beneficiary' && (v.benefitsCount || 0) === 0 && (v.benefits_count || 0) === 0) return false;
                    if (mandalVoterFilter === 'voted' && !v.voted && v.votingStatus !== 'voted') return false;
                    if (!query) return true;
                    return (
                      (v.name || '').toLowerCase().includes(query) ||
                      (v.voterId || v.voter_id || '').toLowerCase().includes(query) ||
                      (v.mobile || '').includes(query) ||
                      (v.boothNumber || v.booth_number || '').toString().includes(query)
                    );
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="py-16 text-center border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl">
                        <Users className="mx-auto h-10 w-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">No voters found</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          {mandalVoterSearch ? 'Try a different search term or filter' : 'No electors currently assigned to this Mandal or its polling booths'}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-bold uppercase tracking-wider text-[10px]">
                          <tr>
                            <th className="px-4 py-3">Elector Info</th>
                            <th className="px-4 py-3">Booth</th>
                            <th className="px-4 py-3">Contact / Guardian</th>
                            <th className="px-4 py-3">Karyakarta Status</th>
                            <th className="px-4 py-3">Welfare Benefits</th>
                            <th className="px-4 py-3">Voting Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 font-medium">
                          {filtered.map(v => (
                            <tr key={v.id || v.voterId} className="hover:bg-zinc-50/80 dark:hover:bg-zinc-900/40 transition-colors">
                              <td className="px-4 py-3">
                                <div className="font-bold text-zinc-900 dark:text-zinc-100 text-xs">
                                  {v.name}
                                </div>
                                <div className="text-[11px] font-mono text-zinc-400 mt-0.5">
                                  EPIC: {v.voterId || v.voter_id || 'N/A'}
                                </div>
                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                  {v.gender ? `${v.gender} • ` : ''}Age: {v.age || 'N/A'}
                                </div>
                              </td>

                              <td className="px-4 py-3">
                                {v.boothNumber || v.booth_number ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200/50">
                                    Booth #{v.boothNumber || v.booth_number}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 text-[11px] italic">Not Assigned</span>
                                )}
                              </td>

                              <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                                <div className="flex items-center gap-1 font-mono text-xs">
                                  <Phone size={11} className="text-zinc-400" />
                                  <span>{v.mobile || 'No Mobile'}</span>
                                </div>
                                {v.relationName || v.relation_name ? (
                                  <div className="text-[10px] text-zinc-400 mt-0.5">
                                    S/o, D/o, W/o: {v.relationName || v.relation_name}
                                  </div>
                                ) : null}
                              </td>

                              <td className="px-4 py-3">
                                {v.isKaryakarta || v.is_karyakarta ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500 text-white shadow-sm">
                                    <Star size={10} className="fill-white" />
                                    <span>Active Karyakarta</span>
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 text-[11px]">General Voter</span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {(v.benefitsCount || 0) > 0 || (v.benefits_count || 0) > 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200/60">
                                    🎁 {v.benefitsCount || v.benefits_count} Schemes
                                    {(v.benefitsTotalAmount || v.benefits_total_amount) > 0 && ` (₹${Number(v.benefitsTotalAmount || v.benefits_total_amount).toLocaleString()})`}
                                  </span>
                                ) : (
                                  <span className="text-zinc-400 text-[11px]">None</span>
                                )}
                              </td>

                              <td className="px-4 py-3">
                                {v.voted || v.votingStatus === 'voted' ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                    <CheckCircle size={12} />
                                    <span>Voted</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] text-zinc-400">Not Voted</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 flex items-center justify-between">
                <span className="text-xs text-zinc-500">
                  Showing <strong className="text-zinc-800 dark:text-zinc-200">{mandalVoters.length}</strong> electors synchronized with Mandal
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedMandalForVoters(null)}
                  className="px-4 py-1.5 text-xs font-bold rounded-xl bg-zinc-200 hover:bg-zinc-300 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
