import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  MapPin, 
  X,
  Save,
  Flag,
  Globe,
  Upload,
  AlertCircle,
  Users,
  Home,
  UserSquare2,
  UserCheck,
  FileSpreadsheet,
  Download,
  AlertTriangle,
  Eye,
  Activity,
  Coins,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  Edit3,
  Phone,
  Mail,
  Calendar,
  Building2,
  Copy,
  Check,
  ExternalLink,
  FileText,
  Sparkles,
  ShieldCheck,
  Briefcase,
  GraduationCap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import BulkImportModal from './BulkImportModal';
import { useTableColumns, ColumnDef } from '../hooks/useTableColumns';
import { TableColumnManager } from './common/TableColumnManager';

type VoterColumnKey = 
  | 'slNo'
  | 'voterId'
  | 'aadharNumber'
  | 'name'
  | 'relationName'
  | 'gender'
  | 'age'
  | 'caste'
  | 'houseNo'
  | 'village'
  | 'mandal'
  | 'booth'
  | 'mobile'
  | 'additionalMobile'
  | 'email'
  | 'sentiment'
  | 'favoredParty'
  | 'isVolunteer'
  | 'profileComplete'
  | 'actions';

const DEFAULT_VOTER_COLUMNS: ColumnDef<VoterColumnKey>[] = [
  { id: 'voterId', label: 'EPIC / Voter ID', category: 'Identity', required: true, defaultVisible: true, minWidth: '130px' },
  { id: 'name', label: 'Voter Name', category: 'General', required: true, defaultVisible: true, minWidth: '160px' },
  { id: 'relationName', label: 'Father / Relative', category: 'General', defaultVisible: true, minWidth: '150px' },
  { id: 'gender', label: 'Gender / Sex', category: 'Demographics', defaultVisible: true, minWidth: '70px' },
  { id: 'age', label: 'Age', category: 'Demographics', defaultVisible: true, minWidth: '70px' },
  { id: 'mobile', label: 'Primary Mobile', category: 'Contact', defaultVisible: true, minWidth: '120px' },
  { id: 'favoredParty', label: 'Favored Party', category: 'Intelligence', defaultVisible: true, minWidth: '140px' },
  { id: 'profileComplete', label: 'Profile Completion', category: 'Status', defaultVisible: true, minWidth: '130px' },
  { id: 'actions', label: 'Actions', category: 'Controls', required: true, defaultVisible: true, minWidth: '100px' },
  
  // Additional database fields available to show/hide in the Column Customizer
  { id: 'slNo', label: 'Sl No', category: 'General', defaultVisible: false, minWidth: '60px' },
  { id: 'aadharNumber', label: 'Aadhaar Number', category: 'Identity', defaultVisible: false, minWidth: '130px' },
  { id: 'caste', label: 'Caste / Community', category: 'Demographics', defaultVisible: false, minWidth: '110px' },
  { id: 'houseNo', label: 'House Number', category: 'Address', defaultVisible: false, minWidth: '100px' },
  { id: 'village', label: 'Village / Street', category: 'Address', defaultVisible: false, minWidth: '130px' },
  { id: 'mandal', label: 'Mandal / Block', category: 'Address', defaultVisible: false, minWidth: '120px' },
  { id: 'booth', label: 'Polling Station / Booth', category: 'Location', defaultVisible: false, minWidth: '150px' },
  { id: 'additionalMobile', label: 'Alternate Mobile', category: 'Contact', defaultVisible: false, minWidth: '120px' },
  { id: 'email', label: 'Email Address', category: 'Contact', defaultVisible: false, minWidth: '150px' },
  { id: 'sentiment', label: 'Political Sentiment', category: 'Intelligence', defaultVisible: false, minWidth: '130px' },
  { id: 'isVolunteer', label: 'Volunteer Status', category: 'Intelligence', defaultVisible: false, minWidth: '110px' },
];

export const DEFAULT_FALLBACK_PARTIES = [
  { id: 'bjp', name: 'Bharatiya Janata Party', code: 'BJP', color: '#f97316' },
  { id: 'inc', name: 'Indian National Congress', code: 'INC', color: '#3b82f6' },
  { id: 'aap', name: 'Aam Aadmi Party', code: 'AAP', color: '#06b6d4' },
  { id: 'bsp', name: 'Bahujan Samaj Party', code: 'BSP', color: '#1d4ed8' },
  { id: 'sp', name: 'Samajwadi Party', code: 'SP', color: '#dc2626' },
  { id: 'cpi_m', name: 'Communist Party of India (Marxist)', code: 'CPI(M)', color: '#b91c1c' },
  { id: 'ncp', name: 'Nationalist Congress Party', code: 'NCP', color: '#059669' },
  { id: 'tmc', name: 'All India Trinamool Congress', code: 'AITC', color: '#10b981' },
  { id: 'shiv_sena', name: 'Shiv Sena', code: 'SS', color: '#ea580c' },
  { id: 'jdu', name: 'Janata Dal (United)', code: 'JD(U)', color: '#16a34a' },
  { id: 'rjd', name: 'Rashtriya Janata Dal', code: 'RJD', color: '#15803d' },
  { id: 'ind', name: 'Independent / Other', code: 'IND', color: '#6b7280' },
];

interface IndiaState {
  id: string;
  name: string;
  code: string;
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
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber: string;
  constituencyId: string;
}

interface Voter {
  id: string;
  voterId: string; // EPIC No
  name: string;
  relationName?: string; // Father / Husband Name
  aadharNumber?: string;
  gender: 'Male' | 'Female' | 'Other' | string;
  age: number;
  dob?: string;
  mobile?: string;
  email?: string;
  additionalMobile?: string;
  address?: string;
  newAddress?: string;
  houseNo?: string;
  village?: string;
  caste?: string;
  occupation?: string;
  isKaryakarta: boolean;
  voted: boolean;
  partNo?: string;
  srNo?: string;
  stateId: string;
  districtId: string;
  constituencyId: string;
  boothId: string;
  vitalStatus?: 'Active' | 'Deceased' | 'Migrated/Shifted' | string;
  physicalProfile?: 'General' | 'PwD' | 'Senior Citizen' | 'Chronic Illness' | string;
  disabilityCategory?: 'None' | 'Locomotor' | 'Visual' | 'Speech & Hearing' | 'Other' | string;
  eciAssistanceNeeded?: boolean;
  economicCategory?: 'BPL' | 'APL' | 'EWS' | string;
  incomeRange?: 'Under ₹15,000' | '₹15,000 - ₹30,000' | '₹30,000 - ₹60,000' | 'Above ₹60,000' | string;
  landOwnership?: 'Landless' | 'Small Farmer' | 'Marginal Farmer' | 'Large Landowner' | 'Urban Commercial/Residential Only' | string;
  education?: string;
  createdAt?: any;
  updatedAt?: any;
}

const calculateAge = (dobString: string): number => {
  if (!dobString) return 18;
  const today = new Date();
  const birthDate = new Date(dobString);
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return Math.max(0, age);
};

