/** Small display helpers. No business logic. */

const USD = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
});

export function usd(value: number): string {
  return USD.format(value);
}

/** "2:14:07 PM" — local time, for start/completion stamps. */
export function timeOfDay(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  });
}

/** "1.4s" / "2m 05s" — elapsed time between two stamps. */
export function duration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '—';
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = Math.max(0, end - new Date(startedAt).getTime());

  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1000);
  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
}

export function prettyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}
