import Joi from 'joi';
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
import crypto from 'crypto';

const IntentClassifierSchema = Joi.object({
  intent: Joi.string().valid('referral_search', 'match_explanation', 'decision_digest', 'application_status', 'career_query', 'action_proposal').required(),
  confidence: Joi.number().min(0).max(1).required()
});

export class CopilotChatService {
  /**
   * Orchestrates a conversational chat request across existing CareerGraph capabilities.
   * @param {Object} params
   * @param {string} params.userId - Authenticated user ID.
   * @param {string} params.message - Current user query message.
   * @param {Array<{role: string, content: string}>} [params.messages] - Short recent conversation history (max 6).
   * @param {Object} [params.context] - Optional UI entity context ({ jobId, connectionId, applicationId }).
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

    // 1. Sanitize input against prompt injection
    const safeMessage = detectAndSanitizePromptInjection(message.trim());

    // 2. Intercept side-effect actions (Action Safety Guardrail)
    const isSideEffectAction = /\b(send|submit|delete|remove|mutate)\b/i.test(safeMessage) && 
      /\b(email|message|outreach|application|connection|record|crm|data)\b/i.test(safeMessage);

    if (isSideEffectAction && !safeMessage.toLowerCase().includes('draft')) {
      return {
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

    // 3. Authorize and Validate Client-Provided Entity Context
    const authorizedContext = {};
    if (context?.jobId) {
      const dbJob = await models.Job.findOne({ where: { id: context.jobId, user_id: userId } });
      if (dbJob) {
        authorizedContext.jobId = dbJob.id;
        authorizedContext.job = dbJob;
      }
    }

    if (context?.connectionId) {
      const dbConn = await models.Connection.findOne({ where: { id: context.connectionId, user_id: userId } });
      if (dbConn) {
        authorizedContext.connectionId = dbConn.id;
        authorizedContext.connection = dbConn;
      }
    }

    if (context?.applicationId) {
      const dbApp = await models.Application.findOne({ where: { id: context.applicationId, user_id: userId } });
      if (dbApp) {
        authorizedContext.applicationId = dbApp.id;
        authorizedContext.application = dbApp;
      }
    }

    // 4. Intent Routing
    let intent = this.classifyIntentDeterminist(safeMessage);
    let confidence = 0.95;

    if (!intent) {
      // Try AI Intent Classifier if ambiguous
      try {
        const classifierPrompt = `
Classify the following user message into exactly ONE of these intents:
- referral_search (who can refer me, networking, contacts at company)
- match_explanation (why match, why apply, fit for job, match score)
- decision_digest (today's priorities, what to focus on, daily plan)
- application_status (status of applications, interviews, follow-ups)
- career_query (skills, career advice, target roles, resume analysis)

USER MESSAGE: "${safeMessage}"
`;
        const classified = await aiService.generateStructured(classifierPrompt, IntentClassifierSchema, {
          operation: 'copilot_intent_classification',
          userId
        });
        intent = classified.intent;
        confidence = classified.confidence || 0.85;
      } catch (err) {
        console.warn('[CopilotChatService] AI intent classification failed, falling back to career_query:', err.message);
        intent = 'career_query';
        confidence = 0.50;
      }
    }

    // 5. Delegate to Existing Capabilities based on Intent
    let result;
    try {
      switch (intent) {
        case 'action_proposal':
          result = await this.handleActionProposal(userId, safeMessage, authorizedContext);
          break;

        case 'referral_search':
          result = await this.handleReferralSearch(userId, safeMessage, authorizedContext);
          break;

        case 'match_explanation':
          result = await this.handleMatchExplanation(userId, safeMessage, authorizedContext);
          break;

        case 'decision_digest':
          result = await this.handleDecisionDigest(userId, safeMessage);
          break;

        case 'application_status':
          result = await this.handleApplicationStatus(userId, safeMessage);
          break;

        case 'career_query':
        default:
          intent = 'career_query';
          result = await this.handleCareerQuery(userId, safeMessage);
          break;
      }
    } catch (err) {
      console.error(`[CopilotChatService] Error handling intent ${intent}:`, err);
      // Fallback response if handler fails unexpectedly
      result = {
        message: 'I ran into an issue retrieving full information for your request. Here are your general career options.',
        aiStatus: 'unavailable',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?', 'Who can refer me for my top job?']
      };
    }

    const latencyMs = Date.now() - startTime;

    // 6. Record Observability Metadata (No sensitive content logged)
    try {
      await aiObservability.recordRequest({
        userId,
        operation: 'copilot_chat',
        entityType: 'chat',
        entityId: null,
        provider: result.aiStatus === 'success' ? 'copilot' : 'fallback',
        model: 'v1',
        promptVersion: 1,
        schemaVersion: 1,
        latencyMs,
        status: result.aiStatus === 'unavailable' ? 'fallback' : 'success'
      });
    } catch (obsErr) {
      console.warn('[CopilotChatService] Failed to record observability:', obsErr.message);
    }

    return {
      message: result.message,
      intent,
      confidence,
      aiStatus: result.aiStatus || 'success',
      references: result.references || [],
      data: result.data || {},
      suggestedPrompts: result.suggestedPrompts || [
        'Why is this job a good match?',
        'Who can refer me?',
        'What should I focus on today?'
      ]
    };
  }

  /**
   * Deterministically matches obvious keyword patterns to intents.
   */
  static classifyIntentDeterminist(text) {
    const lower = text.toLowerCase();

    // Action proposals
    if (/\b(save.*job|bookmark.*job|track.*job|change.*status|mark.*interested|mark.*rejected|move.*pipeline|update.*status|apply|create.*application|log.*application|remind.*follow.*up|schedule.*follow.*up|follow.*up|draft.*message|draft.*outreach|write.*email|add.*note|write.*note|log.*note)\b/i.test(lower)) {
      return 'action_proposal';
    }

    if (/\b(refer|referral|who can refer|connection at|who should i contact|contact at|network at)\b/i.test(lower)) {
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

    if (/\b(skill|skills|skill gap|target roles|target companies|resume|career advice)\b/i.test(lower)) {
      return 'career_query';
    }

    return null;
  }

  // --- INTENT HANDLERS ---

  static async handleActionProposal(userId, query, context) {
    const targetId = context.jobId || context.connectionId || context.applicationId;
    const requestId = crypto.randomUUID();

    try {
      const planResult = await ActionPlanner.planAction({
        userId,
        intent: query,
        targetDescription: !targetId ? query : null, // If no explicit context, use query to find target
        targetId,
        requestId,
        explanation: 'You asked to perform an action.' // A more specific explanation is generated inside ActionPlanner
      });

      if (planResult.needsInput || planResult.needsClarification) {
        return {
          message: planResult.message,
          aiStatus: 'success',
          references: [],
          data: { 
            needsClarification: planResult.needsClarification,
            candidates: planResult.candidates 
          },
          suggestedPrompts: planResult.candidates 
            ? planResult.candidates.map(c => `Use ${c.label}`) 
            : ['What should I focus on today?']
        };
      }

      return {
        message: 'I have prepared an action plan for you. Please review and confirm it below.',
        aiStatus: 'success',
        references: [],
        data: { actionPlan: planResult.toJSON() },
        suggestedPrompts: ['What should I focus on today?']
      };
    } catch (err) {
      console.error('[CopilotChatService] Error planning action:', err);
      return {
        message: 'I could not create a safe action plan for your request. ' + (err.message || ''),
        aiStatus: 'unavailable',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?']
      };
    }
  }

  static async handleReferralSearch(userId, query, context) {
    let jobId = context.jobId;

    if (!jobId) {
      // Find user's top saved job as target
      const topJob = await models.Job.findOne({
        where: { user_id: userId, isArchived: false },
        order: [['matchScore', 'DESC']]
      });
      if (topJob) jobId = topJob.id;
    }

    if (!jobId) {
      return {
        message: 'No active job opportunities found. Save or import jobs to explore referral paths.',
        aiStatus: 'success',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?', 'What skills should I improve?']
      };
    }

    const referralRes = await ReferralPathAgentService.findReferralPath({ userId, jobId, query });

    const targetJobId = referralRes.job?.id || jobId;
    const targetTitle = referralRes.job?.title || 'Job';
    const targetCompany = referralRes.job?.company || 'Company';

    const references = [
      { type: 'job', id: targetJobId, label: `${targetTitle} at ${targetCompany}` }
    ];

    if (referralRes.recommendedContacts) {
      for (const c of referralRes.recommendedContacts) {
        if (c.connectionId) {
          references.push({ type: 'connection', id: c.connectionId, label: c.name ? `${c.name} (${c.company || targetCompany})` : `Connection ${c.connectionId}` });
        }
      }
    }

    return {
      message: referralRes.summary || 'Here are your top referral connection candidates.',
      aiStatus: referralRes.aiStatus,
      references,
      data: referralRes,
      suggestedPrompts: [
        'Why is this job a good match?',
        'What should I focus on today?',
        'Draft an outreach message'
      ]
    };
  }

  static async handleMatchExplanation(userId, query, context) {
    let jobId = context.jobId;

    if (!jobId) {
      const topJob = await models.Job.findOne({
        where: { user_id: userId, isArchived: false },
        order: [['matchScore', 'DESC']]
      });
      if (topJob) jobId = topJob.id;
    }

    if (!jobId) {
      return {
        message: 'No jobs available to evaluate match explanations. Add jobs to your tracker first.',
        aiStatus: 'success',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?']
      };
    }

    const matchRes = await MatchExplainerService.explainMatch({ userId, jobId, query });

    const targetJobId = matchRes.job?.id || jobId;
    const targetTitle = matchRes.job?.title || 'Job';
    const targetCompany = matchRes.job?.company || 'Company';

    const references = [
      { type: 'job', id: targetJobId, label: `${targetTitle} at ${targetCompany}` }
    ];

    return {
      message: matchRes.explanation || `Deterministic Match Score: ${matchRes.deterministicScore}%`,
      aiStatus: matchRes.aiStatus,
      references,
      data: matchRes,
      suggestedPrompts: [
        'Who can refer me for this job?',
        'What should I focus on today?'
      ]
    };
  }

  static async handleDecisionDigest(userId, query) {
    const todayStr = new Date().toISOString().split('T')[0];
    const digestRes = await DecisionDigestService.generateDigest({ userId, date: todayStr, query });

    const references = [];
    if (digestRes.priorities) {
      for (const p of digestRes.priorities) {
        if (p.entityId) {
          references.push({ type: p.type || 'entity', id: p.entityId, label: p.title });
        }
      }
    }

    return {
      message: digestRes.summary || 'Here is your career decision digest for today.',
      aiStatus: digestRes.aiStatus,
      references,
      data: digestRes,
      suggestedPrompts: [
        'Who can refer me for my top job?',
        'Why is this job a good match?',
        'What applications need follow-up?'
      ]
    };
  }

  static async handleApplicationStatus(userId, query) {
    const applications = await models.Application.findAll({
      where: { user_id: userId },
      include: [
        { model: models.Job, as: 'job' }
      ],
      order: [['updatedAt', 'DESC']],
      limit: 10
    });

    if (!applications || applications.length === 0) {
      return {
        message: 'You currently have no recorded job applications.',
        aiStatus: 'success',
        references: [],
        data: { applications: [] },
        suggestedPrompts: ['What jobs should I focus on today?', 'Who can refer me?']
      };
    }

    const activeApps = applications.filter(a => !['rejected', 'withdrawn'].includes(a.status));
    const followUps = activeApps.filter(a => a.nextFollowUpDate || a.next_follow_up_date);

    const appSummaries = applications.map(a => ({
      applicationId: a.id,
      jobTitle: a.job ? a.job.title : 'Job',
      company: a.job ? a.job.company : 'Company',
      status: a.status,
      nextFollowUpDate: a.nextFollowUpDate || a.next_follow_up_date || null
    }));

    let message = `You have ${applications.length} total application(s) logged (${activeApps.length} active).`;
    if (followUps.length > 0) {
      message += ` ${followUps.length} application(s) have follow-ups scheduled.`;
    }

    // Optionally synthesize natural summary with AI if enabled
    let aiStatus = 'success';
    try {
      const summaryPrompt = `
Summarize the following application statuses concisely for the user:
${JSON.stringify(appSummaries, null, 2)}
`;
      const aiSummary = await aiService.generateText(summaryPrompt, {
        operation: 'copilot_application_status',
        userId
      });
      if (aiSummary) message = aiSummary;
    } catch (err) {
      aiStatus = 'unavailable';
    }

    const references = appSummaries.map(a => ({
      type: 'application',
      id: a.applicationId,
      label: `${a.jobTitle} at ${a.company} (${a.status})`
    }));

    return {
      message,
      aiStatus,
      references,
      data: { applications: appSummaries },
      suggestedPrompts: [
        'What should I focus on today?',
        'Who can refer me for my top job?'
      ]
    };
  }

  static async handleCareerQuery(userId, query) {
    const contextPackage = await ContextBuilder.buildContext(userId, {
      intent: 'career_query',
      query
    });

    const resume = contextPackage.entities.resume;
    const skills = resume?.skills || [];

    let message = `Based on your profile, your key skills include: ${skills.join(', ') || 'Node.js, PostgreSQL'}.`;
    let aiStatus = 'success';

    try {
      const prompt = `
Answer the user's career query using ONLY the provided context package.
USER QUERY: "${query}"
CONTEXT PACKAGE: ${JSON.stringify(contextPackage.entities, null, 2)}
`;
      const aiResponse = await aiService.generateText(prompt, {
        operation: 'copilot_career_query',
        userId
      });
      if (aiResponse) message = aiResponse;
    } catch (err) {
      aiStatus = 'unavailable';
    }

    const references = (contextPackage.sources || []).map(src => ({
      type: src.split(':')[0],
      id: src.split(':')[1] || src,
      label: src
    }));

    return {
      message,
      aiStatus,
      references,
      data: { contextPackage },
      suggestedPrompts: [
        'What should I focus on today?',
        'Who can refer me for my top job?',
        'Why is my top job a good match?'
      ]
    };
  }
}
