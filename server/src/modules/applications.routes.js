import { Router } from 'express';
import Joi from 'joi';
import { models } from '../config/database.js';
import { APPLICATION_STATUSES } from '../database/models.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { createNotification } from '../lib/notifications.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createSchema = Joi.object({
  jobId: Joi.string().uuid().required(),
  status: Joi.string()
    .valid(...APPLICATION_STATUSES)
    .default('saved'),
  occurredAt: Joi.date().optional(),
  resumeId: Joi.string().uuid().allow(null),
  coverLetter: Joi.string().allow('', null),
  referralConnectionId: Joi.string().uuid().allow(null),
  notes: Joi.string().allow('', null),
  nextFollowUpDate: Joi.string().allow('', null),
});

const updateSchema = Joi.object({
  status: Joi.string().valid(...APPLICATION_STATUSES),
  resumeId: Joi.string().uuid().allow(null),
  coverLetter: Joi.string().allow('', null),
  referralConnectionId: Joi.string().uuid().allow(null),
  notes: Joi.string().allow('', null),
  nextFollowUpDate: Joi.string().allow('', null),
});

const statusSchema = Joi.object({
  status: Joi.string()
    .valid(...APPLICATION_STATUSES)
    .required(),
  notes: Joi.string().allow('', null),
  occurredAt: Joi.date().optional(),
});

const eventSchema = Joi.object({
  eventType: Joi.string().required(),
  status: Joi.string().required(),
  notes: Joi.string().allow('', null),
  occurredAt: Joi.date().optional(),
});

async function ensureJobOwnership(userId, jobId) {
  const job = await models.Job.findOne({
    where: { id: jobId, user_id: userId },
    include: [{ model: models.Company, as: 'company' }],
  });

  if (!job) {
    throw new AppError(404, 'JOB_NOT_FOUND', 'Job not found.');
  }

  return job;
}

async function ensureApplicationOwnership(userId, applicationId) {
  const application = await models.Application.findOne({
    where: { id: applicationId, user_id: userId },
    include: [
      { model: models.Job, as: 'job', include: [{ model: models.Company, as: 'company' }] },
      { model: models.ApplicationEvent, as: 'events' },
    ],
    order: [[{ model: models.ApplicationEvent, as: 'events' }, 'occurred_at', 'DESC']],
  });

  if (!application) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Application not found.');
  }

  return application;
}

async function createApplicationEvent(application, userId, status, eventType, notes, occurredAt) {
  return models.ApplicationEvent.create({
    application_id: application.id,
    user_id: userId,
    status,
    eventType,
    notes,
    occurredAt: occurredAt || new Date(),
  });
}

async function serializeApplication(application) {
  const notes = await models.Note.findAll({
    where: {
      user_id: application.user_id,
      entityType: 'application',
      entityId: application.id,
    },
    order: [['created_at', 'DESC']],
  });

  return {
    ...application.toJSON(),
    job: {
      ...application.job.toJSON(),
      companyName: application.job.company?.name ?? null,
    },
    notes,
  };
}

router.use(requireAuth);

router.post(
  '/',
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const job = await ensureJobOwnership(req.auth.userId, req.body.jobId);
    const duplicate = await models.Application.findOne({
      where: { user_id: req.auth.userId, job_id: job.id },
    });

    if (duplicate) {
      throw new AppError(409, 'APPLICATION_EXISTS', 'An application already exists for this job.');
    }

    const occurredAt = req.body.occurredAt || new Date();
    const application = await models.Application.create({
      user_id: req.auth.userId,
      job_id: job.id,
      status: req.body.status,
      appliedAt: req.body.status === 'applied' ? occurredAt : null,
      lastStatusAt: occurredAt,
      resumeId: req.body.resumeId || null,
      coverLetter: req.body.coverLetter || null,
      referralConnectionId: req.body.referralConnectionId || null,
      notes: req.body.notes || null,
      nextFollowUpDate: req.body.nextFollowUpDate || null,
    });

    await createApplicationEvent(
      application,
      req.auth.userId,
      req.body.status,
      'created',
      req.body.notes || null,
      occurredAt,
    );

    await createNotification(models, {
      user_id: req.auth.userId,
      type: 'application_update',
      title: 'Application created',
      message: `Application for ${job.title} at ${job.company?.name ?? 'Unknown company'} is ${req.body.status}.`,
      relatedEntityType: 'application',
      relatedEntityId: application.id,
    });

    created(res, await serializeApplication(await ensureApplicationOwnership(req.auth.userId, application.id)));
  }),
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const applications = await models.Application.findAll({
      where: { user_id: req.auth.userId },
      include: [
        { model: models.Job, as: 'job', include: [{ model: models.Company, as: 'company' }] },
        { model: models.ApplicationEvent, as: 'events' },
      ],
      order: [
        ['updated_at', 'DESC'],
        [{ model: models.ApplicationEvent, as: 'events' }, 'occurred_at', 'DESC']
      ],
    });
    ok(
      res,
      applications.map((application) => {
        const appJson = application.toJSON();
        return {
          ...appJson,
          job: {
            ...appJson.job,
            companyName: application.job.company?.name ?? null,
          },
        };
      }),
    );
  }),
);

