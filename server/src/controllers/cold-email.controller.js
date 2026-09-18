import { ColdEmailOutreachService } from '../services/cold-email-outreach.service.js';

export class ColdEmailController {
  static getUserId(req) {
    return req.auth?.userId || req.user?.id;
  }

  static async getColdEmails(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const { status, organization, role, search, page, limit } = req.query;

      const result = await ColdEmailOutreachService.getColdEmails({
        userId,
        status,
        organization,
        role,
        search,
        page,
        limit
      });

      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  static async syncColdEmails(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const { emails, source } = req.body;

      const result = await ColdEmailOutreachService.ingestColdEmails({
        userId,
        emails,
        source: source || 'gmail_sync'
      });

      return res.status(201).json({
        success: true,
        message: `Successfully ingested ${result.totalIngested} cold email outreach records (${result.linkedCompanies} linked companies, ${result.linkedConnections} linked connections).`,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }

  static async createColdEmail(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const emailData = req.body;

      const result = await ColdEmailOutreachService.ingestColdEmails({
        userId,
        emails: [emailData],
        source: emailData.source || 'manual'
      });

      return res.status(201).json({
        success: true,
        item: result.items[0]
      });
    } catch (err) {
      next(err);
    }
  }

  static async logRevert(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const { id } = req.params;
      const { replyStatus, revertDate, revertMessage, nextActionDate, nextActionNotes } = req.body;

      const updated = await ColdEmailOutreachService.logRevert({
        userId,
        id,
        replyStatus,
        revertDate,
        revertMessage,
        nextActionDate,
        nextActionNotes
      });

      return res.json({
        success: true,
        message: 'Revert status logged successfully.',
        item: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async linkToCRM(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const { id } = req.params;
      const { connectionId, companyId, createConnectionIfMissing } = req.body;

      const updated = await ColdEmailOutreachService.linkToCRM({
        userId,
        id,
        connectionId,
        companyId,
        createConnectionIfMissing
      });

      return res.json({
        success: true,
        message: 'Outreach record linked to CRM successfully.',
        item: updated
      });
    } catch (err) {
      next(err);
    }
  }

  static async getStats(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const stats = await ColdEmailOutreachService.getOutreachStats({ userId });

      return res.json({
        success: true,
        stats
      });
    } catch (err) {
      next(err);
    }
  }

  static async syncFromGmail(req, res, next) {
    try {
      const userId = ColdEmailController.getUserId(req);
      const { label } = req.body || {};
      const { syncGmailColdEmails } = await import('../services/gmail-sync.service.js');
      const result = await syncGmailColdEmails(userId, label || 'opportunity');
      return res.json({
        success: true,
        ...result
      });
    } catch (err) {
      next(err);
    }
  }
}
