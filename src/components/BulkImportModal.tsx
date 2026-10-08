import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Download, 
  FileSpreadsheet, 
  CheckCircle, 
  AlertCircle, 
  MapPin, 
  Sparkles,
  FileCheck,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  UserCheck,
  ShieldCheck,
  Building2
} from 'lucide-react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';

export interface IndiaState {
  id: string;
  name: string;
  code?: string;
}

export interface IndiaDistrict {
  id: string;
  name: string;
  stateId: string;
  stateName?: string;
}

export interface IndiaConstituency {
  id: string;
  name: string;
  districtId: string;
  stateId?: string;
  districtName?: string;
  stateName?: string;
}

export interface IndiaMandal {
  id: string;
  name: string;
  code?: string;
  constituencyId: string;
  districtId?: string;
  stateId?: string;
  constituencyName?: string;
}

export interface IndiaPanchayat {
  id: string;
  name: string;
  code?: string;
  mandalId: string;
  constituencyId?: string;
  districtId?: string;
  stateId?: string;
  type?: string;
  mandalName?: string;
}

export interface IndiaWard {
  id: string;
  name: string;
  wardNumber?: string;
  panchayatId?: string;
  mandalId?: string;
  constituencyId?: string;
  districtId?: string;
  stateId?: string;
  panchayatName?: string;
}

export interface IndiaBooth {
  id: string;
  name: string;
  boothNumber: string;
  wardId?: string;
  panchayatId?: string;
  mandalId?: string;
  constituencyId: string;
  districtId?: string;
  stateId?: string;
}

const normalizeId = (id: any): string => {
  if (id === null || id === undefined) return '';
  return String(id).trim().replace(/\.0$/, '');
};

const unwrapList = (res: any): any[] => {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.results)) return res.results;
  if (Array.isArray(res?.data)) return res.data;
  return [];
};

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialStateId?: string;
  initialDistrictId?: string;
  initialConstituencyId?: string;
  initialMandalId?: string;
  initialPanchayatId?: string;
  initialWardId?: string;
  initialBoothId?: string;
  states?: IndiaState[];
}

export interface ParsedVoterRow {
  voter_id: string;
  name: string;
  relation_name: string;
  relation_type: string;
  gender: string;
  age: number;
  part_no: string;
  sr_no: string;
  mobile: string;
  email: string;
  address: string;
  house_no: string;
  village: string;
  caste: string;
  occupation: string;
  is_karyakarta: number;
  voting_status: string;
  party_inclination: string;
  booth_id?: string;
  ward_id?: string;
  ward_name?: string;
  panchayat_id?: string;
  panchayat_name?: string;
  mandal_id?: string;
  constituency_id?: string;
  district_id?: string;
  state_id?: string;
  [key: string]: any;
}

// Standard Sample Data Matching user's primary bulk upload format
const STANDARD_SAMPLE_VOTERS = [
  {
    'Voter Name': 'Rajesh Kumar',
    'Relative Name': 'Dev Raj',
    'Relation': 'Father',
    'Gender': 'Male',
    'Age': 38,
    'EPIC No': 'HP01054001',
    'House No': '14-A',
    'Ward Name': 'Ward No 4 Main Bazar',
    'Mobile': '9816012345',
    'Part No': '1',
    'Serial No': '101',
    'Caste': 'General',
    'Occupation': 'Business',
    'Is Karyakarta': 'No',
    'Voting Status': 'unvoted',
    'Favored Party': 'Strong Supporter'
  },
  {
    'Voter Name': 'Sunita Sharma',
    'Relative Name': 'Rajesh Kumar',
    'Relation': 'Husband',
    'Gender': 'Female',
    'Age': 34,
    'EPIC No': 'HP01054002',
    'House No': '14-A',
    'Ward Name': 'Ward No 4 Main Bazar',
    'Mobile': '9816054321',
    'Part No': '1',
    'Serial No': '102',
    'Caste': 'General',
    'Occupation': 'Homemaker',
    'Is Karyakarta': 'No',
    'Voting Status': 'unvoted',
    'Favored Party': 'Favorable'
  },
  {
    'Voter Name': 'Amit Singh',
    'Relative Name': 'Mohan Singh',
    'Relation': 'Father',
    'Gender': 'Male',
    'Age': 26,
    'EPIC No': 'HP01054003',
    'House No': '52',
    'Ward Name': 'Chakli',
    'Mobile': '9418011223',
    'Part No': '1',
    'Serial No': '103',
    'Caste': 'OBC',
    'Occupation': 'Govt Employee',
    'Is Karyakarta': 'No',
    'Voting Status': 'unvoted',
    'Favored Party': 'Neutral'
  },
  {
    'Voter Name': 'Pooja Devi',
    'Relative Name': 'Amit Singh',
    'Relation': 'Husband',
    'Gender': 'Female',
    'Age': 24,
    'EPIC No': 'HP01054004',
    'House No': '52',
    'Ward Name': 'Chakli',
    'Mobile': '9418099887',
    'Part No': '1',
    'Serial No': '104',
    'Caste': 'OBC',
    'Occupation': 'Private Service',
    'Is Karyakarta': 'No',
    'Voting Status': 'unvoted',
    'Favored Party': 'Favorable'
  },
  {
    'Voter Name': 'Kewal Ram',
    'Relative Name': 'Ram Lal',
    'Relation': 'Father',
    'Gender': 'Male',
    'Age': 61,
    'EPIC No': 'HP01054005',
    'House No': '08',
    'Ward Name': 'Near Old Temple',
    'Mobile': '9805067890',
    'Part No': '1',
    'Serial No': '105',
    'Caste': 'SC',
    'Occupation': 'Farmer',
    'Is Karyakarta': 'Yes',
    'Voting Status': 'unvoted',
    'Favored Party': 'Strong Supporter'
  }
];

