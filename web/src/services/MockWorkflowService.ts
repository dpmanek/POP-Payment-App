/**
 * Simulated workflow execution, entirely client-side.
 *
 * This exists so the UI can be built, demoed and reviewed before the real
 * orchestrator is ready. It walks the nine steps on a timer and produces
 * realistic payloads. Every result it invents is tagged source: 'simulated'.
 *
 * When Live mode is on, the two steps that have a real POP API behind them
 * (Exposure Review, Routing Decision) call the actual endpoints and their
 * results are tagged source: 'live'. Everything else stays simulated.
 *
 * Nothing here leaks into the UI: it satisfies WorkflowService and is swapped
 * out wholesale once a real backend exists.
 */

import type { WorkflowNode, WorkflowRun } from '../types/workflow';
import type { ScenarioId, StartRunOptions, WorkflowService } from './WorkflowService';
import {
  type CasePayload,
  SCENARIOS,
  WORKFLOW_NAME,
  WORKFLOW_STEPS,
  type StepDefinition,
} from './workflowDefinition';
import { callExposureDecision, callThresholdDetermination } from './popApi';
import { usd } from '../lib/format';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const now = (): string => new Date().toISOString();

interface StepOutcome {
  summary: string;
  response: unknown;
}

/** Thrown by a simulated step to represent a downstream system failure. */
class SimulatedFailure extends Error {}

function overageOf(payload: CasePayload): number {
  return payload.limits.exposureValue - payload.limits.dLimitValue - payload.limits.cLimitValue;
}

/**
 * Simulated results, shaped to match what each real system would plausibly
 * return. The two API-backed steps mirror the live response schemas exactly, so
 * switching them to real calls changes the values but never the shape.
 */
function simulateStep(step: StepDefinition, scenario: ScenarioId, payload: CasePayload): StepOutcome {
  const overage = overageOf(payload);
  const temp = payload.limits.tempValue;
  const exceeds = overage > temp;

  switch (step.id) {
    case 'case-created':
      return {
        summary: `Case ${payload.caseId} opened for ${payload.company}.`,
        response: {
          caseId: payload.caseId,
          company: payload.company,
          exceptionType: payload.exceptionType,
          source: 'Pega',
          receivedAt: now(),
        },
      };

    case 'payplus-lookup':
      if (scenario === 'lookupFailure') {
        throw new SimulatedFailure(
          'PayPlus did not respond within 30 seconds. The customer profile could not be retrieved.',
        );
      }
      return {
        summary: `Profile found. Debit limit ${usd(payload.limits.dLimitValue)}, credit limit ${usd(payload.limits.cLimitValue)}.`,
        response: {
          customer: payload.company,
          relationshipManager: 'A. Whitfield',
          dLimitValue: payload.limits.dLimitValue,
          cLimitValue: payload.limits.cLimitValue,
          tempValue: payload.limits.tempValue,
          tempIncreaseOnFile: payload.limits.tempValue > 0,
          profileStatus: 'ACTIVE',
        },
      };

    case 'account-lookup':
      return {
        summary: `${payload.transactions.length} transaction(s) retrieved. Current exposure ${usd(payload.limits.exposureValue)}.`,
        response: {
          accountStatus: 'IN_GOOD_STANDING',
          exposureValue: payload.limits.exposureValue,
          transactions: payload.transactions,
        },
      };

    case 'exposure-review':
      return {
        summary:
          overage > 0
            ? `Over the limit by ${usd(overage)}.`
            : `Within the limit. No overage.`,
        response: {
          caseId: payload.caseId,
          exceptionType: payload.exceptionType,
          overageValue: overage,
          grandTotalValue: 0,
          limitBreached: overage > 0 ? 'YES' : 'NO',
          recommendation: overage > 0 ? (exceeds ? 'ROUTE-UW' : 'APPROVE') : null,
          confidence: 0.85,
          rationale: `Exposure ${usd(payload.limits.exposureValue)} less D-Limit ${usd(payload.limits.dLimitValue)} and C-Limit ${usd(payload.limits.cLimitValue)} leaves overage ${usd(overage)}.`,
          seniorLenderReferral: overage > 0 && payload.limits.exposureValue > 300000,
          missingDataFields: [],
          additionalNotes: null,
          requiresHumanDecision: overage > 0,
        },
      };

    case 'routing-decision':
      return {
        summary: exceeds
          ? `Above the ${usd(temp)} temporary limit — escalate to RBO.`
          : `Within the ${usd(temp)} temporary limit — close automatically.`,
        response: {
          caseId: payload.caseId,
          determination: exceeds ? 'EXCEEDS_THRESHOLD' : overage === 0 ? 'EQUALS_LIMIT' : 'BELOW_THRESHOLD',
          route: exceeds ? 'RBOPCG_ESCALATION' : overage === 0 ? 'HUMAN_REVIEW' : 'AUTO_CLOSE_BELOW_THRESHOLD',
          overageValue: overage,
          grandTotalValue: 0,
          rationale: exceeds
            ? `Overage ${usd(overage)} exceeds temporary threshold ${usd(temp)} — RBO/PCG escalation required.`
            : `Overage ${usd(overage)} is within temporary threshold ${usd(temp)} — auto-close.`,
        },
      };

    case 'notify-rbo':
      if (!exceeds) {
        return {
          summary: 'No notification needed — the case closed within the limit.',
          response: { notified: false, reason: 'Case auto-closed below threshold.' },
        };
      }
      return {
        summary: 'Case summary sent to the RBO team.',
        response: {
          notified: true,
          recipients: ['rbo-exceptions@example-bank.internal'],
          subject: `ACH exposure exception ${payload.caseId} — ${usd(overage)} over limit`,
          sentAt: now(),
        },
      };

    case 'manual-review':
      if (!exceeds) {
        return {
          summary: 'Skipped — no human review required.',
          response: { required: false, reason: 'Overage within the temporary limit increase.' },
        };
      }
      return {
        summary: 'Reviewer approved the exception.',
        response: {
          required: true,
          queue: 'RBO Exception Review',
          reviewer: 'M. Okafor',
          decision: 'APPROVED',
          decidedAt: now(),
        },
      };

    case 'update-pega':
      return {
        summary: `Case ${payload.caseId} updated and closed in Pega.`,
        response: {
          caseId: payload.caseId,
          caseStatus: 'RESOLVED-COMPLETED',
          outcome: exceeds ? 'APPROVED_AFTER_REVIEW' : 'AUTO_CLOSED',
          auditTrailWritten: true,
        },
      };

    case 'workflow-complete':
      return {
        summary: 'All steps finished successfully.',
        response: {
          caseId: payload.caseId,
          finalOutcome: exceeds ? 'APPROVED_AFTER_REVIEW' : 'AUTO_CLOSED',
          completedAt: now(),
        },
      };

    default:
      return { summary: 'Completed.', response: null };
  }
}

