import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Users, 
  Search, 
  CheckCircle, 
  X, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  Eye, 
  Edit3, 
  Star, 
  Phone, 
  MessageSquare, 
  Calendar, 
  Download, 
  CheckSquare, 
  Square,
  Building2,
  CheckCircle2,
  ListTodo
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

export interface WorkflowTask {
  id: string;
  title: string;
  description?: string;
  priority?: 'Low' | 'Medium' | 'High' | 'Urgent';
  category?: string;
  dueDate?: string;
  status: 'Pending' | 'In Progress' | 'Completed';
  createdAt?: string;
}

export interface Karyakarta {
  id: string;
  voterDocId: string;
  voterId: string;
  name: string;
  aadharNumber?: string;
  mobile?: string;
  adminId: string;
  status: 'Active' | 'Inactive';
  tasks: WorkflowTask[];
  performanceRating: number;
  assignedBoothId?: string;
  assignedBoothName?: string;
  createdAt?: string;

  // Demographics
  gender?: string;
  age?: number;
  partNo?: string;
  srNo?: string;
  address?: string;
  houseNo?: string;
  village?: string;
  caste?: string;
  occupation?: string;
  partyInclination?: string;
  votingStatus?: string;
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  voterBoothId?: string;
  boothName?: string;
  boothNumber?: string;
}

interface BaseVoter {
  id: string;
  voter_id: string;
  name: string;
  mobile?: string;
  gender?: string;
  age?: number;
  part_no?: string;
  sr_no?: string;
  house_no?: string;
  village?: string;
  caste?: string;
  occupation?: string;
  party_inclination?: string;
  booth_id?: string;
  booth_name?: string;
  booth_number?: string;
}

interface IndiaBooth { 
  id: string; 
  name: string; 
  boothNumber?: string; 
  constituencyId?: string; 
}

