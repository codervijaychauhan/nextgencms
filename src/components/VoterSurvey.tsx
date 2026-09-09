import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, 
  Search, 
  Loader2, 
  CheckCircle, 
  AlertCircle,
  BarChart3,
  MessageSquare,
  UserPlus,
  Plus,
  X,
  Target,
  Send,
  Flag,
  Calendar,
  ThumbsUp,
  ThumbsDown,
  Info,
  Download,
  Trash2,
  RefreshCw,
  TrendingUp,
  SlidersHorizontal,
  Smile,
  Meh,
  Frown,
  ClipboardList,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../AuthProvider';

interface Voter {
  id: string;
  voterId: string;
  name: string;
  relationName?: string;
  constituencyId: string;
  boothId: string;
  stateId?: string;
  districtId?: string;
  village?: string;
  mobile?: string;
  email?: string;
  gender?: string;
  age?: number;
  caste?: string;
  isKaryakarta?: boolean;
  voted?: boolean;
  education?: string;
}

interface Election {
  id: string;
  year: number;
  title?: string;
  status: string;
}

interface Party {
  id: string;
  name: string;
  abbreviation: string;
  color?: string;
}

interface Sentiment {
  id: string;
  voterDocId?: string;
  voterName: string;
  favoredPartyId?: string;
  favoredPartyName: string;
  sentimentScore: number;
  electionYear: number;
  createdAt?: any;
  surveyId?: string;
  surveyTitle?: string;
  recordedBy?: string;
  recordedByName?: string;
  keyConcerns?: string[];
  stateId?: string;
  districtId?: string;
  constituencyId?: string;
  boothId?: string;
  mobile?: string;
  email?: string;
  aadharNumber?: string;
  customAnswers?: Record<string, unknown>;
}

interface CampaignSurvey {
  id: string;
  title: string;
  description: string;
  electionId: string;
  electionYear: number;
  assignedTo: string[];
  status: 'Draft' | 'Active' | 'Completed';
  linkedPartyIds?: string[];
  templateId?: string;
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
  isSystem: boolean;
  fields: SurveyField[];
}

const POLITICAL_SENTIMENT_TEMPLATE: SurveyTemplate = {
  id: 'political_sentiment',
  name: 'Political Sentiment Template',
  description: 'Built-in default survey template for political alignment checks.',
  isSystem: true,
  fields: []
};

const COMMON_CONCERNS = [
  'Development',
  'Inflation',
  'Employment',
  'Education',
  'Healthcare',
  'Agriculture',
  'Infrastructure',
  'Water Supply',
  'Electricity',
  'Law & Order'
];