/** Calls a real POP API for the steps that have one. */
async function callLiveApi(step: StepDefinition, payload: CasePayload): Promise<StepOutcome> {
  if (step.liveEndpoint === 'exposure-decision') {
    const response = await callExposureDecision(payload);
    const overage = response.overageValue;
    return {
      summary:
        response.limitBreached === 'INSUFFICIENT_DATA'
          ? 'Not enough information to decide.'
          : overage !== null && overage > 0
            ? `Over the limit by ${usd(overage)}.`
            : 'Within the limit. No overage.',
      response,
    };
  }

  const response = await callThresholdDetermination(payload);
  return {
    summary:
      response.route === 'RBOPCG_ESCALATION'
        ? `Above the temporary limit — escalate to RBO.`
        : response.route === 'HUMAN_REVIEW'
          ? 'Exposure equals the limit — send for human review.'
          : 'Within the temporary limit — close automatically.',
    response,
  };
}

function blankNode(step: StepDefinition): WorkflowNode {
  return {
    id: step.id,
    name: step.name,
    description: step.description,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    summary: null,
    response: null,
    error: null,
    source: 'simulated',
  };
}

interface RunControl {
  run: WorkflowRun;
  aborted: boolean;
}

export class MockWorkflowService implements WorkflowService {
  #runs = new Map<string, RunControl>();
  #order: string[] = [];

  async startRun(options: StartRunOptions): Promise<WorkflowRun> {
    // Only one run executes at a time in the demo; stop any earlier one.
    for (const control of this.#runs.values()) control.aborted = true;

    const scenario = SCENARIOS[options.scenario];
    const workflowId = `wf-${Date.now().toString(36)}`;

    const run: WorkflowRun = {
      workflowId,
      workflowName: WORKFLOW_NAME,
      workflowStatus: 'running',
      caseId: scenario.payload.caseId,
      startedAt: now(),
      completedAt: null,
      nodes: WORKFLOW_STEPS.map(blankNode),
    };

    const control: RunControl = { run, aborted: false };
    this.#runs.set(workflowId, control);
    this.#order.unshift(workflowId);

    void this.#execute(control, options);

    return structuredClone(run);
  }

  async getRun(workflowId: string): Promise<WorkflowRun | null> {
    const control = this.#runs.get(workflowId);
    return control ? structuredClone(control.run) : null;
  }

  async listRuns(): Promise<WorkflowRun[]> {
    return this.#order
      .map((id) => this.#runs.get(id))
      .filter((c): c is RunControl => c !== undefined)
      .map((c) => structuredClone(c.run));
  }

  async #execute(control: RunControl, options: StartRunOptions): Promise<void> {
    const { run } = control;
    const scenario = SCENARIOS[options.scenario];

    for (let i = 0; i < WORKFLOW_STEPS.length; i += 1) {
      if (control.aborted) return;

      const step = WORKFLOW_STEPS[i];
      const node = run.nodes[i];
      const isLive = options.useLiveApis && step.liveEndpoint !== undefined;

      // A step that pauses for a person shows as "Waiting for Review" while it runs.
      const runningStatus = step.pausesForHuman ? 'waiting' : 'running';
      node.status = runningStatus;
      node.startedAt = now();
      node.source = isLive ? 'live' : 'simulated';
      run.workflowStatus = step.pausesForHuman ? 'waiting' : 'running';

      try {
        let outcome: StepOutcome;

        if (isLive) {
          // Real network call — no artificial delay needed, but keep a floor so
          // the step is visible rather than flashing past.
          const [result] = await Promise.all([callLiveApi(step, scenario.payload), sleep(600)]);
          outcome = result;
        } else {
          await sleep(step.durationMs);
          outcome = simulateStep(step, scenario.id, scenario.payload);
        }

        if (control.aborted) return;

        node.status = 'success';
        node.summary = outcome.summary;
        node.response = outcome.response;
        node.completedAt = now();
      } catch (err) {
        if (control.aborted) return;

        node.status = 'failed';
        node.completedAt = now();
        node.error = err instanceof Error ? err.message : String(err);
        node.summary = isLive ? 'The service could not be reached.' : 'This step could not be completed.';

        run.workflowStatus = 'failed';
        run.completedAt = now();
        return; // Downstream steps stay "Not Started".
      }
    }

    if (control.aborted) return;
    run.workflowStatus = 'completed';
    run.completedAt = now();
  }
}
