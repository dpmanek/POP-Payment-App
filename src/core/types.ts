/**
 * Core domain types — transport-agnostic.
 *
 * Nothing in `core/` imports Express, AWS, or any HTTP concern. These types
 * describe the decision problem itself so the engine can be reused as a
 * standalone "skill" (Lambda handler, Step Function task, unit test, etc.).
 */

export type ExceptionType = 'Credit Exposure' | 'Debit Exposure';

export type TransactionType = 'Credit' | 'Debit';

/** Transaction code: 22 = debit, 27 = credit. */
export type TransactionCode = '22' | '27';

export interface Transaction {
  type?: TransactionType;
  tc?: TransactionCode;
  account?: string;
  amount?: number;
}

export interface Limits {
  dLimitValue?: number | null;
  cLimitValue?: number | null;
  /** Temporary limit increase on file. 0/absent = none on file (a valid value). */
  tempValue?: number | null;
  /** Aggregate / running exposure value. */
  exposureValue?: number | null;
  /** Authority ceiling for credit exposure (senior-referral trigger). */
  creditCeiling?: number | null;
  /** Authority ceiling for debit exposure (senior-referral trigger). */
  debitCeiling?: number | null;
  /**
   * Optional reliability flag for the temporary increase. When present and
   * false, the temp value is treated as unconfirmed and lowers confidence.
   * Absent = treated as confirmed (no penalty).
   */
  tempConfirmed?: boolean;
}

/**
 * The neutral decision request. Both HTTP contracts normalize into this shape
 * before touching the engine.
 */
export interface DecisionInput {
  caseId: string;
  company?: string;
  achId?: string;
  fileNumber?: string;
  batchNumber?: string;
  exceptionType?: ExceptionType;
  limits?: Limits;
  transactions?: Transaction[];
}

export type BreachStatus = 'YES' | 'NO' | 'INSUFFICIENT_DATA';

/** Advisory recommendation. Never REJECT — rejection is a human-only outcome. */
export type Recommendation = 'APPROVE' | 'ROUTE-UW';

/**
 * The single, neutral result the engine produces. Adapters map this into each
 * contract's response shape — the engine never speaks a specific contract.
 */
export interface DecisionResult {
  caseId: string;
  exceptionType?: ExceptionType;

  /** Exposure − dLimit − cLimit against the highest-value transaction. */
  overageValue: number | null;
  /** Sum of overage across credit transactions only. Null for debit exposure. */
  grandTotalValue: number | null;

  limitBreached: BreachStatus;
  recommendation: Recommendation | null;
  confidence: number | null;

  rationale: string | null;
  seniorLenderReferral: boolean;

  missingDataFields: string[];
  additionalNotes: string | null;
  requiresHumanDecision: boolean;

  /**
   * The highest-value transaction the overage was computed against, if one was
   * resolved. Adapters may ignore it; kept for traceability.
   */
  basisTransaction: Transaction | null;
}
