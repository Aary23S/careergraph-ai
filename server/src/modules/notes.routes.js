import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const schema = Joi.object({
  entityType: Joi.string().valid('application', 'outreach', 'job', 'connection').required(),
  entityId: Joi.string().uuid().required(),
  content: Joi.string().trim().min(1).required(),
});

async function ensureEntityOwnership(userId, entityType, entityId) {
  const mapping = {
    application: models.Application,
    outreach: models.Outreach,
    job: models.Job,
    connection: models.Connection,
  };

  const entity = await mapping[entityType].findOne({
    where: { id: entityId, user_id: userId },
  });

  if (!entity) {
    throw new AppError(404, 'ENTITY_NOT_FOUND', 'The requested entity was not found.');
  }
}

router.use(requireAuth);

router.get(
  '/',
  validate(
    Joi.object({
      entityType: Joi.string().valid('application', 'outreach', 'job', 'connection').required(),
      entityId: Joi.string().uuid().required(),
    }),
    'query',
  ),
  asyncHandler(async (req, res) => {
    await ensureEntityOwnership(req.auth.userId, req.query.entityType, req.query.entityId);
    const notes = await models.Note.findAll({
      where: {
        user_id: req.auth.userId,
        entityType: req.query.entityType,
        entityId: req.query.entityId,
      },
      order: [['created_at', 'DESC']],
    });
    ok(res, notes);
  }),
);

router.post(
  '/',
  validate(schema),
  asyncHandler(async (req, res) => {
    await ensureEntityOwnership(req.auth.userId, req.body.entityType, req.body.entityId);
    const note = await models.Note.create({
      user_id: req.auth.userId,
      ...req.body,
    });
    created(res, note);
  }),
);

export default router;
