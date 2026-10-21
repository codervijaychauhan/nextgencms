import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  FileSpreadsheet,
  Building2,
  Landmark,
  Layers,
  Home,
  Sparkles,
  ListPlus,
  FileText,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import BulkImportModal, { IndiaState, IndiaDistrict, IndiaConstituency, IndiaBooth } from './BulkImportModal';

export type DemographicTab = 'states' | 'districts' | 'constituencies' | 'blocks' | 'panchayats' | 'wards' | 'booths';

export interface DemographicItem {
  id: string;
  name: string;
  code?: string;
  type?: string;
  category?: string;
  wardNumber?: string;
  stateId?: string;
  stateCode?: string;
  stateName?: string;
  districtId?: string;
  districtName?: string;
  constituencyId?: string;
  constituencyName?: string;
  mandalId?: string;
  mandalName?: string;
  mandalCode?: string;
  panchayatId?: string;
  panchayatName?: string;
  wardId?: string;
  wardName?: string;
  boothId?: string;
  boothNumber?: string;
  boothLabel?: string;
  address?: string;
  totalVoters?: number;
  population?: number;
  districtCount?: number;
  constituencyCount?: number;
  blockCount?: number;
  panchayatCount?: number;
  wardCount?: number;
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
  
  const [activeTab, setActiveTab] = useState<DemographicTab>('states');
  
