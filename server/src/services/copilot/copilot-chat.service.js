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
          result = await this.handleActionProposal(userId, safeMessage, authorizedContext, messages);
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
        type: 'error',
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
      type: result.type || (intent === 'action_proposal' ? 'action_preview' : 'answer'),
      actionId: result.actionId || null,
      actionType: result.actionType || null,
      preview: result.preview || null,
      requiresConfirmation: result.requiresConfirmation || false,
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

    // Action proposals (including message drafting, outreach creation, and status updates)
    if (/\b(save.*job|bookmark.*job|track.*job|change.*status|mark.*interested|mark.*applying|mark.*interviewing|mark.*offer|mark.*rejected|mark.*contacted|mark.*conversation|set.*relationship|move.*pipeline|update.*status|apply.*to|create.*application|log.*application|remind.*follow.*up|schedule.*follow.*up|follow.*up|draft.*message|draft.*outreach|draft.*referral|draft.*email|create.*email|write.*email|prepare.*email|send.*email|email to|email for|personalized email|prepare.*referral|add.*note|write.*note|log.*note|remember.*that|note.*that|i.*contacted|log.*outreach|record.*outreach|log.*messaged|create.*message|write.*message|send.*message|prepare.*message|message to|message for|draft.*to|outreach.*to|connect.*with)\b/i.test(lower)) {
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

    if (/\b(skill|skills|skill gap|target roles|target companies|resume|career advice)\b/i.test(lower)) {
      return 'career_query';
    }

    return null;
  }

  static async resolveConversationContext(userId, query = '', context = {}, messages = []) {
    let jobId = context.jobId || null;
    let connectionId = context.connectionId || null;
    let applicationId = context.applicationId || null;

    const likeOp = models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;

    // 1. Search for explicit person name or company in query (e.g. "Hari Bala Ganesh")
    if (query) {
      const cleanWords = query.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length >= 2 && !['create', 'a', 'the', 'professional', 'message', 'to', 'for', 'send', 'write', 'draft', 'outreach', 'email', 'referral', 'who', 'can', 'refer', 'me', 'in', 'at', 'my', 'top', 'job', 'position', 'role'].includes(w));

      if (cleanWords.length > 0) {
        const matchedConn = await models.Connection.findOne({
          where: {
            user_id: userId,
            [Op.or]: cleanWords.map(w => ({ name: { [likeOp]: `%${w}%` } }))
          }
        });

        if (matchedConn) {
          connectionId = matchedConn.id;
          if (!jobId && matchedConn.company) {
            const connJob = await models.Job.findOne({
              where: {
                user_id: userId,
                isArchived: false,
                normalizedCompany: { [likeOp]: `%${matchedConn.company.toLowerCase().trim()}%` }
              }
            });
            if (connJob) jobId = connJob.id;
          }
        }
      }
    }

    // 2. Inherit from recent message history references
    if (Array.isArray(messages) && messages.length > 0) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.references && Array.isArray(msg.references)) {
          if (!connectionId) {
            const connRef = msg.references.find(r => r.type === 'connection');
            if (connRef?.id) connectionId = connRef.id;
          }
          if (!jobId) {
            const jobRef = msg.references.find(r => r.type === 'job');
            if (jobRef?.id) jobId = jobRef.id;
          }
          if (!applicationId) {
            const appRef = msg.references.find(r => r.type === 'application');
            if (appRef?.id) applicationId = appRef.id;
          }
        }
      }
    }

    return { jobId, connectionId, applicationId };
  }

  // --- INTENT HANDLERS ---

  static async handleActionProposal(userId, query, context, messages = []) {
    const resolvedCtx = await this.resolveConversationContext(userId, query, context, messages);
    let targetId = resolvedCtx.connectionId || resolvedCtx.jobId || resolvedCtx.applicationId;

    const requestId = crypto.randomUUID();

    try {
      const planResult = await ActionPlanner.planAction({
        userId,
        intent: query,
        targetDescription: !targetId ? query : null,
        targetId,
        requestId,
        explanation: `You asked Copilot: "${query}"`
      });

      if (planResult.needsInput || planResult.needsClarification) {
        return {
          type: 'clarification',
          message: planResult.message || 'I found multiple or no matching entities. Please clarify your target.',
          aiStatus: 'success',
          references: [],
          data: { 
            needsClarification: planResult.needsClarification,
            candidates: planResult.candidates || []
          },
          suggestedPrompts: planResult.candidates 
            ? planResult.candidates.map(c => `Use ${c.label || c.name || c.title || c.id}`) 
            : ['What should I focus on today?']
        };
      }

      const actionPlanJson = planResult.toJSON();
      const actionModel = planResult.action;
      const previewData = planResult.preview || {};

      const safetyNotes = actionModel.actionType === 'create_outreach_draft' 
        ? 'Draft only — nothing will be sent.' 
        : undefined;

      return {
        type: 'action_preview',
        actionId: actionModel.actionId,
        actionType: actionModel.actionType,
        preview: {
          operation: previewData.operation || 'Execute Action',
          target: previewData.target || `${actionModel.target.type}:${actionModel.target.id}`,
          reason: planResult.explanation || `You asked to perform ${actionModel.actionType.replace('_', ' ')}.`,
          safetyNotes
        },
        requiresConfirmation: true,
        message: `I have prepared an action plan to ${previewData.operation ? previewData.operation.toLowerCase() : 'execute action'} for ${previewData.target || 'the requested item'}. Please review and confirm it below.`,
        aiStatus: 'success',
        references: [
          { type: actionModel.target.type, id: actionModel.target.id, label: previewData.target }
        ],
        data: { actionPlan: actionPlanJson },
        suggestedPrompts: ['What should I focus on today?']
      };
    } catch (err) {
      console.error('[CopilotChatService] Error planning action:', err);
      return {
        type: 'error',
        message: 'I could not create a safe action plan for your request. ' + (err.message || ''),
        aiStatus: 'unavailable',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?']
      };
    }
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
        .filter(w => w.length >= 2 && !['who', 'can', 'refer', 'me', 'in', 'at', 'for', 'my', 'top', 'job', 'position', 'role', 'company', 'the', 'is', 'a', 'why', 'match', 'explanation', 'good', 'fit', 'what', 'status', 'application', 'draft', 'outreach', 'suitable', 'connections', 'connection', 'people', 'contacts', 'referrals', 'referral', 'are', 'find', 'show', 'list', 'get', 'any', 'working', 'work'].includes(w));

      if (cleanWords.length > 0) {
        const orConditions = cleanWords.flatMap(w => [
          { normalizedCompany: { [likeOp]: `%${w}%` } },
          { title: { [likeOp]: `%${w}%` } },
          { normalizedTitle: { [likeOp]: `%${w}%` } }
        ]);

        const matchedJob = await models.Job.findOne({
          where: {
            user_id: userId,
            isArchived: false,
            [Op.or]: orConditions
          },
          order: [['match_score', 'DESC']]
        });

        if (matchedJob) return { job: matchedJob, isDirectMatch: true, searchTerms: cleanWords };
      }
    }

    const topJob = await models.Job.findOne({
      where: { user_id: userId, isArchived: false },
      order: [['match_score', 'DESC']]
    });

    return { job: topJob, isDirectMatch: false };
  }

  static async handleReferralSearch(userId, query, context) {
    const likeOp = models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;

    // Check whether the user named a company. This must be handled before we
    // use the UI's selected job context: "connections in Microsoft" should
    // never silently become a referral search for the previously selected job.
    const cleanWords = query ? query.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length >= 2 && !['who', 'can', 'refer', 'me', 'in', 'at', 'for', 'from', 'my', 'top', 'job', 'position', 'role', 'company', 'the', 'is', 'a', 'why', 'match', 'explanation', 'good', 'fit', 'what', 'status', 'application', 'draft', 'outreach', 'suitable', 'connections', 'connection', 'people', 'contacts', 'referrals', 'referral', 'are', 'find', 'show', 'list', 'get', 'give', 'any', 'all', 'working', 'work'].includes(w))
      : [];

    // Prefer the company immediately following an explicit relationship
    // preposition. This prevents verbs such as "give" and "from" from
    // becoming a broad SQL substring query.
    const companyPhrase = query?.match(/\b(?:at|in|from|for)\s+([a-z0-9][a-z0-9&().-]*)/i)?.[1];
    const explicitCompanyRequested = companyPhrase?.toLowerCase() || cleanWords[0] || null;

    if (explicitCompanyRequested) {
      const matchingConns = await models.Connection.findAll({
        where: {
          user_id: userId,
          [Op.or]: [
            { company: { [likeOp]: `%${explicitCompanyRequested}%` } },
            { normalizedCompany: { [likeOp]: `%${explicitCompanyRequested}%` } }
          ]
        },
        order: [['connectionScore', 'DESC'], ['createdAt', 'DESC']]
      });

      if (matchingConns.length > 0) {
        const targetComp = matchingConns[0].company || (explicitCompanyRequested.charAt(0).toUpperCase() + explicitCompanyRequested.slice(1));
        const references = matchingConns.map(c => ({
          type: 'connection',
          id: c.id,
          label: `${c.name} (${c.title || c.headline || 'Employee'} at ${c.company || targetComp})`
        }));

        const message = `I found **${matchingConns.length}** connection(s) at **${targetComp}** in your CRM:\n\n` +
          matchingConns.map(c => `• **${c.name}** — ${c.title || c.headline || 'Team Member'} at ${c.company || targetComp}${c.location ? ` (${c.location})` : ''}`).join('\n');

        return {
          message,
          aiStatus: 'success',
          references,
          data: { connections: matchingConns },
          suggestedPrompts: [`Draft outreach to ${matchingConns[0].name}`, 'What should I focus on today?']
        };
      }

      const targetComp = explicitCompanyRequested.charAt(0).toUpperCase() + explicitCompanyRequested.slice(1);
      return {
        message: `I found no connections at **${targetComp}** in your CRM.`,
        aiStatus: 'success',
        references: [],
        data: { connections: [] },
        suggestedPrompts: ['Who can refer me for my top job?', 'What should I focus on today?']
      };
    }

    const { job: targetJob } = await this.resolveTargetJob(userId, query, context.jobId);

    if (!targetJob) {
      return {
        message: 'No active job opportunities or matching connections found. Add jobs or connections to explore referral paths.',
        aiStatus: 'success',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?', 'What skills should I improve?']
      };
    }

    const referralRes = await ReferralPathAgentService.findReferralPath({ userId, jobId: targetJob.id, query });

    const targetJobId = referralRes.job?.id || targetJob.id;
    const targetTitle = referralRes.job?.title || targetJob.title;
    const targetCompany = referralRes.job?.company || targetJob.company || 'your target opportunity';

    const references = [
      { type: 'job', id: targetJobId, label: `${targetTitle} at ${targetCompany}` }
    ];

    if (referralRes.recommendedContacts) {
      for (const c of referralRes.recommendedContacts) {
        if (c.connectionId) {
          references.push({
            type: 'connection',
            id: c.connectionId,
            label: c.name ? `${c.name} (${c.company || targetCompany})` : `Connection ${c.connectionId}`
          });
        }
      }
    }

    let message = referralRes.summary || referralRes.message;

    return {
      message,
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
    const { job: targetJob, isDirectMatch } = await this.resolveTargetJob(userId, query, context.jobId);

    if (!targetJob) {
      return {
        message: 'No jobs available to evaluate match explanations. Add jobs to your tracker first.',
        aiStatus: 'success',
        references: [],
        data: {},
        suggestedPrompts: ['What should I focus on today?']
      };
    }

    const matchRes = await MatchExplainerService.explainMatch({ userId, jobId: targetJob.id, query });

    const targetJobId = matchRes.job?.id || targetJob.id;
    const targetTitle = matchRes.job?.title || targetJob.title;
    const targetCompany = matchRes.job?.company || targetJob.company;

    const references = [
      { type: 'job', id: targetJobId, label: `${targetTitle} at ${targetCompany}` }
    ];

    let explanationMsg = matchRes.explanation || `Deterministic Match Score: ${matchRes.deterministicScore}%`;
    if (!isDirectMatch && query && targetCompany && !query.toLowerCase().includes(targetCompany.toLowerCase())) {
      explanationMsg = `Displaying match breakdown for your top saved opportunity (**${targetTitle} at ${targetCompany}**):\n\n` + explanationMsg;
    }

    return {
      message: explanationMsg,
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

    // Statuses are canonical workflow data. Do not let a text model rewrite
    // or infer them; the deterministic count above is the answer of record.
    const aiStatus = 'success';

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
    const jobsCount = contextPackage.entities.jobs?.length || 0;
    const connCount = contextPackage.entities.connections?.length || 0;

    const skillsText = skills.slice(0, 5).join(', ');
    const message = skills.length > 0
      ? `Your profile records these skills: ${skillsText}. You have ${jobsCount} tracked job opportunity(s) and ${connCount} connection(s). Select a specific job to receive a grounded match breakdown; I will not infer missing experience from this summary.`
      : `You have ${jobsCount} tracked job opportunity(s) and ${connCount} connection(s). Add profile skills or select a specific job for a grounded match breakdown.`;
    const aiStatus = 'success';

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
        'Who can refer me for my top job?',
        'Why is my top job a good match?',
        'What should I focus on today?'
      ]
    };
  }
}
