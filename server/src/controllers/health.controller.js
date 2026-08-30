import { env } from '../config/env.js';

export function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'careergraph-api',
    environment: process.env.NODE_ENV ?? 'development',
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    version: process.env.npm_package_version ?? '0.1.0',
    database: {
      configured: Boolean(env.databaseDialect === 'postgres' ? env.databaseUrl : env.databaseStorage),
    },
    timestamp: new Date().toISOString(),
  });
}
