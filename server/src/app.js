import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { standardRateLimit } from './middleware/rate-limit.js';
import { observabilityMiddleware } from './middleware/observability.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  const corsOrigins = env.corsOrigin
    ? env.corsOrigin.split(',').map((o) => o.trim())
    : [];

  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      const isVercel = /^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin);
      const isLocalhost = env.nodeEnv === 'development' && /^http:\/\/localhost:\d+$/.test(origin);
      const isAllowedConfig = env.corsOrigin === '*' || corsOrigins.includes(origin);

      if (isAllowedConfig || isVercel || isLocalhost) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
      }
    }

    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);
  app.use(observabilityMiddleware);
  app.use(standardRateLimit);

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
