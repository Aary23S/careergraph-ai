import Joi from 'joi';
import { models } from '../config/database.js';
import { env } from '../config/env.js';
import { buildOutreachDraftPrompt } from '../prompts/outreach-draft.v1.js';
import { aiService } from './ai/ai.service.js';
import { buildOutreachAIContext } from './outreach-ai-context.service.js';
import { checkOutreachDuplicates } from './outreach-ai-guard.service.js';

const draftSchema = Joi.object({
  message: Joi.string().required(),
  tone: Joi.string().required(),
  personalizationPoints: Joi.array().items(Joi.string()).default([])
});

/**
 * Generates and saves an AI outreach draft.
 */
export async function generateOutreachDraft({
  userId,
  jobId,
  connectionId,
  intent,
  tone,
  length,
  forceGenerate = false
}) {
  // 1. Run Guard check
  const guard = await checkOutreachDuplicates({ userId, jobId, connectionId });
  if (guard.warnings.length > 0 && !forceGenerate) {
    return {
      success: true,
      allowed: false,
      warnings: guard.warnings
    };
  }

  // 2. Gather Context
  const context = await buildOutreachAIContext({ userId, jobId, connectionId });

  // 3. Build Prompt
  const prompt = buildOutreachDraftPrompt({
    intent,
    tone,
    length,
    job: context.job,
    user: context.user,
    connection: context.connection,
    relationship: context.relationship
  });

  // 4. Generate structured response
  let parsed;
  try {
    parsed = await aiService.generateStructured(prompt, draftSchema);
  } catch (err) {
    console.error('[OutreachAiService] Generation failed:', err);
    throw new Error('AI_PROVIDER_UNAVAILABLE');
  }

  // 5. Save generated draft to DB
  const draftRecord = await models.OutreachAiDraft.create({
    userId,
    connectionId: connectionId || null,
    jobId: jobId || null,
    intent,
    tone,
    length,
    provider: env.aiProvider || 'mock',
    model: env.ollamaModel || 'mock',
    promptVersion: 'outreach-draft.v1',
    draft: parsed.message,
    personalizationPoints: parsed.personalizationPoints || [],
    status: 'generated'
  });

  return {
    success: true,
    allowed: true,
    draft: {
      id: draftRecord.id,
      message: draftRecord.draft,
      tone: draftRecord.tone,
      personalizationPoints: draftRecord.personalizationPoints,
      status: draftRecord.status
    },
    warnings: guard.warnings
  };
}