export default function VoterSurvey() {
  const { user, isAdmin, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Assigned/All Surveys state
  const [assignedSurveys, setAssignedSurveys] = useState<CampaignSurvey[]>([]);
  const [allSurveys, setAllSurveys] = useState<CampaignSurvey[]>([]);
  const [activeSurvey, setActiveSurvey] = useState<CampaignSurvey | null>(null);

  // Templates & answers state
  const [templates, setTemplates] = useState<SurveyTemplate[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, unknown>>({});

  // Dynamic template checks
  const isCustomTemplate = activeSurvey && activeSurvey.templateId && activeSurvey.templateId !== 'political_sentiment';

  // Permission helper
  const hasRight = (moduleId: string, right: string) => {
    if (isAdmin) return true;
    const perms = profile?.permissions?.[moduleId] || '';
    return perms.includes(right);
  };

  // Search States
  const [voterSearch, setVoterSearch] = useState('');
  const [voters, setVoters] = useState<Voter[]>([]);
  const [searchingVoters, setSearchingVoters] = useState(false);
  const [selectedVoter, setSelectedVoter] = useState<Voter | null>(null);

  // Form States
  const [elections, setElections] = useState<Election[]>([]);
  const [selectedElection, setSelectedElection] = useState<string>('');
  const [parties, setParties] = useState<Party[]>([]);
  const [supportingParty, setSupportingParty] = useState<string>('');
  const [sentimentScore, setSentimentScore] = useState<number>(3);
  const [concerns, setConcerns] = useState<string[]>([]);
  const [otherConcern, setOtherConcern] = useState('');

  // Recent Sentiments
  const [recentSentiments, setRecentSentiments] = useState<Sentiment[]>([]);

  // Report and View States
  const [activeView, setActiveView] = useState<'record' | 'report'>('record');
  const [allSentiments, setAllSentiments] = useState<Sentiment[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [totalAssignedVotersCount, setTotalAssignedVotersCount] = useState<number>(0);

  // Report Filter States
  const [yearFilter, setYearFilter] = useState('');
  const [partyFilter, setPartyFilter] = useState('');
  const [sentimentFilter, setSentimentFilter] = useState('');
  const [reportSearchText, setReportSearchText] = useState('');
  const [surveyFilter, setSurveyFilter] = useState('');
  const [customFilters, setCustomFilters] = useState<Record<string, string>>({});
  const [votersMap, setVotersMap] = useState<Record<string, Voter>>({});

  // Computed Report Template variables
  const selectedReportSurvey = assignedSurveys.find(s => s.id === surveyFilter);
  const isReportCustomTemplate = selectedReportSurvey && selectedReportSurvey.templateId && selectedReportSurvey.templateId !== 'political_sentiment';
  const reportTemplate = selectedReportSurvey ? templates.find(t => t.id === selectedReportSurvey.templateId) : null;

  // Dropdown states for Survey Form & Reports Selection
  const [formDropdownOpen, setFormDropdownOpen] = useState(false);
  const [formSearchText, setFormSearchText] = useState('');
  const [reportDropdownOpen, setReportDropdownOpen] = useState(false);
  const [reportDropdownSearchText, setReportDropdownSearchText] = useState('');

  // Edit Sentiment States
  const [editingSentiment, setEditingSentiment] = useState<Sentiment | null>(null);
  const [editSupportingParty, setEditSupportingParty] = useState<string>('');
  const [editSentimentScore, setEditSentimentScore] = useState<number>(3);
  const [editConcerns, setEditConcerns] = useState<string[]>([]);
  const [editOtherConcern, setEditOtherConcern] = useState('');
  const [editCustomAnswers, setEditCustomAnswers] = useState<Record<string, unknown>>({});
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete Sentiment States
  const [sentimentToDelete, setSentimentToDelete] = useState<Sentiment | null>(null);
  const [deletingSentiment, setDeletingSentiment] = useState(false);

  // Already Responded constraints
  const [checkingVoterResponse, setCheckingVoterResponse] = useState(false);
  const [voterAlreadyResponded, setVoterAlreadyResponded] = useState(false);

  useEffect(() => {
    if (!selectedVoter || !activeSurvey) {
      setVoterAlreadyResponded(false);
      return;
    }
    
    let isMounted = true;
    const checkVoterSurveyResponse = async () => {
      setCheckingVoterResponse(true);
      setError('');
      try {
        const sentiments = await apiFetch<Sentiment[]>(`/api/voter-sentiments?voterDocId=${selectedVoter.id}`).catch(() => []);
        if (!isMounted) return;
        const hasResponded = (sentiments || []).some(doc => doc.surveyId === activeSurvey.id);
        setVoterAlreadyResponded(hasResponded);
        if (hasResponded) {
          setError(`This voter has already responded to the "${activeSurvey.title}" survey campaign. A voter can only respond to a given campaign once.`);
        }
      } catch (err) {
        console.error('Error checking voter survey response:', err);
      } finally {
        if (isMounted) {
          setCheckingVoterResponse(false);
        }
      }
    };

    checkVoterSurveyResponse();
    return () => {
      isMounted = false;
    };
  }, [selectedVoter, activeSurvey]);

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    const trimmed = voterSearch.trim();
    if (!trimmed) {
      setVoters([]);
      setError('');
      return;
    }
    const delayDebounce = setTimeout(() => {
      searchVoters(trimmed);
    }, 450);

    return () => clearTimeout(delayDebounce);
  }, [voterSearch]);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // Fetch surveys first
      const surveyList = await apiFetch<CampaignSurvey[]>('/api/surveys').catch(() => []);
      setAllSurveys(surveyList || []);
      
      const activeUserSurveys = (surveyList || []).filter(s => 
        s.status === 'Active' && (isAdmin || !s.assignedTo?.length || s.assignedTo?.includes(user?.uid || ''))
      );
      
      setAssignedSurveys(activeUserSurveys);
      let defaultElectionId = '';

      if (activeUserSurveys.length > 0) {
        const chosen = activeUserSurveys[0];
        setActiveSurvey(chosen);
        setSurveyFilter(chosen.id);
        if (chosen.electionId) {
          defaultElectionId = chosen.electionId;
        }
      } else {
        setActiveSurvey(null);
        setSurveyFilter('');
      }

      // Fetch active/upcoming elections
      const electionList = await apiFetch<Election[]>('/api/elections').catch(() => []);
      setElections(electionList || []);
      
      if (defaultElectionId) {
        setSelectedElection(defaultElectionId);
      } else if (electionList && electionList.length > 0) {
        setSelectedElection(electionList[0].id);
      }

      // Fetch parties
      const partyList = await apiFetch<Party[]>('/api/parties').catch(() => []);
      setParties(partyList || []);

      // Fetch survey templates
      const templateList = await apiFetch<SurveyTemplate[]>('/api/surveys/templates').catch(() => []);
      const customTemplates = (templateList || []).filter(t => t.id !== 'political_sentiment');
      setTemplates([POLITICAL_SENTIMENT_TEMPLATE, ...customTemplates]);

      // Fetch voters
      const votersRes = await apiFetch<{ data: Voter[] }>('/api/voters?limit=500').catch(() => ({ data: [] }));
      const votersList = votersRes?.data || [];
      setTotalAssignedVotersCount(votersList.length);

      const vMap: Record<string, Voter> = {};
      votersList.forEach(v => {
        vMap[v.id] = v;
      });
      setVotersMap(vMap);

      // Fetch recent sentiments with the immediate active user surveys list
      fetchRecentSentiments(activeUserSurveys);
    } catch (err) {
      console.error(err);
      setError('Failed to load initial data');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentSentiments = async (surveysListParam?: CampaignSurvey[]) => {
    try {
      const rawList = await apiFetch<Sentiment[]>('/api/voter-sentiments').catch(() => []);
      const referenceSurveys = surveysListParam !== undefined ? surveysListParam : assignedSurveys;
      const assignedSurveyIds = referenceSurveys.map(s => s.id);
      
      const filteredList = (rawList || []).filter(s => {
        if (!isAdmin && assignedSurveyIds.length > 0) {
          if (s.surveyId && !assignedSurveyIds.includes(s.surveyId)) return false;
        }
        return true;
      });
      
      setRecentSentiments(filteredList.slice(0, 5));
    } catch (err) {
      console.error('Error fetching recent sentiments', err);
    }
  };

  const fetchAllSentiments = async () => {
    setReportLoading(true);
    setError('');
    try {
      const surveyList = await apiFetch<CampaignSurvey[]>('/api/surveys').catch(() => []);
      setAllSurveys(surveyList || []);
      
      const activeUserSurveys = (surveyList || []).filter(s => 
        isAdmin || !s.assignedTo?.length || s.assignedTo?.includes(user?.uid || '')
      );
      const assignedSurveyIds = activeUserSurveys.map(s => s.id);

      const list = await apiFetch<Sentiment[]>('/api/voter-sentiments').catch(() => []);
      const filteredList = (list || []).filter(s => {
        if (!isAdmin && assignedSurveyIds.length > 0) {
          if (s.surveyId && !assignedSurveyIds.includes(s.surveyId)) return false;
        }
        return true;
      });

      const votersRes = await apiFetch<{ data: Voter[] }>('/api/voters?limit=500').catch(() => ({ data: [] }));
      const votersList = votersRes?.data || [];
      setTotalAssignedVotersCount(votersList.length);

      const vMap: Record<string, Voter> = {};
      votersList.forEach(v => {
        vMap[v.id] = v;
      });
      setVotersMap(vMap);

      setAllSentiments(filteredList);
      setAssignedSurveys(activeUserSurveys);
      if (!surveyFilter && activeUserSurveys.length > 0) {
        setSurveyFilter(activeUserSurveys[0].id);
      }
    } catch (err) {
      console.error('Error fetching sentiments', err);
      setError('Failed to load survey report responses. Verify permissions.');
    } finally {
      setReportLoading(false);
    }
  };

  const handleDeleteSentiment = async () => {
    if (!sentimentToDelete) return;
    setDeletingSentiment(true);
    setError('');
    try {
      await apiFetch(`/api/voter-sentiments/${sentimentToDelete.id}`, { method: 'DELETE' });
      setAllSentiments(prev => prev.filter(s => s.id !== sentimentToDelete.id));
      setRecentSentiments(prev => prev.filter(s => s.id !== sentimentToDelete.id));
      setSuccess('Response deleted successfully');
      setSentimentToDelete(null);
      setTimeout(() => setSuccess(''), 3000);
      fetchRecentSentiments();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to delete response. Verify permissions.');
    } finally {
      setDeletingSentiment(false);
    }
  };

  const canDelete = (s: Sentiment) => {
    return isAdmin || s.recordedBy === user?.uid || hasRight('surveys', 'd');
  };

  const canEdit = (s: Sentiment) => {
    return isAdmin || s.recordedBy === user?.uid || hasRight('surveys', 'u');
  };

  const handleStartEdit = (s: Sentiment) => {
    setEditingSentiment(s);
    setEditSupportingParty(s.favoredPartyId || '');
    setEditSentimentScore(s.sentimentScore);
    setEditConcerns(s.keyConcerns || []);
    setEditOtherConcern('');
    setEditCustomAnswers(s.customAnswers || {});
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSentiment) return;
    setSavingEdit(true);
    setError('');
    
    try {
      const editedDocSurvey = allSurveys.find(as => as.id === editingSentiment.surveyId) || assignedSurveys.find(as => as.id === editingSentiment.surveyId);
      const isEditedDocCustomTemplate = editedDocSurvey && editedDocSurvey.templateId && editedDocSurvey.templateId !== 'political_sentiment';

      const party = editSupportingParty === 'none' 
        ? { name: 'Undecided / No Favor' }
        : editSupportingParty === 'others'
          ? { name: 'Others' }
          : parties.find(p => p.id === editSupportingParty);
          
      const updatedFields = {
        id: editingSentiment.id,
        voter_id: editingSentiment.voterDocId,
        voter_name: editingSentiment.voterName,
        favoredPartyId: isEditedDocCustomTemplate ? 'none' : editSupportingParty,
        favoredPartyName: isEditedDocCustomTemplate ? 'Undecided / No Favor' : (party?.name || ''),
        sentimentScore: isEditedDocCustomTemplate ? 3 : Number(editSentimentScore),
        keyConcerns: isEditedDocCustomTemplate ? [] : editConcerns,
        customAnswers: isEditedDocCustomTemplate ? editCustomAnswers : (editingSentiment.customAnswers || {})
      };
      
      await apiFetch('/api/voter-sentiments', {
        method: 'POST',
        body: JSON.stringify(updatedFields)
      });
      
      // Update local states synchronously
      setAllSentiments(prev => prev.map(s => s.id === editingSentiment.id 
        ? { 
            ...s, 
            favoredPartyId: isEditedDocCustomTemplate ? 'none' : editSupportingParty, 
            favoredPartyName: isEditedDocCustomTemplate ? 'Undecided / No Favor' : (party?.name || ''),
            sentimentScore: isEditedDocCustomTemplate ? 3 : Number(editSentimentScore),
            keyConcerns: isEditedDocCustomTemplate ? [] : editConcerns,
            customAnswers: isEditedDocCustomTemplate ? editCustomAnswers : (s.customAnswers || {})
          } 
        : s
      ));
      
      setRecentSentiments(prev => prev.map(s => s.id === editingSentiment.id 
        ? { 
            ...s, 
            favoredPartyId: isEditedDocCustomTemplate ? 'none' : editSupportingParty, 
            favoredPartyName: isEditedDocCustomTemplate ? 'Undecided / No Favor' : (party?.name || ''),
            sentimentScore: isEditedDocCustomTemplate ? 3 : Number(editSentimentScore),
            keyConcerns: isEditedDocCustomTemplate ? [] : editConcerns,
            customAnswers: isEditedDocCustomTemplate ? editCustomAnswers : (s.customAnswers || {})
          } 
        : s
      ));
      
      setSuccess('Survey response updated successfully!');
      setEditingSentiment(null);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to update survey response. Check permissions.');
    } finally {
      setSavingEdit(false);
    }
  };

  const toggleEditConcern = (concern: string) => {
    setEditConcerns(prev => 
      prev.includes(concern) ? prev.filter(c => c !== concern) : [...prev, concern]
    );
  };

  const searchVoters = async (searchTermParam?: string) => {
    const termToSearch = (searchTermParam !== undefined ? searchTermParam : voterSearch).trim();
    if (!termToSearch) {
      setVoters([]);
      return;
    }
    setSearchingVoters(true);
    setError('');

    try {
      const res = await apiFetch<{ data: Voter[] }>(`/api/voters?search=${encodeURIComponent(termToSearch)}&limit=10`);
      const results = (res?.data || []).map((v: any) => ({
        ...v,
        voterId: v.voter_id || v.voterId,
        relationName: v.relation_name || v.relationName,
        boothId: v.booth_id || v.boothId,
        constituencyId: v.constituency_id || v.constituencyId,
        stateId: v.state_id || v.stateId,
        districtId: v.district_id || v.districtId
      }));
      setVoters(results);
      if (results.length === 0) {
        setError('No voters found matching your search. Try EPIC ID or name.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Voter search failed. Please check your connection.');
    } finally {
      setSearchingVoters(false);
    }
  };

  const handleSurveySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVoter || !selectedElection || (!isCustomTemplate && !supportingParty)) {
      setError(isCustomTemplate ? 'Please select voter and election' : 'Please select voter, election and party');
      return;
    }

    if (voterAlreadyResponded) {
      setError(`This voter has already responded to the "${activeSurvey?.title || 'current'}" survey campaign.`);
      return;
    }

    const election = elections.find(e => e.id === selectedElection);
    const party = parties.find(p => p.id === supportingParty);

    const sentimentData = {
      voterDocId: selectedVoter.id,
      voterName: selectedVoter.name,
      aadharNumber: (selectedVoter as any).aadharNumber || (selectedVoter as any).aadhar_number || '',
      mobile: selectedVoter.mobile || '',
      email: selectedVoter.email || '',
      electionId: selectedElection,
      electionYear: election?.year || 0,
      favoredPartyId: isCustomTemplate ? 'none' : supportingParty,
      favoredPartyName: isCustomTemplate ? 'Undecided / No Favor' : (party?.name || ''),
      sentimentScore: isCustomTemplate ? 3 : Number(sentimentScore),
      keyConcerns: isCustomTemplate ? [] : concerns,
      stateId: selectedVoter.stateId || '',
      districtId: selectedVoter.districtId || '',
      constituencyId: selectedVoter.constituencyId || '',
      boothId: selectedVoter.boothId || '',
      recordedBy: user?.uid || '',
      recordedByName: user?.displayName || user?.email || 'Staff',
      surveyId: activeSurvey?.id || '',
      surveyTitle: activeSurvey?.title || '',
      customAnswers: customAnswers || {}
    };

    setLoading(true);
    try {
      await apiFetch('/api/voter-sentiments', {
        method: 'POST',
        body: JSON.stringify(sentimentData)
      });
      setSuccess('Sentiment recorded successfully!');
      // Reset form
      setSelectedVoter(null);
      setVoterSearch('');
      setVoters([]);
      setSupportingParty('');
      setSentimentScore(3);
      setConcerns([]);
      setCustomAnswers({});
      fetchRecentSentiments();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err?.message || 'Failed to submit survey');
    } finally {
      setLoading(false);
    }
  };

  const toggleConcern = (concern: string) => {
    setConcerns(prev => 
      prev.includes(concern) ? prev.filter(c => c !== concern) : [...prev, concern]
    );
  };

  // Filtered sentiments list for report
  const filteredSentiments = allSentiments.filter(s => {
    const matchSurvey = !surveyFilter 
      ? true 
      : surveyFilter === 'general_manual_sentiments' 
        ? !s.surveyId 
        : s.surveyId === surveyFilter;
    
    // Core search by voter name
    const matchSearch = !reportSearchText.trim() || s.voterName.toLowerCase().includes(reportSearchText.toLowerCase());
    
    if (!matchSurvey || !matchSearch) return false;

    if (isReportCustomTemplate && reportTemplate) {
      // Dynamic filters according to each custom survey template field
      for (const field of reportTemplate.fields) {
        const filterVal = customFilters[field.id];
        if (filterVal) {
          const ans = s.customAnswers?.[field.id];
          if (field.type === 'checkbox') {
            const isChecked = !!ans;
            const expected = filterVal === 'true';
            if (isChecked !== expected) return false;
          } else if (field.type === 'scale' || field.type === 'select') {
            if (ans === undefined || ans === null || String(ans) !== filterVal) {
              return false;
            }
          } else if (field.type === 'multiselect') {
            const arr = Array.isArray(ans) ? ans : [];
            if (!arr.includes(filterVal)) return false;
          } else {
            // text or number search
            if (ans === undefined || ans === null || !String(ans).toLowerCase().includes(filterVal.toLowerCase())) {
              return false;
            }
          }
        }
      }
      return true;
    } else {
      // Standard political sentiment filters
      const matchYear = !yearFilter || s.electionYear === Number(yearFilter);
      const matchParty = !partyFilter || s.favoredPartyId === partyFilter;
      const matchSentiment = !sentimentFilter || s.sentimentScore === Number(sentimentFilter);
      return matchYear && matchParty && matchSentiment;
    }
  });

  const filteredFormSurveys = assignedSurveys.filter(s =>
    s.title.toLowerCase().includes(formSearchText.toLowerCase()) ||
    (s.description || '').toLowerCase().includes(formSearchText.toLowerCase())
  );

  const handleExportCSV = () => {
    if (filteredSentiments.length === 0) return;
    
    // Headers
    const headers = isReportCustomTemplate
      ? [
          'Voter Name', 'EPIC ID', 'Mobile', 'Father/Husband Name', 'Age', 'Gender', 'Village', 
          'Campaign Survey', 'Election Year', 
          ...(reportTemplate?.fields || []).map(f => f.label), 
          'Recorded By', 'Date'
        ]
      : [
          'Voter Name', 'EPIC ID', 'Mobile', 'Email', 'Father/Husband Name', 'Age', 'Gender', 'Village',
          'Campaign Survey', 'Sentiment Strength', 'Supporting Party', 'Election Year', 'Key Concerns', 
          'Recorded By', 'Date'
        ];
    
    // Rows
    const rows = filteredSentiments.map(s => {
      const vDetail = s.voterDocId ? votersMap[s.voterDocId] : null;
      const voterId = vDetail?.voterId || '';
      const mobile = vDetail?.mobile || s.mobile || '';
      const email = vDetail?.email || s.email || '';
      const relationName = vDetail?.relationName || '';
      const age = vDetail?.age ? String(vDetail.age) : '';
      const gender = vDetail?.gender || '';
      const village = vDetail?.village || '';
      const surveyTitle = s.surveyTitle || 'General Sentiment';
      const electionYear = s.electionYear || '';
      const recordedBy = s.recordedByName || s.recordedBy || 'Staff';
      const createdAt = s.createdAt ? new Date(s.createdAt.toDate()).toLocaleDateString() : 'N/A';

      const commonPrefix = [
        `"${s.voterName.replace(/"/g, '""')}"`,
        `"${voterId.replace(/"/g, '""')}"`,
        `"${mobile.replace(/"/g, '""')}"`,
        `"${email.replace(/"/g, '""')}"`,
        `"${relationName.replace(/"/g, '""')}"`,
        `"${age.replace(/"/g, '""')}"`,
        `"${gender.replace(/"/g, '""')}"`,
        `"${village.replace(/"/g, '""')}"`,
        `"${surveyTitle.replace(/"/g, '""')}"`,
        `"${String(electionYear).replace(/"/g, '""')}"`
      ];

      if (isReportCustomTemplate) {
        const customCells = (reportTemplate?.fields || []).map(f => {
          const val = s.customAnswers?.[f.id];
          const valStr = Array.isArray(val)
            ? val.join(', ')
            : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (val !== undefined && val !== null ? String(val) : ''));
          return `"${valStr.replace(/"/g, '""')}"`;
        });
        return [
          ...commonPrefix,
          ...customCells,
          `"${recordedBy.replace(/"/g, '""')}"`,
          `"${createdAt.replace(/"/g, '""')}"`
        ];
      } else {
        const sentimentStr = s.sentimentScore ? `${s.sentimentScore * 20}%` : '';
        const supportingPartyStr = s.favoredPartyName || '';
        const keyConcernsStr = (s.keyConcerns || []).join(', ');
        
        return [
          ...commonPrefix,
          `"${sentimentStr.replace(/"/g, '""')}"`,
          `"${supportingPartyStr.replace(/"/g, '""')}"`,
          `"${keyConcernsStr.replace(/"/g, '""')}"`,
          `"${recordedBy.replace(/"/g, '""')}"`,
          `"${createdAt.replace(/"/g, '""')}"`
        ];
      }
    });
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Survey_Report_Export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!hasRight('surveys', 'v')) {
    return (
      <div className="flex flex-col items-center justify-center py-24 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center max-w-lg mx-auto shadow-sm mt-8">
        <BarChart3 className="text-zinc-300 dark:text-zinc-700 w-16 h-16 min-h-16 mb-4" />
        <h3 className="text-base font-black text-zinc-900 dark:text-white">Permission Required</h3>
        <p className="text-zinc-500 text-xs mt-1.5 leading-relaxed">
          You do not have view permissions for <strong className="font-semibold text-zinc-700 dark:text-zinc-300">Voter Survey</strong>. Please contact your Super Admin to obtain permission.
        </p>
      </div>
    );
  }

  const currentSurveyTemplate = activeSurvey ? templates.find(t => t.id === activeSurvey.templateId) : null;

  const updateCustomAnswer = (fieldId: string, value: unknown) => {
    setCustomAnswers(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 w-full max-w-full min-w-0 mx-auto">
      {/* Dynamic Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-purple-500" />
            Survey
          </h1>
          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Record and analyze voter feedback for upcoming elections</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900/50 p-1.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 self-start">
          <button
            onClick={() => setActiveView('record')}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all ${
              activeView === 'record'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            Record Survey
          </button>
          <button
            onClick={() => {
              setActiveView('report');
              fetchAllSentiments();
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 ${
              activeView === 'report'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            Survey Reports
          </button>
        </div>
      </div>

      {activeView === 'record' ? (
        !activeSurvey ? (
          <div className="flex flex-col items-center justify-center p-16 text-center border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm max-w-xl mx-auto space-y-4 my-10">
            <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-450">
              <ClipboardList className="w-8 h-8 text-zinc-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-base font-bold text-zinc-900 dark:text-white mt-2">No Active Surveys Assigned</h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
                There are no active field voter surveys assigned to your account. 
                Please contact your campaign administrator to assign a survey under the Administration Section.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Main Survey Form */}
            <div className="lg:col-span-2 space-y-6">
          <form onSubmit={handleSurveySubmit} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Choose Campaign Section inside the Form card */}
            <div className="space-y-4 pb-5 border-b border-zinc-100 dark:border-zinc-800/60 relative">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black uppercase text-zinc-450 dark:text-zinc-500 tracking-wider flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-blue-500" />
                  1. Select Active Survey Campaign Form
                </label>
                <span className="text-[10px] bg-blue-500/10 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400 font-extrabold px-2 py-0.5 rounded-full select-none">
                  {assignedSurveys.length} campaigns
                </span>
              </div>
              
              {/* Custom Searchable Dropdown Selector */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setFormDropdownOpen(!formDropdownOpen)}
                  className="w-full text-left px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border-2 border-zinc-100 dark:border-zinc-800/80 rounded-xl hover:bg-zinc-100/50 dark:hover:bg-zinc-900 transition-all flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <div className="min-w-0">
                    {activeSurvey ? (
                      <div className="flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 capitalize truncate">
                          {activeSurvey.title}
                        </span>
                      </div>
                    ) : (
                      <span className="text-sm text-zinc-450 dark:text-zinc-500">
                        Choose a Campaign Survey...
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-500 hidden sm:inline">
                      {activeSurvey ? 'Selected' : 'Click to select'}
                    </span>
                    {formDropdownOpen ? (
                      <ChevronUp className="w-4 h-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                </button>

                {formDropdownOpen && (
                  <>
                    {/* Click-away overlay backdrop */}
                    <div className="fixed inset-0 z-30" onClick={() => setFormDropdownOpen(false)} />
                    
                    {/* Floating dropdown overlay frame */}
                    <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl shadow-xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Search box inside campaign selector list */}
                      <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/25 flex items-center gap-2">
                        <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <input
                          type="text"
                          value={formSearchText}
                          onChange={(e) => setFormSearchText(e.target.value)}
                          placeholder="Search campaigns by title or description..."
                          className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 outline-none placeholder:text-zinc-400"
                          onClick={(e) => e.stopPropagation()}
                        />
                        {formSearchText && (
                          <button
                            type="button"
                            onClick={() => setFormSearchText('')}
                            className="text-zinc-400 hover:text-zinc-650"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>

                      {/* Display of surveys matching terms */}
                      <div className="max-h-60 overflow-y-auto custom-scrollbar">
                        {filteredFormSurveys.length === 0 ? (
                          <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-550">
                            No campaigns match the search criteria
                          </div>
                        ) : (
                          filteredFormSurveys.map(s => {
                            const isSelected = activeSurvey && activeSurvey.id === s.id;
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setActiveSurvey(s);
                                  if (s.electionId) setSelectedElection(s.electionId);
                                  setFormDropdownOpen(false);
                                  setFormSearchText('');
                                }}
                                className={`w-full text-left p-3 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800/50 transition-all flex items-start gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                  isSelected ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                                }`}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize truncate">
                                      {s.title}
                                    </h4>
                                    {isSelected && (
                                      <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded uppercase font-sans shrink-0">
                                        Selected
                                      </span>
                                    )}
                                  </div>
                                  {s.description && (
                                    <p className="text-[10px] text-zinc-450 dark:text-zinc-500 truncate mt-1 line-clamp-1">
                                      {s.description}
                                    </p>
                                  )}
                                </div>
                                {isSelected ? (
                                  <CheckCircle className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0 self-center" />
                                ) : (
                                  <div className="w-4 h-4 border border-zinc-300 dark:border-zinc-700 rounded-full shrink-0 self-center" />
                                )}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Selected Campaign Description Block (Always visible for clarity) */}
              {activeSurvey && (
                <div className="bg-blue-50/20 dark:bg-blue-950/5 border border-blue-100 dark:border-blue-900/20 rounded-xl p-4 flex gap-3 text-left">
                  <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-600 shrink-0">
                    <ClipboardList className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-xs font-black text-zinc-900 dark:text-zinc-100 capitalize">
                        {activeSurvey.title}
                      </h4>
                      <span className="text-[8px] tracking-wider font-extrabold px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 uppercase rounded">
                        Form Active
                      </span>
                    </div>
                    {activeSurvey.description && (
                      <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400 mt-1 max-w-xl">
                        {activeSurvey.description}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

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

            {/* Voter Search Section */}
            <div className="space-y-4">
              <label className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4" />
                Select Voter
              </label>
              
              {!selectedVoter ? (
                <div className="space-y-3">
                  <div className="relative">
                    <input
                      type="text"
                      value={voterSearch}
                      onChange={(e) => setVoterSearch(e.target.value)}
                      placeholder="Search instantly by name or EPIC ID..."
                      className="w-full pl-10 pr-16 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), searchVoters(voterSearch))}
                    />
                    <Search className="absolute left-3 top-3.5 w-4 h-4 text-zinc-400" />
                    <div className="absolute right-3 top-2.5 flex items-center">
                      {searchingVoters ? (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      ) : voterSearch ? (
                        <button
                          type="button"
                          onClick={() => {
                            setVoterSearch('');
                            setVoters([]);
                          }}
                          className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors"
                          title="Clear search"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {voters.length > 0 && (
                    <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
                      {voters.map(v => (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVoter(v)}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors text-left"
                        >
                          <div>
                            <p className="font-medium text-zinc-900 dark:text-white">{v.name}</p>
                            <p className="text-xs text-zinc-500">{v.voterId} {v.relationName ? `• F/H: ${v.relationName}` : ''} • {v.village || 'No Village'}</p>
                          </div>
                          <UserPlus className="w-4 h-4 text-blue-500" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-4 rounded-xl flex items-center justify-between border ${
                  voterAlreadyResponded 
                    ? 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30' 
                    : 'bg-blue-50 dark:bg-blue-900/10 border-blue-100 dark:border-blue-900/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                      voterAlreadyResponded ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {selectedVoter.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-zinc-900 dark:text-white">{selectedVoter.name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {selectedVoter.voterId} • {selectedVoter.mobile || 'No Mobile'}
                      </p>
                      {voterAlreadyResponded && (
                        <p className="text-xs text-red-600 dark:text-red-400 font-semibold mt-1 flex items-center gap-1">
                          <AlertCircle size={14} className="flex-shrink-0" />
                          Already responded to this survey
                        </p>
                      )}
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setSelectedVoter(null)}
                    className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <label className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Election Cycle
                </label>
                <select
                  value={selectedElection}
                  onChange={(e) => setSelectedElection(e.target.value)}
                  className="w-full px-4 py-2.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none text-zinc-500 dark:text-zinc-400 cursor-not-allowed"
                  required
                  disabled={true}
                >
                  {elections.map(ele => (
                    <option key={ele.id} value={ele.id}>{ele.title || `${ele.year} Election`} ({ele.status})</option>
                  ))}
                </select>
              </div>

              {!isCustomTemplate && (
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Flag className="w-4 h-4" />
                    Supporting Party
                  </label>
                  <select
                    value={supportingParty}
                    onChange={(e) => setSupportingParty(e.target.value)}
                    className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  >
                    <option value="">Select Party</option>
                    {parties.map(p => (
                      <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                    ))}
                    <option value="none">Undecided / No Favor</option>
                    <option value="others">Others</option>
                  </select>
                </div>
              )}
            </div>

            {!isCustomTemplate && (
              <>
                {/* Sentiment Score Slider */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Target className="w-4 h-4" />
                      Sentiment Strength
                    </label>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      sentimentScore >= 4 ? 'bg-emerald-100 text-emerald-700' :
                      sentimentScore <= 2 ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {sentimentScore === 1 ? 'Strongly Opposed' :
                       sentimentScore === 2 ? 'Slightly Opposed' :
                       sentimentScore === 3 ? 'Neutral / Lean' :
                       sentimentScore === 4 ? 'Supporting' :
                       'Strong Support'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="5"
                    step="1"
                    value={sentimentScore}
                    onChange={(e) => setSentimentScore(Number(e.target.value))}
                    className="w-full h-2 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-400 font-medium px-1">
                    <span>OPPOSED</span>
                    <span>NEUTRAL</span>
                    <span>SUPPORTIVE</span>
                  </div>
                </div>

                {/* Concerns Multi-select */}
                <div className="space-y-4">
                  <label className="text-sm font-semibold text-zinc-900 dark:text-white flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Key Concerns
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {COMMON_CONCERNS.map(concern => (
                      <button
                        key={concern}
                        type="button"
                        onClick={() => toggleConcern(concern)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                          concerns.includes(concern)
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'bg-zinc-50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                        }`}
                      >
                        {concern}
                      </button>
                    ))}
                    
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={otherConcern}
                        onChange={(e) => setOtherConcern(e.target.value)}
                        placeholder="Other..."
                        className="px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-blue-500 w-24"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && otherConcern.trim()) {
                            e.preventDefault();
                            if (!concerns.includes(otherConcern.trim())) {
                              setConcerns([...concerns, otherConcern.trim()]);
                            }
                            setOtherConcern('');
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (otherConcern.trim()) {
                            if (!concerns.includes(otherConcern.trim())) {
                              setConcerns([...concerns, otherConcern.trim()]);
                            }
                            setOtherConcern('');
                          }
                        }}
                        className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-xl"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Dynamic Template Questions Layout */}
            {currentSurveyTemplate && currentSurveyTemplate.fields && currentSurveyTemplate.fields.length > 0 && (
              <div className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-5">
                <div className="flex items-center gap-2">
                  <div className="p-1 px-2.5 bg-purple-50 dark:bg-purple-950/35 border border-purple-100 dark:border-purple-900 rounded-lg text-[9px] font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider">
                    BLUEPRINT LAYOUT
                  </div>
                  <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                    {currentSurveyTemplate.name} Dynamic Questionnaire
                  </h4>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 bg-purple-50/10 dark:bg-purple-950/5 p-4 rounded-3xl border border-purple-100/30 dark:border-purple-900/10 shadow-3xs">
                  {currentSurveyTemplate.fields.map(field => {
                    const val = customAnswers[field.id] || '';
                    return (
                      <div key={field.id} className="space-y-2 p-3.5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800">
                        <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex items-center gap-1">
                          {field.label} {field.required && <span className="text-red-500 font-extrabold">*</span>}
                        </label>

                        {/* Text format */}
                        {field.type === 'text' && (
                          <input
                            type="text"
                            required={field.required}
                            value={val}
                            onChange={e => updateCustomAnswer(field.id, e.target.value)}
                            placeholder="Type respondent's answer..."
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                          />
                        )}

                        {/* Number format */}
                        {field.type === 'number' && (
                          <input
                            type="number"
                            required={field.required}
                            value={val}
                            onChange={e => updateCustomAnswer(field.id, e.target.value)}
                            placeholder="Enter numeric response..."
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                          />
                        )}

                        {/* Textarea format */}
                        {field.type === 'textarea' && (
                          <textarea
                            required={field.required}
                            value={val}
                            onChange={e => updateCustomAnswer(field.id, e.target.value)}
                            placeholder="Enter notes or additional comments..."
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white min-h-[60px]"
                          />
                        )}

                        {/* Choice drop-down selection */}
                        {field.type === 'select' && (
                          <select
                            required={field.required}
                            value={val}
                            onChange={e => updateCustomAnswer(field.id, e.target.value)}
                            className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                          >
                            <option value="">Choose options...</option>
                            {field.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}

                        {/* Standard toggle checkbox */}
                        {field.type === 'checkbox' && (
                          <label className="flex items-center gap-2 cursor-pointer select-none py-1.5">
                            <input
                              type="checkbox"
                              checked={!!val}
                              onChange={e => updateCustomAnswer(field.id, e.target.checked)}
                              className="rounded border-zinc-300 text-purple-650 focus:ring-purple-500 h-4.5 w-4.5"
                            />
                            <span className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Confirm / Verified Yes</span>
                          </label>
                        )}

                        {/* Star/Pill rating scale 1 through 10 */}
                        {field.type === 'scale' && (
                          <div className="flex flex-wrap gap-1">
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                              <button
                                key={num}
                                type="button"
                                onClick={() => updateCustomAnswer(field.id, num)}
                                className={`h-7 w-7 rounded-lg text-[10px] font-extrabold flex items-center justify-center transition-all border ${
                                  Number(val) === num
                                    ? 'bg-purple-600 text-white border-purple-650'
                                    : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-zinc-205 dark:border-zinc-800 hover:border-purple-400'
                                }`}
                              >
                                {num}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Checked listing options */}
                        {field.type === 'multiselect' && (
                          <div className="flex flex-wrap gap-1.5">
                            {field.options?.map(opt => {
                              const arrValues = Array.isArray(val) ? val : [];
                              const selected = arrValues.includes(opt);
                              return (
                                <button
                                  key={opt}
                                  type="button"
                                  onClick={() => {
                                    const nextList = selected
                                      ? arrValues.filter(x => x !== opt)
                                      : [...arrValues, opt];
                                    updateCustomAnswer(field.id, nextList);
                                  }}
                                  className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all ${
                                    selected
                                      ? 'bg-purple-600 text-white border-purple-600'
                                      : 'bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-450 border-zinc-200 dark:border-zinc-800 hover:border-purple-400'
                                  }`}
                                >
                                  {opt}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end">
              <button
                type="submit"
                disabled={loading || checkingVoterResponse || voterAlreadyResponded}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-lg shadow-blue-500/20"
              >
                {loading || checkingVoterResponse ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                {voterAlreadyResponded ? 'Already Responded' : 'Save Record'}
              </button>
            </div>
          </form>
        </div>

        {/* Sidebar Context */}
        <div className="space-y-6">
          <div className="bg-zinc-900 text-white rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <ThumbsUp className="w-24 h-24 rotate-12" />
            </div>
            <h3 className="text-lg font-bold mb-2 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-400" />
              Quick Tips
            </h3>
            <ul className="text-sm text-zinc-400 space-y-3 relative z-10">
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Verify voter ID before recording sentiment.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Sentiment score 3 is for neutral or lean voters.</span>
              </li>
              <li className="flex gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                <span>Add multiple concerns to build a better profile.</span>
              </li>
            </ul>
          </div>

          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-4 flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-500" />
              Recent Activities
            </h3>
            <div className="space-y-4">
              {recentSentiments.length === 0 ? (
                <p className="text-sm text-zinc-500">No recent activities found.</p>
              ) : (
                recentSentiments.map(s => (
                  <div key={s.id} className="flex gap-3 items-start">
                    <div className={`p-2 rounded-lg flex-shrink-0 ${
                      s.sentimentScore >= 4 ? 'bg-emerald-50 text-emerald-600' :
                      s.sentimentScore <= 2 ? 'bg-red-50 text-red-600' :
                      'bg-yellow-50 text-yellow-600'
                    }`}>
                      {s.sentimentScore >= 4 ? <ThumbsUp className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">{s.voterName}</p>
                      <p className="text-xs text-zinc-500">Supports {s.favoredPartyName}</p>
                      <p className="text-[10px] text-zinc-400 mt-0.5">{s.electionYear} Election</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <button 
              onClick={() => {
                setActiveView('report');
                fetchAllSentiments();
              }}
              className="w-full mt-6 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors"
            >
              View All Analytics
            </button>
          </div>
        </div>
      </div>
      </div>
      )) : (
        /* ================= SURVEY REPORTS PAGE ================= */
        <div className="space-y-6 w-full max-w-full min-w-0">
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

          {assignedSurveys.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-16 text-center border bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-sm max-w-xl mx-auto space-y-4 my-10">
              <div className="w-16 h-16 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-450">
                <BarChart3 className="w-8 h-8 text-zinc-450" />
              </div>
              <div className="space-y-2">
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white mt-1">No Assigned Reports Available</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">
                  There are no survey campaigns currently assigned to your account. 
                  You can only view reports and analytics for surveys explicitly assigned to you.
                  Please ask an administrator to assign a campaign survey to your account.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Survey Campaign Separate Report Navigation */}
              {assignedSurveys.length > 0 && (
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4 relative">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-zinc-50 dark:border-zinc-800/60 pb-3">
                    <div>
                      <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-blue-500" />
                        Select Report Survey Campaign
                      </h3>
                      <p className="text-xs text-zinc-505 dark:text-zinc-400 mt-0.5">
                        Choose which campaign survey to load full analytics, respondent metrics, and sentiment trends for.
                      </p>
                    </div>
                    <span className="text-[10px] bg-zinc-500/10 text-zinc-650 dark:bg-zinc-800 dark:text-zinc-450 font-extrabold px-2.5 py-1 rounded-full select-none shrink-0 self-start sm:self-center">
                      {assignedSurveys.length} campaigns
                    </span>
                  </div>

                  {/* Dropdown Selector */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setReportDropdownOpen(!reportDropdownOpen)}
                      className="w-full text-left px-4 py-3 bg-zinc-50 dark:bg-zinc-950/40 border-2 border-zinc-100 dark:border-zinc-800/80 rounded-xl hover:bg-zinc-100/50 dark:hover:bg-zinc-900 transition-all flex items-center justify-between gap-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <div className="min-w-0">
                        {(() => {
                          if (!surveyFilter) {
                            return (
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0 animate-pulse" />
                                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                  All Assigned Campaigns Reports
                                </span>
                              </div>
                            );
                          }
                          if (surveyFilter === 'general_manual_sentiments') {
                            return (
                              <div className="flex items-center gap-2">
                                <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-500 shrink-0" />
                                <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                                  General Surveys / Manual Sentiment Entries
                                </span>
                              </div>
                            );
                          }
                          const found = assignedSurveys.find(s => s.id === surveyFilter);
                          return (
                            <div className="flex items-center gap-2">
                              <span className={`inline-block w-2.5 h-2.5 rounded-full shrink-0 ${found?.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                              <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 capitalize truncate">
                                {found ? found.title : 'Unknown Campaign Survey'}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] uppercase font-bold text-zinc-400 dark:text-zinc-505 hidden sm:inline">
                          Change Report View
                        </span>
                        {reportDropdownOpen ? (
                          <ChevronUp className="w-4 h-4 text-zinc-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-zinc-400" />
                        )}
                      </div>
                    </button>

                    {reportDropdownOpen && (
                      <>
                        {/* Invisible Backdrop */}
                        <div className="fixed inset-0 z-30" onClick={() => setReportDropdownOpen(false)} />

                        {/* Floating list */}
                        <div className="absolute left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 rounded-xl shadow-xl z-40 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
                          {/* Mini search inside dropdown list */}
                          <div className="p-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/25 flex items-center gap-2">
                            <Search className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            <input
                              type="text"
                              value={reportDropdownSearchText}
                              onChange={(e) => setReportDropdownSearchText(e.target.value)}
                              placeholder="Search campaigns by name..."
                              className="w-full bg-transparent text-xs text-zinc-800 dark:text-zinc-200 outline-none placeholder:text-zinc-400"
                              onClick={(e) => e.stopPropagation()}
                            />
                            {reportDropdownSearchText && (
                              <button
                                type="button"
                                onClick={() => setReportDropdownSearchText('')}
                                className="text-zinc-400 hover:text-zinc-650"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            )}
                          </div>

                          <div className="max-h-64 overflow-y-auto custom-scrollbar">
                            {/* 1. All Assigned Campaigns Opt */}
                            <button
                              type="button"
                              onClick={() => {
                                setSurveyFilter('');
                                setReportDropdownOpen(false);
                                setReportDropdownSearchText('');
                              }}
                              className={`w-full text-left p-3 border-b border-zinc-100 dark:border-zinc-800/40 transition-all flex items-center justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                surveyFilter === '' ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse shrink-0" />
                                  <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                                    All Assigned Campaigns Reports
                                  </h4>
                                </div>
                                <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1 truncate">
                                  Aggregate dashboard visualization across all active campaigns
                                </p>
                              </div>
                              <div className="text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded font-mono font-bold text-zinc-650 dark:text-zinc-400 shrink-0">
                                {allSentiments.length} Responses
                              </div>
                            </button>

                            {/* 2. List of mapped surveys */}
                            {(() => {
                              const filteredSurveysForList = assignedSurveys.filter(s =>
                                s.title.toLowerCase().includes(reportDropdownSearchText.toLowerCase()) ||
                                (s.description || '').toLowerCase().includes(reportDropdownSearchText.toLowerCase())
                              );

                              if (filteredSurveysForList.length === 0 && reportDropdownSearchText) {
                                return (
                                  <div className="p-4 text-center text-xs text-zinc-400 dark:text-zinc-550">
                                    No campaigns matching search term
                                  </div>
                                );
                              }

                              return filteredSurveysForList.map(s => {
                                const isSelected = surveyFilter === s.id;
                                const campaignResponses = allSentiments.filter(sentiment => sentiment.surveyId === s.id);
                                const campaignAvg = campaignResponses.length > 0 
                                  ? (campaignResponses.reduce((sum, item) => sum + item.sentimentScore, 0) / campaignResponses.length).toFixed(1) 
                                  : '0.0';

                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => {
                                      setSurveyFilter(s.id);
                                      setReportDropdownOpen(false);
                                      setReportDropdownSearchText('');
                                    }}
                                    className={`w-full text-left p-3 border-b border-zinc-100 dark:border-zinc-800/50 transition-all flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                      isSelected ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                                    }`}
                                  >
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${s.status === 'Active' ? 'bg-emerald-500' : 'bg-zinc-450'}`} />
                                        <h4 className="text-xs font-bold text-zinc-800 dark:text-zinc-200 capitalize truncate">
                                          {s.title}
                                        </h4>
                                        {isSelected && (
                                          <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1 py-0.5 rounded uppercase shrink-0 font-sans">
                                            Current
                                          </span>
                                        )}
                                      </div>
                                      {s.description && (
                                        <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1 truncate max-w-[280px]">
                                          {s.description}
                                        </p>
                                      )}
                                    </div>

                                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 shrink-0 font-mono text-[9px] text-zinc-650 dark:text-zinc-400">
                                      <span>RESP: {campaignResponses.length}</span>
                                      <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                      <span>SCORE: {campaignAvg}</span>
                                    </div>
                                  </button>
                                );
                              });
                            })()}

                            {/* 3. General surveys option */}
                            {allSentiments.some(sentiment => !sentiment.surveyId) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSurveyFilter('general_manual_sentiments');
                                  setReportDropdownOpen(false);
                                  setReportDropdownSearchText('');
                                }}
                                className={`w-full text-left p-3 transition-all flex items-start justify-between gap-3 hover:bg-zinc-50 dark:hover:bg-zinc-800/40 ${
                                  surveyFilter === 'general_manual_sentiments' ? 'bg-blue-50/20 dark:bg-blue-950/10' : ''
                                }`}
                              >
                                {(() => {
                                  const recs = allSentiments.filter(sentiment => !sentiment.surveyId);
                                  const avg = recs.length > 0 
                                    ? (recs.reduce((sum, item) => sum + item.sentimentScore, 0) / recs.length).toFixed(1) 
                                    : '0.0';
                                  return (
                                    <>
                                      <div className="min-w-0 flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                          <h4 className="text-xs font-bold text-zinc-900 dark:text-white">
                                            General Surveys
                                          </h4>
                                        </div>
                                        <p className="text-[10px] text-zinc-450 dark:text-zinc-500 mt-1 truncate">
                                          Field notes/manual responses outside of active campaigns
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 shrink-0 font-mono text-[9px] text-zinc-650 dark:text-zinc-400 font-bold">
                                        <span>RESP: {recs.length}</span>
                                        <span className="text-zinc-300 dark:text-zinc-700">|</span>
                                        <span>SCORE: {avg}</span>
                                      </div>
                                    </>
                                  );
                                })()}
                              </button>
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

          {/* KPI Dashboard Cards Grid */}
          {(() => {
            const total = filteredSentiments.length;

            if (isReportCustomTemplate && selectedReportSurvey) {
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Card 1: Record Count */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-blue-50 dark:bg-blue-900/15 text-blue-600 rounded-xl">
                      <Users className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Total Responses</p>
                      <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{total}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Recorded template entries</p>
                    </div>
                  </div>

                  {/* Card 2: Campaign Status */}
                  <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                    <div className="p-3.5 bg-purple-50 dark:bg-purple-900/15 text-purple-600 rounded-xl">
                      <ClipboardList className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Selected Campaign</p>
                      <p className="text-sm font-black text-zinc-900 dark:text-white mt-1.5 truncate max-w-[250px]">
                        {selectedReportSurvey.title}
                      </p>
                      <p className="text-[10px] text-zinc-500 mt-0.5 uppercase font-bold tracking-wider text-emerald-500">
                        {selectedReportSurvey.status} Active
                      </p>
                    </div>
                  </div>
                </div>
              );
            }

            const avgScore = total > 0 ? (filteredSentiments.reduce((sum, s) => sum + s.sentimentScore, 0) / total).toFixed(1) : '0.0';

            // Base pool of sentiments matching other filters (survey, year, search text) but NOT restricted by partyFilter
            const sentimentsForKpis = allSentiments.filter(s => {
              const matchSurvey = !surveyFilter 
                ? true 
                : surveyFilter === 'general_manual_sentiments' 
                  ? !s.surveyId 
                  : s.surveyId === surveyFilter;
              const matchYear = !yearFilter || s.electionYear === Number(yearFilter);
              const matchSentiment = !sentimentFilter || s.sentimentScore === Number(sentimentFilter);
              const matchSearch = !reportSearchText.trim() || s.voterName.toLowerCase().includes(reportSearchText.toLowerCase());
              return matchSurvey && matchYear && matchSentiment && matchSearch;
            });

            const kpiTotal = sentimentsForKpis.length;

            // 1. Identify which campaign is currently selected (if any)
            const currentCampaign = surveyFilter && surveyFilter !== 'general_manual_sentiments'
              ? assignedSurveys.find(s => s.id === surveyFilter)
              : null;

            // 2. Determine which political parties are relevant
            const relevantParties = (() => {
              if (currentCampaign) {
                if (currentCampaign.linkedPartyIds && currentCampaign.linkedPartyIds.length > 0) {
                  // Highly targeted: Only show parties that are explicitly linked to this campaign survey
                  return parties.filter(p => currentCampaign.linkedPartyIds?.includes(p.id));
                } else {
                  // Otherwise, show parties involved (which have at least 1 response inside this survey)
                  return parties.filter(p => 
                    sentimentsForKpis.some(s => s.favoredPartyId === p.id)
                  );
                }
              } else {
                // No survey filter: show political parties that have at least one recorded sentiment response
                return parties.filter(p => 
                  sentimentsForKpis.some(s => s.favoredPartyId === p.id)
                );
              }
            })();

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Record Count */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                  <div className="p-3.5 bg-blue-50 dark:bg-blue-900/15 text-blue-600 rounded-xl">
                    <Users className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Total Surveys</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">{total}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">Recorded responses</p>
                  </div>
                </div>

                {/* Card 2: Average Rating */}
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm flex items-center gap-4">
                  <div className="p-3.5 bg-purple-50 dark:bg-purple-900/15 text-purple-600 rounded-xl">
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Average Sentiment</p>
                    <p className="text-2xl font-black text-zinc-900 dark:text-white mt-1">
                      {total > 0 ? `${Math.round((parseFloat(avgScore) / 5) * 100)}%` : '0%'}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5">
                      {Number(avgScore) >= 3.5 ? (
                        <span className="text-emerald-500 font-bold flex items-center gap-0.5"><Smile size={12} /> Positive Lean</span>
                      ) : Number(avgScore) <= 2.5 && total > 0 ? (
                        <span className="text-red-500 font-bold flex items-center gap-0.5"><Frown size={12} /> Critical Lean</span>
                      ) : (
                        <span className="text-yellow-600 font-bold flex items-center gap-0.5"><Meh size={12} /> Neutral Lean</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Dynamic Party Share & Sentiment Analysis cards */}
                {relevantParties.map(p => {
                  // Supporters of party p: explicitly favor target party AND have positive sentiment (score >= 4)
                  const supportCount = sentimentsForKpis.filter(s => s.favoredPartyId === p.id && s.sentimentScore >= 4).length;
                  const supportPct = totalAssignedVotersCount > 0 
                    ? Math.round((supportCount / totalAssignedVotersCount) * 100) 
                    : 0;

                  // Voter share of each party in that survey (out of total responses in survey)
                  const partyTotalResponses = sentimentsForKpis.filter(s => s.favoredPartyId === p.id).length;
                  const voterSharePct = kpiTotal > 0 
                    ? Math.round((partyTotalResponses / kpiTotal) * 100) 
                    : 0;

                  // Sentiment of each party calculated in percentage of 100
                  const partyAvgScore = partyTotalResponses > 0 
                    ? (sentimentsForKpis.filter(s => s.favoredPartyId === p.id).reduce((sum, s) => sum + s.sentimentScore, 0) / partyTotalResponses) 
                    : 0;
                  const partySentimentPct = Math.round((partyAvgScore / 5) * 100);

                  return (
                    <div key={p.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 shadow-sm flex flex-col justify-between">
                      <div className="flex items-center gap-1.5 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color || '#3b82f6' }} />
                        <div className="min-w-0">
                          <h4 className="text-xs font-black text-zinc-900 dark:text-white truncate">{p.name}</h4>
                          <h5 className="text-[9px] font-black uppercase text-zinc-400 tracking-wider leading-none mt-0.5">{p.abbreviation} Share</h5>
                        </div>
                      </div>

                      <div className="mt-3.5 space-y-2">
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-[10px] font-bold">
                            <span className="text-zinc-500 flex items-center gap-1">
                              <ThumbsUp className="w-2.5 h-2.5 text-emerald-500" /> Supporters
                            </span>
                            <span className="text-zinc-800 dark:text-white font-black">
                              {supportCount} ({supportPct}%)
                            </span>
                          </div>
                          <p className="text-[8px] text-zinc-400 leading-none">Of {totalAssignedVotersCount} total assigned voters</p>
                          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden mt-1">
                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${supportPct}%` }} />
                          </div>
                        </div>

                        <div className="h-px bg-zinc-150 dark:bg-zinc-850 my-1.5" />

                        <div className="grid grid-cols-2 gap-2 text-[10px] pt-0.5">
                          <div>
                            <span className="block text-[9px] text-zinc-450 uppercase tracking-wider font-extrabold">Voter Share</span>
                            <span className="text-xs font-black text-zinc-800 dark:text-white mt-0.5 block">{voterSharePct}%</span>
                          </div>
                          <div className="border-l border-zinc-100 dark:border-zinc-800 pl-2">
                            <span className="block text-[9px] text-zinc-450 uppercase tracking-wider font-extrabold">Sentiment</span>
                            <span className="text-xs font-black text-zinc-800 dark:text-white mt-0.5 block">{partySentimentPct}%</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Visual Analysis Grid */}
          {!isReportCustomTemplate && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Party Share Analytics */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                <Flag className="w-4 h-4 text-blue-500" />
                Party Vote Share Support
              </h3>
              <div className="space-y-3.5 max-h-[300px] overflow-y-auto pr-1">
                {(() => {
                  const total = filteredSentiments.length;
                  const partyCounts: { [key: string]: { name: string; count: number; abbreviation: string; color: string } } = {};
                  
                  // Seed with existing parties
                  parties.forEach(p => {
                    partyCounts[p.id] = { name: p.name, count: 0, abbreviation: p.abbreviation, color: p.color || '#3b82f6' };
                  });
                  partyCounts['none'] = { name: 'Undecided / No Favor', count: 0, abbreviation: 'UND', color: '#71717a' };
                  partyCounts['others'] = { name: 'Others', count: 0, abbreviation: 'OTH', color: '#f59e0b' };

                  // Accumulate
                  filteredSentiments.forEach(s => {
                    const pid = s.favoredPartyId || 'none';
                    if (partyCounts[pid]) {
                      partyCounts[pid].count++;
                    }
                  });

                  const sortedParties = Object.keys(partyCounts)
                    .map(key => ({ id: key, ...partyCounts[key] }))
                    .filter(p => p.count > 0 || p.id === 'none' || p.id === 'others')
                    .sort((a, b) => b.count - a.count);

                  if (total === 0) {
                    return <p className="text-xs text-zinc-500 py-4 text-center">No sentiment data recorded to calculate party share.</p>;
                  }

                  return sortedParties.map(item => {
                    const pct = Math.round((item.count / total) * 100);
                    return (
                      <div key={item.id} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">{item.name} ({item.abbreviation})</span>
                          <span className="font-black text-zinc-900 dark:text-white">{item.count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: item.color }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Sentiment Levels Breakdown */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-purple-500" />
                Sentiment Level Breakdown
              </h3>
              <div className="space-y-3.5">
                {(() => {
                  const total = filteredSentiments.length;
                  const scoreCounts = [0, 0, 0, 0, 0, 0]; // 0 to 5 indexes
                  filteredSentiments.forEach(s => {
                    if (s.sentimentScore >= 1 && s.sentimentScore <= 5) {
                      scoreCounts[s.sentimentScore]++;
                    }
                  });

                  const scoreLevels = [
                    { val: 5, label: 'Strong Support', color: 'bg-emerald-600' },
                    { val: 4, label: 'Supporting', color: 'bg-emerald-400' },
                    { val: 3, label: 'Neutral / Lean', color: 'bg-yellow-500' },
                    { val: 2, label: 'Slightly Opposed', color: 'bg-red-400' },
                    { val: 1, label: 'Strongly Opposed', color: 'bg-red-600' }
                  ];

                  if (total === 0) {
                    return <p className="text-xs text-zinc-500 py-4 text-center">No sentiment data recorded to calculate levels.</p>;
                  }

                  return scoreLevels.map(level => {
                    const count = scoreCounts[level.val];
                    const pct = Math.round((count / total) * 100);
                    return (
                      <div key={level.val} className="space-y-1">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-bold text-zinc-700 dark:text-zinc-300">Level {level.val} — {level.label}</span>
                          <span className="font-black text-zinc-900 dark:text-white">{count} ({pct}%)</span>
                        </div>
                        <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2.5 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${level.color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>

            {/* Popular Concerns Radar / Rank */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-sm space-y-4">
              <h3 className="text-xs font-black uppercase text-zinc-400 tracking-wider flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-emerald-500" />
                Voters Top Concerns
              </h3>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {(() => {
                  const total = filteredSentiments.length;
                  const concernCounts: { [key: string]: number } = {};
                  filteredSentiments.forEach(s => {
                    if (s.keyConcerns && Array.isArray(s.keyConcerns)) {
                      s.keyConcerns.forEach(c => {
                        concernCounts[c] = (concernCounts[c] || 0) + 1;
                      });
                    }
                  });

                  const rankedConcerns = Object.keys(concernCounts)
                    .map(name => ({ name, count: concernCounts[name] }))
                    .sort((a, b) => b.count - a.count);

                  if (rankedConcerns.length === 0) {
                    return <p className="text-xs text-zinc-500 py-4 text-center">No key concerns reported yet.</p>;
                  }

                  return rankedConcerns.slice(0, 7).map((item, idx) => {
                    const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
                    return (
                      <div key={item.name} className="flex items-center gap-3 bg-zinc-50 dark:bg-zinc-900/60 p-2 border border-zinc-100 dark:border-zinc-800/80 rounded-xl">
                        <span className="text-xs font-black h-6 w-6 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-500 flex items-center justify-center">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                            <span className="truncate">{item.name}</span>
                            <span>{item.count} items ({pct}%)</span>
                          </div>
                          <div className="w-full bg-zinc-200/50 dark:bg-zinc-800 h-1 rounded-full mt-1.5 overflow-hidden">
                            <div className="bg-purple-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </div>
          </div>
          )}

          {/* Detailed Responses Grid and Filters */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-sm overflow-hidden w-full max-w-full min-w-0">
            <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-50/50 dark:bg-zinc-900/20">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-blue-500" />
                  Filter Surveys & Export
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Search and segment responses dynamically below</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchAllSentiments}
                  disabled={reportLoading}
                  className="p-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-600 dark:text-zinc-300 disabled:opacity-50 transition-colors"
                  title="Refresh Survey Data"
                >
                  <RefreshCw className={`w-4 h-4 ${reportLoading ? 'animate-spin' : ''}`} />
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  disabled={filteredSentiments.length === 0}
                  className="px-4 py-2.5 bg-zinc-950 dark:bg-blue-600 hover:bg-zinc-900 dark:hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Export CSV ({filteredSentiments.length})
                </button>
              </div>
            </div>

            {/* Filter controls area */}
            <div className="p-5 border-b border-zinc-100 dark:border-zinc-800 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 bg-zinc-50/30">
              {/* Respondent Name Search */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Search Respondent</label>
                <div className="relative">
                  <input
                    type="text"
                    value={reportSearchText}
                    onChange={e => setReportSearchText(e.target.value)}
                    placeholder="Search by name..."
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                  />
                  <Search className="absolute left-3 top-3.5 w-3.5 h-3.5 text-zinc-400" />
                </div>
              </div>

              {/* Campaign Survey Filter */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Campaign Survey</label>
                <select
                  value={surveyFilter}
                  onChange={e => {
                    setSurveyFilter(e.target.value);
                    setCustomFilters({});
                    setYearFilter('');
                    setPartyFilter('');
                    setSentimentFilter('');
                  }}
                  className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                >
                  <option value="">All Assigned Campaigns</option>
                  {assignedSurveys.map(s => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                </select>
              </div>

              {/* Conditionally render filters */}
              {!isReportCustomTemplate ? (
                <>
                  {/* Year Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Election Cycle</label>
                    <select
                      value={yearFilter}
                      onChange={e => setYearFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                    >
                      <option value="">All Election Cycles</option>
                      {Array.from(new Set(allSentiments.map(s => s.electionYear)))
                        .sort((a,b) => Number(b) - Number(a))
                        .map(yr => (
                          <option key={yr} value={yr}>{yr} Election Cycle</option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Party Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Supporting Party</label>
                    <select
                      value={partyFilter}
                      onChange={e => setPartyFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                    >
                      <option value="">All Parties</option>
                      {parties.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                      ))}
                      <option value="none">Undecided</option>
                      <option value="others">Others</option>
                    </select>
                  </div>

                  {/* Sentiment Score Filter */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider">Sentiment Score</label>
                    <select
                      value={sentimentFilter}
                      onChange={e => setSentimentFilter(e.target.value)}
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                    >
                      <option value="">All Scores</option>
                      <option value="5">Score 5 — Strong Support</option>
                      <option value="4">Score 4 — Supporting</option>
                      <option value="3">Score 3 — Neutral / Lean</option>
                      <option value="2">Score 2 — Slightly Opposed</option>
                      <option value="1">Score 1 — Strongly Opposed</option>
                    </select>
                  </div>
                </>
              ) : (
                /* Dynamic Custom Filters corresponding to each column (field) of layout */
                (reportTemplate?.fields || []).map(field => {
                  return (
                    <div key={field.id} className="space-y-1.5">
                      <label className="text-[10px] font-black uppercase text-zinc-400 tracking-wider truncate block" title={field.label}>
                        {field.label}
                      </label>
                      {field.type === 'select' || field.type === 'scale' || field.type === 'checkbox' || field.type === 'multiselect' ? (
                        <select
                          value={customFilters[field.id] || ''}
                          onChange={e => setCustomFilters(prev => ({ ...prev, [field.id]: e.target.value }))}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white pb-1.5 pt-1.5"
                        >
                          <option value="">All {field.label}</option>
                          {field.type === 'checkbox' ? (
                            <>
                              <option value="true">Checked (Yes)</option>
                              <option value="false">Unchecked (No)</option>
                            </>
                          ) : field.type === 'scale' ? (
                            Array.from({ length: 10 }, (_, i) => String(i + 1)).map(valStr => (
                              <option key={valStr} value={valStr}>{valStr}</option>
                            ))
                          ) : (
                            /* Pre-defined options inside the field */
                            (field.options || []).map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))
                          )}
                        </select>
                      ) : (
                        /* Text/Area input search */
                        <input
                          type="text"
                          value={customFilters[field.id] || ''}
                          onChange={e => setCustomFilters(prev => ({ ...prev, [field.id]: e.target.value }))}
                          placeholder={`Search ${field.label}...`}
                          className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-xs transition-all text-zinc-850 dark:text-white"
                        />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* List / Table Area */}
            {reportLoading ? (
              <div className="p-16 text-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto" />
                <p className="text-zinc-400 text-sm">Querying survey databases...</p>
              </div>
            ) : filteredSentiments.length === 0 ? (
              <div className="p-16 text-center space-y-3">
                <BarChart3 className="w-8 h-8 text-zinc-300 dark:text-zinc-700 mx-auto" />
                <p className="text-zinc-400 text-sm font-bold">No matching survey responses found</p>
                <p className="text-zinc-500 text-xs text-center max-w-sm mx-auto">Try clearing search text or adjusting the party/year/campaign segments filters.</p>
                {(reportSearchText || surveyFilter || yearFilter || partyFilter || sentimentFilter) && (
                  <button
                    onClick={() => {
                      setReportSearchText('');
                      setSurveyFilter(assignedSurveys[0]?.id || '');
                      setYearFilter('');
                      setPartyFilter('');
                      setSentimentFilter('');
                    }}
                    className="px-4 py-1.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-bold rounded-lg mt-2"
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <div className="w-full overflow-x-auto min-w-0 border-t border-zinc-100 dark:border-zinc-800">
                <table className="w-full min-w-full table-auto text-left border-collapse whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black text-zinc-400 uppercase tracking-wider bg-zinc-50/50 dark:bg-zinc-900/35">
                      <th className="px-6 py-4">Respondent Voter</th>
                      <th className="px-6 py-4">EPIC ID</th>
                      <th className="px-6 py-4">Mobile</th>
                      <th className="px-6 py-4">Email</th>
                      <th className="px-6 py-4">Father/Husband Name</th>
                      <th className="px-6 py-4">Age / Gender</th>
                      <th className="px-6 py-4">Village</th>
                      <th className="px-6 py-4">Campaign Survey</th>
                      <th className="px-6 py-4">Election Cycle</th>
                      {isReportCustomTemplate ? (
                        (reportTemplate?.fields || []).map(f => (
                          <th key={f.id} className="px-6 py-4">{f.label}</th>
                        ))
                      ) : (
                        <>
                          <th className="px-6 py-4">Sentiment Strength</th>
                          <th className="px-6 py-4">Supporting Party</th>
                          <th className="px-6 py-4">Key Concerns Reported</th>
                        </>
                      )}
                      <th className="px-6 py-4">Recorded By</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {filteredSentiments.map(s => {
                      const vDetail = s.voterDocId ? votersMap[s.voterDocId] : null;
                      return (
                        <tr key={s.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/40 text-xs">
                          {/* Voter Details */}
                          <td className="px-6 py-4">
                            <span className="font-bold text-zinc-900 dark:text-white block">{s.voterName}</span>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-mono">
                            {vDetail?.voterId || '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-mono">
                            {vDetail?.mobile || s.mobile || '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400 font-mono">
                            {vDetail?.email || s.email || '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                            {vDetail?.relationName || '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-400">
                            {vDetail?.age && vDetail?.gender 
                              ? `${vDetail.age} / ${vDetail.gender}` 
                              : vDetail?.age || vDetail?.gender || '—'}
                          </td>
                          <td className="px-6 py-4 text-zinc-650 dark:text-zinc-350 capitalize">
                            {vDetail?.village || '—'}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize truncate max-w-[120px] block">
                                {s.surveyTitle || 'General Survey'}
                              </span>
                              <span className="text-[9px] text-zinc-450 uppercase tracking-wider block">
                                {s.surveyId ? `ID: ${s.surveyId.substring(0, 8)}` : 'Manual Record'}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-zinc-600 dark:text-zinc-455 font-medium">
                            {s.electionYear ? `${s.electionYear} Cycle` : '—'}
                          </td>

                          {/* Dynamic Custom Template answers versus standard sentiment scores */}
                          {isReportCustomTemplate ? (
                            (reportTemplate?.fields || []).map(f => {
                              const val = s.customAnswers?.[f.id];
                              const answerStr = Array.isArray(val)
                                ? val.join(', ')
                                : (typeof val === 'boolean' ? (val ? 'Yes' : 'No') : (val !== undefined && val !== null ? String(val) : '—'));
                              return (
                                <td key={f.id} className="px-6 py-4 font-semibold text-zinc-700 dark:text-zinc-300">
                                  {answerStr}
                                </td>
                              );
                            })
                          ) : (
                            <>
                              {/* Sentiment Score Badge */}
                              <td className="px-6 py-4">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1.5">
                                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full inline-block ${
                                    s.sentimentScore >= 4 ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400' :
                                    s.sentimentScore <= 2 ? 'bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400' :
                                    'bg-yellow-100 text-yellow-850 dark:bg-yellow-950/40 dark:text-yellow-450'
                                  }`}>
                                    Score: {s.sentimentScore * 20}%
                                  </span>
                                  <span className="text-[11px] text-zinc-500 font-medium">
                                    {s.sentimentScore === 1 ? 'Strongly Opposed' :
                                     s.sentimentScore === 2 ? 'Slightly Opposed' :
                                     s.sentimentScore === 3 ? 'Neutral/Lean' :
                                     s.sentimentScore === 4 ? 'Supporting' :
                                     'Strong Support'}
                                  </span>
                                </div>
                              </td>

                              {/* Supporting Party */}
                              <td className="px-6 py-4">
                                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg inline-block border ${
                                  s.favoredPartyId === 'none' 
                                    ? 'bg-zinc-50 text-zinc-500 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' 
                                    : s.favoredPartyId === 'others'
                                      ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30'
                                      : 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/30'
                                }`}>
                                  {s.favoredPartyName}
                                </span>
                              </td>

                              {/* Key Concerns */}
                              <td className="px-6 py-4">
                                <div className="flex flex-wrap gap-1 max-w-[220px]">
                                  {s.keyConcerns && s.keyConcerns.length > 0 ? (
                                    s.keyConcerns.map(cn => (
                                      <span key={cn} className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-2 py-0.5 rounded font-medium">
                                        {cn}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="text-[10px] text-zinc-400">No issues reported</span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}

                          {/* Recorded By */}
                          <td className="px-6 py-4 text-zinc-700 dark:text-zinc-350 font-medium">
                            {s.recordedByName || 'Staff'}
                          </td>

                          {/* Date */}
                          <td className="px-6 py-4 text-zinc-500 dark:text-zinc-400 font-mono">
                            {s.createdAt ? new Date(s.createdAt.toDate()).toLocaleDateString() : '—'}
                          </td>

                          {/* Actions */}
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {canEdit(s) && (
                                <button
                                  type="button"
                                  onClick={() => handleStartEdit(s)}
                                  className="p-1.5 text-zinc-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/20 rounded-lg transition-colors"
                                  title="Edit survey response"
                                >
                                  <Edit size={15} />
                                </button>
                              )}
                              {canDelete(s) && (
                                <button
                                  type="button"
                                  onClick={() => setSentimentToDelete(s)}
                                  className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-lg transition-colors"
                                  title="Delete survey entry"
                                >
                                  <Trash2 size={15} />
                                </button>
                              )}
                              {!canEdit(s) && !canDelete(s) && (
                                <span className="text-[10px] text-zinc-400 font-medium italic">Read-only</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {/* Edit Sentiment Modal */}
          {editingSentiment && (() => {
            const editedDocSurvey = allSurveys.find(as => as.id === editingSentiment.surveyId) || assignedSurveys.find(as => as.id === editingSentiment.surveyId);
            const isEditedDocCustomTemplate = editedDocSurvey && editedDocSurvey.templateId && editedDocSurvey.templateId !== 'political_sentiment';
            const editingTemplate = editedDocSurvey ? templates.find(t => t.id === editedDocSurvey.templateId) : null;

            return (
              <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-6 relative animate-in fade-in zoom-in-95 duration-200">
                  <button
                    type="button"
                    onClick={() => setEditingSentiment(null)}
                    className="absolute top-4 right-4 p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-500 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="space-y-1">
                    <span className="text-[9px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-400 font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">
                      Edit Response
                    </span>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Voter: {editingSentiment.voterName}
                    </h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                      Update the survey respondent feedback. Survey: <span className="font-bold text-zinc-800 dark:text-zinc-200">{editedDocSurvey?.title || editingSentiment.surveyTitle || 'General Survey'}</span>
                    </p>
                  </div>

                  <form onSubmit={handleSaveEdit} className="space-y-5">
                    {!isEditedDocCustomTemplate ? (
                      <>
                        {/* Supporting Party */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-300 flex items-center gap-1.5">
                            <Flag className="w-3.5 h-3.5 text-zinc-400" />
                            Supporting Party
                          </label>
                          <select
                            value={editSupportingParty}
                            onChange={(e) => setEditSupportingParty(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-zinc-900 dark:text-white font-medium"
                            required
                          >
                            <option value="">Select Party</option>
                            {parties.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.abbreviation})</option>
                            ))}
                            <option value="none">Undecided / No Favor</option>
                            <option value="others">Others</option>
                          </select>
                        </div>

                        {/* Sentiment Score */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-300 flex items-center gap-1.5">
                              <Target className="w-3.5 h-3.5 text-zinc-400" />
                              Sentiment Score
                            </label>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              editSentimentScore >= 4 ? 'bg-emerald-100 text-emerald-700' :
                              editSentimentScore <= 2 ? 'bg-red-100 text-red-700' :
                              'bg-yellow-100 text-yellow-700'
                            }`}>
                              {editSentimentScore === 1 ? 'Strongly Opposed' :
                               editSentimentScore === 2 ? 'Slightly Opposed' :
                               editSentimentScore === 3 ? 'Neutral / Lean' :
                               editSentimentScore === 4 ? 'Supporting' :
                               'Strong Support'}
                            </span>
                          </div>
                          <input
                            type="range"
                            min="1"
                            max="5"
                            step="1"
                            value={editSentimentScore}
                            onChange={(e) => setEditSentimentScore(Number(e.target.value))}
                            className="w-full h-1.5 bg-zinc-200 dark:bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                          />
                          <div className="flex justify-between text-[8px] text-zinc-400 font-bold px-1 uppercase tracking-wide">
                            <span>Opposed</span>
                            <span>Neutral</span>
                            <span>Supportive</span>
                          </div>
                        </div>

                        {/* Key Concerns */}
                        <div className="space-y-2">
                          <label className="text-xs font-bold text-zinc-800 dark:text-zinc-300 flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                            Key Concerns
                          </label>
                          <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto p-1 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50/20 font-sans">
                            {COMMON_CONCERNS.map(concern => (
                              <button
                                key={concern}
                                type="button"
                                onClick={() => toggleEditConcern(concern)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                                  editConcerns.includes(concern)
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/10'
                                    : 'bg-white dark:bg-zinc-850 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-blue-400'
                                }`}
                              >
                                {concern}
                              </button>
                            ))}
                            
                            <div className="flex gap-1">
                              <input
                                type="text"
                                value={editOtherConcern}
                                onChange={(e) => setEditOtherConcern(e.target.value)}
                                placeholder="Other..."
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 outline-none focus:ring-1 focus:ring-blue-500 w-20 text-zinc-900 dark:text-white"
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && editOtherConcern.trim()) {
                                    e.preventDefault();
                                    if (!editConcerns.includes(editOtherConcern.trim())) {
                                      setEditConcerns([...editConcerns, editOtherConcern.trim()]);
                                    }
                                    setEditOtherConcern('');
                                  }
                                }}
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  if (editOtherConcern.trim()) {
                                    if (!editConcerns.includes(editOtherConcern.trim())) {
                                      setEditConcerns([...editConcerns, editOtherConcern.trim()]);
                                    }
                                    setEditOtherConcern('');
                                  }
                                }}
                                className="p-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 rounded-lg"
                              >
                                <Plus className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      /* Custom template dynamic fields */
                      editingTemplate && editingTemplate.fields && editingTemplate.fields.length > 0 ? (
                        <div className="space-y-4 max-h-[350px] overflow-y-auto p-1 text-left">
                          <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2">
                            {editingTemplate.name} Structure Form Responses
                          </p>
                          <div className="space-y-4">
                            {editingTemplate.fields.map(field => {
                              const val = editCustomAnswers[field.id];
                              const updateEditCustomAnswer = (fId: string, fVal: unknown) => {
                                setEditCustomAnswers(prev => ({
                                  ...prev,
                                  [fId]: fVal
                                }));
                              };

                              return (
                                <div key={field.id} className="space-y-1.5 p-3.5 bg-zinc-50 dark:bg-zinc-850 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                  <label className="text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400 tracking-wider flex items-center gap-1">
                                    {field.label} {field.required && <span className="text-red-500 font-extrabold">*</span>}
                                  </label>

                                  {/* Text format */}
                                  {field.type === 'text' && (
                                    <input
                                      type="text"
                                      required={field.required}
                                      value={typeof val === 'string' ? val : ''}
                                      onChange={e => updateEditCustomAnswer(field.id, e.target.value)}
                                      placeholder="Type respondent's answer..."
                                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    />
                                  )}

                                  {/* Number format */}
                                  {field.type === 'number' && (
                                    <input
                                      type="number"
                                      required={field.required}
                                      value={val !== undefined && val !== null ? String(val) : ''}
                                      onChange={e => updateEditCustomAnswer(field.id, e.target.value === '' ? '' : Number(e.target.value))}
                                      placeholder="Enter numeric response..."
                                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    />
                                  )}

                                  {/* Textarea format */}
                                  {field.type === 'textarea' && (
                                    <textarea
                                      required={field.required}
                                      value={typeof val === 'string' ? val : ''}
                                      onChange={e => updateEditCustomAnswer(field.id, e.target.value)}
                                      placeholder="Enter notes or additional comments..."
                                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white min-h-[60px]"
                                    />
                                  )}

                                  {/* Choice drop-down selection */}
                                  {field.type === 'select' && (
                                    <select
                                      required={field.required}
                                      value={typeof val === 'string' ? val : ''}
                                      onChange={e => updateEditCustomAnswer(field.id, e.target.value)}
                                      className="w-full px-3 py-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-purple-500 text-zinc-800 dark:text-white"
                                    >
                                      <option value="">Choose options...</option>
                                      {field.options?.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  )}

                                  {/* Standard toggle checkbox */}
                                  {field.type === 'checkbox' && (
                                    <label className="flex items-center gap-2 cursor-pointer select-none py-1.5">
                                      <input
                                        type="checkbox"
                                        checked={!!val}
                                        onChange={e => updateEditCustomAnswer(field.id, e.target.checked)}
                                        className="rounded border-zinc-300 text-purple-650 focus:ring-purple-500 h-4.5 w-4.5"
                                      />
                                      <span className="text-xs font-bold text-zinc-650 dark:text-zinc-400 mb-0.5">Confirm / Verified Yes</span>
                                    </label>
                                  )}

                                  {/* Star/Pill rating scale 1 through 10 */}
                                  {field.type === 'scale' && (
                                    <div className="flex flex-wrap gap-1">
                                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
                                        <button
                                          key={num}
                                          type="button"
                                          onClick={() => updateEditCustomAnswer(field.id, num)}
                                          className={`h-7 w-7 rounded-lg text-[10px] font-extrabold flex items-center justify-center transition-all border ${
                                            Number(val) === num
                                              ? 'bg-purple-600 text-white border-purple-650 shadow-sm'
                                              : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
                                          }`}
                                        >
                                          {num}
                                        </button>
                                      ))}
                                    </div>
                                  )}

                                  {/* Checked listing options */}
                                  {field.type === 'multiselect' && (
                                    <div className="flex flex-wrap gap-1.5">
                                      {field.options?.map(opt => {
                                        const arrValues = Array.isArray(val) ? val : [];
                                        const selected = arrValues.includes(opt);
                                        return (
                                          <button
                                            key={opt}
                                            type="button"
                                            onClick={() => {
                                              const nextList = selected
                                                ? arrValues.filter(x => x !== opt)
                                                : [...arrValues, opt];
                                              updateEditCustomAnswer(field.id, nextList);
                                            }}
                                            className={`px-2.5 py-1 rounded-lg text-[9px] font-black border transition-all ${
                                              selected
                                                ? 'bg-purple-600 text-white border-purple-600'
                                                : 'bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700 hover:border-purple-400'
                                            }`}
                                          >
                                            {opt}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 text-center text-xs text-zinc-400 italic">No fields defined for this template</div>
                      )
                    )}

                    {/* Buttons */}
                    <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingSentiment(null)}
                        className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={savingEdit}
                        className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 disabled:opacity-50 transition-all shadow-md shadow-blue-500/10"
                      >
                        {savingEdit ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          'Save Changes'
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            );
          })()}

          {/* Delete Confirmation Modal */}
          <AnimatePresence>
            {sentimentToDelete && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
                <motion.div 
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  onClick={() => setSentimentToDelete(null)}
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
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white tracking-tight">Delete Response Record?</h3>
                    <p className="text-sm text-zinc-500 mt-2">
                      Are you sure you want to remove the survey response for <span className="font-bold text-zinc-900 dark:text-zinc-100">{sentimentToDelete.voterName}</span>? 
                      This action is permanent and cannot be undone.
                    </p>
                  </div>
                  <div className="flex w-full gap-3 pt-2">
                    <button 
                      onClick={() => setSentimentToDelete(null)}
                      className="px-4 py-2 text-xs font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl flex-1 text-center"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleDeleteSentiment}
                      disabled={deletingSentiment}
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-md flex-1 text-center"
                    >
                      {deletingSentiment ? <Loader2 className="animate-spin w-3.5 h-3.5" /> : <Trash2 size={14} />}
                      Delete Response
                    </button>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </>
      )}
        </div>
      )}
    </div>
  );
}
