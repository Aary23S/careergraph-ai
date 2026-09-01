import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { CAREER_LEVELS } from '../services/resume-ai-enrichment.service.js';

const router = Router();

const educationItemSchema = Joi.object({
  institution: Joi.string().allow('', null),
  degree: Joi.string().allow('', null),
  field: Joi.string().allow('', null),
  startYear: Joi.string().allow('', null),
  endYear: Joi.string().allow('', null),
});

const certificationItemSchema = Joi.alternatives().try(
  Joi.object({
    name: Joi.string().allow('', null),
    issuer: Joi.string().allow('', null),
    issueDate: Joi.string().allow('', null),
    expiryDate: Joi.string().allow('', null),
    credentialId: Joi.string().allow('', null),
  }),
  Joi.string(),
);

const linksSchema = Joi.object({
  linkedin: Joi.string().allow('', null),
  github: Joi.string().allow('', null),
  portfolio: Joi.string().allow('', null),
});

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
  professionalTitle: Joi.string().allow('', null),
  careerLevel: Joi.string().valid('', ...CAREER_LEVELS).allow(null),
  education: Joi.array().items(educationItemSchema).default([]),
  certifications: Joi.array().items(certificationItemSchema).default([]),
  links: linksSchema.default({}),
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
    let profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });

    // Auto-sync profile from active resume enrichment if active resume exists and profile is empty/unsynced
    if (profile) {
      const activeResume = await models.Resume.findOne({
        where: { user_id: req.auth.userId, isActive: true },
        include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
      });

      if (activeResume?.aiEnrichment && activeResume.aiEnrichment.status === 'completed') {
        if (profile.syncedResumeId !== activeResume.id || !profile.skills || profile.skills.length === 0) {
          const { syncProfileFromResumeEnrichment } = await import('../services/profile-resume-sync.service.js');
          profile = (await syncProfileFromResumeEnrichment(req.auth.userId, activeResume.aiEnrichment)) || profile;
        }
      }
    }

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
      professionalTitle: null,
      careerLevel: null,
      education: [],
      certifications: [],
      links: {},
    });
    ok(res, profile);
  }),
);

export default router;