  // Data states
  const [states, setStates] = useState<IndiaState[]>([]);
  const [districts, setDistricts] = useState<IndiaDistrict[]>([]);
  const [constituencies, setConstituencies] = useState<IndiaConstituency[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [panchayats, setPanchayats] = useState<any[]>([]);
  const [wards, setWards] = useState<any[]>([]);
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
  const [selectedBlockId, setSelectedBlockId] = useState<string>('all');
  const [selectedPanchayatId, setSelectedPanchayatId] = useState<string>('all');
  const [selectedWardId, setSelectedWardId] = useState<string>('all');
  
  // Bulk Import modal state
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '', // For States / Blocks / Panchayats
    type: 'Gram Panchayat', // For Panchayats: Gram Panchayat, Municipal Corporation, Municipality, Nagar Panchayat, ULB; For Wards: Ward, Village, Mohalla
    category: 'General', // For Constituencies: General, OBC, SC, ST, Other
    wardNumber: '', // For Wards
    boothNumber: '', // For Booths
    boothLabel: '', // For Booths
    address: '', // For Booths
    population: 0,
    stateId: '',
    districtId: '',
    constituencyId: '',
    mandalId: '',
    panchayatId: '',
    wardId: '',
  });

  // Modal cascading dropdown caches
  const [modalDistricts, setModalDistricts] = useState<IndiaDistrict[]>([]);
  const [modalConstituencies, setModalConstituencies] = useState<IndiaConstituency[]>([]);
  const [modalBlocks, setModalBlocks] = useState<any[]>([]);
  const [modalPanchayats, setModalPanchayats] = useState<any[]>([]);
  const [modalWards, setModalWards] = useState<any[]>([]);

  const normalizeId = (id: any) => String(id ?? '').trim().replace(/\.0$/, '');

  const getDistrictCount = (stateItem: any) => {
    const matchCount = districts.filter(d => normalizeId(d.stateId) === normalizeId(stateItem.id)).length;
    if (matchCount > 0) return matchCount;
    if (stateItem.districtCount !== undefined && stateItem.districtCount !== null) return Number(stateItem.districtCount);
    return matchCount;
  };

  const getConstituencyCount = (districtItem: any) => {
    const matchCount = constituencies.filter(c => normalizeId(c.districtId) === normalizeId(districtItem.id)).length;
    if (matchCount > 0) return matchCount;
    if (districtItem.constituencyCount !== undefined && districtItem.constituencyCount !== null) return Number(districtItem.constituencyCount);
    return matchCount;
  };

  const getBlockCount = (constituencyItem: any) => {
    const matchCount = blocks.filter(b => normalizeId(b.constituencyId) === normalizeId(constituencyItem.id)).length;
    if (matchCount > 0) return matchCount;
    return matchCount;
  };

  const getPanchayatCount = (blockItem: any) => {
    const matchCount = panchayats.filter(p => normalizeId(p.mandalId) === normalizeId(blockItem.id)).length;
    return matchCount;
  };

  const getWardCount = (panchayatItem: any) => {
    const matchCount = wards.filter(w => normalizeId(w.panchayatId) === normalizeId(panchayatItem.id)).length;
    return matchCount;
  };

  const getBoothCount = (item: any, level: 'constituency' | 'block' | 'panchayat' | 'ward') => {
    if (level === 'constituency') {
      return booths.filter(b => normalizeId(b.constituencyId) === normalizeId(item.id)).length;
    }
    if (level === 'block') {
      return booths.filter(b => normalizeId(b.mandalId) === normalizeId(item.id)).length;
    }
    if (level === 'panchayat') {
      return booths.filter(b => normalizeId(b.panchayatId) === normalizeId(item.id)).length;
    }
    if (level === 'ward') {
      return booths.filter(b => normalizeId(b.wardId) === normalizeId(item.id)).length;
    }
    return 0;
  };

  const getVoterCount = (boothItem: any) => {
    if (boothItem.totalVoters !== undefined && boothItem.totalVoters !== null && Number(boothItem.totalVoters) > 0) {
      return Number(boothItem.totalVoters);
    }
    if (boothItem.voter_count !== undefined && boothItem.voter_count !== null) {
      return Number(boothItem.voter_count);
    }
    if (boothItem.total_voters !== undefined && boothItem.total_voters !== null) {
      return Number(boothItem.total_voters);
    }
    return Number(boothItem.population || 0);
  };

  // Unified data loader that builds a complete sequential hierarchical map
  const fetchAllData = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      const [st, dt, ct, blk, pan, wrd, bth] = await Promise.all([
        api.get<any[]>('/api/states').catch(() => []),
        api.get<any[]>('/api/districts').catch(() => []),
        api.get<any[]>('/api/constituencies').catch(() => []),
        api.get<any[]>('/api/mandals').catch(() => []),
        api.get<any[]>('/api/panchayats').catch(() => []),
        api.get<any[]>('/api/wards').catch(() => []),
        api.get<any[]>('/api/booths').catch(() => []),
      ]);

      const unwrapList = (res: any): any[] => {
        if (Array.isArray(res)) return res;
        if (Array.isArray(res?.results)) return res.results;
        if (Array.isArray(res?.data)) return res.data;
        return [];
      };

      const rawSt = unwrapList(st);
      const rawDt = unwrapList(dt);
      const rawCt = unwrapList(ct);
      const rawBlk = unwrapList(blk);
      const rawPan = unwrapList(pan);
      const rawWrd = unwrapList(wrd);
      const rawBth = unwrapList(bth);

      // 1. Map states
      const stateList = rawSt.map((s: any) => ({
        ...s,
        id: String(s.id),
        name: s.name || '',
        code: s.code || '',
        population: Number(s.population || 0),
        districtCount: s.districtCount !== undefined ? Number(s.districtCount) : (s.district_count !== undefined ? Number(s.district_count) : undefined),
      }));
      const stateMap = new Map(stateList.map((s: any) => [normalizeId(s.id), s]));

      // 2. Map districts
      const districtList = rawDt.map((d: any) => {
        const sId = String(d.state_id !== undefined && d.state_id !== null ? d.state_id : (d.stateId || ''));
        const parentState = stateMap.get(normalizeId(sId));
        return {
          ...d,
          id: String(d.id),
          name: d.name || '',
          stateId: sId,
          stateName: d.state_name || d.stateName || parentState?.name || '',
          population: Number(d.population || 0),
          constituencyCount: d.constituencyCount !== undefined ? Number(d.constituencyCount) : (d.constituency_count !== undefined ? Number(d.constituency_count) : undefined),
        };
      });
      const districtMap = new Map(districtList.map((d: any) => [normalizeId(d.id), d]));

      // 3. Map constituencies
      const constList = rawCt.map((c: any) => {
        const dId = String(c.district_id !== undefined && c.district_id !== null ? c.district_id : (c.districtId || ''));
        const parentDist = districtMap.get(normalizeId(dId));
        const rawStateId = String(c.state_id !== undefined && c.state_id !== null ? c.state_id : (c.stateId || parentDist?.stateId || ''));
        const parentState = stateMap.get(normalizeId(rawStateId));
        return {
          ...c,
          id: String(c.id),
          name: c.name || '',
          stateId: rawStateId,
          stateName: c.state_name || c.stateName || parentState?.name || parentDist?.stateName || '',
          districtId: dId,
          districtName: c.district_name || c.districtName || parentDist?.name || '',
          category: c.category || c.seat_category || c.seat_type || 'General',
          population: Number(c.population || 0),
          boothCount: c.boothCount !== undefined ? Number(c.boothCount) : (c.booth_count !== undefined ? Number(c.booth_count) : undefined),
        };
      });
      const constMap = new Map(constList.map((c: any) => [normalizeId(c.id), c]));

      // 4. Map blocks / mandals
      const blockList = rawBlk.map((m: any) => {
        const cId = String(m.constituency_id !== undefined && m.constituency_id !== null ? m.constituency_id : (m.constituencyId || ''));
        const parentConst = constMap.get(normalizeId(cId));
        const rawDistId = String(m.district_id !== undefined && m.district_id !== null ? m.district_id : (m.districtId || parentConst?.districtId || ''));
        const parentDist = districtMap.get(normalizeId(rawDistId));
        const rawStateId = String(m.state_id !== undefined && m.state_id !== null ? m.state_id : (m.stateId || parentConst?.stateId || parentDist?.stateId || ''));
        const parentState = stateMap.get(normalizeId(rawStateId));
        return {
          ...m,
          id: String(m.id),
          name: m.name || '',
          code: m.mandal_code || m.mandalCode || m.code || '',
          mandalCode: m.mandal_code || m.mandalCode || m.code || '',
          stateId: rawStateId,
          stateName: m.state_name || m.stateName || parentState?.name || parentConst?.stateName || parentDist?.stateName || '',
          districtId: rawDistId,
          districtName: m.district_name || m.districtName || parentDist?.name || parentConst?.districtName || '',
          constituencyId: cId,
          constituencyName: m.constituency_name || m.constituencyName || parentConst?.name || '',
          population: Number(m.population || 0),
        };
      });
      const mandalMap = new Map(blockList.map((m: any) => [normalizeId(m.id), m]));

      // 5. Map panchayats
      const panList = rawPan.map((p: any) => {
        const mId = String(p.mandal_id !== undefined && p.mandal_id !== null ? p.mandal_id : (p.mandalId || ''));
        const parentMandal = mandalMap.get(normalizeId(mId));
        const cId = String(p.constituency_id !== undefined && p.constituency_id !== null ? p.constituency_id : (p.constituencyId || parentMandal?.constituencyId || ''));
        const parentConst = constMap.get(normalizeId(cId));
        const dId = String(p.district_id !== undefined && p.district_id !== null ? p.district_id : (p.districtId || parentMandal?.districtId || parentConst?.districtId || ''));
        const parentDist = districtMap.get(normalizeId(dId));
        const sId = String(p.state_id !== undefined && p.state_id !== null ? p.state_id : (p.stateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || ''));
        const parentState = stateMap.get(normalizeId(sId));
        return {
          ...p,
          id: String(p.id),
          name: p.name || '',
          code: p.panchayat_code || p.code || '',
          type: p.panchayat_type || p.type || 'Gram Panchayat',
          mandalId: mId,
          mandalName: p.mandal_name || p.mandalName || parentMandal?.name || '',
          constituencyId: cId,
          constituencyName: p.constituency_name || p.constituencyName || parentConst?.name || '',
          districtId: dId,
          districtName: p.district_name || p.districtName || parentDist?.name || '',
          stateId: sId,
          stateName: p.state_name || p.stateName || parentState?.name || '',
          population: Number(p.population || 0),
        };
      });
      const panMap = new Map(panList.map((p: any) => [normalizeId(p.id), p]));

      // 6. Map wards
      const wardList = rawWrd.map((w: any) => {
        const pId = String(w.panchayat_id !== undefined && w.panchayat_id !== null ? w.panchayat_id : (w.panchayatId || ''));
        const parentPan = panMap.get(normalizeId(pId));
        const mId = String(w.mandal_id !== undefined && w.mandal_id !== null ? w.mandal_id : (w.mandalId || parentPan?.mandalId || ''));
        const parentMandal = mandalMap.get(normalizeId(mId));
        const cId = String(w.constituency_id !== undefined && w.constituency_id !== null ? w.constituency_id : (w.constituencyId || parentPan?.constituencyId || parentMandal?.constituencyId || ''));
        const parentConst = constMap.get(normalizeId(cId));
        const dId = String(w.district_id !== undefined && w.district_id !== null ? w.district_id : (w.districtId || parentPan?.districtId || parentConst?.districtId || ''));
        const parentDist = districtMap.get(normalizeId(dId));
        const sId = String(w.state_id !== undefined && w.state_id !== null ? w.state_id : (w.stateId || parentPan?.stateId || parentConst?.stateId || parentDist?.stateId || ''));
        const parentState = stateMap.get(normalizeId(sId));
        return {
          ...w,
          id: String(w.id),
          name: w.name || '',
          wardNumber: String(w.ward_number || w.wardNumber || ''),
          type: w.ward_type || w.type || 'Ward',
          panchayatId: pId,
          panchayatName: w.panchayat_name || w.panchayatName || parentPan?.name || '',
          mandalId: mId,
          mandalName: w.mandal_name || w.mandalName || parentMandal?.name || '',
          constituencyId: cId,
          constituencyName: w.constituency_name || w.constituencyName || parentConst?.name || '',
          districtId: dId,
          districtName: w.district_name || w.districtName || parentDist?.name || '',
          stateId: sId,
          stateName: w.state_name || w.stateName || parentState?.name || '',
          population: Number(w.population || 0),
        };
      });
      const wardMap = new Map(wardList.map((w: any) => [normalizeId(w.id), w]));

      // 7. Map booths
      const boothList = rawBth.map((b: any) => {
        const rawWardId = String(b.ward_id !== undefined && b.ward_id !== null ? b.ward_id : (b.wardId || ''));
        const matchedWard = wardMap.get(normalizeId(rawWardId));
        const rawPanId = String(b.panchayat_id !== undefined && b.panchayat_id !== null ? b.panchayat_id : (b.panchayatId || matchedWard?.panchayatId || ''));
        const matchedPan = panMap.get(normalizeId(rawPanId));
        const rawMandalId = String(b.mandal_id !== undefined && b.mandal_id !== null ? b.mandal_id : (b.mandalId || matchedPan?.mandalId || matchedWard?.mandalId || ''));
        const matchedMandal = mandalMap.get(normalizeId(rawMandalId));
        const rawConstId = String(b.constituency_id !== undefined && b.constituency_id !== null ? b.constituency_id : (b.constituencyId || matchedMandal?.constituencyId || matchedPan?.constituencyId || matchedWard?.constituencyId || ''));
        const matchedConst = constMap.get(normalizeId(rawConstId));
        const rawDistId = String(b.district_id !== undefined && b.district_id !== null ? b.district_id : (b.districtId || matchedConst?.districtId || matchedMandal?.districtId || matchedPan?.districtId || ''));
        const parentDist = districtMap.get(normalizeId(rawDistId));
        const rawStateId = String(b.state_id !== undefined && b.state_id !== null ? b.state_id : (b.stateId || matchedConst?.stateId || parentDist?.stateId || ''));
        const parentState = stateMap.get(normalizeId(rawStateId));
        const vCount = b.voter_count !== undefined ? Number(b.voter_count) : (b.total_voters !== undefined ? Number(b.total_voters) : (Number(b.totalVoters) || Number(b.population) || 0));

        return {
          ...b,
          id: String(b.id),
          name: b.name || '',
          boothNumber: String(b.booth_number !== undefined ? b.booth_number : (b.boothNumber || '')),
          boothLabel: b.booth_label || b.boothLabel || '',
          address: b.address || '',
          totalVoters: vCount,
          population: vCount,
          stateId: rawStateId,
          stateName: b.state_name || b.stateName || parentState?.name || '',
          districtId: rawDistId,
          districtName: b.district_name || b.districtName || parentDist?.name || '',
          constituencyId: rawConstId,
          constituencyName: b.constituency_name || matchedConst?.name || '',
          mandalId: rawMandalId,
          mandalName: b.mandal_name || b.mandalName || matchedMandal?.name || '',
          panchayatId: rawPanId,
          panchayatName: b.panchayat_name || b.panchayatName || matchedPan?.name || '',
          wardId: rawWardId,
          wardName: b.ward_name || b.wardName || matchedWard?.name || ''
        };
      });

      setStates(stateList);
      setDistricts(districtList);
      setConstituencies(constList);
      setBlocks(blockList);
      setPanchayats(panList);
      setWards(wardList);
      setBooths(boothList);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to fetch demographic hierarchy.');
    } finally {
      setLoading(false);
    }
  };

  const fetchStates = () => fetchAllData(false);
  const fetchDistricts = () => fetchAllData(false);
  const fetchConstituencies = () => fetchAllData(false);
  const fetchBlocks = () => fetchAllData(false);
  const fetchPanchayats = () => fetchAllData(false);
  const fetchWards = () => fetchAllData(false);
  const fetchBooths = () => fetchAllData(false);

  // Load all demographic levels on mount
  useEffect(() => {
    fetchAllData(true);
  }, []);

  // Modal cascading loaders
  useEffect(() => {
    if (!formData.stateId) {
      setModalDistricts([]);
      return;
    }
    api.get<IndiaDistrict[]>(`/api/districts?stateId=${formData.stateId}`)
      .then(d => setModalDistricts(d.map((x: any) => ({ ...x, id: String(x.id), stateId: String(x.state_id || x.stateId || '') }))))
      .catch(console.error);
  }, [formData.stateId]);

  useEffect(() => {
    if (!formData.districtId) {
      setModalConstituencies([]);
      return;
    }
    api.get<IndiaConstituency[]>(`/api/constituencies?districtId=${formData.districtId}`)
      .then(c => setModalConstituencies(c.map((x: any) => ({ ...x, id: String(x.id), stateId: String(x.state_id || x.stateId || ''), districtId: String(x.district_id || x.districtId || '') }))))
      .catch(console.error);
  }, [formData.districtId]);

  useEffect(() => {
    if (!formData.constituencyId) {
      setModalBlocks([]);
      return;
    }
    api.get<any[]>(`/api/mandals?constituencyId=${formData.constituencyId}`)
      .then(m => setModalBlocks(m.map((x: any) => ({ ...x, id: String(x.id) }))))
      .catch(console.error);
  }, [formData.constituencyId]);

  useEffect(() => {
    if (!formData.mandalId) {
      setModalPanchayats([]);
      return;
    }
    api.get<any[]>(`/api/panchayats?mandalId=${formData.mandalId}`)
      .then(p => setModalPanchayats(p.map((x: any) => ({ ...x, id: String(x.id) }))))
      .catch(console.error);
  }, [formData.mandalId]);

  useEffect(() => {
    if (!formData.panchayatId) {
      setModalWards([]);
      return;
    }
    api.get<any[]>(`/api/wards?panchayatId=${formData.panchayatId}`)
      .then(w => setModalWards(w.map((x: any) => ({ ...x, id: String(x.id) }))))
      .catch(console.error);
  }, [formData.panchayatId]);

  const handleModalStateChange = (stateId: string) => {
    setFormData(prev => ({
      ...prev,
      stateId,
      districtId: '',
      constituencyId: '',
      mandalId: '',
      panchayatId: '',
      wardId: ''
    }));
  };

  const handleModalDistrictChange = (districtId: string) => {
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(districtId));
    const effectiveStateId = parentDist?.stateId || formData.stateId;
    setFormData(prev => ({
      ...prev,
      districtId,
      stateId: effectiveStateId,
      constituencyId: '',
      mandalId: '',
      panchayatId: '',
      wardId: ''
    }));
  };

  const handleModalConstituencyChange = (constituencyId: string) => {
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(constituencyId));
    const effectiveDistrictId = parentConst?.districtId || formData.districtId;
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistrictId));
    const effectiveStateId = parentConst?.stateId || parentDist?.stateId || formData.stateId;
    setFormData(prev => ({
      ...prev,
      constituencyId,
      districtId: effectiveDistrictId,
      stateId: effectiveStateId,
      mandalId: '',
      panchayatId: '',
      wardId: ''
    }));
  };

  const handleModalBlockChange = (mandalId: string) => {
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(mandalId));
    const effectiveConstId = parentMandal?.constituencyId || formData.constituencyId;
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
    const effectiveDistrictId = parentMandal?.districtId || parentConst?.districtId || formData.districtId;
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistrictId));
    const effectiveStateId = parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || formData.stateId;
    setFormData(prev => ({
      ...prev,
      mandalId,
      constituencyId: effectiveConstId,
      districtId: effectiveDistrictId,
      stateId: effectiveStateId,
      panchayatId: '',
      wardId: ''
    }));
  };

  // Quick Bulk Paste / Multi-Add Modal State
  const [isBulkPasteModalOpen, setIsBulkPasteModalOpen] = useState(false);
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [bulkParentStateId, setBulkParentStateId] = useState('');
  const [bulkParentDistrictId, setBulkParentDistrictId] = useState('');
  const [bulkParentConstituencyId, setBulkParentConstituencyId] = useState('');
  const [bulkParentMandalId, setBulkParentMandalId] = useState('');
  const [bulkParentPanchayatId, setBulkParentPanchayatId] = useState('');
  const [bulkParentWardId, setBulkParentWardId] = useState('');
  const [bulkItemType, setBulkItemType] = useState('Gram Panchayat');
  const [bulkItemCategory, setBulkItemCategory] = useState('General');
  const [bulkStartingNumber, setBulkStartingNumber] = useState<number>(1);
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);

  const handleBulkStateChange = (stateId: string) => {
    setBulkParentStateId(stateId);
    setBulkParentDistrictId('');
    setBulkParentConstituencyId('');
    setBulkParentMandalId('');
    setBulkParentPanchayatId('');
    setBulkParentWardId('');
  };

  const handleBulkDistrictChange = (districtId: string) => {
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(districtId));
    setBulkParentDistrictId(districtId);
    if (parentDist?.stateId) setBulkParentStateId(parentDist.stateId);
    setBulkParentConstituencyId('');
    setBulkParentMandalId('');
    setBulkParentPanchayatId('');
    setBulkParentWardId('');
  };

  const handleBulkConstituencyChange = (constituencyId: string) => {
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(constituencyId));
    const effectiveDistrictId = parentConst?.districtId || bulkParentDistrictId;
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistrictId));
    setBulkParentConstituencyId(constituencyId);
    if (effectiveDistrictId) setBulkParentDistrictId(effectiveDistrictId);
    if (parentConst?.stateId || parentDist?.stateId) setBulkParentStateId(parentConst?.stateId || parentDist?.stateId || bulkParentStateId);
    setBulkParentMandalId('');
    setBulkParentPanchayatId('');
    setBulkParentWardId('');
  };

  const handleBulkBlockChange = (mandalId: string) => {
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(mandalId));
    const effectiveConstId = parentMandal?.constituencyId || bulkParentConstituencyId;
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
    const effectiveDistrictId = parentMandal?.districtId || parentConst?.districtId || bulkParentDistrictId;
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistrictId));
    setBulkParentMandalId(mandalId);
    if (effectiveConstId) setBulkParentConstituencyId(effectiveConstId);
    if (effectiveDistrictId) setBulkParentDistrictId(effectiveDistrictId);
    if (parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId) setBulkParentStateId(parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || bulkParentStateId);
    setBulkParentPanchayatId('');
    setBulkParentWardId('');
  };

  const handleBulkPanchayatChange = (panchayatId: string) => {
    const parentPan = panchayats.find(p => normalizeId(p.id) === normalizeId(panchayatId));
    const effectiveMandalId = parentPan?.mandalId || bulkParentMandalId;
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(effectiveMandalId));
    const effectiveConstId = parentPan?.constituencyId || parentMandal?.constituencyId || bulkParentConstituencyId;
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
    const effectiveDistrictId = parentPan?.districtId || parentMandal?.districtId || parentConst?.districtId || bulkParentDistrictId;
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistrictId));
    setBulkParentPanchayatId(panchayatId);
    if (effectiveMandalId) setBulkParentMandalId(effectiveMandalId);
    if (effectiveConstId) setBulkParentConstituencyId(effectiveConstId);
    if (effectiveDistrictId) setBulkParentDistrictId(effectiveDistrictId);
    if (parentPan?.stateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId) setBulkParentStateId(parentPan?.stateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || bulkParentStateId);
    setBulkParentWardId('');
  };

  const parsedBulkItems = useMemo(() => {
    if (!bulkPasteText.trim()) return [];
    const lines = bulkPasteText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    
    return lines.map((line, idx) => {
      const cleanLine = line.replace(/^\d+[\.\)\-]\s*/, '').trim();
      if (!cleanLine) return null;

      if (activeTab === 'booths') {
        const parts = cleanLine.split(/,|\t| - /).map(s => s.trim()).filter(Boolean);
        let bNum = '';
        let bName = cleanLine;
        let bAddress = '';
        
        if (parts.length >= 2 && (/^\d+[A-Za-z\-]*$/.test(parts[0]) || !isNaN(Number(parts[0])))) {
          bNum = parts[0];
          bName = parts[1];
          bAddress = parts.slice(2).join(', ');
        } else {
          bNum = String((Number(bulkStartingNumber) || 1) + idx);
          bName = cleanLine;
        }
        return {
          boothNumber: bNum,
          name: bName,
          boothLabel: '',
          address: bAddress,
          population: 0
        };
      }

      if (activeTab === 'wards') {
        const parts = cleanLine.split(/,|\t/).map(s => s.trim()).filter(Boolean);
        let wNum = '';
        let wName = cleanLine;
        if (parts.length >= 2) {
          wNum = parts[0];
          wName = parts[1];
        } else {
          const match = cleanLine.match(/\b(?:ward|village|unit)?\s*(?:no\.?|#)?\s*(\d+[A-Za-z]?)\b/i);
          if (match) {
            wNum = match[1];
          } else {
            wNum = String(idx + 1);
          }
        }
        return {
          name: wName,
          wardNumber: wNum,
          type: bulkItemType || 'Ward',
          population: 0
        };
      }

      if (activeTab === 'panchayats') {
        const parts = cleanLine.split(/,|\t/).map(s => s.trim()).filter(Boolean);
        let pCode = '';
        let pName = cleanLine;
        if (parts.length >= 2) {
          if (parts[0].length <= 10 && (parts[0].includes('-') || !isNaN(Number(parts[0])))) {
            pCode = parts[0].toUpperCase();
            pName = parts[1];
          } else {
            pName = parts[0];
            pCode = parts[1].toUpperCase();
          }
        }
        return {
          name: pName,
          code: pCode,
          type: bulkItemType || 'Gram Panchayat',
          population: 0
        };
      }

      if (activeTab === 'blocks') {
        const parts = cleanLine.split(/,|\t/).map(s => s.trim()).filter(Boolean);
        let bCode = '';
        let bName = cleanLine;
        if (parts.length >= 2) {
          bCode = parts[0].toUpperCase();
          bName = parts[1];
        }
        return {
          name: bName,
          code: bCode,
          population: 0
        };
      }

      if (activeTab === 'constituencies') {
        const parts = cleanLine.split(/,|\t/).map(s => s.trim()).filter(Boolean);
        return {
          name: parts[0] || cleanLine,
          category: parts[1] || bulkItemCategory || 'General',
          population: 0
        };
      }

      return {
        name: cleanLine,
        code: cleanLine.substring(0, 3).toUpperCase(),
        population: 0
      };
    }).filter(Boolean) as any[];
  }, [bulkPasteText, activeTab, bulkItemType, bulkItemCategory, bulkStartingNumber]);

  const openBulkPasteModal = () => {
    const initialMandalId = selectedBlockId !== 'all' ? selectedBlockId : '';
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(initialMandalId));
    const initialConstId = selectedConstituencyId !== 'all' ? selectedConstituencyId : (parentMandal?.constituencyId || '');
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(initialConstId));
    const initialDistId = selectedDistrictId !== 'all' ? selectedDistrictId : (parentMandal?.districtId || parentConst?.districtId || '');
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(initialDistId));
    const initialStateId = selectedStateId !== 'all' ? selectedStateId : (parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || states[0]?.id || '');
    const initialPanId = selectedPanchayatId !== 'all' ? selectedPanchayatId : '';
    const initialWardId = selectedWardId !== 'all' ? selectedWardId : '';

    setBulkParentStateId(initialStateId);
    setBulkParentDistrictId(initialDistId);
    setBulkParentConstituencyId(initialConstId);
    setBulkParentMandalId(initialMandalId);
    setBulkParentPanchayatId(initialPanId);
    setBulkParentWardId(initialWardId);
    setBulkPasteText('');
    setBulkItemType(activeTab === 'panchayats' ? 'Gram Panchayat' : activeTab === 'wards' ? 'Ward' : '');
    setBulkItemCategory('General');
    setBulkStartingNumber(1);
    setIsBulkPasteModalOpen(true);
  };

  const handleExecuteBulkPaste = async () => {
    if (!parsedBulkItems || parsedBulkItems.length === 0) {
      setError('Please paste at least one item name.');
      return;
    }

    if (activeTab === 'districts' && !bulkParentStateId) {
      setError('Please select a parent state.');
      return;
    }
    if (activeTab === 'constituencies' && !bulkParentDistrictId) {
      setError('Please select a parent district.');
      return;
    }
    if (activeTab === 'blocks' && !bulkParentConstituencyId) {
      setError('Please select a parent constituency.');
      return;
    }
    if (activeTab === 'panchayats' && !bulkParentConstituencyId && !bulkParentMandalId && !bulkParentDistrictId) {
      setError('Please select at least a parent district or constituency.');
      return;
    }
    if (activeTab === 'wards' && !bulkParentPanchayatId && !bulkParentMandalId && !bulkParentConstituencyId) {
      setError('Please select a parent Local Body / Panchayat or Block.');
      return;
    }
    if (activeTab === 'booths' && !bulkParentConstituencyId) {
      setError('Please select a parent constituency.');
      return;
    }

    setActionLoading(true);
    setError('');
    setBulkProgress({ current: 0, total: parsedBulkItems.length });

    try {
      api.invalidateCache();
      const itemsToSave = parsedBulkItems;
      let successCount = 0;

      const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(bulkParentMandalId));
      const parentPan = panchayats.find(p => normalizeId(p.id) === normalizeId(bulkParentPanchayatId));
      const effectiveConstId = bulkParentConstituencyId || parentMandal?.constituencyId || parentPan?.constituencyId || '';
      const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
      const effectiveDistId = bulkParentDistrictId || parentMandal?.districtId || parentConst?.districtId || parentPan?.districtId || '';
      const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistId));
      const effectiveStateId = bulkParentStateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || parentPan?.stateId || states[0]?.id || '';

      const chunkSize = 5;
      for (let i = 0; i < itemsToSave.length; i += chunkSize) {
        const chunk = itemsToSave.slice(i, i + chunkSize);
        await Promise.all(chunk.map(async (item: any) => {
          if (activeTab === 'panchayats') {
            await api.post('/api/panchayats', {
              name: item.name,
              code: item.code || null,
              type: item.type || bulkItemType || 'Gram Panchayat',
              mandal_id: bulkParentMandalId ? (!isNaN(Number(bulkParentMandalId)) ? Number(bulkParentMandalId) : bulkParentMandalId) : null,
              constituency_id: effectiveConstId ? (!isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId) : null,
              district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
              state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
              population: 0
            });
          } else if (activeTab === 'wards') {
            await api.post('/api/wards', {
              name: item.name,
              ward_number: item.wardNumber || '',
              type: item.type || bulkItemType || 'Ward',
              panchayat_id: bulkParentPanchayatId ? (!isNaN(Number(bulkParentPanchayatId)) ? Number(bulkParentPanchayatId) : bulkParentPanchayatId) : null,
              mandal_id: bulkParentMandalId ? (!isNaN(Number(bulkParentMandalId)) ? Number(bulkParentMandalId) : bulkParentMandalId) : null,
              constituency_id: effectiveConstId ? (!isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId) : null,
              district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
              state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
              population: 0
            });
          } else if (activeTab === 'booths') {
            await api.post('/api/booths', {
              name: item.name,
              booth_number: item.boothNumber,
              booth_label: item.boothLabel || '',
              address: item.address || '',
              constituency_id: !isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId,
              mandal_id: bulkParentMandalId ? (!isNaN(Number(bulkParentMandalId)) ? Number(bulkParentMandalId) : bulkParentMandalId) : null,
              panchayat_id: bulkParentPanchayatId ? (!isNaN(Number(bulkParentPanchayatId)) ? Number(bulkParentPanchayatId) : bulkParentPanchayatId) : null,
              ward_id: bulkParentWardId ? (!isNaN(Number(bulkParentWardId)) ? Number(bulkParentWardId) : bulkParentWardId) : null,
              state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
              district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
              total_voters: 0
            });
          } else if (activeTab === 'blocks') {
            const bCode = item.code || item.name.substring(0, 3).toUpperCase();
            await api.post('/api/mandals', {
              name: item.name,
              mandal_code: bCode,
              code: bCode,
              constituency_id: !isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId,
              district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
              state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
              population: 0
            });
          } else if (activeTab === 'constituencies') {
            await api.post('/api/constituencies', {
              name: item.name,
              district_id: !isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId,
              state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
              category: item.category || bulkItemCategory || 'General',
              population: 0
            });
          }
          successCount++;
          setBulkProgress({ current: successCount, total: itemsToSave.length });
        }));
      }

      api.invalidateCache();
      setSuccessMessage(`Successfully added ${successCount} ${getTabPlural(activeTab)}!`);

      if (effectiveStateId) setSelectedStateId(String(effectiveStateId));
      if (effectiveDistId) setSelectedDistrictId(String(effectiveDistId));
      if (effectiveConstId) setSelectedConstituencyId(String(effectiveConstId));
      if (bulkParentMandalId) setSelectedBlockId(String(bulkParentMandalId));
      if (bulkParentPanchayatId) setSelectedPanchayatId(String(bulkParentPanchayatId));
      setSearchTerm('');

      await fetchAllData(false);
      setIsBulkPasteModalOpen(false);
      setBulkPasteText('');
      setTimeout(() => setSuccessMessage(''), 6000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to complete bulk addition.');
    } finally {
      setActionLoading(false);
      setBulkProgress(null);
    }
  };

  const openEditModal = (item: any) => {
    setEditingItem(item);
    const itemMandalId = item.mandalId || item.mandal_id || (selectedBlockId !== 'all' ? selectedBlockId : '');
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(itemMandalId));
    const itemConstituencyId = item.constituencyId || item.constituency_id || parentMandal?.constituencyId || (selectedConstituencyId !== 'all' ? selectedConstituencyId : '');
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(itemConstituencyId));
    const itemDistrictId = item.districtId || item.district_id || parentMandal?.districtId || parentConst?.districtId || (selectedDistrictId !== 'all' ? selectedDistrictId : '');
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(itemDistrictId));
    const itemStateId = item.stateId || item.state_id || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || (selectedStateId !== 'all' ? selectedStateId : (states[0]?.id || ''));
    const itemPanchayatId = item.panchayatId || item.panchayat_id || (selectedPanchayatId !== 'all' ? selectedPanchayatId : '');
    const itemWardId = item.wardId || item.ward_id || (selectedWardId !== 'all' ? selectedWardId : '');

    setFormData({
      name: item.name || '',
      code: item.code || item.mandalCode || item.mandal_code || item.panchayat_code || '',
      type: item.type || item.panchayat_type || item.ward_type || (activeTab === 'panchayats' ? 'Gram Panchayat' : activeTab === 'wards' ? 'Ward' : ''),
      category: item.category || 'General',
      wardNumber: item.wardNumber || item.ward_number || '',
      boothNumber: item.boothNumber !== undefined ? String(item.boothNumber) : (item.booth_number !== undefined ? String(item.booth_number) : ''),
      boothLabel: item.boothLabel || item.booth_label || '',
      address: item.address || '',
      population: item.totalVoters !== undefined ? Number(item.totalVoters) : (item.total_voters !== undefined ? Number(item.total_voters) : (item.population || 0)),
      stateId: String(itemStateId || ''),
      districtId: String(itemDistrictId || ''),
      constituencyId: String(itemConstituencyId || ''),
      mandalId: String(itemMandalId || ''),
      panchayatId: String(itemPanchayatId || ''),
      wardId: String(itemWardId || ''),
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingItem(null);
    const initialMandalId = selectedBlockId !== 'all' ? selectedBlockId : '';
    const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(initialMandalId));
    const initialConstId = selectedConstituencyId !== 'all' ? selectedConstituencyId : (parentMandal?.constituencyId || '');
    const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(initialConstId));
    const initialDistId = selectedDistrictId !== 'all' ? selectedDistrictId : (parentMandal?.districtId || parentConst?.districtId || '');
    const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(initialDistId));
    const initialStateId = selectedStateId !== 'all' ? selectedStateId : (parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || states[0]?.id || '');
    const initialPanId = selectedPanchayatId !== 'all' ? selectedPanchayatId : '';
    const initialWardId = selectedWardId !== 'all' ? selectedWardId : '';

    setFormData({
      name: '',
      code: '',
      type: activeTab === 'panchayats' ? 'Gram Panchayat' : activeTab === 'wards' ? 'Ward' : '',
      category: 'General',
      wardNumber: '',
      population: 0,
      stateId: initialStateId,
      districtId: initialDistId,
      constituencyId: initialConstId,
      mandalId: initialMandalId,
      panchayatId: initialPanId,
      wardId: initialWardId,
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
      api.invalidateCache();
      if (activeTab === 'states') {
        const payload = {
          name: formData.name.trim(),
          code: formData.code.trim().toUpperCase(),
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/states/${editingItem.id}`, payload);
        } else {
          await api.post('/api/states', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`State ${formData.name} saved successfully.`);
        setSearchTerm('');
        await fetchAllData(false);
      } else if (activeTab === 'districts') {
        if (!formData.stateId) throw new Error('Please select a parent state.');
        const payload = {
          name: formData.name.trim(),
          state_id: !isNaN(Number(formData.stateId)) ? Number(formData.stateId) : formData.stateId,
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/districts/${editingItem.id}`, payload);
        } else {
          await api.post('/api/districts', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`District ${formData.name} saved successfully.`);
        if (formData.stateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(formData.stateId)) {
          setSelectedStateId(String(formData.stateId));
        }
        setSearchTerm('');
        await fetchAllData(false);
      } else if (activeTab === 'constituencies') {
        if (!formData.districtId) throw new Error('Please select a parent district.');
        const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(formData.districtId));
        const effectiveStateId = formData.stateId || parentDist?.stateId || null;
        const payload = {
          name: formData.name.trim(),
          state_id: effectiveStateId || null,
          stateId: effectiveStateId || null,
          district_id: formData.districtId || parentDist?.id || null,
          districtId: formData.districtId || parentDist?.id || null,
          category: formData.category || 'General',
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/constituencies/${editingItem.id}`, payload);
        } else {
          await api.post('/api/constituencies', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`Constituency ${formData.name} saved successfully.`);
        if (effectiveStateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(effectiveStateId)) {
          setSelectedStateId(String(effectiveStateId));
        }
        if (formData.districtId && selectedDistrictId !== 'all' && normalizeId(selectedDistrictId) !== normalizeId(formData.districtId)) {
          setSelectedDistrictId(String(formData.districtId));
        }
        setSearchTerm('');
        await fetchAllData(false);
      } else if (activeTab === 'blocks') {
        if (!formData.constituencyId) throw new Error('Please select a parent constituency.');
        const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(formData.constituencyId));
        const effectiveDistId = formData.districtId || parentConst?.districtId || null;
        const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistId));
        const effectiveStateId = formData.stateId || parentConst?.stateId || parentDist?.stateId || null;
        const blockCode = (formData.code.trim() || formData.name.trim().substring(0, 3)).toUpperCase();

        const payload = {
          name: formData.name.trim(),
          mandal_code: blockCode,
          code: blockCode,
          constituency_id: !isNaN(Number(formData.constituencyId)) ? Number(formData.constituencyId) : formData.constituencyId,
          district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
          state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/mandals/${editingItem.id}`, payload);
        } else {
          await api.post('/api/mandals', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`Block / Area ${formData.name} saved successfully.`);
        if (effectiveStateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(effectiveStateId)) {
          setSelectedStateId(String(effectiveStateId));
        }
        if (effectiveDistId && selectedDistrictId !== 'all' && normalizeId(selectedDistrictId) !== normalizeId(effectiveDistId)) {
          setSelectedDistrictId(String(effectiveDistId));
        }
        if (formData.constituencyId && selectedConstituencyId !== 'all' && normalizeId(selectedConstituencyId) !== normalizeId(formData.constituencyId)) {
          setSelectedConstituencyId(String(formData.constituencyId));
        }
        setSearchTerm('');
        await fetchAllData(false);
      } else if (activeTab === 'panchayats') {
        if (!formData.name.trim()) throw new Error('Please enter a name for the Local Body / Panchayat.');
        const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(formData.mandalId));
        const effectiveConstId = formData.constituencyId || parentMandal?.constituencyId || null;
        const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
        const effectiveDistId = formData.districtId || parentMandal?.districtId || parentConst?.districtId || null;
        const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistId));
        const effectiveStateId = formData.stateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || null;

        const payload = {
          name: formData.name.trim(),
          code: formData.code.trim() || null,
          type: formData.type || 'Gram Panchayat',
          mandal_id: formData.mandalId ? (!isNaN(Number(formData.mandalId)) ? Number(formData.mandalId) : formData.mandalId) : null,
          constituency_id: effectiveConstId ? (!isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId) : null,
          district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
          state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/panchayats/${editingItem.id}`, payload);
        } else {
          await api.post('/api/panchayats', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`Local Body ${formData.name} saved successfully.`);

        if (effectiveStateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(effectiveStateId)) {
          setSelectedStateId(String(effectiveStateId));
        }
        if (effectiveDistId && selectedDistrictId !== 'all' && normalizeId(selectedDistrictId) !== normalizeId(effectiveDistId)) {
          setSelectedDistrictId(String(effectiveDistId));
        }
        if (effectiveConstId && selectedConstituencyId !== 'all' && normalizeId(selectedConstituencyId) !== normalizeId(effectiveConstId)) {
          setSelectedConstituencyId(String(effectiveConstId));
        }
        if (formData.mandalId && selectedBlockId !== 'all' && normalizeId(selectedBlockId) !== normalizeId(formData.mandalId)) {
          setSelectedBlockId(String(formData.mandalId));
        } else if (!formData.mandalId && selectedBlockId !== 'all') {
          setSelectedBlockId('all');
        }
        setSearchTerm('');
        await fetchAllData(false);
      } else if (activeTab === 'wards') {
        if (!formData.panchayatId && !formData.mandalId && !formData.constituencyId) throw new Error('Please select a parent local body or block.');
        const parentPan = panchayats.find(p => normalizeId(p.id) === normalizeId(formData.panchayatId));
        const effectiveMandalId = formData.mandalId || parentPan?.mandalId || null;
        const parentMandal = blocks.find(b => normalizeId(b.id) === normalizeId(effectiveMandalId));
        const effectiveConstId = formData.constituencyId || parentPan?.constituencyId || parentMandal?.constituencyId || null;
        const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(effectiveConstId));
        const effectiveDistId = formData.districtId || parentPan?.districtId || parentMandal?.districtId || parentConst?.districtId || null;
        const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistId));
        const effectiveStateId = formData.stateId || parentPan?.stateId || parentMandal?.stateId || parentConst?.stateId || parentDist?.stateId || null;

        const payload = {
          name: formData.name.trim(),
          ward_number: formData.wardNumber.trim() || formData.code.trim(),
          type: formData.type || 'Ward',
          panchayat_id: formData.panchayatId ? (!isNaN(Number(formData.panchayatId)) ? Number(formData.panchayatId) : formData.panchayatId) : null,
          mandal_id: effectiveMandalId ? (!isNaN(Number(effectiveMandalId)) ? Number(effectiveMandalId) : effectiveMandalId) : null,
          constituency_id: effectiveConstId ? (!isNaN(Number(effectiveConstId)) ? Number(effectiveConstId) : effectiveConstId) : null,
          district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
          state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
          population: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/wards/${editingItem.id}`, payload);
        } else {
          await api.post('/api/wards', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`Ward / Village ${formData.name} saved successfully.`);

        if (effectiveStateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(effectiveStateId)) {
          setSelectedStateId(String(effectiveStateId));
        }
        if (effectiveDistId && selectedDistrictId !== 'all' && normalizeId(selectedDistrictId) !== normalizeId(effectiveDistId)) {
          setSelectedDistrictId(String(effectiveDistId));
        }
        if (effectiveConstId && selectedConstituencyId !== 'all' && normalizeId(selectedConstituencyId) !== normalizeId(effectiveConstId)) {
          setSelectedConstituencyId(String(effectiveConstId));
        }
        if (effectiveMandalId && selectedBlockId !== 'all' && normalizeId(selectedBlockId) !== normalizeId(effectiveMandalId)) {
          setSelectedBlockId(String(effectiveMandalId));
        }
        if (formData.panchayatId && selectedPanchayatId !== 'all' && normalizeId(selectedPanchayatId) !== normalizeId(formData.panchayatId)) {
          setSelectedPanchayatId(String(formData.panchayatId));
        }
        setSearchTerm('');
        await fetchAllData(false);
      } else {
        if (!formData.constituencyId) throw new Error('Please select a parent constituency.');
        const parentConst = constituencies.find(c => normalizeId(c.id) === normalizeId(formData.constituencyId));
        const effectiveDistId = formData.districtId || parentConst?.districtId || null;
        const parentDist = districts.find(d => normalizeId(d.id) === normalizeId(effectiveDistId));
        const effectiveStateId = formData.stateId || parentConst?.stateId || parentDist?.stateId || null;

        const payload = {
          name: formData.name.trim() || `Booth #${formData.boothNumber.trim()}`,
          booth_number: formData.boothNumber.trim(),
          booth_label: formData.boothLabel.trim(),
          address: formData.address.trim(),
          state_id: effectiveStateId ? (!isNaN(Number(effectiveStateId)) ? Number(effectiveStateId) : effectiveStateId) : null,
          district_id: effectiveDistId ? (!isNaN(Number(effectiveDistId)) ? Number(effectiveDistId) : effectiveDistId) : null,
          constituency_id: !isNaN(Number(formData.constituencyId)) ? Number(formData.constituencyId) : formData.constituencyId,
          mandal_id: formData.mandalId ? (!isNaN(Number(formData.mandalId)) ? Number(formData.mandalId) : formData.mandalId) : null,
          panchayat_id: formData.panchayatId ? (!isNaN(Number(formData.panchayatId)) ? Number(formData.panchayatId) : formData.panchayatId) : null,
          ward_id: formData.wardId ? (!isNaN(Number(formData.wardId)) ? Number(formData.wardId) : formData.wardId) : null,
          total_voters: Number(formData.population) || 0,
        };
        if (editingItem?.id) {
          await api.put(`/api/booths/${editingItem.id}`, payload);
        } else {
          await api.post('/api/booths', payload);
        }
        api.invalidateCache();
        setSuccessMessage(`Booth ${formData.name || formData.boothNumber} saved successfully.`);

        if (effectiveStateId && selectedStateId !== 'all' && normalizeId(selectedStateId) !== normalizeId(effectiveStateId)) {
          setSelectedStateId(String(effectiveStateId));
        }
        if (effectiveDistId && selectedDistrictId !== 'all' && normalizeId(selectedDistrictId) !== normalizeId(effectiveDistId)) {
          setSelectedDistrictId(String(effectiveDistId));
        }
        if (formData.constituencyId && selectedConstituencyId !== 'all' && normalizeId(selectedConstituencyId) !== normalizeId(formData.constituencyId)) {
          setSelectedConstituencyId(String(formData.constituencyId));
        }
        setSearchTerm('');
        await fetchAllData(false);
      }
      setIsModalOpen(false);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save demographic item.');
    } finally {
      setActionLoading(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (itemId: string, itemName: string) => {
    setActionLoading(true);
    setError('');
    
    try {
      api.invalidateCache();
      if (activeTab === 'states') {
        await api.delete(`/api/states/${itemId}`);
        setStates(prev => prev.filter(s => s.id !== itemId));
      } else if (activeTab === 'districts') {
        await api.delete(`/api/districts/${itemId}`);
        setDistricts(prev => prev.filter(d => d.id !== itemId));
      } else if (activeTab === 'constituencies') {
        await api.delete(`/api/constituencies/${itemId}`);
        setConstituencies(prev => prev.filter(c => c.id !== itemId));
      } else if (activeTab === 'blocks') {
        await api.delete(`/api/mandals/${itemId}`);
        setBlocks(prev => prev.filter(b => b.id !== itemId));
      } else if (activeTab === 'panchayats') {
        await api.delete(`/api/panchayats/${itemId}`);
        setPanchayats(prev => prev.filter(p => p.id !== itemId));
      } else if (activeTab === 'wards') {
        await api.delete(`/api/wards/${itemId}`);
        setWards(prev => prev.filter(w => w.id !== itemId));
      } else if (activeTab === 'booths') {
        await api.delete(`/api/booths/${itemId}`);
        setBooths(prev => prev.filter(b => b.id !== itemId));
      }
      setSuccessMessage(`${itemName} removed successfully.`);
      setDeletingId(null);
      setTimeout(() => setSuccessMessage(''), 5000);
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || `Failed to delete ${itemName}.`);
    } finally {
      setActionLoading(false);
    }
  };

  // Profile scope checks
  const electSettings = profile?.election_settings || profile?.electionSettings || {};
  const rawState = profile?.stateId || profile?.state_id || electSettings.state_id || electSettings.stateId || '';
  const rawDistrict = profile?.districtId || profile?.district_id || electSettings.district_id || electSettings.districtId || '';
  const rawConstituency = profile?.constituencyId || profile?.constituency_id || electSettings.constituency_id || electSettings.constituencyId || '';
  const rawBooth = profile?.boothId || profile?.booth_id || electSettings.booth_id || electSettings.boothId || '';
  const rawAssignedBooths = profile?.assigned_booths || electSettings.assigned_booths || [];

  const isSuperUser = isSuperAdmin || 
                      (user?.email || profile?.email || '').toLowerCase().trim() === 'vijaychauhanofficial01@gmail.com' || 
                      profile?.role === 'super_admin' || 
                      profile?.role === 'admin';

  const cleanScopeFilter = (raw: any): string[] => {
    if (!raw) return [];
    return String(raw)
      .split(',')
      .map(s => s.trim())
      .filter(s => s && !['all', 'ALL', '*', 'null', 'undefined', '[]', '0'].includes(s));
  };

  const allowedStateIds = !isSuperUser ? cleanScopeFilter(rawState) : [];
  const allowedDistrictIds = !isSuperUser ? cleanScopeFilter(rawDistrict) : [];
  const allowedConstituencyIds = !isSuperUser ? cleanScopeFilter(rawConstituency) : [];
  const allowedBoothIds = !isSuperUser
    ? (rawBooth 
        ? cleanScopeFilter(rawBooth) 
        : (Array.isArray(rawAssignedBooths) 
            ? rawAssignedBooths.map(String).map(s => s.trim()).filter(s => s && !['all', 'ALL', '*', 'null', 'undefined', '[]', '0'].includes(s)) 
            : []))
    : [];

  const hasRestrictedScope = !isSuperUser && (
    allowedBoothIds.length > 0 ||
    allowedConstituencyIds.length > 0 ||
    allowedDistrictIds.length > 0 ||
    allowedStateIds.length > 0
  );

  const isItemInScope = (allowedList: string[], id: any, name?: string, code?: string) => {
    if (allowedList.length === 0) return true;
    const nId = normalizeId(id);
    return allowedList.some(item => {
      const nItem = normalizeId(item);
      return nItem === nId || 
             (name && item.toLowerCase() === name.toLowerCase()) || 
             (code && item.toLowerCase() === code.toLowerCase());
    });
  };

  const getFilteredData = (): DemographicItem[] => {
    const search = searchTerm.trim().toLowerCase();

    if (activeTab === 'states') {
      return states.filter(s => {
        const matchesSearch = !search || s.name.toLowerCase().includes(search) || (s.code && s.code.toLowerCase().includes(search));
        if (!hasRestrictedScope || allowedStateIds.length === 0) return matchesSearch;
        const matchesScope = isItemInScope(allowedStateIds, s.id, s.name, s.code);
        return matchesSearch && matchesScope;
      });
    }

    if (activeTab === 'districts') {
      return districts.filter(d => {
        const matchesState = selectedStateId === 'all' || normalizeId(d.stateId) === normalizeId(selectedStateId);
        const matchesSearch = !search || d.name.toLowerCase().includes(search) || (d.stateName && d.stateName.toLowerCase().includes(search));
        if (!hasRestrictedScope) return matchesState && matchesSearch;
        const matchesScope = isItemInScope(allowedDistrictIds, d.id, d.name) &&
                             isItemInScope(allowedStateIds, d.stateId, d.stateName);
        return matchesState && matchesSearch && matchesScope;
      });
    }

    if (activeTab === 'constituencies') {
      return constituencies.filter(c => {
        const matchesState = selectedStateId === 'all' || normalizeId(c.stateId) === normalizeId(selectedStateId);
        const matchesDistrict = selectedDistrictId === 'all' || normalizeId(c.districtId) === normalizeId(selectedDistrictId);
        const matchesSearch = !search || c.name.toLowerCase().includes(search) || (c.districtName && c.districtName.toLowerCase().includes(search)) || (c.category && c.category.toLowerCase().includes(search));
        if (!hasRestrictedScope) return matchesState && matchesDistrict && matchesSearch;
        const matchesScope = isItemInScope(allowedConstituencyIds, c.id, c.name) &&
                             isItemInScope(allowedDistrictIds, c.districtId, c.districtName) &&
                             isItemInScope(allowedStateIds, c.stateId);
        return matchesState && matchesDistrict && matchesSearch && matchesScope;
      });
    }

    if (activeTab === 'blocks') {
      return blocks.filter(b => {
        const matchesState = selectedStateId === 'all' || normalizeId(b.stateId) === normalizeId(selectedStateId);
        const matchesDistrict = selectedDistrictId === 'all' || normalizeId(b.districtId) === normalizeId(selectedDistrictId);
        const matchesConstituency = selectedConstituencyId === 'all' || normalizeId(b.constituencyId) === normalizeId(selectedConstituencyId);
        const matchesSearch = !search || b.name.toLowerCase().includes(search) || (b.mandalCode && b.mandalCode.toLowerCase().includes(search)) || (b.constituencyName && b.constituencyName.toLowerCase().includes(search)) || (b.districtName && b.districtName.toLowerCase().includes(search));
        if (!hasRestrictedScope) return matchesState && matchesDistrict && matchesConstituency && matchesSearch;
        const matchesScope = isItemInScope(allowedConstituencyIds, b.constituencyId) &&
                             isItemInScope(allowedDistrictIds, b.districtId) &&
                             isItemInScope(allowedStateIds, b.stateId);
        return matchesState && matchesDistrict && matchesConstituency && matchesSearch && matchesScope;
      });
    }

    if (activeTab === 'panchayats') {
      return panchayats.filter(p => {
        const matchesState = selectedStateId === 'all' || normalizeId(p.stateId) === normalizeId(selectedStateId);
        const matchesDistrict = selectedDistrictId === 'all' || normalizeId(p.districtId) === normalizeId(selectedDistrictId);
        const matchesConstituency = selectedConstituencyId === 'all' || normalizeId(p.constituencyId) === normalizeId(selectedConstituencyId);
        const matchesBlock = selectedBlockId === 'all' || normalizeId(p.mandalId) === normalizeId(selectedBlockId);
        const matchesSearch = !search || p.name.toLowerCase().includes(search) || (p.code && p.code.toLowerCase().includes(search)) || (p.type && p.type.toLowerCase().includes(search)) || (p.mandalName && p.mandalName.toLowerCase().includes(search));
        if (!hasRestrictedScope) return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesSearch;
        const matchesScope = isItemInScope(allowedConstituencyIds, p.constituencyId) &&
                             isItemInScope(allowedDistrictIds, p.districtId) &&
                             isItemInScope(allowedStateIds, p.stateId);
        return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesSearch && matchesScope;
      });
    }

    if (activeTab === 'wards') {
      return wards.filter(w => {
        const matchesState = selectedStateId === 'all' || normalizeId(w.stateId) === normalizeId(selectedStateId);
        const matchesDistrict = selectedDistrictId === 'all' || normalizeId(w.districtId) === normalizeId(selectedDistrictId);
        const matchesConstituency = selectedConstituencyId === 'all' || normalizeId(w.constituencyId) === normalizeId(selectedConstituencyId);
        const matchesBlock = selectedBlockId === 'all' || normalizeId(w.mandalId) === normalizeId(selectedBlockId);
        const matchesPanchayat = selectedPanchayatId === 'all' || normalizeId(w.panchayatId) === normalizeId(selectedPanchayatId);
        const matchesSearch = !search || w.name.toLowerCase().includes(search) || (w.wardNumber && w.wardNumber.toLowerCase().includes(search)) || (w.panchayatName && w.panchayatName.toLowerCase().includes(search)) || (w.mandalName && w.mandalName.toLowerCase().includes(search));
        if (!hasRestrictedScope) return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesPanchayat && matchesSearch;
        const matchesScope = isItemInScope(allowedConstituencyIds, w.constituencyId) &&
                             isItemInScope(allowedDistrictIds, w.districtId) &&
                             isItemInScope(allowedStateIds, w.stateId);
        return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesPanchayat && matchesSearch && matchesScope;
      });
    }

    return booths.filter(b => {
      const matchesState = selectedStateId === 'all' || normalizeId(b.stateId) === normalizeId(selectedStateId);
      const matchesDistrict = selectedDistrictId === 'all' || normalizeId(b.districtId) === normalizeId(selectedDistrictId);
      const matchesConstituency = selectedConstituencyId === 'all' || normalizeId(b.constituencyId) === normalizeId(selectedConstituencyId);
      const matchesBlock = selectedBlockId === 'all' || normalizeId(b.mandalId) === normalizeId(selectedBlockId);
      const matchesPanchayat = selectedPanchayatId === 'all' || normalizeId(b.panchayatId) === normalizeId(selectedPanchayatId);
      const matchesWard = selectedWardId === 'all' || normalizeId(b.wardId) === normalizeId(selectedWardId);
      const matchesSearch = !search || b.name.toLowerCase().includes(search) || b.boothNumber.toLowerCase().includes(search) || (b.constituencyName && b.constituencyName.toLowerCase().includes(search)) || (b.mandalName && b.mandalName.toLowerCase().includes(search)) || (b.panchayatName && b.panchayatName.toLowerCase().includes(search)) || (b.wardName && b.wardName.toLowerCase().includes(search)) || (b.address && b.address.toLowerCase().includes(search));
      if (!hasRestrictedScope) return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesPanchayat && matchesWard && matchesSearch;
      const matchesScope = isItemInScope(allowedBoothIds, b.id, b.name, b.boothNumber) &&
                           isItemInScope(allowedConstituencyIds, b.constituencyId, b.constituencyName) &&
                           isItemInScope(allowedDistrictIds, b.districtId, b.districtName) &&
                           isItemInScope(allowedStateIds, b.stateId);
      return matchesState && matchesDistrict && matchesConstituency && matchesBlock && matchesPanchayat && matchesWard && matchesSearch && matchesScope;
    });
  };

  const filteredData = getFilteredData();

  const isAnyFilterActive = selectedStateId !== 'all' || selectedDistrictId !== 'all' || selectedConstituencyId !== 'all' || selectedBlockId !== 'all' || selectedPanchayatId !== 'all' || selectedWardId !== 'all' || searchTerm.trim() !== '';

  const resetAllFilters = () => {
    setSelectedStateId('all');
    setSelectedDistrictId('all');
    setSelectedConstituencyId('all');
    setSelectedBlockId('all');
    setSelectedPanchayatId('all');
    setSelectedWardId('all');
    setSearchTerm('');
  };

  const getTabLabel = (tab: DemographicTab) => {
    switch (tab) {
      case 'states': return 'State';
      case 'districts': return 'District';
      case 'constituencies': return 'Constituency';
      case 'blocks': return 'Block / Area';
      case 'panchayats': return 'Panchayat / MC / ULB';
      case 'wards': return 'Ward / Village';
      case 'booths': return 'Polling Booth';
    }
  };

  const getTabPlural = (tab: DemographicTab) => {
    switch (tab) {
      case 'states': return 'States';
      case 'districts': return 'Districts';
      case 'constituencies': return 'Constituencies';
      case 'blocks': return 'Blocks / Areas';
      case 'panchayats': return 'Panchayats / ULBs';
      case 'wards': return 'Wards / Villages';
      case 'booths': return 'Polling Booths';
    }
  };

  return (
    <div className="space-y-6 w-full animate-in fade-in duration-500">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeletingId(null)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white dark:bg-zinc-950 p-6 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-sm w-full text-center">
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-600 mx-auto mb-4">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2">Are you sure?</h3>
              <p className="text-zinc-500 text-sm mb-6">This will permanently remove the record from the demographic registry and decouple linked units.</p>
              <div className="flex gap-3">
                <button onClick={() => setDeletingId(null)} className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all">Cancel</button>
                <button 
                  onClick={() => {
                    const item = filteredData.find(x => x.id === deletingId);
                    if (item) handleDelete(item.id, item.name || item.boothNumber || 'Item');
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

      {/* Header & 7-Sequence Tabs */}
      <div className="flex flex-col gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Demographics
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Manage States, Districts, Constituencies, Blocks/Areas, Panchayats/ULBs, Wards/Villages, and Polling Booths.
            </p>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            {hasRight('demographics', 'c') && (
              <button 
                onClick={() => openBulkPasteModal()}
                className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center gap-1.5 shadow-sm shadow-blue-500/20 text-xs font-bold whitespace-nowrap cursor-pointer transition-all active:scale-95"
                title={`Quickly paste and batch add multiple ${getTabPlural(activeTab).toLowerCase()}`}
              >
                <Sparkles size={14} className="text-amber-300 animate-pulse" />
                <span>Quick Bulk Add</span>
              </button>
            )}

            {hasRight('demographics', 'c') && (
              <button 
                onClick={() => openCreateModal()}
                className="webapp-button-primary h-10 px-4 flex items-center justify-center gap-2 shadow-sm text-xs font-semibold whitespace-nowrap"
              >
                <Plus size={16} /> Add {getTabLabel(activeTab)}
              </button>
            )}
          </div>
        </div>

        {/* 7-Level Sequence Navigation Tabs */}
        <div className="bg-zinc-100 dark:bg-zinc-900 p-1.5 rounded-2xl flex border border-zinc-200 dark:border-zinc-800 overflow-x-auto custom-scrollbar-hide whitespace-nowrap gap-1">
          <button 
            onClick={() => setActiveTab('states')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'states' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Flag size={13} />
            <span>1. States</span>
          </button>
          <button 
            onClick={() => setActiveTab('districts')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'districts' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <MapPin size={13} />
            <span>2. Districts</span>
          </button>
          <button 
            onClick={() => setActiveTab('constituencies')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'constituencies' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Globe size={13} />
            <span>3. Constituencies</span>
          </button>
          <button 
            onClick={() => setActiveTab('blocks')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'blocks' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Layers size={13} />
            <span>4. Blocks / Areas</span>
          </button>
          <button 
            onClick={() => setActiveTab('panchayats')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'panchayats' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Landmark size={13} />
            <span>5. Panchayats / MC / ULB</span>
          </button>
          <button 
            onClick={() => setActiveTab('wards')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'wards' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <Home size={13} />
            <span>6. Wards / Villages</span>
          </button>
          <button 
            onClick={() => setActiveTab('booths')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'booths' ? 'bg-white dark:bg-zinc-800 text-blue-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'}`}
          >
            <FileSpreadsheet size={13} />
            <span>7. Booths</span>
          </button>
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
        {/* Filter bar */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row justify-between gap-4 items-stretch sm:items-center bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center w-full sm:w-auto flex-wrap">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={14} />
              <input 
                type="text" 
                placeholder={`Search ${getTabPlural(activeTab)}...`} 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="webapp-input w-full pl-9 h-9 text-xs"
              />
            </div>
            
            {activeTab !== 'states' && (
              <select 
                value={selectedStateId}
                onChange={(e) => {
                  setSelectedStateId(e.target.value);
                  setSelectedDistrictId('all');
                  setSelectedConstituencyId('all');
                  setSelectedBlockId('all');
                  setSelectedPanchayatId('all');
                  setSelectedWardId('all');
                }}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-32"
              >
                <option value="all">All States</option>
                {states.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}

            {(activeTab === 'constituencies' || activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
              <select 
                value={selectedDistrictId}
                onChange={(e) => {
                  setSelectedDistrictId(e.target.value);
                  setSelectedConstituencyId('all');
                  setSelectedBlockId('all');
                  setSelectedPanchayatId('all');
                  setSelectedWardId('all');
                }}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-32"
              >
                <option value="all">All Districts</option>
                {districts.filter(d => selectedStateId === 'all' || normalizeId(d.stateId) === normalizeId(selectedStateId)).map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}

            {(activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
              <select 
                value={selectedConstituencyId}
                onChange={(e) => {
                  setSelectedConstituencyId(e.target.value);
                  setSelectedBlockId('all');
                  setSelectedPanchayatId('all');
                  setSelectedWardId('all');
                }}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-36"
              >
                <option value="all">All Constituencies</option>
                {constituencies.filter(c => (selectedDistrictId === 'all' || normalizeId(c.districtId) === normalizeId(selectedDistrictId)) && (selectedStateId === 'all' || normalizeId(c.stateId) === normalizeId(selectedStateId))).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}

            {(activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
              <select 
                value={selectedBlockId}
                onChange={(e) => {
                  setSelectedBlockId(e.target.value);
                  setSelectedPanchayatId('all');
                  setSelectedWardId('all');
                }}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-32"
              >
                <option value="all">All Blocks / Areas</option>
                {blocks.filter(b => (selectedConstituencyId === 'all' || normalizeId(b.constituencyId) === normalizeId(selectedConstituencyId)) && (selectedDistrictId === 'all' || normalizeId(b.districtId) === normalizeId(selectedDistrictId)) && (selectedStateId === 'all' || normalizeId(b.stateId) === normalizeId(selectedStateId))).map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}

            {(activeTab === 'wards' || activeTab === 'booths') && (
              <select 
                value={selectedPanchayatId}
                onChange={(e) => {
                  setSelectedPanchayatId(e.target.value);
                  setSelectedWardId('all');
                }}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-36"
              >
                <option value="all">All Panchayats/ULBs</option>
                {panchayats.filter(p => (selectedBlockId === 'all' || normalizeId(p.mandalId) === normalizeId(selectedBlockId)) && (selectedConstituencyId === 'all' || normalizeId(p.constituencyId) === normalizeId(selectedConstituencyId)) && (selectedDistrictId === 'all' || normalizeId(p.districtId) === normalizeId(selectedDistrictId)) && (selectedStateId === 'all' || normalizeId(p.stateId) === normalizeId(selectedStateId))).map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}

            {activeTab === 'booths' && (
              <select 
                value={selectedWardId}
                onChange={(e) => setSelectedWardId(e.target.value)}
                className="webapp-input h-9 text-xs py-0 w-full sm:w-32"
              >
                <option value="all">All Wards</option>
                {wards.filter(w => (selectedPanchayatId === 'all' || normalizeId(w.panchayatId) === normalizeId(selectedPanchayatId)) && (selectedBlockId === 'all' || normalizeId(w.mandalId) === normalizeId(selectedBlockId)) && (selectedConstituencyId === 'all' || normalizeId(w.constituencyId) === normalizeId(selectedConstituencyId)) && (selectedDistrictId === 'all' || normalizeId(w.districtId) === normalizeId(selectedDistrictId)) && (selectedStateId === 'all' || normalizeId(w.stateId) === normalizeId(selectedStateId))).map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}

            {isAnyFilterActive && (
              <button
                onClick={resetAllFilters}
                className="h-9 px-3 rounded-xl bg-zinc-200/60 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                title="Reset all filters to Show All"
              >
                <X size={12} />
                <span>Reset Filters</span>
              </button>
            )}
          </div>

          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest hidden sm:block whitespace-nowrap">
            Found {filteredData.length} Records
          </p>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto hidden sm:block">
          <table className="w-full text-left border-collapse min-w-[850px] whitespace-nowrap">
            <thead>
              <tr className="bg-zinc-50/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-2.5 data-label">{activeTab === 'booths' ? 'Booth No.' : 'Administrative Unit'}</th>
                {activeTab === 'districts' && <th className="px-4 py-2.5 data-label">Parent State</th>}
                {activeTab === 'constituencies' && <th className="px-4 py-2.5 data-label">Parent District</th>}
                {activeTab === 'constituencies' && <th className="px-4 py-2.5 data-label text-center">Seat Category</th>}
                {activeTab === 'blocks' && <th className="px-4 py-2.5 data-label">Parent Constituency</th>}
                {activeTab === 'blocks' && <th className="px-4 py-2.5 data-label text-center">Block Code</th>}
                {activeTab === 'panchayats' && <th className="px-4 py-2.5 data-label">Local Body Type</th>}
                {activeTab === 'panchayats' && <th className="px-4 py-2.5 data-label">Parent Block/Area</th>}
                {activeTab === 'wards' && <th className="px-4 py-2.5 data-label">Ward / Village Type</th>}
                {activeTab === 'wards' && <th className="px-4 py-2.5 data-label">Parent Panchayat/ULB</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Booth Name</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Constituency</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Block / Area</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Panchayat / ULB</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Ward / Village</th>}
                {activeTab === 'booths' && <th className="px-4 py-2.5 data-label">Address</th>}
                
                {/* Child Count Column */}
                {activeTab === 'states' && <th className="px-4 py-2.5 data-label text-center">Districts</th>}
                {activeTab === 'districts' && <th className="px-4 py-2.5 data-label text-center">Constituencies</th>}
                {activeTab === 'constituencies' && <th className="px-4 py-2.5 data-label text-center">Blocks</th>}
                {activeTab === 'blocks' && <th className="px-4 py-2.5 data-label text-center">Panchayats</th>}
                {activeTab === 'panchayats' && <th className="px-4 py-2.5 data-label text-center">Wards</th>}
                {activeTab === 'wards' && <th className="px-4 py-2.5 data-label text-center">Booths</th>}

                {activeTab === 'states' && <th className="px-4 py-2.5 data-label text-center">State Code</th>}
                <th className="px-4 py-2.5 data-label text-right">{activeTab === 'booths' ? 'Total Voters' : 'Population (Est.)'}</th>
                <th className="px-4 py-2.5 data-label text-right">Management</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center">
                    <Loader2 size={24} className="animate-spin mx-auto text-zinc-300 dark:text-zinc-700 mb-2" />
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-400 opacity-50">Syncing Administrative Hierarchy...</p>
                  </td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-16 text-center text-zinc-400">
                    <div className="max-w-md mx-auto space-y-3">
                      <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                          No {getTabPlural(activeTab)} Found
                        </p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                          {isAnyFilterActive 
                            ? `No records match the active filter criteria for ${getTabPlural(activeTab)}.`
                            : `No ${getTabPlural(activeTab)} have been registered in the database yet.`}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                        {isAnyFilterActive && (
                          <button
                            onClick={resetAllFilters}
                            className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                          >
                            <X size={13} />
                            <span>Reset Filters</span>
                          </button>
                        )}
                        {hasRight('demographics', 'c') && (
                          <button
                            onClick={openBulkPasteModal}
                            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                          >
                            <Sparkles size={13} className="text-amber-300" />
                            <span>Bulk Paste & Add</span>
                          </button>
                        )}
                        {hasRight('demographics', 'c') && (
                          <button
                            onClick={openCreateModal}
                            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20 cursor-pointer"
                          >
                            <Plus size={13} />
                            <span>Add Single {getTabLabel(activeTab)}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/40 transition-colors group">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/5 text-blue-600 flex items-center justify-center border border-blue-500/10 shrink-0">
                          {activeTab === 'states' && <Flag size={14} />}
                          {activeTab === 'districts' && <MapPin size={14} />}
                          {activeTab === 'constituencies' && <Globe size={14} />}
                          {activeTab === 'blocks' && <Layers size={14} />}
                          {activeTab === 'panchayats' && <Landmark size={14} />}
                          {activeTab === 'wards' && <Home size={14} />}
                          {activeTab === 'booths' && <FileSpreadsheet size={14} />}
                        </div>
                        <div>
                          {activeTab === 'booths' ? (
                            <span className="font-bold text-blue-600 text-xs">#{item.boothNumber}</span>
                          ) : (
                            <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[160px] block" title={item.name}>{item.name}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {activeTab === 'districts' && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                          <Flag size={11} className="text-zinc-300 shrink-0" />
                          <span className="truncate">{item.stateName || states.find(s => normalizeId(s.id) === normalizeId(item.stateId))?.name || '-'}</span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'constituencies' && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                          <MapPin size={11} className="text-zinc-300 shrink-0" />
                          <span className="truncate">{item.districtName || districts.find(d => normalizeId(d.id) === normalizeId(item.districtId))?.name || '-'}</span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'constituencies' && (
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black tracking-wider uppercase border bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                          {item.category || 'General'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'blocks' && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                          <Globe size={11} className="text-blue-500 shrink-0" />
                          <span className="truncate">{item.constituencyName || constituencies.find(c => normalizeId(c.id) === normalizeId(item.constituencyId))?.name || '-'}</span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'blocks' && (
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                          {item.code || item.mandalCode || '-'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'panchayats' && (
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
                          {item.type || 'Gram Panchayat'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'panchayats' && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                          <Layers size={11} className="text-indigo-500 shrink-0" />
                          <span className="truncate">{item.mandalName || blocks.find(b => normalizeId(b.id) === normalizeId(item.mandalId))?.name || '-'}</span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'wards' && (
                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {item.type || 'Ward'} #{item.wardNumber || ''}
                        </span>
                      </td>
                    )}

                    {activeTab === 'wards' && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400 truncate max-w-[150px]">
                          <Landmark size={11} className="text-amber-500 shrink-0" />
                          <span className="truncate">{item.panchayatName || panchayats.find(p => normalizeId(p.id) === normalizeId(item.panchayatId))?.name || '-'}</span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-zinc-900 dark:text-zinc-100 text-xs truncate max-w-[160px] block" title={item.name}>{item.name}</span>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 truncate max-w-[130px] block">
                          {item.constituencyName || constituencies.find(c => normalizeId(c.id) === normalizeId(item.constituencyId))?.name || '-'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[120px] block">
                          {item.mandalName || blocks.find(b => normalizeId(b.id) === normalizeId(item.mandalId))?.name || '-'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[120px] block">
                          {item.panchayatName || panchayats.find(p => normalizeId(p.id) === normalizeId(item.panchayatId))?.name || '-'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5">
                        <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[110px] block">
                          {item.wardName || wards.find(w => normalizeId(w.id) === normalizeId(item.wardId))?.name || '-'}
                        </span>
                      </td>
                    )}

                    {activeTab === 'booths' && (
                      <td className="px-4 py-2.5 max-w-[160px]">
                        <div className="text-xs text-zinc-500 dark:text-zinc-400 truncate" title={item.address}>
                          {item.address || <span className="italic text-zinc-400">-</span>}
                        </div>
                      </td>
                    )}

                    {/* Hierarchy Counter Badges */}
                    {activeTab !== 'booths' && (
                      <td className="px-4 py-2.5 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border bg-zinc-50 dark:bg-zinc-800/60 text-zinc-700 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700">
                          <span>
                            {activeTab === 'states' && getDistrictCount(item)}
                            {activeTab === 'districts' && getConstituencyCount(item)}
                            {activeTab === 'constituencies' && getBlockCount(item)}
                            {activeTab === 'blocks' && getPanchayatCount(item)}
                            {activeTab === 'panchayats' && getWardCount(item)}
                            {activeTab === 'wards' && getBoothCount(item, 'ward')}
                          </span>
                          <span className="opacity-75 font-semibold text-[10px] uppercase tracking-wider">
                            {activeTab === 'states' && 'Districts'}
                            {activeTab === 'districts' && 'Const.'}
                            {activeTab === 'constituencies' && 'Blocks'}
                            {activeTab === 'blocks' && 'Panchayats'}
                            {activeTab === 'panchayats' && 'Wards'}
                            {activeTab === 'wards' && 'Booths'}
                          </span>
                        </div>
                      </td>
                    )}

                    {activeTab === 'states' && (
                      <td className="px-4 py-2.5 text-center">
                        <span className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] font-bold text-zinc-600 dark:text-zinc-400 border border-zinc-200/50 dark:border-zinc-700">
                          {item.code || '-'}
                        </span>
                      </td>
                    )}

                    <td className="px-4 py-2.5 text-right font-mono text-xs font-semibold">
                      {activeTab === 'booths' ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 font-bold border border-blue-200 dark:border-blue-900/40">
                          {getVoterCount(item).toLocaleString()} Voters
                        </span>
                      ) : (
                        <span className="text-zinc-500 dark:text-zinc-400">
                          {Number(item.population || 0) > 0 ? Number(item.population).toLocaleString() : '-'}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-2.5 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5">
                        {hasRight('demographics', 'u') && (
                          <button 
                            onClick={() => openEditModal(item)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                            title="Edit"
                          >
                            <Edit2 size={12} />
                            <span>Edit</span>
                          </button>
                        )}
                        {hasRight('demographics', 'd') && (
                          <button 
                            onClick={() => setDeletingId(item.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                            <span>Delete</span>
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

        {/* Mobile View */}
        <div className="block sm:hidden divide-y divide-zinc-100 dark:divide-zinc-800/50">
          {loading ? (
            <div className="py-20 text-center">
              <Loader2 size={24} className="animate-spin mx-auto text-zinc-300 mb-2" />
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 opacity-50">Syncing...</p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="py-16 text-center text-zinc-400 p-6 space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 flex items-center justify-center mx-auto">
                <MapPin size={24} />
              </div>
              <div>
                <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                  No {getTabPlural(activeTab)} Found
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                  {isAnyFilterActive 
                    ? `No records match the active filter criteria for ${getTabPlural(activeTab)}.`
                    : `No ${getTabPlural(activeTab)} have been registered in the database yet.`}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2 flex-wrap">
                {isAnyFilterActive && (
                  <button
                    onClick={resetAllFilters}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <X size={13} />
                    <span>Reset Filters</span>
                  </button>
                )}
                {hasRight('demographics', 'c') && (
                  <button
                    onClick={openCreateModal}
                    className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm shadow-blue-500/20"
                  >
                    <Plus size={13} />
                    <span>Add {getTabLabel(activeTab)}</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            filteredData.map((item) => (
              <div key={item.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/5 text-blue-600 flex items-center justify-center border border-blue-500/10 shrink-0">
                      {activeTab === 'states' && <Flag size={18} />}
                      {activeTab === 'districts' && <MapPin size={18} />}
                      {activeTab === 'constituencies' && <Globe size={18} />}
                      {activeTab === 'blocks' && <Layers size={18} />}
                      {activeTab === 'panchayats' && <Landmark size={18} />}
                      {activeTab === 'wards' && <Home size={18} />}
                      {activeTab === 'booths' && <FileSpreadsheet size={18} />}
                    </div>
                    <div>
                      {activeTab === 'booths' ? (
                        <div className="font-black text-blue-600 text-sm">#{item.boothNumber} - {item.name}</div>
                      ) : (
                        <div className="font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                          {item.name}
                        </div>
                      )}
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tight">
                        {[item.wardName, item.panchayatName, item.mandalName, item.constituencyName, item.districtName, item.stateName].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {hasRight('demographics', 'u') && (
                      <button onClick={() => openEditModal(item)} className="p-2 text-zinc-400 hover:text-blue-600 rounded-lg">
                        <Edit2 size={16} />
                      </button>
                    )}
                    {hasRight('demographics', 'd') && (
                      <button onClick={() => setDeletingId(item.id)} className="p-2 text-zinc-400 hover:text-red-600 rounded-lg">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Bulk Import Modal */}
      <BulkImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          if (activeTab === 'booths') fetchBooths();
          else if (activeTab === 'blocks') fetchBlocks();
          else if (activeTab === 'panchayats') fetchPanchayats();
          else if (activeTab === 'wards') fetchWards();
        }}
        initialStateId={selectedStateId !== 'all' ? selectedStateId : ''}
        initialDistrictId={selectedDistrictId !== 'all' ? selectedDistrictId : ''}
        initialConstituencyId={selectedConstituencyId !== 'all' ? selectedConstituencyId : ''}
        states={states}
      />

      {/* Add / Edit Hierarchical Modal */}
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
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {editingItem ? `Update ${getTabLabel(activeTab)}` : `New ${getTabLabel(activeTab)} Entry`}
                  </h3>
                  <p className="text-[10px] text-zinc-500 font-black uppercase tracking-widest mt-1">
                    Administrative & Demographic Hierarchy
                  </p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-all">
                  <X size={20} />
                </button>
              </div>
              
              <form onSubmit={handleCreateOrUpdate} className="flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                  <div className="space-y-1.5">
                    <label className="data-label">Official Name</label>
                    <input 
                      type="text" 
                      required 
                      value={formData.name} 
                      onChange={e => setFormData({ ...formData, name: e.target.value })} 
                      className="webapp-input w-full h-10 text-sm font-medium"
                      placeholder={`e.g. ${activeTab === 'states' ? 'Maharashtra' : activeTab === 'districts' ? 'Mumbai' : activeTab === 'constituencies' ? 'Mumbai South' : activeTab === 'blocks' ? 'Andheri Block' : activeTab === 'panchayats' ? 'Gram Panchayat Khed' : activeTab === 'wards' ? 'Ward 12' : 'Booth No. 15'}`}
                    />
                  </div>
                  
                  {/* Cascading Hierarchy Selectors */}
                  {activeTab !== 'states' && (
                    <div className="space-y-3 bg-zinc-50/70 dark:bg-zinc-900/60 p-4 rounded-xl border border-zinc-200/80 dark:border-zinc-800">
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mb-2">Interlinked Hierarchy</p>
                      
                      {/* State */}
                      <div className="space-y-1">
                        <label className="data-label">1. Parent State</label>
                        <select 
                          required
                          value={formData.stateId}
                          onChange={e => handleModalStateChange(e.target.value)}
                          className="webapp-input w-full h-10 text-sm"
                        >
                          <option value="" disabled>Select parent state</option>
                          {states.map(s => (
                            <option key={s.id} value={s.id}>{s.name} ({s.code})</option>
                          ))}
                        </select>
                      </div>

                      {/* District */}
                      {(activeTab === 'constituencies' || activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                        <div className="space-y-1">
                          <label className="data-label">2. Parent District</label>
                          <select 
                            required
                            value={formData.districtId}
                            onChange={e => handleModalDistrictChange(e.target.value)}
                            className="webapp-input w-full h-10 text-sm"
                          >
                            <option value="" disabled>Select parent district</option>
                            {districts
                              .filter(d => !formData.stateId || normalizeId(d.stateId) === normalizeId(formData.stateId))
                              .map(d => (
                                <option key={d.id} value={d.id}>{d.name}</option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Constituency */}
                      {(activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                        <div className="space-y-1">
                          <label className="data-label">3. Parent Constituency</label>
                          <select 
                            required
                            value={formData.constituencyId}
                            onChange={e => handleModalConstituencyChange(e.target.value)}
                            className="webapp-input w-full h-10 text-sm"
                          >
                            <option value="" disabled>Select parent constituency</option>
                            {constituencies
                              .filter(c => (!formData.districtId || normalizeId(c.districtId) === normalizeId(formData.districtId)) && (!formData.stateId || normalizeId(c.stateId) === normalizeId(formData.stateId)))
                              .map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Block / Area */}
                      {(activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                        <div className="space-y-1">
                          <label className="data-label">4. Parent Block / Area (Mandal)</label>
                          <select 
                            value={formData.mandalId}
                            onChange={e => handleModalBlockChange(e.target.value)}
                            className="webapp-input w-full h-10 text-sm"
                          >
                            <option value="">Select Block / Area (Optional)</option>
                            {blocks
                              .filter(b => !formData.constituencyId || normalizeId(b.constituencyId) === normalizeId(formData.constituencyId))
                              .map(m => (
                                <option key={m.id} value={m.id}>{m.name} {m.mandal_code ? `(${m.mandal_code})` : ''}</option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Panchayat / MC / ULB */}
                      {(activeTab === 'wards' || activeTab === 'booths') && (
                        <div className="space-y-1">
                          <label className="data-label">5. Parent Panchayat / MC / ULB</label>
                          <select 
                            value={formData.panchayatId}
                            onChange={e => setFormData({ ...formData, panchayatId: e.target.value, wardId: '' })}
                            className="webapp-input w-full h-10 text-sm"
                          >
                            <option value="">Select Local Body / Panchayat (Optional)</option>
                            {panchayats
                              .filter(p => (!formData.mandalId || normalizeId(p.mandalId) === normalizeId(formData.mandalId)) && (!formData.constituencyId || normalizeId(p.constituencyId) === normalizeId(formData.constituencyId)))
                              .map(p => (
                                <option key={p.id} value={p.id}>{p.name} ({p.type || 'GP'})</option>
                              ))}
                          </select>
                        </div>
                      )}

                      {/* Ward / Village */}
                      {activeTab === 'booths' && (
                        <div className="space-y-1">
                          <label className="data-label">6. Parent Ward / Village</label>
                          <select 
                            value={formData.wardId}
                            onChange={e => setFormData({ ...formData, wardId: e.target.value })}
                            className="webapp-input w-full h-10 text-sm"
                          >
                            <option value="">Select Ward / Village (Optional)</option>
                            {(modalWards.length > 0 ? modalWards : wards.filter(w => !formData.panchayatId || normalizeId(w.panchayatId) === normalizeId(formData.panchayatId))).map(w => (
                              <option key={w.id} value={w.id}>{w.name} {w.wardNumber ? `(Ward #${w.wardNumber})` : ''}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Level Specific Attributes */}
                  {activeTab === 'states' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="data-label">State Code</label>
                        <input 
                          type="text" 
                          required 
                          maxLength={5}
                          value={formData.code} 
                          onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })} 
                          className="webapp-input w-full h-10 text-sm font-black uppercase"
                          placeholder="MH"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Population (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-10 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'districts' && (
                    <div className="space-y-1">
                      <label className="data-label">Population (Est.)</label>
                      <input 
                        type="number" 
                        value={formData.population} 
                        onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                        className="webapp-input w-full h-10 text-sm"
                        placeholder="0"
                      />
                    </div>
                  )}

                  {activeTab === 'constituencies' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="data-label">Seat Category</label>
                        <select
                          value={formData.category || 'General'}
                          onChange={e => setFormData({ ...formData, category: e.target.value })}
                          className="webapp-input w-full h-10 text-sm font-semibold"
                        >
                          <option value="General">General (GEN / Open)</option>
                          <option value="OBC">OBC</option>
                          <option value="SC">SC (Scheduled Caste)</option>
                          <option value="ST">ST (Scheduled Tribe)</option>
                          <option value="Other">Other</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Population (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-10 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'blocks' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="data-label">Block / Mandal Code</label>
                        <input 
                          type="text" 
                          value={formData.code} 
                          onChange={e => setFormData({ ...formData, code: e.target.value })} 
                          className="webapp-input w-full h-10 text-sm font-bold"
                          placeholder="e.g. BLK-01"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Population (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-10 text-sm"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'panchayats' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="data-label">Local Body Category</label>
                        <select
                          value={formData.type || 'Gram Panchayat'}
                          onChange={e => setFormData({ ...formData, type: e.target.value })}
                          className="webapp-input w-full h-10 text-sm font-semibold"
                        >
                          <option value="Gram Panchayat">Gram Panchayat (GP)</option>
                          <option value="Municipal Corporation">Municipal Corporation (MC)</option>
                          <option value="Municipality">Municipality (Nagar Palika)</option>
                          <option value="Nagar Panchayat">Nagar Panchayat</option>
                          <option value="Urban Local Body">Urban Local Body (ULB)</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Local Body Code</label>
                        <input 
                          type="text" 
                          value={formData.code} 
                          onChange={e => setFormData({ ...formData, code: e.target.value })} 
                          className="webapp-input w-full h-10 text-sm font-bold"
                          placeholder="e.g. GP-102"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'wards' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="data-label">Ward / Village Type</label>
                        <select
                          value={formData.type || 'Ward'}
                          onChange={e => setFormData({ ...formData, type: e.target.value })}
                          className="webapp-input w-full h-10 text-sm font-semibold"
                        >
                          <option value="Ward">Municipal Ward</option>
                          <option value="Village">Revenue Village</option>
                          <option value="Mohalla">Mohalla / Street</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Ward / Unit Number</label>
                        <input 
                          type="text" 
                          value={formData.wardNumber} 
                          onChange={e => setFormData({ ...formData, wardNumber: e.target.value })} 
                          className="webapp-input w-full h-10 text-sm font-bold"
                          placeholder="e.g. 14"
                        />
                      </div>
                    </div>
                  )}

                  {activeTab === 'booths' && (
                    <>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="data-label">Booth Number</label>
                          <input 
                            type="text" 
                            required 
                            value={formData.boothNumber} 
                            onChange={e => setFormData({ ...formData, boothNumber: e.target.value })} 
                            className="webapp-input w-full h-10 text-sm font-bold"
                            placeholder="e.g. 154"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="data-label">Booth Label (Optional)</label>
                          <input 
                            type="text" 
                            value={formData.boothLabel} 
                            onChange={e => setFormData({ ...formData, boothLabel: e.target.value })} 
                            className="webapp-input w-full h-10 text-sm"
                            placeholder="e.g. 154-A"
                          />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Total Registered Voters (Est.)</label>
                        <input 
                          type="number" 
                          value={formData.population} 
                          onChange={e => setFormData({ ...formData, population: Number(e.target.value) })} 
                          className="webapp-input w-full h-10 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="data-label">Full Address / Location</label>
                        <textarea 
                          value={formData.address} 
                          onChange={e => setFormData({ ...formData, address: e.target.value })} 
                          className="webapp-input w-full h-20 text-sm py-2"
                          placeholder="e.g. Primary School Room 4, Ground Floor, Near Main Chawk..."
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="webapp-button-secondary flex-1">Cancel</button>
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

      {/* Quick Bulk Paste / Multi-Add Modal */}
      <AnimatePresence>
        {isBulkPasteModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              onClick={() => !actionLoading && setIsBulkPasteModalOpen(false)} 
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ scale: 0.96, opacity: 0, y: 15 }} 
              animate={{ scale: 1, opacity: 1, y: 0 }} 
              exit={{ scale: 0.96, opacity: 0, y: 15 }} 
              className="relative bg-white dark:bg-zinc-950 rounded-[24px] border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden z-10"
            >
              {/* Header */}
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-gradient-to-r from-blue-500/5 via-indigo-500/5 to-purple-500/5 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
                    <Sparkles size={20} className="text-amber-300" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      Bulk Paste & Add {getTabPlural(activeTab)}
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
                        Fast Multi-Entry
                      </span>
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Copy-paste multiple names from Excel, Word, or text to create them all in one shot.
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => !actionLoading && setIsBulkPasteModalOpen(false)} 
                  disabled={actionLoading}
                  className="w-8 h-8 rounded-full flex items-center justify-center text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4 overflow-y-auto custom-scrollbar text-left flex-1">
                {/* 1. Target Hierarchy */}
                <div className="space-y-2 bg-zinc-50 dark:bg-zinc-900/50 p-3.5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800">
                  <p className="text-[11px] font-black uppercase text-zinc-500 tracking-wider flex items-center gap-1.5">
                    <Building2 size={13} className="text-blue-500" /> 1. Select Target Parent Hierarchy
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {/* State */}
                    {activeTab !== 'states' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">State</label>
                        <select 
                          value={bulkParentStateId}
                          onChange={e => handleBulkStateChange(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select State</option>
                          {states.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* District */}
                    {(activeTab === 'constituencies' || activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">District</label>
                        <select 
                          value={bulkParentDistrictId}
                          onChange={e => handleBulkDistrictChange(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select District</option>
                          {districts
                            .filter(d => !bulkParentStateId || normalizeId(d.stateId) === normalizeId(bulkParentStateId))
                            .map(d => (
                              <option key={d.id} value={d.id}>{d.name}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Constituency */}
                    {(activeTab === 'blocks' || activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Constituency</label>
                        <select 
                          value={bulkParentConstituencyId}
                          onChange={e => handleBulkConstituencyChange(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select Constituency</option>
                          {constituencies
                            .filter(c => (!bulkParentDistrictId || normalizeId(c.districtId) === normalizeId(bulkParentDistrictId)) && (!bulkParentStateId || normalizeId(c.stateId) === normalizeId(bulkParentStateId)))
                            .map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Block / Mandal */}
                    {(activeTab === 'panchayats' || activeTab === 'wards' || activeTab === 'booths') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Block / Area (Mandal)</label>
                        <select 
                          value={bulkParentMandalId}
                          onChange={e => handleBulkBlockChange(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select Block / Area (Optional for ULBs)</option>
                          {blocks
                            .filter(b => (!bulkParentConstituencyId || normalizeId(b.constituencyId) === normalizeId(bulkParentConstituencyId)) && (!bulkParentDistrictId || normalizeId(b.districtId) === normalizeId(bulkParentDistrictId)))
                            .map(m => (
                              <option key={m.id} value={m.id}>{m.name} {m.mandal_code ? `(${m.mandal_code})` : ''}</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Panchayat / ULB */}
                    {(activeTab === 'wards' || activeTab === 'booths') && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Parent Panchayat / Local Body</label>
                        <select 
                          value={bulkParentPanchayatId}
                          onChange={e => handleBulkPanchayatChange(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select Local Body / Panchayat (Optional)</option>
                          {panchayats
                            .filter(p => (!bulkParentMandalId || normalizeId(p.mandalId) === normalizeId(bulkParentMandalId)) && (!bulkParentConstituencyId || normalizeId(p.constituencyId) === normalizeId(bulkParentConstituencyId)))
                            .map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.type || 'GP'})</option>
                            ))}
                        </select>
                      </div>
                    )}

                    {/* Ward / Village */}
                    {activeTab === 'booths' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-zinc-400">Parent Ward / Village</label>
                        <select 
                          value={bulkParentWardId}
                          onChange={e => setBulkParentWardId(e.target.value)}
                          className="webapp-input w-full h-9 text-xs"
                        >
                          <option value="">Select Ward / Village (Optional)</option>
                          {wards
                            .filter(w => (!bulkParentPanchayatId || normalizeId(w.panchayatId) === normalizeId(bulkParentPanchayatId)) && (!bulkParentMandalId || normalizeId(w.mandalId) === normalizeId(bulkParentMandalId)))
                            .map(w => (
                              <option key={w.id} value={w.id}>{w.name} {w.wardNumber ? `(Ward #${w.wardNumber})` : ''}</option>
                            ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Category & Configuration */}
                {activeTab === 'panchayats' && (
                  <div className="space-y-1">
                    <label className="data-label">Default Local Body Type</label>
                    <select
                      value={bulkItemType}
                      onChange={e => setBulkItemType(e.target.value)}
                      className="webapp-input w-full h-9 text-xs font-semibold"
                    >
                      <option value="Gram Panchayat">Gram Panchayat (GP)</option>
                      <option value="Municipal Corporation">Municipal Corporation (MC)</option>
                      <option value="Municipality">Municipality (Nagar Palika)</option>
                      <option value="Nagar Panchayat">Nagar Panchayat</option>
                      <option value="Urban Local Body">Urban Local Body (ULB)</option>
                    </select>
                  </div>
                )}


                {activeTab === 'booths' && (
                  <div className="space-y-1">
                    <label className="data-label">Starting Booth Number (Auto-Increment if not in list)</label>
                    <input 
                      type="number" 
                      min={1}
                      value={bulkStartingNumber}
                      onChange={e => setBulkStartingNumber(Math.max(1, Number(e.target.value)))}
                      className="webapp-input w-full h-9 text-xs font-bold"
                    />
                  </div>
                )}

                {/* 3. Paste Textarea */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="data-label flex items-center gap-1.5">
                      <ClipboardList size={13} className="text-blue-500" /> 2. Paste Names / List (One per line)
                    </label>
                    <span className="text-[10px] font-semibold text-zinc-400">
                      {bulkPasteText ? `${bulkPasteText.split(/\r?\n/).filter(Boolean).length} lines entered` : 'Excel / Text compatible'}
                    </span>
                  </div>
                  <textarea 
                    rows={6}
                    value={bulkPasteText}
                    onChange={e => setBulkPasteText(e.target.value)}
                    placeholder={
                      activeTab === 'panchayats' 
                        ? "Paste Panchayat / Local Body names (one per line, or with code):\nAAMWALA SAINWALA\nMAJRA\nKANSHIPUR\nDHAULA KUAN\nGP-05, PURUWALA"
                        : activeTab === 'wards'
                        ? "Paste Ward or Village names:\nWard 1\nWard 2\nWard 3\nVillage Majra\n4, Ward No 4"
                        : activeTab === 'booths'
                        ? "Paste Booth numbers & names:\n1, Govt Primary School Aamwala\n2, Panchayat Ghar Majra\n3, Govt High School Kanshipur\nGovt Middle School Paonta"
                        : "Paste names (one per line):\nBlock A\nBlock B\nBlock C"
                    }
                    className="webapp-input w-full text-xs font-mono py-2.5 px-3 leading-relaxed h-36"
                  />
                  <p className="text-[11px] text-zinc-400">
                    💡 Tip: You can paste straight from Excel, Google Sheets, or WhatsApp. Numbered lists like &quot;1. Name&quot; or comma separated &quot;Code, Name&quot; are automatically parsed.
                  </p>
                </div>

                {/* 4. Live Parsed Items Preview */}
                {parsedBulkItems.length > 0 && (
                  <div className="space-y-2 bg-blue-50/50 dark:bg-blue-950/20 p-3 rounded-2xl border border-blue-200/50 dark:border-blue-900/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                        <CheckCircle size={14} className="text-emerald-500" />
                        {parsedBulkItems.length} {parsedBulkItems.length === 1 ? 'Item' : 'Items'} Ready to Add
                      </span>
                      <span className="text-[10px] font-bold text-blue-500 bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 rounded-full">
                        Preview
                      </span>
                    </div>
                    <div className="max-h-28 overflow-y-auto custom-scrollbar flex flex-wrap gap-1.5 pt-1">
                      {parsedBulkItems.map((item, idx) => (
                        <div 
                          key={idx} 
                          className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5 shadow-2xs"
                        >
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold">#{idx + 1}</span>
                          {item.boothNumber && <span className="font-bold text-indigo-600">[{item.boothNumber}]</span>}
                          {item.wardNumber && <span className="font-bold text-indigo-600">[W#{item.wardNumber}]</span>}
                          {item.code && <span className="font-bold text-indigo-600">[{item.code}]</span>}
                          <span className="truncate max-w-[180px]">{item.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Progress Animation */}
                {bulkProgress && (
                  <div className="space-y-1.5 bg-zinc-100 dark:bg-zinc-900 p-3 rounded-xl">
                    <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                      <span>Saving Records...</span>
                      <span>{bulkProgress.current} / {bulkProgress.total}</span>
                    </div>
                    <div className="w-full bg-zinc-200 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                      <div 
                        className="bg-blue-600 h-full transition-all duration-200 rounded-full" 
                        style={{ width: `${(bulkProgress.current / bulkProgress.total) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 shrink-0">
                <button 
                  type="button" 
                  onClick={() => setIsBulkPasteModalOpen(false)} 
                  disabled={actionLoading}
                  className="webapp-button-secondary flex-1"
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={handleExecuteBulkPaste} 
                  disabled={actionLoading || parsedBulkItems.length === 0}
                  className="webapp-button-primary flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold flex justify-center items-center gap-2 shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer"
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} className="text-amber-300" />}
                  <span>Add {parsedBulkItems.length > 0 ? `${parsedBulkItems.length} ` : ''}{getTabPlural(activeTab)}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DemographicSettings;
