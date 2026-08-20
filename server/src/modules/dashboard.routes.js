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

    // 1. Fetch active jobs & calculate opportunity scores
    const jobs = await models.Job.findAll({
      where: { user_id: userId, isArchived: false },
      include: [{ model: models.Company, as: 'company' }],
    });

    const activeConnections = await models.Connection.findAll({ where: { user_id: userId } });

    const scoredJobs = await Promise.all(
      jobs.map(async (job) => {
        const matchScore = calculateMatchScore(profile, job);
        
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

    const result = await emailService.sendDigest(user.email, profile?.name || 'User', {
      topJobs,
      topReferrals,
      pendingFollowUps
    });

    ok(res, { sent: true, recipient: user.email, result });
  }),
);

export default router;
