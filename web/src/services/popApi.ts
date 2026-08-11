/**
 * Thin client for the two POP APIs that already exist.
 *
 * Used only when Live mode is enabled. In production the UI is served from the
 * same origin as the API, so the base URL is empty and requests are relative.
 * In local development Vite proxies /pop to the backend (see vite.config.ts).
 */

/** Empty string means same-origin. Override with VITE_API_BASE_URL for cross-origin testing. */
const API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');

export interface ExposureDecisionResponse {
  caseId: string;
  exceptionType?: string;
  overageValue: number | null;
  grandTotalValue: number | null;
  limitBreached: 'YES' | 'NO' | 'INSUFFICIENT_DATA';
  recommendation: 'APPROVE' | 'ROUTE-UW' | null;
  confidence: number | null;
  rationale: string | null;
  seniorLenderReferral: boolean;
  missingDataFields: string[];
  additionalNotes: string | null;
  requiresHumanDecision: boolean;
}

export interface ThresholdDeterminationResponse {
  caseId: string;
  determination: 'EQUALS_LIMIT' | 'BELOW_THRESHOLD' | 'EXCEEDS_THRESHOLD';
  route: 'HUMAN_REVIEW' | 'AUTO_CLOSE_BELOW_THRESHOLD' | 'RBOPCG_ESCALATION';
  overageValue: number;
  grandTotalValue: number | null;
  rationale: string;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    throw new Error(`${path} returned a non-JSON response (HTTP ${res.status})`);
  }

  if (!res.ok) {
    const message =
      parsed && typeof parsed === 'object' && 'error' in parsed
        ? String((parsed as { error: unknown }).error)
        : `HTTP ${res.status}`;
    throw new Error(message);
  }

  return parsed as T;
}

export function callExposureDecision(payload: unknown): Promise<ExposureDecisionResponse> {
  return postJson<ExposureDecisionResponse>('/pop/api/exposure-decision', payload);
}

export function callThresholdDetermination(payload: unknown): Promise<ThresholdDeterminationResponse> {
  return postJson<ThresholdDeterminationResponse>('/pop/api/threshold-determination', payload);
}
