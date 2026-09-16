import { env } from '../config/env.js';

export function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'careergraph-api',
    environment: process.env.NODE_ENV ?? 'development',
    demoMode: env.demoMode ?? false,
    database: {
      configured: Boolean(env.databaseDialect || env.databaseUrl || env.databaseName),
      status: 'healthy',
      dialect: env.databaseDialect
    },
    components: {
      database: {
        status: 'healthy',
        dialect: env.databaseDialect
      },
      redis: {
        status: env.redisEnabled ? 'healthy' : 'in-memory-fallback'
      },
      aiWorker: {
        status: 'running',
        driver: env.aiQueueDriver
      },
      aiProvider: {
        status: env.aiEnabled ? 'ready' : 'disabled',
        provider: env.aiProvider,
        model: env.aiProvider === 'gemini' ? env.geminiModel : env.ollamaModel
      }
    },
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    version: process.env.npm_package_version ?? '0.1.0',
    timestamp: new Date().toISOString()
  });
}
