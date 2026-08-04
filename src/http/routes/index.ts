/**
 * Route table — wires paths to validated controllers.
 */

import { Router } from 'express';
import { exposureDecisionController } from '../controllers/exposureDecision.controller.js';
import { healthController } from '../controllers/health.controller.js';
import { thresholdDeterminationController } from '../controllers/thresholdDetermination.controller.js';
import { validateBody } from '../middleware/validate.js';
import {
  exposureDecisionRequestSchema,
  thresholdDeterminationRequestSchema,
} from '../validators/schemas.js';

export const router = Router();

router.get('/health', healthController);

router.post(
  '/pop/api/exposure-decision',
  validateBody(exposureDecisionRequestSchema, exposureDecisionController),
);

router.post(
  '/pop/api/threshold-determination',
  validateBody(thresholdDeterminationRequestSchema, thresholdDeterminationController),
);
