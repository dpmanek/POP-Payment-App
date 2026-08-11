import type { WorkflowRun } from '../types/workflow';
import { WORKFLOW_STATUS_LABEL, WORKFLOW_STATUS_TONE } from '../lib/statusLabels';
import { duration, timeOfDay } from '../lib/format';
import { StatusPill } from './StatusPill';

interface WorkflowHeaderProps {
  run: WorkflowRun;
}

export function WorkflowHeader({ run }: WorkflowHeaderProps) {
  const total = run.nodes.length;
  const done = run.nodes.filter((n) => n.status === 'success').length;
  const failed = run.nodes.some((n) => n.status === 'failed');
  const percent = Math.round((done / total) * 100);
  const tone = WORKFLOW_STATUS_TONE[run.workflowStatus];

  return (
    <section className="wf">
      <div className="wf__top">
        <div>
          <h2 className="wf__name">{run.workflowName}</h2>
          <p className="wf__case">
            Case <strong>{run.caseId}</strong> · Reference {run.workflowId}
          </p>
        </div>
        <StatusPill label={WORKFLOW_STATUS_LABEL[run.workflowStatus]} tone={tone} large />
      </div>

      <div className="wf__progress">
        <div className="wf__bar" role="img" aria-label={`${done} of ${total} steps completed`}>
          <div className={`wf__fill wf__fill--${failed ? 'bad' : tone}`} style={{ width: `${percent}%` }} />
        </div>
        <span className="wf__count">
          {done} of {total} steps completed
        </span>
      </div>

      <dl className="wf__facts">
        <div>
          <dt>Started</dt>
          <dd>{timeOfDay(run.startedAt)}</dd>
        </div>
        <div>
          <dt>Finished</dt>
          <dd>{timeOfDay(run.completedAt)}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{duration(run.startedAt, run.completedAt)}</dd>
        </div>
      </dl>
    </section>
  );
}
