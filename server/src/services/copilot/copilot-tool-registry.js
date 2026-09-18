import { Op } from 'sequelize';
import { models } from '../../config/database.js';
import { CompanyNormalizerService } from './company-normalizer.service.js';
import { GroundingContract, GroundingStatuses } from './grounding-contract.js';
import { ReferralPathAgentService } from './referral-path-agent.service.js';
import { MatchExplainerService } from './match-explainer.service.js';
import { DecisionDigestService } from './decision-digest.service.js';

export class CopilotToolRegistry {
  static _getLikeOp() {
    return models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;
  }

  /**
   * Tool 1: searchConnections
   * Executes authorized database query for user's CRM connections with canonical company aliasing.
   */
  static async searchConnections({ userId, company, person, limit = 20, fallbackAllowed = true }) {
    if (!userId) {
      throw new Error('Unauthorized: userId is required for searchConnections.');
    }

    const likeOp = this._getLikeOp();
    const whereClause = { user_id: userId };

    if (company) {
      const normalizedCompany = CompanyNormalizerService.normalizeCompany(company);
      whereClause[Op.or] = [
        { company: { [likeOp]: `%${normalizedCompany}%` } },
        { company: { [likeOp]: `%${company}%` } }
      ];
    }

    if (person) {
      whereClause.name = { [likeOp]: `%${person}%` };
    }

    let records = await models.Connection.findAll({
      where: whereClause,
      limit,
      order: [['updatedAt', 'DESC']]
    });

    let fallbackUsed = false;

    // Strict Rule: Do not use fallback if an explicit company was requested but had no matches!
    if (records.length === 0 && !company && fallbackAllowed) {
      records = await models.Connection.findAll({
        where: { user_id: userId },
        limit: 5,
        order: [['updatedAt', 'DESC']]
      });
      fallbackUsed = records.length > 0;
    }

    if (records.length === 0) {
      const noDataMessage = company 
        ? `I searched your network for direct connections at ${company}, but found no records matching ${company} in your CareerGraph CRM.` 
        : `No network connections were found in your CareerGraph database.`;

      return GroundingContract.format({
        answerType: 'connection_list',
        message: noDataMessage,
        data: { connections: [], company: company || null },
        references: [],
        status: GroundingStatuses.NO_DATA,
        sourceCount: 0,
        fallbackUsed: false,
        suggestedPrompts: ['Add imported connections for ' + (company || 'top companies'), 'What should I focus on today?']
      });
    }

    const references = records.map(conn => ({
      type: 'connection',
      id: conn.id,
      fields: ['name', 'company', 'title', 'relationshipStatus']
    }));

    const message = fallbackUsed 
      ? `I could not find connections for your query. Showing ${records.length} recent network contact(s):`
      : `I found ${records.length} direct connection(s) ${company ? 'at ' + company : 'in your network'}:`;

    return GroundingContract.format({
      answerType: 'connection_list',
      message,
      data: {
        connections: records.map(r => r.toJSON ? r.toJSON() : r),
        company: company || null
      },
      references,
      status: fallbackUsed ? GroundingStatuses.PARTIAL : GroundingStatuses.GROUNDED,
      sourceCount: records.length,
      fallbackUsed,
      suggestedPrompts: company ? [`Who can refer me at ${company}?`, `Draft a message to ${records[0]?.name || 'connection'}`] : ['What should I focus on today?']
    });
  }

  /**
   * Tool 2: searchJobs
   */
  static async searchJobs({ userId, company, jobTitle, limit = 10 }) {
    if (!userId) throw new Error('Unauthorized user.');

    const likeOp = this._getLikeOp();
    const whereClause = { user_id: userId };

    if (company) {
      const norm = CompanyNormalizerService.normalizeCompany(company);
      whereClause[Op.or] = [
        { company: { [likeOp]: `%${norm}%` } },
        { company: { [likeOp]: `%${company}%` } }
      ];
    }

    const records = await models.Job.findAll({
      where: whereClause,
      limit,
      order: [['updatedAt', 'DESC']]
    });

    if (records.length === 0) {
      return GroundingContract.format({
        answerType: 'job_list',
        message: company 
          ? `I searched your pipeline for job postings at ${company}, but found no saved jobs.`
          : `No tracked job postings were found in your pipeline.`,
        data: { jobs: [] },
        references: [],
        status: GroundingStatuses.NO_DATA,
        sourceCount: 0
      });
    }

    return GroundingContract.format({
      answerType: 'job_list',
      message: `Found ${records.length} tracked job(s):`,
      data: { jobs: records.map(r => r.toJSON ? r.toJSON() : r) },
      references: records.map(j => ({ type: 'job', id: j.id, fields: ['title', 'company', 'status'] })),
      status: GroundingStatuses.GROUNDED,
      sourceCount: records.length
    });
  }

  /**
   * Tool 3: getApplicationStatus
   */
  static async getApplicationStatus({ userId, company }) {
    if (!userId) throw new Error('Unauthorized user.');

    const applications = await models.Application.findAll({
      where: { user_id: userId },
      include: [{ model: models.Job, as: 'job' }],
      order: [['updatedAt', 'DESC']]
    });

    if (applications.length === 0) {
      return GroundingContract.format({
        answerType: 'application_list',
        message: 'You have 0 total application(s) in your pipeline.',
        data: { applications: [] },
        references: [],
        status: GroundingStatuses.NO_DATA,
        sourceCount: 0
      });
    }

    const formattedApps = applications.map(a => {
      const json = a.toJSON ? a.toJSON() : a;
      return {
        ...json,
        jobTitle: a.job?.title || 'Tracked Position',
        company: a.job?.company || 'Company'
      };
    });

    return GroundingContract.format({
      answerType: 'application_list',
      message: `You have ${applications.length} total application(s) in your pipeline:`,
      data: { applications: formattedApps },
      references: applications.map(a => ({ type: 'application', id: a.id, fields: ['status', 'appliedDate'] })),
      status: GroundingStatuses.GROUNDED,
      sourceCount: applications.length
    });
  }

