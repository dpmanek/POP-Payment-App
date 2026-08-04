/**
 * Logger — structured JSON via Pino. CloudWatch-native output.
 */

import { pino } from 'pino';
import { config } from '../config/index.js';

export const logger = pino({
  level: config.logLevel,
  base: { service: 'pop-exposure-decision' },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export type Logger = typeof logger;
