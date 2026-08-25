import { Router } from 'express';
import { aiService } from '../services/ai/ai.service.js';
import { env } from '../config/env.js';

const router = Router();

router.get('/health', async (req, res) => {
  try {
    const available = await aiService.healthCheck();
    return res.json({
      success: true,
      data: {
        enabled: env.aiEnabled,
        provider: env.aiProvider,
        model: env.ollamaModel,
        available
      }
    });
  } catch (err) {
    // Prevent any crashes under any network failures
    return res.json({
      success: false,
      data: {
        enabled: env.aiEnabled,
        provider: env.aiProvider,
        model: env.ollamaModel,
        available: false
      },
      error: err.message
    });
  }
});

export default router;
