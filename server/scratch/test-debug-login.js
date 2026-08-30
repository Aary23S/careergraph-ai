import { models, sequelize } from '../src/config/database.js';
import { hashPassword, signRefreshToken, signAccessToken, hashToken } from '../src/lib/auth.js';
import crypto from 'crypto';

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
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  return {
    accessToken: signAccessToken(user),
    refreshToken: rawRefreshToken,
  };
}

async function test() {
  const email = `test-${Date.now()}@example.com`;
  let user = null;
  try {
    console.log('1. Hashing password...');
    const hashed = await hashPassword('Password123!');

    console.log('2. Creating User...');
    user = await models.User.create({
      email,
      passwordHash: hashed,
      emailVerificationToken: 'dummy',
    });
    console.log('User created:', user.id);

    console.log('3. Creating Profile...');
    const profile = await models.Profile.create({
      user_id: user.id,
      name: 'Test Login',
    });
    console.log('Profile created:', profile.id);

    console.log('4. Creating UserPreference...');
    const pref = await models.UserPreference.create({ user_id: user.id });
    console.log('UserPreference created:', pref.id);

    console.log('5. Issuing tokens...');
    const tokens = await issueTokens(user);
    console.log('Tokens issued successfully:', tokens);
  } catch (err) {
    console.error('Error during execution:', err);
  } finally {
    if (user) {
      console.log('Cleaning up database entries...');
      await models.UserPreference.destroy({ where: { user_id: user.id } });
      await models.Profile.destroy({ where: { user_id: user.id } });
      await models.RefreshToken.destroy({ where: { user_id: user.id } });
      await models.User.destroy({ where: { id: user.id } });
    }
    await sequelize.close();
  }
}

test();
