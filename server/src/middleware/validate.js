import { AppError } from '../lib/http.js';

export function validate(schema, property = 'body') {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      next(
        new AppError(400, 'VALIDATION_ERROR', 'Request validation failed.', error.details),
      );
      return;
    }

    req[property] = value;
    next();
  };
}
