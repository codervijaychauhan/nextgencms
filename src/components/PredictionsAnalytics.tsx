import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Users, 
  CheckCircle, 
  Loader2,
  Calendar,
  MapPin,
  Flame,
  UserCheck,
  RefreshCw,
  Download,
  Printer,
  Search,
  ChevronDown,
  ShieldAlert,
  Vote,
  BarChart3,
  SlidersHorizontal,
  Eye,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  FileText,
  Phone,
  Mail,
  Building,
  Star,
  Sparkles,
  Info,
  Check,
  Trash2,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { useTableColumns, ColumnDef } from '../hooks/useTableColumns';
import { TableColumnManager } from './common/TableColumnManager';

type AnalyticsBoothColumnKey = 
  | 'boothName'
  | 'boothId'
  | 'totalSample'
  | 'support'
  | 'neutral'
  | 'oppose'
  | 'favorableProjection'
  | 'margin';

const DEFAULT_ANALYTICS_BOOTH_COLUMNS: ColumnDef<AnalyticsBoothColumnKey>[] = [
  { id: 'boothName', label: 'Booth / Station Name', category: 'Location', required: true, defaultVisible: true, minWidth: '180px' },
  { id: 'boothId', label: 'Booth ID / Code', category: 'Location', defaultVisible: false, minWidth: '100px' },
  { id: 'totalSample', label: 'Total Sample', category: 'Sample', defaultVisible: true, minWidth: '90px' },
  { id: 'support', label: 'Support Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'neutral', label: 'Neutral Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'oppose', label: 'Oppose Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'favorableProjection', label: 'Favorable Projection', category: 'Analytics', defaultVisible: true, minWidth: '130px' },
  { id: 'margin', label: 'Net Lead / Deficit', category: 'Analytics', defaultVisible: false, minWidth: '120px' },
];

type VoterSentimentColumnKey = 
  | 'voter'
  | 'epic'
  | 'guardianName'
  | 'sentiment'
  | 'favoredParty'
  | 'location'
  | 'constituency'
  | 'village'
  | 'houseNo'
  | 'contact'
  | 'email'
  | 'demographics'
  | 'caste'
  | 'concerns'
  | 'survey'
  | 'electionYear'
  | 'recordedBy'
  | 'recordedById'
  | 'admin'
  | 'date'
  | 'actions';

const DEFAULT_VOTER_SENTIMENT_COLUMNS: ColumnDef<VoterSentimentColumnKey>[] = [
  { id: 'voter', label: 'Voter Name', category: 'Voter Info', required: true, defaultVisible: true, minWidth: '180px' },
  { id: 'epic', label: 'EPIC / Voter ID', category: 'Voter Info', defaultVisible: true, minWidth: '130px' },
  { id: 'guardianName', label: 'Father / Guardian Name', category: 'Voter Info', defaultVisible: false, minWidth: '140px' },
  { id: 'sentiment', label: 'Sentiment & Score Meter', category: 'Sentiment', defaultVisible: true, minWidth: '160px' },
  { id: 'favoredParty', label: 'Favored Party', category: 'Sentiment', defaultVisible: true, minWidth: '140px' },
  { id: 'location', label: 'Polling Booth / Station', category: 'Location', defaultVisible: true, minWidth: '170px' },
  { id: 'constituency', label: 'Constituency', category: 'Location', defaultVisible: false, minWidth: '140px' },
  { id: 'village', label: 'Village / Ward', category: 'Location', defaultVisible: false, minWidth: '130px' },
  { id: 'houseNo', label: 'House Number', category: 'Location', defaultVisible: false, minWidth: '100px' },
  { id: 'contact', label: 'Mobile Number', category: 'Contact', defaultVisible: true, minWidth: '130px' },
  { id: 'email', label: 'Email Address', category: 'Contact', defaultVisible: false, minWidth: '140px' },
  { id: 'demographics', label: 'Age & Gender', category: 'Demographics', defaultVisible: true, minWidth: '120px' },
  { id: 'caste', label: 'Caste / Social Category', category: 'Demographics', defaultVisible: false, minWidth: '130px' },
  { id: 'concerns', label: 'Key Grievances / Issues', category: 'Sentiment', defaultVisible: true, minWidth: '180px' },
  { id: 'survey', label: 'Campaign Survey Title', category: 'Audit & Source', defaultVisible: false, minWidth: '140px' },
  { id: 'electionYear', label: 'Election Cycle', category: 'Audit & Source', defaultVisible: false, minWidth: '110px' },
  { id: 'recordedBy', label: 'Recorded By (Name)', category: 'Audit & Source', defaultVisible: true, minWidth: '140px' },
  { id: 'recordedById', label: 'Recorded By (User ID)', category: 'Audit & Source', defaultVisible: false, minWidth: '130px' },
  { id: 'admin', label: 'Admin (Workspace)', category: 'Audit & Source', defaultVisible: false, minWidth: '140px' },
  { id: 'date', label: 'Response Date', category: 'Audit & Source', defaultVisible: true, minWidth: '110px' },
  { id: 'actions', label: 'Actions', category: 'Actions', required: true, defaultVisible: true, minWidth: '110px' },
];

interface SentimentRecord {
  id: string;
  adminId?: string;
  adminName?: string;
  voterDocId: string;
  voterEpic?: string;
  voterName: string;
  gender: string;
  age: number;
  caste?: string;
  guardianName?: string;
  village?: string;
  houseNo?: string;
  electionId?: string;
  electionYear?: string;
  favoredPartyId?: string;
  favoredPartyName?: string;
  partyColor?: string;
  partySymbol?: string;
  sentimentScore: number;
  sentiment: 'Support' | 'Neutral' | 'Oppose' | 'Other Party';
  keyConcerns?: string[];
  constituencyId?: string;
  constituencyName?: string;
  stateId?: string;
  districtId?: string;
  boothId?: string;
  boothName?: string;
  mobile?: string;
  email?: string;
  aadharNumber?: string;
  surveyId?: string;
  surveyTitle?: string;
  customAnswers?: Record<string, any>;
  recordedBy?: string;
  recordedByName?: string;
  createdAt?: string;
}

interface DemographicLookup {
  id: string;
  name: string;
  code?: string;
}

interface PartyRecord {
  id: string;
  name: string;
  code?: string;
  symbol?: string;
  color?: string;
}

interface VolunteerRecord {
  id: string;
  name: string;
  role?: string;
  boothId?: string;
  status?: string;
}

interface AdminUser {
  uid: string;
  id?: string;
  username: string;
  name?: string;
  email: string;
  role: string;
}

export const PredictionsAnalytics: React.FC = () => {
  const { user, isSuperAdmin, profile } = useAuth();

  const isEffectiveSuperAdmin = isSuperAdmin || 
    (user?.email || profile?.email || '').toLowerCase().trim() === 'vijaychauhanofficial01@gmail.com' ||
    ['super_admin', 'superadmin'].includes((profile?.role || (user as any)?.role || '').toLowerCase());

  const hasRight = (moduleId: string, right: string) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin) return true;
    const userRole = (profile?.role || (user as any)?.role || '').toLowerCase();
    if (['super_admin', 'admin', 'superadmin'].includes(userRole)) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.permissions?.['analytics'] || profile?.rights?.[moduleId] || profile?.rights?.['analytics'] || '';
    if (perms === true || perms === 1 || perms === '*') return true;
    return typeof perms === 'string' && (perms.includes(right) || perms.includes('v') || perms.includes('r') || perms.includes('d'));
  };

  const normalizeId = (val: any) => String(val ?? '').toLowerCase().trim();

  const currentUserId = String(user?.id || (user as any)?.uid || profile?.id || profile?.uid || '');
  const currentUserEmail = (user?.email || profile?.email || '').toLowerCase().trim();
  const currentUserName = (profile?.name || profile?.username || user?.displayName || '').toLowerCase().trim();
  const myAdminIds = useMemo(() => [
    normalizeId(currentUserId),
    normalizeId(currentUserEmail),
    normalizeId(currentUserName),
    normalizeId(profile?.parentAdminId),
    normalizeId(profile?.parentAdminName)
  ].filter(Boolean), [currentUserId, currentUserEmail, currentUserName, profile]);

  const electSettings = profile?.election_settings || profile?.electionSettings || {};
  const rawBooth = profile?.boothId || profile?.booth_id || electSettings.booth_id || electSettings.boothId || '';
  const rawAssignedBooths = profile?.assigned_booths || electSettings.assigned_booths || [];

  const allowedBoothIds = useMemo(() => {
    if (isEffectiveSuperAdmin) return [];
    if (rawBooth) {
      return String(rawBooth).split(',').map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]');
    }
    if (Array.isArray(rawAssignedBooths) && rawAssignedBooths.length > 0) {
      return rawAssignedBooths.map(normalizeId).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]');
    }
    return [];
  }, [isEffectiveSuperAdmin, rawBooth, rawAssignedBooths]);

  // Tab State
  const [activeTab, setActiveTab] = useState<'overview' | 'responses'>('overview');

  // Loading & Sync States
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Raw Database Collections
  const [sentiments, setSentiments] = useState<SentimentRecord[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [booths, setBooths] = useState<DemographicLookup[]>([]);
  const [constituencies, setConstituencies] = useState<DemographicLookup[]>([]);
  const [parties, setParties] = useState<PartyRecord[]>([]);
  const [volunteers, setVolunteers] = useState<VolunteerRecord[]>([]);
  const [surveys, setSurveys] = useState<{ id: string; title: string }[]>([]);

  // Global Filter & Selection States
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState<string>('all');
  const [selectedBoothFilter, setSelectedBoothFilter] = useState<string>('all');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>('all');
  const [targetWinningThreshold, setTargetWinningThreshold] = useState<number>(50);
  const [swingConversionRate, setSwingConversionRate] = useState<number>(25);
  const [boothSearchTerm, setBoothSearchTerm] = useState<string>('');

  // Voter Responses Tab Specific States
  const [voterSearchTerm, setVoterSearchTerm] = useState<string>('');
  const [voterSentimentFilter, setVoterSentimentFilter] = useState<string>('all');
  const [voterScoreFilter, setVoterScoreFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [detailVoterRecord, setDetailVoterRecord] = useState<SentimentRecord | null>(null);

  // Deletion States
  const [sentimentToDelete, setSentimentToDelete] = useState<SentimentRecord | null>(null);
  const [deletingSentiment, setDeletingSentiment] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [successToast, setSuccessToast] = useState('');

  // Table Column Managers with LocalStorage Persistence
  const boothColumnManager = useTableColumns('analytics_booths_table_v2', DEFAULT_ANALYTICS_BOOTH_COLUMNS);
  const voterSentimentColumnManager = useTableColumns('analytics_voter_sentiments_table_v2', DEFAULT_VOTER_SENTIMENT_COLUMNS);

  // Load all foundational collections
  const fetchAnalyticsData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Users & Build All-Users Map & Valid Admins (Identical to AdminSentimentComparison)
      const usersRes = await api.get<any[]>('/api/users').catch(() => []);
      
      const allUsersMap = new Map<string, any>();
      (usersRes || []).forEach(u => {
        const uid = String(u.id || u.uid);
        allUsersMap.set(uid, u);
        if (u.email) allUsersMap.set(u.email.toLowerCase().trim(), u);
        if (u.username) allUsersMap.set(u.username.toLowerCase().trim(), u);
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
          const name = u.name || u.username || u.email?.split('@')[0] || 'Administrator';
          const uid = String(u.id || u.uid);
          return {
            uid,
            id: uid,
            username: name,
            name,
            email: u.email || '',
            role: isSuper ? 'super_admin' : 'admin'
          };
        });
      setAdmins(validAdmins);

      // Helper to resolve parent admin ID for any assessment (same resolution as AdminSentimentComparison)
      const resolveToAdminId = (rawAdminId: string, recordedBy?: string): string => {
        if (validAdmins.some(a => a.uid === rawAdminId || a.id === rawAdminId)) return rawAdminId;

        const userObj = allUsersMap.get(rawAdminId) || allUsersMap.get(recordedBy || '');
        if (userObj) {
          if (userObj.role === 'admin' || userObj.role === 'super_admin') {
            return String(userObj.id || userObj.uid);
          }
          if (userObj.parent_admin_id) {
            const parent = validAdmins.find(a => a.uid === String(userObj.parent_admin_id) || a.id === String(userObj.parent_admin_id));
            if (parent) return parent.uid;
            return String(userObj.parent_admin_id);
          }
        }
        return rawAdminId || (validAdmins[0]?.uid || 'admin');
      };

      // 2. Fetch Booths
      const boothsRes = await api.get<any[]>('/api/booths').catch(() => []);
      let mappedBooths = (boothsRes || []).map(b => ({ 
        id: String(b.id), 
        name: b.name || `Booth #${b.booth_number || b.id}` 
      }));

      if (!isEffectiveSuperAdmin && allowedBoothIds.length > 0) {
        mappedBooths = mappedBooths.filter(b => allowedBoothIds.includes(normalizeId(b.id)));
      }
      setBooths(mappedBooths);

      // 3. Fetch Constituencies
      const constRes = await api.get<any[]>('/api/constituencies').catch(() => []);
      setConstituencies((constRes || []).map(c => ({ 
        id: String(c.id), 
        name: c.name || 'Constituency' 
      })));

      // 4. Fetch Political Parties
      const partiesRes = await api.get<any[]>('/api/parties').catch(() => []);
      setParties((partiesRes || []).map(p => ({
        id: String(p.id),
        name: p.name || 'Independent',
        code: p.code || p.abbreviation || '',
        symbol: p.symbol || '',
        color: p.color || '#3b82f6'
      })));

      // 5. Fetch Volunteers / Karyakartas
      const volsRes = await api.get<any[]>('/api/volunteers').catch(() => []);
      let mappedVols = (volsRes || []).map(v => ({
        id: String(v.id),
        name: v.name || 'Karyakarta',
        role: v.role || 'Booth Volunteer',
        boothId: String(v.booth_id || v.boothId || ''),
        status: v.status || 'Active'
      }));
      if (!isEffectiveSuperAdmin && allowedBoothIds.length > 0) {
        mappedVols = mappedVols.filter(v => allowedBoothIds.includes(normalizeId(v.boothId)));
      }
      setVolunteers(mappedVols);

      // 6. Fetch Surveys
      const surveysRes = await api.get<any[]>('/api/surveys').catch(() => []);
      setSurveys((surveysRes || []).map(s => ({
        id: String(s.id),
        title: s.title || `Survey #${s.id}`
      })));

      // 7. Fetch Enriched Sentiments and Voter Assessments (Matching Admin Sentiment Comparison)
      const [sentimentsRes, assessmentsRes] = await Promise.all([
        api.get<any[]>('/api/voter-sentiments').catch(() => []),
        api.get<any[]>('/api/voter-assessments').catch(() => [])
      ]);

      const mergedSentimentsMap = new Map<string, SentimentRecord>();

      // A. Populate from voter-assessments (Admin-recorded Political Sentiment Profile)
      (assessmentsRes || []).forEach((a: any) => {
        const rawAdmin = String(a.admin_id || a.adminId || '');
        const rawRecorded = String(a.recorded_by || a.recordedBy || '');
        const adminId = resolveToAdminId(rawAdmin, rawRecorded);
        const adminObj = validAdmins.find(ad => ad.uid === adminId || ad.id === adminId);
        const adminName = adminObj?.username || adminObj?.name || a.admin_name || 'Administrator';

        const recordedById = rawRecorded || adminId;
        const recordedUserObj = allUsersMap.get(recordedById);
        const recordedByName = a.recorded_by_name || a.recordedByName || a.recorded_by_display_name || recordedUserObj?.name || recordedUserObj?.username || adminName;

        const score = Number(a.sentiment_score || a.sentimentScore || 3);
        const sentimentVal = (a.sentiment || (score >= 4 ? 'Support' : score <= 2 ? 'Oppose' : 'Neutral')) as any;

        const id = String(a.id || `va_${adminId}_${a.voter_id}`);

        mergedSentimentsMap.set(id, {
          id,
          adminId,
          adminName,
          voterDocId: String(a.voter_id || a.voterId || ''),
          voterEpic: a.voter_epic || a.voter_epic_id || a.voterEpic || (a.voter_id && !a.voter_id.includes('-') && a.voter_id.length < 20 ? a.voter_id : ''),
          voterName: a.voter_full_name || a.voter_name || a.voterName || 'Voter',
          gender: a.voter_gender || a.gender || 'Male',
          age: Number(a.voter_age || a.age || 35),
          caste: a.caste || a.voter_caste || '',
          guardianName: a.voter_guardian_name || a.guardian_name || a.relation_name || '',
          village: a.voter_village || a.village || '',
          houseNo: a.voter_house_no || a.house_no || '',
          favoredPartyId: String(a.favored_party_id || a.favoredPartyId || ''),
          favoredPartyName: a.favored_party_name || a.favoredPartyName || '',
          partyColor: a.party_color || a.partyColor || '#3b82f6',
          partySymbol: a.party_symbol || a.partySymbol || '🗳️',
          sentimentScore: score,
          sentiment: sentimentVal,
          keyConcerns: Array.isArray(a.key_concerns) ? a.key_concerns : typeof a.key_concerns === 'string' ? JSON.parse(a.key_concerns || '[]') : (a.keyConcerns || []),
          constituencyId: normalizeId(a.voter_constituency_id || a.constituency_id || a.constituencyId),
          constituencyName: a.constituency_name || a.constituencyName || constituencies.find(c => normalizeId(c.id) === normalizeId(a.voter_constituency_id || a.constituency_id || a.constituencyId))?.name || '',
          boothId: normalizeId(a.voter_booth_id || a.booth_id || a.boothId),
          boothName: a.booth_name || a.boothName || mappedBooths.find(b => normalizeId(b.id) === normalizeId(a.voter_booth_id || a.booth_id || a.boothId))?.name || '',
          mobile: a.voter_mobile || a.mobile || '',
          email: a.voter_email || a.email || '',
          recordedBy: recordedById,
          recordedByName: recordedByName,
          createdAt: a.updated_at || a.created_at || a.createdAt
        });
      });

      // B. Populate from voter-sentiments
      (sentimentsRes || []).forEach((s: any) => {
        const rawAdmin = String(s.admin_id || s.adminId || s.recorded_by || s.recordedBy || '');
        const rawRecorded = String(s.recorded_by || s.recordedBy || '');
        const adminId = resolveToAdminId(rawAdmin, rawRecorded);
        const adminObj = validAdmins.find(ad => ad.uid === adminId || ad.id === adminId);
        const adminName = adminObj?.username || adminObj?.name || s.recordedByName || s.recorded_by_name || 'Administrator';

        const recordedById = rawRecorded || adminId;
        const recordedUserObj = allUsersMap.get(recordedById);
        const recordedByName = s.recordedByName || s.recorded_by_name || recordedUserObj?.name || recordedUserObj?.username || adminName;

        const id = String(s.id || `vs_${s.voter_id}_${s.survey_id || s.recorded_by || 'sent'}`);
        if (!mergedSentimentsMap.has(id)) {
          const score = Number(s.sentimentScore || s.sentiment_score || 3);
          const sentimentVal = (s.sentiment || (score >= 4 ? 'Support' : score <= 2 ? 'Oppose' : 'Neutral')) as any;

          mergedSentimentsMap.set(id, {
            id,
            adminId,
            adminName,
            voterDocId: String(s.voterDocId || s.voter_id || s.voterId || ''),
            voterEpic: s.voter_epic || s.voter_epic_id || s.voterEpic || (s.voter_id && !s.voter_id.includes('-') && s.voter_id.length < 20 ? s.voter_id : ''),
            voterName: s.voterName || s.voter_name || 'Voter',
            gender: s.gender || s.voter_gender || 'Male',
            age: Number(s.age || s.voter_age || 35),
            caste: s.caste || s.voter_caste || '',
            guardianName: s.voter_guardian_name || s.guardian_name || s.relation_name || '',
            village: s.voter_village || s.village || '',
            houseNo: s.voter_house_no || s.house_no || '',
            electionYear: s.electionYear || s.election_year || '',
            favoredPartyId: String(s.favoredPartyId || s.favored_party_id || ''),
            favoredPartyName: s.favoredPartyName || s.favored_party_name || s.party_name || '',
            partyColor: s.partyColor || s.party_color || '#3b82f6',
            partySymbol: s.partySymbol || s.party_symbol || '🗳️',
            sentimentScore: score,
            sentiment: sentimentVal,
            keyConcerns: Array.isArray(s.keyConcerns) ? s.keyConcerns : Array.isArray(s.key_concerns) ? s.key_concerns : typeof s.key_concerns === 'string' ? JSON.parse(s.key_concerns || '[]') : [],
            constituencyId: normalizeId(s.constituencyId || s.constituency_id || s.effective_constituency_id),
            constituencyName: s.constituencyName || s.constituency_name || constituencies.find(c => normalizeId(c.id) === normalizeId(s.constituencyId || s.constituency_id || s.effective_constituency_id))?.name || '',
            boothId: normalizeId(s.boothId || s.booth_id || s.effective_booth_id),
            boothName: s.boothName || s.booth_name || mappedBooths.find(b => normalizeId(b.id) === normalizeId(s.boothId || s.booth_id || s.effective_booth_id))?.name || '',
            mobile: s.voter_mobile || s.mobile || '',
            email: s.voter_email || s.email || '',
            surveyId: s.surveyId || s.survey_id || '',
            surveyTitle: s.surveyTitle || s.survey_title || '',
            customAnswers: s.customAnswers || s.custom_answers || {},
            recordedBy: recordedById,
            recordedByName: recordedByName,
            createdAt: s.createdAt || s.created_at || s.updated_at
          });
        }
      });

      let allSentiments = Array.from(mergedSentimentsMap.values());

      // If non-super admin, strictly scope only to sentiment assessments recorded by or linked to THIS admin user
      if (!isEffectiveSuperAdmin) {
        allSentiments = allSentiments.filter(s => {
          const sAdminId = normalizeId(s.adminId);
          const sRecordedBy = normalizeId(s.recordedBy);
          const sRecordedByName = normalizeId(s.recordedByName);
          const sBooth = normalizeId(s.boothId);

          // Direct match with this admin's credentials/team
          const isOwnAdminRecord = myAdminIds.some(id => id && (sAdminId === id || sRecordedBy === id || sRecordedByName === id));
          if (isOwnAdminRecord) return true;

          // If within assigned booths and not recorded by another distinct admin
          if (allowedBoothIds.length > 0 && allowedBoothIds.includes(sBooth)) {
            if (!sRecordedBy || isOwnAdminRecord) return true;
          }

          return false;
        });
      }

      setSentiments(allSentiments);

    } catch (err) {
      console.error('Error fetching analytics dataset:', err);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (user && hasRight('predictions', 'v')) {
      fetchAnalyticsData(true);
    } else {
      setLoading(false);
    }
  }, [user, profile]);

  // Reset pagination when filter criteria change
  useEffect(() => {
    setCurrentPage(1);
  }, [voterSearchTerm, voterSentimentFilter, voterScoreFilter, selectedAdminId, selectedConstituencyFilter, selectedBoothFilter, selectedPartyFilter]);

  // Compute stats according to filters
  const computedAnalytics = useMemo(() => {
    let filtered = sentiments;

    // Filter by Admin (Super Admin view only)
    if (isEffectiveSuperAdmin && selectedAdminId !== 'all') {
      filtered = filtered.filter(s => 
        String(s.recordedBy || '').toLowerCase() === selectedAdminId.toLowerCase() ||
        String(s.recordedByName || '').toLowerCase() === selectedAdminId.toLowerCase() ||
        String((s as any).adminId || '').toLowerCase() === selectedAdminId.toLowerCase()
      );
    }

    // Filter by Constituency
    if (selectedConstituencyFilter !== 'all') {
      filtered = filtered.filter(s => String(s.constituencyId) === selectedConstituencyFilter);
    }

    // Filter by Booth
    if (selectedBoothFilter !== 'all') {
      filtered = filtered.filter(s => String(s.boothId) === selectedBoothFilter);
    }

    // Filter by Party Preference
    if (selectedPartyFilter !== 'all') {
      filtered = filtered.filter(s => 
        String(s.favoredPartyName || '').toLowerCase() === selectedPartyFilter.toLowerCase() ||
        String(s.favoredPartyId || '').toLowerCase() === selectedPartyFilter.toLowerCase()
      );
    }

    // Aggregations
    let supportCount = 0;
    let neutralCount = 0;
    let opposeCount = 0;
    let otherCount = 0;
    let totalScoreSum = 0;
    let scoredItemsCount = 0;

    const partyCounts: Record<string, { count: number; name: string; color: string; symbol: string }> = {};
    const concernsMap: Record<string, number> = {};

    filtered.forEach(item => {
      const score = item.sentimentScore || 3;
      totalScoreSum += score;
      scoredItemsCount++;

      if (score >= 4) supportCount++;
      else if (score <= 2) opposeCount++;
      else neutralCount++;

      if (item.sentiment === 'Other Party') {
        otherCount++;
      }

      // Party breakdown
      const pName = item.favoredPartyName || 'Undecided / Independent';
      const pColor = item.partyColor || '#64748b';
      const pSymbol = item.partySymbol || '🗳️';
      if (!partyCounts[pName]) {
        partyCounts[pName] = { count: 0, name: pName, color: pColor, symbol: pSymbol };
      }
      partyCounts[pName].count++;

      // Key concerns
      if (Array.isArray(item.keyConcerns)) {
        item.keyConcerns.forEach(c => {
          if (c && typeof c === 'string') {
            concernsMap[c] = (concernsMap[c] || 0) + 1;
          }
        });
      }
    });

    const totalMonitored = filtered.length;
    const averageStrength = scoredItemsCount > 0 ? (totalScoreSum / scoredItemsCount) : 0;

    const supportPercentage = totalMonitored > 0 ? (supportCount / totalMonitored) * 100 : 0;
    const neutralPercentage = totalMonitored > 0 ? (neutralCount / totalMonitored) * 100 : 0;
    const opposePercentage = totalMonitored > 0 ? (opposeCount / totalMonitored) * 100 : 0;
    const otherPercentage = totalMonitored > 0 ? (otherCount / totalMonitored) * 100 : 0;

    // Projected Swing Conversion
    const convertedSupportPercentage = supportPercentage + (neutralPercentage * (swingConversionRate / 100));

    // Projection Status
    let projectionStatus = 'Toss-Up';
    let recommendation = 'Mobilize local karyakartas to engage undecided and swing voters.';
    if (supportPercentage >= 58) {
      projectionStatus = 'Strong Hold';
      recommendation = 'Maintain ground connect and finalize Booth Day transport mobilization schedules.';
    } else if (supportPercentage >= 48) {
      projectionStatus = 'Leaning Favorite';
      recommendation = 'Focus on turning neutral households into committed supporters to build a decisive lead.';
    } else if (supportPercentage > 0 && supportPercentage < 40) {
      projectionStatus = 'Deficit Danger';
      recommendation = 'Urgent: Deploy senior karyakarta teams to address key citizen grievances.';
    }

    // Demographics Breakdown amongst Supporters
    let maleSupporters = 0;
    let femaleSupporters = 0;
    let otherGenderSupporters = 0;

    let youthSupporters = 0; // 18-35
    let midAgeSupporters = 0; // 36-60
    let seniorSupporters = 0; // 60+

    filtered.filter(s => s.sentimentScore >= 4).forEach(s => {
      const g = (s.gender || 'Male').toLowerCase();
      if (g.includes('fem') || g === 'f') femaleSupporters++;
      else if (g.includes('mal') || g === 'm') maleSupporters++;
      else otherGenderSupporters++;

      const age = s.age || 35;
      if (age <= 35) youthSupporters++;
      else if (age <= 60) midAgeSupporters++;
      else seniorSupporters++;
    });

    // Booth-wise Breakdown (Include all booths in current scope)
    const boothMap: Record<string, { total: number; support: number; neutral: number; oppose: number; boothName: string }> = {};
    booths.forEach(b => {
      if (selectedBoothFilter === 'all' || selectedBoothFilter === b.id) {
        boothMap[b.id] = { total: 0, support: 0, neutral: 0, oppose: 0, boothName: b.name };
      }
    });

    filtered.forEach(item => {
      let bId = item.boothId;
      if (!bId || bId === 'unassigned') {
        const matchedByName = booths.find(b => b.name && item.boothName && b.name.toLowerCase() === item.boothName.toLowerCase());
        if (matchedByName) bId = matchedByName.id;
      }
      bId = bId || 'unassigned';
      const matchedBooth = booths.find(b => b.id === bId || normalizeId(b.id) === normalizeId(bId));
      const bName = item.boothName || matchedBooth?.name || (bId === 'unassigned' ? 'Unassigned / General' : `Booth #${bId}`);
      if (!boothMap[bId]) {
        boothMap[bId] = { total: 0, support: 0, neutral: 0, oppose: 0, boothName: bName };
      }
      boothMap[bId].total++;
      if (item.sentimentScore >= 4) boothMap[bId].support++;
      else if (item.sentimentScore <= 2) boothMap[bId].oppose++;
      else boothMap[bId].neutral++;
    });

    const boothStatsList = Object.entries(boothMap).map(([bId, counters]) => ({
      boothId: bId,
      boothName: counters.boothName,
      total: counters.total,
      support: counters.support,
      neutral: counters.neutral,
      oppose: counters.oppose,
      supportRate: counters.total > 0 ? (counters.support / counters.total) * 100 : 0,
      margin: counters.support - counters.oppose
    })).sort((a, b) => b.supportRate - a.supportRate);

    // Karyakartas deployed in selected scope
    let activeKaryakartasCount = volunteers.length;
    if (selectedBoothFilter !== 'all') {
      activeKaryakartasCount = volunteers.filter(v => v.boothId === selectedBoothFilter).length;
    }

    // Top concerns list
    const topConcerns = Object.entries(concernsMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    return {
      filteredSentiments: filtered,
      totalMonitored,
      supportCount,
      neutralCount,
      opposeCount,
      otherCount,
      supportPercentage,
      neutralPercentage,
      opposePercentage,
      otherPercentage,
      convertedSupportPercentage,
      projectionStatus,
      recommendation,
      averageStrength,
      activeKaryakartasCount,
      partyShare: Object.values(partyCounts).sort((a, b) => b.count - a.count),
      topConcerns,
      genderBreakdown: {
        male: maleSupporters,
        female: femaleSupporters,
        other: otherGenderSupporters
      },
      ageBreakdown: {
        youth: youthSupporters,
        middle: midAgeSupporters,
        senior: seniorSupporters
      },
      boothStats: boothStatsList
    };

  }, [sentiments, selectedAdminId, selectedConstituencyFilter, selectedBoothFilter, selectedPartyFilter, swingConversionRate, booths, volunteers, isEffectiveSuperAdmin]);

  // Check if user has delete rights on a sentiment response
  const canDeleteSentiment = (s: SentimentRecord) => {
    if (isEffectiveSuperAdmin) return true;
    const userRole = (profile?.role || (user as any)?.role || '').toLowerCase();
    if (['super_admin', 'superadmin', 'admin', 'manager'].includes(userRole)) return true;
    if (hasRight('predictions', 'd') || hasRight('surveys', 'd') || hasRight('analytics', 'd')) return true;
    const recBy = normalizeId(s.recordedBy);
    const recByName = normalizeId(s.recordedByName);
    return myAdminIds.some(id => id && (recBy === id || recByName === id));
  };

  // Handle Deleting a Sentiment Response
  const handleDeleteSentiment = async () => {
    if (!sentimentToDelete) return;
    setDeletingSentiment(true);
    setDeleteError('');
    try {
      const targetId = sentimentToDelete.id;
      
      // Perform deletion via API
      await api.delete(`/api/voter-sentiments/${targetId}`).catch(async () => {
        const strippedId = targetId.replace(/^(vs_|va_)/, '');
        if (strippedId && strippedId !== targetId) {
          await api.delete(`/api/voter-sentiments/${strippedId}`).catch(() => {});
        }
      });

      // Instantly remove from sentiments state so computed analytics live re-calculates all figures
      setSentiments(prev => prev.filter(s => s.id !== targetId && (s.voterDocId && sentimentToDelete.voterDocId ? s.voterDocId !== sentimentToDelete.voterDocId : true)));

      if (detailVoterRecord?.id === targetId) {
        setDetailVoterRecord(null);
      }

      setSentimentToDelete(null);
      setSuccessToast(`Sentiment response for "${sentimentToDelete.voterName}" deleted. Analytics stats recalculated.`);
      setTimeout(() => setSuccessToast(''), 4000);
    } catch (err: any) {
      console.error('Error deleting sentiment response:', err);
      setDeleteError(err?.message || 'Failed to delete sentiment response. Please check permissions.');
    } finally {
      setDeletingSentiment(false);
    }
  };

  // Voter Responses Filtered for the Table View
  const filteredVoterResponses = useMemo(() => {
    let list = computedAnalytics.filteredSentiments;

    // Search query
    if (voterSearchTerm.trim()) {
      const q = voterSearchTerm.toLowerCase().trim();
      list = list.filter(item => 
        (item.voterName || '').toLowerCase().includes(q) ||
        (item.voterEpic || '').toLowerCase().includes(q) ||
        (item.mobile || '').toLowerCase().includes(q) ||
        (item.village || '').toLowerCase().includes(q) ||
        (item.houseNo || '').toLowerCase().includes(q) ||
        (item.boothName || '').toLowerCase().includes(q) ||
        (item.constituencyName || '').toLowerCase().includes(q) ||
        (item.guardianName || '').toLowerCase().includes(q) ||
        (item.favoredPartyName || '').toLowerCase().includes(q) ||
        (item.recordedByName || '').toLowerCase().includes(q) ||
        (item.keyConcerns || []).some(c => c.toLowerCase().includes(q))
      );
    }

    // Sentiment Filter
    if (voterSentimentFilter !== 'all') {
      list = list.filter(item => {
        if (voterSentimentFilter === 'Support') return item.sentimentScore >= 4;
        if (voterSentimentFilter === 'Neutral') return item.sentimentScore === 3;
        if (voterSentimentFilter === 'Oppose') return item.sentimentScore <= 2;
        if (voterSentimentFilter === 'Other Party') return item.sentiment === 'Other Party';
        return true;
      });
    }

    // Score Filter
    if (voterScoreFilter !== 'all') {
      const scoreNum = Number(voterScoreFilter);
      list = list.filter(item => item.sentimentScore === scoreNum);
    }

    return list;
  }, [computedAnalytics.filteredSentiments, voterSearchTerm, voterSentimentFilter, voterScoreFilter]);

  // Paginated Voter Responses
  const totalPages = Math.ceil(filteredVoterResponses.length / pageSize) || 1;
  const paginatedVoterResponses = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVoterResponses.slice(startIndex, startIndex + pageSize);
  }, [filteredVoterResponses, currentPage, pageSize]);

  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Voter Name,EPIC ID,Guardian Name,Mobile,Email,Age,Gender,Caste,Village,House No,Booth,Constituency,Favored Party,Sentiment Score,Sentiment Classification,Key Concerns,Survey Title,Election Cycle,Recorded By ID,Recorded By Name,Admin ID,Admin Name,Date"].join(",") + "\n"
      + filteredVoterResponses.map(s => [
          `"${(s.voterName || '').replace(/"/g, '""')}"`,
          `"${(s.voterEpic || '').replace(/"/g, '""')}"`,
          `"${(s.guardianName || '').replace(/"/g, '""')}"`,
          `"${(s.mobile || '').replace(/"/g, '""')}"`,
          `"${(s.email || '').replace(/"/g, '""')}"`,
          s.age || '',
          `"${(s.gender || '').replace(/"/g, '""')}"`,
          `"${(s.caste || '').replace(/"/g, '""')}"`,
          `"${(s.village || '').replace(/"/g, '""')}"`,
          `"${(s.houseNo || '').replace(/"/g, '""')}"`,
          `"${(s.boothName || s.boothId || '').replace(/"/g, '""')}"`,
          `"${(s.constituencyName || s.constituencyId || '').replace(/"/g, '""')}"`,
          `"${(s.favoredPartyName || '').replace(/"/g, '""')}"`,
          s.sentimentScore,
          `"${(s.sentiment || (s.sentimentScore >= 4 ? 'Support' : s.sentimentScore <= 2 ? 'Oppose' : 'Neutral')).replace(/"/g, '""')}"`,
          `"${(s.keyConcerns || []).join('; ').replace(/"/g, '""')}"`,
          `"${(s.surveyTitle || '').replace(/"/g, '""')}"`,
          `"${(s.electionYear || '').replace(/"/g, '""')}"`,
          `"${(s.recordedBy || '').replace(/"/g, '""')}"`,
          `"${(s.recordedByName || '').replace(/"/g, '""')}"`,
          `"${(s.adminId || '').replace(/"/g, '""')}"`,
          `"${(s.adminName || '').replace(/"/g, '""')}"`,
          s.createdAt ? s.createdAt.substring(0, 10) : ''
        ].join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Voter_Sentiment_Responses_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatSentimentDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!hasRight('predictions', 'v')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-zinc-500 p-8 text-center bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
        <ShieldAlert className="w-12 h-12 text-amber-500 mb-3" />
        <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Analytics Access Restricted</h3>
        <p className="text-xs text-zinc-500 max-w-md mt-1">
          You do not have view permissions for Ground Intelligence & Electoral Analytics. Please contact your campaign administrator.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 min-h-[70vh] gap-4">
        <Loader2 size={36} className="animate-spin text-zinc-900 dark:text-white" />
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Loading Ground Intelligence & Sentiment Analytics...</p>
      </div>
    );
  }

  const filteredBoothStats = computedAnalytics.boothStats.filter(b => 
    b.boothName.toLowerCase().includes(boothSearchTerm.toLowerCase()) || 
    b.boothId.toLowerCase().includes(boothSearchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 w-full animate-fade-in text-zinc-900 dark:text-zinc-100 relative">
      
      {/* Success Toast Notification */}
      {successToast && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl animate-in slide-in-from-top-3 fade-in duration-200 text-xs font-bold">
          <CheckCircle2 size={16} className="shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header with Navigation & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Analytics & Ground Intelligence
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Live Intel
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Voter political sentiment response stats, electoral forecasts, and respondent ground records.
          </p>
        </div>

        {/* Action Controls & Sync */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchAnalyticsData(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs text-zinc-700 dark:text-zinc-300"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
            {isRefreshing ? 'Syncing...' : 'Sync Data'}
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs text-zinc-700 dark:text-zinc-300"
          >
            <Download size={13} />
            Export CSV ({filteredVoterResponses.length})
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs"
          >
            <Printer size={13} />
            Print Report
          </button>
        </div>
      </div>

      {/* Global Scope & Filter Bar */}
      <div className={`grid grid-cols-1 ${isEffectiveSuperAdmin ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'} gap-3 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm`}>
        
        {/* Admin Context */}
        {isEffectiveSuperAdmin ? (
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
              Admin Workspace
            </label>
            <div className="relative">
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
              >
                <option value="all">🌐 All Admins (Consolidated)</option>
                {admins.map(adm => (
                  <option key={adm.uid} value={adm.uid}>👤 {adm.username} ({adm.role === 'super_admin' ? 'Super Admin' : 'Admin'})</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        ) : null}

        {/* Constituency Filter - Super Admin Only */}
        {isEffectiveSuperAdmin ? (
          <div>
            <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
              Assembly / Constituency
            </label>
            <div className="relative">
              <select
                value={selectedConstituencyFilter}
                onChange={(e) => setSelectedConstituencyFilter(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
              >
                <option value="all">🏛️ All Constituencies ({constituencies.length})</option>
                {constituencies.map(c => (
                  <option key={c.id} value={c.id}>🏛️ {c.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
            </div>
          </div>
        ) : null}

        {/* Booth Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
            Polling Station / Booth
          </label>
          <div className="relative">
            <select
              value={selectedBoothFilter}
              onChange={(e) => setSelectedBoothFilter(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
            >
              <option value="all">📍 All Booth Locations ({booths.length})</option>
              {booths.map(b => (
                <option key={b.id} value={b.id}>📍 {b.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>

        {/* Registered Political Party Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
            Registered Party Preference
          </label>
          <div className="relative">
            <select
              value={selectedPartyFilter}
              onChange={(e) => setSelectedPartyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
            >
              <option value="all">🗳️ All Political Parties ({parties.length})</option>
              {parties.map(p => (
                <option key={p.id} value={p.name || p.id}>
                  {p.symbol ? `${p.symbol} ` : '🗳️ '}{p.name} {p.code ? `(${p.code})` : ''}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
          </div>
        </div>

      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <div className="flex items-center gap-2 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'overview'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <BarChart3 size={15} className={activeTab === 'overview' ? 'text-blue-600 dark:text-blue-400' : ''} />
            <span>Analytics & Projections</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('responses')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              activeTab === 'responses'
                ? 'bg-white dark:bg-zinc-800 text-zinc-950 dark:text-white shadow-xs'
                : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Users size={15} className={activeTab === 'responses' ? 'text-indigo-600 dark:text-indigo-400' : ''} />
            <span>Voter Sentiment Responses</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'responses'
                ? 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
            }`}>
              {computedAnalytics.totalMonitored}
            </span>
          </button>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400">
          <span>Total Sample: <strong className="text-zinc-800 dark:text-zinc-200">{computedAnalytics.totalMonitored}</strong></span>
          <span>•</span>
          <span>Support Base: <strong className="text-emerald-600 dark:text-emerald-400">{computedAnalytics.supportPercentage.toFixed(1)}%</strong></span>
        </div>
      </div>

      {/* TAB 1: OVERVIEW & ANALYTICS PROJECTIONS */}
      {activeTab === 'overview' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Main Analytical Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* LEFT TWO COLUMNS: Metrics, Charts, Demographics & Booths */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* Key Metric Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                
                {/* Card 1: Sample Coverage */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Sample Coverage</span>
                    <Users size={16} className="text-zinc-400" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                      {computedAnalytics.totalMonitored}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Audited Citizens</p>
                  </div>
                </div>

                {/* Card 2: Projected Support Share */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider">Support Base</span>
                    <CheckCircle size={16} className="text-emerald-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                      {computedAnalytics.supportPercentage.toFixed(1)}%
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">
                      {computedAnalytics.supportCount} Supporters
                    </p>
                  </div>
                </div>

                {/* Card 3: Neutral / Swing Segment */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Neutral / Swing</span>
                    <Target size={16} className="text-amber-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black tracking-tight text-amber-500">
                      {computedAnalytics.neutralPercentage.toFixed(1)}%
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">
                      {computedAnalytics.neutralCount} Neutrals
                    </p>
                  </div>
                </div>

                {/* Card 4: Avg Sentiment Strength */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-blue-500 tracking-wider">Avg Strength</span>
                    <TrendingUp size={16} className="text-blue-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black tracking-tight text-blue-500">
                      {computedAnalytics.averageStrength > 0 ? computedAnalytics.averageStrength.toFixed(1) : '0.0'}/5
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Average Score</p>
                  </div>
                </div>

                {/* Card 5: Ground Workers Deployed */}
                <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase text-purple-500 tracking-wider">Ground Force</span>
                    <UserCheck size={16} className="text-purple-500" />
                  </div>
                  <div className="space-y-0.5">
                    <h3 className="text-2xl font-black tracking-tight text-purple-500">
                      {computedAnalytics.activeKaryakartasCount}
                    </h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase">Active Karyakartas</p>
                  </div>
                </div>

              </div>

              {/* Overall Sentiment Spectrum Progress */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Voter Sentiment Response Breakdown</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Segment distribution of monitored responses</p>
                  </div>
                  <span className="text-xs font-black text-zinc-600 dark:text-zinc-300">
                    {computedAnalytics.totalMonitored} Sampled Responses
                  </span>
                </div>

                {/* Multi-segmented Progress Bar */}
                <div className="h-4 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden flex shadow-inner">
                  <div 
                    className="bg-emerald-500 h-full transition-all duration-500 relative group cursor-pointer" 
                    style={{ width: `${computedAnalytics.supportPercentage}%` }} 
                    title={`Support: ${computedAnalytics.supportPercentage.toFixed(1)}%`}
                  />
                  <div 
                    className="bg-amber-400 h-full transition-all duration-500 relative group cursor-pointer" 
                    style={{ width: `${computedAnalytics.neutralPercentage}%` }} 
                    title={`Neutral / Swing: ${computedAnalytics.neutralPercentage.toFixed(1)}%`}
                  />
                  <div 
                    className="bg-red-500 h-full transition-all duration-500 relative group cursor-pointer" 
                    style={{ width: `${computedAnalytics.opposePercentage}%` }} 
                    title={`Oppose: ${computedAnalytics.opposePercentage.toFixed(1)}%`}
                  />
                  <div 
                    className="bg-blue-500 h-full transition-all duration-500 relative group cursor-pointer" 
                    style={{ width: `${computedAnalytics.otherPercentage}%` }} 
                    title={`Other Party: ${computedAnalytics.otherPercentage.toFixed(1)}%`}
                  />
                </div>

                {/* Legend details */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Support ({computedAnalytics.supportPercentage.toFixed(1)}%)</span>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.supportCount} Voters</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Neutral / Swing ({computedAnalytics.neutralPercentage.toFixed(1)}%)</span>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.neutralCount} Voters</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Opposing ({computedAnalytics.opposePercentage.toFixed(1)}%)</span>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.opposeCount} Voters</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-blue-500 shrink-0" />
                    <div>
                      <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Other Parties ({computedAnalytics.otherPercentage.toFixed(1)}%)</span>
                      <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.otherCount} Voters</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Age Demographics & Gender Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                
                {/* Age Cohorts amongst Supporters */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Age Demographics</h3>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Supporter Distribution</p>
                    </div>
                    {(() => {
                      const arr = [
                        { label: 'Youth', val: computedAnalytics.ageBreakdown.youth },
                        { label: 'Middle', val: computedAnalytics.ageBreakdown.middle },
                        { label: 'Seniors', val: computedAnalytics.ageBreakdown.senior }
                      ];
                      const sorted = [...arr].sort((a,b) => b.val - a.val);
                      const total = arr.reduce((acc, curr) => acc + curr.val, 0) || 1;
                      const ratio = ((sorted[0].val / total) * 100).toFixed(0);
                      if (sorted[0].val === 0) return null;
                      return (
                        <span className="text-[9px] font-black text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Leading: {sorted[0].label} ({ratio}%)
                        </span>
                      );
                    })()}
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const totalAgeSupporters = (computedAnalytics.ageBreakdown.youth + computedAnalytics.ageBreakdown.middle + computedAnalytics.ageBreakdown.senior) || 1;
                      return [
                        { label: 'Youth (18 - 35)', count: computedAnalytics.ageBreakdown.youth, gradient: 'from-sky-400 to-blue-600', textClass: 'text-sky-500' },
                        { label: 'Middle Age (36 - 60)', count: computedAnalytics.ageBreakdown.middle, gradient: 'from-blue-600 to-indigo-600', textClass: 'text-blue-500' },
                        { label: 'Senior Citizens (60+)', count: computedAnalytics.ageBreakdown.senior, gradient: 'from-indigo-600 to-purple-600', textClass: 'text-indigo-400' }
                      ].map(item => {
                        const pct = ((item.count / totalAgeSupporters) * 100);
                        return (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                              <div>
                                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">{item.label}</span>
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">{item.count} Supporters</span>
                              </div>
                              <span className={`text-xs font-black ${item.textClass}`}>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${pct}%` }} 
                                className={`h-full bg-gradient-to-r ${item.gradient} rounded-full transition-all duration-500`} 
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* Gender Cohorts amongst Supporters */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Gender Breakdown</h3>
                      <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Demographic Support Base</p>
                    </div>
                    {(() => {
                      const arr = [
                        { label: 'Male', val: computedAnalytics.genderBreakdown.male },
                        { label: 'Female', val: computedAnalytics.genderBreakdown.female },
                        { label: 'Other', val: computedAnalytics.genderBreakdown.other }
                      ];
                      const sorted = [...arr].sort((a,b) => b.val - a.val);
                      const total = arr.reduce((acc, curr) => acc + curr.val, 0) || 1;
                      const ratio = ((sorted[0].val / total) * 100).toFixed(0);
                      if (sorted[0].val === 0) return null;
                      return (
                        <span className="text-[9px] font-black text-fuchsia-600 bg-fuchsia-50 dark:bg-fuchsia-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                          Dominant: {sorted[0].label} ({ratio}%)
                        </span>
                      );
                    })()}
                  </div>

                  <div className="space-y-4">
                    {(() => {
                      const totalGenderSupporters = (computedAnalytics.genderBreakdown.male + computedAnalytics.genderBreakdown.female + computedAnalytics.genderBreakdown.other) || 1;
                      return [
                        { label: 'Male Supporters', count: computedAnalytics.genderBreakdown.male, gradient: 'from-blue-400 to-indigo-600', textClass: 'text-blue-500' },
                        { label: 'Female Supporters', count: computedAnalytics.genderBreakdown.female, gradient: 'from-fuchsia-400 to-pink-600', textClass: 'text-fuchsia-500' },
                        { label: 'Other/Unspecified', count: computedAnalytics.genderBreakdown.other, gradient: 'from-purple-600 to-indigo-600', textClass: 'text-purple-400' }
                      ].map(item => {
                        const pct = ((item.count / totalGenderSupporters) * 100);
                        return (
                          <div key={item.label} className="space-y-1.5">
                            <div className="flex justify-between items-end">
                              <div>
                                <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">{item.label}</span>
                                <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">{item.count} Supporters</span>
                              </div>
                              <span className={`text-xs font-black ${item.textClass}`}>{pct.toFixed(1)}%</span>
                            </div>
                            <div className="h-2 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                              <div 
                                style={{ width: `${pct}%` }} 
                                className={`h-full bg-gradient-to-r ${item.gradient} rounded-full transition-all duration-500`} 
                              />
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>

              {/* Booth-wise Breakdown List */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Polling Station Performance Density</h3>
                    <p className="text-[10px] text-zinc-400 font-bold uppercase">Ranked by Support Share</p>
                  </div>
                </div>

                {/* Search and Column Management Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative w-full sm:w-64">
                    <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input 
                      type="text" 
                      placeholder="Filter by booth name or ID..."
                      value={boothSearchTerm}
                      onChange={(e) => setBoothSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <TableColumnManager columnManager={boothColumnManager} tableName="Polling Booths" variant="button" />
                </div>

                <div className="overflow-x-auto custom-scrollbar rounded-xl border border-zinc-150 dark:border-zinc-800">
                  <table className="w-full text-left text-xs min-w-[650px] whitespace-nowrap">
                    <thead>
                      <tr className="bg-zinc-50/70 dark:bg-zinc-800/50 text-zinc-400 uppercase tracking-widest text-[9px] font-black border-b border-zinc-150 dark:border-zinc-800">
                        {boothColumnManager.visibleColumns.map(col => (
                          <th
                            key={col.id}
                            className={`py-2 px-3 ${col.id === 'favorableProjection' || col.id === 'margin' ? 'text-right pr-4' : col.id === 'boothName' ? '' : 'text-center'} ${
                              col.id === 'support' ? 'text-emerald-600 dark:text-emerald-400' : col.id === 'neutral' ? 'text-amber-500' : col.id === 'oppose' ? 'text-red-500' : ''
                            }`}
                            style={{ minWidth: col.minWidth }}
                          >
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                      {filteredBoothStats.length === 0 ? (
                        <tr>
                          <td colSpan={boothColumnManager.visibleColumns.length || 1} className="text-center py-6 text-zinc-400 font-bold text-xs">
                            No sentiment records found matching the selected filters.
                          </td>
                        </tr>
                      ) : (
                        filteredBoothStats.map(bs => {
                          let tagClass = 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10';
                          if (bs.supportRate < 40) tagClass = 'text-red-500 bg-red-50 dark:bg-red-500/10';
                          else if (bs.supportRate < 50) tagClass = 'text-amber-500 bg-amber-50 dark:bg-amber-500/10';

                          return (
                            <tr key={bs.boothId} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/20 transition-colors font-medium">
                              {boothColumnManager.visibleColumns.map(col => {
                                switch (col.id) {
                                  case 'boothName':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                                        <MapPin size={12} className="text-zinc-400 shrink-0" />
                                        <span className="truncate max-w-[200px]">{bs.boothName}</span>
                                      </td>
                                    );
                                  case 'boothId':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 font-mono text-center text-zinc-400">
                                        {bs.boothId}
                                      </td>
                                    );
                                  case 'totalSample':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-center text-zinc-500">
                                        {bs.total}
                                      </td>
                                    );
                                  case 'support':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                        {bs.support}
                                      </td>
                                    );
                                  case 'neutral':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-center font-bold text-amber-500">
                                        {bs.neutral}
                                      </td>
                                    );
                                  case 'oppose':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-center font-bold text-red-500">
                                        {bs.oppose}
                                      </td>
                                    );
                                  case 'favorableProjection':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-right pr-4">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tagClass}`}>
                                          {bs.supportRate.toFixed(1)}%
                                        </span>
                                      </td>
                                    );
                                  case 'margin':
                                    return (
                                      <td key={col.id} className="py-1.5 px-3 text-right pr-4 font-mono font-bold">
                                        <span className={bs.margin >= 0 ? 'text-emerald-600' : 'text-red-500'}>
                                          {bs.margin > 0 ? `+${bs.margin}` : bs.margin}
                                        </span>
                                      </td>
                                    );
                                  default:
                                    return null;
                                }
                              })}
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>

            {/* RIGHT COLUMN: Scenarios, Party Shares & AI Directives */}
            <div className="space-y-8">
              
              {/* Winning Projection Scenario Simulator */}
              <div className="bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-white rounded-3xl p-6 border border-zinc-800 space-y-6 shadow-xl relative overflow-hidden">
                <div className="absolute right-0 bottom-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
                
                <div className="space-y-2">
                  <span className="text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">
                    Projection Engine
                  </span>
                  <h3 className="text-lg font-black tracking-tight pt-1 text-white">Electoral Confidence Scenario</h3>
                  <p className="text-xs text-zinc-400">Calibrated against historical winning margins and live ground data</p>
                </div>

                {/* Threshold Slider */}
                <div className="p-4 bg-zinc-900/90 rounded-2xl border border-zinc-800 space-y-3">
                  <div className="flex justify-between items-center text-xs text-zinc-400">
                    <span>Scenario Winning Threshold Target</span>
                    <span className="font-bold text-white bg-blue-600 px-2 py-0.5 rounded-md">{targetWinningThreshold}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="40" 
                    max="75" 
                    value={targetWinningThreshold} 
                    onChange={(e) => setTargetWinningThreshold(Number(e.target.value))} 
                    className="w-full accent-blue-500 h-1.5 bg-zinc-800 rounded-lg cursor-pointer" 
                  />
                  <div className="flex justify-between text-[9px] text-zinc-500 font-extrabold uppercase">
                    <span>40% (Plurality)</span>
                    <span>50% (Clear Majority)</span>
                    <span>75% (Supermajority)</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-300">Monitored Vote Projection:</span>
                    <span className="text-sm font-black text-emerald-400">{computedAnalytics.supportPercentage.toFixed(1)}%</span>
                  </div>
                  
                  <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                    <span className="text-xs text-zinc-300">Projected Outcome:</span>
                    <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                      computedAnalytics.supportPercentage >= targetWinningThreshold 
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}>
                      {computedAnalytics.supportPercentage >= targetWinningThreshold ? 'VICTORY' : 'VULNERABLE'}
                    </span>
                  </div>
                </div>

                {/* Simulated confidence factor meter */}
                <div className="space-y-2 pt-2 border-t border-zinc-800">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Projection Confidence Index</span>
                    <span className="text-xl font-black text-white">{Math.min(100, Math.round(computedAnalytics.supportPercentage * 1.35))}%</span>
                  </div>
                  <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      style={{ width: `${Math.min(100, Math.round(computedAnalytics.supportPercentage * 1.35))}%` }} 
                      className={`h-full rounded-full transition-all duration-300 ${
                        computedAnalytics.supportPercentage >= targetWinningThreshold ? 'bg-emerald-500' : 'bg-red-500'
                      }`} 
                    />
                  </div>
                </div>
              </div>

              {/* Swing Conversion Opportunities Simulator */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex gap-2.5 items-center">
                  <Target className="text-blue-500" size={18} />
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Swing Voter Conversion Simulator</h3>
                </div>

                <div className="p-4 bg-blue-50/50 dark:bg-blue-950/20 rounded-2xl border border-blue-500/20 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-600 dark:text-zinc-300 font-semibold">Target Neutral Conversion Rate:</span>
                    <span className="font-bold text-blue-600 dark:text-blue-400 bg-white dark:bg-zinc-900 px-2 py-0.5 rounded border border-blue-500/20">{swingConversionRate}%</span>
                  </div>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={swingConversionRate} 
                    onChange={(e) => setSwingConversionRate(Number(e.target.value))} 
                    className="w-full accent-blue-600 h-1.5 bg-blue-200 dark:bg-blue-900/50 rounded-lg cursor-pointer" 
                  />
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium">
                    Converting <strong className="text-blue-600 dark:text-blue-400">{swingConversionRate}%</strong> of the {computedAnalytics.neutralCount} swing voters increases your projected vote share from <strong className="text-emerald-600">{computedAnalytics.supportPercentage.toFixed(1)}%</strong> to <strong className="text-emerald-600 dark:text-emerald-400 font-black">{computedAnalytics.convertedSupportPercentage.toFixed(1)}%</strong>.
                  </p>
                </div>
              </div>

              {/* Party Lead & Traction Breakdown */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-2">
                  <Vote size={18} className="text-purple-500" />
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Party Alignment Distribution</h3>
                </div>

                <div className="space-y-3">
                  {computedAnalytics.partyShare.length === 0 ? (
                    <p className="text-xs text-zinc-400 text-center py-4">No party alignment responses recorded yet.</p>
                  ) : (
                    computedAnalytics.partyShare.map(p => {
                      const pct = computedAnalytics.totalMonitored > 0 ? (p.count / computedAnalytics.totalMonitored) * 100 : 0;
                      return (
                        <div key={p.name} className="space-y-1">
                          <div className="flex justify-between text-xs font-semibold">
                            <span className="text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <span>{p.symbol}</span>
                              <span className="truncate max-w-[160px]">{p.name}</span>
                            </span>
                            <span className="text-zinc-500 dark:text-zinc-400">{p.count} ({pct.toFixed(1)}%)</span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div 
                              className="h-full rounded-full transition-all duration-500" 
                              style={{ width: `${pct}%`, backgroundColor: p.color || '#3b82f6' }}
                            />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Predictive Directives */}
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="flex gap-2.5 items-center">
                  <Flame className="text-red-500" size={18} />
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Ground Intelligence Directives</h3>
                </div>

                <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-extrabold uppercase text-[9px] tracking-wider">Campaign Focus</span>
                    <span className="text-blue-600 dark:text-blue-400 font-black uppercase text-[10px] tracking-wide">{computedAnalytics.projectionStatus}</span>
                  </div>
                  <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed font-bold">
                    {computedAnalytics.recommendation}
                  </p>
                </div>

                {/* Top Citizen Issues */}
                {computedAnalytics.topConcerns.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">Top Citizen Grievances & Topics</span>
                    <div className="flex flex-wrap gap-1.5">
                      {computedAnalytics.topConcerns.map(c => (
                        <span key={c.name} className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-semibold">
                          {c.name} <strong className="text-blue-500">({c.count})</strong>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

            </div>

          </div>

        </div>
      )}

      {/* TAB 2: VOTER SENTIMENT RESPONSES TABLE */}
      {activeTab === 'responses' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* Table Toolbar & Search Filters */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-5 shadow-sm space-y-4">
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                  <Users className="w-4 h-4 text-indigo-500" />
                  Voter Sentiment Responses
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Detailed breakdown of voter political sentiments, scores, favored parties, grievances, and field audit records.
                </p>
              </div>

              {/* Action Tools */}
              <div className="flex items-center gap-2.5 flex-wrap">
                <TableColumnManager 
                  columnManager={voterSentimentColumnManager} 
                  tableName="Voter Sentiment Responses" 
                  variant="button"
                />

                <button
                  type="button"
                  onClick={handleDownloadCSV}
                  disabled={filteredVoterResponses.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 hover:bg-zinc-800 dark:hover:bg-white text-white dark:text-zinc-950 text-xs font-bold transition-all disabled:opacity-50 shadow-xs cursor-pointer"
                >
                  <Download size={13} />
                  <span>Export ({filteredVoterResponses.length})</span>
                </button>
              </div>
            </div>

            {/* Granular Table Filter Strip */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800">
              
              {/* Text Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search voter, EPIC, mobile, village, auditor..."
                  value={voterSearchTerm}
                  onChange={(e) => setVoterSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-zinc-100"
                />
                {voterSearchTerm && (
                  <button 
                    onClick={() => setVoterSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Sentiment Classification Filter */}
              <div className="relative">
                <select
                  value={voterSentimentFilter}
                  onChange={(e) => setVoterSentimentFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
                >
                  <option value="all">🎯 All Sentiment Types</option>
                  <option value="Support">🟢 Support Base (Score 4-5)</option>
                  <option value="Neutral">🟡 Neutral / Swing (Score 3)</option>
                  <option value="Oppose">🔴 Opposed Base (Score 1-2)</option>
                  <option value="Other Party">🔵 Other Party Preference</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>

              {/* Exact Sentiment Score Filter */}
              <div className="relative">
                <select
                  value={voterScoreFilter}
                  onChange={(e) => setVoterScoreFilter(e.target.value)}
                  className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-xl bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
                >
                  <option value="all">⭐ All Rating Scores</option>
                  <option value="5">Score 5 — Strong Support (100%)</option>
                  <option value="4">Score 4 — Supporting (80%)</option>
                  <option value="3">Score 3 — Neutral / Swing (60%)</option>
                  <option value="2">Score 2 — Lean Oppose (40%)</option>
                  <option value="1">Score 1 — Strongly Opposed (20%)</option>
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              </div>

              {/* Page Size Selector */}
              <div className="flex items-center gap-2 justify-end">
                <span className="text-xs text-zinc-400 whitespace-nowrap">Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="px-2.5 py-1.5 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>

            </div>

          </div>

          {/* Detailed Voter Responses Table */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead>
                  <tr className="bg-zinc-50/80 dark:bg-zinc-800/60 text-zinc-500 dark:text-zinc-400 uppercase tracking-widest text-[9px] font-black border-b border-zinc-200 dark:border-zinc-800">
                    {voterSentimentColumnManager.visibleColumns.map(col => (
                      <th
                        key={col.id}
                        className={`py-3 px-4 ${col.id === 'actions' ? 'text-right pr-5' : ''}`}
                        style={{ minWidth: col.minWidth }}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {paginatedVoterResponses.length === 0 ? (
                    <tr>
                      <td colSpan={voterSentimentColumnManager.visibleColumns.length || 1} className="text-center py-12 text-zinc-400">
                        <Users className="w-8 h-8 mx-auto mb-2 text-zinc-300 dark:text-zinc-700" />
                        <p className="font-bold text-xs text-zinc-600 dark:text-zinc-400">No voter sentiment responses found.</p>
                        <p className="text-[11px] text-zinc-400 mt-0.5">Try clearing filters or search terms to display voter records.</p>
                      </td>
                    </tr>
                  ) : (
                    paginatedVoterResponses.map(record => {
                      const score = record.sentimentScore || 3;
                      const scorePercent = score * 20;

                      let sentimentBadgeClass = 'bg-yellow-100 text-yellow-850 dark:bg-yellow-950/50 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800/60';
                      let sentimentLabel = 'Neutral';
                      if (score >= 4) {
                        sentimentBadgeClass = 'bg-emerald-100 text-emerald-850 dark:bg-emerald-950/50 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60';
                        sentimentLabel = score === 5 ? 'Strong Support' : 'Supporting';
                      } else if (score <= 2) {
                        sentimentBadgeClass = 'bg-red-100 text-red-850 dark:bg-red-950/50 dark:text-red-400 border-red-200 dark:border-red-800/60';
                        sentimentLabel = score === 1 ? 'Strongly Opposed' : 'Lean Oppose';
                      }

                      return (
                        <tr 
                          key={record.id} 
                          className="hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30 transition-colors group cursor-pointer"
                          onClick={() => setDetailVoterRecord(record)}
                        >
                          {voterSentimentColumnManager.visibleColumns.map(col => {
                            switch (col.id) {
                              case 'voter':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 font-semibold text-zinc-900 dark:text-zinc-100">
                                    <div className="space-y-0.5">
                                      <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                                        <span className="truncate max-w-[180px]">{record.voterName}</span>
                                      </div>
                                      {(record.guardianName || record.village) && (
                                        <div className="text-[10px] text-zinc-400 font-normal truncate max-w-[200px]">
                                          {record.guardianName ? `c/o ${record.guardianName}` : ''}
                                          {record.guardianName && record.village ? ' • ' : ''}
                                          {record.village ? record.village : ''}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );

                              case 'epic':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 font-mono text-zinc-600 dark:text-zinc-400">
                                    {record.voterEpic ? (
                                      <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-[11px] border border-zinc-200 dark:border-zinc-700">
                                        {record.voterEpic}
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 text-[11px]">-</span>
                                    )}
                                  </td>
                                );

                              case 'guardianName':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">
                                    <span className="truncate max-w-[140px] block">{record.guardianName || '-'}</span>
                                  </td>
                                );

                              case 'sentiment':
                                return (
                                  <td key={col.id} className="py-2.5 px-4">
                                    <div className="space-y-1 max-w-[150px]">
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${sentimentBadgeClass}`}>
                                          {sentimentLabel}
                                        </span>
                                        <span className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                                          {scorePercent}%
                                        </span>
                                      </div>
                                      <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                                        <div 
                                          style={{ width: `${scorePercent}%` }}
                                          className={`h-full rounded-full transition-all duration-300 ${
                                            score >= 4 ? 'bg-emerald-500' : score <= 2 ? 'bg-red-500' : 'bg-amber-400'
                                          }`}
                                        />
                                      </div>
                                    </div>
                                  </td>
                                );

                              case 'favoredParty':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 font-semibold text-zinc-800 dark:text-zinc-200">
                                    {record.favoredPartyName ? (
                                      <span 
                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60"
                                      >
                                        <span>{record.partySymbol || '🗳️'}</span>
                                        <span className="truncate max-w-[120px]">{record.favoredPartyName}</span>
                                      </span>
                                    ) : (
                                      <span className="text-zinc-400 font-normal italic">Undecided</span>
                                    )}
                                  </td>
                                );

                              case 'location':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300">
                                    <div className="space-y-0.5 max-w-[170px]">
                                      <div className="flex items-center gap-1 font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                                        <MapPin size={11} className="text-zinc-400 shrink-0" />
                                        <span className="truncate">{record.boothName || booths.find(b => b.id === record.boothId)?.name || (record.boothId ? `Booth #${record.boothId}` : 'Booth Unassigned')}</span>
                                      </div>
                                      {record.constituencyName && (
                                        <div className="text-[10px] text-zinc-400 truncate pl-3.5">
                                          {record.constituencyName}
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                );

                              case 'constituency':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300">
                                    <span className="truncate max-w-[140px] block">{record.constituencyName || '-'}</span>
                                  </td>
                                );

                              case 'village':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300">
                                    <span className="truncate max-w-[130px] block">{record.village || '-'}</span>
                                  </td>
                                );

                              case 'houseNo':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 font-mono">
                                    {record.houseNo || '-'}
                                  </td>
                                );

                              case 'contact':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                                    {record.mobile ? (
                                      <div className="flex items-center gap-1">
                                        <Phone size={11} className="text-zinc-400" />
                                        <span>{record.mobile}</span>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-400 font-sans text-[11px]">-</span>
                                    )}
                                  </td>
                                );

                              case 'email':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 font-mono text-[11px]">
                                    {record.email ? (
                                      <div className="flex items-center gap-1">
                                        <Mail size={11} className="text-zinc-400" />
                                        <span className="truncate max-w-[130px]">{record.email}</span>
                                      </div>
                                    ) : (
                                      <span className="text-zinc-400 font-sans text-[11px]">-</span>
                                    )}
                                  </td>
                                );

                              case 'demographics':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-300">
                                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 block">
                                      {record.age ? `${record.age} yrs` : ''} 
                                      {record.age && record.gender ? ' • ' : ''} 
                                      {record.gender || ''}
                                    </span>
                                  </td>
                                );

                              case 'caste':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                                    {record.caste || '-'}
                                  </td>
                                );

                              case 'concerns':
                                return (
                                  <td key={col.id} className="py-2.5 px-4">
                                    <div className="flex items-center gap-1 overflow-hidden max-w-[180px] flex-wrap">
                                      {record.keyConcerns && record.keyConcerns.length > 0 ? (
                                        record.keyConcerns.slice(0, 2).map((c, i) => (
                                          <span key={i} className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-medium truncate max-w-[90px]">
                                            {c}
                                          </span>
                                        ))
                                      ) : (
                                        <span className="text-zinc-400 text-[11px]">-</span>
                                      )}
                                      {record.keyConcerns && record.keyConcerns.length > 2 && (
                                        <span className="text-[10px] text-blue-500 font-bold">
                                          +{record.keyConcerns.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                );

                              case 'survey':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">
                                    <span className="truncate max-w-[140px] block font-medium" title={record.surveyTitle || 'General Survey'}>
                                      {record.surveyTitle || 'General Survey'}
                                    </span>
                                  </td>
                                );

                              case 'electionYear':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-600 dark:text-zinc-400">
                                    {record.electionYear ? `${record.electionYear} Cycle` : '-'}
                                  </td>
                                );

                              case 'recordedBy':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                    <div className="space-y-0.5 max-w-[140px]">
                                      <span className="truncate block font-bold text-zinc-900 dark:text-zinc-100">
                                        {record.recordedByName || 'Field Staff'}
                                      </span>
                                    </div>
                                  </td>
                                );

                              case 'recordedById':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 font-mono text-[10px] text-zinc-400">
                                    {record.recordedBy || '-'}
                                  </td>
                                );

                              case 'admin':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-700 dark:text-zinc-300 font-medium">
                                    <span className="truncate block font-semibold text-zinc-800 dark:text-zinc-200">
                                      {record.adminName || 'Administrator'}
                                    </span>
                                  </td>
                                );

                              case 'date':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-zinc-500 dark:text-zinc-400 font-mono text-[11px]">
                                    {formatSentimentDate(record.createdAt)}
                                  </td>
                                );

                              case 'actions':
                                return (
                                  <td key={col.id} className="py-2.5 px-4 text-right pr-4" onClick={(e) => e.stopPropagation()}>
                                    <div className="flex items-center justify-end gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => setDetailVoterRecord(record)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800/60 transition-colors cursor-pointer"
                                        title="View complete response details"
                                      >
                                        <Eye size={12} />
                                        <span>Details</span>
                                      </button>

                                      {canDeleteSentiment(record) && (
                                        <button
                                          type="button"
                                          onClick={() => setSentimentToDelete(record)}
                                          className="p-1 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-transparent hover:border-red-200 dark:hover:border-red-800/60 transition-colors cursor-pointer"
                                          title="Delete sentiment response"
                                        >
                                          <Trash2 size={13} />
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );

                              default:
                                return null;
                            }
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredVoterResponses.length > 0 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3.5 bg-zinc-50/70 dark:bg-zinc-800/40 border-t border-zinc-200 dark:border-zinc-800 text-xs">
                <div className="text-zinc-500 dark:text-zinc-400 font-medium">
                  Showing <strong className="text-zinc-900 dark:text-white">{(currentPage - 1) * pageSize + 1}</strong> to <strong className="text-zinc-900 dark:text-white">{Math.min(currentPage * pageSize, filteredVoterResponses.length)}</strong> of <strong className="text-zinc-900 dark:text-white">{filteredVoterResponses.length}</strong> voter records
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="First Page"
                  >
                    <ChevronsLeft size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Previous Page"
                  >
                    <ChevronLeft size={14} />
                  </button>

                  <div className="px-3 py-1 font-bold text-zinc-800 dark:text-zinc-200 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-700">
                    Page {currentPage} of {totalPages}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Next Page"
                  >
                    <ChevronRight size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                    title="Last Page"
                  >
                    <ChevronsRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {/* DETAIL MODAL: Full Voter Sentiment Response Profile */}
      {detailVoterRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setDetailVoterRecord(null)}
              className="absolute top-5 right-5 p-1.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-indigo-50 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 font-black uppercase px-2.5 py-0.5 rounded-full tracking-wider">
                  Voter Sentiment Profile
                </span>
                {detailVoterRecord.voterEpic && (
                  <span className="font-mono text-xs font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded-md">
                    {detailVoterRecord.voterEpic}
                  </span>
                )}
              </div>

              <h3 className="text-xl font-black text-zinc-900 dark:text-white pt-1">
                {detailVoterRecord.voterName}
              </h3>
              <p className="text-xs text-zinc-400">
                Audited feedback recorded on {formatSentimentDate(detailVoterRecord.createdAt)}
              </p>
            </div>

            {/* Detail Grid Sections */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              
              {/* Section 1: Demographics & Contact */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Voter Identity & Demographics
                </span>
                
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Age & Gender:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.age} yrs • {detailVoterRecord.gender}</span>
                  </div>
                  {detailVoterRecord.guardianName && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Relation / Guardian:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.guardianName}</span>
                    </div>
                  )}
                  {detailVoterRecord.caste && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Social Category / Caste:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.caste}</span>
                    </div>
                  )}
                  {detailVoterRecord.village && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Village / Ward:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.village}</span>
                    </div>
                  )}
                  {detailVoterRecord.houseNo && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">House Number:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.houseNo}</span>
                    </div>
                  )}
                  {detailVoterRecord.mobile && (
                    <div className="flex justify-between font-mono">
                      <span className="text-zinc-500 font-sans">Mobile:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.mobile}</span>
                    </div>
                  )}
                  {detailVoterRecord.email && (
                    <div className="flex justify-between font-mono">
                      <span className="text-zinc-500 font-sans">Email:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.email}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Section 2: Electoral Station & Location */}
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 space-y-3">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                  Polling Station & Electoral Area
                </span>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Polling Booth:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.boothName || booths.find(b => b.id === detailVoterRecord.boothId)?.name || (detailVoterRecord.boothId ? `Booth #${detailVoterRecord.boothId}` : 'Unassigned')}</span>
                  </div>
                  {detailVoterRecord.constituencyName && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Constituency:</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.constituencyName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Campaign Survey:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.surveyTitle || 'Ground Sentiment Assessment'}</span>
                  </div>
                  {detailVoterRecord.adminName && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Admin Workspace:</span>
                      <span className="font-bold text-indigo-600 dark:text-indigo-400">{detailVoterRecord.adminName}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Field Auditor / Staff:</span>
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{detailVoterRecord.recordedByName || 'Staff Member'}</span>
                  </div>
                  {detailVoterRecord.recordedBy && (
                    <div className="flex justify-between">
                      <span className="text-zinc-500">Auditor User ID:</span>
                      <span className="font-mono text-zinc-600 dark:text-zinc-400 text-[11px]">{detailVoterRecord.recordedBy}</span>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Section 3: Sentiment & Political Alignment */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100/50 dark:from-zinc-800/60 dark:to-zinc-800/30 border border-zinc-200 dark:border-zinc-800 space-y-4">
              <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                Political Sentiment & Alignment
              </span>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                
                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-500 block font-semibold">Favored Political Party</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{detailVoterRecord.partySymbol || '🗳️'}</span>
                    <span className="text-sm font-black text-zinc-900 dark:text-white">
                      {detailVoterRecord.favoredPartyName || 'Undecided'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-zinc-500 block font-semibold">Sentiment Score Rating</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-zinc-900 dark:text-white">
                      {detailVoterRecord.sentimentScore}/5
                    </span>
                    <span className="text-xs text-zinc-500">
                      ({detailVoterRecord.sentimentScore * 20}%)
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      detailVoterRecord.sentimentScore >= 4 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400' :
                      detailVoterRecord.sentimentScore <= 2 ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400' :
                      'bg-yellow-100 text-yellow-850 dark:bg-yellow-950 dark:text-yellow-400'
                    }`}>
                      {detailVoterRecord.sentiment || (detailVoterRecord.sentimentScore >= 4 ? 'Support' : detailVoterRecord.sentimentScore <= 2 ? 'Oppose' : 'Neutral')}
                    </span>
                  </div>
                </div>

              </div>

              {/* Key Grievances & Concerns */}
              {detailVoterRecord.keyConcerns && detailVoterRecord.keyConcerns.length > 0 && (
                <div className="space-y-2 pt-2 border-t border-zinc-200 dark:border-zinc-700/60">
                  <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider block">
                    Reported Citizen Concerns & Topics
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {detailVoterRecord.keyConcerns.map((c, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 text-xs font-semibold border border-zinc-200 dark:border-zinc-700">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between gap-2 pt-2">
              {canDeleteSentiment(detailVoterRecord) ? (
                <button
                  type="button"
                  onClick={() => setSentimentToDelete(detailVoterRecord)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-red-600 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Record</span>
                </button>
              ) : <div />}

              <button
                type="button"
                onClick={() => setDetailVoterRecord(null)}
                className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Profile
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {sentimentToDelete && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div 
            className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 relative animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3.5">
              <div className="p-3 bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 rounded-2xl shrink-0">
                <AlertTriangle size={22} />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-zinc-900 dark:text-white">
                  Delete Sentiment Response?
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Are you sure you want to delete the audited sentiment record for voter <strong className="text-zinc-900 dark:text-white">{sentimentToDelete.voterName}</strong>?
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-200 dark:border-zinc-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-zinc-500">Polling Booth:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{sentimentToDelete.boothName || booths.find(b => b.id === sentimentToDelete.boothId)?.name || (sentimentToDelete.boothId ? `Booth #${sentimentToDelete.boothId}` : 'Unassigned')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Favored Party:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{sentimentToDelete.favoredPartyName || 'Undecided'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Recorded By:</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">{sentimentToDelete.recordedByName || 'Field Staff'}</span>
              </div>
            </div>

            {deleteError && (
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl border border-red-200 dark:border-red-900/40">
                {deleteError}
              </p>
            )}

            <p className="text-[11px] text-zinc-400 italic">
              * Deleting this record will instantly recalculate all ground intelligence stats, support margins, and polling station projections across the dashboard.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSentimentToDelete(null);
                  setDeleteError('');
                }}
                disabled={deletingSentiment}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-xl transition-colors disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleDeleteSentiment}
                disabled={deletingSentiment}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl transition-colors disabled:opacity-50 shadow-xs cursor-pointer"
              >
                {deletingSentiment && <Loader2 size={13} className="animate-spin" />}
                <span>{deletingSentiment ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default PredictionsAnalytics;