router.get(
  '/:applicationId',
  asyncHandler(async (req, res) => {
    ok(res, await serializeApplication(await ensureApplicationOwnership(req.auth.userId, req.params.applicationId)));
  }),
);

router.put(
  '/:applicationId',
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    const application = await ensureApplicationOwnership(req.auth.userId, req.params.applicationId);
    
    const prevStatus = application.status;
    const updates = {};
    const allowed = ['status', 'resumeId', 'coverLetter', 'referralConnectionId', 'notes', 'nextFollowUpDate'];
    allowed.forEach(k => {
      if (req.body[k] !== undefined) {
        updates[k] = req.body[k];
      }
    });

    if (req.body.status && req.body.status !== prevStatus) {
      updates.lastStatusAt = new Date();
      if (req.body.status === 'applied' && !application.appliedAt) {
        updates.appliedAt = new Date();
      }
    }

    await application.update(updates);

    if (req.body.status && req.body.status !== prevStatus) {
      await createApplicationEvent(
        application,
        req.auth.userId,
        req.body.status,
        'status_changed',
        req.body.notes || 'Status updated via edit',
        new Date(),
      );

      await createNotification(models, {
        user_id: req.auth.userId,
        type: 'application_update',
        title: 'Application status updated',
        message: `Application for ${application.job.title} is now ${req.body.status}.`,
        relatedEntityType: 'application',
        relatedEntityId: application.id,
      });
    }

    ok(res, await serializeApplication(await ensureApplicationOwnership(req.auth.userId, application.id)));
  })
);

router.delete(
  '/:applicationId',
  asyncHandler(async (req, res) => {
    const application = await ensureApplicationOwnership(req.auth.userId, req.params.applicationId);
    await application.destroy();
    ok(res, { deleted: true });
  }),
);

router.patch(
  '/:applicationId/status',
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const application = await ensureApplicationOwnership(req.auth.userId, req.params.applicationId);
    const prevStatus = application.status;
    application.status = req.body.status;
    application.lastStatusAt = req.body.occurredAt || new Date();
    if (req.body.status === 'applied' && !application.appliedAt) {
      application.appliedAt = req.body.occurredAt || new Date();
    }
    await application.save();

    await createApplicationEvent(
      application,
      req.auth.userId,
      req.body.status,
      'status_changed',
      req.body.notes,
      req.body.occurredAt,
    );

    await createNotification(models, {
      user_id: req.auth.userId,
      type: 'application_update',
      title: 'Application status updated',
      message: `Application for ${application.job.title} is now ${req.body.status}.`,
      relatedEntityType: 'application',
      relatedEntityId: application.id,
    });

    ok(res, await serializeApplication(await ensureApplicationOwnership(req.auth.userId, application.id)));
  }),
);

router.post(
  '/:applicationId/events',
  validate(eventSchema),
  asyncHandler(async (req, res) => {
    const application = await ensureApplicationOwnership(req.auth.userId, req.params.applicationId);
    const event = await createApplicationEvent(
      application,
      req.auth.userId,
      req.body.status,
      req.body.eventType,
      req.body.notes,
      req.body.occurredAt
    );
    ok(res, event);
  })
);

export default router;
