import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { models } from '../config/database.js';
import { fileStorage } from '../lib/storage.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { getPagination, makePageMeta } from '../lib/pagination.js';
import { createNotification } from '../lib/notifications.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { calculateReferralScore } from '../services/intelligence.service.js';
import { getDashboardOverview } from '../services/connection-dashboard.service.js';
import { parseLinkedInPDF } from '../services/linkedin-pdf-parser.js';
import { getCompanyDirectory, getCompanyDetail } from '../services/company.service.js';

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
  headline: Joi.string().allow('', null),
  profileSummary: Joi.string().allow('', null),
  skills: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  externalLinks: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  profilePdfKey: Joi.string().allow('', null),
  languages: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  certifications: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  projects: Joi.alternatives().try(Joi.array().items(Joi.string()), Joi.string()).allow(null),
  experience: Joi.alternatives().try(Joi.array(), Joi.string()).allow(null),
  education: Joi.alternatives().try(Joi.array(), Joi.string()).allow(null),
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

const savedViewFiltersSchema = Joi.object({
  search: Joi.string().allow('', null),
  q: Joi.string().allow('', null),
  company: Joi.string().allow('', null),
  companies: Joi.array().items(Joi.string()).allow(null),
  position: Joi.string().allow('', null),
  positions: Joi.array().items(Joi.string()).allow(null),
  seniority: Joi.array().items(Joi.string()).allow(null),
  roleCategory: Joi.array().items(Joi.string()).allow(null),
  relationshipStatus: Joi.array().items(Joi.string()).allow(null),
  relationshipStrength: Joi.array().items(Joi.string()).allow(null),
  priority: Joi.array().items(Joi.string()).allow(null),
  hasEmail: Joi.boolean().allow(null),
  connectedFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  connectedTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  lastContactedFrom: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  lastContactedTo: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).allow('', null),
  followUpDue: Joi.boolean().allow(null),
}).unknown(true);

