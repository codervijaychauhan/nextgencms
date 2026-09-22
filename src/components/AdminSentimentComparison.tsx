import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Users, 
  UserCheck, 
  Search, 
  Filter, 
  CheckCircle, 
  AlertTriangle, 
  ShieldAlert, 
  BarChart3, 
  Layers, 
  Download, 
  RefreshCw, 
  Eye, 
  SlidersHorizontal, 
  Sparkles, 
  Building2, 
  MapPin, 
  X, 
  Check, 
  FileSpreadsheet, 
  Printer, 
  Info,
  Calendar,
  Phone,
  UserSquare2,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ShieldCheck,
  Award,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  username?: string;
}

export interface VoterAssessmentRecord {
  id: string;
  admin_id: string;
  admin_name?: string;
  admin_email?: string;
  admin_role?: string;
  voter_id: string;
  voter_name?: string;
  voter_epic?: string;
  voter_full_name?: string;
  voter_gender?: string;
  voter_age?: number;
  voter_mobile?: string;
  voter_village?: string;
  voter_house_no?: string;
  voter_booth_id?: string;
  booth_name?: string;
  booth_number?: string;
  voter_constituency_id?: string;
  constituency_name?: string;
  sentiment: 'Support' | 'Neutral' | 'Oppose' | 'Other Party' | string;
  sentiment_score: number;
  notes?: string;
  is_karyakarta?: number | boolean;
  vital_status?: string;
  physical_profile?: string;
  economic_category?: string;
  income_range?: string;
  land_ownership?: string;
  education?: string;
  voted?: number | boolean;
  recorded_by?: string;
  recorded_by_name?: string;
  created_at?: string;
  updated_at?: string;
}

export interface ComparisonVoterRow {
  voterKey: string;
  voterId: string;
  voterEpic: string;
  name: string;
  gender: string;
  age: number;
  mobile: string;
  village: string;
  boothName: string;
  boothNumber: string;
  constituencyName: string;
  adminAssessments: Record<string, VoterAssessmentRecord>;
  sentimentsList: string[];
  hasConsensus: boolean;
  hasConflict: boolean;
  assessmentCount: number;
}

