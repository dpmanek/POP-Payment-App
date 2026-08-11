import { useState } from 'react';
import type { WorkflowNode } from '../types/workflow';
import { NODE_STATUS_LABEL, NODE_STATUS_TONE } from '../lib/statusLabels';
import { duration, timeOfDay } from '../lib/format';
import { StatusPill } from './StatusPill';
import { StepDetail } from './StepDetail';

interface StepCardProps {
  node: WorkflowNode;
  index: number;
  isCurrent: boolean;
}

/** Small status glyph inside the timeline marker. */
function Marker({ node, index }: { node: WorkflowNode; index: number }) {
  if (node.status === 'success') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 10.5l3.2 3.2L15 7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (node.status === 'failed') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M10 5.5v5.2M10 14.2v.3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }
  if (node.status === 'waiting') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="10" cy="10" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="M10 6.8V10l2.2 1.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return <span className="marker__num">{index + 1}</span>;
}

export function StepCard({ node, index, isCurrent }: StepCardProps) {
  const [expanded, setExpanded] = useState(false);

  const hasDetail = node.status !== 'pending';
  const tone = NODE_STATUS_TONE[node.status];
  const isActive = node.status === 'running' || node.status === 'waiting';

  return (
    <li className={`step step--${tone}${isCurrent ? ' step--current' : ''}`}>
      <div className={`marker marker--${tone}${node.status === 'running' ? ' marker--spin' : ''}`}>
        <Marker node={node} index={index} />
      </div>

      <div className="step__body">
        <div className="step__top">
          <div className="step__titles">
            <h3 className="step__name">{node.name}</h3>
            {isCurrent && isActive && <span className="step__now">Current step</span>}
          </div>
          <div className="step__badges">
            {node.status !== 'pending' && (
              <span className={`tag tag--${node.source}`}>
                {node.source === 'live' ? 'Live data' : 'Simulated'}
              </span>
            )}
            <StatusPill label={NODE_STATUS_LABEL[node.status]} tone={tone} />
          </div>
        </div>

        {node.summary ? (
          <p className="step__summary">{node.summary}</p>
        ) : (
          <p className="step__summary step__summary--muted">{node.description}</p>
        )}

        <div className="step__meta">
          <span>
            Started <strong>{timeOfDay(node.startedAt)}</strong>
          </span>
          <span>
            Finished <strong>{timeOfDay(node.completedAt)}</strong>
          </span>
          {node.startedAt && (
            <span>
              Took <strong>{duration(node.startedAt, node.completedAt)}</strong>
            </span>
          )}
        </div>

        {hasDetail && (
          <>
            <button
              type="button"
              className="step__toggle"
              onClick={() => setExpanded((open) => !open)}
              aria-expanded={expanded}
            >
              {expanded ? 'Hide details' : 'View details'}
              <svg viewBox="0 0 16 16" className={expanded ? 'chev chev--open' : 'chev'} aria-hidden="true">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            {expanded && <StepDetail node={node} />}
          </>
        )}
      </div>
    </li>
  );
}
