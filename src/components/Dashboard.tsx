import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { Link } from 'react-router-dom';
import { 
  Shield, 
  Smartphone, 
  Users, 
  Target, 
  Flag, 
  ClipboardList, 
  MessageSquare, 
  CheckCircle, 
  Loader2,
  Building2,
  Gift,
  Wallet,
  Layers,
  TrendingUp,
  UserCog,
  Database,
  ArrowRight,
  ExternalLink,
  MapPin,
  BarChart3,
  Sparkles,
  Calendar,
  Check,
  Network,
  ChevronDown,
  ChevronRight,
  UserCheck,
  IdCard
} from 'lucide-react';
import { api } from '../lib/api';

interface Voter {
  id: string;
  voterId: string;
  name: string;
  relationName?: string;
  constituencyId: string;
  boothId: string;
  stateId?: string;
  districtId?: string;
  village?: string;
  mobile?: string;
  gender?: string;
  age?: number;
  caste?: string;
  isKaryakarta?: boolean;
  voted?: boolean;
  education?: string;
}

interface Sentiment {
  id: string;
  voterDocId?: string;
  voterName: string;
  favoredPartyId?: string;
  favoredPartyName: string;
  sentimentScore: number;
  electionYear: number;
  createdAt?: any;
  surveyId?: string;
  surveyTitle?: string;
  recordedBy?: string;
  recordedByName?: string;
  keyConcerns?: string[];
}

interface CampaignSurvey {
  id: string;
  title: string;
  description: string;
  electionId: string;
  electionYear: number;
  assignedTo: string[];
  status: 'Draft' | 'Active' | 'Completed';
  templateId?: string;
}

interface BenefitItem {
  id: string | number;
  voterName: string;
  voterId?: string;
  benefitName: string;
  benefitType: string;
  amount: number;
  date: string;
  adminId?: string;
}

interface VolunteerItem {
  id: string;
  name: string;
  mobile?: string;
  role?: string;
  assignedBoothId?: string;
  status?: string;
}

interface BoothItem {
  id: string;
  name: string;
  boothNumber: string;
  constituencyId?: string;
  districtId?: string;
  stateId?: string;
  constituencyName?: string;
  districtName?: string;
  stateName?: string;
}

interface MandalItem {
  id: string;
  name: string;
  code?: string;
  districtId?: string;
}

interface WhatsAppBroadcast {
  id: string;
  campaignName: string;
  status: string;
  totalCount: number;
  successCount: number;
  failedCount: number;
}

interface BudgetRecord {
  id: string;
  totalBudget: number;
  electionYear: string | number;
  allocations?: Record<string, number>;
  adminId?: string;
}

