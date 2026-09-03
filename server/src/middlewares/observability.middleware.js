export function observabilityMiddleware(req, res, next) {
  const start = Date.now();
  
  // Track page depth for telemetry
  if (req.query && req.query.page) {
    const page = Number(req.query.page);
    if (!isNaN(page) && page > 10) {
      console.log(`[TELEMETRY] Deep pagination accessed: page ${page} on ${req.method} ${req.originalUrl}`);
    }
  }

  // Hook into response finish event to log execution time
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (duration > 2000) {
      console.warn(`[WARN] SLOW QUERY ALERT: ${req.method} ${req.originalUrl} took ${duration}ms`);
    }
  });

  next();
}
