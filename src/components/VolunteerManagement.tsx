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
  ListTodo,
  Shield,
  Crown,
  Network,
  IdCard,
  MapPin,
  Vote,
  ExternalLink,
  ChevronRight,
  Filter,
  UserCheck
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { useTableColumns, ColumnDef } from '../hooks/useTableColumns';
import { TableColumnManager } from './common/TableColumnManager';

export const DEFAULT_VOLUNTEER_COLUMNS: ColumnDef[] = [
  { id: 'sr_no', label: '# / Sr. No.', defaultVisible: true },
  { id: 'name_epic', label: 'Name & EPIC', defaultVisible: true, required: true },
  { id: 'leadership', label: 'Supervising Leadership (Admin / Mgr)', defaultVisible: true },
  { id: 'mobile', label: 'Contact (Mobile)', defaultVisible: true },
  { id: 'registered_booth', label: 'Registered Booth (Voter Roll)', defaultVisible: true },
  { id: 'assigned_booth', label: 'Assigned Duty Booth (Campaign)', defaultVisible: true },
  { id: 'village', label: 'Village / Area', defaultVisible: true },
  { id: 'tasks', label: 'Workflow Tasks', defaultVisible: true },
  { id: 'rating', label: 'Performance Rating', defaultVisible: true },
  { id: 'status', label: 'Status', defaultVisible: true },
  { id: 'aadhaar', label: 'Aadhaar Number', defaultVisible: false },
  { id: 'gender_age', label: 'Gender & Age', defaultVisible: false },
  { id: 'house_no', label: 'House No', defaultVisible: false },
  { id: 'caste', label: 'Caste / Community', defaultVisible: false },
  { id: 'occupation', label: 'Occupation', defaultVisible: false },
  { id: 'created_at', label: 'Enrolled Date', defaultVisible: false },
  { id: 'actions', label: 'Actions', defaultVisible: true, required: true },
];

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
  admin_id?: string;
  adminName?: string;
  admin_name?: string;
  adminEmail?: string;
  admin_email?: string;
  status: 'Active' | 'Inactive';
  tasks: WorkflowTask[];
  performanceRating: number;
  assignedBoothId?: string;
  assignedBoothName?: string;
  assignedBoothNumber?: string;
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
  voterBoothName?: string;
  voterBoothNumber?: string;
  boothName?: string;
  boothNumber?: string;

  // Hierarchy & Link
  managerId?: string;
  manager_id?: string;
  managerName?: string;
  manager_name?: string;
  managerEmail?: string;
  manager_email?: string;
  userId?: string;
  user_id?: string;
  userEmail?: string;
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
  const { user, isSuperAdmin, isAdmin, profile } = useAuth();
  const volunteerColumnManager = useTableColumns('volunteers_table', DEFAULT_VOLUNTEER_COLUMNS);
  
  const hasRight = (moduleId: string, right: string) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.rights?.[moduleId] || '';
    return perms.includes(right);
  };

  // State
  const [karyakartas, setKaryakartas] = useState<Karyakarta[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [admins, setAdmins] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [boothFilter, setBoothFilter] = useState<string>('All');
  const [adminFilter, setAdminFilter] = useState<string>('All');
  const [managerFilter, setManagerFilter] = useState<string>('All');

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
  const [editAdminId, setEditAdminId] = useState('');
  const [editManagerId, setEditManagerId] = useState('');

  // Task Form
  const [taskTitle, setTaskTitle] = useState('');
  const [taskPriority, setTaskPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [taskDueDate, setTaskDueDate] = useState('');

  // Recruitment Form
  const [voterSearch, setVoterSearch] = useState('');
  const [recruitBoothFilter, setRecruitBoothFilter] = useState('');
  const [recruitAdminId, setRecruitAdminId] = useState('');
  const [recruitManagerId, setRecruitManagerId] = useState('');
  const [votersList, setVotersList] = useState<BaseVoter[]>([]);
  const [loadingVoters, setLoadingVoters] = useState(false);

  // Load Booths & Users (Admins & Managers)
  useEffect(() => {
    if (!user) return;
    api.get<IndiaBooth[]>('/api/booths')
      .then(res => setBooths(res || []))
      .catch(console.error);

    api.get<any[]>('/api/users')
      .then(res => {
        const list = Array.isArray(res) ? res : (res as any)?.users || [];
        setAllUsers(list);
        const adms = list.filter((u: any) => u.role === 'admin' || u.role === 'super_admin');
        const mgrs = list.filter((u: any) => u.role === 'manager');
        setAdmins(adms);
        setManagers(mgrs);

        if (isSuperAdmin && adms.length > 0) {
          setRecruitAdminId(String(adms[0].id || adms[0].uid));
        } else {
          setRecruitAdminId(profile?.adminId || profile?.parentAdminId || user?.uid || '');
        }
      })
      .catch(console.error);
  }, [user, isSuperAdmin, profile]);

  // Helpers to resolve human-readable Admin & Manager names
  const getKaryakartaAdminName = (k: Karyakarta) => {
    if (k.adminName && !k.adminName.startsWith('usr_') && !k.adminName.startsWith('admin_')) return k.adminName;
    const found = admins.find(a => String(a.id || a.uid) === String(k.adminId) || a.email === k.adminEmail || a.email === k.adminId);
    if (found) return found.name || found.username || found.email?.split('@')[0];
    if (k.adminEmail) return k.adminEmail.split('@')[0];
    return 'Campaign Administrator';
  };

  const getKaryakartaManagerName = (k: Karyakarta) => {
    if (k.managerName && !k.managerName.startsWith('usr_')) return k.managerName;
    const found = managers.find(m => String(m.id || m.uid) === String(k.managerId) || m.email === k.managerEmail || m.email === k.managerId);
    if (found) return found.name || found.username || found.email?.split('@')[0];
    if (k.managerEmail) return k.managerEmail.split('@')[0];
    if (k.managerId) return 'Assigned Team Manager';
    return null;
  };

  // Load Karyakartas with Hierarchy
  const fetchKaryakartas = async () => {
    try {
      setLoading(true);
      const url = adminFilter !== 'All' ? `/api/volunteers?adminId=${adminFilter}` : '/api/volunteers';
      const data = await api.get<any[]>(url);
      const formatted: Karyakarta[] = (data || []).map(d => ({
        id: String(d.id),
        voterDocId: String(d.voter_doc_id || d.voterDocId || ''),
        voterId: d.voter_id || d.voterId || '',
        name: d.name || 'Unnamed Karyakarta',
        aadharNumber: d.aadhar_number || d.aadharNumber || '',
        mobile: d.mobile || '',
        adminId: d.admin_id || d.adminId || '',
        adminName: d.admin_name || d.adminName || '',
        adminEmail: d.admin_email || d.adminEmail || '',
        managerId: d.manager_id || d.managerId || '',
        managerName: d.manager_name || d.managerName || '',
        managerEmail: d.manager_email || d.managerEmail || '',
        userId: d.user_id || d.userId || '',
        userEmail: d.user_email || d.userEmail || '',
        status: d.status === 'Inactive' ? 'Inactive' : 'Active',
        tasks: Array.isArray(d.tasks) ? d.tasks : [],
        performanceRating: Number(d.performance_rating !== undefined ? d.performance_rating : 5.0),
        assignedBoothId: d.assigned_booth_id || d.assignedBoothId || '',
        assignedBoothName: d.assigned_booth_name || d.assignedBoothName || '',
        assignedBoothNumber: d.assigned_booth_number || d.assignedBoothNumber || '',
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
        voterBoothName: d.voter_booth_name || d.voterBoothName || d.booth_name || d.boothName || '',
        voterBoothNumber: d.voter_booth_number || d.voterBoothNumber || d.booth_number || d.boothNumber || '',
        boothName: d.voter_booth_name || d.voterBoothName || d.booth_name || d.boothName || '',
        boothNumber: d.voter_booth_number || d.voterBoothNumber || d.booth_number || d.boothNumber || ''
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
  }, [user, adminFilter]);

  // Voters recruitment search
  const handleSearchVoters = async (searchTerm = voterSearch, boothId = recruitBoothFilter) => {
    try {
      setLoadingVoters(true);
      let query = `/api/voters?limit=50`;
      if (searchTerm.trim()) {
        query += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      if (boothId) {
        query += `&boothId=${encodeURIComponent(boothId)}`;
      }
      const res = await api.get<{ data?: BaseVoter[] } | BaseVoter[]>(query);
      const list = (res as any)?.data || (Array.isArray(res) ? res : []);
      setVotersList(list);
    } catch (e) {
      console.error('Error searching voters for karyakarta recruitment:', e);
    } finally {
      setLoadingVoters(false);
    }
  };

  // Auto-search voters as you type, on booth change, or on modal open (debounced)
  useEffect(() => {
    if (!isRecruitOpen) return;
    const timer = setTimeout(() => {
      handleSearchVoters(voterSearch, recruitBoothFilter);
    }, 250);
    return () => clearTimeout(timer);
  }, [isRecruitOpen, voterSearch, recruitBoothFilter]);

  // Recruit Voter Handler
  const handleRecruitVoter = async (voter: BaseVoter) => {
    try {
      const targetAdmin = isSuperAdmin && recruitAdminId ? recruitAdminId : (profile?.adminId || profile?.parentAdminId || user?.uid || '');

      const payload = {
        name: voter.name,
        voterId: voter.voter_id,
        voterDocId: String(voter.id),
        mobile: voter.mobile || '',
        adminId: targetAdmin,
        managerId: recruitManagerId || null,
        status: 'Active',
        performanceRating: 5.0,
        assignedBoothId: '',
        assignedBoothName: ''
      };

      await api.post('/api/volunteers', payload);
      setSuccess(`Recruited ${voter.name} as active Karyakarta (Duty Booth unassigned).`);
      setTimeout(() => setSuccess(''), 4000);
      fetchKaryakartas();
    } catch (e: any) {
      console.error('Error recruiting voter:', e);
      setError('Failed to recruit karyakarta.');
      setTimeout(() => setError(''), 4000);
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
    setEditBoothId(k.assignedBoothId || '');
    setEditAdminId(k.adminId || '');
    setEditManagerId(k.managerId || '');
    setIsEditOpen(true);
  };

  // Save Edit Handler
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKaryakarta) return;

    try {
      const selectedBooth = booths.find(b => b.id === editBoothId);
      const payload = {
        name: editName,
        mobile: editMobile,
        aadharNumber: editAadhar,
        status: editStatus,
        performanceRating: editRating,
        assignedBoothId: editBoothId || null,
        assignedBoothName: selectedBooth?.name || '',
        adminId: editAdminId || activeKaryakarta.adminId,
        managerId: editManagerId || null
      };

      await api.put(`/api/volunteers/${activeKaryakarta.id}`, payload);
      setSuccess('Karyakarta profile updated successfully!');
      setTimeout(() => setSuccess(''), 4000);
      setIsEditOpen(false);
      fetchKaryakartas();
    } catch (e) {
      console.error('Error saving karyakarta:', e);
      setError('Failed to update karyakarta.');
    }
  };

  // Toggle Status
  const handleToggleStatus = async (k: Karyakarta) => {
    try {
      const newStatus = k.status === 'Active' ? 'Inactive' : 'Active';
      await api.put(`/api/volunteers/${k.id}`, { status: newStatus });
      setKaryakartas(prev => prev.map(item => item.id === k.id ? { ...item, status: newStatus } : item));
    } catch (e) {
      console.error('Error updating status:', e);
      setError('Failed to update status.');
    }
  };

  // Open Tasks Modal
  const handleOpenTasks = (k: Karyakarta) => {
    setActiveKaryakarta(k);
    setIsTasksOpen(true);
  };

  // Add Task Handler
  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeKaryakarta || !taskTitle.trim()) return;

    const newTask: WorkflowTask = {
      id: `task_${Date.now()}`,
      title: taskTitle.trim(),
      priority: taskPriority,
      dueDate: taskDueDate || undefined,
      status: 'Pending',
      createdAt: new Date().toISOString()
    };

    const updatedTasks = [...(activeKaryakarta.tasks || []), newTask];

    try {
      await api.put(`/api/volunteers/${activeKaryakarta.id}`, { tasks: updatedTasks });
      setActiveKaryakarta({ ...activeKaryakarta, tasks: updatedTasks });
      setKaryakartas(prev => prev.map(item => item.id === activeKaryakarta.id ? { ...item, tasks: updatedTasks } : item));
      setTaskTitle('');
      setTaskDueDate('');
    } catch (e) {
      console.error('Error adding task:', e);
      setError('Failed to add task.');
    }
  };

  // Toggle Task Completion
  const handleToggleTaskStatus = async (taskId: string, _currentStatus?: string) => {
    if (!activeKaryakarta) return;

    const updatedTasks: WorkflowTask[] = (activeKaryakarta.tasks || []).map(t => {
      if (t.id === taskId) {
        const nextStatus: 'Pending' | 'In Progress' | 'Completed' = 
          t.status === 'Pending' ? 'In Progress' : 
          t.status === 'In Progress' ? 'Completed' : 'Pending';
        return { ...t, status: nextStatus };
      }
      return t;
    });

    try {
      await api.put(`/api/volunteers/${activeKaryakarta.id}`, { tasks: updatedTasks });
      setActiveKaryakarta({ ...activeKaryakarta, tasks: updatedTasks });
      setKaryakartas(prev => prev.map(item => item.id === activeKaryakarta.id ? { ...item, tasks: updatedTasks } : item));
    } catch (e) {
      console.error('Error toggling task status:', e);
    }
  };

  // Delete Task
  const handleDeleteTask = async (taskId: string) => {
    if (!activeKaryakarta) return;

    const updatedTasks = (activeKaryakarta.tasks || []).filter(t => t.id !== taskId);

    try {
      await api.put(`/api/volunteers/${activeKaryakarta.id}`, { tasks: updatedTasks });
      setActiveKaryakarta({ ...activeKaryakarta, tasks: updatedTasks });
      setKaryakartas(prev => prev.map(item => item.id === activeKaryakarta.id ? { ...item, tasks: updatedTasks } : item));
    } catch (e) {
      console.error('Error deleting task:', e);
    }
  };

  // Confirm Delete Karyakarta
  const handleConfirmDelete = async () => {
    if (!deletingKaryakarta) return;
    try {
      await api.delete(`/api/volunteers/${deletingKaryakarta.id}`);
      setSuccess(`Removed ${deletingKaryakarta.name} from Karyakarta roster.`);
      setTimeout(() => setSuccess(''), 4000);
      setIsDeleteOpen(false);
      setDeletingKaryakarta(null);
      fetchKaryakartas();
    } catch (e) {
      console.error('Error deleting karyakarta:', e);
      setError('Failed to remove karyakarta.');
    }
  };

  // Filtered List
  const filteredKaryakartas = useMemo(() => {
    return karyakartas.filter(k => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = k.name?.toLowerCase().includes(q);
        const matchesEpic = k.voterId?.toLowerCase().includes(q);
        const matchesMobile = k.mobile?.toLowerCase().includes(q);
        const matchesVillage = k.village?.toLowerCase().includes(q);
        const matchesBooth = k.assignedBoothName?.toLowerCase().includes(q) || k.boothName?.toLowerCase().includes(q) || k.voterBoothName?.toLowerCase().includes(q);
        const matchesAdmin = k.adminName?.toLowerCase().includes(q) || k.adminEmail?.toLowerCase().includes(q);
        const matchesMgr = k.managerName?.toLowerCase().includes(q) || k.managerEmail?.toLowerCase().includes(q);

        if (!matchesName && !matchesEpic && !matchesMobile && !matchesVillage && !matchesBooth && !matchesAdmin && !matchesMgr) {
          return false;
        }
      }

      // 2. Status
      if (statusFilter !== 'All' && k.status !== statusFilter) {
        return false;
      }

      // 3. Booth (Duty Booth)
      if (boothFilter === 'Assigned' && !k.assignedBoothId && !k.assignedBoothName) {
        return false;
      }
      if (boothFilter === 'Unassigned' && (k.assignedBoothId || k.assignedBoothName)) {
        return false;
      }
      if (boothFilter !== 'All' && boothFilter !== 'Assigned' && boothFilter !== 'Unassigned') {
        if (k.assignedBoothId !== boothFilter) return false;
      }

      // 4. Admin filter (for Super Admin)
      if (adminFilter !== 'All' && String(k.adminId) !== adminFilter && String(k.adminEmail) !== adminFilter) {
        return false;
      }

      // 5. Manager filter
      if (managerFilter !== 'All') {
        if (managerFilter === 'unassigned' && k.managerId) return false;
        if (managerFilter !== 'unassigned' && String(k.managerId) !== managerFilter) return false;
      }

      return true;
    });
  }, [karyakartas, searchQuery, statusFilter, boothFilter, adminFilter, managerFilter]);

  // Metrics
  const metrics = useMemo(() => {
    const total = karyakartas.length;
    const active = karyakartas.filter(k => k.status === 'Active').length;
    const assigned = karyakartas.filter(k => k.assignedBoothId || k.assignedBoothName).length;
    const totalTasks = karyakartas.reduce((acc, k) => acc + (k.tasks?.length || 0), 0);
    const completedTasks = karyakartas.reduce((acc, k) => acc + (k.tasks?.filter(t => t.status === 'Completed').length || 0), 0);
    const totalRatings = karyakartas.reduce((acc, k) => acc + (k.performanceRating || 5), 0);
    const avgRating = total > 0 ? (totalRatings / total).toFixed(1) : '5.0';

    return { total, active, assigned, totalTasks, completedTasks, avgRating };
  }, [karyakartas]);

  // Excel Export
  const handleExport = (format: 'xlsx' | 'csv') => {
    const data = filteredKaryakartas.map((k, i) => ({
      'Sr. No.': i + 1,
      'Name': k.name,
      'EPIC Number': k.voterId,
      'Mobile': k.mobile || '',
      'Status': k.status,
      'Supervising Admin': k.adminName || k.adminEmail || k.adminId,
      'Reporting Manager': k.managerName || (k.managerId ? k.managerId : 'Direct Admin'),
      'Registered Voting Booth': (k.boothNumber || k.voterBoothNumber) ? `#${k.boothNumber || k.voterBoothNumber} - ${k.boothName || k.voterBoothName}` : (k.boothName || k.voterBoothName || '—'),
      'Assigned Duty Booth': k.assignedBoothName ? (k.assignedBoothNumber ? `#${k.assignedBoothNumber} - ` : '') + k.assignedBoothName : 'Unassigned',
      'Village / Area': k.village || '',
      'Performance Rating': k.performanceRating || 5.0,
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
    <div className="space-y-6 w-full pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Karyakartas
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {metrics.total} Staff
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Field workforce and task assignments.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasRight('volunteers', 'c') && (
            <button
              onClick={() => setIsRecruitOpen(true)}
              className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Plus size={14} />
              <span>Add Karyakarta</span>
            </button>
          )}

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExport('xlsx')}
              className="px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-all"
              title="Export as Excel"
            >
              <Download size={13} />
              <span>Export</span>
            </button>
            <button
              onClick={fetchKaryakartas}
              className="p-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <TableColumnManager columnManager={volunteerColumnManager} tableName="Volunteers" />
          </div>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Total Staff</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-zinc-900 dark:text-white">{metrics.total}</span>
            <span className="text-[11px] text-emerald-600 font-medium">{metrics.active} Active</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Booth Assigned</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{metrics.assigned}</span>
            <span className="text-[11px] text-zinc-500">assigned</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Tasks</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{metrics.completedTasks}</span>
            <span className="text-[11px] text-zinc-500">/ {metrics.totalTasks} Done</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3.5 rounded-xl shadow-xs">
          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Rating</p>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-xl font-bold text-amber-500 flex items-center gap-1">
              <Star size={15} className="fill-amber-400" /> {metrics.avgRating}
            </span>
            <span className="text-[11px] text-zinc-400">/ 5.0</span>
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

      {/* Filter Bar with Admin & Manager selectors */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3 top-3 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by Name, EPIC, Mobile, Village, Booth, Admin, or Manager..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs font-medium text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            {/* Super Admin: Admin Selector */}
            {isSuperAdmin && (
              <select
                value={adminFilter}
                onChange={e => setAdminFilter(e.target.value)}
                className="h-9 px-3 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/40 text-xs font-bold text-blue-700 dark:text-blue-300 max-w-[200px] truncate"
                title="Filter by Supervising Admin"
              >
                <option value="All">👑 All Admins (Global Roster)</option>
                {admins.map(a => (
                  <option key={a.id || a.uid} value={String(a.id || a.uid)}>
                    Admin: {a.name || a.username || a.email}
                  </option>
                ))}
              </select>
            )}

            {/* Manager Filter */}
            <select
              value={managerFilter}
              onChange={e => setManagerFilter(e.target.value)}
              className="h-9 px-3 rounded-lg border border-purple-200 dark:border-purple-900/60 bg-purple-50/50 dark:bg-purple-950/40 text-xs font-bold text-purple-700 dark:text-purple-300 max-w-[190px] truncate"
              title="Filter by Assigned Manager"
            >
              <option value="All">💼 All Managers</option>
              <option value="unassigned">Direct Admin (No Manager)</option>
              {managers.map(m => (
                <option key={m.id || m.uid} value={String(m.id || m.uid)}>
                  Mgr: {m.name || m.username || m.email}
                </option>
              ))}
            </select>

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
              title="Filter by Assigned Duty Booth"
            >
              <option value="All">All Duty Booths</option>
              <option value="Assigned">Assigned to Duty Booth</option>
              <option value="Unassigned">Unassigned Duty Booth</option>
              {booths.map(b => (
                <option key={b.id} value={b.id}>
                  {b.boothNumber ? `#${b.boothNumber} - ` : ''}{b.name}
                </option>
              ))}
            </select>

            {(searchQuery || statusFilter !== 'All' || boothFilter !== 'All' || adminFilter !== 'All' || managerFilter !== 'All') && (
              <button
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('All');
                  setBoothFilter('All');
                  setAdminFilter('All');
                  setManagerFilter('All');
                }}
                className="h-9 px-2.5 text-xs font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline whitespace-nowrap"
              >
                Reset
              </button>
            )}
          </div>
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
                  {volunteerColumnManager.visibleColumns.map(col => {
                    switch (col.id) {
                      case 'sr_no':
                        return <th key={col.id} className="p-3.5 w-12 text-center">#</th>;
                      case 'name_epic':
                        return <th key={col.id} className="p-3.5">Name &amp; EPIC</th>;
                      case 'leadership':
                        return isSuperAdmin ? <th key={col.id} className="p-3.5">Supervising Leadership</th> : null;
                      case 'mobile':
                        return <th key={col.id} className="p-3.5">Contact</th>;
                      case 'registered_booth':
                        return <th key={col.id} className="p-3.5" title="Where this voter is enrolled in the electoral voter roll">Registered Booth (Voter Roll)</th>;
                      case 'assigned_booth':
                        return <th key={col.id} className="p-3.5" title="Operational polling station assigned for volunteer duties">Assigned Duty Booth (Campaign)</th>;
                      case 'village':
                        return <th key={col.id} className="p-3.5">Village / Area</th>;
                      case 'tasks':
                        return <th key={col.id} className="p-3.5">Tasks</th>;
                      case 'rating':
                        return <th key={col.id} className="p-3.5 text-center">Rating</th>;
                      case 'status':
                        return <th key={col.id} className="p-3.5 text-center">Status</th>;
                      case 'aadhaar':
                        return <th key={col.id} className="p-3.5">Aadhaar</th>;
                      case 'gender_age':
                        return <th key={col.id} className="p-3.5">Gender / Age</th>;
                      case 'house_no':
                        return <th key={col.id} className="p-3.5">House No</th>;
                      case 'caste':
                        return <th key={col.id} className="p-3.5">Caste</th>;
                      case 'occupation':
                        return <th key={col.id} className="p-3.5">Occupation</th>;
                      case 'created_at':
                        return <th key={col.id} className="p-3.5">Enrolled Date</th>;
                      case 'actions':
                        return <th key={col.id} className="p-3.5 text-right">Actions</th>;
                      default:
                        return <th key={col.id} className="p-3.5">{col.label}</th>;
                    }
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-zinc-700 dark:text-zinc-300">
                {filteredKaryakartas.map((k, idx) => {
                  const completedTasks = k.tasks?.filter(t => t.status === 'Completed').length || 0;
                  const totalTasks = k.tasks?.length || 0;

                  return (
                    <tr key={k.id} className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors">
                      {volunteerColumnManager.visibleColumns.map(col => {
                        switch (col.id) {
                          case 'sr_no':
                            return <td key={col.id} className="p-3.5 text-center font-mono text-zinc-400 text-[11px]">{idx + 1}</td>;
                          case 'name_epic':
                            return (
                              <td key={col.id} className="p-3.5">
                                <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                  {k.name}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                                  <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 font-semibold">{k.voterId}</span>
                                </div>
                              </td>
                            );
                          case 'leadership':
                            if (!isSuperAdmin) return null;
                            return (
                              <td key={col.id} className="p-3.5 space-y-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800/40">
                                    <Shield size={10} className="text-blue-600" />
                                    <span>Admin: {getKaryakartaAdminName(k)}</span>
                                  </span>

                                  {getKaryakartaManagerName(k) ? (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 px-1.5 py-0.5 rounded border border-purple-200 dark:border-purple-800/40">
                                      <Users size={10} className="text-purple-600" />
                                      <span>Mgr: {getKaryakartaManagerName(k)}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-[9px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                                      Direct Admin
                                    </span>
                                  )}
                                </div>
                              </td>
                            );
                          case 'mobile':
                            return (
                              <td key={col.id} className="p-3.5 font-mono">
                                <div className="flex items-center gap-1.5">
                                  <span>{k.mobile || '—'}</span>
                                  {k.mobile && (
                                    <a href={`tel:${k.mobile}`} className="text-blue-600 hover:text-blue-800 p-0.5" title="Call">
                                      <Phone size={12} />
                                    </a>
                                  )}
                                </div>
                              </td>
                            );
                          case 'registered_booth':
                            return (
                              <td key={col.id} className="p-3.5 font-medium">
                                {(k.boothName || k.voterBoothName) ? (
                                  <div className="flex items-center gap-1.5" title={`Voter Roll Booth: ${k.boothNumber || k.voterBoothNumber ? '#' + (k.boothNumber || k.voterBoothNumber) + ' ' : ''}${k.boothName || k.voterBoothName}`}>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 bg-zinc-100 dark:bg-zinc-800/80 px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 max-w-[180px] truncate">
                                      <Vote size={12} className="text-blue-500 shrink-0" />
                                      <span className="truncate">
                                        {k.boothNumber || k.voterBoothNumber ? `#${k.boothNumber || k.voterBoothNumber} ` : ''}{k.boothName || k.voterBoothName}
                                      </span>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-zinc-400 italic text-[11px]">—</span>
                                )}
                              </td>
                            );
                          case 'assigned_booth':
                            return (
                              <td key={col.id} className="p-3.5 font-medium">
                                {k.assignedBoothName ? (
                                  <div className="flex items-center gap-1.5" title={`Campaign Duty Booth: ${k.assignedBoothNumber ? '#' + k.assignedBoothNumber + ' ' : ''}${k.assignedBoothName}`}>
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 px-2 py-1 rounded-lg border border-purple-200 dark:border-purple-800/50 max-w-[180px] truncate">
                                      <MapPin size={12} className="text-purple-600 dark:text-purple-400 shrink-0" />
                                      <span className="truncate">
                                        {k.assignedBoothNumber ? `#${k.assignedBoothNumber} ` : ''}{k.assignedBoothName}
                                      </span>
                                    </span>
                                  </div>
                                ) : (
                                  <span className="inline-flex items-center text-[10px] font-medium text-zinc-400 bg-zinc-100 dark:bg-zinc-800/60 px-2 py-0.5 rounded-full italic">
                                    Unassigned
                                  </span>
                                )}
                              </td>
                            );
                          case 'village':
                            return (
                              <td key={col.id} className="p-3.5 text-zinc-600 dark:text-zinc-400">
                                {k.village || k.boothName || '—'}
                              </td>
                            );
                          case 'tasks':
                            return (
                              <td key={col.id} className="p-3.5">
                                <button
                                  onClick={() => handleOpenTasks(k)}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-blue-50 hover:text-blue-600 text-[11px] font-semibold transition-colors"
                                >
                                  <ListTodo size={12} />
                                  <span>{completedTasks}/{totalTasks} Done</span>
                                </button>
                              </td>
                            );
                          case 'rating':
                            return (
                              <td key={col.id} className="p-3.5 text-center">
                                <span className="font-bold text-amber-500 flex items-center justify-center gap-0.5">
                                  <Star size={12} className="fill-amber-400" /> {k.performanceRating?.toFixed(1) || '5.0'}
                                </span>
                              </td>
                            );
                          case 'status':
                            return (
                              <td key={col.id} className="p-3.5 text-center">
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
                            );
                          case 'aadhaar':
                            return <td key={col.id} className="p-3.5 font-mono text-zinc-600 dark:text-zinc-400">{k.aadharNumber || '—'}</td>;
                          case 'gender_age':
                            return <td key={col.id} className="p-3.5 text-zinc-600 dark:text-zinc-400">{[k.gender, k.age ? `${k.age} yrs` : ''].filter(Boolean).join(', ') || '—'}</td>;
                          case 'house_no':
                            return <td key={col.id} className="p-3.5 text-zinc-600 dark:text-zinc-400">{k.houseNo || '—'}</td>;
                          case 'caste':
                            return <td key={col.id} className="p-3.5 text-zinc-600 dark:text-zinc-400">{k.caste || '—'}</td>;
                          case 'occupation':
                            return <td key={col.id} className="p-3.5 text-zinc-600 dark:text-zinc-400">{k.occupation || '—'}</td>;
                          case 'created_at':
                            return <td key={col.id} className="p-3.5 text-zinc-500 text-[11px] whitespace-nowrap">{k.createdAt ? new Date(k.createdAt).toLocaleDateString() : '—'}</td>;
                          case 'actions':
                            return (
                              <td key={col.id} className="p-3.5 text-right space-x-1 whitespace-nowrap">
                                <button
                                  onClick={() => {
                                    setActiveKaryakarta(k);
                                    setIsViewOpen(true);
                                  }}
                                  className="p-1 rounded text-zinc-400 hover:text-blue-600"
                                  title="View Full Profile & Hierarchy"
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
                            );
                          default:
                            return null;
                        }
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 1. VIEW KARYAKARTA PROFILE & HIERARCHY MODAL (COMPREHENSIVE) */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isViewOpen && activeKaryakarta && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Modal Top Header */}
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-gradient-to-r from-blue-600/10 via-purple-600/10 to-indigo-600/10 flex justify-between items-start">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-blue-600 text-white font-black text-lg flex items-center justify-center shadow-md">
                    {activeKaryakarta.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white text-lg flex items-center gap-2">
                      {activeKaryakarta.name}
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        activeKaryakarta.status === 'Active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-zinc-200 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                      }`}>
                        {activeKaryakarta.status}
                      </span>
                    </h3>
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-mono font-bold flex items-center gap-1.5 mt-0.5">
                      <IdCard size={13} /> EPIC: {activeKaryakarta.voterId}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs font-bold text-amber-500 bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 rounded-lg border border-amber-200 dark:border-amber-800/40">
                    <Star size={13} className="fill-amber-400" /> {activeKaryakarta.performanceRating?.toFixed(1) || '5.0'}
                  </span>
                  <button 
                    onClick={() => setIsViewOpen(false)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* Modal Body with Hierarchy & Dual Booth Details */}
              <div className="p-5 space-y-5 overflow-y-auto flex-1 text-xs">
                
                {/* 1. SUPERVISORY LEADERSHIP & HIERARCHY LINKS */}
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-xs">
                    <Network size={15} className="text-purple-600" />
                    <span>Supervising Leadership Chain</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Admin Supervisor Card */}
                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Shield size={12} /> Supervising Admin
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          Sector Authority
                        </span>
                      </div>
                      <p className="font-bold text-sm text-zinc-900 dark:text-white">
                        {getKaryakartaAdminName(activeKaryakarta)}
                      </p>
                      {activeKaryakarta.adminEmail && (
                        <p className="text-[11px] text-zinc-500 font-medium">
                          {activeKaryakarta.adminEmail}
                        </p>
                      )}
                    </div>

                    {/* Team Manager Card */}
                    <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/30 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <Users size={12} /> Assigned Manager
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          getKaryakartaManagerName(activeKaryakarta) ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {getKaryakartaManagerName(activeKaryakarta) ? 'Team Lead' : 'Direct Under Admin'}
                        </span>
                      </div>
                      <p className="font-bold text-sm text-zinc-900 dark:text-white">
                        {getKaryakartaManagerName(activeKaryakarta) || 'Direct Under Admin (No Intermediary Manager)'}
                      </p>
                      {activeKaryakarta.managerEmail && (
                        <p className="text-[11px] text-zinc-500 font-medium">
                          {activeKaryakarta.managerEmail}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. DUAL BOOTH BREAKDOWN: REGISTERED VOTER BOOTH VS CAMPAIGN DUTY BOOTH */}
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-xs">
                    <MapPin size={15} className="text-emerald-600" />
                    <span>Polling Booth &amp; Territory Structure (Voting vs. Campaign Duty)</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Card A: Registered Voting Booth (Personal Electoral Roll) */}
                    <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                          <Vote size={12} /> 1. Registered Voting Booth
                        </span>
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                          Electoral Roll
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white">
                          {activeKaryakarta.boothNumber || activeKaryakarta.voterBoothNumber ? `#${activeKaryakarta.boothNumber || activeKaryakarta.voterBoothNumber} - ` : ''}
                          {activeKaryakarta.boothName || activeKaryakarta.voterBoothName || 'Not Linked to Booth Roll'}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Where this individual personally belongs &amp; casts their vote
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1.5 border-t border-blue-100 dark:border-blue-900/30 text-zinc-600 dark:text-zinc-400">
                        <div><span className="text-[10px] text-zinc-400 block font-semibold">Part / Serial:</span> Part {activeKaryakarta.partNo || '—'} / Sr {activeKaryakarta.srNo || '—'}</div>
                        <div><span className="text-[10px] text-zinc-400 block font-semibold">Village / Area:</span> {activeKaryakarta.village || '—'}</div>
                      </div>
                    </div>

                    {/* Card B: Campaign Duty Booth (Assigned Operational Territory) */}
                    <div className="p-3.5 rounded-xl border border-purple-200 dark:border-purple-900/50 bg-purple-50/40 dark:bg-purple-950/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black uppercase text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <MapPin size={12} /> 2. Campaign Duty Booth
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                          activeKaryakarta.assignedBoothName ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                        }`}>
                          {activeKaryakarta.assignedBoothName ? 'Assigned Duty' : 'Unassigned'}
                        </span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-purple-700 dark:text-purple-300">
                          {activeKaryakarta.assignedBoothNumber ? `#${activeKaryakarta.assignedBoothNumber} - ` : ''}
                          {activeKaryakarta.assignedBoothName || 'Unassigned (No duty booth assigned)'}
                        </p>
                        <p className="text-[10px] text-zinc-400 mt-0.5">
                          Operational polling booth assigned for volunteer campaign duties
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1.5 border-t border-purple-100 dark:border-purple-900/30 text-zinc-600 dark:text-zinc-400">
                        <div><span className="text-[10px] text-zinc-400 block font-semibold">Assigned By:</span> {getKaryakartaManagerName(activeKaryakarta) || getKaryakartaAdminName(activeKaryakarta)}</div>
                        <div><span className="text-[10px] text-zinc-400 block font-semibold">Duty Status:</span> {activeKaryakarta.assignedBoothName ? 'Active On-Duty' : 'Pending Deployment'}</div>
                      </div>
                    </div>
                  </div>

                  {/* Demographics row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-zinc-50 dark:bg-zinc-950/60 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">House / Address</span>
                      <p className="text-zinc-700 dark:text-zinc-300 mt-0.5 truncate text-[11px]">
                        {activeKaryakarta.houseNo ? `H.No ${activeKaryakarta.houseNo}, ` : ''}{activeKaryakarta.address || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Age / Gender</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 text-[11px]">
                        {activeKaryakarta.age ? `${activeKaryakarta.age} yrs` : '—'} • {activeKaryakarta.gender || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Caste / Occupation</span>
                      <p className="font-medium text-zinc-700 dark:text-zinc-300 mt-0.5 text-[11px]">
                        {activeKaryakarta.caste || '—'} • {activeKaryakarta.occupation || '—'}
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-zinc-400 font-bold uppercase block">Political Inclination</span>
                      <p className="font-bold text-blue-600 dark:text-blue-400 mt-0.5 text-[11px]">
                        {activeKaryakarta.partyInclination || 'Neutral'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. WORKFLOW TASKS */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-zinc-900 dark:text-white font-bold text-xs">
                      <ListTodo size={15} className="text-blue-600" />
                      <span>Campaign Tasks ({activeKaryakarta.tasks?.filter(t => t.status === 'Completed').length || 0} / {activeKaryakarta.tasks?.length || 0} Done)</span>
                    </div>
                    <button
                      onClick={() => {
                        setIsViewOpen(false);
                        handleOpenTasks(activeKaryakarta);
                      }}
                      className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Manage Tasks
                    </button>
                  </div>

                  {activeKaryakarta.tasks && activeKaryakarta.tasks.length > 0 ? (
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {activeKaryakarta.tasks.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800">
                          <span className={`text-xs font-medium ${t.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                            {t.title}
                          </span>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                            t.status === 'Completed' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400'
                          }`}>
                            {t.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-400 italic p-2 bg-zinc-50 dark:bg-zinc-950 rounded-lg text-center">
                      No campaign tasks assigned yet.
                    </p>
                  )}
                </div>

                {/* Direct Action Contacts */}
                {activeKaryakarta.mobile && (
                  <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <a
                      href={`tel:${activeKaryakarta.mobile}`}
                      className="flex-1 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <Phone size={14} /> Call Karyakarta
                    </a>
                    <a
                      href={`https://wa.me/${activeKaryakarta.mobile.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </a>
                  </div>
                )}

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 2. RECRUIT KARYAKARTA MODAL */}
      {/* ========================================================================= */}
      <AnimatePresence>
        {isRecruitOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <motion.div 
              initial={{ scale: 0.97, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.97, opacity: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
            >
              <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Plus className="text-blue-600" size={18} />
                  <h3 className="font-bold text-zinc-900 dark:text-white text-base">Recruit Karyakarta from Voter Directory</h3>
                </div>
                <button onClick={() => setIsRecruitOpen(false)}><X size={18} /></button>
              </div>

              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {/* Supervising Admin & Manager assignment selectors */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800">
                  {isSuperAdmin && (
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                        Supervising Administrator (Admin)
                      </label>
                      <select
                        value={recruitAdminId}
                        onChange={e => setRecruitAdminId(e.target.value)}
                        className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-blue-600 dark:text-blue-400"
                      >
                        {admins.map(a => (
                          <option key={a.id || a.uid} value={String(a.id || a.uid)}>
                            {a.name || a.username} ({a.email})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-bold uppercase text-zinc-400 mb-1">
                      Assigned Team Manager (Optional)
                    </label>
                    <select
                      value={recruitManagerId}
                      onChange={e => setRecruitManagerId(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-bold text-purple-600 dark:text-purple-400"
                    >
                      <option value="">Direct Under Admin (No Manager)</option>
                      {managers
                        .filter(m => !recruitAdminId || String(m.parentAdminId || m.parent_admin_id) === String(recruitAdminId) || isSuperAdmin)
                        .map(m => (
                          <option key={m.id || m.uid} value={String(m.id || m.uid)}>
                            {m.name || m.username} ({m.email || 'Manager'})
                          </option>
                        ))}
                    </select>
                  </div>
                </div>

                {/* Voter Search Bar */}
                <div className="space-y-1.5">
                  <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3 top-2.5 text-zinc-400" />
                      <input
                        type="text"
                        value={voterSearch}
                        onChange={e => setVoterSearch(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchVoters(voterSearch, recruitBoothFilter)}
                        placeholder="Type voter name, EPIC, or mobile to search..."
                        className="w-full h-9 pl-9 pr-8 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-blue-500 font-medium"
                      />
                      {voterSearch && (
                        <button
                          onClick={() => setVoterSearch('')}
                          className="absolute right-2.5 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                          title="Clear search"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <select
                      value={recruitBoothFilter}
                      onChange={e => setRecruitBoothFilter(e.target.value)}
                      className="h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs max-w-[160px] truncate font-medium text-zinc-700 dark:text-zinc-200"
                      title="Filter voter list by Registered Booth"
                    >
                      <option value="">All Booths</option>
                      {booths.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.boothNumber ? `#${b.boothNumber} ` : ''}{b.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => handleSearchVoters(voterSearch, recruitBoothFilter)}
                      disabled={loadingVoters}
                      className="px-3.5 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shrink-0 transition-all shadow-xs"
                      title="Search directory"
                    >
                      <RefreshCw size={13} className={loadingVoters ? 'animate-spin' : ''} />
                      <span>Search</span>
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
                    <span>
                      {loadingVoters ? (
                        <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-medium">
                          <RefreshCw size={11} className="animate-spin" /> Searching voter directory...
                        </span>
                      ) : (
                        <span>Showing {votersList.length} registered voter{votersList.length === 1 ? '' : 's'}</span>
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-400">⚡ Live search as you type</span>
                  </div>
                </div>

                {/* Search Results */}
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                  {loadingVoters && votersList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 flex flex-col items-center gap-2">
                      <RefreshCw size={20} className="animate-spin text-blue-600" />
                      <span>Searching voter records...</span>
                    </div>
                  ) : votersList.length === 0 ? (
                    <div className="py-12 text-center text-xs text-zinc-400 space-y-1">
                      <p className="font-semibold text-zinc-600 dark:text-zinc-400">No Voters Found</p>
                      <p className="text-[11px] text-zinc-400">
                        {voterSearch ? `No matching voters found for "${voterSearch}".` : 'No voters enrolled under this booth selection.'}
                      </p>
                    </div>
                  ) : (
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-zinc-50 dark:bg-zinc-950 text-[10px] font-bold uppercase text-zinc-500 sticky top-0 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">EPIC No</th>
                          <th className="p-2.5">Mobile</th>
                          <th className="p-2.5">Registered Booth</th>
                          <th className="p-2.5 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {votersList.map(v => {
                          const isAlreadyRecruited = karyakartas.some(k => k.voterDocId === String(v.id) || k.voterId === v.voter_id);

                          return (
                            <tr key={v.id} className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30">
                              <td className="p-2.5 font-bold text-zinc-900 dark:text-white">{v.name}</td>
                              <td className="p-2.5 font-mono text-blue-600 dark:text-blue-400 font-semibold">{v.voter_id}</td>
                              <td className="p-2.5 font-mono text-zinc-500">{v.mobile || '—'}</td>
                              <td className="p-2.5 text-zinc-500">
                                <span className="inline-flex items-center gap-1 text-[11px]">
                                  <Vote size={11} className="text-blue-500" />
                                  {v.booth_number ? `#${v.booth_number} ` : ''}{v.booth_name || v.village || '—'}
                                </span>
                              </td>
                              <td className="p-2.5 text-right">
                                {isAlreadyRecruited ? (
                                  <span className="text-[10px] text-emerald-600 font-bold px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/60 dark:text-emerald-400 rounded">Recruited</span>
                                ) : (
                                  <button
                                    onClick={() => handleRecruitVoter(v)}
                                    className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] shadow-xs"
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
      {/* 3. EDIT KARYAKARTA MODAL */}
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
                <h3 className="font-bold text-zinc-900 dark:text-white text-base">Edit Karyakarta Profile</h3>
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
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Mobile Number</label>
                    <input
                      type="text"
                      value={editMobile}
                      onChange={e => setEditMobile(e.target.value)}
                      className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Status</label>
                    <select
                      value={editStatus}
                      onChange={e => setEditStatus(e.target.value as any)}
                      className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold"
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Supervising Admin</label>
                    <select
                      value={editAdminId}
                      onChange={e => setEditAdminId(e.target.value)}
                      className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-blue-600 dark:text-blue-400"
                    >
                      {admins.map(a => (
                        <option key={a.id || a.uid} value={String(a.id || a.uid)}>
                          {a.name || a.username} ({a.email})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">Assigned Team Manager</label>
                  <select
                    value={editManagerId}
                    onChange={e => setEditManagerId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 font-bold text-purple-600 dark:text-purple-400"
                  >
                    <option value="">Direct Under Admin (No Manager)</option>
                    {managers
                      .filter(m => !editAdminId || String(m.parentAdminId || m.parent_admin_id) === String(editAdminId) || isSuperAdmin)
                      .map(m => (
                        <option key={m.id || m.uid} value={String(m.id || m.uid)}>
                          {m.name || m.username} ({m.email || 'Manager'})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Registered Voting Booth - Read-Only Electoral Context */}
                <div className="p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40 bg-blue-50/50 dark:bg-blue-950/30">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 flex items-center gap-1">
                      <Vote size={11} /> Registered Voting Booth (Electoral Roll)
                    </span>
                    <span className="text-[9px] font-semibold text-zinc-400">Read-Only</span>
                  </div>
                  <p className="font-bold text-xs text-zinc-800 dark:text-zinc-200">
                    {activeKaryakarta.boothNumber || activeKaryakarta.voterBoothNumber ? `#${activeKaryakarta.boothNumber || activeKaryakarta.voterBoothNumber} - ` : ''}
                    {activeKaryakarta.boothName || activeKaryakarta.voterBoothName || 'Not Linked to Booth Roll'}
                  </p>
                </div>

                {/* Assigned Campaign Duty Booth Dropdown */}
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-400 mb-1">
                    Assign Campaign Duty Booth (Fieldwork Duty)
                  </label>
                  <select
                    value={editBoothId}
                    onChange={e => setEditBoothId(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-purple-200 dark:border-purple-800/60 bg-white dark:bg-zinc-950 font-bold text-purple-700 dark:text-purple-300"
                  >
                    <option value="">Unassigned (No duty booth assigned)</option>
                    {booths.map(b => (
                      <option key={b.id} value={b.id}>
                        {b.boothNumber ? `#${b.boothNumber} - ` : ''}{b.name}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] text-zinc-400 mt-1">
                    Select the polling station where this Karyakarta will perform operational campaign duties.
                  </p>
                </div>

                <div className="flex gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
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
                    Save Changes
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ========================================================================= */}
      {/* 4. TASKS MODAL */}
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
                  <p className="text-[11px] text-zinc-400 font-mono">EPIC: {activeKaryakarta.voterId}</p>
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
                    className="w-full h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-xs font-medium"
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
                    className="w-full py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs flex items-center justify-center gap-1"
                  >
                    <Plus size={13} />
                    <span>Assign Task</span>
                  </button>
                </form>

                {/* Tasks List */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                    Assigned Tasks ({activeKaryakarta.tasks?.length || 0})
                  </span>

                  {(!activeKaryakarta.tasks || activeKaryakarta.tasks.length === 0) ? (
                    <div className="py-8 text-center text-xs text-zinc-400">No tasks assigned yet.</div>
                  ) : (
                    <div className="space-y-1.5">
                      {activeKaryakarta.tasks.map(t => (
                        <div
                          key={t.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-all ${
                            t.status === 'Completed'
                              ? 'bg-zinc-50 dark:bg-zinc-950/40 border-zinc-200 dark:border-zinc-800/60 opacity-70'
                              : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
                          }`}
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <button
                              onClick={() => handleToggleTaskStatus(t.id, t.status)}
                              className="text-zinc-400 hover:text-blue-600 shrink-0"
                            >
                              {t.status === 'Completed' ? (
                                <CheckSquare size={16} className="text-emerald-600" />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold truncate ${t.status === 'Completed' ? 'line-through text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                                {t.title}
                              </p>
                              <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-0.5">
                                <span className={`px-1.5 py-0.2 rounded font-bold ${
                                  t.priority === 'Urgent' ? 'bg-red-100 text-red-600' :
                                  t.priority === 'High' ? 'bg-amber-100 text-amber-600' :
                                  t.priority === 'Medium' ? 'bg-blue-100 text-blue-600' :
                                  'bg-zinc-100 text-zinc-600'
                                }`}>
                                  {t.priority || 'Medium'}
                                </span>
                                {t.dueDate && (
                                  <span className="flex items-center gap-0.5">
                                    <Calendar size={10} /> Due: {t.dueDate}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteTask(t.id)}
                            className="p-1 text-zinc-400 hover:text-red-600 rounded shrink-0"
                            title="Delete Task"
                          >
                            <Trash2 size={13} />
                          </button>
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
      {/* 5. DELETE CONFIRMATION MODAL */}
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