export default function Dashboard() {
  const { user, isAdmin, isSuperAdmin, profile, loading: authLoading } = useAuth();
  const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const isSuper = isSuperAdmin || userEmail === 'vijaychauhanofficial01@gmail.com';

  const normalizeId = (id: any): string => {
    if (id === null || id === undefined) return '';
    return String(id).trim().replace(/\.0$/, '');
  };

  // Demographic Scoping for Non-Super-Admins
  const electSettings = profile?.election_settings || profile?.electionSettings || {};
  const rawState = profile?.stateId || profile?.state_id || electSettings.state_id || electSettings.stateId || '';
  const rawDistrict = profile?.districtId || profile?.district_id || electSettings.district_id || electSettings.districtId || '';
  const rawConstituency = profile?.constituencyId || profile?.constituency_id || electSettings.constituency_id || electSettings.constituencyId || '';
  const rawBooth = profile?.boothId || profile?.booth_id || electSettings.booth_id || electSettings.boothId || '';
  const rawAssignedBooths = profile?.assigned_booths || electSettings.assigned_booths || [];

  const allowedStateIds = !isSuper && rawState
    ? String(rawState).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedDistrictIds = !isSuper && rawDistrict
    ? String(rawDistrict).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedConstituencyIds = !isSuper && rawConstituency
    ? String(rawConstituency).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedBoothIds = !isSuper && (rawBooth || (Array.isArray(rawAssignedBooths) && rawAssignedBooths.length > 0))
    ? (rawBooth 
        ? String(rawBooth).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
        : (rawAssignedBooths || []).map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')) 
    : [];

  const hasAssignedScope = isSuper || (
    allowedBoothIds.length > 0 ||
    allowedConstituencyIds.length > 0 ||
    allowedDistrictIds.length > 0 ||
    allowedStateIds.length > 0
  );

  // Permission check helper
  const canAccess = (moduleId: string): boolean => {
    if (isSuper) return true;
    if (!profile || profile.role === 'guest' || profile.disabled) return false;
    const perms = profile.permissions?.[moduleId] || profile.rights?.[moduleId] || '';
    if (typeof perms === 'string') {
      return perms.includes('v') || perms.includes('c') || perms.includes('u') || perms.includes('d');
    }
    return false;
  };
  
  // Dynamic Module States
  const [reportVoters, setReportVoters] = useState<Voter[]>([]);
  const [allSentiments, setAllSentiments] = useState<Sentiment[]>([]);
  const [assignedSurveys, setAssignedSurveys] = useState<CampaignSurvey[]>([]);
  const [allSurveysCount, setAllSurveysCount] = useState<number>(0);
  const [volunteersList, setVolunteersList] = useState<VolunteerItem[]>([]);
  const [boothsList, setBoothsList] = useState<BoothItem[]>([]);
  const [mandalsList, setMandalsList] = useState<MandalItem[]>([]);
  const [benefitsList, setBenefitsList] = useState<BenefitItem[]>([]);
  const [budgetsList, setBudgetsList] = useState<BudgetRecord[]>([]);
  const [whatsappBroadcasts, setWhatsappBroadcasts] = useState<WhatsAppBroadcast[]>([]);
  const [electionsList, setElectionsList] = useState<any[]>([]);
  const [partiesList, setPartiesList] = useState<any[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const userIdentifiers = [
    user?.uid,
    profile?.uid,
    profile?.id,
    profile?.username,
    (profile as any)?.name,
    user?.email?.toLowerCase(),
    profile?.email?.toLowerCase()
  ].filter(Boolean).map(id => String(id).toLowerCase().trim());

  useEffect(() => {
    const fetchData = async () => {
      setLoadingData(true);
      try {
        const promises: Promise<any>[] = [];

        // 1. Voters
        if (canAccess('voters') || canAccess('demographics')) {
          promises.push(
            api.get<{ data: Voter[] }>('/api/voters?limit=1000')
              .then(res => {
                let list = (res?.data || []).map((v: any) => ({
                  ...v,
                  voterId: v.voter_id || v.voterId,
                  relationName: v.relation_name || v.relationName,
                  constituencyId: normalizeId(v.constituency_id || v.constituencyId),
                  boothId: normalizeId(v.booth_id || v.boothId),
                  stateId: normalizeId(v.state_id || v.stateId),
                  districtId: normalizeId(v.district_id || v.districtId),
                  isKaryakarta: Boolean(v.is_karyakarta),
                  voted: v.voting_status === 'voted' || Boolean(v.voted)
                }));

                if (!isSuper) {
                  if (!hasAssignedScope) {
                    list = [];
                  } else {
                    list = list.filter(v => {
                      if (allowedBoothIds.length > 0) {
                        return allowedBoothIds.includes(v.boothId);
                      }
                      if (allowedConstituencyIds.length > 0) {
                        return allowedConstituencyIds.includes(v.constituencyId);
                      }
                      if (allowedDistrictIds.length > 0) {
                        return allowedDistrictIds.includes(v.districtId);
                      }
                      if (allowedStateIds.length > 0) {
                        return allowedStateIds.includes(v.stateId);
                      }
                      return true;
                    });
                  }
                }

                setReportVoters(list);
              })
              .catch(() => setReportVoters([]))
          );
        }

        // 2. Surveys & Sentiments
        if (canAccess('surveys') || canAccess('survey_campaigns')) {
          promises.push(
            api.get<CampaignSurvey[]>('/api/surveys')
              .then(surveyList => {
                const list = surveyList || [];
                setAllSurveysCount(list.length);
                const activeUserSurveys = list.filter(s => 
                  isSuper || (Array.isArray(s.assignedTo) && s.assignedTo.some(a => userIdentifiers.includes(String(a).toLowerCase().trim())))
                );
                setAssignedSurveys(activeUserSurveys);
              })
              .catch(() => {
                setAssignedSurveys([]);
                setAllSurveysCount(0);
              })
          );
          promises.push(
            api.get<Sentiment[]>('/api/voter-sentiments')
              .then(list => setAllSentiments(list || []))
              .catch(() => setAllSentiments([]))
          );
        }

        // 3. Volunteers / Karyakartas
        if (canAccess('volunteers') || canAccess('booths')) {
          promises.push(
            api.get<VolunteerItem[]>('/api/volunteers')
              .then(list => setVolunteersList(list || []))
              .catch(() => setVolunteersList([]))
          );
        }

        // 4. Booths (Scoped to assigned user permissions)
        if (canAccess('booths') || canAccess('demographics')) {
          promises.push(
            api.get<any[]>('/api/booths')
              .then(rawList => {
                let list: BoothItem[] = (rawList || []).map((b: any) => ({
                  id: normalizeId(b.id),
                  name: b.name || '',
                  boothNumber: String(b.boothNumber || b.booth_number || ''),
                  constituencyId: normalizeId(b.constituencyId || b.constituency_id || ''),
                  districtId: normalizeId(b.districtId || b.district_id || ''),
                  stateId: normalizeId(b.stateId || b.state_id || ''),
                  constituencyName: b.constituencyName || b.constituency_name || '',
                  districtName: b.districtName || b.district_name || '',
                  stateName: b.stateName || b.state_name || ''
                }));

                if (!isSuper) {
                  if (!hasAssignedScope) {
                    list = [];
                  } else {
                    list = list.filter(b => {
                      const bId = normalizeId(b.id);
                      const bConstId = normalizeId(b.constituencyId);
                      const bDistId = normalizeId(b.districtId);
                      const bStateId = normalizeId(b.stateId);

                      // 1. If specific booth(s) are assigned, only show those booths
                      if (allowedBoothIds.length > 0) {
                        return allowedBoothIds.includes(bId) || 
                               allowedBoothIds.includes(b.boothNumber) || 
                               allowedBoothIds.includes(b.name);
                      }

                      // 2. If specific constituency(s) are assigned, only show booths in those constituencies
                      if (allowedConstituencyIds.length > 0) {
                        return allowedConstituencyIds.includes(bConstId) || 
                               (b.constituencyName && allowedConstituencyIds.includes(b.constituencyName));
                      }

                      // 3. If specific district(s) are assigned, only show booths in those districts
                      if (allowedDistrictIds.length > 0) {
                        return allowedDistrictIds.includes(bDistId) || 
                               (b.districtName && allowedDistrictIds.includes(b.districtName));
                      }

                      // 4. If specific state(s) are assigned, only show booths in those states
                      if (allowedStateIds.length > 0) {
                        return allowedStateIds.includes(bStateId) || 
                               (b.stateName && allowedStateIds.includes(b.stateName));
                      }

                      return true;
                    });
                  }
                }
                setBoothsList(list);
              })
              .catch(() => setBoothsList([]))
          );
        }

        // 5. Mandals
        if (canAccess('mandals')) {
          promises.push(
            api.get<MandalItem[]>('/api/mandals')
              .then(list => setMandalsList(list || []))
              .catch(() => setMandalsList([]))
          );
        }

        // 6. Benefits (Scoped to user / admin)
        if (canAccess('benefits')) {
          promises.push(
            api.get<any[]>('/api/benefits')
              .then(rawList => {
                let list: BenefitItem[] = (rawList || []).map((b: any) => ({
                  id: b.id,
                  voterName: b.voterName || b.voter_name || '',
                  voterId: b.voterId || b.voter_id || '',
                  benefitName: b.benefitName || b.benefit_name || '',
                  benefitType: b.benefitType || b.benefit_type || 'Government',
                  amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || '0'),
                  date: b.date || b.distribution_date || '',
                  adminId: normalizeId(b.adminId || b.admin_id || '')
                }));

                if (!isSuper) {
                  const myIds = [user?.uid, profile?.uid, profile?.id, profile?.parentAdminId, profile?.parent_admin_id, profile?.adminId].filter(Boolean).map(normalizeId);
                  list = list.filter(b => myIds.includes(b.adminId || '') || b.adminId === normalizeId(user?.uid));
                }
                setBenefitsList(list);
              })
              .catch(() => setBenefitsList([]))
          );
        }

        // 7. Finance (Scoped to user / admin)
        if (canAccess('finance')) {
          promises.push(
            api.get<any[]>('/api/finance/budgets')
              .then(rawList => {
                let list: BudgetRecord[] = (rawList || []).map((b: any) => ({
                  id: String(b.id),
                  totalBudget: typeof b.totalBudget === 'number' ? b.totalBudget : parseFloat(b.total_budget || b.totalBudget || '0'),
                  electionYear: b.electionYear || b.election_year || '2026',
                  allocations: b.allocations,
                  adminId: normalizeId(b.adminId || b.admin_id || '')
                }));

                if (!isSuper) {
                  const myIds = [user?.uid, profile?.uid, profile?.id, profile?.parentAdminId, profile?.parent_admin_id, profile?.adminId].filter(Boolean).map(normalizeId);
                  list = list.filter(b => myIds.includes(b.adminId || '') || b.adminId === normalizeId(user?.uid));
                }
                setBudgetsList(list);
              })
              .catch(() => setBudgetsList([]))
          );
        }

        // 8. WhatsApp
        if (canAccess('whatsapp')) {
          promises.push(
            api.get<WhatsAppBroadcast[]>('/api/whatsapp/broadcasts')
              .then(list => setWhatsappBroadcasts(list || []))
              .catch(() => setWhatsappBroadcasts([]))
          );
        }

        // 9. Elections & Parties
        if (canAccess('elections') || canAccess('demographics')) {
          promises.push(
            api.get<any[]>('/api/elections')
              .then(list => setElectionsList(list || []))
              .catch(() => setElectionsList([]))
          );
          promises.push(
            api.get<any[]>('/api/parties')
              .then(list => setPartiesList(list || []))
              .catch(() => setPartiesList([]))
          );
        }

        // 10. Users
        if (canAccess('users')) {
          promises.push(
            api.get<any[]>('/api/users')
              .then(list => setUsersList(list || []))
              .catch(() => setUsersList([]))
          );
        }

        await Promise.allSettled(promises);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user?.uid, user?.email, profile?.uid, profile?.id, profile?.permissions, profile?.rights, isSuper]);

  // Derived Calculations
  const totalVoters = reportVoters.length;
  const maleVoters = reportVoters.filter(v => v.gender === 'Male').length;
  const femaleVoters = reportVoters.filter(v => v.gender === 'Female').length;
  const mobileVoters = reportVoters.filter(v => v.mobile && v.mobile.trim().length >= 5).length;
  const mobilePct = totalVoters > 0 ? Math.round((mobileVoters / totalVoters) * 100) : 0;

  const assignedSurveyIds = assignedSurveys.map(s => String(s.id));
  const relevantSentiments = allSentiments.filter(s => 
    isSuper || (s.surveyId && assignedSurveyIds.includes(String(s.surveyId))) ||
    userIdentifiers.includes(String(s.recordedBy || '').toLowerCase())
  );
  const userSentimentsCount = relevantSentiments.filter(s => 
    userIdentifiers.includes(String(s.recordedBy || '').toLowerCase())
  ).length;

  const totalBenefitsDisbursed = benefitsList.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const uniqueBeneficiariesCount = new Set(benefitsList.map(b => (b.voterId || b.voterName || '').trim()).filter(Boolean)).size;
  const uniqueSchemesCount = new Set(benefitsList.map(b => (b.benefitName || '').trim()).filter(Boolean)).size;
  const totalBudgetDisbursed = budgetsList.reduce((acc, b) => acc + (Number(b.totalBudget) || 0), 0);
  const totalBroadcastsSent = whatsappBroadcasts.reduce((acc, b) => acc + (b.successCount || 0), 0);

  // Check how many modules the user has access to
  const accessibleModuleIds = [
    'voters', 'surveys', 'volunteers', 'booths', 'mandals', 'benefits',
    'finance', 'whatsapp', 'predictions', 'survey_campaigns', 'demographics',
    'elections', 'users'
  ].filter(id => canAccess(id));

  const hasAssignedPermissions = isSuper || accessibleModuleIds.length > 0;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {isSuper ? 'Super Admin' : (profile?.role ? profile.role.replace('_', ' ') : 'User')}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {isSuper ? 'System overview and module metrics.' : 'Election management workspace.'}
          </p>
        </div>
      </div>

      {/* Guest / No Module Access View */}
      {!hasAssignedPermissions && !isSuper ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-2xl space-y-3 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Shield size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Module Authorization Pending</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                No active modules assigned yet. Please contact the administrator to grant access to your designated areas.
              </p>
            </div>
          </div>
        </motion.div>
      ) : loadingData ? (
        <div className="p-12 text-center space-y-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs font-semibold text-zinc-400">Loading modules...</p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Clean Module Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          
          {/* 1. Voters */}
          {canAccess('voters') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Voters</h3>
                    <p className="text-[10px] text-zinc-400">Voter database</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-zinc-900 dark:text-white">{totalVoters}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Total</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>M: <strong className="text-zinc-700 dark:text-zinc-300">{maleVoters}</strong></span>
                    <span>F: <strong className="text-zinc-700 dark:text-zinc-300">{femaleVoters}</strong></span>
                    <span>Mobile: <strong className="text-blue-600 dark:text-blue-400">{mobilePct}%</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/voters"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300"
              >
                <span>Open Voters</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 2. Karyakartas */}
          {canAccess('volunteers') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <Users size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Karyakartas</h3>
                    <p className="text-[10px] text-zinc-400">Field workforce</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{volunteersList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Volunteers</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Active: <strong className="text-zinc-700 dark:text-zinc-300">{volunteersList.filter(v => v.status === 'Active').length}</strong></span>
                    <span>Assigned: <strong className="text-zinc-700 dark:text-zinc-300">{volunteersList.filter(v => v.assignedBoothId).length}</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/volunteers"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300"
              >
                <span>View Karyakartas</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 3. Mandals */}
          {canAccess('mandals') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                    <Layers size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Mandals</h3>
                    <p className="text-[10px] text-zinc-400">Sub-district units</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-teal-600 dark:text-teal-400">{mandalsList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Configured</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    Council and committee coverage
                  </div>
                </div>
              </div>

              <Link
                to="/admin/mandals"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300"
              >
                <span>Manage Mandals</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 4. Booths */}
          {canAccess('booths') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                    <Building2 size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Booths</h3>
                    <p className="text-[10px] text-zinc-400">Polling stations</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-amber-600 dark:text-amber-400">{boothsList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Booths</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    Polling station agent assignments
                  </div>
                </div>
              </div>

              <Link
                to="/admin/booths"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300"
              >
                <span>Manage Booths</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 5. Benefits */}
          {canAccess('benefits') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
                    <Gift size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Benefits</h3>
                    <p className="text-[10px] text-zinc-400">Welfare & aid</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-pink-600 dark:text-pink-400">₹{totalBenefitsDisbursed.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">{benefitsList.length} {benefitsList.length === 1 ? 'Record' : 'Records'}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Beneficiaries: <strong className="text-zinc-700 dark:text-zinc-300">{uniqueBeneficiariesCount}</strong></span>
                    <span>Schemes: <strong className="text-zinc-700 dark:text-zinc-300">{uniqueSchemesCount}</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/benefits"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300"
              >
                <span>Track Benefits</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 6. Finance */}
          {canAccess('finance') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                    <Wallet size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Finance</h3>
                    <p className="text-[10px] text-zinc-400">Budget & expenses</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-cyan-600 dark:text-cyan-400">₹{totalBudgetDisbursed.toLocaleString('en-IN')}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Budget</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Budgets: <strong className="text-zinc-700 dark:text-zinc-300">{budgetsList.length}</strong></span>
                    <span>Status: <strong className="text-emerald-600 dark:text-emerald-400">Active</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/finance"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300"
              >
                <span>Open Finance</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 7. Broadcasts */}
          {canAccess('whatsapp') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Broadcasts</h3>
                    <p className="text-[10px] text-zinc-400">Messaging campaigns</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-green-600 dark:text-green-400">{whatsappBroadcasts.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Campaigns</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Delivered:</span>
                    <strong className="text-zinc-700 dark:text-zinc-300">{totalBroadcastsSent}</strong>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/whatsapp"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300"
              >
                <span>Open Broadcasts</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 8. Surveys */}
          {canAccess('surveys') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                    <BarChart3 size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Surveys</h3>
                    <p className="text-[10px] text-zinc-400">Field responses</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-purple-600 dark:text-purple-400">{assignedSurveys.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Assigned</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Logged: <strong className="text-zinc-700 dark:text-zinc-300">{userSentimentsCount}</strong></span>
                    <span>Total: <strong className="text-zinc-700 dark:text-zinc-300">{relevantSentiments.length}</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/surveys"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"
              >
                <span>Record Survey</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 9. Analytics */}
          {canAccess('predictions') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                    <TrendingUp size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Analytics</h3>
                    <p className="text-[10px] text-zinc-400">Forecasts & trends</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-indigo-600 dark:text-indigo-400">Active</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Models</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    Turnout & sentiment projections
                  </div>
                </div>
              </div>

              <Link
                to="/admin/analytics"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300"
              >
                <span>View Analytics</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 10. Users */}
          {canAccess('users') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                    <UserCog size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Users</h3>
                    <p className="text-[10px] text-zinc-400">Access control</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-rose-600 dark:text-rose-400">{usersList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Users</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    Roles and module rights
                  </div>
                </div>
              </div>

              <Link
                to="/admin/users"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300"
              >
                <span>Manage Users</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 11. Campaigns */}
          {canAccess('survey_campaigns') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                    <ClipboardList size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Campaigns</h3>
                    <p className="text-[10px] text-zinc-400">Survey management</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-violet-600 dark:text-violet-400">{allSurveysCount}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Campaigns</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    Templates & staff assignment
                  </div>
                </div>
              </div>

              <Link
                to="/admin/surveys"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-violet-600 dark:text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300"
              >
                <span>Manage Campaigns</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 12. Demographics */}
          {canAccess('demographics') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                    <Flag size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Demographics</h3>
                    <p className="text-[10px] text-zinc-400">Territories & booths</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-orange-600 dark:text-orange-400">{boothsList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Registered Booths</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800 truncate">
                    State, district & booth mapping
                  </div>
                </div>
              </div>

              <Link
                to="/admin/demographics"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300"
              >
                <span>Demographics</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 13. Elections */}
          {canAccess('elections') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col justify-between group"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                    <Database size={16} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Elections</h3>
                    <p className="text-[10px] text-zinc-400">Cycles & parties</p>
                  </div>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200/80 dark:border-zinc-800/80 rounded-lg space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{electionsList.length}</span>
                    <span className="text-[10px] text-zinc-500 font-medium">Cycles</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Parties:</span>
                    <strong className="text-zinc-700 dark:text-zinc-300">{partiesList.length}</strong>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/elections"
                className="mt-3 pt-2.5 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-semibold text-yellow-600 dark:text-yellow-400 group-hover:text-yellow-700 dark:group-hover:text-yellow-300"
              >
                <span>Setup Elections</span>
                <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          </div>
        </div>
      )}
    </div>
  );
}
