import crypto from 'crypto';
import { env } from '../config/env.js';
import { AppError } from './http.js';

export function getPagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  if (page > 100) {
    throw new AppError(400, 'MAX_PAGE_DEPTH_EXCEEDED', 'Requested page exceeds maximum allowed depth of 100. Please use search or export features for deep historical data.');
  }

  const rawPageSize = query.limit || query.pageSize;
  const pageSize = Math.min(Math.max(Number(rawPageSize) || 50, 1), 100);

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    cursor: query.cursor || null,
  };
}

export function makePageMeta({ page, pageSize, limit, total, nextCursor = null }) {
  const finalLimit = limit || pageSize || 50;
  
  const totalPages = total !== undefined ? Math.max(Math.ceil(total / finalLimit), 1) : undefined;
  
  return {
    page,
    pageSize: finalLimit,
    limit: finalLimit,
    total,
    totalPages,
    hasNextPage: nextCursor ? true : (total !== undefined ? page < totalPages : false),
    hasPreviousPage: page > 1,
    nextCursor,
  };
}

const CURSOR_SECRET = env.jwtAccessSecret || 'fallback_secret_for_cursors_if_missing';

export function encodeCursor(payload) {
  const data = JSON.stringify(payload);
  const hash = crypto.createHmac('sha256', CURSOR_SECRET).update(data).digest('hex');
  return Buffer.from(`${hash}:${data}`).toString('base64');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf8');
    const [hash, ...rest] = decoded.split(':');
    const data = rest.join(':');
    const expectedHash = crypto.createHmac('sha256', CURSOR_SECRET).update(data).digest('hex');
    if (hash !== expectedHash) return null;
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}
