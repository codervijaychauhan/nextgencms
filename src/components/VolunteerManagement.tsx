import React, { useState, useEffect } from 'react';
import { 
  Plus, Users, Search, CheckCircle, X, 
  Trash2, MapPin, RefreshCw, AlertCircle, User, Eye
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

interface BaseVoter {
  id: string;
  voterId: string;
  name: string;
  aadharNumber?: string;
  mobile?: string;
  stateId: string;
  districtId: string;
  constituencyId: string;
  boothId: string;
}

interface Volunteer {
  id: string;
  voterDocId: string;
  voterId: string; // EPIC No
  name: string;
  aadharNumber?: string;
  mobile?: string;
  adminId: string; // Isolated to the admin who added them
  status: 'Active' | 'Inactive';
  tasks: Array<{
    id: string;
    title: string;
    description: string;
    status: 'Pending' | 'In Progress' | 'Completed';
    createdAt: unknown;
  }>;
  assignedBoothId?: string; // Loaded dynamically
  assignedBoothName?: string;
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  boothId?: string;
  createdAt: unknown;
}

interface BoothAssignment {
  id: string;
  adminId: string;
  boothId: string;
  boothNumber: string;
  boothName: string;
  agentVolunteerDocId: string;
  agentName: string;
  agentAadhar?: string;
  agentMobile?: string;
  designation?: string;
}

interface IndiaState { id: string; name: string; }
interface IndiaDistrict { id: string; name: string; stateId: string; }
interface IndiaConstituency { id: string; name: string; districtId: string; }
interface IndiaBooth { id: string; name: string; boothNumber?: string; constituencyId: string; }

export default function VolunteerManagement() {
  const { user, isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };
  
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [boothAssignments, setBoothAssignments] = useState<BoothAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<{ uid: string; username: string; email: string; role: string }[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('All');

  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);

  useEffect(() => {
    if (!user) return;
    const fetchDemoData = async () => {
      try {
        const [statesData, districtsData, constData, boothsData] = await Promise.all([
          api.get<IndiaState[]>('/api/states'),
          api.get<IndiaDistrict[]>('/api/districts'),
          api.get<IndiaConstituency[]>('/api/constituencies'),
          api.get<IndiaBooth[]>('/api/booths')
        ]);
        setStates(statesData || []);
        setDistricts(districtsData || []);
        setConstituencies(constData || []);
        setBooths(boothsData || []);
      } catch (err) {
        console.error("Failed to load demographics for lookup:", err);
      }
    };
    fetchDemoData();
  }, [user]);

  const getBelongingDemographics = (v: Volunteer) => {
    if (!v.stateId && !v.districtId && !v.constituencyId && !v.boothId) {
      return null;
    }
    const stateName = states.find(s => s.id === v.stateId)?.name || '';
    const districtName = districts.find(d => d.id === v.districtId)?.name || '';
    const constituencyName = constituencies.find(c => c.id === v.constituencyId)?.name || '';
    const boothObj = booths.find(b => b.id === v.boothId);
    
    return {
      state: stateName,
      district: districtName,
      constituency: constituencyName,
      boothName: boothObj?.name || '',
      boothNumber: boothObj?.boothNumber || ''
    };
  };

  const getVolunteerBoothAssignments = (volunteerId: string) => {
    return boothAssignments.filter(a => a.agentVolunteerDocId === volunteerId);
  };

  // Load high-privilege users specifically for the Admin dropdown filter
  useEffect(() => {
    if (!user || !hasRight('volunteers', 'v')) {
      setAdminUsers([]);
      return;
    }
    const fetchAdmins = async () => {
      try {
        const users = await api.get<any[]>('/api/users');
        const list: { uid: string; username: string; email: string; role: string }[] = [];
        users.forEach(u => {
          const r = u.role || 'guest';
          if (['super_admin', 'admin', 'manager', 'volunteer'].includes(r)) {
            list.push({
              uid: u.id,
              username: u.username || u.name || u.email?.split('@')[0] || 'Unknown User',
              email: u.email || '',
              role: r
            });
          }
        });
        setAdminUsers(list);
      } catch (err) {
        console.error("Failed to load users for admin-based filter:", err);
      }
    };
    fetchAdmins();
  }, [user, isAdmin, profile]);

  // Load Booth Assignments
  useEffect(() => {
    if (!user) return;
    const fetchAssignments = async () => {
      try {
        const data = await api.get<any[]>('/api/booths/agents');
        setBoothAssignments(data || []);
      } catch (err) {
        console.error("Failed to fetch booth assignments:", err);
      }
    };
    fetchAssignments();
  }, [user, isAdmin, profile]);

  // Search/Select Voter to recruit
  const [isRecruitOpen, setIsRecruitOpen] = useState(false);
  const [voterSearch, setVoterSearch] = useState('');
  const [searchingVoters, setSearchingVoters] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<BaseVoter | null>(null);
  const [allAllowedVoters, setAllAllowedVoters] = useState<BaseVoter[]>([]);

  // New Volunteer Details Form
  const [volunteerStatus, setVolunteerStatus] = useState<'Active' | 'Inactive'>('Active');

  // Task assignment form
  const [activeVolunteerForTask, setActiveVolunteerForTask] = useState<Volunteer | null>(null);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDescription, setTaskDescription] = useState('');

  const liveVolunteerForTask = activeVolunteerForTask 
    ? (volunteers.find(vol => vol.id === activeVolunteerForTask.id) || activeVolunteerForTask) 
    : null;

  // Volunteer digital profile view state (linked dynamically)
  const [selectedVolunteerForView, setSelectedVolunteerForView] = useState<Volunteer | null>(null);
  const liveVolunteerForView = selectedVolunteerForView 
    ? (volunteers.find(vol => vol.id === selectedVolunteerForView.id) || selectedVolunteerForView) 
    : null;

  // Volunteer deletion state
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const fetchVolunteers = async () => {
    try {
      setLoading(true);
      const data = await api.get<any[]>('/api/volunteers');
      const list: Volunteer[] = (data || []).map(d => ({
        id: d.id,
        voterDocId: d.voterDocId || d.voter_doc_id || '',
        voterId: d.voterId || d.voter_id || '',
        name: d.name || '',
        aadharNumber: d.aadharNumber || d.aadhar_number || '',
        mobile: d.mobile || '',
        adminId: d.adminId || d.admin_id || '',
        status: d.status || 'Active',
        stateId: d.stateId || d.state_id || '',
        districtId: d.districtId || d.district_id || '',
        constituencyId: d.constituencyId || d.constituency_id || '',
        boothId: d.boothId || d.booth_id || '',
        tasks: d.tasks || [],
        assignedBoothId: d.assignedBoothId || d.assigned_booth_id || '',
        assignedBoothName: d.assignedBoothName || d.assigned_booth_name || 'No Booth Assigned',
        createdAt: d.createdAt || d.created_at
      }));
      setVolunteers(list);
    } catch (err: any) {
      console.error(err);
      setError('Failed to fetch Karyakarta roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchVolunteers();
  }, [user, isAdmin, profile, refreshTrigger]);

  // Load permitted voters when recruitment portal opens
  useEffect(() => {
    if (isRecruitOpen && user) {
      const loadAllVoters = async () => {
        setSearchingVoters(true);
        setError('');
        try {
          const votersData = await api.get<any[]>('/api/voters?pageSize=500');
          const list: BaseVoter[] = (votersData || []).map((d: any) => ({
            id: d.id,
            voterId: d.voterId || '',
            name: d.name || '',
            aadharNumber: d.aadharNumber || '',
            mobile: d.mobile || '',
            stateId: d.stateId || '',
            districtId: d.districtId || '',
            constituencyId: d.constituencyId || '',
            boothId: d.boothId || ''
          }));
          setAllAllowedVoters(list);
        } catch (err) {
          console.error("Error fetching voters list for recruitment:", err);
          setError("Failed to fetch constituency voters list.");
        } finally {
          setSearchingVoters(false);
        }
      };
      
      loadAllVoters();
    } else {
      setAllAllowedVoters([]);
      setVoterSearch('');
    }
  }, [isRecruitOpen, user, profile, isAdmin]);

  // Compute live match filtering in real time
  const filteredVotersToRecruit = React.useMemo(() => {
    const unrecruited = allAllowedVoters.filter(
      mv => !volunteers.some(vol => vol.voterDocId === mv.id)
    );

    const s = voterSearch.toLowerCase().trim();
    if (!s) {
      return unrecruited.slice(0, 15); // Return top 15 initially
    }

    return unrecruited.filter(v => {
      return (
        (v.voterId || '').toLowerCase().includes(s) ||
        (v.name || '').toLowerCase().includes(s) ||
        (v.mobile || '').toLowerCase().includes(s) ||
        (v.aadharNumber || '').toLowerCase().includes(s)
      );
    });
  }, [allAllowedVoters, voterSearch, volunteers]);

  const handleRecruitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter || !user) return;
    if (!hasRight('volunteers', 'c')) {
      setError("You do not have permission to recruit Karyakartas.");
      return;
    }

    try {
      const newVolunteerData = {
        voterDocId: selectedVoter.id,
        voterId: selectedVoter.voterId,
        name: selectedVoter.name,
        aadharNumber: selectedVoter.aadharNumber || '',
        mobile: selectedVoter.mobile || '',
        adminId: user.uid,
        status: volunteerStatus,
        stateId: selectedVoter.stateId || '',
        districtId: selectedVoter.districtId || '',
        constituencyId: selectedVoter.constituencyId || '',
        boothId: selectedVoter.boothId || '',
        tasks: []
      };

      await api.post('/api/volunteers', newVolunteerData);

      setSuccess(`Recruited ${selectedVoter.name} as a Karyakarta!`);
      setIsRecruitOpen(false);
      setSelectedVoter(null);
      setVoterSearch('');
      fetchVolunteers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to recruit volunteer');
    }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeVolunteerForTask || !taskTitle.trim()) return;
    if (!hasRight('volunteers', 'u')) {
      setError("You do not have permission to assign tasks.");
      return;
    }

    try {
      const newTask = {
        id: Math.random().toString(36).substring(2, 9),
        title: taskTitle,
        description: taskDescription,
        status: 'Pending' as const,
        createdAt: new Date().toISOString()
      };

      const updatedTasks = [...(activeVolunteerForTask.tasks || []), newTask];
      await api.put(`/api/volunteers/${activeVolunteerForTask.id}`, {
        tasks: updatedTasks
      });

      setSuccess(`Task assigned to ${activeVolunteerForTask.name}`);
      setTaskTitle('');
      setTaskDescription('');
      fetchVolunteers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to assign task.');
    }
  };

  const handleToggleTaskStatus = async (volunteer: Volunteer, taskId: string) => {
    if (!hasRight('volunteers', 'u')) {
      setError("You do not have permission to toggle task status.");
      return;
    }
    const updatedTasks = volunteer.tasks.map(t => {
      if (t.id === taskId) {
        const nextStatus = t.status === 'Pending' ? 'In Progress' : t.status === 'In Progress' ? 'Completed' : 'Pending';
        return { ...t, status: nextStatus };
      }
      return t;
    });

    try {
      await api.put(`/api/volunteers/${volunteer.id}`, {
        tasks: updatedTasks
      });
      fetchVolunteers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveTask = async (volunteer: Volunteer, taskId: string) => {
    if (!hasRight('volunteers', 'u')) {
      setError("You do not have permission to remove tasks.");
      return;
    }
    const updatedTasks = volunteer.tasks.filter(t => t.id !== taskId);
    try {
      await api.put(`/api/volunteers/${volunteer.id}`, {
        tasks: updatedTasks
      });
      fetchVolunteers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleStatus = async (volunteer: Volunteer) => {
    if (!hasRight('volunteers', 'u')) {
      setError("You do not have permission to change active status.");
      return;
    }
    const nextStatus = volunteer.status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.put(`/api/volunteers/${volunteer.id}`, {
        status: nextStatus
      });
      fetchVolunteers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveVolunteer = async (volunteerId: string) => {
    if (!hasRight('volunteers', 'd')) {
      setError("You do not have permission to remove Karyakartas.");
      return;
    }
    const vol = volunteers.find(v => v.id === volunteerId);
    if (!vol) return;
    try {
      // Update local state immediately for instant feedback
      setVolunteers(prev => prev.filter(v => v.id !== volunteerId));
      setDeletingId(null);
      setSuccess(`Karyakarta ${vol.name} removed from your team.`);
      
      await api.delete(`/api/volunteers/${volunteerId}`);
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to remove Karyakarta.');
    }
  };

  // Derive allowed volunteers based on logged-in user's assigned scopes from User Management
  const allowedVolunteers = React.useMemo(() => {
    if (isAdmin) {
      return volunteers;
    }

    const allowedStateIds = profile?.stateId ? profile.stateId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const allowedDistrictIds = profile?.districtId ? profile.districtId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const allowedConstituencyIds = profile?.constituencyId ? profile.constituencyId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
    const allowedBoothIds = profile?.boothId ? profile.boothId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];

    const hasAnyScope = allowedStateIds.length > 0 || allowedDistrictIds.length > 0 || allowedConstituencyIds.length > 0 || allowedBoothIds.length > 0;

    if (!hasAnyScope) {
      // Default fallback: only items they personally added
      return volunteers.filter(v => v.adminId === user?.uid);
    }

    return volunteers.filter(v => {
      // Always allow if they recruited them
      if (v.adminId === user?.uid) return true;

      // Geographic matching
      if (allowedStateIds.length > 0 && v.stateId && !allowedStateIds.includes(v.stateId)) return false;
      if (allowedDistrictIds.length > 0 && v.districtId && !allowedDistrictIds.includes(v.districtId)) return false;
      if (allowedConstituencyIds.length > 0 && v.constituencyId && !allowedConstituencyIds.includes(v.constituencyId)) return false;
      if (allowedBoothIds.length > 0 && v.boothId && !allowedBoothIds.includes(v.boothId)) return false;

      return true;
    });
  }, [volunteers, profile, isAdmin, user]);

  // Derive volunteers filtered by Admin selection (Super Admin & Admin feature)
  const volunteersFilteredByAdmin = React.useMemo(() => {
    const listToFilter = allowedVolunteers;
    if (selectedAdminId === 'All') {
      return listToFilter;
    }
    return listToFilter.filter(v => v.adminId === selectedAdminId);
  }, [allowedVolunteers, selectedAdminId]);

  // Precompute how many volunteers are logged under each admin
  const adminCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    allowedVolunteers.forEach(v => {
      counts[v.adminId] = (counts[v.adminId] || 0) + 1;
    });
    return counts;
  }, [allowedVolunteers]);

  // Metrics
  const totalVolunteers = volunteersFilteredByAdmin.length;
  const activeVolunteers = volunteersFilteredByAdmin.filter(v => v.status === 'Active').length;
  const totalTasksAssigned = volunteersFilteredByAdmin.reduce((acc, curr) => acc + (curr.tasks?.length || 0), 0);
  const completedTasks = volunteersFilteredByAdmin.reduce((acc, curr) => acc + (curr.tasks?.filter(t => t.status === 'Completed').length || 0), 0);

  // Instantly filter the Karyakartas list
  const filteredVolunteers = volunteersFilteredByAdmin.filter(v => {
    const searchLower = rosterSearch.toLowerCase().trim();
    if (!searchLower) return true;
    
    // Check dynamic live assignments for assignments matching this volunteer
    const liveAsgs = getVolunteerBoothAssignments(v.id);
    const matchesLiveAsgs = liveAsgs.some(asg => 
      (asg.boothName || '').toLowerCase().includes(searchLower) || 
      (asg.boothNumber || '').toLowerCase().includes(searchLower) || 
      (asg.designation || '').toLowerCase().includes(searchLower)
    );

    return (
      (v.name || '').toLowerCase().includes(searchLower) ||
      (v.voterId || '').toLowerCase().includes(searchLower) ||
      (v.mobile || '').toLowerCase().includes(searchLower) ||
      (v.assignedBoothName || '').toLowerCase().includes(searchLower) ||
      matchesLiveAsgs
    );
  });

  if (!hasRight('volunteers', 'v')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
        <Users className="text-zinc-300 dark:text-zinc-700 w-16 h-16 min-h-16 mb-4" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">Permission Required</h3>
        <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
          You do not have view permissions for the <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Karyakartas Roster</strong>. Please contact your Super Admin to obtain permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl shadow-sm">
        <div>
          <h1 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2 tracking-tight">
            <Users className="text-blue-500" />
            Karyakarta Management
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Recruit active Karyakartas directly from the Voter list, manage tasks, and monitor active campaign performance.
          </p>
        </div>
        {hasRight('volunteers', 'c') && (
          <button 
            onClick={() => setIsRecruitOpen(true)}
            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all shadow-md active:scale-95"
          >
            <Plus size={16} />
            Recruit Karyakarta
          </button>
        )}
      </div>

      {/* Stats Board */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Total Karyakartas</p>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{totalVolunteers}</h2>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 inline-block">Registered to your team</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Active Staff</p>
          <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{activeVolunteers}</h2>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 inline-block">{totalVolunteers - activeVolunteers} inactive</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Tasks Assigned</p>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{totalTasksAssigned}</h2>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 inline-block">{completedTasks} completed successfully</span>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl text-xs text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-center gap-2 p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Volunteers Table / List */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Karyakarta Team Roster</h3>
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto lg:justify-end">
            {/* Admin selector filter */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <User size={13} />
                  <span className="uppercase text-[9px] tracking-wider font-bold">Admin:</span>
                </div>
                <select
                  value={selectedAdminId}
                  onChange={e => setSelectedAdminId(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-bold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 min-w-[160px] h-9"
                >
                  <option value="All">All Admins ({allowedVolunteers.length})</option>
                  {adminUsers
                    .filter(u => {
                      if (isAdmin) return true;
                      return allowedVolunteers.some(v => v.adminId === u.uid) || u.uid === user?.uid;
                    })
                    .map(u => {
                      const count = adminCounts[u.uid] || 0;
                      return (
                        <option key={u.uid} value={u.uid}>
                          {u.uid === user?.uid ? 'Me' : u.username} ({count})
                        </option>
                      );
                    })}
                </select>
              </div>
            )}

            {/* Roster Search Bar */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 text-zinc-400" size={14} />
              <input 
                type="text" 
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
                placeholder="Instant filter Karyakartas..."
                className="webapp-input w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
              />
            </div>
            <button onClick={fetchVolunteers} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all shrink-0">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-400">Synchronizing team roster...</p>
          </div>
        ) : volunteers.length === 0 ? (
          <div className="py-16 text-center">
            <Users size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
            <p className="text-sm font-bold text-zinc-400">Your Karyakarta roster is empty</p>
            <p className="text-xs text-zinc-500 mt-1">Start by recruiting active Karyakartas from your authorized voters list.</p>
            <button 
              onClick={() => setIsRecruitOpen(true)}
              className="mt-4 inline-flex items-center gap-1.5 bg-blue-600 text-white font-bold text-[10px] uppercase tracking-wider px-3.5 py-2 rounded-lg"
            >
              <Plus size={12} /> Recruitment Portal
            </button>
          </div>
        ) : filteredVolunteers.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2 whitespace-pre-wrap" />
            <p className="text-sm font-bold text-zinc-400">No matching Karyakartas found</p>
            <p className="text-xs text-zinc-500 mt-1">Try refining your search terms or search by different parameters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                  <th className="px-6 py-4">Karyakarta Detail</th>
                  <th className="px-6 py-4">Mobile</th>
                  <th className="px-6 py-4">Deployments & Info</th>
                  <th className="px-6 py-4">Home/Belonging Booth</th>
                  <th className="px-6 py-4">Active Status</th>
                  <th className="px-6 py-4">Workflow Tasks</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {filteredVolunteers.map(v => (
                  <tr key={v.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all text-xs">
                    <td className="px-6 py-4">
                      <div className="font-bold text-zinc-900 dark:text-zinc-100 leading-normal">{v.name}</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-700 dark:text-zinc-300 font-mono font-bold">
                      {v.mobile || '—'}
                    </td>
                    <td className="px-6 py-4 leading-normal">
                      <div className="flex flex-col gap-1.5 items-start">
                        {(() => {
                          const activeAsgs = getVolunteerBoothAssignments(v.id);
                          if (activeAsgs.length === 0) {
                            return (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                Unassigned Agent
                              </span>
                            );
                          }
                          const firstAsg = activeAsgs[0];
                          return (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                {firstAsg.designation || 'Booth President'}
                              </span>
                              {activeAsgs.length > 1 && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-black bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
                                  +{activeAsgs.length - 1} More
                                </span>
                              )}
                            </div>
                          );
                        })()}
                        
                        <button
                          onClick={() => setSelectedVolunteerForView(v)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50/50 hover:bg-blue-50 dark:bg-blue-955/10 dark:hover:bg-blue-950/20 rounded-lg border border-blue-100/50 dark:border-blue-900/30 transition-all shadow-3xs cursor-pointer"
                        >
                          <Eye size={11} />
                          <span>View Info & Booths</span>
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-zinc-550 leading-normal">
                      {(() => {
                        const demo = getBelongingDemographics(v);
                        if (!demo) return <span className="text-zinc-400 dark:text-zinc-650 italic">No Demographics</span>;
                        return (
                          <div className="text-[10px] text-zinc-700 dark:text-zinc-300 font-semibold space-y-0.5 font-sans">
                            <div className="text-zinc-800 dark:text-zinc-200 font-bold leading-tight flex items-center gap-1">
                              <span>🏠</span>
                              <span>{demo.boothName || 'Unknown'} {demo.boothNumber ? `(No. ${demo.boothNumber})` : ''}</span>
                            </div>
                            <div className="text-[9px] text-zinc-400 font-medium leading-tight">
                              {demo.constituency && <span>{demo.constituency}</span>}
                              {demo.district && <span> • {demo.district}</span>}
                              {demo.state && <span> • {demo.state}</span>}
                            </div>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {hasRight('volunteers', 'u') ? (
                        <button 
                          onClick={() => handleToggleStatus(v)}
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border transition-all hover:opacity-85 ${
                            v.status === 'Active' 
                              ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200' 
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200'
                          }`}
                        >
                          {v.status}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border opacity-60 ${
                          v.status === 'Active' 
                            ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200' 
                            : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border-zinc-200'
                        }`}>
                          {v.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const total = v.tasks?.length || 0;
                        const completed = (v.tasks || []).filter(t => t.status === 'Completed').length;
                        
                        return (
                          <div className="flex items-center gap-2">
                            <span 
                              className={`font-mono text-[11px] font-black px-2 py-1 rounded-md border ${
                                total === 0 
                                  ? 'bg-zinc-50 dark:bg-zinc-900 border-zinc-150 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500' 
                                  : completed === total 
                                    ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-amber-50 dark:bg-amber-955/20 border-amber-100 dark:border-amber-900/30 text-amber-600 dark:text-amber-400'
                              }`}
                              title={`${completed} of ${total} tasks completed`}
                            >
                              {completed}/{total}
                            </span>
                            
                            <button 
                              onClick={() => setActiveVolunteerForTask(v)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-bold text-[11px] rounded-lg border border-blue-100 dark:border-blue-900/40 transition-all shrink-0"
                            >
                              <Plus size={11} />
                              <span>Assign Task</span>
                            </button>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {hasRight('volunteers', 'd') ? (
                        <button 
                          onClick={() => setDeletingId(v.id)}
                          className="p-1 text-zinc-400 hover:text-red-500 rounded bg-zinc-50 hover:bg-red-50 dark:bg-zinc-900 dark:hover:bg-red-950/20 transition-all ml-auto self-end flex"
                          title="Remove Karyakarta"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        <span className="text-[10px] text-zinc-400 italic">Restricted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recruitment Modal */}
      <AnimatePresence>
        {isRecruitOpen && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">Recruitment Portal</h3>
                  <p className="text-[10px] text-zinc-500">Recruit a citizen from the Voter list to your campaign team</p>
                </div>
                <button onClick={() => { setIsRecruitOpen(false); setSelectedVoter(null); }} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-5 overflow-y-auto space-y-4 flex-1">
                {!selectedVoter ? (
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Search Allowed Voters</label>
                    <div className="relative">
                      <Search className="absolute left-3.5 top-3.5 text-zinc-400" size={15} />
                      <input 
                        type="text" 
                        value={voterSearch} 
                        onChange={e => setVoterSearch(e.target.value)} 
                        className="webapp-input pl-10 w-full h-11 text-xs" 
                        placeholder="Type to filter instantly by Name, EPIC, Mobile or Aadhaar..." 
                      />
                    </div>

                    {searchingVoters ? (
                      <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                        <RefreshCw className="animate-spin text-zinc-400" size={20} />
                        <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Caching Voter Database...</p>
                      </div>
                    ) : filteredVotersToRecruit.length > 0 ? (
                      <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[250px] overflow-y-auto">
                        {filteredVotersToRecruit.map(sv => (
                          <button 
                            key={sv.id}
                            type="button"
                            onClick={() => setSelectedVoter(sv)}
                            className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex justify-between items-center transition-all text-xs"
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-zinc-900 dark:text-white truncate">{sv.name}</p>
                              <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                                EPIC: {sv.voterId} {sv.mobile ? `| Mobile: ${sv.mobile}` : ''}
                              </p>
                            </div>
                            <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shrink-0">Select</span>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-12 border border-zinc-150 dark:border-zinc-800 border-dashed rounded-xl text-center">
                        <Users className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" size={24} />
                        <p className="text-xs font-bold text-zinc-400">No matching recruitable voters found</p>
                        <p className="text-[10px] text-zinc-500 mt-1">Check search query, spelling or eligibility conditions.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <form onSubmit={handleRecruitSubmit} className="space-y-4">
                    <div className="bg-blue-50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 p-4 rounded-xl">
                      <p className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Selected Citizen</p>
                      <h4 className="font-black text-lg text-blue-700 dark:text-blue-400 mt-1">{selectedVoter.name}</h4>
                      <p className="text-xs text-zinc-500 mt-1">EPIC No / Voter ID: <strong className="font-semibold text-zinc-700 dark:text-zinc-200">{selectedVoter.voterId}</strong></p>
                    </div>

                    {/* Required Fields Validation */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">verify aadhar number</label>
                        <input 
                          required
                          type="text" 
                          value={selectedVoter.aadharNumber || ''} 
                          onChange={e => setSelectedVoter({ ...selectedVoter, aadharNumber: e.target.value })}
                          className="webapp-input w-full h-11 text-xs" 
                          placeholder="Must provide aadhar" 
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">verify mobile number</label>
                        <input 
                          required
                          type="tel" 
                          value={selectedVoter.mobile || ''} 
                          onChange={e => setSelectedVoter({ ...selectedVoter, mobile: e.target.value })}
                          className="webapp-input w-full h-11 text-xs" 
                          placeholder="Contact mobile" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 font-bold">Roster Status</label>
                      <select 
                        value={volunteerStatus} 
                        onChange={e => setVolunteerStatus(e.target.value as 'Active' | 'Inactive')}
                        className="webapp-input w-full h-11 text-xs"
                      >
                        <option value="Active">Active Team Member</option>
                        <option value="Inactive">Inactive Back-up</option>
                      </select>
                    </div>

                    <div className="flex gap-3 border-t border-zinc-100 dark:border-zinc-800 pt-4 mt-6">
                      <button 
                        type="button" 
                        onClick={() => setSelectedVoter(null)}
                        className="flex-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs h-11 rounded-xl"
                      >
                        Back
                      </button>
                      <button 
                        type="submit" 
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-11 rounded-xl"
                      >
                        Recruit Karyakarta
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Assign Task Offcanvas (Right-side slide-over) */}
      <AnimatePresence>
        {activeVolunteerForTask && liveVolunteerForTask && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setActiveVolunteerForTask(null);
                setTaskTitle('');
                setTaskDescription('');
              }}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-xs transition-opacity"
            />

            <div className="pointer-events-none fixed inset-y-0 right-0 flex max-w-full pl-10">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 210 }}
                className="pointer-events-auto w-screen max-w-md"
              >
                <div className="flex h-full flex-col bg-white dark:bg-zinc-950 shadow-2xl border-l border-zinc-200 dark:border-zinc-800">
                  {/* Header */}
                  <div className="p-6 border-b border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/10">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-extrabold text-[10px] text-blue-600 dark:text-blue-400 uppercase tracking-widest">
                          Karyakarta Operations
                        </h3>
                        <h2 className="text-base font-black text-zinc-900 dark:text-white mt-0.5">
                          Task & Objectives Control
                        </h2>
                      </div>
                      <button 
                        onClick={() => {
                          setActiveVolunteerForTask(null);
                          setTaskTitle('');
                          setTaskDescription('');
                        }} 
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all duration-200"
                      >
                        <X size={15} />
                      </button>
                    </div>

                    {/* Volunteer Card */}
                    <div className="flex flex-col gap-3 bg-white dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/80 shadow-xs">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                          <User size={15} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-bold text-zinc-900 dark:text-white truncate">{liveVolunteerForTask.name}</p>
                          <div className="space-y-1.5 mt-1 font-sans">
                            {liveVolunteerForTask.mobile && <div className="text-[10px] text-zinc-500 font-mono">📞 {liveVolunteerForTask.mobile}</div>}
                            <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-1.5">
                              <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider block mb-1">Active Booth Deployments</span>
                              {(() => {
                                const activeAsgs = getVolunteerBoothAssignments(liveVolunteerForTask.id);
                                if (activeAsgs.length === 0) {
                                  return (
                                    <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 font-bold">
                                      <MapPin size={10} className="text-zinc-350" />
                                      Unassigned
                                    </span>
                                  );
                                }
                                return (
                                  <div className="space-y-1">
                                    {activeAsgs.map(asg => (
                                      <div key={asg.id} className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800/80 rounded-lg p-1.5 space-y-0.5">
                                        <div className="flex items-center gap-1 font-bold">
                                          <MapPin size={10} className="text-blue-500 shrink-0" />
                                          <span>{asg.boothName} {asg.boothNumber ? `(No. ${asg.boothNumber})` : ''}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-rose-500 dark:text-rose-400 pl-3.5">
                                          {asg.designation || 'Booth President'}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>
                      </div>

                      {(() => {
                        const demo = getBelongingDemographics(liveVolunteerForTask);
                        if (!demo) return null;
                        return (
                          <div className="pt-2 border-t border-zinc-150 dark:border-zinc-800/60 text-[10px] space-y-1">
                            <div className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">Home/Belonging Booth Demographics</div>
                            <div className="text-zinc-700 dark:text-zinc-300 font-semibold leading-tight">
                              <div>🏠 {demo.boothName || 'Unknown Booth'} {demo.boothNumber ? `(No. ${demo.boothNumber})` : ''}</div>
                              <div className="text-[9px] text-zinc-400 font-medium mt-0.5">
                                {demo.constituency && <span>{demo.constituency}</span>}
                                {demo.district && <span> • {demo.district}</span>}
                                {demo.state && <span> • {demo.state}</span>}
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Scrollable Container */}
                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Task Progress & Breakdown Card inside Offcanvas */}
                    {(() => {
                      const total = liveVolunteerForTask.tasks?.length || 0;
                      if (total === 0) return null;
                      const completed = (liveVolunteerForTask.tasks || []).filter(t => t.status === 'Completed').length;
                      const percent = Math.round((completed / total) * 100);
                      return (
                        <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-150 dark:border-zinc-800/80 shadow-3xs rounded-2xl space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                              Operation Completion
                            </span>
                            <span className="text-[11px] font-black font-mono text-zinc-900 dark:text-zinc-100 bg-white dark:bg-zinc-950 px-2 py-0.5 rounded-md border border-zinc-100 dark:border-zinc-850 shadow-3xs">
                              {completed}/{total} Tasks Done
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-black text-zinc-700 dark:text-zinc-300">
                              <span>Overall Progress</span>
                              <span className={percent === 100 ? 'text-emerald-500' : 'text-blue-500 font-black'}>
                                {percent}%
                              </span>
                            </div>
                            {/* Visual Progress Bar */}
                            <div className="w-full h-2 bg-zinc-200/60 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                className={`h-full transition-all duration-300 ${
                                  percent === 100 
                                    ? 'bg-emerald-500' 
                                    : percent >= 50 
                                      ? 'bg-blue-500' 
                                      : 'bg-amber-500'
                                }`}
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          {/* Pending & Complete Counts */}
                          <div className="grid grid-cols-2 gap-2 text-[10px] font-bold font-mono">
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-amber-50/50 dark:bg-amber-955/10 border border-amber-100/45 dark:border-amber-900/20 text-amber-700 dark:text-amber-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"></span>
                              <span>Pending: {total - completed}</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-50/50 dark:bg-emerald-955/10 border border-emerald-100/45 dark:border-emerald-900/20 text-emerald-700 dark:text-emerald-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                              <span>Completed: {completed}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Active Tasks list */}
                    <div>
                      <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-3 flex items-center justify-between">
                        <span>Currently Allocated Tasks ({liveVolunteerForTask.tasks?.length || 0})</span>
                        <span className="h-px bg-zinc-150 dark:bg-zinc-800/80 flex-1 ml-3" />
                      </h4>

                      {(!liveVolunteerForTask.tasks || liveVolunteerForTask.tasks.length === 0) ? (
                        <div className="text-center p-6 border border-dashed border-zinc-200 dark:border-zinc-850 rounded-2xl bg-zinc-50/30 dark:bg-zinc-900/10">
                          <p className="text-xs text-zinc-500 dark:text-zinc-400 italic">No operations currently allocated</p>
                          <p className="text-[10px] text-zinc-400 mt-1">Fill out the form below to allocate a campaign task.</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {liveVolunteerForTask.tasks.map(t => (
                            <div key={t.id} className="p-3 bg-zinc-50/50 dark:bg-zinc-900/30 border border-zinc-100 dark:border-zinc-800/80 rounded-xl space-y-1.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <h5 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 leading-snug truncate" title={t.title}>
                                    {t.title}
                                  </h5>
                                  {t.description && (
                                    <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                                      {t.description}
                                    </p>
                                  )}
                                </div>
                                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                                  t.status === 'Completed' 
                                    ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30' 
                                    : 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                                }`}>
                                  {t.status}
                                </span>
                              </div>

                              <div className="flex justify-between items-center border-t border-zinc-100/60 dark:border-zinc-800/60 pt-2 text-[9px] text-zinc-400">
                                <span>{t.createdAt ? new Date(String(t.createdAt)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Pending'}</span>
                                {hasRight('volunteers', 'u') && (
                                  <div className="flex items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleTaskStatus(liveVolunteerForTask, t.id)}
                                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md transition-all ${
                                        t.status === 'Completed' 
                                          ? 'text-zinc-500 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200' 
                                          : 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                                      }`}
                                      title="Toggle Status"
                                    >
                                      {t.status === 'Completed' ? 'Reopen' : 'Mark Completed ✓'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveTask(liveVolunteerForTask, t.id)}
                                      className="text-zinc-400 hover:text-red-500 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-colors"
                                      title="Dismiss Task"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Assign New Task Section */}
                    {hasRight('volunteers', 'u') && (
                      <div className="pt-4 border-t border-zinc-100 dark:border-zinc-850">
                        <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider mb-4 flex items-center">
                          <span>Assign New Operation</span>
                          <span className="h-px bg-zinc-150 dark:bg-zinc-800/80 flex-1 ml-3" />
                        </h4>

                        <form onSubmit={handleAddTask} className="space-y-4">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Operation Title</label>
                            <input 
                              required 
                              type="text" 
                              value={taskTitle} 
                              onChange={e => setTaskTitle(e.target.value)}
                              className="webapp-input w-full h-11 text-xs font-bold" 
                              placeholder="e.g. Conduct Door-to-Door voter verification" 
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Operation Information / Description</label>
                            <textarea 
                              value={taskDescription} 
                              onChange={e => setTaskDescription(e.target.value)}
                              className="webapp-input w-full p-3 text-xs h-24 font-semibold leading-relaxed" 
                              placeholder="Details about task objectives, targets, or specific directions..." 
                            />
                          </div>

                          <button 
                            type="submit" 
                            className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[11px] uppercase tracking-wider h-11 rounded-xl shadow-sm transition-colors duration-200"
                          >
                            Assign Task to Karyakarta
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Karyakarta Profile & Deployment Details Modal */}
      <AnimatePresence>
        {selectedVolunteerForView && liveVolunteerForView && (
          <div className="fixed inset-0 bg-black/45 backdrop-blur-xs z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              {/* Header with high-fidelity theme banner */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-700 dark:from-blue-950 dark:to-indigo-950 px-6 py-5 text-white flex items-center justify-between">
                <div>
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-amber-300 dark:text-amber-400 bg-white/10 px-2 py-0.5 rounded">
                    Karyakarta Profile Card
                  </span>
                  <h3 className="font-black text-lg text-white mt-1.5 leading-none">
                    {liveVolunteerForView.name}
                  </h3>
                  <p className="text-[10px] text-blue-105 font-medium mt-1 leading-tight">
                    Structural linkage & organizational role details
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedVolunteerForView(null)} 
                  className="p-1.5 rounded-lg border border-white/20 hover:bg-white/10 text-white transition-all cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Scrollable details container */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Contact and Identification Banner */}
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 p-4 rounded-xl">
                  <div>
                    <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">
                      Primary Contact Number
                    </span>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-100 font-mono">
                      📞 {liveVolunteerForView.mobile || 'No Contact Number'}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">
                      Status Designation
                    </span>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
                      liveVolunteerForView.status === 'Active'
                        ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-250'
                        : 'bg-zinc-100 dark:bg-zinc-850 text-zinc-500 border-zinc-200'
                    }`}>
                      {liveVolunteerForView.status}
                    </span>
                  </div>
                  {liveVolunteerForView.voterId && (
                    <div className="col-span-1 pt-1">
                      <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">
                        EPIC / Voter Card Number
                      </span>
                      <span className="text-xs font-black text-zinc-750 dark:text-zinc-200 font-mono uppercase bg-zinc-100 dark:bg-zinc-950 px-1.5 py-0.5 rounded">
                        {liveVolunteerForView.voterId}
                      </span>
                    </div>
                  )}
                  {liveVolunteerForView.aadharNumber && (
                    <div className="col-span-1 pt-1">
                      <span className="text-[9px] font-black uppercase text-zinc-400 block mb-1">
                        Aadhaar Number
                      </span>
                      <span className="text-xs font-black text-zinc-750 dark:text-zinc-200 font-mono bg-zinc-100 dark:bg-zinc-950 px-1.5 py-0.5 rounded">
                        {liveVolunteerForView.aadharNumber}
                      </span>
                    </div>
                  )}
                </div>

                {/* ACTIVE BOOTH ASSIGNMENTS SECTION */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                      Active Work Booth Deployments & Designations
                    </h4>
                    <span className="h-px bg-zinc-150 dark:bg-zinc-800 flex-1 ml-3" />
                  </div>

                  {(() => {
                    const activeAsgs = getVolunteerBoothAssignments(liveVolunteerForView.id);
                    if (activeAsgs.length === 0) {
                      return (
                        <div className="p-5 border border-dashed border-zinc-250 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-900/10 text-center space-y-1">
                          <MapPin size={22} className="mx-auto text-zinc-350 dark:text-zinc-650 mb-1" />
                          <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">
                            No Active Work Deployments Linked
                          </p>
                          <p className="text-[10px] text-zinc-400 max-w-[280px] mx-auto">
                            This Karyakarta hasn't been deployed in any work booths yet. Go to the Booth Management panel to link them.
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {activeAsgs.map(asg => (
                          <div key={asg.id} className="p-3 bg-blue-50/40 dark:bg-blue-950/10 border border-blue-105/60 dark:border-blue-900/30 rounded-xl flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <span className="text-[9px] uppercase font-black text-blue-500 block">
                                Deployed Polling Office
                              </span>
                              <div className="font-bold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5 leading-none">
                                <MapPin size={11} className="text-blue-500 shrink-0" />
                                <span className="truncate">{asg.boothName}</span>
                                {asg.boothNumber && (
                                  <span className="text-zinc-400 dark:text-zinc-500 font-mono text-[10px] font-bold">
                                    (No. {asg.boothNumber})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="text-[9px] uppercase font-black text-rose-500 block mb-1">
                                Designated Role
                              </span>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-black bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-100 dark:border-rose-900/40">
                                {asg.designation || 'Booth President'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>

                {/* HOME/BELONGING REGISTERED DEMOGRAPHICS */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                      Home / Belonging Voter Registration
                    </h4>
                    <span className="h-px bg-zinc-150 dark:bg-zinc-800 flex-1 ml-3" />
                  </div>

                  {(() => {
                    const demo = getBelongingDemographics(liveVolunteerForView);
                    if (!demo) {
                      return (
                        <p className="text-[11px] text-zinc-400 italic">No voter registration linked.</p>
                      );
                    }
                    return (
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl space-y-3 font-sans">
                        <div className="flex items-start gap-2.5">
                          <span className="text-lg">🏠</span>
                          <div>
                            <span className="text-[9px] uppercase tracking-wider font-extrabold text-zinc-400 block">Registered Polling Station</span>
                            <span className="font-extrabold text-zinc-900 dark:text-white text-xs block mt-0.5">
                              {demo.boothName || 'Unknown Station'} {demo.boothNumber ? `(No. ${demo.boothNumber})` : ''}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/60 text-[10px] font-medium">
                          <div>
                            <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">Assembly Constituency</span>
                            <span className="text-zinc-850 dark:text-zinc-200 font-extrabold">{demo.constituency || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">District Division</span>
                            <span className="text-zinc-850 dark:text-zinc-200 font-extrabold">{demo.district || '—'}</span>
                          </div>
                          <div>
                            <span className="text-[8px] font-black uppercase text-zinc-400 block mb-0.5">Subdivision State</span>
                            <span className="text-zinc-850 dark:text-zinc-200 font-extrabold">{demo.state || '—'}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* ASSIGNED TASK OBJECTIVES */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider">
                      Work Objectives & Goals
                    </h4>
                    <span className="h-px bg-zinc-150 dark:bg-zinc-800 flex-1 ml-3" />
                  </div>

                  {(() => {
                    const total = liveVolunteerForView.tasks?.length || 0;
                    const completed = (liveVolunteerForView.tasks || []).filter(t => t.status === 'Completed').length;
                    
                    return (
                      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl p-3 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <p className="text-[10px] font-bold text-zinc-500">Operation Objectives Progress</p>
                          <p className="text-xs font-black text-zinc-900 dark:text-white">
                            {completed} of {total} Work Tasks Completed
                          </p>
                        </div>
                        
                        <button
                          onClick={() => {
                            setSelectedVolunteerForView(null);
                            setActiveVolunteerForTask(liveVolunteerForView);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider rounded-lg transition-all cursor-pointer"
                        >
                          <Plus size={11} /> Manage Tasks
                        </button>
                      </div>
                    );
                  })()}
                </div>

              </div>

              {/* Footer */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border-t border-zinc-150 dark:border-zinc-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setSelectedVolunteerForView(null)}
                  className="px-5 py-2 bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 font-black text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer"
                >
                  Close Profile
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-950/30 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle size={24} />
              </div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white mb-1">Remove Karyakarta?</h3>
              <p className="text-[11px] text-zinc-500 mb-6">
                Are you sure you want to remove this Karyakarta? This action will dismiss them from your registered team roster.
              </p>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setDeletingId(null)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs h-10 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={() => handleRemoveVolunteer(deletingId)}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold text-xs h-10 rounded-xl transition-all"
                >
                  Remove
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
