import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ClipboardList, Plus, Search, Loader2, AlertCircle, CheckCircle, 
  Trash2, Edit2, X, Save, FileText, Check, RefreshCw, ChevronDown, ChevronUp,
  Wrench, ArrowUp, ArrowDown
} from 'lucide-react';

interface UserData {
  uid: string;
  username: string;
  email: string;
  role: string;
}

interface Election {
  id: string;
  year: number;
  title?: string;
  status: string;
}

interface SurveyField {
  id: string;
  label: string;
  type: 'select' | 'multiselect' | 'scale' | 'text' | 'checkbox' | 'number';
  options?: string[];
  required?: boolean;
}

interface SurveyTemplate {
  id: string;
  name: string;
  description: string;
  isSystem?: boolean;
  fields: SurveyField[];
  createdAt?: string;
}

// System baseline fallback
const POLITICAL_SENTIMENT_TEMPLATE: SurveyTemplate = {
  id: 'political_sentiment',
  name: 'Political Sentiment Template',
  description: 'Standard built-in template for tracking favored party and sentiment scoring.',
  isSystem: true,
  fields: [
    { id: 'favored_party', label: 'Favored Party', type: 'select', options: [], required: true },
    { id: 'sentiment_score', label: 'Support Score (1-5 Scale)', type: 'scale', required: true },
    { id: 'key_concerns', label: 'Key Voter Concerns', type: 'multiselect', options: ['Development', 'Water Supply', 'Road Quality', 'Unemployment', 'Inflation', 'Electricity', 'Healthcare', 'Education'], required: false }
  ]
};

interface Survey {
  id: string;
  title: string;
  description: string;
  electionId: string;
  electionYear: number;
  assignedTo: string[]; // array of user UIDs
  status: 'Draft' | 'Active' | 'Completed';
  createdAt?: string;
  linkedPartyIds?: string[]; // array of political party IDs linked to this survey
  templateId?: string; // custom template selection
}

