import { models } from '../config/database.js';
import { Op } from 'sequelize';
import { CompanyNormalizerService } from './copilot/company-normalizer.service.js';

export class ColdEmailOutreachService {
  /**
   * Ingests array of cold emails, parses metadata, and auto-matches CRM Companies and Connections.
   * 
   * @param {Object} params
   * @param {string} params.userId
   * @param {Array<Object>} params.emails
   * @param {string} [params.source='gmail_sync']
   * @returns {Promise<Object>} Ingestion summary
   */
  static async ingestColdEmails({ userId, emails = [], source = 'gmail_sync' }) {
    if (!userId) throw new Error('User ID is required.');
    if (!Array.isArray(emails) || emails.length === 0) {
      return { totalIngested: 0, linkedCompanies: 0, linkedConnections: 0, items: [] };
    }

    const likeOp = models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;
    let linkedCompaniesCount = 0;
    let linkedConnectionsCount = 0;
    const ingestedRecords = [];

    for (const raw of emails) {
      const recipientEmail = (raw.recipientEmail || raw.toEmail || '').trim().toLowerCase();
      const recipientName = (raw.recipientName || raw.toName || '').trim();
      const organizationName = (raw.organizationName || raw.company || '').trim();
      if (!organizationName && !recipientEmail) continue;

      const normOrg = CompanyNormalizerService.normalizeCompany(organizationName || recipientEmail.split('@')[1] || 'Unknown');
      const sentDate = raw.sentDate ? new Date(raw.sentDate) : new Date();
      const recipientRole = this.classifyRole(raw.recipientRole || raw.subject || raw.body || recipientName);
      const gmailMessageId = raw.gmailMessageId || raw.messageId || null;
      const gmailThreadId = raw.gmailThreadId || raw.threadId || null;

      // 1. Auto-match with existing CRM Company
      let companyId = raw.companyId || null;
      if (!companyId && normOrg) {
        const matchingCompany = await models.Company.findOne({
          where: { normalizedName: { [likeOp]: `%${normOrg}%` } }
        });
        if (matchingCompany) {
          companyId = matchingCompany.id;
          linkedCompaniesCount++;
        }
      }

      // 2. Auto-match with existing CRM Connection
      let connectionId = raw.connectionId || null;
      if (!connectionId) {
        let matchingConn = null;
        if (recipientEmail) {
          matchingConn = await models.Connection.findOne({
            where: { user_id: userId, email: recipientEmail }
          });
        }
        if (!matchingConn && recipientName) {
          matchingConn = await models.Connection.findOne({
            where: {
              user_id: userId,
              name: { [likeOp]: `%${recipientName}%` }
            }
          });
        }
        if (matchingConn) {
          connectionId = matchingConn.id;
          linkedConnectionsCount++;
          // Update connection last contacted date and relationship status
          await matchingConn.update({
            lastContactedDate: sentDate.toISOString().split('T')[0],
            relationshipStatus: matchingConn.relationshipStatus === 'not_contacted' ? 'contacted' : matchingConn.relationshipStatus
          });
        }
      }

      // 3. Upsert ColdEmailOutreach record
      const whereClause = { userId };
      if (gmailMessageId) {
        whereClause.gmailMessageId = gmailMessageId;
      } else {
        whereClause.recipientEmail = recipientEmail || 'unknown@domain.com';
        whereClause.organizationName = organizationName || 'Unknown';
      }

      const existingRecord = await models.ColdEmailOutreach.findOne({ where: whereClause });

      if (existingRecord) {
        await existingRecord.update({
          recipientName: recipientName || existingRecord.recipientName,
          recipientRole: recipientRole || existingRecord.recipientRole,
          subject: raw.subject || existingRecord.subject,
          emailBody: raw.emailBody || raw.body || existingRecord.emailBody,
          companyId: companyId || existingRecord.companyId,
          connectionId: connectionId || existingRecord.connectionId,
          replyStatus: raw.replyStatus || existingRecord.replyStatus
        });
        ingestedRecords.push(existingRecord);
      } else {
        const newRecord = await models.ColdEmailOutreach.create({
          userId,
          recipientEmail: recipientEmail || 'unknown@domain.com',
          recipientName: recipientName || 'Hiring Team Member',
          recipientRole,
          organizationName: organizationName || 'Target Organization',
          normalizedOrganization: normOrg,
          subject: raw.subject || 'Opportunity Inquiry',
          sentDate,
          emailBody: raw.emailBody || raw.body || '',
          gmailMessageId,
          gmailThreadId,
          source,
          replyStatus: raw.replyStatus || 'sent_awaiting_reply',
          revertDate: raw.revertDate ? new Date(raw.revertDate) : null,
          revertMessage: raw.revertMessage || null,
          companyId,
          connectionId
        });
        ingestedRecords.push(newRecord);
      }
    }

    return {
      totalIngested: ingestedRecords.length,
      linkedCompanies: linkedCompaniesCount,
      linkedConnections: linkedConnectionsCount,
      items: ingestedRecords
    };
  }

