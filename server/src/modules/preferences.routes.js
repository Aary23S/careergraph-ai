import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const schema = Joi.object({
  preferredJobLocations: Joi.array().items(Joi.string()).default([]),
  preferredJobRoles: Joi.array().items(Joi.string()).default([]),
  remotePreference: Joi.string().valid('remote', 'hybrid', 'onsite', '').allow(null),
  notificationsEnabled: Joi.boolean().required(),
  notifyHighlyRelevant: Joi.boolean().optional(),
  notifyStrongReferral: Joi.boolean().optional(),
  notifyTargetCompany: Joi.boolean().optional(),
  dailyDigestEnabled: Joi.boolean().optional(),
  notifyLowRelevance: Joi.boolean().optional(),
  minimumMatchScore: Joi.number().integer().min(0).max(100).optional(),
});

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const preferences = await models.UserPreference.findOne({
      where: { user_id: req.auth.userId },
    });
    ok(res, preferences);
  }),
);

router.put(
  '/',
  validate(schema),
  asyncHandler(async (req, res) => {
    const preferences = await models.UserPreference.findOne({
      where: { user_id: req.auth.userId },
    });
    await preferences.update(req.body);
    ok(res, preferences);
  }),
);

export default router;
