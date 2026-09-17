import React, { useState, useEffect, useRef } from 'react';
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
}

export interface IndiaConstituency {
  id: string;
  name: string;
  districtId: string;
  stateId?: string;
}

export interface IndiaBooth {
  id: string;
  name: string;
  boothNumber: string;
  constituencyId: string;
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialStateId?: string;
  initialDistrictId?: string;
  initialConstituencyId?: string;
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
  mandal_id?: string;
  constituency_id?: string;
  state_id?: string;
  district_id?: string;
  [key: string]: any;
}

// Standard Sample Data Matching dbo.voters Table Schema
const STANDARD_SAMPLE_VOTERS = [
  {
    voter_id: 'HP01054001',
    name: 'Rajesh Kumar',
    relation_name: 'Dev Raj',
    relation_type: 'Father',
    gender: 'Male',
    age: 38,
    part_no: '1',
    sr_no: '101',
    mobile: '9816012345',
    email: 'rajesh.kumar@example.com',
    address: 'Ward No 4 Main Bazar, Nahan',
    house_no: '14-A',
    village: 'Nahan',
    caste: 'General',
    occupation: 'Business',
    is_karyakarta: 1,
    voting_status: 'unvoted',
    party_inclination: 'Strong Supporter',
    booth_id: '',
    mandal_id: '',
    constituency_id: '',
    state_id: '',
    district_id: ''
  },
  {
    voter_id: 'HP01054002',
    name: 'Sunita Sharma',
    relation_name: 'Rajesh Kumar',
    relation_type: 'Husband',
    gender: 'Female',
    age: 34,
    part_no: '1',
    sr_no: '102',
    mobile: '9816054321',
    email: 'sunita.sharma@example.com',
    address: 'Ward No 4 Main Bazar, Nahan',
    house_no: '14-A',
    village: 'Nahan',
    caste: 'General',
    occupation: 'Homemaker',
    is_karyakarta: 0,
    voting_status: 'unvoted',
    party_inclination: 'Favorable',
    booth_id: '',
    mandal_id: '',
    constituency_id: '',
    state_id: '',
    district_id: ''
  },
  {
    voter_id: 'HP01054003',
    name: 'Amit Singh',
    relation_name: 'Mohan Singh',
    relation_type: 'Father',
    gender: 'Male',
    age: 26,
    part_no: '1',
    sr_no: '103',
    mobile: '9418011223',
    email: 'amit.singh@example.com',
    address: 'Green Valley Road, Chakli',
    house_no: '52',
    village: 'Chakli',
    caste: 'OBC',
    occupation: 'Govt Employee',
    is_karyakarta: 0,
    voting_status: 'unvoted',
    party_inclination: 'Neutral',
    booth_id: '',
    mandal_id: '',
    constituency_id: '',
    state_id: '',
    district_id: ''
  },
  {
    voter_id: 'HP01054004',
    name: 'Pooja Devi',
    relation_name: 'Amit Singh',
    relation_type: 'Husband',
    gender: 'Female',
    age: 24,
    part_no: '1',
    sr_no: '104',
    mobile: '9418099887',
    email: 'pooja.devi@example.com',
    address: 'Green Valley Road, Chakli',
    house_no: '52',
    village: 'Chakli',
    caste: 'OBC',
    occupation: 'Private Service',
    is_karyakarta: 0,
    voting_status: 'unvoted',
    party_inclination: 'Favorable',
    booth_id: '',
    mandal_id: '',
    constituency_id: '',
    state_id: '',
    district_id: ''
  },
  {
    voter_id: 'HP01054005',
    name: 'Kewal Ram',
    relation_name: 'Ram Lal',
    relation_type: 'Father',
    gender: 'Male',
    age: 61,
    part_no: '1',
    sr_no: '105',
    mobile: '9805067890',
    email: 'kewal.ram@example.com',
    address: 'Near Old Temple, Nahan',
    house_no: '08',
    village: 'Nahan',
    caste: 'SC',
    occupation: 'Farmer',
    is_karyakarta: 1,
    voting_status: 'unvoted',
    party_inclination: 'Strong Supporter',
    booth_id: '',
    mandal_id: '',
    constituency_id: '',
    state_id: '',
    district_id: ''
  }
];

