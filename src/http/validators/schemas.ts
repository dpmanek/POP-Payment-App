/**
 * Zod validation schemas — STRUCTURAL validation only.
 *
 * Rule from the spec: missing *business* data is not a 400. It is returned as a
 * 200 with limitBreached=INSUFFICIENT_DATA (exposure-decision) or, where the
 * contract cannot represent it, a 400 (threshold-determination). So these
 * schemas reject only structural problems — wrong types, bad enums, malformed
 * shapes — and leave "is there enough to decide?" to the engine.
 */

import { z } from 'zod';

const transactionSchema = z
  .object({
    type: z.enum(['Credit', 'Debit']).optional(),
    tc: z.enum(['22', '27']).optional(),
    account: z.string().optional(),
    amount: z.number().finite().optional(),
  })
  .strict();

const limitsSchema = z
  .object({
    dLimitValue: z.number().finite().nullish(),
    cLimitValue: z.number().finite().nullish(),
    tempValue: z.number().finite().nullish(),
    exposureValue: z.number().finite().nullish(),
    creditCeiling: z.number().finite().nullish(),
    debitCeiling: z.number().finite().nullish(),
    tempConfirmed: z.boolean().optional(),
  })
  .strict();

/** exposure-decision contract: only caseId is required. */
export const exposureDecisionRequestSchema = z
  .object({
    caseId: z.string().min(1, 'caseId must be a non-empty string'),
    company: z.string().optional(),
    achId: z.string().optional(),
    fileNumber: z.string().optional(),
    batchNumber: z.string().optional(),
    exceptionType: z.enum(['Credit Exposure', 'Debit Exposure']).optional(),
    limits: limitsSchema.optional(),
    transactions: z.array(transactionSchema).optional(),
  })
  .strict();

/** threshold-determination contract: caseId + full limits block required. */
export const thresholdDeterminationRequestSchema = z
  .object({
    caseId: z.string().min(1, 'caseId must be a non-empty string'),
    company: z.string().optional(),
    achId: z.string().optional(),
    fileNumber: z.string().optional(),
    batchNumber: z.string().optional(),
    exceptionType: z.enum(['Credit Exposure', 'Debit Exposure']).optional(),
    limits: z
      .object({
        dLimitValue: z.number().finite(),
        cLimitValue: z.number().finite(),
        tempValue: z.number().finite(),
        exposureValue: z.number().finite(),
        creditCeiling: z.number().finite().nullish(),
        debitCeiling: z.number().finite().nullish(),
        tempConfirmed: z.boolean().optional(),
      })
      .strict(),
    transactions: z.array(transactionSchema).optional(),
  })
  .strict();

export type ExposureDecisionRequest = z.infer<typeof exposureDecisionRequestSchema>;
export type ThresholdDeterminationRequest = z.infer<typeof thresholdDeterminationRequestSchema>;
