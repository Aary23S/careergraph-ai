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

  // Connection detail states
  const [activeConnectionId, setActiveConnectionId] = useState(null);
  const [connectionDetail, setConnectionDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [newTagText, setNewTagText] = useState('');

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

  // Reload data when active tab changes or filters change
  useEffect(() => {
    if (isAuthenticated) {
      if (activeTab === 'dashboard') loadDashboard();
      if (activeTab === 'profile') loadProfile();
      if (activeTab === 'resumes') loadResumes();
      if (activeTab === 'connections') loadConnections();
      if (activeTab === 'jobs') loadJobs();
      if (activeTab === 'applications') loadApplications();
      if (activeTab === 'outreach') loadOutreach();
      loadNotifications();
    }
  }, [isAuthenticated, activeTab, connFilters.page, jobFilters.page, jobFilters.archived]);

  useEffect(() => {
    if (isAuthenticated && activeTab === 'connection-detail' && activeConnectionId) {
      loadConnectionDetail(activeConnectionId);
    }
  }, [isAuthenticated, activeTab, activeConnectionId]);

  const loadConnectionDetail = async (id) => {
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
    } catch (e) {
      console.error(e);
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

            <div className="card-panel">
              {resumes.length === 0 ? (
                <div className="empty-state">No resumes uploaded yet. Click upload to get started.</div>
              ) : (
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>File Name</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Uploaded Date</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resumes.map((res) => (
                        <tr key={res.id}>
                          <td style={{ fontWeight: 600 }}>{res.fileName}</td>
                          <td>v{res.version}</td>
                          <td>
                            {res.isActive ? (
                              <span className="badge badge-success">Active Resume</span>
                            ) : (
                              <button className="btn-link" onClick={async () => {
                                await api.setActiveResume(res.id);
                                loadResumes();
                              }}>Set Active</button>
                            )}
                          </td>
                          <td>{new Date(res.createdAt).toLocaleDateString()}</td>
                          <td style={{ textAlign: 'right' }}>
                            <a
                              href={api.getResumeDownloadUrl(res.id)}
                              target="_blank"
                              rel="noreferrer"
                              className="btn btn-secondary"
                              style={{ marginRight: '8px', padding: '6px 12px', fontSize: '0.85rem' }}
                            >
                              Download
                            </a>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                              onClick={async () => {
                                if (confirm('Delete this resume?')) {
                                  await api.deleteResume(res.id);
                                  loadResumes();
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
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONNECTIONS CRM TAB */}
        {activeTab === 'connections' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Connections Directory</h1>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button className="btn btn-secondary" onClick={() => setModal('csv')}>
                  Import CSV
                </button>
                <button className="btn btn-primary" onClick={() => { setEditItem(null); setModal('connection'); }}>
                  Add Connection
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Search Query</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Name, title, company..."
                  value={connFilters.q}
                  onChange={(e) => setConnFilters({ ...connFilters, q: e.target.value, page: 1 })}
                />
              </div>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Filter Company</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. Google"
                  value={connFilters.company}
                  onChange={(e) => setConnFilters({ ...connFilters, company: e.target.value, page: 1 })}
                />
              </div>
              <button className="btn btn-secondary" onClick={loadConnections}>Apply</button>
            </div>

            <div className="card-panel">
              {connections.length === 0 ? (
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
                      {connections.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600 }}>{c.name}</td>
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

        {/* JOBS TRACKER TAB */}
        {activeTab === 'jobs' && (
          <div>
            <div className="page-header">
              <h1 className="page-title">Job Postings</h1>
              <button className="btn btn-primary" onClick={() => { setEditItem(null); setModal('job'); }}>
                Track New Job
              </button>
            </div>

            <div className="filter-bar">
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Job Title / keyword</label>
                <input
                  type="text"
                  className="form-input"
                  value={jobFilters.q}
                  onChange={(e) => setJobFilters({ ...jobFilters, q: e.target.value, page: 1 })}
                />
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
              <button className="btn btn-secondary" onClick={loadJobs}>Search</button>
            </div>

            <div className="card-panel">
              {jobs.length === 0 ? (
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
                      {jobs.map((job) => (
                        <tr key={job.id}>
                          <td style={{ fontWeight: 600 }}>{job.title}</td>
                          <td>{job.companyName}</td>
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
            )}
          </div>
        )}

      </main>

      {/* ================= MODALS ================= */}

      {/* CSV Import Modal */}
      {modal === 'csv' && (
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
      )}

      {/* Resume File Upload Modal */}
      {modal === 'resume' && (
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
      )}

      {/* Add/Edit Connection Modal */}
      {modal === 'connection' && (
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
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Connection</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add/Edit Job Modal */}
      {modal === 'job' && (
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
      )}

      {/* Application Status Update Modal */}
      {modal === 'application' && (
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
      )}

      {/* Log Outreach Modal */}
      {modal === 'outreach' && (
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
                setModal(null);
                loadOutreach();
                loadDashboard();
              } catch (err) {
                alert(err.message);
              }
            }}>
              <div className="form-group">
                <label className="form-label">Outreach Stage</label>
                <select name="status" className="form-input">
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
                  <input type="date" name="contactDate" className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Next Follow Up Date</label>
                  <input type="date" name="followUpDate" className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Interaction Log / Message Notes</label>
                <textarea name="notes" className="form-input" rows="3"></textarea>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Log Outreach</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Update Outreach Modal */}
      {modal === 'outreach_update' && (
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
      )}

      {/* Job Detail Intelligence Modal */}
      {modal === 'job_detail' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
            <h2 className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>🔍 Job Intel: {editItem?.title}</span>
              <span className="badge badge-info">{editItem?.status}</span>
            </h2>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>{editItem?.companyName} &bull; {editItem?.location}</div>
            
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
                💡 {editItem?.recommendedAction}
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

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label className="form-label">Recommended Referral Contacts</label>
              {editItem?.recommendedContacts?.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No connections found at {editItem?.companyName}. Add some to get referrals!</div>
              ) : (
                <div className="activity-list">
                  {editItem?.recommendedContacts?.map(contact => (
                    <div className="activity-item" key={contact.id} style={{ display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{contact.name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{contact.title} &bull; Relationship Strength: {contact.relationshipStrength || 'Unknown'}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span className="badge badge-info">Referral Score: {contact.referralScore}</span>
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }} onClick={() => {
                          setEditItem(contact);
                          setModal('outreach');
                        }}>Contact</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Close Intel</button>
            </div>
          </div>
        </div>
      )}

      {/* Connection Detail CRM Modal */}
      {modal === 'connection_detail' && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '700px' }}>
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

            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Close Intel</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
