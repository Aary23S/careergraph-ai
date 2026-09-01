import { Router } from 'express';
import Joi from 'joi';
import rateLimit from 'express-rate-limit';
import { Op } from 'sequelize';
import crypto from 'crypto';
import { models } from '../config/database.js';
import {
  comparePassword,
  hashPassword,
  hashToken,
  randomToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/auth.js';
import { AppError, asyncHandler, created, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { env } from '../config/env.js';

const router = Router();

const authLimiter = rateLimit({
  windowMs: env.authRateLimitWindowMinutes * 60 * 1000,
  limit: env.authRateLimitMaxRequests,
  standardHeaders: true,
  legacyHeaders: false,
});

const registerSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(8).required(),
  name: Joi.string().trim().min(2).required(),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().required(),
});

const refreshSchema = Joi.object({
  refreshToken: Joi.string().required(),
});

const tokenSchema = Joi.object({
  token: Joi.string().required(),
});

function serializeUser(user, profile) {
  return {
    id: user.id,
    email: user.email,
    emailVerifiedAt: user.emailVerifiedAt,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
        }
      : null,
  };
}

async function issueTokens(user) {
    const refreshTokenId = crypto.randomUUID();
  const rawRefreshToken = signRefreshToken({
    sub: user.id,
    tokenId: refreshTokenId,
    type: 'refresh',
  });

  await models.RefreshToken.create({
    id: refreshTokenId,
    user_id: user.id,
    tokenHash: hashToken(rawRefreshToken),
    expiresAt: new Date(Date.now() + env.refreshTokenTtlDays * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: rawRefreshToken,
  };
}

async function revokeRefreshToken(rawRefreshToken) {
  let payload;
  try {
    payload = verifyRefreshToken(rawRefreshToken);
  } catch {
    return;
  }

  const refreshToken = await models.RefreshToken.findByPk(payload.tokenId);
  if (!refreshToken) {
    return;
  }

  refreshToken.revokedAt = new Date();
  await refreshToken.save();
}

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const existingUser = await models.User.findOne({ where: { email: req.body.email } });
    if (existingUser) {
      throw new AppError(409, 'EMAIL_IN_USE', 'An account already exists for this email.');
    }

    const verificationToken = randomToken();
    const user = await models.User.create({
      email: req.body.email,
      passwordHash: await hashPassword(req.body.password),
      emailVerificationToken: hashToken(verificationToken),
    });

    const profile = await models.Profile.create({
      user_id: user.id,
      name: req.body.name,
    });
    await models.UserPreference.create({ user_id: user.id });

    const tokens = await issueTokens(user);

    created(res, {
      user: serializeUser(user, profile),
      tokens,
      emailVerificationRequested: true,
    });
  }),
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const user = await models.User.findOne({
      where: { email: req.body.email },
      include: [{ model: models.Profile, as: 'profile' }],
    });

    if (!user || !(await comparePassword(req.body.password, user.passwordHash))) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    const tokens = await issueTokens(user);
    ok(res, {
      user: serializeUser(user, user.profile),
      tokens,
    });
  }),
);

router.post(
  '/refresh',
  authLimiter,
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    let payload;
    try {
      payload = verifyRefreshToken(req.body.refreshToken);
    } catch {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
    }

    const storedToken = await models.RefreshToken.findByPk(payload.tokenId);
    if (
      !storedToken ||
      storedToken.revokedAt ||
      storedToken.user_id !== payload.sub ||
      storedToken.tokenHash !== hashToken(req.body.refreshToken) ||
      storedToken.expiresAt < new Date()
    ) {
      throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid.');
    }

    storedToken.revokedAt = new Date();
    await storedToken.save();

    const user = await models.User.findByPk(payload.sub);
    const tokens = await issueTokens(user);
    ok(res, tokens);
  }),
);

router.post(
  '/logout',
  authLimiter,
  validate(refreshSchema),
  asyncHandler(async (req, res) => {
    await revokeRefreshToken(req.body.refreshToken);
    ok(res, { loggedOut: true });
  }),
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await models.User.findByPk(req.auth.userId, {
      include: [
        { model: models.Profile, as: 'profile' },
        { model: models.UserPreference, as: 'preferences' },
      ],
    });

    ok(res, {
      user: serializeUser(user, user.profile),
      preferences: user.preferences,
    });
  }),
);

router.post(
  '/email-verification/request',
  requireAuth,
  asyncHandler(async (req, res) => {
    req.auth.user.emailVerificationToken = hashToken(randomToken());
    await req.auth.user.save();
    ok(res, { requested: true });
  }),
);

router.post(
  '/email-verification/verify',
  validate(tokenSchema),
  asyncHandler(async (req, res) => {
    const user = await models.User.findOne({
      where: { emailVerificationToken: hashToken(req.body.token) },
    });

    if (!user) {
      throw new AppError(400, 'INVALID_VERIFICATION_TOKEN', 'Verification token is invalid.');
    }

    user.emailVerificationToken = null;
    user.emailVerifiedAt = new Date();
    await user.save();

    ok(res, { verified: true });
  }),
);

router.post(
  '/password-reset/request',
  authLimiter,
  validate(Joi.object({ email: Joi.string().email().required() })),
  asyncHandler(async (req, res) => {
    const user = await models.User.findOne({ where: { email: req.body.email } });
    if (user) {
      user.passwordResetToken = hashToken(randomToken());
      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
    }

    ok(res, { requested: true });
  }),
);

router.post(
  '/password-reset/confirm',
  authLimiter,
  validate(
    Joi.object({
      token: Joi.string().required(),
      password: Joi.string().min(8).required(),
    }),
  ),
  asyncHandler(async (req, res) => {
    const user = await models.User.findOne({
      where: {
        passwordResetToken: hashToken(req.body.token),
        passwordResetExpiresAt: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      throw new AppError(400, 'INVALID_RESET_TOKEN', 'Password reset token is invalid.');
    }

    user.passwordHash = await hashPassword(req.body.password);
    user.passwordResetToken = null;
    user.passwordResetExpiresAt = null;
    await user.save();

    ok(res, { reset: true });
  }),
);

export default router;
