import { sequelize, models } from '../../config/database.js';
import { ActionValidator } from './action-validator.js';
import { ActionStatuses, ActionTypes, TargetTypes, JOB_STATUSES, APPLICATION_STATUSES } from './action-registry.js';
import { ActionValidationError } from './action.error.js';
import { getRedisClient } from '../../config/queue.js';

// Fallback in-memory state tracking if Redis is unavailable
const memoryStateTracker = new Map();
const memoryResultTracker = new Map();

export class ActionExecutor {
  /**
   * Main entrypoint for executing confirmed actions.
   * Supports both object parameters { action, authenticatedUserId, requestId }
   * and positional arguments (action, authenticatedUserId, requestId).
   * 
   * @param {Object|ActionModel} paramsOrAction 
   * @param {string} [authenticatedUserIdArg] 
   * @param {string} [requestIdArg] 
   * @returns {Promise<Object>} Execution result contract
   */
  static async executeAction(paramsOrAction, authenticatedUserIdArg, requestIdArg) {
    let action, authenticatedUserId, requestId;

    if (paramsOrAction && typeof paramsOrAction === 'object' && paramsOrAction.action) {
      action = paramsOrAction.action;
      authenticatedUserId = paramsOrAction.authenticatedUserId;
      requestId = paramsOrAction.requestId || action.requestId || 'req-exec';
    } else {
      action = paramsOrAction;
      authenticatedUserId = authenticatedUserIdArg;
      requestId = requestIdArg || (action && action.requestId) || 'req-exec';
    }

    if (!action) {
      throw new ActionValidationError('Action is required');
    }

    // 1. Authenticated User Check
    if (!authenticatedUserId) {
      throw new Error('Unauthenticated request');
    }

    // 2. Ownership / Tenant Isolation Check
    if (action.userId !== authenticatedUserId) {
      throw new Error('Unauthorized: Cannot execute action belonging to another user');
    }

    // 3. Action Contract Integrity Validation
    ActionValidator.validateActionContract(action);

    // 4. Expiration Re-Check Immediately Before Execution
    if (action.expiresAt < new Date()) {
      throw new ActionValidationError('Action has expired');
    }

    // 5. Idempotency Check & Atomic Execution Locking (First check if already completed)
    const currentTrackedStatus = await this._getTrackedStatus(action.actionId);
    if (currentTrackedStatus === ActionStatuses.COMPLETED) {
      const cachedResult = await this._getTrackedResult(action.actionId);
      if (cachedResult) {
        return cachedResult;
      }
      return {
        actionId: action.actionId,
        status: ActionStatuses.COMPLETED,
        actionType: action.actionType,
        target: action.target,
        result: { message: 'Action already completed' },
        executedAt: new Date()
      };
    }

    if (currentTrackedStatus === ActionStatuses.EXECUTING) {
      throw new ActionValidationError('Action is currently executing in another process.');
    }

    if (currentTrackedStatus && currentTrackedStatus !== ActionStatuses.CONFIRMED) {
      throw new ActionValidationError(`Cannot execute action with tracked status: ${currentTrackedStatus}`);
    }

    // 6. Status Validation (Action object must be CONFIRMED if not already completed)
    if (action.status !== ActionStatuses.CONFIRMED) {
      throw new ActionValidationError(`Cannot execute action with status: ${action.status}. Status must be confirmed.`);
    }

    // Lock and transition to EXECUTING state
    await this._setTrackedStatus(action.actionId, ActionStatuses.EXECUTING);
    action.status = ActionStatuses.EXECUTING;

    const startTime = Date.now();
    let executionResult = null;

    try {
      // 7. Verify Target Ownership & Execute Domain Operation
      executionResult = await this._dispatchDomainAction(action, authenticatedUserId);

      // 8. Transition to COMPLETED
      await this._setTrackedStatus(action.actionId, ActionStatuses.COMPLETED);
      action.status = ActionStatuses.COMPLETED;

      const response = {
        actionId: action.actionId,
        status: ActionStatuses.COMPLETED,
        actionType: action.actionType,
        target: action.target,
        result: executionResult,
        executedAt: new Date()
      };

      await this._setTrackedResult(action.actionId, response);

      // 9. Record Audit Success
      await this._recordAudit({
        userId: authenticatedUserId,
        action,
        status: 'success',
        latencyMs: Date.now() - startTime,
        requestId
      });

      return response;
    } catch (err) {
      // Mark FAILED on domain error
      await this._setTrackedStatus(action.actionId, ActionStatuses.FAILED);
      action.status = ActionStatuses.FAILED;

      // Record Audit Failure
      await this._recordAudit({
        userId: authenticatedUserId,
        action,
        status: 'failed',
        latencyMs: Date.now() - startTime,
        requestId,
        error: err.message
      });

      throw err;
    }
  }

