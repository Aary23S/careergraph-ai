import { Router } from 'express';
import { Op } from 'sequelize';
import { models } from '../config/database.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import {
  calculateMatchScore,
  calculateReferralScore,
  calculateOpportunityScore,
  determineActionRecommendation,
} from '../services/intelligence.service.js';
import { emailService } from '../services/email.service.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const [totalJobs, newJobs, savedJobs, applications, interviews, offers, totalConnections, followUpsDue] =
      await Promise.all([
        models.Job.count({ where: { user_id: req.auth.userId } }),
        models.Job.count({ where: { user_id: req.auth.userId, status: 'new' } }),
        models.Application.count({ where: { user_id: req.auth.userId, status: 'saved' } }),
        models.Application.count({ where: { user_id: req.auth.userId } }),
        models.Application.count({ where: { user_id: req.auth.userId, status: 'interview' } }),
        models.Application.count({ where: { user_id: req.auth.userId, status: 'offer' } }),
        models.Connection.count({ where: { user_id: req.auth.userId } }),
        models.Connection.count({
          where: {
            user_id: req.auth.userId,
            nextFollowUpDate: { [Op.lte]: today },
          },
        }),
      ]);

    const [recentApplicationEvents, recentOutreachEvents, recentNotifications] = await Promise.all([
      models.ApplicationEvent.findAll({
        where: { user_id: req.auth.userId },
        order: [['occurred_at', 'DESC']],
        limit: 5,
      }),
      models.OutreachEvent.findAll({
        where: { user_id: req.auth.userId },
        order: [['occurred_at', 'DESC']],
        limit: 5,
      }),
      models.Notification.findAll({
        where: { user_id: req.auth.userId },
        order: [['created_at', 'DESC']],
        limit: 5,
      }),
    ]);

    const recentActivity = [
      ...recentApplicationEvents.map((item) => ({ type: 'application_event', ...item.toJSON() })),
      ...recentOutreachEvents.map((item) => ({ type: 'outreach_event', ...item.toJSON() })),
      ...recentNotifications.map((item) => ({ type: 'notification', ...item.toJSON() })),
    ]
      .sort((a, b) => new Date(b.occurredAt || b.createdAt) - new Date(a.occurredAt || a.createdAt))
      .slice(0, 10);

    ok(res, {
      totalJobs,
      newJobs,
      savedJobs,
      applications,
      interviews,
      offers,
      totalConnections,
      followUpsDue,
      recentActivity,
    });
  }),
);

router.post(
  '/digest',
  asyncHandler(async (req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const userId = req.auth.userId;

    const user = await models.User.findByPk(userId);
    const profile = await models.Profile.findOne({ where: { user_id: userId } });
    const activeResume = await models.Resume.findOne({
      where: { user_id: userId, isActive: true },
      include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }],
    });

    // 1. Fetch active jobs & calculate opportunity scores
    const jobs = await models.Job.findAll({
      where: { user_id: userId, isArchived: false },
      include: [
        { model: models.Company, as: 'company' },
        { model: models.JobAiEnrichment, as: 'aiEnrichment' },
      ],
    });

    const activeConnections = await models.Connection.findAll({ where: { user_id: userId } });

    const scoredJobs = await Promise.all(
      jobs.map(async (job) => {
        const matchScore = calculateMatchScore(profile, job, {
          resumeEnrichment: activeResume?.aiEnrichment,
          jobEnrichment: job.aiEnrichment,
        });
        
        // Find connections for this company
        const companyName = job.company?.name || '';
        const companyConns = activeConnections.filter(c => 
          c.company && companyName && (c.company.toLowerCase().includes(companyName.toLowerCase()) || 
          companyName.toLowerCase().includes(c.company.toLowerCase()))
        );

        const scoredConns = companyConns.map(conn => ({
          name: conn.name,
          title: conn.title,
          referralScore: calculateReferralScore(conn, job)
        })).sort((a, b) => b.referralScore - a.referralScore);

        const maxReferral = scoredConns.length > 0 ? scoredConns[0].referralScore : 0;
        const opportunityScore = calculateOpportunityScore(matchScore, maxReferral);
        const recommendedAction = determineActionRecommendation(matchScore, scoredConns[0] || null);

        return {
          title: job.title,
          companyName: job.company?.name || 'Unknown',
          location: job.location,
          matchScore,
          opportunityScore,
          recommendedAction
        };
      })
    );

    // Sort by opportunity score descending, get top 3
    const topJobs = scoredJobs.sort((a, b) => b.opportunityScore - a.opportunityScore).slice(0, 3);

    // 2. Fetch top referral connections
    const scoredReferrals = [];
    for (const conn of activeConnections) {
      if (!conn.company) continue;
      
      // Look for jobs at this company to score them
      const companyJobs = jobs.filter(j => 
        j.company?.name && (conn.company.toLowerCase().includes(j.company.name.toLowerCase()) || 
        j.company.name.toLowerCase().includes(conn.company.toLowerCase()))
      );

      let maxRefScore = 0;
      for (const job of companyJobs) {
        const score = calculateReferralScore(conn, job);
        if (score > maxRefScore) maxRefScore = score;
      }

      if (maxRefScore > 0) {
        scoredReferrals.push({
          name: conn.name,
          title: conn.title,
          company: conn.company,
          relationshipStrength: conn.relationshipStrength,
          referralScore: maxRefScore
        });
      }
    }

    const topReferrals = scoredReferrals.sort((a, b) => b.referralScore - a.referralScore).slice(0, 3);

    // 3. Find pending followups
    const pendingFollowUps = await models.Connection.findAll({
      where: {
        user_id: userId,
        nextFollowUpDate: { [Op.lte]: today },
      },
    });

    let result = null;
    let emailSent = false;
    try {
      result = await emailService.sendDigest(user.email, profile?.name || 'User', {
        topJobs,
        topReferrals,
        pendingFollowUps
      });
      emailSent = true;
    } catch (eErr) {
      console.error('[DashboardRoutes] Failed to send digest via Email:', eErr.message);
      result = { success: false, error: eErr.message, body: `Daily digest generated for ${user.email}.` };
    }

    let telegramSent = false;
    try {
      const telegramLink = await models.TelegramIntegration.findOne({ where: { user_id: userId } });
      if (telegramLink && telegramLink.telegramUserId) {
        const { sendMessage } = await import('../services/telegram.service.js');
        let cleanBody = result.body || '';
        cleanBody = cleanBody.replace(/={10,}/g, '───');
        const telegramBody = `<b>📋 CareerGraph Daily Digest</b>\n\n` + cleanBody;
        await sendMessage(telegramLink.telegramUserId, telegramBody, { parse_mode: 'HTML' });
        telegramSent = true;
      }
    } catch (tErr) {
      console.error('[DashboardRoutes] Failed to send digest via Telegram:', tErr);
    }

    ok(res, { sent: emailSent, recipient: user.email, result, telegramSent });
  }),
);