export default function VolunteerManagement() {
  const { user, isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };

  // State
  const [karyakartas, setKaryakartas] = useState<Karyakarta[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [boothFilter, setBoothFilter] = useState<string>('All');

  // Modals
  const [isRecruitOpen, setIsRecruitOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isTasksOpen, setIsTasksOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  // Active items
  const [activeKaryakarta, setActiveKaryakarta] = useState<Karyakarta | null>(null);
  const [deletingKaryakarta, setDeletingKaryakarta] = useState<Karyakarta | null>(null);

  // Edit Form
  const [editName, setEditName] = useState('');
  const [editMobile, setEditMobile] = useState('');
  const [editAadhar, setEditAadhar] = useState('');
  const [editStatus, setEditStatus] = useState<'Active' | 'Inactive'>('Active');
  const [editRating, setEditRating] = useState<number>(5);
  const [editBoothId, setEditBoothId] = useState('');

  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Recruitment Form
  const [voterSearch, setVoterSearch] = useState('');
  const [recruitBoothFilter, setRecruitBoothFilter] = useState('');
  const [votersList, setVotersList] = useState<BaseVoter[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  // Load Booths
  useEffect(() => {
    if (!user) return;
    api.get<IndiaBooth[]>('/api/booths')
      .then(res => setBooths(res || []))
      .catch(console.error);
  }, [user]);

  // Load Karyakartas
  const fetchKaryakartas = async () => {
    try {
      setLoading(true);
      const data = await api.get<any[]>('/api/volunteers');
      const formatted: Karyakarta[] = (data || []).map(d => ({
        id: String(d.id),
        voterDocId: String(d.voter_doc_id || d.voterDocId || ''),
        voterId: d.voter_id || d.voterId || '',
        name: d.name || 'Unnamed Karyakarta',
        aadharNumber: d.aadhar_number || d.aadharNumber || '',
        mobile: d.mobile || '',
        adminId: d.admin_id || d.adminId || '',
        status: d.status === 'Inactive' ? 'Inactive' : 'Active',
        tasks: Array.isArray(d.tasks) ? d.tasks : [],
        performanceRating: Number(d.performance_rating !== undefined ? d.performance_rating : 5.0),
        assignedBoothId: d.assigned_booth_id || d.assignedBoothId || '',
        assignedBoothName: d.assigned_booth_name || d.assignedBoothName || '',
        createdAt: d.created_at || d.createdAt,
        gender: d.gender || '',
        age: d.age ? Number(d.age) : undefined,
        partNo: d.part_no || d.partNo || '',
        srNo: d.sr_no || d.srNo || '',
        address: d.address || '',
        houseNo: d.house_no || d.houseNo || '',
        village: d.village || '',
        caste: d.caste || '',
        occupation: d.occupation || '',
        partyInclination: d.party_inclination || d.partyInclination || 'Neutral',
        votingStatus: d.voting_status || d.votingStatus || 'unvoted',
        stateId: d.state_id || d.stateId || '',
        districtId: d.district_id || d.districtId || '',
        constituencyId: d.constituency_id || d.constituencyId || '',
        voterBoothId: d.voter_booth_id || d.voterBoothId || '',
        boothName: d.booth_name || d.boothName || '',
        boothNumber: d.booth_number || d.boothNumber || ''
      }));
      setKaryakartas(formatted);
    } catch (err: any) {
      console.error('Error fetching karyakartas:', err);
      setError('Failed to fetch Karyakarta roster.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    fetchKaryakartas();
  }, [user]);

  // Load Voters for Recruitment
  const searchVoters = async () => {
    setLoadingVoters(true);
    try {
      let url = '/api/voters?limit=100';
      if (recruitBoothFilter) url += `&boothId=${recruitBoothFilter}`;
      if (voterSearch) url += `&search=${encodeURIComponent(voterSearch)}`;
      const res: any = await api.get(url);
      setVotersList(Array.isArray(res) ? res : (res?.data || []));
    } catch (err) {
      console.error('Error loading voters:', err);
    } finally {
      setLoadingVoters(false);
    }
  };

  useEffect(() => {
    if (isRecruitOpen) {
      searchVoters();
    }
  }, [isRecruitOpen, recruitBoothFilter, voterSearch]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const total = karyakartas.length;
    const active = karyakartas.filter(k => k.status === 'Active').length;
    const assigned = karyakartas.filter(k => k.assignedBoothId || k.assignedBoothName).length;
    
    let totalTasks = 0;
    let completedTasks = 0;
    let totalRating = 0;

    karyakartas.forEach(k => {
      totalRating += (k.performanceRating || 5);
      if (k.tasks) {
        k.tasks.forEach(t => {
          totalTasks++;
          if (t.status === 'Completed') completedTasks++;
        });
      }
    });

    const avgRating = total > 0 ? (totalRating / total).toFixed(1) : '5.0';

    return { total, active, assigned, totalTasks, completedTasks, avgRating };
  }, [karyakartas]);

  // Filtered Roster
  const filteredKaryakartas = useMemo(() => {
    return karyakartas.filter(k => {
      if (statusFilter !== 'All' && k.status !== statusFilter) return false;
      if (boothFilter !== 'All') {
        if (boothFilter === 'Assigned' && !k.assignedBoothId && !k.assignedBoothName) return false;
        if (boothFilter === 'Unassigned' && (k.assignedBoothId || k.assignedBoothName)) return false;
        if (boothFilter !== 'Assigned' && boothFilter !== 'Unassigned' && k.assignedBoothId !== boothFilter && k.voterBoothId !== boothFilter) return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = k.name.toLowerCase().includes(q);
        const matchesEpic = (k.voterId || '').toLowerCase().includes(q);
        const matchesMobile = (k.mobile || '').toLowerCase().includes(q);
        const matchesVillage = (k.village || '').toLowerCase().includes(q);
        const matchesBooth = (k.assignedBoothName || k.boothName || '').toLowerCase().includes(q);
        return matchesName || matchesEpic || matchesMobile || matchesVillage || matchesBooth;
      }

      return true;
    });
  }, [karyakartas, statusFilter, boothFilter, searchQuery]);

  // Status Toggle
  const handleToggleStatus = async (k: Karyakarta) => {
    if (!hasRight('volunteers', 'u')) return;
    const nextStatus = k.status === 'Active' ? 'Inactive' : 'Active';
    try {
      setKaryakartas(prev => prev.map(item => item.id === k.id ? { ...item, status: nextStatus } : item));
      await api.put(`/api/volunteers/${k.id}`, { status: nextStatus });
      setSuccess(`Status updated for ${k.name}`);
      setTimeout(() => setSuccess(''), 2500);
    } catch (err) {
      fetchKaryakartas();
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (k: Karyakarta) => {
    setActiveKaryakarta(k);
    setEditName(k.name);
    setEditMobile(k.mobile || '');
    setEditAadhar(k.aadharNumber || '');
    setEditStatus(k.status);
    setEditRating(k.performanceRating || 5);
    setEditBoothId(k.assignedBoothId ? String(k.assignedBoothId) : '');
    setIsEditOpen(true);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKaryakarta) return;

    try {
      const selectedBooth = booths.find(b => String(b.id) === String(editBoothId));
      const finalBoothName = selectedBooth 
        ? `${selectedBooth.boothNumber ? `#${selectedBooth.boothNumber} - ` : ''}${selectedBooth.name}` 
        : (editBoothId ? activeKaryakarta.assignedBoothName || '' : '');

      const payload = {
        name: editName.trim(),
        mobile: editMobile.trim(),
        aadhar_number: editAadhar.trim(),
        status: editStatus,
        performance_rating: Number(editRating) || 5,
        assigned_booth_id: editBoothId ? (parseInt(String(editBoothId), 10) || editBoothId) : null,
        assigned_booth_name: finalBoothName
      };

      // Update local state immediately for instant feedback
      setKaryakartas(prev => prev.map(k => k.id === activeKaryakarta.id ? {
        ...k,
        name: editName.trim(),
        mobile: editMobile.trim(),
        aadharNumber: editAadhar.trim(),
        status: editStatus,
        performanceRating: Number(editRating) || 5,
        assignedBoothId: editBoothId ? String(editBoothId) : '',
        assignedBoothName: finalBoothName
      } : k));

      await api.put(`/api/volunteers/${activeKaryakarta.id}`, payload);

      setSuccess(`Updated details for ${editName}`);
      setIsEditOpen(false);
      fetchKaryakartas();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      console.error('Error saving karyakarta:', err);
      setError(err?.message || 'Failed to update Karyakarta.');
      fetchKaryakartas();
    }
  };

  // Open Tasks Modal
  const handleOpenTasks = (k: Karyakarta) => {
    setActiveKaryakarta(k);
    setTaskTitle('');
    setTaskPriority('Medium');
    setTaskDueDate('');
    setIsTasksOpen(true);
  };

  // Add Task
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKaryakarta || !taskTitle.trim()) return;

    try {
      const res: any = await api.post(`/api/volunteers/${activeKaryakarta.id}/tasks`, {
        title: taskTitle.trim(),
        priority: taskPriority,
        dueDate: taskDueDate
      });

      if (res?.task) {
        const updatedTasks = [res.task, ...(activeKaryakarta.tasks || [])];
        setActiveKaryakarta({ ...activeKaryakarta, tasks: updatedTasks });
        setKaryakartas(prev => prev.map(k => k.id === activeKaryakarta.id ? { ...k, tasks: updatedTasks } : k));
      }
      setTaskTitle('');
      setSuccess('Task assigned.');
      setTimeout(() => setSuccess(''), 2000);
    } catch (err) {
      setError('Failed to assign task.');
    }
  };

  // Toggle Task Status
  const handleToggleTaskStatus = async (karyakartaId: string, taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Completed' ? 'Pending' : 'Completed';
    try {
      const res: any = await api.put(`/api/volunteers/${karyakartaId}/tasks/${taskId}`, { status: nextStatus });
      if (res?.tasks) {
        if (activeKaryakarta && activeKaryakarta.id === karyakartaId) {
          setActiveKaryakarta({ ...activeKaryakarta, tasks: res.tasks });
        }
        setKaryakartas(prev => prev.map(k => k.id === karyakartaId ? { ...k, tasks: res.tasks } : k));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Delete Task
  const handleDeleteTask = async (karyakartaId: string, taskId: string) => {
    try {
      const res: any = await api.delete(`/api/volunteers/${karyakartaId}/tasks/${taskId}`);
      if (res?.tasks) {
        if (activeKaryakarta && activeKaryakarta.id === karyakartaId) {
          setActiveKaryakarta({ ...activeKaryakarta, tasks: res.tasks });
        }
        setKaryakartas(prev => prev.map(k => k.id === karyakartaId ? { ...k, tasks: res.tasks } : k));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Recruit Single Voter
  const handleRecruitVoter = async (voter: BaseVoter) => {
    try {
      const selectedBooth = booths.find(b => b.id === voter.booth_id);
      const boothName = selectedBooth ? `${selectedBooth.boothNumber ? `#${selectedBooth.boothNumber} - ` : ''}${selectedBooth.name}` : '';

      await api.post('/api/volunteers', {
        voterDocId: voter.id,
        voterId: voter.voter_id,
        name: voter.name,
        mobile: voter.mobile || '',
        status: 'Active',
        assignedBoothId: voter.booth_id || null,
        assignedBoothName: boothName
      });

      setSuccess(`Recruited ${voter.name} as Karyakarta!`);
      fetchKaryakartas();
      searchVoters();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to recruit voter.');
    }
  };

  // Delete Karyakarta
  const handleConfirmDelete = async () => {
    if (!deletingKaryakarta) return;
    try {
      await api.delete(`/api/volunteers/${deletingKaryakarta.id}`);
      setSuccess(`Removed ${deletingKaryakarta.name} from Karyakarta roster.`);
      setIsDeleteOpen(false);
      setDeletingKaryakarta(null);
      fetchKaryakartas();
      setTimeout(() => setSuccess(''), 2500);
    } catch (err: any) {
      setError(err?.message || 'Failed to remove Karyakarta.');
    }
  };

  // Export Roster
  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredKaryakartas.map((k, idx) => ({
      'S.No': idx + 1,
      'Full Name': k.name,
      'EPIC / Voter ID': k.voterId,
      'Mobile': k.mobile || '—',
      'Assigned Booth': k.assignedBoothName || 'Unassigned',
      'Village / Area': k.village || '—',
      'House No': k.houseNo || '—',
      'Status': k.status,
      'Rating': k.performanceRating || 5,
      'Tasks Done': `${k.tasks?.filter(t => t.status === 'Completed').length || 0} / ${k.tasks?.length || 0}`
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Karyakartas');
    if (format === 'xlsx') {
      XLSX.writeFile(wb, `Karyakarta_Roster_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      XLSX.writeFile(wb, `Karyakarta_Roster_${new Date().toISOString().slice(0, 10)}.csv`);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      
      {/* Top Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="text-blue-600" size={24} />
            Karyakarta Management
          </h1>
          <p className="text-xs text-zinc-500 mt-1">
            Recruit active Karyakartas directly from the Voter list, manage workflow tasks, and monitor campaign performance.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasRight('volunteers', 'c') && (
            <button
              onClick={() => setIsRecruitOpen(true)}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Plus size={15} />
              <span>Recruit Karyakarta</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all"
              title="Export as Excel"
            >
              <Download size={14} />
              <span>Export</span>
            </button>
            <button
              onClick={fetchKaryakartas}
              className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              title="Refresh"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Total Karyakartas</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-zinc-900 dark:text-white">{metrics.total}</span>
            <span className="text-xs text-emerald-600 font-medium">{metrics.active} Active</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Booth Assigned</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{metrics.assigned}</span>
            <span className="text-xs text-zinc-500 font-medium">of {metrics.total} staff</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Campaign Tasks</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">{metrics.completedTasks}</span>
            <span className="text-xs text-zinc-500 font-medium">/ {metrics.totalTasks} Done</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Average Rating</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-bold text-amber-500 flex items-center gap-1">
              <Star size={18} className="fill-amber-400" /> {metrics.avgRating}
            </span>
            <span className="text-xs text-zinc-400">/ 5.0</span>
          </div>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl text-xs text-red-600 dark:text-red-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')}><X size={14} /></button>
        </div>
      )}

      {success && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle size={15} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess('')}><X size={14} /></button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by Name, EPIC, Mobile, or Village..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-200"
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select
            value={boothFilter}
            onChange={e => setBoothFilter(e.target.value)}
            className="h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium text-zinc-700 dark:text-zinc-200 max-w-[180px] truncate"
          >
            <option value="All">All Booths</option>
            <option value="Assigned">Assigned to Booth</option>
            <option value="Unassigned">Unassigned</option>
            {booths.map(b => (
              <option key={b.id} value={b.id}>
                {b.boothNumber ? `#${b.boothNumber} - ` : ''}{b.name}
              </option>
            ))}
          </select>

          {(searchQuery || statusFilter !== 'All' || boothFilter !== 'All') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('All');
                setBoothFilter('All');
              }}
              className="h-9 px-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline whitespace-nowrap"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-16 text-center text-xs text-zinc-400">Loading Karyakarta roster...</div>
        ) : filteredKaryakartas.length === 0 ? (
          <div className="py-14 text-center space-y-2">
            <Users size={32} className="mx-auto text-zinc-300 dark:text-zinc-700" />
            <p className="text-sm font-semibold text-zinc-600 dark:text-zinc-400">No Karyakartas Found</p>
            <p className="text-xs text-zinc-400">Try adjusting your search query or recruit from the Voter list.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-zinc-50 dark:bg-zinc-950/80 text-[11px] font-bold text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="p-3.5 w-12 text-center">#</th>
                  <th className="p-3.5">Name &amp; EPIC</th>
                  <th className="p-3.5">Mobile</th>
                  <th className="p-3.5">Assigned Booth</th>
                  <th className="p-3.5">Village / Area</th>
                  <th className="p-3.5">Tasks</th>
                  <th className="p-3.5 text-center">Rating</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredKaryakartas.map((k, idx) => {
                  const completedTasks = k.tasks?.filter(t => t.status === 'Completed').length || 0;
                  const totalTasks = k.tasks?.length || 0;

                  return (
                    <tr key={k.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="p-3.5 text-center font-mono text-zinc-400 text-[11px]">{idx + 1}</td>

                      <td className="p-3.5">
                        <div className="font-bold text-zinc-900 dark:text-white">{k.name}</div>
                        <div className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{k.voterId}</div>
                      </td>

                      <td className="p-3.5 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span>{k.mobile || '—'}</span>
                          {k.mobile && (
                            <a href={`tel:${k.mobile}`} className="text-blue-600 hover:text-blue-800 p-0.5">
                              <Phone size={12} />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="p-3.5 font-medium">
                        {k.assignedBoothName ? (
                          <span className="text-purple-600 dark:text-purple-400 font-semibold truncate block max-w-[170px]">
                            {k.assignedBoothName}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Unassigned</span>
                        )}
                      </td>

                      <td className="p-3.5 text-zinc-600 dark:text-zinc-400">
                        {k.village || k.boothName || '—'}
                      </td>

                      <td className="p-3.5">
                        <button
                          onClick={() => handleOpenTasks(k)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 hover:text-blue-600 text-[11px] font-semibold transition-colors"
                        >
                          <ListTodo size={12} />
                          <span>{completedTasks}/{totalTasks} Done</span>
                        </button>
                      </td>

                      <td className="p-3.5 text-center">
                        <span className="font-bold text-amber-500 flex items-center justify-center gap-0.5">
                          <Star size={12} className="fill-amber-400" /> {k.performanceRating?.toFixed(1) || '5.0'}
                        </span>
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleToggleStatus(k)}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            k.status === 'Active' 
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400' 
                              : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                          }`}
                        >
                          {k.status}
                        </button>
                      </td>

                      <td className="p-3.5 text-right space-x-1">
                        <button
                          onClick={() => {
                            setActiveKaryakarta(k);
                            setIsViewOpen(true);
                          }}
                          className="p-1 rounded text-zinc-400 hover:text-blue-600"
                          title="View Profile"
                        >
                          <Eye size={14} />
                        </button>
                        {hasRight('volunteers', 'u') && (
                          <button
                            onClick={() => handleOpenEdit(k)}
                            className="p-1 rounded text-zinc-400 hover:text-amber-600"
                            title="Edit"
                          >
                            <Edit3 size={14} />
                          </button>
                        )}
                        {hasRight('volunteers', 'd') && (
                          <button
                            onClick={() => {
                              setDeletingKaryakarta(k);
                              setIsDeleteOpen(true);
                            }}
                            className="p-1 rounded text-zinc-400 hover:text-red-600"
                            title="Remove"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* Recruitment Modal (Simple & Clean) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRecruitOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 dark:text-white text-base flex items-center gap-2">
                  <Users size={18} className="text-blue-600" />
                  Recruit Karyakartas from Voter List
                </h3>
                <button onClick={() => setIsRecruitOpen(false)}><X size={18} /></button>
              </div>

              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                    <input
                      type="text"
                      value={voterSearch}
                      onChange={e => setVoterSearch(e.target.value)}
                      placeholder="Search voter by name or EPIC..."
                      className="w-full h-9 pl-8 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium"
                    />
                  </div>

                  <div>
                    <select
                      value={recruitBoothFilter}
                      onChange={e => setRecruitBoothFilter(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-xs font-medium"
                    >
                      <option value="">All Booths</option>
                      {booths.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.boothNumber ? `#${b.boothNumber} - ` : ''}{b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                  {loadingVoters ? (
                    <div className="py-12 text-center text-xs text-zinc-400">Loading voter records...</div>
                  ) : votersList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400">No voters found.</div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold uppercase text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">EPIC No</th>
                          <th className="p-2.5">Mobile</th>
                          <th className="p-2.5">Village / Booth</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {votersList.map(v => {
                          const isAlreadyRecruited = karyakartas.some(k => k.voterDocId === String(v.id) || k.voterId === v.voter_id);

                          return (
                            <tr key={v.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                              <td className="p-2.5 font-bold text-zinc-900 dark:text-white">{v.name}</td>
                              <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400">{v.voter_id}</td>
                              <td className="p-2.5 font-mono text-zinc-500">{v.mobile || '—'}</td>
                              <td className="p-2.5 text-zinc-500">{v.village || v.booth_name || '—'}</td>
                              <td className="p-2.5 text-right">
                                {isAlreadyRecruited ? (
                                  <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 rounded">Recruited</span>
                                ) : (
                                  <button
                                    onClick={() => handleRecruitVoter(v)}
                                    className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px]"
                                  >
                                    Recruit
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
                <button
                  onClick={() => setIsRecruitOpen(false)}
                  className="px-4 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Tasks Modal (Simple & Clean) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isTasksOpen && activeKaryakarta && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">
                    Tasks: {activeKaryakarta.name}
                  </h3>
                  <p className="text-[11px] text-zinc-400">EPIC: {activeKaryakarta.voterId}</p>
                </div>
                <button onClick={() => setIsTasksOpen(false)}><X size={18} /></button>
              </div>

              <div className="p-4 space-y-4 flex-1 overflow-y-auto">
                {/* Add Task Form */}
                <form onSubmit={handleAddTask} className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl space-y-2.5 border border-zinc-200 dark:border-zinc-800">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">Add Campaign Task</span>
                  <input
                    type="text"
                    value={taskTitle}
                    onChange={e => setTaskTitle(e.target.value)}
                    placeholder="Task title (e.g. Distribute voter slips in Ward 2)..."
                    required
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[9px] font-semibold text-zinc-400 mb-0.5">Priority</label>
                      <select
                        value={taskPriority}
                        onChange={e => setTaskPriority(e.target.value as any)}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[9px] font-semibold text-zinc-400 mb-0.5">Due Date</label>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={e => setTaskDueDate(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs"
                  >
                    Assign Task
                  </button>
                </form>

                {/* Task List */}
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-zinc-500 uppercase">Assigned Tasks ({activeKaryakarta.tasks?.length || 0})</span>
                  {!activeKaryakarta.tasks || activeKaryakarta.tasks.length === 0 ? (
                    <div className="py-6 text-center text-xs text-zinc-400 italic">No tasks assigned yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeKaryakarta.tasks.map(t => (
                        <div
                          key={t.id}
                          className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleTaskStatus(activeKaryakarta.id, t.id, t.status)}
                              className="text-zinc-400 hover:text-blue-600"
                            >
                              {t.status === 'Completed' ? (
                                <CheckSquare size={16} className="text-emerald-500" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                            <div>
                              <p className={`text-xs font-semibold ${t.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                {t.title}
                              </p>
                              {t.dueDate && <span className="text-[10px] text-zinc-400">Due: {t.dueDate}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.priority === 'Urgent' ? 'bg-red-100 text-red-600' : 'bg-zinc-100 text-zinc-600'}`}>
                              {t.priority || 'Medium'}
                            </span>
                            <button
                              onClick={() => handleDeleteTask(activeKaryakarta.id, t.id)}
                              className="text-zinc-400 hover:text-red-500 p-0.5"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Edit Modal (Simple & Clean) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isEditOpen && activeKaryakarta && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">Edit Karyakarta</h3>
                <button onClick={() => setIsEditOpen(false)}><X size={18} /></button>
              </div>

              <form onSubmit={handleSaveEdit} className="p-4 space-y-3 text-xs">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    required
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-medium"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Mobile</label>
                    <input
                      type="text"
                      value={editMobile}
                      onChange={e => setEditMobile(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as any)}
                      className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-medium"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Rating (1 to 5)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={editRating}
                      onChange={e => setEditRating(Number(e.target.value))}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-bold text-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Aadhar Number</label>
                    <input
                      type="text"
                      value={editAadhar}
                      onChange={e => setEditAadhar(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Assigned Booth</label>
                  <select
                    value={editBoothId}
                    onChange={e => setEditBoothId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-medium"
                  >
                    <option value="">Unassigned</option>
                    {booths.map(b => (
                      <option key={b.id} value={String(b.id)}>
                        {b.boothNumber ? `#${b.boothNumber} - ` : ''}{b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="flex-1 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold"
                  >
                    Save
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* View Modal (Simple & Clean) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isViewOpen && activeKaryakarta && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">Karyakarta Profile</h3>
                <button onClick={() => setIsViewOpen(false)}><X size={18} /></button>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div>
                  <h4 className="text-base font-bold text-zinc-900 dark:text-white">{activeKaryakarta.name}</h4>
                  <p className="font-mono text-blue-600 dark:text-blue-400 font-bold">EPIC: {activeKaryakarta.voterId}</p>
                </div>

                <div className="grid grid-cols-2 gap-2 bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg">
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold">Mobile</span>
                    <p className="font-mono font-bold mt-0.5">{activeKaryakarta.mobile || '—'}</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-zinc-400 font-semibold">Status</span>
                    <p className={`font-bold mt-0.5 ${activeKaryakarta.status === 'Active' ? 'text-emerald-600' : 'text-zinc-500'}`}>
                      {activeKaryakarta.status}
                    </p>
                  </div>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg space-y-0.5">
                  <span className="text-[10px] text-zinc-400 font-semibold">Assigned Booth</span>
                  <p className="font-bold text-purple-600 dark:text-purple-400">
                    {activeKaryakarta.assignedBoothName || 'Unassigned'}
                  </p>
                </div>

                <div className="bg-zinc-50 dark:bg-zinc-950 p-2.5 rounded-lg space-y-0.5">
                  <span className="text-[10px] text-zinc-400 font-semibold">Home Address</span>
                  <p className="text-zinc-700 dark:text-zinc-300">
                    {activeKaryakarta.houseNo ? `H.No ${activeKaryakarta.houseNo}, ` : ''}{activeKaryakarta.village || ''} {activeKaryakarta.address ? `(${activeKaryakarta.address})` : ''}
                  </p>
                </div>

                {activeKaryakarta.mobile && (
                  <div className="flex gap-2 pt-1">
                    <a
                      href={`tel:${activeKaryakarta.mobile}`}
                      className="flex-1 py-1.5 rounded-lg bg-blue-600 text-white font-semibold flex items-center justify-center gap-1"
                    >
                      <Phone size={13} /> Call
                    </a>
                    <a
                      href={`https://wa.me/${activeKaryakarta.mobile.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold flex items-center justify-center gap-1"
                    >
                      <MessageSquare size={13} /> WhatsApp
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* Delete Confirmation Modal */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isDeleteOpen && deletingKaryakarta && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-xs p-5 text-center space-y-3"
            >
              <div className="w-10 h-10 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-zinc-900 dark:text-white">Remove Karyakarta?</h3>
                <p className="text-xs text-zinc-500 mt-1">
                  Are you sure you want to remove <strong className="text-zinc-800 dark:text-zinc-200">{deletingKaryakarta.name}</strong> from your team?
                </p>
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setIsDeleteOpen(false)}
                  className="flex-1 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="flex-1 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
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
