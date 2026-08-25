import { Op } from 'sequelize';
import { models } from '../config/database.js';

/**
 * Checks for recent, duplicate, or pending outreach attempts.
 */
export async function checkOutreachDuplicates({ userId, jobId, connectionId }) {
  const warnings = [];

  if (!connectionId) {
    return { allowed: true, warnings };
  }

  // 1. Check existing Outreach record for this connection
  const existingOutreach = await models.Outreach.findOne({
    where: { connection_id: connectionId, user_id: userId }
  });

  if (existingOutreach) {
    // Check if the same job is associated and already discussed
    if (jobId && existingOutreach.jobId === jobId) {
      warnings.push({
        code: 'DUPLICATE_JOB_OUTREACH',
        message: 'You have already logged outreach discussing this specific job with this connection.',
        relatedOutreachId: existingOutreach.id,
        createdAt: existingOutreach.createdAt
      });
    }

    // Check if referral was already requested
    if (existingOutreach.status === 'referral_requested' || existingOutreach.status === 'referral_received') {
      if (jobId && existingOutreach.jobId === jobId) {
        warnings.push({
          code: 'REFERRAL_ALREADY_REQUESTED',
          message: `Referral was already requested/received for this job with this connection.`,
          relatedOutreachId: existingOutreach.id,
          createdAt: existingOutreach.createdAt
        });
      }
    }

    // Check if follow-up is currently pending in the future
    if (existingOutreach.followUpDate) {
      const followUp = new Date(existingOutreach.followUpDate);
      if (followUp > new Date()) {
        warnings.push({
          code: 'PENDING_FOLLOW_UP',
          message: `You have a pending follow-up scheduled for this connection on ${followUp.toLocaleDateString()}.`,
          relatedOutreachId: existingOutreach.id,
          createdAt: existingOutreach.createdAt
        });
      }
    }

    // Check if contacted within the last 14 days
    if (existingOutreach.contactDate) {
      const contact = new Date(existingOutreach.contactDate);
      const diffDays = Math.ceil(Math.abs(new Date() - contact) / (1000 * 60 * 60 * 24));
      if (diffDays <= 14) {
        warnings.push({
          code: 'RECENT_OUTREACH_LOGGED',
          message: `Outreach was recently logged for this connection ${diffDays} days ago.`,
          relatedOutreachId: existingOutreach.id,
          createdAt: existingOutreach.createdAt
        });
      }
    }
  }

  // 2. Check for very recent similar AI draft (within past 2 hours)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  const recentDraft = await models.OutreachAiDraft.findOne({
    where: {
      user_id: userId,
      connection_id: connectionId,
      job_id: jobId || null,
      status: 'generated',
      created_at: { [Op.gt]: twoHoursAgo }
    }
  });

  if (recentDraft) {
    warnings.push({
      code: 'RECENT_DRAFT_GENERATED',
      message: 'A similar AI draft was already generated for this connection within the last 2 hours.',
      relatedOutreachId: recentDraft.id,
      createdAt: recentDraft.createdAt
    });
  }

  return {
    allowed: true, // Warn, but let the user decide whether to bypass
    warnings
  };
}
