/**
 * Validation helper — runs a Zod schema against req.body and passes the parsed,
 * typed value to the handler. Structural failures become a 400 with a readable
 * message.
 */

import type { Request, RequestHandler, Response } from 'express';
import type { ZodSchema } from 'zod';
import { HttpError } from './errors.js';

export function validateBody<T>(
  schema: ZodSchema<T>,
  handler: (data: T, req: Request, res: Response) => void,
): RequestHandler {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      const path = first?.path.join('.');
      const message = path ? `${path}: ${first?.message}` : (first?.message ?? 'Invalid request');
      next(new HttpError(400, message));
      return;
    }
    try {
      handler(parsed.data, req, res);
    } catch (err) {
      next(err);
    }
  };
}
