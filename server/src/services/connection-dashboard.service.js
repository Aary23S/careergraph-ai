import { Op, fn, col } from 'sequelize';
import { models } from '../config/database.js';

export async function getDashboardOverview(userId) {
  // 1. Summary Metrics
  const totalConnections = await models.Connection.count({
    where: { user_id: userId }
  });

  const distinctCompanies = await models.Connection.count({
    distinct: true,
    col: 'normalized_company',
    where: {
      user_id: userId,
      normalizedCompany: { [Op.and]: [{ [Op.ne]: '' }, { [Op.not]: null }] }
    }
  });

  const highPriority = await models.Connection.count({
    where: { user_id: userId, priority: 'high' }
  });

  const neverContacted = await models.Connection.count({
    where: { user_id: userId, relationshipStatus: 'not_contacted' }
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const followUpsDue = await models.Connection.count({
    where: {
      user_id: userId,
      nextFollowUpDate: {
        [Op.not]: null,
        [Op.lte]: todayStr
      }
    }
  });

  const withEmail = await models.Connection.count({
    where: {
      user_id: userId,
      email: { [Op.and]: [{ [Op.ne]: '' }, { [Op.not]: null }] }
    }
  });

  // 2. Top Companies
  const topCompanies = await models.Connection.findAll({
    attributes: [
      ['company', 'name'],
      ['normalized_company', 'normalizedName'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: {
      user_id: userId,
      normalizedCompany: { [Op.and]: [{ [Op.ne]: '' }, { [Op.not]: null }] }
    },
    group: ['company', 'normalized_company'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    limit: 10,
    raw: true
  });

  // 3. Role Category Distribution
  const roles = await models.Connection.findAll({
    attributes: [
      ['role_category', 'category'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: { user_id: userId },
    group: ['role_category'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true
  });

  // 4. Seniority Distribution
  const seniority = await models.Connection.findAll({
    attributes: [
      ['seniority_level', 'level'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: { user_id: userId },
    group: ['seniority_level'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true
  });

  // 5. Relationship Distribution
  const relationships = await models.Connection.findAll({
    attributes: [
      ['relationship_status', 'status'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: { user_id: userId },
    group: ['relationship_status'],
    order: [[fn('COUNT', col('id')), 'DESC']],
    raw: true
  });

  // 6. Follow-up Aggregates
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split('T')[0];

  const overdueCount = await models.Connection.count({
    where: {
      user_id: userId,
      nextFollowUpDate: {
        [Op.not]: null,
        [Op.lt]: todayStr
      }
    }
  });

  const todayCount = await models.Connection.count({
    where: {
      user_id: userId,
      nextFollowUpDate: todayStr
    }
  });

  const thisWeekCount = await models.Connection.count({
    where: {
      user_id: userId,
      nextFollowUpDate: {
        [Op.between]: [todayStr, nextWeekStr]
      }
    }
  });

  // 7. Network Growth Data (cumulative monthly additions)
  const isPostgres = models.Connection.sequelize.options.dialect === 'postgres';
  const groupAttr = isPostgres 
    ? fn('to_char', col('connected_date'), 'YYYY-MM') 
    : fn('strftime', '%Y-%m', col('connected_date'));

  const growthRaw = await models.Connection.findAll({
    attributes: [
      [groupAttr, 'month'],
      [fn('COUNT', col('id')), 'count']
    ],
    where: {
      user_id: userId,
      connectedDate: { [Op.not]: null }
    },
    group: [isPostgres ? groupAttr : fn('strftime', '%Y-%m', col('connected_date'))],
    order: [[isPostgres ? groupAttr : fn('strftime', '%Y-%m', col('connected_date')), 'ASC']],
    raw: true
  });

  // Accumulate growth totals chronologically in JS memory
  let runningTotal = 0;
  const growth = growthRaw.map(item => {
    runningTotal += parseInt(item.count || 0, 10);
    return {
      month: item.month,
      added: parseInt(item.count || 0, 10),
      total: runningTotal
    };
  });

  // 8. High Priority Connections
  const highPriorityList = await models.Connection.findAll({
    attributes: ['id', 'name', 'title', 'company', 'connectionScore', 'priority'],
    where: { user_id: userId, priority: 'high' },
    order: [['connectionScore', 'DESC']],
    limit: 5
  });

  return {
    summary: {
      totalConnections,
      companies: distinctCompanies,
      highPriority,
      neverContacted,
      followUpsDue,
      withEmail
    },
    topCompanies: topCompanies.map(c => ({
      name: c.name,
      normalizedName: c.normalizedName,
      count: parseInt(c.count || 0, 10)
    })),
    roles: roles.map(r => ({
      category: r.category || 'unknown',
      count: parseInt(r.count || 0, 10)
    })),
    seniority: seniority.map(s => ({
      level: s.level || 'unknown',
      count: parseInt(s.count || 0, 10)
    })),
    relationships: relationships.map(rel => ({
      status: rel.status || 'not_contacted',
      count: parseInt(rel.count || 0, 10)
    })),
    followUps: {
      overdue: overdueCount,
      today: todayCount,
      thisWeek: thisWeekCount
    },
    growth,
    highPriorityConnections: highPriorityList
  };
}
