import { Op } from 'sequelize';
import { env } from '../config/env.js';

// Op.iLike is Postgres-only - Sequelize emits it as a literal `ILIKE` keyword
// for every dialect rather than translating it, so using it against SQLite
// (or any other dialect) throws a syntax error. SQLite's own `LIKE` is
// already case-insensitive for ASCII by default, which matches the
// case-insensitive search behavior this app relies on.
export const caseInsensitiveLikeOp = env.databaseDialect === 'postgres' ? Op.iLike : Op.like;

// For raw SQL fragments (e.g. inside sequelize.literal) where Op operators
// aren't available. Only use this with fixed, non-user-controlled values.
export const caseInsensitiveLikeKeyword = env.databaseDialect === 'postgres' ? 'ILIKE' : 'LIKE';
