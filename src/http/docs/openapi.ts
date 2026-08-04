/**
 * OpenAPI 3.0 spec — self-contained (no dependency on the References folder),
 * covering both contracts POP exposes plus the health probe.
 */

export const openapiSpec = {
  openapi: '3.0.3',
  info: {
    title: 'POP — Exposure Decision API',
    description:
      'Headless, stateless ACH exposure decision service. Two contracts over one shared engine: ' +
      '`exposure-decision` (richer advisory view) and `threshold-determination` (routing view). ' +
      'No state is retained between calls.',
    version: '0.1.0',
  },
  // Relative server so Swagger "Try it out" targets whatever host is serving
  // the docs (localhost in dev, the API Gateway domain in AWS).
  servers: [{ url: '/' }],
  tags: [
    { name: 'ExposureDecision', description: 'Richer advisory decision' },
    { name: 'Determination', description: 'Routing determination for Pega workflow' },
    { name: 'Health' },
  ],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        operationId: 'health',
        responses: { '200': { description: 'Service is up' } },
      },
    },
    '/pop/api/exposure-decision': {
      post: {
        tags: ['ExposureDecision'],
        summary: 'Overage + advisory recommendation for an ACH exposure exception',
        operationId: 'exposureDecision',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DecisionRequest' },
              examples: {
                breachRouteToUnderwriter: {
                  summary: '1) Breach beyond temp → ROUTE-UW',
                  value: {
                    caseId: 'EXP-30412',
                    company: 'Top Banana LLC',
                    achId: '5271834',
                    exceptionType: 'Credit Exposure',
                    limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
                    transactions: [{ type: 'Credit', tc: '27', account: '•••• 8830', amount: 180000 }],
                  },
                },
                breachWithinTempApprove: {
                  summary: '2) Breach within temp → APPROVE',
                  value: {
                    caseId: 'EXP-30413',
                    company: 'Top Banana LLC',
                    achId: '5271834',
                    exceptionType: 'Credit Exposure',
                    limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 60000, exposureValue: 550000 },
                    transactions: [{ type: 'Credit', tc: '27', account: '•••• 8830', amount: 180000 }],
                  },
                },
                notBreached: {
                  summary: '3) Not breached (overage ≤ 0) → NO',
                  value: {
                    caseId: 'EXP-30414',
                    company: 'Blue Harbor Freight',
                    achId: '9930211',
                    exceptionType: 'Credit Exposure',
                    limits: { dLimitValue: 200000, cLimitValue: 200000, tempValue: 0, exposureValue: 250000 },
                    transactions: [{ type: 'Credit', tc: '27', account: '•••• 4471', amount: 100000 }],
                  },
                },
                debitBreachRouteToUnderwriter: {
                  summary: '4) Debit breach → ROUTE-UW (grandTotal null)',
                  value: {
                    caseId: 'EXP-30416',
                    company: 'Cedar Mill Co',
                    achId: '4410092',
                    exceptionType: 'Debit Exposure',
                    limits: { dLimitValue: 100000, cLimitValue: 50000, tempValue: 5000, exposureValue: 260000 },
                    transactions: [{ type: 'Debit', tc: '22', account: '•••• 2231', amount: 260000 }],
                  },
                },
                insufficientData: {
                  summary: '5) Missing debit limit → INSUFFICIENT_DATA',
                  value: {
                    caseId: 'EXP-30415',
                    company: 'Blue Harbor Freight',
                    achId: '9930211',
                    exceptionType: 'Debit Exposure',
                    limits: { cLimitValue: 100000, tempValue: 0, exposureValue: 210000 },
                    transactions: [{ type: 'Debit', tc: '22', account: '•••• 4471', amount: 210000 }],
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Decision result',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ExposureDecisionResponse' },
                examples: {
                  breachRouteToUnderwriter: {
                    summary: '1) Breach beyond temp → ROUTE-UW',
                    value: {
                      caseId: 'EXP-30412',
                      exceptionType: 'Credit Exposure',
                      overageValue: 50000,
                      grandTotalValue: 0,
                      limitBreached: 'YES',
                      recommendation: 'ROUTE-UW',
                      confidence: 1,
                      rationale:
                        'Exposure $550,000.00 less D-Limit $50,000.00 and C-Limit $450,000.00 leaves overage $50,000.00, which exceeds the $25,000.00 temporary limit increase on file — route to an underwriter.',
                      seniorLenderReferral: true,
                      missingDataFields: [],
                      additionalNotes: null,
                      requiresHumanDecision: true,
                    },
                  },
                  breachWithinTempApprove: {
                    summary: '2) Breach within temp → APPROVE',
                    value: {
                      caseId: 'EXP-30413',
                      exceptionType: 'Credit Exposure',
                      overageValue: 50000,
                      grandTotalValue: 0,
                      limitBreached: 'YES',
                      recommendation: 'APPROVE',
                      confidence: 1,
                      rationale:
                        'Exposure $550,000.00 less D-Limit $50,000.00 and C-Limit $450,000.00 leaves overage $50,000.00, which is within the $60,000.00 temporary limit increase on file — recommend approval.',
                      seniorLenderReferral: true,
                      missingDataFields: [],
                      additionalNotes: null,
                      requiresHumanDecision: true,
                    },
                  },
                  notBreached: {
                    summary: '3) Not breached (overage ≤ 0) → NO',
                    value: {
                      caseId: 'EXP-30414',
                      exceptionType: 'Credit Exposure',
                      overageValue: -150000,
                      grandTotalValue: 0,
                      limitBreached: 'NO',
                      recommendation: null,
                      confidence: null,
                      rationale:
                        'Exposure $250,000.00 less D-Limit $200,000.00 and C-Limit $200,000.00 leaves overage -$150,000.00, which does not breach the exposure limit.',
                      seniorLenderReferral: false,
                      missingDataFields: [],
                      additionalNotes: null,
                      requiresHumanDecision: false,
                    },
                  },
                  debitBreachRouteToUnderwriter: {
                    summary: '4) Debit breach → ROUTE-UW (grandTotal null)',
                    value: {
                      caseId: 'EXP-30416',
                      exceptionType: 'Debit Exposure',
                      overageValue: 110000,
                      grandTotalValue: null,
                      limitBreached: 'YES',
                      recommendation: 'ROUTE-UW',
                      confidence: 1,
                      rationale:
                        'Exposure $260,000.00 less D-Limit $100,000.00 and C-Limit $50,000.00 leaves overage $110,000.00, which exceeds the $5,000.00 temporary limit increase on file — route to an underwriter.',
                      seniorLenderReferral: true,
                      missingDataFields: [],
                      additionalNotes: null,
                      requiresHumanDecision: true,
                    },
                  },
                  insufficientData: {
                    summary: '5) Missing debit limit → INSUFFICIENT_DATA',
                    value: {
                      caseId: 'EXP-30415',
                      exceptionType: 'Debit Exposure',
                      overageValue: null,
                      grandTotalValue: null,
                      limitBreached: 'INSUFFICIENT_DATA',
                      recommendation: null,
                      confidence: null,
                      rationale: null,
                      seniorLenderReferral: false,
                      missingDataFields: ['limits.dLimitValue'],
                      additionalNotes: 'Cannot compute a decision without a debit limit.',
                      requiresHumanDecision: false,
                    },
                  },
                },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/pop/api/threshold-determination': {
      post: {
        tags: ['Determination'],
        summary: 'Routing determination (called by Pega workflow)',
        operationId: 'thresholdDetermination',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/DeterminationRequest' },
              example: {
                caseId: 'EXP-30412',
                exceptionType: 'Credit Exposure',
                limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
                transactions: [{ type: 'Credit', tc: '27', account: '•••• 8830', amount: 180000 }],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Routing determination',
            content: { 'application/json': { schema: { $ref: '#/components/schemas/DeterminationResponse' } } },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
  },
  components: {
    responses: {
      BadRequest: {
        description:
          'Structurally malformed request (bad types, bad JSON). For exposure-decision, missing ' +
          'business data is NOT a 400 — it returns 200 with limitBreached: INSUFFICIENT_DATA.',
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      },
    },
    schemas: {
      Error: { type: 'object', properties: { error: { type: 'string' } } },
      Transaction: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['Credit', 'Debit'] },
          tc: { type: 'string', enum: ['22', '27'], description: '22 = debit, 27 = credit' },
          account: { type: 'string' },
          amount: { type: 'number' },
        },
      },
      Limits: {
        type: 'object',
        properties: {
          dLimitValue: { type: 'number', nullable: true },
          cLimitValue: { type: 'number', nullable: true },
          tempValue: { type: 'number', default: 0, description: '0/absent = no temporary increase on file' },
          exposureValue: { type: 'number', nullable: true },
          creditCeiling: { type: 'number', default: 300000 },
          debitCeiling: { type: 'number', default: 200000 },
          tempConfirmed: { type: 'boolean', description: 'false = temp value unconfirmed (lowers confidence)' },
        },
      },
      DecisionRequest: {
        type: 'object',
        required: ['caseId'],
        properties: {
          caseId: { type: 'string' },
          company: { type: 'string' },
          achId: { type: 'string' },
          fileNumber: { type: 'string' },
          batchNumber: { type: 'string' },
          exceptionType: { type: 'string', enum: ['Credit Exposure', 'Debit Exposure'] },
          limits: { $ref: '#/components/schemas/Limits' },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
        },
      },
      DeterminationRequest: {
        type: 'object',
        required: ['caseId', 'limits'],
        properties: {
          caseId: { type: 'string' },
          company: { type: 'string' },
          achId: { type: 'string' },
          exceptionType: { type: 'string', enum: ['Credit Exposure', 'Debit Exposure'] },
          limits: {
            type: 'object',
            required: ['dLimitValue', 'cLimitValue', 'tempValue', 'exposureValue'],
            properties: {
              dLimitValue: { type: 'number' },
              cLimitValue: { type: 'number' },
              tempValue: { type: 'number' },
              exposureValue: { type: 'number' },
            },
          },
          transactions: { type: 'array', items: { $ref: '#/components/schemas/Transaction' } },
        },
      },
      ExposureDecisionResponse: {
        type: 'object',
        properties: {
          caseId: { type: 'string' },
          exceptionType: { type: 'string', enum: ['Credit Exposure', 'Debit Exposure'] },
          overageValue: { type: 'number', nullable: true },
          grandTotalValue: { type: 'number', nullable: true },
          limitBreached: { type: 'string', enum: ['YES', 'NO', 'INSUFFICIENT_DATA'] },
          recommendation: { type: 'string', enum: ['APPROVE', 'ROUTE-UW'], nullable: true },
          confidence: { type: 'number', minimum: 0, maximum: 1, nullable: true },
          rationale: { type: 'string', nullable: true },
          seniorLenderReferral: { type: 'boolean' },
          missingDataFields: { type: 'array', items: { type: 'string' } },
          additionalNotes: { type: 'string', nullable: true },
          requiresHumanDecision: { type: 'boolean' },
        },
      },
      DeterminationResponse: {
        type: 'object',
        properties: {
          caseId: { type: 'string' },
          determination: { type: 'string', enum: ['EQUALS_LIMIT', 'BELOW_THRESHOLD', 'EXCEEDS_THRESHOLD'] },
          route: {
            type: 'string',
            enum: ['HUMAN_REVIEW', 'AUTO_CLOSE_BELOW_THRESHOLD', 'RBOPCG_ESCALATION'],
          },
          overageValue: { type: 'number' },
          grandTotalValue: { type: 'number', nullable: true },
          rationale: { type: 'string' },
        },
      },
    },
  },
} as const;
