import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, 
  MessageCircle, 
  Copy, 
  Check, 
  ExternalLink, 
  Sparkles, 
  Clock, 
  ShieldCheck, 
  SlidersHorizontal, 
  Columns, 
  Link as LinkIcon, 
  Trash2, 
  AlertCircle,
  Eye,
  CheckCircle2,
  Phone,
  Layers,
  HelpCircle,
  UserCheck,
  Globe,
  MapPin,
  Building2,
  Users,
  Activity,
  Coins,
  Search,
  Filter,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';

export interface FeedFilterCriteria {
  stateIds?: string[];
  districtIds?: string[];
  constituencyIds?: string[];
  mandalIds?: string[];
  panchayatIds?: string[];
  wardIds?: string[];
  boothIds?: string[];
  gender?: string;
  caste?: string;
  ageGroup?: string;
  economicCategory?: string;
  sentiment?: string;
  completeness?: string;
  isKaryakarta?: string;
  vitalStatus?: string;
  search?: string;
}

export interface BroadcastLinkSummary {
  id: string;
  token: string;
  title: string;
  filterCriteria: FeedFilterCriteria;
  columns: string[];
  expiryHours: number;
  expiresAt: string | null;
  isExpired: boolean;
  createdAt: string;
  createdBy?: string;
}

interface IndiaState {
  id: string;
  name: string;
  code?: string;
}

interface IndiaDistrict {
  id: string;
  name: string;
  stateId: string;
}

interface IndiaConstituency {
  id: string;
  name: string;
  districtId: string;
  stateId?: string;
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber?: string;
  constituencyId: string;
}

interface WhatsAppFeedModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFilters?: FeedFilterCriteria;
  filterSummaryText?: string;
  matchingCount?: number;
  states?: IndiaState[];
  districts?: IndiaDistrict[];
  constituencies?: IndiaConstituency[];
  booths?: IndiaBooth[];
}

const AVAILABLE_COLUMNS = [
  { id: 'phone', label: 'Mobile / Phone Number', desc: 'Normalized 10-digit number with country code (91)', mandatory: true },
  { id: 'name', label: 'Voter Name', desc: 'Full Name of the elector for personalized greeting', mandatory: false, default: true },
  { id: 'relation_name', label: 'Relative Name', desc: "Father's / Husband's name", mandatory: false, default: true },
  { id: 'relation_type', label: 'Relation (F/H)', desc: 'Relation type (Father, Husband, etc.)', mandatory: false, default: false },
  { id: 'epic_no', label: 'EPIC / Voter ID', desc: 'Electoral photo identity card number', mandatory: false, default: false },
  { id: 'house_no', label: 'House No', desc: 'Door / House number for family identification', mandatory: false, default: true },
  { id: 'ward_name', label: 'Ward / Village Name', desc: 'Ward, Village or Mohalla', mandatory: false, default: true },
  { id: 'booth_name', label: 'Polling Booth & Station', desc: 'Assigned polling booth name & number', mandatory: false, default: true },
  { id: 'age', label: 'Age', desc: 'Age in years', mandatory: false, default: false },
  { id: 'gender', label: 'Gender', desc: 'Male / Female / Other', mandatory: false, default: false },
  { id: 'caste', label: 'Caste / Community', desc: 'Demographic category', mandatory: false, default: false },
  { id: 'occupation', label: 'Occupation', desc: 'Job / Profession', mandatory: false, default: false },
  { id: 'voting_status', label: 'Voting Status', desc: 'Voted / Unvoted', mandatory: false, default: false },
  { id: 'party_inclination', label: 'Party Inclination', desc: 'Support / Neutral / Opposition', mandatory: false, default: false },
  { id: 'is_karyakarta', label: 'Karyakarta Status', desc: 'Party volunteer flag (Yes/No)', mandatory: false, default: false }
];

