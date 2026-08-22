import { models } from '../config/database.js';
import { verifyAccessToken } from '../lib/auth.js';
import { AppError } from '../lib/http.js';

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