const VoterManagement: React.FC = () => {
  const { user, isAdmin, isSuperAdmin, isManager, profile } = useAuth();
  
  const isVolunteer = (profile?.role === 'volunteer' || profile?.role === 'karyakarta') && !isAdmin && !isManager && !isSuperAdmin;

  const hasRight = (moduleId: string, right: string) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.rights?.[moduleId] || '';
    return perms.includes(right);
  };
  
  // Hierarchy Data
  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);
  
  // Voter Data
  const [voters, setVoters] = useState<Voter[]>([]);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  
  // Loading states
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  
  // Filter states
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [selectedStateIds, setSelectedStateIds] = useState<string[]>([]);
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const [isStateDropdownOpen, setIsStateDropdownOpen] = useState(false);
  const [stateSearchText, setStateSearchText] = useState('');

  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedDistrictIds, setSelectedDistrictIds] = useState<string[]>([]);
  const districtDropdownRef = useRef<HTMLDivElement>(null);
  const [isDistrictDropdownOpen, setIsDistrictDropdownOpen] = useState(false);
  const [districtSearchText, setDistrictSearchText] = useState('');

  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>('all');
  const [selectedConstituencyIds, setSelectedConstituencyIds] = useState<string[]>([]);
  const constituencyDropdownRef = useRef<HTMLDivElement>(null);
  const [isConstituencyDropdownOpen, setIsConstituencyDropdownOpen] = useState(false);
  const [constituencySearchText, setConstituencySearchText] = useState('');

  const [selectedBoothId, setSelectedBoothId] = useState<string>('all');
  const [selectedBoothIds, setSelectedBoothIds] = useState<string[]>([]);
  const boothDropdownRef = useRef<HTMLDivElement>(null);
  const [isBoothDropdownOpen, setIsBoothDropdownOpen] = useState(false);
  const [boothSearchText, setBoothSearchText] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Table Column Manager with local persistence
  const voterColumnManager = useTableColumns('voters_table_v2', DEFAULT_VOTER_COLUMNS);
  
  // Advanced Filter state variables
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterGender, setFilterGender] = useState<string>('all');
  const [filterCaste, setFilterCaste] = useState<string>('all');
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>('all');
  const [filterEconomicCategory, setFilterEconomicCategory] = useState<string>('all');
  const [filterSentiment, setFilterSentiment] = useState<string>('all');
  const [filterCompleteness, setFilterCompleteness] = useState<string>('all');
  const [filterIsKaryakarta, setFilterIsKaryakarta] = useState<string>('all');
  const [filterVitalStatus, setFilterVitalStatus] = useState<string>('Active');
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'view' | 'edit'>('view');
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const handleCopy = (text: string, fieldName: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [activeFormTab, setActiveFormTab] = useState<'main' | 'contact' | 'health_economy' | 'political_sentiment'>('main');
  const [editingVoter, setEditingVoter] = useState<Voter | null>(null);

  // Multi-Admin Assessments (For Super Admin oversight & isolated Admin storage)
  const [voterAssessments, setVoterAssessments] = useState<any[]>([]);
  const [loadingAssessments, setLoadingAssessments] = useState(false);

  // Political Sentiment states
  const [parties, setParties] = useState<{ id: string; name: string; code?: string; symbol?: string; color?: string }[]>([]);
  const [sentimentFavoredPartyId, setSentimentFavoredPartyId] = useState<string>('');
  const [sentimentStatus, setSentimentStatus] = useState<'Support' | 'Neutral' | 'Oppose' | 'Other Party'>('Neutral');
  const [sentimentNotes, setSentimentNotes] = useState('');
  const [sentimentStrength, setSentimentStrength] = useState<number>(3);
  const [sentimentIsKaryakarta, setSentimentIsKaryakarta] = useState<boolean>(false);
  const [sentimentAdminId, setSentimentAdminId] = useState('');
  const [allAdmins, setAllAdmins] = useState<{ uid: string; username: string; email: string; role: string }[]>([]);
  const [loadingSentiment, setLoadingSentiment] = useState(false);
  const [lastSentimentUpdatedBy, setLastSentimentUpdatedBy] = useState('');
  const [lastSentimentUpdatedAt, setLastSentimentUpdatedAt] = useState<string>('');
  const [formData, setFormData] = useState({
    voterId: '',
    name: '',
    relationName: '',
    aadharNumber: '',
    gender: 'Male',
    age: 18,
    dob: '',
    mobile: '',
    email: '',
    additionalMobile: '',
    address: '',
    newAddress: '',
    houseNo: '',
    village: '',
    caste: 'General',
    occupation: 'Private Service',
    isKaryakarta: false,
    voted: false,
    partNo: '',
    srNo: '',
    stateId: '',
    districtId: '',
    constituencyId: '',
    boothId: '',
    vitalStatus: 'Active',
    physicalProfile: 'General',
    disabilityCategory: 'None',
    eciAssistanceNeeded: false,
    economicCategory: 'APL',
    incomeRange: '₹15,000 - ₹30,000',
    landOwnership: 'Small Farmer',
    education: 'Unspecified',
  });

  // Keep track of political sentiments for all loaded voters under the current admin context
  const [voterSentiments, setVoterSentiments] = useState<Record<string, Record<string, unknown>>>({});

  useEffect(() => {
    const fetchVoterSentiments = async () => {
      if (voters.length === 0) return;
      try {
        const sentiments = await api.get<any[]>('/api/voter-sentiments');
        const mapping: Record<string, Record<string, unknown>> = {};
        sentiments.forEach(s => {
          if (s.voterDocId) {
            mapping[s.voterDocId] = s;
          }
        });
        setVoterSentiments(mapping);
      } catch (err) {
        console.error("Error loading political sentiments in list context:", err);
      }
    };

    fetchVoterSentiments();
  }, [voters, user, profile, sentimentAdminId]);

  const getSectionCompleteness = (v: Voter, sentiment: Record<string, unknown> | undefined) => {
    // 1. Main Profile
    const mainFields = [
      { value: v.name },
      { value: v.voterId },
      { value: v.aadharNumber },
      { value: v.gender },
      { value: v.dob },
      { value: v.caste },
      { value: v.occupation },
      { value: v.education }
    ];
    const mainFilled = mainFields.filter(f => f.value && f.value !== '' && f.value !== 'Unspecified').length;
    const mainTotal = mainFields.length;

    // 2. Address & Contact
    const addressFields = [
      { value: v.mobile },
      { value: v.additionalMobile },
      { value: v.email },
      { value: v.address },
      { value: v.newAddress },
      { value: v.houseNo },
      { value: v.village },
      { value: v.stateId },
      { value: v.districtId },
      { value: v.constituencyId },
      { value: v.boothId }
    ];
    const addressFilled = addressFields.filter(f => f.value && f.value !== '').length;
    const addressTotal = addressFields.length;

    // 3. Health & Profile
    const healthFields = [
      { value: v.vitalStatus },
      { value: v.physicalProfile },
      { value: v.disabilityCategory },
      { value: v.eciAssistanceNeeded }
    ];
    const healthFilled = healthFields.filter(f => f.value !== undefined && f.value !== null && f.value !== '' && f.value !== 'None' && f.value !== 'General').length;
    const healthTotal = healthFields.length;

    // 4. Economy
    const economyFields = [
      { value: v.economicCategory },
      { value: v.incomeRange },
      { value: v.landOwnership }
    ];
    const economyFilled = economyFields.filter(f => f.value && f.value !== '' && f.value !== 'Unspecified').length;
    const economyTotal = economyFields.length;

    // 5. Political Sentiment (separate per admin)
    const polFilled = sentiment ? 1 : 0;
    const polTotal = 1;

    return {
      main: { filled: mainFilled, total: mainTotal },
      address: { filled: addressFilled, total: addressTotal },
      health: { filled: healthFilled, total: healthTotal },
      economy: { filled: economyFilled, total: economyTotal },
      political: { filled: polFilled, total: polTotal }
    };
  };

  const getCompletenessPercent = (v: Voter) => {
    const sentiment = voterSentiments[v.id];
    const stats = getSectionCompleteness(v, sentiment);
    const filled = stats.main.filled + stats.address.filled + stats.health.filled + stats.economy.filled + stats.political.filled;
    const total = stats.main.total + stats.address.total + stats.health.total + stats.economy.total + stats.political.total;
    return total > 0 ? Math.round((filled / total) * 100) : 0;
  };

  const computeSectionAggregates = () => {
    const statsSummary = {
      main: { filledVoters: 0, blankVoters: 0, totalFilledFields: 0, totalBlankFields: 0 },
      address: { filledVoters: 0, blankVoters: 0, totalFilledFields: 0, totalBlankFields: 0 },
      health: { filledVoters: 0, blankVoters: 0, totalFilledFields: 0, totalBlankFields: 0 },
      economy: { filledVoters: 0, blankVoters: 0, totalFilledFields: 0, totalBlankFields: 0 },
      political: { filledVoters: 0, blankVoters: 0, totalFilledFields: 0, totalBlankFields: 0 }
    };

    filteredVoters.forEach(v => {
      const sentiment = voterSentiments[v.id];
      const itemStats = getSectionCompleteness(v, sentiment);

      // Main Profile - at least half of the fields filled to count as filled voter context
      statsSummary.main.totalFilledFields += itemStats.main.filled;
      statsSummary.main.totalBlankFields += itemStats.main.total - itemStats.main.filled;
      if (itemStats.main.filled >= 4) {
        statsSummary.main.filledVoters++;
      } else {
        statsSummary.main.blankVoters++;
      }

      // Address & Contact - at least half of the fields filled to count as filled voter context
      statsSummary.address.totalFilledFields += itemStats.address.filled;
      statsSummary.address.totalBlankFields += itemStats.address.total - itemStats.address.filled;
      if (itemStats.address.filled >= 5) {
        statsSummary.address.filledVoters++;
      } else {
        statsSummary.address.blankVoters++;
      }

      // Health - at least 2 fields filled
      statsSummary.health.totalFilledFields += itemStats.health.filled;
      statsSummary.health.totalBlankFields += itemStats.health.total - itemStats.health.filled;
      if (itemStats.health.filled >= 2) {
        statsSummary.health.filledVoters++;
      } else {
        statsSummary.health.blankVoters++;
      }

      // Economy - at least 2 fields filled
      statsSummary.economy.totalFilledFields += itemStats.economy.filled;
      statsSummary.economy.totalBlankFields += itemStats.economy.total - itemStats.economy.filled;
      if (itemStats.economy.filled >= 2) {
        statsSummary.economy.filledVoters++;
      } else {
        statsSummary.economy.blankVoters++;
      }

      // Political Sentiment - active sentiment exists
      statsSummary.political.totalFilledFields += itemStats.political.filled;
      statsSummary.political.totalBlankFields += itemStats.political.total - itemStats.political.filled;
      if (itemStats.political.filled > 0) {
        statsSummary.political.filledVoters++;
      } else {
        statsSummary.political.blankVoters++;
      }
    });

    return statsSummary;
  };



  // Allowed Demographics Based on Role & Profile Scoping
  const electSettings = profile?.election_settings || profile?.electionSettings || {};
  const rawState = profile?.stateId || profile?.state_id || electSettings.state_id || electSettings.stateId || '';
  const rawDistrict = profile?.districtId || profile?.district_id || electSettings.district_id || electSettings.districtId || '';
  const rawConstituency = profile?.constituencyId || profile?.constituency_id || electSettings.constituency_id || electSettings.constituencyId || '';
  const rawBooth = profile?.boothId || profile?.booth_id || electSettings.booth_id || electSettings.boothId || '';
  const rawAssignedBooths = profile?.assigned_booths || electSettings.assigned_booths || [];

  const allowedStateIds = !isSuperAdmin && rawState
    ? String(rawState).split(',').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedDistrictIds = !isSuperAdmin && rawDistrict
    ? String(rawDistrict).split(',').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedConstituencyIds = !isSuperAdmin && rawConstituency
    ? String(rawConstituency).split(',').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') 
    : [];
  const allowedBoothIds = !isSuperAdmin && (rawBooth || (Array.isArray(rawAssignedBooths) && rawAssignedBooths.length > 0))
    ? (rawBooth ? String(rawBooth).split(',').map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]') : (rawAssignedBooths || []).map(String).map(s => s.trim()).filter(s => s && s !== 'null' && s !== 'undefined' && s !== '[]')) 
    : [];

  const hasAssignedScope = isSuperAdmin || (
    allowedBoothIds.length > 0 ||
    allowedConstituencyIds.length > 0 ||
    allowedDistrictIds.length > 0 ||
    allowedStateIds.length > 0
  );
  const isRestrictedUser = !isSuperAdmin;

  const fetchStates = async () => {
    try {
      const allStates = await api.get<IndiaState[]>('/api/states');
      setStates(allStates);
    } catch (err) { console.error(err); }
  };

  const fetchHierarchy = async () => {
    try {
      const allDistricts = await api.get<IndiaDistrict[]>('/api/districts');
      const allConstituencies = await api.get<IndiaConstituency[]>('/api/constituencies');
      const allBooths = await api.get<IndiaBooth[]>('/api/booths');

      setDistricts(allDistricts.map((d: any) => ({ ...d, stateId: String(d.state_id || d.stateId || '') })));
      setConstituencies(allConstituencies.map((c: any) => ({ ...c, stateId: String(c.state_id || c.stateId || ''), districtId: String(c.district_id || c.districtId || '') })));
      setBooths(allBooths.map((b: any) => ({ ...b, boothNumber: String(b.booth_number || b.boothNumber || ''), constituencyId: String(b.constituency_id || b.constituencyId || ''), mandalId: String(b.mandal_id || b.mandalId || '') })));
    } catch (err) { console.error(err); }
  };

  const fetchVoters = async () => {
    if (!isSuperAdmin && !hasAssignedScope) {
      setVoters([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '1000');

      // 1. Explicit UI filter dropdown selections
      if (selectedBoothId !== 'all') {
        params.set('boothId', selectedBoothId);
      } else if (selectedBoothIds.length > 0) {
        params.set('boothIds', selectedBoothIds.join(','));
      }

      if (selectedConstituencyId !== 'all') {
        params.set('constituencyId', selectedConstituencyId);
      } else if (selectedConstituencyIds.length > 0) {
        params.set('constituencyIds', selectedConstituencyIds.join(','));
      }

      if (selectedDistrictId !== 'all') {
        params.set('districtId', selectedDistrictId);
      } else if (selectedDistrictIds.length > 0) {
        params.set('districtIds', selectedDistrictIds.join(','));
      }

      if (selectedStateId !== 'all') {
        params.set('stateId', selectedStateId);
      } else if (selectedStateIds.length > 0) {
        params.set('stateIds', selectedStateIds.join(','));
      }

      // 2. If non-super admin and no explicit UI filters selected, apply assigned profile scope
      if (!isSuperAdmin) {
        if (!params.has('boothId') && !params.has('boothIds') && allowedBoothIds.length > 0 && allowedBoothIds.length < 50) {
          params.set('boothIds', allowedBoothIds.join(','));
        }
        if (!params.has('constituencyId') && !params.has('constituencyIds') && allowedConstituencyIds.length > 0) {
          params.set('constituencyIds', allowedConstituencyIds.join(','));
        }
        if (!params.has('districtId') && !params.has('districtIds') && allowedDistrictIds.length > 0) {
          params.set('districtIds', allowedDistrictIds.join(','));
        }
        if (!params.has('stateId') && !params.has('stateIds') && allowedStateIds.length > 0) {
          params.set('stateIds', allowedStateIds.join(','));
        }
      }

      const res = await api.get<{ data: any[] }>(`/api/voters?${params.toString()}`);
      const rawList = res.data || [];
      const seenKeys = new Set<string>();
      const uniqueRaw: any[] = [];
      for (const d of rawList) {
        const key = String(d.id || d.voter_id || d.voterId || '');
        if (key && !seenKeys.has(key)) {
          seenKeys.add(key);
          uniqueRaw.push(d);
        } else if (!key) {
          uniqueRaw.push(d);
        }
      }

      const newVoters = uniqueRaw.map(d => ({
        ...d,
        voterId: d.voter_id || d.voterId,
        relationName: d.relation_name || d.relationName,
        relationType: d.relation_type || d.relationType,
        gender: d.gender,
        age: d.age,
        partNo: d.part_no || d.partNo,
        srNo: d.sr_no || d.srNo,
        houseNo: d.house_no || d.houseNo,
        isKaryakarta: Boolean(d.is_karyakarta),
        voted: d.voting_status === 'voted' || Boolean(d.voted),
        partyInclination: d.party_inclination || d.partyInclination,
        boothId: String(d.booth_id || d.boothId || ''),
        mandalId: String(d.mandal_id || d.mandalId || ''),
        constituencyId: String(d.constituency_id || d.constituencyId || ''),
        stateId: String(d.state_id || d.stateId || ''),
        districtId: String(d.district_id || d.districtId || '')
      })) as Voter[];
      
      setVoters(newVoters);
    } catch (err) {
      console.error('Error loading voters:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStates();
    fetchHierarchy();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (boothDropdownRef.current && !boothDropdownRef.current.contains(event.target as Node)) {
        setIsBoothDropdownOpen(false);
      }
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target as Node)) {
        setIsStateDropdownOpen(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(event.target as Node)) {
        setIsDistrictDropdownOpen(false);
      }
      if (constituencyDropdownRef.current && !constituencyDropdownRef.current.contains(event.target as Node)) {
        setIsConstituencyDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (selectedStateIds.length === 1) {
      setSelectedStateId(selectedStateIds[0]);
    } else {
      setSelectedStateId('all');
    }
  }, [selectedStateIds]);

  useEffect(() => {
    if (selectedDistrictIds.length === 1) {
      setSelectedDistrictId(selectedDistrictIds[0]);
    } else {
      setSelectedDistrictId('all');
    }
  }, [selectedDistrictIds]);

  useEffect(() => {
    if (selectedConstituencyIds.length === 1) {
      setSelectedConstituencyId(selectedConstituencyIds[0]);
    } else {
      setSelectedConstituencyId('all');
    }
  }, [selectedConstituencyIds]);

  useEffect(() => {
    if (selectedBoothIds.length === 1) {
      setSelectedBoothId(selectedBoothIds[0]);
    } else {
      setSelectedBoothId('all');
    }
  }, [selectedBoothIds]);

  useEffect(() => {
    // Reset page to 1 whenever any filtering parameters change
    setCurrentPage(1);
  }, [
    searchTerm,
    filterGender,
    filterCaste,
    filterAgeGroup,
    filterEconomicCategory,
    filterSentiment,
    filterCompleteness,
    filterIsKaryakarta,
    filterVitalStatus,
    selectedStateId,
    selectedStateIds,
    selectedDistrictId,
    selectedDistrictIds,
    selectedConstituencyId,
    selectedConstituencyIds,
    selectedBoothId,
    selectedBoothIds
  ]);

  useEffect(() => {
    fetchVoters();
  }, [
    selectedStateId, selectedDistrictId, selectedConstituencyId, selectedBoothId,
    selectedBoothIds, selectedStateIds, selectedDistrictIds, selectedConstituencyIds,
    booths, isSuperAdmin, allowedConstituencyIds.join(','), allowedDistrictIds.join(','),
    allowedStateIds.join(','), allowedBoothIds.join(',')
  ]);

  // Load admins list for political sentiment mapping
  useEffect(() => {
    const fetchAdmins = async () => {
      try {
        const users = await api.get<any[]>('/api/users');
        const list: { uid: string; username: string; email: string; role: string }[] = [];
        users.forEach(u => {
          const r = u.role || 'guest';
          if (['super_admin', 'admin', 'manager'].includes(r)) {
            list.push({
              uid: u.id,
              username: u.username || u.name || u.email?.split('@')[0] || 'Unknown User',
              email: u.email || '',
              role: r
            });
          }
        });
        setAllAdmins(list);
      } catch (err) {
        console.error("Failed to load users for admins:", err);
      }
    };
    if (user) {
      fetchAdmins();
    }
  }, [user]);

  useEffect(() => {
    const fetchParties = async () => {
      try {
        const pList = await api.get<any[]>('/api/parties');
        const mapped = (pList || []).map(p => ({
          id: String(p.id || p.name),
          name: p.name || 'Party',
          code: p.code || p.abbreviation || '',
          symbol: p.symbol || p.logoUrl || '🗳️',
          color: p.color || '#3b82f6'
        }));
        if (mapped.length > 0) {
          // If custom parties exist, merge with standard parties so user always has complete options
          const existingNames = new Set(mapped.map(m => m.name.toLowerCase()));
          const combined = [...mapped, ...DEFAULT_FALLBACK_PARTIES.filter(f => !existingNames.has(f.name.toLowerCase()))];
          setParties(combined);
        } else {
          setParties(DEFAULT_FALLBACK_PARTIES);
        }
      } catch (err) {
        console.error("Failed to load parties, using registered defaults:", err);
        setParties(DEFAULT_FALLBACK_PARTIES);
      }
    };
    fetchParties();
  }, []);

  const loadVoterAssessments = async (voterDocId: string) => {
    if (!voterDocId) return;
    setLoadingAssessments(true);
    try {
      const list = await api.get<any[]>(`/api/voters/${voterDocId}/assessments`);
      setVoterAssessments(list || []);
    } catch (err) {
      console.error("Failed to load multi-admin voter assessments:", err);
      setVoterAssessments([]);
    } finally {
      setLoadingAssessments(false);
    }
  };

  const applyAdminAssessment = (assessment: any) => {
    if (!assessment) return;
    setSentimentAdminId(assessment.admin_id || '');
    setFormData(prev => ({
      ...prev,
      vitalStatus: assessment.vital_status || prev.vitalStatus,
      physicalProfile: assessment.physical_profile || prev.physicalProfile,
      disabilityCategory: assessment.disability_category || prev.disabilityCategory,
      eciAssistanceNeeded: Boolean(assessment.eci_assistance_needed),
      economicCategory: assessment.economic_category || prev.economicCategory,
      incomeRange: assessment.income_range || prev.incomeRange,
      landOwnership: assessment.land_ownership || prev.landOwnership,
      education: assessment.education || prev.education,
      isKaryakarta: Boolean(assessment.is_karyakarta),
      voted: Boolean(assessment.voted)
    }));
    setSentimentStatus(assessment.sentiment || 'Neutral');
    setSentimentStrength(assessment.sentiment_score !== undefined ? Number(assessment.sentiment_score) : 3);
    setSentimentFavoredPartyId(assessment.favored_party_id || assessment.favoredPartyId || '');
    setSentimentNotes(assessment.notes || '');
    setSentimentIsKaryakarta(Boolean(assessment.is_karyakarta));
    setLastSentimentUpdatedBy(assessment.recorded_by_display_name || assessment.admin_name || 'Staff');
    setLastSentimentUpdatedAt(assessment.updated_at ? new Date(assessment.updated_at).toLocaleString() : '');
  };

  const loadVoterSentiment = async (voterDocId: string, targetAdminId: string) => {
    if (!voterDocId || !targetAdminId) return;
    setLoadingSentiment(true);
    try {
      const sentiments = await api.get<any[]>('/api/voter-sentiments');
      const found = sentiments.find(s => s.voterDocId === voterDocId || s.id === `${targetAdminId}_${voterDocId}`);
      if (found) {
        setSentimentStatus(found.sentiment || 'Neutral');
        setSentimentNotes(found.notes || '');
        setSentimentStrength(found.sentimentScore !== undefined ? Number(found.sentimentScore) : 3);
        setSentimentFavoredPartyId(found.favoredPartyId || found.favored_party_id || '');
        setSentimentIsKaryakarta(found.isKaryakarta || false);
        setLastSentimentUpdatedBy(found.recordedByName || found.recordedBy || 'System');
        setLastSentimentUpdatedAt(found.createdAt ? new Date(found.createdAt).toLocaleString() : '');
      } else {
        setSentimentStatus('Neutral');
        setSentimentNotes('');
        setSentimentStrength(3);
        setSentimentFavoredPartyId('');
        setSentimentIsKaryakarta(false);
        setLastSentimentUpdatedBy('');
        setLastSentimentUpdatedAt('');
      }
    } catch (err) {
      console.error("Error loading political sentiment:", err);
    } finally {
      setLoadingSentiment(false);
    }
  };

  useEffect(() => {
    if (editingVoter && sentimentAdminId) {
      loadVoterSentiment(editingVoter.id, sentimentAdminId);
    }
  }, [sentimentAdminId, editingVoter]);

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      const targetAdmin = sentimentAdminId || profile?.parentAdminId || profile?.adminId || profile?.creatorId || user?.uid || '';
      const selectedPartyObj = parties.find(p => String(p.id) === String(sentimentFavoredPartyId) || p.name === sentimentFavoredPartyId);
      const voterData = {
        ...formData,
        adminId: targetAdmin,
        isKaryakarta: activeFormTab === 'political_sentiment' ? sentimentIsKaryakarta : formData.isKaryakarta,
        sentimentScore: sentimentStrength,
        sentiment: sentimentStatus,
        favoredPartyId: sentimentFavoredPartyId,
        favoredPartyName: selectedPartyObj?.name || '',
        partyInclination: selectedPartyObj?.name || '',
        notes: sentimentNotes,
        age: Number(formData.age)
      };

      let voterDocId = '';
      let updatedVoterObj: Voter;
      if (editingVoter) {
        voterDocId = editingVoter.id;
        await api.put(`/api/voters/${editingVoter.id}`, voterData);
        setSuccessMessage(`Voter ${formData.name} updated successfully.`);
        updatedVoterObj = { ...editingVoter, ...voterData, id: editingVoter.id };
      } else {
        const res = await api.post<any>('/api/voters', voterData);
        voterDocId = res?.id || res?.data?.id || '';
        setSuccessMessage(`Voter ${formData.name} registered.`);
        updatedVoterObj = { ...voterData, id: voterDocId } as Voter;
      }

      // Save Political Sentiment if provided
      if (targetAdmin && voterDocId) {
        try {
          await api.post('/api/voter-sentiments', {
            id: `${targetAdmin}_${voterDocId}`,
            adminId: targetAdmin,
            voterDocId: voterDocId,
            voterName: formData.name,
            sentimentScore: sentimentStrength,
            sentiment: sentimentStatus,
            favoredPartyId: sentimentFavoredPartyId,
            favoredPartyName: selectedPartyObj?.name || '',
            partyColor: selectedPartyObj?.color || '#3b82f6',
            partySymbol: selectedPartyObj?.symbol || '🗳️',
            notes: sentimentNotes,
            isKaryakarta: sentimentIsKaryakarta,
            recordedBy: user?.uid || '',
            recordedByName: profile?.username || profile?.name || profile?.email?.split('@')[0] || 'Staff',
            constituencyId: formData.constituencyId,
            boothId: formData.boothId
          });
          setVoterSentiments(prev => ({
            ...prev,
            [voterDocId]: {
              ...prev[voterDocId],
              sentiment: sentimentStatus,
              sentimentScore: sentimentStrength,
              favoredPartyId: sentimentFavoredPartyId,
              favoredPartyName: selectedPartyObj?.name || '',
              partyColor: selectedPartyObj?.color || '#3b82f6',
              partySymbol: selectedPartyObj?.symbol || '🗳️',
              notes: sentimentNotes,
              isKaryakarta: sentimentIsKaryakarta,
              recordedByName: profile?.username || profile?.name || profile?.email?.split('@')[0] || 'Staff',
              createdAt: new Date().toISOString()
            }
          }));
        } catch (sErr) {
          console.error("Error updating sentiment:", sErr);
        }
      }

      setEditingVoter(null);
      setIsModalOpen(false);
      fetchVoters();
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save voter record');
    } finally {
      setActionLoading(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const handleDelete = async (id: string, name: string) => {
    setActionLoading(true);
    try {
      await api.delete(`/api/voters/${id}`);
      setVoters(prev => prev.filter(v => v.id !== id));
      setSuccessMessage(`${name} removed.`);
      setDeletingId(null);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete voter');
    } finally {
      setActionLoading(false);
    }
  };

  const startViewVoter = (v: Voter) => {
    setEditingVoter(v);
    setFormData({
      voterId: v.voterId || '',
      name: v.name || '',
      relationName: v.relationName || '',
      aadharNumber: v.aadharNumber || '',
      gender: v.gender || 'Male',
      age: v.age || 18,
      dob: v.dob || '',
      mobile: v.mobile || '',
      email: v.email || '',
      additionalMobile: v.additionalMobile || '',
      address: v.address || '',
      newAddress: v.newAddress || '',
      houseNo: v.houseNo || '',
      village: v.village || '',
      caste: v.caste || 'General',
      occupation: v.occupation || 'Private Service',
      isKaryakarta: v.isKaryakarta || false,
      voted: v.voted || false,
      partNo: v.partNo || '',
      srNo: v.srNo || '',
      stateId: v.stateId || '',
      districtId: v.districtId || '',
      constituencyId: v.constituencyId || '',
      boothId: v.boothId || '',
      vitalStatus: v.vitalStatus || 'Active',
      physicalProfile: v.physicalProfile || 'General',
      disabilityCategory: v.disabilityCategory || 'None',
      eciAssistanceNeeded: !!v.eciAssistanceNeeded,
      economicCategory: v.economicCategory || 'APL',
      incomeRange: v.incomeRange || '₹15,000 - ₹30,000',
      landOwnership: v.landOwnership || 'Small Farmer',
      education: v.education || 'Unspecified',
    });
    
    // Default to target admin context
    const currentAdminContext = profile?.parentAdminId || profile?.adminId || user?.uid || '';
    setSentimentAdminId(currentAdminContext);
    
    // Explicitly load sentiment and assessments for this voter
    const initialParty = (v as any).partyInclination || (v as any).favoredPartyId || (v as any).favoredPartyName || '';
    setSentimentFavoredPartyId(initialParty);
    loadVoterSentiment(v.id, currentAdminContext);
    loadVoterAssessments(v.id);

    setModalMode('view');
    setActiveFormTab('main');
    setIsModalOpen(true);
  };

  const startCreateVoter = () => {
    setEditingVoter(null);
    setFormData({
      voterId: '', 
      name: '', 
      relationName: '',
      aadharNumber: '',
      gender: 'Male', 
      age: 18, 
      dob: '', 
      mobile: '', 
      email: '',
      additionalMobile: '',
      address: '', 
      newAddress: '',
      houseNo: '', 
      village: '', 
      caste: 'General', 
      occupation: 'Private Service', 
      isKaryakarta: false, 
      voted: false, 
      partNo: '', 
      srNo: '', 
      stateId: selectedStateIds.length > 0 ? selectedStateIds[0] : (selectedStateId !== 'all' ? selectedStateId : (states[0]?.id || '')),
      districtId: selectedDistrictIds.length > 0 ? selectedDistrictIds[0] : (selectedDistrictId !== 'all' ? selectedDistrictId : ''),
      constituencyId: selectedConstituencyIds.length > 0 ? selectedConstituencyIds[0] : (selectedConstituencyId !== 'all' ? selectedConstituencyId : ''),
      boothId: selectedBoothIds.length > 0 ? selectedBoothIds[0] : (selectedBoothId !== 'all' ? selectedBoothId : ''),
      vitalStatus: 'Active',
      physicalProfile: 'General',
      disabilityCategory: 'None',
      eciAssistanceNeeded: false,
      economicCategory: 'APL',
      incomeRange: '₹15,000 - ₹30,000',
      landOwnership: 'Small Farmer',
      education: 'Unspecified',
    });
    setSentimentStatus('Neutral');
    setSentimentNotes('');
    setSentimentStrength(3);
    setSentimentFavoredPartyId('');
    setSentimentIsKaryakarta(false);
    setLastSentimentUpdatedBy('');
    setLastSentimentUpdatedAt('');
    setSentimentAdminId(profile?.parentAdminId || profile?.adminId || user?.uid || '');
    setVoterAssessments([]);
    setModalMode('edit');
    setActiveFormTab('main');
    setIsModalOpen(true);
  };

  const startEditVoter = (v: Voter) => {
    setEditingVoter(v);
    setFormData({
      voterId: v.voterId || '',
      name: v.name || '',
      relationName: v.relationName || '',
      aadharNumber: v.aadharNumber || '',
      gender: v.gender || 'Male',
      age: v.age || 18,
      dob: v.dob || '',
      mobile: v.mobile || '',
      email: v.email || '',
      additionalMobile: v.additionalMobile || '',
      address: v.address || '',
      newAddress: v.newAddress || '',
      houseNo: v.houseNo || '',
      village: v.village || '',
      caste: v.caste || 'General',
      occupation: v.occupation || 'Private Service',
      isKaryakarta: v.isKaryakarta || false,
      voted: v.voted || false,
      partNo: v.partNo || '',
      srNo: v.srNo || '',
      stateId: v.stateId || '',
      districtId: v.districtId || '',
      constituencyId: v.constituencyId || '',
      boothId: v.boothId || '',
      vitalStatus: v.vitalStatus || 'Active',
      physicalProfile: v.physicalProfile || 'General',
      disabilityCategory: v.disabilityCategory || 'None',
      eciAssistanceNeeded: !!v.eciAssistanceNeeded,
      economicCategory: v.economicCategory || 'APL',
      incomeRange: v.incomeRange || '₹15,000 - ₹30,000',
      landOwnership: v.landOwnership || 'Small Farmer',
      education: v.education || 'Unspecified',
    });
    
    // Default to target admin context
    const currentAdminContext = profile?.parentAdminId || profile?.adminId || user?.uid || '';
    setSentimentAdminId(currentAdminContext);
    
    // Explicitly load sentiment and assessments for this voter
    const initialParty = (v as any).partyInclination || (v as any).favoredPartyId || (v as any).favoredPartyName || '';
    setSentimentFavoredPartyId(initialParty);
    loadVoterSentiment(v.id, currentAdminContext);
    loadVoterAssessments(v.id);

    setModalMode('edit');
    setActiveFormTab(isVolunteer ? 'health_economy' : 'main');
    setIsModalOpen(true);
  };

  // Helper to resolve clean party abbreviation
  const getPartyAbbreviation = (partyIdentifier: string) => {
    if (!partyIdentifier) return '';
    const trimmed = String(partyIdentifier).trim();
    const lower = trimmed.toLowerCase();

    // Check for non-decided or empty values
    if (['none', 'na', 'n/a', 'n', '-', 'not decided', 'undecided', 'null', 'undefined', 'not set', 'no', 'unassigned'].includes(lower)) {
      return '';
    }

    const partyObj = parties.find(
      p => p.id === partyIdentifier || 
           p.name?.toLowerCase() === partyIdentifier.toLowerCase() || 
           p.code?.toLowerCase() === partyIdentifier.toLowerCase()
    );
    if (partyObj?.code) return partyObj.code;

    const matchParen = trimmed.match(/\(([^)]+)\)/);
    if (matchParen && matchParen[1]) return matchParen[1].toUpperCase();

    if (lower.includes('bharatiya janata') || lower === 'bjp') return 'BJP';
    if (lower.includes('congress') || lower === 'inc') return 'INC';
    if (lower.includes('aam aadmi') || lower === 'aap') return 'AAP';
    if (lower.includes('bahujan samaj') || lower === 'bsp') return 'BSP';
    if (lower.includes('samajwadi') || lower === 'sp') return 'SP';
    if (lower.includes('marxist') || lower.includes('cpi(m)') || lower === 'cpim') return 'CPI(M)';
    if (lower.includes('communist') || lower === 'cpi') return 'CPI';
    if (lower.includes('nationalist congress') || lower === 'ncp') return 'NCP';
    if (lower.includes('trinamool') || lower === 'aitc' || lower === 'tmc') return 'AITC';
    if (lower.includes('shiv sena') || lower === 'ss') return 'SS';
    if (lower.includes('janata dal') || lower === 'jdu' || lower === 'jd(u)') return 'JD(U)';
    if (lower.includes('rashtriya janata') || lower === 'rjd') return 'RJD';
    if (lower.includes('independent') || lower === 'ind') return 'IND';

    if (trimmed.length <= 6) return trimmed.toUpperCase();
    return trimmed.split(' ').map(w => w[0]).join('').toUpperCase();
  };

  // Helper to extract full resolved location for a voter record
  const getVoterLocation = (v: Voter) => {
    const bId = String(v.boothId || (v as any).booth_id || '').trim();
    const boothObj = booths.find(b => String(b.id) === bId || String(b.boothNumber) === bId || b.name === bId);
    
    const rawCId = String(v.constituencyId || (v as any).constituency_id || (boothObj ? (boothObj.constituencyId || (boothObj as any).constituency_id) : '') || '').trim();
    const constObj = constituencies.find(c => String(c.id) === rawCId || c.name === rawCId);
    const cId = constObj ? String(constObj.id) : rawCId;
    const cName = constObj ? constObj.name : rawCId;
    
    const rawDId = String(v.districtId || (v as any).district_id || (constObj ? (constObj.districtId || (constObj as any).district_id) : '') || '').trim();
    const distObj = districts.find(d => String(d.id) === rawDId || d.name === rawDId);
    const dId = distObj ? String(distObj.id) : rawDId;
    const dName = distObj ? distObj.name : rawDId;
    
    const rawSId = String(v.stateId || (v as any).state_id || (distObj ? (distObj.stateId || (distObj as any).state_id) : '') || (constObj ? (constObj.stateId || (constObj as any).state_id) : '') || '').trim();
    const stateObj = states.find(s => String(s.id) === rawSId || s.name === rawSId || s.code === rawSId);
    const sId = stateObj ? String(stateObj.id) : rawSId;
    const sName = stateObj ? stateObj.name : rawSId;
    
    return { 
      boothId: bId, 
      boothNumber: boothObj ? boothObj.boothNumber : '',
      constituencyId: cId, 
      constituencyName: cName,
      districtId: dId, 
      districtName: dName,
      stateId: sId,
      stateName: sName
    };
  };

  // Determine if a voter is within the user's assigned scope
  const matchesUserScope = (v: Voter) => {
    if (isSuperAdmin) return true;
    if (!hasAssignedScope) return false;

    const loc = getVoterLocation(v);

    // 1. Check booth level restriction
    if (allowedBoothIds.length > 0) {
      const matchBooth = allowedBoothIds.some(id => 
        id === loc.boothId || 
        id === loc.boothNumber ||
        booths.some(b => String(b.id) === id && (String(b.boothNumber) === loc.boothId || b.name === loc.boothId || String(b.id) === loc.boothId))
      );
      if (matchBooth) return true;
    }

    // 2. Check constituency level restriction
    if (allowedConstituencyIds.length > 0) {
      const matchConst = allowedConstituencyIds.some(id => 
        id === loc.constituencyId || 
        id === loc.constituencyName ||
        constituencies.some(c => String(c.id) === id && (c.name === loc.constituencyName || String(c.id) === loc.constituencyId))
      );
      if (matchConst) return true;
    }

    // 3. Check district level restriction
    if (allowedDistrictIds.length > 0) {
      const matchDist = allowedDistrictIds.some(id => 
        id === loc.districtId || 
        id === loc.districtName ||
        districts.some(d => String(d.id) === id && (d.name === loc.districtName || String(d.id) === loc.districtId))
      );
      if (matchDist) return true;
    }

    // 4. Check state level restriction
    if (allowedStateIds.length > 0) {
      const matchState = allowedStateIds.some(id => 
        id === loc.stateId || 
        id === loc.stateName ||
        states.some(s => String(s.id) === id && (s.name === loc.stateName || s.code === loc.stateName || String(s.id) === loc.stateId))
      );
      if (matchState) return true;
    }

    return false;
  };

  // Scoped State IDs for dropdown filters
  const validScopedStateIds = useMemo(() => {
    if (!isRestrictedUser) return null;
    if (allowedStateIds.length > 0) return allowedStateIds;
    if (allowedDistrictIds.length > 0) {
      const matched = districts.filter(d => allowedDistrictIds.includes(String(d.id))).map(d => String(d.stateId));
      return Array.from(new Set(matched));
    }
    if (allowedConstituencyIds.length > 0) {
      const consts = constituencies.filter(c => allowedConstituencyIds.includes(String(c.id)));
      const distIds = consts.map(c => String(c.districtId));
      const matched = districts.filter(d => distIds.includes(String(d.id))).map(d => String(d.stateId));
      return Array.from(new Set(matched));
    }
    if (allowedBoothIds.length > 0) {
      const bths = booths.filter(b => allowedBoothIds.includes(String(b.id)));
      const constIds = bths.map(b => String(b.constituencyId));
      const consts = constituencies.filter(c => constIds.includes(String(c.id)));
      const distIds = consts.map(c => String(c.districtId));
      const matched = districts.filter(d => distIds.includes(String(d.id))).map(d => String(d.stateId));
      return Array.from(new Set(matched));
    }
    return null;
  }, [isRestrictedUser, allowedStateIds, allowedDistrictIds, allowedConstituencyIds, allowedBoothIds, districts, constituencies, booths]);

  // Scoped District IDs for dropdown filters
  const validScopedDistrictIds = useMemo(() => {
    if (!isRestrictedUser) return null;
    if (allowedDistrictIds.length > 0) return allowedDistrictIds;
    if (allowedConstituencyIds.length > 0) {
      const consts = constituencies.filter(c => allowedConstituencyIds.includes(String(c.id)));
      return Array.from(new Set(consts.map(c => String(c.districtId))));
    }
    if (allowedBoothIds.length > 0) {
      const bths = booths.filter(b => allowedBoothIds.includes(String(b.id)));
      const constIds = bths.map(b => String(b.constituencyId));
      const consts = constituencies.filter(c => constIds.includes(String(c.id)));
      return Array.from(new Set(consts.map(c => String(c.districtId))));
    }
    if (allowedStateIds.length > 0) {
      return districts.filter(d => allowedStateIds.includes(String(d.stateId))).map(d => String(d.id));
    }
    return null;
  }, [isRestrictedUser, allowedDistrictIds, allowedConstituencyIds, allowedBoothIds, allowedStateIds, districts, constituencies, booths]);

  // Scoped Constituency IDs for dropdown filters
  const validScopedConstituencyIds = useMemo(() => {
    if (!isRestrictedUser) return null;
    if (allowedConstituencyIds.length > 0) return allowedConstituencyIds;
    if (allowedBoothIds.length > 0) {
      const bths = booths.filter(b => allowedBoothIds.includes(String(b.id)));
      return Array.from(new Set(bths.map(b => String(b.constituencyId))));
    }
    if (allowedDistrictIds.length > 0) {
      return constituencies.filter(c => allowedDistrictIds.includes(String(c.districtId))).map(c => String(c.id));
    }
    if (allowedStateIds.length > 0) {
      const distIds = districts.filter(d => allowedStateIds.includes(String(d.stateId))).map(d => String(d.id));
      return constituencies.filter(c => distIds.includes(String(c.districtId))).map(c => String(c.id));
    }
    return null;
  }, [isRestrictedUser, allowedConstituencyIds, allowedBoothIds, allowedDistrictIds, allowedStateIds, constituencies, districts, booths]);

  // Scoped Booth IDs for dropdown filters
  const validScopedBoothIds = useMemo(() => {
    if (!isRestrictedUser) return null;
    if (allowedBoothIds.length > 0) return allowedBoothIds;
    if (allowedConstituencyIds.length > 0) {
      return booths.filter(b => allowedConstituencyIds.includes(String(b.constituencyId))).map(b => String(b.id));
    }
    if (allowedDistrictIds.length > 0) {
      const consts = constituencies.filter(c => allowedDistrictIds.includes(String(c.districtId))).map(c => String(c.id));
      return booths.filter(b => consts.includes(String(b.constituencyId))).map(b => String(b.id));
    }
    if (allowedStateIds.length > 0) {
      const dsts = districts.filter(d => allowedStateIds.includes(String(d.stateId))).map(d => String(d.id));
      const consts = constituencies.filter(c => dsts.includes(String(c.districtId))).map(c => String(c.id));
      return booths.filter(b => consts.includes(String(b.constituencyId))).map(b => String(b.id));
    }
    return null;
  }, [isRestrictedUser, allowedBoothIds, allowedConstituencyIds, allowedDistrictIds, allowedStateIds, booths, constituencies, districts]);

  const filteredVoters = useMemo(() => {
    const seenKeys = new Set<string>();
    return voters.filter(v => {
      const uniqueKey = String(v.id || v.voterId || '');
      if (uniqueKey) {
        if (seenKeys.has(uniqueKey)) return false;
        seenKeys.add(uniqueKey);
      }

      // 1. Full text search matching
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        const matchesSearch = (
          v.name?.toLowerCase().includes(term) || 
          v.voterId?.toLowerCase().includes(term) ||
          v.mobile?.includes(term) ||
          v.aadharNumber?.includes(term) ||
          v.houseNo?.toLowerCase().includes(term) ||
          v.village?.toLowerCase().includes(term) ||
          v.address?.toLowerCase().includes(term)
        );
        if (!matchesSearch) return false;
      }

      // 2. Secure demographic scope enforcement for non-Super Admins
      if (!matchesUserScope(v)) return false;

      // 3. Instant On-Screen Demographic Dropdown Filters
      const loc = getVoterLocation(v);

      // State filter
      if (selectedStateIds.length > 0) {
        if (!loc.stateId || !selectedStateIds.includes(loc.stateId)) return false;
      } else if (selectedStateId && selectedStateId !== 'all') {
        if (loc.stateId !== selectedStateId) return false;
      }

      // District filter
      if (selectedDistrictIds.length > 0) {
        if (!loc.districtId || !selectedDistrictIds.includes(loc.districtId)) return false;
      } else if (selectedDistrictId && selectedDistrictId !== 'all') {
        if (loc.districtId !== selectedDistrictId) return false;
      }

      // Constituency filter
      if (selectedConstituencyIds.length > 0) {
        if (!loc.constituencyId || !selectedConstituencyIds.includes(loc.constituencyId)) return false;
      } else if (selectedConstituencyId && selectedConstituencyId !== 'all') {
        if (loc.constituencyId !== selectedConstituencyId) return false;
      }

      // Booth filter
      if (selectedBoothIds.length > 0) {
        if (!loc.boothId || !selectedBoothIds.includes(loc.boothId)) return false;
      } else if (selectedBoothId && selectedBoothId !== 'all') {
        if (loc.boothId !== selectedBoothId) return false;
      }

      // Filter by vital status
      const vStatus = v.vitalStatus || 'Active';
      if (filterVitalStatus !== 'all') {
        if (filterVitalStatus === 'Active' && vStatus !== 'Active') return false;
        if (filterVitalStatus === 'Deceased' && vStatus !== 'Deceased') return false;
        if (filterVitalStatus === 'Migrated/Shifted' && vStatus !== 'Migrated/Shifted' && vStatus !== 'Migrated') return false;
      }

      // Filter by Gender
      if (filterGender !== 'all' && v.gender !== filterGender) return false;

      // Filter by Caste
      const vCaste = v.caste || 'General';
      if (filterCaste !== 'all' && vCaste !== filterCaste) return false;

      // Filter by Age Group
      if (filterAgeGroup !== 'all') {
        const ageNum = v.age || 0;
        if (filterAgeGroup === 'under30' && ageNum >= 30) return false;
        if (filterAgeGroup === '30to49' && (ageNum < 30 || ageNum > 49)) return false;
        if (filterAgeGroup === '50to69' && (ageNum < 50 || ageNum > 69)) return false;
        if (filterAgeGroup === '70plus' && ageNum < 70) return false;
      }

      // Filter by Economic Category
      const vEco = v.economicCategory || 'APL';
      if (filterEconomicCategory !== 'all' && vEco !== filterEconomicCategory) return false;

      // Filter by Sentiment
      if (filterSentiment !== 'all') {
        const sData = voterSentiments[v.id];
        const sVal = (sData?.sentiment as string) || 'Unassigned';
        if (filterSentiment !== sVal) return false;
      }

      // Filter by Profile Completeness
      if (filterCompleteness !== 'all') {
        const comp = getCompletenessPercent(v);
        if (filterCompleteness === 'complete' && comp < 80) return false;
        if (filterCompleteness === 'incomplete' && comp >= 80) return false;
      }

      // Filter by Karyakarta (Volunteer)
      if (filterIsKaryakarta !== 'all') {
        const matchesKaryakarta = v.isKaryakarta === true;
        if (filterIsKaryakarta === 'yes' && !matchesKaryakarta) return false;
        if (filterIsKaryakarta === 'no' && matchesKaryakarta) return false;
      }

      return true;
    });
  }, [
    voters,
    searchTerm,
    filterGender,
    filterCaste,
    filterAgeGroup,
    filterEconomicCategory,
    filterSentiment,
    filterCompleteness,
    filterIsKaryakarta,
    filterVitalStatus,
    selectedStateId,
    selectedStateIds,
    selectedDistrictId,
    selectedDistrictIds,
    selectedConstituencyId,
    selectedConstituencyIds,
    selectedBoothId,
    selectedBoothIds,
    voterSentiments,
    isSuperAdmin,
    hasAssignedScope,
    allowedBoothIds,
    allowedConstituencyIds,
    allowedDistrictIds,
    allowedStateIds,
    booths,
    constituencies,
    districts,
    states
  ]);

  const filterableStates = states.filter(s => 
    !validScopedStateIds || validScopedStateIds.includes(String(s.id))
  );
  const searchedStates = filterableStates.filter(s =>
    s.name.toLowerCase().includes(stateSearchText.toLowerCase())
  );

  const filterableDistricts = districts.filter(d => {
    const isScoped = !validScopedDistrictIds || validScopedDistrictIds.includes(String(d.id));
    const matchesSelectedState = selectedStateIds.length === 0 || selectedStateIds.includes(String(d.stateId));
    return isScoped && matchesSelectedState;
  });
  const searchedDistricts = filterableDistricts.filter(d =>
    d.name.toLowerCase().includes(districtSearchText.toLowerCase())
  );

  const filterableConstituencies = constituencies.filter(c => {
    const dist = districts.find(d => String(d.id) === String(c.districtId));
    const isScoped = !validScopedConstituencyIds || validScopedConstituencyIds.includes(String(c.id));
    const matchesSelectedState = selectedStateIds.length === 0 || (dist && selectedStateIds.includes(String(dist.stateId)));
    const matchesSelectedDistrict = selectedDistrictIds.length === 0 || selectedDistrictIds.includes(String(c.districtId));
    return isScoped && matchesSelectedState && matchesSelectedDistrict;
  });
  const searchedConstituencies = filterableConstituencies.filter(c =>
    c.name.toLowerCase().includes(constituencySearchText.toLowerCase())
  );

  const filterableBooths = booths.filter(b => {
    const conn = constituencies.find(c => String(c.id) === String(b.constituencyId));
    const dist = districts.find(d => String(d.id) === String(conn?.districtId));
    const isScoped = !validScopedBoothIds || validScopedBoothIds.includes(String(b.id));
    const matchesSelectedState = selectedStateIds.length === 0 || (dist && selectedStateIds.includes(String(dist.stateId)));
    const matchesSelectedDistrict = selectedDistrictIds.length === 0 || (conn && selectedDistrictIds.includes(String(conn.districtId)));
    const matchesSelectedConstituency = selectedConstituencyIds.length === 0 || selectedConstituencyIds.includes(String(b.constituencyId));
    return isScoped && matchesSelectedState && matchesSelectedDistrict && matchesSelectedConstituency;
  });
  const searchedBooths = filterableBooths.filter(b => 
    b.name.toLowerCase().includes(boothSearchText.toLowerCase()) || 
    b.boothNumber.toLowerCase().includes(boothSearchText.toLowerCase())
  );

  // Paginated lists
  const totalPages = Math.ceil(filteredVoters.length / pageSize) || 1;
  const activePage = Math.min(currentPage, totalPages);
  const paginatedVoters = filteredVoters.slice((activePage - 1) * pageSize, activePage * pageSize);

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
      {/* Notifications */}
      <AnimatePresence>
        {successMessage && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-green-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
            <CheckCircle size={20} />
            <span className="font-bold text-sm tracking-tight">{successMessage}</span>
          </motion.div>
        )}
        {error && (
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] bg-red-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3">
            <AlertCircle size={20} />
            <span className="font-bold text-sm tracking-tight">{error}</span>
            <button onClick={() => setError('')} className="p-1 hover:bg-black/10 rounded"><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Voters
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              {voters.length.toLocaleString()} Total
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Electorate directory and registration records.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          {!isVolunteer && hasRight('voters', 'c') && (
            <>
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="h-9 px-3.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Upload size={13} /> Import
              </button>
              <button 
                onClick={startCreateVoter}
                className="webapp-button-primary h-9 px-4 flex items-center justify-center gap-1.5 text-xs font-semibold shadow-xs"
              >
                <Plus size={15} /> Add Voter
              </button>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {(() => {
          const stats = computeSectionAggregates();
          const sections = [
            {
              title: "Profile",
              filled: stats.main.filledVoters,
              blank: stats.main.blankVoters,
              color: "text-emerald-600 dark:text-emerald-400",
              bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
              progressColor: "bg-emerald-500",
              filledFields: stats.main.totalFilledFields,
              blankFields: stats.main.totalBlankFields,
              icon: <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            },
            {
              title: "Contact & Area",
              filled: stats.address.filledVoters,
              blank: stats.address.blankVoters,
              color: "text-blue-600 dark:text-blue-400",
              bgColor: "bg-blue-50 dark:bg-blue-950/20",
              progressColor: "bg-blue-500",
              filledFields: stats.address.totalFilledFields,
              blankFields: stats.address.totalBlankFields,
              icon: <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            },
            {
              title: "Health & Vital",
              filled: stats.health.filledVoters,
              blank: stats.health.blankVoters,
              color: "text-purple-600 dark:text-purple-400",
              bgColor: "bg-purple-50 dark:bg-purple-950/15",
              progressColor: "bg-purple-500",
              filledFields: stats.health.totalFilledFields,
              blankFields: stats.health.totalBlankFields,
              icon: <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            },
            {
              title: "Economy",
              filled: stats.economy.filledVoters,
              blank: stats.economy.blankVoters,
              color: "text-orange-600 dark:text-orange-400",
              bgColor: "bg-orange-50 dark:bg-orange-950/20",
              progressColor: "bg-orange-500",
              filledFields: stats.economy.totalFilledFields,
              blankFields: stats.economy.totalBlankFields,
              icon: <Coins className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            },
            {
              title: "Sentiment",
              filled: stats.political.filledVoters,
              blank: stats.political.blankVoters,
              color: "text-amber-600 dark:text-amber-400",
              bgColor: "bg-amber-50 dark:bg-amber-950/20",
              progressColor: "bg-amber-500",
              filledFields: stats.political.totalFilledFields,
              blankFields: stats.political.totalBlankFields,
              icon: <CheckCircle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            }
          ];

          return sections.map((sec, idx) => {
            const totalFieldsAll = sec.filledFields + sec.blankFields;
            const compPercent = totalFieldsAll > 0 ? Math.round((sec.filledFields / totalFieldsAll) * 100) : 0;
            return (
              <div 
                key={idx} 
                className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-xs flex flex-col justify-between hover:border-zinc-300 dark:hover:border-zinc-700 transition-all gap-2.5"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className={`p-1.5 rounded-lg ${sec.bgColor} ${sec.color}`}>
                      {sec.icon}
                    </div>
                    <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                      {compPercent}%
                    </span>
                  </div>
                  <h3 className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{sec.title}</h3>
                </div>

                <div className="space-y-2">
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1 overflow-hidden">
                    <div 
                      className={`h-full ${sec.progressColor} transition-all duration-300`}
                      style={{ width: `${compPercent}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between text-[10px] text-zinc-500 dark:text-zinc-400">
                    <span>Filled: <strong className="text-zinc-800 dark:text-zinc-200">{sec.filled}</strong></span>
                    <span>Blank: <strong>{sec.blank}</strong></span>
                  </div>
                </div>
              </div>
            );
          });
        })()}
      </div>

      <div className="webapp-card overflow-hidden">
        {/* Filters Header */}
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 space-y-6 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
            <div className="flex-1 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest flex items-center gap-1.5">
                <Search size={10} className="text-blue-500" /> Search Registry
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                <input 
                  type="text" 
                  placeholder="Search name, EPIC ID or Mobile..." 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)} 
                  className="webapp-input pl-10 h-11 text-xs py-0 w-full bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 focus:border-blue-500/50" 
                />
              </div>
            </div>
            
            <div className="hidden lg:flex items-center gap-3 self-center mt-4">
              <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-2" />
              <div className="text-right">
                <div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest leading-none">Total Results</div>
                <div className="text-lg font-black text-blue-600 leading-none mt-1">{filteredVoters.length}</div>
              </div>
            </div>
          </div>

          {/* Demographic Multi-Select Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {/* State Filter */}
            <div className="space-y-1.5 relative" ref={stateDropdownRef}>
              <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest flex items-center gap-1.5">
                <Globe size={10} className="text-blue-500" /> State
              </label>
              <button
                type="button"
                onClick={() => setIsStateDropdownOpen(!isStateDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all select-none min-h-[44px]"
              >
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {selectedStateIds.length === 0 
                    ? 'All States' 
                    : selectedStateIds.length === 1 
                      ? states.find(s => s.id === selectedStateIds[0])?.name || `${selectedStateIds.length} Selected`
                      : `${selectedStateIds.length} States`
                  }
                </span>
                <span className="text-zinc-400 text-[10px]">▼</span>
              </button>
              
              {isStateDropdownOpen && (
                <div className="absolute left-0 mt-1 w-full min-w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col max-h-64">
                  <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search state..."
                      value={stateSearchText}
                      onChange={e => setStateSearchText(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[11px] focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="overflow-y-auto space-y-0.5 custom-scrollbar flex-1">
                    <div 
                      onClick={() => setSelectedStateIds([])}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        selectedStateIds.length === 0 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {selectedStateIds.length === 0 && <span className="text-[9px] font-black">✓</span>}
                      </div>
                      All States
                    </div>
                    {searchedStates.map(s => {
                      const isChecked = selectedStateIds.includes(s.id);
                      return (
                        <div 
                          key={s.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedStateIds(prev => prev.filter(id => id !== s.id));
                            } else {
                              setSelectedStateIds(prev => [...prev, s.id]);
                            }
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isChecked 
                              ? 'border-blue-500 bg-blue-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <span className="text-[9px] font-black">✓</span>}
                          </div>
                          {s.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* District Filter */}
            <div className="space-y-1.5 relative" ref={districtDropdownRef}>
              <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest flex items-center gap-1.5">
                <Flag size={10} className="text-blue-500" /> District
              </label>
              <button
                type="button"
                onClick={() => setIsDistrictDropdownOpen(!isDistrictDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all select-none min-h-[44px]"
              >
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {selectedDistrictIds.length === 0 
                    ? 'All Districts' 
                    : selectedDistrictIds.length === 1 
                      ? districts.find(d => d.id === selectedDistrictIds[0])?.name || `${selectedDistrictIds.length} Selected`
                      : `${selectedDistrictIds.length} Districts`
                  }
                </span>
                <span className="text-zinc-400 text-[10px]">▼</span>
              </button>
              
              {isDistrictDropdownOpen && (
                <div className="absolute left-0 mt-1 w-full min-w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col max-h-64">
                  <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search district..."
                      value={districtSearchText}
                      onChange={e => setDistrictSearchText(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[11px] focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="overflow-y-auto space-y-0.5 custom-scrollbar flex-1">
                    <div 
                      onClick={() => setSelectedDistrictIds([])}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        selectedDistrictIds.length === 0 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {selectedDistrictIds.length === 0 && <span className="text-[9px] font-black">✓</span>}
                      </div>
                      All Districts
                    </div>
                    {searchedDistricts.map(d => {
                      const isChecked = selectedDistrictIds.includes(d.id);
                      return (
                        <div 
                          key={d.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedDistrictIds(prev => prev.filter(id => id !== d.id));
                            } else {
                              setSelectedDistrictIds(prev => [...prev, d.id]);
                            }
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isChecked 
                              ? 'border-blue-500 bg-blue-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <span className="text-[9px] font-black">✓</span>}
                          </div>
                          {d.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Constituency Filter */}
            <div className="space-y-1.5 relative" ref={constituencyDropdownRef}>
              <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest flex items-center gap-1.5">
                <MapPin size={10} className="text-blue-500" /> Constituency
              </label>
              <button
                type="button"
                onClick={() => setIsConstituencyDropdownOpen(!isConstituencyDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all select-none min-h-[44px]"
              >
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {selectedConstituencyIds.length === 0 
                    ? 'All Constituencies' 
                    : selectedConstituencyIds.length === 1 
                      ? constituencies.find(c => c.id === selectedConstituencyIds[0])?.name || `${selectedConstituencyIds.length} Selected`
                      : `${selectedConstituencyIds.length} Constituencies`
                  }
                </span>
                <span className="text-zinc-400 text-[10px]">▼</span>
              </button>
              
              {isConstituencyDropdownOpen && (
                <div className="absolute left-0 mt-1 w-full min-w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col max-h-64">
                  <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search constituency..."
                      value={constituencySearchText}
                      onChange={e => setConstituencySearchText(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[11px] focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="overflow-y-auto space-y-0.5 custom-scrollbar flex-1">
                    <div 
                      onClick={() => setSelectedConstituencyIds([])}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        selectedConstituencyIds.length === 0 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {selectedConstituencyIds.length === 0 && <span className="text-[9px] font-black">✓</span>}
                      </div>
                      All Constituencies
                    </div>
                    {searchedConstituencies.map(c => {
                      const isChecked = selectedConstituencyIds.includes(c.id);
                      return (
                        <div 
                          key={c.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedConstituencyIds(prev => prev.filter(id => id !== c.id));
                            } else {
                              setSelectedConstituencyIds(prev => [...prev, c.id]);
                            }
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isChecked 
                              ? 'border-blue-500 bg-blue-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <span className="text-[9px] font-black">✓</span>}
                          </div>
                          {c.name}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Booth Filter */}
            <div className="space-y-1.5 relative" ref={boothDropdownRef}>
              <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest flex items-center gap-1.5">
                <Home size={10} className="text-blue-500" /> Booth
              </label>
              <button
                type="button"
                onClick={() => setIsBoothDropdownOpen(!isBoothDropdownOpen)}
                className="w-full flex items-center justify-between bg-white dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl px-3 py-2 text-xs font-bold text-left hover:border-zinc-300 dark:hover:border-zinc-700 transition-all select-none min-h-[44px]"
              >
                <span className="truncate text-zinc-700 dark:text-zinc-300">
                  {selectedBoothIds.length === 0 
                    ? 'All Booths' 
                    : selectedBoothIds.length === 1 
                      ? booths.find(b => b.id === selectedBoothIds[0])?.name || `${selectedBoothIds.length} Selected`
                      : `${selectedBoothIds.length} Booths`
                  }
                </span>
                <span className="text-zinc-400 text-[10px]">▼</span>
              </button>
              
              {isBoothDropdownOpen && (
                <div className="absolute left-0 mt-1 w-full min-w-[220px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xl z-50 p-2.5 animate-in fade-in slide-in-from-top-1 duration-100 flex flex-col max-h-64">
                  <div className="relative mb-2 shrink-0">
                    <Search className="absolute left-2.5 top-2.5 w-3 h-3 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Search booth..."
                      value={boothSearchText}
                      onChange={e => setBoothSearchText(e.target.value)}
                      className="w-full pl-8 pr-2 py-1.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg outline-none text-[11px] focus:ring-1 focus:ring-blue-500 text-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="overflow-y-auto space-y-0.5 custom-scrollbar flex-1">
                    <div 
                      onClick={() => setSelectedBoothIds([])}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                    >
                      <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                        selectedBoothIds.length === 0 
                          ? 'border-blue-500 bg-blue-500 text-white' 
                          : 'border-zinc-300 dark:border-zinc-700'
                      }`}>
                        {selectedBoothIds.length === 0 && <span className="text-[9px] font-black">✓</span>}
                      </div>
                      All Booths
                    </div>
                    {searchedBooths.map(b => {
                      const isChecked = selectedBoothIds.includes(b.id);
                      return (
                        <div 
                          key={b.id}
                          onClick={() => {
                            if (isChecked) {
                              setSelectedBoothIds(prev => prev.filter(id => id !== b.id));
                            } else {
                              setSelectedBoothIds(prev => [...prev, b.id]);
                            }
                          }}
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-zinc-650 dark:text-zinc-355 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
                        >
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                            isChecked 
                              ? 'border-blue-500 bg-blue-500 text-white' 
                              : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <span className="text-[9px] font-black">✓</span>}
                          </div>
                          <div>
                            <span className="block text-zinc-800 dark:text-zinc-200">{b.name}</span>
                            <span className="block text-[8px] text-zinc-400 font-bold">No. {b.boothNumber}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Advanced Query Filters Section */}
          <div className="pt-4 border-t border-zinc-200/50 dark:border-zinc-800/50">
            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="group flex items-center gap-2 text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider hover:text-blue-700 dark:hover:text-blue-300 transition-colors select-none"
            >
              <SlidersHorizontal size={12} className="group-hover:rotate-12 transition-transform" />
              <span>{showAdvancedFilters ? "Hide Advanced Filters" : "Show Advanced Filters"}</span>
              <span className={`text-[9px] transition-transform duration-200 ${showAdvancedFilters ? 'rotate-180' : ''}`}>▼</span>
              
              {(filterGender !== 'all' || filterCaste !== 'all' || filterAgeGroup !== 'all' || filterEconomicCategory !== 'all' || filterSentiment !== 'all' || filterCompleteness !== 'all' || filterIsKaryakarta !== 'all' || filterVitalStatus !== 'Active') && (
                <span className="bg-blue-100 dark:bg-blue-950 text-blue-750 dark:text-blue-300 px-2 py-0.5 rounded-full text-[8px] font-extrabold normal-case leading-none">
                  Active Filters
                </span>
              )}
            </button>

            {showAdvancedFilters && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 p-4 rounded-2xl bg-zinc-100/30 dark:bg-zinc-900/10 border border-zinc-200/50 dark:border-zinc-800/40 animate-in fade-in duration-155">
                
                {/* Gender Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Gender Selection</label>
                  <select 
                    value={filterGender} 
                    onChange={e => setFilterGender(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other / Third Gender</option>
                  </select>
                </div>

                {/* Caste / Category Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Caste / Category</label>
                  <select 
                    value={filterCaste} 
                    onChange={e => setFilterCaste(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Castes</option>
                    <option value="General">General</option>
                    <option value="OBC">OBC</option>
                    <option value="SC">SC</option>
                    <option value="ST">ST</option>
                    <option value="Minority">Minority</option>
                  </select>
                </div>

                {/* Age Group Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Age Group</label>
                  <select 
                    value={filterAgeGroup} 
                    onChange={e => setFilterAgeGroup(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Ages</option>
                    <option value="under30">Under 30 Yrs</option>
                    <option value="30to49">30 - 49 Yrs</option>
                    <option value="50to69">50 - 69 Yrs</option>
                    <option value="70plus">70 Yrs & Above</option>
                  </select>
                </div>

                {/* Economic Category Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Economic Category</label>
                  <select 
                    value={filterEconomicCategory} 
                    onChange={e => setFilterEconomicCategory(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Categories</option>
                    <option value="APL">APL (Above Poverty Line)</option>
                    <option value="BPL">BPL (Below Poverty Line)</option>
                    <option value="EWS">EWS (Economically Weaker Section)</option>
                  </select>
                </div>

                {/* Political Sentiment Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Voter Sentiment</label>
                  <select 
                    value={filterSentiment} 
                    onChange={e => setFilterSentiment(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Sentiments</option>
                    <option value="Support">Support</option>
                    <option value="Neutral">Neutral</option>
                    <option value="Oppose">Oppose</option>
                    <option value="Other Party">Other Party</option>
                    <option value="Unassigned">Unassigned / No Record</option>
                  </select>
                </div>

                {/* Profile Completeness Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Profile Completeness</label>
                  <select 
                    value={filterCompleteness} 
                    onChange={e => setFilterCompleteness(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">Any % Complete</option>
                    <option value="high">Fully Complete (75% or More)</option>
                    <option value="medium">Partially Complete (40% - 74%)</option>
                    <option value="low">Incomplete (Under 40%)</option>
                  </select>
                </div>

                {/* Volunteer Status Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest">Volunteer Status</label>
                  <select 
                    value={filterIsKaryakarta} 
                    onChange={e => setFilterIsKaryakarta(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-955 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="all">All Roles</option>
                    <option value="yes">Connection Volunteers</option>
                    <option value="no">General Voters</option>
                  </select>
                </div>

                {/* Vital Status Filter */}
                <div className="space-y-1.5 flex flex-col">
                  <label className="text-[10px] font-black uppercase text-zinc-400 px-1 tracking-widest font-bold">Vital Status</label>
                  <select 
                    value={filterVitalStatus} 
                    onChange={e => setFilterVitalStatus(e.target.value)} 
                    className="webapp-input w-full h-11 text-xs font-bold bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-xl"
                  >
                    <option value="Active">Active (Default View)</option>
                    <option value="Deceased">Deceased (Archived)</option>
                    <option value="Migrated/Shifted">Migrated/Shifted (Archived)</option>
                    <option value="all">All (including Archived)</option>
                  </select>
                </div>

                {/* Reset Filters Option inline */}
                <div className="col-span-1 sm:col-span-2 lg:col-span-4 flex justify-end gap-2 pt-2 border-t border-zinc-200/30 dark:border-zinc-800/30">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterGender('all');
                      setFilterCaste('all');
                      setFilterAgeGroup('all');
                      setFilterEconomicCategory('all');
                      setFilterSentiment('all');
                      setFilterCompleteness('all');
                      setFilterIsKaryakarta('all');
                      setFilterVitalStatus('Active');
                    }}
                    className="text-[10px] font-black uppercase text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 transition-colors select-none"
                  >
                    Reset Advanced Options
                  </button>
                </div>

              </div>
            )}
          </div>

          <div className="flex sm:hidden justify-between items-center bg-white dark:bg-zinc-955 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 mt-2">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Total Found</span>
            <span className="text-xs font-black text-blue-600">{filteredVoters.length}</span>
          </div>
        </div>

        {/* Table Action Toolbar with Column Customizer */}
        <div className="px-6 py-3 bg-white dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">
              Showing <strong className="text-zinc-900 dark:text-white">{filteredVoters.length}</strong> registered voters
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TableColumnManager columnManager={voterColumnManager} tableName="Voters" />
          </div>
        </div>

        {/* Table View (Desktop) */}
        <div className="overflow-x-auto hidden md:block">
            <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800">
                {voterColumnManager.visibleColumns.map(col => (
                  <th
                    key={col.id}
                    className={`px-6 py-4 text-[10px] font-black uppercase text-zinc-400 tracking-wider ${col.id === 'actions' ? 'text-right' : ''}`}
                    style={{ minWidth: col.minWidth }}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading && voters.length === 0 ? (
                <tr>
                  <td colSpan={voterColumnManager.visibleColumns.length || 1} className="py-20 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-zinc-300" />
                  </td>
                </tr>
              ) : filteredVoters.length === 0 ? (
                <tr>
                  <td colSpan={voterColumnManager.visibleColumns.length || 1} className="py-20 text-center text-zinc-400 text-xs">
                    No voters found matching criteria.
                  </td>
                </tr>
              ) : (
                paginatedVoters.map((v, index) => (
                  <tr key={v.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30 transition-colors">
                    {voterColumnManager.visibleColumns.map(col => {
                      switch (col.id) {
                        case 'slNo':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-bold text-zinc-400 dark:text-zinc-650">
                              {(activePage - 1) * pageSize + index + 1}
                            </td>
                          );
                        case 'voterId':
                          return (
                            <td key={col.id} className="px-6 py-5">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black text-blue-600 bg-blue-50 dark:bg-zinc-850 px-1.5 py-0.5 rounded w-fit">
                                  {v.voterId}
                                </span>
                                {v.aadharNumber && (
                                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono leading-none mt-1">
                                    Aadhaar: {v.aadharNumber}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        case 'aadharNumber':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                              {v.aadharNumber || <span className="text-zinc-400 font-bold">-</span>}
                            </td>
                          );
                        case 'name':
                          return (
                            <td key={col.id} className="px-6 py-5">
                              <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm leading-tight">{v.name}</div>
                            </td>
                          );
                        case 'relationName':
                          return (
                            <td key={col.id} className="px-6 py-5">
                              {v.relationName ? (
                                <div className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                  {v.relationName}
                                </div>
                              ) : (
                                <span className="text-xs text-zinc-400 font-bold">-</span>
                              )}
                            </td>
                          );
                        case 'gender': {
                          const g = (v.gender || '').trim().toUpperCase();
                          const displayGender = g.startsWith('M') ? 'M' : g.startsWith('F') ? 'F' : (g.startsWith('T') || g.startsWith('O')) ? 'O' : '-';
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {displayGender}
                            </td>
                          );
                        }
                        case 'age':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {v.age ? `${v.age} Yrs` : '-'}
                            </td>
                          );
                        case 'caste':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <div className="font-bold">{v.caste || '-'}</div>
                            </td>
                          );
                        case 'houseNo':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {(v as any).houseNo || (v as any).houseNumber || (v as any).doorNo || <span className="text-zinc-400 font-bold">-</span>}
                            </td>
                          );
                        case 'village':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <div>{v.village || (v as any).section || '-'}</div>
                            </td>
                          );
                        case 'mandal':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <div>{(v as any).mandal || '-'}</div>
                            </td>
                          );
                        case 'booth': {
                          const booth = booths.find(b => b.id === v.boothId);
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <div className="line-clamp-1 text-zinc-800 dark:text-zinc-200 font-bold">{booth ? booth.name : '-'}</div>
                            </td>
                          );
                        }
                        case 'mobile':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              <div className="font-bold">{v.mobile || '-'}</div>
                              {v.additionalMobile && <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-normal mt-0.5">Alt: {v.additionalMobile}</div>}
                              {v.email && <div className="text-[10px] text-blue-500 hover:underline mt-0.5 max-w-[150px] truncate" title={v.email}>{v.email}</div>}
                            </td>
                          );
                        case 'additionalMobile':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {v.additionalMobile || <span className="text-zinc-400 font-bold">-</span>}
                            </td>
                          );
                        case 'email':
                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {v.email ? (
                                <a href={`mailto:${v.email}`} className="text-blue-500 hover:underline truncate max-w-[160px] block">
                                  {v.email}
                                </a>
                              ) : (
                                <span className="text-zinc-400 font-bold">-</span>
                              )}
                            </td>
                          );
                        case 'sentiment': {
                          const sentimentData = voterSentiments[v.id];
                          const sentiment = sentimentData?.sentiment as string || 'Unassigned';
                          let badgeColor = 'bg-zinc-100 text-zinc-650 dark:bg-zinc-900 dark:text-zinc-400';
                          if (sentiment === 'Support') badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-500/20';
                          else if (sentiment === 'Neutral') badgeColor = 'bg-zinc-500/10 text-zinc-655 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-500/20';
                          else if (sentiment === 'Oppose') badgeColor = 'bg-red-500/10 text-red-650 dark:bg-red-950/30 dark:text-red-400 border border-red-500/20';
                          else if (sentiment === 'Other Party') badgeColor = 'bg-amber-500/10 text-amber-650 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-500/20';
                          
                          return (
                            <td key={col.id} className="px-6 py-5">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${badgeColor}`}>
                                {sentiment === 'Support' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
                                {sentiment === 'Neutral' && <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />}
                                {sentiment === 'Oppose' && <span className="w-1.5 h-1.5 rounded-full bg-red-500" />}
                                {sentiment === 'Other Party' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                                {sentiment === 'Unassigned' && <span className="w-1.5 h-1.5 rounded-full bg-zinc-350 dark:bg-zinc-700" />}
                                {sentiment}
                              </span>
                            </td>
                          );
                        }
                        case 'favoredParty': {
                          const sData = voterSentiments[v.id];
                          const rawParty = (sData as any)?.favoredPartyName || (sData as any)?.favored_party_name || (sData as any)?.favoredPartyId || (v as any).favoredPartyName || v.partyInclination || '';
                          const partyObj = parties.find(p => p.id === rawParty || p.name?.toLowerCase() === rawParty.toLowerCase() || p.code?.toLowerCase() === rawParty.toLowerCase());
                          const abbrev = getPartyAbbreviation(rawParty);
                          const fullName = partyObj?.name || rawParty;

                          return (
                            <td key={col.id} className="px-6 py-5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                              {abbrev ? (
                                <span 
                                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white uppercase font-bold text-xs" 
                                  title={fullName}
                                >
                                  {abbrev}
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-bold text-xs">-</span>
                              )}
                            </td>
                          );
                        }
                        case 'isVolunteer':
                          return (
                            <td key={col.id} className="px-6 py-5">
                              {(v as any).isVolunteer || (v as any).is_volunteer || (v as any).isKaryakarta ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                  ★ Volunteer
                                </span>
                              ) : (
                                <span className="text-[10px] text-zinc-400">Voter</span>
                              )}
                            </td>
                          );
                        case 'profileComplete': {
                          const percent = getCompletenessPercent(v);
                          let badgeColor = 'text-red-650 bg-red-500/10 border-red-500/20 dark:text-red-400 dark:bg-red-950/20';
                          let barColor = 'bg-red-500';
                          if (percent >= 75) {
                            badgeColor = 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20 dark:text-emerald-400 dark:bg-emerald-950/25';
                            barColor = 'bg-emerald-500';
                          } else if (percent >= 40) {
                            badgeColor = 'text-amber-600 bg-amber-500/10 border-amber-500/20 dark:text-amber-400 dark:bg-amber-950/20';
                            barColor = 'bg-amber-500';
                          }
                          return (
                            <td key={col.id} className="px-6 py-5">
                              <div className="flex flex-col gap-1.5 w-24">
                                <div className="flex items-center justify-between">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-black tracking-wide border uppercase leading-none ${badgeColor}`}>
                                    {percent}% Complete
                                  </span>
                                </div>
                                <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                                </div>
                              </div>
                            </td>
                          );
                        }
                        case 'actions':
                          return (
                            <td key={col.id} className="px-6 py-5 text-right">
                              <div className="flex justify-end gap-1.5">
                                <button 
                                  onClick={() => startViewVoter(v)}
                                  title="View Voter Details"
                                  className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 hover:border-blue-300 dark:hover:text-blue-400 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider shadow-xs transform active:scale-95 transition-all cursor-pointer"
                                >
                                  <Eye size={12} />
                                  <span>View</span>
                                </button>
                                {hasRight('voters', 'u') && (
                                  <button 
                                    onClick={() => startEditVoter(v)}
                                    title="Edit Voter Information"
                                    className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 hover:border-amber-300 dark:hover:text-amber-400 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider shadow-xs transform active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Edit3 size={12} />
                                    <span>Edit</span>
                                  </button>
                                )}
                                {!isVolunteer && hasRight('voters', 'd') && (
                                  <button 
                                    onClick={() => setDeletingId(v.id)} 
                                    title="Delete Voter Record"
                                    className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-red-600 hover:border-red-300 dark:hover:text-red-400 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider shadow-xs transform active:scale-95 transition-all cursor-pointer"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="md:hidden divide-y divide-zinc-100 dark:divide-zinc-800">
           {loading && voters.length === 0 ? (
             <div className="p-20 text-center"><Loader2 size={24} className="animate-spin mx-auto text-zinc-300" /></div>
           ) : paginatedVoters.map(v => (
             <div key={v.id} className="p-4 space-y-4">
               <div className="flex justify-between items-start">
                 <div className="flex items-center gap-3 cursor-pointer" onClick={() => startViewVoter(v)}>
                    <div className="w-10 h-10 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 shrink-0">
                      <UserSquare2 size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-zinc-900 dark:text-white text-sm">{v.name}</div>
                      {v.relationName && (
                        <div className="text-[11px] text-zinc-400 dark:text-zinc-500 font-medium mt-0.5">
                          F/H: <span className="font-semibold text-zinc-600 dark:text-zinc-300">{v.relationName}</span>
                        </div>
                      )}
                      <div className="flex flex-wrap items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-black text-blue-600 tracking-wider">#{v.voterId}</span>
                        {v.aadharNumber && (
                          <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-mono">
                            | Aadhaar: {v.aadharNumber}
                          </span>
                        )}
                        {(() => {
                          const sentimentData = voterSentiments[v.id];
                          const sentiment = sentimentData?.sentiment as string;
                          if (!sentiment) return null;
                          let badgeColor = 'bg-zinc-100 text-zinc-650 dark:bg-zinc-900 dark:text-zinc-400';
                          if (sentiment === 'Support') badgeColor = 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400';
                          else if (sentiment === 'Neutral') badgeColor = 'bg-zinc-500/10 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400';
                          else if (sentiment === 'Oppose') badgeColor = 'bg-red-500/10 text-red-650 dark:bg-red-950/20 dark:text-red-400';
                          else if (sentiment === 'Other Party') badgeColor = 'bg-amber-500/10 text-amber-655 dark:bg-amber-950/25 dark:text-amber-450';
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${badgeColor}`}>
                              {sentiment}
                            </span>
                          );
                        })()}
                        {(() => {
                          const percent = getCompletenessPercent(v);
                          let col = 'bg-red-500/5 text-red-600 border border-red-500/10 dark:bg-red-950/15 dark:text-red-400';
                          if (percent >= 75) col = 'bg-emerald-500/5 text-emerald-600 border border-emerald-500/10 dark:bg-emerald-950/15 dark:text-emerald-400';
                          else if (percent >= 40) col = 'bg-amber-500/5 text-amber-600 border border-amber-500/10 dark:bg-amber-950/15 dark:text-amber-400';
                          return (
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${col}`}>
                              {percent}% Complete
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                 </div>
                  <div className="flex gap-1.5 items-center">
                    <button 
                      onClick={() => startViewVoter(v)} 
                      title="View Voter Details"
                      className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-blue-600 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                    >
                      <Eye size={12} />
                      <span>View</span>
                    </button>
                    {hasRight('voters', 'u') && (
                      <button 
                        onClick={() => startEditVoter(v)} 
                        title="Edit Voter"
                        className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        <Edit3 size={12} />
                        <span>Edit</span>
                      </button>
                    )}
                    {!isVolunteer && hasRight('voters', 'd') && (
                      <button 
                        onClick={() => setDeletingId(v.id)} 
                        title="Delete Voter"
                        className="p-1 px-2 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-500 hover:text-red-600 rounded-lg flex items-center gap-1 text-[10px] font-black uppercase tracking-wider cursor-pointer"
                      >
                        <Trash2 size={12} />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
               </div>

                <div className="grid grid-cols-2 gap-4 bg-zinc-50 dark:bg-zinc-900/50 p-3 rounded-2xl">
                 <div>
                   <div className="text-[9px] font-black text-zinc-400 uppercase">Profile</div>
                   <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                     <div>{v.gender}, {v.age}Y {v.caste && `(${v.caste})`}</div>
                     {v.occupation && <div className="text-[10px] text-zinc-500 font-bold">{v.occupation}</div>}
                     {v.education && v.education !== 'Unspecified' && <div className="text-[10px] text-blue-600 dark:text-blue-400 font-extrabold">{v.education}</div>}
                     {v.dob && <span className="block text-[10px] font-medium text-blue-500 mt-0.5">DOB: {v.dob}</span>}
                   </div>
                 </div>
                 <div>
                   <div className="text-[9px] font-black text-zinc-400 uppercase">Booth Info</div>
                   <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Part: {v.partNo}, Sr: {v.srNo}</div>
                   {v.mobile && <div className="text-[10px] text-zinc-650 dark:text-zinc-400 font-semibold mt-1">📞 {v.mobile}</div>}
                   {v.email && <div className="text-[10px] text-blue-500 font-semibold truncate max-w-[120px] mt-0.5" title={v.email}>✉️ {v.email}</div>}
                  </div>
                  <div className="col-span-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/40">
                    <div className="flex justify-between items-center text-[9px] font-black text-zinc-400 uppercase">
                      <span>Profile Completeness</span>
                      <span className="text-zinc-650 dark:text-zinc-300 font-extrabold">{getCompletenessPercent(v)}%</span>
                    </div>
                    {(() => {
                      const percent = getCompletenessPercent(v);
                      let barColor = 'bg-red-500';
                      if (percent >= 75) barColor = 'bg-emerald-500';
                      else if (percent >= 40) barColor = 'bg-amber-500';
                      return (
                        <div className="w-full bg-zinc-200 dark:bg-zinc-805 h-1.5 rounded-full mt-1 overflow-hidden">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percent}%` }} />
                        </div>
                      );
                    })()}
                 </div>
               </div>
             </div>
           ))}
        </div>

        {/* Pagination Section */}
        <div className="p-4 sm:p-6 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Summary */}
          <div className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 capitalize">
            {filteredVoters.length === 0 ? (
              <span>No Matching Voters</span>
            ) : (
              <span>
                Showing <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{(activePage - 1) * pageSize + 1}</strong> to{' '}
                <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">
                  {Math.min(activePage * pageSize, filteredVoters.length)}
                </strong>{' '}
                of <strong className="font-extrabold text-zinc-900 dark:text-zinc-100">{filteredVoters.length}</strong> Records
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Page Size Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">View</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 text-xs font-bold bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-350 outline-none focus:ring-1 focus:ring-blue-500 transition-all cursor-pointer"
              >
                {[10, 15, 25, 50, 100].map(sz => (
                  <option key={sz} value={sz}>{sz} rows</option>
                ))}
              </select>
            </div>

            {/* Navigational Buttons */}
            {totalPages > 1 && (
              <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-850 p-1 rounded-xl">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                  title="First Page"
                >
                  <ChevronsLeft size={16} />
                </button>

                {/* Prev */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={activePage === 1}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                  title="Previous Page"
                >
                  <ChevronLeft size={16} />
                </button>

                {/* Page Indices */}
                {(() => {
                  const pages = [];
                  const startPage = Math.max(1, activePage - 2);
                  const endPage = Math.min(totalPages, startPage + 4);
                  
                  // Adjust startPage if we are near the end
                  const finalStartPage = Math.max(1, Math.min(startPage, totalPages - 4));

                  for (let i = finalStartPage; i <= endPage; i++) {
                    pages.push(
                      <button
                        key={i}
                        type="button"
                        onClick={() => setCurrentPage(i)}
                        className={`min-w-8 h-8 flex items-center justify-center rounded-lg text-xs font-black transition-all cursor-pointer ${
                          activePage === i
                            ? 'bg-white dark:bg-zinc-800 text-blue-600 dark:text-blue-400 shadow-sm'
                            : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pages;
                })()}

                {/* Next */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                  title="Next Page"
                >
                  <ChevronRight size={16} />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={activePage === totalPages}
                  className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer transition-all"
                  title="Last Page"
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Voter Entry / View Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-white dark:bg-zinc-950 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-100">
          <div className="relative w-full h-full flex flex-col overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-900/90 shrink-0">
              <div className="max-w-5xl mx-auto w-full flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ${
                    modalMode === 'view' 
                      ? 'bg-blue-600 text-white dark:bg-blue-500' 
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  }`}>
                    {modalMode === 'view' ? <UserSquare2 size={22} /> : (editingVoter ? <Edit3 size={20} /> : <Plus size={22} />)}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg sm:text-xl font-black text-zinc-900 dark:text-white tracking-tight">
                        {modalMode === 'view' 
                          ? (editingVoter?.name || 'Voter Information') 
                          : (editingVoter ? 'Edit Voter Information' : 'New Voter Entry')}
                      </h3>
                      {modalMode === 'view' && editingVoter && (
                        <>
                          <span className="text-[10px] font-black text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-900/50 px-2 py-0.5 rounded-md font-mono">
                            {editingVoter.voterId}
                          </span>
                          <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            editingVoter.vitalStatus === 'Deceased' ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-900/40' :
                            editingVoter.vitalStatus === 'Migrated/Shifted' ? 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/40' :
                            'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40'
                          }`}>
                            {editingVoter.vitalStatus || 'Active'}
                          </span>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400 mt-0.5">
                      {modalMode === 'view' && editingVoter
                        ? `${editingVoter.gender}, ${editingVoter.age} Yrs • ${editingVoter.relationName ? `F/H: ${editingVoter.relationName}` : 'Elector Record'}`
                        : (editingVoter 
                            ? `Updating details for ${formData.name || editingVoter.name} (${formData.voterId || editingVoter.voterId})` 
                            : 'Fill in the details to register a new voter in the campaign registry.')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <button 
                    onClick={() => setIsModalOpen(false)} 
                    className="p-2 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all cursor-pointer"
                    title="Close modal"
                  >
                    <X size={20} />
                  </button>
                </div>
              </div>
            </div>

            {/* Modular Tab Navigation */}
            <div className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0">
              <div className="max-w-5xl mx-auto w-full px-6 py-2.5 flex gap-2 overflow-x-auto scrollbar-none">
                {[
                  { id: 'main', label: modalMode === 'view' ? '1. Overview & Identity' : '1. Main Details' },
                  { id: 'contact', label: '2. Address & Contacts' },
                  { id: 'health_economy', label: '3. Health & Economy' },
                  { id: 'political_sentiment', label: '4. Political Sentiment' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFormTab(tab.id as 'main' | 'contact' | 'health_economy' | 'political_sentiment')}
                    className={`px-4 sm:px-5 py-2 text-[11px] uppercase tracking-wider font-extrabold rounded-xl whitespace-nowrap transition-all cursor-pointer ${
                      activeFormTab === tab.id
                        ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/60'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* VIEW MODE CONTENT */}
            {modalMode === 'view' && editingVoter ? (
              <div className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="max-w-5xl mx-auto w-full p-6 sm:p-8 space-y-6">
                    {(() => {
                      const loc = getVoterLocation(editingVoter);
                      const completeness = getCompletenessPercent(editingVoter);
                      const sData = voterSentiments[editingVoter.id];
                      const currentSentiment = sentimentStatus || (sData?.sentiment as string) || 'Unassigned';

                      return (
                        <>
                          {/* TAB 1: OVERVIEW & IDENTITY (VIEW MODE) */}
                          {activeFormTab === 'main' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                              
                              {/* Quick Header Summary Card */}
                              <div className="p-5 rounded-3xl bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-zinc-50/60 dark:from-blue-950/20 dark:via-indigo-950/15 dark:to-zinc-900/30 border border-blue-100 dark:border-blue-900/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                  <div className="w-14 h-14 rounded-2xl bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800/50 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm shrink-0">
                                    <UserSquare2 size={30} />
                                  </div>
                                  <div>
                                    <div className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                                      {editingVoter.name}
                                    </div>
                                    <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                                      {editingVoter.relationName ? `Relation: ${editingVoter.relationName}` : 'No relative specified'}
                                    </div>
                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                                        {editingVoter.gender}, {editingVoter.age} Yrs
                                      </span>
                                      {editingVoter.caste && (
                                        <span className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 bg-zinc-200/60 dark:bg-zinc-800 px-2 py-0.5 rounded">
                                          {editingVoter.caste}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800 pt-3 md:pt-0 md:pl-6">
                                  <div className="space-y-1">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400 block">Profile Completeness</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-black text-zinc-900 dark:text-white">{completeness}%</span>
                                      <div className="w-24 bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                        <div 
                                          className={`h-full rounded-full ${completeness >= 75 ? 'bg-emerald-500' : completeness >= 40 ? 'bg-amber-500' : 'bg-red-500'}`}
                                          style={{ width: `${completeness}%` }}
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {hasRight('voters', 'u') && (
                                    <button
                                      type="button"
                                      onClick={() => setModalMode('edit')}
                                      className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm cursor-pointer shrink-0"
                                    >
                                      <Edit3 size={13} />
                                      <span>Edit Details</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Identity Profile Grid */}
                              <div className="space-y-3">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <ShieldCheck size={14} className="text-blue-500" /> Identity & Personal Attributes
                                </h4>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                  {/* EPIC ID */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Voter ID (EPIC)</span>
                                      <span className="text-sm font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5 block">
                                        {editingVoter.voterId || '—'}
                                      </span>
                                    </div>
                                    {editingVoter.voterId && (
                                      <button 
                                        type="button"
                                        onClick={() => handleCopy(editingVoter.voterId, 'epic')}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                        title="Copy Voter ID"
                                      >
                                        {copiedField === 'epic' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Aadhaar */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Aadhaar Number</span>
                                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 font-mono mt-0.5 block">
                                        {editingVoter.aadharNumber || 'Not recorded'}
                                      </span>
                                    </div>
                                    {editingVoter.aadharNumber && (
                                      <button 
                                        type="button"
                                        onClick={() => handleCopy(editingVoter.aadharNumber || '', 'aadhar')}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                        title="Copy Aadhaar"
                                      >
                                        {copiedField === 'aadhar' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Full Name */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Full Name</span>
                                    <span className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mt-0.5 block">
                                      {editingVoter.name}
                                    </span>
                                  </div>

                                  {/* Father / Husband Name */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Father / Husband Name</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.relationName || 'Not recorded'}
                                    </span>
                                  </div>

                                  {/* Gender & Age */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Gender & Age</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.gender} • {editingVoter.age} Years
                                    </span>
                                  </div>

                                  {/* Date of Birth */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Date of Birth</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.dob ? new Date(editingVoter.dob).toLocaleDateString() : 'Not recorded'}
                                    </span>
                                  </div>

                                  {/* Caste / Category */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Caste / Category</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.caste || 'General'}
                                    </span>
                                  </div>

                                  {/* Occupation */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Occupation</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.occupation || 'Private Service'}
                                    </span>
                                  </div>

                                  {/* Education */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Education Qualification</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.education || 'Unspecified'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Administrative Geography Details */}
                              <div className="space-y-3 pt-2">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <MapPin size={14} className="text-blue-500" /> Administrative Deployment & Hierarchy
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                                  {/* State */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">State</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {loc.stateName || 'Unassigned'}
                                    </span>
                                  </div>

                                  {/* District */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">District</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {loc.districtName || 'Unassigned'}
                                    </span>
                                  </div>

                                  {/* Constituency */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Constituency</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {loc.constituencyName || 'Unassigned'}
                                    </span>
                                  </div>

                                  {/* Polling Booth */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 sm:col-span-2 lg:col-span-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Polling Booth</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block truncate">
                                      {loc.boothNumber ? `#${loc.boothNumber} - ` : ''}{booths.find(b => b.id === editingVoter.boothId)?.name || loc.boothId || 'Unassigned'}
                                    </span>
                                  </div>

                                  {/* Part No */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Part Number</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block font-mono">
                                      {editingVoter.partNo || '—'}
                                    </span>
                                  </div>

                                  {/* Serial No */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Serial Number</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block font-mono">
                                      {editingVoter.srNo || '—'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 2: ADDRESS & CONTACTS (VIEW MODE) */}
                          {activeFormTab === 'contact' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                              
                              {/* Contact Information */}
                              <div className="space-y-3">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <Phone size={14} className="text-blue-500" /> Contact Channels & Telephony
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                  {/* Primary Mobile */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Primary Mobile</span>
                                      {editingVoter.mobile ? (
                                        <a href={`tel:${editingVoter.mobile}`} className="text-sm font-black text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block">
                                          📞 {editingVoter.mobile}
                                        </a>
                                      ) : (
                                        <span className="text-sm font-medium text-zinc-400 italic mt-0.5 block">Not recorded</span>
                                      )}
                                    </div>
                                    {editingVoter.mobile && (
                                      <button 
                                        type="button"
                                        onClick={() => handleCopy(editingVoter.mobile || '', 'mobile')}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                        title="Copy Mobile"
                                      >
                                        {copiedField === 'mobile' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Additional Mobile */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Alternate Mobile</span>
                                      {editingVoter.additionalMobile ? (
                                        <a href={`tel:${editingVoter.additionalMobile}`} className="text-sm font-black text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block">
                                          📞 {editingVoter.additionalMobile}
                                        </a>
                                      ) : (
                                        <span className="text-sm font-medium text-zinc-400 italic mt-0.5 block">None</span>
                                      )}
                                    </div>
                                    {editingVoter.additionalMobile && (
                                      <button 
                                        type="button"
                                        onClick={() => handleCopy(editingVoter.additionalMobile || '', 'addMobile')}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-all"
                                        title="Copy Alternate Mobile"
                                      >
                                        {copiedField === 'addMobile' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>

                                  {/* Email */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                                    <div className="min-w-0 flex-1">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Email Address</span>
                                      {editingVoter.email ? (
                                        <a href={`mailto:${editingVoter.email}`} className="text-sm font-bold text-blue-600 dark:text-blue-400 hover:underline mt-0.5 block truncate" title={editingVoter.email}>
                                          ✉️ {editingVoter.email}
                                        </a>
                                      ) : (
                                        <span className="text-sm font-medium text-zinc-400 italic mt-0.5 block">Not recorded</span>
                                      )}
                                    </div>
                                    {editingVoter.email && (
                                      <button 
                                        type="button"
                                        onClick={() => handleCopy(editingVoter.email || '', 'email')}
                                        className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-all shrink-0 ml-2"
                                        title="Copy Email"
                                      >
                                        {copiedField === 'email' ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Physical Residential Address */}
                              <div className="space-y-3 pt-2">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <Home size={14} className="text-blue-500" /> Physical Residence & Local Habitat
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">House No</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.houseNo || 'Not specified'}
                                    </span>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Village / Society</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                      {editingVoter.village || 'Not specified'}
                                    </span>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 sm:col-span-2">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Complete Registered Address</span>
                                    <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1 leading-relaxed">
                                      {editingVoter.address || 'No complete address description provided.'}
                                    </p>
                                  </div>

                                  {editingVoter.newAddress && (
                                    <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 sm:col-span-2">
                                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block">Shifted / Migrated Address Tracker</span>
                                      <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mt-1 leading-relaxed">
                                        {editingVoter.newAddress}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 3: HEALTH & ECONOMY (VIEW MODE) */}
                          {activeFormTab === 'health_economy' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                              
                              {/* Health & Vital Status */}
                              <div className="space-y-3">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <Activity size={14} className="text-purple-500" /> Health & Vital Demographics
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                  {/* Vital Status */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Vital Status</span>
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider mt-1.5 ${
                                      editingVoter.vitalStatus === 'Deceased' ? 'bg-red-50 text-red-600 border border-red-200 dark:bg-red-950/40 dark:text-red-400' :
                                      editingVoter.vitalStatus === 'Migrated/Shifted' ? 'bg-amber-50 text-amber-600 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-400' :
                                      'bg-emerald-50 text-emerald-600 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    }`}>
                                      {editingVoter.vitalStatus || 'Active'}
                                    </span>
                                  </div>

                                  {/* Physical Profile */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Physical Profile</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                                      {editingVoter.physicalProfile || 'General'}
                                    </span>
                                  </div>

                                  {/* Disability Category */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Disability Category</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                                      {editingVoter.disabilityCategory || 'None'}
                                    </span>
                                  </div>

                                  {/* ECI Assistance */}
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">ECI Assistance</span>
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-black uppercase tracking-wider mt-1.5 ${
                                      editingVoter.eciAssistanceNeeded 
                                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300' 
                                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                    }`}>
                                      {editingVoter.eciAssistanceNeeded ? 'Assistance Required' : 'Standard'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Economic Profile */}
                              <div className="space-y-3 pt-2">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <Coins size={14} className="text-orange-500" /> Economic & Welfare Profile
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Economic Category</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                                      {editingVoter.economicCategory || 'APL'}
                                    </span>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Monthly Household Income</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                                      {editingVoter.incomeRange || '₹15,000 - ₹30,000'}
                                    </span>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Land Ownership</span>
                                    <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-1 block">
                                      {editingVoter.landOwnership || 'Small Farmer'}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* Civic & Staff Status */}
                              <div className="space-y-3 pt-2">
                                <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                                  <UserCheck size={14} className="text-emerald-500" /> Operational & Electoral Engagement
                                </h4>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Karyakarta / Volunteer Status</span>
                                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                        {editingVoter.isKaryakarta ? 'Active Connection Volunteer' : 'Standard Elector'}
                                      </span>
                                    </div>
                                    <div className={`p-2 rounded-xl ${editingVoter.isKaryakarta ? 'bg-orange-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                                      <UserCheck size={18} />
                                    </div>
                                  </div>

                                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                                    <div>
                                      <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400 block">Voting Cast Status</span>
                                      <span className="text-sm font-bold text-zinc-800 dark:text-zinc-200 mt-0.5 block">
                                        {editingVoter.voted ? 'Voted (Ballot Cast)' : 'Pending (Not Cast)'}
                                      </span>
                                    </div>
                                    <div className={`p-2 rounded-xl ${editingVoter.voted ? 'bg-green-500 text-white' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'}`}>
                                      <CheckCircle size={18} />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* TAB 4: POLITICAL SENTIMENT (VIEW MODE) */}
                          {activeFormTab === 'political_sentiment' && (
                            <div className="space-y-6 animate-in fade-in duration-200">
                              
                              {/* Sentiment Header Card */}
                              <div className="p-5 rounded-3xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 space-y-4">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-200/60 dark:border-zinc-800 pb-3">
                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Voter Support Sentiment</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                                        currentSentiment === 'Support' ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-500/20' :
                                        currentSentiment === 'Neutral' ? 'bg-zinc-500/10 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-500/20' :
                                        currentSentiment === 'Oppose' ? 'bg-red-500/10 text-red-650 dark:bg-red-950/40 dark:text-red-400 border border-red-500/20' :
                                        currentSentiment === 'Other Party' ? 'bg-amber-500/10 text-amber-650 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-500/20' :
                                        'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                                      }`}>
                                        <span className={`w-2 h-2 rounded-full ${
                                          currentSentiment === 'Support' ? 'bg-emerald-500' :
                                          currentSentiment === 'Neutral' ? 'bg-zinc-400' :
                                          currentSentiment === 'Oppose' ? 'bg-red-500' :
                                          currentSentiment === 'Other Party' ? 'bg-amber-500' :
                                          'bg-zinc-350'
                                        }`} />
                                        {currentSentiment}
                                      </span>
                                    </div>
                                  </div>

                                  <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block">Sentiment Strength Rating</span>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {[1, 2, 3, 4, 5].map(st => (
                                        <div 
                                          key={st}
                                          className={`w-6 h-6 rounded-lg text-[11px] font-black flex items-center justify-center ${
                                            st <= sentimentStrength 
                                              ? 'bg-amber-500 text-white shadow-xs' 
                                              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400'
                                          }`}
                                        >
                                          ★
                                        </div>
                                      ))}
                                      <span className="text-xs font-bold text-zinc-600 dark:text-zinc-300 ml-1">
                                        ({sentimentStrength}/5)
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Favored Political Party */}
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1">Registered Party Alignment</span>
                                  <div className="p-3 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                                    <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                      {parties.find(p => p.id === sentimentFavoredPartyId || p.name === sentimentFavoredPartyId)?.name || sentimentFavoredPartyId || (sData?.favoredPartyName as string) || '-'}
                                    </span>
                                  </div>
                                </div>

                                {/* Notes & Field Intel */}
                                <div>
                                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-1.5">Campaign Intel Notes & Feedback</span>
                                  <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-sm font-medium text-zinc-800 dark:text-zinc-200 leading-relaxed min-h-[70px]">
                                    {sentimentNotes || (sData?.notes as string) || (
                                      <span className="text-zinc-400 italic">No voter sentiment notes or field feedback recorded yet.</span>
                                    )}
                                  </div>
                                </div>

                                {/* Metadata Footer */}
                                {(lastSentimentUpdatedBy || lastSentimentUpdatedAt) && (
                                  <div className="flex flex-wrap items-center justify-between text-[10px] font-bold text-zinc-400 uppercase tracking-wider pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50">
                                    {lastSentimentUpdatedBy && <span>Recorded By: <strong className="text-zinc-700 dark:text-zinc-300">{lastSentimentUpdatedBy}</strong></span>}
                                    {lastSentimentUpdatedAt && <span>Updated: <strong className="text-zinc-700 dark:text-zinc-300">{lastSentimentUpdatedAt}</strong></span>}
                                  </div>
                                )}
                              </div>

                              {/* Super Admin Multi-Admin Assessments */}
                              {isSuperAdmin && voterAssessments.length > 0 && (
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/70 to-purple-50/70 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900/40 space-y-3">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                                      <Users size={14} /> Multi-Admin Assessments for this Voter ({voterAssessments.length})
                                    </span>
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/70 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                                      Super Admin Intel
                                    </span>
                                  </div>
                                  
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                    {voterAssessments.map(a => (
                                      <div key={a.id} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                            👑 {a.admin_name}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                            a.sentiment === 'Support' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                            a.sentiment === 'Oppose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
                                            'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                          }`}>
                                            {a.sentiment || 'Neutral'} ({a.sentiment_score || 3}★)
                                          </span>
                                        </div>
                                        {a.notes && (
                                          <p className="text-[10px] text-zinc-500 italic bg-zinc-50 dark:bg-zinc-950/60 p-1.5 rounded">
                                            "{a.notes}"
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* View Mode Footer */}
                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0 p-5">
                  <div className="max-w-5xl mx-auto w-full flex justify-end items-center">
                    <button 
                      type="button" 
                      onClick={() => setIsModalOpen(false)} 
                      className="webapp-button-secondary px-6 py-2.5 text-xs font-bold cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* EDIT MODE CONTENT & FORM */
              <form onSubmit={handleCreateOrUpdate} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar">
                  <div className="max-w-4xl mx-auto w-full p-8 space-y-6">
                  
                  {activeFormTab === 'main' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {isVolunteer && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                          <AlertCircle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="font-medium">
                            <strong>Master Demographic Registry:</strong> Core voter identity details are managed by Campaign Managers and Admins. You can review this data and update the <strong>Health & Economy</strong> and <strong>Political Sentiment</strong> tabs.
                          </span>
                        </div>
                      )}

                      {/* Basic Identity Details */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800 pb-1">Basic Identity</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Voter ID (EPIC NO)</label>
                            <input disabled={isVolunteer} required value={formData.voterId} onChange={e => setFormData({ ...formData, voterId: e.target.value.toUpperCase() })} className={`webapp-input w-full h-11 text-sm font-black ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. ABC1234567" />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Full Name</label>
                            <input disabled={isVolunteer} required value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="As per voter list" />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Father / Husband Name</label>
                            <input disabled={isVolunteer} value={formData.relationName || ''} onChange={e => setFormData({ ...formData, relationName: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="Father's or Husband's Name" />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Aadhar Number</label>
                            <input disabled={isVolunteer} value={formData.aadharNumber} onChange={e => setFormData({ ...formData, aadharNumber: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. 1234 5678 9012" />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Gender</label>
                            <select disabled={isVolunteer} value={formData.gender} onChange={e => setFormData({ ...formData, gender: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="Male">Male</option>
                              <option value="Female">Female</option>
                              <option value="Other">Other</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Date of Birth</label>
                            <input 
                              type="date" 
                              disabled={isVolunteer}
                              required
                              value={formData.dob} 
                              onChange={e => {
                                const dobVal = e.target.value;
                                setFormData({ ...formData, dob: dobVal, age: calculateAge(dobVal) });
                              }} 
                              className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} 
                            />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Age (Calculated)</label>
                            <input 
                              type="text" 
                              readOnly 
                              value={formData.age > 0 ? `${formData.age} Years` : 'Select DOB'} 
                              className="webapp-input w-full h-11 text-sm font-bold bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 cursor-not-allowed select-none" 
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Caste / Category</label>
                            <select disabled={isVolunteer} value={formData.caste || 'General'} onChange={e => setFormData({ ...formData, caste: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="General">General</option>
                              <option value="OBC">OBC (Other Backward Classes)</option>
                              <option value="SC">SC (Scheduled Caste)</option>
                              <option value="ST">ST (Scheduled Tribe)</option>
                              <option value="Minority">Minority</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Occupation</label>
                            <select disabled={isVolunteer} value={formData.occupation || 'Private Service'} onChange={e => setFormData({ ...formData, occupation: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="Farmer">Farmer / Agriculture</option>
                              <option value="Government Service">Government Service</option>
                              <option value="Private Service">Private Service</option>
                              <option value="Business Owner">Business & Retail</option>
                              <option value="Student">Student</option>
                              <option value="Housewife">Housewife / Homemaker</option>
                              <option value="Unemployed">Unemployed</option>
                              <option value="Retired">Retired</option>
                              <option value="Other">Other / Professional</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Education Qualification</label>
                            <select value={formData.education || 'Unspecified'} onChange={e => setFormData({ ...formData, education: e.target.value })} className="webapp-input w-full h-11 text-sm font-bold">
                              <option value="Unspecified">Unspecified / None</option>
                              <option value="Illiterate">Illiterate / No Formal</option>
                              <option value="Below Matric">Below Matric (Class 1-9)</option>
                              <option value="Matriculation">Matriculation (10th Pass)</option>
                              <option value="Senior Secondary">Senior Secondary (12th Pass)</option>
                              <option value="Diploma">Diploma / Certified Course</option>
                              <option value="Under Graduate">Undergraduate / Graduate</option>
                              <option value="Post Graduate">Postgraduate (Master's)</option>
                              <option value="Doctorate">Doctorate / Professional</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Party Alignment / Favored</label>
                            <select
                              value={sentimentFavoredPartyId}
                              onChange={e => {
                                setSentimentFavoredPartyId(e.target.value);
                                const sel = parties.find(p => p.id === e.target.value || p.name === e.target.value);
                                setFormData(prev => ({ ...prev, partyInclination: sel?.name || e.target.value }));
                              }}
                              className="webapp-input w-full h-11 text-sm font-bold bg-white dark:bg-zinc-900 cursor-pointer"
                            >
                              <option value="">-- Choose Inclined Party --</option>
                              {parties.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.code ? `(${p.code})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Deployment / Administrative Location Details */}
                      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800 pb-1">Deployment & Geography</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">State</label>
                            <select disabled={isVolunteer} required value={formData.stateId} onChange={e => setFormData({ ...formData, stateId: e.target.value, districtId: '', constituencyId: '', boothId: '' })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="" disabled>Select State</option>
                              {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">District</label>
                            <select disabled={isVolunteer} required value={formData.districtId} onChange={e => setFormData({ ...formData, districtId: e.target.value, constituencyId: '', boothId: '' })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="" disabled>Select District</option>
                              {districts.filter(d => d.stateId === formData.stateId).map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Constituency</label>
                            <select disabled={isVolunteer} required value={formData.constituencyId} onChange={e => setFormData({ ...formData, constituencyId: e.target.value, boothId: '' })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="" disabled>Select Constituency</option>
                              {constituencies.filter(c => c.districtId === formData.districtId).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Booth</label>
                            <select disabled={isVolunteer} required value={formData.boothId} onChange={e => setFormData({ ...formData, boothId: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`}>
                              <option value="" disabled>Select Booth</option>
                              {booths.filter(b => b.constituencyId === formData.constituencyId).map(b => <option key={b.id} value={b.id}>#{b.boothNumber} - {b.name}</option>)}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Part No</label>
                            <input disabled={isVolunteer} value={formData.partNo} onChange={e => setFormData({ ...formData, partNo: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. 52" />
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Serial No</label>
                            <input disabled={isVolunteer} value={formData.srNo} onChange={e => setFormData({ ...formData, srNo: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. 142" />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === 'contact' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {isVolunteer && (
                        <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs flex items-center gap-2.5">
                          <AlertCircle size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="font-medium">
                            <strong>Master Contact Registry:</strong> Address and telephone registry are managed by Campaign Managers and Admins.
                          </span>
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Primary Mobile</label>
                          <input disabled={isVolunteer} type="tel" value={formData.mobile} onChange={e => setFormData({ ...formData, mobile: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. 9876543210" />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Additional Mobile (Optional)</label>
                          <input disabled={isVolunteer} type="tel" value={formData.additionalMobile} onChange={e => setFormData({ ...formData, additionalMobile: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="Alternate, Sub-contact" />
                        </div>
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Email Address</label>
                        <input disabled={isVolunteer} type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className={`webapp-input w-full h-11 text-sm font-bold placeholder-zinc-400 dark:placeholder-zinc-500 ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. name@domain.com" />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">House No</label>
                          <input disabled={isVolunteer} value={formData.houseNo} onChange={e => setFormData({ ...formData, houseNo: e.target.value })} className={`webapp-input w-full h-11 text-sm ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. 154-C" />
                        </div>
                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Village / Society</label>
                          <input disabled={isVolunteer} value={formData.village} onChange={e => setFormData({ ...formData, village: e.target.value })} className={`webapp-input w-full h-11 text-sm ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="e.g. Green Meadows" />
                        </div>
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Full Address</label>
                        <textarea disabled={isVolunteer} value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className={`webapp-input w-full h-20 text-sm py-2 ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="Full residential physical address details..." />
                      </div>

                      <div className="space-y-1.5 flex flex-col">
                        <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">New Address (Shifted/Migrated Track)</label>
                        <textarea disabled={isVolunteer} value={formData.newAddress} onChange={e => setFormData({ ...formData, newAddress: e.target.value })} className={`webapp-input w-full h-16 text-sm py-2 ${isVolunteer ? 'opacity-70 bg-zinc-100 dark:bg-zinc-900 cursor-not-allowed' : ''}`} placeholder="If voter shifted, track current location here..." />
                      </div>
                    </div>
                  )}

                  {activeFormTab === 'health_economy' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      
                      {/* Super Admin Multi-Admin Overview */}
                      {isSuperAdmin && voterAssessments.length > 0 && (
                        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50/70 via-indigo-50/70 to-purple-50/70 dark:from-blue-950/30 dark:via-indigo-950/30 dark:to-purple-950/30 border border-blue-200 dark:border-blue-900/40 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                              <Users size={14} /> Multi-Admin Assessments for this Voter ({voterAssessments.length})
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-200/70 dark:bg-blue-900/60 text-blue-800 dark:text-blue-200">
                              Super Admin Unified Intel
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                            {voterAssessments.map(a => (
                              <div key={a.id} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                                    👑 {a.admin_name}
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                    a.sentiment === 'Support' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400' :
                                    a.sentiment === 'Oppose' ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-400' :
                                    'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                                  }`}>
                                    {a.sentiment || 'Neutral'} ({a.sentiment_score || 3}★)
                                  </span>
                                </div>
                                <div className="text-[11px] text-zinc-600 dark:text-zinc-400 grid grid-cols-2 gap-1 font-medium">
                                  <div>Health: <strong className="text-zinc-800 dark:text-zinc-200">{a.physical_profile || 'General'}</strong></div>
                                  <div>Economy: <strong className="text-zinc-800 dark:text-zinc-200">{a.economic_category || 'APL'}</strong></div>
                                  <div>Vital: <strong className="text-zinc-800 dark:text-zinc-200">{a.vital_status || 'Active'}</strong></div>
                                  <div>Income: <strong className="text-zinc-800 dark:text-zinc-200">{a.income_range || '—'}</strong></div>
                                </div>
                                {a.notes && (
                                  <p className="text-[10px] text-zinc-500 italic bg-zinc-50 dark:bg-zinc-950/60 p-1.5 rounded">
                                    "{a.notes}"
                                  </p>
                                )}
                                <div className="flex items-center justify-between pt-1 border-t border-zinc-100 dark:border-zinc-800 text-[9px] text-zinc-400">
                                  <span>By {a.recorded_by_display_name || 'Staff'}</span>
                                  <button
                                    type="button"
                                    onClick={() => applyAdminAssessment(a)}
                                    className="px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all"
                                  >
                                    Load this Assessment
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Non-Super Admin Sector context card */}
                      {!isSuperAdmin && (
                        <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                          <div>
                            <span className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider block">Campaign Administrator Sector</span>
                            <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                              Sector Admin: {profile?.parentAdminName || profile?.name || 'Assigned Admin'} ({profile?.role === 'volunteer' ? 'Karyakarta Assessment' : (profile?.role === 'manager' ? 'Campaign Manager' : 'Admin Staff')})
                            </span>
                          </div>
                          <span className="text-[9px] bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Sector Secured</span>
                        </div>
                      )}

                      {/* Health Section */}
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800 pb-1">Health & Vital Status</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Vital Status</label>
                            <select value={formData.vitalStatus} onChange={e => setFormData({ ...formData, vitalStatus: e.target.value })} className="webapp-input w-full h-11 text-sm font-bold">
                              <option value="Active">Active (On List)</option>
                              <option value="Deceased">Deceased</option>
                              <option value="Migrated/Shifted">Migrated / Shifted</option>
                            </select>
                            <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-tight">Rule: Archived status will automatically exclude the voter from active operational lists by default.</p>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Physical / Health Profile</label>
                            <select value={formData.physicalProfile} onChange={e => setFormData({ ...formData, physicalProfile: e.target.value, disabilityCategory: e.target.value === 'PwD' ? formData.disabilityCategory : 'None' })} className="webapp-input w-full h-11 text-sm font-bold">
                              <option value="General">General / Healthy</option>
                              <option value="PwD">PwD (Person with Disability)</option>
                              <option value="Senior Citizen">Senior Citizen (Bedridden/Frail)</option>
                              <option value="Chronic Illness">Chronic Illness</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className={`text-[10px] font-black uppercase tracking-wider ${formData.physicalProfile !== 'PwD' ? 'text-zinc-400 dark:text-zinc-600' : 'text-zinc-500 dark:text-zinc-400'}`}>Disability Category</label>
                            <select 
                              disabled={formData.physicalProfile !== 'PwD'} 
                              value={formData.disabilityCategory} 
                              onChange={e => setFormData({ ...formData, disabilityCategory: e.target.value })} 
                              className={`webapp-input w-full h-11 text-sm font-bold ${formData.physicalProfile !== 'PwD' ? 'opacity-50 cursor-not-allowed bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500' : ''}`}
                            >
                              <option value="None">None</option>
                              <option value="Locomotor">Locomotor Disability</option>
                              <option value="Visual">Visual Impairment</option>
                              <option value="Speech & Hearing">Speech & Hearing</option>
                              <option value="Other">Other disability</option>
                            </select>
                          </div>
                          
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">ECI Assistance Needed</label>
                            <div className="flex bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-xl border border-zinc-200 dark:border-zinc-800 h-11 items-center">
                              {[
                                { label: 'No Assistance', value: false },
                                { label: 'ECI Assist', value: true }
                              ].map(item => (
                                <button
                                  key={String(item.value)}
                                  type="button"
                                  onClick={() => setFormData({ ...formData, eciAssistanceNeeded: item.value })}
                                  className={`flex-1 text-[10px] uppercase font-black tracking-tight py-2 rounded-lg transition-all cursor-pointer ${
                                    formData.eciAssistanceNeeded === item.value 
                                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-950 shadow-sm'
                                      : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Economic Section */}
                      <div className="space-y-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800 pb-1">Economic & Welfare Intelligence</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Economic Category</label>
                            <select value={formData.economicCategory || 'APL'} onChange={e => setFormData({ ...formData, economicCategory: e.target.value })} className="webapp-input w-full h-11 text-sm font-bold">
                              <option value="APL">APL (Above Poverty Line)</option>
                              <option value="BPL">BPL (Below Poverty Line)</option>
                              <option value="EWS">EWS (Economically Weaker Section)</option>
                            </select>
                          </div>
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Monthly Household Income Range</label>
                            <select value={formData.incomeRange || '₹15,000 - ₹30,000'} onChange={e => setFormData({ ...formData, incomeRange: e.target.value })} className="webapp-input w-full h-11 text-sm font-bold">
                              <option value="Under ₹15,000">Under ₹15,000</option>
                              <option value="₹15,000 - ₹30,000">₹15,000 - ₹30,000</option>
                              <option value="₹30,000 - ₹60,000">₹30,000 - ₹60,000</option>
                              <option value="Above ₹60,000">Above ₹60,000</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-1.5 flex flex-col">
                          <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Land Ownership Type</label>
                          <select value={formData.landOwnership || 'Small Farmer'} onChange={e => setFormData({ ...formData, landOwnership: e.target.value })} className="webapp-input w-full h-11 text-sm font-bold">
                            <option value="Landless">Landless</option>
                            <option value="Small Farmer">Small Farmer</option>
                            <option value="Marginal Farmer">Marginal Farmer</option>
                            <option value="Large Landowner">Large Landowner</option>
                            <option value="Urban Commercial/Residential Only">Urban Commercial / Residential Only</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-zinc-200 dark:border-zinc-800">
                          <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.isKaryakarta ? 'bg-orange-500 text-white shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                              <UserCheck size={18} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Karyakarta Staff</label>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{formData.isKaryakarta ? 'Active Staff' : 'Standard'}</span>
                                <button type="button" onClick={() => setFormData({ ...formData, isKaryakarta: !formData.isKaryakarta })} className={`w-8 h-5 rounded-full relative transition-all cursor-pointer ${formData.isKaryakarta ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.isKaryakarta ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4 p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${formData.voted ? 'bg-green-500 text-white shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                              <CheckCircle size={18} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Voting Status</label>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">{formData.voted ? 'Voted' : 'Pending'}</span>
                                <button type="button" onClick={() => setFormData({ ...formData, voted: !formData.voted })} className={`w-8 h-5 rounded-full relative transition-all cursor-pointer ${formData.voted ? 'bg-green-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
                                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${formData.voted ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeFormTab === 'political_sentiment' && (
                    <div className="space-y-6 animate-in fade-in duration-200">
                      {loadingSentiment ? (
                        <div className="flex flex-col items-center justify-center py-12 gap-2 text-center">
                          <Loader2 size={24} className="animate-spin text-zinc-500" />
                          <span className="text-zinc-400 font-bold text-[10px] uppercase tracking-wider">Syncing Admin Sentiment Data...</span>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <h4 className="text-[11px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-[0.2em] border-b border-zinc-200 dark:border-zinc-800 pb-1">Political Sentiment Profile</h4>
                          
                          {/* Admin Context Selector - visible to Super Admin or read-only info for other roles */}
                          {isSuperAdmin ? (
                            <div className="space-y-2 p-3.5 rounded-2xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40">
                              <div className="flex items-center justify-between">
                                <label className="text-[10px] font-black uppercase text-blue-700 dark:text-blue-300 tracking-wider flex items-center gap-1.5">
                                  <Users size={13} /> Active Admin Assessment Context
                                </label>
                                <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">Super Admin Mode</span>
                              </div>
                              <select 
                                value={sentimentAdminId} 
                                onChange={e => {
                                  const newAdmId = e.target.value;
                                  setSentimentAdminId(newAdmId);
                                  const matching = voterAssessments.find(a => a.admin_id === newAdmId);
                                  if (matching) {
                                    applyAdminAssessment(matching);
                                  }
                                }} 
                                className="webapp-input w-full h-11 text-sm font-bold bg-white dark:bg-zinc-900"
                              >
                                <option value="">-- Choose Admin Context --</option>
                                {allAdmins.map(adm => (
                                  <option key={adm.uid} value={adm.uid}>{adm.username} ({adm.role === 'super_admin' ? 'Super Admin' : 'Admin'} - {adm.email})</option>
                                ))}
                              </select>
                              <p className="text-[9px] text-zinc-500 dark:text-zinc-400 leading-tight">*As Super Admin, you can switch between any administrator to inspect or record their linked assessment.</p>
                            </div>
                          ) : (
                            <div className="p-3 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
                              <div>
                                <span className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider block">Campaign Administrator Context</span>
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                  Sector Admin: {profile?.parentAdminName || profile?.name || 'Assigned Admin'} ({profile?.role === 'volunteer' ? 'Karyakarta Staff' : (profile?.role === 'manager' ? 'Campaign Manager' : 'Admin Staff')})
                                </span>
                              </div>
                              <span className="text-[9px] bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-400 border border-blue-200 dark:border-blue-900/50 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">Sector Secured</span>
                            </div>
                          )}

                          {/* Sentiment Status Selection */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider block">Voter Sentiment Status</label>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {[
                                { value: 'Support', label: 'Support', activeClass: 'border-emerald-600 bg-emerald-600 text-white font-black shadow-md' },
                                { value: 'Neutral', label: 'Neutral', activeClass: 'border-zinc-600 bg-zinc-600 text-white font-black shadow-md' },
                                { value: 'Oppose', label: 'Oppose', activeClass: 'border-rose-600 bg-rose-600 text-white font-black shadow-md' },
                                { value: 'Other Party', label: 'Other Party', activeClass: 'border-amber-600 bg-amber-600 text-white font-black shadow-md' }
                              ].map(item => {
                                const isSelected = sentimentStatus === item.value;
                                return (
                                  <button
                                    key={item.value}
                                    type="button"
                                    onClick={() => setSentimentStatus(item.value as 'Support' | 'Neutral' | 'Oppose' | 'Other Party')}
                                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                      isSelected
                                        ? item.activeClass
                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                  >
                                    <span>{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Registered Political Party Preference */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider block flex items-center justify-between">
                              <span>Registered Political Party Preference / Alignment</span>
                              {sentimentFavoredPartyId && (
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold lowercase">
                                  Selected: {parties.find(p => p.id === sentimentFavoredPartyId || p.name === sentimentFavoredPartyId)?.name || sentimentFavoredPartyId}
                                </span>
                              )}
                            </label>
                            <select
                              value={sentimentFavoredPartyId}
                              onChange={e => {
                                setSentimentFavoredPartyId(e.target.value);
                                const sel = parties.find(p => p.id === e.target.value || p.name === e.target.value);
                                setFormData(prev => ({ ...prev, partyInclination: sel?.name || e.target.value }));
                              }}
                              className="webapp-input w-full h-11 text-sm font-bold bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 cursor-pointer focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="">-- Choose Inclined / Favored Party --</option>
                              {parties.map(p => (
                                <option key={p.id} value={p.id}>
                                  {p.name} {p.code ? `(${p.code})` : ''}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Sentiment Strength (1-5) */}
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider block">Sentiment Strength / Intensity (1 - 5)</label>
                            <div className="flex flex-wrap items-center gap-2">
                              {[1, 2, 3, 4, 5].map(rating => {
                                const isSelected = sentimentStrength === rating;
                                return (
                                  <button
                                    key={rating}
                                    type="button"
                                    onClick={() => setSentimentStrength(rating)}
                                    className={`w-10 h-10 rounded-xl border text-sm font-black flex items-center justify-center transition-all cursor-pointer ${
                                      isSelected
                                        ? 'border-amber-500 bg-amber-500 text-white font-black shadow-md'
                                        : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                    }`}
                                  >
                                    {rating}
                                  </button>
                                );
                              })}
                              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 ml-1.5">
                                {sentimentStrength === 1 && '1 - Highly Volatile / Very Weak'}
                                {sentimentStrength === 2 && '2 - Weak / Soft support'}
                                {sentimentStrength === 3 && '3 - Moderate / Uncertain'}
                                {sentimentStrength === 4 && '4 - Strong / Aligned'}
                                {sentimentStrength === 5 && '5 - Very Strong / Committed'}
                              </span>
                            </div>
                          </div>

                          {/* Mark as Karyakarta Toggle */}
                          <div className="flex items-center gap-4 p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${sentimentIsKaryakarta ? 'bg-orange-500 text-white shadow-md' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500'}`}>
                              <UserCheck size={18} />
                            </div>
                            <div className="flex-1">
                              <label className="text-[9px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Local Connection Volunteer</label>
                              <div className="flex justify-between items-center mt-0.5">
                                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                                  {sentimentIsKaryakarta ? 'Marked as local Karyakarta/Volunteer' : 'Mark as connection volunteer'}
                                </span>
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    setSentimentIsKaryakarta(!sentimentIsKaryakarta);
                                    setFormData(prev => ({ ...prev, isKaryakarta: !sentimentIsKaryakarta }));
                                  }} 
                                  className={`w-8 h-5 rounded-full relative transition-all cursor-pointer ${sentimentIsKaryakarta ? 'bg-orange-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                                >
                                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${sentimentIsKaryakarta ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Notes & Feedback */}
                          <div className="space-y-1.5 flex flex-col">
                            <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider">Campaign Intel Notes & Feedback</label>
                            <textarea 
                              value={sentimentNotes} 
                              onChange={e => setSentimentNotes(e.target.value)} 
                              className="webapp-input w-full h-24 text-sm py-2" 
                              placeholder="Record support reasons, concerns, party alignments, or issues raised by this voter..." 
                            />
                          </div>

                          {/* Last Update Metadata */}
                          {lastSentimentUpdatedBy && (
                            <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-wider space-y-1">
                              <div>Last Updated By: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{lastSentimentUpdatedBy}</span></div>
                              {lastSentimentUpdatedAt && <div>Date & Time: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{lastSentimentUpdatedAt}</span></div>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  </div>
                </div>

                <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/80 shrink-0 p-6">
                  <div className="max-w-4xl mx-auto w-full flex flex-col sm:flex-row justify-between gap-3">
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => setIsModalOpen(false)} 
                        className="webapp-button-secondary px-5 py-2.5 text-xs font-bold cursor-pointer"
                      >
                        Cancel
                      </button>
                      {activeFormTab !== 'main' && (
                        <button 
                          type="button" 
                          onClick={() => {
                            const tabSequence: typeof activeFormTab[] = ['main', 'contact', 'health_economy', 'political_sentiment'];
                            const curIdx = tabSequence.indexOf(activeFormTab);
                            if (curIdx > 0) setActiveFormTab(tabSequence[curIdx - 1]);
                          }} 
                          className="webapp-button-secondary px-5 py-2.5 text-xs font-bold cursor-pointer"
                        >
                          Back
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {activeFormTab !== 'political_sentiment' ? (
                        <button 
                          type="button" 
                          onClick={() => {
                            const tabSequence: typeof activeFormTab[] = ['main', 'contact', 'health_economy', 'political_sentiment'];
                            const curIdx = tabSequence.indexOf(activeFormTab);
                            if (curIdx < tabSequence.length - 1) {
                              setActiveFormTab(tabSequence[curIdx + 1]);
                            }
                          }} 
                          className="webapp-button-primary px-6 py-2.5 text-xs font-bold cursor-pointer"
                        >
                          Continue
                        </button>
                      ) : (
                        <button type="submit" disabled={actionLoading} className="webapp-button-primary px-8 py-2.5 text-xs flex justify-center items-center gap-2 font-bold cursor-pointer">
                          {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                          {editingVoter ? 'Sync Updates' : 'Confirm Entry'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

       {/* Bulk Import Modal */}
       <BulkImportModal
         isOpen={isImportModalOpen}
         onClose={() => setIsImportModalOpen(false)}
         onSuccess={fetchVoters}
         states={states}
         initialStateId={selectedStateId !== 'all' ? selectedStateId : (selectedStateIds[0] || '')}
         initialDistrictId={selectedDistrictId !== 'all' ? selectedDistrictId : (selectedDistrictIds[0] || '')}
         initialConstituencyId={selectedConstituencyId !== 'all' ? selectedConstituencyId : (selectedConstituencyIds[0] || '')}
         initialBoothId={selectedBoothId !== 'all' ? selectedBoothId : (selectedBoothIds[0] || '')}
       />

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingId(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-zinc-950 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Are you sure?</h3>
              <p className="text-zinc-500 text-sm mb-6">This will permanently remove the voter record. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 transition-all">Cancel</button>
                <button 
                  onClick={() => {
                    const voter = voters.find(v => v.id === deletingId);
                    if (voter) handleDelete(voter.id, voter.name);
                  }} 
                  className="flex-1 px-4 py-2 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center gap-2"
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : "Delete"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default VoterManagement;
