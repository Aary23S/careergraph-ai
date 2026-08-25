import { Router } from 'express';
import Joi from 'joi';
import multer from 'multer';
import { models } from '../config/database.js';
import { fileStorage } from '../lib/storage.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

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

export default router;
