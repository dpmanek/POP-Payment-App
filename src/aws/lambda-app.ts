/**
 * AWS Lambda handler — full Express app via serverless-http.
 *
 * Unlike `lambda.ts` (a lean, dependency-free decision-only handler), this
 * wraps the complete Express app, so EVERYTHING the app serves is available
 * through API Gateway: both decision endpoints, `/health`, `/openapi.json`,
 * and the Swagger UI at `/docs`.
 *
 * The core engine remains transport-agnostic; this file simply chooses to run
 * the Express transport inside Lambda.
 */

import serverlessHttp from 'serverless-http';
import { createApp } from '../http/app.js';

export const handler = serverlessHttp(createApp());
