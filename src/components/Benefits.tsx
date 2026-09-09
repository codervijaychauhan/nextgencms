import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Gift, X, Trash2, Calendar, 
  User, CreditCard, Banknote, Landmark, Filter, CheckCircle2, AlertCircle, RefreshCw,
  Eye, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';

// Interfaces
interface BaseVoter {
  id: string;
  voterId: string; // EPIC
  name: string;
  aadharNumber?: string;
  mobile?: string;
  stateId: string;
  districtId: string;
  constituencyId: string;
  boothId: string;
}

interface Benefit {
  id: string;
  voterDocId: string;
  voterId: string; // EPIC
  voterName: string;
  aadharNumber: string;
  amount: number;
  benefitName: string;
  benefitType: 'Government' | 'Party';
  date: string;
  adminId: string; // multi-admin isolation
  notes?: string;
  createdAt: unknown;
  witnessName?: string;
  witnessVoterId?: string;
  witnessVoterDocId?: string;
  witnesses?: {
    name: string;
    voterId?: string;
    voterDocId?: string;
  }[];
}

const BENEFIT_SUGGESTIONS = [
  "PM Kisan Samman Nidhi",
  "Lado Protsahan Yojana",
  "Pradhan Mantri Awas Yojana Help",
  "Free Ration Kit Distribution",
  "Mukhyamantri Ayushman Card Aid",
  "Party Education Kit Contribution",
  "Party Event Volunteer Allowance",
  "Local Medical Treatment Support",
  "E-Shram Pension Allocation"
];

