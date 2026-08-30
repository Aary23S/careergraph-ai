import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { models } from '../config/database.js';
import { fileStorage } from '../lib/storage.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { estimateYearsOfExperience } from '../lib/experience.util.js';
import { mergeStringListCaseInsensitive, mergeStructuredListByKey, educationSignature, certificationSignature } from '../lib/profile-merge.util.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const PROFILE_APPLY_FIELDS = [
  'skills',
  'targetRoles',
  'experience',
  'bio',
  'education',
  'certifications',
  'professionalTitle',
  'careerLevel',
  'contactInfo',
];

const applyToProfileSchema = Joi.object({
  fields: Joi.array().items(Joi.string().valid(...PROFILE_APPLY_FIELDS)).min(1).required(),
});

async function ensureResumeOwnership(userId, resumeId) {
  const resume = await models.Resume.findOne({
    where: { id: resumeId, user_id: userId },
    include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }]
  });

  if (!resume) {
    throw new AppError(404, 'RESUME_NOT_FOUND', 'Resume not found.');
  }

  return resume;
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await models.Resume.findAll({
      where: { user_id: req.auth.userId },
      include: [{ model: models.ResumeAiEnrichment, as: 'aiEnrichment' }],
      order: [['created_at', 'DESC']],
    });
    ok(res, resumes);
  }),
);

router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Resume file is required.');
    }

    const storedFile = await fileStorage.save(req.file);
    const currentCount = await models.Resume.count({ where: { user_id: req.auth.userId } });

    if (currentCount === 0) {
      await models.Resume.update(
        { isActive: false },
        { where: { user_id: req.auth.userId } },
      );
    }

    const resume = await models.Resume.create({
      user_id: req.auth.userId,
      fileName: req.file.originalname,
      storageKey: storedFile.key,
      contentType: req.file.mimetype || 'application/octet-stream',
      sizeBytes: req.file.size,
      isActive: currentCount === 0,
      version: currentCount + 1,
    });

    const { enqueueResumeEnrichment } = await import('../services/resume-ai-enrichment.service.js');
    enqueueResumeEnrichment(resume.id);

    created(res, resume);
  }),
);

router.get(
  '/:resumeId',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    ok(res, resume);
  }),
);

router.get(
  '/:resumeId/download',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    res.setHeader('Content-Type', resume.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${resume.fileName}"`);
    fileStorage.createReadStream(resume.storageKey).pipe(res);
  }),
);

router.patch(
  '/:resumeId/active',
  validate(Joi.object({ isActive: Joi.boolean().valid(true).required() })),
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    await models.Resume.update({ isActive: false }, { where: { user_id: req.auth.userId } });
    resume.isActive = true;
    await resume.save();

    if (resume.aiEnrichment?.status === 'completed') {
      const { syncProfileFromResumeEnrichment } = await import('../services/profile-resume-sync.service.js');
      await syncProfileFromResumeEnrichment(req.auth.userId, resume.aiEnrichment).catch((err) => {
        console.error(`[ResumesRoutes] Profile auto-sync failed on resume activation ${resume.id}:`, err);
      });
    }

    const { refreshMatchAnalysisForTrackedJobs } = await import('../services/job-match-analysis.service.js');
    refreshMatchAnalysisForTrackedJobs(req.auth.userId);

    ok(res, resume);
  }),
);

router.put(
  '/:resumeId',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) {
      throw new AppError(400, 'FILE_REQUIRED', 'Resume file is required.');
    }

    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    const replacement = await fileStorage.replace(resume.storageKey, req.file);
    await resume.update({
      fileName: req.file.originalname,
      storageKey: replacement.key,
      contentType: req.file.mimetype || 'application/octet-stream',
      sizeBytes: req.file.size,
      version: resume.version + 1,
    });

    const { enqueueResumeEnrichment } = await import('../services/resume-ai-enrichment.service.js');
    enqueueResumeEnrichment(resume.id);

    ok(res, resume);
  }),
);

router.delete(
  '/:resumeId',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    await fileStorage.delete(resume.storageKey);
    await resume.destroy();
    ok(res, { deleted: true });
  }),
);

router.get(
  '/:resumeId/ai',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    ok(res, resume.aiEnrichment || {});
  }),
);