const savedViewCreateSchema = Joi.object({
  name: Joi.string().max(100).required(),
  description: Joi.string().allow('', null),
  filters: savedViewFiltersSchema.required(),
  sort: Joi.object({
    sortBy: Joi.string().valid('connectedDate', 'connectionScore', 'name', 'company', 'title', 'lastContactedDate', 'nextFollowUpDate', 'priority').default('connectedDate'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  }).required(),
});

const savedViewUpdateSchema = Joi.object({
  name: Joi.string().max(100),
  description: Joi.string().allow('', null),
  filters: savedViewFiltersSchema,
  sort: Joi.object({
    sortBy: Joi.string().valid('connectedDate', 'connectionScore', 'name', 'company', 'title', 'lastContactedDate', 'nextFollowUpDate', 'priority'),
    sortOrder: Joi.string().valid('asc', 'desc'),
  }),
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
    const body = { ...req.body };
    if (typeof body.skills === 'string') {
      body.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.externalLinks === 'string') {
      body.externalLinks = body.externalLinks.split(',').map(l => l.trim()).filter(Boolean);
    }
    if (typeof body.languages === 'string') {
      body.languages = body.languages.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.certifications === 'string') {
      body.certifications = body.certifications.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.projects === 'string') {
      body.projects = body.projects.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.experience === 'string') {
      try { body.experience = JSON.parse(body.experience); } catch(e) {}
    }
    if (typeof body.education === 'string') {
      try { body.education = JSON.parse(body.education); } catch(e) {}
    }
    const dateFields = ['nextFollowUpDate', 'lastContactedDate', 'connectedDate'];
    dateFields.forEach(field => {
      if (body[field] === '') {
        body[field] = null;
      }
    });
    const connection = await models.Connection.create({
      user_id: req.auth.userId,
      ...body,
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
  '/overview',
  asyncHandler(async (req, res) => {
    const overview = await getDashboardOverview(req.auth.userId);
    ok(res, overview);
  }),
);

router.get(
  '/views',
  asyncHandler(async (req, res) => {
    const views = await models.SavedConnectionView.findAll({
      where: { user_id: req.auth.userId },
      order: [['updatedAt', 'DESC']],
    });
    ok(res, views);
  })
);

router.post(
  '/views',
  validate(savedViewCreateSchema),
  asyncHandler(async (req, res) => {
    const existing = await models.SavedConnectionView.findOne({
      where: { user_id: req.auth.userId, name: req.body.name }
    });
    if (existing) {
      throw new AppError(409, 'DUPLICATE_NAME', 'A saved view with this name already exists.');
    }

    const view = await models.SavedConnectionView.create({
      user_id: req.auth.userId,
      name: req.body.name,
      description: req.body.description || null,
      filtersJson: req.body.filters,
      sortJson: req.body.sort,
      filterVersion: 1,
    });
    created(res, view);
  })
);

router.get(
  '/views/:id',
  asyncHandler(async (req, res) => {
    const view = await models.SavedConnectionView.findOne({
      where: { id: req.params.id, user_id: req.auth.userId },
    });
    if (!view) {
      throw new AppError(404, 'NOT_FOUND', 'Saved view not found.');
    }
    await view.update({ lastUsedAt: new Date() });
    ok(res, view);
  })
);

router.put(
  '/views/:id',
  validate(savedViewUpdateSchema),
  asyncHandler(async (req, res) => {
    const view = await models.SavedConnectionView.findOne({
      where: { id: req.params.id, user_id: req.auth.userId },
    });
    if (!view) {
      throw new AppError(404, 'NOT_FOUND', 'Saved view not found.');
    }

    if (req.body.name && req.body.name !== view.name) {
      const existing = await models.SavedConnectionView.findOne({
        where: { user_id: req.auth.userId, name: req.body.name }
      });
      if (existing) {
        throw new AppError(409, 'DUPLICATE_NAME', 'A saved view with this name already exists.');
      }
    }

    await view.update({
      name: req.body.name !== undefined ? req.body.name : view.name,
      description: req.body.description !== undefined ? req.body.description : view.description,
      filtersJson: req.body.filters !== undefined ? req.body.filters : view.filtersJson,
      sortJson: req.body.sort !== undefined ? req.body.sort : view.sortJson,
    });
    ok(res, view);
  })
);

router.delete(
  '/views/:id',
  asyncHandler(async (req, res) => {
    const view = await models.SavedConnectionView.findOne({
      where: { id: req.params.id, user_id: req.auth.userId },
    });
    if (!view) {
      throw new AppError(404, 'NOT_FOUND', 'Saved view not found.');
    }
    await view.destroy();
    ok(res, { message: 'Saved view deleted successfully.' });
  })
);

router.post(
  '/views/:id/duplicate',
  asyncHandler(async (req, res) => {
    const view = await models.SavedConnectionView.findOne({
      where: { id: req.params.id, user_id: req.auth.userId },
    });
    if (!view) {
      throw new AppError(404, 'NOT_FOUND', 'Saved view not found.');
    }
    
    let name = `${view.name} (Copy)`;
    let existing = await models.SavedConnectionView.findOne({
      where: { user_id: req.auth.userId, name }
    });
    let counter = 1;
    while (existing) {
      name = `${view.name} (Copy ${counter})`;
      existing = await models.SavedConnectionView.findOne({
        where: { user_id: req.auth.userId, name }
      });
      counter++;
    }

    const dup = await models.SavedConnectionView.create({
      user_id: req.auth.userId,
      name,
      description: view.description,
      filtersJson: view.filtersJson,
      sortJson: view.sortJson,
      filterVersion: view.filterVersion,
    });
    created(res, dup);
  })
);

const companyQuerySchema = Joi.object({
  search: Joi.string().allow('', null),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().valid(25, 50, 100).default(50),
  sortBy: Joi.string().valid('connections', 'companyName', 'seniorPlus', 'engineering', 'recruiter', 'highPriority').default('connections'),
  sortOrder: Joi.string().lowercase().valid('asc', 'desc').default('desc')
});

router.get(
  '/companies',
  validate(companyQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const options = {
      search: req.query.search,
      page: parseInt(req.query.page, 10) || 1,
      limit: parseInt(req.query.limit, 10) || 50,
      sortBy: req.query.sortBy,
      sortOrder: req.query.sortOrder
    };
    const result = await getCompanyDirectory(req.auth.userId, options);
    ok(res, result.companies, makePageMeta(result), 200);
  })
);

router.get(
  '/companies/:companyKey',
  asyncHandler(async (req, res) => {
    const details = await getCompanyDetail(req.auth.userId, req.params.companyKey);
    if (!details) {
      throw new AppError(404, 'COMPANY_NOT_FOUND', 'Company details not found.');
    }
    ok(res, details);
  })
);

router.post(
  '/enrichment/import',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'PDF file is required.');
    }
    const saved = await fileStorage.save(req.file);
    const parsed = await parseLinkedInPDF(req.file.buffer);
    parsed.profilePdfKey = saved.key;
    
    // Perform matching priority
    let matchedConnection = null;
    
    const cleanUrl = (url) => url ? url.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '') : '';

    const allConnections = await models.Connection.findAll({
      where: { user_id: req.auth.userId }
    });

    if (parsed.profileUrl) {
      const targetClean = cleanUrl(parsed.profileUrl);
      matchedConnection = allConnections.find(c => c.profileUrl && cleanUrl(c.profileUrl) === targetClean);
    }

    if (!matchedConnection && parsed.email) {
      const targetEmail = parsed.email.toLowerCase();
      matchedConnection = allConnections.find(c => c.email && c.email.toLowerCase() === targetEmail);
    }

    if (!matchedConnection && parsed.name && parsed.company) {
      const targetName = parsed.name.toLowerCase();
      const targetCompany = parsed.company.toLowerCase();
      matchedConnection = allConnections.find(c => 
        c.name && c.name.toLowerCase() === targetName && 
        c.company && c.company.toLowerCase() === targetCompany
      );
    }

    if (!matchedConnection && parsed.name) {
      const targetName = parsed.name.toLowerCase();
      matchedConnection = allConnections.find(c => 
        c.name && c.name.toLowerCase() === targetName
      );
    }

    ok(res, {
      matched: matchedConnection ? [await serializeConnection(matchedConnection)] : [],
      new: matchedConnection ? [] : [parsed],
      parsed
    });
  })
);

