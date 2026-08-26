import React, { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { api } from './api.js';
import './styles.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [user, setUser] = useState(null);

  // Modal controllers
  const [modal, setModal] = useState(null); // 'connection', 'job', 'application', 'outreach', 'csv'
  const [editItem, setEditItem] = useState(null);
  const [editingConnectionAi, setEditingConnectionAi] = useState(false);
  const [loadingConnectionAi, setLoadingConnectionAi] = useState(false);

  // AI Outreach Assistant States
  const [aiIntent, setAiIntent] = useState('referral_request');
  const [aiTone, setAiTone] = useState('professional');
  const [aiLength, setAiLength] = useState('short');
  const [aiDraft, setAiDraft] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [aiWarnings, setAiWarnings] = useState([]);
  const [aiForceGenerate, setAiForceGenerate] = useState(false);

  const handleEnrichConnectionAi = async (connectionId) => {
    setLoadingConnectionAi(true);
    try {
      await api.request(`/connections/${connectionId}/ai-enrich`, { method: 'POST' });
      const detailRes = await api.request(`/connections/${connectionId}`);
      setEditItem(detailRes.data);
    } catch (err) {
      alert(err.message || 'AI enrichment failed.');
    } finally {
      setLoadingConnectionAi(false);
    }
  };

  const handleSaveConnectionAiCorrections = async (connectionId, corrections) => {
    try {
      await api.request(`/connections/${connectionId}/ai-corrections`, {
        method: 'PUT',
        body: JSON.stringify(corrections)
      });
      const detailRes = await api.request(`/connections/${connectionId}`);
      setEditItem(detailRes.data);
      setEditingConnectionAi(false);
    } catch (err) {
      alert(err.message || 'Failed to save corrections.');
    }
  };

  const handleGenerateAiDraft = async (force = false) => {
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await api.request('/outreach/ai-drafts/generate', {
        method: 'POST',
        body: {
          jobId: editItem?.job_id || null,
          connectionId: editItem?.id || null,
          intent: aiIntent,
          tone: aiTone,
          length: aiLength,
          forceGenerate: force
        }
      });
      if (res.success) {
        const payload = res.data;
        if (!payload.allowed) {
          setAiWarnings(payload.warnings || []);
        } else {
          setAiDraft(payload.draft);
          setAiWarnings(payload.warnings || []);
          // Populate notes textarea automatically
          const notesTextarea = document.querySelector('textarea[name="notes"]');
          if (notesTextarea) {
            notesTextarea.value = payload.draft.message;
          }
        }
      }
    } catch (err) {
      if (err.message === 'AI_PROVIDER_UNAVAILABLE') {
        setAiError('AI draft generation is temporarily unavailable. You can still create outreach manually.');
      } else {
        setAiError(err.message || 'Generation failed.');
      }
    } finally {
      setAiLoading(false);
    }
  };

  const handleDiscardDraft = async () => {
    if (aiDraft?.id) {
      try {
        await api.request(`/outreach/ai-drafts/${aiDraft.id}/discard`, { method: 'POST' });
      } catch (e) {
        console.warn('Discard failed:', e.message);
      }
    }
    setAiDraft(null);
    setAiWarnings([]);
    setAiForceGenerate(false);
    const notesTextarea = document.querySelector('textarea[name="notes"]');
    if (notesTextarea) {
      notesTextarea.value = '';
    }
  };

  // Core States
  const [stats, setStats] = useState({
    totalJobs: 0, newJobs: 0, savedJobs: 0, applications: 0,
    interviews: 0, offers: 0, totalConnections: 0, followUpsDue: 0,
    recentActivity: []
  });
  const [profile, setProfile] = useState({
    name: '', phone: '', location: '', targetRoles: [],
    targetCompanies: [], preferredLocations: [], remotePreference: '',
    experience: '', skills: [], salaryPreference: '', bio: ''
  });
  const [resumes, setResumes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [applications, setApplications] = useState([]);
  const [outreachList, setOutreachList] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Pagination & Filter States
  const [connFilters, setConnFilters] = useState({ page: 1, pageSize: 10, q: '', company: '', title: '' });
  const [connMeta, setConnMeta] = useState({ total: 0, totalPages: 1 });
  const [jobFilters, setJobFilters] = useState({ page: 1, pageSize: 10, q: '', company: '', location: '', status: '', archived: false });
  const [jobMeta, setJobMeta] = useState({ total: 0, totalPages: 1 });
  const [connSearchMode, setConnSearchMode] = useState('keyword');
  const [semanticConnResults, setSemanticConnResults] = useState(null);
  const [searchingSemantic, setSearchingSemantic] = useState(false);
  const [jobSearchMode, setJobSearchMode] = useState('keyword');
  const [semanticJobResults, setSemanticJobResults] = useState(null);
  const [searchingJobSemantic, setSearchingJobSemantic] = useState(false);
  const [syncingEmbeddings, setSyncingEmbeddings] = useState(false);
  const [jobSubTab, setJobSubTab] = useState('list'); // 'list', 'sources'
  const [searchProfiles, setSearchProfiles] = useState([]);
  const [gmailStatus, setGmailStatus] = useState(null);
  const [gmailSyncing, setGmailSyncing] = useState(false);
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [telegramLinkingCode, setTelegramLinkingCode] = useState(null);
  const [incomingJobs, setIncomingJobs] = useState([]);
  const [loadingIncoming, setLoadingIncoming] = useState(false);
  const [reviewJob, setReviewJob] = useState(null);
  const [ingestionMonitor, setIngestionMonitor] = useState(null);
  const [deduplicationLogs, setDeduplicationLogs] = useState([]);
  const [preferences, setPreferences] = useState({
    notificationsEnabled: true,
    notifyHighlyRelevant: true,
    notifyStrongReferral: true,
    notifyTargetCompany: true,
    dailyDigestEnabled: true,
    notifyLowRelevance: false,
    minimumMatchScore: 80,
    preferredJobLocations: [],
    preferredJobRoles: [],
    remotePreference: ''
  });

  const [editingAiEnrichment, setEditingAiEnrichment] = useState(false);
  const [selectedResumeId, setSelectedResumeId] = useState(null);
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [loadingResumeAnalysis, setLoadingResumeAnalysis] = useState(false);

  // Connection detail states
  const [activeConnectionId, setActiveConnectionId] = useState(null);
  const [connectionDetail, setConnectionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newTagText, setNewTagText] = useState('');

  // Overview dashboard states
  const [connectionSubTab, setConnectionSubTab] = useState('overview'); // 'overview', 'all', 'companies', 'saved_views', 'follow_ups'
  const [dashboardOverview, setDashboardOverview] = useState(null);
  const [loadingOverview, setLoadingOverview] = useState(false);
  const [overviewError, setOverviewError] = useState(null);

  // Company directory states
  const [companies, setCompanies] = useState([]);
  const [companiesMeta, setCompaniesMeta] = useState({ total: 0, totalPages: 1 });
  const [companiesPage, setCompaniesPage] = useState(1);
  const [companySearch, setCompanySearch] = useState('');
  const [companySortBy, setCompanySortBy] = useState('connections');
  const [companySortOrder, setCompanySortOrder] = useState('desc');
  const [activeCompanyKey, setActiveCompanyKey] = useState(null);
  const [companyDetailData, setCompanyDetailData] = useState(null);
  const [loadingCompanyDetail, setLoadingCompanyDetail] = useState(false);

  // PDF Enrichment states
  const [enrichmentPreview, setEnrichmentPreview] = useState(null);
  const [enrichmentLoading, setEnrichmentLoading] = useState(false);
  const [enrichmentError, setEnrichmentError] = useState(null);
  const [pdfObjectURL, setPdfObjectURL] = useState(null);
  const [showOriginalPdf, setShowOriginalPdf] = useState(false);

  const closeEnrichmentModal = () => {
    if (pdfObjectURL) {
      URL.revokeObjectURL(pdfObjectURL);
      setPdfObjectURL(null);
    }
    setEnrichmentPreview(null);
    setEnrichmentError(null);
    setModal(null);
  };

  // Saved Views States
  const [savedViews, setSavedViews] = useState([]);
  const [activeViewId, setActiveViewId] = useState('all'); // 'all', 'high_priority', 'never_contacted', 'follow_ups', or view UUID
  const [activeViewName, setActiveViewName] = useState('All Connections');
  const [showSaveViewModal, setShowSaveViewModal] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewDesc, setNewViewDesc] = useState('');

  // Job Network Workspace States
  const [jobNetworkSubTab, setJobNetworkSubTab] = useState('overview'); // 'overview', 'application', 'network'
  const [jobNetworkDetails, setJobNetworkDetails] = useState(null);
  const [jobNetworkFilters, setJobNetworkFilters] = useState({
    page: 1,
    limit: 10,
    roleCategory: '',
    seniority: '',
    relationshipStatus: '',
    relationshipStrength: '',
    priority: '',
    sortBy: 'referralScore',
    sortOrder: 'desc'
  });
  // eslint-disable-next-line no-unused-vars
  const [jobNetworkMeta, setJobNetworkMeta] = useState({ total: 0, totalPages: 1 });
  const [jobNetworkLoading, setJobNetworkLoading] = useState(false);

  // Auth Forms State
  const [authTab, setAuthTab] = useState('login'); // 'login', 'register', 'forgot'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authSuccess, setAuthSuccess] = useState('');

  // Handle auto logout
  useEffect(() => {
    api.onLogout = () => {
      setIsAuthenticated(false);
      setUser(null);
    };
    if (api.accessToken) {
      loadSession();
    }
  }, []);

  useEffect(() => {
    if (modal !== 'outreach') {
      setAiIntent('referral_request');
      setAiTone('professional');
      setAiLength('short');
      setAiDraft(null);
      setAiLoading(false);
      setAiError(null);
      setAiWarnings([]);
      setAiForceGenerate(false);
    }
  }, [modal]);

  // Reload data when active tab changes or filters change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') loadDashboard();
      if (activeTab === 'profile') loadProfile();
      if (activeTab === 'resumes') loadResumes();
      if (activeTab === 'connections') loadConnections();
      if (activeTab === 'jobs') {
        loadJobs();
        loadSearchProfiles();
        loadGmailStatus();
        loadTelegramStatus();
        loadIncomingJobs();
        loadIngestionMonitor();
        loadDeduplicationLogs();
        loadPreferences();
      }
      if (activeTab === 'applications') loadApplications();
      if (activeTab === 'outreach') loadOutreach();
      loadNotifications();
    }
  }, [isAuthenticated, activeTab, connFilters, jobFilters, jobFilters.archived]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connection-detail' && activeConnectionId) {
      loadConnectionDetail(activeConnectionId);
    }
  }, [isAuthenticated, activeTab, activeConnectionId]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && connectionSubTab === 'overview') {
      loadDashboardOverview();
    }
  }, [isAuthenticated, activeTab, connectionSubTab]);

  const loadDashboardOverview = async () => {
    setLoadingOverview(true);
    setOverviewError(null);
    try {
      const res = await api.request('/connections/overview');
      setDashboardOverview(res.data);
    } catch (e) {
      setOverviewError(e.message || 'Failed to load dashboard overview.');
    } finally {
      setLoadingOverview(false);
    }
  };

  const loadSavedViews = async () => {
    try {
      const res = await api.request('/connections/views');
      setSavedViews(res.data || []);
    } catch (e) {
      console.error('Failed to load saved views', e);
    }
  };

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && connectionSubTab === 'companies') {
      loadCompanies();
    }
  }, [isAuthenticated, activeTab, connectionSubTab, companiesPage, companySearch, companySortBy, companySortOrder]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections' && activeCompanyKey) {
      loadCompanyDetail(activeCompanyKey);
    }
  }, [isAuthenticated, activeTab, activeCompanyKey]);

  const loadCompanies = async () => {
    try {
      const res = await api.listCompanies({
        search: companySearch,
        page: companiesPage,
        limit: 25,
        sortBy: companySortBy,
        sortOrder: companySortOrder
      });
      setCompanies(res.data);
      setCompaniesMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadCompanyDetail = async (key) => {
    setLoadingCompanyDetail(true);
    try {
      const res = await api.getCompanyDetail(key);
      setCompanyDetailData(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingCompanyDetail(false);
    }
  };

  // URL synchronization
  const updateURLFromFilters = (filters) => {
    const query = new URLSearchParams();
    Object.keys(filters).forEach((key) => {
      const val = filters[key];
      if (val !== undefined && val !== null && val !== '') {
        if (Array.isArray(val)) {
          if (val.length > 0) {
            query.set(key, val.join(','));
          }
        } else {
          query.set(key, val);
        }
      }
    });
    const newRelativePathQuery = window.location.pathname + '?' + query.toString();
    window.history.pushState(null, '', newRelativePathQuery);
  };

  const loadFiltersFromURL = () => {
    const params = new URLSearchParams(window.location.search);
    const filters = { page: 1, pageSize: 10 };

    if (params.get('q')) filters.q = params.get('q');
    if (params.get('company')) filters.company = params.get('company');
    if (params.get('title')) filters.title = params.get('title');
    if (params.get('hasEmail')) filters.hasEmail = params.get('hasEmail') === 'true';
    if (params.get('relationshipStatus')) filters.relationshipStatus = params.get('relationshipStatus');
    if (params.get('followUpDue')) filters.followUpDue = params.get('followUpDue') === 'true';

    if (params.get('companies')) filters.companies = params.get('companies').split(',');
    if (params.get('seniority')) filters.seniority = params.get('seniority').split(',');
    if (params.get('roleCategory')) filters.roleCategory = params.get('roleCategory').split(',');
    if (params.get('priority')) filters.priority = params.get('priority').split(',');

    if (params.get('sortBy')) filters.sortBy = params.get('sortBy');
    if (params.get('sortOrder')) filters.sortOrder = params.get('sortOrder');

    return filters;
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmail_connected') === 'true') {
      alert(`Gmail successfully connected: ${params.get('email') || ''}`);
      // Clean query params
      window.history.replaceState({}, document.title, window.location.pathname);
      loadGmailStatus();
    } else if (params.get('gmail_error')) {
      alert(`Failed to connect Gmail: ${params.get('gmail_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    if (window.location.search) {
      const parsedFilters = loadFiltersFromURL();
      setConnFilters(prev => ({ ...prev, ...parsedFilters }));
      setConnectionSubTab('all');
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'connections') {
      updateURLFromFilters(connFilters);
    }
  }, [connFilters, activeTab]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connections') {
      loadSavedViews();
    }
  }, [isAuthenticated, activeTab]);

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;
    try {
      const payload = {
        name: newViewName.trim(),
        description: newViewDesc.trim() || null,
        filters: {
          q: connFilters.q || undefined,
          company: connFilters.company || undefined,
          companies: connFilters.companies || undefined,
          title: connFilters.title || undefined,
          seniority: connFilters.seniority || undefined,
          roleCategory: connFilters.roleCategory || undefined,
          relationshipStatus: connFilters.relationshipStatus || undefined,
          priority: connFilters.priority || undefined,
          hasEmail: connFilters.hasEmail !== undefined ? connFilters.hasEmail : undefined,
          followUpDue: connFilters.followUpDue || undefined,
        },
        sort: {
          sortBy: connFilters.sortBy || 'connectedDate',
          sortOrder: connFilters.sortOrder || 'desc',
        }
      };

      let res;
      if (activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups') {
        res = await api.request(`/connections/views/${activeViewId}`, {
          method: 'PUT',
          body: payload
        });
        alert('View updated successfully!');
      } else {
        res = await api.request('/connections/views', {
          method: 'POST',
          body: payload
        });
        alert('New view saved successfully!');
      }
      setShowSaveViewModal(false);
      setNewViewName('');
      setNewViewDesc('');
      loadSavedViews();
      if (res && res.data) {
        setActiveViewId(res.data.id);
        setActiveViewName(res.data.name);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  // eslint-disable-next-line no-unused-vars
  const handleSaveAsNewView = async () => {
    const name = prompt('Enter a name for the new saved view:');
    if (!name || !name.trim()) return;
    try {
      const payload = {
        name: name.trim(),
        filters: {
          q: connFilters.q || undefined,
          company: connFilters.company || undefined,
          companies: connFilters.companies || undefined,
          title: connFilters.title || undefined,
          seniority: connFilters.seniority || undefined,
          roleCategory: connFilters.roleCategory || undefined,
          relationshipStatus: connFilters.relationshipStatus || undefined,
          priority: connFilters.priority || undefined,
          hasEmail: connFilters.hasEmail !== undefined ? connFilters.hasEmail : undefined,
          followUpDue: connFilters.followUpDue || undefined,
        },
        sort: {
          sortBy: connFilters.sortBy || 'connectedDate',
          sortOrder: connFilters.sortOrder || 'desc',
        }
      };

      const res = await api.request('/connections/views', {
        method: 'POST',
        body: payload
      });
      alert('View saved successfully!');
      loadSavedViews();
      if (res && res.data) {
        setActiveViewId(res.data.id);
        setActiveViewName(res.data.name);
      }
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDuplicateView = async (id) => {
    try {
      await api.request(`/connections/views/${id}/duplicate`, { method: 'POST' });
      alert('View duplicated successfully!');
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleDeleteView = async (id) => {
    if (!confirm('Are you sure you want to delete this saved view? Connections will not be deleted.')) return;
    try {
      await api.request(`/connections/views/${id}`, { method: 'DELETE' });
      alert('View deleted successfully!');
      if (activeViewId === id) {
        handleApplyBuiltinView('all');
      }
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleRenameView = async (id, currentName) => {
    const name = prompt('Enter new name:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;
    try {
      await api.request(`/connections/views/${id}`, {
        method: 'PUT',
        body: { name: name.trim() }
      });
      alert('View renamed successfully!');
      if (activeViewId === id) {
        setActiveViewName(name.trim());
      }
      loadSavedViews();
    } catch (e) {
      alert(e.message);
    }
  };

  const handleLoadSavedView = (view) => {
    setActiveViewId(view.id);
    setActiveViewName(view.name);

    const filters = {
      page: 1,
      pageSize: 10,
      q: view.filtersJson.q || '',
      company: view.filtersJson.company || '',
      companies: view.filtersJson.companies || [],
      title: view.filtersJson.title || '',
      seniority: view.filtersJson.seniority || [],
      roleCategory: view.filtersJson.roleCategory || [],
      relationshipStatus: view.filtersJson.relationshipStatus || '',
      priority: view.filtersJson.priority || [],
      hasEmail: view.filtersJson.hasEmail,
      followUpDue: view.filtersJson.followUpDue,
      sortBy: view.sortJson.sortBy || 'connectedDate',
      sortOrder: view.sortJson.sortOrder || 'desc',
    };

    setConnFilters(filters);
    setConnectionSubTab('all');
    api.request(`/connections/views/${view.id}`).catch(() => { });
  };

  const handleApplyBuiltinView = (type) => {
    setActiveViewId(type);
    let filters = { page: 1, pageSize: 10, q: '', company: '', title: '' };
    if (type === 'all') {
      setActiveViewName('All Connections');
    } else if (type === 'high_priority') {
      setActiveViewName('High Priority');
      filters.priority = ['high'];
    } else if (type === 'never_contacted') {
      setActiveViewName('Never Contacted');
      filters.relationshipStatus = 'not_contacted';
    } else if (type === 'follow_ups') {
      setActiveViewName('Follow-ups Due');
      filters.followUpDue = true;
    }
    setConnFilters(filters);
    setConnectionSubTab('all');
  };

  const loadConnectionDetail = async (id) => {
    setShowOriginalPdf(false);
    setLoadingDetail(true);
    setDetailError(null);
    try {
      const res = await api.request(`/connections/${id}`);
      setConnectionDetail(res.data);
    } catch (e) {
      setDetailError(e.message || 'Failed to load connection details.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!newNoteContent.trim() || !activeConnectionId) return;
    try {
      await api.request('/notes', {
        method: 'POST',
        body: {
          entityType: 'connection',
          entityId: activeConnectionId,
          content: newNoteContent.trim()
        }
      });
      setNewNoteContent('');
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddTag = async (tagText) => {
    if (!tagText.trim() || !activeConnectionId || !connectionDetail) return;
    const currentTags = connectionDetail.tags || [];
    if (currentTags.includes(tagText.trim())) {
      alert('Tag already exists on this connection.');
      return;
    }
    const updatedTags = [...currentTags, tagText.trim()];
    try {
      await api.request(`/connections/${activeConnectionId}`, {
        method: 'PUT',
        body: {
          name: connectionDetail.name,
          tags: updatedTags
        }
      });
      setNewTagText('');
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveTag = async (tagToRemove) => {
    if (!activeConnectionId || !connectionDetail) return;
    const currentTags = connectionDetail.tags || [];
    const updatedTags = currentTags.filter(t => t !== tagToRemove);
    try {
      await api.request(`/connections/${activeConnectionId}`, {
        method: 'PUT',
        body: {
          name: connectionDetail.name,
          tags: updatedTags
        }
      });
      loadConnectionDetail(activeConnectionId);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadSession = async () => {
    try {
      const res = await api.getMe();
      setUser(res.data.user);
      setIsAuthenticated(true);
    } catch {
      api.clearTokens();
    }
  };

  const loadDashboard = async () => {
    try {
      const res = await api.getDashboardStats();
      setStats(res);
    } catch (e) {
      console.error(e);
    }
  };

  const loadProfile = async () => {
    try {
      const data = await api.getProfile();
      if (data) setProfile(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadResumes = async () => {
    try {
      const data = await api.listResumes();
      setResumes(data);
      if (data.length > 0 && !selectedResumeId) {
        const active = data.find(r => r.isActive);
        setSelectedResumeId(active ? active.id : data[0].id);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadResumeFitAnalysis = async (jobId) => {
    setLoadingResumeAnalysis(true);
    try {
      const res = await api.request(`/jobs/${jobId}/resume-analysis`);
      setResumeAnalysis(res.data);
    } catch (e) {
      console.error(e);
      setResumeAnalysis({
        matchedSkills: [],
        missingSkills: [],
        strengths: [],
        potentialGaps: [],
        analysisSummary: e.message || 'Failed to load analysis.',
        compatibilityAssessment: 'unknown'
      });
    } finally {
      setLoadingResumeAnalysis(false);
    }
  };

  const loadConnections = async () => {
    try {
      const res = await api.listConnections(connFilters);
      setConnections(res.data);
      setConnMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadJobs = async () => {
    try {
      const res = await api.listJobs(jobFilters);
      setJobs(res.data);
      setJobMeta(res.meta || { total: res.data.length, totalPages: 1 });
    } catch (e) {
      console.error(e);
    }
  };

  const loadSearchProfiles = async () => {
    try {
      const data = await api.listJobSearchProfiles();
      setSearchProfiles(data);
    } catch (e) {
      console.error(e);
    }
  };

  const runSemanticConnSearch = async () => {
    if (!connFilters.q) return;
    setSearchingSemantic(true);
    try {
      const res = await api.request('/search/semantic', {
        method: 'POST',
        body: {
          query: connFilters.q,
          entityTypes: ['connection'],
          limit: 20,
          filters: {
            company: connFilters.company || undefined,
            title: connFilters.title || undefined
          }
        }
      });
      setSemanticConnResults(res.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearchingSemantic(false);
    }
  };

  const runSemanticJobSearch = async () => {
    if (!jobFilters.q) return;
    setSearchingJobSemantic(true);
    try {
      const res = await api.request('/search/jobs', {
        method: 'POST',
        body: {
          query: jobFilters.q,
          limit: 20
        }
      });
      setSemanticJobResults(res.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setSearchingJobSemantic(false);
    }
  };

  const runBackfill = async () => {
    setSyncingEmbeddings(true);
    try {
      const res = await api.request('/search/backfill', { method: 'POST' });
      const stats = res.data;
      alert(`AI Embeddings synced successfully!\n• Connections backfilled: ${stats.connections.processed}\n• Jobs backfilled: ${stats.jobs.processed}\n• Resumes backfilled: ${stats.resumes.processed}`);
    } catch (err) {
      alert(`Failed to sync embeddings: ${err.message}`);
    } finally {
      setSyncingEmbeddings(false);
    }
  };

  const loadGmailStatus = async () => {
    try {
      const res = await api.request('/integrations/gmail/status');
      setGmailStatus(res.data);
    } catch (err) {
      console.error('Failed to load Gmail status:', err);
    }
  };

  const loadTelegramStatus = async () => {
    try {
      const res = await api.request('/integrations/telegram/status');
      setTelegramStatus(res.data);
    } catch (err) {
      console.error('Failed to load Telegram status:', err);
    }
  };

  const generateTelegramCode = async () => {
    try {
      const res = await api.request('/integrations/telegram/link');
      setTelegramLinkingCode(res.data.code);
    } catch (err) {
      alert(err.message);
    }
  };

  const loadIngestionMonitor = async () => {
    try {
      const res = await api.request('/dashboard/ingestion-monitor');
      setIngestionMonitor(res.data);
    } catch (err) {
      console.error('Failed to load ingestion monitor stats:', err);
    }
  };

  const loadDeduplicationLogs = async () => {
    try {
      const res = await api.request('/dashboard/deduplication-logs');
      setDeduplicationLogs(res.data);
    } catch (err) {
      console.error('Failed to load deduplication logs:', err);
    }
  };

  const loadPreferences = async () => {
    try {
      const res = await api.request('/preferences');
      if (res.data) {
        setPreferences(res.data);
      }
    } catch (err) {
      console.error('Failed to load user preferences:', err);
    }
  };

  const savePreferences = async (updated) => {
    try {
      const res = await api.request('/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updated)
      });
      if (res.data) {
        setPreferences(res.data);
        alert('Automation preferences saved successfully!');
      }
    } catch (err) {
      alert('Failed to save automation preferences: ' + err.message);
    }
  };

  const loadIncomingJobs = async () => {
    setLoadingIncoming(true);
    try {
      const res = await api.request('/incoming-jobs');
      setIncomingJobs(res.data);
    } catch (err) {
      console.error('Failed to load incoming jobs:', err);
    } finally {
      setLoadingIncoming(false);
    }
  };

  const handleConnectGmail = () => {
    const token = localStorage.getItem('cg_access_token');
    if (!user || !user.id) {
      alert('Your user session has not loaded yet. Please wait a moment and try again.');
      return;
    }
    // Redirect to backend connect endpoint
    window.location.href = `http://localhost:5000/api/integrations/gmail/connect?userId=${user.id}`;
  };

  const loadApplications = async () => {
    try {
      const data = await api.listApplications();
      setApplications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadOutreach = async () => {
    try {
      const data = await api.listOutreach();
      setOutreachList(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadNotifications = async () => {
    try {
      const data = await api.listNotifications();
      setNotifications(data);
    } catch (e) {
      console.error(e);
    }
  };

  const loadJobNetwork = async (jobId, filters = jobNetworkFilters) => {
    setJobNetworkLoading(true);
    try {
      const query = new URLSearchParams();
      Object.keys(filters).forEach(key => {
        if (filters[key] !== undefined && filters[key] !== null && filters[key] !== '') {
          query.set(key, filters[key]);
        }
      });
      const res = await api.request(`/jobs/${jobId}/network?${query.toString()}`);
      setJobNetworkDetails(res.data);
      if (res.data && res.data.pagination) {
        setJobNetworkMeta(res.data.pagination);
      }
    } catch (e) {
      console.error('Failed to load job network workspace', e);
    } finally {
      setJobNetworkLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && modal === 'job_detail' && editItem?.id) {
      loadJobNetwork(editItem.id, jobNetworkFilters);
    }
  }, [isAuthenticated, modal, editItem?.id, jobNetworkFilters]);

  // Auth handlers
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    setAuthSuccess('');
    try {
      if (authTab === 'login') {
        await api.login(authEmail, authPassword);
        setIsAuthenticated(true);
        loadSession();
      } else if (authTab === 'register') {
        await api.register(authEmail, authPassword, authName);
        setIsAuthenticated(true);
        loadSession();
      } else if (authTab === 'forgot') {
        await api.requestPasswordReset(authEmail);
        setAuthSuccess('Password reset link requested. Check terminal logs (simulated email)');
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = async () => {
    await api.logout();
    setIsAuthenticated(false);
    setUser(null);
  };

  // Profile Save
  const handleProfileSave = async (e) => {
    e.preventDefault();
    try {
      const formatted = {
        ...profile,
        targetRoles: Array.isArray(profile.targetRoles) ? profile.targetRoles : String(profile.targetRoles).split(',').map(s => s.trim()).filter(Boolean),
        targetCompanies: Array.isArray(profile.targetCompanies) ? profile.targetCompanies : String(profile.targetCompanies).split(',').map(s => s.trim()).filter(Boolean),
        preferredLocations: Array.isArray(profile.preferredLocations) ? profile.preferredLocations : String(profile.preferredLocations).split(',').map(s => s.trim()).filter(Boolean),
        skills: Array.isArray(profile.skills) ? profile.skills : String(profile.skills).split(',').map(s => s.trim()).filter(Boolean)
      };
      await api.updateProfile(formatted);
      alert('Profile updated successfully');
      loadProfile();
    } catch (err) {
      alert(err.message);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-header">
            <h1>CareerGraph</h1>
            <p>Your premium personal career tracker & connection CRM</p>
          </div>

          <form onSubmit={handleAuthSubmit}>
            {authError && <div style={{ color: 'var(--danger)', marginBottom: '16px' }}>{authError}</div>}
            {authSuccess && <div style={{ color: 'var(--success)', marginBottom: '16px' }}>{authSuccess}</div>}

            {authTab === 'register' && (
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  required
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input
                type="email"
                className="form-input"
                required
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
              />
            </div>

            {authTab !== 'forgot' && (
              <div className="form-group">
                <label className="form-label">Password</label>
                <input
                  type="password"
                  className="form-input"
                  required
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </div>
            )}

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '12px' }}>
              {authTab === 'login' && 'Sign In'}
              {authTab === 'register' && 'Sign Up'}
              {authTab === 'forgot' && 'Send Reset Request'}
            </button>
          </form>

          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
            {authTab === 'login' ? (
              <>
                <button className="btn-link" onClick={() => setAuthTab('register')}>Need an account? Register</button>
                <button className="btn-link" onClick={() => setAuthTab('forgot')}>Forgot Password?</button>
              </>
            ) : (
              <button className="btn-link" style={{ margin: '0 auto' }} onClick={() => setAuthTab('login')}>Back to Sign In</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="sidebar-logo">CareerGraph</div>
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
            Dashboard
          </button>
          <button className={`nav-item ${activeTab === 'profile' ? 'active' : ''}`} onClick={() => setActiveTab('profile')}>
            My Profile
          </button>
          <button className={`nav-item ${activeTab === 'resumes' ? 'active' : ''}`} onClick={() => setActiveTab('resumes')}>
            Resume Files
          </button>
          <button className={`nav-item ${activeTab === 'connections' ? 'active' : ''}`} onClick={() => setActiveTab('connections')}>
            Connections CRM
          </button>
          <button className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`} onClick={() => setActiveTab('jobs')}>
            Jobs Tracker
          </button>
          <button className={`nav-item ${activeTab === 'applications' ? 'active' : ''}`} onClick={() => setActiveTab('applications')}>
            Applications
          </button>
          <button className={`nav-item ${activeTab === 'outreach' ? 'active' : ''}`} onClick={() => setActiveTab('outreach')}>
            Outreach CRM
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="user-badge">
            <span className="user-name">{user?.profile?.name || 'User'}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">

        {/* DASHBOARD TAB */}
        {activeTab === 'dashboard' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Dashboard Overview</h1>
              <button className="btn btn-secondary" onClick={async () => {
                try {
                  await api.request('/dashboard/digest', { method: 'POST' });
                  alert('Daily email digest triggered! Look at the server terminal console output to inspect the generated digest body.');
                } catch (err) {
                  alert(err.message);
                }
              }}>
                Trigger Daily Digest
              </button>
            </div>

            <div className="metrics-grid">
              <div className="metric-card">
                <div className="metric-label">Total Jobs</div>
                <div className="metric-value">{stats.totalJobs}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Active Applications</div>
                <div className="metric-value">{stats.applications}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Interviews Scheduled</div>
                <div className="metric-value">{stats.interviews}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Offers Received</div>
                <div className="metric-value">{stats.offers}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Total Connections</div>
                <div className="metric-value">{stats.totalConnections}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Follow-ups Due</div>
                <div className="metric-value" style={{ color: stats.followUpsDue > 0 ? 'var(--warning)' : '#fff' }}>
                  {stats.followUpsDue}
                </div>
              </div>
            </div>

            <div className="dashboard-layout">
              <div className="card-panel" style={{ gridColumn: 'span 2', marginBottom: '24px' }}>
                <h2 className="card-title">Top Referral & Match Opportunities</h2>
                {jobs.length === 0 ? (
                  <div className="empty-state">No jobs tracked yet. Add job posts to see recommendations.</div>
                ) : (
                  <div className="data-table-container">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Job Title</th>
                          <th>Company</th>
                          <th>Match Score</th>
                          <th>Opportunity Score</th>
                          <th>Action Recommendation</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...jobs]
                          .sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0))
                          .slice(0, 3)
                          .map((job) => (
                            <tr key={job.id}>
                              <td style={{ fontWeight: 600 }}>{job.title}</td>
                              <td>{job.companyName}</td>
                              <td>
                                <span className="badge badge-success">{job.matchScore || 0}%</span>
                              </td>
                              <td>
                                <span className="badge badge-info">{job.opportunityScore || 0}%</span>
                              </td>
                              <td style={{ fontSize: '0.9rem' }}>{job.recommendedAction}</td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="card-panel">
                <h2 className="card-title">Recent Activity Logs</h2>
                <div className="activity-list">
                  {stats.recentActivity.length === 0 ? (
                    <div className="empty-state">No recent activities logged yet.</div>
                  ) : (
                    stats.recentActivity.map((activity, idx) => (
                      <div className="activity-item" key={idx}>
                        <div className="item-header">
                          <span>{activity.type.replace('_', ' ').toUpperCase()}</span>
                          <span>{new Date(activity.occurredAt || activity.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="item-title">
                          Status: {activity.status || activity.title}
                        </div>
                        <div className="item-desc">{activity.notes || activity.message}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="card-panel">
                <h2 className="card-title">Reminders & Notifications</h2>
                <div className="notification-list">
                  {notifications.filter(n => !n.isRead).length === 0 ? (
                    <div className="empty-state">No unread notifications.</div>
                  ) : (
                    notifications.filter(n => !n.isRead).map((notif) => (
                      <div className="notification-item" key={notif.id}>
                        <div className="item-header">
                          <span className="badge badge-info">{notif.type}</span>
                          <button className="btn-link" onClick={async () => {
                            await api.markNotificationRead(notif.id);
                            loadNotifications();
                            loadDashboard();
                          }}>Dismiss</button>
                        </div>
                        <div className="item-title">{notif.title}</div>
                        <p className="item-desc">{notif.message}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div className="card-panel">
            <h1 className="page-title" style={{ marginBottom: '24px' }}>My Career Profile</h1>
            <form onSubmit={handleProfileSave}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.phone || ''}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Location</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.location || ''}
                    onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Remote Preference</label>
                  <select
                    className="form-input"
                    value={profile.remotePreference || ''}
                    onChange={(e) => setProfile({ ...profile, remotePreference: e.target.value })}
                  >
                    <option value="">Choose preference...</option>
                    <option value="remote">Remote Only</option>
                    <option value="hybrid">Hybrid</option>
                    <option value="onsite">On-Site</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Target Roles (Comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={profile.targetRoles}
                  onChange={(e) => setProfile({ ...profile, targetRoles: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Companies (Comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={profile.targetCompanies}
                  onChange={(e) => setProfile({ ...profile, targetCompanies: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Skills (Comma-separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={profile.skills}
                  onChange={(e) => setProfile({ ...profile, skills: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Years of Experience</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profile.experience || ''}
                    onChange={(e) => setProfile({ ...profile, experience: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Salary Expectation</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. $120k/yr"
                    value={profile.salaryPreference || ''}
                    onChange={(e) => setProfile({ ...profile, salaryPreference: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Short Bio / Pitch</label>
                <textarea
                  className="form-input"
                  rows="4"
                  value={profile.bio || ''}
                  onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary">Save Profile Changes</button>
            </form>
          </div>
        )}

        {/* RESUME FILES TAB */}
        {activeTab === 'resumes' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Resume Manager</h1>
              <button className="btn btn-primary" onClick={() => setModal('resume')}>
                Upload New Resume
              </button>
            </div>

            <div style={{ marginTop: '20px' }}>
              {/* Resumes list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resumes.length === 0 ? (
                  <div className="card-panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No resumes uploaded yet. Click upload to get started.
                  </div>
                ) : (
                  resumes.map((res) => {
                    const isSelected = selectedResumeId === res.id;
                    return (
                      <div
                        key={res.id}
                        className={`card-panel ${isSelected ? 'active-card' : ''}`}
                        onClick={() => { setSelectedResumeId(res.id); setEditingAiEnrichment(false); }}
                        style={{
                          padding: '16px',
                          cursor: 'pointer',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.08)',
                          background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'var(--bg-secondary)',
                          borderRadius: '8px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#fff' }}>{res.fileName}</span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>v{res.version}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem' }}>
                          <span>{new Date(res.createdAt).toLocaleDateString()}</span>
                          {res.isActive ? (
                            <span className="badge badge-success">Active</span>
                          ) : (
                            <button
                              className="btn-link"
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--primary)' }}
                              onClick={async (e) => {
                                e.stopPropagation();
                                await api.setActiveResume(res.id);
                                loadResumes();
                              }}
                            >
                              Set Active
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                          <a
                            href={api.getResumeDownloadUrl(res.id)}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            Download
                          </a>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirm('Delete this resume?')) {
                                await api.deleteResume(res.id);
                                if (selectedResumeId === res.id) setSelectedResumeId(null);
                                loadResumes();
                              }
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

            </div>
          </div>
        )}

        {/* CONNECTIONS CRM TAB */}
        {activeTab === 'connections' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Connections CRM</h1>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setModal('csv')}>
                  Import CSV
                </button>
                <button className="btn btn-secondary" onClick={() => {
                  setEnrichmentPreview(null);
                  setEnrichmentError(null);
                  setModal('linkedin_pdf');
                }}>
                  Import LinkedIn PDF
                </button>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setModal('connection'); }}>
                  Add Connection
                </button>
              </div>
            </div>

            {/* Sub Tabs Selection */}
            <div style={{ display: 'flex', gap: '16px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <button
                className={`btn ${connectionSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={() => { setConnectionSubTab('overview'); setActiveCompanyKey(null); }}
              >
                Network Overview
              </button>
              <button
                className={`btn ${connectionSubTab === 'all' && !connFilters.followUpDue ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={() => { setConnFilters({ ...connFilters, followUpDue: undefined, page: 1 }); setConnectionSubTab('all'); setActiveCompanyKey(null); }}
              >
                All Connections
              </button>
              <button
                className={`btn ${connectionSubTab === 'companies' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={() => { setConnectionSubTab('companies'); setActiveCompanyKey(null); }}
              >
                Companies
              </button>
              <button
                className={`btn ${connectionSubTab === 'saved_views' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={() => { setConnectionSubTab('saved_views'); setActiveCompanyKey(null); }}
              >
                Saved Views
              </button>
              <button
                className={`btn ${connectionSubTab === 'all' && connFilters.followUpDue ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '8px 16px', fontSize: '0.9rem' }}
                onClick={() => { setConnFilters({ ...connFilters, followUpDue: true, page: 1 }); setConnectionSubTab('all'); setActiveCompanyKey(null); }}
              >
                Follow-ups Due
              </button>
            </div>

            {/* OVERVIEW SUB-TAB */}
            {connectionSubTab === 'overview' && (
              <div>
                {loadingOverview && <div className="empty-state">Loading network insights...</div>}
                {overviewError && <div className="empty-state" style={{ color: 'var(--danger)' }}>{overviewError}</div>}

                {!loadingOverview && !overviewError && dashboardOverview && (
                  <div>
                    {/* KPI Cards Grid */}
                    <div className="metrics-grid" style={{ marginBottom: '24px' }}>
                      <div className="metric-card">
                        <div className="metric-label">Total Connections</div>
                        <div className="metric-value">{dashboardOverview.summary.totalConnections}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Companies</div>
                        <div className="metric-value">{dashboardOverview.summary.companies}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">High Priority</div>
                        <div className="metric-value" style={{ color: 'var(--warning)' }}>
                          {dashboardOverview.summary.highPriority}
                        </div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Never Contacted</div>
                        <div className="metric-value">{dashboardOverview.summary.neverContacted}</div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">Follow-ups Due</div>
                        <div className="metric-value" style={{ color: dashboardOverview.summary.followUpsDue > 0 ? 'var(--danger)' : '#fff' }}>
                          {dashboardOverview.summary.followUpsDue}
                        </div>
                      </div>
                      <div className="metric-card">
                        <div className="metric-label">With Email</div>
                        <div className="metric-value">{dashboardOverview.summary.withEmail}</div>
                      </div>
                    </div>

                    {/* Second Row: Growth & Followups */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', marginBottom: '24px' }}>
                      {/* Growth timeline list */}
                      <div className="card-panel">
                        <h2 className="card-title">Network Growth History</h2>
                        {dashboardOverview.growth && dashboardOverview.growth.length > 0 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '16px' }}>
                            {dashboardOverview.growth.slice(-6).map((item) => (
                              <div key={item.month} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ width: '80px', fontWeight: 600 }}>{item.month}</span>
                                <div style={{ flex: 1, background: 'var(--bg-secondary)', height: '16px', borderRadius: '4px', overflow: 'hidden' }}>
                                  <div style={{ background: 'var(--primary)', height: '100%', width: `${Math.min(100, (item.total / dashboardOverview.summary.totalConnections) * 100)}%` }} />
                                </div>
                                <span style={{ width: '100px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                  {item.total} total (+{item.added})
                                </span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="empty-state">No connection dates recorded.</div>
                        )}
                      </div>

                      {/* Follow-up center card */}
                      <div className="card-panel">
                        <h2 className="card-title">Follow-up Summary</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--danger)', borderRadius: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--danger)' }}>🔴 Overdue</span>
                            <strong style={{ fontSize: '1.2rem' }}>{dashboardOverview.followUps.overdue}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderLeft: '4px solid var(--warning)', borderRadius: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--warning)' }}>🟠 Today</span>
                            <strong style={{ fontSize: '1.2rem' }}>{dashboardOverview.followUps.today}</strong>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderLeft: '4px solid var(--info)', borderRadius: '6px' }}>
                            <span style={{ fontWeight: 600, color: 'var(--info)' }}>🟡 This Week</span>
                            <strong style={{ fontSize: '1.2rem' }}>{dashboardOverview.followUps.thisWeek}</strong>
                          </div>
                          <button
                            className="btn btn-secondary"
                            style={{ width: '100%', padding: '10px' }}
                            onClick={() => {
                              setConnFilters({ ...connFilters, followUpDue: true, page: 1 });
                              setConnectionSubTab('all');
                            }}
                          >
                            View All Due Follow-ups
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Third Row: Top Companies & Role Distribution */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

                      {/* Top Companies */}
                      <div className="card-panel">
                        <h2 className="card-title">Top Companies</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {dashboardOverview.topCompanies && dashboardOverview.topCompanies.length > 0 ? (
                            dashboardOverview.topCompanies.map((c) => (
                              <div
                                key={c.normalizedName}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                                className="activity-item"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, company: c.name, page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{c.name}</span>
                                <span className="badge badge-info">{c.count} connections</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No company aggregates available.</div>
                          )}
                        </div>
                      </div>

                      {/* Role Distribution */}
                      <div className="card-panel">
                        <h2 className="card-title">Role Distribution</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {dashboardOverview.roles && dashboardOverview.roles.length > 0 ? (
                            dashboardOverview.roles.map((r) => (
                              <div
                                key={r.category}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                                className="activity-item"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, roleCategory: [r.category], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{r.category.replace('_', ' ')}</span>
                                <span className="badge badge-success">{r.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No role category aggregates available.</div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Fourth Row: Seniority & Relationship Health */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>

                      {/* Seniority Distribution */}
                      <div className="card-panel">
                        <h2 className="card-title">Seniority Distribution</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {dashboardOverview.seniority && dashboardOverview.seniority.length > 0 ? (
                            dashboardOverview.seniority.map((s) => (
                              <div
                                key={s.level}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                                className="activity-item"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, seniority: [s.level], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{s.level}</span>
                                <span className="badge badge-info">{s.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No seniority level aggregates available.</div>
                          )}
                        </div>
                      </div>

                      {/* Relationship Health */}
                      <div className="card-panel">
                        <h2 className="card-title">Relationship Health</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {dashboardOverview.relationships && dashboardOverview.relationships.length > 0 ? (
                            dashboardOverview.relationships.map((rel) => (
                              <div
                                key={rel.status}
                                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '8px', borderRadius: '4px' }}
                                className="activity-item"
                                onClick={() => {
                                  setConnFilters({ ...connFilters, relationshipStatus: rel.status, page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>{rel.status.replace('_', ' ')}</span>
                                <span className="badge badge-warning">{rel.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No relationship status aggregates available.</div>
                          )}
                        </div>
                      </div>

                    </div>

                    {/* Fifth Row: High Priority Connections */}
                    <div className="card-panel" style={{ marginBottom: '24px' }}>
                      <h2 className="card-title">High Priority Connections</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                        {dashboardOverview.highPriorityConnections && dashboardOverview.highPriorityConnections.length > 0 ? (
                          dashboardOverview.highPriorityConnections.map((h) => (
                            <div
                              key={h.id}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', padding: '12px', borderRadius: '6px' }}
                              className="activity-item"
                              onClick={() => {
                                setActiveConnectionId(h.id);
                                setActiveTab('connection-detail');
                              }}
                            >
                              <div>
                                <span style={{ fontWeight: 600, fontSize: '1.05rem', color: '#fff' }}>{h.name}</span>
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{h.title || 'No Title'} &bull; {h.company || 'Unknown Company'}</div>
                              </div>
                              <span className="badge badge-success">Score: {h.connectionScore}</span>
                            </div>
                          ))
                        ) : (
                          <div className="empty-state">No high priority connections set. Go to All Connections to mark priority.</div>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </div>
            )}
            {connectionSubTab === 'companies' && activeCompanyKey && (
              <div>
                <button
                  className="btn btn-secondary"
                  style={{ marginBottom: '16px' }}
                  onClick={() => { setActiveCompanyKey(null); setCompanyDetailData(null); }}
                >
                  &larr; Back to Company Directory
                </button>

                {loadingCompanyDetail && <div className="empty-state">Loading company stats...</div>}

                {!loadingCompanyDetail && companyDetailData && (
                  <div>
                    <div className="page-header" style={{ marginBottom: '24px' }}>
                      <div>
                        <h1 className="page-title">{companyDetailData.companyName}</h1>
                        <p style={{ color: 'var(--text-secondary)' }}>{companyDetailData.totalConnections} Contacts in your network</p>
                      </div>
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="metrics-grid" style={{ marginBottom: '24px' }}>
                      <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <div className="metric-label">Total Connections</div>
                        <div className="metric-value">{companyDetailData.totalConnections}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>View all &rarr;</div>
                      </div>
                      <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: ['recruiting'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <div className="metric-label">Recruiters</div>
                        <div className="metric-value">{companyDetailData.recruiters}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>View list &rarr;</div>
                      </div>
                      <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: ['engineering'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <div className="metric-label">Engineering Leaders</div>
                        <div className="metric-value">{companyDetailData.engineeringLeaders}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>View list &rarr;</div>
                      </div>
                      <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], priority: ['high'], page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <div className="metric-label">High Priority</div>
                        <div className="metric-value" style={{ color: 'var(--warning)' }}>{companyDetailData.highPriority}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>View list &rarr;</div>
                      </div>
                      <div className="metric-card" style={{ cursor: 'pointer' }} onClick={() => {
                        setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], relationshipStatus: 'not_contacted', page: 1 });
                        setConnectionSubTab('all');
                      }}>
                        <div className="metric-label">Not Contacted</div>
                        <div className="metric-value">{companyDetailData.notContacted}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--primary)', marginTop: '8px' }}>View list &rarr;</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '24px' }}>
                      {/* Role distribution */}
                      <div className="card-panel">
                        <h2 className="card-title">Role Distribution</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {companyDetailData.rolesDistribution && companyDetailData.rolesDistribution.length > 0 ? (
                            companyDetailData.rolesDistribution.map(r => (
                              <div
                                key={r.category}
                                className="activity-item"
                                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                                onClick={() => {
                                  setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], roleCategory: [r.category], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{r.category.replace('_', ' ')}</span>
                                <span className="badge badge-info">{r.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No roles logged.</div>
                          )}
                        </div>
                      </div>

                      {/* Seniority distribution */}
                      <div className="card-panel">
                        <h2 className="card-title">Seniority Level</h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px' }}>
                          {companyDetailData.seniorityDistribution && companyDetailData.seniorityDistribution.length > 0 ? (
                            companyDetailData.seniorityDistribution.map(s => (
                              <div
                                key={s.level}
                                className="activity-item"
                                style={{ display: 'flex', justifyContent: 'space-between', padding: '8px', cursor: 'pointer' }}
                                onClick={() => {
                                  setConnFilters({ ...connFilters, companies: [companyDetailData.companyName], seniority: [s.level], page: 1 });
                                  setConnectionSubTab('all');
                                }}
                              >
                                <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>{s.level}</span>
                                <span className="badge badge-success">{s.count}</span>
                              </div>
                            ))
                          ) : (
                            <div className="empty-state">No seniority logged.</div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Derived Expertise aggregated dashboard */}
                    <div className="card-panel" style={{ marginTop: '24px' }}>
                      <h2 className="card-title">🤖 AI-Derived Technical Expertise / Domains</h2>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>Aggregate count of contacts matching these technical expertise tags (derived by Ollama profile analysis).</p>

                      {companyDetailData.aiExpertise && companyDetailData.aiExpertise.length > 0 ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                          {companyDetailData.aiExpertise.map(exp => (
                            <div key={exp.name} className="activity-item" style={{ display: 'flex', justifyContent: 'space-between', padding: '12px', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{exp.name}</span>
                              <span className="badge badge-primary">{exp.count}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="empty-state">No AI-derived expertise analysis available yet. Enrich your connections at this company to see aggregate insights.</div>
                      )}
                    </div>

                  </div>
                )}
              </div>
            )}

            {connectionSubTab === 'companies' && !activeCompanyKey && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', marginBottom: '24px', alignItems: 'center' }}>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search companies..."
                    value={companySearch}
                    onChange={(e) => { setCompanySearch(e.target.value); setCompaniesPage(1); }}
                    style={{ maxWidth: '300px' }}
                  />
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span>Sort by:</span>
                    <select
                      className="form-input"
                      value={companySortBy}
                      onChange={(e) => { setCompanySortBy(e.target.value); setCompaniesPage(1); }}
                    >
                      <option value="connections">Connections Count</option>
                      <option value="companyName">Company Name</option>
                      <option value="seniorPlus">Senior+ Staff</option>
                      <option value="engineering">Engineering</option>
                      <option value="recruiter">Recruiting</option>
                      <option value="highPriority">High Priority</option>
                    </select>
                    <select
                      className="form-input"
                      value={companySortOrder}
                      onChange={(e) => { setCompanySortOrder(e.target.value); setCompaniesPage(1); }}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                </div>

                <div className="card-panel">
                  {companies.length === 0 ? (
                    <div className="empty-state">No companies found in network.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Company</th>
                            <th>Connections</th>
                            <th>Senior+</th>
                            <th>Engineering</th>
                            <th>Recruiters</th>
                            <th>Contacted</th>
                            <th>Not Contacted</th>
                            <th>High Priority</th>
                          </tr>
                        </thead>
                        <tbody>
                          {companies.map(c => (
                            <tr key={c.companyKey}>
                              <td>
                                <button
                                  className="btn-link"
                                  style={{ fontWeight: 700, fontSize: '1rem', textAlign: 'left' }}
                                  onClick={() => setActiveCompanyKey(c.companyKey)}
                                >
                                  {c.companyName}
                                </button>
                              </td>
                              <td style={{ fontWeight: 600 }}>{c.connectionCount}</td>
                              <td>{c.seniorPlusCount}</td>
                              <td>{c.engineeringCount}</td>
                              <td>{c.recruiterCount}</td>
                              <td style={{ color: 'var(--success)' }}>{c.contactedCount}</td>
                              <td>{c.notContactedCount}</td>
                              <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{c.highPriorityCount}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {companiesMeta.totalPages > 1 && (
                  <div className="pagination" style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
                    <button
                      className="btn btn-secondary"
                      disabled={companiesPage === 1}
                      onClick={() => setCompaniesPage(companiesPage - 1)}
                    >
                      Prev
                    </button>
                    <span style={{ padding: '8px 16px', color: 'var(--text-secondary)' }}>
                      Page {companiesPage} of {companiesMeta.totalPages}
                    </span>
                    <button
                      className="btn btn-secondary"
                      disabled={companiesPage === companiesMeta.totalPages}
                      onClick={() => setCompaniesPage(companiesPage + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            )}

            {connectionSubTab === 'saved_views' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', alignItems: 'center' }}>
                  <h2 style={{ fontSize: '1.2rem', fontWeight: 600 }}>Your Saved Reusable Segments</h2>
                  <button className="btn btn-primary" onClick={() => {
                    setConnectionSubTab('all');
                    setConnFilters({
                      page: 1,
                      limit: 50,
                      search: '',
                      companies: '',
                      positions: '',
                      seniority: '',
                      roleCategory: '',
                      relationshipStatus: '',
                      relationshipStrength: '',
                      priority: '',
                      hasEmail: undefined,
                      followUpDue: undefined
                    });
                  }}>
                    Create Custom View
                  </button>
                </div>

                <div className="card-panel">
                  {savedViews.length === 0 ? (
                    <div className="empty-state">No saved connection views found. Set filters in All Connections and click &quot;Save view&quot;.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                      {savedViews.map(view => (
                        <div
                          key={view.id}
                          className="activity-item"
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderRadius: '8px', borderLeft: '4px solid var(--primary)' }}
                        >
                          <div>
                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>{view.name}</span>
                            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{view.description || 'No description provided'}</p>
                          </div>
                          <div style={{ display: 'flex', gap: '12px' }}>
                            <button
                              className="btn btn-secondary"
                              onClick={() => handleLoadSavedView(view)}
                            >
                              Open view
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={async () => {
                                if (confirm('Delete this saved view?')) {
                                  await api.request(`/connections/views/${view.id}`, { method: 'DELETE' });
                                  loadSavedViews();
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DIRECTORY LIST SUB-TAB */}
            {connectionSubTab === 'all' && (
              <div>
                {/* Saved Views Control Panel */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid var(--primary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600 }}>Active Segment:</span>
                    <div className="dropdown" style={{ position: 'relative', display: 'inline-block' }}>
                      <select
                        className="form-input"
                        style={{ minWidth: '220px', fontWeight: 600, background: 'var(--bg-primary)', color: 'var(--primary)' }}
                        value={activeViewId || 'all'}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === 'all' || val === 'high_priority' || val === 'never_contacted' || val === 'follow_ups') {
                            handleApplyBuiltinView(val);
                          } else {
                            const found = savedViews.find(v => v.id === val);
                            if (found) handleLoadSavedView(found);
                          }
                        }}
                      >
                        <optgroup label="System Views">
                          <option value="all">All Connections</option>
                          <option value="high_priority">High Priority Only</option>
                          <option value="never_contacted">Never Contacted</option>
                          <option value="follow_ups">Follow-ups Due</option>
                        </optgroup>
                        {savedViews.length > 0 && (
                          <optgroup label="Custom Saved Views">
                            {savedViews.map(view => (
                              <option key={view.id} value={view.id}>{view.name}</option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                    </div>

                    <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#fff' }}>
                      {activeViewName}
                      {activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' && (
                        <span>
                          {(() => {
                            const active = savedViews.find(v => v.id === activeViewId);
                            if (active) {
                              const cleanFilters = (f) => ({
                                q: f.q || '',
                                company: f.company || '',
                                title: f.title || '',
                                hasEmail: f.hasEmail,
                                relationshipStatus: f.relationshipStatus || '',
                                followUpDue: !!f.followUpDue,
                                companies: f.companies || [],
                                seniority: f.seniority || [],
                                roleCategory: f.roleCategory || [],
                                priority: f.priority || []
                              });
                              const diff = JSON.stringify(cleanFilters(connFilters)) !== JSON.stringify(cleanFilters(active.filtersJson)) ||
                                (connFilters.sortBy || 'connectedDate') !== (active.sortJson.sortBy || 'connectedDate') ||
                                (connFilters.sortOrder || 'desc') !== (active.sortJson.sortOrder || 'desc');
                              return diff ? ' * (unsaved changes)' : '';
                            }
                            return '';
                          })()}
                        </span>
                      )}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '8px' }}>
                    {activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' && (
                      <>
                        <button className="btn btn-primary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={handleSaveView}>Save Changes</button>
                        <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => handleRenameView(activeViewId, activeViewName)}>Rename</button>
                        <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => handleDuplicateView(activeViewId)}>Duplicate</button>
                        <button className="btn btn-danger" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => handleDeleteView(activeViewId)}>Delete View</button>
                      </>
                    )}
                    <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.85rem' }} onClick={() => {
                      setNewViewName(activeViewId && activeViewId !== 'all' && activeViewId !== 'high_priority' && activeViewId !== 'never_contacted' && activeViewId !== 'follow_ups' ? `${activeViewName} Copy` : 'My Custom View');
                      setShowSaveViewModal(true);
                    }}>Save View As...</button>
                    <button 
                      className="btn btn-primary" 
                      style={{ padding: '8px 14px', fontSize: '0.85rem', background: 'var(--accent)', borderColor: 'var(--accent)' }} 
                      onClick={runBackfill} 
                      disabled={syncingEmbeddings}
                    >
                      {syncingEmbeddings ? 'Syncing...' : '🔄 Sync AI Embeddings'}
                    </button>
                  </div>
                </div>

                {/* Active Filter Chips */}
                {(() => {
                  const chips = [];
                  if (connFilters.q) chips.push({ label: `Search: ${connFilters.q}`, key: 'q', value: '' });
                  if (connFilters.company) chips.push({ label: `Company: ${connFilters.company}`, key: 'company', value: '' });
                  if (connFilters.title) chips.push({ label: `Title: ${connFilters.title}`, key: 'title', value: '' });
                  if (connFilters.hasEmail !== undefined) chips.push({ label: connFilters.hasEmail ? 'Has Email' : 'No Email', key: 'hasEmail', value: undefined });
                  if (connFilters.relationshipStatus) chips.push({ label: `Status: ${connFilters.relationshipStatus}`, key: 'relationshipStatus', value: undefined });
                  if (connFilters.followUpDue) chips.push({ label: `Follow-up Due`, key: 'followUpDue', value: undefined });

                  if (connFilters.companies && connFilters.companies.length > 0) {
                    connFilters.companies.forEach(c => {
                      chips.push({ label: `Company: ${c}`, key: 'companies', value: c });
                    });
                  }
                  if (connFilters.seniority && connFilters.seniority.length > 0) {
                    connFilters.seniority.forEach(s => {
                      chips.push({ label: `Seniority: ${s}`, key: 'seniority', value: s });
                    });
                  }
                  if (connFilters.roleCategory && connFilters.roleCategory.length > 0) {
                    connFilters.roleCategory.forEach(r => {
                      chips.push({ label: `Role: ${r}`, key: 'roleCategory', value: r });
                    });
                  }
                  if (connFilters.priority && connFilters.priority.length > 0) {
                    connFilters.priority.forEach(p => {
                      chips.push({ label: `Priority: ${p}`, key: 'priority', value: p });
                    });
                  }

                  if (chips.length === 0) return null;

                  return (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Active Filters:</span>
                      {chips.map((chip, idx) => (
                        <span key={idx} className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '0.85rem' }}>
                          {chip.label}
                          <span
                            style={{ cursor: 'pointer', fontWeight: 'bold', marginLeft: '4px' }}
                            onClick={() => {
                              if (chip.key === 'companies' || chip.key === 'seniority' || chip.key === 'roleCategory' || chip.key === 'priority') {
                                setConnFilters({
                                  ...connFilters,
                                  [chip.key]: connFilters[chip.key].filter(v => v !== chip.value),
                                  page: 1
                                });
                              } else {
                                setConnFilters({
                                  ...connFilters,
                                  [chip.key]: chip.value,
                                  page: 1
                                });
                              }
                            }}
                          >
                            &times;
                          </span>
                        </span>
                      ))}
                      <button
                        className="btn-link"
                        style={{ fontSize: '0.85rem', color: 'var(--danger)', border: 'none', background: 'none', cursor: 'pointer' }}
                        onClick={() => {
                          setConnFilters({ page: 1, pageSize: 10, q: '', company: '', title: '' });
                        }}
                      >
                        Clear All
                      </button>
                    </div>
                  );
                })()}

                {/* Filter Bar */}
                <div className="filter-bar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ margin: 0, minWidth: '240px' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Search Query</span>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                        <span 
                          style={{ cursor: 'pointer', fontWeight: connSearchMode === 'keyword' ? 'bold' : 'normal', color: connSearchMode === 'keyword' ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={() => { setConnSearchMode('keyword'); setSemanticConnResults(null); }}
                        >Keyword</span>
                        <span 
                          style={{ cursor: 'pointer', fontWeight: connSearchMode === 'semantic' ? 'bold' : 'normal', color: connSearchMode === 'semantic' ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={() => { setConnSearchMode('semantic'); }}
                        >Semantic</span>
                      </div>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={connSearchMode === 'semantic' ? "Find people with experience in..." : "Name, title, company..."}
                        value={connFilters.q || ''}
                        onChange={(e) => {
                          setConnFilters({ ...connFilters, q: e.target.value, page: 1 });
                          if (connSearchMode === 'keyword') setSemanticConnResults(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && connSearchMode === 'semantic') {
                            await runSemanticConnSearch();
                          }
                        }}
                      />
                      {connSearchMode === 'semantic' && (
                        <button className="btn btn-primary" onClick={runSemanticConnSearch} disabled={searchingSemantic}>
                          {searchingSemantic ? '...' : 'Search'}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                    <label className="form-label">Filter Company</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Google"
                      value={connFilters.company || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, company: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                    <label className="form-label">Filter Title/Role</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. Engineer"
                      value={connFilters.title || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, title: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                    <label className="form-label">Email Filter</label>
                    <select
                      className="form-input"
                      value={connFilters.hasEmail === undefined ? '' : String(connFilters.hasEmail)}
                      onChange={(e) => {
                        const val = e.target.value;
                        setConnFilters({
                          ...connFilters,
                          hasEmail: val === '' ? undefined : val === 'true',
                          page: 1
                        });
                      }}
                    >
                      <option value="">All Connections</option>
                      <option value="true">Has Email Only</option>
                      <option value="false">No Email Only</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '120px' }}>
                    <label className="form-label">Relationship Status</label>
                    <select
                      className="form-input"
                      value={connFilters.relationshipStatus || ''}
                      onChange={(e) => setConnFilters({ ...connFilters, relationshipStatus: e.target.value || undefined, page: 1 })}
                    >
                      <option value="">All Statuses</option>
                      <option value="not_contacted">Not Contacted</option>
                      <option value="researching">Researching</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="conversation">Conversation</option>
                      <option value="referral_requested">Referral Requested</option>
                      <option value="referral_received">Referral Received</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
                    <label className="form-label">Sort By</label>
                    <select
                      className="form-input"
                      value={connFilters.sortBy || 'connectedDate'}
                      onChange={(e) => setConnFilters({ ...connFilters, sortBy: e.target.value, page: 1 })}
                    >
                      <option value="connectedDate">Connected Date</option>
                      <option value="connectionScore">Connection Score</option>
                      <option value="name">Name</option>
                      <option value="company">Company</option>
                      <option value="title">Title</option>
                      <option value="lastContactedDate">Last Contacted</option>
                      <option value="nextFollowUpDate">Next Follow-up</option>
                      <option value="priority">Priority</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, minWidth: '100px' }}>
                    <label className="form-label">Sort Order</label>
                    <select
                      className="form-input"
                      value={connFilters.sortOrder || 'desc'}
                      onChange={(e) => setConnFilters({ ...connFilters, sortOrder: e.target.value, page: 1 })}
                    >
                      <option value="desc">Descending</option>
                      <option value="asc">Ascending</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
                    <input
                      type="checkbox"
                      id="followUpDueOnly"
                      checked={!!connFilters.followUpDue}
                      onChange={(e) => setConnFilters({ ...connFilters, followUpDue: e.target.checked ? true : undefined, page: 1 })}
                    />
                    <label htmlFor="followUpDueOnly" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>Follow-up Due</label>
                  </div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-secondary" onClick={loadConnections}>Apply</button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => {
                        setConnFilters({ page: 1, pageSize: 10, q: '', company: '', title: '' });
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Collapsible Advanced Filters Drawer */}
                <details style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                  <summary style={{ cursor: 'pointer', fontWeight: 600, color: 'var(--primary)' }}>Advanced Attribute Filters</summary>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginTop: '12px' }}>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Seniority</h4>
                      {['mid', 'senior', 'junior', 'intern', 'lead', 'manager', 'director', 'executive', 'founder', 'unknown'].map(lvl => (
                        <label key={lvl} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '4px', textTransform: 'capitalize', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={connFilters.seniority?.includes(lvl) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.seniority || [];
                              setConnFilters({
                                ...connFilters,
                                seniority: checked ? [...current, lvl] : current.filter(v => v !== lvl),
                                page: 1
                              });
                            }}
                          />
                          {lvl}
                        </label>
                      ))}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Role Category</h4>
                      {['engineering', 'data', 'product', 'recruiting', 'sales', 'marketing', 'design', 'finance', 'other'].map(cat => (
                        <label key={cat} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '4px', textTransform: 'capitalize', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={connFilters.roleCategory?.includes(cat) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.roleCategory || [];
                              setConnFilters({
                                ...connFilters,
                                roleCategory: checked ? [...current, cat] : current.filter(v => v !== cat),
                                page: 1
                              });
                            }}
                          />
                          {cat.replace('_', ' ')}
                        </label>
                      ))}
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>Priority</h4>
                      {['high', 'medium', 'low', 'none'].map(prio => (
                        <label key={prio} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', marginBottom: '4px', textTransform: 'capitalize', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={connFilters.priority?.includes(prio) || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const current = connFilters.priority || [];
                              setConnFilters({
                                ...connFilters,
                                priority: checked ? [...current, prio] : current.filter(v => v !== prio),
                                page: 1
                              });
                            }}
                          />
                          {prio}
                        </label>
                      ))}
                    </div>
                  </div>
                </details>

                <div className="card-panel">
                  {(semanticConnResults !== null ? semanticConnResults : connections).length === 0 ? (
                    <div className="empty-state">No connection CRM records matching query.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Company & Title</th>
                            <th>Email / Location</th>
                            <th>Relationship Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(semanticConnResults !== null
                            ? semanticConnResults.map(r => ({ ...r.connection, similarity: r.similarity, matchedConcepts: r.matchedConcepts }))
                            : connections
                          ).map((c) => (
                            <tr key={c.id}>
                              <td style={{ fontWeight: 600 }}>
                                <div>{c.name}</div>
                                {c.similarity !== undefined && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'normal', marginTop: '4px' }}>
                                    Similarity: {Math.round(c.similarity * 100)}% {c.matchedConcepts?.length > 0 && `(${c.matchedConcepts.join(', ')})`}
                                  </div>
                                )}
                              </td>
                              <td>
                                <div>{c.title || 'No Title'}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.company || 'Unknown'}</div>
                              </td>
                              <td>
                                <div>{c.email || 'No email'}</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{c.location || 'Unknown'}</div>
                              </td>
                              <td>
                                <span className="badge badge-info">{c.relationshipStatus || 'Not Contacted'}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setActiveConnectionId(c.id);
                                    setActiveTab('connection-detail');
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setEditItem(c);
                                    setModal('outreach');
                                  }}
                                >
                                  Log Outreach
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setEditItem(c);
                                    setModal('connection');
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={async () => {
                                    if (confirm('Delete this connection record?')) {
                                      await api.deleteConnection(c.id);
                                      loadConnections();
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="pagination">
                        <button
                          className="btn btn-secondary"
                          disabled={connFilters.page <= 1}
                          onClick={() => setConnFilters({ ...connFilters, page: connFilters.page - 1 })}
                        >
                          Previous
                        </button>
                        <span>Page {connFilters.page} of {connMeta.totalPages || 1}</span>
                        <button
                          className="btn btn-secondary"
                          disabled={connFilters.page >= connMeta.totalPages}
                          onClick={() => setConnFilters({ ...connFilters, page: connFilters.page + 1 })}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* JOBS TRACKER TAB */}
        {activeTab === 'jobs' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Job Postings</h1>
              <button className="btn btn-primary" onClick={() => { setEditItem(null); setModal('job'); }}>
                Track New Job
              </button>
            </div>

            <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--bg-secondary)', marginBottom: '16px', paddingBottom: '8px' }}>
              <button
                className={`btn ${jobSubTab === 'list' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => setJobSubTab('list')}
              >
                All Jobs
              </button>
              <button
                className={`btn ${jobSubTab === 'sources' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => setJobSubTab('sources')}
              >
                Settings ➔ Job Sources
              </button>
              <button
                className={`btn ${jobSubTab === 'review' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                onClick={() => { setJobSubTab('review'); loadIncomingJobs(); }}
              >
                Incoming Queue ({incomingJobs.filter(j => j.status === 'pending_review').length})
              </button>
            </div>

            {jobSubTab === 'list' && (
              <div>
                <div className="filter-bar">
                  <div className="form-group" style={{ margin: 0, minWidth: '240px' }}>
                    <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>Job Title / keyword</span>
                      <div style={{ display: 'flex', gap: '8px', fontSize: '0.8rem' }}>
                        <span 
                          style={{ cursor: 'pointer', fontWeight: jobSearchMode === 'keyword' ? 'bold' : 'normal', color: jobSearchMode === 'keyword' ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={() => { setJobSearchMode('keyword'); setSemanticJobResults(null); }}
                        >Keyword</span>
                        <span 
                          style={{ cursor: 'pointer', fontWeight: jobSearchMode === 'semantic' ? 'bold' : 'normal', color: jobSearchMode === 'semantic' ? 'var(--primary)' : 'var(--text-secondary)' }}
                          onClick={() => { setJobSearchMode('semantic'); }}
                        >Semantic</span>
                      </div>
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder={jobSearchMode === 'semantic' ? "Find backend roles focused on..." : "Job title..."}
                        value={jobFilters.q}
                        onChange={(e) => {
                          setJobFilters({ ...jobFilters, q: e.target.value, page: 1 });
                          if (jobSearchMode === 'keyword') setSemanticJobResults(null);
                        }}
                        onKeyDown={async (e) => {
                          if (e.key === 'Enter' && jobSearchMode === 'semantic') {
                            await runSemanticJobSearch();
                          }
                        }}
                      />
                    </div>
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Location</label>
                    <input
                      type="text"
                      className="form-input"
                      value={jobFilters.location}
                      onChange={(e) => setJobFilters({ ...jobFilters, location: e.target.value, page: 1 })}
                    />
                  </div>
                  <div className="form-group" style={{ margin: 0 }}>
                    <label className="form-label">Status</label>
                    <select
                      className="form-input"
                      value={jobFilters.status}
                      onChange={(e) => setJobFilters({ ...jobFilters, status: e.target.value, page: 1 })}
                    >
                      <option value="">All statuses</option>
                      <option value="new">New</option>
                      <option value="saved">Saved</option>
                      <option value="applied">Applied</option>
                    </select>
                  </div>
                  <button className="btn btn-secondary" onClick={jobSearchMode === 'semantic' ? runSemanticJobSearch : loadJobs}>
                    {searchingJobSemantic ? '...' : 'Search'}
                  </button>
                </div>

                <div className="card-panel">
                  {(semanticJobResults !== null ? semanticJobResults : jobs).length === 0 ? (
                    <div className="empty-state">No jobs found matching conditions.</div>
                  ) : (
                    <div className="data-table-container">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Job Title</th>
                            <th>Company Name</th>
                            <th>Location</th>
                            <th>Post Status</th>
                            <th style={{ textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(semanticJobResults !== null
                            ? semanticJobResults.map(r => ({ ...r.job, similarity: r.similarity, matchedConcepts: r.matchedConcepts }))
                            : jobs
                          ).map((job) => (
                            <tr key={job.id}>
                              <td style={{ fontWeight: 600 }}>
                                <div>{job.title}</div>
                                {job.similarity !== undefined && (
                                  <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'normal', marginTop: '4px' }}>
                                    Similarity: {Math.round(job.similarity * 100)}% {job.matchedConcepts?.length > 0 && `(${job.matchedConcepts.join(', ')})`}
                                  </div>
                                )}
                              </td>
                              <td>
                                {job.companyName}
                                <span className="badge badge-secondary" style={{ marginLeft: '8px', textTransform: 'capitalize', fontSize: '0.75rem' }}>
                                  {job.source || 'manual'}
                                </span>
                              </td>
                              <td>{job.location || 'Remote'}</td>
                              <td>
                                <span className="badge badge-info">{job.status}</span>
                              </td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  className="btn btn-primary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={async () => {
                                    try {
                                      const data = await api.request(`/jobs/${job.id}`);
                                      setEditItem(data.data);
                                      setModal('job_detail');
                                    } catch (err) {
                                      alert(err.message);
                                    }
                                  }}
                                >
                                  View
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={async () => {
                                    await api.createApplication(job.id, 'saved');
                                    alert('Job saved to applications!');
                                  }}
                                >
                                  Save / Apply
                                </button>
                                <button
                                  className="btn btn-secondary"
                                  style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={() => {
                                    setEditItem(job);
                                    setModal('job');
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="btn btn-danger"
                                  style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                  onClick={async () => {
                                    if (confirm('Delete this job?')) {
                                      await api.deleteJob(job.id);
                                      loadJobs();
                                    }
                                  }}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      <div className="pagination">
                        <button
                          className="btn btn-secondary"
                          disabled={jobFilters.page <= 1}
                          onClick={() => setJobFilters({ ...jobFilters, page: jobFilters.page - 1 })}
                        >
                          Previous
                        </button>
                        <span>Page {jobFilters.page} of {jobMeta.totalPages || 1}</span>
                        <button
                          className="btn btn-secondary"
                          disabled={jobFilters.page >= jobMeta.totalPages}
                          onClick={() => setJobFilters({ ...jobFilters, page: jobFilters.page + 1 })}
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {jobSubTab === 'sources' && (
              <div>
                {/* 2.7-A & 2.7-G: INGESTION MONITORING PANEL */}
                <div className="card-panel" style={{ marginBottom: '24px' }}>
                  <h2 className="card-title">Job Ingestion Monitor & Health</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Track status, synchronization timestamps, health, and throughput metrics across all automated connectors.
                  </p>

                  {ingestionMonitor ? (
                    <div>
                      {/* Health Matrix Table */}
                      <table className="table" style={{ width: '100%', marginBottom: '24px', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>
                            <th style={{ padding: '8px 12px' }}>Source</th>
                            <th style={{ padding: '8px 12px' }}>Health Status</th>
                            <th style={{ padding: '8px 12px' }}>Last Synced</th>
                            <th style={{ padding: '8px 12px' }}>New Jobs (Today)</th>
                            <th style={{ padding: '8px 12px' }}>Failures</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ingestionMonitor.sources.map(s => (
                            <tr key={s.name} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              <td style={{ padding: '12px', fontWeight: 600 }}>{s.name}</td>
                              <td style={{ padding: '12px' }}>
                                <span style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.8rem',
                                  fontWeight: 600,
                                  background: s.status === 'healthy' ? 'rgba(76, 175, 80, 0.15)' : s.status === 'degraded' ? 'rgba(255, 152, 0, 0.15)' : 'rgba(244, 67, 54, 0.15)',
                                  color: s.status === 'healthy' ? 'var(--success)' : s.status === 'degraded' ? '#ff9800' : 'var(--danger)'
                                }}>
                                  {s.status === 'healthy' ? '✅ Healthy' : s.status === 'degraded' ? '⚠️ Degraded' : '❌ Failed'}
                                </span>
                              </td>
                              <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                                {s.lastSync ? new Date(s.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                              </td>
                              <td style={{ padding: '12px', fontWeight: 600 }}>{s.newJobs || '—'}</td>
                              <td style={{ padding: '12px', color: s.failed > 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>{s.failed || 0}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {/* Today's Ingestion Metrics Summary */}
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Today's Ingestion</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '16px', background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Messages Received</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ingestionMonitor.stats.messagesReceived}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jobs Detected</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ingestionMonitor.stats.jobsDetected}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Jobs Created</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ingestionMonitor.stats.jobsCreated}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Duplicates</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{ingestionMonitor.stats.duplicates}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Pending Review</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{ingestionMonitor.stats.pendingReview}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Failed</div>
                          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: ingestionMonitor.stats.failed > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>{ingestionMonitor.stats.failed}</div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)' }}>Loading ingestion status metrics...</div>
                  )}
                </div>

                <div className="card-panel" style={{ marginBottom: '24px' }}>
                  <h2 className="card-title">Job Sources: Adzuna API Integration</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Adzuna is connected in your backend configurations. Run manual sync below or let the scheduled background runner fetch jobs automatically every 4 hours.
                  </p>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Adzuna Status</div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                        🟢 Active / Configured
                      </div>
                    </div>
                    <button
                      className="btn btn-primary"
                      onClick={async () => {
                        try {
                          const summary = await api.syncAdzunaJobs();
                          alert(`Adzuna Sync Complete!\nProcessed: ${summary.processed}\nCreated: ${summary.created}\nUpdated: ${summary.updated}\nDuplicates: ${summary.duplicate}\nFailed: ${summary.failed}`);
                          loadJobs();
                          loadIngestionMonitor();
                        } catch (err) {
                          alert(err.message);
                        }
                      }}
                    >
                      Sync Adzuna Jobs Now
                    </button>
                  </div>
                </div>

                <div className="card-panel" style={{ marginBottom: '24px' }}>
                  <h2 className="card-title">LinkedIn Job Alerts</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Connect Gmail to fetch and parse job listings from LinkedIn alert emails under the <strong>CareerGraph/LinkedInJobs</strong> label.
                  </p>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                    {gmailStatus?.connected ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                              🟢 Connected: {gmailStatus.email}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Label: CareerGraph/LinkedInJobs &bull; Last Sync: {gmailStatus.lastSyncAt ? new Date(gmailStatus.lastSyncAt).toLocaleString() : 'Never'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-primary"
                              disabled={gmailSyncing}
                              onClick={async () => {
                                setGmailSyncing(true);
                                try {
                                  const res = await api.request('/integrations/gmail/jobs/sync', { method: 'POST' });
                                  alert(`Gmail Sync Complete!\nEmails Processed: ${res.data.emailsProcessed}\nJobs Found: ${res.data.jobsFound}\nCreated: ${res.data.created}\nUpdated: ${res.data.updated}\nDuplicates: ${res.data.duplicates}\nFailed: ${res.data.failed}`);
                                  loadGmailStatus();
                                  loadJobs();
                                  loadIngestionMonitor();
                                } catch (err) {
                                  alert(err.message);
                                } finally {
                                  setGmailSyncing(false);
                                }
                              }}
                            >
                              {gmailSyncing ? 'Syncing...' : 'Sync Now'}
                            </button>
                            <button
                              className="btn btn-danger"
                              onClick={async () => {
                                if (confirm('Disconnect Gmail integration?')) {
                                  try {
                                    await api.request('/integrations/gmail/disconnect', { method: 'POST' });
                                    loadGmailStatus();
                                    loadIngestionMonitor();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Not Connected</span>
                        <button
                          className="btn btn-primary"
                          onClick={handleConnectGmail}
                        >
                          Connect Gmail
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="card-panel" style={{ marginBottom: '24px' }}>
                  <h2 className="card-title">Telegram Job Tracker</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Connect your Telegram account to CareerGraph to manually forward or copy-paste job postings directly into your private bot chat.
                  </p>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                    {telegramStatus?.connected ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                              🟢 Connected: @{telegramStatus.telegramUsername || telegramStatus.telegramUserId}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Bot: @{telegramStatus.botUsername} &bull; Linked: {new Date(telegramStatus.linkedAt).toLocaleDateString()}
                            </div>
                            <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                              <div><strong>{telegramStatus.stats.received}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Received</span></div>
                              <div><strong>{telegramStatus.stats.jobsCreated}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Created</span></div>
                              <div><strong>{telegramStatus.stats.duplicates}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duplicates</span></div>
                              <div><strong>{telegramStatus.stats.pendingReview}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pending Review</span></div>
                            </div>
                          </div>
                          <div>
                            <button
                              className="btn btn-danger"
                              onClick={async () => {
                                if (confirm('Disconnect Telegram integration?')) {
                                  try {
                                    await api.request('/integrations/telegram/disconnect', { method: 'POST' });
                                    loadTelegramStatus();
                                    loadIngestionMonitor();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Not Connected</span>
                          <button
                            className="btn btn-primary"
                            onClick={generateTelegramCode}
                          >
                            Generate Linking Code
                          </button>
                        </div>
                        {telegramLinkingCode && (
                          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                              1. Open Telegram and search for <strong>@{telegramStatus?.botUsername || 'CareerGraphJobBot'}</strong>
                            </p>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>
                              2. Send the command:
                            </p>
                            <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', color: 'var(--accent)' }}>
                              /start {telegramLinkingCode}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2.7-I: USER AUTOMATION PREFERENCES PANEL */}
                <div className="card-panel" style={{ marginBottom: '24px' }}>
                  <h2 className="card-title">Job Discovery Automation Preferences</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Configure automatic notifications, filtering rules, and quality thresholds for new job matches.
                  </p>

                  <div style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={preferences.notificationsEnabled}
                          onChange={(e) => savePreferences({ ...preferences, notificationsEnabled: e.target.checked })}
                        />
                        <span style={{ fontWeight: 600 }}>Enable Real-time Job Notifications</span>
                      </label>

                      {preferences.notificationsEnabled && (
                        <div style={{ marginLeft: '24px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '2px solid var(--border-color)', paddingLeft: '16px', marginTop: '4px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={preferences.notifyHighlyRelevant}
                              onChange={(e) => savePreferences({ ...preferences, notifyHighlyRelevant: e.target.checked })}
                            />
                            <span>Notify for highly relevant jobs (matching score &ge; threshold)</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={preferences.notifyStrongReferral}
                              onChange={(e) => savePreferences({ ...preferences, notifyStrongReferral: e.target.checked })}
                            />
                            <span>Notify when strong referral exists at the company</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={preferences.notifyTargetCompany}
                              onChange={(e) => savePreferences({ ...preferences, notifyTargetCompany: e.target.checked })}
                            />
                            <span>Notify for target companies list matching roles</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={preferences.dailyDigestEnabled}
                              onChange={(e) => savePreferences({ ...preferences, dailyDigestEnabled: e.target.checked })}
                            />
                            <span>Include new jobs in CareerGraph Daily Digest email</span>
                          </label>

                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={preferences.notifyLowRelevance}
                              onChange={(e) => savePreferences({ ...preferences, notifyLowRelevance: e.target.checked })}
                            />
                            <span>Notify for low-relevance jobs (score &lt; 40)</span>
                          </label>

                          <div style={{ marginTop: '8px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '6px' }}>
                              Minimum Match Score for Notification: <strong>{preferences.minimumMatchScore || 80}</strong>
                            </label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={preferences.minimumMatchScore || 80}
                              onChange={(e) => setPreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                              onMouseUp={(e) => savePreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                              onTouchEnd={(e) => savePreferences({ ...preferences, minimumMatchScore: parseInt(e.target.value) })}
                              style={{ width: '100%', maxWidth: '300px', accentColor: 'var(--accent)' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="card-panel">
                  <h2 className="card-title">Job Search Profiles</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Configure search queries. The Adzuna sync service will run queries for each active profile to discover relevant roles.
                  </p>

                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    try {
                      await api.createJobSearchProfile({
                        name: data.name,
                        keywords: data.keywords || '',
                        location: data.location || '',
                        remotePreference: data.remotePreference || '',
                        experienceLevel: data.experienceLevel || '',
                        employmentType: data.employmentType || '',
                        excludedKeywords: data.excludedKeywords || '',
                        isActive: true
                      });
                      loadSearchProfiles();
                      e.target.reset();
                      alert('Search profile created!');
                    } catch (err) {
                      alert(err.message);
                    }
                  }} style={{ background: 'var(--bg-secondary)', padding: '20px', borderRadius: '8px', marginBottom: '24px' }}>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '12px' }}>Add Search Profile</h3>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Profile Name *</label>
                        <input type="text" name="name" className="form-input" placeholder="e.g. React Roles" required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Keywords / Query *</label>
                        <input type="text" name="keywords" className="form-input" placeholder="e.g. React, Frontend" required />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Location</label>
                        <input type="text" name="location" className="form-input" placeholder="e.g. San Francisco" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Remote Preference</label>
                        <select name="remotePreference" className="form-input">
                          <option value="">No Preference</option>
                          <option value="remote">Remote Only</option>
                          <option value="hybrid">Hybrid</option>
                          <option value="onsite">Onsite Only</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Excluded Keywords</label>
                        <input type="text" name="excludedKeywords" className="form-input" placeholder="e.g. Senior, Ruby" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Employment Type</label>
                        <select name="employmentType" className="form-input">
                          <option value="">Any Type</option>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                    </div>

                    <button type="submit" className="btn btn-primary">Create Profile</button>
                  </form>

                  {/* List of profiles */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {searchProfiles.length === 0 ? (
                      <div style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No search profiles configured yet. Default parameters matching your Profile targets will be used during sync.</div>
                    ) : (
                      searchProfiles.map(p => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                          <div>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {p.name}
                              <span className={`badge ${p.isActive ? 'badge-success' : 'badge-secondary'}`}>
                                {p.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                              <strong>Keywords:</strong> {p.keywords} &bull;
                              <strong> Location:</strong> {p.location || 'Anywhere'} &bull;
                              <strong> Remote:</strong> {p.remotePreference || 'Any'}
                            </div>
                            {p.excludedKeywords && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <strong>Excluded:</strong> {p.excludedKeywords}
                              </div>
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={async () => {
                                try {
                                  await api.updateJobSearchProfile(p.id, { ...p, isActive: !p.isActive });
                                  loadSearchProfiles();
                                } catch (err) {
                                  alert(err.message);
                                }
                              }}
                            >
                              Toggle Status
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                              onClick={async () => {
                                if (confirm('Delete this search profile?')) {
                                  try {
                                    await api.deleteJobSearchProfile(p.id);
                                    loadSearchProfiles();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* <div className="card-panel" style={{ marginTop: '24px' }}>
                  <h2 className="card-title">Telegram Job Tracker</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Connect your Telegram account to CareerGraph to manually forward or copy-paste job postings directly into your private bot chat.
                  </p>

                  <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                    {telegramStatus?.connected ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                              🟢 Connected: @{telegramStatus.telegramUsername || telegramStatus.telegramUserId}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Bot: @{telegramStatus.botUsername} &bull; Linked: {new Date(telegramStatus.linkedAt).toLocaleDateString()}
                            </div>
                            <div style={{ display: 'flex', gap: '20px', marginTop: '12px' }}>
                              <div><strong>{telegramStatus.stats.received}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Received</span></div>
                              <div><strong>{telegramStatus.stats.jobsCreated}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Created</span></div>
                              <div><strong>{telegramStatus.stats.duplicates}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Duplicates</span></div>
                              <div><strong>{telegramStatus.stats.pendingReview}</strong> <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Pending Review</span></div>
                            </div>
                          </div>
                          <div>
                            <button
                              className="btn btn-danger"
                              onClick={async () => {
                                if (confirm('Disconnect Telegram integration?')) {
                                  try {
                                    await api.request('/integrations/telegram/disconnect', { method: 'POST' });
                                    loadTelegramStatus();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              Disconnect
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Not Connected</span>
                          <button
                            className="btn btn-primary"
                            onClick={generateTelegramCode}
                          >
                            Generate Linking Code
                          </button>
                        </div>
                        {telegramLinkingCode && (
                          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px dashed var(--border-color)' }}>
                            <p style={{ margin: '0 0 8px 0', fontSize: '0.9rem' }}>
                              1. Open Telegram and search for <strong>@{telegramStatus?.botUsername || 'CareerGraphJobBot'}</strong>
                            </p>
                            <p style={{ margin: '0 0 12px 0', fontSize: '0.9rem' }}>
                              2. Send the command:
                            </p>
                            <div style={{ background: 'var(--bg-secondary)', padding: '8px', borderRadius: '4px', fontFamily: 'monospace', fontWeight: 'bold', fontSize: '1.1rem', textAlign: 'center', color: 'var(--accent)' }}>
                              /start {telegramLinkingCode}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div> */}

                {/* 2.7-H: DEDUPLICATION AUDIT LOGS */}
                <div className="card-panel" style={{ marginTop: '24px' }}>
                  <h2 className="card-title">Deduplication & Quality Logs</h2>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                    Audit history of automatically rejected duplicate job postings and their match reasons.
                  </p>

                  <div style={{ maxHeight: '300px', overflowY: 'auto', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '16px' }}>
                    {deduplicationLogs.length === 0 ? (
                      <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '12px' }}>
                        No duplicates detected yet. Your tracker is completely clean!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {deduplicationLogs.map(l => (
                          <div key={l.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-primary)', padding: '10px 14px', borderRadius: '6px', fontSize: '0.85rem', border: '1px solid var(--border-color)' }}>
                            <div>
                              <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{l.duplicateText}</span>
                              <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>
                                via {l.source}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <span className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>
                                {l.reason}
                              </span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                                {new Date(l.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {jobSubTab === 'review' && (
              <div className="card-panel">
                <h2 className="card-title">Incoming Jobs Review Queue</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: '8px 0 16px 0' }}>
                  These jobs were sent from Telegram but could not be parsed with high confidence. Review and edit details below to track them.
                </p>

                {loadingIncoming ? (
                  <div>Loading review queue...</div>
                ) : incomingJobs.filter(j => j.status === 'pending_review').length === 0 ? (
                  <div className="empty-state">No jobs pending review. All caught up!</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {incomingJobs.filter(j => j.status === 'pending_review').map(item => (
                      <div key={item.id} className="card-panel" style={{ background: 'var(--bg-secondary)', padding: '16px', border: '1px solid var(--border-color)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                          <div style={{ flex: 1, minWidth: '280px' }}>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{item.parsedData?.title || 'Unknown Role'}</h3>
                              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>Pending Review</span>
                            </div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                              Company: <strong>{item.parsedData?.companyName || 'Unknown'}</strong> &bull; Location: {item.parsedData?.location || 'Unknown'}
                            </div>

                            <div style={{ marginTop: '12px', background: 'var(--bg-primary)', padding: '10px', borderRadius: '4px', borderLeft: '3px solid var(--accent)' }}>
                              <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600 }}>Raw Message Text:</div>
                              <pre style={{ margin: '6px 0 0 0', whiteSpace: 'pre-wrap', fontSize: '0.85rem', fontFamily: 'inherit', color: 'var(--text-primary)' }}>
                                {item.rawText}
                              </pre>
                            </div>
                          </div>

                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                              onClick={() => setReviewJob(item)}
                            >
                              Review &amp; Ingest
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                              onClick={async () => {
                                if (confirm('Ignore this job posting?')) {
                                  try {
                                    await api.request(`/incoming-jobs/${item.id}/ignore`, { method: 'POST' });
                                    loadIncomingJobs();
                                  } catch (err) {
                                    alert(err.message);
                                  }
                                }
                              }}
                            >
                              Ignore
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* APPLICATIONS TAB */}
        {activeTab === 'applications' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Active Job Applications</h1>
            </div>

            <div className="card-panel">
              {applications.length === 0 ? (
                <div className="empty-state">No active applications currently tracked. Save a job to start.</div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Job Role</th>
                        <th>Company</th>
                        <th>Status</th>
                        <th>Applied On</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map((app) => (
                        <tr key={app.id}>
                          <td style={{ fontWeight: 600 }}>{app.job?.title}</td>
                          <td>{app.job?.companyName}</td>
                          <td>
                            <span className="badge badge-success">{app.status}</span>
                          </td>
                          <td>{app.appliedAt ? new Date(app.appliedAt).toLocaleDateString() : 'Not applied yet'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                              onClick={() => {
                                setEditItem(app);
                                setModal('application');
                              }}
                            >
                              Update Status
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OUTREACH CRM TAB */}
        {activeTab === 'outreach' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Outreach Tracking Logs</h1>
            </div>

            <div className="card-panel">
              {outreachList.length === 0 ? (
                <div className="empty-state">No outreach campaigns logged. Go to Connections CRM to initiate.</div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Connection Name</th>
                        <th>Latest Status</th>
                        <th>Follow Up Date</th>
                        <th>Notes Summary</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {outreachList.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 600 }}>{o.connection?.name || 'Contact'}</td>
                          <td>
                            <span className="badge badge-warning">{o.status}</span>
                          </td>
                          <td>{o.followUpDate || 'None set'}</td>
                          <td>{o.notes || 'No outreach comments'}</td>
                          <td style={{ textAlign: 'right' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                              onClick={() => {
                                setEditItem(o);
                                setModal('outreach_update');
                              }}
                            >
                              Update Outreach
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {/* CONNECTION DETAIL TAB */}
        {activeTab === 'connection-detail' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <button className="btn btn-secondary" onClick={() => setActiveTab('connections')}>
                &larr; Back to Connections
              </button>
            </div>

            {loadingDetail && <div className="empty-state">Loading connection details...</div>}
            {detailError && <div className="empty-state" style={{ color: 'var(--danger)' }}>{detailError}</div>}

            {!loadingDetail && !detailError && connectionDetail && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px', alignItems: 'start' }}>

                  {/* Left Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* PERSON Profile Panel */}
                    <div className="card-panel">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                        <div>
                          <h1 className="page-title" style={{ marginBottom: '8px' }}>{connectionDetail.name}</h1>
                          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            {connectionDetail.title || 'No Title'}
                          </p>
                          <p style={{ color: 'var(--text-muted)' }}>{connectionDetail.company || 'Unknown Company'}</p>
                        </div>
                        {connectionDetail.profileUrl && (
                          <a
                            href={connectionDetail.profileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-secondary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          >
                            LinkedIn ↗
                          </a>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        <button
                          className="btn btn-primary"
                          onClick={() => {
                            setEditItem(connectionDetail);
                            setModal('connection');
                          }}
                        >
                          Edit Connection
                        </button>
                        <button
                          className="btn btn-secondary"
                          onClick={() => {
                            setEditItem(connectionDetail);
                            setModal('outreach');
                          }}
                        >
                          Log Outreach
                        </button>
                      </div>
                    </div>

                    {/* LinkedIn PDF Enrichment Panel */}
                    <div className="card-panel">
                      <h2 className="card-title" style={{ marginBottom: '12px' }}>Enrich via LinkedIn PDF</h2>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '16px' }}>
                        Upload a LinkedIn profile PDF to automatically extract and enrich headline, summary, links, and top skills for {connectionDetail.name}.
                      </p>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <input
                          type="file"
                          accept=".pdf"
                          className="form-input"
                          style={{ maxWidth: '300px' }}
                          onChange={async (e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            setEnrichmentLoading(true);
                            setEnrichmentError(null);
                            setModal('linkedin_pdf');
                            try {
                              const objectUrl = URL.createObjectURL(file);
                              setPdfObjectURL(objectUrl);
                              const res = await api.importLinkedInPdf(file);
                              setEnrichmentPreview(res.data);
                            } catch (err) {
                              setEnrichmentError(err.message || 'Failed to parse PDF profile.');
                            } finally {
                              setEnrichmentLoading(false);
                            }
                          }}
                        />
                      </div>
                    </div>

                    {/* PROFESSIONAL Information */}
                    <div className="card-panel">
                      <h2 className="card-title" style={{ marginBottom: '16px' }}>Professional Profile</h2>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Company</div>
                          <div style={{ fontWeight: 600 }}>{connectionDetail.company || 'Not Specified'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Position</div>
                          <div style={{ fontWeight: 600 }}>{connectionDetail.title || 'Not Specified'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Location</div>
                          <div style={{ fontWeight: 600 }}>{connectionDetail.location || 'Not Specified'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Email</div>
                          <div style={{ fontWeight: 600 }}>{connectionDetail.email || 'Not Specified'}</div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Connected Since</div>
                          <div style={{ fontWeight: 600 }}>
                            {connectionDetail.connectedDate ? new Date(connectionDetail.connectedDate).toLocaleDateString() : 'Not Specified'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Seniority Level (Derived)</div>
                          <div style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--info)' }}>
                            {connectionDetail.seniorityLevel || 'Mid'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role Category (Derived)</div>
                          <div style={{ fontWeight: 600, textTransform: 'capitalize', color: 'var(--info)' }}>
                            {connectionDetail.roleCategory || 'Engineering'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* ENRICHED PROFILE INFORMATION */}
                    {(connectionDetail.headline || connectionDetail.profileSummary || (connectionDetail.skills && connectionDetail.skills.length > 0) || (connectionDetail.externalLinks && connectionDetail.externalLinks.length > 0)) && (
                      <div className="card-panel" style={{ borderLeft: '4px solid var(--success)' }}>
                        <h2 className="card-title" style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>✨ Enriched LinkedIn Profile Intel</span>
                        </h2>

                        {connectionDetail.headline && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Headline</div>
                            <div style={{ fontWeight: 500, color: '#fff', fontSize: '1.05rem' }}>{connectionDetail.headline}</div>
                          </div>
                        )}

                        {connectionDetail.profileSummary && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Profile Summary</div>
                            <div style={{ fontSize: '0.95rem', background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '6px', whiteSpace: 'pre-line' }}>{connectionDetail.profileSummary}</div>
                          </div>
                        )}

                        {connectionDetail.skills && connectionDetail.skills.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Extracted Skills</div>
                            <div className="tags-list">
                              {connectionDetail.skills.map(s => (
                                <span key={s} className="badge badge-success">{s}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.externalLinks && connectionDetail.externalLinks.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Profile Links</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {connectionDetail.externalLinks.map(link => (
                                <a key={link} href={link.startsWith('http') ? link : `https://${link}`} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline', fontSize: '0.9rem' }}>
                                  {link}
                                </a>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.languages && connectionDetail.languages.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Languages</div>
                            <div className="tags-list">
                              {connectionDetail.languages.map(l => (
                                <span key={l} className="badge badge-info" style={{ marginRight: '6px', marginBottom: '6px', display: 'inline-block' }}>{l}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.certifications && connectionDetail.certifications.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Certifications</div>
                            <div className="tags-list">
                              {connectionDetail.certifications.map(c => (
                                <span key={c} className="badge badge-secondary" style={{ marginRight: '6px', marginBottom: '6px', display: 'inline-block' }}>{c}</span>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.projects && connectionDetail.projects.length > 0 && (
                          <div style={{ marginBottom: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '6px' }}>Projects</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {connectionDetail.projects.map(p => (
                                <div key={p} style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>• {p}</div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.experience && connectionDetail.experience.length > 0 && (
                          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Experience Timeline</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                              {connectionDetail.experience.map((exp, idx) => (
                                <div key={idx} style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid var(--primary-glow)' }}>
                                  <div style={{ fontWeight: 600, color: '#fff' }}>{exp.title}</div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--primary)' }}>{exp.company}</div>
                                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exp.dateRange} {exp.location && `| ${exp.location}`}</div>
                                  {exp.description && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                      {exp.description}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.education && connectionDetail.education.length > 0 && (
                          <div style={{ marginBottom: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '12px' }}>Education Milestones</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                              {connectionDetail.education.map((edu, idx) => (
                                <div key={idx} style={{ position: 'relative', paddingLeft: '16px', borderLeft: '2px solid var(--info-glow)' }}>
                                  <div style={{ fontWeight: 600, color: '#fff' }}>{edu.institution}</div>
                                  <div style={{ fontSize: '0.85rem', color: 'var(--info)' }}>
                                    {edu.degree} {edu.field && ` - ${edu.field}`}
                                  </div>
                                  {(edu.startYear || edu.endYear) && (
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                      {edu.startYear} - {edu.endYear || 'Present'}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {connectionDetail.profilePdfKey && (
                          <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}
                              onClick={() => setShowOriginalPdf(!showOriginalPdf)}
                            >
                              <span>📄 {showOriginalPdf ? 'Hide LinkedIn PDF' : 'View Original LinkedIn PDF'}</span>
                            </button>
                            {showOriginalPdf && (
                              <div style={{ marginTop: '8px', background: 'var(--bg-tertiary)', padding: '8px', borderRadius: '8px' }}>
                                <iframe
                                  src={api.getConnectionPdfUrl(connectionDetail.id)}
                                  width="100%"
                                  height="500px"
                                  style={{ border: 'none', borderRadius: '6px', background: '#fff' }}
                                ></iframe>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                  </div>

                  {/* Right Column */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

                    {/* RELATIONSHIP Status & Strength */}
                    <div className="card-panel">
                      <h2 className="card-title" style={{ marginBottom: '16px' }}>Relationship CRM</h2>

                      <div className="form-group">
                        <label className="form-label">Relationship Status</label>
                        <select
                          className="form-input"
                          value={connectionDetail.relationshipStatus || 'not_contacted'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  relationshipStatus: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="not_contacted">Not Contacted</option>
                          <option value="researching">Researching</option>
                          <option value="contacted">Contacted</option>
                          <option value="replied">Replied</option>
                          <option value="conversation">Conversation</option>
                          <option value="referral_requested">Referral Requested</option>
                          <option value="referral_received">Referral Received</option>
                          <option value="closed">Closed</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Relationship Strength</label>
                        <select
                          className="form-input"
                          value={connectionDetail.relationshipStrength || 'cold'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  relationshipStrength: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="cold">Cold</option>
                          <option value="warm">Warm</option>
                          <option value="strong">Strong</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">CRM Priority</label>
                        <select
                          className="form-input"
                          value={connectionDetail.priority || 'medium'}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  priority: e.target.value
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Next Follow-up Date</label>
                        <input
                          type="date"
                          className="form-input"
                          value={connectionDetail.nextFollowUpDate || ''}
                          onChange={async (e) => {
                            try {
                              await api.request(`/connections/${activeConnectionId}`, {
                                method: 'PUT',
                                body: {
                                  name: connectionDetail.name,
                                  nextFollowUpDate: e.target.value || null
                                }
                              });
                              loadConnectionDetail(activeConnectionId);
                            } catch (err) {
                              alert(err.message);
                            }
                          }}
                        />
                        {connectionDetail.nextFollowUpDate && (
                          <button
                            className="btn btn-secondary"
                            style={{ marginTop: '8px', width: '100%', padding: '6px' }}
                            onClick={async () => {
                              try {
                                await api.request(`/connections/${activeConnectionId}`, {
                                  method: 'PUT',
                                  body: {
                                    name: connectionDetail.name,
                                    nextFollowUpDate: null
                                  }
                                });
                                loadConnectionDetail(activeConnectionId);
                              } catch (err) {
                                alert(err.message);
                              }
                            }}
                          >
                            Clear Follow-up
                          </button>
                        )}
                      </div>
                    </div>

                    {/* INTELLIGENCE Scores */}
                    <div className="card-panel">
                      <h2 className="card-title" style={{ marginBottom: '16px' }}>Network Intelligence</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Connection Score</span>
                          <span className="badge badge-success" style={{ fontSize: '1.05rem', padding: '6px 12px' }}>
                            {connectionDetail.connectionScore || 0} / 100
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Profile Completeness</span>
                          <span className="badge badge-info" style={{ fontSize: '1.05rem', padding: '6px 12px' }}>
                            {connectionDetail.profileCompleteness || 0}%
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>

                {/* TAGS SECTION */}
                <div className="card-panel" style={{ marginTop: '24px' }}>
                  <h2 className="card-title" style={{ marginBottom: '12px' }}>Tags / Labels</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {connectionDetail.tags && connectionDetail.tags.length > 0 ? (
                      connectionDetail.tags.map((tag) => (
                        <span key={tag} className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 12px' }}>
                          {tag}
                          <button
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '0.85rem' }}
                            onClick={() => handleRemoveTag(tag)}
                          >
                            &times;
                          </button>
                        </span>
                      ))
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>No tags added yet.</span>
                    )}

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="New tag..."
                        style={{ width: '120px', padding: '4px 8px', fontSize: '0.85rem', margin: 0 }}
                        value={newTagText}
                        onChange={(e) => setNewTagText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleAddTag(newTagText);
                          }
                        }}
                      />
                      <button
                        className="btn btn-primary"
                        style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                        onClick={() => handleAddTag(newTagText)}
                      >
                        + Add Tag
                      </button>
                    </div>
                  </div>
                </div>

                {/* NOTES SECTION */}
                <div className="card-panel" style={{ marginTop: '24px' }}>
                  <h2 className="card-title" style={{ marginBottom: '16px' }}>Relationship & Interaction Notes</h2>

                  <form onSubmit={handleAddNote} style={{ marginBottom: '24px' }}>
                    <div className="form-group">
                      <textarea
                        className="form-input"
                        rows="3"
                        placeholder="Log a new meeting note, update, context details..."
                        required
                        value={newNoteContent}
                        onChange={(e) => setNewNoteContent(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary">Add Note</button>
                  </form>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {connectionDetail.notes && connectionDetail.notes.length > 0 ? (
                      connectionDetail.notes.map((note) => (
                        <div key={note.id} style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', borderLeft: '3px solid var(--primary)' }}>
                          <p style={{ whiteSpace: 'pre-wrap', marginBottom: '8px' }}>{note.content}</p>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(note.createdAt).toLocaleString()}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">No notes recorded yet. Add one above to keep track of interactions.</div>
                    )}
                  </div>
                </div>

                {/* OUTREACH HISTORY */}
                <div className="card-panel" style={{ marginTop: '24px' }}>
                  <h2 className="card-title" style={{ marginBottom: '16px' }}>Outreach & History Logs</h2>

                  {connectionDetail.outreach && connectionDetail.outreach.length > 0 ? (
                    <div className="timeline" style={{ paddingLeft: '10px' }}>
                      {connectionDetail.outreach.map((event) => (
                        <div className="timeline-event" key={event.id} style={{ paddingBottom: '16px', borderLeft: '2px solid var(--border-color)', paddingLeft: '20px', position: 'relative' }}>
                          <div style={{ position: 'absolute', left: '-6px', top: '4px', width: '10px', height: '10px', borderRadius: '50%', background: 'var(--warning)' }} />
                          <div style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                            {event.status.replace('_', ' ')}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0' }}>
                            {new Date(event.occurredAt).toLocaleDateString()}
                          </div>
                          {event.notes && <p style={{ color: 'var(--text-muted)' }}>{event.notes}</p>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">No outreach campaign history recorded yet.</div>
                  )}
                </div>

            {/* RELEVANT OPPORTUNITIES */}
        <div className="card-panel" style={{ marginTop: '24px', marginBottom: '24px' }}>
          <h2 className="card-title" style={{ marginBottom: '16px' }}>Relevant Opportunities at {connectionDetail.company || 'target company'}</h2>

          {connectionDetail.referralOpportunities && connectionDetail.referralOpportunities.length > 0 ? (
            <div className="activity-list">
              {connectionDetail.referralOpportunities.map((opp) => (
                <div className="activity-item" key={opp.jobId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{opp.jobTitle}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{connectionDetail.company}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <span className="badge badge-success" style={{ fontSize: '0.9rem' }}>
                      Referral Match: {opp.referralScore}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">No active tracked jobs found matching company {connectionDetail.company || 'Not Specified'}.</div>
          )}
        </div>

    </div>
  )
}
          </div >
        )}

      </main >

  {/* ================= MODALS ================= */ }

{/* CSV Import Modal */ }
{
  modal === 'csv' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">Import Connections CSV</h2>
        <div className="form-group">
          <label className="form-label">Choose CSV File</label>
          <input
            type="file"
            accept=".csv"
            className="form-input"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                try {
                  const res = await api.importConnections(file);
                  alert(`Successfully imported ${res.imported} connections! Duplicates found: ${res.duplicates}`);
                  setModal(null);
                  loadConnections();
                } catch (err) {
                  alert(err.message);
                }
              }
            }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

{/* Resume File Upload Modal */ }
{
  modal === 'resume' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">Upload Resume File</h2>
        <div className="form-group">
          <label className="form-label">Select Document (PDF/DOCX)</label>
          <input
            type="file"
            className="form-input"
            onChange={async (e) => {
              const file = e.target.files[0];
              if (file) {
                try {
                  await api.uploadResume(file);
                  alert('Resume uploaded successfully!');
                  setModal(null);
                  loadResumes();
                } catch (err) {
                  alert(err.message);
                }
              }
            }}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

{/* Add/Edit Connection Modal */ }
{
  modal === 'connection' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">{editItem ? 'Edit Connection' : 'Add Connection'}</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          try {
            if (editItem) {
              await api.updateConnection(editItem.id, data);
              if (activeTab === 'connection-detail' && activeConnectionId === editItem.id) {
                loadConnectionDetail(editItem.id);
              }
            } else {
              await api.createConnection(data);
            }
            setModal(null);
            loadConnections();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input type="text" name="name" className="form-input" required defaultValue={editItem?.name || ''} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Company</label>
              <input type="text" name="company" className="form-input" defaultValue={editItem?.company || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input type="text" name="title" className="form-input" defaultValue={editItem?.title || ''} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" name="email" className="form-input" defaultValue={editItem?.email || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input type="text" name="location" className="form-input" defaultValue={editItem?.location || ''} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Next Follow Up Date</label>
            <input type="date" name="nextFollowUpDate" className="form-input" defaultValue={editItem?.nextFollowUpDate || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Headline (LinkedIn / Professional Tagline)</label>
            <input type="text" name="headline" className="form-input" defaultValue={editItem?.headline || ''} placeholder="e.g. Senior Machine Learning Engineer" />
          </div>
          <div className="form-group">
            <label className="form-label">Profile Summary</label>
            <textarea name="profileSummary" className="form-input" rows="3" defaultValue={editItem?.profileSummary || ''} placeholder="Add a short professional bio or summary..." />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Skills (Comma-separated)</label>
              <input type="text" name="skills" className="form-input" defaultValue={editItem?.skills?.join(', ') || ''} placeholder="React, Node.js, Python" />
            </div>
            <div className="form-group">
              <label className="form-label">Profile Links (Comma-separated URLs)</label>
              <input type="text" name="externalLinks" className="form-input" defaultValue={editItem?.externalLinks?.join(', ') || ''} placeholder="github.com/user, portfolio.com" />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Connection</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Add/Edit Job Modal */ }
{
  modal === 'job' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">{editItem ? 'Edit Job Posting' : 'Track New Job'}</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          try {
            if (editItem) {
              await api.updateJob(editItem.id, data);
            } else {
              await api.createJob(data);
            }
            setModal(null);
            loadJobs();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Job Title</label>
            <input type="text" name="title" className="form-input" required defaultValue={editItem?.title || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Company Name</label>
            <input type="text" name="companyName" className="form-input" required defaultValue={editItem?.companyName || ''} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Location</label>
              <input type="text" name="location" className="form-input" defaultValue={editItem?.location || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <input type="text" name="employmentType" className="form-input" placeholder="e.g. Full-time" defaultValue={editItem?.employmentType || ''} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Job URL</label>
            <input type="url" name="url" className="form-input" defaultValue={editItem?.url || ''} />
          </div>
          <div className="form-group">
            <label className="form-label">Job Description</label>
            <textarea name="description" className="form-input" rows="3" defaultValue={editItem?.description || ''}></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Track Job</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Review & Ingest Telegram Job Modal */ }
{
  reviewJob && (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '650px' }}>
        <h2 className="card-title">Review &amp; Ingest Job</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());

          // Map skills string to array
          const skillsArray = data.skills
            ? data.skills.split(',').map(s => s.trim()).filter(Boolean)
            : [];

          try {
            await api.request(`/incoming-jobs/${reviewJob.id}/approve`, {
              method: 'POST',
              body: {
                ...data,
                skills: skillsArray
              }
            });
            setReviewJob(null);
            loadIncomingJobs();
            loadJobs();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Job Title</label>
              <input type="text" name="title" className="form-input" required defaultValue={reviewJob.parsedData?.title || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Company Name</label>
              <input type="text" name="companyName" className="form-input" required defaultValue={reviewJob.parsedData?.companyName || ''} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Location</label>
              <input type="text" name="location" className="form-input" defaultValue={reviewJob.parsedData?.location || ''} />
            </div>
            <div className="form-group">
              <label className="form-label">Job URL / Application Link</label>
              <input type="text" name="jobUrl" className="form-input" defaultValue={reviewJob.parsedData?.jobUrl || ''} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label">Employment Type</label>
              <select name="employmentType" className="form-input" defaultValue={reviewJob.parsedData?.employmentType || ''}>
                <option value="">Select Option</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Remote Type</label>
              <select name="remoteType" className="form-input" defaultValue={reviewJob.parsedData?.remoteType || ''}>
                <option value="">Select Option</option>
                <option value="remote">Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="onsite">On-site</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Experience Required</label>
              <input type="text" name="experienceLevel" className="form-input" defaultValue={reviewJob.parsedData?.experience || ''} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Skills (comma-separated)</label>
            <input type="text" name="skills" className="form-input" defaultValue={reviewJob.parsedData?.skills?.join(', ') || ''} />
          </div>

          <div className="form-group">
            <label className="form-label">Job Description / Raw Text</label>
            <textarea name="description" className="form-input" rows="5" defaultValue={reviewJob.rawText}></textarea>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setReviewJob(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Approve &amp; Import</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Application Status Update Modal */ }
{
  modal === 'application' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">Update Application Pipeline</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          const data = Object.fromEntries(formData.entries());
          try {
            await api.updateApplicationStatus(editItem.id, data.status, data.notes);
            setModal(null);
            loadApplications();
            loadDashboard();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Current Pipeline Stage</label>
            <select name="status" className="form-input" defaultValue={editItem?.status || 'saved'}>
              <option value="saved">Saved</option>
              <option value="applied">Applied</option>
              <option value="screening">Screening</option>
              <option value="interview">Interview</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Application Event Notes</label>
            <textarea name="notes" className="form-input" rows="3" placeholder="Add status notes/logs..."></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Update Status</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Log Outreach Modal */ }
{
  modal === 'outreach' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">Log Outreach for {editItem?.name}</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          try {
            await api.createOutreach(
              editItem.id,
              formData.get('status'),
              formData.get('notes'),
              formData.get('contactDate'),
              formData.get('followUpDate')
            );
            if (aiDraft?.id) {
              await api.request(`/outreach/ai-drafts/${aiDraft.id}`, {
                method: 'PATCH',
                body: { draft: formData.get('notes') }
              });
              await api.request(`/outreach/ai-drafts/${aiDraft.id}/save`, {
                method: 'POST'
              });
            }
            setModal(null);
            loadOutreach();
            loadDashboard();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Outreach Stage</label>
            <select name="status" className="form-input" defaultValue="contacted">
              <option value="not_contacted">Not Contacted</option>
              <option value="researching">Researching</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="conversation">Conversation</option>
              <option value="referral_requested">Referral Requested</option>
              <option value="referral_received">Referral Received</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Contact Date</label>
              <input type="date" name="contactDate" className="form-input" defaultValue={new Date().toISOString().split('T')[0]} />
            </div>
            <div className="form-group">
              <label className="form-label">Next Follow Up Date</label>
              <input type="date" name="followUpDate" className="form-input" />
            </div>
          </div>

          {/* AI OUTREACH ASSISTANT PANEL */}
          <div className="card-panel" style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed var(--primary-glow)', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '1.05rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', color: '#fff' }}>
              <span>🤖 AI Outreach Assistant</span>
            </h3>

            {aiError && (
              <div className="alert alert-danger" style={{ marginBottom: '12px', padding: '10px 14px', borderRadius: '6px', fontSize: '0.9rem' }}>
                {aiError}
              </div>
            )}

            {!aiDraft && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Intent</label>
                    <select
                      className="form-input"
                      value={aiIntent}
                      onChange={(e) => setAiIntent(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    >
                      <option value="referral_request">Referral Request</option>
                      <option value="guidance_request">Guidance Request</option>
                      <option value="introduction">Introduction</option>
                      <option value="networking">Networking</option>
                      <option value="follow_up">Follow Up</option>
                      <option value="thank_you">Thank You</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Tone</label>
                    <select
                      className="form-input"
                      value={aiTone}
                      onChange={(e) => setAiTone(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    >
                      <option value="professional">Professional</option>
                      <option value="friendly">Friendly</option>
                      <option value="concise">Concise</option>
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8rem' }}>Length</label>
                    <select
                      className="form-input"
                      value={aiLength}
                      onChange={(e) => setAiLength(e.target.value)}
                      style={{ padding: '6px 8px', fontSize: '0.85rem' }}
                    >
                      <option value="short">Short</option>
                      <option value="medium">Medium</option>
                    </select>
                  </div>
                </div>

                {aiWarnings.length > 0 && (
                  <div className="alert alert-warning" style={{ marginBottom: '12px', padding: '12px', borderRadius: '6px', fontSize: '0.85rem' }}>
                    <strong style={{ display: 'block', marginBottom: '4px' }}>⚠ Outreach Warning:</strong>
                    <ul style={{ margin: 0, paddingLeft: '16px' }}>
                      {aiWarnings.map((w, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{w.message}</li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      className="btn btn-warning"
                      style={{ marginTop: '8px', padding: '4px 10px', fontSize: '0.8rem', width: '100%' }}
                      onClick={() => handleGenerateAiDraft(true)}
                      disabled={aiLoading}
                    >
                      {aiLoading ? 'Generating...' : 'I Understand, Generate Anyway'}
                    </button>
                  </div>
                )}

                {aiWarnings.length === 0 && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '8px' }}
                    onClick={() => handleGenerateAiDraft(false)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Generating Draft...' : '✨ Generate AI Outreach Draft'}
                  </button>
                )}
              </div>
            )}

            {aiDraft && (
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                  <strong>Selected Intent:</strong> {aiIntent.replace('_', ' ')} &bull; <strong>Tone:</strong> {aiDraft.tone}
                </div>
                
                {aiDraft.personalizationPoints && aiDraft.personalizationPoints.length > 0 && (
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '4px' }}>Personalization factors applied:</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {aiDraft.personalizationPoints.map((p, idx) => (
                        <span key={idx} className="badge badge-success" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                          ✓ {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '6px' }}
                    onClick={() => handleGenerateAiDraft(true)}
                    disabled={aiLoading}
                  >
                    {aiLoading ? 'Regenerating...' : '🔄 Regenerate'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '6px', color: 'var(--danger)' }}
                    onClick={handleDiscardDraft}
                  >
                    Discard Draft
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">Interaction Log / Message Notes</label>
            <textarea name="notes" className="form-input" rows="3" placeholder="Message content goes here..."></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Log Outreach</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Update Outreach Modal */ }
{
  modal === 'outreach_update' && (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2 className="card-title">Update Outreach Logs</h2>
        <form onSubmit={async (e) => {
          e.preventDefault();
          const formData = new FormData(e.target);
          try {
            await api.createOutreachEvent(
              editItem.id,
              formData.get('status'),
              formData.get('notes')
            );
            setModal(null);
            loadOutreach();
            loadDashboard();
          } catch (err) {
            alert(err.message);
          }
        }}>
          <div className="form-group">
            <label className="form-label">Outreach Stage</label>
            <select name="status" className="form-input" defaultValue={editItem?.status}>
              <option value="not_contacted">Not Contacted</option>
              <option value="researching">Researching</option>
              <option value="contacted">Contacted</option>
              <option value="replied">Replied</option>
              <option value="conversation">Conversation</option>
              <option value="referral_requested">Referral Requested</option>
              <option value="referral_received">Referral Received</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Interaction Log / Message Notes</label>
            <textarea name="notes" className="form-input" rows="3"></textarea>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Update Outreach</button>
          </div>
        </form>
      </div>
    </div>
  )
}

{/* Job Detail Intelligence Modal */ }
{
  modal === 'job_detail' && (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '750px', width: '90%', maxHeight: '85vh', overflowY: 'auto' }}>
        <h2 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span>Job Workspace: {editItem?.title}</span>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span className="badge badge-info">{editItem?.status}</span>
            <button
              className="btn btn-secondary"
              style={{ padding: '4px 8px', fontSize: '0.8rem', cursor: 'pointer', border: 'none', background: 'rgba(255,255,255,0.1)' }}
              onClick={() => setModal(null)}
            >
              ✕
            </button>
          </div>
        </h2>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ color: 'var(--text-secondary)' }}>
            {editItem?.companyName} &bull; {editItem?.location}
          </div>
          {(editItem?.url || editItem?.sourceUrl) && (
            <a
              href={editItem.url || editItem.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary"
              style={{ padding: '6px 12px', fontSize: '0.85rem', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              Apply / Visit Job Posting
            </a>
          )}
        </div>

        {/* Navigation tabs inside the Job details modal */}
        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--bg-secondary)', marginBottom: '16px', paddingBottom: '8px' }}>
          <button
            className={`btn ${jobNetworkSubTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setJobNetworkSubTab('overview')}
          >
            Overview & Match
          </button>
          <button
            className={`btn ${jobNetworkSubTab === 'application' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setJobNetworkSubTab('application')}
          >
            Application Tracker
          </button>
          <button
            className={`btn ${jobNetworkSubTab === 'network' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => setJobNetworkSubTab('network')}
          >
            Referral Network Workspace
          </button>
          <button
            className={`btn ${jobNetworkSubTab === 'ai' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => { setJobNetworkSubTab('ai'); setEditingAiEnrichment(false); }}
          >
            AI Job Intelligence
          </button>
          <button
            className={`btn ${jobNetworkSubTab === 'resume_analysis' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            onClick={() => { setJobNetworkSubTab('resume_analysis'); loadResumeFitAnalysis(editItem.id); }}
          >
            AI Resume Fit
          </button>
        </div>

        {/* TAB 1: OVERVIEW & MATCH */}
        {jobNetworkSubTab === 'overview' && (
          <div>
            <div className="metrics-grid" style={{ marginBottom: '24px' }}>
              <div className="metric-card">
                <div className="metric-label">Match Score</div>
                <div className="metric-value" style={{ color: 'var(--success)' }}>{editItem?.matchScore}%</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Opportunity Score</div>
                <div className="metric-value" style={{ color: 'var(--primary)' }}>{editItem?.opportunityScore}%</div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Action Recommendation</label>
              <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', padding: '16px', borderRadius: '8px', color: '#fff', fontWeight: 600 }}>
                {editItem?.recommendedAction}
              </div>
            </div>

            <div className="form-row" style={{ gap: '24px' }}>
              <div className="form-group">
                <label className="form-label">Matched Skills</label>
                <div className="tags-list">
                  {editItem?.matchedSkills?.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>None matched</span>
                  ) : (
                    editItem?.matchedSkills?.map(s => <span key={s} className="badge badge-success">{s}</span>)
                  )}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Missing Skills</label>
                <div className="tags-list">
                  {editItem?.missingSkills?.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>None missing</span>
                  ) : (
                    editItem?.missingSkills?.map(s => <span key={s} className="badge badge-warning">{s}</span>)
                  )}
                </div>
              </div>
            </div>

            {editItem?.description && (
              <div className="form-group" style={{ marginTop: '16px' }}>
                <label className="form-label">Description</label>
                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                  {editItem.description}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: AI JOB INTELLIGENCE */}
        {jobNetworkSubTab === 'ai' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>AI Job Understanding &amp; Enrichment</h3>
              {editItem?.aiEnrichment && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                  onClick={async () => {
                    if (confirm('Re-run AI extraction? This takes a few seconds.')) {
                      try {
                        const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                        setEditItem(data.data);
                        alert('AI enrichment re-run completed!');
                      } catch (e) {
                        alert(e.message);
                      }
                    }
                  }}
                >
                  Force Re-Enrich Job
                </button>
              )}
            </div>

            {!editItem?.aiEnrichment ? (
              <div className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                <p>AI Enrichment has not run or is disabled.</p>
                <button
                  className="btn btn-primary"
                  onClick={async () => {
                    try {
                      const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                      setEditItem(data.data);
                      alert('AI Enrichment initiated!');
                    } catch (e) {
                      alert(e.message);
                    }
                  }}
                >
                  Run AI Enrichment Now
                </button>
              </div>
            ) : editItem.aiEnrichment.status === 'pending' || editItem.aiEnrichment.status === 'processing' ? (
              <div className="empty-state" style={{ padding: '24px', textAlign: 'center' }}>
                <p>AI Ingestion Monitor: Enrichment status is <strong>{editItem.aiEnrichment.status}</strong>...</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Refreshing in a few seconds.</p>
                <button
                  className="btn btn-secondary"
                  onClick={async () => {
                    const data = await api.request(`/jobs/${editItem.id}`);
                    setEditItem(data.data);
                  }}
                >
                  Refresh Status
                </button>
              </div>
            ) : editItem.aiEnrichment.status === 'failed' ? (
              <div className="empty-state" style={{ padding: '24px', border: '1px solid var(--danger)', background: 'rgba(239, 68, 68, 0.05)' }}>
                <p style={{ color: 'var(--danger)', fontWeight: 600 }}>⚠️ AI Enrichment Failed</p>
                <p style={{ fontSize: '0.85rem' }}>Error Code: <code>{editItem.aiEnrichment.errorCode}</code></p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{editItem.aiEnrichment.rawResponse}</p>
                <button
                  className="btn btn-primary"
                  style={{ marginTop: '12px' }}
                  onClick={async () => {
                    try {
                      const data = await api.request(`/jobs/${editItem.id}/ai-enrich`, { method: 'POST' });
                      setEditItem(data.data);
                    } catch (e) {
                      alert(e.message);
                    }
                  }}
                >
                  Retry Enrichment
                </button>
              </div>
            ) : (
              <div>
                {/* Display Mode or Edit Mode */}
                {!editingAiEnrichment ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Header Status Bar */}
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      padding: '12px 16px',
                      borderRadius: '8px',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{
                          display: 'inline-block',
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--success)',
                          boxShadow: '0 0 8px var(--success)'
                        }}></span>
                        <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>Enrichment Complete</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        Model: <code style={{ color: 'var(--primary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px' }}>{editItem.aiEnrichment.model}</code>
                        <span style={{ margin: '0 8px' }}>&bull;</span>
                        Latency: <strong style={{ color: '#fff' }}>{editItem.aiEnrichment.latencyMs}ms</strong>
                      </div>
                    </div>

                    {/* 2x2 Info Matrix Cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                      {/* Classification Card */}
                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Job Classification</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Role Category</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px' }}>
                              {editItem.aiEnrichment.userCorrectedRoleCategory || editItem.aiEnrichment.roleCategory || 'N/A'}
                              {editItem.aiEnrichment.userCorrectedRoleCategory && (
                                <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>Edited</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Seniority</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px', textTransform: 'capitalize' }}>
                              {editItem.aiEnrichment.userCorrectedSeniority || editItem.aiEnrichment.seniority || 'N/A'}
                              {editItem.aiEnrichment.userCorrectedSeniority && (
                                <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>Edited</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Work Type Card */}
                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px'
                      }}>
                        <h4 style={{ margin: 0, fontSize: '0.85rem', color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Position Parameters</h4>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Remote setup</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px', textTransform: 'capitalize' }}>
                              {editItem.aiEnrichment.userCorrectedRemoteType || editItem.aiEnrichment.remoteType || 'N/A'}
                              {editItem.aiEnrichment.userCorrectedRemoteType && (
                                <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>Edited</span>
                              )}
                            </div>
                          </div>

                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Employment Type</div>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem', marginTop: '2px', textTransform: 'capitalize' }}>
                              {editItem.aiEnrichment.userCorrectedEmploymentType || editItem.aiEnrichment.employmentType || 'N/A'}
                              {editItem.aiEnrichment.userCorrectedEmploymentType && (
                                <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '0.65rem' }}>Edited</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Experience and Domains */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '16px' }}>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '10px'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Required Experience</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {(editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears) !== null ? (
                            `${editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears} to ${editItem.aiEnrichment.userCorrectedExperienceMaxYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMaxYears : (editItem.aiEnrichment.experienceMaxYears || 'unspecified')} yrs`
                          ) : 'N/A'}
                        </div>
                      </div>

                      <div style={{
                        background: 'var(--bg-secondary)',
                        border: '1px solid rgba(255,255,255,0.05)',
                        padding: '16px',
                        borderRadius: '10px'
                      }}>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Target Domains</div>
                        <div className="tags-list">
                          {(editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None identified</span>
                          ) : (
                            (editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).map(d => (
                              <span key={d} className="badge badge-info" style={{ textTransform: 'capitalize' }}>{d}</span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Skills breakdown */}
                    <div style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      padding: '16px',
                      borderRadius: '10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '16px'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Required Technical Skills</div>
                        <div className="tags-list">
                          {(editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None extracted</span>
                          ) : (
                            (editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).map(s => (
                              <span key={s} className="badge badge-success" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{s}</span>
                            ))
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Preferred / Desired Skills</div>
                        <div className="tags-list">
                          {(editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>None extracted</span>
                          ) : (
                            (editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).map(s => (
                              <span key={s} className="badge badge-secondary" style={{ fontSize: '0.8rem', padding: '4px 10px' }}>{s}</span>
                            ))
                          )}
                        </div>
                      </div>
                    </div>

                    {/* AI Summary Block */}
                    <div style={{
                      borderLeft: '4px solid var(--primary)',
                      background: 'rgba(255,255,255,0.02)',
                      padding: '16px',
                      borderRadius: '0 8px 8px 0'
                    }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Role Intel Summary</div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                        "{editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || 'No summary available.'}"
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--bg-secondary)', paddingTop: '16px' }}>
                      <button className="btn btn-secondary" onClick={() => setEditingAiEnrichment(true)}>
                        Correct AI Details
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());

                    const payload = {
                      roleCategory: data.roleCategory,
                      seniority: data.seniority,
                      remoteType: data.remoteType,
                      employmentType: data.employmentType,
                      experienceMinYears: data.experienceMinYears ? parseInt(data.experienceMinYears) : null,
                      experienceMaxYears: data.experienceMaxYears ? parseInt(data.experienceMaxYears) : null,
                      requiredSkills: data.requiredSkills ? data.requiredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
                      preferredSkills: data.preferredSkills ? data.preferredSkills.split(',').map(s => s.trim()).filter(Boolean) : [],
                      domain: data.domain ? data.domain.split(',').map(s => s.trim()).filter(Boolean) : [],
                      summary: data.summary
                    };

                    try {
                      const refreshed = await api.request(`/jobs/${editItem.id}/ai-corrections`, {
                        method: 'PUT',
                        body: payload
                      });
                      setEditItem(refreshed.data);
                      setEditingAiEnrichment(false);
                      loadJobs();
                    } catch (err) {
                      alert(err.message);
                    }
                  }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Role Category</label>
                        <input type="text" name="roleCategory" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRoleCategory || editItem.aiEnrichment.roleCategory || ''} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Seniority</label>
                        <input type="text" name="seniority" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedSeniority || editItem.aiEnrichment.seniority || ''} />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Remote Type</label>
                        <select name="remoteType" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRemoteType || editItem.aiEnrichment.remoteType || ''}>
                          <option value="">Choose remote preference...</option>
                          <option value="remote">Remote</option>
                          <option value="hybrid">Hybrid</option>
                          <option value="onsite">Onsite</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Employment Type</label>
                        <select name="employmentType" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedEmploymentType || editItem.aiEnrichment.employmentType || ''}>
                          <option value="">Choose employment...</option>
                          <option value="full-time">Full-time</option>
                          <option value="part-time">Part-time</option>
                          <option value="contract">Contract</option>
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Required Skills (comma separated)</label>
                        <input type="text" name="requiredSkills" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedRequiredSkills || editItem.aiEnrichment.requiredSkills || []).join(', ')} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Preferred Skills (comma separated)</label>
                        <input type="text" name="preferredSkills" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedPreferredSkills || editItem.aiEnrichment.preferredSkills || []).join(', ')} />
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Min Experience (Years)</label>
                        <input type="number" name="experienceMinYears" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedExperienceMinYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMinYears : editItem.aiEnrichment.experienceMinYears || ''} />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Max Experience (Years)</label>
                        <input type="number" name="experienceMaxYears" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedExperienceMaxYears !== null ? editItem.aiEnrichment.userCorrectedExperienceMaxYears : editItem.aiEnrichment.experienceMaxYears || ''} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Domains / Industry Keywords (comma separated)</label>
                      <input type="text" name="domain" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedDomain || editItem.aiEnrichment.domain || []).join(', ')} />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Summary</label>
                      <textarea name="summary" className="form-input" rows="3" defaultValue={editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || ''}></textarea>
                    </div>

                    <div className="modal-actions">
                      <button type="button" className="btn btn-secondary" onClick={() => setEditingAiEnrichment(false)}>Cancel</button>
                      <button type="submit" className="btn btn-primary">Save Corrections</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        )}


        {jobNetworkSubTab === 'resume_analysis' && (
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '16px' }}>AI Resume ↔ Job Fit Analysis</h3>

            {loadingResumeAnalysis ? (
              <div className="empty-state" style={{ padding: '32px', textAlign: 'center' }}>
                <p>Generating alignment analysis...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Compatibility Rating Card */}
                <div style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  padding: '20px',
                  borderRadius: '10px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Compatibility Assessment</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 800, textTransform: 'capitalize', color: resumeAnalysis?.compatibilityAssessment === 'high' ? 'var(--success)' : resumeAnalysis?.compatibilityAssessment === 'medium' ? '#f59e0b' : 'var(--danger)' }}>
                      {resumeAnalysis?.compatibilityAssessment || 'unknown'}
                    </div>
                  </div>
                  <button
                    className="btn btn-secondary"
                    onClick={() => loadResumeFitAnalysis(editItem.id)}
                  >
                    Re-Analyze Fit
                  </button>
                </div>

                {/* Summary Bio */}
                <div style={{ borderLeft: '4px solid var(--primary)', background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '0 8px 8px 0' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Analysis Summary</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 }}>
                    {resumeAnalysis?.analysisSummary}
                  </p>
                </div>

                {/* Matched vs Missing Skills */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Matched Skills</div>
                    <div className="tags-list">
                      {(resumeAnalysis?.matchedSkills || []).length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No matching skills detected</span>
                      ) : (
                        (resumeAnalysis.matchedSkills || []).map(s => (
                          <span key={s} className="badge badge-success">{s}</span>
                        ))
                      )}
                    </div>
                  </div>

                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Potential Gaps / Missing Skills</div>
                    <div className="tags-list">
                      {(resumeAnalysis?.missingSkills || []).length === 0 ? (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No gaps detected</span>
                      ) : (
                        (resumeAnalysis.missingSkills || []).map(s => (
                          <span key={s} className="badge badge-danger">{s}</span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Strengths List */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Core Alignment Strengths</div>
                  {(resumeAnalysis?.strengths || []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No key strengths highlighted yet.</div>
                  ) : (
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {(resumeAnalysis.strengths || []).map((str, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{str}</li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Gaps List */}
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', padding: '16px', borderRadius: '10px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>Areas of Improvement / Growth</div>
                  {(resumeAnalysis?.potentialGaps || []).length === 0 ? (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No potential gaps highlighted.</div>
                  ) : (
                    <ul style={{ margin: '4px 0 0 16px', padding: 0, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                      {(resumeAnalysis.potentialGaps || []).map((gap, idx) => (
                        <li key={idx} style={{ marginBottom: '4px' }}>{gap}</li>
                      ))}
                    </ul>
                  )}
                </div>

              </div>
            )}
          </div>
        )}

        {/* TAB 2: APPLICATION LIFE CYCLE TRACKER */}
        {jobNetworkSubTab === 'application' && (
          <div>
            {!editItem?.application ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Start Tracking Application</h3>
                <form onSubmit={async (e) => {
                  e.preventDefault();
                  const formData = new FormData(e.target);
                  const data = Object.fromEntries(formData.entries());
                  try {
                    await api.createApplication(editItem.id, data.status, {
                      resumeId: data.resumeId || null,
                      coverLetter: data.coverLetter || '',
                      referralConnectionId: data.referralConnectionId || null,
                      notes: data.notes || '',
                      nextFollowUpDate: data.nextFollowUpDate || null
                    });
                    const updated = await api.request(`/jobs/${editItem.id}`);
                    setEditItem(updated.data);
                    loadJobs();
                    alert('Application tracker initialized!');
                  } catch (err) {
                    alert(err.message);
                  }
                }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select name="status" className="form-input" defaultValue="saved">
                        <option value="saved">Saved</option>
                        <option value="applying">Applying</option>
                        <option value="applied">Applied</option>
                        <option value="recruiter_contact">Recruiter Contact</option>
                        <option value="screening">Screening</option>
                        <option value="interview">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Resume Used</label>
                      <select name="resumeId" className="form-input">
                        <option value="">No Resume Linked</option>
                        {resumes.map(r => <option key={r.id} value={r.id}>{r.fileName}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Referral Connection</label>
                      <select name="referralConnectionId" className="form-input">
                        <option value="">No Referral</option>
                        {connections.filter(c => c.company?.toLowerCase().includes(editItem.companyName?.toLowerCase())).map(c => (
                          <option key={c.id} value={c.id}>{c.name} ({c.title})</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Next Follow Up Date</label>
                      <input type="date" name="nextFollowUpDate" className="form-input" />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Cover Letter</label>
                    <textarea name="coverLetter" className="form-input" rows="3" placeholder="Paste cover letter used..."></textarea>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Initial Notes</label>
                    <textarea name="notes" className="form-input" rows="3" placeholder="Initial thoughts, referral requests, etc..."></textarea>
                  </div>

                  <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Initialize Application</button>
                </form>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                {/* Left Column: Update Form */}
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Application Details</h3>
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    try {
                      await api.updateApplication(editItem.application.id, {
                        status: data.status,
                        resumeId: data.resumeId || null,
                        coverLetter: data.coverLetter || '',
                        referralConnectionId: data.referralConnectionId || null,
                        notes: data.notes || '',
                        nextFollowUpDate: data.nextFollowUpDate || null
                      });
                      const updated = await api.request(`/jobs/${editItem.id}`);
                      setEditItem(updated.data);
                      loadJobs();
                      alert('Application details updated!');
                    } catch (err) {
                      alert(err.message);
                    }
                  }}>
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Status</label>
                        <select name="status" className="form-input" defaultValue={editItem.application.status}>
                          <option value="saved">Saved</option>
                          <option value="applying">Applying</option>
                          <option value="applied">Applied</option>
                          <option value="recruiter_contact">Recruiter Contact</option>
                          <option value="screening">Screening</option>
                          <option value="interview">Interview</option>
                          <option value="offer">Offer</option>
                          <option value="accepted">Accepted</option>
                          <option value="rejected">Rejected</option>
                          <option value="withdrawn">Withdrawn</option>
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Resume Used</label>
                        <select name="resumeId" className="form-input" defaultValue={editItem.application.resumeId || ''}>
                          <option value="">No Resume Linked</option>
                          {resumes.map(r => <option key={r.id} value={r.id}>{r.fileName}</option>)}
                        </select>
                      </div>
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Referral Connection</label>
                        <select name="referralConnectionId" className="form-input" defaultValue={editItem.application.referralConnectionId || ''}>
                          <option value="">No Referral</option>
                          {connections.filter(c => c.company?.toLowerCase().includes(editItem.companyName?.toLowerCase())).map(c => (
                            <option key={c.id} value={c.id}>{c.name} ({c.title})</option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Next Follow Up Date</label>
                        <input type="date" name="nextFollowUpDate" className="form-input" defaultValue={editItem.application.nextFollowUpDate || ''} />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Cover Letter</label>
                      <textarea name="coverLetter" className="form-input" rows="3" defaultValue={editItem.application.coverLetter || ''}></textarea>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Notes</label>
                      <textarea name="notes" className="form-input" rows="3" defaultValue={editItem.application.notes || ''}></textarea>
                    </div>

                    <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Save Updates</button>
                  </form>
                </div>

                {/* Right Column: Timeline & Add Event */}
                <div style={{ borderLeft: '1px solid var(--bg-secondary)', paddingLeft: '24px' }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '16px' }}>Application Timeline</h3>

                  {/* Visual Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '180px', overflowY: 'auto', marginBottom: '24px', paddingRight: '8px' }}>
                    {(!editItem.application.events || editItem.application.events.length === 0) ? (
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No timeline events recorded.</div>
                    ) : (
                      editItem.application.events.map((ev, index) => (
                        <div key={ev.id || index} style={{ display: 'flex', gap: '12px', position: 'relative' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--primary)', marginTop: '4px' }}></div>
                            {index < editItem.application.events.length - 1 && (
                              <div style={{ width: '2px', flexGrow: 1, background: 'var(--bg-secondary)', margin: '4px 0' }}></div>
                            )}
                          </div>
                          <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {new Date(ev.occurredAt).toLocaleDateString()}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: '0.85rem', textTransform: 'capitalize' }}>
                              {ev.eventType.replace('_', ' ')}: <span className="badge badge-info">{ev.status}</span>
                            </div>
                            {ev.notes && (
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px', fontStyle: 'italic' }}>
                                "{ev.notes}"
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Custom Event Form */}
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    const data = Object.fromEntries(formData.entries());
                    try {
                      await api.createApplicationEvent(editItem.application.id, {
                        eventType: data.eventType,
                        status: data.status,
                        notes: data.notes
                      });
                      const updated = await api.request(`/jobs/${editItem.id}`);
                      setEditItem(updated.data);
                      e.target.reset();
                      alert('Timeline event added!');
                    } catch (err) {
                      alert(err.message);
                    }
                  }} style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px' }}>
                    <h4 style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px' }}>Add Timeline Event</h4>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Event Type</label>
                      <select name="eventType" className="form-input" style={{ padding: '6px', fontSize: '0.8rem' }} defaultValue="interview_scheduled">
                        <option value="application_submitted">Application Submitted</option>
                        <option value="recruiter_contacted">Recruiter Contacted</option>
                        <option value="referral_requested">Referral Requested</option>
                        <option value="referral_received">Referral Received</option>
                        <option value="interview_scheduled">Interview Scheduled</option>
                        <option value="interview_completed">Interview Completed</option>
                        <option value="offer_received">Offer Received</option>
                        <option value="rejected">Rejected</option>
                        <option value="withdrawn">Withdrawn</option>
                        <option value="follow_up">Follow Up</option>
                        <option value="note">Note / Event</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Associated Stage</label>
                      <select name="status" className="form-input" style={{ padding: '6px', fontSize: '0.8rem' }} defaultValue={editItem.application.status}>
                        <option value="saved">Saved</option>
                        <option value="applying">Applying</option>
                        <option value="applied">Applied</option>
                        <option value="recruiter_contact">Recruiter Contact</option>
                        <option value="screening">Screening</option>
                        <option value="interview">Interview</option>
                        <option value="offer">Offer</option>
                        <option value="accepted">Accepted</option>
                        <option value="rejected">Rejected</option>
                        <option value="withdrawn">Withdrawn</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: '8px' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem' }}>Event Notes</label>
                      <input type="text" name="notes" className="form-input" style={{ padding: '6px', fontSize: '0.8rem' }} placeholder="e.g. Round 1 Technical round" />
                    </div>
                    <button type="submit" className="btn btn-secondary" style={{ width: '100%', padding: '6px', fontSize: '0.8rem' }}>Log Event</button>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REFERRAL NETWORK WORKSPACE */}
        {jobNetworkSubTab === 'network' && (
          <div>
            {jobNetworkLoading ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Loading referral candidates...</div>
            ) : (
              <div>
                {/* Summary Metrics */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)' }}>
                      {jobNetworkDetails?.summary?.totalConnections || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Connections</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--success)' }}>
                      {jobNetworkDetails?.summary?.relevantConnections || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Relevant</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--warning)' }}>
                      {jobNetworkDetails?.summary?.highPotential || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>High Potential</div>
                  </div>
                  <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#fff' }}>
                      {jobNetworkDetails?.summary?.recruiters || 0}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Recruiters</div>
                  </div>
                </div>

                {/* Filters Bar */}
                <div style={{ background: 'var(--bg-secondary)', padding: '12px', borderRadius: '8px', marginBottom: '16px', display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flexGrow: 1 }}>
                    <select
                      className="form-input"
                      style={{ padding: '6px', fontSize: '0.8rem', minWidth: '110px' }}
                      value={jobNetworkFilters.roleCategory}
                      onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, roleCategory: e.target.value, page: 1 })}
                    >
                      <option value="">All Roles</option>
                      <option value="engineering">Engineering Only</option>
                      <option value="other">Other Roles</option>
                    </select>

                    <select
                      className="form-input"
                      style={{ padding: '6px', fontSize: '0.8rem', minWidth: '110px' }}
                      value={jobNetworkFilters.seniority}
                      onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, seniority: e.target.value, page: 1 })}
                    >
                      <option value="">All Seniorities</option>
                      <option value="senior">Senior</option>
                      <option value="lead">Lead</option>
                      <option value="manager">Manager</option>
                      <option value="director">Director</option>
                      <option value="executive">Executive</option>
                      <option value="founder">Founder</option>
                    </select>

                    <select
                      className="form-input"
                      style={{ padding: '6px', fontSize: '0.8rem', minWidth: '110px' }}
                      value={jobNetworkFilters.relationshipStatus}
                      onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, relationshipStatus: e.target.value, page: 1 })}
                    >
                      <option value="">All Statuses</option>
                      <option value="not_contacted">Not Contacted</option>
                      <option value="researching">Researching</option>
                      <option value="contacted">Contacted</option>
                      <option value="replied">Replied</option>
                      <option value="conversation">Conversation</option>
                      <option value="referral_requested">Referral Requested</option>
                      <option value="referral_received">Referral Received</option>
                    </select>

                    <select
                      className="form-input"
                      style={{ padding: '6px', fontSize: '0.8rem', minWidth: '110px' }}
                      value={jobNetworkFilters.priority}
                      onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, priority: e.target.value, page: 1 })}
                    >
                      <option value="">All Priorities</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sort:</span>
                    <select
                      className="form-input"
                      style={{ padding: '6px', fontSize: '0.8rem', minWidth: '130px' }}
                      value={jobNetworkFilters.sortBy}
                      onChange={(e) => setJobNetworkFilters({ ...jobNetworkFilters, sortBy: e.target.value, page: 1 })}
                    >
                      <option value="referralScore">Referral Score</option>
                      <option value="connectionScore">Connection Score</option>
                      <option value="seniority">Seniority</option>
                      <option value="relationshipStrength">Strength</option>
                      <option value="lastContactedDate">Last Contacted</option>
                    </select>
                  </div>
                </div>

                {/* Recommended Actions */}
                {jobNetworkDetails?.candidates?.length > 0 && (
                  <div style={{ background: 'var(--primary-glow)', border: '1px solid var(--primary)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--primary)', marginBottom: '6px' }}>⭐ Recommended Workspace Actions</div>
                    <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.8rem', color: '#fff' }}>
                      {jobNetworkDetails.candidates.slice(0, 3).map((candidate, idx) => {
                        let action = 'Research relationship details';
                        if (candidate.relationshipStatus === 'not_contacted') {
                          action = `Initiate outreach to request a referral for this ${editItem?.title} role`;
                        } else if (candidate.relationshipStatus === 'contacted') {
                          action = 'Follow up to see if they received your request';
                        } else if (candidate.relationshipStatus === 'referral_received') {
                          action = 'Proceed with submitting application on company portal';
                        }
                        return (
                          <li key={idx} style={{ marginBottom: '4px' }}>
                            <strong>Contact {candidate.connection.name}</strong>: {action}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                {/* Candidates List */}
                {jobNetworkDetails?.candidates?.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-secondary)', borderRadius: '8px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                    No referral candidates match your filter criteria at {editItem?.companyName}.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {jobNetworkDetails?.candidates?.map((candidate) => (
                      <div
                        key={candidate.connection.id}
                        style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderLeft: '4px solid var(--primary)' }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#fff' }}>{candidate.connection.name}</span>
                            <span className={`badge ${candidate.relationshipStatus === 'not_contacted' ? 'badge-info' : 'badge-success'}`} style={{ fontSize: '0.75rem' }}>
                              {candidate.relationshipStatus.replace('_', ' ')}
                            </span>
                            {candidate.priority && candidate.priority !== 'none' && (
                              <span className="badge badge-warning" style={{ fontSize: '0.75rem' }}>{candidate.priority} priority</span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                            {candidate.connection.title} &bull; {candidate.connection.company}
                          </div>
                          {/* Explainable scoring reasons */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' }}>
                            {candidate.reasons?.map((reason, ridx) => (
                              <span key={ridx} style={{ fontSize: '0.75rem', background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '4px', color: 'var(--primary)' }}>
                                ✓ {reason}
                              </span>
                            ))}
                          </div>
                          {/* AI Matching Evidence */}
                          {candidate.aiEvidence && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {candidate.aiEvidence.skillAlignment.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  💡 <strong style={{ color: 'var(--success)' }}>AI Skill Match:</strong> {candidate.aiEvidence.skillAlignment.join(', ')}
                                </div>
                              )}
                              {candidate.aiEvidence.domainAlignment.length > 0 && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  🌐 <strong style={{ color: 'var(--primary)' }}>AI Domain Match:</strong> {candidate.aiEvidence.domainAlignment.join(', ')}
                                </div>
                              )}
                              {candidate.aiEvidence.roleAlignment !== 'neutral' && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  👔 <strong>AI Role Alignment:</strong> <span style={{ textTransform: 'capitalize', color: candidate.aiEvidence.roleAlignment === 'strong' ? 'var(--success)' : '#f59e0b' }}>{candidate.aiEvidence.roleAlignment}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                           <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                             <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Score:</span>
                             <span style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)' }}>
                               {candidate.referralScore}
                             </span>
                           </div>
                           {candidate.semanticSimilarity !== undefined && (
                             <div style={{ fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                               Relevance: {Math.round(candidate.semanticSimilarity * 100)}%
                             </div>
                           )}
                         </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              className="btn btn-secondary"
                              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={async () => {
                                try {
                                  const res = await api.request(`/connections/${candidate.connection.id}`);
                                  setEditItem(res.data);
                                  setModal('connection_detail');
                                } catch (err) {
                                  alert(err.message);
                                }
                              }}
                            >
                              View CRM
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                              onClick={() => {
                                setEditItem({
                                  ...candidate.connection,
                                  job_id: editItem.id // pass selected job_id context
                                });
                                setModal('outreach');
                              }}
                            >
                              Log Outreach
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => { setModal(null); setJobNetworkSubTab('overview'); }}>Close Intel</button>
        </div>
      </div>
    </div>
  )
}

{/* Connection Detail CRM Modal */ }
{
  modal === 'connection_detail' && (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h2 className="card-title">🤝 Connection Intel: {editItem?.name}</h2>
        <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{editItem?.title || 'No Title'} at {editItem?.company || 'Unknown Company'}</div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Relationship Details</label>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem' }}>
              <div>Strength: <strong style={{ color: 'var(--warning)' }}>{editItem?.relationshipStrength || 'Not Rated'}</strong></div>
              <div style={{ marginTop: '4px' }}>Status: <strong>{editItem?.relationshipStatus || 'Not Contacted'}</strong></div>
              <div style={{ marginTop: '4px' }}>Follow-up Date: <strong>{editItem?.followUpDate || 'None scheduled'}</strong></div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">CRM Notes</label>
            <div style={{ background: 'var(--bg-tertiary)', padding: '12px', borderRadius: '8px', fontSize: '0.9rem', minHeight: '80px', maxHeight: '120px', overflowY: 'auto' }}>
              {editItem?.notes || 'No relationship notes logged.'}
            </div>
          </div>
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">Referral Opportunities at {editItem?.company || 'their company'}</label>
          {editItem?.referralOpportunities?.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No active tracked jobs found at {editItem?.company}.</div>
          ) : (
            <div className="activity-list">
              {editItem?.referralOpportunities?.map(opp => (
                <div className="activity-item" key={opp.jobId} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{opp.jobTitle}</div>
                  </div>
                  <span className="badge badge-success">Referral Match: {opp.referralScore}%</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="form-group" style={{ marginTop: '16px' }}>
          <label className="form-label">Outreach & Communications History</label>
          {editItem?.outreachHistory?.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No outreach history logged yet.</div>
          ) : (
            <div className="timeline" style={{ paddingLeft: '10px', marginTop: '10px' }}>
              {editItem?.outreachHistory?.map(event => (
                <div className="timeline-event" key={event.id} style={{ fontSize: '0.85rem' }}>
                  <strong>{event.status}</strong> &bull; {new Date(event.occurredAt).toLocaleDateString()}
                  <p style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>{event.notes || 'No description'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI Professional Profile Panel */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>🤖 AI Professional Profile</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {editItem?.aiEnrichment && (
                <button
                  className="btn btn-secondary"
                  style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                  onClick={() => setEditingConnectionAi(!editingConnectionAi)}
                >
                  {editingConnectionAi ? 'Cancel Edit' : 'Correct AI Output'}
                </button>
              )}
              <button
                className="btn btn-primary"
                style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                disabled={loadingConnectionAi}
                onClick={() => handleEnrichConnectionAi(editItem.id)}
              >
                {loadingConnectionAi ? 'Analyzing...' : editItem?.aiEnrichment ? 'Re-Run AI' : 'Run AI Enrichment'}
              </button>
            </div>
          </div>

          {!editItem?.aiEnrichment ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
              No AI profile generated for this connection yet. Click "Run AI Enrichment" to analyze their profile.
            </div>
          ) : editingConnectionAi ? (
            /* Human corrections form */
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const fd = new FormData(e.target);
                const parsedTech = fd.get('technologies').split(',').map(t => t.trim()).filter(Boolean);
                const parsedTechDomains = fd.get('technicalDomains').split(',').map(d => d.trim()).filter(Boolean);
                const parsedIndDomains = fd.get('industryDomains').split(',').map(d => d.trim()).filter(Boolean);
                const parsedExpertise = fd.get('expertiseAreas').split(',').map(d => d.trim()).filter(Boolean);

                await handleSaveConnectionAiCorrections(editItem.id, {
                  professionalRole: fd.get('professionalRole'),
                  roleFamily: fd.get('roleFamily'),
                  careerLevel: fd.get('careerLevel'),
                  leadershipLevel: fd.get('leadershipLevel'),
                  technologies: parsedTech,
                  technicalDomains: parsedTechDomains,
                  industryDomains: parsedIndDomains,
                  expertiseAreas: parsedExpertise,
                  summary: fd.get('summary')
                });
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px' }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Professional Role</label>
                  <input type="text" name="professionalRole" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedProfessionalRole || editItem.aiEnrichment.professionalRole || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Role Family</label>
                  <input type="text" name="roleFamily" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedRoleFamily || editItem.aiEnrichment.roleFamily || ''} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Career Level</label>
                  <input type="text" name="careerLevel" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedCareerLevel || editItem.aiEnrichment.careerLevel || ''} />
                </div>
                <div className="form-group">
                  <label className="form-label" style={{ fontSize: '0.8rem' }}>Leadership Level</label>
                  <input type="text" name="leadershipLevel" className="form-input" defaultValue={editItem.aiEnrichment.userCorrectedLeadershipLevel || editItem.aiEnrichment.leadershipLevel || ''} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Technologies (comma separated)</label>
                <input type="text" name="technologies" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).join(', ')} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Technical Domains (comma separated)</label>
                <input type="text" name="technicalDomains" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).join(', ')} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Industry Domains (comma separated)</label>
                <input type="text" name="industryDomains" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).join(', ')} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Expertise Areas (comma separated)</label>
                <input type="text" name="expertiseAreas" className="form-input" defaultValue={(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).join(', ')} />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Summary</label>
                <textarea name="summary" className="form-input" rows="2" defaultValue={editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || ''}></textarea>
              </div>

              <button type="submit" className="btn btn-primary" style={{ alignSelf: 'flex-end', padding: '6px 12px', fontSize: '0.85rem' }}>Save Corrections</button>
            </form>
          ) : (
            /* AI Display View */
            <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', fontSize: '0.85rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Professional Role</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedProfessionalRole || editItem.aiEnrichment.professionalRole || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Role Family</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedRoleFamily || editItem.aiEnrichment.roleFamily || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Career Level</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedCareerLevel || editItem.aiEnrichment.careerLevel || 'N/A'}</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Leadership Level</div>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{editItem.aiEnrichment.userCorrectedLeadershipLevel || editItem.aiEnrichment.leadershipLevel || 'N/A'}</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>AI Confidence</div>
                  <div style={{ fontWeight: 600, color: 'var(--primary)' }}>{Math.round((editItem.aiEnrichment.confidence || 0) * 100)}%</div>
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase' }}>Status</div>
                  <div style={{ fontWeight: 600, textTransform: 'capitalize', color: editItem.aiEnrichment.status === 'completed' ? 'var(--success)' : editItem.aiEnrichment.status === 'failed' ? 'var(--danger)' : 'var(--warning)' }}>{editItem.aiEnrichment.status}</div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Technologies</div>
                <div className="tags-list">
                  {(editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>None</span>
                  ) : (
                    (editItem.aiEnrichment.userCorrectedTechnologies || editItem.aiEnrichment.technologies || []).map(t => (
                      <span key={t} className="badge badge-secondary" style={{ fontSize: '0.75rem' }}>{t}</span>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Technical Domains</div>
                <div className="tags-list">
                  {(editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>None</span>
                  ) : (
                    (editItem.aiEnrichment.userCorrectedTechnicalDomains || editItem.aiEnrichment.technicalDomains || []).map(d => (
                      <span key={d} className="badge" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', fontSize: '0.75rem' }}>{d}</span>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Industry Domains</div>
                <div className="tags-list">
                  {(editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>None</span>
                  ) : (
                    (editItem.aiEnrichment.userCorrectedIndustryDomains || editItem.aiEnrichment.industryDomains || []).map(d => (
                      <span key={d} className="badge" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', fontSize: '0.75rem' }}>{d}</span>
                    ))
                  )}
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>Expertise Areas</div>
                <ul style={{ margin: '4px 0 0 16px', padding: 0, color: 'var(--text-secondary)' }}>
                  {(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).map((exp, idx) => (
                    <li key={idx} style={{ marginBottom: '2px' }}>{exp}</li>
                  ))}
                  {(editItem.aiEnrichment.userCorrectedExpertiseAreas || editItem.aiEnrichment.expertiseAreas || []).length === 0 && (
                    <li style={{ listStyleType: 'none', marginLeft: '-16px', color: 'var(--text-muted)' }}>None logged</li>
                  )}
                </ul>
              </div>

              <div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '4px' }}>AI Career Summary</div>
                <p style={{ margin: 0, lineHeight: 1.4, color: 'var(--text-secondary)' }}>{editItem.aiEnrichment.userCorrectedSummary || editItem.aiEnrichment.summary || 'No summary available.'}</p>
              </div>
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
          <label className="form-label" style={{ fontWeight: 600 }}>Enrich Profile via LinkedIn PDF</label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '8px' }}>
            <input
              type="file"
              accept=".pdf"
              className="form-input"
              style={{ maxWidth: '300px' }}
              onChange={async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                setEnrichmentLoading(true);
                setEnrichmentError(null);
                setModal('linkedin_pdf');
                try {
                  const objectUrl = URL.createObjectURL(file);
                  setPdfObjectURL(objectUrl);
                  const res = await api.importLinkedInPdf(file);
                  setEnrichmentPreview(res.data);
                } catch (err) {
                  setEnrichmentError(err.message || 'Failed to parse PDF profile.');
                } finally {
                  setEnrichmentLoading(false);
                }
              }}
            />
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Upload PDF to update skills, headline, summary.</span>
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: '24px' }}>
          <button className="btn btn-secondary" onClick={() => setModal(null)}>Close Intel</button>
        </div>
      </div>
    </div>
  )
}

{
  modal === 'linkedin_pdf' && (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: pdfObjectURL ? '1100px' : '650px', width: '95%', transition: 'max-width 0.3s ease' }}>
        <h2 className="modal-title">LinkedIn PDF Profile Enrichment</h2>

        {enrichmentLoading && (
          <div className="empty-state">
            <p>Uploading and parsing LinkedIn PDF...</p>
          </div>
        )}

        {enrichmentError && (
          <div className="empty-state" style={{ color: 'var(--danger)' }}>
            <p>Error: {enrichmentError}</p>
            <button className="btn btn-secondary" style={{ marginTop: '12px' }} onClick={() => setEnrichmentError(null)}>
              Try Again
            </button>
          </div>
        )}

        {!enrichmentLoading && !enrichmentError && !enrichmentPreview && (
          <form onSubmit={async (e) => {
            e.preventDefault();
            const file = e.target.elements.pdfFile.files[0];
            if (!file) return alert('Please select a file.');
            setEnrichmentLoading(true);
            setEnrichmentError(null);
            try {
              const objectUrl = URL.createObjectURL(file);
              setPdfObjectURL(objectUrl);
              const res = await api.importLinkedInPdf(file);
              setEnrichmentPreview(res.data);
            } catch (err) {
              setEnrichmentError(err.message || 'Failed to parse PDF profile.');
            } finally {
              setEnrichmentLoading(false);
            }
          }}>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
              Upload a LinkedIn profile PDF to match against existing network contacts and enrich their profile summary, headline, or skill arrays.
            </p>
            <div className="form-group">
              <label className="form-label">Select LinkedIn PDF Export</label>
              <input type="file" name="pdfFile" className="form-input" accept=".pdf" required />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeEnrichmentModal}>Cancel</button>
              <button type="submit" className="btn btn-primary">Parse PDF</button>
            </div>
          </form>
        )}

        {!enrichmentLoading && !enrichmentError && enrichmentPreview && (
          <div style={{ display: 'flex', gap: '24px', flexDirection: pdfObjectURL ? 'row' : 'column', alignItems: 'stretch', marginTop: '16px' }}>
            {pdfObjectURL && (
              <div style={{ flex: 1.2, minWidth: '350px', background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '12px', display: 'flex', flexDirection: 'column' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '12px' }}>Uploaded Profile PDF</h3>
                <iframe src={pdfObjectURL} width="100%" height="450px" style={{ border: 'none', borderRadius: '6px', background: '#fff' }}></iframe>
              </div>
            )}

            <div style={{ flex: 1, minWidth: '300px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>
                Profile Extracted: <span style={{ color: 'var(--primary)' }}>{enrichmentPreview.parsed.name}</span>
              </h3>

              <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '8px', marginBottom: '20px', fontSize: '0.9rem' }}>
                {enrichmentPreview.parsed.headline && <div><strong>Headline:</strong> {enrichmentPreview.parsed.headline}</div>}
                {enrichmentPreview.parsed.email && <div style={{ marginTop: '6px' }}><strong>Email:</strong> {enrichmentPreview.parsed.email}</div>}
                {enrichmentPreview.parsed.profileUrl && <div style={{ marginTop: '6px' }}><strong>LinkedIn URL:</strong> <a href={enrichmentPreview.parsed.profileUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)' }}>{enrichmentPreview.parsed.profileUrl}</a></div>}
                {enrichmentPreview.parsed.skills && <div style={{ marginTop: '6px' }}><strong>Skills Extracted:</strong> {enrichmentPreview.parsed.skills.join(', ')}</div>}
              </div>

              {enrichmentPreview.matched.length > 0 ? (
                <div style={{ border: '1px solid var(--warning)', background: 'var(--warning-glow)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--warning)', fontWeight: 700, marginBottom: '8px' }}>Existing Contact Matched</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    We found a matched profile in your CRM network: <strong>{enrichmentPreview.matched[0].name}</strong> at <strong>{enrichmentPreview.matched[0].company || 'No Company'}</strong> ({enrichmentPreview.matched[0].title || 'No Title'}).
                  </p>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    <button className="btn btn-primary" onClick={async () => {
                      setEnrichmentLoading(true);
                      try {
                        await api.confirmEnrichment({
                          action: 'enrich',
                          parsed: enrichmentPreview.parsed,
                          connectionId: enrichmentPreview.matched[0].id
                        });
                        alert('Connection enriched successfully!');
                        closeEnrichmentModal();
                        loadConnections();
                      } catch (err) {
                        alert(err.message);
                      } finally {
                        setEnrichmentLoading(false);
                      }
                    }}>
                      Enrich Matched Contact
                    </button>
                    <button className="btn btn-secondary" onClick={async () => {
                      if (confirm('Create a new duplicate connection anyway?')) {
                        setEnrichmentLoading(true);
                        try {
                          await api.confirmEnrichment({
                            action: 'create',
                            parsed: enrichmentPreview.parsed
                          });
                          alert('New duplicate connection created!');
                          closeEnrichmentModal();
                          loadConnections();
                        } catch (err) {
                          alert(err.message);
                        } finally {
                          setEnrichmentLoading(false);
                        }
                      }
                    }}>
                      Import as New Instead
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ border: '1px solid var(--success)', background: 'var(--primary-glow)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                  <h4 style={{ color: 'var(--success)', fontWeight: 700, marginBottom: '8px' }}>No matches found</h4>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                    This profile does not match any existing contacts in your CRM. Do you want to import them as a new connection?
                  </p>
                  <button className="btn btn-primary" onClick={async () => {
                    setEnrichmentLoading(true);
                    try {
                      await api.confirmEnrichment({
                        action: 'create',
                        parsed: enrichmentPreview.parsed
                      });
                      alert('New contact imported successfully!');
                      closeEnrichmentModal();
                      loadConnections();
                    } catch (err) {
                      alert(err.message);
                    } finally {
                      setEnrichmentLoading(false);
                    }
                  }}>
                    Create New Connection
                  </button>
                </div>
              )}

              <div className="modal-actions">
                <button className="btn btn-secondary" onClick={closeEnrichmentModal}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

{
  showSaveViewModal && (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <h2 className="modal-title">Save Connection Segment View</h2>
        <div className="form-group">
          <label className="form-label">View Name</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Google Recruiters"
            value={newViewName}
            onChange={(e) => setNewViewName(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Description (Optional)</label>
          <textarea
            className="form-input"
            rows="3"
            placeholder="Senior Engineering Recruiters in SF"
            value={newViewDesc}
            onChange={(e) => setNewViewDesc(e.target.value)}
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setShowSaveViewModal(false)}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSaveView}>Save View</button>
        </div>
      </div>
    </div>
  )
}

    </div >
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
