import React, { useState, useEffect } from 'react';
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
  Star
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
  population?: number;
  stateId: string;
  stateName?: string;
  districtId: string;
  districtName?: string;
  constituencyId: string;
  constituencyName?: string;
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
  adminId: string;
}

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

export default function MandalManagement() {
  const { user, isAdmin, hasPermission } = useAuth();

  // Permission rights check
  const canView = hasPermission('mandals', 'v');
  const canCreate = hasPermission('mandals', 'c');
  const canUpdate = hasPermission('mandals', 'u');
  const canDelete = hasPermission('mandals', 'd');

  // Component states
  const [mandals, setMandals] = useState<Mandal[]>([]);
  const [states, setStates] = useState<StateData[]>([]);
  const [districts, setDistricts] = useState<DistrictData[]>([]);
  const [constituencies, setConstituencies] = useState<ConstituencyData[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterDistrict, setFilterDistrict] = useState('all');
  const [filterConstituency, setFilterConstituency] = useState('all');

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

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState('');

  // --- MEMBER/LIST MANAGEMENT STATES ---
  const [selectedMandalForMembers, setSelectedMandalForMembers] = useState<Mandal | null>(null);
  const [members, setMembers] = useState<MandalMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [isMemberModalOpen, setIsMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<MandalMember | null>(null);
  
  // Member Form fields
  const [memberFormCategory, setMemberFormCategory] = useState('');
  const [memberFormName, setMemberFormName] = useState('');
  const [memberFormPhone, setMemberFormPhone] = useState('');
  const [memberFormVoterId, setMemberFormVoterId] = useState('');
  const [memberFormDesignation, setMemberFormDesignation] = useState('');
  
  // Voter list linkage search fields
  const [isVoterSearchOpen, setIsVoterSearchOpen] = useState(false);
  const [constituencyVoters, setConstituencyVoters] = useState<Voter[]>([]);
  const [voterSearching, setVoterSearching] = useState(false);
  const [voterSearchText, setVoterSearchText] = useState('');
  const [selectedVoterForLink, setSelectedVoterForLink] = useState<Voter | null>(null);

  // Active expanded list key in members detail view
  const [expandedCategoryKey, setExpandedCategoryKey] = useState<string | null>('office_bearers');

  // Fetch initial configuration / metadata
  useEffect(() => {
    const loadStaticData = async () => {
      try {
        setLoading(true);
        setError('');

        // 1. Fetch States
        const statesList = await api.get<StateData[]>('/api/states').catch(() => []);
        setStates(statesList);

        // 2. Fetch Districts
        const districtsList = await api.get<DistrictData[]>('/api/districts').catch(() => []);
        setDistricts(districtsList);

        // 3. Fetch Constituencies
        const constituenciesList = await api.get<ConstituencyData[]>('/api/constituencies').catch(() => []);
        setConstituencies(constituenciesList);

        // 4. Fetch Volunteers/Karyakartas for President assignment
        const volList = await api.get<Volunteer[]>('/api/volunteers').catch(() => []);
        setVolunteers(volList);
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

  // Fetch Mandals from SQL API
  const fetchMandals = async () => {
    try {
      setLoading(true);
      setError('');
      
      const list = await api.get<Mandal[]>('/api/mandals');
      setMandals(list.map((m: any) => ({
        ...m,
        mandalCode: m.mandal_code || m.mandalCode,
        presidentName: m.president_name || m.presidentName,
        presidentPhone: m.president_phone || m.presidentPhone,
        voterCount: m.voter_count !== undefined ? m.voter_count : m.voterCount,
        population: m.population,
        stateId: m.state_id || m.stateId,
        districtId: m.district_id || m.districtId,
        constituencyId: m.constituency_id || m.constituencyId,
        constituencyName: m.constituency_name || m.constituencyName
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
  }, [user, canView]);

  // Fetch members for a specific Mandal
  const fetchMandalMembers = async (mandalId: string) => {
    try {
      setMembersLoading(true);
      const list = await api.get<MandalMember[]>(`/api/mandals/${mandalId}/members`);
      setMembers(list.map((item: any) => ({
        ...item,
        categoryKey: item.category_key || item.categoryKey,
        voterId: item.voter_id || item.voterId
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
        id: d.id,
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
  };

  // Handle Volunteer/Karyakarta President assignment selection
  const handleVolunteerSelection = (val: string) => {
    setSelectedVolunteerId(val);
    if (val === 'custom') {
      setName('');
    } else {
      const selectedVol = volunteers.find(v => v.id === val);
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
      
      const matchedVol = volunteers.find(v => v.name === mandal.presidentName && v.mobile === mandal.presidentPhone);
      setSelectedVolunteerId(matchedVol ? matchedVol.id : 'custom');
    } else {
      setIsEditMode(false);
      setEditingId('');
      setName('');
      setMandalCode('');
      setPresidentName('');
      setPresidentPhone('');
      setVoterCount('');
      setPopulation('');
      setSelectedState('');
      setSelectedDistrict('');
      setSelectedConstituency('');
      setSelectedVolunteerId('custom');
    }
    setIsModalOpen(true);
  };

  // Handle Mandal Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !mandalCode.trim() || !selectedState || !selectedDistrict || !selectedConstituency) {
      setError('Please complete all required fields.');
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
        constituency_id: selectedConstituency
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
    } catch (err: unknown) {
      setError('Failed to persist Mandal details.');
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
    } catch (err: unknown) {
      setError('Failed to delete Mandal.');
    }
  };

  // --- MEMBER LIST OPERATIONS ---

  // Open modal to add/edit a list member inside a Mandal category
  const openMemberModal = (categoryKey: string, member?: MandalMember) => {
    setMemberFormCategory(categoryKey);
    setSelectedVoterForLink(null);
    setVoterSearchText('');
    
    if (member) {
      setEditingMember(member);
      setMemberFormName(member.name);
      setMemberFormPhone(member.phone || '');
      setMemberFormVoterId(member.voterId || '');
      setMemberFormDesignation(member.designation || '');
    } else {
      setEditingMember(null);
      setMemberFormName('');
      setMemberFormPhone('');
      setMemberFormVoterId('');
      
      const matchedCat = MANDAL_CATEGORIES.find(c => c.key === categoryKey);
      setMemberFormDesignation(matchedCat ? matchedCat.englishLabel : '');
    }
    setIsMemberModalOpen(true);
  };

  // Handle linking selected voter from list
  const handleLinkVoter = (voter: Voter) => {
    setSelectedVoterForLink(voter);
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

      await api.post(`/api/mandals/${selectedMandalForMembers.id}/members`, payload);
      setSuccess('Member added to list successfully.');

      setIsMemberModalOpen(false);
      fetchMandalMembers(selectedMandalForMembers.id);
    } catch (err) {
      console.error('Error saving member:', err);
      setError('Failed to save list member.');
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
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg uppercase tracking-wider">
                  {selectedMandalForMembers.mandalCode}
                </span>
                <span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {selectedMandalForMembers.constituencyName} Constituency
                </span>
              </div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50 mt-2">
                {selectedMandalForMembers.name} Mandal Roster
              </h2>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
                Configure official committees, assign convenors, and track leader compliance counts across the 8 standard administrative directories.
              </p>
            </div>
            
            <div className="grid grid-cols-2 gap-4 text-center bg-zinc-50 dark:bg-zinc-950 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800/40">
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Commitee Members</span>
                <p className="text-xl font-extrabold text-zinc-800 dark:text-zinc-100 mt-1">
                  {members.length} / 146
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Completion Rate</span>
                <p className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">
                  {Math.round((members.length / 146) * 100)}%
                </p>
              </div>
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
            
            {/* Left Column: List of 8 categories with progress bars */}
            <div className="lg:col-span-5 space-y-3">
              <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider px-1">
                8 Core Directories
              </h3>
              
              {MANDAL_CATEGORIES.map((category, idx) => {
                const categoryMembers = members.filter(m => m.categoryKey === category.key);
                const count = categoryMembers.length;
                const percent = Math.min(100, Math.round((count / category.targetCount) * 100));
                const isSelected = expandedCategoryKey === category.key;
                const Icon = category.icon;

                return (
                  <button
                    key={category.key}
                    onClick={() => setExpandedCategoryKey(category.key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between gap-3 ${
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
                          <p className="text-[10px] font-bold text-zinc-400 tracking-wide uppercase">
                            Category {idx + 1}
                          </p>
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
                        <span>{category.targetCount - count} Needed</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Right Column: Assigned members of the selected category */}
            <div className="lg:col-span-7">
              {expandedCategoryKey && (() => {
                const activeCat = MANDAL_CATEGORIES.find(c => c.key === expandedCategoryKey);
                if (!activeCat) return null;
                const activeMembers = members.filter(m => m.categoryKey === expandedCategoryKey);
                const Icon = activeCat.icon;

                return (
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6 space-y-6">
                    {/* Active category header info */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-5 gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${activeCat.colorClass}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="text-lg font-extrabold text-zinc-800 dark:text-zinc-100">
                            {activeCat.label}
                          </h3>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-0.5">
                            {activeCat.englishLabel}
                          </p>
                        </div>
                      </div>

                      {canUpdate && (
                        <button
                          id="add-member-btn"
                          onClick={() => openMemberModal(activeCat.key)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 text-xs font-bold rounded-lg transition-colors shadow-sm"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Add Member
                        </button>
                      )}
                    </div>

                    {/* Member rows list */}
                    {activeMembers.length === 0 ? (
                      <div className="text-center py-16 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                        <User className="h-10 w-10 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                        <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No members assigned yet</p>
                        <p className="text-xs text-zinc-400 mt-0.5 max-w-xs mx-auto">
                          Assign active volunteers or link voters directly from the constituency to fill the target quota of {activeCat.targetCount} members.
                        </p>
                        {canUpdate && (
                          <button
                            onClick={() => openMemberModal(activeCat.key)}
                            className="mt-4 px-3.5 py-1.5 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-xs font-bold rounded-lg text-zinc-700 dark:text-zinc-300 transition-colors"
                          >
                            Assign First Member
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {activeMembers.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800/40 rounded-xl hover:shadow-sm transition-shadow"
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-9 w-9 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center font-bold text-zinc-600 dark:text-zinc-300 text-sm">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h5 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">
                                  {member.name}
                                </h5>
                                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-0.5 text-xs text-zinc-400">
                                  {member.designation && (
                                    <span className="font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                      <Star className="h-3 w-3 text-amber-500 shrink-0 fill-amber-500" />
                                      {member.designation}
                                    </span>
                                  )}
                                  {member.phone && (
                                    <span className="flex items-center gap-1">
                                      <Phone className="h-3 w-3 shrink-0" />
                                      {member.phone}
                                    </span>
                                  )}
                                  {member.voterId && (
                                    <span className="px-1.5 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 rounded-md font-mono font-bold uppercase shrink-0">
                                      EPIC: {member.voterId}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Remove button */}
                            {canUpdate && (
                              <div className="flex items-center gap-2">
                                <button
                                  id={`edit-member-btn-${member.id}`}
                                  onClick={() => openMemberModal(activeCat.key, member)}
                                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 rounded-lg transition-colors"
                                  title="Edit member designation/phone"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  id={`remove-member-btn-${member.id}`}
                                  onClick={() => handleDeleteMember(member.id)}
                                  className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg transition-colors"
                                  title="Remove from list"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>

          </div>
        )}

        {/* MEMBER DETAILS / REGISTER MODAL */}
        <AnimatePresence>
          {isMemberModalOpen && (
            <div id="member-form-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md p-6 relative"
              >
                <button
                  id="close-member-modal-btn"
                  onClick={() => setIsMemberModalOpen(false)}
                  className="absolute right-4 top-4 p-1 rounded-full text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="h-5 w-5" />
                </button>

                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-zinc-500" />
                  {editingMember ? 'Edit Member Assignment' : 'Assign New Member'}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Assign a voter to the directory list or write down custom profile fields.
                </p>

                <form onSubmit={handleSaveMember} className="mt-6 space-y-4">
                  {/* Link existing voter action */}
                  {!editingMember && (
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
                    <label className="block text-xs font-semibold text-zinc-600 dark:text-zinc-400 uppercase tracking-wider mb-1.5">
                      Official Designation / Title
                    </label>
                    <input
                      id="member-form-designation-input"
                      type="text"
                      placeholder="e.g. Mandal Secretary"
                      value={memberFormDesignation}
                      onChange={(e) => setMemberFormDesignation(e.target.value)}
                      className="w-full px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-sm text-zinc-900 dark:text-zinc-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-400"
                    />
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

  // Otherwise, default main Grid of Mandals
  return (
    <div id="mandal-management-container" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
            <Layers className="h-6 w-6 text-zinc-600 dark:text-zinc-400" />
            Mandal Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Create, manage, and assign leaders to administrative blocks (Mandals) mapped directly to your constituency.
          </p>
        </div>
        {canCreate && (
          <button
            id="create-mandal-btn"
            onClick={() => openModal()}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-950 font-medium rounded-lg shadow transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create Mandal
          </button>
        )}
      </div>

      {/* Notifications */}
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

      {/* KPI Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Mandals</span>
            <Layers className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">{mandals.length}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Total Active Presidents</span>
            <User className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">
            {mandals.filter(m => m.presidentName).length}
          </p>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-xl shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Target Voters Tracked</span>
            <Users className="h-5 w-5 text-zinc-400" />
          </div>
          <p className="text-2xl font-bold mt-2 text-zinc-900 dark:text-zinc-50">
            {mandals.reduce((acc, curr) => acc + (curr.voterCount || 0), 0).toLocaleString()}
          </p>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <input
            id="search-input"
            type="text"
            placeholder="Search by Mandal name, code, president..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-transparent"
          />
        </div>
        <div className="flex flex-wrap gap-4">
          <select
            id="state-filter"
            value={filterState}
            onChange={(e) => { setFilterState(e.target.value); setFilterDistrict('all'); setFilterConstituency('all'); }}
            className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none"
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
            className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none"
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
            className="px-3 py-2 border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-sm text-zinc-700 dark:text-zinc-300 focus:outline-none"
            disabled={filterDistrict === 'all'}
          >
            <option value="all">All Constituencies</option>
            {constituencies.filter(c => c.districtId === filterDistrict).map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Mandal Roster Grid */}
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
      ) : (
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
                    <span className="text-xs font-semibold px-2 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                      {mandal.mandalCode}
                    </span>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50 mt-2">{mandal.name}</h3>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {canUpdate && (
                      <button
                        id={`edit-mandal-btn-${mandal.id}`}
                        onClick={() => openModal(mandal)}
                        className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200 rounded-lg transition-colors"
                        title="Edit Mandal Parameters"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        id={`delete-mandal-btn-${mandal.id}`}
                        onClick={() => setDeleteConfirmId(mandal.id)}
                        className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/20 text-zinc-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 rounded-lg transition-colors"
                        title="Delete Mandal"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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

              {/* Roster & Directory lists quick button */}
              <div className="mt-5">
                <button
                  id={`manage-lists-btn-${mandal.id}`}
                  onClick={() => handleSelectMandalForMembers(mandal)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-all"
                >
                  <Layers className="h-4 w-4" />
                  Manage 8 Core Lists
                </button>
              </div>

              {/* Stats / Numbers */}
              <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-2 gap-4 text-center">
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Registered Voters</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {mandal.voterCount !== undefined && mandal.voterCount !== null ? mandal.voterCount.toLocaleString() : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-medium text-zinc-400 dark:text-zinc-500 uppercase">Population</p>
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                    {mandal.population !== undefined && mandal.population !== null ? mandal.population.toLocaleString() : 'N/A'}
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
      </AnimatePresence>
    </div>
  );
}
