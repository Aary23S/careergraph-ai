import { Router } from 'express';
import Joi from 'joi';
import { requireAuth, requireOperator } from '../middleware/auth.js';
import { asyncHandler, ok, created } from '../lib/http.js';
import { validate } from '../middleware/validate.js';
import * as registry from '../services/model-registry.service.js';

const router = Router();

router.use(requireAuth);
router.use(requireOperator);

const registerSchema = Joi.object({
  name: Joi.string().required(),
  version: Joi.string().required(),
  modelType: Joi.string().valid(...registry.MODEL_TYPES).required(),
  provider: Joi.string().required(),
  framework: Joi.string().allow('', null).optional(),
  artifactUri: Joi.string().allow('', null).optional(),
  metadata: Joi.object().unknown(true).allow(null).optional(),
  status: Joi.string().valid(...registry.MODEL_STATUSES).optional(),
});

const evaluateSchema = Joi.object({
  evaluationType: Joi.string().required(),
  datasetVersion: Joi.string().allow('', null).optional(),
  metrics: Joi.object().unknown(true).allow(null).optional(),
  overallScore: Joi.number().allow(null).optional(),
  status: Joi.string().valid(...registry.EVALUATION_STATUSES, 'completed').optional(),
  evaluatedAt: Joi.date().iso().optional(),
});

const promoteSchema = Joi.object({
  environment: Joi.string().valid(...registry.ENVIRONMENTS).required(),
  confirmReindex: Joi.boolean().optional(),
});

const rollbackSchema = Joi.object({
  modelType: Joi.string().valid(...registry.MODEL_TYPES).required(),
  environment: Joi.string().valid(...registry.ENVIRONMENTS).required(),
});

const transitionSchema = Joi.object({
  targetStatus: Joi.string().valid(...registry.MODEL_STATUSES).required(),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const rows = await registry.listModelsWithSummary({
      modelType: req.query.type,
      status: req.query.status,
      provider: req.query.provider,
    });
    ok(res, rows);
  }),
);

router.get(
  '/compare',
  asyncHandler(async (req, res) => {
    const modelIds = (req.query.ids || '').split(',').map((id) => id.trim()).filter(Boolean);
    const result = await registry.compareEvaluations({ modelIds, datasetVersion: req.query.datasetVersion });
    ok(res, result);
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const details = await registry.getModelWithDetails(req.params.id);
    ok(res, details);
  }),
);

router.post(
  '/',
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const model = await registry.registerModel(req.body);
    created(res, model);
  }),
);

router.post(
  '/:id/evaluate',
  validate(evaluateSchema),
  asyncHandler(async (req, res) => {
    const evaluation = await registry.recordEvaluation(req.params.id, req.body);
    created(res, evaluation);
  }),
);

router.post(
  '/:id/promote',
  validate(promoteSchema),
  asyncHandler(async (req, res) => {
    const assignment = await registry.promoteModel(req.params.id, {
      environment: req.body.environment,
      confirmReindex: req.body.confirmReindex,
      operatorEmail: req.auth.user.email,
    });
    created(res, assignment);
  }),
);

router.post(
  '/rollback',
  validate(rollbackSchema),
  asyncHandler(async (req, res) => {
    const assignment = await registry.rollbackAssignment({
      modelType: req.body.modelType,
      environment: req.body.environment,
      operatorEmail: req.auth.user.email,
    });
    created(res, assignment);
  }),
);

router.post(
  '/:id/transition',
  validate(transitionSchema),
  asyncHandler(async (req, res) => {
    const model = await registry.transitionStatus(req.params.id, req.body.targetStatus);
    ok(res, model);
  }),
);

export default router;