// Field definitions for the in-app schema guide
const SCHEMA_COLUMNS = [
  { field: 'voter_id', type: 'VARCHAR(100)', req: 'Required', desc: 'Unique EPIC card number (e.g. HP01054001)' },
  { field: 'name', type: 'VARCHAR(255)', req: 'Required', desc: 'Full Name of the voter' },
  { field: 'relation_name', type: 'VARCHAR(255)', req: 'Optional', desc: "Father's / Husband's / Relative's Name" },
  { field: 'relation_type', type: 'VARCHAR(50)', req: 'Optional', desc: 'Relation type: Father, Husband, Mother, Other' },
  { field: 'gender', type: 'VARCHAR(20)', req: 'Optional', desc: 'Gender: Male, Female, Other' },
  { field: 'age', type: 'INT', req: 'Optional', desc: 'Age in years (e.g. 38)' },
  { field: 'part_no', type: 'VARCHAR(50)', req: 'Optional', desc: 'Voter list polling part number' },
  { field: 'sr_no', type: 'VARCHAR(50)', req: 'Optional', desc: 'Serial number on electoral roll' },
  { field: 'mobile', type: 'VARCHAR(50)', req: 'Optional', desc: '10-digit mobile contact number' },
  { field: 'email', type: 'VARCHAR(255)', req: 'Optional', desc: 'Email address' },
  { field: 'address', type: 'NVARCHAR(500)', req: 'Optional', desc: 'Residential address line' },
  { field: 'house_no', type: 'VARCHAR(100)', req: 'Optional', desc: 'House or Flat Number' },
  { field: 'village', type: 'VARCHAR(100)', req: 'Optional', desc: 'Village / Ward / Mohalla / Colony' },
  { field: 'caste', type: 'VARCHAR(100)', req: 'Optional', desc: 'Category: General, OBC, SC, ST, etc.' },
  { field: 'occupation', type: 'VARCHAR(100)', req: 'Optional', desc: 'Business, Farmer, Homemaker, Govt Employee, etc.' },
  { field: 'is_karyakarta', type: 'BIT (0/1)', req: 'Optional', desc: '1 or Yes for Party Worker / Karyakarta, 0 or No for standard' },
  { field: 'voting_status', type: 'VARCHAR(50)', req: 'Optional', desc: 'unvoted or voted' },
  { field: 'party_inclination', type: 'VARCHAR(50)', req: 'Optional', desc: 'Strong Supporter, Favorable, Neutral, Opposition' },
  { field: 'booth_id', type: 'VARCHAR(64)', req: 'Optional', desc: 'Target Booth ID (or select in modal)' },
  { field: 'mandal_id', type: 'VARCHAR(64)', req: 'Optional', desc: 'Target Mandal ID (or auto-assigned)' },
  { field: 'constituency_id', type: 'VARCHAR(64)', req: 'Optional', desc: 'Target Constituency ID (or select in modal)' },
  { field: 'state_id', type: 'VARCHAR(64)', req: 'Optional', desc: 'Target State ID (or select in modal)' },
  { field: 'district_id', type: 'VARCHAR(64)', req: 'Optional', desc: 'Target District ID (or select in modal)' }
];

