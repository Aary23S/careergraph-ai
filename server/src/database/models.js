import { DataTypes } from 'sequelize';
import { enrichConnectionData } from '../services/connection-intelligence.service.js';

export const APPLICATION_STATUSES = [
  'saved',
  'not_applied',
  'applying',
  'applied',
  'recruiter_contact',
  'screening',
  'interview',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
];

export const OUTREACH_STATUSES = [
  'not_contacted',
  'researching',
  'contacted',
  'replied',
  'conversation',
  'referral_requested',
  'referral_received',
  'closed',
];

export function initializeModels(sequelize) {
  const baseOptions = {
    underscored: true,
    freezeTableName: true,
  };

  const User = sequelize.define(
    'User',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      email: { type: DataTypes.STRING, allowNull: false, unique: true },
      passwordHash: { type: DataTypes.STRING, allowNull: false, field: 'password_hash' },
      emailVerifiedAt: { type: DataTypes.DATE, field: 'email_verified_at' },
      emailVerificationToken: { type: DataTypes.STRING, field: 'email_verification_token' },
      passwordResetToken: { type: DataTypes.STRING, field: 'password_reset_token' },
      passwordResetExpiresAt: { type: DataTypes.DATE, field: 'password_reset_expires_at' },
      lastLoginAt: { type: DataTypes.DATE, field: 'last_login_at' },
    },
    { ...baseOptions, tableName: 'users' },
  );

  const RefreshToken = sequelize.define(
    'RefreshToken',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tokenHash: { type: DataTypes.STRING, allowNull: false, field: 'token_hash' },
      expiresAt: { type: DataTypes.DATE, allowNull: false, field: 'expires_at' },
      revokedAt: { type: DataTypes.DATE, field: 'revoked_at' },
    },
    { ...baseOptions, tableName: 'refresh_tokens' },
  );

  const Profile = sequelize.define(
    'Profile',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      phone: { type: DataTypes.STRING },
      location: { type: DataTypes.STRING },
      targetRoles: { type: DataTypes.JSON, defaultValue: [], field: 'target_roles' },
      targetCompanies: { type: DataTypes.JSON, defaultValue: [], field: 'target_companies' },
      preferredLocations: {
        type: DataTypes.JSON,
        defaultValue: [],
        field: 'preferred_locations',
      },
      remotePreference: { type: DataTypes.STRING, field: 'remote_preference' },
      experience: { type: DataTypes.STRING },
      skills: { type: DataTypes.JSON, defaultValue: [] },
      salaryPreference: { type: DataTypes.STRING, field: 'salary_preference' },
      bio: { type: DataTypes.TEXT },
      education: { type: DataTypes.JSON, defaultValue: [] },
      certifications: { type: DataTypes.JSON, defaultValue: [] },
      professionalTitle: { type: DataTypes.STRING, field: 'professional_title' },
      careerLevel: { type: DataTypes.STRING, field: 'career_level' },
      resumeConfidence: { type: DataTypes.FLOAT, field: 'resume_confidence' },
      links: { type: DataTypes.JSON, defaultValue: {} },
      resumeSyncMeta: { type: DataTypes.JSON, defaultValue: {}, field: 'resume_sync_meta' },
      lastResumeSyncedAt: { type: DataTypes.DATE, field: 'last_resume_synced_at' },
      syncedResumeId: { type: DataTypes.UUID, field: 'synced_resume_id' },
    },
    { ...baseOptions, tableName: 'profiles' },
  );

  const Resume = sequelize.define(
    'Resume',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      fileName: { type: DataTypes.STRING, allowNull: false, field: 'file_name' },
      storageKey: { type: DataTypes.STRING, allowNull: false, field: 'storage_key' },
      contentType: { type: DataTypes.STRING, allowNull: false, field: 'content_type' },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: false, field: 'size_bytes' },
      isActive: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_active' },
      version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    { ...baseOptions, tableName: 'resumes' },
  );

  const Connection = sequelize.define(
    'Connection',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      company: { type: DataTypes.STRING },
      title: { type: DataTypes.STRING },
      location: { type: DataTypes.STRING },
      email: { type: DataTypes.STRING },
      profileUrl: { type: DataTypes.STRING, field: 'profile_url' },
      connectedDate: { type: DataTypes.DATEONLY, field: 'connected_date' },
      industry: { type: DataTypes.STRING },
      notes: { type: DataTypes.TEXT },
      relationshipStatus: { type: DataTypes.STRING, field: 'relationship_status' },
      relationshipStrength: { type: DataTypes.STRING, field: 'relationship_strength' },
      lastContactedDate: { type: DataTypes.DATEONLY, field: 'last_contacted_date' },
      nextFollowUpDate: { type: DataTypes.DATEONLY, field: 'next_follow_up_date' },
      importBatchId: { type: DataTypes.STRING, field: 'import_batch_id' },
      
      normalizedCompany: { type: DataTypes.STRING, field: 'normalized_company' },
      normalizedPosition: { type: DataTypes.STRING, field: 'normalized_position' },
      seniorityLevel: { type: DataTypes.STRING, field: 'seniority_level' },
      roleCategory: { type: DataTypes.STRING, field: 'role_category' },
      priority: { type: DataTypes.STRING, field: 'priority' },
      connectionScore: { type: DataTypes.INTEGER, field: 'connection_score' },
      profileCompleteness: { type: DataTypes.INTEGER, field: 'profile_completeness' },
      lastEnrichedAt: { type: DataTypes.DATE, field: 'last_enriched_at' },
      headline: { type: DataTypes.STRING },
      skills: { type: DataTypes.JSON },
      externalLinks: { type: DataTypes.JSON, field: 'external_links' },
      profileSummary: { type: DataTypes.TEXT, field: 'profile_summary' },
      dataSources: { type: DataTypes.JSON, field: 'data_sources' },
      profilePdfKey: { type: DataTypes.STRING, field: 'profile_pdf_key' },
      linkedinId: { type: DataTypes.STRING, field: 'linkedin_id' },
      languages: { type: DataTypes.JSON },
      certifications: { type: DataTypes.JSON },
      projects: { type: DataTypes.JSON },
      experience: { type: DataTypes.JSON },
      education: { type: DataTypes.JSON },
    },
    {
      ...baseOptions,
      tableName: 'connections',
      hooks: {
        beforeSave: (connection) => {
          enrichConnectionData(connection);
        },
      },
    },
  );

  const ConnectionTag = sequelize.define(
    'ConnectionTag',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      tag: { type: DataTypes.STRING, allowNull: false },
    },
    { ...baseOptions, tableName: 'connection_tags' },
  );

  const Company = sequelize.define(
    'Company',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      normalizedName: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        field: 'normalized_name',
      },
    },
    { ...baseOptions, tableName: 'companies' },
  );

  const Job = sequelize.define(
    'Job',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      title: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT },
      location: { type: DataTypes.STRING },
      employmentType: { type: DataTypes.STRING, field: 'employment_type' },
      experienceMin: { type: DataTypes.INTEGER, field: 'experience_min' },
      experienceMax: { type: DataTypes.INTEGER, field: 'experience_max' },
      url: { type: DataTypes.TEXT },
      source: { type: DataTypes.STRING },
      sourceJobId: { type: DataTypes.STRING, field: 'source_job_id' },
      postedDate: { type: DataTypes.DATEONLY, field: 'posted_date' },
      firstSeenDate: { type: DataTypes.DATEONLY, field: 'first_seen_date' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
      isArchived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_archived' },
      sourceUrl: { type: DataTypes.TEXT, field: 'source_url' },
      externalJobId: { type: DataTypes.STRING, field: 'external_job_id' },
      sourceMetadata: { type: DataTypes.JSON, field: 'source_metadata' },
      fetchedAt: { type: DataTypes.DATE, field: 'fetched_at' },
      provider: { type: DataTypes.STRING },
      normalizedCompany: { type: DataTypes.STRING, field: 'normalized_company' },
      normalizedTitle: { type: DataTypes.STRING, field: 'normalized_title' },
      normalizedLocation: { type: DataTypes.STRING, field: 'normalized_location' },
      normalizedSkills: { type: DataTypes.JSON, field: 'normalized_skills' },
      remoteType: { type: DataTypes.STRING, field: 'remote_type' },
      experienceLevel: { type: DataTypes.STRING, field: 'experience_level' },
      matchScore: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'match_score' },
      priority: { type: DataTypes.STRING, allowNull: false, defaultValue: 'standard' },
    },
    {
      ...baseOptions,
      tableName: 'jobs',
      hooks: {
        beforeSave: async (job) => {
          try {
            const Profile = job.sequelize.models.Profile;
            const profile = await Profile.findOne({ where: { user_id: job.user_id } });
            if (profile) {
              const { calculateMatchScore } = await import('../services/intelligence.service.js');
              job.matchScore = calculateMatchScore(profile, job);
            }
          } catch (e) {
            console.error('Error in Job beforeSave hook:', e);
          }
        }
      }
    },
  );
 
  const Application = sequelize.define(
    'Application',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: APPLICATION_STATUSES[0],
        validate: { isIn: [APPLICATION_STATUSES] },
      },
      appliedAt: { type: DataTypes.DATE, field: 'applied_at' },
      lastStatusAt: { type: DataTypes.DATE, field: 'last_status_at' },
      resumeId: { type: DataTypes.UUID, field: 'resume_id' },
      coverLetter: { type: DataTypes.TEXT, field: 'cover_letter' },
      referralConnectionId: { type: DataTypes.UUID, field: 'referral_connection_id' },
      notes: { type: DataTypes.TEXT },
      nextFollowUpDate: { type: DataTypes.DATEONLY, field: 'next_follow_up_date' },
    },
    { ...baseOptions, tableName: 'applications' },
  );

  const ApplicationEvent = sequelize.define(
    'ApplicationEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      status: { type: DataTypes.STRING, allowNull: false },
      eventType: { type: DataTypes.STRING, allowNull: false, field: 'event_type' },
      notes: { type: DataTypes.TEXT },
      occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
    },
    { ...baseOptions, tableName: 'application_events' },
  );

  const Outreach = sequelize.define(
    'Outreach',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: OUTREACH_STATUSES[0],
        validate: { isIn: [OUTREACH_STATUSES] },
      },
      contactDate: { type: DataTypes.DATEONLY, field: 'contact_date' },
      followUpDate: { type: DataTypes.DATEONLY, field: 'follow_up_date' },
      notes: { type: DataTypes.TEXT },
      outcome: { type: DataTypes.TEXT },
      jobId: { type: DataTypes.UUID, allowNull: true, field: 'job_id' },
    },
    { ...baseOptions, tableName: 'outreach' },
  );

  const OutreachEvent = sequelize.define(
    'OutreachEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      status: { type: DataTypes.STRING, allowNull: false },
      eventType: { type: DataTypes.STRING, allowNull: false, field: 'event_type' },
      notes: { type: DataTypes.TEXT },
      occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
    },
    { ...baseOptions, tableName: 'outreach_events' },
  );

  const Note = sequelize.define(
    'Note',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      entityType: { type: DataTypes.STRING, allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      content: { type: DataTypes.TEXT, allowNull: false },
    },
    { ...baseOptions, tableName: 'notes' },
  );

  const Notification = sequelize.define(
    'Notification',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      type: { type: DataTypes.STRING, allowNull: false },
      title: { type: DataTypes.STRING, allowNull: false },
      message: { type: DataTypes.TEXT, allowNull: false },
      isRead: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'is_read' },
      relatedEntityType: { type: DataTypes.STRING, field: 'related_entity_type' },
      relatedEntityId: { type: DataTypes.UUID, field: 'related_entity_id' },
      dueAt: { type: DataTypes.DATE, field: 'due_at' },
    },
    { ...baseOptions, tableName: 'notifications' },
  );

  const UserPreference = sequelize.define(
    'UserPreference',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      preferredJobLocations: {
        type: DataTypes.JSON,
        defaultValue: [],
        field: 'preferred_job_locations',
      },
      preferredJobRoles: { type: DataTypes.JSON, defaultValue: [], field: 'preferred_job_roles' },
      remotePreference: { type: DataTypes.STRING, field: 'remote_preference' },
      notificationsEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notifications_enabled',
      },
      notifyHighlyRelevant: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_highly_relevant',
      },
      notifyStrongReferral: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_strong_referral',
      },
      notifyTargetCompany: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'notify_target_company',
      },
      dailyDigestEnabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        field: 'daily_digest_enabled',
      },
      notifyLowRelevance: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        field: 'notify_low_relevance',
      },
      minimumMatchScore: {
        type: DataTypes.INTEGER,
        defaultValue: 80,
        field: 'minimum_match_score',
      },
    },
    { ...baseOptions, tableName: 'user_preferences' },
  );

  const SavedConnectionView = sequelize.define(
    'SavedConnectionView',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      filtersJson: { type: DataTypes.JSON, allowNull: false, field: 'filters_json' },
      sortJson: { type: DataTypes.JSON, allowNull: false, field: 'sort_json' },
      filterVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'filter_version' },
      lastUsedAt: { type: DataTypes.DATE, allowNull: true, field: 'last_used_at' },
    },
    { ...baseOptions, tableName: 'saved_connection_views' },
  );

  const JobSearchProfile = sequelize.define(
    'JobSearchProfile',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      keywords: { type: DataTypes.STRING, allowNull: true },
      location: { type: DataTypes.STRING, allowNull: true },
      remotePreference: { type: DataTypes.STRING, allowNull: true, field: 'remote_preference' },
      experienceLevel: { type: DataTypes.STRING, allowNull: true, field: 'experience_level' },
      employmentType: { type: DataTypes.STRING, allowNull: true, field: 'employment_type' },
      excludedKeywords: { type: DataTypes.STRING, allowNull: true, field: 'excluded_keywords' },
      targetCompanies: { type: DataTypes.JSON, allowNull: true, field: 'target_companies' },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true, field: 'is_active' }
    },
    { ...baseOptions, tableName: 'job_search_profiles' }
  );

  const GmailIntegration = sequelize.define(
    'GmailIntegration',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      emailAddress: { type: DataTypes.STRING, allowNull: false, field: 'email_address' },
      encryptedRefreshToken: { type: DataTypes.TEXT, allowNull: false, field: 'encrypted_refresh_token' },
      scope: { type: DataTypes.STRING, allowNull: true },
      historyId: { type: DataTypes.STRING, allowNull: true, field: 'history_id' },
      lastSyncAt: { type: DataTypes.DATE, allowNull: true, field: 'last_sync_at' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'active' }
    },
    { ...baseOptions, tableName: 'gmail_integrations' }
  );

  const JobIngestionEvent = sequelize.define(
    'JobIngestionEvent',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      sourceType: { type: DataTypes.STRING, allowNull: false, field: 'source_type' },
      sourceMessageId: { type: DataTypes.STRING, allowNull: false, field: 'source_message_id' },
      status: { type: DataTypes.STRING, allowNull: false },
      processedAt: { type: DataTypes.DATE, allowNull: false, field: 'processed_at' }
    },
    { ...baseOptions, tableName: 'job_ingestion_events' }
  );

  const TelegramIntegration = sequelize.define(
    'TelegramIntegration',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      telegramUserId: { type: DataTypes.STRING, allowNull: false, unique: true, field: 'telegram_user_id' },
      telegramUsername: { type: DataTypes.STRING, allowNull: true, field: 'telegram_username' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'connected' },
      linkedAt: { type: DataTypes.DATE, allowNull: false, field: 'linked_at' }
    },
    { ...baseOptions, tableName: 'telegram_integrations' }
  );

  const IncomingJob = sequelize.define(
    'IncomingJob',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      source: { type: DataTypes.STRING, allowNull: false, defaultValue: 'telegram' },
      rawText: { type: DataTypes.TEXT, allowNull: false, field: 'raw_text' },
      telegramMessageId: { type: DataTypes.STRING, allowNull: true, field: 'telegram_message_id' },
      telegramUserId: { type: DataTypes.STRING, allowNull: true, field: 'telegram_user_id' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending_review' },
      parsedData: { type: DataTypes.JSON, allowNull: true, field: 'parsed_data' },
      matchScore: { type: DataTypes.INTEGER, allowNull: true, field: 'match_score' },
      receivedAt: { type: DataTypes.DATE, allowNull: false, field: 'received_at' }
    },
    { ...baseOptions, tableName: 'incoming_jobs' }
  );

  const JobDeduplicationLog = sequelize.define(
    'JobDeduplicationLog',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      source: { type: DataTypes.STRING, allowNull: false },
      duplicateText: { type: DataTypes.TEXT, allowNull: false, field: 'duplicate_text' },
      matchedJobId: { type: DataTypes.UUID, allowNull: true, field: 'matched_job_id' },
      reason: { type: DataTypes.STRING, allowNull: false },
      loggedAt: { type: DataTypes.DATE, allowNull: false, field: 'logged_at' }
    },
    { ...baseOptions, tableName: 'job_deduplication_logs' }
  );

  const JobAiEnrichment = sequelize.define(
    'JobAiEnrichment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      jobId: { type: DataTypes.UUID, allowNull: false, field: 'job_id' },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      promptVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'prompt_version' },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      inputHash: { type: DataTypes.STRING, allowNull: false, field: 'input_hash' },
      roleCategory: { type: DataTypes.STRING, field: 'role_category' },
      seniority: { type: DataTypes.STRING },
      requiredSkills: { type: DataTypes.JSON, field: 'required_skills' },
      preferredSkills: { type: DataTypes.JSON, field: 'preferred_skills' },
      location: { type: DataTypes.STRING },
      remoteType: { type: DataTypes.STRING, field: 'remote_type' },
      employmentType: { type: DataTypes.STRING, field: 'employment_type' },
      experienceMinYears: { type: DataTypes.INTEGER, field: 'experience_min_years' },
      experienceMaxYears: { type: DataTypes.INTEGER, field: 'experience_max_years' },
      domain: { type: DataTypes.JSON },
      responsibilities: { type: DataTypes.JSON },
      summary: { type: DataTypes.TEXT },
      confidence: { type: DataTypes.FLOAT },
      rawResponse: { type: DataTypes.TEXT, field: 'raw_response' },
      latencyMs: { type: DataTypes.INTEGER, field: 'latency_ms' },
      errorCode: { type: DataTypes.STRING, field: 'error_code' },
      userCorrectedRoleCategory: { type: DataTypes.STRING, field: 'user_corrected_role_category' },
      userCorrectedSeniority: { type: DataTypes.STRING, field: 'user_corrected_seniority' },
      userCorrectedRequiredSkills: { type: DataTypes.JSON, field: 'user_corrected_required_skills' },
      userCorrectedPreferredSkills: { type: DataTypes.JSON, field: 'user_corrected_preferred_skills' },
      userCorrectedLocation: { type: DataTypes.STRING, field: 'user_corrected_location' },
      userCorrectedRemoteType: { type: DataTypes.STRING, field: 'user_corrected_remote_type' },
      userCorrectedEmploymentType: { type: DataTypes.STRING, field: 'user_corrected_employment_type' },
      userCorrectedExperienceMinYears: { type: DataTypes.INTEGER, field: 'user_corrected_experience_min_years' },
      userCorrectedExperienceMaxYears: { type: DataTypes.INTEGER, field: 'user_corrected_experience_max_years' },
      userCorrectedDomain: { type: DataTypes.JSON, field: 'user_corrected_domain' },
      userCorrectedResponsibilities: { type: DataTypes.JSON, field: 'user_corrected_responsibilities' },
      userCorrectedSummary: { type: DataTypes.TEXT, field: 'user_corrected_summary' },
    },
    { ...baseOptions, tableName: 'job_ai_enrichments' }
  );

  const ResumeAiEnrichment = sequelize.define(
    'ResumeAiEnrichment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      resumeId: { type: DataTypes.UUID, allowNull: false, field: 'resume_id' },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      promptVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'prompt_version' },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      inputHash: { type: DataTypes.STRING, allowNull: false, field: 'input_hash' },
      professionalTitle: { type: DataTypes.STRING, field: 'professional_title' },
      careerLevel: { type: DataTypes.STRING, field: 'career_level' },
      skills: { type: DataTypes.JSON },
      technicalDomains: { type: DataTypes.JSON, field: 'technical_domains' },
      experience: { type: DataTypes.JSON },
      projects: { type: DataTypes.JSON },
      education: { type: DataTypes.JSON },
      certifications: { type: DataTypes.JSON },
      achievements: { type: DataTypes.JSON },
      summary: { type: DataTypes.TEXT },
      confidence: { type: DataTypes.FLOAT },
      contactInfo: { type: DataTypes.JSON, field: 'contact_info' },
      canonicalSkills: { type: DataTypes.JSON, field: 'canonical_skills' },
      totalExperienceYears: { type: DataTypes.INTEGER, field: 'total_experience_years' },
      needsReview: { type: DataTypes.BOOLEAN, defaultValue: false, field: 'needs_review' },
      rawResponse: { type: DataTypes.TEXT, field: 'raw_response' },
      latencyMs: { type: DataTypes.INTEGER, field: 'latency_ms' },
      errorCode: { type: DataTypes.STRING, field: 'error_code' },
      userCorrectedProfessionalTitle: { type: DataTypes.STRING, field: 'user_corrected_professional_title' },
      userCorrectedCareerLevel: { type: DataTypes.STRING, field: 'user_corrected_career_level' },
      userCorrectedSkills: { type: DataTypes.JSON, field: 'user_corrected_skills' },
      userCorrectedSummary: { type: DataTypes.TEXT, field: 'user_corrected_summary' },
    },
    { ...baseOptions, tableName: 'resume_ai_enrichments' }
  );

  const JobMatchAnalysis = sequelize.define(
    'JobMatchAnalysis',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      jobId: { type: DataTypes.UUID, allowNull: false, unique: true, field: 'job_id' },
      resumeId: { type: DataTypes.UUID, allowNull: true, field: 'resume_id' },
      provider: { type: DataTypes.STRING },
      model: { type: DataTypes.STRING },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      inputHash: { type: DataTypes.STRING, allowNull: false, field: 'input_hash' },
      ruleScore: { type: DataTypes.INTEGER, field: 'rule_score' },
      finalScore: { type: DataTypes.INTEGER, field: 'final_score' },
      compatibilityAssessment: { type: DataTypes.STRING, field: 'compatibility_assessment' },
      matchedSkills: { type: DataTypes.JSON, field: 'matched_skills' },
      missingSkills: { type: DataTypes.JSON, field: 'missing_skills' },
      strengths: { type: DataTypes.JSON },
      potentialGaps: { type: DataTypes.JSON, field: 'potential_gaps' },
      analysisSummary: { type: DataTypes.TEXT, field: 'analysis_summary' },
      latencyMs: { type: DataTypes.INTEGER, field: 'latency_ms' },
      errorCode: { type: DataTypes.STRING, field: 'error_code' },
      computedAt: { type: DataTypes.DATE, field: 'computed_at' },
    },
    { ...baseOptions, tableName: 'job_match_analyses' }
  );

  const ConnectionAiEnrichment = sequelize.define(
    'ConnectionAiEnrichment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      connectionId: { type: DataTypes.UUID, allowNull: false, field: 'connection_id' },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      promptVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'prompt_version' },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'pending' },
      inputHash: { type: DataTypes.STRING, allowNull: false, field: 'input_hash' },
      professionalRole: { type: DataTypes.STRING, field: 'professional_role' },
      roleFamily: { type: DataTypes.STRING, field: 'role_family' },
      careerLevel: { type: DataTypes.STRING, field: 'career_level' },
      technicalDomains: { type: DataTypes.JSON, field: 'technical_domains' },
      technologies: { type: DataTypes.JSON },
      industryDomains: { type: DataTypes.JSON, field: 'industry_domains' },
      expertiseAreas: { type: DataTypes.JSON, field: 'expertise_areas' },
      leadershipLevel: { type: DataTypes.STRING, field: 'leadership_level' },
      summary: { type: DataTypes.TEXT },
      confidence: { type: DataTypes.FLOAT },
      rawResponse: { type: DataTypes.TEXT, field: 'raw_response' },
      latencyMs: { type: DataTypes.INTEGER, field: 'latency_ms' },
      errorCode: { type: DataTypes.STRING, field: 'error_code' },
      userCorrectedProfessionalRole: { type: DataTypes.STRING, field: 'user_corrected_professional_role' },
      userCorrectedRoleFamily: { type: DataTypes.STRING, field: 'user_corrected_role_family' },
      userCorrectedCareerLevel: { type: DataTypes.STRING, field: 'user_corrected_career_level' },
      userCorrectedTechnicalDomains: { type: DataTypes.JSON, field: 'user_corrected_technical_domains' },
      userCorrectedTechnologies: { type: DataTypes.JSON, field: 'user_corrected_technologies' },
      userCorrectedIndustryDomains: { type: DataTypes.JSON, field: 'user_corrected_industry_domains' },
      userCorrectedExpertiseAreas: { type: DataTypes.JSON, field: 'user_corrected_expertise_areas' },
      userCorrectedLeadershipLevel: { type: DataTypes.STRING, field: 'user_corrected_leadership_level' },
      userCorrectedSummary: { type: DataTypes.TEXT, field: 'user_corrected_summary' },
    },
    { ...baseOptions, tableName: 'connection_ai_enrichments' }
  );
  const OutreachAiDraft = sequelize.define(
    'OutreachAiDraft',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      connectionId: { type: DataTypes.UUID, allowNull: true, field: 'connection_id' },
      jobId: { type: DataTypes.UUID, allowNull: true, field: 'job_id' },
      intent: { type: DataTypes.STRING, allowNull: false },
      tone: { type: DataTypes.STRING, allowNull: false },
      length: { type: DataTypes.STRING, allowNull: false },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      promptVersion: { type: DataTypes.STRING, allowNull: false, field: 'prompt_version' },
      draft: { type: DataTypes.TEXT, allowNull: false },
      personalizationPoints: { type: DataTypes.JSON, allowNull: true, field: 'personalization_points' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'generated' },
    },
    { ...baseOptions, tableName: 'outreach_ai_drafts' }
  );

  const SemanticEmbedding = sequelize.define(
    'SemanticEmbedding',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      entityType: { type: DataTypes.STRING, allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      embedding: {
        type: DataTypes.JSON,
        allowNull: false
      },
      contentHash: { type: DataTypes.STRING, allowNull: false, field: 'content_hash' },
      embeddingModel: { type: DataTypes.STRING, allowNull: false, field: 'embedding_model' },
      embeddingDimension: { type: DataTypes.INTEGER, allowNull: false, field: 'embedding_dimension' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
    },
    { ...baseOptions, tableName: 'semantic_embeddings' }
  );

  const AiAuditLog = sequelize.define(
    'AiAuditLog',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      userId: { type: DataTypes.UUID, allowNull: false, field: 'user_id' },
      operation: { type: DataTypes.STRING, allowNull: false },
      entityType: { type: DataTypes.STRING, allowNull: true, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: true, field: 'entity_id' },
      provider: { type: DataTypes.STRING, allowNull: false },
      model: { type: DataTypes.STRING, allowNull: false },
      promptVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'prompt_version' },
      schemaVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1, field: 'schema_version' },
      latencyMs: { type: DataTypes.INTEGER, allowNull: false, field: 'latency_ms' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'success' },
      evaluationScore: { type: DataTypes.FLOAT, allowNull: true, field: 'evaluation_score' },
      correlationId: { type: DataTypes.UUID, allowNull: true, field: 'correlation_id' },
      modelRegistryId: { type: DataTypes.UUID, allowNull: true, field: 'model_registry_id' },
      modelVersion: { type: DataTypes.STRING, allowNull: true, field: 'model_version' },
    },
    { ...baseOptions, tableName: 'ai_audit_logs' }
  );

  const ModelRegistry = sequelize.define(
    'ModelRegistry',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      name: { type: DataTypes.STRING, allowNull: false },
      version: { type: DataTypes.STRING, allowNull: false },
      modelType: { type: DataTypes.STRING, allowNull: false, field: 'model_type' },
      provider: { type: DataTypes.STRING, allowNull: false },
      framework: { type: DataTypes.STRING, allowNull: true },
      artifactUri: { type: DataTypes.STRING, allowNull: true, field: 'artifact_uri' },
      metadata: { type: DataTypes.JSON, allowNull: true },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'candidate' },
    },
    {
      ...baseOptions,
      tableName: 'model_registry',
      indexes: [
        { unique: true, fields: ['provider', 'name', 'version', 'model_type'] },
      ],
    }
  );

  const ModelEvaluation = sequelize.define(
    'ModelEvaluation',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      modelRegistryId: { type: DataTypes.UUID, allowNull: false, field: 'model_registry_id' },
      evaluationType: { type: DataTypes.STRING, allowNull: false, field: 'evaluation_type' },
      datasetVersion: { type: DataTypes.STRING, allowNull: true, field: 'dataset_version' },
      metrics: { type: DataTypes.JSON, allowNull: true },
      overallScore: { type: DataTypes.FLOAT, allowNull: true, field: 'overall_score' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'completed' },
      evaluatedAt: { type: DataTypes.DATE, allowNull: true, field: 'evaluated_at' },
    },
    { ...baseOptions, tableName: 'model_evaluations', updatedAt: false }
  );

  const ModelAssignment = sequelize.define(
    'ModelAssignment',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      modelType: { type: DataTypes.STRING, allowNull: false, field: 'model_type' },
      environment: { type: DataTypes.STRING, allowNull: false },
      modelRegistryId: { type: DataTypes.UUID, allowNull: false, field: 'model_registry_id' },
      assignedAt: { type: DataTypes.DATE, allowNull: false, field: 'assigned_at', defaultValue: DataTypes.NOW },
      assignedBy: { type: DataTypes.STRING, allowNull: true, field: 'assigned_by' },
    },
    { ...baseOptions, tableName: 'model_assignments', timestamps: false }
  );

  const MlPrediction = sequelize.define(
    'MlPrediction',
    {
      id: { type: DataTypes.UUID, primaryKey: true, defaultValue: DataTypes.UUIDV4 },
      entityType: { type: DataTypes.STRING, allowNull: false, field: 'entity_type' },
      entityId: { type: DataTypes.UUID, allowNull: false, field: 'entity_id' },
      modelRegistryId: { type: DataTypes.UUID, allowNull: true, field: 'model_registry_id' },
      modelVersion: { type: DataTypes.STRING, allowNull: true, field: 'model_version' },
      featureVersion: { type: DataTypes.STRING, allowNull: true, field: 'feature_version' },
      predictionScore: { type: DataTypes.FLOAT, allowNull: false, field: 'prediction_score' },
      predictionTime: { type: DataTypes.INTEGER, allowNull: true, field: 'prediction_time' },
      requestId: { type: DataTypes.UUID, allowNull: true, field: 'request_id' },
    },
    { ...baseOptions, tableName: 'ml_predictions' }
  );


  User.hasMany(RefreshToken, { foreignKey: 'user_id', as: 'refreshTokens' });
  RefreshToken.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasOne(Profile, { foreignKey: 'user_id', as: 'profile' });
  Profile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Resume, { foreignKey: 'user_id', as: 'resumes' });
  Resume.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Connection, { foreignKey: 'user_id', as: 'connections' });
  Connection.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Connection.hasMany(ConnectionTag, { foreignKey: 'connection_id', as: 'tags' });
  ConnectionTag.belongsTo(Connection, { foreignKey: 'connection_id', as: 'connection' });
  User.hasMany(ConnectionTag, { foreignKey: 'user_id', as: 'connectionTags' });
  ConnectionTag.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Job, { foreignKey: 'user_id', as: 'jobs' });
  Job.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Company.hasMany(Job, { foreignKey: 'company_id', as: 'jobs' });
  Job.belongsTo(Company, { foreignKey: 'company_id', as: 'company' });

  Job.hasMany(Outreach, { foreignKey: 'job_id', as: 'outreachItems' });
  Outreach.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

  User.hasMany(Application, { foreignKey: 'user_id', as: 'applications' });
  Application.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Job.hasOne(Application, { foreignKey: 'job_id', as: 'application' });
  Application.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
  Application.belongsTo(Resume, { foreignKey: 'resume_id', as: 'resume' });
  Application.belongsTo(Connection, { foreignKey: 'referral_connection_id', as: 'referralConnection' });

  Application.hasMany(ApplicationEvent, { foreignKey: 'application_id', as: 'events' });
  ApplicationEvent.belongsTo(Application, { foreignKey: 'application_id', as: 'application' });
  User.hasMany(ApplicationEvent, { foreignKey: 'user_id', as: 'applicationEvents' });
  ApplicationEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Outreach, { foreignKey: 'user_id', as: 'outreachItems' });
  Outreach.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  Connection.hasOne(Outreach, { foreignKey: 'connection_id', as: 'outreach' });
  Outreach.belongsTo(Connection, { foreignKey: 'connection_id', as: 'connection' });

  Outreach.hasMany(OutreachEvent, { foreignKey: 'outreach_id', as: 'events' });
  OutreachEvent.belongsTo(Outreach, { foreignKey: 'outreach_id', as: 'outreach' });
  User.hasMany(OutreachEvent, { foreignKey: 'user_id', as: 'outreachEvents' });
  OutreachEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Note, { foreignKey: 'user_id', as: 'notes' });
  Note.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(Notification, { foreignKey: 'user_id', as: 'notifications' });
  Notification.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasOne(UserPreference, { foreignKey: 'user_id', as: 'preferences' });
  UserPreference.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(SavedConnectionView, { foreignKey: 'user_id', as: 'savedViews' });
  SavedConnectionView.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(JobSearchProfile, { foreignKey: 'user_id', as: 'searchProfiles' });
  JobSearchProfile.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasOne(GmailIntegration, { foreignKey: 'user_id', as: 'gmailIntegration' });
  GmailIntegration.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(JobIngestionEvent, { foreignKey: 'user_id', as: 'ingestionEvents' });
  JobIngestionEvent.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasOne(TelegramIntegration, { foreignKey: 'user_id', as: 'telegramIntegration' });
  TelegramIntegration.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(IncomingJob, { foreignKey: 'user_id', as: 'incomingJobs' });
  IncomingJob.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(JobDeduplicationLog, { foreignKey: 'user_id', as: 'deduplicationLogs' });
  JobDeduplicationLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Job.hasMany(JobDeduplicationLog, { foreignKey: 'matched_job_id', as: 'duplicateLogs' });
  JobDeduplicationLog.belongsTo(Job, { foreignKey: 'matched_job_id', as: 'matchedJob' });

  Job.hasOne(JobAiEnrichment, { foreignKey: 'job_id', as: 'aiEnrichment' });
  JobAiEnrichment.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

  Job.hasOne(JobMatchAnalysis, { foreignKey: 'job_id', as: 'matchAnalysis' });
  JobMatchAnalysis.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });
  Resume.hasMany(JobMatchAnalysis, { foreignKey: 'resume_id', as: 'matchAnalyses' });
  JobMatchAnalysis.belongsTo(Resume, { foreignKey: 'resume_id', as: 'resume' });

  Resume.hasOne(ResumeAiEnrichment, { foreignKey: 'resume_id', as: 'aiEnrichment' });
  ResumeAiEnrichment.belongsTo(Resume, { foreignKey: 'resume_id', as: 'resume' });

  Connection.hasOne(ConnectionAiEnrichment, { foreignKey: 'connection_id', as: 'aiEnrichment' });
  ConnectionAiEnrichment.belongsTo(Connection, { foreignKey: 'connection_id', as: 'connection' });

  User.hasMany(OutreachAiDraft, { foreignKey: 'user_id', as: 'aiDrafts' });
  OutreachAiDraft.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  Connection.hasMany(OutreachAiDraft, { foreignKey: 'connection_id', as: 'aiDrafts' });
  OutreachAiDraft.belongsTo(Connection, { foreignKey: 'connection_id', as: 'connection' });

  Job.hasMany(OutreachAiDraft, { foreignKey: 'job_id', as: 'aiDrafts' });
  OutreachAiDraft.belongsTo(Job, { foreignKey: 'job_id', as: 'job' });

  User.hasMany(SemanticEmbedding, { foreignKey: 'user_id', as: 'embeddings' });
  SemanticEmbedding.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  User.hasMany(AiAuditLog, { foreignKey: 'user_id', as: 'aiAuditLogs' });
  AiAuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  ModelRegistry.hasMany(ModelEvaluation, { foreignKey: 'model_registry_id', as: 'evaluations' });
  ModelEvaluation.belongsTo(ModelRegistry, { foreignKey: 'model_registry_id', as: 'model' });

  ModelRegistry.hasMany(ModelAssignment, { foreignKey: 'model_registry_id', as: 'assignments' });
  ModelAssignment.belongsTo(ModelRegistry, { foreignKey: 'model_registry_id', as: 'model' });

  User.hasMany(MlPrediction, { foreignKey: 'user_id', as: 'predictions' });
  MlPrediction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

  ModelRegistry.hasMany(MlPrediction, { foreignKey: 'model_registry_id', as: 'predictions' });
  MlPrediction.belongsTo(ModelRegistry, { foreignKey: 'model_registry_id', as: 'model' });

  return {
    User,
    RefreshToken,
    Profile,
    Resume,
    Connection,
    ConnectionTag,
    Company,
    Job,
    Application,
    ApplicationEvent,
    Outreach,
    OutreachEvent,
    Note,
    Notification,
    UserPreference,
    SavedConnectionView,
    JobSearchProfile,
    GmailIntegration,
    JobIngestionEvent,
    TelegramIntegration,
    IncomingJob,
    JobDeduplicationLog,
    JobAiEnrichment,
    ResumeAiEnrichment,
    JobMatchAnalysis,
    ConnectionAiEnrichment,
    OutreachAiDraft,
    SemanticEmbedding,
    AiAuditLog,
    ModelRegistry,
    ModelEvaluation,
    ModelAssignment,
    MlPrediction,
  };
}