  /**
   * Tool 4: getReferralCandidates
   */
  static async getReferralCandidates({ userId, jobId, company, jobTitle }) {
    if (!userId) throw new Error('Unauthorized user.');

    let targetJobId = jobId;
    if (!targetJobId) {
      const topJob = await models.Job.findOne({
        where: { user_id: userId, isArchived: false },
        order: [['updatedAt', 'DESC']]
      });
      if (topJob) targetJobId = topJob.id;
    }

    if (!targetJobId) {
      return this.searchConnections({ userId, company, fallbackAllowed: true });
    }

    const result = await ReferralPathAgentService.findReferralPath({ userId, jobId: targetJobId, query: company });
    
    const references = [
      { type: 'job', id: targetJobId, fields: ['title', 'company'] },
      ...(result.recommendedContacts || result.primaryReferrals || []).map(r => ({
        type: 'connection',
        id: r.connectionId || r.id,
        fields: ['name', 'company', 'title', 'referralScore']
      }))
    ];

    return GroundingContract.format({
      answerType: 'referral_candidates',
      message: result.summary || result.message || `Here are your referral candidates:`,
      data: result,
      references,
      status: result.aiStatus === 'no_candidates' ? GroundingStatuses.NO_DATA : GroundingStatuses.GROUNDED,
      sourceCount: references.length,
      suggestedPrompts: result.recommendedContacts?.[0] ? [`Draft a message to ${result.recommendedContacts[0].name || 'contact'}`] : []
    });
  }

  /**
   * Tool 5: generateOutreachDraft (Direct Editable Draft Generation)
   */
  static async generateOutreachDraft({ userId, personName, company, intent = 'referral_request', tone = 'professional' }) {
    if (!userId) throw new Error('Unauthorized user.');

    const likeOp = this._getLikeOp();
    let connection = null;

    if (personName) {
      connection = await models.Connection.findOne({
        where: {
          user_id: userId,
          name: { [likeOp]: `%${personName}%` }
        }
      });
    }

    if (!connection && company) {
      const norm = CompanyNormalizerService.normalizeCompany(company);
      connection = await models.Connection.findOne({
        where: {
          user_id: userId,
          company: { [likeOp]: `%${norm}%` }
        }
      });
    }

    if (!connection) {
      connection = await models.Connection.findOne({
        where: { user_id: userId },
        order: [['updatedAt', 'DESC']]
      });
    }

    if (!connection) {
      return GroundingContract.format({
        answerType: 'draft_outreach',
        message: `Could not generate a personalized draft because no matching connection was found in your CareerGraph database.`,
        data: { draft: null },
        references: [],
        status: GroundingStatuses.NO_DATA,
        sourceCount: 0
      });
    }

    const verifiedName = connection.name || 'there';
    const verifiedCompany = connection.company || 'your company';
    const verifiedTitle = connection.title || 'team member';

    const draftText = `Hi ${verifiedName},\n\nI hope you're doing well! I've been following your work as ${verifiedTitle} at ${verifiedCompany} and would love to connect briefly regarding potential career opportunities and insights.\n\nBest regards,\n[Your Name]`;

    return GroundingContract.format({
      answerType: 'draft_outreach',
      message: `Here is a personalized draft for ${verifiedName} (${verifiedTitle} at ${verifiedCompany}). You can copy, edit, or save it below:`,
      data: {
        draft: draftText,
        recipient: {
          id: connection.id,
          name: verifiedName,
          company: verifiedCompany,
          title: verifiedTitle
        },
        tone,
        status: 'draft_ready',
        safetyNotice: 'Nothing has been sent. This draft is editable.'
      },
      references: [
        { type: 'connection', id: connection.id, fields: ['name', 'company', 'title'] }
      ],
      status: GroundingStatuses.DRAFT,
      sourceCount: 1
    });
  }

  /**
   * Tool 6: getMatchBreakdown
   */
  static async getMatchBreakdown({ userId, jobId }) {
    if (!userId) throw new Error('Unauthorized user.');

    let targetJobId = jobId;
    if (!targetJobId) {
      const topJob = await models.Job.findOne({
        where: { user_id: userId, isArchived: false },
        order: [['updatedAt', 'DESC']]
      });
      if (topJob) targetJobId = topJob.id;
    }

    if (!targetJobId) {
      return GroundingContract.format({
        answerType: 'match_explanation',
        message: 'No active job target was found in your pipeline to explain match fit.',
        data: { deterministicScore: 0 },
        references: [],
        status: GroundingStatuses.NO_DATA,
        sourceCount: 0
      });
    }

    const result = await MatchExplainerService.explainMatch({ userId, jobId: targetJobId });
    return GroundingContract.format({
      answerType: 'match_explanation',
      message: `Here is the grounded match analysis:`,
      data: result,
      references: [{ type: 'job', id: targetJobId, fields: ['title', 'company', 'matchScore'] }],
      status: GroundingStatuses.GROUNDED,
      sourceCount: 1
    });
  }

  /**
   * Tool 7: getDecisionDigest
   */
  static async getDecisionDigest({ userId }) {
    if (!userId) throw new Error('Unauthorized user.');

    const result = await DecisionDigestService.generateDigest({ userId });
    return GroundingContract.format({
      answerType: 'decision_digest',
      message: `Here is your daily career decision digest:`,
      data: result,
      references: [],
      status: GroundingStatuses.GROUNDED,
      sourceCount: 1
    });
  }
}
