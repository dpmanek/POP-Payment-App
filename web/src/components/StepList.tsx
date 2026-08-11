import type { WorkflowRun } from '../types/workflow';
import { StepCard } from './StepCard';

interface StepListProps {
  run: WorkflowRun;
}

export function StepList({ run }: StepListProps) {
  // The step the user should be looking at: the first one still in flight.
  const currentIndex = run.nodes.findIndex((n) => n.status === 'running' || n.status === 'waiting');

  return (
    <ol className="steps">
      {run.nodes.map((node, index) => (
        <StepCard key={node.id} node={node} index={index} isCurrent={index === currentIndex} />
      ))}
    </ol>
  );
}
