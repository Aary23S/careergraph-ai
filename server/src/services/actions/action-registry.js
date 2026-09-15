/**
 * Action Registry
 * Defines standard action types, statuses, targets, and lifecycle transitions for H7-A.
 */

// Centralized Action Types
export const ActionTypes = {
  SAVE_JOB: 'save_job',
  CHANGE_JOB_STATUS: 'change_job_status',
  CREATE_APPLICATION: 'create_application',
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
  [ActionTypes.SCHEDULE_FOLLOWUP]: { 
    targetType: TargetTypes.CONNECTION,
    risk: 'MEDIUM',
    description: 'Schedule a follow-up reminder'
  },
  [ActionTypes.CREATE_OUTREACH_DRAFT]: { 
    targetType: TargetTypes.CONNECTION,
    risk: 'MEDIUM',
    description: 'Draft an outreach message'
  },
  // ADD_NOTE can target multiple types in the future, we'll allow connection, job, application
  [ActionTypes.ADD_NOTE]: { 
    targetType: [TargetTypes.CONNECTION, TargetTypes.JOB, TargetTypes.APPLICATION],
    risk: 'LOW',
    description: 'Add a textual note to a record'
  }
};

// Valid Lifecycle Transitions
// Source status -> Array of valid target statuses
export const ValidTransitions = {
  [ActionStatuses.PENDING_CONFIRMATION]: [
    ActionStatuses.CONFIRMED,
    ActionStatuses.CANCELLED,
    ActionStatuses.EXPIRED
  ],
  [ActionStatuses.CONFIRMED]: [
    ActionStatuses.EXECUTING,
    ActionStatuses.FAILED // E.g., if validation fails immediately before async exec
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