  /**
   * Helper to classify recipient role into Talent Acquisition, Hiring Manager, Founder, Recruiter, or Executive.
   */
  static classifyRole(text = '') {
    const lower = (text || '').toLowerCase();
    if (/talent|ta\b|acquisition|recruit|sourcer|headhunter|hr\b|human resource/i.test(lower)) {
      return 'talent_acquisition';
    }
    if (/founder|co-founder|ceo|cto|cfo|president|owner|cofounder/i.test(lower)) {
      return 'founder';
    }
    if (/hiring manager|engineering manager|tech lead|director|vp\b|head of|lead/i.test(lower)) {
      return 'hiring_manager';
    }
    if (/executive|vp|vice president|chief|officer/i.test(lower)) {
      return 'executive';
    }
    return 'recruiter';
  }

  /**
   * Fetches paginated list of cold email outreach records with filters.
   */
  static async getColdEmails({ userId, status, organization, role, search, page = 1, limit = 20 }) {
    if (!userId) throw new Error('User ID is required.');
    const where = { userId };
    const likeOp = models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;

    if (status && status !== 'all') {
      where.replyStatus = status;
    }

    if (role && role !== 'all') {
      where.recipientRole = role;
    }

    if (organization) {
      const cleanOrg = organization.replace(/recruiters|hiring|team/gi, '').trim();
      const norm = CompanyNormalizerService.normalizeCompany(cleanOrg || organization);
      const orgWhere = [
        { normalizedOrganization: { [likeOp]: `%${norm}%` } },
        { organizationName: { [likeOp]: `%${cleanOrg || organization}%` } }
      ];
      if (search) {
        where[Op.and] = [
          { [Op.or]: orgWhere },
          {
            [Op.or]: [
              { organizationName: { [likeOp]: `%${search}%` } },
              { recipientName: { [likeOp]: `%${search}%` } },
              { recipientEmail: { [likeOp]: `%${search}%` } },
              { subject: { [likeOp]: `%${search}%` } }
            ]
          }
        ];
      } else {
        where[Op.or] = orgWhere;
      }
    } else if (search) {
      where[Op.or] = [
        { organizationName: { [likeOp]: `%${search}%` } },
        { recipientName: { [likeOp]: `%${search}%` } },
        { recipientEmail: { [likeOp]: `%${search}%` } },
        { subject: { [likeOp]: `%${search}%` } }
      ];
    }

    const offset = (Math.max(1, parseInt(page)) - 1) * parseInt(limit);

    const { count, rows } = await models.ColdEmailOutreach.findAndCountAll({
      where,
      include: [
        { model: models.Company, as: 'company', attributes: ['id', 'name', 'normalizedName'] },
        { model: models.Connection, as: 'connection', attributes: ['id', 'name', 'title', 'company', 'relationshipStatus'] },
        { model: models.Job, as: 'job', attributes: ['id', 'title', 'status'] },
        { model: models.Application, as: 'application', attributes: ['id', 'status'] }
      ],
      order: [['sentDate', 'DESC']],
      limit: parseInt(limit),
      offset
    });

    const stats = await this.getOutreachStats({ userId });

    return {
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(count / parseInt(limit)),
      stats,
      data: rows
    };
  }

