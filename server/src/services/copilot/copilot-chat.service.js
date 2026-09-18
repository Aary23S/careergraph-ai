import Joi from 'joi';
import { Op } from 'sequelize';
import { AppError } from '../../lib/http.js';
import { models } from '../../config/database.js';
import { aiService } from '../ai/ai.service.js';
import { detectAndSanitizePromptInjection } from '../ai/guardrails.service.js';
import { aiObservability } from '../ai/observability.service.js';
import { ContextBuilder } from './context/context-builder.service.js';
import { ReferralPathAgentService } from './referral-path-agent.service.js';
import { MatchExplainerService } from './match-explainer.service.js';
import { DecisionDigestService } from './decision-digest.service.js';
import { ActionPlanner } from '../actions/action-planner.service.js';
import { QueryUnderstandingService } from './query-understanding.service.js';
import { CopilotToolRegistry } from './copilot-tool-registry.js';
import { GroundingContract, GroundingStatuses } from './grounding-contract.js';
import crypto from 'crypto';

export class CopilotChatService {
  /**
   * Main Entry Point for Grounded Copilot Chat.
   * Executes deterministic query understanding, tool registry dispatching, and evidence grounding.
   */
  static async sendChat({ userId, message, messages = [], context = {} }) {
    if (!userId) {
      throw new AppError(401, 'UNAUTHORIZED', 'Authentication required.');
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new AppError(400, 'BAD_REQUEST', 'Message is required.');
    }

    if (message.length > 2000) {
      throw new AppError(400, 'BAD_REQUEST', 'Message exceeds maximum length of 2000 characters.');
    }

    if (messages && messages.length > 6) {
      throw new AppError(400, 'BAD_REQUEST', 'Conversation history exceeds maximum limit of 6 messages.');
    }

    const startTime = Date.now();
    const safeMessage = detectAndSanitizePromptInjection(message.trim());

    // 1. Action Safety Guardrail: Intercept side-effect actions
    const isSideEffectAction = /\b(send|submit|delete|remove|mutate)\b/i.test(safeMessage) && 
      /\b(email|message|outreach|application|connection|record|crm|data)\b/i.test(safeMessage);

    if (isSideEffectAction && !safeMessage.toLowerCase().includes('draft')) {
      return {
        type: 'answer',
        message: 'I can analyze opportunities or help draft outreach, but executing side-effect actions (like sending emails or updating records) is not performed automatically. You can review and execute actions directly in the application interface.',
        intent: 'action_blocked',
        confidence: 1.0,
        aiStatus: 'success',
        references: [],
        data: { actionBlocked: true },
        suggestedPrompts: [
          'Draft an outreach message',
          'Who can refer me for my top job?',
          'Why is this job a good match?'
        ]
      };
    }

    // 2. Intercept explicit action proposal requests
    const isExplicitActionExecution = this.classifyIntentDeterminist(safeMessage) === 'action_proposal';

    if (isExplicitActionExecution) {
      const actionResult = await this.handleActionProposal(userId, safeMessage, context, messages);
      return {
        ...actionResult,
        intent: 'action_proposal',
        confidence: 0.95,
        grounding: { status: GroundingStatuses.GROUNDED, sourceCount: 1, fallbackUsed: false }
      };
    }

    // 3. Authorize Client Entity Context (Prevent Cross-Tenant Leakage)
    const authorizedContext = {};
    if (context?.jobId) {
      const dbJob = await models.Job.findOne({ where: { id: context.jobId, user_id: userId } });
      if (dbJob) authorizedContext.jobId = dbJob.id;
    }
    if (context?.connectionId) {
      const dbConn = await models.Connection.findOne({ where: { id: context.connectionId, user_id: userId } });
      if (dbConn) authorizedContext.connectionId = dbConn.id;
    }
    if (context?.applicationId) {
      const dbApp = await models.Application.findOne({ where: { id: context.applicationId, user_id: userId } });
      if (dbApp) authorizedContext.applicationId = dbApp.id;
    }

    // 4. Query Understanding & Entity Resolution
    const understanding = QueryUnderstandingService.understandQuery({
      message: safeMessage,
      conversationContext: authorizedContext,
      selectedContext: authorizedContext,
      userId
    });

    const companyName = understanding.entities.company?.value;
    const personName = understanding.entities.person?.value;
    const jobTitle = understanding.entities.job?.value;

    let groundedResult;

    // 5. Tool Dispatching via Registry
    switch (understanding.intent) {
      case 'connection_search':
        groundedResult = await CopilotToolRegistry.searchConnections({
          userId,
          company: companyName,
          person: personName,
          fallbackAllowed: !understanding.entities.company
        });
        break;

      case 'referral_search':
        if (companyName || personName) {
          const connRes = await CopilotToolRegistry.searchConnections({
            userId,
            company: companyName,
            person: personName,
            fallbackAllowed: false
          });
          if (connRes.grounding.status !== GroundingStatuses.NO_DATA) {
            groundedResult = connRes;
            break;
          }
        }

        const targetJobRes = await this.resolveTargetJob(userId, safeMessage, authorizedContext.jobId);
        if (targetJobRes?.job) {
          groundedResult = await CopilotToolRegistry.getReferralCandidates({
            userId,
            jobId: targetJobRes.job.id,
            company: companyName || targetJobRes.job.company,
            jobTitle: jobTitle || targetJobRes.job.title
          });
        } else {
          groundedResult = await CopilotToolRegistry.searchConnections({
            userId,
            company: companyName,
            person: personName,
            fallbackAllowed: false
          });
        }
        break;

      case 'draft_outreach':
        groundedResult = await CopilotToolRegistry.generateOutreachDraft({
          userId,
          personName,
          company: companyName
        });
        break;

      case 'job_search':
        groundedResult = await CopilotToolRegistry.searchJobs({
          userId,
          company: companyName,
          jobTitle
        });
        break;

      case 'application_status':
        groundedResult = await CopilotToolRegistry.getApplicationStatus({
          userId,
          company: companyName
        });
        break;

      case 'match_explanation':
        groundedResult = await CopilotToolRegistry.getMatchBreakdown({
          userId,
          jobId: authorizedContext.jobId
        });
        break;

      case 'decision_digest':
        groundedResult = await CopilotToolRegistry.getDecisionDigest({ userId });
        break;

      case 'unsupported':
        groundedResult = GroundingContract.format({
          answerType: 'unsupported_query',
          message: companyName 
            ? `I do not have verified hiring or internal operational records for ${companyName} in your database. You can track job postings or add imported connections for ${companyName} to build verified data.`
            : `I do not have verified records for that specific question in your CareerGraph database. You can add CRM connections or job postings to track this data.`,
          data: {},
          references: [],
          status: GroundingStatuses.NO_DATA,
          sourceCount: 0,
          suggestedPrompts: ['What should I focus on today?', 'Show my applications', 'Show my network']
        });
        break;

      case 'career_query':
      default:
        groundedResult = GroundingContract.format({
          answerType: 'career_query',
          message: 'To optimize for senior technical roles, focus on expanding high-impact system architecture experience, leading technical projects, and securing warm referrals from senior engineering leaders.',
          data: {},
          references: [],
          status: GroundingStatuses.GROUNDED,
          sourceCount: 0,
          suggestedPrompts: ['What should I focus on today?', 'Who can refer me for my top job?']
        });
        break;
    }

    const latencyMs = Date.now() - startTime;

    // Record Observability Metrics
    try {
      await aiObservability.recordRequest({
        userId,
        operation: 'copilot_chat',
        entityType: 'chat',
        entityId: null,
        provider: 'copilot-grounded',
        model: understanding.intent,
        promptVersion: 1,
        schemaVersion: 1,
        latencyMs,
        status: groundedResult.grounding.status
      });
    } catch (obsErr) {
      console.warn('[CopilotChatService] Failed to record observability:', obsErr.message);
    }

    return {
      type: 'answer',
      message: groundedResult.message,
      intent: understanding.intent,
      confidence: understanding.confidence,
      aiStatus: 'success',
      references: groundedResult.references,
      data: groundedResult.data,
      grounding: groundedResult.grounding,
      suggestedPrompts: groundedResult.suggestedPrompts
    };
  }

