import type { Tone } from '../lib/statusLabels';

interface StatusPillProps {
  label: string;
  tone: Tone;
  /** Larger variant used in the workflow header. */
  large?: boolean;
}

export function StatusPill({ label, tone, large = false }: StatusPillProps) {
  return (
    <span className={`pill pill--${tone}${large ? ' pill--large' : ''}`}>
      <span className="pill__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
