import { useMemo, useState } from 'react';
import { MockWorkflowService } from './services/MockWorkflowService';
import type { ScenarioId } from './services/WorkflowService';
import { DEFAULT_SCENARIO, SCENARIOS } from './services/workflowDefinition';
import { useWorkflow } from './hooks/useWorkflow';
import { isTerminal } from './types/workflow';
import { WorkflowHeader } from './components/WorkflowHeader';
import { StepList } from './components/StepList';

/**
 * The single place the data source is chosen.
 *
 * Today: MockWorkflowService — everything is simulated in the browser.
 * Later:  new HttpWorkflowService(import.meta.env.VITE_ORCHESTRATOR_URL)
 *         once the orchestrator exposes the endpoints described in
 *         services/HttpWorkflowService.ts. Nothing else in the UI changes.
 */
function useWorkflowService() {
  return useMemo(() => new MockWorkflowService(), []);
}

export default function App() {
  const service = useWorkflowService();
  const { run, isStarting, startError, start, reset } = useWorkflow(service);

  const [scenario, setScenario] = useState<ScenarioId>(DEFAULT_SCENARIO);
  const [useLiveApis, setUseLiveApis] = useState(false);

  const inFlight = run !== null && !isTerminal(run.workflowStatus);
  const selected = SCENARIOS[scenario];

  return (
    <div className="page">
      <header className="head">
        <div className="head__brand">
          <span className="head__mark">POP</span>
          <div>
            <h1 className="head__title">Payment Operations Workflow</h1>
            <p className="head__sub">ACH exposure exception processing</p>
          </div>
        </div>
      </header>

      <div className="notice">
        <strong>Demonstration view.</strong> Steps marked <span className="tag tag--simulated">Simulated</span> use
        sample data, not real customer records.
        {useLiveApis && (
          <> Steps marked <span className="tag tag--live">Live data</span> call the live POP decision service.</>
        )}
      </div>

      <section className="controls">
        <div className="controls__field">
          <label htmlFor="scenario">Example case</label>
          <select
            id="scenario"
            value={scenario}
            disabled={inFlight}
            onChange={(e) => setScenario(e.target.value as ScenarioId)}
          >
            {Object.values(SCENARIOS).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <p className="controls__hint">{selected.blurb}</p>
        </div>

        <div className="controls__field controls__field--toggle">
          <label className="switch">
            <input
              type="checkbox"
              checked={useLiveApis}
              disabled={inFlight}
              onChange={(e) => setUseLiveApis(e.target.checked)}
            />
            <span className="switch__track" aria-hidden="true">
              <span className="switch__knob" />
            </span>
            <span className="switch__label">Use live decision service</span>
          </label>
          <p className="controls__hint">
            Off: every step is simulated. On: the exposure and routing steps call the real POP service.
          </p>
        </div>

        <div className="controls__actions">
          <button
            type="button"
            className="btn btn--primary"
            disabled={inFlight || isStarting}
            onClick={() => void start({ scenario, useLiveApis })}
          >
            {inFlight ? 'Running…' : 'Start Workflow'}
          </button>
          <button type="button" className="btn" disabled={!run || inFlight} onClick={reset}>
            Clear
          </button>
        </div>
      </section>

      {startError && <div className="alert">{startError}</div>}

      {run ? (
        <>
          <WorkflowHeader run={run} />
          <StepList run={run} />
        </>
      ) : (
        <section className="empty">
          <h2>No workflow running</h2>
          <p>Choose an example case above and select Start Workflow to watch each step as it processes.</p>
        </section>
      )}

      <footer className="foot">
        POP Workflow View · statuses refresh automatically every half second
      </footer>
    </div>
  );
}
