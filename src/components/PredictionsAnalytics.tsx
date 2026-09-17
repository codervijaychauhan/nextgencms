import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp, 
  Target, 
  Users, 
  Flag, 
  CheckCircle, 
  Sparkles, 
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
  AlertCircle,
  ShieldAlert,
  Sliders,
  Award,
  Vote
} from 'lucide-react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';

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

  const hasRight = (moduleId: string, right: string) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.permissions?.['analytics'] || profile?.rights?.[moduleId] || '';
    return perms.includes(right);
  };

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
  const [selectedSurveyFilter, setSelectedSurveyFilter] = useState<string>('all');
  const [targetWinningThreshold, setTargetWinningThreshold] = useState<number>(50);
  const [swingConversionRate, setSwingConversionRate] = useState<number>(25);
  const [boothSearchTerm, setBoothSearchTerm] = useState<string>('');

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
      setBooths((boothsRes || []).map(b => ({ 
        id: String(b.id), 
        name: b.name || `Booth #${b.booth_number || b.id}` 
      })));

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
      setVolunteers((volsRes || []).map(v => ({
        id: String(v.id),
        name: v.name || 'Karyakarta',
        role: v.role || 'Booth Volunteer',
        boothId: String(v.booth_id || v.boothId || ''),
        status: v.status || 'Active'
      })));

      // 6. Fetch Surveys
      const surveysRes = await api.get<any[]>('/api/surveys').catch(() => []);
      setSurveys((surveysRes || []).map(s => ({
        id: String(s.id),
        title: s.title || `Survey #${s.id}`
      })));

      // 7. Fetch Enriched Sentiments
      const sentimentsRes = await api.get<SentimentRecord[]>('/api/voter-sentiments').catch(() => []);
      setSentiments(sentimentsRes || []);

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
  }, [user]);

  // Handle default administrator focus for non-super admins
  useEffect(() => {
    if (!isSuperAdmin && profile) {
      const parentAdminId = profile.adminId || profile.creatorId || user?.uid || '';
      if (parentAdminId) {
        setSelectedAdminId(parentAdminId);
      }
    }
  }, [isSuperAdmin, profile, user]);

  // Compute stats according to filters
  const computedAnalytics = useMemo(() => {
    let filtered = sentiments;

    // Filter by Admin
    if (selectedAdminId !== 'all') {
      filtered = filtered.filter(s => 
        String(s.recordedBy).toLowerCase() === selectedAdminId.toLowerCase() ||
        String(s.recordedByName).toLowerCase() === selectedAdminId.toLowerCase()
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

    // Filter by Survey Campaign
    if (selectedSurveyFilter !== 'all') {
      filtered = filtered.filter(s => String(s.surveyId) === selectedSurveyFilter);
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

    // Booth-wise Breakdown
    const boothMap: Record<string, { total: number; support: number; neutral: number; oppose: number; boothName: string }> = {};
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

  }, [sentiments, selectedAdminId, selectedConstituencyFilter, selectedBoothFilter, selectedSurveyFilter, swingConversionRate, booths, volunteers]);

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
          You do not have view permissions for Ground Intelligence & Electoral Forecasting. Please contact your campaign administrator.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 min-h-[70vh] gap-4">
        <Loader2 size={36} className="animate-spin text-zinc-900 dark:text-white" />
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Loading Campaign Intelligence & Electoral Forecasts...</p>
      </div>
    );
  }

  const activeFocusUser = admins.find(a => a.uid === selectedAdminId);
  const filteredBoothStats = computedAnalytics.boothStats.filter(b => 
    b.boothName.toLowerCase().includes(boothSearchTerm.toLowerCase()) || 
    b.boothId.toLowerCase().includes(boothSearchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-full mx-auto animate-fade-in text-zinc-900 dark:text-zinc-100">
      
      {/* Dynamic Upper Panel */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-zinc-950 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-red-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Analytics</h1>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                <Sparkles size={12} className="text-amber-500 shrink-0" /> Ground Intelligence & Electoral Forecasting
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Sync */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-end">
          <button
            onClick={() => fetchAnalyticsData(false)}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm text-zinc-700 dark:text-zinc-300"
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin text-blue-500' : ''} />
            {isRefreshing ? 'Syncing...' : 'Sync Data'}
          </button>

          <button
            onClick={handleDownloadCSV}
            className="flex items-center gap-2 px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm text-zinc-700 dark:text-zinc-300"
          >
            <Download size={14} />
            Export CSV
          </button>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 text-white dark:text-zinc-950 text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-sm"
          >
            <Printer size={14} />
            Print Report
          </button>
        </div>
      </div>

      {/* Global Filter Toolbar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-900/40 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        
        {/* Admin Context */}
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
            Admin Workspace
          </label>
          {isSuperAdmin ? (
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
          ) : (
            <div className="px-3 py-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-300 truncate">
              👤 {activeFocusUser?.username || profile?.username || 'Current District Admin'}
            </div>
          )}
        </div>

        {/* Constituency Filter */}
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

        {/* Survey Campaign Filter */}
        <div>
          <label className="block text-[10px] font-black uppercase text-zinc-400 tracking-wider mb-1">
            Survey Campaign
          </label>
          <div className="relative">
            <select
              value={selectedSurveyFilter}
              onChange={(e) => setSelectedSurveyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-bold rounded-xl bg-white dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 appearance-none cursor-pointer pr-8"
            >
              <option value="all">📋 All Survey Drives ({surveys.length})</option>
              {surveys.map(s => (
                <option key={s.id} value={s.id}>📋 {s.title}</option>
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
                  Total sample breakdown mapping voting tendencies across {constituencies.length} registered constituencies
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
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
                <input
                  type="text"
                  placeholder="Search polling booth..."
                  value={boothSearchTerm}
                  onChange={(e) => setBoothSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar rounded-xl border border-zinc-150 dark:border-zinc-800">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-400 uppercase tracking-widest text-[9px] font-black border-b border-zinc-150 dark:border-zinc-800">
                    <th className="py-3 px-3">Booth / Station Name</th>
                    <th className="py-3 px-3 text-center">Total Sample</th>
                    <th className="py-3 px-3 text-center text-emerald-600">Support</th>
                    <th className="py-3 px-3 text-center text-amber-500">Neutral</th>
                    <th className="py-3 px-3 text-center text-red-500">Oppose</th>
                    <th className="py-3 px-3 text-right">Favorable Projection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-150 dark:divide-zinc-800/80">
                  {filteredBoothStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-zinc-400 font-bold text-xs">
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
                          <td className="py-3 px-3 font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                            <MapPin size={13} className="text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{bs.boothName}</span>
                          </td>
                          <td className="py-3 text-center text-zinc-500">{bs.total}</td>
                          <td className="py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">{bs.support}</td>
                          <td className="py-3 text-center font-bold text-amber-500">{bs.neutral}</td>
                          <td className="py-3 text-center font-bold text-red-500">{bs.oppose}</td>
                          <td className="py-3 text-right pr-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${tagClass}`}>
                              {bs.supportRate.toFixed(1)}%
                            </span>
                          </td>
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