export const WhatsAppFeedModal: React.FC<WhatsAppFeedModalProps> = ({
  isOpen,
  onClose,
  currentFilters: initialFilters = {} as FeedFilterCriteria,
  filterSummaryText: initialSummary = '',
  matchingCount: initialMatchingCount = 0,
  states: propStates,
  districts: propDistricts,
  constituencies: propConstituencies,
  booths: propBooths,
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'manage'>('create');
  
  // Hierarchy Data States
  const [states, setStates] = useState<IndiaState[]>(propStates || []);
  const [districts, setDistricts] = useState<IndiaDistrict[]>(propDistricts || []);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>(propConstituencies || []);
  const [mandals, setMandals] = useState<any[]>([]);
  const [panchayats, setPanchayats] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>(propBooths || []);

  // Filter Configuration State (Section 1: Territory)
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>(initialFilters.stateIds || []);
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>(initialFilters.districtIds || []);
  const [selectedConstituencyIds, setSelectedConstituencyIds] = useState<string[]>(initialFilters.constituencyIds || []);
  const [selectedMandalIds, setSelectedMandalIds] = useState<string[]>(initialFilters.mandalIds || []);
  const [selectedPanchayatIds, setSelectedPanchayatIds] = useState<string[]>(initialFilters.panchayatIds || []);
  const [selectedWardIds, setSelectedWardIds] = useState<string[]>(initialFilters.wardIds || []);
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>(initialFilters.boothIds || []);

  // Filter Configuration State (Section 2: Demographics)
  const [filterGender, setFilterGender] = useState<string>(initialFilters.gender || 'all');
  const [filterCaste, setFilterCaste] = useState<string>(initialFilters.caste || 'all');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>(initialFilters.ageGroup || 'all');
  const [filterEconomicCategory, setFilterEconomicCategory] = useState<string>(initialFilters.economicCategory || 'all');

  // Filter Configuration State (Section 3: Political Sentiment & Status)
  const [filterSentiment, setFilterSentiment] = useState<string>(initialFilters.sentiment || 'all');
  const [filterCompleteness, setFilterCompleteness] = useState<string>(initialFilters.completeness || 'all');
  const [filterIsKaryakarta, setFilterIsKaryakarta] = useState<string>(initialFilters.isKaryakarta || 'all');
  const [filterVitalStatus, setFilterVitalStatus] = useState<string>(initialFilters.vitalStatus || 'Active');
  const [searchTerm, setSearchTerm] = useState<string>(initialFilters.search || '');

  // UI Accordion Toggles for Filter Sections
  const [isTerritoryOpen, setIsTerritoryOpen] = useState(true);
  const [isDemographicsOpen, setIsDemographicsOpen] = useState(true);
  const [isSentimentOpen, setIsSentimentOpen] = useState(true);

  // Form State
  const [feedTitle, setFeedTitle] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'phone',
    'name',
    'relation_name',
    'house_no',
    'ward_name',
    'booth_name'
  ]);
  const [expiryHours, setExpiryHours] = useState<number>(24);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<{
    id: string;
    token: string;
    url: string;
    expiresAt: string | null;
    title: string;
  } | null>(null);

  // Active links list
  const [activeLinks, setActiveLinks] = useState<BroadcastLinkSummary[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Live Recipient Count State
  const [estimatedCount, setEstimatedCount] = useState<number>(initialMatchingCount || 0);
  const [calculatingCount, setCalculatingCount] = useState(false);

  // Load Hierarchy Data if not provided via props
  useEffect(() => {
    if (isOpen) {
      if (!propStates || propStates.length === 0) {
        api.get<IndiaState[]>('/api/states')
          .then(s => setStates(s.map((item: any) => ({ ...item, id: String(item.id) }))))
          .catch(console.error);
      }
      if (!propDistricts || propDistricts.length === 0) {
        api.get<IndiaDistrict[]>('/api/districts')
          .then(d => setDistricts(d.map((item: any) => ({ ...item, id: String(item.id), stateId: String(item.state_id || item.stateId) }))))
          .catch(console.error);
      }
      if (!propConstituencies || propConstituencies.length === 0) {
        api.get<IndiaConstituency[]>('/api/constituencies')
          .then(c => setConstituencies(c.map((item: any) => ({ ...item, id: String(item.id), districtId: String(item.district_id || item.districtId) }))))
          .catch(console.error);
      }
      api.get<any[]>('/api/mandals')
        .then(m => setMandals(m.map((x: any) => ({ ...x, id: String(x.id), constituencyId: String(x.constituency_id || x.constituencyId) }))))
        .catch(console.error);
      api.get<any[]>('/api/panchayats')
        .then(p => setPanchayats(p.map((x: any) => ({ ...x, id: String(x.id), mandalId: String(x.mandal_id || x.mandalId) }))))
        .catch(console.error);
      api.get<any[]>('/api/wards')
        .then(w => setWards(w.map((x: any) => ({ ...x, id: String(x.id), panchayatId: String(x.panchayat_id || x.panchayatId) }))))
        .catch(console.error);
      if (!propBooths || propBooths.length === 0) {
        api.get<IndiaBooth[]>('/api/booths')
          .then(b => setBooths(b.map((item: any) => ({ ...item, id: String(item.id), constituencyId: String(item.constituency_id || item.constituencyId) }))))
          .catch(console.error);
      }
    }
  }, [isOpen, propStates, propDistricts, propConstituencies, propBooths]);

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      setFeedTitle(`WhatsApp Voter Broadcast - ${dateStr}`);
      setGeneratedLink(null);
      setSuccessMessage('');
      setErrorMessage('');
      loadActiveLinks();

      // Pre-fill filter states from props
      setSelectedStateIds(initialFilters.stateIds || []);
      setSelectedDistrictIds(initialFilters.districtIds || []);
      setSelectedConstituencyIds(initialFilters.constituencyIds || []);
      setSelectedMandalIds(initialFilters.mandalIds || []);
      setSelectedPanchayatIds(initialFilters.panchayatIds || []);
      setSelectedWardIds(initialFilters.wardIds || []);
      setSelectedBoothIds(initialFilters.boothIds || []);
      setFilterGender(initialFilters.gender || 'all');
      setFilterCaste(initialFilters.caste || 'all');
      setFilterAgeGroup(initialFilters.ageGroup || 'all');
      setFilterEconomicCategory(initialFilters.economicCategory || 'all');
      setFilterSentiment(initialFilters.sentiment || 'all');
      setFilterCompleteness(initialFilters.completeness || 'all');
      setFilterIsKaryakarta(initialFilters.isKaryakarta || 'all');
      setFilterVitalStatus(initialFilters.vitalStatus || 'Active');
      setSearchTerm(initialFilters.search || '');
    }
  }, [isOpen, initialFilters]);

  // Compute Active Filter count inside the modal
  const activeModalFilterCount = useMemo(() => {
    let count = 0;
    if (selectedStateIds.length > 0) count++;
    if (selectedDistrictIds.length > 0) count++;
    if (selectedConstituencyIds.length > 0) count++;
    if (selectedMandalIds.length > 0) count++;
    if (selectedPanchayatIds.length > 0) count++;
    if (selectedWardIds.length > 0) count++;
    if (selectedBoothIds.length > 0) count++;
    if (filterGender !== 'all') count++;
    if (filterCaste !== 'all') count++;
    if (filterAgeGroup !== 'all') count++;
    if (filterEconomicCategory !== 'all') count++;
    if (filterSentiment !== 'all') count++;
    if (filterCompleteness !== 'all') count++;
    if (filterIsKaryakarta !== 'all') count++;
    if (filterVitalStatus !== 'Active') count++;
    if (searchTerm.trim()) count++;
    return count;
  }, [
    selectedStateIds, selectedDistrictIds, selectedConstituencyIds, selectedMandalIds,
    selectedPanchayatIds, selectedWardIds, selectedBoothIds, filterGender, filterCaste,
    filterAgeGroup, filterEconomicCategory, filterSentiment, filterCompleteness,
    filterIsKaryakarta, filterVitalStatus, searchTerm
  ]);

  // Filtered dropdown options with cascading
  const filteredDistricts = useMemo(() => {
    if (selectedStateIds.length === 0) return districts;
    return districts.filter(d => selectedStateIds.includes(d.stateId));
  }, [districts, selectedStateIds]);

  const filteredConstituencies = useMemo(() => {
    if (selectedDistrictIds.length === 0) return constituencies;
    return constituencies.filter(c => selectedDistrictIds.includes(c.districtId));
  }, [constituencies, selectedDistrictIds]);

  const filteredMandals = useMemo(() => {
    if (selectedConstituencyIds.length === 0) return mandals;
    return mandals.filter(m => selectedConstituencyIds.includes(m.constituencyId));
  }, [mandals, selectedConstituencyIds]);

  const filteredPanchayats = useMemo(() => {
    if (selectedMandalIds.length === 0) return panchayats;
    return panchayats.filter(p => selectedMandalIds.includes(p.mandalId));
  }, [panchayats, selectedMandalIds]);

  const filteredWards = useMemo(() => {
    if (selectedPanchayatIds.length === 0) return wards;
    return wards.filter(w => selectedPanchayatIds.includes(w.panchayatId));
  }, [wards, selectedPanchayatIds]);

  const filteredBooths = useMemo(() => {
    if (selectedConstituencyIds.length === 0) return booths;
    return booths.filter(b => selectedConstituencyIds.includes(b.constituencyId));
  }, [booths, selectedConstituencyIds]);

  const assembledFilterCriteria: FeedFilterCriteria = useMemo(() => ({
    stateIds: selectedStateIds,
    districtIds: selectedDistrictIds,
    constituencyIds: selectedConstituencyIds,
    mandalIds: selectedMandalIds,
    panchayatIds: selectedPanchayatIds,
    wardIds: selectedWardIds,
    boothIds: selectedBoothIds,
    gender: filterGender,
    caste: filterCaste,
    ageGroup: filterAgeGroup,
    economicCategory: filterEconomicCategory,
    sentiment: filterSentiment,
    completeness: filterCompleteness,
    isKaryakarta: filterIsKaryakarta,
    vitalStatus: filterVitalStatus,
    search: searchTerm
  }), [
    selectedStateIds, selectedDistrictIds, selectedConstituencyIds, selectedMandalIds,
    selectedPanchayatIds, selectedWardIds, selectedBoothIds, filterGender, filterCaste,
    filterAgeGroup, filterEconomicCategory, filterSentiment, filterCompleteness,
    filterIsKaryakarta, filterVitalStatus, searchTerm
  ]);

  const loadActiveLinks = async () => {
    setLoadingLinks(true);
    try {
      const list = await api.get<BroadcastLinkSummary[]>('/api/broadcast-links');
      setActiveLinks(list || []);
    } catch (err) {
      console.warn('Failed to load active broadcast links:', err);
    } finally {
      setLoadingLinks(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedStateIds([]);
    setSelectedDistrictIds([]);
    setSelectedConstituencyIds([]);
    setSelectedMandalIds([]);
    setSelectedPanchayatIds([]);
    setSelectedWardIds([]);
    setSelectedBoothIds([]);
    setFilterGender('all');
    setFilterCaste('all');
    setFilterAgeGroup('all');
    setFilterEconomicCategory('all');
    setFilterSentiment('all');
    setFilterCompleteness('all');
    setFilterIsKaryakarta('all');
    setFilterVitalStatus('Active');
    setSearchTerm('');
  };

  const toggleColumn = (colId: string) => {
    if (colId === 'phone') return; // Mandatory
    setSelectedColumns(prev => 
      prev.includes(colId) ? prev.filter(c => c !== colId) : [...prev, colId]
    );
  };

  const handleSelectAllColumns = () => {
    setSelectedColumns(AVAILABLE_COLUMNS.map(c => c.id));
  };

  const handleResetColumns = () => {
    setSelectedColumns(['phone', 'name', 'relation_name', 'house_no', 'ward_name', 'booth_name']);
  };

  const handleGenerateLink = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await api.post<{
        success: boolean;
        id: string;
        token: string;
        title: string;
        expiresAt: string | null;
        url: string;
      }>('/api/broadcast-links', {
        title: feedTitle.trim() || 'WhatsApp Voter Broadcast',
        filterCriteria: assembledFilterCriteria,
        columns: selectedColumns,
        expiryHours
      });

      if (res && res.success) {
        const fullUrl = `${window.location.origin}${res.url}`;
        setGeneratedLink({
          id: res.id,
          token: res.token,
          url: fullUrl,
          expiresAt: res.expiresAt,
          title: res.title
        });
        setSuccessMessage('Randomized broadcast feed URL generated successfully!');
        loadActiveLinks();
      } else {
        setErrorMessage('Failed to generate broadcast URL.');
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Error creating broadcast URL.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = (urlToCopy: string, tokenKey: string) => {
    navigator.clipboard.writeText(urlToCopy);
    setCopiedToken(tokenKey);
    setTimeout(() => {
      setCopiedToken(null);
    }, 2500);
  };

  const handleRevokeLink = async (idOrToken: string) => {
    if (!window.confirm('Are you sure you want to revoke this broadcast link? WhatsApp extensions will immediately lose access to this feed.')) {
      return;
    }

    try {
      await api.delete(`/api/broadcast-links/${idOrToken}`);
      setActiveLinks(prev => prev.filter(l => l.id !== idOrToken && l.token !== idOrToken));
      if (generatedLink && (generatedLink.id === idOrToken || generatedLink.token === idOrToken)) {
        setGeneratedLink(null);
      }
    } catch (err: any) {
      alert(`Failed to revoke link: ${err?.message || 'Server error'}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      {/* Backdrop */}
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-black/75 backdrop-blur-md" 
      />

      {/* Modal Dialog */}
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: 15 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: 15 }} 
        className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden z-10 text-zinc-900 dark:text-zinc-100"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/80 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <MessageCircle size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                  WhatsApp Extension Live Feed
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
                  Targeted Stream
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Filter electors by territory, demographics &amp; sentiment to stream numbers directly to your extension.
              </p>
            </div>
          </div>
          
          <button 
            onClick={onClose} 
            className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 px-5 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'create'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Sparkles size={14} /> Filter &amp; Generate Feed
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manage')}
            className={`pb-2.5 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
              activeTab === 'manage'
                ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <Layers size={14} /> Active Links ({activeLinks.length})
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">

          {/* TAB 1: CREATE NEW FEED LINK WITH INTEGRATED FILTERS */}
          {activeTab === 'create' && (
            <div className="space-y-5">
              
              {/* Filter Scoping Toolbar & Search */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Filter size={15} className="text-emerald-500" />
                    <span className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider">
                      Target Audience Filters
                    </span>
                    {activeModalFilterCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                        {activeModalFilterCount} Active
                      </span>
                    )}
                  </div>
                  {activeModalFilterCount > 0 && (
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="text-[11px] font-bold text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1 self-start sm:self-auto"
                    >
                      <RotateCcw size={12} /> Clear All Filters
                    </button>
                  )}
                </div>

                {/* Optional Search Query */}
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                  <input
                    type="text"
                    placeholder="Filter by name, mobile, EPIC or house number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full h-10 pl-9 pr-8 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white font-medium"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-0.5"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>

              {/* SECTION 1: GEOGRAPHIC TERRITORY HIERARCHY (7-TIER CASCADING) */}
              <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div 
                  onClick={() => setIsTerritoryOpen(!isTerritoryOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Globe size={15} className="text-blue-500" />
                    <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider">
                      1. Geographic Territory Hierarchy
                    </h4>
                    <span className="text-[10px] text-zinc-400">(7-Level Cascading)</span>
                  </div>
                  {isTerritoryOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                </div>

                {isTerritoryOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    {/* 1. State */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">1. State</label>
                      <select
                        value={selectedStateIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedStateIds(val ? [val] : []);
                          setSelectedDistrictIds([]);
                          setSelectedConstituencyIds([]);
                          setSelectedMandalIds([]);
                          setSelectedPanchayatIds([]);
                          setSelectedWardIds([]);
                          setSelectedBoothIds([]);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All States</option>
                        {states.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 2. District */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">2. District</label>
                      <select
                        value={selectedDistrictIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedDistrictIds(val ? [val] : []);
                          setSelectedConstituencyIds([]);
                          setSelectedMandalIds([]);
                          setSelectedPanchayatIds([]);
                          setSelectedWardIds([]);
                          setSelectedBoothIds([]);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Districts</option>
                        {filteredDistricts.map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 3. Constituency */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">3. Constituency</label>
                      <select
                        value={selectedConstituencyIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedConstituencyIds(val ? [val] : []);
                          setSelectedMandalIds([]);
                          setSelectedPanchayatIds([]);
                          setSelectedWardIds([]);
                          setSelectedBoothIds([]);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Constituencies</option>
                        {filteredConstituencies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 4. Block / Area / Mandal */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">4. Block / Area</label>
                      <select
                        value={selectedMandalIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedMandalIds(val ? [val] : []);
                          setSelectedPanchayatIds([]);
                          setSelectedWardIds([]);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Blocks</option>
                        {filteredMandals.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 5. Panchayat / ULB */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">5. Panchayat / ULB</label>
                      <select
                        value={selectedPanchayatIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedPanchayatIds(val ? [val] : []);
                          setSelectedWardIds([]);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Panchayats</option>
                        {filteredPanchayats.map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* 6. Ward / Village */}
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">6. Ward / Village</label>
                      <select
                        value={selectedWardIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedWardIds(val ? [val] : []);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Wards / Villages</option>
                        {filteredWards.map(w => (
                          <option key={w.id} value={w.id}>
                            {w.wardNumber ? `Ward #${w.wardNumber} - ` : ''}{w.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 7. Polling Booth */}
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">7. Polling Booth</label>
                      <select
                        value={selectedBoothIds[0] || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setSelectedBoothIds(val ? [val] : []);
                        }}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="">All Polling Booths</option>
                        {filteredBooths.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.boothNumber ? `Booth #${b.boothNumber} - ` : ''}{b.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 2: DEMOGRAPHIC & SOCIO-ECONOMIC FILTERS */}
              <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div 
                  onClick={() => setIsDemographicsOpen(!isDemographicsOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Users size={15} className="text-purple-500" />
                    <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider">
                      2. Demographic &amp; Socio-Economic Filters
                    </h4>
                  </div>
                  {isDemographicsOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                </div>

                {isDemographicsOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Gender</label>
                      <select
                        value={filterGender}
                        onChange={(e) => setFilterGender(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Genders</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Caste / Category</label>
                      <select
                        value={filterCaste}
                        onChange={(e) => setFilterCaste(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Castes</option>
                        <option value="General">General</option>
                        <option value="OBC">OBC</option>
                        <option value="SC">SC</option>
                        <option value="ST">ST</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Age Group</label>
                      <select
                        value={filterAgeGroup}
                        onChange={(e) => setFilterAgeGroup(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Ages</option>
                        <option value="18-25">18 - 25 (Youth)</option>
                        <option value="26-35">26 - 35 (Young Adults)</option>
                        <option value="36-50">36 - 50 (Middle Age)</option>
                        <option value="50-60">50 - 60</option>
                        <option value="60+">60+ (Senior Citizens)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Economic Category</label>
                      <select
                        value={filterEconomicCategory}
                        onChange={(e) => setFilterEconomicCategory(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Categories</option>
                        <option value="BPL">BPL</option>
                        <option value="APL">APL</option>
                        <option value="EWS">EWS</option>
                        <option value="Antyodaya">Antyodaya</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: POLITICAL SENTIMENT, ROLES & STATUS */}
              <div className="p-4 bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div 
                  onClick={() => setIsSentimentOpen(!isSentimentOpen)}
                  className="flex items-center justify-between cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2">
                    <Activity size={15} className="text-amber-500" />
                    <h4 className="text-xs font-black uppercase text-zinc-800 dark:text-zinc-200 tracking-wider">
                      3. Political Sentiment, Roles &amp; Vital Status
                    </h4>
                  </div>
                  {isSentimentOpen ? <ChevronUp size={16} className="text-zinc-400" /> : <ChevronDown size={16} className="text-zinc-400" />}
                </div>

                {isSentimentOpen && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-zinc-100 dark:border-zinc-800/80">
                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Voter Sentiment</label>
                      <select
                        value={filterSentiment}
                        onChange={(e) => setFilterSentiment(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Sentiments</option>
                        <option value="Strong Supporter">Strong Supporter</option>
                        <option value="Favorable">Favorable</option>
                        <option value="Neutral">Neutral</option>
                        <option value="Opposition">Opposition</option>
                        <option value="Support">Support</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Volunteer Status</label>
                      <select
                        value={filterIsKaryakarta}
                        onChange={(e) => setFilterIsKaryakarta(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">All Roles</option>
                        <option value="yes">Karyakartas / Volunteers Only</option>
                        <option value="no">General Voters Only</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Vital Status</label>
                      <select
                        value={filterVitalStatus}
                        onChange={(e) => setFilterVitalStatus(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="Active">Active Only</option>
                        <option value="all">All Statuses</option>
                        <option value="Deceased">Deceased</option>
                        <option value="Migrated/Shifted">Migrated / Shifted</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase text-zinc-400 mb-1">Profile Completeness</label>
                      <select
                        value={filterCompleteness}
                        onChange={(e) => setFilterCompleteness(e.target.value)}
                        className="w-full h-9 px-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs font-bold text-zinc-800 dark:text-zinc-200"
                      >
                        <option value="all">Any % Complete</option>
                        <option value="complete">100% Complete</option>
                        <option value="high">Above 75%</option>
                        <option value="medium">Above 50%</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* Feed Title & Expiry Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                    Broadcast Campaign Name
                  </label>
                  <input
                    type="text"
                    value={feedTitle}
                    onChange={(e) => setFeedTitle(e.target.value)}
                    placeholder="e.g. Ward 4 Youth Registration Drive"
                    className="w-full h-11 px-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">
                    Link Expiry Time
                  </label>
                  <select
                    value={expiryHours}
                    onChange={(e) => setExpiryHours(Number(e.target.value))}
                    className="w-full h-11 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 text-xs font-bold text-zinc-900 dark:text-white focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value={1}>1 Hour (Strict)</option>
                    <option value={6}>6 Hours</option>
                    <option value={24}>24 Hours (1 Day)</option>
                    <option value={72}>72 Hours (3 Days)</option>
                    <option value={168}>7 Days</option>
                    <option value={0}>Never Expire</option>
                  </select>
                </div>
              </div>

              {/* Column Selection Grid */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Columns size={14} className="text-emerald-500" />
                    <span className="text-xs font-black uppercase text-zinc-700 dark:text-zinc-300 tracking-wider">
                      Select Columns for Extension Placeholders
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSelectAllColumns}
                      className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                    >
                      Select All
                    </button>
                    <span className="text-zinc-300 dark:text-zinc-700">&bull;</span>
                    <button
                      type="button"
                      onClick={handleResetColumns}
                      className="text-[11px] font-bold text-zinc-500 hover:underline"
                    >
                      Reset Default
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {AVAILABLE_COLUMNS.map((col) => {
                    const isSelected = selectedColumns.includes(col.id);
                    return (
                      <div
                        key={col.id}
                        onClick={() => toggleColumn(col.id)}
                        className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-start gap-2.5 ${
                          isSelected
                            ? 'bg-emerald-50/60 dark:bg-emerald-950/25 border-emerald-300 dark:border-emerald-800/60 text-zinc-900 dark:text-white'
                            : 'bg-zinc-50/50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:border-zinc-300 dark:hover:border-zinc-700'
                        } ${col.mandatory ? 'cursor-not-allowed opacity-90' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={col.mandatory}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
                        />
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold truncate">{col.label}</span>
                            {col.mandatory && (
                              <span className="text-[9px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 rounded">
                                Req
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">{col.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Generate Action Button */}
              {!generatedLink && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerateLink}
                    disabled={isGenerating}
                    className="w-full py-3.5 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
                  >
                    <Sparkles size={16} />
                    <span>{isGenerating ? 'Generating Unique Feed...' : `Generate WhatsApp Feed URL (${selectedColumns.length} Columns)`}</span>
                  </button>
                </div>
              )}

              {/* Generated Result Box */}
              {generatedLink && (
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border border-emerald-500/30 space-y-4 animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-300 font-bold text-xs sm:text-sm">
                      <CheckCircle2 size={18} className="text-emerald-600" />
                      <span>Ready! Paste this URL in your WhatsApp Extension:</span>
                    </div>
                    <span className="text-[10px] font-mono text-zinc-500">
                      Token: {generatedLink.token}
                    </span>
                  </div>

                  {/* URL Display with 1-Click Copy */}
                  <div className="flex items-center gap-2 bg-white dark:bg-zinc-950 p-2 rounded-xl border border-emerald-500/40">
                    <LinkIcon size={16} className="text-emerald-500 shrink-0 ml-1.5" />
                    <input
                      type="text"
                      readOnly
                      value={generatedLink.url}
                      className="w-full text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200 bg-transparent focus:outline-hidden"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopyLink(generatedLink.url, generatedLink.token)}
                      className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
                    >
                      {copiedToken === generatedLink.token ? (
                        <>
                          <Check size={14} />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={14} />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                    <a
                      href={generatedLink.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all shrink-0"
                      title="Open Live Feed in New Tab"
                    >
                      <ExternalLink size={16} />
                    </a>
                  </div>

                  {/* Extension Instructions Step-by-Step */}
                  <div className="p-3 bg-white/70 dark:bg-zinc-900/70 rounded-xl border border-emerald-500/20 text-xs text-zinc-600 dark:text-zinc-300 space-y-1.5">
                    <p className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                      <HelpCircle size={14} className="text-emerald-500" /> Quick WhatsApp Extension Instructions:
                    </p>
                    <ol className="list-decimal list-inside space-y-1 text-[11px] text-zinc-600 dark:text-zinc-400 pl-1">
                      <li>Click <strong>Copy Link</strong> or <strong>Open in New Tab</strong>.</li>
                      <li>In your WhatsApp Bulk Extension, select <strong>"Upload from URL"</strong> or <strong>"Scrape Tab"</strong> and paste this link.</li>
                      <li>The extension will auto-detect the voter recipient numbers and custom placeholder tags without downloading your raw database file.</li>
                    </ol>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: MANAGE ACTIVE LINKS */}
          {activeTab === 'manage' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-500">Active Live Feed Streams:</span>
                <button
                  type="button"
                  onClick={loadActiveLinks}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline text-[11px] font-bold"
                >
                  Refresh Links
                </button>
              </div>

              {loadingLinks ? (
                <div className="py-12 text-center text-zinc-500 text-xs">Loading active links...</div>
              ) : activeLinks.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-900 text-zinc-400 flex items-center justify-center mx-auto">
                    <LinkIcon size={20} />
                  </div>
                  <p className="text-xs font-bold text-zinc-400">No active broadcast links found.</p>
                  <p className="text-[11px] text-zinc-500">Generate a new stream link above to send WhatsApp messages.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeLinks.map((link) => {
                    const fullUrl = `${window.location.origin}/broadcast-feed/${link.token}`;
                    return (
                      <div
                        key={link.id}
                        className="p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-900/50 space-y-3"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                                {link.title}
                              </h4>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                link.isExpired ? 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400'
                              }`}>
                                {link.isExpired ? 'Expired' : 'Active'}
                              </span>
                            </div>
                            <p className="text-[11px] text-zinc-500 mt-0.5">
                              Created: {new Date(link.createdAt).toLocaleString()} &bull; Columns: {link.columns?.join(', ')}
                            </p>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-center">
                            <button
                              type="button"
                              onClick={() => handleCopyLink(fullUrl, link.token)}
                              className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold transition-all flex items-center gap-1"
                              title="Copy Link"
                            >
                              {copiedToken === link.token ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                            </button>
                            <a
                              href={fullUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 text-xs font-bold transition-all flex items-center gap-1"
                              title="Open Live Feed"
                            >
                              <ExternalLink size={14} />
                            </a>
                            <button
                              type="button"
                              onClick={() => handleRevokeLink(link.id || link.token)}
                              className="p-2 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/60 transition-all"
                              title="Revoke and Invalidate this Link"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 p-2 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200 dark:border-zinc-800 font-mono text-[11px] text-zinc-600 dark:text-zinc-400 truncate">
                          <span className="truncate flex-1">{fullUrl}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center gap-2 text-[11px] text-zinc-500">
            <ShieldCheck size={14} className="text-emerald-500" />
            <span>Encrypted endpoint stream for WhatsApp automation</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 text-xs font-bold uppercase tracking-wider hover:opacity-90 transition-all"
          >
            Close
          </button>
        </div>

      </motion.div>
    </div>
  );
};

export default WhatsAppFeedModal;