export const BulkImportModal: React.FC<BulkImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialStateId = '',
  initialDistrictId = '',
  initialConstituencyId = '',
  initialBoothId = '',
  states: propStates,
}) => {
  // Geopolitical Hierarchy state
  const [states, setStates] = useState<IndiaState[]>(propStates || []);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);

  const [selectedStateId, setSelectedStateId] = useState<string>(initialStateId || '');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>(initialDistrictId || '');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>(initialConstituencyId || '');
  const [selectedBoothId, setSelectedBoothId] = useState<string>(initialBoothId || '');

  const [loadingDistricts, setLoadingDistricts] = useState(false);
  const [loadingConstituencies, setLoadingConstituencies] = useState(false);
  const [loadingBooths, setLoadingBooths] = useState(false);

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

  // Initialize states if not passed as prop
  useEffect(() => {
    if (!propStates || propStates.length === 0) {
      api.get<IndiaState[]>('/api/states')
        .then(s => setStates(s.map((item: any) => ({ ...item, id: String(item.id) }))))
        .catch(console.error);
    } else {
      setStates(propStates);
    }
  }, [propStates]);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialStateId && initialStateId !== 'all') setSelectedStateId(initialStateId);
      if (initialDistrictId && initialDistrictId !== 'all') setSelectedDistrictId(initialDistrictId);
      if (initialConstituencyId && initialConstituencyId !== 'all') setSelectedConstituencyId(initialConstituencyId);
      if (initialBoothId && initialBoothId !== 'all') setSelectedBoothId(initialBoothId);
    }
  }, [isOpen, initialStateId, initialDistrictId, initialConstituencyId, initialBoothId]);

  // Load cascading districts
  useEffect(() => {
    if (!selectedStateId || selectedStateId === 'all') {
      setDistricts([]);
      setSelectedDistrictId('');
      return;
    }
    setLoadingDistricts(true);
    api.get<IndiaDistrict[]>(`/api/districts?stateId=${selectedStateId}`)
      .then(dSnap => setDistricts(dSnap.map((d: any) => ({ ...d, id: String(d.id), stateId: String(d.state_id || d.stateId) }))))
      .catch(console.error)
      .finally(() => setLoadingDistricts(false));
  }, [selectedStateId]);

  // Load cascading constituencies
  useEffect(() => {
    if (!selectedDistrictId || selectedDistrictId === 'all') {
      setConstituencies([]);
      setSelectedConstituencyId('');
      return;
    }
    setLoadingConstituencies(true);
    api.get<IndiaConstituency[]>(`/api/constituencies?districtId=${selectedDistrictId}`)
      .then(cSnap => setConstituencies(cSnap.map((c: any) => ({ ...c, id: String(c.id), districtId: String(c.district_id || c.districtId) }))))
      .catch(console.error)
      .finally(() => setLoadingConstituencies(false));
  }, [selectedDistrictId]);

  // Load cascading booths
  useEffect(() => {
    if (!selectedConstituencyId || selectedConstituencyId === 'all') {
      setBooths([]);
      setSelectedBoothId('');
      return;
    }
    setLoadingBooths(true);
    api.get<IndiaBooth[]>(`/api/booths?constituencyId=${selectedConstituencyId}`)
      .then(bSnap => setBooths(bSnap.map((b: any) => ({ ...b, id: String(b.id), constituencyId: String(b.constituency_id || b.constituencyId) }))))
      .catch(console.error)
      .finally(() => setLoadingBooths(false));
  }, [selectedConstituencyId]);

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
        'voter_id',
        'name',
        'relation_name',
        'relation_type',
        'gender',
        'age',
        'part_no',
        'sr_no',
        'mobile',
        'email',
        'address',
        'house_no',
        'village',
        'caste',
        'occupation',
        'is_karyakarta',
        'voting_status',
        'party_inclination',
        'booth_id',
        'mandal_id',
        'constituency_id',
        'state_id',
        'district_id'
      ]
    });

    ws['!cols'] = [
      { wch: 15 }, // voter_id
      { wch: 20 }, // name
      { wch: 18 }, // relation_name
      { wch: 15 }, // relation_type
      { wch: 10 }, // gender
      { wch: 8 },  // age
      { wch: 10 }, // part_no
      { wch: 10 }, // sr_no
      { wch: 15 }, // mobile
      { wch: 25 }, // email
      { wch: 30 }, // address
      { wch: 12 }, // house_no
      { wch: 15 }, // village
      { wch: 12 }, // caste
      { wch: 18 }, // occupation
      { wch: 14 }, // is_karyakarta
      { wch: 14 }, // voting_status
      { wch: 18 }, // party_inclination
      { wch: 12 }, // booth_id
      { wch: 12 }, // mandal_id
      { wch: 16 }, // constituency_id
      { wch: 12 }, // state_id
      { wch: 12 }  // district_id
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
      const rawName = getValue(row, ['name', 'voter_name', 'voter name', 'full name', 'voterName', 'voter']);
      const finalName = rawName || 'Unnamed Voter';

      const rawVId = getValue(row, ['voter_id', 'voterId', 'voter id', 'epic', 'epic_no', 'epic no', 'epicId', 'id_card_no', 'voter_card_no']);
      const finalVId = rawVId ? rawVId.toUpperCase() : `EPIC-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

      const rawAge = getValue(row, ['age', 'age_yrs', 'ageYrs', 'voter_age']);
      let rowAgeNum = 18;
      if (rawAge) {
        const num = parseInt(String(rawAge), 10);
        if (!isNaN(num)) rowAgeNum = num;
      }

      const rawGender = getValue(row, ['gender', 'sex', 'gender_type']);
      let finalGender = 'Male';
      if (rawGender) {
        const firstChar = String(rawGender).trim().charAt(0).toUpperCase();
        if (firstChar === 'M') finalGender = 'Male';
        else if (firstChar === 'F') finalGender = 'Female';
        else if (firstChar === 'O') finalGender = 'Other';
        else finalGender = String(rawGender).trim();
      }

      const rawKaryakarta = getValue(row, ['is_karyakarta', 'isKaryakarta', 'is_worker', 'karyakarta', 'worker']);
      let isKaryakartaNum = 0;
      if (rawKaryakarta !== '') {
        const lower = String(rawKaryakarta).trim().toLowerCase();
        if (lower === '1' || lower === 'true' || lower === 'yes' || lower === 'y') isKaryakartaNum = 1;
      }

      const rawVotingStatus = getValue(row, ['voting_status', 'votingStatus', 'voting status', 'voted', 'status']);
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
      const rowBooth = getValue(row, ['booth_id', 'boothId', 'booth id', 'booth']) || selectedBoothId;
      const rowMandal = getValue(row, ['mandal_id', 'mandalId', 'mandal id', 'mandal']) || '';
      const rowConstituency = getValue(row, ['constituency_id', 'constituencyId', 'constituency id', 'constituency']) || selectedConstituencyId;
      const rowState = getValue(row, ['state_id', 'stateId', 'state id', 'state']) || selectedStateId;
      const rowDistrict = getValue(row, ['district_id', 'districtId', 'district id', 'district']) || selectedDistrictId;

      formatted.push({
        voter_id: finalVId,
        name: finalName,
        relation_name: getValue(row, ['relation_name', 'relationName', 'relation name', 'fatherName', "father's name", 'father name', 'husbandName', "husband's name", 'guardian', 'relativeName']),
        relation_type: getValue(row, ['relation_type', 'relationType', 'relation type', 'rel_type']) || 'Father',
        gender: finalGender,
        age: rowAgeNum,
        part_no: getValue(row, ['part_no', 'partNo', 'part no', 'part', 'part_number']),
        sr_no: getValue(row, ['sr_no', 'srNo', 'sr no', 'serial no', 'serial_no', 'sr', 'serial']),
        mobile: getValue(row, ['mobile', 'phone', 'contact', 'mobileNumber', 'mobile_no']),
        email: getValue(row, ['email', 'emailAddress', 'mail', 'email_id']),
        address: getValue(row, ['address', 'current address', 'currentAddress', 'full_address']),
        house_no: getValue(row, ['house_no', 'houseNo', 'house no', 'h no', 'h.no']),
        village: getValue(row, ['village', 'area', 'colony', 'villageName', 'mohalla']),
        caste: getValue(row, ['caste', 'category', 'casteCategory', 'caste_category']) || 'General',
        occupation: getValue(row, ['occupation', 'work', 'job', 'profession']) || 'Private Service',
        is_karyakarta: isKaryakartaNum,
        voting_status: finalVotingStatus,
        party_inclination: getValue(row, ['party_inclination', 'partyInclination', 'party inclination', 'sentiment', 'inclination']) || 'Neutral',
        state_id: rowState,
        district_id: rowDistrict,
        constituency_id: rowConstituency,
        booth_id: rowBooth,
        mandal_id: rowMandal
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

  const getTargetBoothLabel = () => {
    const booth = booths.find(b => b.id === selectedBoothId);
    if (!booth) return 'Not Selected';
    return `${booth.boothNumber ? `Booth #${booth.boothNumber} - ` : ''}${booth.name}`;
  };

  const getTargetConstituencyLabel = () => {
    const constItem = constituencies.find(c => c.id === selectedConstituencyId);
    return constItem?.name || 'Not Selected';
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
        className="relative bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden z-10"
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

              {/* Step 2: Target Location Hierarchy Selection (State, District, Constituency, Booth) */}
              <div className="p-4 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
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
                        Applied if booth/constituency IDs are not specified inside your sheet
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      State
                    </label>
                    <select
                      value={selectedStateId}
                      onChange={(e) => setSelectedStateId(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200"
                    >
                      <option value="">Select State</option>
                      {states.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      District
                    </label>
                    <select
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      disabled={!selectedStateId || loadingDistricts}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">{loadingDistricts ? 'Loading...' : 'Select District'}</option>
                      {districts.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Constituency
                    </label>
                    <select
                      value={selectedConstituencyId}
                      onChange={(e) => setSelectedConstituencyId(e.target.value)}
                      disabled={!selectedDistrictId || loadingConstituencies}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">{loadingConstituencies ? 'Loading...' : 'Select Constituency'}</option>
                      {constituencies.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1">
                      Booth / Polling Station
                    </label>
                    <select
                      value={selectedBoothId}
                      onChange={(e) => setSelectedBoothId(e.target.value)}
                      disabled={!selectedConstituencyId || loadingBooths}
                      className="w-full h-10 px-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-blue-500 font-medium text-zinc-800 dark:text-zinc-200 disabled:opacity-50"
                    >
                      <option value="">{loadingBooths ? 'Loading...' : 'Select Booth'}</option>
                      {booths.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.boothNumber ? `Booth #${b.boothNumber} - ` : ''}{b.name}
                        </option>
                      ))}
                    </select>
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

                {(!selectedStateId || !selectedDistrictId || !selectedConstituencyId || !selectedBoothId) ? (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-medium flex items-center gap-2.5">
                    <AlertCircle size={16} className="shrink-0" />
                    <span>Please select default State, District, Constituency, and Booth above to enable file upload.</span>
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
                        Targeting {getTargetConstituencyLabel()} &bull; {getTargetBoothLabel()}
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
                        <th className="p-2.5">EPIC / Voter ID</th>
                        <th className="p-2.5">Full Name</th>
                        <th className="p-2.5">Relative &amp; Relation</th>
                        <th className="p-2.5">Gender / Age</th>
                        <th className="p-2.5">Part # / Sr #</th>
                        <th className="p-2.5">Contact (Mobile/Email)</th>
                        <th className="p-2.5">Address / House / Village</th>
                        <th className="p-2.5">Caste &amp; Job</th>
                        <th className="p-2.5">Karyakarta?</th>
                        <th className="p-2.5">Status &amp; Inclination</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 text-[11px]">
                      {previewRows.map((voter, idx) => (
                        <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40">
                          <td className="p-2.5 font-mono font-bold text-blue-600 dark:text-blue-400">
                            {voter.voter_id}
                          </td>
                          <td className="p-2.5 font-bold text-zinc-900 dark:text-white">
                            {voter.name}
                          </td>
                          <td className="p-2.5 text-zinc-500">
                            {voter.relation_name ? `${voter.relation_name} (${voter.relation_type || 'Father'})` : '-'}
                          </td>
                          <td className="p-2.5 text-zinc-700 dark:text-zinc-300">
                            {voter.gender} &bull; {voter.age}y
                          </td>
                          <td className="p-2.5 font-mono text-zinc-500">
                            P:{voter.part_no || '-'} / S:{voter.sr_no || '-'}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-400">
                            <div>{voter.mobile || '-'}</div>
                            {voter.email && <div className="text-[10px] text-zinc-400">{voter.email}</div>}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-400">
                            <div>{voter.house_no ? `H.No ${voter.house_no}, ` : ''}{voter.village || ''}</div>
                            {voter.address && <div className="text-[10px] text-zinc-400 truncate max-w-[150px]">{voter.address}</div>}
                          </td>
                          <td className="p-2.5 text-zinc-600 dark:text-zinc-400">
                            {voter.caste || 'General'} &bull; {voter.occupation || 'Service'}
                          </td>
                          <td className="p-2.5">
                            {voter.is_karyakarta === 1 ? (
                              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 flex items-center gap-1 w-fit">
                                <ShieldCheck size={11} /> Karyakarta
                              </span>
                            ) : (
                              <span className="text-[10px] text-zinc-400">No</span>
                            )}
                          </td>
                          <td className="p-2.5 space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              voter.voting_status === 'voted' ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-500'
                            }`}>
                              {voter.voting_status || 'unvoted'}
                            </span>
                            <div className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                              {voter.party_inclination || 'Neutral'}
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