// Fetch Ingestion Monitor metrics
router.get(
  '/ingestion-monitor',
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const { env } = await import('../config/env.js');

    // 1. Calculate Source Health
    // Adzuna
    let adzunaHealth = env.adzunaEnabled ? 'healthy' : 'disabled';
    
    // LinkedIn Email
    const gmailIntegration = await models.GmailIntegration.findOne({ where: { user_id: userId } });
    let gmailHealth = env.gmailEnabled ? (gmailIntegration ? 'healthy' : 'degraded') : 'disabled';

    // Telegram
    const telegramIntegration = await models.TelegramIntegration.findOne({ where: { user_id: userId } });
    let telegramHealth = env.telegramEnabled ? (telegramIntegration ? 'healthy' : 'degraded') : 'disabled';

    // Check recent ingestion failures to update health status
    const recentFailedIngestions = await models.JobIngestionEvent.count({
      where: {
        user_id: userId,
        status: 'failed',
        processedAt: { [Op.gte]: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });

    if (recentFailedIngestions > 0) {
      if (gmailHealth === 'healthy') gmailHealth = 'degraded';
    }

    // 2. Fetch Sync Statuses
    const lastGmailSync = gmailIntegration?.lastSyncAt || null;
    
    // Get last Adzuna job creation date
    const lastAdzunaJob = await models.Job.findOne({
      where: { user_id: userId, source: 'adzuna' },
      order: [['createdAt', 'DESC']]
    });
    const lastAdzunaSync = lastAdzunaJob?.createdAt || null;

    // Get last Telegram sync
    const lastTelegramJob = await models.IncomingJob.findOne({
      where: { user_id: userId, source: 'telegram' },
      order: [['receivedAt', 'DESC']]
    });
    const lastTelegramSync = lastTelegramJob?.receivedAt || null;

    // 3. Stats Summary Metrics
    const gmailJobEvents = await models.JobIngestionEvent.findAll({
      where: { user_id: userId, sourceType: 'linkedin_email', processedAt: { [Op.gte]: startOfToday } }
    });
    const telegramEvents = await models.IncomingJob.findAll({
      where: { user_id: userId, source: 'telegram', receivedAt: { [Op.gte]: startOfToday } }
    });

    const totalReceivedMessages = gmailJobEvents.length + telegramEvents.length;
    const totalJobsCreated = await models.Job.count({
      where: { user_id: userId, createdAt: { [Op.gte]: startOfToday } }
    });
    const totalDuplicates = await models.JobDeduplicationLog.count({
      where: { user_id: userId, loggedAt: { [Op.gte]: startOfToday } }
    });
    const totalPending = await models.IncomingJob.count({
      where: { user_id: userId, status: 'pending_review' }
    });
    const totalFailed = gmailJobEvents.filter(e => e.status === 'failed').length;

    ok(res, {
      sources: [
        { name: 'Adzuna', status: adzunaHealth, lastSync: lastAdzunaSync, newJobs: totalJobsCreated, failed: 0 },
        { name: 'LinkedIn Email', status: gmailHealth, lastSync: lastGmailSync, newJobs: gmailJobEvents.filter(e => e.status === 'success').length, failed: totalFailed },
        { name: 'Telegram', status: telegramHealth, lastSync: lastTelegramSync, newJobs: telegramEvents.filter(e => e.status === 'approved').length, failed: telegramEvents.filter(e => e.status === 'ignored').length }
      ],
      stats: {
        messagesReceived: totalReceivedMessages,
        jobsDetected: totalReceivedMessages,
        jobsCreated: totalJobsCreated,
        duplicates: totalDuplicates,
        pendingReview: totalPending,
        failed: totalFailed
      }
    });
  })
);

// Fetch Deduplication matching audit logs
router.get(
  '/deduplication-logs',
  asyncHandler(async (req, res) => {
    const userId = req.auth.userId;
    const logs = await models.JobDeduplicationLog.findAll({
      where: { user_id: userId },
      order: [['loggedAt', 'DESC']],
      limit: 50
    });
    ok(res, logs);
  })
);

export default router;
