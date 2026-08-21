import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { models } from '../config/database.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { getPagination, makePageMeta } from '../lib/pagination.js';
import { createNotification } from '../lib/notifications.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { calculateReferralScore } from '../services/intelligence.service.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const createSchema = Joi.object({
  name: Joi.string().required(),
  company: Joi.string().allow('', null),
  title: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  email: Joi.string().allow('', null),
  profileUrl: Joi.string().allow('', null),
  connectedDate: Joi.string().allow('', null),
  industry: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  relationshipStatus: Joi.string().allow('', null),
  relationshipStrength: Joi.string().allow('', null),
  priority: Joi.string().allow('', null),
  lastContactedDate: Joi.string().allow('', null),
  nextFollowUpDate: Joi.string().allow('', null),
  tags: Joi.array().items(Joi.string()).default([]),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().valid(25, 50, 100).default(50),
  pageSize: Joi.number().integer().min(1).max(100), // backward compatibility
  search: Joi.string().allow('', null),
  q: Joi.string().allow('', null),
  company: Joi.string().allow('', null),
  companies: Joi.string().allow('', null),
  position: Joi.string().allow('', null),
  positions: Joi.string().allow('', null),
  seniority: Joi.string().allow('', null),
  roleCategory: Joi.string().allow('', null),
  relationshipStatus: Joi.string().allow('', null),
  relationship: Joi.string().allow('', null), // backward compatibility
  relationshipStrength: Joi.string().allow('', null),
  priority: Joi.string().allow('', null),
  hasEmail: Joi.boolean(),
  connectedFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('connectedFrom must be in format YYYY-MM-DD').allow('', null),
  connectedTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('connectedTo must be in format YYYY-MM-DD').allow('', null),
  lastContactedFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('lastContactedFrom must be in format YYYY-MM-DD').allow('', null),
  lastContactedTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('lastContactedTo must be in format YYYY-MM-DD').allow('', null),
  followUpFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('followUpFrom must be in format YYYY-MM-DD').allow('', null),
  followUpTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).message('followUpTo must be in format YYYY-MM-DD').allow('', null),
  followUpDue: Joi.boolean(),
  sortBy: Joi.string().valid(
    'name',
    'company',
    'title',
    'connectedDate',
    'lastContactedDate',
    'nextFollowUpDate',
    'priority',
    'connectionScore',
    'seniority'
  ).default('connectedDate'),
  sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc'),
});

function mapCsvRecord(record) {
  const firstName = record['First Name'] || record['first name'] || record.first_name || '';
  const lastName = record['Last Name'] || record['last name'] || record.last_name || '';
  let name = record.name || record.Name || '';
  if (!name && (firstName || lastName)) {
    name = `${firstName} ${lastName}`.trim();
  }

  return {
    name,
    company: record.company || record.Company || null,
    title: record.title || record.Title || record.Position || record.position || null,
    location: record.location || record.Location || null,
    email: record.email || record.Email || record['Email Address'] || record['email address'] || null,
    profileUrl: record.profile_url || record['profile url'] || record['Profile URL'] || record.URL || record.url || null,
    connectedDate: record.connected_date || record['connected date'] || record['Connected On'] || record['connected on'] || null,
    industry: record.industry || record.Industry || null,
    notes: record.notes || record.Notes || null,
    relationshipStatus:
      record.relationship_status || record.relationship || record['relationship status'] || null,
    relationshipStrength:
      record.relationship_strength || record['relationship strength'] || null,
    lastContactedDate: record.last_contacted_date || record['last contacted date'] || null,
    nextFollowUpDate: record.next_follow_up_date || record['next follow-up date'] || null,
    tags: [],
  };
}

async function upsertTags(connection, userId, tags) {
  await models.ConnectionTag.destroy({ where: { connection_id: connection.id, user_id: userId } });
  if (!tags.length) {
    return;
  }

  await models.ConnectionTag.bulkCreate(
    tags.map((tag) => ({
      connection_id: connection.id,
      user_id: userId,
      tag,
    })),
  );
}

async function serializeConnection(connection) {
  const tags = await models.ConnectionTag.findAll({
    where: { connection_id: connection.id },
    order: [['tag', 'ASC']],
  });

  return {
    ...connection.toJSON(),
    tags: tags.map((tag) => tag.tag),
  };
}

async function ensureConnectionOwnership(userId, connectionId) {
  const connection = await models.Connection.findOne({
    where: { id: connectionId, user_id: userId },
  });

  if (!connection) {
    throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found.');
  }

  return connection;
}

