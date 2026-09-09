import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  Loader2, 
  CheckCircle, 
  MapPin, 
  X,
  Save,
  Flag,
  Globe,
  ChevronRight,
  Upload,
  AlertCircle,
  AlertTriangle,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import Papa from 'papaparse';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';

interface IndiaState {
  id: string;
  name: string;
  code: string;
  population?: number;
  createdAt?: any;
  updatedAt?: any;
  districtCount?: number;
}

interface IndiaDistrict {
  id: string;
  name: string;
  stateId: string;
  stateName: string;
  population?: number;
  createdAt?: any;
  updatedAt?: any;
  constituencyCount?: number;
}

interface IndiaConstituency {
  id: string;
  name: string;
  stateId: string;
  districtId: string;
  districtName: string;
  population?: number;
  createdAt?: any;
  updatedAt?: any;
  boothCount?: number;
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber: string;
  boothLabel?: string;
  address?: string;
  stateId: string;
  districtId: string;
  constituencyId: string;
  constituencyName: string;
  population?: number;
  createdAt?: any;
  updatedAt?: any;
}

interface DemographicItem {
  id: string;
  name: string;
  code?: string;
  stateId?: string;
  stateCode?: string;
  stateName?: string;
  districtId?: string;
  districtName?: string;
  constituencyId?: string;
  constituencyName?: string;
  boothId?: string;
  boothNumber?: string;
  boothLabel?: string;
  address?: string;
  population?: number;
  districtCount?: number;
  constituencyCount?: number;
  boothCount?: number;
}

