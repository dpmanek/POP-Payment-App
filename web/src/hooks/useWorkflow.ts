/**
 * Drives one workflow run and keeps it fresh by polling.
 *
 * Polling (rather than a websocket or server-sent events) is deliberate: the
 * backend runs on AWS Lambda behind API Gateway, which cannot hold a persistent
 * connection open. Polling behaves identically locally and in AWS.
 *
 * The hook talks only to the WorkflowService interface, so it is unaffected by
 * whether the data is simulated or real.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { isTerminal, type WorkflowRun } from '../types/workflow';
import type { StartRunOptions, WorkflowService } from '../services/WorkflowService';

const POLL_INTERVAL_MS = 500;

export interface UseWorkflowResult {
  run: WorkflowRun | null;
  isStarting: boolean;
  startError: string | null;
  start: (options: StartRunOptions) => Promise<void>;
  reset: () => void;
}

export function useWorkflow(service: WorkflowService): UseWorkflowResult {
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);
  const activeIdRef = useRef<string | null>(null);

  const start = useCallback(
    async (options: StartRunOptions) => {
      setIsStarting(true);
      setStartError(null);
      try {
        const started = await service.startRun(options);
        activeIdRef.current = started.workflowId;
        setRun(started);
      } catch (err) {
        setStartError(err instanceof Error ? err.message : 'Could not start the workflow.');
      } finally {
        setIsStarting(false);
      }
    },
    [service],
  );

  const reset = useCallback(() => {
    activeIdRef.current = null;
    setRun(null);
    setStartError(null);
  }, []);

  const shouldPoll = run !== null && !isTerminal(run.workflowStatus);

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;
    const timer = window.setInterval(() => {
      const id = activeIdRef.current;
      if (!id) return;

      void service
        .getRun(id)
        .then((latest) => {
          // Ignore responses for a run the user has already replaced or cleared.
          if (cancelled || !latest || latest.workflowId !== activeIdRef.current) return;
          setRun(latest);
        })
        .catch(() => {
          /* transient poll failure — the next tick retries */
        });
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [service, shouldPoll]);

  return { run, isStarting, startError, start, reset };
}