  static classifyIntentDeterminist(text) {
    if (!text || typeof text !== 'string') return null;
    const lower = text.toLowerCase();

    if (/\b(save.*job|bookmark.*job|track.*job|change.*status|mark.*interested|mark.*applying|mark.*interviewing|mark.*offer|mark.*rejected|mark.*contacted|mark.*conversation|set.*relationship|move.*pipeline|update.*status|apply.*to|create.*application|log.*application|remind.*follow.*up|schedule.*follow.*up|follow.*up|draft.*outreach|create.*message|create.*email|personalized email|send.*email|send.*message|add.*note|write.*note|log.*note|remember.*that|note.*that|i.*contacted|log.*outreach|record.*outreach|log.*messaged)\b/i.test(lower)) {
      return 'action_proposal';
    }

    if (/\b(refer|referral|who can refer|connection|connections|contacts|who should i contact|contact at|contact in|network at|network in|who works at|who works in)\b/i.test(lower)) {
      return 'referral_search';
    }

    if (/\b(why match|why is this a match|match explanation|why should i apply|good match|match score|fit for this job|match percentage)\b/i.test(lower)) {
      return 'match_explanation';
    }

    if (/\b(what should i focus|today|priority|priorities|what should i do|daily plan|digest|career brief)\b/i.test(lower)) {
      return 'decision_digest';
    }

    if (/\b(application status|applications|interviews|offers|application progress|follow-up|follow up|applied jobs|status of my application)\b/i.test(lower)) {
      return 'application_status';
    }

    return null;
  }

