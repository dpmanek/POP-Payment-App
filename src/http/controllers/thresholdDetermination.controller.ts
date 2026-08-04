/**
 * Controller: POST /pop/api/threshold-determination (routing contract).
 *
 * Same shared engine, different output shape. Insufficient data is not
 * representable in this contract's 200 response, so it is surfaced as a 400 per
 * the contract's "incomplete payload" semantics.
 */

import type { Request, Response } from 'express';
import { config } from '../../config/index.js';
import { toThresholdDetermination } from '../../core/adapters/thresholdDetermination.js';
import { decide } from '../../core/engine/index.js';
import type { DecisionInput } from '../../core/types.js';
import { logger } from '../../logger/index.js';
import { HttpError } from '../middleware/errors.js';
import type { ThresholdDeterminationRequest } from '../validators/schemas.js';

export function thresholdDeterminationController(
  data: ThresholdDeterminationRequest,
  _req: Request,
  res: Response,
): void {
  const input = data as DecisionInput;
  const result = decide(input, config.engine);
  const tempValue = input.limits?.tempValue ?? 0;
  const adapted = toThresholdDetermination(result, tempValue);

  if (adapted.kind === 'insufficient') {
    const fields = adapted.missingDataFields.join(', ');
    throw new HttpError(400, `Incomplete payload: cannot determine routing (missing ${fields})`);
  }

  logger.info(
    { caseId: adapted.body.caseId, determination: adapted.body.determination, route: adapted.body.route },
    'threshold-determination computed',
  );
  res.status(200).json(adapted.body);
}
