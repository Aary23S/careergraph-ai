import { models, sequelize } from '../config/database.js';
import { Op } from 'sequelize';

export async function getCompanyDirectory(userId, options = {}) {
  const { search = '', page = 1, limit = 50, sortBy = 'connections', sortOrder = 'desc' } = options;
  const offset = (page - 1) * limit;

  // Build where clause
  const where = {
    user_id: userId,
    normalizedCompany: { [Op.not]: null, [Op.ne]: '' }
  };

  if (search) {
    where[Op.or] = [
      { company: { [Op.iLike]: `%${search}%` } },
      { normalizedCompany: { [Op.iLike]: `%${search}%` } }
    ];
  }

  // Get aggregated records
  // We compute: count, senior+, engineering, recruiter, contacted, not contacted, high priority
  const results = await models.Connection.findAll({
    where,
    attributes: [
      'normalizedCompany',
      [sequelize.fn('MAX', sequelize.col('company')), 'companyName'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'connectionCount'],
      [
        sequelize.literal(`SUM(CASE WHEN seniority_level IN ('senior', 'lead', 'manager', 'director', 'vp', 'executive') THEN 1 ELSE 0 END)`),
        'seniorPlusCount'
      ],
      [
        sequelize.literal(`SUM(CASE WHEN role_category = 'engineering' THEN 1 ELSE 0 END)`),
        'engineeringCount'
      ],
      [
        sequelize.literal(`SUM(CASE WHEN role_category = 'recruiting' OR title ILIKE '%recruiter%' THEN 1 ELSE 0 END)`),
        'recruiterCount'
      ],
      [
        sequelize.literal(`SUM(CASE WHEN relationship_status IN ('contacted', 'replied') THEN 1 ELSE 0 END)`),
        'contactedCount'
      ],
      [
        sequelize.literal(`SUM(CASE WHEN relationship_status = 'not_contacted' OR relationship_status IS NULL THEN 1 ELSE 0 END)`),
        'notContactedCount'
      ],
      [
        sequelize.literal(`SUM(CASE WHEN priority IN ('high', 'critical') THEN 1 ELSE 0 END)`),
        'highPriorityCount'
      ]
    ],
    group: ['normalizedCompany'],
    raw: true
  });

  // Map to correct types (convert string counts to integers)
  const mapped = results.map(r => ({
    companyKey: r.normalizedCompany,
    companyName: r.companyName || r.normalizedCompany,
    connectionCount: parseInt(r.connectionCount || 0, 10),
    seniorPlusCount: parseInt(r.seniorPlusCount || 0, 10),
    engineeringCount: parseInt(r.engineeringCount || 0, 10),
    recruiterCount: parseInt(r.recruiterCount || 0, 10),
    contactedCount: parseInt(r.contactedCount || 0, 10),
    notContactedCount: parseInt(r.notContactedCount || 0, 10),
    highPriorityCount: parseInt(r.highPriorityCount || 0, 10)
  }));

  // Sorting
  mapped.sort((a, b) => {
    let fieldA = a.connectionCount;
    let fieldB = b.connectionCount;

    if (sortBy === 'companyName') {
      fieldA = a.companyName.toLowerCase();
      fieldB = b.companyName.toLowerCase();
      return sortOrder === 'asc' ? fieldA.localeCompare(fieldB) : fieldB.localeCompare(fieldA);
    }
    
    if (sortBy === 'seniorPlus') {
      fieldA = a.seniorPlusCount;
      fieldB = b.seniorPlusCount;
    } else if (sortBy === 'engineering') {
      fieldA = a.engineeringCount;
      fieldB = b.engineeringCount;
    } else if (sortBy === 'recruiter') {
      fieldA = a.recruiterCount;
      fieldB = b.recruiterCount;
    } else if (sortBy === 'highPriority') {
      fieldA = a.highPriorityCount;
      fieldB = b.highPriorityCount;
    }

    return sortOrder === 'asc' ? fieldA - fieldB : fieldB - fieldA;
  });

  const total = mapped.length;
  const paginated = mapped.slice(offset, offset + limit);

  return {
    companies: paginated,
    total,
    totalPages: Math.ceil(total / limit),
    page,
    limit
  };
}

export async function getCompanyDetail(userId, companyKey) {
  const where = {
    user_id: userId,
    normalizedCompany: companyKey
  };

  // Get total connections
  const totalConnections = await models.Connection.count({ where });
  if (totalConnections === 0) {
    return null;
  }

  // Get company name
  const sample = await models.Connection.findOne({
    where,
    attributes: ['company']
  });
  const companyName = sample ? sample.company : companyKey;

  // Role distribution
  const roles = await models.Connection.findAll({
    where,
    attributes: [
      [sequelize.literal(`COALESCE(role_category, 'other')`), 'category'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: [sequelize.literal(`COALESCE(role_category, 'other')`)],
    raw: true
  });

  // Seniority distribution
  const seniority = await models.Connection.findAll({
    where,
    attributes: [
      [sequelize.literal(`COALESCE(seniority_level, 'mid')`), 'level'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: [sequelize.literal(`COALESCE(seniority_level, 'mid')`)],
    raw: true
  });

  // Relationship distribution
  const relationships = await models.Connection.findAll({
    where,
    attributes: [
      [sequelize.literal(`COALESCE(relationship_status, 'not_contacted')`), 'status'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'count']
    ],
    group: [sequelize.literal(`COALESCE(relationship_status, 'not_contacted')`)],
    raw: true
  });

  // Specific aggregates
  const recruiters = await models.Connection.count({
    where: {
      ...where,
      [Op.or]: [
        { roleCategory: 'recruiting' },
        { title: { [Op.iLike]: '%recruiter%' } }
      ]
    }
  });

  const engineeringLeaders = await models.Connection.count({
    where: {
      ...where,
      roleCategory: 'engineering',
      seniorityLevel: { [Op.in]: ['manager', 'director', 'vp', 'executive'] }
    }
  });

  const highPriority = await models.Connection.count({
    where: {
      ...where,
      priority: { [Op.in]: ['high', 'critical'] }
    }
  });

  const notContacted = await models.Connection.count({
    where: {
      ...where,
      relationshipStatus: { [Op.or]: [null, 'not_contacted'] }
    }
  });

  // AI-derived domains/expertise aggregates
  const aiEnrichments = await models.ConnectionAiEnrichment.findAll({
    include: [{
      model: models.Connection,
      as: 'connection',
      where: {
        user_id: userId,
        normalizedCompany: companyKey
      },
      attributes: []
    }]
  });

  const expertiseCounts = {};
  aiEnrichments.forEach(enrich => {
    const domains = enrich.userCorrectedTechnicalDomains || enrich.technicalDomains || [];
    domains.forEach(d => {
      if (d) {
        const normalized = d.trim().replace(/^\w/, c => c.toUpperCase());
        expertiseCounts[normalized] = (expertiseCounts[normalized] || 0) + 1;
      }
    });
  });

  const aiExpertise = Object.entries(expertiseCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    companyKey,
    companyName,
    totalConnections,
    recruiters,
    engineeringLeaders,
    highPriority,
    notContacted,
    rolesDistribution: roles.map(r => ({ category: r.category, count: parseInt(r.count, 10) })),
    seniorityDistribution: seniority.map(s => ({ level: s.level, count: parseInt(s.count, 10) })),
    relationshipDistribution: relationships.map(rel => ({ status: rel.status, count: parseInt(rel.count, 10) })),
    aiExpertise
  };
}
