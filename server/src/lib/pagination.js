export function getPagination(query) {
  const page = Math.max(Number(query.page) || 1, 1);
  const rawPageSize = query.limit || query.pageSize;
  const pageSize = Math.min(Math.max(Number(rawPageSize) || 50, 1), 100);

  return {
    page,
    pageSize,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  };
}

export function makePageMeta({ page, pageSize, limit, total }) {
  const finalLimit = limit || pageSize || 50;
  const totalPages = Math.max(Math.ceil(total / finalLimit), 1);
  
  return {
    page,
    pageSize: finalLimit,
    limit: finalLimit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}
