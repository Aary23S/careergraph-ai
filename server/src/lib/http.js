export class AppError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export function ok(res, data, meta, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    meta: meta ?? undefined,
  });
}

export function created(res, data, meta) {
  return ok(res, data, meta, 201);
}

export function asyncHandler(fn) {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
