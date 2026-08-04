/**
 * AWS Lambda handler (API Gateway proxy) — the deployment seam.
 *
 * Demonstrates that the decision engine is transport-agnostic: this handler
 * imports the SAME `core/` engine the Express controllers use, with no Express
 * in the path. Wire it to an API Gateway route (or a Step Functions task) to
 * run POP serverless. Types are declared locally so the package carries no AWS
 * dependency until you actually deploy.
 */

import { config } from '../config/index.js';
import { toExposureDecision } from '../core/adapters/exposureDecision.js';
import { toThresholdDetermination } from '../core/adapters/thresholdDetermination.js';
import { decide } from '../core/engine/index.js';
import type { DecisionInput } from '../core/types.js';

interface ApiGatewayEvent {
  path?: string;
  rawPath?: string;
  body?: string | null;
}

interface ApiGatewayResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

function json(statusCode: number, body: unknown): ApiGatewayResult {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

export async function handler(event: ApiGatewayEvent): Promise<ApiGatewayResult> {
  let input: DecisionInput;
  try {
    input = JSON.parse(event.body ?? '{}') as DecisionInput;
  } catch {
    return json(400, { error: 'Malformed JSON in request body' });
  }

  if (!input.caseId || typeof input.caseId !== 'string') {
    return json(400, { error: 'Missing required field: caseId' });
  }

  const result = decide(input, config.engine);
  const path = event.rawPath ?? event.path ?? '';

  if (path.endsWith('/threshold-determination')) {
    const adapted = toThresholdDetermination(result, input.limits?.tempValue ?? 0);
    if (adapted.kind === 'insufficient') {
      return json(400, { error: `Incomplete payload (missing ${adapted.missingDataFields.join(', ')})` });
    }
    return json(200, adapted.body);
  }

  return json(200, toExposureDecision(result));
}
