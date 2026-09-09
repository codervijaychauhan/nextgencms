import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthProvider';
import { motion } from 'motion/react';
import { 
  Shield, 
  Smartphone, 
  Globe, 
  Clock, 
  Sparkles, 
  Search,
  Users, 
  Target, 
  Flag, 
  ClipboardList, 
  SlidersHorizontal, 
  MessageSquare, 
  CheckCircle, 
  Loader2
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
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  boothId?: string;
}

interface CampaignSurvey {
  id: string;
  title: string;
  description: string;
  electionId: string;
  electionYear: number;
  assignedTo: string[];
  status: 'Draft' | 'Active' | 'Completed';
}

function GenderDonutChart({ male, female, other, total }: { male: number; female: number; other: number; total: number }) {
  const totalCount = male + female + other;
  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/10 h-[170px]">
        <span className="text-[11px] text-zinc-400">No Gender Data Available</span>
      </div>
    );
  }

  const mPct = totalCount > 0 ? (male / totalCount) * 100 : 0;
  const fPct = totalCount > 0 ? (female / totalCount) * 100 : 0;
  const oPct = totalCount > 0 ? Math.max(0, 100 - mPct - fPct) : 0;

  const circ = 238.76; // 2 * PI * 38
  
  const mStroke = (mPct / 100) * circ;
  const fStroke = (fPct / 100) * circ;
  const oStroke = (oPct / 100) * circ;

  const mOffset = circ * 0.25; // start from top
  const fOffset = mOffset - mStroke;
  const oOffset = fOffset - fStroke;

  return (
    <div className="flex flex-col sm:flex-row items-center justify-around gap-4 p-4 border border-zinc-100 dark:border-zinc-800 rounded-xl bg-zinc-50/30 dark:bg-zinc-850/10 min-h-[170px]">
      <div className="relative w-[110px] h-[110px] flex items-center justify-center">
        <svg width="110" height="110" viewBox="0 0 100 100" className="transform -rotate-90">
          <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f4f4f5" strokeWidth="10" className="dark:stroke-zinc-800" />
          {male > 0 && (
            <circle 
              cx="50" 
              cy="50" 
              r="38" 
              fill="transparent" 
              stroke="#6366f1" 
              strokeWidth="10" 
              strokeDasharray={`${mStroke} ${circ}`}
              strokeDashoffset={-mOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          )}
          {female > 0 && (
            <circle 
              cx="50" 
              cy="50" 
              r="38" 
              fill="transparent" 
              stroke="#ec4899" 
              strokeWidth="10" 
              strokeDasharray={`${fStroke} ${circ}`}
              strokeDashoffset={-fOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          )}
          {other > 0 && (
            <circle 
              cx="50" 
              cy="50" 
              r="38" 
              fill="transparent" 
              stroke="#71717a" 
              strokeWidth="10" 
              strokeDasharray={`${oStroke} ${circ}`}
              strokeDashoffset={-oOffset}
              strokeLinecap="round"
              className="transition-all duration-500 ease-out"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-xl font-extrabold text-zinc-900 dark:text-white leading-none">{total}</span>
          <span className="text-[9px] text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mt-1">Voters</span>
        </div>
      </div>

      <div className="flex flex-col gap-2 shrink-0 text-xs text-zinc-650 dark:text-zinc-450 font-medium">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded bg-indigo-500 shrink-0" />
          <span>Male: <strong className="text-zinc-900 dark:text-white">{male}</strong> <span className="text-[10px] text-zinc-400">({Math.round(mPct)}%)</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded bg-pink-500 shrink-0" />
          <span>Female: <strong className="text-zinc-900 dark:text-white">{female}</strong> <span className="text-[10px] text-zinc-400">({Math.round(fPct)}%)</span></span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded bg-zinc-500 shrink-0" />
          <span>Other: <strong className="text-zinc-900 dark:text-white">{other}</strong> <span className="text-[10px] text-zinc-400">({Math.round(oPct)}%)</span></span>
        </div>
      </div>
    </div>
  );
}

function AgeDistributionChart({ values }: { values: { label: string; count: number; fillClass: string }[] }) {
  const maxVal = Math.max(...values.map(v => v.count), 1);
  const chartHeight = 110; 
  const width = 300;
  const height = 150;
  
  return (
    <div className="p-4 border border-zinc-100 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-850/10 rounded-xl flex items-center justify-center min-h-[170px]">
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
        {/* Horizontal background lines */}
        {[0, 0.5, 1].map((p, idx) => {
          const y = 15 + (1 - p) * chartHeight;
          const displayLabel = Math.round(maxVal * p);
          return (
            <g key={idx}>
              <line 
                x1="30" y1={y} x2={width - 10} y2={y} 
                stroke="#e4e4e7" strokeWidth="1" strokeDasharray="3 3"
                className="dark:stroke-zinc-800"
              />
              <text x="24" y={y + 4} textAnchor="end" className="text-[9px] font-mono fill-zinc-400 select-none">
                {displayLabel}
              </text>
            </g>
          );
        })}

        {/* Vertical Bars */}
        {values.map((v, idx) => {
          const barWidth = 20;
          const spacing = (width - 40) / values.length;
          const x = 38 + idx * spacing;
          const barHeight = (v.count / maxVal) * chartHeight;
          const y = 15 + chartHeight - barHeight;
          
          return (
            <g key={idx} className="group cursor-pointer">
              {/* Tooltip on hover */}
              <rect
                x={x - 12} y={y - 25} width={barWidth + 24} height="20" rx="4"
                fill="#18181b" className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 fill-zinc-900 dark:fill-zinc-100"
              />
              <text 
                x={x + barWidth / 2} y={y - 12} textAnchor="middle"
                className="text-[10px] font-bold fill-white dark:fill-zinc-950 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
              >
                {v.count}
              </text>
              {/* The bar itself */}
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 2)}
                rx="4"
                className={`${v.fillClass} transition-all duration-500 ease-out origin-bottom transform`}
              />
              {/* x-axis label */}
              <text 
                x={x + barWidth / 2} 
                y={height - 2} 
                textAnchor="middle" 
                className="text-[8px] font-bold fill-zinc-500 dark:fill-zinc-400 select-none"
              >
                {v.label.split(' ')[0]}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function RadialGaugeRing({ pct, label, subtext, colorClass, strokeColor, icon: Icon }: {
  pct: number;
  label: string;
  subtext: string;
  colorClass: string;
  strokeColor: string;
  icon: React.ComponentType<{ size?: number }>;
}) {
  const r = 22;
  const circ = 2 * Math.PI * r; // ~138.2
  const dashOffset = circ - (pct / 100) * circ;

  return (
    <div className="flex items-center gap-3 p-3 bg-white dark:bg-zinc-900 border border-zinc-150 dark:border-zinc-800 rounded-xl shadow-sm hover:shadow-md transition-all">
      <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
        <svg width="56" height="56" viewBox="0 0 56 56" className="transform -rotate-90">
          <circle cx="28" cy="28" r={r} fill="transparent" stroke="#f4f4f5" strokeWidth="4.5" className="dark:stroke-zinc-800" />
          <circle 
            cx="28" 
            cy="28" 
            r={r} 
            fill="transparent" 
            stroke={strokeColor} 
            strokeWidth="4.5" 
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center ${colorClass}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-1">
          <span className="text-[9px] font-extrabold uppercase text-zinc-400 dark:text-zinc-505 tracking-wider truncate">{label}</span>
          <span className="text-xs font-black text-zinc-905 dark:text-white shrink-0">{pct}%</span>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{subtext}</p>
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, isAdmin, profile, loading: authLoading } = useAuth();
  const [reportVoters, setReportVoters] = useState<Voter[]>([]);
  const [allSentiments, setAllSentiments] = useState<Sentiment[]>([]);
  const [loadingDemographics, setLoadingDemographics] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoadingDemographics(true);
      try {
        // Fetch surveys
        const surveyList = await api.get<CampaignSurvey[]>('/api/surveys').catch(() => []);
        const activeUserSurveys = surveyList.filter(s => 
          s.assignedTo?.includes(user?.uid || '')
        );
        const assignedSurveyIds = activeUserSurveys.map(s => s.id);

        // Fetch voters from SQL API
        const votersRes = await api.get<{ data: Voter[] }>('/api/voters?limit=500').catch(() => ({ data: [] }));
        const votersList = (votersRes.data || []).map((v: any) => ({
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
        setReportVoters(votersList);

        // Fetch sentiments from SQL API
        const sentimentsList = await api.get<Sentiment[]>('/api/voter-sentiments').catch(() => []);
        setAllSentiments(sentimentsList);
      } catch (err) {
        console.error('Error fetching dashboard demographics data', err);
      } finally {
        setLoadingDemographics(false);
      }
    };

    if (user) {
      fetchData();
    }
  }, [user, isAdmin, profile]);

  const cards = [
    { title: 'Security Status', value: 'High', icon: Shield, color: 'text-green-400', bg: 'bg-green-400/10' },
    { title: 'Active Sessions', value: '2', icon: Smartphone, color: 'text-blue-400', bg: 'bg-blue-400/10' },
    { title: 'Geo Regions', value: 'Global', icon: Globe, color: 'text-purple-400', bg: 'bg-purple-400/10' },
    { title: 'Last Login', value: 'Today', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-400/10' },
  ];

  // User Scope & Demographic Analytics Calculations
  const userStatesCount = (!isAdmin && profile?.stateId) 
    ? profile.stateId.split(',').map((s: string) => s.trim()).filter(Boolean).length 
    : Array.from(new Set(reportVoters.map(v => v.stateId).filter(Boolean))).length;

  const userDistrictsCount = (!isAdmin && profile?.districtId) 
    ? profile.districtId.split(',').map((s: string) => s.trim()).filter(Boolean).length 
    : Array.from(new Set(reportVoters.map(v => v.districtId).filter(Boolean))).length;

  const userConstituenciesCount = (!isAdmin && profile?.constituencyId) 
    ? profile.constituencyId.split(',').map((s: string) => s.trim()).filter(Boolean).length 
    : Array.from(new Set(reportVoters.map(v => v.constituencyId).filter(Boolean))).length;

  const userBoothsCount = (!isAdmin && profile?.boothId) 
    ? profile.boothId.split(',').map((s: string) => s.trim()).filter(Boolean).length 
    : Array.from(new Set(reportVoters.map(v => v.boothId).filter(Boolean))).length;

  const totalAssignedVotersCount = reportVoters.length;

  // Gender demographics
  const mCount = reportVoters.filter(v => v.gender === 'Male').length;
  const fCount = reportVoters.filter(v => v.gender === 'Female').length;
  const oCount = reportVoters.filter(v => v.gender && v.gender !== 'Male' && v.gender !== 'Female').length;

  // Caste / Category demographics
  const catCounts: { [key: string]: number } = {};
  reportVoters.forEach(v => {
    const rawVal = v.caste?.trim() || '';
    let mapped = 'Unspecified';
    if (rawVal.toLowerCase().includes('gen')) mapped = 'General';
    else if (rawVal.toLowerCase().includes('obc')) mapped = 'OBC';
    else if (rawVal.toLowerCase().includes('sc')) mapped = 'SC';
    else if (rawVal.toLowerCase().includes('st')) mapped = 'ST';
    else if (rawVal) mapped = rawVal;
    catCounts[mapped] = (catCounts[mapped] || 0) + 1;
  });
  const catList = Object.keys(catCounts)
    .map(name => ({ name, count: catCounts[name] }))
    .sort((a, b) => b.count - a.count);

  // Age Cohorts
  const a18_25 = reportVoters.filter(v => v.age && v.age >= 18 && v.age <= 25).length;
  const a26_35 = reportVoters.filter(v => v.age && v.age >= 26 && v.age <= 35).length;
  const a36_50 = reportVoters.filter(v => v.age && v.age >= 36 && v.age <= 50).length;
  const a51_65 = reportVoters.filter(v => v.age && v.age >= 51 && v.age <= 65).length;
  const a65Plus = reportVoters.filter(v => v.age && v.age > 65).length;

  // Reachability parameters
  const rMobile = reportVoters.filter(v => v.mobile && v.mobile.trim().length >= 5).length;
  const rMobilePct = totalAssignedVotersCount > 0 ? Math.round((rMobile / totalAssignedVotersCount) * 100) : 0;
  const rKaryakarta = reportVoters.filter(v => v.isKaryakarta).length;
  const rVoted = reportVoters.filter(v => v.voted).length;
  const rVotedPct = totalAssignedVotersCount > 0 ? Math.round((rVoted / totalAssignedVotersCount) * 100) : 0;
  const rParticipated = reportVoters.filter(v => allSentiments.some(s => s.voterDocId === v.id || s.voterName === v.name)).length;
  const rParticipatedPct = totalAssignedVotersCount > 0 ? Math.round((rParticipated / totalAssignedVotersCount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Dashboard Overview</h1>
          <p className="text-sm text-zinc-500 mt-1">Detailed summary of your account, assigned territory, and demographics profile.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="webapp-button-secondary py-1.5 px-3 flex items-center gap-2">
            <Search size={14} />
            Search Activity
          </button>
          <button className="webapp-button-primary py-1.5 px-3">
            New Project
          </button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, i) => {
          const Icon = card.icon;
          return (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="webapp-card p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-2 rounded-lg ${card.bg} ${card.color}`}>
                  <Icon size={16} />
                </div>
                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded-md uppercase">+12%</span>
              </div>
              <div className="space-y-0.5">
                <p className="data-label">{card.title}</p>
                <p className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 tracking-tight">{card.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Territory Scope & Voter Demographics Dashboard */}
      {loadingDemographics || authLoading ? (
        <div className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-12 flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          <span className="text-xs text-zinc-500">Loading your assigned territory details...</span>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 space-y-6"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-4">
            <div>
              <h2 className="text-sm font-black uppercase text-zinc-850 dark:text-zinc-200 tracking-wider flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-purple-500" />
                My Assigned Territory & Voter Demographics Summary
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                Assigned scope, gender ratios, caste/category breakdown, and age cohort distribution linked directly to your logged-in credentials.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black px-2.5 py-1 bg-purple-500/10 text-purple-600 dark:bg-purple-950/30 dark:text-purple-400 rounded-full">
                {isAdmin ? 'System Administrator view' : 'Assigned Staff View'}
              </span>
            </div>
          </div>

          {/* Scoped Territory KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: States */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1.5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">States Assigned</span>
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 rounded-xl">
                  <Flag className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-none mt-2">
                  {isAdmin ? 'All States' : `${userStatesCount} Scoped`}
                </h3>
                <p className="text-[10px] text-zinc-500 mt-2 leading-none">Primary states coverage</p>
              </div>
            </div>

            {/* Card 2: Districts */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1.5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Districts Scoped</span>
                <div className="p-2 bg-orange-50 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-xl">
                  <Target className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-none mt-2">
                  {userDistrictsCount}
                </h3>
                <p className="text-[10px] text-zinc-500 mt-2 leading-none">Districts under management</p>
              </div>
            </div>

            {/* Card 3: Polling Booths */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1.5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Polling Booths</span>
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-xl">
                  <ClipboardList className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-none mt-2">
                  {userBoothsCount} <span className="text-xs text-zinc-400 font-semibold">in {userConstituenciesCount} Const.</span>
                </h3>
                <p className="text-[10px] text-zinc-500 mt-2 leading-none">Assigned micro polling booths</p>
              </div>
            </div>

            {/* Card 4: Voters Linked */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-1.5 hover:shadow-md transition-all">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Voters Linked</span>
                <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white leading-none mt-2">
                  {totalAssignedVotersCount}
                </h3>
                <p className="text-[10px] text-zinc-500 mt-2 leading-none">Active electorate connected</p>
              </div>
            </div>
          </div>

          {/* Demographics Details Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Box 1: Gender Distribution & Category Representation */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div>
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-indigo-500" />
                  Gender & Category Ratios
                </h4>
                <p className="text-[11px] text-zinc-500 mt-1">Electorate gender and caste/category metrics</p>
              </div>

              {/* Gender Doughnut Graph Component */}
              <GenderDonutChart male={mCount} female={fCount} other={oCount} total={totalAssignedVotersCount} />

              <div className="h-px bg-zinc-100 dark:bg-zinc-800" />

              {/* Category (Caste) Representation */}
              <div className="space-y-3">
                <h5 className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Caste & Category Representation</h5>
                {totalAssignedVotersCount === 0 ? (
                  <p className="text-xs text-zinc-400 italic">No category/caste data found</p>
                ) : (
                  <div className="space-y-2.5 max-h-[140px] overflow-y-auto pr-1">
                    {catList.map(cat => {
                      const pct = Math.round((cat.count / totalAssignedVotersCount) * 100);
                      return (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between items-center text-[11px] font-bold">
                            <span className="text-zinc-650 dark:text-zinc-350">{cat.name}</span>
                            <span className="text-zinc-800 dark:text-white font-black">{cat.count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Box 2: Dynamic Age Cohorts Distribution Graph */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div>
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Age Distribution Graph
                </h4>
                <p className="text-[11px] text-zinc-500 mt-1">Electorate broken down by age cohorts</p>
              </div>

              {/* SVG vertical column chart */}
              <AgeDistributionChart 
                values={[
                  { label: 'Youth (18-25)', count: a18_25, fillClass: 'fill-emerald-500' },
                  { label: 'Young (26-35)', count: a26_35, fillClass: 'fill-emerald-400' },
                  { label: 'Mid-Age (36-50)', count: a36_50, fillClass: 'fill-teal-500' },
                  { label: 'Seniors (51-65)', count: a51_65, fillClass: 'fill-cyan-500' },
                  { label: 'Elderly (65+)', count: a65Plus, fillClass: 'fill-sky-500' },
                ]} 
              />

              {/* Legend & Raw Cohort Details */}
              <div className="grid grid-cols-2 gap-2 text-[10px] text-zinc-500 pt-1 font-medium border-t border-zinc-50 dark:border-zinc-850">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-emerald-500 shrink-0" />
                  <span>Youth: {a18_25} voters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-emerald-400 shrink-0" />
                  <span>Pro: {a26_35} voters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-teal-500 shrink-0" />
                  <span>Mid: {a36_50} voters</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded bg-cyan-505 shrink-0" />
                  <span>Senior: {a51_65} voters</span>
                </div>
              </div>
            </div>

            {/* Box 3: Reachability, Volunteer & Participation Metrics */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-5">
              <div>
                <h4 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Reachability & Engagement Profile
                </h4>
                <p className="text-[11px] text-zinc-505 mt-1">Voters reachability & community engagement levels</p>
              </div>

              {/* Radial activity rings / gauged sectors in a polished mobile grid */}
              <div className="grid grid-cols-1 gap-3">
                {/* Ring 1: Mobile Reachability */}
                <RadialGaugeRing 
                  pct={rMobilePct} 
                  label="Mobile Coverage" 
                  subtext={`${rMobile} of ${totalAssignedVotersCount} reachable via phone`} 
                  colorClass="text-blue-500" 
                  strokeColor="#3b82f6" 
                  icon={MessageSquare} 
                />

                {/* Ring 2: Volunteer Density */}
                <RadialGaugeRing 
                  pct={totalAssignedVotersCount > 0 ? Math.round((rKaryakarta / totalAssignedVotersCount) * 100) : 0} 
                  label="Karyakarta Density" 
                  subtext={`${rKaryakarta} Karyakartas Active in booths`} 
                  colorClass="text-purple-500" 
                  strokeColor="#a855f7" 
                  icon={Users} 
                />

                {/* Ring 3: Voted Rate */}
                <RadialGaugeRing 
                  pct={rVotedPct} 
                  label="Participation Rate" 
                  subtext={`${rVoted} of ${totalAssignedVotersCount} recorded as Voted`} 
                  colorClass="text-emerald-500" 
                  strokeColor="#10b981" 
                  icon={CheckCircle} 
                />

                {/* Ring 4: Completed surveys */}
                <RadialGaugeRing 
                  pct={rParticipatedPct} 
                  label="Completed Survey Rate" 
                  subtext={`${rParticipated} of ${totalAssignedVotersCount} responded`} 
                  colorClass="text-indigo-500" 
                  strokeColor="#6366f1" 
                  icon={ClipboardList} 
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Existing Lower Cards Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-6">
          <div className="webapp-card">
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Account Information</h2>
              <button className="text-xs text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10 px-2 py-1 rounded-md transition-all">View Logs</button>
            </div>
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="p-6 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-default">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-600 dark:text-zinc-300 font-bold border border-zinc-200 dark:border-zinc-700">
                    {user?.email?.[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{user?.email}</p>
                    <p className="text-xs text-zinc-505 mt-0.5 uppercase tracking-tighter">ID: {user?.uid.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="text-[10px] data-label">Last Session</p>
                    <p className="text-xs text-zinc-400">2m ago</p>
                  </div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-widest border border-emerald-500/20">
                    Online
                  </span>
                </div>
              </div>

              <div className="p-6 flex items-center justify-between group hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all cursor-default">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 font-bold border border-blue-500/20">
                    G
                  </div>
                  <div>
                    <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Google Workspace</p>
                    <p className="text-xs text-zinc-500 mt-0.5 uppercase tracking-tighter">Connected Identity</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button className="webapp-button-secondary px-3 py-1 text-xs">Manage</button>
                </div>
              </div>
            </div>
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-200 dark:border-zinc-800 rounded-b-xl">
               <p className="text-[10px] text-zinc-500 font-medium italic">System performance is optimized based on current usage.</p>
            </div>
          </div>
        </div>

        {/* Action Sidebar */}
        <div className="space-y-6">
          <div className="webapp-card bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 p-6 flex flex-col justify-between overflow-hidden relative">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/20 blur-2xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <div className="mb-4 inline-flex items-center gap-2 px-2 py-1 bg-white/10 dark:bg-zinc-950/10 rounded-full border border-white/20 dark:border-zinc-950/20">
                <Sparkles size={12} className="text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Enterprise</span>
              </div>
              <h2 className="text-lg font-bold mb-2 tracking-tight">Expand Workspace</h2>
              <p className="text-zinc-400 dark:text-zinc-500 text-xs leading-relaxed mb-6 font-medium">
                Unlock specialized features and collaborative tools for your entire team.
              </p>
              <button className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded-lg text-xs transition-all shadow-lg shadow-blue-500/20 uppercase tracking-widest">
                Upgrade Now
              </button>
            </div>
          </div>

          <div className="webapp-card p-6">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-4">Latest Notifications</h3>
            <div className="space-y-4">
              {[1, 2].map((n) => (
                <div key={n} className="flex gap-3 pb-4 border-b border-zinc-100 dark:divide-zinc-800 last:border-0 last:pb-0">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-zinc-900 dark:text-zinc-100">Account security updated.</p>
                    <p className="text-[10px] text-zinc-500">2:44 PM</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