export default function SurveyManagement() {
  const { isAdmin, profile } = useAuth();

  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };

  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [elections, setElections] = useState<Election[]>([]);
  const [parties, setParties] = useState<{ id: string; name: string; abbreviation: string; color?: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Layout states
  const [activeTab, setActiveTab] = useState<'campaigns' | 'templates'>('campaigns');

  // Templates Management State
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('political_sentiment');
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<SurveyTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<SurveyTemplate | null>(null);
  const [templateSearchTerm, setTemplateSearchTerm] = useState('');

  // Template Form Fields
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [templateFields, setTemplateFields] = useState<SurveyField[]>([]);

  // Field Builder Sub-form State
  const [fieldLabel, setFieldLabel] = useState('');
  const [fieldType, setFieldType] = useState<SurveyField['type']>('text');
  const [fieldRequired, setFieldRequired] = useState(true);
  const [fieldOptionsText, setFieldOptionsText] = useState(''); // comma-separated options
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  // Form search states
  const [searchTerm, setSearchTerm] = useState('');

  // Submitting state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);

  // Delete Survey States
  const [surveyToDelete, setSurveyToDelete] = useState<Survey | null>(null);
  const [deletingSurvey, setDeletingSurvey] = useState(false);

  // Form Fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedElectionId, setSelectedElectionId] = useState('');
  const [assignedTo, setAssignedTo] = useState<string[]>([]);
  const [status, setStatus] = useState<Survey['status']>('Draft');
  const [linkedPartyIds, setLinkedPartyIds] = useState<string[]>([]);
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [personnelDropdownOpen, setPersonnelDropdownOpen] = useState(false);
  const [userSearchTerm, setUserSearchTerm] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch Surveys
      const surveyList = await apiFetch<Survey[]>('/api/surveys').catch(() => []);
      setSurveys(surveyList || []);

      // 2. Fetch Users
      const userList = await apiFetch<UserData[]>('/api/users').catch(() => []);
      setUsers(userList || []);

      // 3. Fetch Elections
      const electionList = await apiFetch<Election[]>('/api/elections').catch(() => []);
      setElections(electionList || []);

      // 4. Fetch Parties
      const partyList = await apiFetch<{ id: string; name: string; abbreviation: string; color?: string }[]>('/api/parties').catch(() => []);
      setParties(partyList || []);

      // 5. Fetch Custom Survey Templates
      try {
        const customTemplates = await apiFetch<SurveyTemplate[]>('/api/surveys/templates').catch(() => []);
        const filteredTemplates = (customTemplates || []).filter(t => t.id !== 'political_sentiment');
        setTemplates([POLITICAL_SENTIMENT_TEMPLATE, ...filteredTemplates]);
      } catch (templateError) {
        console.warn("Survey templates fetch failed:", templateError);
        setTemplates([POLITICAL_SENTIMENT_TEMPLATE]);
      }
    } catch (err: any) {
      console.error('Error fetching admin data', err);
      setError(err?.message || 'Failed to load surveys or registries. Verify database availability.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingSurvey(null);
    setTitle('');
    setDescription('');
    setSelectedElectionId(elections[0]?.id || '');
    setAssignedTo([]);
    setStatus('Draft');
    setLinkedPartyIds([]);
    setPartyDropdownOpen(false);
    setPersonnelDropdownOpen(false);
    setUserSearchTerm('');
    setSelectedTemplateId('political_sentiment');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (survey: Survey) => {
    setEditingSurvey(survey);
    setTitle(survey.title);
    setDescription(survey.description);
    setSelectedElectionId(survey.electionId);
    setAssignedTo(survey.assignedTo || []);
    setStatus(survey.status);
    setLinkedPartyIds(survey.linkedPartyIds || []);
    setPartyDropdownOpen(false);
    setPersonnelDropdownOpen(false);
    setUserSearchTerm('');
    setSelectedTemplateId(survey.templateId || 'political_sentiment');
    setIsModalOpen(true);
  };

  const handleSelectUser = (uid: string) => {
    setAssignedTo(prev => 
      prev.includes(uid) 
        ? prev.filter(id => id !== uid) 
        : [...prev, uid]
    );
  };

  const handleOpenCreateTemplateModal = () => {
    setEditingTemplate(null);
    setTemplateName('');
    setTemplateDescription('');
    setTemplateFields([]);
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(true);
    setFieldOptionsText('');
    setEditingFieldIndex(null);
    setIsTemplateModalOpen(true);
  };

  const handleOpenEditTemplateModal = (template: SurveyTemplate) => {
    if (template.isSystem) return;
    setEditingTemplate(template);
    setTemplateName(template.name);
    setTemplateDescription(template.description);
    setTemplateFields(template.fields || []);
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(true);
    setFieldOptionsText('');
    setEditingFieldIndex(null);
    setIsTemplateModalOpen(true);
  };

  const handleAddField = () => {
    if (!fieldLabel.trim()) return;

    let optsList: string[] | undefined = undefined;
    if (fieldType === 'select' || fieldType === 'multiselect') {
      optsList = fieldOptionsText.split(',')
        .map(opt => opt.trim())
        .filter(opt => opt.length > 0);
      if (!optsList || optsList.length === 0) {
        setError('Please enter choices for dropdown/checklist fields.');
        setTimeout(() => setError(''), 4000);
        return;
      }
    }

    const newField: SurveyField = {
      id: editingFieldIndex !== null && templateFields[editingFieldIndex]
        ? templateFields[editingFieldIndex].id
        : `field_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      label: fieldLabel.trim(),
      type: fieldType,
      required: fieldRequired,
      options: optsList
    };

    if (editingFieldIndex !== null) {
      setTemplateFields(prev => {
        const next = [...prev];
        next[editingFieldIndex] = newField;
        return next;
      });
      setEditingFieldIndex(null);
      setSuccess('Question updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } else {
      setTemplateFields(prev => [...prev, newField]);
      setSuccess('Question added successfully');
      setTimeout(() => setSuccess(''), 3000);
    }

    // Clear field designer
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(true);
    setFieldOptionsText('');
  };

  const handleEditField = (index: number) => {
    const field = templateFields[index];
    if (!field) return;
    setEditingFieldIndex(index);
    setFieldLabel(field.label);
    setFieldType(field.type);
    setFieldRequired(field.required ?? true);
    setFieldOptionsText(field.options ? field.options.join(', ') : '');
  };

  const handleCancelFieldEdit = () => {
    setEditingFieldIndex(null);
    setFieldLabel('');
    setFieldType('text');
    setFieldRequired(true);
    setFieldOptionsText('');
  };

  const handleRemoveField = (id: string) => {
    setTemplateFields(prev => prev.filter(f => f.id !== id));
    if (editingFieldIndex !== null && templateFields[editingFieldIndex]?.id === id) {
      setEditingFieldIndex(null);
      setFieldLabel('');
      setFieldType('text');
      setFieldRequired(true);
      setFieldOptionsText('');
    }
  };

  const handleMoveField = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === templateFields.length - 1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    setTemplateFields(prev => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[newIndex];
      next[newIndex] = temp;
      return next;
    });

    if (editingFieldIndex === index) {
      setEditingFieldIndex(newIndex);
    } else if (editingFieldIndex === newIndex) {
      setEditingFieldIndex(index);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      setError('Template name is required');
      return;
    }
    if (templateFields.length === 0) {
      setError('Please add at least one survey question field to this template');
      return;
    }

    setActionLoading(true);
    setError('');

    const templateData = {
      name: templateName.trim(),
      description: templateDescription.trim(),
      fields: templateFields.map(field => {
        const cleanField: SurveyField = {
          id: field.id,
          label: field.label,
          type: field.type,
          required: field.required ?? true
        };
        if (field.options !== undefined && field.options !== null) {
          cleanField.options = field.options;
        }
        return cleanField;
      }),
      isSystem: false
    };

    try {
      if (editingTemplate) {
        await apiFetch(`/api/surveys/templates/${editingTemplate.id}`, {
          method: 'PUT',
          body: JSON.stringify(templateData)
        });
        setSuccess('Survey Template updated successfully');
      } else {
        await apiFetch('/api/surveys/templates', {
          method: 'POST',
          body: JSON.stringify(templateData)
        });
        setSuccess('Survey Template created successfully');
      }
      setIsTemplateModalOpen(false);
      fetchInitialData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred while saving the Survey Template.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTemplate = async () => {
    if (!templateToDelete || templateToDelete.isSystem) return;

    setActionLoading(true);
    setError('');
    try {
      await apiFetch(`/api/surveys/templates/${templateToDelete.id}`, {
        method: 'DELETE'
      });
      setSuccess('Survey template deleted successfully');
      setTemplateToDelete(null);
      fetchInitialData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete template due to database restriction check.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !selectedElectionId) {
      setError('Please fill in all required fields');
      return;
    }

    if (editingSurvey && !hasRight('survey_campaigns', 'u')) {
      setError('You do not have permission to update survey campaigns.');
      return;
    }
    if (!editingSurvey && !hasRight('survey_campaigns', 'c')) {
      setError('You do not have permission to create survey campaigns.');
      return;
    }

    const matchedElection = elections.find(el => el.id === selectedElectionId);
    if (!matchedElection) {
      setError('Selected election is invalid');
      return;
    }

    setActionLoading(true);
    setError('');
    
    const surveyData = {
      title: title.trim(),
      description: description.trim(),
      electionId: selectedElectionId,
      electionYear: matchedElection.year,
      assignedTo: assignedTo,
      status: status,
      linkedPartyIds: linkedPartyIds,
      templateId: selectedTemplateId || 'political_sentiment'
    };

    try {
      if (editingSurvey) {
        await apiFetch(`/api/surveys/${editingSurvey.id}`, {
          method: 'PUT',
          body: JSON.stringify(surveyData)
        });
        setSuccess('Survey updated successfully');
      } else {
        await apiFetch('/api/surveys', {
          method: 'POST',
          body: JSON.stringify(surveyData)
        });
        setSuccess('New survey campaign created');
      }

      setIsModalOpen(false);
      fetchInitialData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'An error occurred while saving the survey campaign.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteSurvey = async () => {
    if (!surveyToDelete) return;

    if (!hasRight('survey_campaigns', 'd')) {
      setError('You do not have permission to delete survey campaigns.');
      setSurveyToDelete(null);
      return;
    }
    
    try {
      await apiFetch(`/api/surveys/${surveyToDelete.id}`, {
        method: 'DELETE'
      });
      setSuccess('Survey deleted successfully');
      setSurveyToDelete(null);
      fetchInitialData();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to delete the survey template.');
    } finally {
      setDeletingSurvey(false);
    }
  };

  const filteredSurveys = surveys.filter(s => 
    s.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsersForAssignment = users.filter(u => {
    const term = userSearchTerm.toLowerCase();
    return (
      u.username.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  });

  if (!hasRight('survey_campaigns', 'v')) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto mt-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xl">
        <div className="w-16 h-16 bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Access Denied</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          You do not have permission to view or manage Survey & Field Campaigns. Please contact your system administrator to grant you access.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-blue-500" />
            Survey & Campaigns Builder
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Design structured custom questionnaire templates and track field campaigns</p>
        </div>
        
        {hasRight('survey_campaigns', 'c') && (
          <div className="flex items-center gap-2">
            {activeTab === 'campaigns' ? (
              <button
                onClick={handleOpenCreateModal}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Campaign
              </button>
            ) : (
              <button
                onClick={handleOpenCreateTemplateModal}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                Create Template
              </button>
            )}
          </div>
        )}
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800 gap-2">
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`px-5 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'campaigns'
              ? 'border-blue-600 text-blue-600 dark:text-blue-500'
              : 'border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300'
          }`}
        >
          Active Campaigns
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-5 py-3 text-[10px] sm:text-xs font-black uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'templates'
              ? 'border-purple-605 text-purple-600 dark:text-purple-400'
              : 'border-transparent text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300'
          }`}
        >
          Survey Templates List
        </button>
      </div>

      {/* Notifications */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/10 text-red-650 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-900/20 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs font-bold">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/10 text-emerald-650 dark:text-emerald-400 rounded-xl border border-emerald-100 dark:border-emerald-950/20 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-xs font-bold">{success}</p>
        </div>
      )}

      {/* ======================= ACTIVE CAMPAIGNS VIEW ======================= */}
      {activeTab === 'campaigns' && (
        <div className="space-y-6">
          {/* Stats Summary & Filters */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-900/20 p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Search campaigns..."
                  className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500 transition-all min-w-[260px]"
                />
                <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-400" />
              </div>

              <button
                onClick={fetchInitialData}
                className="p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 hover:text-zinc-800 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-bold text-zinc-500 dark:text-zinc-400">
              <div>Total Campaigns: <span className="text-zinc-900 dark:text-white font-extrabold">{surveys.length}</span></div>
              <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800" />
              <div>Active Surveys: <span className="text-emerald-500 font-extrabold">{surveys.filter(s => s.status === 'Active').length}</span></div>
            </div>
          </div>

          {/* Campaigns list Table & Grid */}
          {loading ? (
            <div className="p-16 text-center space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
              <p className="text-zinc-400 text-sm font-semibold">Synchronizing campaign rosters...</p>
            </div>
          ) : filteredSurveys.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-16 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-zinc-50 dark:bg-zinc-800/40 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-800 dark:text-zinc-200">No Survey Campaigns Configured</h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto mt-1">Create dynamic sentiment surveys and match them with active field staff to start collecting analytics.</p>
              </div>
              {hasRight('survey_campaigns', 'c') && (
                <button
                  onClick={handleOpenCreateModal}
                  className="px-4 py-2 bg-zinc-950 dark:bg-zinc-800 hover:bg-zinc-900 text-white text-xs font-bold rounded-xl transition-all"
                >
                  Configure First Campaign
                </button>
              )}
            </div>
          ) : (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-900/35">
                      <th className="px-6 py-4">Campaign Title & Info</th>
                      <th className="px-6 py-4">Layout Template</th>
                      <th className="px-6 py-4">Target Election</th>
                      <th className="px-6 py-4">Assigned Personnel</th>
                      <th className="px-6 py-4">Campaign Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredSurveys.map(campaign => {
                      const matchedElection = elections.find(el => el.id === campaign.electionId);
                      const assignedStaff = users.filter(u => campaign.assignedTo?.includes(u.uid));
                      const campaignTemplate = templates.find(t => t.id === campaign.templateId) || templates.find(t => t.id === 'political_sentiment') || POLITICAL_SENTIMENT_TEMPLATE;

                  return (
                    <tr key={campaign.id} className="hover:bg-zinc-50/20 dark:hover:bg-zinc-900/40">
                      {/* Name & desc */}
                      <td className="px-6 py-4 max-w-sm">
                        <div>
                          <p className="text-sm font-bold text-zinc-900 dark:text-white capitalize">{campaign.title}</p>
                          <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2">{campaign.description}</p>
                          {campaign.linkedPartyIds && campaign.linkedPartyIds.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2 items-center">
                              <span className="text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase mr-1">Involved Parties:</span>
                              {parties.filter(p => campaign.linkedPartyIds?.includes(p.id)).map(p => (
                                <span 
                                  key={p.id} 
                                  className="text-[9px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1 bg-zinc-50 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                                  style={{ borderColor: `${p.color}40` }}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                  {p.abbreviation}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Layout Template Badge */}
                      <td className="px-6 py-4">
                        <div>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border inline-flex items-center gap-1 ${
                            campaignTemplate.isSystem 
                              ? 'bg-blue-50 text-blue-700/85 border-blue-200 dark:bg-blue-950/20 dark:text-blue-405 dark:border-blue-900/30' 
                              : 'bg-purple-50 text-purple-705/85 border-purple-200 dark:bg-purple-950/20 dark:text-purple-405 dark:border-purple-900/30'
                          }`}>
                            {campaignTemplate.name}
                          </span>
                          <p className="text-[10px] text-zinc-400 mt-1">{campaignTemplate.fields?.length || 0} Dynamic Questions</p>
                        </div>
                      </td>

                      {/* Targeted election */}
                      <td className="px-6 py-4">
                        <div>
                          <span className="text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700">
                            {campaign.electionYear} Election Cycle
                          </span>
                          <p className="text-[10px] text-zinc-400 mt-1">{matchedElection?.title || 'Cycle Profile'}</p>
                        </div>
                      </td>

                      {/* Assigned staff */}
                      <td className="px-6 py-4 max-w-xs">
                        <div className="flex flex-wrap gap-1 items-center">
                          {assignedStaff.length > 0 ? (
                            assignedStaff.map(staff => (
                              <span 
                                key={staff.uid} 
                                className="text-[10px] bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 font-bold px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/35"
                              >
                                {staff.username}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-yellow-600 font-bold bg-yellow-50 dark:bg-yellow-950/25 px-2 py-0.5 rounded-md border border-yellow-100 dark:border-yellow-900/35">
                              Unassigned / Pool Wide
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Campaign Status */}
                      <td className="px-6 py-4">
                        <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
                          campaign.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/25 dark:text-emerald-400 dark:border-emerald-800'
                            : campaign.status === 'Completed'
                              ? 'bg-zinc-100 text-zinc-650 border-zinc-305 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700'
                              : 'bg-yellow-50 text-yellow-700 border-yellow-250 dark:bg-yellow-950/20 dark:text-yellow-400 dark:border-yellow-905'
                        }`}>
                          {campaign.status}
                        </span>
                      </td>

                      {/* Tools actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {hasRight('survey_campaigns', 'u') && (
                            <button
                              onClick={() => handleOpenEditModal(campaign)}
                              className="p-1.5 text-zinc-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors"
                              title="Edit campaign settings"
                            >
                              <Edit2 size={14} />
                            </button>
                          )}
                          {hasRight('survey_campaigns', 'd') && (
                            <button
                              onClick={() => setSurveyToDelete(campaign)}
                              className="p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                              title="Delete campaign"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                          {!hasRight('survey_campaigns', 'u') && !hasRight('survey_campaigns', 'd') && (
                            <span className="text-[10px] text-zinc-400 italic font-medium">Read-only</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )}

      {/* ======================= SURVEY TEMPLATES TAB VIEW ======================= */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          {/* Template Search bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-zinc-50 dark:bg-zinc-805/25 p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
            <div className="relative w-full md:w-auto">
              <input
                type="text"
                value={templateSearchTerm}
                onChange={e => setTemplateSearchTerm(e.target.value)}
                placeholder="Search survey templates..."
                className="pl-9 pr-4 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 transition-all min-w-[280px] text-zinc-850 dark:text-white font-semibold"
              />
              <Search className="absolute left-3 top-3 w-3.5 h-3.5 text-zinc-400" />
            </div>

            <div className="text-xs text-zinc-500 font-bold self-start md:self-auto uppercase tracking-wide">
              Registered Templates: <span className="text-zinc-900 dark:text-white font-extrabold">{templates.length}</span> ({templates.filter(t => t.isSystem).length} Built-in Default)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates
              .filter(t =>
                t.name.toLowerCase().includes(templateSearchTerm.toLowerCase()) ||
                t.description.toLowerCase().includes(templateSearchTerm.toLowerCase())
              )
              .map(template => (
                <div 
                  key={template.id} 
                  className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 flex flex-col justify-between hover:shadow-md transition-shadow duration-200"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-bold text-zinc-900 dark:text-white text-sm capitalize truncate">{template.name}</h4>
                        <p className="text-[10px] text-zinc-405 line-clamp-2 mt-1">{template.description || 'No description provided.'}</p>
                      </div>
                      {template.isSystem ? (
                        <span className="text-[8px] font-extrabold uppercase shrink-0 bg-emerald-105 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-250">
                          Built-in
                        </span>
                      ) : (
                        <span className="text-[8px] font-extrabold uppercase shrink-0 bg-purple-105 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400 px-1.5 py-0.5 rounded border border-purple-250">
                          Custom
                        </span>
                      )}
                    </div>

                    {/* Schema fields overview */}
                    <div className="border-t border-zinc-100 dark:border-zinc-800/80 pt-3 space-y-2">
                      <span className="text-[9px] font-black uppercase text-zinc-400 tracking-wider">Configured Questionnaire Schema</span>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {template.fields && template.fields.map((f, idx) => (
                          <div key={f.id || idx} className="flex items-center justify-between text-[11px] bg-zinc-50 dark:bg-zinc-950/50 p-2 rounded-lg border border-zinc-150 dark:border-zinc-800">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="text-[10px] text-purple-500 font-extrabold">Q{idx + 1}:</span>
                              <span className="font-bold text-zinc-700 dark:text-zinc-300 truncate">{f.label}</span>
                            </div>
                            <span className="text-[8px] uppercase font-mono font-black text-zinc-400 bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded whitespace-nowrap">
                              {f.type} {f.required ? '• Req' : ''}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                    {template.isSystem ? (
                      <span className="text-[10px] text-zinc-400 italic font-bold">Default layout locked</span>
                    ) : (
                      <>
                        {hasRight('survey_campaigns', 'u') && (
                          <button
                            type="button"
                            onClick={() => handleOpenEditTemplateModal(template)}
                            className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 hover:text-purple-505 dark:text-zinc-300 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                          >
                            Edit Fields
                          </button>
                        )}
                        {hasRight('survey_campaigns', 'd') && (
                          <button
                            type="button"
                            onClick={() => setTemplateToDelete(template)}
                            className="px-2.5 py-1.5 bg-zinc-50 hover:bg-red-50 hover:text-red-500 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 text-[10px] font-black rounded-lg transition-colors cursor-pointer"
                          >
                            Delete
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
      {/* Editor/Creator Draw Modal Drawer */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Body */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-5 overflow-hidden"
              >
                {/* Modal Title Row */}
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-4">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 text-sm uppercase tracking-wide">
                      <FileText className="w-4 h-4 text-blue-500" />
                      {editingSurvey ? 'Refine Survey Campaign' : 'Configure New Survey'}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Determine the target election, Karyakartas, and operational status</p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl"
                  >
                    <X size={16} />
                  </button>
                </div>

                {/* Form fields */}
                <form onSubmit={handleSaveSurvey} className="space-y-4">
                  {/* Campaign Title */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Campaign Title *</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Assembly Election Household Roster"
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-800 dark:text-white"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Description & Guidance *</label>
                    <textarea
                      required
                      rows={3}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Specify campaign goals, talking points, or area scopes for Karyakartas..."
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-800 dark:text-white"
                    />
                  </div>

                  {/* Survey Template Layout Selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Survey Template Layout *</label>
                    <select
                      required
                      value={selectedTemplateId}
                      onChange={e => setSelectedTemplateId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-805 dark:text-white font-extrabold"
                    >
                      {templates.map(st => (
                        <option key={st.id} value={st.id}>
                          {st.name} {st.isSystem ? '(Default)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Target Election and Campaign Status side-by-side Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Election Cycle *</label>
                      <select
                        required
                        value={selectedElectionId}
                        onChange={e => setSelectedElectionId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-800 dark:text-white"
                      >
                        <option value="" disabled>Select target</option>
                        {elections.map(el => (
                          <option key={el.id} value={el.id}>
                            {el.year} — {el.title || 'Untitled'} ({el.status})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Campaign Status</label>
                      <select
                        value={status}
                        onChange={e => setStatus(e.target.value as 'Draft' | 'Active' | 'Completed')}
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-800 dark:text-white"
                      >
                        <option value="Draft">Draft Mode</option>
                        <option value="Active">Operational / Active</option>
                        <option value="Completed">Completed / Archived</option>
                      </select>
                    </div>
                  </div>

                  {/* Assigned Personnel Selection */}
                  <div className="space-y-2 flex flex-col relative">
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Assign Personnel / Karyakartas</label>
                      <p className="text-[10px] text-zinc-400">Select Karyakartas who can access and fill out this survey campaign</p>
                    </div>

                    <div className="relative">
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setPersonnelDropdownOpen(prev => !prev)}
                        className="w-full flex items-center justify-between text-left p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-xs"
                      >
                        <div className="flex flex-wrap gap-1 items-center min-w-0 pr-2">
                          {assignedTo.length === 0 ? (
                            <span className="text-zinc-400 dark:text-zinc-500">None assigned — accessible to all system users</span>
                          ) : (
                            users.filter(u => assignedTo.includes(u.uid)).map(u => (
                              <span 
                                key={u.uid}
                                className="text-[9px] font-extrabold pl-2 pr-1.5 py-0.5 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 inline-flex items-center gap-1 group/badge"
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-blue-500 animate-pulse" />
                                <span className="truncate max-w-[80px]">{u.username}</span>
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setAssignedTo(prev => prev.filter(id => id !== u.uid));
                                  }}
                                  className="w-3.5 h-3.5 rounded-md inline-flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-all cursor-pointer font-sans"
                                  title={`Remove ${u.username}`}
                                >
                                  <X size={10} strokeWidth={2.5} />
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                        <div className="shrink-0 text-zinc-450">
                          {personnelDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {/* Dropdown Menu */}
                      {personnelDropdownOpen && (
                        <>
                          {/* Invisible backdrop to capture outside clicks and close the dropdown */}
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setPersonnelDropdownOpen(false)}
                          />
                          
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-3 space-y-2.5 max-h-72 overflow-y-auto">
                            
                            {/* Personnel Search bar inside dropdown */}
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Search personnel by username, email, or role..."
                                value={userSearchTerm}
                                onChange={e => setUserSearchTerm(e.target.value)}
                                className="w-full pl-9 pr-8 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-blue-550 text-xs transition-all text-zinc-800 dark:text-white"
                              />
                              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
                              {userSearchTerm && (
                                <button
                                  type="button"
                                  onClick={() => setUserSearchTerm('')}
                                  className="absolute right-3 top-2 p-0.5 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200 transition-colors"
                                  title="Clear search"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>

                            {/* Quick batch selectors inside dropdown */}
                            {users.length > 0 && (
                              <div className="flex justify-between items-center px-1 text-[9px] font-black uppercase text-zinc-450 select-none">
                                <span>{filteredUsersForAssignment.length} of {users.length} found</span>
                                <div className="flex gap-2 items-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const newIds = [...assignedTo];
                                      filteredUsersForAssignment.forEach(u => {
                                        if (!newIds.includes(u.uid)) {
                                          newIds.push(u.uid);
                                        }
                                      });
                                      setAssignedTo(newIds);
                                    }}
                                    className="hover:text-blue-500 transition-colors cursor-pointer"
                                  >
                                    Select All
                                  </button>
                                  <span>•</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const filteredUids = filteredUsersForAssignment.map(u => u.uid);
                                      setAssignedTo(prev => prev.filter(id => !filteredUids.includes(id)));
                                    }}
                                    className="hover:text-red-500 transition-colors cursor-pointer"
                                  >
                                    Clear Visible
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* Registered personnel items */}
                            <div className="space-y-0.5 max-h-40 overflow-y-auto">
                              {users.length === 0 ? (
                                <p className="text-[10px] text-zinc-400 text-center py-4">No system Karyakartas enrolled</p>
                              ) : filteredUsersForAssignment.length === 0 ? (
                                <p className="text-[10px] text-zinc-400 text-center py-4">No personnel matches the search criteria</p>
                              ) : (
                                filteredUsersForAssignment.map(u => {
                                  const isChecked = assignedTo.includes(u.uid);
                                  return (
                                    <div 
                                      key={u.uid}
                                      onClick={() => handleSelectUser(u.uid)}
                                      className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${
                                          isChecked 
                                            ? 'bg-blue-650 border-blue-650 text-white' 
                                            : 'border-zinc-300 dark:border-zinc-700'
                                        }`}>
                                          {isChecked && <Check size={10} strokeWidth={3} />}
                                        </div>
                                        <div className="flex flex-col text-left min-w-0">
                                          <span className="font-bold text-zinc-800 dark:text-zinc-200 capitalize truncate leading-none">{u.username}</span>
                                          <span className="text-[9px] text-zinc-400 mt-0.5 truncate">{u.email}</span>
                                        </div>
                                      </div>
                                      <span className="text-[8px] uppercase font-bold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded tracking-wider font-mono shrink-0">
                                        {u.role}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Linked Parties Option */}
                  <div className="space-y-2 flex flex-col relative">
                    <div>
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Linked Political Parties</label>
                      <p className="text-[10px] text-zinc-400">Select which political parties are active in/linked to this campaign survey</p>
                    </div>

                    <div className="relative">
                      {/* Trigger Button */}
                      <button
                        type="button"
                        onClick={() => setPartyDropdownOpen(prev => !prev)}
                        className="w-full flex items-center justify-between text-left p-3 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-xs"
                      >
                        <div className="flex flex-wrap gap-1 items-center min-w-0 pr-2">
                          {linkedPartyIds.length === 0 ? (
                            <span className="text-zinc-400 dark:text-zinc-500">None linked — all parties visible</span>
                          ) : (
                            parties.filter(p => linkedPartyIds.includes(p.id)).map(p => (
                              <span 
                                key={p.id}
                                className="text-[9px] font-extrabold pl-2 pr-1.5 py-0.5 rounded border inline-flex items-center gap-1 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 group/badge"
                                style={{ borderColor: `${p.color}40` }}
                              >
                                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                                <span>{p.abbreviation}</span>
                                <span
                                  role="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLinkedPartyIds(prev => prev.filter(id => id !== p.id));
                                  }}
                                  className="w-3.5 h-3.5 rounded-md inline-flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-red-500 transition-all cursor-pointer font-sans"
                                  title={`Remove ${p.abbreviation}`}
                                >
                                  <X size={10} strokeWidth={2.5} />
                                </span>
                              </span>
                            ))
                          )}
                        </div>
                        <div className="shrink-0 text-zinc-450">
                          {partyDropdownOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </div>
                      </button>

                      {/* Dropdown Menu */}
                      {partyDropdownOpen && (
                        <>
                          {/* Invisible backdrop to capture outside clicks and close the dropdown */}
                          <div 
                            className="fixed inset-0 z-40" 
                            onClick={() => setPartyDropdownOpen(false)}
                          />
                          
                          <div className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl p-2 max-h-56 overflow-y-auto">
                            <div className="flex items-center justify-between px-2 py-1 mb-1 border-b border-zinc-100 dark:border-zinc-800">
                              <span className="text-[9px] font-black uppercase text-zinc-450 tracking-wider">Select Active Parties</span>
                              {linkedPartyIds.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => setLinkedPartyIds([])}
                                  className="text-[9px] font-black uppercase text-red-500 hover:text-red-650 transition-all"
                                >
                                  Clear All
                                </button>
                              )}
                            </div>

                            {parties.length === 0 ? (
                              <p className="text-[10px] text-zinc-400 text-center py-4">No registered political parties found</p>
                            ) : (
                              <div className="space-y-0.5">
                                {parties.map(p => {
                                  const isChecked = linkedPartyIds.includes(p.id);
                                  return (
                                    <div 
                                      key={p.id}
                                      onClick={() => {
                                        setLinkedPartyIds(prev => 
                                          prev.includes(p.id) 
                                            ? prev.filter(id => id !== p.id) 
                                            : [...prev, p.id]
                                        );
                                      }}
                                      className="flex items-center justify-between p-2 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 cursor-pointer text-xs"
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <div className={`w-3.5 h-3.5 border rounded flex items-center justify-center transition-all ${
                                          isChecked 
                                            ? 'bg-blue-650 border-blue-650 text-white' 
                                            : 'border-zinc-300 dark:border-zinc-700'
                                        }`}>
                                          {isChecked && <Check size={10} strokeWidth={3} />}
                                        </div>
                                        <span className="w-2 rounded-full h-2 shrink-0 animate-pulse" style={{ backgroundColor: p.color }} />
                                        <div className="flex flex-col text-left min-w-0">
                                          <span className="font-bold text-zinc-800 dark:text-zinc-200 truncate leading-none">{p.name}</span>
                                        </div>
                                      </div>
                                      
                                      <span 
                                        className="text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase font-mono"
                                        style={{ backgroundColor: `${p.color}15`, color: p.color }}
                                      >
                                        {p.abbreviation}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex justify-end gap-2 border-t border-zinc-150 dark:border-zinc-800 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-xl text-xs font-bold transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Save
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Survey Template Builder Modal */}
      <AnimatePresence>
        {isTemplateModalOpen && (
          <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsTemplateModalOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            />

            {/* Modal Box */}
            <div className="flex min-h-full items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl w-full max-w-4xl p-6 shadow-2xl space-y-5 overflow-hidden"
              >
                {/* Modal Title Row */}
                <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-4">
                  <div>
                    <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5 text-sm uppercase tracking-wide">
                      <Wrench className="w-4 h-4 text-purple-500" />
                      {editingTemplate ? 'Refine Questionnaire Template' : 'Design Questionnaire Template'}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-0.5">Configure reusable questionnaire forms and response fields for surveys</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(false)}
                    className="p-1.5 text-zinc-400 hover:text-zinc-650 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl cursor-pointer"
                  >
                    <X size={16} />
                  </button>
                </div>

                <form onSubmit={handleSaveTemplate} className="space-y-4">
                  {/* Template Meta Info Row */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Template Name *</label>
                      <input
                        type="text"
                        required
                        value={templateName}
                        onChange={e => setTemplateName(e.target.value)}
                        placeholder="e.g. Civic Feedback Template"
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs transition-all text-zinc-850 dark:text-white font-extrabold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Operational Description *</label>
                      <input
                        type="text"
                        required
                        value={templateDescription}
                        onChange={e => setTemplateDescription(e.target.value)}
                        placeholder="e.g. Dynamic voter checklist format..."
                        className="w-full px-3.5 py-2.5 bg-zinc-50 dark:bg-zinc-955 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-xs transition-all text-zinc-800 dark:text-white"
                      />
                    </div>
                  </div>

                  {/* Questionnaire Builder Division */}
                  <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Add/Build Fields Subform */}
                    <div className={`lg:col-span-5 p-4 border rounded-2xl space-y-3.5 transition-all ${
                      editingFieldIndex !== null 
                        ? 'bg-amber-50/20 dark:bg-amber-955/5 border-amber-300 dark:border-amber-800' 
                        : 'bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-850'
                    }`}>
                      <span className="text-[11px] font-black uppercase text-zinc-400 dark:text-zinc-500 tracking-wider flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-purple-500" /> 
                          {editingFieldIndex !== null ? 'Modify Question Field' : 'Component Field Designer'}
                        </span>
                        {editingFieldIndex !== null && (
                          <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-black uppercase tracking-normal">
                            Editing Q#{editingFieldIndex + 1}
                          </span>
                        )}
                      </span>

                      <div className="space-y-1">
                        <label className="text-[9px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase">Question / Input Label *</label>
                        <input
                          type="text"
                          value={fieldLabel}
                          onChange={e => setFieldLabel(e.target.value)}
                          placeholder="e.g. Which civic candidate do you prefer?"
                          className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-805 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-extrabold text-zinc-500 dark:text-zinc-400 uppercase">Response Type</label>
                          <select
                            value={fieldType}
                            onChange={e => setFieldType(e.target.value as SurveyField['type'])}
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-850 dark:text-white"
                          >
                            <option value="text">Short Text Response</option>
                            <option value="textarea">Large Paragraph Area</option>
                            <option value="number">Numeric Input</option>
                            <option value="scale">Rating Scale (1-10)</option>
                            <option value="checkbox">Yes/No Checkbox</option>
                            <option value="select">Dropdown Selection</option>
                            <option value="multiselect">Multi-Checklist Choices</option>
                          </select>
                        </div>

                        <div className="space-y-1 flex flex-col justify-end">
                          <label className="flex items-center gap-2 cursor-pointer py-2 select-none text-xs font-bold text-zinc-650 dark:text-zinc-400">
                            <input
                              type="checkbox"
                              checked={fieldRequired}
                              onChange={e => setFieldRequired(e.target.checked)}
                              className="rounded border-zinc-350 text-purple-650 focus:ring-purple-500 h-4.5 w-4.5 cursor-pointer"
                            />
                            Required Field
                          </label>
                        </div>
                      </div>

                      {/* Select/Multiselect choices comma separated */}
                      {(fieldType === 'select' || fieldType === 'multiselect') && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between">
                            <label className="text-[9px] font-extrabold text-zinc-500 dark:text-zinc-450 uppercase">Possible Answer Options *</label>
                            <span className="text-[8px] text-zinc-400">separated by commas</span>
                          </div>
                          <input
                            type="text"
                            value={fieldOptionsText}
                            onChange={e => setFieldOptionsText(e.target.value)}
                            placeholder="e.g. Satisfied, Neutral, Unsatisfied"
                            className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white font-semibold"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        {editingFieldIndex !== null && (
                          <button
                            type="button"
                            onClick={handleCancelFieldEdit}
                            className="flex-1 py-2.5 bg-zinc-105 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                          >
                            Cancel
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={handleAddField}
                          className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {editingFieldIndex !== null ? 'Update Item' : 'Add Question'}
                        </button>
                      </div>
                    </div>

                    {/* Show already configured checklist questions */}
                    <div className="lg:col-span-7 flex flex-col justify-between">
                      <div className="space-y-2">
                        <span className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center justify-between">
                          <span>Form Schema Overview ({templateFields.length} Questions)</span>
                          {templateFields.length === 0 && <span className="text-red-500 font-extrabold uppercase text-[9px]">At least 1 Field Required</span>}
                        </span>

                        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                          {templateFields.length === 0 ? (
                            <div className="border border-dashed border-zinc-200 dark:border-zinc-800 p-12 text-center rounded-2xl bg-zinc-50/50 dark:bg-zinc-950/20">
                              <p className="text-[11px] text-zinc-450 dark:text-zinc-500">No input components added yet. Use the Component Field Designer on the left to add questions.</p>
                            </div>
                          ) : (
                            templateFields.map((field, index) => (
                              <div 
                                key={field.id} 
                                className={`p-3 bg-zinc-50 dark:bg-zinc-950 border rounded-xl flex items-center justify-between gap-3 transition-colors ${
                                  editingFieldIndex === index 
                                    ? 'border-amber-300 bg-amber-50/10 dark:border-amber-900/40' 
                                    : 'border-zinc-205 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
                                }`}
                              >
                                <div className="min-w-0 flex-1 space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 shrink-0">#{index+1}</span>
                                    <span className="text-xs font-bold text-zinc-850 dark:text-zinc-200 truncate capitalize">{field.label}</span>
                                    {field.required && (
                                      <span className="text-[8px] font-black bg-amber-50 text-amber-600 dark:bg-amber-950/25 px-1.5 py-0.5 rounded border border-amber-200/50 shrink-0">
                                        Req
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[9px] font-mono text-zinc-405 uppercase tracking-wider">
                                    Format: {field.type} {field.options && field.options.length > 0 && `(${field.options.join(', ')})`}
                                  </p>
                                </div>
                                
                                <div className="flex items-center gap-1 shrink-0">
                                  {/* Reordering */}
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(index, 'up')}
                                    disabled={index === 0}
                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-805 rounded text-zinc-400 disabled:opacity-30 transition-all cursor-pointer"
                                    title="Move question up"
                                  >
                                    <ArrowUp size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleMoveField(index, 'down')}
                                    disabled={index === templateFields.length - 1}
                                    className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-805 rounded text-zinc-400 disabled:opacity-30 transition-all cursor-pointer"
                                    title="Move question down"
                                  >
                                    <ArrowDown size={12} />
                                  </button>
                                  
                                  {/* Edit / Trash */}
                                  <button
                                    type="button"
                                    onClick={() => handleEditField(index)}
                                    className="p-1 text-zinc-400 hover:text-purple-605 hover:bg-purple-100/30 rounded transition-colors cursor-pointer"
                                    title="Edit properties"
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveField(field.id)}
                                    className="p-1 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded transition-colors cursor-pointer"
                                    title="Remove from template"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Error logs inside template builder */}
                      {error && (
                        <div className="mt-2 text-[10px] font-extrabold text-red-500 p-2.5 bg-red-50 dark:bg-red-955/10 rounded-xl border border-red-105">
                          {error}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="flex justify-end gap-2 border-t border-zinc-150 dark:border-zinc-805 pt-4">
                    <button
                      type="button"
                      onClick={() => setIsTemplateModalOpen(false)}
                      className="px-4 py-2 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-700 dark:text-zinc-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Close Builder
                    </button>
                    <button
                      type="submit"
                      disabled={actionLoading}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      {actionLoading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          Publishing Layout...
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          Save Survey Template
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Dynamic Template Delete Confirmation Modal */}
      <AnimatePresence>
        {templateToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setTemplateToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 flex flex-col items-center text-center space-y-4 rounded-3xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 ring-8 ring-red-500/5">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Delete Questionnaire Template?</h3>
                <p className="text-sm text-zinc-550 mt-2">
                  Are you sure you want to remove the template <span className="font-bold text-zinc-900 dark:text-zinc-100">"{templateToDelete.name}"</span>? 
                  Any campaigns linked with this template will default to political sentiment. This action is permanent.
                </p>
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button 
                  onClick={() => setTemplateToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex-1 text-center cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteTemplate}
                  disabled={actionLoading}
                  className="px-4 py-2 bg-red-950 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md flex-1 text-[11px] text-center cursor-pointer"
                >
                  {actionLoading ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Trash2 size={14} />}
                  Delete Layout
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {surveyToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSurveyToDelete(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-8 flex flex-col items-center text-center space-y-4 rounded-3xl w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center text-red-500 ring-8 ring-red-500/5">
                <Trash2 size={32} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Delete Survey Campaign?</h3>
                <p className="text-sm text-zinc-500 mt-2">
                  Are you sure you want to remove the survey campaign <span className="font-bold text-zinc-900 dark:text-zinc-100">"{surveyToDelete.title}"</span>? 
                  This will delete the campaign template and assignment associations. This action is permanent.
                </p>
              </div>
              <div className="flex w-full gap-3 pt-2">
                <button 
                  onClick={() => setSurveyToDelete(null)}
                  className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex-1 text-center"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleDeleteSurvey}
                  disabled={deletingSurvey}
                  className="px-4 py-2 bg-red-950 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md flex-1 text-[11px] text-center"
                >
                  {deletingSurvey ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Trash2 size={14} />}
                  Delete Record
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}


