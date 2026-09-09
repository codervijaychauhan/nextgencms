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
  UserCheck
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';

interface SentimentDoc {
  id: string;
  adminId: string;
  voterDocId: string;
  sentiment: 'Support' | 'Neutral' | 'Oppose' | 'Other Party';
  notes?: string;
  strength?: number;
  isKaryakarta?: boolean;
  updatedByName?: string;
  updatedAt?: any;
}

interface VoterDoc {
  id: string;
  voterId: string;
  name: string;
  relationName?: string;
  boothId?: string;
  gender?: string;
  age?: number;
  caste?: string;
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
}

interface AdminUser {
  uid: string;
  username: string;
  email: string;
  role: string;
}

interface DemographicItem {
  id: string;
  name: string;
}

export const PredictionsAnalytics: React.FC = () => {
  const { user, isAdmin, profile } = useAuth();

  // Loading States
  const [loading, setLoading] = useState(true);

  // Raw Database Data
  const [sentiments, setSentiments] = useState<SentimentDoc[]>([]);
  const [voters, setVoters] = useState<VoterDoc[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [booths, setBooths] = useState<DemographicItem[]>([]);
  const [constituencies, setConstituencies] = useState<DemographicItem[]>([]);

  // Filter & Selection States
  const [selectedAdminId, setSelectedAdminId] = useState<string>('all');
  const [targetWinningThreshold, setTargetWinningThreshold] = useState<number>(50); // slider for target vote share
  const [selectedBoothFilter, setSelectedBoothFilter] = useState<string>('all');

  // Load all foundational collections
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // 1. Fetch Admins
        const usersList = await apiFetch<any[]>('/api/users').catch(() => []);
        const adminsList: AdminUser[] = (usersList || [])
          .filter(u => ['super_admin', 'admin', 'manager'].includes(u.role || ''))
          .map(u => ({
            uid: u.id || u.uid,
            username: u.username || u.name || u.email?.split('@')[0] || 'System User',
            email: u.email || '',
            role: u.role
          }));
        setAdmins(adminsList);

        // 2. Fetch Demographic Lookups (Booths & Constituencies)
        const boothsRes = await apiFetch<any[]>('/api/booths').catch(() => []);
        setBooths((boothsRes || []).map(b => ({ id: b.id, name: b.name || `Booth ${b.booth_number || ''}` })));

        const constRes = await apiFetch<any[]>('/api/constituencies').catch(() => []);
        setConstituencies((constRes || []).map(c => ({ id: c.id, name: c.name || 'Constituency' })));

        // 3. Fetch voters
        const votersRes = await apiFetch<{ data: any[] }>('/api/voters?limit=500').catch(() => ({ data: [] }));
        const votersList: VoterDoc[] = (votersRes?.data || []).map(v => ({
          id: v.id,
          voterId: v.voter_id || v.voterId || '',
          name: v.name || '',
          boothId: v.booth_id || v.boothId || '',
          gender: v.gender || '',
          age: v.age || 0,
          caste: v.caste || '',
          stateId: v.state_id || v.stateId || '',
          districtId: v.district_id || v.districtId || '',
          constituencyId: v.constituency_id || v.constituencyId || ''
        }));
        setVoters(votersList);

        // 4. Fetch Sentiments
        const rawSentiments = await apiFetch<any[]>('/api/voter-sentiments').catch(() => []);
        const sentimentsList: SentimentDoc[] = (rawSentiments || []).map(s => {
          let sentimentScore = s.sentimentScore || s.sentiment_score || 3;
          let sentimentType: SentimentDoc['sentiment'] = 'Neutral';
          if (sentimentScore >= 4) sentimentType = 'Support';
          else if (sentimentScore <= 2) sentimentType = 'Oppose';

          return {
            id: s.id,
            adminId: s.recordedBy || s.recorded_by || '',
            voterDocId: s.voterDocId || s.voter_id || '',
            sentiment: sentimentType,
            notes: s.notes || '',
            strength: sentimentScore,
            isKaryakarta: s.isKaryakarta || false,
            updatedByName: s.recordedByName || s.recorded_by_name || '',
            updatedAt: s.createdAt || s.created_at
          };
        });
        setSentiments(sentimentsList);

      } catch (err) {
        console.error("Error loading Analytics data: ", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user]);

  // Handle default administrator focus
  useEffect(() => {
    if (!isAdmin && profile) {
      const parentAdminId = profile.adminId || profile.creatorId || user?.uid || '';
      setSelectedAdminId(parentAdminId);
    } else if (isAdmin && selectedAdminId === 'all' && admins.length > 0) {
      // For Super Admin we can keep 'all', or default to first
    }
  }, [isAdmin, profile, user, admins]);

  // Compute stats according to filters
  const computedAnalytics = useMemo(() => {
    // 1. Filter sentiments by target admin if applicable
    let activeSentiments = sentiments;
    
    if (selectedAdminId !== 'all') {
      activeSentiments = sentiments.filter(s => s.adminId === selectedAdminId);
    }

    // Map Voter Data onto matching Sentiment docs
    const sentimentVoters = activeSentiments.map(sent => {
      const matchVoter = voters.find(v => v.id === sent.voterDocId);
      return {
        ...sent,
        voter: matchVoter
      };
    }).filter(sv => sv.voter !== undefined); // only count those whose voter files exist

    // Filter by Booth
    const filteredByBooth = selectedBoothFilter === 'all' 
      ? sentimentVoters 
      : sentimentVoters.filter(sv => sv.voter?.boothId === selectedBoothFilter);

    // Group sentiments
    let supportCount = 0;
    let neutralCount = 0;
    let opposeCount = 0;
    let otherCount = 0;
    let localKaryakartaCount = 0;
    let totalStrengthSum = 0;
    let strengthRecordsCount = 0;

    filteredByBooth.forEach(item => {
      if (item.sentiment === 'Support') supportCount++;
      else if (item.sentiment === 'Neutral') neutralCount++;
      else if (item.sentiment === 'Oppose') opposeCount++;
      else if (item.sentiment === 'Other Party') otherCount++;
      
      if (item.isKaryakarta) {
        localKaryakartaCount++;
      }
      if (item.strength !== undefined && item.strength > 0) {
        totalStrengthSum += item.strength;
        strengthRecordsCount++;
      }
    });

    const totalMonitored = filteredByBooth.length;
    const averageStrength = strengthRecordsCount > 0 ? (totalStrengthSum / strengthRecordsCount) : 0;

    // Support Share of Monitored
    const supportPercentage = totalMonitored > 0 ? (supportCount / totalMonitored) * 100 : 0;
    const neutralPercentage = totalMonitored > 0 ? (neutralCount / totalMonitored) * 100 : 0;
    const opposePercentage = totalMonitored > 0 ? (opposeCount / totalMonitored) * 100 : 0;
    const otherPercentage = totalMonitored > 0 ? (otherCount / totalMonitored) * 100 : 0;

    // Projected Turnout Confidence Indicator
    // If Support constitutes high share of monitored block, we give strong projections
    let projectionStatus = 'Toss-Up';
    let recommendation = 'Increase local karyakarta outreach programs in critical booths.';
    if (supportPercentage >= 60) {
      projectionStatus = 'Strong Hold';
      recommendation = 'Maintain ground connect and finalize Booth Day transport mobilization schedules.';
    } else if (supportPercentage >= 50) {
      projectionStatus = 'Leaning Favorite';
      recommendation = 'Convert 35% of Swing/Neutral voters to secure a comfortable victory margin.';
    } else if (supportPercentage > 0 && supportPercentage < 40) {
      projectionStatus = 'Deficit Danger';
      recommendation = 'Urgent: Redirect campaigning funds & deploy senior volunteers to reverse opposition traction.';
    }

    // Demographics groupings
    // Gender Breakdown amongst Supporters
    let maleSupporters = 0;
    let femaleSupporters = 0;
    let otherGenderSupporters = 0;

    filteredByBooth.filter(sv => sv.sentiment === 'Support').forEach(sv => {
      const gender = sv.voter?.gender || 'Male';
      if (gender === 'Male') maleSupporters++;
      else if (gender === 'Female') femaleSupporters++;
      else otherGenderSupporters++;
    });

    // Age distribution amongst Supporters
    let youthSupporters = 0; // 18-35
    let midAgeSupporters = 0; // 36-60
    let seniorSupporters = 0; // 60+

    filteredByBooth.filter(sv => sv.sentiment === 'Support').forEach(sv => {
      const age = sv.voter?.age || 18;
      if (age <= 35) youthSupporters++;
      else if (age <= 60) midAgeSupporters++;
      else seniorSupporters++;
    });

    // Booth density calculation
    const boothPerformanceMap: Record<string, { total: number; support: number; neutral: number; oppose: number; other: number }> = {};
    filteredByBooth.forEach(item => {
      const bId = item.voter?.boothId || 'unassigned';
      if (!boothPerformanceMap[bId]) {
        boothPerformanceMap[bId] = { total: 0, support: 0, neutral: 0, oppose: 0, other: 0 };
      }
      boothPerformanceMap[bId].total++;
      if (item.sentiment === 'Support') boothPerformanceMap[bId].support++;
      else if (item.sentiment === 'Neutral') boothPerformanceMap[bId].neutral++;
      else if (item.sentiment === 'Oppose') boothPerformanceMap[bId].oppose++;
      else if (item.sentiment === 'Other Party') boothPerformanceMap[bId].other++;
    });

    const boothStatsList = Object.entries(boothPerformanceMap).map(([bId, counters]) => {
      const bName = booths.find(b => b.id === bId)?.name || 'General Area Pooling';
      return {
        boothId: bId,
        boothName: bName,
        ...counters,
        supportRate: counters.total > 0 ? (counters.support / counters.total) * 100 : 0
      };
    }).sort((a, b) => b.supportRate - a.supportRate);

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
      projectionStatus,
      recommendation,
      averageStrength,
      localKaryakartaCount,
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

  }, [sentiments, voters, selectedAdminId, selectedBoothFilter, booths]);

  // Render Loader
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 min-h-[70vh] gap-4">
        <Loader2 size={36} className="animate-spin text-zinc-900 dark:text-white" />
        <p className="text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">Loading Campaign Intelligence...</p>
      </div>
    );
  }

  // Active admin display label
  const activeFocusUser = admins.find(a => a.uid === selectedAdminId);

  return (
    <div className="p-4 sm:p-8 space-y-8 max-w-full mx-auto">
      {/* Dynamic Upper Panel */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 bg-white dark:bg-zinc-950 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-zinc-100 dark:shadow-none">
        <div className="space-y-2 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-red-600 flex items-center justify-center text-white shadow-lg shrink-0">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Analytics</h1>
              <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest flex items-center gap-1.5 flex-wrap">
                <Sparkles size={11} className="text-amber-500 shrink-0" /> Ground Intelligence & Electoral Forecasting
              </p>
            </div>
          </div>
        </div>

        {/* Global Filter Toolbar */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center w-full md:w-auto">
          {isAdmin ? (
            <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto shrink-0">
              <span className="text-[9px] font-black uppercase text-zinc-400 px-3 tracking-widest hidden sm:inline">Admin Context</span>
              <select
                value={selectedAdminId}
                onChange={(e) => setSelectedAdminId(e.target.value)}
                className="webapp-input h-9 text-xs font-bold border-none bg-transparent outline-none py-0 pr-8 pl-2 flex-grow sm:flex-grow-0 w-full sm:w-auto"
              >
                <option value="all">🌐 All Admins (Consolidated)</option>
                {admins.map(adm => (
                  <option key={adm.uid} value={adm.uid}>👤 {adm.username} ({adm.role === 'super_admin' ? 'Super Admin' : 'Admin'})</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="p-2 sm:px-4 sm:py-2.5 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold text-zinc-700 dark:text-zinc-350 w-full sm:w-auto text-center shrink-0">
              🔭 Focused On: <span className="text-zinc-900 dark:text-white underline decoration-blue-500 underline-offset-4">{activeFocusUser?.username || profile?.username || 'Current District Admin'}</span>
            </div>
          )}

          <div className="flex items-center bg-zinc-50 dark:bg-zinc-900 p-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 w-full sm:w-auto shrink-0">
            <span className="text-[9px] font-black uppercase text-zinc-400 px-3 tracking-widest hidden sm:inline">Booth Area</span>
            <select
              value={selectedBoothFilter}
              onChange={(e) => setSelectedBoothFilter(e.target.value)}
              className="webapp-input h-9 text-xs font-bold border-none bg-transparent outline-none py-0 pr-8 pl-1 flex-grow sm:flex-grow-0 w-full sm:w-auto"
            >
              <option value="all">📍 All Booth Locations</option>
              {booths.map(b => (
                <option key={b.id} value={b.id}>📍 {b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main Analytical Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT TWO COLUMNS: Metrics & Charts */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Key Metric Blocks */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            
            <div className="webapp-card p-4 space-y-3 col-span-2 lg:col-span-1">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Sample Coverage</span>
                <Users size={16} className="text-zinc-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                  {computedAnalytics.totalMonitored}
                </h3>
                <p className="text-[9px] text-zinc-400 font-bold uppercase tracking-wider">Voters Polled</p>
              </div>
            </div>

            <div className="webapp-card p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Net Support</span>
                <CheckCircle size={16} className="text-emerald-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-emerald-600 dark:text-emerald-450">
                  {computedAnalytics.supportPercentage.toFixed(1)}%
                </h3>
                <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
                  {computedAnalytics.supportCount} Supporters
                </p>
              </div>
            </div>

            <div className="webapp-card p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Swing Core</span>
                <Flag size={16} className="text-zinc-500 dark:text-zinc-400 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-amber-600 dark:text-amber-450">
                  {computedAnalytics.neutralPercentage.toFixed(1)}%
                </h3>
                <p className="text-[9px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
                  {computedAnalytics.neutralCount} Neutrals
                </p>
              </div>
            </div>

            <div className="webapp-card p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Avg Strength</span>
                <Flame size={16} className="text-orange-500 fill-orange-500/10" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-orange-600 dark:text-orange-450">
                  {computedAnalytics.averageStrength > 0 ? computedAnalytics.averageStrength.toFixed(1) : '0.0'}/5
                </h3>
                <p className="text-[9px] text-orange-600 dark:text-orange-400 font-bold uppercase tracking-wider">
                  Aligned Intensity
                </p>
              </div>
            </div>

            <div className="webapp-card p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Ground Connect</span>
                <UserCheck size={16} className="text-blue-500" />
              </div>
              <div className="space-y-1">
                <h3 className="text-2xl font-black tracking-tight text-blue-600 dark:text-blue-450">
                  {computedAnalytics.localKaryakartaCount}
                </h3>
                <p className="text-[9px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                  Local Karyakartas/Vols
                </p>
              </div>
            </div>

          </div>

          {/* Visual Progress Donuts & bars */}
          <div className="webapp-card p-6 sm:p-8 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-base font-black text-zinc-900 dark:text-white tracking-tight">Electoral Sentiment Distribution</h3>
                <p className="text-[10px] text-zinc-400">Total sample breakdown mapping potential voting patterns across {constituencies.length} registered constituencies</p>
              </div>
              <Calendar size={16} className="text-zinc-400" />
            </div>

            {/* Custom Visual Sentiment bar */}
            <div className="space-y-4">
              <div className="h-6 rounded-full w-full flex overflow-hidden shadow-inner border border-zinc-150/10 bg-zinc-100 dark:bg-zinc-900">
                <div 
                  style={{ width: `${computedAnalytics.supportPercentage}%` }} 
                  className="bg-emerald-500 h-full transition-all duration-500 relative group"
                  title={`Support: ${computedAnalytics.supportPercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.neutralPercentage}%` }} 
                  className="bg-zinc-400 h-full transition-all duration-500"
                  title={`Neutral: ${computedAnalytics.neutralPercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.opposePercentage}%` }} 
                  className="bg-red-500 h-full transition-all duration-500"
                  title={`Oppose: ${computedAnalytics.opposePercentage.toFixed(1)}%`}
                />
                <div 
                  style={{ width: `${computedAnalytics.otherPercentage}%` }} 
                  className="bg-amber-400 h-full transition-all duration-500"
                  title={`Other: ${computedAnalytics.otherPercentage.toFixed(1)}%`}
                />
              </div>

              {/* Legend with counts */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 block leading-tight">Support ({computedAnalytics.supportPercentage.toFixed(1)}%)</span>
                    <span className="text-[9px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.supportCount} Voters</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 block leading-tight">Neutral ({computedAnalytics.neutralPercentage.toFixed(1)}%)</span>
                    <span className="text-[9px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.neutralCount} Voters</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 block leading-tight">Opposing ({computedAnalytics.opposePercentage.toFixed(1)}%)</span>
                    <span className="text-[9px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.opposeCount} Voters</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-amber-400 shrink-0" />
                  <div>
                    <span className="text-[10px] font-black text-zinc-700 dark:text-zinc-300 block leading-tight">Other Party ({computedAnalytics.otherPercentage.toFixed(1)}%)</span>
                    <span className="text-[9px] text-zinc-400 font-extrabold uppercase">{computedAnalytics.otherCount} Voters</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Demographic Projections */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
            
            {/* Age Cohorts amongst Supporters */}
            <div className="webapp-card p-6 space-y-5">
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
                      <div key={item.label} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">{item.label}</span>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">{item.count} Registered Supporters</span>
                          </div>
                          <span className={`text-sm font-black ${item.textClass}`}>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-200/50 dark:border-zinc-800">
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
            <div className="webapp-card p-6 space-y-5">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Gender Breakdown</h3>
                  <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Demographic Support Base</p>
                </div>
                {(() => {
                  const arr = [
                    { label: 'Male', val: computedAnalytics.genderBreakdown.male },
                    { label: 'Female', val: computedAnalytics.genderBreakdown.female },
                    { label: 'Other/Unspecified', val: computedAnalytics.genderBreakdown.other }
                  ];
                  const sorted = [...arr].sort((a,b) => b.val - a.val);
                  const total = arr.reduce((acc, curr) => acc + curr.val, 0) || 1;
                  const ratio = ((sorted[0].val / total) * 100).toFixed(0);
                  if (sorted[0].val === 0) return null;
                  return (
                    <span className="text-[9px] font-black text-purple-600 bg-purple-50 dark:bg-purple-500/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                      Dominant: {sorted[0].label} ({ratio}%)
                    </span>
                  );
                })()}
              </div>

              <div className="space-y-4">
                {(() => {
                  const totalGenderSupporters = (computedAnalytics.genderBreakdown.male + computedAnalytics.genderBreakdown.female + computedAnalytics.genderBreakdown.other) || 1;
                  return [
                    { label: 'Male Supporters', count: computedAnalytics.genderBreakdown.male, gradient: 'from-pink-400 to-fuchsia-600', textClass: 'text-fuchsia-500' },
                    { label: 'Female Supporters', count: computedAnalytics.genderBreakdown.female, gradient: 'from-fuchsia-500 to-purple-600', textClass: 'text-purple-400' },
                    { label: 'Other/Unspecified', count: computedAnalytics.genderBreakdown.other, gradient: 'from-purple-600 to-indigo-600', textClass: 'text-indigo-400' }
                  ].map(item => {
                    const pct = ((item.count / totalGenderSupporters) * 100);
                    return (
                      <div key={item.label} className="space-y-2">
                        <div className="flex justify-between items-end">
                          <div className="space-y-0.5">
                            <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">{item.label}</span>
                            <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">{item.count} Registered Supporters</span>
                          </div>
                          <span className={`text-sm font-black ${item.textClass}`}>{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2.5 w-full bg-zinc-100 dark:bg-zinc-900 rounded-full overflow-hidden p-0.5 border border-zinc-200/50 dark:border-zinc-800">
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
          <div className="webapp-card p-6 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Polling Station Performance Density</h3>
                <p className="text-[9px] text-zinc-400 font-bold uppercase">Ranked by Support Share</p>
              </div>
              <MapPin size={16} className="text-zinc-400" />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-850 text-zinc-400 uppercase tracking-widest text-[9px] font-black p-2">
                    <th className="py-3 px-2">Booth / Station Name</th>
                    <th className="py-3 px-2 text-center">Total Sample</th>
                    <th className="py-3 px-2 text-center text-emerald-600">Support</th>
                    <th className="py-3 px-2 text-center text-zinc-450">Neutral</th>
                    <th className="py-3 px-2 text-center text-red-500">Oppose</th>
                    <th className="py-3 px-2 text-right">Favorable Projection</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50 dark:divide-zinc-900/50">
                  {computedAnalytics.boothStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-6 text-zinc-400 font-extrabold text-[10px] uppercase">
                        No Sentiment Data Logged for Booth Locations
                      </td>
                    </tr>
                  ) : (
                    computedAnalytics.boothStats.map(bs => {
                      let tagClass = 'text-green-500 bg-green-50/50 dark:bg-zinc-900';
                      if (bs.supportRate < 40) tagClass = 'text-red-500 bg-red-50/50 dark:bg-zinc-900';
                      else if (bs.supportRate < 50) tagClass = 'text-amber-500 bg-amber-50/50 dark:bg-zinc-900';

                      return (
                        <tr key={bs.boothId} className="hover:bg-zinc-50/40 dark:hover:bg-zinc-900/10 transition-colors font-bold text-zinc-700 dark:text-zinc-300">
                          <td className="py-3 px-2 truncate max-w-[150px]">{bs.boothName}</td>
                          <td className="py-3 text-center">{bs.total}</td>
                          <td className="py-3 text-center text-emerald-600">{bs.support}</td>
                          <td className="py-3 text-center text-zinc-455">{bs.neutral}</td>
                          <td className="py-3 text-center text-red-400">{bs.oppose}</td>
                          <td className={`py-3 text-right pr-2 ${tagClass.split(' ')[0]}`}>{bs.supportRate.toFixed(1)}%</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Scenarios & AI Engine */}
        <div className="space-y-8">
          
          {/* Winning Projection Scenario Simulator */}
          <div className="webapp-card p-6 bg-gradient-to-br from-zinc-950 to-zinc-900 text-white dark:border-zinc-800 space-y-6 relative overflow-hidden">
            <div className="absolute right-0 bottom-0 w-32 h-32 bg-zinc-800/10 rounded-full blur-3xl pointer-events-none" />
            
            <div className="space-y-2">
              <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2.5 py-1 rounded-full font-black uppercase tracking-widest">Projection Engine</span>
              <h3 className="text-lg font-black tracking-tight pt-2">Electoral Confidence Scenario</h3>
              <p className="text-xs text-zinc-400">Calibrated against historical target margins</p>
            </div>

            <div className="p-4 bg-zinc-900/80 rounded-2xl border border-zinc-800/40 space-y-3">
              <div className="flex justify-between items-center text-xs text-zinc-400">
                <span>Scenario Threshold Target</span>
                <span className="font-bold text-white">{targetWinningThreshold}%</span>
              </div>
              <input 
                type="range" 
                min="40" 
                max="75" 
                value={targetWinningThreshold} 
                onChange={(e) => setTargetWinningThreshold(Number(e.target.value))} 
                className="w-full accent-blue-500 h-1 bg-zinc-800 rounded-lg cursor-pointer" 
              />
              <div className="flex justify-between text-[9px] text-zinc-500 font-extrabold uppercase">
                <span>40% (Minimum)</span>
                <span>50% (Clear Majority)</span>
                <span>75% (Supermajority)</span>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-300">Monitored Vote Projection:</span>
                <span className="text-sm font-black">{computedAnalytics.supportPercentage.toFixed(1)}%</span>
              </div>
              
              <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
                <span className="text-xs text-zinc-300">Status Outcome:</span>
                <span className={`text-xs font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full ${
                  computedAnalytics.supportPercentage >= targetWinningThreshold 
                    ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
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
                <span className="text-xl font-black">{Math.min(100, Math.round(computedAnalytics.supportPercentage * 1.35))}%</span>
              </div>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                <div 
                  style={{ width: `${Math.min(100, Math.round(computedAnalytics.supportPercentage * 1.35))}%` }} 
                  className={`h-full rounded-full transition-all duration-300 ${
                    computedAnalytics.supportPercentage >= targetWinningThreshold ? 'bg-green-400' : 'bg-red-400'
                  }`} 
                />
              </div>
            </div>
          </div>

          {/* Predictive Outreach Directives */}
          <div className="webapp-card p-6 space-y-4">
            <div className="flex gap-2.5 items-center">
              <Flame className="text-red-500" size={18} />
              <h3 className="text-sm font-black text-zinc-900 dark:text-white tracking-tight">Electoral Status Focus</h3>
            </div>

            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-150/40 dark:border-zinc-800 space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400 font-extrabold uppercase text-[9px] tracking-wider">Projected Directives</span>
                <span className="text-blue-500 font-black uppercase text-[10px] tracking-wide">{computedAnalytics.projectionStatus}</span>
              </div>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed font-bold">
                {computedAnalytics.recommendation}
              </p>
            </div>

            {/* Swing convertor potential */}
            <div className="space-y-3 pt-2">
              <h4 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Swing Conversion Opportunities</h4>
              <div className="p-4 bg-blue-50/40 dark:bg-zinc-900/30 rounded-2xl border border-blue-500/10 flex items-start gap-3">
                <div className="p-2 bg-blue-100 dark:bg-zinc-850 text-blue-600 dark:text-blue-400 rounded-lg shrink-0">
                  <Target size={16} />
                </div>
                <div className="space-y-1">
                  <span className="text-xs font-black text-zinc-800 dark:text-zinc-200 block">Neutral Conversion Potential</span>
                  <span className="text-[11px] text-zinc-500 leading-tight block">
                    If ground karyakartas convert just <span className="text-blue-600 dark:text-blue-400 font-black">25%</span> of the logged {computedAnalytics.neutralCount} Neutral/Swing voters, your supportive share jumps to <span className="text-emerald-600 dark:text-emerald-400 font-black">{(computedAnalytics.supportPercentage + (computedAnalytics.neutralPercentage * 0.25)).toFixed(1)}%</span>.
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
