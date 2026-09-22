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
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import BulkImportModal, { IndiaState, IndiaDistrict, IndiaConstituency, IndiaBooth } from './BulkImportModal';

interface DemographicItem {
  id: string;
  name: string;
  code?: string;
  category?: string;
  stateId?: string;
  stateCode?: string;
  stateName?: string;
  districtId?: string;
  districtName?: string;
  constituencyId?: string;
  constituencyName?: string;
  mandalId?: string;
  mandalName?: string;
  boothId?: string;
  boothNumber?: string;
  boothLabel?: string;
  address?: string;
  totalVoters?: number;
  population?: number;
  districtCount?: number;
  constituencyCount?: number;
  boothCount?: number;
}

const DemographicSettings: React.FC = () => {
  const { user, isSuperAdmin, profile } = useAuth();
  
  const hasRight = (moduleId: string, right: string) => {
    const userEmail = (user?.email || profile?.email || '').toLowerCase().trim();
    if (userEmail === 'vijaychauhanofficial01@gmail.com' || isSuperAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || profile?.rights?.[moduleId] || '';
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
  
  // Bulk Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<IndiaState | IndiaDistrict | IndiaConstituency | IndiaBooth | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '', // For States
    category: 'General', // For Constituencies: General, OBC, SC, ST, Other
    boothNumber: '', // For Booths
    boothLabel: '', // For Booths
    address: '', // For Booths
    population: 0,
    stateId: '', // For Districts/Constituencies/Booths
    districtId: '', // For Constituencies/Booths
    constituencyId: '', // For Booths
    mandalId: '', // For Booths
  });

  // Modal cascading dropdown cache
  const [modalDistricts, setModalDistricts] = useState<IndiaDistrict[]>([]);
  const [modalConstituencies, setModalConstituencies] = useState<IndiaConstituency[]>([]);
  const [modalMandals, setModalMandals] = useState<any[]>([]);

  const fetchStates = async () => {
    setLoading(true);
    try {
      const fetchedStates = await api.get<IndiaState[]>('/api/states');
      setStates(fetchedStates.map((s: any) => ({
        ...s,
        id: String(s.id),
      })));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch states.');
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
        id: String(d.id),
        stateId: String(d.state_id || d.stateId || ''),
        stateName: d.state_name || d.stateName || ''
      })));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch districts.');
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
        id: String(c.id),
        stateId: String(c.state_id || c.stateId || ''),
        districtId: String(c.district_id || c.districtId || ''),
        districtName: c.district_name || c.districtName || '',
        category: c.category || c.seat_category || c.seat_type || 'General'
      })));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch constituencies.');
    } finally {
      setLoading(false);
    }
  };

  const normalizeId = (id: any) => String(id ?? '').trim().replace(/\.0$/, '');

  const getConstituencyName = (constituencyId?: string | number, constituencyName?: string) => {
    if (constituencyName && !constituencyName.startsWith('Constituency #') && !constituencyName.includes('.')) {
      return constituencyName;
    }
    const normTarget = normalizeId(constituencyId);
    if (!normTarget) return '';
    const found = constituencies.find(c => normalizeId(c.id) === normTarget);
    if (found && found.name) return found.name;
    if (constituencyName && !constituencyName.startsWith('Constituency #')) return constituencyName;
    return `Constituency ${normTarget}`;
  };

  const fetchBooths = async () => {
    setLoading(true);
    try {
      let url = '/api/booths?';
      if (selectedStateId !== 'all') url += `stateId=${selectedStateId}&`;
      if (selectedDistrictId !== 'all') url += `districtId=${selectedDistrictId}&`;
      if (selectedConstituencyId !== 'all') url += `constituencyId=${selectedConstituencyId}&`;
      const fetchedBooths = await api.get<IndiaBooth[]>(url);
      setBooths(fetchedBooths.map((b: any) => {
        const rawConstId = String(b.constituency_id || b.constituencyId || '');
        const matchedConst = constituencies.find(c => normalizeId(c.id) === normalizeId(rawConstId));
        return {
          ...b,
          id: String(b.id),
          name: b.name || '',
          boothNumber: String(b.booth_number !== undefined ? b.booth_number : (b.boothNumber || '')),
          boothLabel: b.booth_label || b.boothLabel || '',
          address: b.address || '',
          totalVoters: b.total_voters !== undefined ? Number(b.total_voters) : (Number(b.totalVoters) || Number(b.population) || 0),
          population: b.total_voters !== undefined ? Number(b.total_voters) : (Number(b.totalVoters) || Number(b.population) || 0),
          stateId: String(b.state_id || b.stateId || matchedConst?.stateId || ''),
          stateName: b.state_name || b.stateName || '',
          districtId: String(b.district_id || b.districtId || matchedConst?.districtId || ''),
          districtName: b.district_name || b.districtName || '',
          constituencyId: rawConstId,
          constituencyName: b.constituency_name || matchedConst?.name || '',
          mandalId: b.mandal_id !== undefined && b.mandal_id !== null ? String(b.mandal_id) : (b.mandalId ? String(b.mandalId) : ''),
          mandalName: b.mandal_name || b.mandalName || ''
        };
      }));
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch booths.');
    } finally {
      setLoading(false);
    }
  };

  // Always load states on mount
  useEffect(() => {
    fetchStates();
  }, []);

  // Fetch active tab data
  useEffect(() => {
    if (activeTab === 'states') {
      fetchStates();
    } else if (activeTab === 'districts') {
      fetchDistricts();
    } else if (activeTab === 'constituencies') {
      fetchConstituencies();
      if (districts.length === 0) fetchDistricts();
    } else {
      fetchBooths();
      if (districts.length === 0) fetchDistricts();
      if (constituencies.length === 0) fetchConstituencies();
    }
  }, [activeTab, selectedStateId, selectedDistrictId, selectedConstituencyId]);

  // Load modal cascading options when formData state or district changes
  useEffect(() => {
    if (!formData.stateId) {
      setModalDistricts([]);
      return;
    }
    api.get<IndiaDistrict[]>(`/api/districts?stateId=${formData.stateId}`)
      .then(d => setModalDistricts(d.map((x: any) => ({
        ...x,
        id: String(x.id),
        stateId: String(x.state_id || x.stateId || '')
      }))))
      .catch(console.error);
  }, [formData.stateId]);

  useEffect(() => {
    if (!formData.districtId) {
      setModalConstituencies([]);
      return;
    }
    api.get<IndiaConstituency[]>(`/api/constituencies?districtId=${formData.districtId}`)
      .then(c => setModalConstituencies(c.map((x: any) => ({
        ...x,
        id: String(x.id),
        stateId: String(x.state_id || x.stateId || ''),
        districtId: String(x.district_id || x.districtId || '')
      }))))
      .catch(console.error);
  }, [formData.districtId]);

  useEffect(() => {
    if (!formData.constituencyId) {
      setModalMandals([]);
      return;
    }
    api.get<any[]>(`/api/mandals?constituencyId=${formData.constituencyId}`)
      .then(m => setModalMandals(m.map((x: any) => ({
        ...x,
        id: String(x.id),
      }))))
      .catch(console.error);
  }, [formData.constituencyId]);





  const openEditModal = (item: any) => {
    setEditingItem(item);
    const matchedConst = constituencies.find(c => normalizeId(c.id) === normalizeId(item.constituencyId));
    const matchedDist = districts.find(d => normalizeId(d.id) === normalizeId(item.districtId || matchedConst?.districtId));
    const targetStateId = String(item.stateId || matchedConst?.stateId || matchedDist?.stateId || (selectedStateId !== 'all' ? selectedStateId : (states[0]?.id || '')));
    const targetDistrictId = String(item.districtId || matchedConst?.districtId || (selectedDistrictId !== 'all' ? selectedDistrictId : ''));
    const targetConstituencyId = String(item.constituencyId || (selectedConstituencyId !== 'all' ? selectedConstituencyId : ''));

    setFormData({ 
      name: item.name || '', 
      code: item.code || '', 
      category: item.category || 'General',
      boothNumber: item.boothNumber || '',
      boothLabel: item.boothLabel || '',
      address: item.address || '',
      population: item.totalVoters !== undefined ? item.totalVoters : (item.population || 0),
      stateId: targetStateId,
      districtId: targetDistrictId,
      constituencyId: targetConstituencyId,
      mandalId: item.mandalId ? String(item.mandalId) : '',
    }); 
    setIsModalOpen(true); 
  };

  const openCreateModal = () => {
    setEditingItem(null); 
    const defaultStateId = selectedStateId !== 'all' ? selectedStateId : (states[0]?.id || '');
    const defaultDistrictId = selectedDistrictId !== 'all' ? selectedDistrictId : '';
    const defaultConstituencyId = selectedConstituencyId !== 'all' ? selectedConstituencyId : '';
    setFormData({ 
      name: '', 
      code: '', 
      category: 'General',
      population: 0, 
      stateId: defaultStateId,
      districtId: defaultDistrictId,
      constituencyId: defaultConstituencyId,
      mandalId: '',
      boothNumber: '',
      boothLabel: '',
      address: '',
    }); 
    setIsModalOpen(true); 
  };

  const handleCreateOrUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setError('');

    try {
      if (activeTab === 'states') {
        const stateData = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/states/${editingItem.id}`, stateData);
        } else {
          await api.post('/api/states', stateData);
        }
        setSuccessMessage(`${formData.name} saved to registry.`);
        fetchStates();
      } else if (activeTab === 'districts') {
        if (!formData.stateId) {
          setError('Please select a parent state.');
          setActionLoading(false);
          return;
        }
        const districtData = {
          name: formData.name.trim(),
          state_id: !isNaN(Number(formData.stateId)) ? Number(formData.stateId) : formData.stateId,
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/districts/${editingItem.id}`, districtData);
        } else {
          await api.post('/api/districts', districtData);
        }
        setSuccessMessage(`District ${formData.name} saved.`);
        fetchDistricts();
      } else if (activeTab === 'constituencies') {
        if (!formData.districtId) {
          setError('Please select a parent district.');
          setActionLoading(false);
          return;
        }
        const constituencyData = {
          name: formData.name.trim(),
          state_id: formData.stateId ? (!isNaN(Number(formData.stateId)) ? Number(formData.stateId) : formData.stateId) : null,
          district_id: !isNaN(Number(formData.districtId)) ? Number(formData.districtId) : formData.districtId,
          category: formData.category || 'General',
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/constituencies/${editingItem.id}`, constituencyData);
        } else {
          await api.post('/api/constituencies', constituencyData);
        }
        setSuccessMessage(`Constituency ${formData.name} saved.`);
        fetchConstituencies();
      } else {
        if (!formData.constituencyId) {
          setError('Please select a parent constituency.');
          setActionLoading(false);
          return;
        }
        const boothData = {
          name: formData.name.trim() || `Booth #${formData.boothNumber.trim()}`,
          booth_number: formData.boothNumber.trim(),
          booth_label: formData.boothLabel.trim(),
          address: formData.address.trim(),
          state_id: formData.stateId ? (!isNaN(Number(formData.stateId)) ? Number(formData.stateId) : formData.stateId) : null,
          district_id: formData.districtId ? (!isNaN(Number(formData.districtId)) ? Number(formData.districtId) : formData.districtId) : null,
          constituency_id: !isNaN(Number(formData.constituencyId)) ? Number(formData.constituencyId) : formData.constituencyId,
          mandal_id: formData.mandalId ? (!isNaN(Number(formData.mandalId)) ? Number(formData.mandalId) : formData.mandalId) : null,
          total_voters: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/booths/${editingItem.id}`, boothData);
        } else {
          await api.post('/api/booths', boothData);
        }
        setSuccessMessage(`Booth ${formData.name || formData.boothNumber} saved.`);
        fetchBooths();
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Failed to save demographic item.';
      setError(msg);
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
        setDistricts(prev => prev.filter(d => d.stateId !== itemId));
      } else if (activeTab === 'districts') {
        await api.delete(`/api/districts/${itemId}`);
        setDistricts(prev => prev.filter(d => d.id !== itemId));
        setConstituencies(prev => prev.filter(c => c.districtId !== itemId));
      } else if (activeTab === 'constituencies') {
        await api.delete(`/api/constituencies/${itemId}`);
        setConstituencies(prev => prev.filter(c => c.id !== itemId));
        setBooths(prev => prev.filter(b => b.constituencyId !== itemId));
      } else if (activeTab === 'booths') {
        await api.delete(`/api/booths/${itemId}`);
        setBooths(prev => prev.filter(b => b.id !== itemId));
      }
      setSuccessMessage(`${itemName} removed successfully.`);
      setDeletingId(null);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || `Failed to delete ${itemName}.`;
      setError(msg);
    } finally {
      setActionLoading(false);
    }
  };

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

  const filteredData = (!isSuperAdmin && !hasAssignedScope)
    ? []
    : activeTab === 'states' 
      ? states.filter(s => {
          const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.code.toLowerCase().includes(searchTerm.toLowerCase());
          if (isSuperAdmin) return matchesSearch;
          const matchesScope = allowedStateIds.length === 0 || allowedStateIds.includes(String(s.id)) || allowedStateIds.includes(s.name) || allowedStateIds.includes(s.code);
          return matchesSearch && matchesScope;
        })
      : activeTab === 'districts'
        ? districts.filter(d => {
            const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) || d.stateName.toLowerCase().includes(searchTerm.toLowerCase());
            if (isSuperAdmin) return matchesSearch;
            if (allowedDistrictIds.length > 0) return matchesSearch && (allowedDistrictIds.includes(String(d.id)) || allowedDistrictIds.includes(d.name));
            if (allowedStateIds.length > 0) return matchesSearch && (allowedStateIds.includes(String(d.stateId)) || allowedStateIds.includes(d.stateName));
            return matchesSearch;
          })
        : activeTab === 'constituencies'
          ? constituencies.filter(c => {
              const matchesSearch = c.name.toLowerCase().includes(searchTerm.toLowerCase()) || c.districtName.toLowerCase().includes(searchTerm.toLowerCase()) || (c.category && c.category.toLowerCase().includes(searchTerm.toLowerCase()));
              if (isSuperAdmin) return matchesSearch;
              if (allowedConstituencyIds.length > 0) return matchesSearch && (allowedConstituencyIds.includes(String(c.id)) || allowedConstituencyIds.includes(c.name));
              if (allowedDistrictIds.length > 0) return matchesSearch && (allowedDistrictIds.includes(String(c.districtId)) || allowedDistrictIds.includes(c.districtName));
              if (allowedStateIds.length > 0) return matchesSearch && (allowedStateIds.includes(String(c.stateId)));
              return matchesSearch;
            })
          : booths.filter(b => {
              const matchesSearch = b.name.toLowerCase().includes(searchTerm.toLowerCase()) || b.boothNumber.toLowerCase().includes(searchTerm.toLowerCase()) || (b.constituencyName && b.constituencyName.toLowerCase().includes(searchTerm.toLowerCase())) || (b.mandalName && b.mandalName.toLowerCase().includes(searchTerm.toLowerCase())) || (b.address && b.address.toLowerCase().includes(searchTerm.toLowerCase()));
              if (isSuperAdmin) return matchesSearch;
              if (allowedBoothIds.length > 0) return matchesSearch && (allowedBoothIds.includes(String(b.id)) || allowedBoothIds.includes(String(b.boothNumber)) || allowedBoothIds.includes(b.name));
              if (allowedConstituencyIds.length > 0) return matchesSearch && (allowedConstituencyIds.includes(String(b.constituencyId)) || allowedConstituencyIds.includes(b.constituencyName));
              if (allowedDistrictIds.length > 0) return matchesSearch && (allowedDistrictIds.includes(String(b.districtId)));
              if (allowedStateIds.length > 0) return matchesSearch && (allowedStateIds.includes(String(b.stateId)));
              return matchesSearch;
            });

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
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

      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Demographics
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Settings
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage states, districts, constituencies, and polling booths.
          </p>
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
                onClick={() => setIsImportModalOpen(true)}
                className="h-10 px-4 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-semibold text-xs hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 flex-1 sm:flex-none whitespace-nowrap"
              >
                <Upload size={14} /> Bulk Import
              </button>
            )}

            {hasRight('demographics', 'c') && (
              <button 
                onClick={() => openCreateModal()}
                className="webapp-button-primary h-10 px-4 flex items-center justify-center gap-2 shadow-sm flex-1 sm:flex-none text-xs font-semibold whitespace-nowrap"
              >
                <Plus size={16} /> Add {activeTab === 'states' ? 'State' : activeTab === 'districts' ? 'District' : activeTab === 'constituencies' ? 'Constituency' : 'Booth'}
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
                {activeTab === 'constituencies' && <th className="px-6 py-4 data-label text-center">Seat Category</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Booth Name</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Constituency</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Mandal</th>}
                {activeTab === 'booths' && <th className="px-6 py-4 data-label">Address</th>}
                {activeTab !== 'booths' && <th className="px-6 py-4 data-label text-center">{activeTab === 'states' ? 'Districts' : activeTab === 'districts' ? 'Constituencies' : 'Booths'}</th>}
                {activeTab === 'states' && <th className="px-6 py-4 data-label text-center">State Code</th>}
                <th className="px-6 py-4 data-label text-right">{activeTab === 'booths' ? 'Total Voters' : 'Population (Est.)'}</th>
                <th className="px-6 py-4 data-label text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'states' ? 5 : activeTab === 'districts' ? 5 : activeTab === 'constituencies' ? 6 : 7} className="py-24 text-center">
                    <Loader2 size={32} className="animate-spin mx-auto text-zinc-300 dark:text-zinc-700 mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 opacity-50">Syncing Administrative Records...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'states' ? 5 : activeTab === 'districts' ? 5 : activeTab === 'constituencies' ? 6 : 7} className="py-32 text-center text-zinc-400">
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
                    {activeTab === 'constituencies' && (
                      <td className="px-6 py-5 text-center">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-black tracking-wider uppercase border shadow-2xs ${
                          (item.category || '').toUpperCase() === 'SC' 
                            ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/60'
                            : (item.category || '').toUpperCase() === 'ST'
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                              : (item.category || '').toUpperCase() === 'OBC'
                                ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                                : (item.category || '').toUpperCase() === 'OTHER'
                                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60'
                                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                        }`}>
                          {item.category || 'General'}
                        </span>
                      </td>
                    )}
                    {activeTab === 'booths' && (
                      <td className="px-6 py-5">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-800 dark:text-zinc-200">
                            <Globe size={13} className="text-blue-500 shrink-0" />
                            <span>{getConstituencyName(item.constituencyId, item.constituencyName) || '-'}</span>
                          </div>
                          {(item.districtName || item.stateName) && (
                            <span className="text-[10px] text-zinc-400 font-medium pl-5">
                              {[item.districtName, item.stateName].filter(Boolean).join(', ')}
                            </span>
                          )}
                        </div>
                      </td>
                    )}
                    {activeTab === 'booths' && (
                      <td className="px-6 py-5">
                        {item.mandalName ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 text-xs font-bold border border-indigo-200/60 dark:border-indigo-800/40">
                            {item.mandalName}
                          </span>
                        ) : (
                          <span className="text-xs text-zinc-300 dark:text-zinc-600">-</span>
                        )}
                      </td>
                    )}
                    {activeTab === 'booths' && (
                      <td className="px-6 py-5 max-w-[200px]">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 leading-relaxed" title={item.address}>
                          {item.address || <span className="italic text-zinc-300 dark:text-zinc-600">No address specified</span>}
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
                    {activeTab === 'states' && (
                      <td className="px-6 py-5 text-center">
                        <span className="px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-[10px] font-black text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                          {item.code}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-5 text-right font-mono text-xs text-zinc-500">
                      {(item.totalVoters !== undefined ? item.totalVoters : item.population)?.toLocaleString() || 'N/A'}
                    </td>
                    <td className="px-6 py-5 text-right">
                      <div className="flex justify-end gap-2">
                        {hasRight('demographics', 'u') && (
                          <button 
                            onClick={() => openEditModal(item)}
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
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm flex items-center gap-2 flex-wrap">
                          <span>{item.name}</span>
                          {activeTab === 'constituencies' && (
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black tracking-wider uppercase border ${
                              (item.category || '').toUpperCase() === 'SC' 
                                ? 'bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 border-purple-200 dark:border-purple-800/60'
                                : (item.category || '').toUpperCase() === 'ST'
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                                  : (item.category || '').toUpperCase() === 'OBC'
                                    ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                                    : (item.category || '').toUpperCase() === 'OTHER'
                                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800/60'
                                      : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                            }`}>
                              {item.category || 'General'}
                            </span>
                          )}
                        </div>
                      )}
                      {activeTab === 'states' && item.code && (
                        <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                          {item.code}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {hasRight('demographics', 'u') && (
                      <button 
                        onClick={() => openEditModal(item)}
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
                      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">{activeTab === 'booths' ? 'Total Voters' : 'Population'}</div>
                      <div className="text-xs font-mono font-bold text-zinc-700 dark:text-zinc-300">
                        {(item.totalVoters !== undefined ? item.totalVoters : item.population)?.toLocaleString() || 'N/A'}
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
                    <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                      <div className="text-[10px] text-zinc-400 font-bold uppercase mb-0.5">Parent Hierarchy</div>
                      <div className="flex items-center gap-2 text-xs font-bold text-zinc-600 dark:text-zinc-400">
                        {activeTab === 'districts' ? (
                          <><Flag size={12} className="text-zinc-300" /> {item.stateName}</>
                        ) : activeTab === 'constituencies' ? (
                          <><MapPin size={12} className="text-zinc-300" /> {item.districtName}</>
                        ) : (
                          <div className="flex flex-col gap-1 w-full">
                            <div className="flex items-center gap-1.5">
                              <Globe size={12} className="text-blue-500" /> 
                              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                                {getConstituencyName(item.constituencyId, item.constituencyName) || 'Constituency Unassigned'}
                              </span>
                            </div>
                            {(item.districtName || item.stateName) && (
                              <div className="text-[10px] text-zinc-400 pl-4.5 font-medium">
                                {[item.districtName, item.stateName].filter(Boolean).join(' • ')}
                              </div>
                            )}
                            {item.mandalName && <div className="text-[10px] text-indigo-600 dark:text-indigo-400 font-semibold pl-4.5">Mandal: {item.mandalName}</div>}
                          </div>
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

      {/* Upgraded Bulk Import Modal */}
      <BulkImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          if (activeTab === 'booths') {
            fetchBooths();
          }
        }}
        initialStateId={selectedStateId !== 'all' ? selectedStateId : ''}
        initialDistrictId={selectedDistrictId !== 'all' ? selectedDistrictId : ''}
        initialConstituencyId={selectedConstituencyId !== 'all' ? selectedConstituencyId : ''}
        states={states}
      />

      <AnimatePresence>
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
                            {(modalDistricts.length > 0 ? modalDistricts : districts.filter(d => String(d.stateId) === String(formData.stateId))).map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                          </select>
                        </div>
                      )}

                      {activeTab === 'booths' && (
                        <>
                          <div className="space-y-2">
                            <label className="data-label">Parent Constituency</label>
                            <select 
                              required
                              value={formData.constituencyId}
                              onChange={e => setFormData({ ...formData, constituencyId: e.target.value, mandalId: '' })}
                              className="webapp-input w-full h-11 text-sm"
                            >
                              <option value="" disabled>Select parent constituency</option>
                              {(modalConstituencies.length > 0 ? modalConstituencies : constituencies.filter(c => String(c.districtId) === String(formData.districtId))).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>

                          <div className="space-y-2">
                            <label className="data-label">Parent Mandal (Optional)</label>
                            <select 
                              value={formData.mandalId}
                              onChange={e => setFormData({ ...formData, mandalId: e.target.value })}
                              className="webapp-input w-full h-11 text-sm"
                            >
                              <option value="">Select Mandal (Optional)</option>
                              {modalMandals.map(m => (
                                <option key={m.id} value={m.id}>{m.name} {m.mandal_code ? `(${m.mandal_code})` : ''}</option>
                              ))}
                            </select>
                          </div>
                        </>
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
                            <label className="data-label">Booth Label (Optional)</label>
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
                        <label className="data-label">{activeTab === 'booths' ? 'Total Voters' : 'Population (Est.)'}</label>
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

                  {activeTab === 'constituencies' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="data-label">Seat Category (Reservation)</label>
                        <select
                          value={formData.category || 'General'}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className="webapp-input w-full h-11 text-sm font-semibold"
                        >
                          <option value="General">General (GEN / Open)</option>
                          <option value="OBC">OBC (Other Backward Class)</option>
                          <option value="SC">SC (Scheduled Caste)</option>
                          <option value="ST">ST (Scheduled Tribe)</option>
                          <option value="Other">Other / Special</option>
                        </select>
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

                  {activeTab === 'districts' && (
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