router.post(
  '/enrichment/confirm',
  asyncHandler(async (req, res) => {
    const { action, parsed, connectionId } = req.body;
    if (!action || !parsed) {
      throw new AppError(400, 'PAYLOAD_REQUIRED', 'Action and parsed profile are required.');
    }

    if (action === 'enrich') {
      if (!connectionId) {
        throw new AppError(400, 'CONNECTION_ID_REQUIRED', 'Connection ID is required for enrichment.');
      }
      const connection = await ensureConnectionOwnership(req.auth.userId, connectionId);
      
      const updates = {};
      for (const key of ['headline', 'profileSummary', 'location', 'email', 'profileUrl']) {
        if (parsed[key] !== undefined && parsed[key] !== null && parsed[key] !== '') {
          if (!connection[key]) {
            updates[key] = parsed[key];
          }
        }
      }

      // Merge arrays
      if (parsed.skills && parsed.skills.length > 0) {
        const existingSkills = connection.skills || [];
        updates.skills = Array.from(new Set([...existingSkills, ...parsed.skills]));
      }
      if (parsed.externalLinks && parsed.externalLinks.length > 0) {
        const existingLinks = connection.externalLinks || [];
        updates.externalLinks = Array.from(new Set([...existingLinks, ...parsed.externalLinks]));
      }
      if (parsed.languages && parsed.languages.length > 0) {
        const existing = connection.languages || [];
        updates.languages = Array.from(new Set([...existing, ...parsed.languages]));
      }
      if (parsed.certifications && parsed.certifications.length > 0) {
        const existing = connection.certifications || [];
        updates.certifications = Array.from(new Set([...existing, ...parsed.certifications]));
      }
      if (parsed.projects && parsed.projects.length > 0) {
        const existing = connection.projects || [];
        updates.projects = Array.from(new Set([...existing, ...parsed.projects]));
      }
      if (parsed.experience && parsed.experience.length > 0) {
        const existing = connection.experience || [];
        const combined = [...existing];
        parsed.experience.forEach(newItem => {
          const isDuplicate = existing.some(oldItem => 
            oldItem.company?.toLowerCase() === newItem.company?.toLowerCase() &&
            oldItem.title?.toLowerCase() === newItem.title?.toLowerCase()
          );
          if (!isDuplicate) {
            combined.push(newItem);
          }
        });
        updates.experience = combined;
      }
      if (parsed.education && parsed.education.length > 0) {
        const existing = connection.education || [];
        const combined = [...existing];
        parsed.education.forEach(newItem => {
          const isDuplicate = existing.some(oldItem => 
            oldItem.institution?.toLowerCase() === newItem.institution?.toLowerCase() &&
            oldItem.degree?.toLowerCase() === newItem.degree?.toLowerCase()
          );
          if (!isDuplicate) {
            combined.push(newItem);
          }
        });
        updates.education = combined;
      }

      if (parsed.profilePdfKey) {
        updates.profilePdfKey = parsed.profilePdfKey;
      }

      // Track provenance
      const currentSources = connection.dataSources || {};
      const newSources = { ...currentSources };
      for (const key in updates) {
        if (key !== 'profilePdfKey') {
          newSources[key] = 'linkedin_pdf';
        }
      }
      updates.dataSources = newSources;
      updates.lastEnrichedAt = new Date();

      await connection.update(updates);
      ok(res, await serializeConnection(connection));
    } else if (action === 'create') {
      const newConnection = await models.Connection.create({
        user_id: req.auth.userId,
        name: parsed.name,
        company: parsed.company || null,
        title: parsed.title || parsed.headline || null,
        location: parsed.location || null,
        email: parsed.email || null,
        profileUrl: parsed.profileUrl || null,
        headline: parsed.headline || null,
        skills: parsed.skills || null,
        languages: parsed.languages || null,
        certifications: parsed.certifications || null,
        projects: parsed.projects || null,
        experience: parsed.experience || null,
        education: parsed.education || null,
        externalLinks: parsed.externalLinks || null,
        profileSummary: parsed.profileSummary || null,
        profilePdfKey: parsed.profilePdfKey || null,
        dataSources: {
          name: 'linkedin_pdf',
          company: parsed.company ? 'linkedin_pdf' : undefined,
          title: parsed.title ? 'linkedin_pdf' : undefined,
          headline: parsed.headline ? 'linkedin_pdf' : undefined,
          skills: parsed.skills ? 'linkedin_pdf' : undefined,
          profileSummary: parsed.profileSummary ? 'linkedin_pdf' : undefined,
          languages: parsed.languages ? 'linkedin_pdf' : undefined,
          certifications: parsed.certifications ? 'linkedin_pdf' : undefined,
          experience: parsed.experience ? 'linkedin_pdf' : undefined,
          education: parsed.education ? 'linkedin_pdf' : undefined
        },
        lastEnrichedAt: new Date()
      });
      created(res, await serializeConnection(newConnection));
    } else {
      throw new AppError(400, 'INVALID_ACTION', 'Action must be enrich or create.');
    }
  })
);

