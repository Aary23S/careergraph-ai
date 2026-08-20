import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { env } from './config/env.js';
import { requestLogger } from './middleware/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  const corsOrigin = env.nodeEnv === 'development'
    ? (origin, callback) => {
        if (!origin || /^http:\/\/localhost:\d+$/.test(origin)) {
          callback(null, true);
        } else {
          callback(null, env.corsOrigin);
        }
      }
    : env.corsOrigin;

  app.use(cors({ origin: corsOrigin }));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(requestLogger);

  app.use('/api', routes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
