import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle,
  X,
  Save,
  Layers,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  Calendar,
  Flag,
  Check,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch, invalidateClientCache } from '../lib/api';
import { useAuth } from '../AuthProvider';

interface Election {
  id: string;
  year: number;
  title?: string;
  description: string;
  status: 'Upcoming' | 'Active' | 'Completed';
  createdAt?: string;
  updatedAt?: string;
}

interface PoliticalParty {
  id: string;
  name: string;
  abbreviation: string;
  logoUrl?: string;
  logo_url?: string;
  color?: string;
  symbol?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ElectionSetup() {
  const { isSuperAdmin, isAdmin, profile, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'elections' | 'parties'>('elections');
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Elections State
  const [elections, setElections] = useState<Election[]>([]);
  const [isElectionModalOpen, setIsElectionModalOpen] = useState(false);
  const [editingElection, setEditingElection] = useState<Election | null>(null);
  const [electionForm, setElectionForm] = useState({
    year: new Date().getFullYear(),
    title: '',
    description: '',
    status: 'Upcoming' as Election['status']
  });

  // Parties State
  const [parties, setParties] = useState<PoliticalParty[]>([]);
  const [isPartyModalOpen, setIsPartyModalOpen] = useState(false);
  const [editingParty, setEditingParty] = useState<PoliticalParty | null>(null);
  const [partyForm, setPartyForm] = useState({
    name: '',
    abbreviation: '',
    logoUrl: '',
    symbol: '',
    color: '#3b82f6'
  });

  // Deletion State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; type: 'elections' | 'parties'; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Permissions check: SuperAdmin, Admin, or specific permission grant
  const hasElectionsAccess = isSuperAdmin || isAdmin || profile?.role === 'super_admin' || profile?.role === 'admin';
  const canView = hasElectionsAccess || hasPermission('elections', 'v') || hasPermission('elections');
  const canCreate = hasElectionsAccess || hasPermission('elections', 'c') || hasPermission('elections');
  const canEdit = hasElectionsAccess || hasPermission('elections', 'u') || hasPermission('elections');
  const canDelete = hasElectionsAccess || hasPermission('elections', 'd') || hasPermission('elections');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      if (activeTab === 'elections') {
        const data = await apiFetch<Election[]>('/api/elections');
        setElections(data || []);
      } else {
        const data = await apiFetch<PoliticalParty[]>('/api/parties');
        setParties(data || []);
      }
    } catch (err: any) {
      console.error('Error fetching elections/parties:', err);
      setError(err?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    invalidateClientCache('/api/elections');
    invalidateClientCache('/api/parties');
    await fetchData();
  };

  const handleElectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = {
        ...electionForm,
        year: Number(electionForm.year)
      };

      if (editingElection) {
        await apiFetch(`/api/elections/${editingElection.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccess('Election cycle updated successfully');
      } else {
        await apiFetch('/api/elections', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('Election cycle added successfully');
      }
      setIsElectionModalOpen(false);
      setEditingElection(null);
      invalidateClientCache('/api/elections');
      await fetchData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save election');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const payload = {
        name: partyForm.name.trim(),
        abbreviation: partyForm.abbreviation.trim().toUpperCase(),
        logoUrl: partyForm.logoUrl.trim(),
        logo_url: partyForm.logoUrl.trim(),
        symbol: partyForm.symbol.trim(),
        color: partyForm.color
      };

      if (editingParty) {
        await apiFetch(`/api/parties/${editingParty.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload)
        });
        setSuccess('Political party updated successfully');
      } else {
        await apiFetch('/api/parties', {
          method: 'POST',
          body: JSON.stringify(payload)
        });
        setSuccess('Political party added successfully');
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      invalidateClientCache('/api/parties');
      await fetchData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to save party');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStatusChange = async (ele: Election, newStatus: Election['status']) => {
    if (!canEdit) return;
    try {
      await apiFetch(`/api/elections/${ele.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          year: ele.year,
          title: ele.title,
          description: ele.description,
          status: newStatus
        })
      });
      invalidateClientCache('/api/elections');
      setElections(prev => prev.map(item => item.id === ele.id ? { ...item, status: newStatus } : item));
      setSuccess(`Updated status to ${newStatus}`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to update election status');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmation) return;
    setDeleteLoading(true);
    setError('');
    const { id, type, label } = deleteConfirmation;
    try {
      const endpoint = type === 'elections' ? `/api/elections/${id}` : `/api/parties/${id}`;
      await apiFetch(endpoint, { method: 'DELETE' });
      setSuccess(`${type === 'elections' ? 'Election cycle' : 'Party'} "${label}" deleted successfully`);
      setDeleteConfirmation(null);
      invalidateClientCache(type === 'elections' ? '/api/elections' : '/api/parties');
      await fetchData();
      setTimeout(() => setSuccess(''), 3500);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
        <Layers className="text-zinc-300 dark:text-zinc-700 w-16 h-16 min-h-16 mb-4" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">Permission Required</h3>
        <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
          You do not have view permissions for <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Election Setup</strong>. Please contact your Super Admin to obtain permission.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* Minimalistic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-200 dark:border-zinc-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              Elections
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
              Setup
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Manage election cycles, general elections, and registered political parties.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            title="Refresh Data"
            disabled={loading}
            className="p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setActiveTab('elections')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'elections'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              Elections
            </button>
            <button
              onClick={() => setActiveTab('parties')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'parties'
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
                }`}
            >
              <Flag className="w-3.5 h-3.5" />
              Parties
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="space-y-4"
        >
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </div>
              <button onClick={() => setError('')} className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/20 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">{success}</p>
              </div>
              <button onClick={() => setSuccess('')} className="p-1 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 rounded-lg">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-zinc-900 dark:text-white capitalize text-sm sm:text-base">
                  {activeTab === 'elections' ? 'Election Cycles' : 'Registered Political Parties'}
                </h2>
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {activeTab === 'elections' ? elections.length : parties.length}
                </span>
              </div>
              {canCreate && (
                <button
                  onClick={() => {
                    setError('');
                    if (activeTab === 'elections') {
                      setEditingElection(null);
                      setElectionForm({
                        year: new Date().getFullYear(),
                        title: '',
                        description: '',
                        status: 'Upcoming'
                      });
                      setIsElectionModalOpen(true);
                    } else {
                      setEditingParty(null);
                      setPartyForm({
                        name: '',
                        abbreviation: '',
                        logoUrl: '',
                        symbol: '',
                        color: '#3b82f6'
                      });
                      setIsPartyModalOpen(true);
                    }
                  }}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  Add {activeTab === 'elections' ? 'Election' : 'Party'}
                </button>
              )}
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left min-w-[650px] whitespace-nowrap">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    {activeTab === 'elections' ? (
                      <>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title / Year</th>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Description</th>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Party</th>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Abbreviation</th>
                        <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Color</th>
                      </>
                    )}
                    <th className="px-4 py-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center">
                        <Loader2 className="w-7 h-7 text-blue-500 animate-spin mx-auto" />
                        <p className="mt-2 text-xs text-zinc-500">Loading {activeTab}...</p>
                      </td>
                    </tr>
                  ) : (activeTab === 'elections' ? elections.length === 0 : parties.length === 0) ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-12 text-center text-xs text-zinc-500">
                        No {activeTab} found. Click the "Add {activeTab === 'elections' ? 'Election' : 'Party'}" button above to create one.
                      </td>
                    </tr>
                  ) : (
                    activeTab === 'elections' ? (
                      elections.map((ele) => (
                        <tr key={ele.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-black text-xs shrink-0 border border-blue-200/50 dark:border-blue-800/50">
                                {String(ele.year).slice(-2)}
                              </div>
                              <div>
                                <div className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">
                                  {ele.title || `${ele.year} Election`}
                                </div>
                                <div className="text-[11px] text-zinc-500 font-semibold font-mono">
                                  Year: {ele.year}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 max-w-sm truncate">
                            {ele.description || '-'}
                          </td>
                          <td className="px-4 py-3">
                            {canEdit ? (
                              <div className="relative inline-block">
                                <select
                                  value={ele.status}
                                  onChange={(e) => handleStatusChange(ele, e.target.value as Election['status'])}
                                  className={`appearance-none cursor-pointer pl-3 pr-7 py-1 rounded-full text-[11px] font-bold outline-none border transition-all ${ele.status === 'Active'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50'
                                    : ele.status === 'Completed'
                                      ? 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/50'
                                    }`}
                                >
                                  <option value="Upcoming">Upcoming</option>
                                  <option value="Active">Active</option>
                                  <option value="Completed">Completed</option>
                                </select>
                                <ChevronDown className="w-3 h-3 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              </div>
                            ) : (
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${ele.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : ele.status === 'Completed'
                                  ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                  : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${ele.status === 'Active' ? 'bg-emerald-500' : ele.status === 'Completed' ? 'bg-zinc-500' : 'bg-blue-500'
                                  }`} />
                                {ele.status}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canEdit && (
                                <button
                                  onClick={() => {
                                    setError('');
                                    setEditingElection(ele);
                                    setElectionForm({
                                      year: ele.year,
                                      title: ele.title || '',
                                      description: ele.description || '',
                                      status: ele.status
                                    });
                                    setIsElectionModalOpen(true);
                                  }}
                                  title="Edit Election"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                >
                                  <Edit2 size={12} />
                                  <span>Edit</span>
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={() => {
                                    setError('');
                                    setDeleteConfirmation({
                                      id: ele.id,
                                      type: 'elections',
                                      label: ele.title ? `${ele.title} (${ele.year})` : String(ele.year)
                                    });
                                  }}
                                  title="Delete Election"
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                >
                                  <Trash2 size={12} />
                                  <span>Delete</span>
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      parties.map((party) => {
                        const logo = party.logoUrl || party.logo_url;
                        return (
                          <tr key={party.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {logo ? (
                                  <img
                                    src={logo}
                                    alt={party.name}
                                    className="w-8 h-8 rounded-lg object-contain bg-white dark:bg-zinc-800 p-0.5 border border-zinc-200 dark:border-zinc-700 shrink-0"
                                    onError={(e) => {
                                      (e.target as HTMLElement).style.display = 'none';
                                    }}
                                  />
                                ) : (
                                  <div
                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-xs shrink-0 shadow-sm"
                                    style={{ backgroundColor: party.color || '#3b82f6' }}
                                  >
                                    {(party.abbreviation || party.name || 'P').substring(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <span className="font-bold text-zinc-900 dark:text-white text-xs sm:text-sm">{party.name}</span>
                                  {party.symbol && (
                                    <div className="text-[11px] text-zinc-400">Symbol: {party.symbol}</div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs font-mono font-bold text-zinc-700 dark:text-zinc-200">
                              {party.abbreviation}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-4 h-4 rounded-full border border-black/15 dark:border-white/15 shadow-sm"
                                  style={{ backgroundColor: party.color || '#3b82f6' }}
                                />
                                <span className="text-xs text-zinc-500 font-mono uppercase font-medium">{party.color || '#3b82f6'}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      setError('');
                                      setEditingParty(party);
                                      setPartyForm({
                                        name: party.name,
                                        abbreviation: party.abbreviation,
                                        logoUrl: party.logoUrl || party.logo_url || '',
                                        symbol: party.symbol || '',
                                        color: party.color || '#3b82f6'
                                      });
                                      setIsPartyModalOpen(true);
                                    }}
                                    title="Edit Party"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-amber-600 dark:hover:text-amber-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                  >
                                    <Edit2 size={12} />
                                    <span>Edit</span>
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    onClick={() => {
                                      setError('');
                                      setDeleteConfirmation({
                                        id: party.id,
                                        type: 'parties',
                                        label: `${party.name} (${party.abbreviation})`
                                      });
                                    }}
                                    title="Delete Party"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-zinc-600 dark:text-zinc-300 hover:text-red-600 dark:hover:text-red-400 bg-zinc-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 border border-zinc-200 dark:border-zinc-700 transition-colors"
                                  >
                                    <Trash2 size={12} />
                                    <span>Delete</span>
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Election Modal */}
      <AnimatePresence>
        {isElectionModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsElectionModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl z-10"
            >
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {editingElection ? 'Edit Election Cycle' : 'Add Election Cycle'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {editingElection ? 'Update parameters for this election cycle' : 'Create a new election cycle and year'}
                  </p>
                </div>
                <button
                  onClick={() => setIsElectionModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleElectionSubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Election Year *</label>
                    <input
                      type="number"
                      value={electionForm.year}
                      onChange={(e) => setElectionForm({ ...electionForm, year: Number(e.target.value) })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all font-mono"
                      required
                      min={1950}
                      max={2100}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Status *</label>
                    <select
                      value={electionForm.status}
                      onChange={(e) => setElectionForm({ ...electionForm, status: e.target.value as Election['status'] })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                      required
                    >
                      <option value="Upcoming">Upcoming</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Election Title *</label>
                  <input
                    type="text"
                    value={electionForm.title}
                    onChange={(e) => setElectionForm({ ...electionForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    placeholder="e.g. Lok Sabha 2026, State Assembly General Elections"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Description</label>
                  <textarea
                    value={electionForm.description}
                    onChange={(e) => setElectionForm({ ...electionForm, description: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all min-h-[90px]"
                    placeholder="Brief description of this election cycle..."
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsElectionModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-xs sm:text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingElection ? 'Update Election' : 'Create Election'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Party Modal */}
      <AnimatePresence>
        {isPartyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isSubmitting && setIsPartyModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl z-10"
            >
              <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
                    {editingParty ? 'Edit Political Party' : 'Add Political Party'}
                  </h3>
                  <p className="text-xs text-zinc-500 mt-0.5">
                    {editingParty ? 'Update political party details' : 'Register a new political party and symbol'}
                  </p>
                </div>
                <button
                  onClick={() => setIsPartyModalOpen(false)}
                  disabled={isSubmitting}
                  className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handlePartySubmit} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Party Name *</label>
                    <input
                      type="text"
                      value={partyForm.name}
                      onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                      placeholder="e.g. Bharatiya Janata Party"
                      required
                    />
                  </div>
                  <div className="space-y-1.5 col-span-2 sm:col-span-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Abbreviation *</label>
                    <input
                      type="text"
                      value={partyForm.abbreviation}
                      onChange={(e) => setPartyForm({ ...partyForm, abbreviation: e.target.value.toUpperCase() })}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all uppercase font-mono"
                      placeholder="e.g. BJP"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Party Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={partyForm.color}
                      onChange={(e) => setPartyForm({ ...partyForm, color: e.target.value })}
                      className="w-10 h-10 rounded-xl border border-zinc-200 dark:border-zinc-700 cursor-pointer p-0.5 bg-transparent"
                    />
                    <input
                      type="text"
                      value={partyForm.color}
                      onChange={(e) => setPartyForm({ ...partyForm, color: e.target.value })}
                      className="flex-1 px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all uppercase font-mono"
                      placeholder="#3B82F6"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Party Symbol / Name (Optional)</label>
                  <input
                    type="text"
                    value={partyForm.symbol}
                    onChange={(e) => setPartyForm({ ...partyForm, symbol: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    placeholder="e.g. Lotus, Hand, Elephant"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Logo Image URL (Optional)</label>
                  <input
                    type="url"
                    value={partyForm.logoUrl}
                    onChange={(e) => setPartyForm({ ...partyForm, logoUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm transition-all"
                    placeholder="https://example.com/party-logo.png"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setIsPartyModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-xs sm:text-sm transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {editingParty ? 'Update Party' : 'Create Party'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !deleteLoading && setDeleteConfirmation(null)}
              className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl p-6 text-center z-10"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-2xl flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4 border border-red-200 dark:border-red-800/40">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-1.5">Confirm Deletion</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-xs sm:text-sm mb-6 leading-relaxed">
                Are you sure you want to permanently delete <span className="font-bold text-zinc-900 dark:text-white">"{deleteConfirmation.label}"</span>? Associated data may also be removed.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-semibold text-xs sm:text-sm transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-semibold text-xs sm:text-sm shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {deleteLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
