export function getHealth(req, res) {
  res.status(200).json({
    status: 'ok',
    service: 'careergraph-api',
    environment: process.env.NODE_ENV ?? 'development',
    uptimeSeconds: Number(process.uptime().toFixed(2)),
    version: process.env.npm_package_version ?? '0.1.0',
    database: {
      configured: Boolean(process.env.DATABASE_URL || process.env.DATABASE_DIALECT === 'postgres'),
    },
    timestamp: new Date().toISOString(),
  });
}