// Field definitions for the in-app schema guide
const SCHEMA_COLUMNS = [
  { field: 'Voter Name', type: 'TEXT', req: 'Required', desc: 'Full Name of the voter (e.g. Rajesh Kumar)' },
  { field: 'Relative Name', type: 'TEXT', req: 'Optional', desc: "Father's / Husband's / Relative's Name" },
  { field: 'Relation', type: 'TEXT', req: 'Optional', desc: 'Relation type: Father, Husband, Mother, Guardian, Other' },
  { field: 'Gender', type: 'TEXT', req: 'Optional', desc: 'Gender: Male, Female, Other' },
  { field: 'Age', type: 'INT', req: 'Optional', desc: 'Age in years (e.g. 38)' },
  { field: 'EPIC No', type: 'VARCHAR', req: 'Required', desc: 'Voter ID / EPIC card number (e.g. HP01054001)' },
  { field: 'House No', type: 'VARCHAR', req: 'Optional', desc: 'House, Flat or Building Number (e.g. 14-A)' },
  { field: 'Ward Name', type: 'VARCHAR', req: 'Optional', desc: 'Ward, Village, Mohalla or Area Name' },
  { field: 'Mobile', type: 'VARCHAR', req: 'Optional', desc: '10-digit mobile contact number' },
  { field: 'Part No', type: 'VARCHAR', req: 'Optional', desc: 'Voter list polling part number' },
  { field: 'Serial No', type: 'VARCHAR', req: 'Optional', desc: 'Serial number on electoral roll' },
  { field: 'Caste', type: 'VARCHAR', req: 'Optional', desc: 'Category: General, OBC, SC, ST, etc.' },
  { field: 'Occupation', type: 'VARCHAR', req: 'Optional', desc: 'Business, Farmer, Homemaker, Service, etc.' },
  { field: 'Is Karyakarta', type: 'Yes/No', req: 'Optional', desc: 'Yes or 1 if party karyakarta/volunteer' },
  { field: 'Voting Status', type: 'VARCHAR', req: 'Optional', desc: 'unvoted or voted' },
  { field: 'Favored Party', type: 'VARCHAR', req: 'Optional', desc: 'Strong Supporter, Favorable, Neutral, Opposition' }
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStateId = '',
  initialDistrictId = '',
  initialConstituencyId = '',
  initialMandalId = '',
  initialPanchayatId = '',
  initialWardId = '',
  initialBoothId = '',
  states: propStates,
}) => {
  // Master Demographics State (DemographicSettings reference)
  const [allStates, setAllStates] = useState<IndiaState[]>([]);
  const [allDistricts, setAllDistricts] = useState<IndiaDistrict[]>([]);
  const [allConstituencies, setAllConstituencies] = useState<IndiaConstituency[]>([]);
  const [allMandals, setAllMandals] = useState<IndiaMandal[]>([]);
  const [allPanchayats, setAllPanchayats] = useState<IndiaPanchayat[]>([]);
  const [allWards, setAllWards] = useState<IndiaWard[]>([]);
  const [allBooths, setAllBooths] = useState<IndiaBooth[]>([]);
  const [loadingDemographics, setLoadingDemographics] = useState(false);

  const [selectedStateId, setSelectedStateId] = useState<string>(initialStateId || '');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(initialDistrictId || '');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>(initialConstituencyId || '');
  const [selectedMandalId, setSelectedMandalId] = useState<string>(initialMandalId || '');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>(initialPanchayatId || '');
  const [selectedWardId, setSelectedWardId] = useState<string>(initialWardId || '');
  const [selectedBoothId, setSelectedBoothId] = useState<string>(initialBoothId || '');

  // Default Electoral Roll Indices
  const [defaultPartNo, setDefaultPartNo] = useState<string>('');
  const [defaultSrNo, setDefaultSrNo] = useState<string>('');

  // Parsing & File state
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedVoterRow[]>([]);
  const [previewRows, setPreviewRows] = useState<ParsedVoterRow[]>([]);
  const [showFieldGuide, setShowFieldGuide] = useState(false);
  
  // Execution status
  const [status, setStatus] = useState<'idle' | 'preview' | 'importing' | 'completed' | 'error'>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [results, setResults] = useState({
    total: 0,
    inserted: 0,
    updated: 0,
    failed: 0,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unified Demographic Data Loader matching DemographicSettings reference
  useEffect(() => {
    if (!isOpen) return;
    setLoadingDemographics(true);
    Promise.all([
      api.get<any[]>('/api/states').catch(() => []),
      api.get<any[]>('/api/districts').catch(() => []),
      api.get<any[]>('/api/constituencies').catch(() => []),
      api.get<any[]>('/api/mandals').catch(() => []),
      api.get<any[]>('/api/panchayats').catch(() => []),
      api.get<any[]>('/api/wards').catch(() => []),
      api.get<any[]>('/api/booths').catch(() => []),
    ]).then(([st, dt, ct, blk, pan, wrd, bth]) => {
      const rawSt = unwrapList(st);
      const rawDt = unwrapList(dt);
      const rawCt = unwrapList(ct);
      const rawBlk = unwrapList(blk);
      const rawPan = unwrapList(pan);
      const rawWrd = unwrapList(wrd);
      const rawBth = unwrapList(bth);

      // 1. States Map
      const stateList: IndiaState[] = rawSt.map((s: any) => ({
        id: normalizeId(s.id),
        name: s.name || '',
        code: s.code || '',
      }));
      const stateMap = new Map(stateList.map((s) => [normalizeId(s.id), s]));

      // 2. Districts Map
      const districtList: IndiaDistrict[] = rawDt.map((d: any) => {
        const sId = normalizeId(d.state_id !== undefined && d.state_id !== null ? d.state_id : d.stateId);
        const parentState = stateMap.get(sId);
        return {
          id: normalizeId(d.id),
          name: d.name || '',
          stateId: sId,
          stateName: d.state_name || parentState?.name || '',
        };
      });
      const districtMap = new Map(districtList.map((d) => [normalizeId(d.id), d]));

      // 3. Constituencies Map
      const constList: IndiaConstituency[] = rawCt.map((c: any) => {
        const dId = normalizeId(c.district_id !== undefined && c.district_id !== null ? c.district_id : c.districtId);
        const parentDist = districtMap.get(dId);
        const rawStateId = normalizeId(c.state_id !== undefined && c.state_id !== null ? c.state_id : (c.stateId || parentDist?.stateId));
        const parentState = stateMap.get(rawStateId);
        return {
          id: normalizeId(c.id),
          name: c.name || '',
          districtId: dId,
          stateId: rawStateId,
          districtName: c.district_name || parentDist?.name || '',
          stateName: c.state_name || parentState?.name || parentDist?.stateName || '',
        };
      });
      const constMap = new Map(constList.map((c) => [normalizeId(c.id), c]));

      // 4. Mandals (Blocks) Map
      const blockList: IndiaMandal[] = rawBlk.map((m: any) => {
        const cId = normalizeId(m.constituency_id !== undefined && m.constituency_id !== null ? m.constituency_id : m.constituencyId);
        const parentConst = constMap.get(cId);
        const rawDistId = normalizeId(m.district_id !== undefined && m.district_id !== null ? m.district_id : (m.districtId || parentConst?.districtId));
        const parentDist = districtMap.get(rawDistId);
        const rawStateId = normalizeId(m.state_id !== undefined && m.state_id !== null ? m.state_id : (m.stateId || parentConst?.stateId || parentDist?.stateId));
        return {
          id: normalizeId(m.id),
          name: m.name || '',
          code: m.mandal_code || m.mandalCode || m.code || '',
          constituencyId: cId,
          districtId: rawDistId,
          stateId: rawStateId,
          constituencyName: m.constituency_name || parentConst?.name || '',
        };
      });
      const mandalMap = new Map(blockList.map((m) => [normalizeId(m.id), m]));

      // 5. Panchayats Map
      const panList: IndiaPanchayat[] = rawPan.map((p: any) => {
        const mId = normalizeId(p.mandal_id !== undefined && p.mandal_id !== null ? p.mandal_id : p.mandalId);
        const parentMandal = mandalMap.get(mId);
        const cId = normalizeId(p.constituency_id !== undefined && p.constituency_id !== null ? p.constituency_id : (p.constituencyId || parentMandal?.constituencyId));
        const parentConst = constMap.get(cId);
        const dId = normalizeId(p.district_id !== undefined && p.district_id !== null ? p.district_id : (p.districtId || parentMandal?.districtId || parentConst?.districtId));
        const sId = normalizeId(p.state_id !== undefined && p.state_id !== null ? p.state_id : (p.stateId || parentMandal?.stateId || parentConst?.stateId));
        return {
          id: normalizeId(p.id),
          name: p.name || '',
          code: p.panchayat_code || p.code || '',
          type: p.panchayat_type || p.type || 'Gram Panchayat',
          mandalId: mId,
          constituencyId: cId,
          districtId: dId,
          stateId: sId,
          mandalName: p.mandal_name || parentMandal?.name || '',
        };
      });
      const panMap = new Map(panList.map((p) => [normalizeId(p.id), p]));

      // 6. Wards Map
      const wardList: IndiaWard[] = rawWrd.map((w: any) => {
        const pId = normalizeId(w.panchayat_id !== undefined && w.panchayat_id !== null ? w.panchayat_id : w.panchayatId);
        const parentPan = panMap.get(pId);
        const mId = normalizeId(w.mandal_id !== undefined && w.mandal_id !== null ? w.mandal_id : (w.mandalId || parentPan?.mandalId));
        const parentMandal = mandalMap.get(mId);
        const cId = normalizeId(w.constituency_id !== undefined && w.constituency_id !== null ? w.constituency_id : (w.constituencyId || parentPan?.constituencyId || parentMandal?.constituencyId));
        const dId = normalizeId(w.district_id !== undefined && w.district_id !== null ? w.district_id : (w.districtId || parentPan?.districtId || parentMandal?.districtId));
        const sId = normalizeId(w.state_id !== undefined && w.state_id !== null ? w.state_id : (w.stateId || parentPan?.stateId || parentMandal?.stateId));
        return {
          id: normalizeId(w.id),
          name: w.name || '',
          wardNumber: String(w.ward_number || w.wardNumber || ''),
          panchayatId: pId,
          mandalId: mId,
          constituencyId: cId,
          districtId: dId,
          stateId: sId,
          panchayatName: w.panchayat_name || parentPan?.name || '',
        };
      });
      const wardMap = new Map(wardList.map((w) => [normalizeId(w.id), w]));

      // 7. Booths Map
      const boothList: IndiaBooth[] = rawBth.map((b: any) => {
        const rawWardId = normalizeId(b.ward_id !== undefined && b.ward_id !== null ? b.ward_id : b.wardId);
        const matchedWard = wardMap.get(rawWardId);
        const rawPanId = normalizeId(b.panchayat_id !== undefined && b.panchayat_id !== null ? b.panchayat_id : (b.panchayatId || matchedWard?.panchayatId));
        const matchedPan = panMap.get(rawPanId);
        const rawMandalId = normalizeId(b.mandal_id !== undefined && b.mandal_id !== null ? b.mandal_id : (b.mandalId || matchedPan?.mandalId || matchedWard?.mandalId));
        const matchedMandal = mandalMap.get(rawMandalId);
        const rawConstId = normalizeId(b.constituency_id !== undefined && b.constituency_id !== null ? b.constituency_id : (b.constituencyId || matchedMandal?.constituencyId || matchedPan?.constituencyId || matchedWard?.constituencyId));
        const rawDistId = normalizeId(b.district_id !== undefined && b.district_id !== null ? b.district_id : (b.districtId || matchedMandal?.districtId || matchedPan?.districtId));
        const rawStateId = normalizeId(b.state_id !== undefined && b.state_id !== null ? b.state_id : (b.stateId || matchedMandal?.stateId || matchedPan?.stateId));
        return {
          id: normalizeId(b.id),
          name: b.name || '',
          boothNumber: String(b.booth_number !== undefined ? b.booth_number : (b.boothNumber || '')),
          wardId: rawWardId,
          panchayatId: rawPanId,
          mandalId: rawMandalId,
          constituencyId: rawConstId,
          districtId: rawDistId,
          stateId: rawStateId,
        };
      });

      setAllStates(stateList);
      setAllDistricts(districtList);
      setAllConstituencies(constList);
      setAllMandals(blockList);
      setAllPanchayats(panList);
      setAllWards(wardList);
      setAllBooths(boothList);
    }).catch(console.error).finally(() => setLoadingDemographics(false));
  }, [isOpen]);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialStateId && initialStateId !== 'all') setSelectedStateId(normalizeId(initialStateId));
      if (initialDistrictId && initialDistrictId !== 'all') setSelectedDistrictId(normalizeId(initialDistrictId));
      if (initialConstituencyId && initialConstituencyId !== 'all') setSelectedConstituencyId(normalizeId(initialConstituencyId));
      if (initialMandalId && initialMandalId !== 'all') setSelectedMandalId(normalizeId(initialMandalId));
      if (initialPanchayatId && initialPanchayatId !== 'all') setSelectedPanchayatId(normalizeId(initialPanchayatId));
      if (initialWardId && initialWardId !== 'all') setSelectedWardId(normalizeId(initialWardId));
      if (initialBoothId && initialBoothId !== 'all') setSelectedBoothId(normalizeId(initialBoothId));
    }
  }, [isOpen, initialStateId, initialDistrictId, initialConstituencyId, initialMandalId, initialPanchayatId, initialWardId, initialBoothId]);

  // Dynamic Sequential Filtering of Demographics based on active selections
  const availableStates = useMemo(() => {
    return allStates;
  }, [allStates]);

  const availableDistricts = useMemo(() => {
    if (!selectedStateId || selectedStateId === 'all') return [];
    return allDistricts.filter(d => normalizeId(d.stateId) === normalizeId(selectedStateId));
  }, [allDistricts, selectedStateId]);

  const availableConstituencies = useMemo(() => {
    if (!selectedDistrictId || selectedDistrictId === 'all') return [];
    return allConstituencies.filter(c => normalizeId(c.districtId) === normalizeId(selectedDistrictId));
  }, [allConstituencies, selectedDistrictId]);

  const availableMandals = useMemo(() => {
    if (!selectedConstituencyId || selectedConstituencyId === 'all') return [];
    return allMandals.filter(m => normalizeId(m.constituencyId) === normalizeId(selectedConstituencyId));
  }, [allMandals, selectedConstituencyId]);

  const availablePanchayats = useMemo(() => {
    if (!selectedConstituencyId || selectedConstituencyId === 'all') return [];
    return allPanchayats.filter(p => {
      const matchConst = normalizeId(p.constituencyId) === normalizeId(selectedConstituencyId);
      const matchMandal = !selectedMandalId || selectedMandalId === 'all' || normalizeId(p.mandalId) === normalizeId(selectedMandalId);
      return matchConst && matchMandal;
    });
  }, [allPanchayats, selectedConstituencyId, selectedMandalId]);

  const availableWards = useMemo(() => {
    if (!selectedConstituencyId || selectedConstituencyId === 'all') return [];
    return allWards.filter(w => {
      const matchConst = normalizeId(w.constituencyId) === normalizeId(selectedConstituencyId);
      const matchMandal = !selectedMandalId || selectedMandalId === 'all' || normalizeId(w.mandalId) === normalizeId(selectedMandalId);
      const matchPan = !selectedPanchayatId || selectedPanchayatId === 'all' || normalizeId(w.panchayatId) === normalizeId(selectedPanchayatId);
      return matchConst && matchMandal && matchPan;
    });
  }, [allWards, selectedConstituencyId, selectedMandalId, selectedPanchayatId]);

  const availableBooths = useMemo(() => {
    if (!selectedConstituencyId || selectedConstituencyId === 'all') return [];
    return allBooths.filter(b => {
      const matchConst = normalizeId(b.constituencyId) === normalizeId(selectedConstituencyId);
      const matchMandal = !selectedMandalId || selectedMandalId === 'all' || normalizeId(b.mandalId) === normalizeId(selectedMandalId);
      const matchPan = !selectedPanchayatId || selectedPanchayatId === 'all' || normalizeId(b.panchayatId) === normalizeId(selectedPanchayatId);
      const matchWard = !selectedWardId || selectedWardId === 'all' || normalizeId(b.wardId) === normalizeId(selectedWardId);
      return matchConst && matchMandal && matchPan && matchWard;
    });
  }, [allBooths, selectedConstituencyId, selectedMandalId, selectedPanchayatId, selectedWardId]);

  // Dropdown Change Handlers with strict downward cascading reset
  const handleStateChange = (stateId: string) => {
    const val = normalizeId(stateId);
    setSelectedStateId(val);
    setSelectedDistrictId('');
    setSelectedConstituencyId('');
    setSelectedMandalId('');
    setSelectedPanchayatId('');
    setSelectedWardId('');
    setSelectedBoothId('');
  };

  const handleDistrictChange = (districtId: string) => {
    const val = normalizeId(districtId);
    setSelectedDistrictId(val);
    setSelectedConstituencyId('');
    setSelectedMandalId('');
    setSelectedPanchayatId('');
    setSelectedWardId('');
    setSelectedBoothId('');
  };

  const handleConstituencyChange = (constituencyId: string) => {
    const val = normalizeId(constituencyId);
    setSelectedConstituencyId(val);
    setSelectedMandalId('');
    setSelectedPanchayatId('');
    setSelectedWardId('');
    setSelectedBoothId('');
  };

  const handleMandalChange = (mandalId: string) => {
    const val = normalizeId(mandalId);
    setSelectedMandalId(val);
    setSelectedPanchayatId('');
    setSelectedWardId('');
    setSelectedBoothId('');
  };

  const handlePanchayatChange = (panchayatId: string) => {
    const val = normalizeId(panchayatId);
    setSelectedPanchayatId(val);
    setSelectedWardId('');
    setSelectedBoothId('');
  };

  const handleWardChange = (wardId: string) => {
    const val = normalizeId(wardId);
    setSelectedWardId(val);
    setSelectedBoothId('');
  };

  const handleBoothChange = (boothId: string) => {
    setSelectedBoothId(normalizeId(boothId));
  };

  // Helper to extract values from multiple possible column aliases
  const getValue = (row: Record<string, any>, keys: string[], defaultValue: string = ''): string => {
    if (!row || typeof row !== 'object') return defaultValue;
    for (const k of keys) {
      if (row[k] !== undefined && row[k] !== null && String(row[k]).trim() !== '') {
        return String(row[k]).trim();
      }
      const foundKey = Object.keys(row).find(rk => rk.trim().toLowerCase() === k.trim().toLowerCase());
      if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
        return String(row[foundKey]).trim();
      }
    }
    return defaultValue;
  };

  // Download Standard Excel (.xlsx) file
  const downloadSampleExcel = () => {
    const ws = XLSX.utils.json_to_sheet(STANDARD_SAMPLE_VOTERS, {
      header: [
        'Voter Name',
        'Relative Name',
        'Relation',
        'Gender',
        'Age',
        'EPIC No',
        'House No',
        'Ward Name',
        'Mobile',
        'Part No',
        'Serial No',
        'Caste',
        'Occupation',
        'Is Karyakarta',
        'Voting Status',
        'Favored Party'
      ]
    });

    ws['!cols'] = [
      { wch: 20 }, // Voter Name
      { wch: 20 }, // Relative Name
      { wch: 14 }, // Relation
      { wch: 10 }, // Gender
      { wch: 8 },  // Age
      { wch: 16 }, // EPIC No
      { wch: 12 }, // House No
      { wch: 24 }, // Ward Name
      { wch: 15 }, // Mobile
      { wch: 10 }, // Part No
      { wch: 10 }, // Serial No
      { wch: 14 }, // Caste
      { wch: 18 }, // Occupation
      { wch: 14 }, // Is Karyakarta
      { wch: 14 }, // Voting Status
      { wch: 18 }  // Favored Party
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Voters');
    XLSX.writeFile(wb, 'voters_sample_template.xlsx');
  };

  // Download Standard CSV (.csv) file
  const downloadSampleCSV = () => {
    const ws = XLSX.utils.json_to_sheet(STANDARD_SAMPLE_VOTERS);
    const csvContent = XLSX.utils.sheet_to_csv(ws);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'voters_sample_template.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  // Process raw data records into structured voter objects
  const processRawRecords = (data: Record<string, any>[]) => {
    if (!data || data.length === 0) {
      setStatus('error');
      setErrorMessage('The uploaded file contains no valid voter records.');
      return;
    }

    const formatted: ParsedVoterRow[] = [];
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rawName = getValue(row, ['Voter Name', 'voter_name', 'voter name', 'name', 'full name', 'voterName', 'voter']);
      const finalName = rawName || 'Unnamed Voter';

      const rawVId = getValue(row, ['EPIC No', 'epic_no', 'epic no', 'epic', 'voter_id', 'voterId', 'voter id', 'epicId', 'id_card_no', 'voter_card_no']);
      const finalVId = rawVId ? rawVId.toUpperCase() : `EPIC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const rawAge = getValue(row, ['Age', 'age', 'age_yrs', 'ageYrs', 'voter_age']);
      let rowAgeNum = 18;
      if (rawAge) {
        const num = parseInt(String(rawAge), 10);
        if (!isNaN(num)) rowAgeNum = num;
      }

      const rawGender = getValue(row, ['Gender', 'gender', 'sex', 'gender_type']);
      let finalGender = 'Male';
      if (rawGender) {
        const firstChar = String(rawGender).trim().charAt(0).toUpperCase();
        if (firstChar === 'M') finalGender = 'Male';
        else if (firstChar === 'F') finalGender = 'Female';
        else if (firstChar === 'O') finalGender = 'Other';
        else finalGender = String(rawGender).trim();
      }

      const rawKaryakarta = getValue(row, ['Is Karyakarta', 'is_karyakarta', 'isKaryakarta', 'is_worker', 'karyakarta', 'worker']);
      let isKaryakartaNum = 0;
      if (rawKaryakarta !== '') {
        const lower = String(rawKaryakarta).trim().toLowerCase();
        if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'y') isKaryakartaNum = 1;
      }

      const rawVotingStatus = getValue(row, ['Voting Status', 'voting_status', 'votingStatus', 'voting status', 'voted', 'status']);
      let finalVotingStatus = 'unvoted';
      if (rawVotingStatus) {
        const lower = String(rawVotingStatus).trim().toLowerCase();
        if (lower === 'voted' || lower === '1' || lower === 'yes' || lower === 'true') {
          finalVotingStatus = 'voted';
        } else {
          finalVotingStatus = 'unvoted';
        }
      }

      // Hierarchy IDs from file or from modal selectors
      const rawRowState = getValue(row, ['state_id', 'stateId', 'state id', 'state']);
      let rowState = rawRowState ? normalizeId(rawRowState) : selectedStateId;

      const rawRowDistrict = getValue(row, ['district_id', 'districtId', 'district id', 'district']);
      let rowDistrict = rawRowDistrict ? normalizeId(rawRowDistrict) : selectedDistrictId;

      const rawRowConstituency = getValue(row, ['constituency_id', 'constituencyId', 'constituency id', 'constituency']);
      let rowConstituency = rawRowConstituency ? normalizeId(rawRowConstituency) : selectedConstituencyId;

      const rawRowMandal = getValue(row, ['mandal_id', 'mandalId', 'mandal id', 'mandal']);
      let rowMandal = rawRowMandal ? normalizeId(rawRowMandal) : selectedMandalId;

      const rawRowPanchayat = getValue(row, ['panchayat_id', 'panchayatId', 'panchayat id', 'panchayat']);
      let rowPanchayat = rawRowPanchayat ? normalizeId(rawRowPanchayat) : selectedPanchayatId;

      const rawRowWardId = getValue(row, ['ward_id', 'wardId', 'ward id']);
      let rowWardId = rawRowWardId ? normalizeId(rawRowWardId) : selectedWardId;

      const rawRowBooth = getValue(row, ['booth_id', 'boothId', 'booth id', 'booth']);
      let rowBooth = rawRowBooth ? normalizeId(rawRowBooth) : selectedBoothId;

      // Auto-resolve ancestor IDs if deeper levels are present
      if (rowBooth) {
        const b = allBooths.find(x => normalizeId(x.id) === rowBooth || String(x.boothNumber).trim() === rowBooth);
        if (b) {
          if (!rowWardId && b.wardId) rowWardId = normalizeId(b.wardId);
          if (!rowPanchayat && b.panchayatId) rowPanchayat = normalizeId(b.panchayatId);
          if (!rowMandal && b.mandalId) rowMandal = normalizeId(b.mandalId);
          if (!rowConstituency && b.constituencyId) rowConstituency = normalizeId(b.constituencyId);
          if (!rowDistrict && b.districtId) rowDistrict = normalizeId(b.districtId);
          if (!rowState && b.stateId) rowState = normalizeId(b.stateId);
        }
      }

      if (rowWardId) {
        const w = allWards.find(x => normalizeId(x.id) === rowWardId);
        if (w) {
          if (!rowPanchayat && w.panchayatId) rowPanchayat = normalizeId(w.panchayatId);
          if (!rowMandal && w.mandalId) rowMandal = normalizeId(w.mandalId);
          if (!rowConstituency && w.constituencyId) rowConstituency = normalizeId(w.constituencyId);
          if (!rowDistrict && w.districtId) rowDistrict = normalizeId(w.districtId);
          if (!rowState && w.stateId) rowState = normalizeId(w.stateId);
        }
      }

      if (rowPanchayat) {
        const p = allPanchayats.find(x => normalizeId(x.id) === rowPanchayat);
        if (p) {
          if (!rowMandal && p.mandalId) rowMandal = normalizeId(p.mandalId);
          if (!rowConstituency && p.constituencyId) rowConstituency = normalizeId(p.constituencyId);
          if (!rowDistrict && p.districtId) rowDistrict = normalizeId(p.districtId);
          if (!rowState && p.stateId) rowState = normalizeId(p.stateId);
        }
      }

      if (rowMandal) {
        const m = allMandals.find(x => normalizeId(x.id) === rowMandal);
        if (m) {
          if (!rowConstituency && m.constituencyId) rowConstituency = normalizeId(m.constituencyId);
          if (!rowDistrict && m.districtId) rowDistrict = normalizeId(m.districtId);
          if (!rowState && m.stateId) rowState = normalizeId(m.stateId);
        }
      }

      if (rowConstituency) {
        const c = allConstituencies.find(x => normalizeId(x.id) === rowConstituency);
        if (c) {
          if (!rowDistrict && c.districtId) rowDistrict = normalizeId(c.districtId);
          if (!rowState && c.stateId) rowState = normalizeId(c.stateId);
        }
      }

      if (rowDistrict) {
        const d = allDistricts.find(x => normalizeId(x.id) === rowDistrict);
        if (d) {
          if (!rowState && d.stateId) rowState = normalizeId(d.stateId);
        }
      }

      const foundPanchayat = allPanchayats.find(p => normalizeId(p.id) === rowPanchayat);
      const rowPanchayatName = getValue(row, ['panchayat_name', 'panchayatName', 'panchayat name']) || (foundPanchayat ? foundPanchayat.name : '');

      const foundWard = allWards.find(w => normalizeId(w.id) === rowWardId);
      const wardNameVal = getValue(row, ['Ward Name', 'ward_name', 'ward name', 'ward', 'village', 'area', 'colony', 'villageName', 'mohalla']) || (foundWard ? foundWard.name : '');

      const houseNoVal = getValue(row, ['House No', 'house_no', 'house no', 'houseNumber', 'h no', 'h.no', 'h_no']);
      const rawAddress = getValue(row, ['address', 'Address', 'current address', 'currentAddress', 'full_address']);
      const finalAddress = rawAddress || ([houseNoVal ? `House No ${houseNoVal}` : '', wardNameVal].filter(Boolean).join(', '));

      // Part No & Serial No
      const rowPartNo = getValue(row, ['Part No', 'part_no', 'partNo', 'part no', 'part', 'part_number']) || defaultPartNo;
      
      let rowSrNo = getValue(row, ['Serial No', 'serial_no', 'serial no', 'sr_no', 'srNo', 'sr no', 'sr', 'serial']);
      if (!rowSrNo && defaultSrNo) {
        const startNum = parseInt(defaultSrNo, 10);
        if (!isNaN(startNum)) {
          rowSrNo = String(startNum + i);
        } else {
          rowSrNo = defaultSrNo;
        }
      }

      formatted.push({
        voter_id: finalVId,
        name: finalName,
        relation_name: getValue(row, ['Relative Name', 'relative_name', 'relative name', 'relation_name', 'relationName', 'relation name', 'fatherName', "father's name", 'father name', 'husbandName', "husband's name", 'guardian', 'relativeName']),
        relation_type: getValue(row, ['Relation', 'relation', 'relation_type', 'relationType', 'relation type', 'rel_type', 'relationship']) || 'Father',
        gender: finalGender,
        age: rowAgeNum,
        part_no: rowPartNo,
        sr_no: rowSrNo || '',
        mobile: getValue(row, ['Mobile', 'mobile', 'mobile_no', 'mobile no', 'phone', 'contact', 'mobileNumber']),
        email: getValue(row, ['Email', 'email', 'emailAddress', 'mail', 'email_id']),
        address: finalAddress,
        house_no: houseNoVal,
        village: wardNameVal,
        caste: getValue(row, ['Caste', 'caste', 'category', 'casteCategory', 'caste_category']) || 'General',
        occupation: getValue(row, ['Occupation', 'occupation', 'work', 'job', 'profession']) || 'Private Service',
        is_karyakarta: isKaryakartaNum,
        voting_status: finalVotingStatus,
        party_inclination: getValue(row, ['Favored Party', 'favored_party', 'favored party', 'party_inclination', 'partyInclination', 'party inclination', 'sentiment', 'inclination']) || 'Neutral',
        state_id: rowState,
        district_id: rowDistrict,
        constituency_id: rowConstituency,
        mandal_id: rowMandal,
        panchayat_id: rowPanchayat,
        panchayat_name: rowPanchayatName,
        ward_id: rowWardId,
        ward_name: wardNameVal,
        booth_id: rowBooth
      });
    }

    setParsedRows(formatted);
    setPreviewRows(formatted.slice(0, 5));
    setStatus('preview');
  };

  // Handle Excel (.xlsx, .xls) and CSV (.csv) file selection and parsing
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setErrorMessage('');
    setProgress(0);

    const ext = file.name.split('.').pop()?.toLowerCase();

    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const buffer = evt.target?.result;
          const workbook = XLSX.read(buffer, { type: 'binary' });
          const firstSheet = workbook.SheetNames[0];
          const sheet = workbook.Sheets[firstSheet];
          const data = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });
          processRawRecords(data);
        } catch (err: any) {
          setStatus('error');
          setErrorMessage(`Excel Parsing Error: ${err.message || 'Failed to read Excel spreadsheet'}`);
        }
      };
      reader.onerror = () => {
        setStatus('error');
        setErrorMessage('Failed to read selected file.');
      };
      reader.readAsBinaryString(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (resultsParsed) => {
          processRawRecords(resultsParsed.data as Record<string, any>[]);
        },
        error: (parseError) => {
          setStatus('error');
          setErrorMessage(`CSV Parsing Error: ${parseError.message}`);
        }
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Execute bulk import in chunks
  const handleExecuteImport = async () => {
    if (parsedRows.length === 0) return;

    setStatus('importing');
    setProgress(0);
    setErrorMessage('');

    const batchSize = 100;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;

    for (let i = 0; i < parsedRows.length; i += batchSize) {
      const chunk = parsedRows.slice(i, i + batchSize);
      try {
        const res = await api.post<{ 
          success: boolean; 
          count?: number; 
          inserted?: number; 
          updated?: number; 
          failed?: number 
        }>('/api/voters/bulk', { 
          voters: chunk,
          mode: 'upsert'
        });

        if (res) {
          totalInserted += (res.inserted !== undefined ? res.inserted : (res.count || chunk.length));
          totalUpdated += (res.updated || 0);
          totalFailed += (res.failed || 0);
        } else {
          totalInserted += chunk.length;
        }
      } catch (err: any) {
        console.error('Batch import chunk error:', err);
        totalFailed += chunk.length;
      }

      const percent = Math.min(100, Math.round(((i + chunk.length) / parsedRows.length) * 100));
      setProgress(percent);
    }

    setResults({
      total: parsedRows.length,
      inserted: totalInserted,
      updated: totalUpdated,
      failed: totalFailed,
    });

    setStatus('completed');
    if (onSuccess) onSuccess();
  };

  const handleReset = () => {
    setStatus('idle');
    setUploadedFile(null);
    setParsedRows([]);
    setPreviewRows([]);
    setErrorMessage('');
    setProgress(0);
  };

  const getTargetStateLabel = () => {
    const st = allStates.find(s => normalizeId(s.id) === normalizeId(selectedStateId));
    return st?.name || '';
  };

  const getTargetDistrictLabel = () => {
    const dst = allDistricts.find(d => normalizeId(d.id) === normalizeId(selectedDistrictId));
    return dst?.name || '';
  };

  const getTargetConstituencyLabel = () => {
    const constItem = allConstituencies.find(c => normalizeId(c.id) === normalizeId(selectedConstituencyId));
    return constItem?.name || 'Not Selected';
  };

  const getTargetMandalLabel = () => {
    const mandal = allMandals.find(m => normalizeId(m.id) === normalizeId(selectedMandalId));
    return mandal?.name || '';
  };

  const getTargetPanchayatLabel = () => {
    const panchayat = allPanchayats.find(p => normalizeId(p.id) === normalizeId(selectedPanchayatId));
    return panchayat?.name || '';
  };

  const getTargetWardLabel = () => {
    const ward = allWards.find(w => normalizeId(w.id) === normalizeId(selectedWardId));
    return ward?.name || '';
  };

  const getTargetBoothLabel = () => {
    const booth = allBooths.find(b => normalizeId(b.id) === normalizeId(selectedBoothId));
    if (!booth) return 'Not Selected';
    return `${booth.boothNumber ? `Booth #${booth.boothNumber} - ` : ''}${booth.name}`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 md:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        onClick={onClose} 
        className="fixed inset-0 bg-black/70 backdrop-blur-md" 
      />

      <motion.div 
        initial={{ scale: 0.96, opacity: 0, y: 15 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.96, opacity: 0, y: 15 }} 
        className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden z-10"
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/70 dark:bg-zinc-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                Bulk Import Voters
              </h3>
              <p className="text-xs text-zinc-500">
                Upload standard Excel (.xlsx) or CSV (.csv) file matching the voters database schema
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

        {/* Modal Scrollable Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5 flex-1 text-zinc-900 dark:text-zinc-100">
          
          {/* Main Upload Form */}
          {status === 'idle' || status === 'error' ? (
            <div className="space-y-5">
              
              {/* Step 1: Download Standard Sample Sheet (Excel & CSV) */}
              <div className="p-4 bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center font-black text-xs shrink-0">
                      1
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                        Standard Voters Template
                      </h4>
                      <p className="text-[11px] text-zinc-500">
                        Pre-formatted with all 23 database columns &amp; sample records
                      </p>
                    </div>
                  </div>

                  {/* Dual Action Buttons: Excel & CSV */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={downloadSampleExcel}
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="Download formatted Excel (.xlsx) file"
                    >
                      <FileSpreadsheet size={14} />
                      <span>Download Excel (.xlsx)</span>
                    </button>
                    <button
                      type="button"
                      onClick={downloadSampleCSV}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      title="Download formatted CSV (.csv) file"
                    >
                      <Download size={14} />
                      <span>Download CSV</span>
                    </button>
                  </div>
                </div>

                {/* Collapsible Column Guide Toggle */}
                <div className="pt-1 border-t border-blue-200/60 dark:border-blue-900/40">
                  <button
                    type="button"
                    onClick={() => setShowFieldGuide(!showFieldGuide)}
                    className="flex items-center gap-1.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <HelpCircle size={13} />
                    <span>{showFieldGuide ? 'Hide Column Specification Guide' : 'View Database Table Structure & Column Guide'}</span>
                    {showFieldGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>

                  {showFieldGuide && (
                    <div className="mt-2.5 max-h-48 overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-xs">
                      <table className="w-full text-left border-collapse text-[11px]">
                        <thead>
                          <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 font-bold uppercase text-[10px]">
                            <th className="p-1.5">Column Name</th>
                            <th className="p-1.5">SQL Type</th>
                            <th className="p-1.5">Required?</th>
                            <th className="p-1.5">Description / Values</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono">
                          {SCHEMA_COLUMNS.map((col, idx) => (
                            <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <td className="p-1.5 font-bold text-blue-600 dark:text-blue-400">{col.field}</td>
                              <td className="p-1.5 text-zinc-500 text-[10px]">{col.type}</td>
                              <td className="p-1.5">
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${col.req === 'Required' ? 'bg-red-100 dark:bg-red-950/50 text-red-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'}`}>
                                  {col.req}
                                </span>
                              </td>
                              <td className="p-1.5 text-zinc-600 dark:text-zinc-300 font-sans">{col.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Step 2: Target Location Hierarchy Selection (7 Levels + Part No + Serial No) */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                      2
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                        Default Target Hierarchy
                      </h4>
                      <p className="text-[11px] text-zinc-500">
                        Applied if booth, mandal, or ward values are not specified inside your sheet
                      </p>
                    </div>
                  </div>
                </div>

                {/* 7-Tier Territory Hierarchy Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
                  {/* 1. State */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                      1. State <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedStateId}
                      onChange={(e) => handleStateChange(e.target.value)}
                      disabled={loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">{loadingDemographics ? 'Loading States...' : 'Select State'}</option>
                      {availableStates.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.code ? `(${s.code})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* 2. District */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                      2. District <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => handleDistrictChange(e.target.value)}
                      disabled={!selectedStateId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedStateId 
                          ? 'Select State first' 
                          : (loadingDemographics ? 'Loading Districts...' : 'Select District')}
                      </option>
                      {availableDistricts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 3. Constituency */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                      3. Constituency <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedConstituencyId}
                      onChange={(e) => handleConstituencyChange(e.target.value)}
                      disabled={!selectedDistrictId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedDistrictId 
                          ? 'Select District first' 
                          : (loadingDemographics ? 'Loading Constituencies...' : 'Select Constituency')}
                      </option>
                      {availableConstituencies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 4. Block / Area (Mandal) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        4. Block / Area (Mandal) <span className="text-zinc-400 font-normal">(Optional)</span>
                      </label>
                      {selectedConstituencyId && availableMandals.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {availableMandals.length} available
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedMandalId}
                      onChange={(e) => handleMandalChange(e.target.value)}
                      disabled={!selectedConstituencyId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedConstituencyId 
                          ? 'Select Constituency first' 
                          : (loadingDemographics ? 'Loading Blocks / Mandals...' : 'Select Block / Area (Optional)')}
                      </option>
                      {availableMandals.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* 5. Panchayat / MC / ULB */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        5. Panchayat / MC / ULB <span className="text-zinc-400 font-normal">(Optional)</span>
                      </label>
                      {selectedConstituencyId && availablePanchayats.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {availablePanchayats.length} available
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedPanchayatId}
                      onChange={(e) => handlePanchayatChange(e.target.value)}
                      disabled={!selectedConstituencyId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedConstituencyId 
                          ? 'Select Constituency first' 
                          : (loadingDemographics 
                            ? 'Loading Local Bodies...' 
                            : (selectedMandalId ? 'Select Local Body / Panchayat (Filtered by Block)' : 'Select Local Body / Panchayat (Optional)'))}
                      </option>
                      {availablePanchayats.map(p => (
                        <option key={p.id} value={p.id}>{p.name} {p.type ? `(${p.type})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* 6. Ward / Village */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        6. Ward / Village <span className="text-zinc-400 font-normal">(Optional)</span>
                      </label>
                      {selectedConstituencyId && availableWards.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {availableWards.length} available
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedWardId}
                      onChange={(e) => handleWardChange(e.target.value)}
                      disabled={!selectedConstituencyId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedConstituencyId 
                          ? 'Select Constituency first' 
                          : (loadingDemographics 
                            ? 'Loading Wards...' 
                            : (selectedPanchayatId 
                              ? 'Select Ward / Village (Filtered by Panchayat)' 
                              : (selectedMandalId ? 'Select Ward / Village (Filtered by Block)' : 'Select Ward / Village (Optional)')))}
                      </option>
                      {availableWards.map(w => (
                        <option key={w.id} value={w.id}>{w.name} {w.wardNumber ? `(Ward #${w.wardNumber})` : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* 7. Polling Booth */}
                  <div className="lg:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-zinc-500">
                        7. Polling Booth <span className="text-zinc-400 font-normal">(Optional if specified in sheet)</span>
                      </label>
                      {selectedConstituencyId && availableBooths.length > 0 && (
                        <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400">
                          {availableBooths.length} booths available
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedBoothId}
                      onChange={(e) => handleBoothChange(e.target.value)}
                      disabled={!selectedConstituencyId || loadingDemographics}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">
                        {!selectedConstituencyId 
                          ? 'Select Constituency first' 
                          : (loadingDemographics 
                            ? 'Loading Booths...' 
                            : (selectedWardId 
                              ? 'Select Polling Booth (Filtered by Ward)' 
                              : (selectedPanchayatId 
                                ? 'Select Polling Booth (Filtered by Panchayat)' 
                                : (selectedMandalId ? 'Select Polling Booth (Filtered by Block)' : 'Select Polling Booth (Optional)'))))}
                      </option>
                      {availableBooths.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.boothNumber ? `Booth #${b.boothNumber} - ` : ''}{b.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Default Electoral Roll Part No & Serial No */}
                <div className="pt-3 border-t border-zinc-200/70 dark:border-zinc-800/70">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                        Part No <span className="text-zinc-400 font-normal">(Optional default, e.g. 52)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 52"
                        value={defaultPartNo}
                        onChange={(e) => setDefaultPartNo(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-500 mb-1">
                        Serial No <span className="text-zinc-400 font-normal">(Starting serial, e.g. 101)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. 101 (auto-increments if missing)"
                        value={defaultSrNo}
                        onChange={(e) => setDefaultSrNo(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Step 3: Upload Zone */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-black shrink-0">
                    3
                  </div>
                  <h4 className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">
                    Upload Excel (.xlsx) or CSV (.csv) File
                  </h4>
                </div>

                {(!selectedStateId || !selectedDistrictId || !selectedConstituencyId) ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2.5">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>Please select at least default State, District, and Constituency above to enable file upload.</span>
                  </div>
                ) : (
                  <div>
                    <input 
                      type="file" 
                      accept=".xlsx, .xls, .csv" 
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <div 
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 hover:border-blue-500 dark:hover:border-blue-500 bg-white dark:bg-zinc-950 p-6 rounded-2xl text-center cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 bg-blue-50 dark:bg-blue-950/40 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform">
                        <Upload size={22} />
                      </div>
                      <p className="text-xs sm:text-sm font-bold text-zinc-800 dark:text-zinc-200">
                        Click to select or drop <span className="text-blue-600">.xlsx</span> or <span className="text-blue-600">.csv</span> file here
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Targeting {[
                          getTargetStateLabel(),
                          getTargetDistrictLabel(),
                          getTargetConstituencyLabel(),
                          getTargetMandalLabel() ? `Block: ${getTargetMandalLabel()}` : '',
                          getTargetPanchayatLabel() ? `Panchayat: ${getTargetPanchayatLabel()}` : '',
                          getTargetWardLabel() ? `Ward: ${getTargetWardLabel()}` : '',
                          getTargetBoothLabel() !== 'Not Selected' ? getTargetBoothLabel() : ''
                        ].filter(Boolean).join(' • ')}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Error Alert */}
              {status === 'error' && (
                <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs font-medium flex items-start gap-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="font-bold">Upload Error</p>
                    <p className="text-[11px] mt-0.5">{errorMessage}</p>
                  </div>
                  <button onClick={() => setStatus('idle')} className="text-xs underline font-bold">Try Again</button>
                </div>
              )}

            </div>
          ) : null}

          {/* Preview Step */}
          {status === 'preview' && (
            <div className="space-y-4 animate-in fade-in">
              <div className="p-4 bg-blue-50/80 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50 rounded-2xl flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black text-sm shrink-0">
                    <FileCheck size={20} />
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-blue-950 dark:text-blue-100">
                      {uploadedFile?.name || 'Voter Data File'}
                    </h4>
                    <p className="text-xs text-blue-800/80 dark:text-blue-300/80">
                      Found <strong className="text-blue-900 dark:text-white">{parsedRows.length} voter records</strong> verified and mapped
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleReset} 
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                >
                  Change File
                </button>
              </div>

              <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                <MapPin size={15} className="text-blue-600 shrink-0" />
                <span>
                  Default Target Booth: <strong className="text-zinc-900 dark:text-white">{getTargetBoothLabel()}</strong> ({getTargetConstituencyLabel()})
                </span>
              </div>

              {/* Preview Table with full voter details */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="font-bold text-zinc-500">Previewing First 5 Records:</span>
                  <span className="text-zinc-400 text-[11px] font-mono">Total to upload: {parsedRows.length} voters</span>
                </div>

                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-950 overflow-x-auto shadow-sm max-h-72">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead className="bg-zinc-100/70 dark:bg-zinc-900 text-[10px] font-black uppercase text-zinc-500 border-b border-zinc-200 dark:border-zinc-800 sticky top-0">
                      <tr>
                        <th className="py-2 px-3">Voter Name</th>
                        <th className="py-2 px-3">Relative Name (Relation)</th>
                        <th className="py-2 px-3">Gender / Age</th>
                        <th className="py-2 px-3">EPIC No</th>
                        <th className="py-2 px-3">House No</th>
                        <th className="py-2 px-3">Ward Name</th>
                        <th className="py-2 px-3">Mobile</th>
                        <th className="py-2 px-3">Part # / Sr #</th>
                        <th className="py-2 px-3">Status / Party</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-[11px]">
                      {previewRows.map((voter, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                          <td className="py-1.5 px-3 font-bold text-zinc-900 dark:text-white">
                            {voter.name}
                          </td>
                          <td className="py-1.5 px-3 text-zinc-500">
                            {voter.relation_name ? (
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                  {voter.relation_type || 'Father'}
                                </span>
                                <span className="font-semibold text-zinc-700 dark:text-zinc-300">{voter.relation_name}</span>
                              </div>
                            ) : '-'}
                          </td>
                          <td className="py-1.5 px-3 text-zinc-700 dark:text-zinc-300">
                            {voter.gender || '-'} &bull; {voter.age ? `${voter.age}y` : '-'}
                          </td>
                          <td className="py-1.5 px-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {voter.voter_id}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-zinc-700 dark:text-zinc-300">
                            {voter.house_no || '-'}
                          </td>
                          <td className="py-1.5 px-3 text-zinc-600 dark:text-zinc-400 max-w-[150px] truncate">
                            {voter.village || voter.address || '-'}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-zinc-600 dark:text-zinc-400">
                            {voter.mobile || '-'}
                          </td>
                          <td className="py-1.5 px-3 font-mono text-zinc-500">
                            P:{voter.part_no || '-'} / S:{voter.sr_no || '-'}
                          </td>
                          <td className="py-1.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                voter.voting_status === 'voted' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                              }`}>
                                {voter.voting_status || 'unvoted'}
                              </span>
                              <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                ({voter.party_inclination || 'Neutral'})
                              </span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="flex-1 py-2.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                >
                  <Sparkles size={15} />
                  <span>Upload &amp; Insert {parsedRows.length} Voters</span>
                </button>
              </div>
            </div>
          )}

          {/* Importing State */}
          {status === 'importing' && (
            <div className="py-10 text-center space-y-4">
              <div className="relative w-24 h-24 mx-auto">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle 
                    className="text-zinc-100 dark:text-zinc-800" 
                    strokeWidth="8" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="40" 
                    cx="50" 
                    cy="50" 
                  />
                  <circle 
                    className="text-blue-600 transition-all duration-300" 
                    strokeWidth="8" 
                    strokeDasharray={251.2}
                    strokeDashoffset={251.2 - (251.2 * progress) / 100}
                    strokeLinecap="round" 
                    stroke="currentColor" 
                    fill="transparent" 
                    r="40" 
                    cx="50" 
                    cy="50" 
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="font-black text-lg text-zinc-900 dark:text-white">{progress}%</span>
                </div>
              </div>
              <div className="space-y-1">
                <h4 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white">
                  Inserting Voters into Database...
                </h4>
                <p className="text-xs text-zinc-500">
                  Executing batch upsert into dbo.voters table. Please wait a moment.
                </p>
              </div>
            </div>
          )}

          {/* Completed State */}
          {status === 'completed' && (
            <div className="py-6 space-y-5 text-center animate-in fade-in">
              <div className="w-14 h-14 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={32} />
              </div>

              <div className="space-y-1">
                <h4 className="text-base sm:text-lg font-black text-zinc-900 dark:text-white">
                  Voters Imported Successfully!
                </h4>
                <p className="text-xs text-zinc-500">
                  Target: {getTargetBoothLabel()} &bull; {getTargetConstituencyLabel()}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3 bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl text-center">
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{results.inserted}</p>
                  <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold uppercase mt-0.5">New Inserted</p>
                </div>

                <div className="p-3 bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/40 rounded-xl text-center">
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{results.updated}</p>
                  <p className="text-[10px] text-blue-700 dark:text-blue-300 font-bold uppercase mt-0.5">Records Updated</p>
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-center col-span-2 sm:col-span-1">
                  <p className="text-xl font-black text-zinc-800 dark:text-zinc-200">{results.total}</p>
                  <p className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5">Total Processed</p>
                </div>
              </div>

              <div className="flex gap-3 max-w-xs mx-auto pt-2">
                <button 
                  onClick={handleReset}
                  className="flex-1 py-2.5 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all"
                >
                  Import Another
                </button>
                <button 
                  onClick={onClose}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all"
                >
                  Done
                </button>
              </div>
            </div>
          )}

        </div>
      </motion.div>
    </div>
  );
};

export default BulkImportModal;
