/**
 * The expandable panel under a step: full result payload, or the failure reason.
 */

import type { WorkflowNode } from '../types/workflow';
import { prettyJson } from '../lib/format';

interface StepDetailProps {
  node: WorkflowNode;
}

export function StepDetail({ node }: StepDetailProps) {
  return (
    <div className="detail">
      <p className="detail__what">{node.description}</p>

      {node.error && (
        <div className="detail__block detail__block--error">
          <h4 className="detail__heading">What went wrong</h4>
          <p className="detail__error">{node.error}</p>
        </div>
      )}

      {node.response !== null && node.response !== undefined && (
        <div className="detail__block">
          <h4 className="detail__heading">
            Full response
            <span className={`tag tag--${node.source}`}>
              {node.source === 'live' ? 'Live data' : 'Simulated'}
            </span>
          </h4>
          <pre className="detail__json">{prettyJson(node.response)}</pre>
        </div>
      )}

      {node.response === null && !node.error && (
        <p className="detail__empty">No result recorded for this step yet.</p>
      )}
    </div>
  );
}
