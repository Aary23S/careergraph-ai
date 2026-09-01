import { AppError } from '../lib/http.js';

export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      const details = error.details ? error.details.map((d) => d.message).join('. ') : '';
      const message = details ? `Request validation failed: ${details}` : 'Request validation failed.';
      next(
        new AppError(400, 'VALIDATION_ERROR', message, error.details),
      );
      return;
    }

    if (property === 'query') {
      for (const key of Object.keys(req.query)) {
        delete req.query[key];
      }
      Object.assign(req.query, value);
    } else {
      req[property] = value;
    }
    next();
  };
}
