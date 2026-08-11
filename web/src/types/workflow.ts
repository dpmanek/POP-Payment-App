/**
 * THE CONTRACT.
 *
 * This file is the handoff artifact for the orchestrator team. Whatever builds
 * the real workflow engine (LangGraph service, queue consumer, anything else)
 * only has to emit this shape. The UI reads nothing but these types, so a real
 * backend can replace the mock with no UI changes.
 *
 * Keep this file free of React, fetch, and any mock-specific detail.
 */

/** Execution state of a single workflow step. */
export type NodeStatus = 'pending' | 'running' | 'success' | 'failed' | 'waiting';

/** Roll-up state of the workflow as a whole. */
export type WorkflowStatus = 'pending' | 'running' | 'waiting' | 'completed' | 'failed';

/**
 * Where a step's result came from. Purely for UI honesty — an operations user
 * must never mistake simulated output for real bank data.
 */
export type ResultSource = 'live' | 'simulated';

export interface WorkflowNode {
  /** Stable machine id, e.g. "exposure-review". */
  id: string;
  /** Operations-facing label, e.g. "Exposure Review". */
  name: string;
  /** One-line plain-language explanation of what this step does. */
  description: string;
  status: NodeStatus;
  /** ISO-8601, or null if the step has not started. */
  startedAt: string | null;
  /** ISO-8601, or null if the step has not finished. */
  completedAt: string | null;
  /** Short human-readable result shown on the collapsed card. */
  summary: string | null;
  /** Full result payload, revealed in the expandable detail panel. */
  response: unknown | null;
  /** Failure message when status is "failed". */
  error: string | null;
  /** Whether this result is real or simulated. */
  source: ResultSource;
}

export interface WorkflowRun {
  workflowId: string;
  workflowName: string;
  workflowStatus: WorkflowStatus;
  /** Business case this run is processing. */
  caseId: string;
  startedAt: string | null;
  completedAt: string | null;
  nodes: WorkflowNode[];
}

/** Terminal states — no further node transitions will occur. */
export const TERMINAL_WORKFLOW_STATUSES: readonly WorkflowStatus[] = ['completed', 'failed'];

export function isTerminal(status: WorkflowStatus): boolean {
  return TERMINAL_WORKFLOW_STATUSES.includes(status);
}
