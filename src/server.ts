/**
 * Local / container entrypoint. Loads env, builds the app, starts listening.
 *
 * A future AWS Lambda deployment would NOT use this file — it would wrap
 * `createApp()` with serverless-http, or call `decide()` from core/ directly.
 */

import 'dotenv/config';
import { config } from './config/index.js';
import { createApp } from './http/app.js';
import { logger } from './logger/index.js';

const app = createApp();

const server = app.listen(config.port, () => {
  logger.info(
    { port: config.port, env: config.nodeEnv },
    `POP exposure-decision service listening on http://localhost:${config.port}`,
  );
});

function shutdown(signal: string): void {
  logger.info({ signal }, 'Shutting down');
  server.close(() => process.exit(0));
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