  static async resolveTargetJob(userId, query, explicitJobId) {
    if (explicitJobId) {
      const explicitJob = await models.Job.findOne({ where: { id: explicitJobId, user_id: userId } });
      if (explicitJob) return { job: explicitJob, isDirectMatch: true };
    }

    const likeOp = models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;

    if (query) {
      const cleanWords = query.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !['who', 'can', 'refer', 'me', 'in', 'at', 'for', 'my', 'top', 'job', 'position', 'role'].includes(w));

      if (cleanWords.length > 0) {
        const matchingJob = await models.Job.findOne({
          where: {
            user_id: userId,
            isArchived: false,
            [Op.or]: cleanWords.flatMap(w => [
              { normalizedCompany: { [likeOp]: `%${w}%` } },
              { title: { [likeOp]: `%${w}%` } }
            ])
          },
          order: [['updatedAt', 'DESC']]
        });

        if (matchingJob) return { job: matchingJob, isDirectMatch: true };
      }
    }

    const topJob = await models.Job.findOne({
      where: { user_id: userId, isArchived: false },
      order: [['updatedAt', 'DESC']]
    });

    if (topJob) {
      return { job: topJob, isDirectMatch: false };
    }

    return null;
  }

  static async handleActionProposal(userId, query, context, messages = []) {
    const requestId = crypto.randomUUID();
    const planResult = await ActionPlanner.planAction({
      userId,
      intent: query,
      targetDescription: query,
      targetId: context?.connectionId || context?.jobId || context?.applicationId || null,
      requestId,
      explanation: `You asked Copilot: "${query}"`
    });

    const actionPlanJson = typeof planResult.toJSON === 'function' ? planResult.toJSON() : planResult;
    const actionModel = planResult.action || (actionPlanJson ? actionPlanJson.action : null) || {};

    return {
      type: 'action_preview',
      actionId: actionModel.actionId || `act-${Date.now()}`,
      actionType: actionModel.actionType || 'create_outreach_draft',
      preview: planResult.preview || {},
      requiresConfirmation: true,
      message: `I have prepared an action plan for your request. Please review and confirm it below:`,
      aiStatus: 'success',
      references: [
        { type: actionModel.target?.type || 'connection', id: actionModel.target?.id || 'system' }
      ],
      data: { actionPlan: actionPlanJson },
      suggestedPrompts: ['What should I focus on today?']
    };
  }
}
