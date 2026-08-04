/**
 * Configuration — single source of truth, env-driven (12-factor).
 *
 * Reads process.env once at import. Maps cleanly to container env vars,
 * Lambda environment variables, or SSM-injected values. No secrets here — all
 * values are business tunables with sensible defaults from the reference spec.
 */

import type { EngineConfig } from '../core/engine/index.js';

function numEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function strEnv(name: string, fallback: string): string {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === '' ? fallback : raw;
}

export interface AppConfig {
  port: number;
  logLevel: string;
  nodeEnv: string;
  engine: EngineConfig;
}

export function loadConfig(): AppConfig {
  return {
    port: numEnv('PORT', 4000),
    logLevel: strEnv('LOG_LEVEL', 'info'),
    nodeEnv: strEnv('NODE_ENV', 'development'),
    engine: {
      ceilings: {
        creditCeiling: numEnv('CREDIT_CEILING', 300000),
        debitCeiling: numEnv('DEBIT_CEILING', 200000),
      },
      confidence: {
        minConfidence: numEnv('MIN_CONFIDENCE', 0.5),
        unconfirmedTempPenalty: numEnv('UNCONFIRMED_TEMP_PENALTY', 0.25),
        missingOptionalPenalty: numEnv('MISSING_OPTIONAL_PENALTY', 0.15),
      },
    },
  };
}

export const config = loadConfig();
