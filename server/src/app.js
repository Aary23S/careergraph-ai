import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  const corsOrigins = env.corsOrigin
    ? env.corsOrigin.split(',').map((o) => o.trim())
    : [];

  const corsHandler = (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);

    // If wildcard is set
    if (env.corsOrigin === '*') return callback(null, true);

    // Check exact match in configured list
    if (corsOrigins.includes(origin)) return callback(null, true);

    // Check localhost in development mode
    if (env.nodeEnv === 'development' && /^http:\/\/localhost:\d+$/.test(origin)) {
      return callback(null, true);
    }

    // Automatically allow Vercel deployment preview origins (*.vercel.app)
    if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
      return callback(null, true);
    }

    callback(null, false);
  };

  app.use(cors({ origin: corsHandler, credentials: true }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