  /**
   * Helper to safely extract owner user ID from a Sequelize model instance
   */
  static _getEntityUserId(entity) {
    if (!entity) return null;
    return entity.user_id ?? entity.userId ?? (typeof entity.get === 'function' ? entity.get('user_id') : null);
  }

  /**
   * Dispatches execution to the corresponding domain handler based on actionType
   */
  static async _dispatchDomainAction(action, authenticatedUserId) {
    const { actionType, target, payload } = action;

    switch (actionType) {
      case ActionTypes.SAVE_JOB:
        return await this._executeSaveJob(target, payload, authenticatedUserId);

      case ActionTypes.CHANGE_JOB_STATUS:
        return await this._executeChangeJobStatus(target, payload, authenticatedUserId);

      case ActionTypes.CREATE_APPLICATION:
        return await this._executeCreateApplication(target, payload, authenticatedUserId);

      case ActionTypes.CHANGE_APPLICATION_STATUS:
        return await this._executeChangeApplicationStatus(target, payload, authenticatedUserId);

      case ActionTypes.SCHEDULE_FOLLOWUP:
        return await this._executeScheduleFollowup(target, payload, authenticatedUserId);

      case ActionTypes.CREATE_OUTREACH_DRAFT:
        return await this._executeCreateOutreachDraft(target, payload, authenticatedUserId);

      case ActionTypes.ADD_NOTE:
        return await this._executeAddNote(target, payload, authenticatedUserId);

      default:
        throw new ActionValidationError(`Unsupported action type: ${actionType}`);
    }
  }

