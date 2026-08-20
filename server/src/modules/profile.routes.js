import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const profileSchema = Joi.object({
  name: Joi.string().trim().min(2).required(),
  phone: Joi.string().allow('', null),
  location: Joi.string().allow('', null),
  targetRoles: Joi.array().items(Joi.string()).default([]),
  targetCompanies: Joi.array().items(Joi.string()).default([]),
  preferredLocations: Joi.array().items(Joi.string()).default([]),
  remotePreference: Joi.string().valid('remote', 'hybrid', 'onsite', '').allow(null),
  experience: Joi.string().allow('', null),
  skills: Joi.array().items(Joi.string()).default([]),
  salaryPreference: Joi.string().allow('', null),
  bio: Joi.string().allow('', null),
});

router.use(requireAuth);

router.post(
  '/',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const [profile] = await models.Profile.findOrCreate({
      where: { user_id: req.auth.userId },
      defaults: { user_id: req.auth.userId, ...req.body },
    });

    await profile.update(req.body);
    ok(res, profile, undefined, 201);
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    ok(res, profile);
  }),
);

router.put(
  '/',
  validate(profileSchema),
  asyncHandler(async (req, res) => {
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    await profile.update(req.body);
    ok(res, profile);
  }),
);

router.delete(
  '/',
  asyncHandler(async (req, res) => {
    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    await profile.update({
      phone: null,
      location: null,
      targetRoles: [],
      targetCompanies: [],
      preferredLocations: [],
      remotePreference: null,
      experience: null,
      skills: [],
      salaryPreference: null,
      bio: null,
    });
    ok(res, profile);
  }),
);

export default router;
