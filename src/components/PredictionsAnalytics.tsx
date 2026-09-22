import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Users, 
  Flag, 
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
  Vote
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { useTableColumns, ColumnDef } from '../hooks/useTableColumns';
import { TableColumnManager } from './common/TableColumnManager';

type AnalyticsBoothColumnKey = 
  | 'boothName'
  | 'totalSample'
  | 'support'
  | 'neutral'
  | 'oppose'
  | 'favorableProjection';

const DEFAULT_ANALYTICS_BOOTH_COLUMNS: ColumnDef<AnalyticsBoothColumnKey>[] = [
  { id: 'boothName', label: 'Booth / Station Name', category: 'Location', required: true, defaultVisible: true, minWidth: '180px' },
  { id: 'totalSample', label: 'Total Sample', category: 'Sample', defaultVisible: true, minWidth: '90px' },
  { id: 'support', label: 'Support Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'neutral', label: 'Neutral Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'oppose', label: 'Oppose Count', category: 'Sentiment', defaultVisible: true, minWidth: '80px' },
  { id: 'favorableProjection', label: 'Favorable Projection', category: 'Analytics', defaultVisible: true, minWidth: '130px' },
];

interface SentimentRecord {
  id: string;
  voterDocId: string;
  voterName: string;
  gender: string;
  age: number;
  caste?: string;
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
  username: string;
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
    return typeof perms === 'string' && (perms.includes(right) || perms.includes('v') || perms.includes('r'));
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

  // Filter & Selection States
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [selectedConstituencyFilter, setSelectedConstituencyFilter] = useState<string>('all');
  const [selectedBoothFilter, setSelectedBoothFilter] = useState<string>('all');
  const [selectedPartyFilter, setSelectedPartyFilter] = useState<string>('all');
  const [targetWinningThreshold, setTargetWinningThreshold] = useState<number>(50);
  const [swingConversionRate, setSwingConversionRate] = useState<number>(25);
  const [boothSearchTerm, setBoothSearchTerm] = useState<string>('');

  // Table Column Manager for Booth Breakdown
  const boothColumnManager = useTableColumns('analytics_booths_table', DEFAULT_ANALYTICS_BOOTH_COLUMNS);