const DemographicSettings: React.FC = () => {
  const { isAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };
  
  const [activeTab, setActiveTab] = useState<'states' | 'districts' | 'constituencies' | 'booths'>('states');
  
  // Data states
  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);
  
  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Filter states
  const [selectedStateId, setSelectedStateId] = useState<string>('all');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string>('all');
  const [selectedConstituencyId, setSelectedConstituencyId] = useState<string>('all');
  
  // Bulk Import states
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'parsing' | 'uploading' | 'completed' | 'error'>('idle');
  const [importProgress, setImportProgress] = useState(0);
  const [importError, setImportError] = useState('');
  const [importResults, setImportResults] = useState({ success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cascading dropdowns inside bulk import modal
  const [importStateId, setImportStateId] = useState<string>('');
  const [importDistrictId, setImportDistrictId] = useState<string>('');
  const [importConstituencyId, setImportConstituencyId] = useState<string>('');
  const [importBoothId, setImportBoothId] = useState<string>('');

  const [importDistricts, setImportDistricts] = useState<IndiaDistrict[]>([]);
  const [importConstituencies, setImportConstituencies] = useState<IndiaConstituency[]>([]);
  const [importBooths, setImportBooths] = useState<IndiaBooth[]>([]);

  const [loadingImportDistricts, setLoadingImportDistricts] = useState(false);
  const [loadingImportConstituencies, setLoadingImportConstituencies] = useState(false);
  const [loadingImportBooths, setLoadingImportBooths] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IndiaState | IndiaDistrict | IndiaConstituency | IndiaBooth | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '', // For States
    boothNumber: '', // For Booths
    boothLabel: '', // For Booths
    address: '', // For Booths
    population: 0,
    stateId: '', // For Districts/Constituencies/Booths
    districtId: '', // For Constituencies/Booths
    constituencyId: '', // For Booths
  });

  const fetchStates = async () => {
    setLoading(true);
    try {
      const fetchedStates = await api.get<IndiaState[]>('/api/states');
      setStates(fetchedStates);
    } catch (err: unknown) {
      setError('Failed to fetch states.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async () => {
    setLoading(true);
    try {
      const url = selectedStateId !== 'all' ? `/api/districts?stateId=${selectedStateId}` : '/api/districts';
      const fetchedDistricts = await api.get<IndiaDistrict[]>(url);
      setDistricts(fetchedDistricts.map((d: any) => ({
        ...d,
        stateId: d.state_id || d.stateId,
        stateName: d.state_name || d.stateName
      })));
    } catch (err: unknown) {
      setError('Failed to fetch districts.');
    } finally {
      setLoading(false);
    }
  };

  const fetchConstituencies = async () => {
    setLoading(true);
    try {
      let url = '/api/constituencies?';
      if (selectedStateId !== 'all') url += `stateId=${selectedStateId}&`;
      if (selectedDistrictId !== 'all') url += `districtId=${selectedDistrictId}&`;
      const fetchedConstituencies = await api.get<IndiaConstituency[]>(url);
      setConstituencies(fetchedConstituencies.map((c: any) => ({
        ...c,
        stateId: c.state_id || c.stateId,
        districtId: c.district_id || c.districtId,
        districtName: c.district_name || c.districtName
      })));
    } catch (err: unknown) {
      setError('Failed to fetch constituencies.');
    } finally {
      setLoading(false);
    }
  };

  const fetchBooths = async () => {
    setLoading(true);
    try {
      let url = '/api/booths?';
      if (selectedConstituencyId !== 'all') url += `constituencyId=${selectedConstituencyId}&`;
      const fetchedBooths = await api.get<IndiaBooth[]>(url);
      setBooths(fetchedBooths.map((b: any) => ({
        ...b,
        boothNumber: b.booth_number || b.boothNumber,
        constituencyId: b.constituency_id || b.constituencyId,
        constituencyName: b.constituency_name || b.constituencyName,
        mandalId: b.mandal_id || b.mandalId
      })));
    } catch (err: unknown) {
      setError('Failed to fetch booths.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'states') {
      fetchStates();
    } else if (activeTab === 'districts') {
      fetchDistricts();
    } else if (activeTab === 'constituencies') {
      fetchConstituencies();
    } else {
      fetchBooths();
    }
  }, [activeTab, selectedStateId, selectedDistrictId, selectedConstituencyId]);

  // Cascading dropdown load hooks inside bulk import modal
  useEffect(() => {
    if (!importStateId || importStateId === 'all') {
      setImportDistricts([]);
      setImportDistrictId('');
      return;
    }
    const loadImportDistricts = async () => {
      setLoadingImportDistricts(true);
      try {
        const dSnap = await api.get<IndiaDistrict[]>(`/api/districts?stateId=${importStateId}`);
        setImportDistricts(dSnap.map((d: any) => ({ ...d, stateId: d.state_id || d.stateId })));
      } catch (err) {
        console.error('Error fetching import districts:', err);
      } finally {
        setLoadingImportDistricts(false);
      }
    };
    loadImportDistricts();
  }, [importStateId]);

  useEffect(() => {
    if (!importStateId || !importDistrictId || importDistrictId === 'all') {
      setImportConstituencies([]);
      setImportConstituencyId('');
      return;
    }
    const loadImportConstituencies = async () => {
      setLoadingImportConstituencies(true);
      try {
        const cSnap = await api.get<IndiaConstituency[]>(`/api/constituencies?districtId=${importDistrictId}`);
        setImportConstituencies(cSnap.map((c: any) => ({ ...c, stateId: c.state_id || c.stateId, districtId: c.district_id || c.districtId })));
      } catch (err) {
        console.error('Error fetching import constituencies:', err);
      } finally {
        setLoadingImportConstituencies(false);
      }
    };
    loadImportConstituencies();
  }, [importStateId, importDistrictId]);

  useEffect(() => {
    if (!importStateId || !importDistrictId || !importConstituencyId || importConstituencyId === 'all') {
      setImportBooths([]);
      setImportBoothId('');
      return;
    }
    const loadImportBooths = async () => {
      setLoadingImportBooths(true);
      try {
        const bSnap = await api.get<IndiaBooth[]>(`/api/booths?constituencyId=${importConstituencyId}`);
        setImportBooths(bSnap.map((b: any) => ({ ...b, constituencyId: b.constituency_id || b.constituencyId })));
      } catch (err) {
        console.error('Error fetching import booths:', err);
      } finally {
        setLoadingImportBooths(false);
      }
    };
    loadImportBooths();
  }, [importStateId, importDistrictId, importConstituencyId]);

  const calculateAge = (dobString: string): number => {
    if (!dobString) return 18;
    try {
      const birthDate = new Date(dobString);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const m = today.getMonth() - birthDate.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return isNaN(age) ? 18 : age;
    } catch {
      return 18;
    }
  };

  const handleDownloadSample = () => {
    const csvContent = "voterId,name,relationName,gender,dob,age,mobile,additionalMobile,address,newAddress,houseNo,village,caste,occupation,education,aadharNumber,partNo,srNo\n" +
      "EPIC1234,John Doe,Robert Doe,Male,1999-05-15,27,9876543210,,Sample Address,,12-B,Sector 5,General,Worker,Unspecified,123456789012,1,10\n" +
      "EPIC5678,Jane Smith,John Smith,Female,,,9988776655,9988776644,Another Address,New Res Address,45,,OBC,,Unspecified,,2,15\n" +
      "EPIC9012,Bob Johnson,Richard Johnson,Male,,45,8877665544,,,78-A,Green Village,,,Private Service,Unspecified,,3,20";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "voters_bulk_sample.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!importStateId || !importDistrictId || !importConstituencyId || !importBoothId) {
      setImportStatus('error');
      setImportError('Please select State, District, Constituency, and Booth first.');
      return;
    }

    setImportStatus('parsing');
    setImportError('');
    setImportProgress(0);
    setImportResults({ success: 0, failed: 0 });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as Record<string, string>[];
        if (data.length === 0) {
          setImportStatus('error');
          setImportError('No valid data found in CSV.');
          return;
        }

        setImportStatus('uploading');
        let successCount = 0;
        let failedCount = 0;

        // Helper to resolve keys case-insensitively and trim values safely
        const getValue = (row: Record<string, string>, keys: string[], defaultValue: string = ''): string => {
          for (const k of keys) {
            if (row[k] !== undefined) return row[k].trim();
            const foundKey = Object.keys(row).find(rk => rk.toLowerCase() === k.toLowerCase());
            if (foundKey && row[foundKey] !== undefined) return row[foundKey].trim();
          }
          return defaultValue;
        };

        const votersToInsert = [];
        for (let i = 0; i < data.length; i++) {
          const row = data[i];
          const rawName = getValue(row, ['name', 'voter name', 'full name', 'voterName']);
          const finalName = rawName || 'Unnamed Voter';

          const rawVId = getValue(row, ['voterId', 'voter id', 'epic', 'epic_no', 'epic no', 'epicId']);
          const finalVId = rawVId ? rawVId.toUpperCase() : `TEMP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

          const rowDob = getValue(row, ['dob', 'date of birth', 'birthdate', 'birthDate']);
          const rawAge = getValue(row, ['age', 'age_yrs', 'ageYrs']);
          let rowAgeNum = 18;
          if (rowDob) {
            rowAgeNum = calculateAge(rowDob);
          } else if (rawAge) {
            const num = parseInt(rawAge, 10);
            if (!isNaN(num)) rowAgeNum = num;
          }

          const rawGender = getValue(row, ['gender', 'sex']);
          let finalGender = 'Male';
          if (rawGender) {
            const firstChar = rawGender.trim().charAt(0).toUpperCase();
            if (firstChar === 'M') finalGender = 'Male';
            else if (firstChar === 'F') finalGender = 'Female';
            else if (firstChar === 'O') finalGender = 'Other';
            else finalGender = rawGender;
          }

          votersToInsert.push({
            voter_id: finalVId,
            name: finalName,
            relation_name: getValue(row, ['relationName', 'relation name', 'fatherName', "father's name", 'father name', 'husbandName', "husband's name", 'husband name']),
            relation_type: 'Father',
            gender: finalGender,
            age: rowAgeNum,
            mobile: getValue(row, ['mobile', 'phone', 'contact']),
            address: getValue(row, ['address', 'current address', 'currentAddress']),
            house_no: getValue(row, ['houseNo', 'house no', 'h no', 'h.no']),
            village: getValue(row, ['village', 'area', 'colony', 'villageName']),
            caste: getValue(row, ['caste', 'category', 'casteCategory']) || 'General',
            occupation: getValue(row, ['occupation', 'work', 'job', 'profession']) || 'Private Service',
            is_karyakarta: false,
            voting_status: 'unvoted',
            party_inclination: 'Neutral',
            part_no: getValue(row, ['partNo', 'part no', 'part_no']),
            sr_no: getValue(row, ['srNo', 'sr no', 'sr_no', 'serial no', 'serial_no']),
            state_id: importStateId,
            district_id: importDistrictId,
            constituency_id: importConstituencyId,
            booth_id: importBoothId
          });
        }

        try {
          const bulkRes = await api.post<{ success: boolean; count: number }>('/api/voters/bulk', { voters: votersToInsert });
          setImportResults({ success: bulkRes.count || votersToInsert.length, failed: 0 });
          setImportStatus('completed');
          setImportProgress(100);
          if (activeTab === 'booths') {
            fetchBooths();
          }
        } catch (err) {
          setImportStatus('error');
          setImportError('Failed to upload voters to database.');
        }
      },
      error: (error) => {
        setImportStatus('error');
        setImportError(`CSV Parsing Error: ${error.message}`);
      }
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      if (activeTab === 'states') {
        const stateData = {
          name: formData.name,
          code: formData.code.toUpperCase(),
          population: Number(formData.population) || 0,
        };
        await api.post('/api/states', stateData);
        setSuccessMessage(`${formData.name} saved to registry.`);
        fetchStates();
      } else if (activeTab === 'districts') {
        const districtData = {
          name: formData.name,
          state_id: formData.stateId,
          population: Number(formData.population) || 0,
        };
        await api.post('/api/districts', districtData);
        setSuccessMessage(`District ${formData.name} saved.`);
        fetchDistricts();
      } else if (activeTab === 'constituencies') {
        const constituencyData = {
          name: formData.name,
          state_id: formData.stateId,
          district_id: formData.districtId,
          population: Number(formData.population) || 0,
        };
        await api.post('/api/constituencies', constituencyData);
        setSuccessMessage(`Constituency ${formData.name} saved.`);
        fetchConstituencies();
      } else {
        const boothData = {
          name: formData.name,
          booth_number: formData.boothNumber,
          booth_label: formData.boothLabel,
          address: formData.address,
          state_id: formData.stateId,
          district_id: formData.districtId,
          constituency_id: formData.constituencyId,
          total_voters: Number(formData.population) || 0,
        };
        await api.post('/api/booths', boothData);
        setSuccessMessage(`Booth ${formData.name} saved.`);
        fetchBooths();
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      setError('Failed to save demographic item.');
    } finally {
      setActionLoading(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (itemId: string, itemName: string) => {
    setActionLoading(true);
    setError('');
    
    try {
      if (activeTab === 'states') {
        await api.delete(`/api/states/${itemId}`);
        setStates(prev => prev.filter(s => s.id !== itemId));
      } else if (activeTab === 'districts') {
        await api.delete(`/api/districts/${itemId}`);
        setDistricts(prev => prev.filter(d => d.id !== itemId));
      } else if (activeTab === 'constituencies') {
        await api.delete(`/api/constituencies/${itemId}`);
        setConstituencies(prev => prev.filter(c => c.id !== itemId));
      } else if (activeTab === 'booths') {
        await api.delete(`/api/booths/${itemId}`);
        setBooths(prev => prev.filter(b => b.id !== itemId));
      }
      setSuccessMessage(`${itemName} removed successfully.`);
      setDeletingId(null);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: unknown) {
      setError(`Failed to delete ${itemName}.`);
    } finally {
      setActionLoading(false);
    }
  };

  const filteredData = activeTab === 'states' 
    ? states.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase()))
    : activeTab === 'districts'
      ? districts.filter(d => d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.stateName.toLowerCase().includes(searchTerm.toLowerCase()))
      : activeTab === 'constituencies'
        ? constituencies.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.districtName.toLowerCase().includes(searchTerm.toLowerCase()))
        : booths.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.constituencyName.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="p-4 sm:p-8 space-y-8 animate-in fade-in duration-500 max-w-full mx-auto">
      {/* Delete Confirmation Overlay */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingId(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-zinc-950 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Are you sure?</h3>
              <p className="text-zinc-500 text-sm mb-6">This will permanently remove the record from the national registry. This action cannot be undone.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all">Cancel</button>
                <button 
                  onClick={() => {
                    if (activeTab === 'states') {
                      const item = states.find(s => s.id === deletingId);
                      if (item) handleDelete(item.id, item.name);
                    } else if (activeTab === 'districts') {
                      const item = districts.find(d => d.id === deletingId);
                      if (item) handleDelete(item.id, item.name);
                    } else if (activeTab === 'constituencies') {
                      const item = constituencies.find(c => c.id === deletingId);
                      if (item) handleDelete(item.id, item.name);
                    } else if (activeTab === 'booths') {
                      const item = booths.find(b => b.id === deletingId);
                      if (item) handleDelete(item.id, item.name);
                    }
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

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6 bg-white dark:bg-zinc-950 p-4 sm:p-6 md:p-8 rounded-2xl md:rounded-[32px] border border-zinc-200 dark:border-zinc-800 shadow-sm shadow-zinc-100 dark:shadow-none">
        <div className="space-y-2 w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-600/20 shrink-0">
              <Globe size={24} />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center gap-2">
                Election Setting
              </h1>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="bg-zinc-100 dark:bg-zinc-900 p-1 rounded-2xl flex border border-zinc-200 dark:border-zinc-800 overflow-x-auto custom-scrollbar-hide whitespace-nowrap">
            <button 
              onClick={() => setActiveTab('states')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'states' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              States
            </button>
            <button 
              onClick={() => setActiveTab('districts')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'districts' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Districts
            </button>
            <button 
              onClick={() => setActiveTab('constituencies')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'constituencies' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Constituencies
            </button>
            <button 
              onClick={() => setActiveTab('booths')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'booths' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
            >
              Booths
            </button>
          </div>
          

          <div className="flex gap-2">
            {hasRight('demographics', 'c') && (
              <button 
                onClick={() => {
                  setImportStatus('idle');
                  setImportProgress(0);
                  setImportError('');
                  setImportResults({ success: 0, failed: 0 });
                  
                  // Initialize cascading selectors from page filters if selected
                  setImportStateId(selectedStateId !== 'all' ? selectedStateId : '');
                  setImportDistrictId(selectedDistrictId !== 'all' ? selectedDistrictId : '');
                  setImportConstituencyId(selectedConstituencyId !== 'all' ? selectedConstituencyId : '');
                  setImportBoothId('');
                  
                  setIsImportModalOpen(true);
                }}
                className="h-11 px-6 rounded-[14px] bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-black text-[10px] uppercase tracking-wider hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap"
              >
                <Upload size={14} /> Bulk Import Voters
              </button>
            )}

            {hasRight('demographics', 'c') && (
              <button 
                onClick={() => { 
                  setEditingItem(null); 
                  setFormData({ 
                    name: '', 
                    code: '', 
                    population: 0, 
                    stateId: selectedStateId !== 'all' ? selectedStateId : (states[0]?.id || ''),
                    districtId: selectedDistrictId !== 'all' ? selectedDistrictId : (districts.filter(d => d.stateId === (selectedStateId !== 'all' ? selectedStateId : states[0]?.id))[0]?.id || ''),
                    constituencyId: selectedConstituencyId !== 'all' ? selectedConstituencyId : (constituencies.filter(c => c.districtId === (selectedDistrictId !== 'all' ? selectedDistrictId : (districts.filter(d => d.stateId === (selectedStateId !== 'all' ? selectedStateId : states[0]?.id))[0]?.id || '')))[0]?.id || ''),
                    boothNumber: '',
                    boothLabel: '',
                    address: '',
                  }); 
                  setIsModalOpen(true); 
                }}
                className="webapp-button-primary h-11 px-6 flex items-center justify-center gap-2 shadow-lg shadow-blue-600/10 flex-1 sm:flex-none text-[10px] uppercase tracking-wider font-black whitespace-nowrap"
              >
                <Plus size={18} /> Election Setting
              </button>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {(error || successMessage) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-600 dark:text-red-400 text-xs font-bold flex items-center gap-3">
                <AlertTriangle size={18} />
                {error}
                <button onClick={() => setError('')} className="ml-auto opacity-50 hover:opacity-100"><X size={16}/></button>
              </div>
            )}
            {successMessage && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-3">
                <CheckCircle size={18} />
                {successMessage}
                <button onClick={() => setSuccessMessage('')} className="ml-auto opacity-50 hover:opacity-100"><X size={16} /></button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="webapp-card overflow-hidden">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center bg-zinc-50/50 dark:bg-zinc-900/30">
            <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
                <input 
                  type="text" 
                  placeholder={`Search ${activeTab}...`} 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="webapp-input w-full pl-9 h-10 text-xs"
                />
              </div>
              {activeTab !== 'states' && (
                <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex gap-2">
                  <select 
                    value={selectedStateId}
                    onChange={(e) => {
                      setSelectedStateId(e.target.value);
                      setSelectedDistrictId('all');
                    }}
                    className="webapp-input h-10 text-xs py-0 w-full sm:w-32"
                  >
                    <option value="all">All States</option>
                    {states.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  {activeTab === 'districts' && (
                     <div className="webapp-input h-10 flex items-center px-3 bg-zinc-50 dark:bg-zinc-900 border-zinc-100 text-zinc-400 text-[10px] font-black uppercase tracking-widest sm:hidden">
                       District Registry
                     </div>
                  )}
                  {activeTab === 'constituencies' && (
                    <select 
                      value={selectedDistrictId}
                      onChange={(e) => setSelectedDistrictId(e.target.value)}
                      className="webapp-input h-10 text-xs py-0 w-full sm:w-32"
                    >
                      <option value="all">All Districts</option>
                      {districts.filter(d => selectedStateId === 'all' || d.stateId === selectedStateId).map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                  )}
                  {activeTab === 'booths' && (
                    <>
                      <select 
                        value={selectedDistrictId}
                        onChange={(e) => {
                          setSelectedDistrictId(e.target.value);
                          setSelectedConstituencyId('all');
                        }}
                        className="webapp-input h-10 text-xs py-0 w-full sm:w-32"
                      >
                        <option value="all">All Districts</option>
                        {districts.filter(d => selectedStateId === 'all' || d.stateId === selectedStateId).map(d => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                      <select 
                        value={selectedConstituencyId}
                        onChange={(e) => setSelectedConstituencyId(e.target.value)}
                        className="webapp-input h-10 text-xs py-0 w-full sm:w-32"
                      >
                        <option value="all">All Constituencies</option>
                        {constituencies.filter(c => selectedDistrictId === 'all' || c.districtId === selectedDistrictId).map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </>
                  )}
                </div>
              )}
            </div>
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hidden sm:block">
            Found {filteredData.length} Results
          </p>
        </div>

        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-zinc-50/50 dark:bg-zinc-900/30 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-6 py-4 data-label">{activeTab === 'booths' ? 'Booth No.' : 'Administrative Unit'}</th>
                {activeTab === 'districts' && <th className="px-6 py-4 data-label">Parent State</th>}
                {activeTab === 'constituencies' && <th className="px-6 py-4 data-label">Parent District</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Booth Detail</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Parent Constituency</th>}
                {activeTab !== 'booths' && <th className="px-6 py-4 data-label text-center">{activeTab === 'states' ? 'Districts' : activeTab === 'districts' ? 'Constituencies' : 'Booths'}</th>}
                <th className="px-6 py-4 data-label text-center">{activeTab === 'states' ? 'State Code' : 'Registry ID'}</th>
                <th className="px-6 py-4 data-label text-right">Population (Est.)</th>
                <th className="px-6 py-4 data-label text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'states' || activeTab === 'booths' ? 5 : 6} className="py-24 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 opacity-50">Syncing Administrative Records...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'states' || activeTab === 'booths' ? 5 : 6} className="py-32 text-center text-zinc-400">
                    <MapPin size={48} className="mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-medium">No records found for the current selection.</p>
                  </td>
                </tr>
              ) : (
                (filteredData as DemographicItem[]).map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/5 text-blue-600 flex items-center justify-center border border-blue-500/10 group-hover:scale-110 transition-transform">
                          {activeTab === 'states' ? <Flag size={18} /> : activeTab === 'districts' ? <MapPin size={18} /> : activeTab === 'constituencies' ? <Globe size={18} /> : <FileSpreadsheet size={18} />}
                        </div>
                        <div>
                          {activeTab === 'booths' ? (
                            <div className="font-black text-blue-600 text-sm">#{item.boothNumber}</div>
                          ) : (
                            <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{item.name}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    {activeTab === 'booths' && (
                      <td className="px-6 py-5">
                        <div>
                          <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{item.name}</div>
                          {item.boothLabel && <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">Label: {item.boothLabel}</div>}
                          {item.address && <div className="text-[10px] text-zinc-400 mt-0.5 line-clamp-1">{item.address}</div>}
                        </div>
                      </td>
                    )}
                    {activeTab === 'districts' && (
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          <Flag size={12} className="text-zinc-300" />
                          {item.stateName}
                        </div>
                      </td>
                    )}
                    {activeTab === 'constituencies' && (
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          <MapPin size={12} className="text-zinc-300" />
                          {item.districtName}
                        </div>
                      </td>
                    )}
                    {activeTab === 'booths' && (
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                          <Globe size={12} className="text-zinc-300" />
                          {item.constituencyName}
                        </div>
                      </td>
                    )}
                    {activeTab !== 'booths' && (
                      <td className="px-6 py-5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] font-black border border-blue-100 dark:border-blue-900/30">
                          {activeTab === 'states' ? (item.districtCount || 0) : activeTab === 'districts' ? (item.constituencyCount || 0) : (item.boothCount || 0)}
                          <span className="opacity-50 uppercase tracking-tighter">Units</span>
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-5 text-center">
                      <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                        {item.code || `IND-${item.name.substring(0, 3).toUpperCase()}`}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right font-mono text-xs text-zinc-500">
                      {item.population?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {hasRight('demographics', 'u') && (
                          <button 
                            onClick={() => { 
                              setEditingItem(item); 
                              setFormData({ 
                                name: item.name, 
                                code: item.code || '', 
                                boothNumber: item.boothNumber || '',
                                boothLabel: item.boothLabel || '',
                                address: item.address || '',
                                population: item.population || 0,
                                stateId: item.stateId || '',
                                districtId: item.districtId || '',
                                constituencyId: item.constituencyId || '',
                              }); 
                              setIsModalOpen(true); 
                            }}
                            className="p-2 text-zinc-400 hover:text-blue-600 hover:bg-blue-500/10 rounded-lg transition-all"
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                        )}
                        {hasRight('demographics', 'd') && (
                          <button 
                            onClick={() => setDeletingId(item.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-zinc-300 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 opacity-50">Syncing...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-20 text-center text-zinc-400">
              <MapPin size={32} className="mx-auto mb-2 opacity-10" />
              <p className="text-xs">No records found.</p>
            </div>
          ) : (
            (filteredData as DemographicItem[]).map((item) => (
              <div key={item.id} className="p-4 space-y-4">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/5 text-blue-600 flex items-center justify-center border border-blue-500/10 shrink-0">
                      {activeTab === 'states' ? <Flag size={18} /> : activeTab === 'districts' ? <MapPin size={18} /> : activeTab === 'constituencies' ? <Globe size={18} /> : <FileSpreadsheet size={18} />}
                    </div>
                    <div>
                      {activeTab === 'booths' ? (
                        <div className="font-black text-blue-600 text-sm">#{item.boothNumber}</div>
                      ) : (
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">{item.name}</div>
                      )}
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                        {item.code || `IND-${item.name.substring(0, 3).toUpperCase()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {hasRight('demographics', 'u') && (
                      <button 
                        onClick={() => { 
                          setEditingItem(item); 
                          setFormData({ 
                            name: item.name, 
                            code: item.code || '', 
                            boothNumber: item.boothNumber || '',
                            boothLabel: item.boothLabel || '',
                            address: item.address || '',
                            population: item.population || 0,
                            stateId: item.stateId || '',
                            districtId: item.districtId || '',
                            constituencyId: item.constituencyId || '',
                          }); 
                          setIsModalOpen(true); 
                        }}
                        className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg transition-all"
                      >
                        <Edit2 size={16} />
                      </button>
                    )}
                    {hasRight('demographics', 'd') && (
                      <button 
                        onClick={() => setDeletingId(item.id)}
                        className="p-2 text-zinc-400 hover:text-red-600 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-50/50 dark:bg-zinc-900/50 p-3 rounded-2xl flex flex-col gap-2">
                  {activeTab === 'booths' && (
                    <div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Booth Details</div>
                      <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{item.name}</div>
                      {item.boothLabel && <div className="text-[10px] text-zinc-500 font-medium">Label: {item.boothLabel}</div>}
                      {item.address && <div className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed italic">{item.address}</div>}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Population</div>
                      <div className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {item.population?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                    {activeTab !== 'booths' && (
                      <div>
                        <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Containers</div>
                        <div className="text-xs font-black text-blue-600">
                          {activeTab === 'states' ? (item.districtCount || 0) : activeTab === 'districts' ? (item.constituencyCount || 0) : (item.boothCount || 0)} Units
                        </div>
                      </div>
                    )}
                  </div>

                  {(activeTab === 'districts' || activeTab === 'constituencies' || activeTab === 'booths') && (
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Parent Logic</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {activeTab === 'districts' ? (
                          <><Flag size={12} className="text-zinc-300" /> {item.stateName}</>
                        ) : activeTab === 'constituencies' ? (
                          <><MapPin size={12} className="text-zinc-300" /> {item.districtName}</>
                        ) : (
                          <><Globe size={12} className="text-zinc-300" /> {item.constituencyName}</>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsImportModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative webapp-card w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Bulk Import Voters</h3>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">CSV Batch Processing</p>
                </div>
                <button 
                  onClick={() => setIsImportModalOpen(false)} 
                  className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                {importStatus === 'idle' || importStatus === 'error' ? (
                  <>
                    <div className="space-y-4">
                      {/* Step 1: Download Sample */}
                      <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl flex gap-4 items-start">
                        <Download className="text-blue-600 mt-0.5" size={20} />
                        <div>
                          <h4 className="text-sm font-bold text-blue-900 dark:text-blue-100">Step 1: Download Sample</h4>
                          <p className="text-xs text-blue-700/70 dark:text-blue-300/50 mt-1">Get the required CSV format before preparing your data.</p>
                          <button 
                            onClick={handleDownloadSample}
                            className="mt-3 text-xs font-black uppercase tracking-wider text-blue-600 hover:underline flex items-center gap-2"
                          >
                            Download Sample CSV <ChevronRight size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Step 2: Target Location Selection */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                        <div className="flex gap-2 items-center mb-1">
                          <MapPin className="text-zinc-400 animate-pulse" size={18} />
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step 2: Target Mapping</h4>
                        </div>
                        <p className="text-xs text-zinc-500 mb-3">Select the State, District, Constituency, and target Booth under which voters will be registered.</p>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {/* State Select */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">State</label>
                            <select
                              value={importStateId}
                              onChange={(e) => setImportStateId(e.target.value)}
                              className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-1 focus:ring-blue-500 transition-all text-zinc-700 dark:text-zinc-300"
                            >
                              <option value="">Select State</option>
                              {states.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* District Select */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">District</label>
                            <select
                              value={importDistrictId}
                              onChange={(e) => setImportDistrictId(e.target.value)}
                              disabled={!importStateId || loadingImportDistricts}
                              className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 text-zinc-700 dark:text-zinc-300"
                            >
                              <option value="">{loadingImportDistricts ? 'Loading...' : 'Select District'}</option>
                              {importDistricts.map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Constituency Select */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">Constituency</label>
                            <select
                              value={importConstituencyId}
                              onChange={(e) => setImportConstituencyId(e.target.value)}
                              disabled={!importDistrictId || loadingImportConstituencies}
                              className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 text-zinc-700 dark:text-zinc-300"
                            >
                              <option value="">{loadingImportConstituencies ? 'Loading...' : 'Select Constituency'}</option>
                              {importConstituencies.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Booth Select */}
                          <div>
                            <label className="block text-[10px] font-black uppercase tracking-wider text-zinc-400 mb-1.5">Booth</label>
                            <select
                              value={importBoothId}
                              onChange={(e) => setImportBoothId(e.target.value)}
                              disabled={!importConstituencyId || loadingImportBooths}
                              className="w-full h-11 px-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:ring-1 focus:ring-blue-500 transition-all disabled:opacity-50 text-zinc-700 dark:text-zinc-300"
                            >
                              <option value="">{loadingImportBooths ? 'Loading...' : 'Select Booth'}</option>
                              {importBooths.map(b => (
                                <option key={b.id} value={b.id}>{b.boothNumber} - {b.name}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>

                      {/* Step 3: Upload CSV file */}
                      <div className="p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex gap-4 items-start">
                        <Upload className="text-zinc-400 mt-0.5" size={20} />
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Step 3: Upload CSV</h4>
                          <p className="text-xs text-zinc-500 mt-1">Select your completed CSV file to start the bulk sync.</p>
                          
                          {(!importStateId || !importDistrictId || !importConstituencyId || !importBoothId) ? (
                            <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-2 text-[10px] text-amber-600 font-bold uppercase">
                              <AlertCircle size={14} /> Select State, District, Constituency, & Booth First
                            </div>
                          ) : (
                            <div className="mt-4">
                              <input 
                                type="file" 
                                accept=".csv" 
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                className="hidden"
                              />
                              <button 
                                onClick={() => fileInputRef.current?.click()}
                                className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                              >
                                <FileSpreadsheet size={18} /> Select CSV File
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {importStatus === 'error' && (
                      <div className="p-4 bg-red-500/5 border border-red-500/10 rounded-2xl flex gap-3 items-center text-red-600">
                        <AlertCircle size={18} />
                        <p className="text-xs font-medium">{importError}</p>
                      </div>
                    )}
                  </>
                ) : importStatus === 'parsing' || importStatus === 'uploading' ? (
                  <div className="py-12 text-center space-y-6">
                    <div className="relative w-24 h-24 mx-auto">
                      <svg className="w-full h-full" viewBox="0 0 100 100">
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
                          strokeDashoffset={251.2 - (251.2 * importProgress) / 100}
                          strokeLinecap="round" 
                          stroke="currentColor" 
                          fill="transparent" 
                          r="40" 
                          cx="50" 
                          cy="50" 
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center font-black text-lg text-zinc-900 dark:text-white">
                        {importProgress}%
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-zinc-900 dark:text-white">
                        {importStatus === 'parsing' ? 'Reading File...' : 'Syncing Records...'}
                      </h4>
                      <p className="text-xs text-zinc-500 mt-1">Please do not close this window.</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center space-y-6">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center text-green-600 mx-auto">
                      <CheckCircle size={40} />
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-zinc-900 dark:text-white">Import Complete</h4>
                      <div className="flex justify-center gap-4 mt-4">
                        <div className="text-center">
                          <p className="text-xl font-black text-green-600">{importResults.success}</p>
                          <p className="text-[10px] text-zinc-500 font-black uppercase">Success</p>
                        </div>
                        <div className="text-center">
                          <p className="text-xl font-black text-red-600">{importResults.failed}</p>
                          <p className="text-[10px] text-zinc-500 font-black uppercase">Failed</p>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setIsImportModalOpen(false)}
                      className="w-full py-3 border border-zinc-200 dark:border-zinc-800 rounded-xl font-bold text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all"
                    >
                      Close Window
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsModalOpen(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.95, opacity: 0, y: 20 }} 
              className="relative webapp-card w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{editingItem ? 'Update Record' : `New ${activeTab === 'states' ? 'State' : activeTab === 'districts' ? 'District' : activeTab === 'constituencies' ? 'Constituency' : 'Booth'} Entry`}</h3>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">Geopolitical Hierarchy</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all"><X size={20} /></button>
              </div>
              
              <form onSubmit={handleCreateOrUpdate} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-8 space-y-6 custom-scrollbar">
                  <div className="space-y-2">
                    <label className="data-label">Official Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })} 
                      className="webapp-input w-full h-11 text-sm font-medium"
                      placeholder={`e.g. ${activeTab === 'states' ? 'Maharashtra' : activeTab === 'districts' ? 'Mumbai' : activeTab === 'constituencies' ? 'Mumbai South' : 'Booth No. 1'}`}
                    />
                  </div>
                  
                  {activeTab !== 'states' && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="data-label">Parent State</label>
                        <select 
                          required
                          value={formData.stateId}
                          onChange={e => setFormData({ ...formData, stateId: e.target.value, districtId: '', constituencyId: '' })}
                          className="webapp-input w-full h-11 text-sm"
                        >
                          <option value="" disabled>Select parent state</option>
                          {states.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                          ))}
                        </select>
                      </div>

                      {(activeTab === 'constituencies' || activeTab === 'booths') && (
                        <div className="space-y-2">
                          <label className="data-label">Parent District</label>
                          <select 
                            required
                            value={formData.districtId}
                            onChange={e => setFormData({ ...formData, districtId: e.target.value, constituencyId: '' })}
                            className="webapp-input w-full h-11 text-sm"
                          >
                            <option value="" disabled>Select parent district</option>
                            {districts.filter(d => d.stateId === formData.stateId).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {activeTab === 'booths' && (
                        <div className="space-y-2">
                          <label className="data-label">Parent Constituency</label>
                          <select 
                            required
                            value={formData.constituencyId}
                            onChange={e => setFormData({ ...formData, constituencyId: e.target.value })}
                            className="webapp-input w-full h-11 text-sm"
                          >
                            <option value="" disabled>Select parent constituency</option>
                            {constituencies.filter(c => c.districtId === formData.districtId).map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {(activeTab === 'states' || activeTab === 'booths') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {activeTab === 'states' ? (
                        <div className="space-y-2">
                          <label className="data-label">State Code</label>
                          <input 
                            type="text" 
                            required 
                            maxLength={5}
                            value={formData.code} 
                            onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                            className="webapp-input w-full h-11 text-sm font-black uppercase"
                            placeholder="MH"
                          />
                        </div>
                      ) : (
                        <>
                          <div className="space-y-2">
                            <label className="data-label">Booth Number</label>
                            <input 
                              type="text" 
                              required 
                              value={formData.boothNumber} 
                              onChange={e => setFormData({ ...formData, boothNumber: e.target.value })} 
                              className="webapp-input w-full h-11 text-sm font-bold"
                              placeholder="e.g. 154"
                            />
                          </div>
                          <div className="space-y-2">
                            <label className="data-label">Booth Label</label>
                            <input 
                              type="text" 
                              value={formData.boothLabel} 
                              onChange={e => setFormData({ ...formData, boothLabel: e.target.value })} 
                              className="webapp-input w-full h-11 text-sm"
                              placeholder="e.g. 154-A"
                            />
                          </div>
                        </>
                      )}
                      <div className="space-y-2">
                        <label className="data-label">Population (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-11 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'booths' && (
                    <div className="space-y-2">
                      <label className="data-label">Full Address</label>
                      <textarea 
                        value={formData.address} 
                        onChange={e => setFormData({ ...formData, address: e.target.value })} 
                        className="webapp-input w-full h-24 text-sm py-3"
                        placeholder="e.g. Primary School Room 4, Ground Floor, Near Main Chawk..."
                      />
                    </div>
                  )}

                  {(activeTab === 'districts' || activeTab === 'constituencies') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="data-label">Administrative Area</label>
                        <div className="webapp-input w-full h-11 flex items-center px-4 bg-zinc-50 dark:bg-zinc-900 border-zinc-100 text-zinc-400 text-xs font-bold uppercase tracking-widest">
                          Secondary Level
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="data-label">Population (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-11 text-sm"
                          placeholder="0"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="webapp-button-secondary flex-1">Abort</button>
                  <button type="submit" disabled={actionLoading} className="webapp-button-primary flex-1 flex justify-center items-center gap-2">
                    {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    {editingItem ? 'Update Registry' : 'Save Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemographicSettings;
