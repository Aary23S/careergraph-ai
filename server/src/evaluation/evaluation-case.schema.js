import Joi from 'joi';
import fs from 'fs';
import path from 'path';

export const EVALUATION_CATEGORIES = [
  'job_matching',
  'referral',
  'copilot',
  'action_safety',
  'groundedness',
  'productivity',
  'end_to_end'
];

export const EVALUATION_SEVERITIES = ['low', 'medium', 'high', 'critical'];

export const evaluationCaseSchema = Joi.object({
  id: Joi.string().required(),
  category: Joi.string().valid(...EVALUATION_CATEGORIES).required(),
  severity: Joi.string().valid(...EVALUATION_SEVERITIES).default('medium'),
  tags: Joi.array().items(Joi.string()).default([]),
  input: Joi.object().optional(),
  context: Joi.object().optional(),
  profile: Joi.object().optional(),
  expected: Joi.object().optional(),
  groundTruth: Joi.object().optional(),
  allowedVariants: Joi.array().items(Joi.string()).optional(),
  scenario: Joi.string().optional(),
  steps: Joi.array().items(Joi.object()).optional()
}).unknown(true);

/**
 * Validates an evaluation case against the standard schema.
 */
export function validateEvaluationCase(evaluationCase) {
  const { error, value } = evaluationCaseSchema.validate(evaluationCase);
  if (error) {
    throw new Error(`Invalid Evaluation Case [${evaluationCase?.id || 'unknown'}]: ${error.message}`);
  }
  return value;
}

/**
 * Loads golden evaluation fixtures from standard fixture directories.
 */
export function loadEvaluationFixtures(fixturesDir) {
  const root = fixturesDir || path.join(process.cwd(), 'tests', 'evaluation', 'fixtures', 'h8');
  const loadedCases = [];

  const subdirs = [
    { dir: 'jobs', file: 'h8-jobs.json' },
    { dir: 'resumes', file: 'h8-resumes.json' },
    { dir: 'connections', file: 'h8-connections.json' },
    { dir: 'copilot', file: 'h8-copilot-prompts.json' },
    { dir: 'actions', file: 'h8-actions-security.json' },
    { dir: 'workflows', file: 'h8-e2e-workflows.json' }
  ];

  for (const { dir, file } of subdirs) {
    const filePath = path.join(root, dir, file);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cases = JSON.parse(content);
        if (Array.isArray(cases)) {
          for (const c of cases) {
            loadedCases.push(validateEvaluationCase(c));
          }
        }
      } catch (err) {
        console.warn(`[EvaluationCaseLoader] Warning reading fixture ${filePath}:`, err.message);
      }
    }
  }

  return loadedCases;
}
