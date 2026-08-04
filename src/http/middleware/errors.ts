/**
 * Error + not-found middleware.
 *
 * Every error path returns the contract's `{ error: string }` shape with an
 * appropriate status. Malformed JSON (SyntaxError from express.json) and
 * validation failures both surface as 400.
 */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../../logger/index.js';

/** Thrown by controllers/validators for a client-side (4xx) problem. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: 'Not found' });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  // Body-parser JSON syntax errors.
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: 'Malformed JSON in request body' });
    return;
  }

  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  logger.error({ err }, 'Unhandled error');
  res.status(500).json({ error: 'Internal server error' });
};
