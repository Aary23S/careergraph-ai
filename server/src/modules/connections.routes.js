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
  lastContactedDate: Joi.string().allow('', null),
  nextFollowUpDate: Joi.string().allow('', null),
  tags: Joi.array().items(Joi.string()).default([]),
});

const querySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(10),
  q: Joi.string().allow('', null),
  company: Joi.string().allow('', null),
  title: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  industry: Joi.string().allow('', null),
  relationship: Joi.string().allow('', null),
  contacted: Joi.boolean(),
  followUpDue: Joi.boolean(),
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

router.get(
  '/',
  validate(querySchema, 'query'),
  asyncHandler(async (req, res) => {
    const pagination = getPagination(req.query);
    const where = { user_id: req.auth.userId };

    if (req.query.q) {
      where[Op.or] = [
        { name: { [Op.like]: `%${req.query.q}%` } },
        { company: { [Op.like]: `%${req.query.q}%` } },
        { title: { [Op.like]: `%${req.query.q}%` } },
        { email: { [Op.like]: `%${req.query.q}%` } },
      ];
    }

    if (req.query.company) where.company = req.query.company;
    if (req.query.title) where.title = req.query.title;
    if (req.query.location) where.location = req.query.location;
    if (req.query.industry) where.industry = req.query.industry;
    if (req.query.relationship) where.relationshipStatus = req.query.relationship;
    if (req.query.contacted === true) where.lastContactedDate = { [Op.not]: null };
    if (req.query.contacted === false) where.lastContactedDate = null;
    if (req.query.followUpDue) {
      where.nextFollowUpDate = { [Op.lte]: new Date().toISOString().slice(0, 10) };
    }

    const { rows, count } = await models.Connection.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit: pagination.limit,
      offset: pagination.offset,
    });

    const items = await Promise.all(rows.map(serializeConnection));
    ok(res, items, makePageMeta({ ...pagination, total: count }));
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

    ok(res, {
      ...base,
      relevantCompanies: connection.company ? [connection.company] : [],
      relevantRoles: connection.title ? [connection.title] : [],
      associatedJobs,
      referralOpportunities,
      outreachHistory: outreach ? outreach.events : [],
      outreachNotes: outreach ? outreach.notes : '',
      outreachStatus: outreach ? outreach.status : 'not_contacted',
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