router.post(
  '/:resumeId/ai-enrich',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    const { executeResumeEnrichment } = await import('../services/resume-ai-enrichment.service.js');
    await executeResumeEnrichment(resume.id);
    const refreshed = await ensureResumeOwnership(req.auth.userId, resume.id);
    ok(res, refreshed);
  }),
);

router.post(
  '/:resumeId/ai-enrich/retry',
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    if (resume.aiEnrichment && resume.aiEnrichment.status === 'failed') {
      const { executeResumeEnrichment } = await import('../services/resume-ai-enrichment.service.js');
      await executeResumeEnrichment(resume.id);
    }
    const refreshed = await ensureResumeOwnership(req.auth.userId, resume.id);
    ok(res, refreshed);
  }),
);

router.put(
  '/:resumeId/ai-corrections',
  validate(
    Joi.object({
      professionalTitle: Joi.string().allow('', null).optional(),
      careerLevel: Joi.string().allow('', null).optional(),
      skills: Joi.array().items(Joi.string()).optional(),
      summary: Joi.string().allow('', null).optional()
    })
  ),
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    const { saveResumeCorrections } = await import('../services/resume-ai-enrichment.service.js');
    await saveResumeCorrections(resume.id, req.body);
    const refreshed = await ensureResumeOwnership(req.auth.userId, resume.id);
    ok(res, refreshed);
  }),
);

router.post(
  '/:resumeId/apply-to-profile',
  validate(applyToProfileSchema),
  asyncHandler(async (req, res) => {
    const resume = await ensureResumeOwnership(req.auth.userId, req.params.resumeId);
    const enrichment = resume.aiEnrichment;
    if (!enrichment || enrichment.status !== 'completed') {
      throw new AppError(400, 'ENRICHMENT_NOT_READY', 'Resume AI extraction has not completed yet.');
    }

    const profile = await models.Profile.findOne({ where: { user_id: req.auth.userId } });
    if (!profile) {
      throw new AppError(400, 'PROFILE_REQUIRED', 'Save your profile with a name before applying resume data.');
    }

    const updates = {};

    req.body.fields.forEach((field) => {
      if (field === 'skills') {
        const resumeSkills = enrichment.userCorrectedSkills || enrichment.canonicalSkills || enrichment.skills || [];
        updates.skills = mergeStringListCaseInsensitive(profile.skills, resumeSkills);
      } else if (field === 'targetRoles') {
        const title = enrichment.userCorrectedProfessionalTitle || enrichment.professionalTitle;
        if (title) {
          updates.targetRoles = mergeStringListCaseInsensitive(profile.targetRoles, [title]);
        }
      } else if (field === 'professionalTitle') {
        const title = enrichment.userCorrectedProfessionalTitle || enrichment.professionalTitle;
        if (title) updates.professionalTitle = title;
      } else if (field === 'careerLevel') {
        const careerLevel = enrichment.userCorrectedCareerLevel || enrichment.careerLevel;
        if (careerLevel && careerLevel !== 'unknown') updates.careerLevel = careerLevel;
      } else if (field === 'contactInfo') {
        const contactInfo = enrichment.contactInfo || {};
        const mergedLinks = { ...(profile.links || {}) };
        ['linkedin', 'github', 'portfolio'].forEach((key) => {
          if (!mergedLinks[key] && contactInfo[key]) mergedLinks[key] = contactInfo[key];
        });
        updates.links = mergedLinks;
        if (!profile.phone && contactInfo.phone) updates.phone = contactInfo.phone;
      } else if (field === 'experience') {
        const years = enrichment.totalExperienceYears ?? estimateYearsOfExperience(enrichment.experience || []);
        if (years !== null && years !== undefined) updates.experience = String(years);
      } else if (field === 'bio') {
        const summary = enrichment.userCorrectedSummary || enrichment.summary;
        if (summary) updates.bio = summary;
      } else if (field === 'education') {
        updates.education = mergeStructuredListByKey(profile.education, enrichment.education || [], educationSignature);
      } else if (field === 'certifications') {
        updates.certifications = mergeStructuredListByKey(
          profile.certifications,
          enrichment.certifications || [],
          certificationSignature,
        );
      }
    });

    await profile.update(updates);
    ok(res, profile);
  }),
);

export default router;