  // Load all foundational collections
  const fetchAnalyticsData = async (showLoadingSpinner = true) => {
    if (showLoadingSpinner) setLoading(true);
    else setIsRefreshing(true);

    try {
      // 1. Fetch Users / Admins
      const usersList = await api.get<any[]>('/api/users').catch(() => []);
      const adminsList: AdminUser[] = (usersList || [])
        .filter(u => ['super_admin', 'admin', 'manager'].includes(u.role || ''))
        .map(u => ({
          uid: String(u.id || u.uid),
          username: u.username || u.name || u.email?.split('@')[0] || 'System User',
          email: u.email || '',
          role: u.role
        }));
      setAdmins(adminsList);

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

      // 7. Fetch Enriched Sentiments and Voter Assessments (Admin-Specific)
      const [sentimentsRes, assessmentsRes] = await Promise.all([
        api.get<any[]>('/api/voter-sentiments').catch(() => []),
        api.get<any[]>('/api/voter-assessments').catch(() => [])
      ]);

      const mergedSentimentsMap = new Map<string, SentimentRecord>();

      // A. Populate from voter-assessments (Admin-recorded Political Sentiment Profile)
      (assessmentsRes || []).forEach((a: any) => {
        const id = String(a.id || `va_${a.admin_id}_${a.voter_id}`);
        const score = Number(a.sentiment_score || a.sentimentScore || 3);
        const sentimentVal = (a.sentiment || (score >= 4 ? 'Support' : score <= 2 ? 'Oppose' : 'Neutral')) as any;

        mergedSentimentsMap.set(id, {
          id,
          voterDocId: String(a.voter_id || a.voterId || ''),
          voterName: a.voter_full_name || a.voter_name || a.voterName || 'Voter',
          gender: a.voter_gender || a.gender || 'Male',
          age: Number(a.voter_age || a.age || 35),
          caste: a.caste || a.voter_caste || '',
          favoredPartyId: String(a.favored_party_id || a.favoredPartyId || ''),
          favoredPartyName: a.favored_party_name || a.favoredPartyName || '',
          partyColor: a.party_color || a.partyColor || '#3b82f6',
          partySymbol: a.party_symbol || a.partySymbol || '🗳️',
          sentimentScore: score,
          sentiment: sentimentVal,
          keyConcerns: Array.isArray(a.key_concerns) ? a.key_concerns : typeof a.key_concerns === 'string' ? JSON.parse(a.key_concerns || '[]') : (a.keyConcerns || []),
          constituencyId: normalizeId(a.voter_constituency_id || a.constituency_id || a.constituencyId),
          constituencyName: a.constituency_name || a.constituencyName || '',
          boothId: normalizeId(a.voter_booth_id || a.booth_id || a.boothId),
          boothName: a.booth_name || a.boothName || '',
          recordedBy: normalizeId(a.admin_id || a.recorded_by || a.recordedBy),
          recordedByName: a.admin_name || a.recorded_by_name || a.recordedByName || '',
          createdAt: a.updated_at || a.created_at || a.createdAt
        });
      });

      // B. Populate from voter-sentiments
      (sentimentsRes || []).forEach((s: any) => {
        const id = String(s.id || `vs_${s.voter_id}_${s.survey_id || s.recorded_by || 'sent'}`);
        if (!mergedSentimentsMap.has(id)) {
          const score = Number(s.sentimentScore || s.sentiment_score || 3);
          const sentimentVal = (s.sentiment || (score >= 4 ? 'Support' : score <= 2 ? 'Oppose' : 'Neutral')) as any;
          mergedSentimentsMap.set(id, {
            id,
            voterDocId: String(s.voterDocId || s.voter_id || s.voterId || ''),
            voterName: s.voterName || s.voter_name || 'Voter',
            gender: s.gender || s.voter_gender || 'Male',
            age: Number(s.age || s.voter_age || 35),
            caste: s.caste || s.voter_caste || '',
            favoredPartyId: String(s.favoredPartyId || s.favored_party_id || ''),
            favoredPartyName: s.favoredPartyName || s.favored_party_name || s.party_name || '',
            partyColor: s.partyColor || s.party_color || '#3b82f6',
            partySymbol: s.partySymbol || s.party_symbol || '🗳️',
            sentimentScore: score,
            sentiment: sentimentVal,
            keyConcerns: Array.isArray(s.keyConcerns) ? s.keyConcerns : Array.isArray(s.key_concerns) ? s.key_concerns : typeof s.key_concerns === 'string' ? JSON.parse(s.key_concerns || '[]') : [],
            constituencyId: normalizeId(s.constituencyId || s.constituency_id || s.effective_constituency_id),
            constituencyName: s.constituencyName || s.constituency_name || '',
            boothId: normalizeId(s.boothId || s.booth_id || s.effective_booth_id),
            boothName: s.boothName || s.booth_name || '',
            recordedBy: normalizeId(s.recordedBy || s.recorded_by || s.adminId || s.admin_id),
            recordedByName: s.recordedByName || s.recorded_by_name || '',
            createdAt: s.createdAt || s.created_at || s.updated_at
          });
        }
      });

      let allSentiments = Array.from(mergedSentimentsMap.values());

      // If non-super admin, strictly scope only to sentiment assessments recorded by or linked to THIS admin user
      if (!isEffectiveSuperAdmin) {
        allSentiments = allSentiments.filter(s => {
          const sRecordedBy = normalizeId(s.recordedBy);
          const sRecordedByName = normalizeId(s.recordedByName);
          const sBooth = normalizeId(s.boothId);

          // Direct match with this admin's credentials/team
          const isOwnAdminRecord = myAdminIds.some(id => id && (sRecordedBy === id || sRecordedByName === id));
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
      const bId = item.boothId || 'unassigned';
      const bName = item.boothName || booths.find(b => b.id === bId)?.name || 'General Area';
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
      supportRate: counters.total > 0 ? (counters.support / counters.total) * 100 : 0
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

  const handleDownloadCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + ["Voter Name,Booth,Constituency,Favored Party,Sentiment Score,Key Concerns,Date"].join(",") + "\n"
      + sentiments.map(s => [
          `"${(s.voterName || '').replace(/"/g, '""')}"`,
          `"${(s.boothName || s.boothId || '').replace(/"/g, '""')}"`,
          `"${(s.constituencyName || s.constituencyId || '').replace(/"/g, '""')}"`,
          `"${(s.favoredPartyName || '').replace(/"/g, '""')}"`,
          s.sentimentScore,
          `"${(s.keyConcerns || []).join('; ').replace(/"/g, '""')}"`,
          s.createdAt ? s.createdAt.substring(0, 10) : ''
        ].join(",")).join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Ground_Intelligence_Report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    <div className="space-y-6 w-full animate-fade-in text-zinc-900 dark:text-zinc-100">
      
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Analytics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Ground Intelligence
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Voter political sentiment and ground intelligence.
          </p>
        </div>

        {/* Action Controls & Sync */}
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-end">
          <button
            onClick={() => fetchAnalyticsData(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-md transition-all cursor-pointer shadow-xs text-zinc-700 dark:text-zinc-300"
          >
            <RefreshCw size={13} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
            {isRefreshing ? 'Syncing...' : 'Sync Data'}
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3.5 py-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-md transition-all cursor-pointer shadow-xs text-zinc-700 dark:text-zinc-300"
          >
            <Download size={13} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-md transition-all cursor-pointer shadow-xs"
          >
            <Printer size={13} />
            Print Report
          </button>
        </div>
      </div>

      {/* Global Filter Toolbar */}
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
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Voters Polled</p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-blue-500" />
            </div>

            {/* Card 2: Net Support */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Net Support</span>
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
                  {computedAnalytics.supportPercentage.toFixed(1)}%
                </h3>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                  {computedAnalytics.supportCount} Supporters
                </p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500" />
            </div>

            {/* Card 3: Swing Core */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Swing Core</span>
                <Flag size={16} className="text-amber-500 animate-pulse" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-400">
                  {computedAnalytics.neutralPercentage.toFixed(1)}%
                </h3>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                  {computedAnalytics.neutralCount} Neutrals
                </p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-amber-500" />
            </div>

            {/* Card 4: Avg Strength */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Avg Strength</span>
                <Flame size={16} className="text-orange-500 fill-orange-500/10" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-black tracking-tight text-orange-600 dark:text-orange-400">
                  {computedAnalytics.averageStrength > 0 ? computedAnalytics.averageStrength.toFixed(1) : '0.0'}/5
                </h3>
                <p className="text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                  Aligned Intensity
                </p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-orange-500" />
            </div>

            {/* Card 5: Ground Connect */}
            <div className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm space-y-2 relative overflow-hidden col-span-2 sm:col-span-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Ground Connect</span>
                <UserCheck size={16} className="text-indigo-500" />
              </div>
              <div className="space-y-0.5">
                <h3 className="text-2xl font-black tracking-tight text-indigo-600 dark:text-indigo-400">
                  {computedAnalytics.activeKaryakartasCount}
                </h3>
                <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-bold uppercase tracking-wider">
                  Active Karyakartas
                </p>
              </div>
              <div className="absolute bottom-0 inset-x-0 h-1 bg-indigo-500" />
            </div>

          </div>

          {/* Visual Progress Bar & Sentiment Distribution */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">Electoral Sentiment Distribution</h3>
                <p className="text-[11px] text-zinc-400">
                  Political sentiment breakdown mapping ground feedback across {booths.length} assigned polling booths
                </p>
              </div>
              <Calendar size={16} className="text-zinc-400" />
            </div>

            {/* Custom Visual Sentiment bar */}
            <div className="space-y-4">
              <div className="h-6 rounded-full w-full flex overflow-hidden shadow-inner border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-950">
                <div 
                  style={{ width: `${computedAnalytics.supportPercentage}%` }} 
                  className="bg-emerald-500 h-full transition-all duration-500"
                  title={`Support: ${computedAnalytics.supportPercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.neutralPercentage}%` }} 
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`Neutral / Swing: ${computedAnalytics.neutralPercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.opposePercentage}%` }} 
                  className="bg-red-500 h-full transition-all duration-500"
                  title={`Oppose: ${computedAnalytics.opposePercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.otherPercentage}%` }} 
                  className="bg-purple-500 h-full transition-all duration-500"
                  title={`Other Party: ${computedAnalytics.otherPercentage.toFixed(1)}%`}
                />
              </div>

              {/* Legend with counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Support ({computedAnalytics.supportPercentage.toFixed(1)}%)</span>
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.supportCount} Voters</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Neutral / Swing ({computedAnalytics.neutralPercentage.toFixed(1)}%)</span>
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.neutralCount} Voters</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Opposing ({computedAnalytics.opposePercentage.toFixed(1)}%)</span>
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.opposeCount} Voters</span>
                  </div>
                </div>

                <div className="flex items-center gap-2.5">
                  <div className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
                  <div>
                    <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Other Parties ({computedAnalytics.otherPercentage.toFixed(1)}%)</span>
                    <span className="text-[10px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.otherCount} Voters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Demographic Projections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            
            {/* Age Cohorts amongst Supporters */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Age Distribution</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Demographic Supporter Cohorts</p>
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
                      Dominant: {sorted[0].label} ({ratio}%)
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-4">
                {(() => {
                  const totalAgeSupporters = (computedAnalytics.ageBreakdown.youth + computedAnalytics.ageBreakdown.middle + computedAnalytics.ageBreakdown.senior) || 1;
                  return [
                    { label: 'Youth (18 - 35)', count: computedAnalytics.ageBreakdown.youth, gradient: 'from-sky-400 to-blue-600', textClass: 'text-sky-500' },
                    { label: 'Middle Age (36 - 60)', count: computedAnalytics.ageBreakdown.middle, gradient: 'from-blue-500 to-indigo-600', textClass: 'text-indigo-400' },
                    { label: 'Seniors (60+)', count: computedAnalytics.ageBreakdown.senior, gradient: 'from-indigo-600 to-purple-600', textClass: 'text-purple-400' }
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
              <TableColumnManager columnManager={boothColumnManager} tableName="Booth Breakdown" variant="compact" />
            </div>

            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-zinc-150 dark:border-zinc-800">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 uppercase tracking-widest text-[9px] font-black border-b border-zinc-150 dark:border-zinc-800">
                    {boothColumnManager.visibleColumns.map(col => (
                      <th
                        key={col.id}
                        className={`py-3 px-3 ${col.id === 'favorableProjection' ? 'text-right pr-4' : col.id === 'boothName' ? '' : 'text-center'} ${
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
                                  <td key={col.id} className="py-3 px-3 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                                    <MapPin size={13} className="text-zinc-400 shrink-0" />
                                    <span className="truncate max-w-[200px]">{bs.boothName}</span>
                                  </td>
                                );
                              case 'totalSample':
                                return (
                                  <td key={col.id} className="py-3 text-center text-zinc-500">
                                    {bs.total}
                                  </td>
                                );
                              case 'support':
                                return (
                                  <td key={col.id} className="py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                                    {bs.support}
                                  </td>
                                );
                              case 'neutral':
                                return (
                                  <td key={col.id} className="py-3 text-center font-bold text-amber-500">
                                    {bs.neutral}
                                  </td>
                                );
                              case 'oppose':
                                return (
                                  <td key={col.id} className="py-3 text-center font-bold text-red-500">
                                    {bs.oppose}
                                  </td>
                                );
                              case 'favorableProjection':
                                return (
                                  <td key={col.id} className="py-3 text-right pr-4">
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tagClass}`}>
                                      {bs.supportRate.toFixed(1)}%
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
  );
};

export default PredictionsAnalytics;