  /**
   * Action: save_job
   */
  static async _executeSaveJob(target, payload, authenticatedUserId) {
    const jobId = target.id;
    const job = await models.Job.findByPk(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const jobOwnerId = this._getEntityUserId(job);
    if (jobOwnerId && jobOwnerId !== authenticatedUserId) {
      throw new Error('Unauthorized: Job belongs to another user.');
    }

    if (job.status !== 'saved') {
      await job.update({ status: 'saved', user_id: authenticatedUserId });
    }

    return {
      jobId: job.id,
      title: job.title,
      status: job.status,
      savedAt: new Date()
    };
  }

  /**
   * Action: change_job_status
   */
  static async _executeChangeJobStatus(target, payload, authenticatedUserId) {
    const jobId = target.id;
    const newStatus = payload?.status || payload?.jobStatus || payload?.newStatus;
    if (!newStatus || typeof newStatus !== 'string' || !newStatus.trim()) {
      throw new ActionValidationError('Valid status string is required.');
    }
    const cleanStatus = newStatus.trim();

    if (!JOB_STATUSES.includes(cleanStatus)) {
      throw new ActionValidationError(`Invalid job status '${cleanStatus}'. Supported statuses are: ${JOB_STATUSES.join(', ')}.`);
    }

    const job = await models.Job.findByPk(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const jobOwnerId = this._getEntityUserId(job);
    if (jobOwnerId && jobOwnerId !== authenticatedUserId) {
      throw new Error('Unauthorized: Job belongs to another user.');
    }

    await job.update({ status: cleanStatus });

    return {
      jobId: job.id,
      status: job.status,
      updatedAt: new Date()
    };
  }

  /**
   * Action: create_application (Transactional multi-write)
   */
  static async _executeCreateApplication(target, payload, authenticatedUserId) {
    const jobId = target.id || payload?.jobId;
    const job = await models.Job.findByPk(jobId);
    if (!job) {
      throw new Error(`Job with ID ${jobId} not found.`);
    }

    const jobOwnerId = this._getEntityUserId(job);
    if (jobOwnerId && jobOwnerId !== authenticatedUserId) {
      throw new Error('Unauthorized: Job belongs to another user.');
    }

    // Verify resume ownership if provided, or fallback to active resume
    let resumeId = payload?.resumeId;
    if (resumeId) {
      const resume = await models.Resume.findOne({
        where: { id: resumeId, user_id: authenticatedUserId }
      });
      if (!resume) {
        throw new Error(`Unauthorized or invalid Resume ID ${resumeId}.`);
      }
    } else {
      const activeResume = await models.Resume.findOne({
        where: { user_id: authenticatedUserId, isActive: true }
      });
      if (activeResume) {
        resumeId = activeResume.id;
      } else {
        const err = new ActionValidationError('A resume is required before creating this application.', 'RESUME_REQUIRED');
        err.code = 'RESUME_REQUIRED';
        throw err;
      }
    }

    // Verify referral connection ownership if provided
    const referralConnectionId = payload?.referralConnectionId;
    if (referralConnectionId) {
      const connection = await models.Connection.findOne({
        where: { id: referralConnectionId, user_id: authenticatedUserId }
      });
      if (!connection) {
        throw new Error(`Unauthorized or invalid Connection ID ${referralConnectionId}.`);
      }
    }

    // Duplicate application check
    const existingApp = await models.Application.findOne({
      where: { job_id: jobId, user_id: authenticatedUserId }
    });
    if (existingApp) {
      return {
        status: 'already_exists',
        applicationId: existingApp.id,
        jobId: existingApp.get('job_id') || jobId,
        applicationStatus: existingApp.status,
        message: 'Application already exists for this job.',
        createdAt: existingApp.createdAt
      };
    }

    // Sequelize Transaction
    const t = await sequelize.transaction();
    try {
      const appStatus = payload?.status || 'applied';
      const application = await models.Application.create(
        {
          user_id: authenticatedUserId,
          job_id: jobId,
          status: appStatus,
          appliedAt: new Date(),
          resumeId: resumeId || null,
          coverLetter: payload?.coverLetter || null,
          referralConnectionId: referralConnectionId || null,
          notes: payload?.notes || null
        },
        { transaction: t }
      );

      const appEvent = await models.ApplicationEvent.create(
        {
          application_id: application.id,
          user_id: authenticatedUserId,
          status: appStatus,
          eventType: 'CREATED',
          notes: 'Application created via AI Action Executor',
          occurredAt: new Date()
        },
        { transaction: t }
      );

      await t.commit();

      return {
        applicationId: application.id,
        eventId: appEvent.id,
        jobId: application.get('job_id') || jobId,
        status: application.status,
        createdAt: application.createdAt
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Action: change_application_status
   */
  static async _executeChangeApplicationStatus(target, payload, authenticatedUserId) {
    const applicationId = target.id;
    const newStatus = payload?.status || payload?.applicationStatus || payload?.newStatus;
    if (!newStatus || typeof newStatus !== 'string' || !newStatus.trim()) {
      throw new ActionValidationError('Valid application status string is required.');
    }
    const cleanStatus = newStatus.trim();
    if (!APPLICATION_STATUSES.includes(cleanStatus)) {
      throw new ActionValidationError(`Invalid application status '${cleanStatus}'. Supported statuses are: ${APPLICATION_STATUSES.join(', ')}.`);
    }

    const application = await models.Application.findOne({
      where: { id: applicationId, user_id: authenticatedUserId }
    });
    if (!application) {
      throw new Error(`Unauthorized or Application with ID ${applicationId} not found.`);
    }

    const t = await sequelize.transaction();
    try {
      await application.update({ status: cleanStatus, lastStatusAt: new Date() }, { transaction: t });

      const appEvent = await models.ApplicationEvent.create(
        {
          application_id: application.id,
          user_id: authenticatedUserId,
          status: cleanStatus,
          eventType: 'STATUS_CHANGE',
          notes: `Application status changed to ${cleanStatus} via AI Action Executor`,
          occurredAt: new Date()
        },
        { transaction: t }
      );

      await t.commit();

      return {
        applicationId: application.id,
        eventId: appEvent.id,
        status: application.status,
        updatedAt: new Date()
      };
    } catch (err) {
      await t.rollback();
      throw err;
    }
  }

  /**
   * Action: schedule_followup
   */
  static async _executeScheduleFollowup(target, payload, authenticatedUserId) {
    const followUpDateStr = payload?.followUpAt || payload?.followUpDate || payload?.date;
    if (!followUpDateStr) {
      throw new ActionValidationError('followUpAt is required to schedule follow-up.');
    }
    const followUpDate = new Date(followUpDateStr);
    if (isNaN(followUpDate.getTime())) {
      throw new ActionValidationError('Invalid followUpAt date format.');
    }

    const targetType = target.type;
    const targetId = target.id;

    if (targetType === TargetTypes.JOB) {
      const job = await models.Job.findByPk(targetId);
      if (!job) {
        throw new Error(`Job with ID ${targetId} not found.`);
      }
      const jobOwner = this._getEntityUserId(job);
      if (jobOwner && jobOwner !== authenticatedUserId) {
        throw new Error('Unauthorized: Job belongs to another user.');
      }
      let app = await models.Application.findOne({ where: { job_id: targetId, user_id: authenticatedUserId } });
      if (app) {
        await app.update({ nextFollowUpDate: followUpDate });
      } else {
        let outreach = await models.Outreach.findOne({ where: { job_id: targetId, user_id: authenticatedUserId } });
        if (outreach) {
          await outreach.update({ followUpDate: followUpDate });
        } else {
          await models.Outreach.create({
            user_id: authenticatedUserId,
            job_id: targetId,
            status: 'researching',
            followUpDate: followUpDate,
            notes: 'Follow-up scheduled via Action Executor'
          });
        }
      }
    } else if (targetType === TargetTypes.APPLICATION) {
      const app = await models.Application.findOne({ where: { id: targetId, user_id: authenticatedUserId } });
      if (!app) {
        throw new Error(`Unauthorized or Application with ID ${targetId} not found.`);
      }
      await app.update({ nextFollowUpDate: followUpDate });
    } else if (targetType === TargetTypes.CONNECTION) {
      const conn = await models.Connection.findOne({ where: { id: targetId, user_id: authenticatedUserId } });
      if (!conn) {
        throw new Error(`Unauthorized or Connection with ID ${targetId} not found.`);
      }
      let outreach = await models.Outreach.findOne({ where: { connection_id: targetId, user_id: authenticatedUserId } });
      if (outreach) {
        await outreach.update({ followUpDate: followUpDate });
      } else {
        await models.Outreach.create({
          user_id: authenticatedUserId,
          connection_id: targetId,
          status: 'researching',
          followUpDate: followUpDate,
          notes: 'Follow-up scheduled via Action Executor'
        });
      }
    } else if (targetType === TargetTypes.OUTREACH) {
      const outreach = await models.Outreach.findOne({ where: { id: targetId, user_id: authenticatedUserId } });
      if (!outreach) {
        throw new Error(`Unauthorized or Outreach with ID ${targetId} not found.`);
      }
      await outreach.update({ followUpDate: followUpDate });
    } else {
      throw new ActionValidationError(`Target type ${targetType} not supported for schedule_followup.`);
    }

    return {
      targetType,
      targetId,
      followUpDate: followUpDate.toISOString(),
      scheduledAt: new Date()
    };
  }

  /**
   * Action: create_outreach_draft
   */
  static async _executeCreateOutreachDraft(target, payload, authenticatedUserId) {
    const connectionId = target.id;
    const connection = await models.Connection.findOne({
      where: { id: connectionId, user_id: authenticatedUserId }
    });
    if (!connection) {
      throw new Error(`Unauthorized or Connection with ID ${connectionId} not found.`);
    }

    let jobId = payload?.jobId || null;
    if (jobId) {
      const job = await models.Job.findByPk(jobId);
      if (!job) {
        throw new Error(`Job with ID ${jobId} not found.`);
      }
    }

    const draftText = payload?.message || payload?.draft || payload?.text || `Hi ${connection.name || 'there'}, I wanted to reach out regarding career opportunities.`;
    const draftRecord = await models.OutreachAiDraft.create({
      userId: authenticatedUserId,
      connectionId: connection.id,
      jobId: jobId,
      intent: payload?.intent || 'referral_request',
      tone: payload?.tone || 'professional',
      length: payload?.length || 'medium',
      provider: 'action-executor',
      model: 'system',
      promptVersion: '1.0',
      draft: draftText,
      personalizationPoints: payload?.personalizationPoints || [],
      status: 'generated'
    });

    return {
      draftId: draftRecord.id,
      connectionId: connection.id,
      jobId,
      draft: draftRecord.draft,
      status: draftRecord.status,
      createdAt: draftRecord.createdAt,
      note: 'Draft created successfully. No external message was sent.'
    };
  }

  /**
   * Action: add_note
   */
  static async _executeAddNote(target, payload, authenticatedUserId) {
    const content = payload?.content || payload?.note || payload?.text;
    if (!content || typeof content !== 'string' || !content.trim()) {
      throw new ActionValidationError('Note content is required.');
    }
    if (content.length > 2000) {
      throw new ActionValidationError('Note content exceeds maximum length of 2000.');
    }

    const { type: targetType, id: targetId } = target;

    if (targetType === TargetTypes.JOB) {
      const job = await models.Job.findByPk(targetId);
      if (!job) {
        throw new Error(`Job with ID ${targetId} not found.`);
      }
      const jobOwner = this._getEntityUserId(job);
      if (jobOwner && jobOwner !== authenticatedUserId) {
        throw new Error('Unauthorized: Job belongs to another user.');
      }
    } else if (targetType === TargetTypes.CONNECTION) {
      const conn = await models.Connection.findOne({ where: { id: targetId, user_id: authenticatedUserId } });
      if (!conn) {
        throw new Error(`Unauthorized or Connection with ID ${targetId} not found.`);
      }
    } else if (targetType === TargetTypes.APPLICATION) {
      const app = await models.Application.findOne({ where: { id: targetId, user_id: authenticatedUserId } });
      if (!app) {
        throw new Error(`Unauthorized or Application with ID ${targetId} not found.`);
      }
    }

    const note = await models.Note.create({
      userId: authenticatedUserId,
      entityType: targetType,
      entityId: targetId,
      content: content.trim()
    });

    return {
      noteId: note.id,
      targetType,
      targetId,
      content: note.content,
      createdAt: note.createdAt
    };
  }

  /**
   * Audit Logger Helper
   */
  static async _recordAudit({ userId, action, status, latencyMs, requestId, error }) {
    try {
      if (models.AiAuditLog) {
        await models.AiAuditLog.create({
          userId: userId,
          operation: 'ACTION_EXECUTION',
          entityType: action.target?.type || 'action',
          entityId: action.target?.id || action.actionId,
          provider: 'action-executor',
          model: action.actionType,
          promptVersion: 1,
          schemaVersion: 1,
          latencyMs: latencyMs,
          status: status,
          correlationId: requestId
        });
      }
    } catch (e) {
      console.error('Failed to record audit log:', e.message);
    }
  }

  /**
   * Idempotency & State Tracking Helpers
   */
  static async _getTrackedStatus(actionId) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      return await redis.get(`action:state:${actionId}`);
    }
    return memoryStateTracker.get(actionId);
  }

  static async _setTrackedStatus(actionId, status) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.set(`action:state:${actionId}`, status, 'EX', 15 * 60);
    } else {
      memoryStateTracker.set(actionId, status);
      setTimeout(() => memoryStateTracker.delete(actionId), 15 * 60 * 1000).unref();
    }
  }

  static async _getTrackedResult(actionId) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      const val = await redis.get(`action:result:${actionId}`);
      return val ? JSON.parse(val) : null;
    }
    return memoryResultTracker.get(actionId) || null;
  }

  static async _setTrackedResult(actionId, result) {
    const redis = getRedisClient();
    if (redis && redis.status === 'ready') {
      await redis.set(`action:result:${actionId}`, JSON.stringify(result), 'EX', 15 * 60);
    } else {
      memoryResultTracker.set(actionId, result);
      setTimeout(() => memoryResultTracker.delete(actionId), 15 * 60 * 1000).unref();
    }
  }
}
