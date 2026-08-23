import { Op } from 'sequelize';
import { models } from '../config/database.js';

/**
 * Automatically purges expired or low-match jobs that do not have active applications.
 * Keeps the database size optimized and performance fast.
 * 
 * @param {string} userId The owner of the jobs
 * @returns {Promise<number>} Number of deleted job records
 */
export async function cleanupExpiredAndLowMatchJobs(userId) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch IDs of jobs that are actively tracked in applications
  const activeApplications = await models.Application.findAll({
    where: { user_id: userId },
    attributes: ['job_id'],
    raw: true
  });
  const protectedJobIds = activeApplications.map(app => app.job_id).filter(Boolean);

  // Delete jobs matching cleanup criteria
  const deletedCount = await models.Job.destroy({
    where: {
      user_id: userId,
      id: { [Op.notIn]: protectedJobIds },
      [Op.or]: [
        { matchScore: { [Op.lt]: 20 } },
        { fetchedAt: { [Op.lt]: thirtyDaysAgo } },
        { postedDate: { [Op.lt]: thirtyDaysAgo.toISOString().split('T')[0] } }
      ]
    }
  });

  return deletedCount;
}
