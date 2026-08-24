import Joi from 'joi';
import { env } from '../src/config/env.js';
import { aiService } from '../src/services/ai/ai.service.js';

describe('AI Foundation & Provider Abstraction Test Suite', () => {
  beforeEach(() => {
    // Reset configuration parameters before each test run
    env.aiEnabled = true;
    env.aiProvider = 'mock';
    env.aiTimeoutMs = 15000;
    env.aiMaxRetries = 0;
    if (aiService.provider) {
      aiService.provider.delayMs = 0;
    }
  });

  test('Fails immediately when AI_ENABLED is false', async () => {
    env.aiEnabled = false;

    await expect(
      aiService.generateStructured('What is Node.js?', Joi.object())
    ).rejects.toThrow('AI layer is currently disabled');
  });

  test('MockProvider parses job prompt and yields valid structured format', async () => {
    const schema = Joi.object({
      title: Joi.string().required(),
      companyName: Joi.string().required(),
      location: Joi.string().required(),
      skills: Joi.array().items(Joi.string()).required(),
      salary: Joi.string().optional(),
      experience: Joi.string().optional()
    });

    const result = await aiService.generateStructured('Hiring a software engineer job description', schema);
    
    expect(result.title).toBe('Backend Developer');
    expect(result.companyName).toBe('Mock Technologies');
    expect(result.skills).toContain('Node.js');
  });

  test('Throws schema validation error if provider returns non-conforming data', async () => {
    const invalidSchema = Joi.object({
      nonExistentProperty: Joi.string().required()
    });

    await expect(
      aiService.generateStructured('Hiring job roles', invalidSchema)
    ).rejects.toThrow('Structured output schema validation failed');
  });

  test('Orchestrator timeout aborts execution successfully', async () => {
    env.aiTimeoutMs = 10; // Trigger instant timeout
    if (aiService.provider) {
      aiService.provider.delayMs = 100;
    }

    await expect(
      aiService.generateStructured('Hiring developers description', Joi.object())
    ).rejects.toThrow('AI generation pipeline failed after 1 attempts');
  });

  test('Orchestrator executes retry count parameters on failure', async () => {
    env.aiTimeoutMs = 10;
    env.aiMaxRetries = 2; // Trigger 2 retries on failures
    if (aiService.provider) {
      aiService.provider.delayMs = 100;
    }

    let warnCount = 0;
    const originalWarn = console.warn;
    console.warn = () => { warnCount++; };

    try {
      await aiService.generateStructured('Hiring engineers description', Joi.object());
    } catch (e) {
      // Ignored for counter verification
    }

    console.warn = originalWarn;
    expect(warnCount).toBe(3); // 1 initial attempt + 2 retries = 3 logs
  });
});
