/**
 * Controller: POST /pop/api/exposure-decision (richer advisory contract).
 *
 * Thin: normalize -> engine.decide -> adapter -> respond. All business logic
 * lives in core/. Swap Express for Lambda and this file is the only glue that
 * changes.
 */

import type { Request, Response } from 'express';
import { config } from '../../config/index.js';
import { toExposureDecision } from '../../core/adapters/exposureDecision.js';
import { decide } from '../../core/engine/index.js';
import type { DecisionInput } from '../../core/types.js';
import { logger } from '../../logger/index.js';
import type { ExposureDecisionRequest } from '../validators/schemas.js';

export function exposureDecisionController(data: ExposureDecisionRequest, _req: Request, res: Response): void {
  const input = data as DecisionInput;
  const result = decide(input, config.engine);
  logger.info(
    { caseId: result.caseId, limitBreached: result.limitBreached, recommendation: result.recommendation },
    'exposure-decision computed',
  );
  res.status(200).json(toExposureDecision(result));
}