export const AdminSentimentComparison: React.FC = () => {
  const { user, isSuperAdmin, profile } = useAuth();

  // Data states
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [assessments, setAssessments] = useState<VoterAssessmentRecord[]>([]);
  const [booths, setBooths] = useState<{ id: string; name: string; number?: string }[]>([]);
  const [constituencies, setConstituencies] = useState<{ id: string; name: string }[]>([]);

  // Selection & Filters
  const [selectedAdminIds, setSelectedAdminIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState('all');
  const [selectedBoothFilter, setSelectedBoothFilter] = useState('all');
  const [consensusFilter, setConsensusFilter] = useState<'all' | 'conflict' | 'consensus' | 'single'>('all');
  const [sentimentStatusFilter, setSentimentStatusFilter] = useState<string>('all');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Detail Modal
  const [selectedVoterDetail, setSelectedVoterDetail] = useState<ComparisonVoterRow | null>(null);

  // Load all necessary dataset
  const fetchComparisonData = async (initial = false) => {
    if (initial) setLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Users & Index them
      const usersRes = await api.get<any[]>('/api/users').catch(() => []);
      
      const allUsersMap = new Map<string, any>();
      (usersRes || []).forEach(u => {
        const uid = String(u.id || u.uid);
        allUsersMap.set(uid, u);
        if (u.email) allUsersMap.set(u.email.toLowerCase().trim(), u);
      });

      // Filter exclusively to Admin or above (role: 'admin' | 'super_admin' or owner email)
      const validAdmins: AdminUser[] = (usersRes || [])
        .filter(u => {
          const email = (u.email || '').toLowerCase().trim();
          const role = (u.role || '').toLowerCase();
          return role === 'admin' || role === 'super_admin' || email === 'vijaychauhanofficial01@gmail.com';
        })
        .map(u => {
          const email = (u.email || '').toLowerCase().trim();
          const isSuper = u.role === 'super_admin' || email === 'vijaychauhanofficial01@gmail.com';
          return {
            id: String(u.id || u.uid),
            name: u.name || u.username || u.email?.split('@')[0] || 'Administrator',
            email: u.email || '',
            role: isSuper ? 'super_admin' : 'admin',
            username: u.username || ''
          };
        });
      setAdmins(validAdmins);

      // Default select all admins
      if (selectedAdminIds.length === 0 && validAdmins.length > 0) {
        setSelectedAdminIds(validAdmins.map(a => a.id));
      }

      // Helper to resolve parent admin ID for any assessment
      const resolveToAdminId = (rawAdminId: string, recordedBy?: string): string => {
        if (validAdmins.some(a => a.id === rawAdminId)) return rawAdminId;

        const userObj = allUsersMap.get(rawAdminId) || allUsersMap.get(recordedBy || '');
        if (userObj) {
          if (userObj.role === 'admin' || userObj.role === 'super_admin') {
            return String(userObj.id || userObj.uid);
          }
          if (userObj.parent_admin_id) {
            const parent = validAdmins.find(a => a.id === String(userObj.parent_admin_id));
            if (parent) return parent.id;
            return String(userObj.parent_admin_id);
          }
        }
        return rawAdminId || (validAdmins[0]?.id || 'admin');
      };

      // 2. Fetch Booths & Constituencies
      const [boothsRes, constRes] = await Promise.all([
        api.get<any[]>('/api/booths').catch(() => []),
        api.get<any[]>('/api/constituencies').catch(() => [])
      ]);
      setBooths((boothsRes || []).map(b => ({
        id: String(b.id),
        name: b.name || `Booth #${b.booth_number || b.id}`,
        number: b.booth_number || ''
      })));
      setConstituencies((constRes || []).map(c => ({
        id: String(c.id),
        name: c.name || 'Constituency'
      })));

      // 3. Fetch Multi-Admin Assessments
      let assessmentsList: VoterAssessmentRecord[] = [];
      try {
        const rawAssessments = await api.get<any[]>('/api/voter-assessments').catch(() => []);
        if (Array.isArray(rawAssessments) && rawAssessments.length > 0) {
          assessmentsList = rawAssessments.map(a => {
            const adminId = resolveToAdminId(String(a.admin_id || a.adminId || ''), String(a.recorded_by || ''));
            const adminObj = validAdmins.find(ad => ad.id === adminId);
            return {
              ...a,
              admin_id: adminId,
              admin_name: adminObj?.name || a.admin_name || 'Administrator',
              admin_role: adminObj?.role || a.admin_role || 'admin',
              recorded_by_name: a.recorded_by_name || a.recorded_by_display_name || 'Staff'
            };
          });
        } else {
          // Fallback: collect from voter-sentiments if voter-assessments table endpoint is fresh
          const sentiments = await api.get<any[]>('/api/voter-sentiments').catch(() => []);
          assessmentsList = (sentiments || []).map(s => {
            const adminId = resolveToAdminId(String(s.admin_id || s.adminId || s.recorded_by || s.recordedBy || ''), String(s.recorded_by || s.recordedBy || ''));
            const adminObj = validAdmins.find(ad => ad.id === adminId);
            return {
              id: s.id,
              admin_id: adminId,
              admin_name: adminObj?.name || s.recordedByName || s.recorded_by_name || 'Administrator',
              admin_role: adminObj?.role || 'admin',
              voter_id: String(s.voter_id || s.voterId || s.voterDocId || s.id),
              voter_name: s.voter_name || s.voterName || 'Voter',
              voter_epic: s.voter_id || s.voterId || '',
              sentiment: s.sentiment || (Number(s.sentimentScore || s.sentiment_score || 3) >= 4 ? 'Support' : (Number(s.sentimentScore || s.sentiment_score || 3) <= 2 ? 'Oppose' : 'Neutral')),
              sentiment_score: Number(s.sentimentScore || s.sentiment_score || 3.0),
              notes: s.notes || (Array.isArray(s.keyConcerns) ? s.keyConcerns.join(', ') : ''),
              is_karyakarta: s.isKaryakarta || s.is_karyakarta ? 1 : 0,
              recorded_by: s.recorded_by || s.recordedBy,
              recorded_by_name: s.recordedByName || s.recorded_by_name || 'Karyakarta / Staff',
              created_at: s.createdAt || s.created_at,
              updated_at: s.updatedAt || s.updated_at || s.createdAt || s.created_at
            };
          });
        }
      } catch (aErr) {
        console.error("Failed to load assessments:", aErr);
      }

      setAssessments(assessmentsList);

    } catch (err) {
      console.error("Error loading comparison data:", err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchComparisonData(true);
  }, []);

  // Toggle Admin selection
  const toggleAdmin = (adminId: string) => {
    setSelectedAdminIds(prev => 
      prev.includes(adminId) 
        ? prev.filter(id => id !== adminId) 
        : [...prev, adminId]
    );
  };

  const selectAllAdmins = () => {
    setSelectedAdminIds(admins.map(a => a.id));
  };

  const clearAdminSelection = () => {
    setSelectedAdminIds([]);
  };

  // Group assessments into voter-by-voter rows
  const voterComparisonMatrix: ComparisonVoterRow[] = useMemo(() => {
    const voterMap = new Map<string, ComparisonVoterRow>();

    assessments.forEach(ass => {
      const vKey = String(ass.voter_id || ass.voter_epic || ass.id);
      if (!vKey) return;

      if (!voterMap.has(vKey)) {
        voterMap.set(vKey, {
          voterKey: vKey,
          voterId: ass.voter_id,
          voterEpic: ass.voter_epic || ass.voter_id,
          name: ass.voter_full_name || ass.voter_name || 'Voter',
          gender: ass.voter_gender || 'General',
          age: ass.voter_age || 35,
          mobile: ass.voter_mobile || '',
          village: ass.voter_village || '',
          boothName: ass.booth_name || '',
          boothNumber: ass.booth_number || '',
          constituencyName: ass.constituency_name || '',
          adminAssessments: {},
          sentimentsList: [],
          hasConsensus: true,
          hasConflict: false,
          assessmentCount: 0
        });
      }

      const row = voterMap.get(vKey)!;
      row.adminAssessments[ass.admin_id] = ass;
    });

    // Compute consensus & sentiments list for each voter
    const rows = Array.from(voterMap.values());
    rows.forEach(row => {
      const activeAssessments = Object.entries(row.adminAssessments)
        .filter(([adminId]) => selectedAdminIds.length === 0 || selectedAdminIds.includes(adminId))
        .map(([_, a]) => a);

      row.assessmentCount = activeAssessments.length;
      row.sentimentsList = activeAssessments.map(a => a.sentiment || 'Neutral');

      const uniqueSentiments = Array.from(new Set(row.sentimentsList));
      row.hasConsensus = uniqueSentiments.length === 1 && activeAssessments.length > 1;
      row.hasConflict = uniqueSentiments.length > 1;
    });

    return rows;
  }, [assessments, selectedAdminIds]);

  // Compute stats per selected Admin
  const adminStats = useMemo(() => {
    return admins.map(admin => {
      const adminAssessments = assessments.filter(a => String(a.admin_id) === String(admin.id));
      const totalAssessed = adminAssessments.length;
      
      let support = 0;
      let neutral = 0;
      let oppose = 0;
      let other = 0;
      let scoreSum = 0;
      let karyakartas = 0;

      adminAssessments.forEach(a => {
        const s = a.sentiment;
        if (s === 'Support') support++;
        else if (s === 'Neutral') neutral++;
        else if (s === 'Oppose') oppose++;
        else if (s === 'Other Party') other++;
        else neutral++;

        scoreSum += Number(a.sentiment_score || 3);
        if (a.is_karyakarta === 1 || a.is_karyakarta === true) karyakartas++;
      });

      const avgScore = totalAssessed > 0 ? (scoreSum / totalAssessed).toFixed(1) : '0.0';
      const supportPct = totalAssessed > 0 ? Math.round((support / totalAssessed) * 100) : 0;
      const neutralPct = totalAssessed > 0 ? Math.round((neutral / totalAssessed) * 100) : 0;
      const opposePct = totalAssessed > 0 ? Math.round((oppose / totalAssessed) * 100) : 0;
      const otherPct = totalAssessed > 0 ? Math.round((other / totalAssessed) * 100) : 0;

      return {
        admin,
        totalAssessed,
        support,
        neutral,
        oppose,
        other,
        supportPct,
        neutralPct,
        opposePct,
        otherPct,
        avgScore,
        karyakartas,
        isSelected: selectedAdminIds.includes(admin.id)
      };
    });
  }, [admins, assessments, selectedAdminIds]);

  // Overall Consensus KPI
  const consensusMetrics = useMemo(() => {
    const multiAssessed = voterComparisonMatrix.filter(v => v.assessmentCount >= 2);
    const totalMulti = multiAssessed.length;
    const consensusCount = multiAssessed.filter(v => v.hasConsensus).length;
    const conflictCount = multiAssessed.filter(v => v.hasConflict).length;
    const consensusRate = totalMulti > 0 ? Math.round((consensusCount / totalMulti) * 100) : 100;

    return {
      totalEvaluatedVoters: voterComparisonMatrix.length,
      multiAssessedVoters: totalMulti,
      consensusCount,
      conflictCount,
      consensusRate
    };
  }, [voterComparisonMatrix]);

  // Filtered rows for the matrix table
  const filteredRows = useMemo(() => {
    return voterComparisonMatrix.filter(row => {
      // 1. Text Search
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matches = (
          row.name.toLowerCase().includes(term) ||
          row.voterEpic.toLowerCase().includes(term) ||
          row.mobile.includes(term) ||
          row.village.toLowerCase().includes(term) ||
          row.boothName.toLowerCase().includes(term)
        );
        if (!matches) return false;
      }

      // 2. Consensus / Conflict Filter
      if (consensusFilter === 'conflict' && !row.hasConflict) return false;
      if (consensusFilter === 'consensus' && !row.hasConsensus) return false;
      if (consensusFilter === 'single' && row.assessmentCount !== 1) return false;

      // 3. Sentiment Status Filter
      if (sentimentStatusFilter !== 'all') {
        const hasSentiment = row.sentimentsList.includes(sentimentStatusFilter);
        if (!hasSentiment) return false;
      }

      // 4. Constituency Filter
      if (selectedConstituencyFilter !== 'all') {
        const matchesConst = Object.values(row.adminAssessments).some(a => 
          String(a.voter_constituency_id) === selectedConstituencyFilter ||
          a.constituency_name === selectedConstituencyFilter
        );
        if (!matchesConst) return false;
      }

      // 5. Booth Filter
      if (selectedBoothFilter !== 'all') {
        const matchesBooth = Object.values(row.adminAssessments).some(a => 
          String(a.voter_booth_id) === selectedBoothFilter ||
          a.booth_name === selectedBoothFilter ||
          a.booth_number === selectedBoothFilter
        );
        if (!matchesBooth) return false;
      }

      return true;
    });
  }, [voterComparisonMatrix, searchTerm, consensusFilter, sentimentStatusFilter, selectedConstituencyFilter, selectedBoothFilter]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const paginatedRows = filteredRows.slice((activePage - 1) * pageSize, activePage * pageSize);

  // CSV Export
  const exportToCSV = () => {
    const selectedAdminsList = admins.filter(a => selectedAdminIds.includes(a.id));
    const headers = [
      'Voter Name',
      'EPIC / Voter ID',
      'Gender',
      'Age',
      'Mobile',
      'Village',
      'Booth',
      'Consensus Status',
      ...selectedAdminsList.map(a => `${a.name} (${a.role}) Sentiment`),
      ...selectedAdminsList.map(a => `${a.name} Score`),
      ...selectedAdminsList.map(a => `${a.name} Notes`)
    ];

    const rows = filteredRows.map(row => {
      const statusStr = row.hasConflict ? 'CONFLICT / DIVERGENCE' : (row.hasConsensus ? 'FULL CONSENSUS' : 'SINGLE ASSESSMENT');
      return [
        `"${row.name}"`,
        `"${row.voterEpic}"`,
        `"${row.gender}"`,
        row.age,
        `"${row.mobile}"`,
        `"${row.village}"`,
        `"${row.boothName || row.boothNumber}"`,
        `"${statusStr}"`,
        ...selectedAdminsList.map(a => `"${row.adminAssessments[a.id]?.sentiment || 'Not Assessed'}"`),
        ...selectedAdminsList.map(a => row.adminAssessments[a.id]?.sentiment_score ?? 'N/A'),
        ...selectedAdminsList.map(a => `"${(row.adminAssessments[a.id]?.notes || '').replace(/"/g, '""')}"`)
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `voter_sentiment_comparison_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getSentimentPill = (sentiment?: string, score?: number) => {
    if (!sentiment) {
      return (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500 italic">
          Not Assessed
        </span>
      );
    }
    let col = 'bg-zinc-100 text-zinc-650 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700';
    let dot = 'bg-zinc-400';
    if (sentiment === 'Support') {
      col = 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-500/30';
      dot = 'bg-emerald-500';
    } else if (sentiment === 'Neutral') {
      col = 'bg-zinc-500/10 text-zinc-650 border-zinc-500/20 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700';
      dot = 'bg-zinc-400';
    } else if (sentiment === 'Oppose') {
      col = 'bg-red-500/10 text-red-650 border-red-500/20 dark:bg-red-950/30 dark:text-red-400 dark:border-red-500/30';
      dot = 'bg-red-500';
    } else if (sentiment === 'Other Party') {
      col = 'bg-amber-500/10 text-amber-650 border-amber-500/20 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-500/30';
      dot = 'bg-amber-500';
    }

    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${col}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
        <span>{sentiment}</span>
        {score !== undefined && score !== null && (
          <span className="text-[9px] opacity-75 font-mono ml-0.5">★{score}</span>
        )}
      </span>
    );
  };

  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isSuper = isSuperAdmin || userEmail === 'vijaychauhanofficial01@gmail.com';

  if (!isSuper) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 p-8 text-center bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm animate-in fade-in">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4 shadow-sm">
          <ShieldAlert size={28} />
        </div>
        <h3 className="text-lg font-black text-zinc-900 dark:text-white">Super Admin Clearance Required</h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mt-1.5 leading-relaxed">
          The Multi-Admin Voter Sentiment Comparison module is restricted exclusively to Super Administrators for cross-auditing and intelligence verification.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-300">
      
      {/* Header & Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-white flex items-center gap-2">
              Sentiment Comparison
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/50 rounded-full">
              Auditing
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            Compare voter sentiment ratings across administrators.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto">
          <button
            type="button"
            onClick={() => fetchComparisonData(false)}
            disabled={isRefreshing}
            className="webapp-button-secondary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-1.5 cursor-pointer rounded-md border border-zinc-200 dark:border-zinc-800"
            title="Refresh Assessments Data"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={exportToCSV}
            disabled={filteredRows.length === 0}
            className="webapp-button-primary px-3.5 py-1.5 text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs disabled:opacity-50 rounded-md"
          >
            <Download size={13} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Admin Multi-Selector & Pill Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800/80 pb-3">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-blue-500" />
            <span className="text-xs font-black uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
              Select Administrators to Compare ({selectedAdminIds.length}/{admins.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAllAdmins}
              className="text-[11px] font-extrabold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-zinc-300 dark:text-zinc-700">•</span>
            <button
              type="button"
              onClick={clearAdminSelection}
              className="text-[11px] font-extrabold text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Admin Badges */}
        <div className="flex flex-wrap gap-2.5">
          {admins.length === 0 ? (
            <span className="text-xs text-zinc-400 italic">No admin users found in system.</span>
          ) : (
            admins.map(a => {
              const isSelected = selectedAdminIds.includes(a.id);
              const count = assessments.filter(ass => String(ass.admin_id) === String(a.id)).length;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => toggleAdmin(a.id)}
                  className={`px-3 py-2 rounded-2xl border text-xs font-bold flex items-center gap-2.5 transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 shadow-2xs'
                      : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-md flex items-center justify-center text-[9px] font-black ${
                    isSelected ? 'bg-blue-600 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-transparent'
                  }`}>
                    <Check size={10} strokeWidth={3} />
                  </div>
                  <div className="text-left">
                    <div className="font-extrabold flex items-center gap-1.5 leading-tight">
                      <span>{a.name}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-zinc-200/60 dark:bg-zinc-800 font-mono text-zinc-600 dark:text-zinc-400">
                        {a.role}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-medium mt-0.5">
                      {count} {count === 1 ? 'assessment' : 'assessments'}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Consensus & Cross-Auditing KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Assessed */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Voters Evaluated</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400"><Users size={16} /></div>
          </div>
          <div className="text-2xl font-black text-zinc-900 dark:text-white mt-2">
            {consensusMetrics.totalEvaluatedVoters}
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">
            Across {assessments.length} total assessments
          </div>
        </div>

        {/* Multi-Assessed (Overlap) */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Cross-Audited Voters</span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400"><Layers size={16} /></div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 mt-2">
            {consensusMetrics.multiAssessedVoters}
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">
            Evaluated by 2+ selected admins
          </div>
        </div>

        {/* Consensus Rate */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Consensus Rate</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"><CheckCircle size={16} /></div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-2">
            {consensusMetrics.consensusRate}%
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">
            {consensusMetrics.consensusCount} unanimous evaluations
          </div>
        </div>

        {/* Divergence / Conflicts */}
        <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <div className="flex justify-between items-start">
            <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Divergences / Conflicts</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400"><AlertTriangle size={16} /></div>
          </div>
          <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-2">
            {consensusMetrics.conflictCount}
          </div>
          <div className="text-[11px] font-semibold text-zinc-500 mt-1">
            Voters with differing ratings
          </div>
        </div>
      </div>

      {/* Selected Admins Comparative Breakdown Cards */}
      {selectedAdminIds.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2 px-1">
            <TrendingUp size={14} /> Side-by-Side Admin Sentiment Breakdown
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {adminStats.filter(s => s.isSelected).map(stat => (
              <div 
                key={stat.admin.id}
                className="p-5 rounded-3xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                      {stat.admin.name}
                    </h4>
                    <div className="text-[10px] text-zinc-400 font-medium">
                      {stat.admin.email || stat.admin.role}
                    </div>
                  </div>
                  <span className="text-xs font-mono font-black px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300">
                    {stat.totalAssessed} Voters
                  </span>
                </div>

                {/* Score & Karyakarta stats */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/60">
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">Avg Rating</span>
                    <span className="text-sm font-black text-amber-500 flex items-center gap-1 mt-0.5">
                      ★ {stat.avgScore} <span className="text-[10px] text-zinc-400 font-normal">/ 5.0</span>
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/50">
                    <span className="text-[9px] font-black uppercase text-zinc-400 block">Karyakartas</span>
                    <span className="text-sm font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                      {stat.karyakartas} tagged
                    </span>
                  </div>
                </div>

                {/* Sentiment Distribution Bars */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-black text-zinc-400 uppercase">
                    <span>Sentiment Distribution</span>
                  </div>

                  {/* Multi-segment Bar */}
                  <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex">
                    <div style={{ width: `${stat.supportPct}%` }} className="bg-emerald-500 h-full transition-all" title={`Support: ${stat.support} (${stat.supportPct}%)`} />
                    <div style={{ width: `${stat.neutralPct}%` }} className="bg-zinc-400 h-full transition-all" title={`Neutral: ${stat.neutral} (${stat.neutralPct}%)`} />
                    <div style={{ width: `${stat.opposePct}%` }} className="bg-red-500 h-full transition-all" title={`Oppose: ${stat.oppose} (${stat.opposePct}%)`} />
                    <div style={{ width: `${stat.otherPct}%` }} className="bg-amber-500 h-full transition-all" title={`Other Party: ${stat.other} (${stat.otherPct}%)`} />
                  </div>

                  {/* Legend Counts */}
                  <div className="grid grid-cols-4 gap-1 text-center pt-1">
                    <div className="text-[10px]">
                      <span className="font-extrabold text-emerald-600 dark:text-emerald-400 block">{stat.support}</span>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">Support</span>
                    </div>
                    <div className="text-[10px]">
                      <span className="font-extrabold text-zinc-600 dark:text-zinc-400 block">{stat.neutral}</span>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">Neutral</span>
                    </div>
                    <div className="text-[10px]">
                      <span className="font-extrabold text-red-600 dark:text-red-400 block">{stat.oppose}</span>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">Oppose</span>
                    </div>
                    <div className="text-[10px]">
                      <span className="font-extrabold text-amber-600 dark:text-amber-400 block">{stat.other}</span>
                      <span className="text-[8px] font-bold text-zinc-400 uppercase">Other</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="p-5 rounded-3xl bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search by voter name, EPIC ID, mobile, village, or booth..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all font-medium"
            />
            {searchTerm && (
              <button 
                onClick={() => setSearchTerm('')} 
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 cursor-pointer"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Consensus Mode Tabs */}
          <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-2xl shrink-0 overflow-x-auto">
            {[
              { id: 'all', label: 'All Voters' },
              { id: 'conflict', label: 'Conflicts Only ⚠️' },
              { id: 'consensus', label: 'Consensus Only ✨' },
              { id: 'single', label: 'Single Eval' }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => { setConsensusFilter(tab.id as any); setCurrentPage(1); }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                  consensusFilter === tab.id
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/60">
          {/* Sentiment Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Sentiment Alignment</label>
            <select
              value={sentimentStatusFilter}
              onChange={(e) => { setSentimentStatusFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 outline-none font-bold cursor-pointer"
            >
              <option value="all">All Sentiment Types</option>
              <option value="Support">Support</option>
              <option value="Neutral">Neutral</option>
              <option value="Oppose">Oppose</option>
              <option value="Other Party">Other Party</option>
            </select>
          </div>

          {/* Constituency Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Constituency</label>
            <select
              value={selectedConstituencyFilter}
              onChange={(e) => { setSelectedConstituencyFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 outline-none font-bold cursor-pointer"
            >
              <option value="all">All Constituencies</option>
              {constituencies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          {/* Booth Filter */}
          <div>
            <label className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Polling Booth</label>
            <select
              value={selectedBoothFilter}
              onChange={(e) => { setSelectedBoothFilter(e.target.value); setCurrentPage(1); }}
              className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 outline-none font-bold cursor-pointer"
            >
              <option value="all">All Booths</option>
              {booths.map(b => (
                <option key={b.id} value={b.id}>{b.number ? `#${b.number} - ` : ''}{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Comparison Matrix Table */}
      <div className="bg-white dark:bg-zinc-900/60 rounded-3xl border border-zinc-200 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-zinc-50/70 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-5 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider">Voter Profile</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider">Booth / Location</th>
                <th className="px-4 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider text-center">Consensus Status</th>
                
                {/* Columns for selected admins */}
                {admins.filter(a => selectedAdminIds.includes(a.id)).map(admin => (
                  <th key={admin.id} className="px-4 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider">
                    <div className="flex items-center gap-1.5">
                      <span>{admin.name}</span>
                      <span className="text-[8px] font-mono px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 lowercase">
                        {admin.role.replace('_', ' ')}
                      </span>
                    </div>
                  </th>
                ))}
                
                <th className="px-4 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={4 + selectedAdminIds.length} className="py-20 text-center text-zinc-400">
                    <Loader2 size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
                    <span className="text-xs font-bold">Aggregating multi-admin assessments...</span>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4 + selectedAdminIds.length} className="py-16 text-center text-zinc-400 text-xs font-bold">
                    No voter records matching the selected comparison filters.
                  </td>
                </tr>
              ) : (
                paginatedRows.map(row => {
                  const selectedAdminsList = admins.filter(a => selectedAdminIds.includes(a.id));

                  return (
                    <tr 
                      key={row.voterKey} 
                      className={`hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-all ${
                        row.hasConflict ? 'bg-amber-500/[0.03] dark:bg-amber-500/[0.02]' : ''
                      }`}
                    >
                      {/* Voter info */}
                      <td className="px-5 py-4">
                        <div className="font-extrabold text-xs text-zinc-900 dark:text-white flex items-center gap-1.5">
                          <span>{row.name}</span>
                          {(Object.values(row.adminAssessments) as VoterAssessmentRecord[]).some(a => a.is_karyakarta === 1 || a.is_karyakarta === true) && (
                            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 border border-blue-500/20">
                              Karyakarta
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-zinc-400 font-mono mt-0.5 flex items-center gap-2">
                          <span className="text-blue-600 font-bold">{row.voterEpic}</span>
                          {row.gender && <span>• {row.gender}, {row.age}Y</span>}
                          {row.mobile && <span>• 📞 {row.mobile}</span>}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="px-4 py-4 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        <div>{row.boothName || (row.boothNumber ? `Booth #${row.boothNumber}` : 'Unassigned Booth')}</div>
                        {row.village && <div className="text-[10px] text-zinc-400">📍 {row.village}</div>}
                      </td>

                      {/* Consensus Status */}
                      <td className="px-4 py-4 text-center">
                        {row.hasConflict ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 border border-amber-500/30 dark:bg-amber-950/40 dark:text-amber-400">
                            <AlertTriangle size={11} />
                            <span>Divergence</span>
                          </span>
                        ) : row.hasConsensus ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-400">
                            <CheckCircle size={11} />
                            <span>Consensus</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-zinc-400 bg-zinc-100 dark:bg-zinc-800">
                            <span>1 Assessment</span>
                          </span>
                        )}
                      </td>

                      {/* Per-Admin Columns */}
                      {selectedAdminsList.map(admin => {
                        const ass = row.adminAssessments[admin.id];
                        return (
                          <td key={admin.id} className="px-4 py-4">
                            <div className="space-y-1">
                              {getSentimentPill(ass?.sentiment, ass?.sentiment_score)}
                              {ass?.notes && (
                                <div className="text-[10px] text-zinc-500 dark:text-zinc-400 font-normal italic truncate max-w-[140px]" title={ass.notes}>
                                  "{ass.notes}"
                                </div>
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Action View */}
                      <td className="px-4 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedVoterDetail(row)}
                          className="p-1 px-2.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:text-blue-600 hover:border-blue-300 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 ml-auto cursor-pointer transition-all active:scale-95 shadow-2xs"
                        >
                          <Eye size={12} />
                          <span>Compare</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Section */}
        <div className="p-4 sm:p-6 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            {filteredRows.length === 0 ? (
              <span>No Matching Voter Assessments</span>
            ) : (
              <span>
                Showing <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{(activePage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">
                  {Math.min(activePage * pageSize, filteredRows.length)}
                </strong>{' '}
                of <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{filteredRows.length}</strong> Evaluated Voters
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Rows</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-300 outline-none cursor-pointer"
              >
                {[10, 15, 25, 50, 100].map(sz => (
                  <option key={sz} value={sz}>{sz}</option>
                ))}
              </select>
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-850 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="px-2 text-xs font-bold text-zinc-600 dark:text-zinc-300">
                  Page {activePage} of {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-30 cursor-pointer"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Side-by-Side Detailed Voter Modal */}
      <AnimatePresence>
        {selectedVoterDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => setSelectedVoterDetail(null)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative bg-white dark:bg-zinc-950 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden z-10"
            >
              {/* Modal Header */}
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex justify-between items-start shrink-0">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-zinc-900 dark:text-white">
                      {selectedVoterDetail.name}
                    </h3>
                    <span className="text-xs font-mono font-bold text-blue-600 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                      {selectedVoterDetail.voterEpic}
                    </span>
                    {selectedVoterDetail.hasConflict ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30">
                        ⚠️ Conflict Detected
                      </span>
                    ) : selectedVoterDetail.hasConsensus ? (
                      <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/30">
                        ✨ Full Consensus
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-zinc-500 font-medium mt-1">
                    {selectedVoterDetail.gender}, {selectedVoterDetail.age} Yrs • {selectedVoterDetail.boothName || `Booth #${selectedVoterDetail.boothNumber}`} • {selectedVoterDetail.village}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedVoterDetail(null)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Body: Side-by-Side Admin Cards */}
              <div className="p-6 overflow-y-auto space-y-4 flex-1">
                <div className="text-xs font-black uppercase tracking-wider text-zinc-400">
                  Individual Administrator Evaluations ({Object.keys(selectedVoterDetail.adminAssessments).length})
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {(Object.entries(selectedVoterDetail.adminAssessments) as [string, VoterAssessmentRecord][]).map(([adminId, ass]) => {
                    const adminObj = admins.find(a => a.id === adminId);
                    const adminName = ass.admin_name || adminObj?.name || `Admin (${adminId})`;
                    const adminRole = ass.admin_role || adminObj?.role || 'admin';

                    return (
                      <div 
                        key={adminId}
                        className="p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-3"
                      >
                        <div className="flex justify-between items-center border-b border-zinc-200/60 dark:border-zinc-800/60 pb-2.5">
                          <div>
                            <span className="text-xs font-black text-zinc-900 dark:text-white flex items-center gap-1.5">
                              👤 {adminName}
                            </span>
                            <span className="text-[10px] text-zinc-400 font-mono capitalize">
                              {adminRole.replace('_', ' ')}
                            </span>
                          </div>
                          {getSentimentPill(ass.sentiment, ass.sentiment_score)}
                        </div>

                        <div className="space-y-2 text-xs">
                          {/* Rating */}
                          <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                            <span className="text-zinc-400 text-[11px] font-bold">Strength Score</span>
                            <span className="font-extrabold text-amber-500">★ {ass.sentiment_score || 3} / 5</span>
                          </div>

                          {/* Karyakarta */}
                          <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                            <span className="text-zinc-400 text-[11px] font-bold">Karyakarta Status</span>
                            <span className={`font-bold ${ass.is_karyakarta ? 'text-blue-600' : 'text-zinc-400'}`}>
                              {ass.is_karyakarta ? 'Yes (Volunteer)' : 'No'}
                            </span>
                          </div>

                          {/* Economic Profile */}
                          {ass.economic_category && (
                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                              <span className="text-zinc-400 text-[11px] font-bold">Economic Category</span>
                              <span className="font-bold">{ass.economic_category}</span>
                            </div>
                          )}

                          {/* Vital Status */}
                          {ass.vital_status && (
                            <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-300">
                              <span className="text-zinc-400 text-[11px] font-bold">Vital Status</span>
                              <span className="font-bold">{ass.vital_status}</span>
                            </div>
                          )}

                          {/* Intel Notes */}
                          <div className="pt-2 border-t border-zinc-200/60 dark:border-zinc-800/60">
                            <span className="text-[10px] font-black uppercase text-zinc-400 block mb-1">Assessor Notes</span>
                            <div className="p-3 rounded-xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-700 dark:text-zinc-300 leading-relaxed min-h-[50px]">
                              {ass.notes ? `"${ass.notes}"` : <span className="text-zinc-400 italic">No notes recorded by this administrator.</span>}
                            </div>
                          </div>

                          {/* Timestamp */}
                          <div className="text-[10px] text-zinc-400 pt-1 flex justify-between">
                            <span>Recorded by: <strong>{ass.recorded_by_name || 'Staff'}</strong></span>
                            {ass.updated_at && <span>{new Date(ass.updated_at).toLocaleDateString()}</span>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-900/60 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedVoterDetail(null)}
                  className="webapp-button-secondary px-6 py-2 text-xs font-bold cursor-pointer"
                >
                  Close Comparison
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default AdminSentimentComparison;
