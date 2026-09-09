import React, { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../AuthProvider';
import MediaUploader from './MediaUploader';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Send, CheckCircle2, 
  AlertCircle, Plus, Trash2, Shield, Radio, Key, Globe, 
  Phone, Play, Pause, RefreshCw, Layers, Copy, Search, Check, X,
  FileText, Video, Image as ImageIcon, ExternalLink, MessageCircle
} from 'lucide-react';

// Interfaces
interface WhatsAppConfig {
  id: string;
  adminId: string;
  tenantType: 'shared' | 'vendor';
  vendorName: string;
  phoneNumberId: string;
  wabaId: string;
  accessToken: string;
  phoneNumber: string;
  status: 'connected' | 'disconnected';
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface WhatsAppBroadcast {
  id: string;
  adminId: string;
  campaignName: string;
  senderConfigId: string;
  senderPhone: string;
  templateId: string;
  templateName: string;
  mediaUrl: string;
  mediaType: 'none' | 'image' | 'document' | 'video';
  status: 'Draft' | 'Sending' | 'Completed' | 'Failed' | 'Paused';
  totalCount: number;
  successCount: number;
  failedCount: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

interface WhatsAppTemplate {
  id: string;
  adminId: string;
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  bodyText: string;
  mediaType: 'none' | 'image' | 'video' | 'document';
  mediaUrl?: string;
  buttons?: Array<{ type: 'URL' | 'PHONE' | 'QUICK_REPLY'; text: string; value?: string }>;
  status: 'APPROVED' | 'PENDING' | 'REJECTED';
  createdAt?: unknown;
}

interface Recipient {
  name: string;
  phone: string;
  voterId?: string;
  vars?: string[];
}

interface WebhookLog {
  id: string;
  timestamp: string;
  sender: string;
  direction: 'inbound' | 'outbound';
  message: string;
  status?: 'sent' | 'delivered' | 'read' | 'failed';
  tenant: string;
}

interface IndiaBooth {
  id: string;
  name: string;
  boothNumber?: string;
}

interface Voter {
  id: string;
  name: string;
  voterId?: string;
  village?: string;
  mobile?: string;
  boothId?: string;
  isKaryakarta?: boolean;
}

interface Karyakarta {
  id: string;
  name: string;
  mobile?: string;
  boothId?: string;
}

export default function WBSender() {
  const { user } = useAuth();
  const adminId = user?.uid || 'anonymous';

  // State Management
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'templates' | 'onboard' | 'webhook'>('overview');
  const [configs, setConfigs] = useState<WhatsAppConfig[]>([]);
  const [campaigns, setCampaigns] = useState<WhatsAppBroadcast[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [voters, setVoters] = useState<Voter[]>([]);
  const [volunteers, setVolunteers] = useState<Karyakarta[]>([]);
  const [booths, setBooths] = useState<IndiaBooth[]>([]);
  const [selectedVoters, setSelectedVoters] = useState<Voter[]>([]);
  
  // Loading & Toasts
  const [loading, setLoading] = useState<boolean>(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  
  // Recipient Category Filters
  const [recipientCategory, setRecipientCategory] = useState<'all' | 'booth' | 'karyakarta'>('all');
  const [selectedFilterId, setSelectedFilterId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Embedded Meta Signup Simulator State
  const [isMetaModalOpen, setIsMetaModalOpen] = useState(false);
  const [metaStep, setMetaStep] = useState(1);
  const [metaForm, setMetaForm] = useState({
    fbEmail: '',
    fbPassword: '',
    businessProfile: 'NextGen Digital Portfolio',
    wabaName: 'NextGen Bulk WABA',
    senderPhone: '',
    otpCode: '',
    tenantName: ''
  });

  // Campaign Composer State
  const [composer, setComposer] = useState({
    campaignName: '',
    senderConfigId: 'shared_service',
    templateId: '',
    mediaType: 'none' as 'none' | 'image' | 'document' | 'video',
    mediaUrl: '',
    throttlingSpeed: 5
  });
  const [composerMediaMode, setComposerMediaMode] = useState<'url' | 'upload'>('url');

  // Template Maker State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateMediaMode, setTemplateMediaMode] = useState<'url' | 'upload'>('url');
  const [newTemplate, setNewTemplate] = useState<{
    name: string;
    category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
    language: string;
    bodyText: string;
    mediaType: 'none' | 'image' | 'video' | 'document';
    mediaUrl: string;
    buttonType: 'none' | 'URL' | 'PHONE' | 'QUICK_REPLY';
    buttonText: string;
    buttonValue: string;
  }>({
    name: '',
    category: 'MARKETING',
    language: 'en_US',
    bodyText: 'Hello {{1}}, join us for the voter registration rally. Your booth is {{2}}. Please reach out for support!',
    mediaType: 'none',
    mediaUrl: '',
    buttonType: 'none',
    buttonText: '',
    buttonValue: ''
  });

  // Webhook Logs & Live Chat simulation
  const [webhookLogs, setWebhookLogs] = useState<WebhookLog[]>([
    { id: '1', timestamp: new Date(Date.now() - 3600000).toLocaleTimeString(), sender: '919876543210', direction: 'inbound', message: 'Hi! Where is my booth located?', tenant: 'Shared Account' },
    { id: '2', timestamp: new Date(Date.now() - 3500000).toLocaleTimeString(), sender: '919876543210', direction: 'outbound', message: 'Hello, your booth is at Government Primary School.', status: 'read', tenant: 'Shared Account' },
    { id: '3', timestamp: new Date(Date.now() - 600000).toLocaleTimeString(), sender: '919445566778', direction: 'inbound', message: 'Thank you for the benefits info!', tenant: 'MLA Custom WABA' }
  ]);
  const [newInboundMessage, setNewInboundMessage] = useState('');
  const [selectedChatSender, setSelectedChatSender] = useState<string>('919876543210');

  // Load Initial Data
  useEffect(() => {
    fetchInitialData();
  }, [adminId]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification(prev => prev?.message === message ? null : prev);
    }, 4500);
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // 1. Fetch configs, campaigns, templates, voters, volunteers, booths in parallel
      const [configsData, campData, tempData, voterData, volData, boothsData] = await Promise.all([
        api.get<WhatsAppConfig[]>('/api/whatsapp/configs'),
        api.get<WhatsAppBroadcast[]>('/api/whatsapp/broadcasts'),
        api.get<WhatsAppTemplate[]>('/api/whatsapp/templates'),
        api.get<any[]>('/api/voters?pageSize=500'),
        api.get<any[]>('/api/volunteers'),
        api.get<any[]>('/api/booths')
      ]);

      setConfigs(configsData || []);
      const sortedCampaigns = (campData || []).sort((a, b) => b.id.localeCompare(a.id));
      setCampaigns(sortedCampaigns);
      
      let templatesList = tempData || [];
      if (templatesList.length === 0) {
        const defaultTemps: WhatsAppTemplate[] = [
          {
            id: 'default_marketing',
            adminId,
            name: 'voter_outreach_marketing',
            category: 'MARKETING',
            language: 'en_US',
            bodyText: 'Hello {{1}}, join us for the development rally tomorrow at {{2}}. Your support matters!',
            mediaType: 'image',
            mediaUrl: 'https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=800&q=80',
            buttons: [{ type: 'URL', text: 'Visit Website', value: 'https://example.com' }],
            status: 'APPROVED'
          },
          {
            id: 'default_utility',
            adminId,
            name: 'voter_booth_slip_utility',
            category: 'UTILITY',
            language: 'en_US',
            bodyText: 'Dear {{1}}, your voter registration is confirmed. Polling station: {{2}}. Please bring your voter card.',
            mediaType: 'document',
            mediaUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            buttons: [{ type: 'PHONE', text: 'Call Helpline', value: '919000000000' }],
            status: 'APPROVED'
          }
        ];
        for (const temp of defaultTemps) {
          await api.post('/api/whatsapp/templates', temp);
        }
        templatesList = defaultTemps;
      }
      setTemplates(templatesList);

      setVoters((voterData || []).map((d: any) => ({ id: d.id, ...d })));
      setVolunteers((volData || []).map((d: any) => ({
        id: d.id,
        name: d.name || 'Karyakarta',
        mobile: d.mobile || '',
        boothId: d.boothId || d.booth_id || ''
      })));
      setBooths((boothsData || []).map((d: any) => ({
        id: d.id,
        name: d.name || 'Booth',
        boothNumber: d.boothNumber || d.booth_number || ''
      })));

    } catch (err) {
      console.error('Error fetching WhatsApp data:', err);
      showToast('Synced data with dynamic local simulation capability.', 'info');
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (num: string | number): string => {
    const cleaned = String(num).replace(/\D/g, '');
    if (cleaned.length === 10) {
      return '91' + cleaned;
    }
    return cleaned;
  };

  // Filter Voters category-wise
  const getFilteredVoters = () => {
    let list = [...voters];

    if (recipientCategory === 'booth' && selectedFilterId) {
      list = list.filter(v => v.boothId === selectedFilterId || v.village === selectedFilterId);
    } else if (recipientCategory === 'karyakarta' && selectedFilterId) {
      // Voters registered in the same booth assigned to this karyakarta
      const vol = volunteers.find(v => v.id === selectedFilterId);
      if (vol && vol.boothId) {
        list = list.filter(v => v.boothId === vol.boothId);
      }
    }

    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      list = list.filter(v => 
        (v.name || '').toLowerCase().includes(q) || 
        (v.voterId || '').toLowerCase().includes(q) ||
        (v.mobile || '').includes(q)
      );
    }

    return list;
  };

  // Dynamic One-Click Selection
  const selectAllFiltered = () => {
    const filtered = getFilteredVoters();
    setSelectedVoters(prev => {
      // Add all from filtered list that aren't already selected
      const currentIds = new Set(prev.map(p => p.id));
      const union = [...prev];
      filtered.forEach(v => {
        if (!currentIds.has(v.id)) {
          union.push(v);
        }
      });
      showToast(`Selected ${filtered.length} voters inside category!`, 'success');
      return union;
    });
  };

  const deselectAllFiltered = () => {
    const filtered = getFilteredVoters();
    const filteredIds = new Set(filtered.map(f => f.id));
    setSelectedVoters(prev => prev.filter(p => !filteredIds.has(p.id)));
    showToast('Deselected filtered voters.', 'info');
  };

  const toggleVoterSelection = (voter: Voter) => {
    const isSelected = selectedVoters.some(sv => sv.id === voter.id);
    if (isSelected) {
      setSelectedVoters(prev => prev.filter(sv => sv.id !== voter.id));
    } else {
      setSelectedVoters(prev => [...prev, voter]);
    }
  };

  // Create Template
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplate.name) {
      showToast('Template name is required.', 'error');
      return;
    }
    const cleanName = newTemplate.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const newId = `temp_${Date.now()}`;
    
    // Configure buttons if specified
    const buttonsArray: Array<{ type: 'URL' | 'PHONE' | 'QUICK_REPLY'; text: string; value?: string }> = [];
    if (newTemplate.buttonType !== 'none' && newTemplate.buttonText) {
      buttonsArray.push({
        type: newTemplate.buttonType,
        text: newTemplate.buttonText,
        value: newTemplate.buttonValue
      });
    }

    const templateDoc: WhatsAppTemplate = {
      id: newId,
      adminId,
      name: cleanName,
      category: newTemplate.category,
      language: newTemplate.language,
      bodyText: newTemplate.bodyText,
      mediaType: newTemplate.mediaType,
      status: 'APPROVED'
    };

    if (newTemplate.mediaUrl) {
      templateDoc.mediaUrl = newTemplate.mediaUrl;
    }
    if (buttonsArray.length > 0) {
      templateDoc.buttons = buttonsArray;
    }

    try {
      await api.post('/api/whatsapp/templates', templateDoc);
      setTemplates(prev => [templateDoc, ...prev]);
      showToast(`WhatsApp template "${cleanName}" submitted & APPROVED!`, 'success');
      setIsTemplateModalOpen(false);
      setNewTemplate({
        name: '',
        category: 'MARKETING',
        language: 'en_US',
        bodyText: 'Hello {{1}}, join us for the voter registration rally. Your booth is {{2}}. Please reach out for support!',
        mediaType: 'none',
        mediaUrl: '',
        buttonType: 'none',
        buttonText: '',
        buttonValue: ''
      });
    } catch (err) {
      console.error('Error creating template in database:', err);
      const errMsg = err instanceof Error ? err.message : String(err);
      showToast(`Error creating template: ${errMsg}`, 'error');
    }
  };

  const handleDeleteTemplate = async (templateIdToDelete: string, name: string) => {
    if (!window.confirm(`Delete WhatsApp template "${name}"?`)) return;
    try {
      await api.delete(`/api/whatsapp/templates/${templateIdToDelete}`);
      setTemplates(prev => prev.filter(t => t.id !== templateIdToDelete));
      showToast('Template deleted successfully.', 'success');
    } catch {
      showToast('Error deleting template.', 'error');
    }
  };

  // Submit and Start Campaign
  const handleLaunchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    const { campaignName, senderConfigId, templateId } = composer;
    if (!campaignName) {
      showToast('Please enter a campaign name.', 'error');
      return;
    }
    if (!templateId) {
      showToast('Please select a template.', 'error');
      return;
    }

    const selectedTemplate = templates.find(t => t.id === templateId);
    if (!selectedTemplate) {
      showToast('Template invalid.', 'error');
      return;
    }

    if (selectedVoters.length === 0) {
      showToast('Please select at least 1 contact/voter.', 'error');
      return;
    }

    const finalRecipients: Recipient[] = selectedVoters.map(v => {
      // Find associated booth or default to Village/address
      const bth = booths.find(b => b.id === v.boothId);
      const location = bth ? bth.name : (v.village || 'Assembly Booth Area');
      return {
        name: v.name,
        phone: formatPhoneNumber(v.mobile || '9876543210'),
        voterId: v.voterId,
        vars: [v.name, location]
      };
    });

    let senderPhone = '919000000000';
    if (senderConfigId !== 'shared_service') {
      const selectedConf = configs.find(c => c.id === senderConfigId);
      if (selectedConf) {
        senderPhone = selectedConf.phoneNumber;
      }
    }

    const campaignId = `camp_${Date.now()}`;
    const newCampaign: WhatsAppBroadcast = {
      id: campaignId,
      adminId,
      campaignName,
      senderConfigId,
      senderPhone,
      templateId,
      templateName: selectedTemplate.name,
      mediaUrl: composer.mediaUrl || selectedTemplate.mediaUrl || '',
      mediaType: composer.mediaType !== 'none' ? composer.mediaType : selectedTemplate.mediaType,
      status: 'Sending',
      totalCount: finalRecipients.length,
      successCount: 0,
      failedCount: 0
    };

    try {
      await api.post('/api/whatsapp/broadcasts', newCampaign);
      setCampaigns(prev => [newCampaign, ...prev]);
      setActiveTab('overview');
      showToast(`Broadcast Campaign "${campaignName}" launched successfully!`, 'success');
      
      simulateCampaignSending(campaignId, finalRecipients, selectedTemplate);
    } catch {
      showToast('Could not initiate broadcast in database.', 'error');
    }
  };