router.get(
  '/:connectionId/pdf',
  asyncHandler(async (req, res) => {
    const connection = await ensureConnectionOwnership(req.auth.userId, req.params.connectionId);
    if (!connection.profilePdfKey) {
      throw new AppError(404, 'NOT_FOUND', 'Profile PDF not found for this connection.');
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="profile.pdf"');
    fileStorage.createReadStream(connection.profilePdfKey).pipe(res);
  })
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
    const body = { ...req.body };
    if (typeof body.skills === 'string') {
      body.skills = body.skills.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.externalLinks === 'string') {
      body.externalLinks = body.externalLinks.split(',').map(l => l.trim()).filter(Boolean);
    }
    if (typeof body.languages === 'string') {
      body.languages = body.languages.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.certifications === 'string') {
      body.certifications = body.certifications.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.projects === 'string') {
      body.projects = body.projects.split(',').map(s => s.trim()).filter(Boolean);
    }
    if (typeof body.experience === 'string') {
      try { body.experience = JSON.parse(body.experience); } catch(e) {}
    }
    if (typeof body.education === 'string') {
      try { body.education = JSON.parse(body.education); } catch(e) {}
    }
    const dateFields = ['nextFollowUpDate', 'lastContactedDate', 'connectedDate'];
    dateFields.forEach(field => {
      if (body[field] === '') {
        body[field] = null;
      }
    });
    await connection.update(body);
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
