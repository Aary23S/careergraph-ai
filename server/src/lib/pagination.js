export function getPagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
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

export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch (e) {
    return null;
  }
}