  // Background Throttled Sending Simulator
  const simulateCampaignSending = (campId: string, recipients: Recipient[], template: WhatsAppTemplate) => {
    let index = 0;
    const intervalTime = 1800; // complies with Meta's local-rate limit simulation
    
    const interval = setInterval(async () => {
      // Check current status
      let isPaused = false;
      let isDeleted = false;

      setCampaigns(prev => {
        const found = prev.find(c => c.id === campId);
        if (!found) {
          isDeleted = true;
        } else if (found.status === 'Paused') {
          isPaused = true;
        }
        return prev;
      });

      if (isDeleted || isPaused) {
        clearInterval(interval);
        return;
      }

      if (index >= recipients.length) {
        clearInterval(interval);
        try {
          await api.post('/api/whatsapp/broadcasts', {
            id: campId,
            status: 'Completed'
          });
          
          setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status: 'Completed' } : c));
          showToast(`Campaign completed! Sent ${index} messages.`, 'success');
        } catch (e) {
          console.error(e);
        }
        return;
      }

      const current = recipients[index];
      const isSuccess = Math.random() > 0.04; // 96% success rate

      let text = template.bodyText;
      if (current.vars) {
        current.vars.forEach((v, idx) => {
          text = text.replace(`{{${idx + 1}}}`, v || '');
        });
      }