router.use(requireAuth);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const connection = await models.Connection.create({
      user_id: req.auth.userId,
      ...req.body,
    });
    await upsertTags(connection, req.auth.userId, req.body.tags);

    if (connection.nextFollowUpDate) {
      await createNotification(models, {
        user_id: req.auth.userId,
        type: 'follow_up_due',
        title: 'Connection follow-up scheduled',
        message: `Follow up with ${connection.name} on ${connection.nextFollowUpDate}.`,
        relatedEntityType: 'connection',
        relatedEntityId: connection.id,
        dueAt: new Date(connection.nextFollowUpDate),
      });
    }

    created(res, await serializeConnection(connection));
  }),
);

router.post(
  '/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    let csvContent = req.file
      ? req.file.buffer.toString('utf8')
      : req.body.csvContent;

    if (!csvContent) {
      throw new AppError(400, 'CSV_REQUIRED', 'CSV content is required.');
    }

    // Strip LinkedIn intro notes/lines if present
    const headerMatch = csvContent.match(/(?:^|\n)(["']?First Name["']?|["']?Name["']?)/i);
    if (headerMatch) {
      csvContent = csvContent.substring(headerMatch.index).trim();
    }

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const batchId = crypto.randomUUID();
    let imported = 0;
    let duplicates = 0;
    const errors = [];

    for (const record of records) {
      const mapped = mapCsvRecord(record);
      const { error, value } = createSchema.validate(mapped, { abortEarly: false });

      if (error) {
        errors.push({ record, details: error.details });
        continue;
      }

      const duplicate = await models.Connection.findOne({
        where: {
          user_id: req.auth.userId,
          [Op.or]: [
            value.email ? { email: value.email } : null,
            {
              name: value.name,
              company: value.company,
              title: value.title,
            },
          ].filter(Boolean),
        },
      });

      if (duplicate) {
        duplicates += 1;
        continue;
      }

      await models.Connection.create({
        user_id: req.auth.userId,
        importBatchId: batchId,
        ...value,
      });
      imported += 1;
    }

    ok(res, { imported, duplicates, errors, batchId });
  }),
);

export function parseConnectionFilters(query) {
  return {
    search: query.search || query.q || null,
    companies: query.companies || query.company || null,
    positions: query.positions || query.position || null,
    seniority: query.seniority || null,
    roleCategory: query.roleCategory || null,
    relationshipStatus: query.relationshipStatus || query.relationship || null,
    relationshipStrength: query.relationshipStrength || null,
    priority: query.priority || null,
    hasEmail: (query.hasEmail !== undefined && query.hasEmail !== null && query.hasEmail !== '')
      ? (query.hasEmail === true || query.hasEmail === 'true')
      : undefined,
    connectedFrom: query.connectedFrom || null,
    connectedTo: query.connectedTo || null,
    lastContactedFrom: query.lastContactedFrom || null,
    lastContactedTo: query.lastContactedTo || null,
    followUpFrom: query.followUpFrom || null,
    followUpTo: query.followUpTo || null,
    followUpDue: (query.followUpDue !== undefined && query.followUpDue !== null && query.followUpDue !== '')
      ? (query.followUpDue === true || query.followUpDue === 'true')
      : undefined,
  };
}

export function buildConnectionWhereClause(userId, filters) {
  const where = { user_id: userId };
  const parseCsvFilter = (val) => val.split(',').map(v => v.trim()).filter(Boolean);

  // 1. Search Query
  if (filters.search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${filters.search}%` } },
      { email: { [Op.iLike]: `%${filters.search}%` } },
      { company: { [Op.iLike]: `%${filters.search}%` } },
      { normalizedCompany: { [Op.iLike]: `%${filters.search}%` } },
      { title: { [Op.iLike]: `%${filters.search}%` } },
      { normalizedPosition: { [Op.iLike]: `%${filters.search}%` } },
      { profileUrl: { [Op.iLike]: `%${filters.search}%` } },
    ];
  }

  // 2. CSV Filters list
  const addCsvFilter = (field, filterVal, matchNormalizedField = null) => {
    if (filterVal) {
      const list = parseCsvFilter(filterVal);
      where[Op.and] = where[Op.and] || [];
      if (matchNormalizedField) {
        const lowerList = list.map(v => v.toLowerCase());
        where[Op.and].push({
          [Op.or]: [
            { [field]: { [Op.in]: list } },
            { [matchNormalizedField]: { [Op.in]: lowerList } }
          ]
        });
      } else {
        where[Op.and].push({ [field]: { [Op.in]: list } });
      }
    }
  };

  addCsvFilter('company', filters.companies, 'normalizedCompany');
  addCsvFilter('title', filters.positions, 'normalizedPosition');
  addCsvFilter('seniorityLevel', filters.seniority);
  addCsvFilter('roleCategory', filters.roleCategory);
  addCsvFilter('relationshipStatus', filters.relationshipStatus);
  addCsvFilter('relationshipStrength', filters.relationshipStrength);
  addCsvFilter('priority', filters.priority);

  // 3. hasEmail
  if (filters.hasEmail === true) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      email: {
        [Op.not]: null,
        [Op.ne]: '',
      }
    });
  } else if (filters.hasEmail === false) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { email: null },
        { email: '' }
      ]
    });
  }

  // 4. followUpDue
  if (filters.followUpDue === true) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      nextFollowUpDate: {
        [Op.not]: null,
        [Op.lte]: new Date().toISOString().slice(0, 10)
      }
    });
  } else if (filters.followUpDue === false) {
    where[Op.and] = where[Op.and] || [];
    where[Op.and].push({
      [Op.or]: [
        { nextFollowUpDate: null },
        { nextFollowUpDate: { [Op.gt]: new Date().toISOString().slice(0, 10) } }
      ]
    });
  }

  // 5. Date Ranges
  const addDateRange = (field, from, to) => {
    if (from || to) {
      const conditions = [];
      if (from) conditions.push({ [Op.gte]: from });
      if (to) conditions.push({ [Op.lte]: to });
      where[field] = { [Op.and]: conditions };
    }
  };

  addDateRange('connectedDate', filters.connectedFrom, filters.connectedTo);
  addDateRange('lastContactedDate', filters.lastContactedFrom, filters.lastContactedTo);
  addDateRange('nextFollowUpDate', filters.followUpFrom, filters.followUpTo);

  return where;
}

export function buildConnectionOrder(sortBy, sortOrder) {
  const mapSortBy = (val) => {
    switch (val) {
      case 'seniority': return 'seniorityLevel';
      default: return val;
    }
  };
  const column = mapSortBy(sortBy || 'connectedDate');
  const direction = (sortOrder || 'desc').toUpperCase();
  return [[column, direction]];
}

export async function queryConnections(userId, filters, sortBy, sortOrder, limit, offset) {
  const where = buildConnectionWhereClause(userId, filters);
  const order = buildConnectionOrder(sortBy, sortOrder);

  const { rows, count } = await models.Connection.findAndCountAll({
    where,
    order,
    limit,
    offset,
  });

  return { rows, count };
}

router.get(
  '/',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const filters = parseConnectionFilters(req.query);

    const { rows, count } = await queryConnections(
      req.auth.userId,
      filters,
      req.query.sortBy,
      req.query.sortOrder,
      pagination.limit,
      pagination.offset
    );

    const items = await Promise.all(rows.map(serializeConnection));
    ok(res, items, makePageMeta({ ...pagination, total: count }), 200, filters);
  }),
);

router.get(
  '/:connectionId',
  asyncHandler(async (req, res) => {
    const connection = await ensureConnectionOwnership(req.auth.userId, req.params.connectionId);
    const base = await serializeConnection(connection);
    
    let associatedJobs = [];
    if (connection.company) {
      const comp = await models.Company.findOne({
        where: {
          normalizedName: connection.company.trim().toLowerCase().replace(/\s+/g, ' ')
        }
      });
      if (comp) {
        associatedJobs = await models.Job.findAll({
          where: { user_id: req.auth.userId, company_id: comp.id, isArchived: false },
          include: [{ model: models.Company, as: 'company' }]
        });
      }
    }

    const outreach = await models.Outreach.findOne({
      where: { user_id: req.auth.userId, connection_id: connection.id },
      include: [{ model: models.OutreachEvent, as: 'events' }]
    });

    const referralOpportunities = associatedJobs.map(job => ({
      jobId: job.id,
      jobTitle: job.title,
      referralScore: calculateReferralScore(connection, job)
    }));

    const notes = await models.Note.findAll({
      where: { user_id: req.auth.userId, entityType: 'connection', entityId: connection.id },
      order: [['created_at', 'DESC']]
    });

    const outreachEvents = outreach ? (outreach.events || []) : [];

    ok(res, {
      ...base,
      tags: base.tags || [],
      notes,
      outreach: outreachEvents,
      outreachHistory: outreachEvents,
      outreachNotes: outreach ? outreach.notes : '',
      outreachStatus: outreach ? outreach.status : 'not_contacted',
      relatedJobs: associatedJobs,
      associatedJobs,
      referralOpportunities,
      followUpDate: connection.nextFollowUpDate
    });
  }),
);

router.put(
  '/:connectionId',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const connection = await ensureConnectionOwnership(req.auth.userId, req.params.connectionId);
    await connection.update(req.body);
    await upsertTags(connection, req.auth.userId, req.body.tags);
    ok(res, await serializeConnection(connection));
  }),
);

router.delete(
  '/:connectionId',
  asyncHandler(async (req, res) => {
    const connection = await ensureConnectionOwnership(req.auth.userId, req.params.connectionId);
    await models.ConnectionTag.destroy({ where: { connection_id: connection.id } });
    await connection.destroy();
    ok(res, { deleted: true });
  }),
);

export default router;
