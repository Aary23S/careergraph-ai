import rateLimit from 'express-rate-limit';

// Standard rate limit for normal API usage (200 requests per minute)
export const standardRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200, 
  message: { success: false, error: 'Too many requests from this IP, please try again after a minute.' },
  standardHeaders: true, 
  legacyHeaders: false,
});

// Strict rate limit for expensive endpoints (e.g. exporting data, deep searches)
export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { success: false, error: 'Too many expensive requests from this IP, please try again after a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});
