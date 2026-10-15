import { HttpError } from '../utils.js';

/** validate(schema, 'body' | 'query') -> menimpa req[source] dengan hasil parse. */
export const validate = (schema, source = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    const message = result.error.issues
      .map((i) => `${i.path.join('.') || source}: ${i.message}`)
      .join('; ');
    return next(new HttpError(400, 'VALIDATION_ERROR', message));
  }
  req[source] = result.data;
  next();
};
