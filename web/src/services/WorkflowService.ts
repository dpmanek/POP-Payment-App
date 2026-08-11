/**
 * The seam between the UI and whatever executes workflows.
 *
 * Today: MockWorkflowService (client-side simulation).
 * Later:  HttpWorkflowService (real orchestrator over HTTP).
 *
 * The UI imports only this interface. Swapping implementations is a one-line
 * change in App.tsx.
 */

import type { WorkflowRun } from '../types/workflow';

/** The three demo paths an operations user can walk through. */
export type ScenarioId = 'escalation' | 'autoClose' | 'lookupFailure';

export interface StartRunOptions {
  scenario: ScenarioId;
  /**
   * When true, steps that have a real POP API behind them call it instead of
   * returning simulated output. Steps with no real API stay simulated either way.
   */
  useLiveApis: boolean;
}

export interface WorkflowService {
  /** Kick off a run. Resolves as soon as the run exists — execution continues in the background. */
  startRun(options: StartRunOptions): Promise<WorkflowRun>;

  /** Current snapshot of a run. The UI polls this. Null if unknown id. */
  getRun(workflowId: string): Promise<WorkflowRun | null>;

  /** Every run this service knows about, newest first. */
  listRuns(): Promise<WorkflowRun[]>;
}
