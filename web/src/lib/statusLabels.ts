/**
 * Plain-language labels for every status.
 *
 * The screen is read by banking operations staff, not engineers. Raw status
 * codes ("running", "pending") and orchestration vocabulary never reach the UI —
 * everything user-facing goes through this file.
 */

import type { NodeStatus, WorkflowStatus } from '../types/workflow';

export const NODE_STATUS_LABEL: Record<NodeStatus, string> = {
  pending: 'Not Started',
  running: 'Processing',
  success: 'Completed',
  failed: 'Needs Attention',
  waiting: 'Waiting for Review',
};

export const WORKFLOW_STATUS_LABEL: Record<WorkflowStatus, string> = {
  pending: 'Not Started',
  running: 'In Progress',
  waiting: 'Waiting for Review',
  completed: 'Completed',
  failed: 'Needs Attention',
};

/** Drives colour. Kept separate from the label so wording can change freely. */
export type Tone = 'idle' | 'active' | 'good' | 'bad' | 'hold';

export const NODE_STATUS_TONE: Record<NodeStatus, Tone> = {
  pending: 'idle',
  running: 'active',
  success: 'good',
  failed: 'bad',
  waiting: 'hold',
};

export const WORKFLOW_STATUS_TONE: Record<WorkflowStatus, Tone> = {
  pending: 'idle',
  running: 'active',
  waiting: 'hold',
  completed: 'good',
  failed: 'bad',
};
