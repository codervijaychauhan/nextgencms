import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { motion } from 'motion/react';
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
  Check
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
  benefitName: string;
  benefitType: string;
  amount: number;
  date: string;
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
}

export default function Dashboard() {
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  
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

  // Permission check helper
  const canAccess = (moduleId: string): boolean => {
    if (isAdmin) return true;
    if (!profile || profile.role === 'guest') return false;
    const perms = profile.permissions?.[moduleId] || profile.rights?.[moduleId] || '';
    if (typeof perms === 'string') {
      return perms.includes('v') || perms.includes('c') || perms.includes('u') || perms.includes('d');
    }
    return false;
  };

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
        if (canAccess('voters') || canAccess('demographics') || isAdmin) {
          promises.push(
            api.get<{ data: Voter[] }>('/api/voters?limit=500')
              .then(res => {
                const list = (res?.data || []).map((v: any) => ({
                  ...v,
                  voterId: v.voter_id || v.voterId,
                  relationName: v.relation_name || v.relationName,
                  constituencyId: v.constituency_id || v.constituencyId,
                  boothId: v.booth_id || v.boothId,
                  stateId: v.state_id || v.stateId,
                  districtId: v.district_id || v.districtId,
                  isKaryakarta: Boolean(v.is_karyakarta),
                  voted: v.voting_status === 'voted' || Boolean(v.voted)
                }));
                setReportVoters(list);
              })
              .catch(() => setReportVoters([]))
          );
        }

        // 2. Surveys & Sentiments
        if (canAccess('surveys') || canAccess('survey_campaigns') || isAdmin) {
          promises.push(
            api.get<CampaignSurvey[]>('/api/surveys')
              .then(surveyList => {
                const list = surveyList || [];
                setAllSurveysCount(list.length);
                const activeUserSurveys = list.filter(s => 
                  isAdmin || (Array.isArray(s.assignedTo) && s.assignedTo.some(a => userIdentifiers.includes(String(a).toLowerCase().trim())))
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
        if (canAccess('volunteers') || canAccess('booths') || isAdmin) {
          promises.push(
            api.get<VolunteerItem[]>('/api/volunteers')
              .then(list => setVolunteersList(list || []))
              .catch(() => setVolunteersList([]))
          );
        }

        // 4. Booths
        if (canAccess('booths') || canAccess('demographics') || isAdmin) {
          promises.push(
            api.get<BoothItem[]>('/api/booths')
              .then(list => setBoothsList(list || []))
              .catch(() => setBoothsList([]))
          );
        }

        // 5. Mandals
        if (canAccess('mandals') || isAdmin) {
          promises.push(
            api.get<MandalItem[]>('/api/mandals')
              .then(list => setMandalsList(list || []))
              .catch(() => setMandalsList([]))
          );
        }

        // 6. Benefits
        if (canAccess('benefits') || isAdmin) {
          promises.push(
            api.get<BenefitItem[]>('/api/benefits')
              .then(list => setBenefitsList(list || []))
              .catch(() => setBenefitsList([]))
          );
        }

        // 7. Finance
        if (canAccess('finance') || isAdmin) {
          promises.push(
            api.get<BudgetRecord[]>('/api/finance/budgets')
              .then(list => setBudgetsList(list || []))
              .catch(() => setBudgetsList([]))
          );
        }

        // 8. WhatsApp
        if (canAccess('whatsapp') || isAdmin) {
          promises.push(
            api.get<WhatsAppBroadcast[]>('/api/whatsapp/broadcasts')
              .then(list => setWhatsappBroadcasts(list || []))
              .catch(() => setWhatsappBroadcasts([]))
          );
        }

        // 9. Elections & Parties
        if (canAccess('elections') || canAccess('demographics') || isAdmin) {
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
        if (canAccess('users') || isAdmin) {
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
  }, [user?.uid, user?.email, profile?.uid, profile?.id, profile?.permissions, profile?.rights, isAdmin]);

  // Derived Calculations
  const totalVoters = reportVoters.length;
  const maleVoters = reportVoters.filter(v => v.gender === 'Male').length;
  const femaleVoters = reportVoters.filter(v => v.gender === 'Female').length;
  const mobileVoters = reportVoters.filter(v => v.mobile && v.mobile.trim().length >= 5).length;
  const mobilePct = totalVoters > 0 ? Math.round((mobileVoters / totalVoters) * 100) : 0;

  const assignedSurveyIds = assignedSurveys.map(s => String(s.id));
  const relevantSentiments = allSentiments.filter(s => 
    isAdmin || (s.surveyId && assignedSurveyIds.includes(String(s.surveyId))) ||
    userIdentifiers.includes(String(s.recordedBy || '').toLowerCase())
  );
  const userSentimentsCount = relevantSentiments.filter(s => 
    userIdentifiers.includes(String(s.recordedBy || '').toLowerCase())
  ).length;

  const totalBenefitsDisbursed = benefitsList.reduce((acc, b) => acc + (Number(b.amount) || 0), 0);
  const totalBudgetDisbursed = budgetsList.reduce((acc, b) => acc + (Number(b.totalBudget) || 0), 0);
  const totalBroadcastsSent = whatsappBroadcasts.reduce((acc, b) => acc + (b.successCount || 0), 0);

  // Check how many modules the user has access to
  const accessibleModuleIds = [
    'voters', 'surveys', 'volunteers', 'booths', 'mandals', 'benefits',
    'finance', 'whatsapp', 'predictions', 'survey_campaigns', 'demographics',
    'elections', 'users'
  ].filter(id => canAccess(id));

  const hasAssignedPermissions = isAdmin || accessibleModuleIds.length > 0;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 w-full max-w-7xl mx-auto">
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Dashboard
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              {isAdmin ? 'Super Admin' : (profile?.role ? profile.role.replace('_', ' ') : 'Volunteer')}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">
            {isAdmin 
              ? 'Complete system command center & operational overview.' 
              : 'Welcome to NextGen Election Management System workspace.'}
          </p>
        </div>
      </div>

      {/* Guest / No Module Access View */}
      {!hasAssignedPermissions && !isAdmin ? (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-8 bg-white dark:bg-zinc-900 border border-amber-500/30 rounded-3xl space-y-4 shadow-sm"
        >
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-white">Account Awaiting Module Authorization</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                Welcome, <strong className="text-zinc-800 dark:text-zinc-200">{user?.displayName || user?.email}</strong>. 
                You currently do not have any modules assigned. Please contact the <strong>Super Administrator</strong> to assign your designated constituency, booth, and role.
              </p>
            </div>
          </div>
        </motion.div>
      ) : loadingData ? (
        <div className="p-16 text-center space-y-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl">
          <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
          <p className="text-xs font-bold text-zinc-400">Loading your assigned modules...</p>
        </div>
      ) : (
        /* Minimalist Clean Grid: Renders ONLY the assigned modules */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          
          {/* 1. Voters Registry Module */}
          {canAccess('voters') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
                      <Users size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Voters Registry</h3>
                      <p className="text-[10px] text-zinc-400">Voter database & records</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-zinc-900 dark:text-white">{totalVoters}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Connected Voters</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Male: <strong className="text-zinc-800 dark:text-zinc-200">{maleVoters}</strong></span>
                    <span>Female: <strong className="text-zinc-800 dark:text-zinc-200">{femaleVoters}</strong></span>
                    <span>Mobile: <strong className="text-blue-600 dark:text-blue-400">{mobilePct}%</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/voters"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300"
              >
                <span>Open Voters Registry</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 2. Karyakartas Module */}
          {canAccess('volunteers') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                      <Users size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Karyakartas</h3>
                      <p className="text-[10px] text-zinc-400">Volunteers & task tracking</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{volunteersList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Registered Volunteers</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Field operations & volunteer assignments
                  </p>
                </div>
              </div>

              <Link
                to="/admin/volunteers"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:text-emerald-700 dark:group-hover:text-emerald-300"
              >
                <span>View Karyakartas</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 3. Mandal Management Module */}
          {canAccess('mandals') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center text-teal-600 dark:text-teal-400">
                      <Layers size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Mandal Management</h3>
                      <p className="text-[10px] text-zinc-400">Sub-district councils</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-teal-600 dark:text-teal-400">{mandalsList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Configured Mandals</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    President assignments & administrative areas
                  </p>
                </div>
              </div>

              <Link
                to="/admin/mandals"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-teal-600 dark:text-teal-400 group-hover:text-teal-700 dark:group-hover:text-teal-300"
              >
                <span>Manage Mandals</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 4. Booth Management Module */}
          {canAccess('booths') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 dark:text-amber-400">
                      <Building2 size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Booth Management</h3>
                      <p className="text-[10px] text-zinc-400">Polling stations & agents</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{boothsList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Polling Booths</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Booth level karyakarta mapping & coverage
                  </p>
                </div>
              </div>

              <Link
                to="/admin/booths"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-amber-600 dark:text-amber-400 group-hover:text-amber-700 dark:group-hover:text-amber-300"
              >
                <span>Manage Polling Booths</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 5. Benefits Module */}
          {canAccess('benefits') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
                      <Gift size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Benefits</h3>
                      <p className="text-[10px] text-zinc-400">Welfare & aid schemes</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-pink-600 dark:text-pink-400">₹{totalBenefitsDisbursed.toLocaleString('en-IN')}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">{benefitsList.length} Beneficiaries</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Direct government & party assistance tracking
                  </p>
                </div>
              </div>

              <Link
                to="/admin/benefits"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-pink-600 dark:text-pink-400 group-hover:text-pink-700 dark:group-hover:text-pink-300"
              >
                <span>Track Benefits</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 6. Finance Tracker Module */}
          {canAccess('finance') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-600 dark:text-cyan-400">
                      <Wallet size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Finance Tracker</h3>
                      <p className="text-[10px] text-zinc-400">Campaign budget & expenses</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400">₹{totalBudgetDisbursed.toLocaleString('en-IN')}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Allocated Budget</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Expense ledger & budget monitoring
                  </p>
                </div>
              </div>

              <Link
                to="/admin/finance"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-cyan-600 dark:text-cyan-400 group-hover:text-cyan-700 dark:group-hover:text-cyan-300"
              >
                <span>Open Finance Tracker</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 7. WhatsApp WB Sender Module */}
          {canAccess('whatsapp') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-600 dark:text-green-400">
                      <MessageSquare size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">WB Sender</h3>
                      <p className="text-[10px] text-zinc-400">WhatsApp broadcasts</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-green-600 dark:text-green-400">{whatsappBroadcasts.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Broadcasts</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Delivered messages:</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{totalBroadcastsSent}</strong>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/whatsapp"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-green-600 dark:text-green-400 group-hover:text-green-700 dark:group-hover:text-green-300"
              >
                <span>Launch WB Sender</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 8. Survey Module */}
          {canAccess('surveys') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                      <BarChart3 size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Survey</h3>
                      <p className="text-[10px] text-zinc-400">Feedback & sentiment</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-purple-600 dark:text-purple-400">{assignedSurveys.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">
                      {isAdmin ? 'Total Campaigns' : 'Assigned Campaigns'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Logged by you: <strong className="text-zinc-800 dark:text-zinc-200">{userSentimentsCount}</strong></span>
                    <span>Assigned responses: <strong className="text-zinc-800 dark:text-zinc-200">{relevantSentiments.length}</strong></span>
                  </div>
                </div>
              </div>

              <Link
                to="/surveys"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-purple-600 dark:text-purple-400 group-hover:text-purple-700 dark:group-hover:text-purple-300"
              >
                <span>Record Survey Feedback</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 9. Analytics Module */}
          {canAccess('predictions') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <TrendingUp size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Analytics</h3>
                      <p className="text-[10px] text-zinc-400">Electoral forecasting</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black text-indigo-600 dark:text-indigo-400">Interactive Models</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Turnout projections, voter sentiment, and seat modeling
                  </p>
                </div>
              </div>

              <Link
                to="/admin/analytics"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300"
              >
                <span>View Analytics</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 10. User Management Module (Admin) */}
          {canAccess('users') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
                      <UserCog size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">User Management</h3>
                      <p className="text-[10px] text-zinc-400">Roles & permissions</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{usersList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">System Users</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Granular module rights & karyakarta access
                  </p>
                </div>
              </div>

              <Link
                to="/admin/users"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-rose-600 dark:text-rose-400 group-hover:text-rose-700 dark:group-hover:text-rose-300"
              >
                <span>Manage Users & Roles</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 11. Survey Management Module (Admin) */}
          {canAccess('survey_campaigns') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                      <ClipboardList size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Survey Management</h3>
                      <p className="text-[10px] text-zinc-400">Design & roster assignment</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-violet-600 dark:text-violet-400">{allSurveysCount}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Configured Campaigns</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Campaign setup & karyakarta assignment control
                  </p>
                </div>
              </div>

              <Link
                to="/admin/surveys"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-violet-600 dark:text-violet-400 group-hover:text-violet-700 dark:group-hover:text-violet-300"
              >
                <span>Manage Surveys</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 12. Election Setting Module (Admin) */}
          {canAccess('demographics') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-600 dark:text-orange-400">
                      <Flag size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Election Setting</h3>
                      <p className="text-[10px] text-zinc-400">State & district hierarchy</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-orange-600 dark:text-orange-400">{boothsList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Registered Booths</span>
                  </div>
                  <p className="text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    Administrative boundaries & territory configuration
                  </p>
                </div>
              </div>

              <Link
                to="/admin/demographics"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-orange-600 dark:text-orange-400 group-hover:text-orange-700 dark:group-hover:text-orange-300"
              >
                <span>Configure Demographics</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

          {/* 13. Election Setup Module (Admin) */}
          {canAccess('elections') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-600 dark:text-yellow-400">
                      <Database size={17} />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Election Setup</h3>
                      <p className="text-[10px] text-zinc-400">Elections & political parties</p>
                    </div>
                  </div>
                </div>

                <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded-xl space-y-2">
                  <div className="flex items-baseline justify-between">
                    <span className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{electionsList.length}</span>
                    <span className="text-[11px] font-semibold text-zinc-500">Election Cycles</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-200/60 dark:border-zinc-800">
                    <span>Registered parties:</span>
                    <strong className="text-zinc-800 dark:text-zinc-200">{partiesList.length}</strong>
                  </div>
                </div>
              </div>

              <Link
                to="/admin/elections"
                className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-xs font-bold text-yellow-600 dark:text-yellow-400 group-hover:text-yellow-700 dark:group-hover:text-yellow-300"
              >
                <span>Open Election Setup</span>
                <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </motion.div>
          )}

        </div>
      )}
    </div>
  );
}
