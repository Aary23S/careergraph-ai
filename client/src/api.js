const API_BASE = 'http://localhost:5000/api';

class ApiClient {
  constructor() {
    this.accessToken = localStorage.getItem('cg_access_token');
    this.refreshToken = localStorage.getItem('cg_refresh_token');
    this.onLogout = null;
  }

  setTokens(accessToken, refreshToken) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    if (accessToken) {
      localStorage.setItem('cg_access_token', accessToken);
    } else {
      localStorage.removeItem('cg_access_token');
    }
    if (refreshToken) {
      localStorage.setItem('cg_refresh_token', refreshToken);
    } else {
      localStorage.removeItem('cg_refresh_token');
    }
  }

  clearTokens() {
    this.setTokens(null, null);
    if (this.onLogout) {
      this.onLogout();
    }
  }

  async request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    options.headers = options.headers || {};

    if (this.accessToken) {
      options.headers['Authorization'] = `Bearer ${this.accessToken}`;
    }

    if (!(options.body instanceof FormData) && options.body && typeof options.body === 'object') {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(options.body);
    }

    try {
      let response = await fetch(url, options);

      // Check for token expiration (401) and try refresh
      if (response.status === 401 && this.refreshToken) {
        const refreshed = await this.tryRefresh();
        if (refreshed) {
          // Retry original request with new token
          options.headers['Authorization'] = `Bearer ${this.accessToken}`;
          response = await fetch(url, options);
        } else {
          this.clearTokens();
          throw new Error('Session expired');
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Request failed with status ${response.status}`);
      }

      // If it's a file download, we might handle it differently or just return JSON
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }
      return response;
    } catch (err) {
      console.error(`API Error on ${path}:`, err);
      throw err;
    }
  }

  async tryRefresh() {
    try {
      const response = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });

      if (!response.ok) {
        return false;
      }

      const body = await response.json();
      if (body.success && body.data) {
        this.setTokens(body.data.accessToken, body.data.refreshToken);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  // Auth
  async register(email, password, name) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: { email, password, name },
    });
    this.setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data;
  }

  async login(email, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setTokens(res.data.tokens.accessToken, res.data.tokens.refreshToken);
    return res.data;
  }

  async logout() {
    try {
      if (this.refreshToken) {
        await this.request('/auth/logout', {
          method: 'POST',
          body: { refreshToken: this.refreshToken },
        });
      }
    } finally {
      this.clearTokens();
    }
  }

  async getMe() {
    return this.request('/auth/me');
  }

  async requestPasswordReset(email) {
    return this.request('/auth/password-reset/request', {
      method: 'POST',
      body: { email },
    });
  }

  async confirmPasswordReset(token, password) {
    return this.request('/auth/password-reset/confirm', {
      method: 'POST',
      body: { token, password },
    });
  }

  async verifyEmail(token) {
    return this.request('/auth/email-verification/verify', {
      method: 'POST',
      body: { token },
    });
  }

  // Profile
  async getProfile() {
    const res = await this.request('/profile');
    return res.data;
  }

  async updateProfile(profileData) {
    const res = await this.request('/profile', {
      method: 'POST',
      body: profileData,
    });
    return res.data;
  }

  // Resumes
  async listResumes() {
    const res = await this.request('/resumes');
    return res.data;
  }

  async uploadResume(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.request('/resumes', {
      method: 'POST',
      body: formData,
    });
    return res.data;
  }

  async deleteResume(resumeId) {
    return this.request(`/resumes/${resumeId}`, { method: 'DELETE' });
  }

  async setActiveResume(resumeId) {
    const res = await this.request(`/resumes/${resumeId}/active`, {
      method: 'PATCH',
      body: { isActive: true },
    });
    return res.data;
  }

  getResumeDownloadUrl(resumeId) {
    return `${API_BASE}/resumes/${resumeId}/download?token=${this.accessToken}`;
  }

  // Connections
  async listConnections(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return this.request(`/connections?${query.toString()}`);
  }

  async createConnection(connectionData) {
    const res = await this.request('/connections', {
      method: 'POST',
      body: connectionData,
    });
    return res.data;
  }

  async updateConnection(connectionId, connectionData) {
    const res = await this.request(`/connections/${connectionId}`, {
      method: 'PUT',
      body: connectionData,
    });
    return res.data;
  }

  getConnectionPdfUrl(connectionId) {
    return `${API_BASE}/connections/${connectionId}/pdf?token=${this.accessToken}`;
  }

  async deleteConnection(connectionId) {
    return this.request(`/connections/${connectionId}`, { method: 'DELETE' });
  }

  async importConnections(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await this.request('/connections/import', {
      method: 'POST',
      body: formData,
    });
    return res.data;
  }

  async listCompanies(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return this.request(`/connections/companies?${query.toString()}`);
  }

  async getCompanyDetail(companyKey) {
    return this.request(`/connections/companies/${companyKey}`);
  }

  async importLinkedInPdf(file) {
    const formData = new FormData();
    formData.append('file', file);
    return this.request('/connections/enrichment/import', {
      method: 'POST',
      body: formData,
    });
  }

  async confirmEnrichment(payload) {
    return this.request('/connections/enrichment/confirm', {
      method: 'POST',
      body: payload,
    });
  }

  // Jobs
  async listJobs(params = {}) {
    const query = new URLSearchParams();
    Object.keys(params).forEach((key) => {
      if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
        query.append(key, params[key]);
      }
    });
    return this.request(`/jobs?${query.toString()}`);
  }

  async createJob(jobData) {
    const res = await this.request('/jobs', {
      method: 'POST',
      body: jobData,
    });
    return res.data;
  }

  async updateJob(jobId, jobData) {
    const res = await this.request(`/jobs/${jobId}`, {
      method: 'PUT',
      body: jobData,
    });
    return res.data;
  }

  async deleteJob(jobId) {
    return this.request(`/jobs/${jobId}`, { method: 'DELETE' });
  }

  async ingestJob(jobData) {
    const res = await this.request('/jobs/ingest', {
      method: 'POST',
      body: jobData,
    });
    return res.data;
  }

  async ingestJobsBatch(jobsArray) {
    const res = await this.request('/jobs/ingest/batch', {
      method: 'POST',
      body: jobsArray,
    });
    return res.data;
  }

  async archiveJob(jobId, isArchived) {
    const res = await this.request(`/jobs/${jobId}/archive`, {
      method: 'PATCH',
      body: { isArchived },
    });
    return res.data;
  }

  // Applications
  async listApplications() {
    const res = await this.request('/applications');
    return res.data;
  }

  async getApplication(applicationId) {
    const res = await this.request(`/applications/${applicationId}`);
    return res.data;
  }

  async createApplication(jobId, status, extra = {}) {
    const res = await this.request('/applications', {
      method: 'POST',
      body: { jobId, status, ...extra },
    });
    return res.data;
  }

  async updateApplication(applicationId, data) {
    const res = await this.request(`/applications/${applicationId}`, {
      method: 'PUT',
      body: data,
    });
    return res.data;
  }

  async createApplicationEvent(applicationId, eventData) {
    const res = await this.request(`/applications/${applicationId}/events`, {
      method: 'POST',
      body: eventData,
    });
    return res.data;
  }

  async updateApplicationStatus(applicationId, status, notes = '') {
    const res = await this.request(`/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: { status, notes },
    });
    return res.data;
  }

  // Outreach
  async listOutreach() {
    const res = await this.request('/outreach');
    return res.data;
  }

  async getOutreach(outreachId) {
    const res = await this.request(`/outreach/${outreachId}`);
    return res.data;
  }

  async createOutreach(connectionId, status, notes = '', contactDate = null, followUpDate = null) {
    const res = await this.request('/outreach', {
      method: 'POST',
      body: { connectionId, status, notes, contactDate, followUpDate },
    });
    return res.data;
  }

  async updateOutreach(outreachId, data) {
    const res = await this.request(`/outreach/${outreachId}`, {
      method: 'PUT',
      body: data,
    });
    return res.data;
  }

  async createOutreachEvent(outreachId, status, notes = '') {
    const res = await this.request(`/outreach/${outreachId}/events`, {
      method: 'POST',
      body: { status, notes },
    });
    return res.data;
  }

  // Notifications
  async listNotifications() {
    const res = await this.request('/notifications');
    return res.data;
  }

  async markNotificationRead(notificationId) {
    const res = await this.request(`/notifications/${notificationId}/read`, {
      method: 'PATCH',
    });
    return res.data;
  }

  // Dashboard
  async getDashboardStats() {
    const res = await this.request('/dashboard');
    return res.data;
  }
}

export const api = new ApiClient();