  /**
   * Logs a received revert/reply for a cold email outreach item.
   */
  static async logRevert({ userId, id, replyStatus, revertDate, revertMessage, nextActionDate, nextActionNotes }) {
    if (!userId) throw new Error('User ID is required.');

    const outreach = await models.ColdEmailOutreach.findOne({
      where: { id, userId }
    });

    if (!outreach) {
      throw new Error(`Cold email outreach record not found: ${id}`);
    }

    const updatedReplyStatus = replyStatus || 'replied_interested';
    const updatedRevertDate = revertDate ? new Date(revertDate) : new Date();

    await outreach.update({
      replyStatus: updatedReplyStatus,
      revertDate: updatedRevertDate,
      revertMessage: revertMessage || outreach.revertMessage,
      nextActionDate: nextActionDate || outreach.nextActionDate,
      nextActionNotes: nextActionNotes || outreach.nextActionNotes
    });

    // If connected connection exists, update relationship status
    if (outreach.connectionId) {
      const conn = await models.Connection.findByPk(outreach.connectionId);
      if (conn) {
        let connStatus = 'replied';
        if (updatedReplyStatus === 'interview_offered') connStatus = 'conversation';
        await conn.update({ relationshipStatus: connStatus });
      }
    }

    return outreach;
  }

  /**
   * Links outreach item to an existing or new CRM Connection / Company.
   */
  static async linkToCRM({ userId, id, connectionId, companyId, createConnectionIfMissing = false }) {
    const outreach = await models.ColdEmailOutreach.findOne({
      where: { id, userId }
    });

    if (!outreach) throw new Error('Cold email outreach record not found.');

    let finalConnectionId = connectionId || outreach.connectionId;
    let finalCompanyId = companyId || outreach.companyId;

    if (!finalConnectionId && createConnectionIfMissing) {
      const newConn = await models.Connection.create({
        userId,
        name: outreach.recipientName || 'Outreach Contact',
        email: outreach.recipientEmail,
        company: outreach.organizationName,
        title: outreach.recipientRole === 'talent_acquisition' ? 'Talent Acquisition Specialist' : outreach.recipientRole,
        relationshipStatus: outreach.replyStatus === 'sent_awaiting_reply' ? 'contacted' : 'replied',
        lastContactedDate: outreach.sentDate ? outreach.sentDate.toISOString().split('T')[0] : null
      });
      finalConnectionId = newConn.id;
    }

    await outreach.update({
      connectionId: finalConnectionId,
      companyId: finalCompanyId
    });

    return outreach;
  }

  /**
   * Generates summary statistics for the user's cold email outreach dashboard.
   */
  static async getOutreachStats({ userId }) {
    const totalSent = await models.ColdEmailOutreach.count({ where: { userId } });
    const awaitingReply = await models.ColdEmailOutreach.count({
      where: { userId, replyStatus: 'sent_awaiting_reply' }
    });
    const repliedInterested = await models.ColdEmailOutreach.count({
      where: { userId, replyStatus: 'replied_interested' }
    });
    const interviewOffered = await models.ColdEmailOutreach.count({
      where: { userId, replyStatus: 'interview_offered' }
    });
    const declined = await models.ColdEmailOutreach.count({
      where: { userId, replyStatus: 'declined' }
    });

    const totalReplies = repliedInterested + interviewOffered + declined;
    const responseRate = totalSent > 0 ? Math.round((totalReplies / totalSent) * 100) : 0;
    const interviewRate = totalSent > 0 ? Math.round((interviewOffered / totalSent) * 100) : 0;

    return {
      totalSent,
      awaitingReply,
      repliedInterested,
      interviewOffered,
      declined,
      totalReplies,
      responseRatePercentage: responseRate,
      interviewRatePercentage: interviewRate
    };
  }
}
