/**
 * Controller: GET /health — liveness probe. Stateless, no dependencies to check.
 */

import type { Request, Response } from 'express';

export function healthController(_req: Request, res: Response): void {
  res.status(200).json({
    status: 'ok',
    service: 'pop-exposure-decision',
    timestamp: new Date().toISOString(),
  });
}