      // Outbound Webhook Receipt Simulator
      const newLog: WebhookLog = {
        id: `log_${Date.now()}_${index}`,
        timestamp: new Date().toLocaleTimeString(),
        sender: current.phone,
        direction: 'outbound',
        message: text,
        status: isSuccess ? 'read' : 'failed',
        tenant: template.adminId === adminId ? 'MLA Custom WABA' : 'Shared Account'
      };

      setWebhookLogs(prev => [newLog, ...prev.slice(0, 39)]);

      // Simulated Voter Inbound Replier
      if (isSuccess && Math.random() > 0.8) {
        setTimeout(() => {
          const voterReplies = [
            'Thanks for the voter slip! Appreciate the outreach.',
            'Got it. Which booth number do I go to?',
            'Thanks, we will support the rally!',
            'Is there transport assistance available for senior citizens?'
          ];
          const randomReply = voterReplies[Math.floor(Math.random() * voterReplies.length)];
          const replyLog: WebhookLog = {
            id: `reply_${Date.now()}`,
            timestamp: new Date().toLocaleTimeString(),
            sender: current.phone,
            direction: 'inbound',
            message: randomReply,
            tenant: template.adminId === adminId ? 'MLA Custom WABA' : 'Shared Account'
          };
          setWebhookLogs(prev => [replyLog, ...prev]);
        }, 4000);
      }

      // Update campaigns array
      setCampaigns(prev => prev.map(c => {
        if (c.id === campId) {
          const successCount = c.successCount + (isSuccess ? 1 : 0);
          const failedCount = c.failedCount + (isSuccess ? 0 : 1);
          
          if (index % 4 === 0 || index === recipients.length - 1) {
            api.post('/api/whatsapp/broadcasts', {
              id: campId,
              successCount,
              failedCount
            }).catch(console.error);
          }

          return {
            ...c,
            successCount,
            failedCount
          };
        }
        return c;
      }));

