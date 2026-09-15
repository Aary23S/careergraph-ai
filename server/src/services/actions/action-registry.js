import { APPLICATION_STATUSES } from '../../database/models.js';

/**
 * Action Registry
 * Defines standard action types, statuses, targets, and lifecycle transitions.
 */

// Centralized Action Types
export const ActionTypes = {
  SAVE_JOB: 'save_job',
  CHANGE_JOB_STATUS: 'change_job_status',
  CREATE_APPLICATION: 'create_application',
  CHANGE_APPLICATION_STATUS: 'change_application_status',
  SCHEDULE_FOLLOWUP: 'schedule_followup',
  CREATE_OUTREACH_DRAFT: 'create_outreach_draft',
  ADD_NOTE: 'add_note'
};

// Valid Target Types
export const TargetTypes = {
  JOB: 'job',
  APPLICATION: 'application',
  CONNECTION: 'connection',
  OUTREACH: 'outreach',
  NOTE: 'note'
};

// Supported Job Statuses
export const JOB_STATUSES = [
  'new',
  'saved',
  'interested',
  'applying',
  'applied',
  'interview',
  'interviewing',
  'screening',
  'offer',
  'accepted',
  'rejected',
  'withdrawn',
  'archived',
  'closed'
];

export { APPLICATION_STATUSES };

// Centralized Action Statuses
export const ActionStatuses = {
  PENDING_CONFIRMATION: 'pending_confirmation',
  CONFIRMED: 'confirmed',
  EXECUTING: 'executing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  EXPIRED: 'expired'
};

// Registry Metadata mapping actions to valid target types, risks, and descriptions
export const ActionRegistryMap = {
  [ActionTypes.SAVE_JOB]: { 
    targetType: TargetTypes.JOB,
    risk: 'LOW',
    description: 'Save a job to your list'
  },
  [ActionTypes.CHANGE_JOB_STATUS]: { 
    targetType: TargetTypes.JOB,
    risk: 'MEDIUM',
    description: 'Change the pipeline status of a job'
  },
  [ActionTypes.CREATE_APPLICATION]: { 
    targetType: TargetTypes.JOB,
    risk: 'HIGH',
    description: 'Log a new application for a job'
  },
  [ActionTypes.CHANGE_APPLICATION_STATUS]: {
    targetType: TargetTypes.APPLICATION,
    risk: 'MEDIUM',
    description: 'Change the pipeline status of an application'
  },
  [ActionTypes.SCHEDULE_FOLLOWUP]: { 
    targetType: [TargetTypes.CONNECTION, TargetTypes.JOB, TargetTypes.APPLICATION, TargetTypes.OUTREACH],
    risk: 'MEDIUM',
    description: 'Schedule a follow-up reminder'
  },
  [ActionTypes.CREATE_OUTREACH_DRAFT]: { 
    targetType: TargetTypes.CONNECTION,
    risk: 'MEDIUM',
    description: 'Draft an outreach message'
  },
  [ActionTypes.ADD_NOTE]: { 
    targetType: [TargetTypes.CONNECTION, TargetTypes.JOB, TargetTypes.APPLICATION],
    risk: 'LOW',
    description: 'Add a textual note to a record'
  }
};

// Valid Lifecycle Transitions
export const ValidTransitions = {
  [ActionStatuses.PENDING_CONFIRMATION]: [
    ActionStatuses.CONFIRMED,
    ActionStatuses.CANCELLED,
    ActionStatuses.EXPIRED
  ],
  [ActionStatuses.CONFIRMED]: [
    ActionStatuses.EXECUTING,
    ActionStatuses.FAILED
  ],
  [ActionStatuses.EXECUTING]: [
    ActionStatuses.COMPLETED,
    ActionStatuses.FAILED
  ],
  [ActionStatuses.COMPLETED]: [], // Terminal state
  [ActionStatuses.FAILED]: [],    // Terminal state
  [ActionStatuses.CANCELLED]: [], // Terminal state
  [ActionStatuses.EXPIRED]: []    // Terminal state
};

// Configuration
export const ActionConfig = {
  DEFAULT_EXPIRATION_MS: 15 * 60 * 1000 // 15 minutes
};
