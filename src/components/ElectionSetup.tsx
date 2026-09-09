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
  AlertTriangle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { apiFetch } from '../lib/api';
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
  color?: string;
  createdAt?: string;
  updatedAt?: string;
}

export default function ElectionSetup() {
  const { isAdmin, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'elections' | 'parties'>('elections');
  const [loading, setLoading] = useState(true);
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
    color: '#000000'
  });

  // Deletion State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{ id: string; type: 'elections' | 'parties'; label: string } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const canEdit = isAdmin || hasPermission('elections', 'u');
  const canCreate = isAdmin || hasPermission('elections', 'c');
  const canDelete = isAdmin || hasPermission('elections', 'd');

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

  const handleElectionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingElection) {
        await apiFetch(`/api/elections/${editingElection.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...electionForm,
            year: Number(electionForm.year)
          })
        });
        setSuccess('Election updated successfully');
      } else {
        await apiFetch('/api/elections', {
          method: 'POST',
          body: JSON.stringify({
            ...electionForm,
            year: Number(electionForm.year)
          })
        });
        setSuccess('Election added successfully');
      }
      setIsElectionModalOpen(false);
      setEditingElection(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save election');
    }
  };

  const handlePartySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editingParty) {
        await apiFetch(`/api/parties/${editingParty.id}`, {
          method: 'PUT',
          body: JSON.stringify(partyForm)
        });
        setSuccess('Party updated successfully');
      } else {
        await apiFetch('/api/parties', {
          method: 'POST',
          body: JSON.stringify(partyForm)
        });
        setSuccess('Party added successfully');
      }
      setIsPartyModalOpen(false);
      setEditingParty(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save party');
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
      setSuccess(`${type === 'elections' ? 'Election' : 'Party'} "${label}" deleted successfully`);
      setDeleteConfirmation(null);
      fetchData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete item');
    } finally {
      setDeleteLoading(false);
    }
  };

  if (!isAdmin && !hasPermission('elections', 'v')) {
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
    <div className="p-6 space-y-6 max-w-full mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-blue-500" />
            Election Setup
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400">Manage election cycles and political organizations</p>
        </div>
        
        <div className="flex bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('elections')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'elections' 
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Election Years
          </button>
          <button
            onClick={() => setActiveTab('parties')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'parties' 
                ? 'bg-white dark:bg-zinc-700 text-blue-600 dark:text-blue-400 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            Political Parties
          </button>
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
            <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {success && (
            <div className="p-4 bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-900/20 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 flex-shrink-0" />
              <p className="text-sm font-medium">{success}</p>
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-sm">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="font-semibold text-zinc-900 dark:text-white capitalize">
                {activeTab === 'elections' ? 'Election Cycles' : 'Registered Parties'}
              </h2>
              {canCreate && (
                <button
                  onClick={() => {
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
                        color: '#3b82f6'
                      });
                      setIsPartyModalOpen(true);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add {activeTab === 'elections' ? 'Year' : 'Party'}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                  <tr>
                    {activeTab === 'elections' ? (
                      <>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Year</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Party</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Abbreviation</th>
                        <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Color</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin mx-auto" />
                        <p className="mt-2 text-zinc-500">Loading {activeTab}...</p>
                      </td>
                    </tr>
                  ) : elections.length === 0 && parties.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-12 text-center text-zinc-500">
                        No {activeTab} found. Click the Plus button to add one.
                      </td>
                    </tr>
                  ) : (
                    activeTab === 'elections' ? (
                      elections.map((ele) => (
                        <tr key={ele.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold">
                                {String(ele.year).slice(-2)}
                              </div>
                              <div className="flex flex-col">
                                <span className="font-medium text-zinc-900 dark:text-white">{ele.title || `${ele.year} Election`}</span>
                                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">{ele.year}</span>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm text-zinc-500 dark:text-zinc-400 max-w-xs truncate">
                            {ele.description || 'No description'}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                              ele.status === 'Active' 
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                : ele.status === 'Completed'
                                ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400'
                                : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                ele.status === 'Active' ? 'bg-emerald-500' : ele.status === 'Completed' ? 'bg-zinc-500' : 'bg-blue-500'
                              }`} />
                              {ele.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <button 
                                  onClick={() => {
                                    setEditingElection(ele);
                                    setElectionForm({
                                      year: ele.year,
                                      title: ele.title || '',
                                      description: ele.description || '',
                                      status: ele.status
                                    });
                                    setIsElectionModalOpen(true);
                                  }}
                                  className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => setDeleteConfirmation({ id: ele.id, type: 'elections', label: ele.title ? `${ele.title} (${ele.year})` : String(ele.year) })}
                                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      parties.map((party) => (
                        <tr key={party.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              {party.logoUrl ? (
                                <img src={party.logoUrl} alt={party.name} className="w-10 h-10 rounded-xl object-cover" />
                              ) : (
                                <div 
                                  className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-xs"
                                  style={{ backgroundColor: party.color || '#3b82f6' }}
                                >
                                  {party.abbreviation.substring(0, 2)}
                                </div>
                              )}
                              <span className="font-medium text-zinc-900 dark:text-white">{party.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm font-mono text-zinc-500 dark:text-zinc-400">
                            {party.abbreviation}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-4 h-4 rounded-full border border-black/10" 
                                style={{ backgroundColor: party.color }} 
                              />
                              <span className="text-sm text-zinc-500 font-mono uppercase">{party.color}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canEdit && (
                                <button 
                                  onClick={() => {
                                    setEditingParty(party);
                                    setPartyForm({
                                      name: party.name,
                                      abbreviation: party.abbreviation,
                                      logoUrl: party.logoUrl || '',
                                      color: party.color || '#3b82f6'
                                    });
                                    setIsPartyModalOpen(true);
                                  }}
                                  className="p-2 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              )}
                              {canDelete && (
                                <button 
                                  onClick={() => setDeleteConfirmation({ id: party.id, type: 'parties', label: `${party.name} (${party.abbreviation})` })}
                                  className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
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
              onClick={() => setIsElectionModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/20 dark:bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingElection ? 'Edit Election Year' : 'Add Election Year'}
                </h3>
                <button 
                  onClick={() => setIsElectionModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handleElectionSubmit} className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Election Year</label>
                  <input
                    type="number"
                    value={electionForm.year}
                    onChange={(e) => setElectionForm({ ...electionForm, year: Number(e.target.value) })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                    min={1900}
                    max={2100}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Election Title</label>
                  <input
                    type="text"
                    value={electionForm.title}
                    onChange={(e) => setElectionForm({ ...electionForm, title: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="e.g. Lok Sabha 2026, Assembly Election"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Status</label>
                  <select
                    value={electionForm.status}
                    onChange={(e) => setElectionForm({ ...electionForm, status: e.target.value as Election['status'] })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    required
                  >
                    <option value="Upcoming">Upcoming</option>
                    <option value="Active">Active</option>
                    <option value="Completed">Completed</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                  <textarea
                    value={electionForm.description}
                    onChange={(e) => setElectionForm({ ...electionForm, description: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[100px]"
                    placeholder="Brief description of this election cycle..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsElectionModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingElection ? 'Update Year' : 'Create Year'}
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
              onClick={() => setIsPartyModalOpen(false)}
              className="absolute inset-0 bg-zinc-950/20 dark:bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {editingParty ? 'Edit Political Party' : 'Add Political Party'}
                </h3>
                <button 
                  onClick={() => setIsPartyModalOpen(false)}
                  className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5 text-zinc-500" />
                </button>
              </div>

              <form onSubmit={handlePartySubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Party Name</label>
                    <input
                      type="text"
                      value={partyForm.name}
                      onChange={(e) => setPartyForm({ ...partyForm, name: e.target.value })}
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      placeholder="e.g. Bharatiya Janata Party"
                      required
                    />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Abbreviation</label>
                    <input
                      type="text"
                      value={partyForm.abbreviation}
                      onChange={(e) => setPartyForm({ ...partyForm, abbreviation: e.target.value.toUpperCase() })}
                      className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase"
                      placeholder="e.g. BJP"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300 text-left block">Party Color</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={partyForm.color}
                      onChange={(e) => setPartyForm({ ...partyForm, color: e.target.value })}
                      className="w-12 h-12 rounded-xl border-none cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={partyForm.color}
                      onChange={(e) => setPartyForm({ ...partyForm, color: e.target.value })}
                      className="flex-1 px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all uppercase font-mono"
                      placeholder="#000000"
                    />
                  </div>
                </div>

                <div className="space-y-2 text-left">
                  <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Logo URL (Optional)</label>
                  <input
                    type="url"
                    value={partyForm.logoUrl}
                    onChange={(e) => setPartyForm({ ...partyForm, logoUrl: e.target.value })}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="https://example.com/logo.png"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsPartyModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-medium shadow-md transition-colors flex items-center justify-center gap-2"
                  >
                    <Save className="w-4 h-4" />
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
              onClick={() => setDeleteConfirmation(null)}
              className="absolute inset-0 bg-zinc-950/20 dark:bg-zinc-950/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-xl p-6 text-center"
            >
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center text-red-600 dark:text-red-400 mx-auto mb-4">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-2">Delete Confirmation</h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mb-6">
                Are you sure you want to delete <span className="font-semibold text-zinc-900 dark:text-white">"{deleteConfirmation.label}"</span>? This action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={() => setDeleteConfirmation(null)}
                  className="flex-1 px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700 font-medium transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deleteLoading}
                  onClick={handleDeleteConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 font-medium shadow-md transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