export default function Benefits() {
  const { user, isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };
  
  // State variables
  const [benefits, setBenefits] = useState<Benefit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'All' | 'Government' | 'Party'>('All');
  const [adminUsers, setAdminUsers] = useState<{ uid: string; username: string; email: string; role: string }[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('All');
  
  // New States: Date Filter, Pagination, View Details popup
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [detailBenefit, setDetailBenefit] = useState<Benefit | null>(null);

  // Reset pagination to first page when standard or date filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [globalSearch, typeFilter, selectedAdminId, startDateFilter, endDateFilter, pageSize]);
  
  // Registration slide-over state
  const [isOpen, setIsOpen] = useState(false);
  const [allVoters, setAllVoters] = useState<BaseVoter[]>([]);
  const [voterSearch, setVoterSearch] = useState('');
  const [loadingVoters, setLoadingVoters] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<BaseVoter | null>(null);
  
  // Form items
  const [aadharNumber, setAadharNumber] = useState('');
  const [benefitName, setBenefitName] = useState('');
  const [benefitType, setBenefitType] = useState<'Government' | 'Party'>('Government');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [witnessName, setWitnessName] = useState('');
  const [witnessesList, setWitnessesList] = useState<{name: string; voterId?: string; voterDocId?: string}[]>([]);
  const [witnessSearch, setWitnessSearch] = useState('');
  const [saving, setSaving] = useState(false);
  
  // Deletion confirmation
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Load high-privilege users specifically for the Admin dropdown filter
  useEffect(() => {
    if (!user || !isAdmin) {
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
  }, [user, isAdmin]);

  const fetchBenefits = async () => {
    if (!user) return;
    setLoading(true);
    setError('');

    try {
      const data = await api.get<Benefit[]>('/api/benefits');
      const list: Benefit[] = (data || []).map(b => ({
        id: b.id,
        voterDocId: b.voterDocId || '',
        voterId: b.voterId || '',
        voterName: b.voterName || '',
        aadharNumber: b.aadharNumber || '',
        amount: typeof b.amount === 'number' ? b.amount : Number(b.amount || 0),
        benefitName: b.benefitName || '',
        benefitType: b.benefitType || 'Government',
        date: b.date || '',
        adminId: b.adminId || '',
        notes: b.notes || '',
        createdAt: b.createdAt,
        witnessName: b.witnessName || '',
        witnessVoterId: b.witnessVoterId || '',
        witnessVoterDocId: b.witnessVoterDocId || '',
        witnesses: Array.isArray(b.witnesses) ? b.witnesses : []
      }));
      list.sort((a, b) => b.date.localeCompare(a.date));
      setBenefits(list);
    } catch (err) {
      console.error("Error fetching benefits:", err);
      setError("Failed to fetch benefits roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBenefits();
  }, [user, isAdmin, profile]);

  // Pre-cache voters in memory whenever the "Register Benefit" portal is opened
  useEffect(() => {
    if (isOpen && user) {
      const fetchVotersList = async () => {
        setLoadingVoters(true);
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
          setAllVoters(list);
        } catch (err) {
          console.error("Failed to load voters reference database:", err);
          setError("Failed to fetch constituency voter list.");
        } finally {
          setLoadingVoters(false);
        }
      };
      
      fetchVotersList();
    } else {
      setAllVoters([]);
      setSelectedVoter(null);
      setVoterSearch('');
      resetForm();
    }
  }, [isOpen, user, profile, isAdmin]);

  const resetForm = () => {
    setAadharNumber('');
    setBenefitName('');
    setBenefitType('Government');
    setAmount('');
    setDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setWitnessName('');
    setWitnessSearch('');
    setWitnessesList([]);
  };

  // Compute live match filtering in real time for Voter selection list
  const filteredVoters = useMemo(() => {
    const s = voterSearch.toLowerCase().trim();
    if (!s) {
      return []; // Return empty initially to force search entry
    }
    return allVoters.filter(v => {
      return (
        (v.voterId || '').toLowerCase().includes(s) ||
        (v.name || '').toLowerCase().includes(s) ||
        (v.mobile || '').toLowerCase().includes(s) ||
        (v.aadharNumber || '').toLowerCase().includes(s)
      );
    });
  }, [allVoters, voterSearch]);

  // Compute live match filtering in real time for Witness selection list
  const filteredWitnesses = useMemo(() => {
    const s = witnessSearch.toLowerCase().trim();
    if (!s) {
      return allVoters.slice(0, 5); // Return top 5 initially
    }
    return allVoters.filter(v => {
      return (
        (v.voterId || '').toLowerCase().includes(s) ||
        (v.name || '').toLowerCase().includes(s) ||
        (v.mobile || '').toLowerCase().includes(s) ||
        (v.aadharNumber || '').toLowerCase().includes(s)
      );
    });
  }, [allVoters, witnessSearch]);

  // Handle selecting a voter
  const handleSelectVoter = (voter: BaseVoter) => {
    setSelectedVoter(voter);
    setAadharNumber(voter.aadharNumber || '');
  };

  // Form Submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!hasRight('benefits', 'c')) {
      setError("You do not have the required permissions to record benefits.");
      return;
    }
    if (!selectedVoter) {
      setError("Please search and select a beneficiary voter first.");
      return;
    }
    if (!benefitName.trim()) {
      setError("Please select or enter the program/scheme name.");
      return;
    }
    if (aadharNumber.trim() && (aadharNumber.length !== 12 || !/^\d+$/.test(aadharNumber))) {
      setError("If provided, the Aadhaar number must be exactly 12 digits.");
      return;
    }
    if (!amount || Number(amount) < 0) {
      setError("Please input a valid helper amount (0 or positive).");
      return;
    }

    setSaving(true);
    setError('');

    try {
      const finalWitnesses = [...witnessesList];
      if (finalWitnesses.length === 0 && witnessName.trim()) {
        finalWitnesses.push({ name: witnessName.trim() });
      }

      const parsedAmount = Number(amount);
      const computedWitnessName = finalWitnesses.map(w => w.name).join(', ');
      const firstWitness = finalWitnesses[0] || null;

      const newBenefit = {
        voterDocId: selectedVoter.id,
        voterId: selectedVoter.voterId,
        voterName: selectedVoter.name,
        aadharNumber: aadharNumber,
        amount: parsedAmount,
        benefitName: benefitName.trim(),
        benefitType: benefitType,
        date: date,
        adminId: user.uid,
        notes: notes.trim(),
        witnessName: computedWitnessName,
        witnessVoterId: firstWitness ? (firstWitness.voterId || '') : '',
        witnessVoterDocId: firstWitness ? (firstWitness.voterDocId || '') : '',
        witnesses: finalWitnesses
      };
      
      await api.post('/api/benefits', newBenefit);

      setSuccess(`Successfully logged benefit "${benefitName}" for ${selectedVoter.name}!`);
      setIsOpen(false);
      resetForm();
      setSelectedVoter(null);
      fetchBenefits();
      setTimeout(() => setSuccess(''), 4000);
    } catch (err: any) {
      console.error("Error creating benefit entry:", err);
      setError(err?.message || "Failed to finalize aid entry.");
    } finally {
      setSaving(false);
    }
  };

  // Deletion logic
  const handleDeleteBenefit = async (id: string) => {
    setError('');
    if (!hasRight('benefits', 'd')) {
      setError("You do not have the required permissions to delete benefit records.");
      return;
    }
    try {
      await api.delete(`/api/benefits/${id}`);
      setBenefits(prev => prev.filter(b => b.id !== id));
      setSuccess("Benefit record deleted successfully.");
      setConfirmDeleteId(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error("Delete benefit error:", err);
      setError(err?.message || "Failed to remove this benefit entry.");
    }
  };

  // Derive benefits filtered by Admin selection (Super Admin feature)
  const benefitsFilteredByAdmin = useMemo(() => {
    if (!isAdmin || selectedAdminId === 'All') {
      return benefits;
    }
    return benefits.filter(b => b.adminId === selectedAdminId);
  }, [benefits, selectedAdminId, isAdmin]);

  // Map admin UIDs to details for display and counts
  const adminMap = useMemo(() => {
    const map: Record<string, { username: string; email: string }> = {};
    adminUsers.forEach(u => {
      map[u.uid] = { username: u.username, email: u.email };
    });
    return map;
  }, [adminUsers]);

  // Precompute how many records are logged under each admin
  const adminCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    benefits.forEach(b => {
      counts[b.adminId] = (counts[b.adminId] || 0) + 1;
    });
    return counts;
  }, [benefits]);

  // List filter logic
  const filteredBenefits = useMemo(() => {
    return benefitsFilteredByAdmin.filter(b => {
      // Type filter
      if (typeFilter !== 'All' && b.benefitType !== typeFilter) {
        return false;
      }

      // Start Date filter
      if (startDateFilter && b.date < startDateFilter) {
        return false;
      }

      // End Date filter
      if (endDateFilter && b.date > endDateFilter) {
        return false;
      }
      
      // Global text filter
      const searchVal = globalSearch.toLowerCase().trim();
      if (!searchVal) return true;

      return (
        b.voterName.toLowerCase().includes(searchVal) ||
        b.voterId.toLowerCase().includes(searchVal) ||
        b.aadharNumber.toLowerCase().includes(searchVal) ||
        b.benefitName.toLowerCase().includes(searchVal) ||
        (b.witnessName || '').toLowerCase().includes(searchVal) ||
        (b.witnesses || []).some(w => (w.name || '').toLowerCase().includes(searchVal) || (w.voterId || '').toLowerCase().includes(searchVal)) ||
        (b.notes || '').toLowerCase().includes(searchVal)
      );
    });
  }, [benefitsFilteredByAdmin, globalSearch, typeFilter, startDateFilter, endDateFilter]);

  // Paginated benefits helper
  const paginatedBenefits = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredBenefits.slice(startIndex, startIndex + pageSize);
  }, [filteredBenefits, currentPage, pageSize]);

  // Aggregated statistic counters calculated admin-wise
  const stats = useMemo(() => {
    let totAmt = 0;
    let govAmt = 0;
    let partyAmt = 0;
    let govCount = 0;
    let partyCount = 0;
    const uniqueBeneficiaries = new Set<string>();

    benefitsFilteredByAdmin.forEach(b => {
      totAmt += b.amount;
      uniqueBeneficiaries.add(b.voterDocId);
      if (b.benefitType === 'Government') {
        govAmt += b.amount;
        govCount += 1;
      } else {
        partyAmt += b.amount;
        partyCount += 1;
      }
    });

    return {
      totAmt,
      govAmt,
      partyAmt,
      govCount,
      partyCount,
      beneficiariesCount: uniqueBeneficiaries.size
    };
  }, [benefitsFilteredByAdmin]);

  if (!hasRight('benefits', 'v')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
        <Gift className="text-zinc-300 dark:text-zinc-700 w-16 h-16 min-h-16 mb-4" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">Permission Required</h3>
        <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
          You do not have view permissions for <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Benefits Tracker</strong>. Please contact your Super Admin to obtain permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white uppercase">
            Benefits Tracker
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Track and monitor the real-time allocation of government and party-backed benefit programs to citizens.
          </p>
        </div>

        {hasRight('benefits', 'c') && (
          <button 
            onClick={() => setIsOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-5 py-3 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm shrink-0"
          >
            <Plus size={16} />
            Register Benefit
          </button>
        )}
      </div>

      {/* FEEDBACK LABELS */}
      <AnimatePresence>
        {success && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900 text-green-800 dark:text-green-300 px-4 py-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium shadow-sm"
          >
            <CheckCircle2 size={16} className="text-green-600 dark:text-green-400 shrink-0" />
            <span>{success}</span>
          </motion.div>
        )}

        {error && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900 text-red-800 dark:text-red-300 px-4 py-3.5 rounded-xl text-xs flex items-center gap-2.5 font-medium shadow-sm"
          >
            <AlertCircle size={16} className="text-red-600 dark:text-red-400 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Total Disbursements</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Banknote size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-3 font-mono">
            ₹{stats.totAmt.toLocaleString('en-IN')}
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
            Recorded across {benefits.length} distributed packages
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Unique Beneficiaries</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <User size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-3 font-mono">
            {stats.beneficiariesCount}
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1">
            Voters registered on campaign payroll
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Gov-Backed Support</span>
            <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <Landmark size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-3 font-mono">
            ₹{stats.govAmt.toLocaleString('en-IN')}
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1 flex justify-between items-center">
            <span>Official schemes deployed</span>
            <span className="bg-purple-100 dark:bg-purple-950 text-purple-800 dark:text-purple-300 font-bold px-1.5 py-0.5 rounded text-[8px] font-sans">
              {stats.govCount} Entries
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-black tracking-widest text-zinc-400">Party-Backed Support</span>
            <div className="w-8 h-8 rounded-lg bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
              <Gift size={16} />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-900 dark:text-white mt-3 font-mono">
            ₹{stats.partyAmt.toLocaleString('en-IN')}
          </p>
          <div className="text-[10px] text-zinc-500 dark:text-zinc-500 mt-1 flex justify-between items-center">
            <span>Direct campaign outreach</span>
            <span className="bg-orange-100 dark:bg-orange-950 text-orange-850 dark:text-orange-300 font-bold px-1.5 py-0.5 rounded text-[8px] font-sans">
              {stats.partyCount} Entries
            </span>
          </div>
        </div>
      </div>

      {/* FILTER & SEARCH ROW */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 flex flex-col gap-4 shadow-sm">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3.5 text-zinc-400" size={16} />
            <input 
              type="text" 
              value={globalSearch}
              onChange={e => setGlobalSearch(e.target.value)}
              placeholder="Filter recordings by recipient name, EPIC Code, Aadhaar, or aid program..."
              className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {/* Admin selector filter (Visible only to Super Admin) */}
            {isAdmin && (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                  <User size={13} />
                  <span className="uppercase text-[9px] tracking-wider font-bold">Admin:</span>
                </div>
                <select
                  value={selectedAdminId}
                  onChange={e => setSelectedAdminId(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-white border border-zinc-200 dark:border-zinc-800 px-3 py-1.5 text-xs font-bold rounded-xl outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 min-w-[160px] h-9"
                >
                  <option value="All">All Admins ({benefits.length})</option>
                  {adminUsers.map(u => (
                    <option key={u.uid} value={u.uid}>
                      {u.username} ({adminCounts[u.uid] || 0} records)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
                <Filter size={13} />
                <span className="uppercase text-[9px] tracking-wider font-bold">Type:</span>
              </div>
              <div className="bg-zinc-100 dark:bg-zinc-950 p-1 rounded-xl border border-zinc-200/50 dark:border-zinc-800 flex gap-1 h-9 items-center">
                {(['All', 'Government', 'Party'] as const).map(option => (
                  <button
                    key={option}
                    onClick={() => setTypeFilter(option)}
                    className={`px-3 py-1 text-[10px] h-7 font-bold uppercase tracking-wider rounded-lg transition-all ${
                      typeFilter === option 
                        ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-sm font-sans' 
                        : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 font-sans'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* DATE RANGE FILTER ROW */}
        <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-400">
              <Calendar size={13} />
              <span className="uppercase text-[9px] tracking-wider font-bold">Date Range:</span>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 h-9">
                <span className="text-[10px] uppercase font-bold text-zinc-400 mr-2">From</span>
                <input 
                  type="date" 
                  value={startDateFilter}
                  onChange={e => setStartDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-mono outline-none text-zinc-800 dark:text-white w-28"
                />
              </div>

              <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-2.5 h-9">
                <span className="text-[10px] uppercase font-bold text-zinc-400 mr-2">To</span>
                <input 
                  type="date" 
                  value={endDateFilter}
                  onChange={e => setEndDateFilter(e.target.value)}
                  className="bg-transparent text-xs font-mono outline-none text-zinc-800 dark:text-white w-28"
                />
              </div>

              {(startDateFilter || endDateFilter) && (
                <button
                  type="button"
                  onClick={() => {
                    setStartDateFilter('');
                    setEndDateFilter('');
                  }}
                  className="text-[10px] font-bold text-red-500 hover:text-red-700 dark:hover:text-red-400 px-2 hover:underline tracking-wider uppercase shrink-0"
                >
                  Clear dates
                </button>
              )}
            </div>
          </div>

          <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium">
            Active Filter: <strong className="font-semibold text-zinc-650 dark:text-zinc-300">{filteredBenefits.length}</strong> of {benefits.length} records
          </div>
        </div>
      </div>

      {/* RECIPIENTS LOG table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
          <h3 className="font-bold text-zinc-900 dark:text-white text-sm">Disbursement Log</h3>
          <span className="text-[10px] font-bold font-mono bg-zinc-100 dark:bg-zinc-950 text-zinc-500 border border-zinc-200 dark:border-zinc-800 px-2 py-1 rounded-lg">
            {filteredBenefits.length} records matched
          </span>
        </div>

        {loading ? (
          <div className="py-24 text-center">
            <RefreshCw className="animate-spin text-zinc-300 dark:text-zinc-700 mx-auto mb-3" size={32} />
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Streaming benefit log...</p>
          </div>
        ) : filteredBenefits.length === 0 ? (
          <div className="py-20 text-center">
            <Gift size={40} className="mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
            <p className="text-sm font-bold text-zinc-400">No benefit records resolved</p>
            <p className="text-xs text-zinc-500 mt-1">
              Either compile dynamic filter variables above or initialize aid logs via top right button.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 dark:bg-zinc-950/50 text-[10px] font-black uppercase tracking-widest text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
                  <th className="py-4 px-5">Citizen (Recipient)</th>
                  <th className="py-4 px-5">Benefit (Aid Scheme)</th>
                  <th className="py-4 px-5">Source Type</th>
                  <th className="py-4 px-5">Allocation Date</th>
                  <th className="py-4 px-5 text-right">Value (INR)</th>
                  <th className="py-4 px-5 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 text-xs text-zinc-700 dark:text-zinc-400">
                {paginatedBenefits.map(b => (
                  <tr key={b.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-955/30 transition-all">
                    {/* Citizen ID details */}
                    <td className="py-3 px-5">
                      <div>
                        <p className="font-bold text-zinc-900 dark:text-white">{b.voterName}</p>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mt-0.5">EPIC: {b.voterId}</p>
                      </div>
                    </td>

                    {/* Benefit / Program */}
                    <td className="py-3 px-5">
                      <div>
                        <p className="font-semibold text-zinc-800 dark:text-zinc-200">{b.benefitName}</p>
                        {b.notes && (
                          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5 truncate max-w-[200px]" title={b.notes}>
                            Rem: {b.notes}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Source Type Tag */}
                    <td className="py-3 px-5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-widest ${
                        b.benefitType === 'Government' 
                          ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400' 
                          : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                      }`}>
                        <span className={`w-1 h-1 rounded-full ${
                          b.benefitType === 'Government' ? 'bg-purple-600' : 'bg-orange-600'
                        }`} />
                        {b.benefitType}
                      </span>
                    </td>

                    {/* Allocation Date */}
                    <td className="py-3 px-5 font-mono text-zinc-500 dark:text-zinc-500">
                      <div className="flex items-center gap-1.5">
                        <Calendar size={12} className="opacity-70" />
                        {new Date(b.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </div>
                    </td>

                    {/* Monetary value */}
                    <td className="py-3 px-5 text-right font-bold text-zinc-900 dark:text-white font-mono">
                      ₹{b.amount.toLocaleString('en-IN')}
                    </td>

                    {/* Actions panel */}
                    <td className="py-3 px-5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Detail View Eye Trigger */}
                        <button
                          onClick={() => setDetailBenefit(b)}
                          className="text-blue-600 hover:text-blue-850 dark:text-blue-400 dark:hover:text-blue-300 p-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-lg transition-all"
                          title="View entire disbursement details"
                        >
                          <Eye size={14} />
                        </button>

                        {hasRight('benefits', 'd') ? (
                          confirmDeleteId === b.id ? (
                            <div className="flex items-center gap-1 bg-red-50 dark:bg-red-950/30 p-1 rounded-lg">
                              <button
                                onClick={() => handleDeleteBenefit(b.id)}
                                className="bg-red-650 hover:bg-red-700 text-white font-bold text-[9px] px-2 py-1 rounded"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmDeleteId(null)}
                                className="text-zinc-500 hover:text-zinc-800 dark:hover:text-white text-[9px] px-2 py-1"
                              >
                                Abort
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteId(b.id)}
                              className="text-red-500 hover:text-red-700 dark:hover:text-red-400 p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-850 rounded-lg transition-all"
                              title="Delete benefit record"
                            >
                              <Trash2 size={14} />
                            </button>
                          )
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* TABLE PAGINATION FOOTER */}
          <div className="px-5 py-4 border-t border-zinc-100 dark:border-zinc-850 bg-zinc-50/50 dark:bg-zinc-955/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Show</span>
              <select
                value={pageSize}
                onChange={e => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-white rounded-lg px-2 py-1 font-bold outline-none cursor-pointer"
              >
                {[5, 10, 20, 50].map(size => (
                  <option key={size} value={size}>{size} entries</option>
                ))}
              </select>
              <span>
                | Showing {filteredBenefits.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredBenefits.length)} of {filteredBenefits.length} records
              </span>
            </div>

            {/* Pagination Button Controls */}
            {Math.ceil(filteredBenefits.length / pageSize) > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-all cursor-pointer disabled:cursor-not-allowed"
                  title="First Page"
                >
                  <ChevronsLeft size={14} />
                </button>
                
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-all cursor-pointer disabled:cursor-not-allowed"
                  title="Previous Page"
                >
                  <ChevronLeft size={14} />
                </button>

                {/* Page Index Numbers */}
                {Array.from({ length: Math.ceil(filteredBenefits.length / pageSize) }).map((_, idx) => {
                  const pNum = idx + 1;
                  // Handle showing bounds for clean pager feel
                  if (
                    pNum === 1 || 
                    pNum === Math.ceil(filteredBenefits.length / pageSize) || 
                    Math.abs(pNum - currentPage) <= 1
                  ) {
                    return (
                      <button
                        key={pNum}
                        onClick={() => setCurrentPage(pNum)}
                        className={`px-3 py-1 rounded-lg text-xs font-black transition-all ${
                          currentPage === pNum
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer'
                        }`}
                      >
                        {pNum}
                      </button>
                    );
                  } else if (pNum === 2 || pNum === Math.ceil(filteredBenefits.length / pageSize) - 1) {
                    return <span key={pNum} className="text-zinc-400 dark:text-zinc-600 text-xs px-0.5">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredBenefits.length / pageSize)))}
                  disabled={currentPage === Math.ceil(filteredBenefits.length / pageSize)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-all cursor-pointer disabled:cursor-not-allowed"
                  title="Next Page"
                >
                  <ChevronRight size={14} />
                </button>

                <button
                  onClick={() => setCurrentPage(Math.ceil(filteredBenefits.length / pageSize))}
                  disabled={currentPage === Math.ceil(filteredBenefits.length / pageSize)}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-white dark:disabled:hover:bg-zinc-900 transition-all cursor-pointer disabled:cursor-not-allowed"
                  title="Last Page"
                >
                  <ChevronsRight size={14} />
                </button>
              </div>
            )}
          </div>
          </>
        )}
      </div>

      {/* REGISTER AID package slide-over/modal */}
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            {/* Container drawer */}
            <div className="absolute inset-y-0 right-0 max-w-full pl-10 flex">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="w-screen max-w-md bg-white dark:bg-zinc-950 shadow-2xl flex flex-col justify-between"
              >
                {/* Drawer Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
                  <div>
                    <h3 className="font-black text-sm text-zinc-900 dark:text-white uppercase tracking-tight">Register Benefit</h3>
                    <p className="text-[10px] text-zinc-500">Record a benefit under isolated campaign rules</p>
                  </div>
                  <button 
                    onClick={() => setIsOpen(false)} 
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Drawer Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Step 1: Beneficiary Voter Selection */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                      <User size={12} className="opacity-80" />
                      1. Select Beneficiary Citizen
                    </label>

                    {!selectedVoter ? (
                      <div className="space-y-3">
                        <div className="relative">
                          <Search className="absolute left-3.5 top-3.5 text-zinc-400" size={15} />
                          <input 
                            type="text" 
                            value={voterSearch} 
                            onChange={e => setVoterSearch(e.target.value)} 
                            className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-10 pr-4 py-3 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white w-full" 
                            placeholder="Search allowed voters by Name, EPIC No, mobile..." 
                          />
                        </div>

                        {loadingVoters ? (
                          <div className="py-8 text-center flex flex-col items-center justify-center gap-2">
                            <RefreshCw className="animate-spin text-zinc-400" size={20} />
                            <p className="text-[10px] font-semibold text-zinc-400 uppercase tracking-widest">Caching voter master files...</p>
                          </div>
                        ) : !voterSearch.trim() ? (
                          <div className="py-8 px-4 border border-zinc-150 dark:border-zinc-800 rounded-xl text-center bg-zinc-50/50 dark:bg-zinc-900/10">
                            <Search className="mx-auto text-zinc-300 dark:text-zinc-600 mb-2 opacity-50" size={24} />
                            <p className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Search for Beneficiary</p>
                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-1 max-w-[270px] mx-auto">
                              Start typing Name, EPIC No, or Mobile to filter voters assigned to you in User Management.
                            </p>
                          </div>
                        ) : filteredVoters.length > 0 ? (
                          <div className="border border-zinc-100 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 max-h-[220px] overflow-y-auto">
                            {filteredVoters.map(sv => (
                              <button 
                                key={sv.id}
                                type="button"
                                onClick={() => handleSelectVoter(sv)}
                                className="w-full text-left p-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 flex justify-between items-center transition-all text-xs"
                              >
                                <div className="min-w-0 pr-2">
                                  <p className="font-bold text-zinc-900 dark:text-white truncate">{sv.name}</p>
                                  <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                                    EPIC: {sv.voterId} {sv.mobile ? `| Mobile: ${sv.mobile}` : ''}
                                  </p>
                                </div>
                                <span className="text-[10px] bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-1 rounded-lg font-bold uppercase tracking-wider shrink-0">
                                  Select
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="py-12 border border-zinc-150 dark:border-zinc-800 border-dashed rounded-xl text-center">
                            <AlertCircle className="mx-auto text-zinc-300 dark:text-zinc-700 mb-1.5" size={20} />
                            <p className="text-xs font-bold text-zinc-400">No voters found</p>
                            <p className="text-[10px] text-zinc-500 mt-1">We couldn't find any voter matching "{voterSearch}" assigned to you.</p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bg-zinc-50 dark:bg-zinc-900 p-4 border border-zinc-100 dark:border-zinc-850 rounded-xl">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white">{selectedVoter.name}</p>
                            <p className="text-[10px] text-zinc-400 font-mono mt-0.5">EPIC: {selectedVoter.voterId}</p>
                            {selectedVoter.mobile && (
                              <p className="text-[10px] text-zinc-500 mt-0.5">Contact: {selectedVoter.mobile}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setSelectedVoter(null)}
                            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-[10px] font-bold uppercase tracking-wider bg-white dark:bg-zinc-950 px-2 py-1 rounded border border-zinc-150 dark:border-zinc-800"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Step 2: Benefit Details */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Aadhaar Reference Number */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <CreditCard size={12} className="opacity-80" />
                        Aadhaar Number (12 Digits) <span className="text-zinc-500 font-normal italic lowercase">(Optional)</span>
                      </label>
                      <input 
                        type="text"
                        maxLength={12}
                        disabled={!selectedVoter || saving}
                        value={aadharNumber}
                        onChange={e => setAadharNumber(e.target.value.replace(/\D/g, ''))}
                        placeholder="e.g. 123456789012"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50 text-zinc-800 dark:text-white font-mono"
                      />
                      <p className="text-[9px] text-zinc-500">Auto-fetched from voter table if present</p>
                    </div>

                    {/* Source selection */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Benefit Type / Source
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setBenefitType('Government')}
                          className={`p-3 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                            benefitType === 'Government'
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300 font-bold'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                          }`}
                        >
                          <Landmark size={15} />
                          <span className="text-[10px] uppercase tracking-wider">Government Scheme</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => setBenefitType('Party')}
                          className={`p-3 border rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all ${
                            benefitType === 'Party'
                              ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 font-bold'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                          }`}
                        >
                          <Gift size={15} />
                          <span className="text-[10px] uppercase tracking-wider">Party Outreach</span>
                        </button>
                      </div>
                    </div>

                    {/* Benefit Name with quick suggestions */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Scheme / Aid Program Name
                      </label>
                      <input 
                        type="text"
                        required
                        disabled={saving}
                        value={benefitName}
                        onChange={e => setBenefitName(e.target.value)}
                        placeholder="Enter custom program name or select below"
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
                      />
                      
                      {/* Suggestions list */}
                      <div className="flex flex-wrap gap-1.5 pt-1.5">
                        {BENEFIT_SUGGESTIONS.map(s => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => setBenefitName(s)}
                            className="bg-zinc-50 dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-[9px] text-zinc-500 dark:text-zinc-400 px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 transition-all"
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Amount & Date */}
                    <div className="grid grid-cols-2 gap-4">
                      {/* Amount */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                          Aid amount (₹)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          disabled={saving}
                          value={amount}
                          onChange={e => setAmount(e.target.value)}
                          placeholder="e.g. 5000"
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white font-mono font-bold"
                        />
                      </div>

                      {/* Date */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                          Allocation Date
                        </label>
                        <input
                          type="date"
                          required
                          disabled={saving}
                          value={date}
                          onChange={e => setDate(e.target.value)}
                          className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white font-mono"
                        />
                      </div>
                    </div>

                    {/* Witness / Responsible Person */}
                    <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                        <User size={12} className="opacity-80" />
                        Witnesses / Responsible Persons <span className="text-zinc-500 font-normal italic lowercase">(Optional)</span>
                      </label>

                      {/* Dynamic Witness Tags list with add/remove */}
                      {witnessesList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 p-2 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-150 dark:border-zinc-800">
                          {witnessesList.map((witness, idx) => (
                            <span 
                              key={idx} 
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 shadow-xs"
                            >
                              <span>{witness.name} {witness.voterId ? `(${witness.voterId})` : ''}</span>
                              <button
                                type="button"
                                onClick={() => setWitnessesList(prev => prev.filter((_, i) => i !== idx))}
                                className="text-zinc-400 hover:text-red-500 transition-colors"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Direct typing input with Add button */}
                      <div className="flex gap-2">
                        <input 
                          type="text"
                          disabled={saving}
                          value={witnessName}
                          onChange={e => setWitnessName(e.target.value)}
                          placeholder="Type witness name directly..."
                          className="flex-1 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const trimmed = witnessName.trim();
                              if (trimmed) {
                                setWitnessesList(prev => [...prev, { name: trimmed }]);
                                setWitnessName('');
                              }
                            }
                          }}
                        />
                        <button
                          type="button"
                          disabled={saving || !witnessName.trim()}
                          onClick={() => {
                            const trimmed = witnessName.trim();
                            if (trimmed) {
                              setWitnessesList(prev => [...prev, { name: trimmed }]);
                              setWitnessName('');
                            }
                          }}
                          className="bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-830 text-zinc-800 dark:text-white text-xs font-bold px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl transition-all"
                        >
                          Add Direct
                        </button>
                      </div>

                      {/* Citizen link search widget */}
                      <div className="bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-xl border border-zinc-150 dark:border-zinc-850 space-y-2 mt-2">
                        <span className="text-[9px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">Link Citizen as Witness</span>
                        <input 
                          type="text" 
                          value={witnessSearch} 
                          onChange={e => setWitnessSearch(e.target.value)} 
                          className="bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg px-2.5 py-1.5 text-[11px] outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white w-full" 
                          placeholder="Type name / EPIC to filter citizens..." 
                          disabled={saving}
                        />

                        {witnessSearch.trim() && filteredWitnesses.length > 0 && (
                          <div className="divide-y divide-zinc-150/40 dark:divide-zinc-850/50 max-h-[140px] overflow-y-auto pt-1 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-lg">
                            {filteredWitnesses.map(wv => {
                              const alreadyLinked = witnessesList.some(wl => wl.voterDocId === wv.id);
                              return (
                                <div 
                                  key={wv.id}
                                  className="py-2 px-2.5 flex justify-between items-center text-[11px] hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-colors"
                                >
                                  <span className="font-semibold text-zinc-700 dark:text-zinc-300 truncate">
                                    {wv.name} ({wv.voterId})
                                  </span>
                                  {alreadyLinked ? (
                                    <span className="text-[9px] text-green-600 font-bold uppercase shrink-0">Linked</span>
                                  ) : (
                                    <button 
                                      type="button"
                                      onClick={() => {
                                        setWitnessesList(prev => [...prev, {
                                          name: wv.name,
                                          voterId: wv.voterId,
                                          voterDocId: wv.id
                                        }]);
                                      }}
                                      className="text-[9px] text-blue-600 dark:text-blue-400 font-bold hover:underline shrink-0"
                                    >
                                      Link
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
                        Notes / Remarks
                      </label>
                      <textarea
                        disabled={saving}
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Enter administrative description, remarks, or specific transaction proof identifier..."
                        rows={3}
                        className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-150-800 rounded-xl px-3.5 py-2.5 text-xs outline-none focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-white"
                      />
                    </div>

                    {/* Footer Trigger buttons */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
                      <button
                        type="button"
                        onClick={() => setIsOpen(false)}
                        className="flex-1 bg-zinc-50 dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 font-bold text-xs uppercase tracking-wider py-3 rounded-xl border border-zinc-150 dark:border-zinc-800 transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saving || !selectedVoter}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider py-3 rounded-xl transition-all shadow-sm disabled:opacity-40"
                      >
                        {saving ? 'Saving Records...' : 'Authorize & Log'}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILED TRANSACTION INSPECTOR (Right Canvas) */}
      <AnimatePresence>
        {detailBenefit && (
          <div className="fixed inset-0 z-50 overflow-hidden">
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDetailBenefit(null)}
              className="absolute inset-0 bg-black/45 backdrop-blur-xs"
            />

            {/* Container drawer */}
            <div className="fixed inset-y-0 right-0 max-w-full pl-10 flex">
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className="w-screen max-w-md bg-white dark:bg-zinc-950 shadow-2xl flex flex-col justify-between"
              >
                {/* Header */}
                <div className="px-6 py-5 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50/50 dark:bg-zinc-950/20">
                  <div>
                    <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white uppercase tracking-wider">Disbursement Details</h3>
                    <p className="text-[10px] text-zinc-505 font-mono">Transaction ID: {detailBenefit.id}</p>
                  </div>
                  <button 
                    onClick={() => setDetailBenefit(null)} 
                    className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-1 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-lg transition-all"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* Recipient Card */}
                  <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl p-4 border border-zinc-150 dark:border-zinc-850/65">
                    <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-2 font-sans">Recipient Information</span>
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                        <User size={18} />
                      </div>
                      <div>
                        <h4 className="font-black text-sm text-zinc-900 dark:text-white">{detailBenefit.voterName}</h4>
                        <p className="text-[11px] text-zinc-505 mt-0.5">EPIC/Voter ID: <span className="font-mono font-bold dark:text-zinc-350">{detailBenefit.voterId}</span></p>
                        
                        {detailBenefit.aadharNumber ? (
                          <div className="mt-2 flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-950 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 inline-block animate-fade-in">
                            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider font-sans">Aadhaar:</span>
                            <span className="font-mono text-xs text-zinc-705 dark:text-zinc-305 font-bold">
                              {detailBenefit.aadharNumber.replace(/(\d{4})(\d{4})(\d{4})/, '$1-$2-$3')}
                            </span>
                          </div>
                        ) : (
                          <p className="text-[10px] text-zinc-400 italic mt-1.5">No Aadhaar code logged</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Value / Amount Block */}
                  <div className="text-center p-6 border-y border-zinc-100 dark:border-zinc-850/60">
                    <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-1 font-sans">Disbursement Value</span>
                    <h3 className="text-4xl font-mono font-black text-zinc-900 dark:text-white">
                      ₹{detailBenefit.amount.toLocaleString('en-IN')}
                    </h3>
                    <div className="mt-2.5 flex justify-center">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        detailBenefit.benefitType === 'Government' 
                          ? 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-200/50 dark:border-purple-800/40' 
                          : 'bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-200/50 dark:border-orange-800/40'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          detailBenefit.benefitType === 'Government' ? 'bg-purple-600' : 'bg-orange-600'
                        }`} />
                        {detailBenefit.benefitType} Program
                      </span>
                    </div>
                  </div>

                  {/* Scheme Information */}
                  <div className="space-y-4">
                    <div>
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-1 font-sans">Aid Scheme / Program</span>
                      <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">{detailBenefit.benefitName}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-1 font-sans">Allocation Date</span>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-350 font-mono flex items-center gap-1.5">
                          <Calendar size={13} className="opacity-70" />
                          {new Date(detailBenefit.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </p>
                      </div>

                      <div>
                        <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-1 font-sans">Logged Date</span>
                        <p className="text-xs font-bold text-zinc-700 dark:text-zinc-350 font-mono flex items-center gap-1.5 animate-fade-in">
                          <Calendar size={13} className="opacity-70" />
                          {detailBenefit.createdAt ? (
                            new Date((detailBenefit.createdAt as unknown as { seconds: number })?.seconds * 1000 || Date.now()).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                          ) : 'Pending timestamp'}
                        </p>
                      </div>
                    </div>

                    {/* Witness Card details */}
                    <div>
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-2 font-sans">Witnesses / Proof</span>
                      {detailBenefit.witnesses && detailBenefit.witnesses.length > 0 ? (
                        <div className="space-y-2">
                          {detailBenefit.witnesses.map((w, wIdx) => (
                            <div key={wIdx} className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs">
                              <div>
                                <p className="font-bold text-zinc-800 dark:text-zinc-200">{w.name}</p>
                                {w.voterId && (
                                  <p className="text-[10px] text-zinc-505 font-mono mt-0.5 mt-1">EPIC: {w.voterId}</p>
                                )}
                              </div>
                              <span className="text-[8px] font-bold bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200/50 dark:border-green-800/40 px-2.5 py-1 rounded-full uppercase tracking-wider text-right">Verified Proof</span>
                            </div>
                          ))}
                        </div>
                      ) : detailBenefit.witnessName ? (
                        <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-850 px-3 py-2.5 rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <p className="font-bold text-zinc-800 dark:text-zinc-200">{detailBenefit.witnessName}</p>
                            {detailBenefit.witnessVoterId && (
                              <p className="text-[10px] text-zinc-505 font-mono mt-0.5 mt-1">EPIC: {detailBenefit.witnessVoterId}</p>
                            )}
                          </div>
                          <span className="text-[8px] font-bold bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 border border-green-200/50 dark:border-green-800/40 px-2.5 py-1 rounded-full uppercase tracking-wider text-right font-sans">Linked Proof</span>
                        </div>
                      ) : (
                        <div className="bg-zinc-50/50 dark:bg-zinc-900/10 border border-zinc-150 dark:border-zinc-850/60 border-dashed p-3.5 text-center rounded-xl">
                          <p className="text-xs text-zinc-400 dark:text-zinc-505 italic">No formal witness records mapped to this log.</p>
                        </div>
                      )}
                    </div>

                    {/* Notes / Remarks details */}
                    <div>
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-1.5 font-sans">Administrative Remarks</span>
                      <div className="bg-zinc-50 dark:bg-zinc-900 p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-850 text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                        {detailBenefit.notes ? detailBenefit.notes : <span className="italic text-zinc-400">No custom admin notes or remarks entered.</span>}
                      </div>
                    </div>

                    {/* Recorded By details */}
                    <div className="border-t border-zinc-100 dark:border-zinc-850/80 pt-4">
                      <span className="text-[9px] uppercase tracking-widest font-black text-zinc-400 block mb-2 font-sans">Audit Information</span>
                      <div className="flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-950/20 px-3 py-2.5 rounded-xl border border-zinc-150 dark:border-zinc-850 text-xs">
                        <div>
                          <p className="text-[10px] text-zinc-400 font-sans">Logged By</p>
                          <p className="font-bold text-zinc-800 dark:text-zinc-200 mt-0.5">
                            {detailBenefit.adminId === user?.uid ? 'You' : (adminMap[detailBenefit.adminId]?.username || 'Campaign Operator')}
                          </p>
                        </div>
                        <div className="text-right flex flex-col items-end">
                          <p className="text-[10px] text-zinc-400 font-sans">User Email</p>
                          <p className="text-[10px] font-mono text-zinc-505 mt-0.5">
                            {adminMap[detailBenefit.adminId]?.email || `UID: ${detailBenefit.adminId.substring(0, 10)}...`}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Footer close button */}
                <div className="p-6 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-905/35">
                  <button
                    type="button"
                    onClick={() => setDetailBenefit(null)}
                    className="w-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-850 text-zinc-800 dark:text-white font-extrabold text-xs uppercase tracking-wider py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 transition-all font-sans cursor-pointer active:scale-98"
                  >
                    Close Inspector
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
