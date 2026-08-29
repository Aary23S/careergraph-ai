import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { OUTREACH_STATUSES } from '../database/models.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { createNotification } from '../lib/notifications.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const schema = Joi.object({
  connectionId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid(...OUTREACH_STATUSES)
    .required(),
  contactDate: Joi.string().allow('', null),
  followUpDate: Joi.string().allow('', null),
  notes: Joi.string().allow('', null),
  outcome: Joi.string().allow('', null),
});

const eventSchema = Joi.object({
  status: Joi.string()
    .valid(...OUTREACH_STATUSES)
    .required(),
  notes: Joi.string().allow('', null),
  occurredAt: Joi.date().optional(),
});

async function ensureConnectionOwnership(userId, connectionId) {
  const connection = await models.Connection.findOne({
    where: { id: connectionId, user_id: userId },
  });

  if (!connection) {
    throw new AppError(404, 'CONNECTION_NOT_FOUND', 'Connection not found.');
  }

  return connection;
}

async function ensureOutreachOwnership(userId, outreachId) {
  const outreach = await models.Outreach.findOne({
    where: { id: outreachId, user_id: userId },
    include: [
      { model: models.Connection, as: 'connection' },
      { model: models.OutreachEvent, as: 'events' },
    ],
    order: [[{ model: models.OutreachEvent, as: 'events' }, 'occurred_at', 'DESC']],
  });

  if (!outreach) {
    throw new AppError(404, 'OUTREACH_NOT_FOUND', 'Outreach record not found.');
  }

  return outreach;
}

async function createOutreachEvent(outreach, userId, status, notes, occurredAt, eventType) {
  return models.OutreachEvent.create({
    outreach_id: outreach.id,
    user_id: userId,
    status,
    notes,
    occurredAt: occurredAt || new Date(),
    eventType,
  });
}

async function serializeOutreach(outreach) {
  const notes = await models.Note.findAll({
    where: {
      user_id: outreach.user_id,
      entityType: 'outreach',
      entityId: outreach.id,
    },
    order: [['created_at', 'DESC']],
  });

  return {
    ...outreach.toJSON(),
    notesList: notes,
  };
}

router.use(requireAuth);

router.post(
  '/',
  validate(schema),
  asyncHandler(async (req, res) => {
    await ensureConnectionOwnership(req.auth.userId, req.body.connectionId);
    const outreach = await models.Outreach.create({
      user_id: req.auth.userId,
      connection_id: req.body.connectionId,
      status: req.body.status,
      contactDate: req.body.contactDate || null,
      followUpDate: req.body.followUpDate || null,
      notes: req.body.notes || null,
      outcome: req.body.outcome || null,
    });

    await createOutreachEvent(
      outreach,
      req.auth.userId,
      req.body.status,
      req.body.notes,
      req.body.contactDate ? new Date(req.body.contactDate) : new Date(),
      'created',
    );

    if (outreach.followUpDate) {
      await createNotification(models, {
        user_id: req.auth.userId,
        type: 'follow_up_due',
        title: 'Outreach follow-up scheduled',
        message: `Follow up outreach on ${outreach.followUpDate}.`,
        relatedEntityType: 'outreach',
        relatedEntityId: outreach.id,
        dueAt: new Date(outreach.followUpDate),
      });
    }

    created(res, await serializeOutreach(await ensureOutreachOwnership(req.auth.userId, outreach.id)));
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const outreachItems = await models.Outreach.findAll({
      where: { user_id: req.auth.userId },
      include: [{ model: models.Connection, as: 'connection' }],
      order: [['updated_at', 'DESC']],
    });
    ok(res, outreachItems);
  }),
);

router.get(
  '/:outreachId',
  asyncHandler(async (req, res) => {
    ok(res, await serializeOutreach(await ensureOutreachOwnership(req.auth.userId, req.params.outreachId)));
  }),
);

router.put(
  '/:outreachId',
  validate(
    Joi.object({
      status: Joi.string()
        .valid(...OUTREACH_STATUSES)
        .required(),
      contactDate: Joi.string().allow('', null),
      followUpDate: Joi.string().allow('', null),
      notes: Joi.string().allow('', null),
      outcome: Joi.string().allow('', null),
    }),
  ),
  asyncHandler(async (req, res) => {
    const outreach = await ensureOutreachOwnership(req.auth.userId, req.params.outreachId);
    await outreach.update(req.body);
    ok(res, await serializeOutreach(await ensureOutreachOwnership(req.auth.userId, outreach.id)));
  }),
);

router.delete(
  '/:outreachId',
  asyncHandler(async (req, res) => {
    const outreach = await ensureOutreachOwnership(req.auth.userId, req.params.outreachId);
    await outreach.destroy();
    ok(res, { deleted: true });
  }),
);

router.post(
  '/:outreachId/events',
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    const outreach = await ensureOutreachOwnership(req.auth.userId, req.params.outreachId);
    outreach.status = req.body.status;
    await outreach.save();
    await createOutreachEvent(
      outreach,
      req.auth.userId,
      req.body.status,
      req.body.notes,
      req.body.occurredAt,
      'status_changed',
    );

    await createNotification(models, {
      user_id: req.auth.userId,
      type: 'referral_opportunity',
      title: 'Outreach updated',
      message: `Outreach for ${outreach.connection.name} is now ${req.body.status}.`,
      relatedEntityType: 'outreach',
      relatedEntityId: outreach.id,
    });

    ok(res, await serializeOutreach(await ensureOutreachOwnership(req.auth.userId, outreach.id)));
  }),
);

export default router;
