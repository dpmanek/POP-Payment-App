/**
 * The POP workflow shape and its demo scenarios.
 *
 * Step order, labels and descriptions live here so the UI never hardcodes them.
 * When the real orchestrator lands it will emit the same step ids, and this file
 * becomes reference material rather than the source of truth.
 *
 * Wording rule: every label here is read by banking operations staff. No
 * engineering vocabulary ("node", "graph", "handler") appears in any string
 * that reaches the screen.
 */

import type { ScenarioId } from './WorkflowService';

/** The ACH exception payload a run is processing. Matches the live POP API request schema. */
export interface CasePayload {
  caseId: string;
  exceptionType: 'Credit Exposure' | 'Debit Exposure';
  company: string;
  limits: {
    dLimitValue: number;
    cLimitValue: number;
    tempValue: number;
    exposureValue: number;
  };
  transactions: Array<{
    type: 'Credit' | 'Debit';
    tc: '22' | '27';
    account: string;
    amount: number;
  }>;
}

export interface Scenario {
  id: ScenarioId;
  label: string;
  /** Shown under the picker so an ops user knows what they are about to watch. */
  blurb: string;
  payload: CasePayload;
}

export const SCENARIOS: Record<ScenarioId, Scenario> = {
  escalation: {
    id: 'escalation',
    label: 'Over threshold — escalate to RBO',
    blurb: 'Exposure exceeds the temporary limit increase. Routes to the RBO team and a human reviewer.',
    payload: {
      caseId: 'EXP-30412',
      exceptionType: 'Credit Exposure',
      company: 'Northwind Manufacturing LLC',
      limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 550000 },
      transactions: [{ type: 'Credit', tc: '27', account: '****4417', amount: 180000 }],
    },
  },
  autoClose: {
    id: 'autoClose',
    label: 'Within threshold — auto-close',
    blurb: 'Exposure sits inside the temporary limit increase. Closes automatically with no human review.',
    payload: {
      caseId: 'EXP-30588',
      exceptionType: 'Credit Exposure',
      company: 'Cascade Foods Inc',
      limits: { dLimitValue: 50000, cLimitValue: 450000, tempValue: 25000, exposureValue: 510000 },
      transactions: [{ type: 'Credit', tc: '27', account: '****9102', amount: 60000 }],
    },
  },
  lookupFailure: {
    id: 'lookupFailure',
    label: 'Lookup failure — needs attention',
    blurb: 'The PayPlus system is unreachable. The workflow stops and flags the case for follow-up.',
    payload: {
      caseId: 'EXP-30601',
      exceptionType: 'Debit Exposure',
      company: 'Harbor Point Logistics',
      limits: { dLimitValue: 40000, cLimitValue: 200000, tempValue: 10000, exposureValue: 265000 },
      transactions: [{ type: 'Debit', tc: '22', account: '****7734', amount: 95000 }],
    },
  },
};

export const DEFAULT_SCENARIO: ScenarioId = 'escalation';

/** Which real POP API a step can call when Live mode is on. */
export type LiveEndpoint = 'exposure-decision' | 'threshold-determination';

export interface StepDefinition {
  id: string;
  name: string;
  description: string;
  /** Simulated think-time, so the demo reads like a real system doing work. */
  durationMs: number;
  /** Present only on steps that have a real POP API behind them today. */
  liveEndpoint?: LiveEndpoint;
  /** Steps that pause for a person rather than failing or completing outright. */
  pausesForHuman?: boolean;
}

/**
 * The nine steps, in execution order.
 *
 * Only two have a real API today (exposure-review, routing-decision). The other
 * seven are simulated and are labelled as such in the UI. See
 * docs/INTEGRATION-MAP.md for the full mapping.
 */
export const WORKFLOW_STEPS: StepDefinition[] = [
  {
    id: 'case-created',
    name: 'Case Created',
    description: 'An ACH exception case arrives from Pega and is opened for processing.',
    durationMs: 900,
  },
  {
    id: 'payplus-lookup',
    name: 'PayPlus Lookup',
    description: 'Retrieves the customer profile and current limits from PayPlus.',
    durationMs: 1600,
  },
  {
    id: 'account-lookup',
    name: 'Account / ACH Lookup',
    description: 'Pulls account standing and the pending ACH batch detail.',
    durationMs: 1400,
  },
  {
    id: 'exposure-review',
    name: 'Exposure Review',
    description: 'Calculates the overage against the debit and credit limits.',
    durationMs: 1500,
    liveEndpoint: 'exposure-decision',
  },
  {
    id: 'routing-decision',
    name: 'Routing Decision',
    description: 'Compares the overage to the temporary limit increase and decides where the case goes.',
    durationMs: 1200,
    liveEndpoint: 'threshold-determination',
  },
  {
    id: 'notify-rbo',
    name: 'Notify RBO Team',
    description: 'Sends the case summary to the Regional Business Office for review.',
    durationMs: 1300,
  },
  {
    id: 'manual-review',
    name: 'Manual Review Queue',
    description: 'Holds the case for a reviewer to approve or decline.',
    durationMs: 4000,
    pausesForHuman: true,
  },
  {
    id: 'update-pega',
    name: 'Update Pega Case',
    description: 'Writes the outcome and full audit trail back to the Pega case.',
    durationMs: 1500,
  },
  {
    id: 'workflow-complete',
    name: 'Workflow Complete',
    description: 'All steps finished. The case is closed and recorded.',
    durationMs: 600,
  },
];

export const WORKFLOW_NAME = 'POP — ACH Exposure Exception Review';
