/**
 * Express app assembly — transport shell around the pure engine.
 *
 * Exported as a factory so tests (Supertest) and a future Lambda wrapper
 * (serverless-http) can build an app without booting a server.
 */

import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express } from 'express';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { logger } from '../logger/index.js';
import { openapiSpec } from './docs/openapi.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import { router } from './routes/index.js';

/**
 * Built workflow UI, if it has been compiled (`npm run build` inside `web/`).
 *
 * Resolved relative to this module so it works the same from `src/` under tsx,
 * from `dist/` after a build, and from the Lambda package — all three keep the
 * same two-levels-up-then-web/dist layout.
 */
const UI_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');

export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json());

  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
  app.get('/openapi.json', (_req, res) => res.json(openapiSpec));

  // The UI is optional: the API behaves exactly as before when it is absent.
  if (existsSync(UI_DIR)) {
    app.use('/ui', express.static(UI_DIR));
    app.get('/ui/*', (_req, res) => res.sendFile(path.join(UI_DIR, 'index.html')));
    app.get('/', (_req, res) => res.redirect('/ui/'));
  }

  app.use(router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
