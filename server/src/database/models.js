import { DataTypes } from 'sequelize';
import { enrichConnectionData } from '../services/connection-intelligence.service.js';

export const APPLICATION_STATUSES = [
  'saved',
  'applied',
  'screening',
  'interview',
  'offer',
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
      url: { type: DataTypes.STRING },
      source: { type: DataTypes.STRING },
      sourceJobId: { type: DataTypes.STRING, field: 'source_job_id' },
      postedDate: { type: DataTypes.DATEONLY, field: 'posted_date' },
      firstSeenDate: { type: DataTypes.DATEONLY, field: 'first_seen_date' },
      status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'new' },
      isArchived: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false, field: 'is_archived' },
    },
    { ...baseOptions, tableName: 'jobs' },
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
  };
}
