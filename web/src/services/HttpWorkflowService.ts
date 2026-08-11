/**
 * PLACEHOLDER — not wired up yet.
 *
 * This is the drop-in replacement for MockWorkflowService once the real
 * orchestrator exists. It implements the identical WorkflowService interface,
 * so switching over is a one-line change in App.tsx:
 *
 *     const service = new HttpWorkflowService(import.meta.env.VITE_ORCHESTRATOR_URL);
 *
 * The orchestrator team only needs to expose three endpoints returning the
 * WorkflowRun shape defined in src/types/workflow.ts:
 *
 *     POST /workflows          -> WorkflowRun     (start a run)
 *     GET  /workflows/:id      -> WorkflowRun     (current status; the UI polls this ~1/sec)
 *     GET  /workflows          -> WorkflowRun[]   (recent runs, newest first)
 *
 * No UI change is required as long as those responses match the contract.
 */

import type { WorkflowRun } from '../types/workflow';
import type { StartRunOptions, WorkflowService } from './WorkflowService';

export class HttpWorkflowService implements WorkflowService {
  readonly #baseUrl: string;

  constructor(baseUrl: string) {
    this.#baseUrl = baseUrl.replace(/\/$/, '');
  }

  async startRun(options: StartRunOptions): Promise<WorkflowRun> {
    return this.#request<WorkflowRun>('/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options),
    });
  }

  async getRun(workflowId: string): Promise<WorkflowRun | null> {
    try {
      return await this.#request<WorkflowRun>(`/workflows/${encodeURIComponent(workflowId)}`);
    } catch (err) {
      if (err instanceof Error && err.message.includes('404')) return null;
      throw err;
    }
  }

  async listRuns(): Promise<WorkflowRun[]> {
    return this.#request<WorkflowRun[]>('/workflows');
  }

  async #request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.#baseUrl}${path}`, init);
    if (!res.ok) throw new Error(`Orchestrator request failed: HTTP ${res.status}`);
    return (await res.json()) as T;
  }
}
