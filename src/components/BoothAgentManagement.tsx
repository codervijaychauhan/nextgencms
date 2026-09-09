import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, RefreshCw, MapPin, ShieldAlert, AlertCircle, X,
  Building2, UserMinus, Plus, Search, User, Eye, Trash2,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

interface PollingBooth {
  id: string;
  name: string;
  boothNumber: string;
  address?: string;
  village?: string;
  constituencyId: string;
  constituencyName?: string;
}

interface Volunteer {
  id: string;
  name: string;
  voterId: string;
  aadharNumber?: string;
  mobile?: string;
  status: string;
}

interface BoothAssignment {
  id: string; // adminId + '_' + boothId + '_' + volunteerId
  adminId: string;
  boothId: string;
  boothNumber: string;
  boothName: string;
  agentVolunteerDocId: string;
  agentName: string;
  agentAadhar?: string;
  agentMobile?: string;
  designation?: string;
  createdAt?: unknown;
}

export default function BoothAgentManagement() {
  const { user, isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };
  
  const [booths, setBooths] = useState<PollingBooth[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [assignments, setAssignments] = useState<BoothAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [boothSearch, setBoothSearch] = useState('');
  const [agentSearch, setAgentSearch] = useState('');
  const [adminUsers, setAdminUsers] = useState<{ uid: string; username: string; email: string; role: string }[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('All');

  // Load high-privilege users specifically for the Admin dropdown filter
  useEffect(() => {
    if (!user || !hasRight('booths', 'v')) {
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

  // Selector Modal state
  const [activeBoothForAssignment, setActiveBoothForAssignment] = useState<PollingBooth | null>(null);

  // Booth info & list of Karyakartas popup/drawer state (slides in from left)
  const [selectedBoothDetails, setSelectedBoothDetails] = useState<PollingBooth | null>(null);

  // View mode switcher: 'table' (standard list) vs 'frame' (unified layout showing all Karyakartas per booth in one frame) vs 'detailed-roster' (detailed tables per booth)
  const [viewMode, setViewMode] = useState<'table' | 'frame' | 'detailed-roster'>('table');

  // Track expanded booths in the Booth Summary table accordion view
  const [expandedBooths, setExpandedBooths] = useState<Record<string, boolean>>({});

  // Dismiss Karyakarta confirmation state
  const [dismissingAssignment, setDismissingAssignment] = useState<{
    boothId: string;
    assignmentId: string;
    volunteerId: string;
    agentName: string;
  } | null>(null);

  // Deployment customization states
  const [selectedVolForDeploy, setSelectedVolForDeploy] = useState<Volunteer | null>(null);
  const [deployDesignation, setDeployDesignation] = useState('Booth President');
  const [isDeployCustomDesignation, setIsDeployCustomDesignation] = useState(false);
  const [customDeployDesignationText, setCustomDeployDesignationText] = useState('');

  // Inline edit state inside the details offcanvas/drawer
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editDesignation, setEditDesignation] = useState('');
  const [isEditCustomDesignation, setIsEditCustomDesignation] = useState(false);
  const [customEditDesignationText, setCustomEditDesignationText] = useState('');

  // Dynamic set of unique designations from presets + existing assignments
  const existingDesignations = React.useMemo(() => {
    const list = new Set<string>();
    [
      'Booth President',                      // अध्यक्ष
      'Booth Vice President',                 // V.P
      'Booth Secretary',                      // मंत्री
      'Booth Level Agent (B.L.A.)',           // बी.एल.ए
      'Women Wing Head (Mahila Pramukh)',     // महिला प्रमुख
      'Youth Wing Head (Yuva Pramukh)',       // युवा प्रमुख
      'Mann Ki Baat Coordinator',             // मन की बात प्रमुख
      'WhatsApp & Social Media Coordinator',  // व्हाट्सएप प्रमुख
      'Beneficiary Outreach Coordinator',     // लाभार्थी प्रमुख
      'Key Voters Coordinator',               // की वोटर्स प्रमुख
      'Booth Committee Member',               // सदस्य
      'Voter Roll Page In-charge (Panna Pramukh)', // Recommended
      'Campaign Materials Coordinator',       // Recommended
      'Elderly & Disabled Assistance In-charge' // Recommended
    ].forEach(d => list.add(d));
    assignments.forEach(a => {
      if (a.designation && a.designation.trim()) {
        list.add(a.designation.trim());
      }
    });
    return Array.from(list);
  }, [assignments]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const [boothsData, volData, assignData] = await Promise.all([
        api.get<any[]>('/api/booths'),
        api.get<any[]>('/api/volunteers'),
        api.get<any[]>('/api/booths/agents')
      ]);

      let list: PollingBooth[] = (boothsData || []).map((data: any) => ({
        id: data.id,
        name: data.name || '',
        boothNumber: data.boothNumber || data.booth_number || '',
        address: data.address || '',
        village: data.village || '',
        constituencyId: data.constituencyId || data.constituency_id || '',
        constituencyName: data.constituencyName || data.constituency_name || ''
      }));

      // Filter by Allowed ID scopes if not global super_admin
      const allowedConstituencyIds = (!isAdmin && profile?.constituencyId) ? profile.constituencyId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      const allowedBoothIds = (!isAdmin && profile?.boothId) ? profile.boothId.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
      
      const hasAnyScope = allowedConstituencyIds.length > 0 || allowedBoothIds.length > 0;
      
      if (!isAdmin && !hasAnyScope) {
        list = [];
      } else if (!isAdmin) {
        list = list.filter(b => {
          if (allowedBoothIds.length > 0 && !allowedBoothIds.includes(b.id)) return false;
          if (allowedConstituencyIds.length > 0 && !allowedConstituencyIds.includes(b.constituencyId)) return false;
          return true;
        });
      }

      list.sort((a, b) => {
        const numA = parseInt(a.boothNumber, 10);
        const numB = parseInt(b.boothNumber, 10);
        if (isNaN(numA) || isNaN(numB)) return a.boothNumber.localeCompare(b.boothNumber);
        return numA - numB;
      });
      setBooths(list);

      const volList: Volunteer[] = (volData || []).filter((d: any) => (d.status || 'Active') === 'Active').map((data: any) => ({
        id: data.id,
        name: data.name || '',
        voterId: data.voterId || data.voter_id || '',
        aadharNumber: data.aadharNumber || data.aadhar_number || '',
        mobile: data.mobile || '',
        status: data.status || 'Active'
      }));
      setVolunteers(volList);

      const assignList: BoothAssignment[] = (assignData || []).map((data: any) => ({
        id: data.id,
        adminId: data.adminId || data.admin_id || '',
        boothId: data.boothId || data.booth_id || '',
        boothNumber: data.boothNumber || data.booth_number || '',
        boothName: data.boothName || data.booth_name || '',
        agentVolunteerDocId: data.agentVolunteerDocId || data.agent_volunteer_id || '',
        agentName: data.agentName || data.agent_name || '',
        agentAadhar: data.agentAadhar || data.agent_aadhar || '',
        agentMobile: data.agentMobile || data.agent_mobile || '',
        designation: data.designation || 'Booth In-charge'
      }));
      setAssignments(assignList);
    } catch (err: any) {
      console.error("Failed to fetch booth data:", err);
      setError('Failed to fetch polling booths and assignments.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [user, isAdmin, profile]);

  const handleAssignAgent = async (volunteer: Volunteer, designation: string) => {
    if (!activeBoothForAssignment || !user) return;
    if (!hasRight('booths', 'c')) {
      setError('You do not have permission to assign booth Karyakartas.');
      return;
    }
    setSubmitting(true);
    try {
      const docId = `${user.uid}_${activeBoothForAssignment.id}_${volunteer.id}`;
      
      const assignmentData = {
        id: docId,
        adminId: user.uid,
        boothId: activeBoothForAssignment.id,
        boothNumber: activeBoothForAssignment.boothNumber,
        boothName: activeBoothForAssignment.name,
        agentVolunteerDocId: volunteer.id,
        agentName: volunteer.name,
        agentAadhar: volunteer.aadharNumber || '',
        agentMobile: volunteer.mobile || '',
        designation: designation.trim() || 'Booth President'
      };

      await api.post('/api/booths/agents', assignmentData);

      // Update volunteer assigned booth
      try {
        await api.put(`/api/volunteers/${volunteer.id}`, {
          assignedBoothId: activeBoothForAssignment.id,
          assignedBoothName: `#${activeBoothForAssignment.boothNumber} - ${activeBoothForAssignment.name}`
        });
      } catch (volErr) {
        console.warn("Could not update volunteer backward link", volErr);
      }

      setSuccess(`Assigned ${volunteer.name} as Karyakarta for Booth #${activeBoothForAssignment.boothNumber}`);
      setActiveBoothForAssignment(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to assign booth Karyakarta.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateDesignation = async (assignmentId: string, newDesignation: string) => {
    if (!user) return;
    setSubmitting(true);
    try {
      await api.post('/api/booths/agents', {
        id: assignmentId,
        designation: newDesignation.trim() || 'Booth President'
      });
      setSuccess('Karyakarta designation updated successfully.');
      setEditingAssignmentId(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to update Karyakarta designation.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDismissAgent = async () => {
    if (!dismissingAssignment) return;
    if (!hasRight('booths', 'd')) {
      setError('You do not have permission to dismiss booth Karyakartas.');
      return;
    }
    const { assignmentId, volunteerId } = dismissingAssignment;
    
    try {
      await api.delete(`/api/booths/agents/${assignmentId}`);
      
      // Update Volunteer document to clear assigned booth
      try {
        await api.put(`/api/volunteers/${volunteerId}`, {
          assignedBoothId: '',
          assignedBoothName: ''
        });
      } catch (volErr) {
        console.error("Related volunteer record may have already been removed.", volErr);
      }

      setSuccess('Booth Karyakarta dismissed from this location.');
      setDismissingAssignment(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error(err);
      setError('Failed to dismiss Karyakarta.');
    }
  };

  // Derive assignments filtered by Admin selection (Super Admin feature)
  const assignmentsFilteredByAdmin = React.useMemo(() => {
    if (selectedAdminId === 'All') {
      return assignments;
    }
    return assignments.filter(a => a.adminId === selectedAdminId);
  }, [assignments, selectedAdminId]);

  // Map admin UIDs to details for display and counts
  const adminMap = React.useMemo(() => {
    const map: Record<string, { username: string; email: string }> = {};
    adminUsers.forEach(u => {
      map[u.uid] = { username: u.username, email: u.email };
    });
    return map;
  }, [adminUsers]);

  // Precompute how many assignments are logged under each admin
  const adminCounts = React.useMemo(() => {
    const counts: Record<string, number> = {};
    assignments.forEach(a => {
      counts[a.adminId] = (counts[a.adminId] || 0) + 1;
    });
    return counts;
  }, [assignments]);

  // Metrics
  const totalBooths = booths.length;
  const uniqueAssignedCount = new Set(assignmentsFilteredByAdmin.map(as => as.boothId)).size;
  const unassignedCount = totalBooths - uniqueAssignedCount;

  // Instantly filter the booths list
  const filteredBooths = booths.filter(b => {
    const s = boothSearch.toLowerCase().trim();
    if (!s) return true;
    return (
      (b.boothNumber || '').toLowerCase().includes(s) ||
      (b.name || '').toLowerCase().includes(s) ||
      (b.address || '').toLowerCase().includes(s) ||
      (b.village || '').toLowerCase().includes(s)
    );
  });

  if (!hasRight('booths', 'v')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
        <Building2 className="text-zinc-300 dark:text-zinc-700 w-16 h-16 min-h-16 mb-4" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">Permission Required</h3>
        <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
          You do not have view permissions for <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Booth Management</strong>. Please contact your Super Admin to obtain permission.
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
            <Building2 className="text-rose-500" />
            Booth Management
          </h1>
          <p className="text-zinc-500 text-xs mt-1">
            Assign designated Karyakartas to booths to secure physical field verification parameters and track constituency updates.
          </p>
        </div>
        <button 
          onClick={fetchData}
          className="flex items-center justify-center gap-2 bg-zinc-900 dark:bg-zinc-100 dark:text-zinc-950 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition-all hover:bg-zinc-800"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Sync Booth Registry
        </button>
      </div>

      {/* Metrics Panel */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Total Active Booths</p>
          <h2 className="text-3xl font-black text-zinc-900 dark:text-white mt-1">{totalBooths}</h2>
          <span className="text-[10px] text-zinc-500 font-medium mt-1 inline-block">Registered under your allowed constituencies</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Booths with Karyakartas</p>
          <h2 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{uniqueAssignedCount}</h2>
          <span className="text-[10px] text-emerald-500 font-medium mt-1 inline-block">{Math.round((uniqueAssignedCount/Math.max(totalBooths, 1))*100)}% coverage secured</span>
        </div>
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl">
          <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Booths Without Karyakartas</p>
          <h2 className="text-3xl font-black text-rose-500 mt-1">{unassignedCount}</h2>
          <span className="text-[10px] text-rose-500 font-medium mt-1 inline-block">Requires active field recruitment</span>
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
          <CheckCircle2 size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Booth Grid / Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Station Coverages</h3>
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 p-0.5 rounded-lg border border-zinc-200/50 dark:border-zinc-700">
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                  viewMode === 'table'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Booth Summary
              </button>
              <button
                type="button"
                onClick={() => setViewMode('frame')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                  viewMode === 'frame'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
              >
                Cards Grid
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detailed-roster')}
                className={`px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-md transition-all ${
                  viewMode === 'detailed-roster'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
                title="View full Karyakarta table for each booth"
              >
                Detailed Table Roster
              </button>
            </div>
          </div>
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
                  <option value="All">All Admins ({assignments.length})</option>
                  {adminUsers
                    .filter(u => {
                      if (isAdmin) return true;
                      return assignments.some(a => a.adminId === u.uid) || u.uid === user?.uid;
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

            {/* Instant Booth Search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 text-zinc-400" size={14} />
              <input 
                type="text" 
                value={boothSearch}
                onChange={e => setBoothSearch(e.target.value)}
                placeholder="Instant filter booths..."
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-400">Loading polling booths & coverage registries...</p>
          </div>
        ) : booths.length === 0 ? (
          <div className="py-16 text-center">
            <MapPin size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
            <p className="text-sm font-bold text-zinc-400">No Polling Booths found</p>
            <p className="text-xs text-zinc-500 mt-1">Configure structural demographic booths under settings to access.</p>
          </div>
        ) : filteredBooths.length === 0 ? (
          <div className="py-16 text-center">
            <Search size={32} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2 whitespace-pre-wrap" />
            <p className="text-sm font-bold text-zinc-400">No matching booths found</p>
            <p className="text-xs text-zinc-500 mt-1">Try refining your search terms or search by different parameters.</p>
          </div>
        ) : (
          viewMode === 'table' ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-900/50 text-[10px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                    <th className="px-6 py-4 w-12">#</th>
                    <th className="px-6 py-4">Booth No</th>
                    <th className="px-6 py-4">Booth Name</th>
                    <th className="px-6 py-4">Village / Ward</th>
                    <th className="px-6 py-4 text-center">Karyakarta Count</th>
                    <th className="px-6 py-4 text-right">Coverage actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredBooths.map((b, idx) => {
                    const boothAssignments = assignmentsFilteredByAdmin.filter(as => as.boothId === b.id);
                    const isExpanded = !!expandedBooths[b.id];
                    return (
                      <React.Fragment key={b.id}>
                        <tr className={`hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-all text-xs ${isExpanded ? 'bg-zinc-50/40 dark:bg-zinc-900/20' : ''}`}>
                          <td className="px-6 py-3 font-bold text-zinc-400">
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => setExpandedBooths(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                                className="p-1 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded transition-all text-zinc-400 hover:text-zinc-900 dark:hover:text-white shrink-0 cursor-pointer"
                                title={isExpanded ? "Collapse Karyakarta list" : "Expand Karyakarta list"}
                              >
                                {isExpanded ? <ChevronDown size={14} className="text-rose-500" /> : <ChevronRight size={14} />}
                              </button>
                              <span>{idx + 1}</span>
                            </div>
                          </td>
                          <td className="px-6 py-3 font-black text-zinc-800 dark:text-zinc-200">#{b.boothNumber}</td>
                          <td className="px-6 py-3">
                            <div className="font-bold text-zinc-900 dark:text-white leading-normal line-clamp-1">{b.name}</div>
                          </td>
                          <td className="px-6 py-3 text-zinc-650 dark:text-zinc-400">
                            {b.village || 'General Sector'}
                          </td>
                          <td className="px-6 py-3 text-center">
                            {boothAssignments.length > 0 ? (
                              <button
                                onClick={() => setExpandedBooths(prev => ({ ...prev, [b.id]: !prev[b.id] }))}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full transition-all outline-none cursor-pointer ${
                                  isExpanded 
                                    ? 'bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200/50' 
                                    : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-500/15 hover:scale-105 active:scale-95'
                                } text-[10px] font-bold`}
                                title={isExpanded ? "Click to collapse" : "Click to expand Karyakarta details"}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${isExpanded ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}`}></span>
                                <span>{boothAssignments.length} {boothAssignments.length === 1 ? 'Karyakarta' : 'Karyakartas'}</span>
                                {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                              </button>
                            ) : (
                              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 border border-rose-150 dark:border-rose-500/15 text-[10px] font-bold">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                                <span>No coverage</span>
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button 
                                onClick={() => setSelectedBoothDetails(b)}
                                className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900 hover:bg-zinc-105 active:scale-95 transition-all shadow-sm"
                                title="View booth info and deployed Karyakartas list"
                              >
                                <Eye size={12} /> View Info
                              </button>
                              {hasRight('booths', 'c') ? (
                                <button 
                                  onClick={() => setActiveBoothForAssignment(b)}
                                  className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg uppercase tracking-wider transition-all bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90 active:scale-95 shadow-sm"
                                  title="Assign a Karyakarta to this booth"
                                >
                                  <Plus size={12} /> Deploy
                                </button>
                              ) : (
                                <span className="text-[10px] text-zinc-400 italic">No access</span>
                              )}
                            </div>
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-zinc-50/20 dark:bg-zinc-950/20">
                            <td colSpan={6} className="px-6 py-3">
                              <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800 shadow-inner overflow-hidden max-w-full">
                                {/* Header / Mini Summary inside Accordion */}
                                <div className="px-4 py-2.5 bg-zinc-50/50 dark:bg-zinc-900/30 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
                                  <span className="font-extrabold text-zinc-700 dark:text-zinc-300">
                                    Coverage roster for Booth #{b.boothNumber} ({b.name})
                                  </span>
                                  {b.address && <span className="truncate italic max-w-xs">{b.address}</span>}
                                </div>

                                {/* Karyakartas Sub-Table */}
                                {boothAssignments.length === 0 ? (
                                  <div className="p-6 text-center text-xs font-medium text-zinc-400">
                                    No Karyakartas deployed to this station.
                                    {hasRight('booths', 'c') && (
                                      <button
                                        onClick={() => setActiveBoothForAssignment(b)}
                                        className="text-rose-500 hover:text-rose-600 underline ml-2 font-bold inline-flex items-center gap-0.5 cursor-pointer"
                                      >
                                        <Plus size={11} /> Deploy Now
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left border-collapse text-xs">
                                      <thead>
                                        <tr className="bg-zinc-100/30 dark:bg-zinc-900/50 text-[9px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                                          <th className="px-4 py-2 w-10">#</th>
                                          <th className="px-4 py-2">Karyakarta Name</th>
                                          <th className="px-4 py-2">Designation / Role</th>
                                          <th className="px-4 py-2">Mobile Number</th>
                                          <th className="px-4 py-2">Voter Card / Aadhar ID</th>
                                          <th className="px-4 py-2">Deployed By</th>
                                          <th className="px-4 py-2 text-right">Actions</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
                                        {boothAssignments.map((asg, sIdx) => {
                                          const fullVol = volunteers.find(v => v.id === asg.agentVolunteerDocId);
                                          const voterCard = fullVol?.voterId || asg.agentAadhar;
                                          return (
                                            <tr key={asg.id} className="hover:bg-zinc-50/45 dark:hover:bg-zinc-900/10 transition-colors">
                                              <td className="px-4 py-2 font-bold text-zinc-400">{sIdx + 1}</td>
                                              <td className="px-4 py-2">
                                                <div className="flex items-center gap-2">
                                                  <div className="w-6 h-6 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold text-[9px] flex items-center justify-center uppercase border border-rose-100/30 shrink-0">
                                                    {asg.agentName?.substring(0, 2) || 'KK'}
                                                  </div>
                                                  <div>
                                                    <span className="font-extrabold text-zinc-900 dark:text-white leading-normal">{asg.agentName}</span>
                                                    <span className="text-[8px] uppercase tracking-wider text-emerald-500 font-extrabold ml-2">● Active</span>
                                                  </div>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-50 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400 border border-emerald-150/40 dark:border-emerald-900/10">
                                                  {asg.designation || 'Booth Level Assistant'}
                                                </span>
                                              </td>
                                              <td className="px-4 py-2">
                                                {asg.agentMobile ? (
                                                  <a 
                                                    href={`tel:${asg.agentMobile}`} 
                                                    className="font-mono font-bold text-zinc-800 dark:text-zinc-200 hover:text-blue-500 transition-colors"
                                                  >
                                                    {asg.agentMobile}
                                                  </a>
                                                ) : (
                                                  <span className="text-zinc-400 italic">No number</span>
                                                )}
                                              </td>
                                              <td className="px-4 py-2">
                                                <div className="space-y-0.5 text-[10px]">
                                                  {voterCard && (
                                                    <div className="font-semibold text-zinc-500 dark:text-zinc-450">
                                                      <span className="text-[8px] uppercase text-zinc-400 mr-1">VOTER:</span>
                                                      <span className="font-mono">{voterCard}</span>
                                                    </div>
                                                  )}
                                                  {asg.agentAadhar && (
                                                    <div className="text-zinc-450">
                                                      <span className="text-[8px] uppercase text-zinc-400 mr-1">AADHAR:</span>
                                                      <span className="font-mono">{asg.agentAadhar}</span>
                                                    </div>
                                                  )}
                                                  {!voterCard && !asg.agentAadhar && (
                                                    <span className="text-zinc-400 italic text-[10px]">No IDs provided</span>
                                                  )}
                                                </div>
                                              </td>
                                              <td className="px-4 py-2">
                                                <div className="text-[10px] text-zinc-500">
                                                  <span className="font-semibold text-zinc-700 dark:text-zinc-350" title={adminMap[asg.adminId]?.email}>
                                                    {asg.adminId === user?.uid ? 'You' : (adminMap[asg.adminId]?.username || 'External')}
                                                  </span>
                                                </div>
                                              </td>
                                              <td className="px-4 py-2 text-right">
                                                {hasRight('booths', 'd') && (
                                                  <button
                                                    onClick={() => setDismissingAssignment({
                                                      boothId: b.id,
                                                      assignmentId: asg.id,
                                                      volunteerId: asg.agentVolunteerDocId || '',
                                                      agentName: asg.agentName
                                                    })}
                                                    className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 text-zinc-650 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-all cursor-pointer"
                                                    title="Dismiss Karyakarta"
                                                  >
                                                    <UserMinus size={11} /> Dismiss
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
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : viewMode === 'frame' ? (
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-zinc-50/50 dark:bg-zinc-950/10 border-t border-zinc-100 dark:border-zinc-800">
              {filteredBooths.map((b) => {
                const boothAssignments = assignmentsFilteredByAdmin.filter(as => as.boothId === b.id);
                return (
                  <div key={b.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-all gap-4">
                    <div className="space-y-3">
                      {/* Booth Identity Header */}
                      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                        <div className="min-w-0">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-black bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400">
                            Booth #{b.boothNumber}
                          </span>
                          <h4 className="font-extrabold text-sm text-zinc-900 dark:text-white mt-1 leading-snug line-clamp-1">{b.name}</h4>
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-medium block mt-0.5">{b.village || 'General Sector'}</span>
                        </div>
                        <button
                          onClick={() => setSelectedBoothDetails(b)}
                          className="p-1 text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-all shrink-0 animate-none"
                          title="View Full Info"
                        >
                          <Eye size={14} />
                        </button>
                      </div>

                      {/* Karyakartas Roster inside the Box */}
                      <div>
                        <span className="text-[9px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider block mb-2">
                          Deployed Karyakartas ({boothAssignments.length})
                        </span>
                        {boothAssignments.length === 0 ? (
                          <div className="py-5 px-3 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg text-center bg-zinc-50/20 dark:bg-zinc-900/10">
                            <p className="text-[11px] font-semibold text-zinc-400">No coverage deployed</p>
                            {hasRight('booths', 'c') && (
                              <button
                                onClick={() => setActiveBoothForAssignment(b)}
                                className="text-[10px] font-black text-rose-500 hover:text-rose-600 mt-1.5 cursor-pointer underline bg-transparent border-none p-0 inline-flex items-center gap-0.5"
                              >
                                <Plus size={10} /> Deploy Now
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                            {boothAssignments.map(asg => (
                              <div key={asg.id} className="p-2.5 rounded-lg border border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col justify-between gap-1.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">{asg.agentName}</p>
                                    <span className="inline-block px-1.5 py-0.5 rounded text-[8px] font-extrabold uppercase bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30 mt-1 truncate max-w-full">
                                      {asg.designation || 'Authorized Karyakarta'}
                                    </span>
                                  </div>
                                  
                                  {/* Quick Remove Button */}
                                  {hasRight('booths', 'd') && (
                                    <button
                                      onClick={() => setDismissingAssignment({
                                        boothId: b.id,
                                        assignmentId: asg.id,
                                        volunteerId: asg.agentVolunteerDocId || '',
                                        agentName: asg.agentName
                                      })}
                                      className="p-1 text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/40 rounded transition-all shrink-0"
                                      title="Dismiss Karyakarta"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  )}
                                </div>

                                <div className="flex flex-col gap-0.5 pt-1.5 border-t border-zinc-150 dark:border-zinc-800 text-[10px]">
                                  {asg.agentMobile && (
                                    <div className="flex items-center gap-1 text-zinc-650 dark:text-zinc-400">
                                      <span className="font-bold text-[8px] uppercase text-zinc-450">Mob:</span>
                                      <span className="font-mono font-bold text-zinc-800 dark:text-zinc-200">{asg.agentMobile}</span>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1 text-zinc-400 text-[8px] italic">
                                    <span>By:</span>
                                    <span className="font-medium text-zinc-500 dark:text-zinc-400">
                                      {asg.adminId === user?.uid ? 'You' : (adminMap[asg.adminId]?.username || 'External')}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Footer for card */}
                    {hasRight('booths', 'c') && (
                      <button
                        onClick={() => setActiveBoothForAssignment(b)}
                        className="w-full py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1"
                      >
                        <Plus size={12} /> Deploy Karyakarta
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 space-y-8 bg-zinc-50/50 dark:bg-zinc-950/10 border-t border-zinc-100 dark:border-zinc-800">
              {filteredBooths.map((b) => {
                const boothAssignments = assignmentsFilteredByAdmin.filter(as => as.boothId === b.id);
                return (
                  <div key={b.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs flex flex-col hover:shadow-md transition-all">
                    {/* Booth Info Header Strip */}
                    <div className="bg-zinc-50 dark:bg-zinc-900/80 px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black bg-rose-50 dark:bg-rose-955/30 text-rose-600 dark:text-rose-400">
                            Booth #{b.boothNumber}
                          </span>
                          {b.village && (
                            <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                              {b.village}
                            </span>
                          )}
                        </div>
                        <h4 className="font-extrabold text-base text-zinc-900 dark:text-white mt-1.5 leading-tight">{b.name}</h4>
                        {b.address && <p className="text-[11px] text-zinc-400 mt-0.5">{b.address}</p>}
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {hasRight('booths', 'c') && (
                          <button
                            onClick={() => setActiveBoothForAssignment(b)}
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90 active:scale-95 shadow-sm cursor-pointer"
                          >
                            <Plus size={11} /> Deploy Karyakarta
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedBoothDetails(b)}
                          className="inline-flex items-center gap-1 text-[10px] font-bold px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white dark:hover:bg-zinc-900 hover:bg-zinc-105 active:scale-95 transition-all shadow-sm"
                          title="View Full Station Details"
                        >
                          <Eye size={12} /> Station Info
                        </button>
                      </div>
                    </div>

                    {/* Table of Karyakartas for this Booth */}
                    <div className="overflow-x-auto">
                      {boothAssignments.length === 0 ? (
                        <div className="py-10 text-center flex flex-col items-center justify-center">
                          <p className="text-xs font-bold text-zinc-400">No coverage team deployed to this station</p>
                          <p className="text-[10px] text-zinc-500 mt-1">Deploy a Karyakarta helper to track this physical voter booth.</p>
                        </div>
                      ) : (
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="bg-zinc-50/50 dark:bg-zinc-900/20 text-[9px] font-black uppercase text-zinc-400 tracking-wider border-b border-zinc-100 dark:border-zinc-800">
                              <th className="px-6 py-3 w-10">#</th>
                              <th className="px-6 py-3">Karyakarta Info</th>
                              <th className="px-6 py-3">Designation / Role</th>
                              <th className="px-6 py-3">Mobile Number</th>
                              <th className="px-6 py-3">Government IDs</th>
                              <th className="px-6 py-3">Deployed By</th>
                              <th className="px-6 py-3 text-right">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                            {boothAssignments.map((asg, idx) => {
                              const fullVol = volunteers.find(v => v.id === asg.agentVolunteerDocId);
                              const voterCard = fullVol?.voterId || asg.agentAadhar;
                              return (
                                <tr key={asg.id} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-900/20 transition-all text-xs">
                                  <td className="px-6 py-4 font-bold text-zinc-450">{idx + 1}</td>
                                  <td className="px-6 py-4">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-7 h-7 rounded-full bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 font-extrabold text-[10px] flex items-center justify-center uppercase border border-rose-100/30 shrink-0">
                                        {asg.agentName?.substring(0, 2) || 'KK'}
                                      </div>
                                      <div>
                                        <div className="font-extrabold text-zinc-900 dark:text-white leading-normal">{asg.agentName}</div>
                                        <div className="text-[10px] font-semibold text-zinc-400 flex items-center gap-1 mt-0.5">
                                          <span>Status:</span>
                                          <span className="text-emerald-500 font-bold uppercase text-[9px]">● Active</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 dark:bg-emerald-955/40 text-emerald-600 dark:text-emerald-400 border border-emerald-150 dark:border-emerald-900/20">
                                      {asg.designation || 'Booth Level Assistant'}
                                    </span>
                                  </td>
                                  <td className="px-6 py-4">
                                    {asg.agentMobile ? (
                                      <a 
                                        href={`tel:${asg.agentMobile}`} 
                                        className="font-mono font-bold text-zinc-850 dark:text-zinc-200 hover:text-blue-500 transition-colors"
                                      >
                                        {asg.agentMobile}
                                      </a>
                                    ) : (
                                      <span className="text-zinc-450 italic">Not available</span>
                                    )}
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="space-y-0.5">
                                      {voterCard && (
                                        <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                          <span className="uppercase text-[8px] text-zinc-400">Voter EPIC:</span>
                                          <span className="font-mono font-bold">{voterCard}</span>
                                        </div>
                                      )}
                                      {asg.agentAadhar && (
                                        <div className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400 flex items-center gap-1">
                                          <span className="uppercase text-[8px] text-zinc-400">Aadhar:</span>
                                          <span className="font-mono">{asg.agentAadhar}</span>
                                        </div>
                                      )}
                                      {!voterCard && !asg.agentAadhar && (
                                        <span className="text-zinc-455 text-[10px] italic">No IDs saved</span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4">
                                    <div className="text-[10px] text-zinc-500">
                                      <div className="font-bold text-zinc-700 dark:text-zinc-300">
                                        {asg.adminId === user?.uid ? 'You' : (adminMap[asg.adminId]?.username || 'External Admin')}
                                      </div>
                                      <div className="text-[8px] text-zinc-400 truncate mt-0.5 max-w-[120px]" title={adminMap[asg.adminId]?.email}>
                                        {adminMap[asg.adminId]?.email || ''}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      {hasRight('booths', 'd') && (
                                        <button
                                          onClick={() => setDismissingAssignment({
                                            boothId: b.id,
                                            assignmentId: asg.id,
                                            volunteerId: asg.agentVolunteerDocId || '',
                                            agentName: asg.agentName
                                          })}
                                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border border-zinc-200 dark:border-zinc-800 hover:border-rose-200 text-zinc-650 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-all cursor-pointer"
                                          title="Dismiss Karyakarta"
                                        >
                                          <UserMinus size={11} /> Dismiss
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Right-side Booth Details and Agents Popup/Drawer (Slides in from right) */}
      <AnimatePresence>
        {selectedBoothDetails && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <div 
              className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
              onClick={() => setSelectedBoothDetails(null)}
            />
            
            {/* Drawer body - slides in from right */}
            <motion.div 
              initial={{ x: '100%', opacity: 0.9 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute inset-y-0 right-0 w-full max-w-md bg-white dark:bg-zinc-950 shadow-2xl flex flex-col border-l border-zinc-200 dark:border-zinc-800"
            >
              {/* Header */}
              <div className="p-6 border-b border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-black bg-blue-50 dark:bg-zinc-900 text-blue-600 dark:text-blue-400">
                      Booth #{selectedBoothDetails.boothNumber}
                    </span>
                    <span className="text-zinc-400 dark:text-zinc-500 text-xs font-mono">• Details</span>
                  </div>
                  <h3 className="text-base font-black text-zinc-900 dark:text-white mt-1 line-clamp-1">
                    {selectedBoothDetails.name}
                  </h3>
                </div>
                <button 
                  onClick={() => setSelectedBoothDetails(null)} 
                  className="p-1 px-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Section: Booth General Info */}
                <div className="space-y-3.5">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em] block">About Booth</span>
                  <div className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-850 p-4 rounded-xl space-y-3">
                    <div>
                      <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Booth Location / Name</span>
                      <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">{selectedBoothDetails.name}</p>
                    </div>
                    {selectedBoothDetails.address && (
                      <div>
                        <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Physical Address</span>
                        <p className="text-xs text-zinc-600 dark:text-zinc-400 mt-0.5 font-medium leading-relaxed">{selectedBoothDetails.address}</p>
                      </div>
                    )}
                    {selectedBoothDetails.village && (
                      <div>
                        <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Village / Ward</span>
                        <p className="text-xs text-zinc-650 dark:text-zinc-450 mt-0.5 font-medium">{selectedBoothDetails.village}</p>
                      </div>
                    )}
                    {selectedBoothDetails.constituencyName && (
                      <div>
                        <span className="text-[9px] uppercase font-bold text-zinc-400 dark:text-zinc-500">Constituency</span>
                        <p className="text-xs text-zinc-650 dark:text-zinc-450 mt-0.5 font-medium">{selectedBoothDetails.constituencyName}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section: Deployed Karyakartas */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-[0.2em]">Deployed Karyakartas</span>
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                      {assignmentsFilteredByAdmin.filter(as => as.boothId === selectedBoothDetails.id).length} Active
                    </span>
                  </div>

                  <div className="space-y-3">
                    {(() => {
                      const boothAssignments = assignmentsFilteredByAdmin.filter(as => as.boothId === selectedBoothDetails.id);
                      if (boothAssignments.length === 0) {
                        return (
                          <div className="p-5 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/20 dark:bg-zinc-950 text-center">
                            <ShieldAlert size={20} className="mx-auto text-rose-500 mb-1.5" />
                            <p className="text-xs font-bold text-zinc-700 dark:text-zinc-300">No active coverage team</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-505 mt-0.5">Deploy a karyakarta helper below to track this booth.</p>
                          </div>
                        );
                      }
                      return boothAssignments.map(asg => (
                        <div key={asg.id} className="p-3.5 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 flex justify-between items-start gap-3 shadow-sm hover:border-zinc-250 dark:hover:border-zinc-700 transition-all">
                          <div className="min-w-0 space-y-2 flex-1">
                            <div>
                              <span className="text-[8px] uppercase font-black text-rose-500 tracking-wider block mb-0.5">secured Karyakarta</span>
                              <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{asg.agentName}</p>
                            </div>
                            
                            {editingAssignmentId === asg.id ? (
                              <div className="p-2.5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2">
                                <span className="text-[9px] uppercase font-bold text-zinc-400">Specify Role</span>
                                <select
                                  value={editDesignation}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setEditDesignation(val);
                                    if (val === 'CUSTOM') {
                                      setIsEditCustomDesignation(true);
                                    } else {
                                      setIsEditCustomDesignation(false);
                                    }
                                  }}
                                  className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-2 py-1 text-xs font-bold rounded-lg outline-none focus:ring-1 focus:ring-blue-500 h-8"
                                >
                                  {existingDesignations.map(d => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                  <option value="CUSTOM" className="text-blue-500 font-bold">+ Write Custom...</option>
                                </select>

                                {isEditCustomDesignation && (
                                  <input 
                                    type="text"
                                    value={customEditDesignationText}
                                    onChange={e => setCustomEditDesignationText(e.target.value)}
                                    placeholder="Enter custom role..."
                                    className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
                                  />
                                )}

                                <div className="flex gap-2 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setEditingAssignmentId(null)}
                                    className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-500 hover:text-zinc-700"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    disabled={submitting}
                                    onClick={() => {
                                      const updatedVal = isEditCustomDesignation ? customEditDesignationText : editDesignation;
                                      if (updatedVal && updatedVal.trim()) {
                                        handleUpdateDesignation(asg.id, updatedVal);
                                      }
                                    }}
                                    className="px-3 py-1 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 font-bold text-[10px] uppercase tracking-wider rounded-lg"
                                  >
                                    Save
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                  {asg.designation || 'Authorized Karyakarta'}
                                </span>
                                {hasRight('booths', 'c') && (
                                  <button
                                    onClick={() => {
                                      setEditingAssignmentId(asg.id);
                                      setEditDesignation(asg.designation || 'Booth President');
                                      setIsEditCustomDesignation(false);
                                      setCustomEditDesignationText('');
                                    }}
                                    className="text-[10px] font-bold text-zinc-400 hover:text-blue-600 cursor-pointer underline"
                                  >
                                    Change Designation
                                  </button>
                                )}
                              </div>
                            )}

                            <div className="space-y-1">
                              {asg.agentAadhar && (
                                <div className="text-[10px] text-zinc-550 dark:text-zinc-400 flex items-center gap-1.5">
                                  <span className="font-medium text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Aadhaar:</span>
                                  <strong className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">{asg.agentAadhar}</strong>
                                </div>
                              )}
                              {asg.agentMobile && (
                                <div className="text-[10px] text-zinc-550 dark:text-zinc-400 flex items-center gap-1.5">
                                  <span className="font-medium text-[9px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500">Mobile:</span>
                                  <strong className="font-semibold text-zinc-700 dark:text-zinc-300 font-mono">{asg.agentMobile}</strong>
                                </div>
                              )}
                              {hasRight('booths', 'v') && (
                                <div className="text-[9px] text-zinc-400 italic mt-1.5 border-t border-zinc-100 dark:border-zinc-800/60 pt-1.5">
                                  Deployed by: <strong className="font-semibold text-zinc-500 dark:text-zinc-300">
                                    {asg.adminId === user?.uid ? 'You' : (adminMap[asg.adminId]?.username || 'External')}
                                  </strong>
                                </div>
                              )}
                            </div>
                          </div>

                          {hasRight('booths', 'd') && (
                            <button 
                              onClick={() => setDismissingAssignment({
                                boothId: selectedBoothDetails.id,
                                assignmentId: asg.id,
                                volunteerId: asg.agentVolunteerDocId,
                                agentName: asg.agentName
                              })}
                              className="p-1.5 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30 transition-all shrink-0"
                              title={`Dismiss ${asg.agentName}`}
                            >
                              <UserMinus size={13} />
                            </button>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                </div>

              </div>

              {/* Footer inside slide-over */}
              <div className="p-6 border-t border-zinc-150 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-900/10 gap-3 flex">
                <button 
                  onClick={() => setSelectedBoothDetails(null)}
                  className="flex-1 text-xs font-semibold px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
                >
                  Close Details
                </button>
                {hasRight('booths', 'c') && (
                  <button 
                    onClick={() => {
                      setActiveBoothForAssignment(selectedBoothDetails);
                      setSelectedBoothDetails(null);
                    }}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 text-xs font-bold px-4 py-2.5 rounded-xl bg-zinc-950 dark:bg-zinc-100 text-white dark:text-zinc-950 hover:opacity-90 transition-all shadow-sm"
                  >
                    <Plus size={14} /> Deploy Addl
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Deployment Modal */}
      <AnimatePresence>
        {activeBoothForAssignment && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl overflow-hidden shadow-2xl"
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm text-zinc-900 dark:text-white">Deploy Booth Karyakarta</h3>
                  <p className="text-[10px] text-zinc-500">Assign a validated Karyakarta to Booth #{activeBoothForAssignment.boothNumber}</p>
                </div>
                <button onClick={() => { setActiveBoothForAssignment(null); setAgentSearch(''); setSelectedVolForDeploy(null); }} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
                  <X size={18} />
                </button>
              </div>

              {/* Deployment Interaction Body */}
              {selectedVolForDeploy ? (
                <div className="p-5 flex flex-col space-y-4">
                  <div className="bg-zinc-50 dark:bg-zinc-900 p-4 rounded-xl border border-zinc-155 dark:border-zinc-800">
                    <p className="text-[9px] uppercase font-black tracking-wider text-rose-500">Target Karyakarta</p>
                    <p className="font-bold text-sm text-zinc-900 dark:text-white mt-1">{selectedVolForDeploy.name}</p>
                    <p className="text-zinc-500 text-[10px] mt-1">
                      Mobile: {selectedVolForDeploy.mobile || 'No Contact'} {selectedVolForDeploy.aadharNumber ? `| Aadhaar: ${selectedVolForDeploy.aadharNumber}` : ''}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="block text-[10px] uppercase font-black tracking-wider text-zinc-400">
                      Designation / Role in Booth
                    </label>
                    <select
                      value={deployDesignation}
                      onChange={e => {
                        const val = e.target.value;
                        setDeployDesignation(val);
                        if (val === 'CUSTOM') {
                          setIsDeployCustomDesignation(true);
                        } else {
                          setIsDeployCustomDesignation(false);
                        }
                      }}
                      className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-3 py-2 text-xs font-bold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 h-10"
                    >
                      {existingDesignations.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                      <option value="CUSTOM" className="text-blue-500 font-bold">+ Write Custom Designation...</option>
                    </select>
                  </div>

                  {isDeployCustomDesignation && (
                    <div className="space-y-1.5">
                      <label className="block text-[10px] uppercase font-bold text-zinc-400">
                        Custom Designation Name
                      </label>
                      <input 
                        type="text"
                        value={customDeployDesignationText}
                        onChange={e => setCustomDeployDesignationText(e.target.value)}
                        placeholder="e.g. Ward Captain, Booth Convener..."
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-850 dark:text-white font-medium"
                      />
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => setSelectedVolForDeploy(null)}
                      className="flex-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] uppercase tracking-wider h-10 rounded-xl"
                    >
                      Back to list
                    </button>
                    <button
                      type="button"
                      disabled={submitting || (isDeployCustomDesignation && !customDeployDesignationText.trim())}
                      onClick={() => {
                        const finalDesignation = isDeployCustomDesignation ? customDeployDesignationText : deployDesignation;
                        handleAssignAgent(selectedVolForDeploy, finalDesignation);
                        setSelectedVolForDeploy(null);
                        setDeployDesignation('Booth President');
                        setIsDeployCustomDesignation(false);
                        setCustomDeployDesignationText('');
                      }}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] uppercase tracking-wider h-10 rounded-xl transition-all shadow-sm active:scale-95 disabled:opacity-50"
                    >
                      {submitting ? 'Deploying...' : 'Confirm Deploy'}
                    </button>
                  </div>
                </div>
              ) : (
                /* List */
                <div className="p-5 flex flex-col max-h-[420px]">
                  <div className="mb-3">
                    <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-bold block mb-2">My Active Karyakarta team</span>
                    {volunteers.length > 0 && (
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 text-zinc-400" size={13} />
                        <input 
                          type="text" 
                          value={agentSearch}
                          onChange={e => setAgentSearch(e.target.value)}
                          placeholder="Search active team members..."
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
                        />
                      </div>
                    )}
                  </div>

                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800 overflow-y-auto max-h-[250px] pr-1">
                    {(() => {
                      if (volunteers.length === 0) {
                        return (
                          <div className="py-4 text-center">
                            <p className="text-xs text-zinc-500 font-bold">No Active Karyakartas Found</p>
                            <p className="text-[10px] text-zinc-400 mt-1">Please recruit active Karyakartas under the Karyakarta Management module first.</p>
                          </div>
                        );
                      }

                      const alreadyAssignedVolIds = assignments
                        .filter(as => as.boothId === activeBoothForAssignment.id)
                        .map(as => as.agentVolunteerDocId);
                      const deployable = volunteers.filter(vol => !alreadyAssignedVolIds.includes(vol.id));

                      if (deployable.length === 0) {
                        return (
                          <p className="text-xs text-zinc-400 italic py-4 text-center">All available active Karyakartas are already assigned to this booth.</p>
                        );
                      }

                      const filteredDeployable = deployable.filter(v => {
                        const s = agentSearch.toLowerCase().trim();
                        if (!s) return true;
                        return (
                          (v.name || '').toLowerCase().includes(s) ||
                          (v.voterId || '').toLowerCase().includes(s) ||
                          (v.mobile || '').toLowerCase().includes(s)
                        );
                      });

                      if (filteredDeployable.length === 0) {
                        return (
                          <p className="text-xs text-zinc-400 italic py-4 text-center">No matching team members found.</p>
                        );
                      }

                      return filteredDeployable.map(vol => (
                        <div key={vol.id} className="flex justify-between items-center py-2.5">
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-zinc-900 dark:text-white text-xs truncate">{vol.name}</p>
                            <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                              Mobile: {vol.mobile || 'No Contact'} {vol.aadharNumber ? `| Aadhaar: ${vol.aadharNumber}` : ''}
                            </p>
                          </div>
                          <button 
                            disabled={submitting}
                            onClick={() => {
                              setSelectedVolForDeploy(vol);
                              setDeployDesignation('Booth President');
                              setIsDeployCustomDesignation(false);
                              setCustomDeployDesignationText('');
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-lg shrink-0 transition-all active:scale-95"
                          >
                            Deploy
                          </button>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Dismiss Agent Confirmation Modal */}
      <AnimatePresence>
        {dismissingAssignment && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl p-6 text-center"
            >
              <div className="w-12 h-12 bg-rose-100 dark:bg-rose-950/30 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <UserMinus size={24} />
              </div>
              <h3 className="font-black text-sm text-zinc-900 dark:text-white mb-1">Dismiss Booth Karyakarta?</h3>
              <p className="text-[11px] text-zinc-500 mb-6">
                Are you sure you want to dismiss <strong className="font-bold text-zinc-800 dark:text-zinc-200">{dismissingAssignment.agentName}</strong> from this polling booth?
              </p>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setDismissingAssignment(null)}
                  className="flex-1 bg-zinc-100 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs h-10 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={confirmDismissAgent}
                  className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs h-10 rounded-xl transition-all"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
