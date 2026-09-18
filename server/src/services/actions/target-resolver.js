import { models } from '../../config/database.js';
import { Op } from 'sequelize';
import { TargetTypes } from './action-registry.js';

const likeOp = Op.like;

export class TargetResolver {
  static getLikeOp() {
    return models.sequelize?.options?.dialect === 'postgres' ? Op.iLike : Op.like;
  }

  static cleanTerm(description) {
    if (!description || !description.trim()) return '';
    const cleaned = description.trim().replace(/\b(create|draft|write|send|prepare|a|the|professional|message|outreach|email|referral|for|to|in|at|job|application|status|note)\b/gi, '').trim();
    return cleaned.length > 0 ? cleaned : description.trim();
  }

  /**
   * Resolves a natural language target description to a specific entity.
   * If the target is ambiguous or missing, it returns options.
   * 
   * @param {string} userId - The authenticated user's ID
   * @param {string} targetType - The expected TargetType (job, connection, application)
   * @param {string} targetDescription - Natural language describing the target (e.g., "Google job", "John from Microsoft")
   * @returns {Promise<Object>} { resolvedTarget, needsClarification, candidates }
   */
  static async resolve(userId, targetType, targetDescription) {
    if (!targetDescription || !targetDescription.trim()) {
      return { needsClarification: true, candidates: [] };
    }

    const term = this.cleanTerm(targetDescription);

    if (targetType === TargetTypes.JOB) {
      return this._resolveJob(userId, term);
    }

    if (targetType === TargetTypes.CONNECTION) {
      return this._resolveConnection(userId, term);
    }

    if (targetType === TargetTypes.APPLICATION) {
      return this._resolveApplication(userId, term);
    }

    throw new Error(`Unsupported target resolution type: ${targetType}`);
  }

  static async _resolveJob(userId, term) {
    const activeLikeOp = this.getLikeOp();
    const jobs = await models.Job.findAll({
      where: {
        user_id: userId,
        [Op.or]: [
          { title: { [activeLikeOp]: `%${term}%` } },
          { normalizedCompany: { [activeLikeOp]: `%${term}%` } }
        ]
      },
      limit: 5
    });

    if (jobs.length >= 1) {
      return { resolvedTarget: jobs[0], candidates: jobs.map(j => ({ id: j.id, label: `${j.title} at ${j.company || j.normalizedCompany || 'Company'}` })) };
    }

    return {
      needsClarification: true,
      candidates: []
    };
  }

  static async _resolveConnection(userId, term) {
    const activeLikeOp = this.getLikeOp();
    const connections = await models.Connection.findAll({
      where: {
        user_id: userId,
        [Op.or]: [
          { name: { [activeLikeOp]: `%${term}%` } },
          { company: { [activeLikeOp]: `%${term}%` } },
          { title: { [activeLikeOp]: `%${term}%` } },
          { email: { [activeLikeOp]: `%${term}%` } }
        ]
      },
      limit: 5
    });

    if (connections.length >= 1) {
      return { resolvedTarget: connections[0], candidates: connections.map(c => ({ id: c.id, label: `${c.name} (${c.company || 'Company'})` })) };
    }

    return {
      needsClarification: true,
      candidates: []
    };
  }

  static async _resolveApplication(userId, term) {
    // We try to match job company or title for the application
    const applications = await models.Application.findAll({
      where: { user_id: userId },
      include: [
        {
          model: models.Job,
          as: 'job',
          where: {
            [Op.or]: [
              { title: { [likeOp]: `%${term}%` } },
              { company: { [likeOp]: `%${term}%` } }
            ]
          }
        }
      ],
      limit: 5
    });

    if (applications.length === 1) {
      return { resolvedTarget: applications[0] };
    }

    return {
      needsClarification: true,
      candidates: applications.map(a => ({ id: a.id, label: `Application for ${a.job?.title} at ${a.job?.company}` }))
    };
  }
}
