/**
 * Express app assembly — transport shell around the pure engine.
 *
 * Exported as a factory so tests (Supertest) and a future Lambda wrapper
 * (serverless-http) can build an app without booting a server.
 */

import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../logger/index.js';
import { openapiSpec } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { router } from './routes/index.js';

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