      index++;
    }, intervalTime);
  };

  const handlePauseCampaign = async (campId: string) => {
    try {
      await api.post('/api/whatsapp/broadcasts', {
        id: campId,
        status: 'Paused'
      });
      setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status: 'Paused' } : c));
      showToast('Broadcast paused.', 'info');
    } catch {
      showToast('Error pausing campaign.', 'error');
    }
  };

  const handleResumeCampaign = async (campId: string) => {
    try {
      await api.post('/api/whatsapp/broadcasts', {
        id: campId,
        status: 'Sending'
      });
      setCampaigns(prev => prev.map(c => c.id === campId ? { ...c, status: 'Sending' } : c));
      showToast('Broadcast resumed.', 'success');
      
      const camp = campaigns.find(c => c.id === campId);
      if (camp) {
        const remainingRecipients = Array.from({ length: camp.totalCount - camp.successCount - camp.failedCount }).map((_, i) => ({
          name: `Simulated Contact ${i + 1}`,
          phone: `91987654${Math.floor(Math.random() * 9000 + 1000)}`,
          vars: [`Voter Name ${i + 1}`, 'Primary Booth Station']
        }));
        const t = templates.find(temp => temp.name === camp.templateName) || templates[0];
        simulateCampaignSending(campId, remainingRecipients, t);
      }
    } catch {
      showToast('Error resuming campaign.', 'error');
    }
  };

  const handleDeleteCampaign = async (campId: string) => {
    if (!window.confirm('Are you sure you want to delete this campaign log from history?')) return;
    try {
      await api.delete(`/api/whatsapp/broadcasts/${campId}`);
      setCampaigns(prev => prev.filter(c => c.id !== campId));
      showToast('Campaign log removed.', 'success');
    } catch {
      showToast('Error deleting campaign log.', 'error');
    }
  };

  // Simulated embedded signup connect
  const handleMetaNext = () => {
    if (metaStep === 1) {
      if (!metaForm.fbEmail || !metaForm.fbPassword) {
        showToast('Please enter your Facebook password.', 'error');
        return;
      }
      setMetaStep(2);
    } else if (metaStep === 2) {
      if (!metaForm.tenantName) {
        showToast('Please enter client/tenant identifier.', 'error');
        return;
      }
      setMetaStep(3);
    } else if (metaStep === 3) {
      if (!metaForm.senderPhone) {
        showToast('Please enter phone number.', 'error');
        return;
      }
      setMetaStep(4);
    } else if (metaStep === 4) {
      if (!metaForm.otpCode || metaForm.otpCode.length < 4) {
        showToast('Please enter verification OTP code.', 'error');
        return;
      }
      saveSimulatedWaba();
    }
  };

  const saveSimulatedWaba = async () => {
    const newConfigId = `config_${Date.now()}`;
    const newConfig: WhatsAppConfig = {
      id: newConfigId,
      adminId,
      tenantType: 'vendor',
      vendorName: metaForm.tenantName,
      phoneNumberId: `phone_id_${Math.floor(Math.random() * 100000000)}`,
      wabaId: `waba_id_${Math.floor(Math.random() * 100000000)}`,
      accessToken: `EAAG${Math.random().toString(36).substring(2, 22).toUpperCase()}`,
      phoneNumber: metaForm.senderPhone,
      status: 'connected'
    };

    try {
      await api.post('/api/whatsapp/configs', newConfig);
      setConfigs(prev => [...prev, newConfig]);
      showToast(`WABA linked successfully for number +${newConfig.phoneNumber}!`, 'success');
      setIsMetaModalOpen(false);
      setMetaStep(1);
      setMetaForm({
        fbEmail: '',
        fbPassword: '',
        businessProfile: 'NextGen Digital Portfolio',
        wabaName: 'NextGen Bulk WABA',
        senderPhone: '',
        otpCode: '',
        tenantName: ''
      });
    } catch {
      showToast('Failed to connect config. Check network and database server.', 'error');
    }
  };

  const handleDeleteConfig = async (configIdToDelete: string, phone: string) => {
    if (!window.confirm(`Disconnect number +${phone}?`)) return;
    try {
      await api.delete(`/api/whatsapp/configs/${configIdToDelete}`);
      setConfigs(prev => prev.filter(c => c.id !== configIdToDelete));
      showToast('WABA number disconnected.', 'success');
    } catch {
      showToast('Error removing configuration.', 'error');
    }
  };

  const handleSendLiveReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInboundMessage.trim()) return;

    const logId = `log_${Date.now()}`;
    const newLog: WebhookLog = {
      id: logId,
      timestamp: new Date().toLocaleTimeString(),
      sender: selectedChatSender,
      direction: 'outbound',
      message: newInboundMessage,
      status: 'read',
      tenant: 'MLA Custom WABA'
    };

    setWebhookLogs(prev => [newLog, ...prev]);
    setNewInboundMessage('');
    showToast('Simulated message dispatched to WhatsApp gateway!', 'success');
  };

  // Helper values for selected template live preview
  const selectedTemplateObj = templates.find(t => t.id === composer.templateId);
  const previewText = selectedTemplateObj 
    ? selectedTemplateObj.bodyText.replace('{{1}}', 'Rahul Sharma').replace('{{2}}', 'Booth No. 124, Gov School')
    : 'Hello Rahul Sharma, your booth slip allocation is finalized. Please bring your epic card.';
  
  const previewMediaType = composer.mediaType !== 'none' 
    ? composer.mediaType 
    : (selectedTemplateObj?.mediaType || 'none');
  
  const previewMediaUrl = composer.mediaUrl || (selectedTemplateObj?.mediaUrl || '');

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <RefreshCw className="w-8 h-8 text-emerald-500 animate-spin" />
        <span className="text-xs text-zinc-500 font-bold">Synchronizing Multi-Tenant Meta Gateway...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
      
      {/* Dynamic Toast Alerts */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-xs font-semibold max-w-sm ${
              notification.type === 'success' 
                ? 'bg-emerald-50 dark:bg-zinc-900 text-emerald-800 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : notification.type === 'error'
                  ? 'bg-red-50 dark:bg-zinc-900 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800'
                  : 'bg-blue-50 dark:bg-zinc-900 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800'
            }`}
          >
            {notification.type === 'success' ? (
              <CheckCircle2 className="w-4.5 h-4.5 shrink-0 text-emerald-500" />
            ) : (
              <AlertCircle className="w-4.5 h-4.5 shrink-0 text-red-500" />
            )}
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <span className="p-3 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-2xl shrink-0 shadow-xs">
              <MessageSquare className="w-6 h-6" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">WB Sender Dashboard</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Official Meta WABA Campaign Manager, Category Targeting & Multi-Tenant Isolated Senders
              </p>
            </div>
          </div>
        </div>

        {/* Tab Selection Navigation */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-zinc-100 dark:bg-zinc-800/60 rounded-2xl max-w-max self-start md:self-center">
          {[
            { id: 'overview', label: 'Campaigns Dashboard' },
            { id: 'campaigns', label: 'Create Campaign' },
            { id: 'templates', label: 'Templates Builder' },
            { id: 'onboard', label: 'WABA Connections' },
            { id: 'webhook', label: 'Callbacks & Live Chat' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as 'overview' | 'campaigns' | 'templates' | 'onboard' | 'webhook')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-900 text-zinc-950 dark:text-white shadow-xs border border-zinc-200/50 dark:border-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-950 dark:hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Container tabs routing */}
      <div className="space-y-6">

        {/* 1. OVERVIEW VIEW */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Recent Campaigns</span>
                  <Layers className="w-4 h-4 text-indigo-500" />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{campaigns.length}</h3>
                <p className="text-[10px] text-zinc-400">Completed and active runs</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Delivered Success</span>
                  <Check className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                  {campaigns.reduce((acc, c) => acc + c.successCount, 0)}
                </h3>
                <p className="text-[10px] text-zinc-400">Transferred safely to Meta API</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Active WABA Senders</span>
                  <Phone className="w-4 h-4 text-emerald-500" />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{configs.length + 1}</h3>
                <p className="text-[10px] text-zinc-400">Pre-configured secure channels</p>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl shadow-xs space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Approved Templates</span>
                  <FileText className="w-4 h-4 text-amber-500" />
                </div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white">{templates.length}</h3>
                <p className="text-[10px] text-zinc-400">Meta compliant categories</p>
              </div>
            </div>

            {/* Campaign List */}
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl shadow-xs overflow-hidden">
              <div className="px-6 py-5 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between flex-wrap gap-4">
                <div>
                  <h2 className="text-base font-bold text-zinc-900 dark:text-white">Active & Past Outbound Campaigns</h2>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Review status logs, speed throttling, and metrics per tenant</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={fetchInitialData}
                    className="p-2 hover:bg-zinc-50 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-500 dark:text-zinc-400 cursor-pointer"
                    title="Reload data"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setActiveTab('campaigns')}
                    className="px-4 py-2 bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 rounded-xl text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-all"
                  >
                    <Plus className="w-4 h-4" /> Create Campaign
                  </button>
                </div>
              </div>

              {campaigns.length === 0 ? (
                <div className="p-16 text-center space-y-4">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/40 text-zinc-400 rounded-2xl max-w-max mx-auto">
                    <Send className="w-8 h-8 text-zinc-400" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-zinc-800 dark:text-white">No campaigns found</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto">
                      Go to the "Create Campaign" tab to construct, target, and trigger your first WhatsApp bulk broadcast.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-zinc-50 dark:bg-zinc-800/30 text-zinc-500 font-bold border-b border-zinc-200 dark:border-zinc-800 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="px-6 py-4">Campaign Details</th>
                        <th className="px-6 py-4">Approved Template</th>
                        <th className="px-6 py-4">Multi-Tenant Sender</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Delivery progress</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                      {campaigns.map((camp) => {
                        const total = camp.totalCount || 0;
                        const sent = camp.successCount + camp.failedCount;
                        const successPct = total > 0 ? Math.round((sent / total) * 100) : 0;
                        
                        return (
                          <tr key={camp.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/10 transition-all">
                            <td className="px-6 py-4">
                              <span className="font-bold text-zinc-950 dark:text-white block text-sm">{camp.campaignName}</span>
                              <span className="text-[10px] text-zinc-400 block mt-0.5">ID: {camp.id}</span>
                            </td>
                            <td className="px-6 py-4">
                              <code className="px-2 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md font-mono text-zinc-700 dark:text-zinc-300">
                                {camp.templateName}
                              </code>
                              {camp.mediaType !== 'none' && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-zinc-400 block mt-1">
                                  {camp.mediaType === 'image' && <ImageIcon className="w-3 h-3 text-sky-500" />}
                                  {camp.mediaType === 'video' && <Video className="w-3 h-3 text-red-500" />}
                                  {camp.mediaType === 'document' && <FileText className="w-3 h-3 text-emerald-500" />}
                                  Attached {camp.mediaType}
                                </span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-zinc-600 dark:text-zinc-300">
                              <span className="font-bold block text-zinc-800 dark:text-zinc-100">+{camp.senderPhone}</span>
                              <span className="text-[10px] text-zinc-400">
                                {camp.senderConfigId === 'shared_service' ? 'Shared Provider' : 'Tenant Dedicated WABA'}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                camp.status === 'Completed'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30'
                                  : camp.status === 'Sending'
                                    ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30 animate-pulse'
                                    : camp.status === 'Paused'
                                      ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30'
                                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                              }`}>
                                {camp.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 min-w-[180px]">
                              <div className="space-y-1.5">
                                <div className="flex justify-between text-[10px] font-semibold text-zinc-500">
                                  <span>{sent} / {total} Delivered</span>
                                  <span>{successPct}%</span>
                                </div>
                                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full transition-all duration-500 ${
                                      camp.status === 'Completed' 
                                        ? 'bg-emerald-500' 
                                        : camp.status === 'Paused' 
                                          ? 'bg-amber-500' 
                                          : 'bg-blue-500'
                                    }`}
                                    style={{ width: `${successPct}%` }}
                                  />
                                </div>
                                <div className="flex gap-2 text-[10px]">
                                  <span className="text-emerald-600 font-bold">{camp.successCount} Success</span>
                                  <span className="text-red-500 font-bold">{camp.failedCount} Failed</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-1.5">
                                {camp.status === 'Sending' && (
                                  <button
                                    onClick={() => handlePauseCampaign(camp.id)}
                                    className="p-1.5 hover:bg-amber-50 dark:hover:bg-amber-950/40 border border-zinc-200 dark:border-zinc-800 text-amber-600 dark:text-amber-400 rounded-lg cursor-pointer transition-colors"
                                    title="Pause Campaign Throttler"
                                  >
                                    <Pause className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {camp.status === 'Paused' && (
                                  <button
                                    onClick={() => handleResumeCampaign(camp.id)}
                                    className="p-1.5 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border border-zinc-200 dark:border-zinc-800 text-emerald-600 dark:text-emerald-400 rounded-lg cursor-pointer transition-colors"
                                    title="Resume Campaign"
                                  >
                                    <Play className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDeleteCampaign(camp.id)}
                                  className="p-1.5 hover:bg-red-50 dark:hover:bg-red-950/30 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:text-red-500 rounded-lg cursor-pointer transition-colors"
                                  title="Delete Log"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

            {/* Compliance Banner */}
            <div className="bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200 dark:border-amber-900/30 rounded-3xl p-5 flex gap-4 items-start">
              <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-bold text-amber-800 dark:text-amber-400">Meta WABA Throttling and Compliance Governor</h4>
                <p className="text-[11px] text-amber-700 dark:text-amber-500/80 leading-relaxed">
                  WhatsApp business limits bulk templates to secure tiers (Tier 1 to Tier 3 limits) based on opt-out quality feedback scores. Our sending loops are built with dynamic variable validation, rendering fallback, and batch compliance filters to fully prevent rate blocking and <code>429 Gateway</code> rejections.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* 2. CREATE CAMPAIGN COMPOSER */}
        {activeTab === 'campaigns' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Panel: Composer */}
            <div className="lg:col-span-7 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-3xl shadow-sm space-y-6">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white font-sans">Setup Campaign & Dynamic Targeting</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Target contacts dynamically by Booth, Karyakarta category in one click</p>
              </div>

              <form onSubmit={handleLaunchCampaign} className="space-y-5">
                
                {/* Campaign Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Campaign Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. West Booth Voter outreach phase 1"
                    value={composer.campaignName}
                    onChange={(e) => setComposer({ ...composer, campaignName: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                {/* Sender Multi-Tenant Configuration */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Select WABA Sender Profile</label>
                  <select
                    value={composer.senderConfigId}
                    onChange={(e) => setComposer({ ...composer, senderConfigId: e.target.value })}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="shared_service">Model A: Shared NextGen Service (Phone: +91 90000 00000)</option>
                    {configs.map(c => (
                      <option key={c.id} value={c.id}>
                        Model B: {c.vendorName} Dedicated (Phone: +{c.phoneNumber})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Select Approved Template */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Select Meta Approved Template</label>
                    <button
                      type="button"
                      onClick={() => setActiveTab('templates')}
                      className="text-xs text-emerald-600 font-bold hover:underline"
                    >
                      New Template +
                    </button>
                  </div>
                  <select
                    value={composer.templateId}
                    onChange={(e) => {
                      const tempId = e.target.value;
                      const matched = templates.find(t => t.id === tempId);
                      setComposer({ 
                        ...composer, 
                        templateId: tempId,
                        mediaType: matched ? matched.mediaType : 'none',
                        mediaUrl: matched ? (matched.mediaUrl || '') : ''
                      });
                    }}
                    className="w-full px-3.5 py-2.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-white outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="">-- Select Template --</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.category} - {t.language})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Override Media Attachments */}
                <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850">
                  <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Override Template Media</span>
                  <div className="grid grid-cols-4 gap-2">
                    {(['none', 'image', 'video', 'document'] as const).map(type => (
                      <button
                        type="button"
                        key={type}
                        onClick={() => setComposer({ ...composer, mediaType: type })}
                        className={`py-2 text-xs font-bold border rounded-lg transition-all capitalize cursor-pointer ${
                          composer.mediaType === type 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>

                  {composer.mediaType !== 'none' && (
                    <div className="space-y-2 mt-2 text-left">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold text-zinc-500">Override Media Attachment</label>
                        <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-250 dark:border-zinc-750">
                          <button
                            type="button"
                            onClick={() => {
                              setComposerMediaMode('url');
                              setComposer({ ...composer, mediaUrl: '' });
                            }}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                              composerMediaMode === 'url'
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                            }`}
                          >
                            Link URL
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setComposerMediaMode('upload');
                              setComposer({ ...composer, mediaUrl: '' });
                            }}
                            className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                              composerMediaMode === 'upload'
                                ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                            }`}
                          >
                            Direct Upload
                          </button>
                        </div>
                      </div>

                      {composerMediaMode === 'upload' ? (
                        <MediaUploader
                          mediaType={composer.mediaType === 'document' ? 'document' : composer.mediaType === 'video' ? 'video' : 'image'}
                          currentUrl={composer.mediaUrl}
                          onUpload={(url) => setComposer({ ...composer, mediaUrl: url })}
                          onClear={() => setComposer({ ...composer, mediaUrl: '' })}
                        />
                      ) : (
                        <input
                          type="url"
                          placeholder="https://example.com/file.jpg"
                          value={composer.mediaUrl}
                          onChange={(e) => setComposer({ ...composer, mediaUrl: e.target.value })}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      )}
                    </div>
                  )}
                </div>

                {/* DYNAMIC RECIPIENT CATEGORY TARGETING IN ONE CLICK */}
                <div className="space-y-3.5 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-800 dark:text-white block">Recipient Selection Targeting Mode</label>
                    <p className="text-[11px] text-zinc-500">Filter voter database by Polling Booth or assigned Karyakarta (volunteer) with quick selection</p>
                  </div>

                  <div className="flex gap-2">
                    {[
                      { id: 'all', label: 'All Registered Voters' },
                      { id: 'booth', label: 'Booth-wise Targeting' },
                      { id: 'karyakarta', label: 'Karyakarta-wise Targeting' }
                    ].map(cat => (
                      <button
                        type="button"
                        key={cat.id}
                        onClick={() => {
                          setRecipientCategory(cat.id as 'all' | 'booth' | 'karyakarta');
                          setSelectedFilterId('');
                        }}
                        className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                          recipientCategory === cat.id
                            ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-500'
                            : 'bg-white dark:bg-zinc-900 text-zinc-500 border-zinc-200 dark:border-zinc-800'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* Sub-selectors depending on selection */}
                  {recipientCategory === 'booth' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Select Polling Booth</label>
                      <select
                        value={selectedFilterId}
                        onChange={(e) => setSelectedFilterId(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-white outline-none"
                      >
                        <option value="">-- Choose Polling Booth --</option>
                        {booths.length > 0 ? (
                          booths.map(b => (
                            <option key={b.id} value={b.id}>
                              {b.boothNumber ? `[Booth ${b.boothNumber}]` : ''} {b.name}
                            </option>
                          ))
                        ) : (
                          // Fallbacks parsed from unique voter demographics
                          Array.from(new Set(voters.map(v => v.village || v.boothId).filter(Boolean))).map(str => (
                            <option key={str} value={str}>{str}</option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {recipientCategory === 'karyakarta' && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Select Karyakarta (Volunteer Advisor)</label>
                      <select
                        value={selectedFilterId}
                        onChange={(e) => setSelectedFilterId(e.target.value)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs text-zinc-800 dark:text-white outline-none"
                      >
                        <option value="">-- Choose Karyakarta --</option>
                        {volunteers.length > 0 ? (
                          volunteers.map(v => (
                            <option key={v.id} value={v.id}>
                              {v.name} ({v.mobile || 'No Phone'})
                            </option>
                          ))
                        ) : (
                          // Fallback based on voters having isKaryakarta: true
                          voters.filter(v => v.isKaryakarta).map(v => (
                            <option key={v.id} value={v.id}>{v.name} (Voter Volunteer)</option>
                          ))
                        )}
                      </select>
                    </div>
                  )}

                  {/* Voters Selection Table inside composer */}
                  <div className="bg-zinc-50 dark:bg-zinc-950 p-4 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-3">
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-zinc-500">Matching Contacts list:</span>
                        <span className="text-[10px] bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-2 py-0.5 rounded-full font-bold">
                          {getFilteredVoters().length} total
                        </span>
                      </div>
                      
                      {/* Search Bar */}
                      <div className="relative max-w-xs w-full">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-400" />
                        <input
                          type="text"
                          placeholder="Search contact..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl text-[11px] outline-none text-zinc-800 dark:text-white"
                        />
                      </div>
                    </div>

                    {/* ONE CLICK SELECTION BUTTONS */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={selectAllFiltered}
                        className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-200 dark:hover:bg-zinc-100 text-white dark:text-zinc-900 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" /> Select All in Category
                      </button>
                      <button
                        type="button"
                        onClick={deselectAllFiltered}
                        className="flex-1 py-1.5 bg-white hover:bg-zinc-100 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-800 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" /> Deselect All
                      </button>
                    </div>

                    {/* Scrollable grid of contacts */}
                    <div className="max-h-44 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-200 dark:divide-zinc-800 bg-white dark:bg-zinc-900">
                      {getFilteredVoters().map(v => {
                        const isSelected = selectedVoters.some(sv => sv.id === v.id);
                        return (
                          <div 
                            key={v.id} 
                            onClick={() => toggleVoterSelection(v)}
                            className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-all ${
                              isSelected ? 'bg-emerald-50/50 dark:bg-emerald-950/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                readOnly
                                className="text-emerald-500 rounded border-zinc-300 focus:ring-emerald-500"
                              />
                              <div>
                                <span className="font-bold text-zinc-800 dark:text-zinc-200 block leading-tight">{v.name}</span>
                                <span className="text-[10px] text-zinc-400">
                                  EPIC: {v.voterId || 'N/A'} • {v.village || 'Booth Location'}
                                </span>
                              </div>
                            </div>
                            <span className="font-mono text-[10px] text-zinc-500">+{v.mobile || '9876543210'}</span>
                          </div>
                        );
                      })}
                    </div>

                    <div className="text-[11px] text-zinc-500 flex justify-between items-center px-1">
                      <span>Total Selected Outbound:</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-md">
                        {selectedVoters.length} recipients selected
                      </span>
                    </div>

                  </div>
                </div>

                {/* RUN CAMPAIGN TRIGGER BUTTON */}
                <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    type="submit"
                    className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-bold flex items-center justify-center gap-2 shadow-lg hover:shadow-xl hover:translate-y-[-1px] transition-all cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    Run Campaign Outbound Now
                  </button>
                </div>

              </form>
            </div>

            {/* Right Panel: WhatsApp Interactive Preview Mockup */}
            <div className="lg:col-span-5 flex flex-col gap-6">
              
              <div className="bg-zinc-100 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-[36px] p-4 shadow-xl flex-1 flex flex-col min-h-[500px] relative">
                
                {/* Phone Notch/Bezel details */}
                <div className="w-32 h-6 bg-zinc-900 dark:bg-zinc-900 rounded-full mx-auto mb-3 flex items-center justify-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                  <div className="w-10 h-1.5 rounded-full bg-zinc-700" />
                </div>

                {/* Phone screen container */}
                <div className="flex-1 bg-zinc-200/50 dark:bg-zinc-900/40 rounded-[28px] border border-zinc-250 dark:border-zinc-850 overflow-hidden flex flex-col justify-between">
                  
                  {/* Mock WhatsApp Header bar */}
                  <div className="bg-emerald-800 text-white px-4 py-3 flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-xs font-black shadow-inner">
                        <MessageSquare className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold leading-none">Meta Outreach Gateway</h4>
                        <span className="text-[9px] text-emerald-200 font-medium">Official verified service</span>
                      </div>
                    </div>
                    <Radio className="w-4.5 h-4.5 text-emerald-300 animate-pulse" />
                  </div>

                  {/* Chat Message Bubble */}
                  <div className="flex-1 p-4 flex flex-col justify-end space-y-4">
                    
                    <div className="bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white max-w-[85%] rounded-2xl p-3 shadow-md space-y-2.5 border border-zinc-100 dark:border-zinc-700/50 relative">
                      
                      {/* Media Header Preview */}
                      {previewMediaType !== 'none' && (
                        <div className="overflow-hidden rounded-xl border border-zinc-100 dark:border-zinc-700/50 bg-zinc-50 dark:bg-zinc-950">
                          {previewMediaType === 'image' && (
                            <img 
                              src={previewMediaUrl || "https://images.unsplash.com/photo-1540910419892-4a36d2c3266c?auto=format&fit=crop&w=800&q=80"} 
                              alt="Outbound attachment"
                              referrerPolicy="no-referrer"
                              className="w-full h-32 object-cover"
                            />
                          )}

                          {previewMediaType === 'video' && (
                            <div className="w-full h-32 relative bg-zinc-900 flex items-center justify-center">
                              <Video className="w-10 h-10 text-white opacity-80" />
                              <span className="absolute bottom-2 right-2 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">0:15 Mins Video</span>
                            </div>
                          )}

                          {previewMediaType === 'document' && (
                            <div className="p-3 flex items-center gap-3">
                              <FileText className="w-8 h-8 text-emerald-600 shrink-0" />
                              <div className="truncate">
                                <span className="text-xs font-bold block truncate">VOTER_INFORMATION_SLIP.pdf</span>
                                <span className="text-[10px] text-zinc-400 block uppercase">PDF File • 1.2 MB</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Text Message Body */}
                      <p className="text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed">
                        {previewText}
                      </p>

                      {/* Timestamp */}
                      <span className="text-[9px] text-zinc-400 block text-right mt-1 font-mono">
                        {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>

                      {/* Render Interactive Buttons if template has them */}
                      {selectedTemplateObj?.buttons && selectedTemplateObj.buttons.map((btn, idx) => (
                        <div 
                          key={idx} 
                          className="pt-2 border-t border-zinc-100 dark:border-zinc-700/50 mt-2 text-center"
                        >
                          <a
                            href={btn.type === 'URL' ? btn.value : '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 font-bold hover:underline py-1 w-full"
                          >
                            {btn.type === 'URL' && <ExternalLink className="w-3 h-3" />}
                            {btn.type === 'PHONE' && <Phone className="w-3 h-3" />}
                            {btn.type === 'QUICK_REPLY' && <MessageCircle className="w-3 h-3" />}
                            {btn.text}
                          </a>
                        </div>
                      ))}

                    </div>

                  </div>

                  {/* Keyboard Area mock */}
                  <div className="bg-white dark:bg-zinc-900 p-3.5 border-t border-zinc-200 dark:border-zinc-800 shrink-0 text-center text-[10px] text-zinc-500 font-mono">
                    WhatsApp Campaign Real-time Preview Frame
                  </div>

                </div>
              </div>

              {/* Personalization advisory */}
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl space-y-1.5">
                <h4 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Live Personalization Rules</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                  Variables such as <code>{"{{1}}"}</code> substitute the target contact's full name, and <code>{"{{2}}"}</code> triggers their verified polling booth station dynamically from the central database schema.
                </p>
              </div>

            </div>

          </div>
        )}

        {/* 3. TEMPLATES BUILDER */}
        {activeTab === 'templates' && (
          <div className="space-y-6">
            
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Compliance Message Templates</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Manage and create compliant WhatsApp marketing or utility templates</p>
              </div>
              <button
                onClick={() => setIsTemplateModalOpen(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Create New Template
              </button>
            </div>

            {/* Grid of Templates */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(temp => (
                <div key={temp.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-2xl flex flex-col justify-between space-y-4 relative shadow-xs">
                  
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black tracking-widest text-zinc-400 uppercase">
                      {temp.category}
                    </span>
                    <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/30">
                      {temp.status}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold text-zinc-950 dark:text-white truncate">{temp.name}</h3>
                    
                    {/* Media Type indicator */}
                    {temp.mediaType !== 'none' && (
                      <div className="flex items-center gap-1 text-[10px] text-zinc-400 bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-100 dark:border-zinc-800">
                        {temp.mediaType === 'image' && <ImageIcon className="w-3.5 h-3.5 text-sky-500" />}
                        {temp.mediaType === 'video' && <Video className="w-3.5 h-3.5 text-red-500" />}
                        {temp.mediaType === 'document' && <FileText className="w-3.5 h-3.5 text-emerald-500" />}
                        <span>Media: {temp.mediaType.toUpperCase()}</span>
                      </div>
                    )}

                    <p className="text-xs text-zinc-600 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-950 p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-850/50 leading-relaxed font-serif italic">
                      {temp.bodyText}
                    </p>

                    {/* Quick Button link preview */}
                    {temp.buttons && temp.buttons.map((b, i) => (
                      <div key={i} className="flex items-center gap-1 text-[10px] text-emerald-600 font-bold border border-emerald-100 dark:border-emerald-900/30 bg-emerald-50/50 dark:bg-emerald-950/20 px-2.5 py-1.5 rounded-lg">
                        <ExternalLink className="w-3 h-3" />
                        <span>Button Link: "{b.text}" ({b.type})</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center pt-3.5 border-t border-zinc-100 dark:border-zinc-800 text-[10px]">
                    <span className="text-zinc-400">Language: <code>{temp.language}</code></span>
                    {temp.id !== 'default_marketing' && temp.id !== 'default_utility' && (
                      <button
                        onClick={() => handleDeleteTemplate(temp.id, temp.name)}
                        className="text-zinc-400 hover:text-red-500 cursor-pointer p-1 transition-colors"
                        title="Delete Template"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                </div>
              ))}
            </div>

            {/* Create Template Modal */}
            {isTemplateModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/75 backdrop-blur-xs">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5">
                  <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">Create WhatsApp Compliance Template</h3>
                    <button onClick={() => setIsTemplateModalOpen(false)} className="text-zinc-400 hover:text-zinc-500 p-1">
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </div>

                  <form onSubmit={handleCreateTemplate} className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Template Name</label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. rally_invitation"
                          value={newTemplate.name}
                          onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-white"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Category</label>
                        <select
                          value={newTemplate.category}
                          onChange={(e) => setNewTemplate({ ...newTemplate, category: e.target.value as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION' })}
                          className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-white"
                        >
                          <option value="MARKETING">MARKETING</option>
                          <option value="UTILITY">UTILITY</option>
                          <option value="AUTHENTICATION">AUTHENTICATION</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-600 dark:text-zinc-400">Body Message Text</label>
                      <textarea
                        required
                        rows={4}
                        placeholder="Write message template. Support dynamic personalization variables using {{1}}, {{2}}."
                        value={newTemplate.bodyText}
                        onChange={(e) => setNewTemplate({ ...newTemplate, bodyText: e.target.value })}
                        className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 rounded-xl text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-white font-mono"
                      />
                    </div>

                    {/* CUSTOM ATTACHMENTS */}
                    <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Default Attached Media</span>
                      <div className="grid grid-cols-4 gap-2">
                        {(['none', 'image', 'video', 'document'] as const).map(type => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => setNewTemplate({ ...newTemplate, mediaType: type })}
                            className={`py-2 text-xs font-bold border rounded-lg transition-all capitalize cursor-pointer ${
                              newTemplate.mediaType === type 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                            }`}
                          >
                            {type}
                          </button>
                        ))}
                      </div>

                      {newTemplate.mediaType !== 'none' && (
                        <div className="space-y-2 mt-2 text-left">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-bold text-zinc-500">Default Media Attachment</label>
                            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-900 p-0.5 rounded-lg border border-zinc-250 dark:border-zinc-750">
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateMediaMode('url');
                                  setNewTemplate({ ...newTemplate, mediaUrl: '' });
                                }}
                                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                                  templateMediaMode === 'url'
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                                }`}
                              >
                                Link URL
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setTemplateMediaMode('upload');
                                  setNewTemplate({ ...newTemplate, mediaUrl: '' });
                                }}
                                className={`px-2 py-1 text-[9px] font-bold rounded-md transition-all cursor-pointer ${
                                  templateMediaMode === 'upload'
                                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white shadow-xs'
                                    : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700'
                                }`}
                              >
                                Direct Upload
                              </button>
                            </div>
                          </div>

                          {templateMediaMode === 'upload' ? (
                            <MediaUploader
                              mediaType={newTemplate.mediaType === 'document' ? 'document' : newTemplate.mediaType === 'video' ? 'video' : 'image'}
                              currentUrl={newTemplate.mediaUrl}
                              onUpload={(url) => setNewTemplate({ ...newTemplate, mediaUrl: url })}
                              onClear={() => setNewTemplate({ ...newTemplate, mediaUrl: '' })}
                            />
                          ) : (
                            <input
                              type="url"
                              placeholder="https://example.com/file.jpg"
                              value={newTemplate.mediaUrl}
                              onChange={(e) => setNewTemplate({ ...newTemplate, mediaUrl: e.target.value })}
                              className="w-full px-3 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    {/* ATTACH BUTTONS */}
                    <div className="space-y-2.5 bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-150 dark:border-zinc-850">
                      <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 block">Interactive Action Button (Optional)</span>
                      <div className="grid grid-cols-4 gap-2">
                        {(['none', 'URL', 'PHONE', 'QUICK_REPLY'] as const).map(type => (
                          <button
                            type="button"
                            key={type}
                            onClick={() => setNewTemplate({ ...newTemplate, buttonType: type })}
                            className={`py-2 text-xs font-bold border rounded-lg transition-all capitalize cursor-pointer ${
                              newTemplate.buttonType === type 
                                ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100'
                            }`}
                          >
                            {type === 'none' ? 'None' : type}
                          </button>
                        ))}
                      </div>

                      {newTemplate.buttonType !== 'none' && (
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500">Button Label</label>
                            <input
                              type="text"
                              placeholder="e.g. Join Chat"
                              value={newTemplate.buttonText}
                              onChange={(e) => setNewTemplate({ ...newTemplate, buttonText: e.target.value })}
                              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-zinc-500">
                              {newTemplate.buttonType === 'URL' ? 'Website URL' : newTemplate.buttonType === 'PHONE' ? 'Phone number' : 'Reply payload'}
                            </label>
                            <input
                              type="text"
                              placeholder={newTemplate.buttonType === 'URL' ? 'https://..' : newTemplate.buttonType === 'PHONE' ? '919000...' : 'Payload'}
                              value={newTemplate.buttonValue}
                              onChange={(e) => setNewTemplate({ ...newTemplate, buttonValue: e.target.value })}
                              className="w-full px-3 py-1.5 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-white dark:bg-zinc-900 text-xs text-zinc-800 dark:text-white"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3">
                      <button
                        type="button"
                        onClick={() => setIsTemplateModalOpen(false)}
                        className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-xs font-semibold rounded-xl hover:bg-zinc-50 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
                      >
                        Create Template
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

          </div>
        )}

        {/* 4. LINK WABA CONNECTIONS */}
        {activeTab === 'onboard' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-white">Multi-Tenant WABA Connections</h2>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">Onboard and isolated specific client campaigns with embedded Facebook profiles</p>
              </div>
              <button
                onClick={() => setIsMetaModalOpen(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="w-4 h-4" /> Link Custom WABA
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Shared Provider */}
              <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="p-1.5 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <Globe className="w-4 h-4" />
                    </span>
                    <h3 className="text-xs font-black tracking-wider uppercase text-zinc-400">Shared NextGen Gateway</h3>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-zinc-850 dark:text-white">Default Assembly Broadcaster</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
                      This predefined central account is shared among campaigns for quick testing or low-tier broadcasts. Throttling is controlled automatically.
                    </p>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between py-1 border-b border-zinc-150 dark:border-zinc-850">
                    <span className="text-zinc-400">Default Phone</span>
                    <span className="font-mono font-bold text-zinc-800 dark:text-white">+91 90000 00000</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-zinc-150 dark:border-zinc-850">
                    <span className="text-zinc-400">Throttling Level</span>
                    <span className="text-emerald-500 font-bold">Uncapped (Tier 3)</span>
                  </div>
                </div>
              </div>

              {/* Dedicated Tenant-isolated Senders */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Dedicated Tenant isolated WABA lines</h3>
                
                {configs.length === 0 ? (
                  <div className="border border-dashed border-zinc-200 dark:border-zinc-800 p-8 rounded-2xl text-center space-y-2">
                    <Key className="w-5 h-5 text-zinc-400 mx-auto" />
                    <p className="text-xs font-bold text-zinc-800 dark:text-white">No custom numbers linked</p>
                    <p className="text-[10px] text-zinc-500 max-w-xs mx-auto">
                      Link your dedicated company or MLA-specific Facebook Business credentials above to scale.
                    </p>
                  </div>
                ) : (
                  configs.map(conf => (
                    <div key={conf.id} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl flex items-center justify-between shadow-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs text-zinc-900 dark:text-white">{conf.vendorName}</span>
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[8px] font-black uppercase rounded">
                            Model B
                          </span>
                        </div>
                        <div className="text-[10px] text-zinc-500">
                          Sender Line: <code className="font-bold text-zinc-700 dark:text-zinc-300">+{conf.phoneNumber}</code>
                        </div>
                        <div className="text-[9px] font-mono text-zinc-400">WABA ID: {conf.wabaId}</div>
                      </div>

                      <button
                        onClick={() => handleDeleteConfig(conf.id, conf.phoneNumber)}
                        className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 rounded-xl cursor-pointer transition-colors"
                        title="Disconnect Line"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>

            {/* Simulated Embedded Sign-up wizard */}
            {isMetaModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/80 backdrop-blur-xs">
                <div className="bg-zinc-900 text-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-zinc-800 space-y-6 text-left">
                  
                  <div className="flex justify-between items-center border-b border-zinc-800 pb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-white text-xs">f</div>
                      <span className="text-xs font-bold uppercase tracking-widest text-zinc-400 font-mono">Meta Business Connect</span>
                    </div>
                    <button onClick={() => { setIsMetaModalOpen(false); setMetaStep(1); }} className="text-zinc-400 hover:text-white p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Step Progress */}
                  <div className="flex justify-between items-center gap-1.5">
                    {[1, 2, 3, 4].map(idx => (
                      <div key={idx} className="flex-1 space-y-1">
                        <div className={`h-1.5 rounded-full ${metaStep >= idx ? 'bg-blue-500' : 'bg-zinc-800'}`} />
                        <span className="text-[8px] text-zinc-500 block text-center font-bold">
                          {idx === 1 ? 'Login' : idx === 2 ? 'Tenant' : idx === 3 ? 'Line' : 'Verify'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    {metaStep === 1 && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <h4 className="text-sm font-bold">Log in with Facebook Credentials</h4>
                          <p className="text-[10px] text-zinc-400">Grant secure API sync rights for WhatsApp Business Profile</p>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="email"
                            placeholder="Facebook Email or Mobile"
                            value={metaForm.fbEmail}
                            onChange={(e) => setMetaForm({ ...metaForm, fbEmail: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-xs outline-none"
                          />
                          <input
                            type="password"
                            placeholder="Password"
                            value={metaForm.fbPassword}
                            onChange={(e) => setMetaForm({ ...metaForm, fbPassword: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {metaStep === 2 && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <h4 className="text-sm font-bold">Client Isolation Profile</h4>
                          <p className="text-[10px] text-zinc-400">Enter a descriptive name for this multi-tenant sender profile</p>
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-zinc-400">Tenant Vendor Name</label>
                          <input
                            type="text"
                            placeholder="e.g. MLA West Campaign Desk"
                            value={metaForm.tenantName}
                            onChange={(e) => setMetaForm({ ...metaForm, tenantName: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-xs outline-none"
                          />
                        </div>
                      </div>
                    )}

                    {metaStep === 3 && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <h4 className="text-sm font-bold">Assign WhatsApp Line Phone</h4>
                          <p className="text-[10px] text-zinc-400">Register the number to connect to NextGen Multi-tenant gateway</p>
                        </div>
                        <div className="space-y-2">
                          <input
                            type="tel"
                            placeholder="Phone (e.g. 919876543210)"
                            value={metaForm.senderPhone}
                            onChange={(e) => setMetaForm({ ...metaForm, senderPhone: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-xs outline-none font-mono"
                          />
                          <span className="text-[9px] text-zinc-500 leading-relaxed block text-center">
                            The phone number must not be associated with a personal WhatsApp client account.
                          </span>
                        </div>
                      </div>
                    )}

                    {metaStep === 4 && (
                      <div className="space-y-3">
                        <div className="text-center space-y-1">
                          <h4 className="text-sm font-bold">SMS Verification Confirmation</h4>
                          <p className="text-[10px] text-zinc-400">A verification SMS code was triggered to +{metaForm.senderPhone}</p>
                        </div>
                        <div className="space-y-2 text-center">
                          <input
                            type="text"
                            maxLength={6}
                            placeholder="Enter Code (e.g. 556421)"
                            value={metaForm.otpCode}
                            onChange={(e) => setMetaForm({ ...metaForm, otpCode: e.target.value })}
                            className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-white rounded-xl text-center text-sm font-mono tracking-widest outline-none max-w-[160px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex justify-end gap-2.5 pt-3 border-t border-zinc-800">
                    {metaStep > 1 && (
                      <button
                        onClick={() => setMetaStep(prev => prev - 1)}
                        className="px-3.5 py-1.5 border border-zinc-700 hover:bg-zinc-850 rounded-xl text-xs cursor-pointer"
                      >
                        Back
                      </button>
                    )}
                    <button
                      onClick={handleMetaNext}
                      className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-xs cursor-pointer shadow-md"
                    >
                      {metaStep === 4 ? 'Complete Link' : 'Continue'}
                    </button>
                  </div>

                </div>
              </div>
            )}

          </div>
        )}

        {/* 5. CALLBACK WEBHOOK LOGS & LIVE CHAT RESPONSE */}
        {activeTab === 'webhook' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Box: callback webhooks log */}
            <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-5 rounded-3xl shadow-xs space-y-4">
              <div className="flex justify-between items-center border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-zinc-900 dark:text-white">Live Webhook Event Callback</h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Real-time meta payload logs: read, delivery receipts, user replies</p>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                  <span className="text-[10px] font-bold text-emerald-500">LISTENING</span>
                </div>
              </div>

              {/* Log stream details */}
              <div className="bg-zinc-50 dark:bg-zinc-950 p-3 rounded-xl flex items-center justify-between text-xs font-mono text-zinc-500">
                <span className="truncate">https://api.nextgen.cms/v1/whatsapp/webhook</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText('https://api.nextgen.cms/v1/whatsapp/webhook');
                    showToast('Webhook copied!', 'success');
                  }}
                  className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded text-zinc-400 shrink-0 cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {webhookLogs.map((log) => (
                  <div 
                    key={log.id} 
                    onClick={() => setSelectedChatSender(log.sender)}
                    className="p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100 dark:hover:bg-zinc-800/40 rounded-xl text-xs space-y-1.5 transition-all cursor-pointer border border-zinc-150 dark:border-zinc-850"
                  >
                    <div className="flex justify-between text-[10px]">
                      <span className="font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.direction === 'inbound' ? 'bg-blue-500' : 'bg-zinc-400'}`} />
                        +{log.sender}
                      </span>
                      <span className="text-zinc-400">{log.timestamp}</span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 font-medium break-all">{log.message}</p>
                    <div className="flex justify-between items-center text-[9px] text-zinc-400 pt-1 border-t border-zinc-200/50 dark:border-zinc-800/50">
                      <span>Tenant: <code className="font-bold">{log.tenant}</code></span>
                      <span className="capitalize">{log.direction} activity</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Box: Chat Panel */}
            <div className="lg:col-span-6 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl overflow-hidden flex flex-col justify-between min-h-[480px]">
              
              <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-bold text-zinc-900 dark:text-white">Active Chat: +{selectedChatSender}</h3>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Reply and answer live inquiries instantly</p>
                </div>
                <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded">
                  Interactive Response
                </span>
              </div>

              {/* Chat conversations */}
              <div className="flex-1 p-5 overflow-y-auto bg-zinc-50/50 dark:bg-zinc-950/30 space-y-4">
                {webhookLogs
                  .filter(l => l.sender === selectedChatSender)
                  .reverse()
                  .map((m) => {
                    const isInbound = m.direction === 'inbound';
                    return (
                      <div 
                        key={m.id} 
                        className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] rounded-2xl p-3 shadow-xs text-xs ${
                          isInbound 
                            ? 'bg-white dark:bg-zinc-800 text-zinc-850 dark:text-zinc-200 border border-zinc-150 dark:border-zinc-850' 
                            : 'bg-emerald-600 text-white font-medium'
                        }`}>
                          <p className="whitespace-pre-wrap">{m.message}</p>
                          <span className={`text-[8px] text-right block mt-1 ${isInbound ? 'text-zinc-400' : 'text-emerald-200'}`}>
                            {m.timestamp}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>

              {/* Send Chat Reply */}
              <form onSubmit={handleSendLiveReply} className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
                <input
                  type="text"
                  required
                  placeholder={`Send live reply back to +${selectedChatSender}...`}
                  value={newInboundMessage}
                  onChange={(e) => setNewInboundMessage(e.target.value)}
                  className="flex-1 px-3.5 py-2 border border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs focus:ring-1 focus:ring-emerald-500 outline-none text-zinc-800 dark:text-white"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center cursor-pointer shadow-xs"
                >
                  Send
                </button>
              </form>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
