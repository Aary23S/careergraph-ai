import { models } from '../config/database.js';
import { verifyAccessToken } from '../lib/auth.js';
import { AppError } from '../lib/http.js';
import { env } from '../config/env.js';

export async function requireAuth(req, res, next) {
  try {
    let token = '';
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      token = header.slice('Bearer '.length);
    } else if (req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      throw new AppError(401, 'AUTH_REQUIRED', 'Authentication is required.');
    }

    const payload = verifyAccessToken(token);
    const user = await models.User.findByPk(payload.sub);

    if (!user) {
      throw new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid.');
    }

    req.auth = {
      userId: user.id,
      user,
    };
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError(401, 'INVALID_TOKEN', 'Authentication token is invalid.'),
    );
  }
}

// Shared operator gate for admin-only endpoints (queue console, model
// registry lifecycle actions). Mirrors the check admin-queue.routes.js
// already applies locally -- kept here too so new admin routes don't need
// to duplicate the operator-email-list logic.
export function requireOperator(req, res, next) {
  const userEmail = req.auth?.user?.email;
  const operatorEmails = env.aiOperatorEmails ? env.aiOperatorEmails.split(',') : [];

  if (!userEmail || !operatorEmails.includes(userEmail)) {
    return next(new AppError(403, 'OPERATOR_REQUIRED', 'Operator privilege required.'));
  }
  next();
}
