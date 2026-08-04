# POP Exposure Decision — Input and Output Fields

## Input fields

| Field | Type | Required | Default | Description |

|---|---|---|---|---|

| `caseId` | string | Yes | — | Unique identifier for the case being decisioned. |

| `company` | string | No | — | Name of the company associated with the case. |

| `achId` | string | No | — | ACH identifier associated with the company. |

| `fileNumber` | string | No | — | Identifier of the source file the case originated from. |

| `batchNumber` | string | No | — | Identifier of the batch the case originated from. |

| `exceptionType` | enum: `Credit Exposure`, `Debit Exposure` | No | — | The exposure type this case is being decisioned against. Taken as given — not reconciled or re-derived. |

| `limits.dLimitValue` | number | No | — | Debit limit value. |

| `limits.cLimitValue` | number | No | — | Credit limit value. |

| `limits.tempValue` | number | No | `0` | Temporary limit increase on file. `0` means none on file — a valid value, not missing data. |

| `limits.exposureValue` | number | No | — | Aggregate/running exposure value. |

| `limits.creditCeiling` | number | No | `300000` | Authority ceiling for credit exposure. Above this, the case is flagged for senior-level referral. |

| `limits.debitCeiling` | number | No | `200000` | Authority ceiling for debit exposure. Above this, the case is flagged for senior-level referral. |

| `transactions[]` | array | No | — | List of transactions associated with the case. |

| `transactions[].type` | enum: `Credit`, `Debit` | No | — | Transaction direction. |

| `transactions[].tc` | enum: `22`, `27` | No | — | Transaction code (`22` = debit, `27` = credit). |

| `transactions[].account` | string | No | — | Account reference for the transaction. |

| `transactions[].amount` | number | No | — | Transaction amount. |

Only `caseId` is required at the field level. All other business data may be absent — an absence that prevents a decision is reported through the output rather than rejected as invalid input.

## Output fields

| Field | Type | Description |

|---|---|---|

| `caseId` | string | Echoes the case identifier from the request. |

| `exceptionType` | enum: `Credit Exposure`, `Debit Exposure` | Echoes the exposure type the decision was made against. |

| `overageValue` | number, nullable | Exposure minus debit limit minus credit limit, computed against the highest-value transaction. Null when data is insufficient. |

| `grandTotalValue` | number, nullable | Sum of overage amounts across credit-type transactions only. Null for debit exposure or when data is insufficient. |

| `limitBreached` | enum: `YES`, `NO`, `INSUFFICIENT_DATA` | Whether the exposure limit is breached, or whether the decision could not be made. |

| `recommendation` | enum: `APPROVE`, `ROUTE-UW`, nullable | Present only when `limitBreached` is `YES`. Never `REJECT` — rejection is not a value this decision produces. |

| `confidence` | number (0–1), nullable | Present only when a recommendation is returned. Reflects completeness and reliability of the input data. |

| `rationale` | string, nullable | Plain-language explanation citing the figures behind the decision. |

| `seniorLenderReferral` | boolean | True when overage or exposure exceeds the applicable authority ceiling. Informational; does not alter `recommendation`. |

| `missingDataFields` | array of strings | Populated only when `limitBreached` is `INSUFFICIENT_DATA` — the specific fields needed to complete the decision. |

| `additionalNotes` | string, nullable | Human-readable explanation of what is missing. |

| `requiresHumanDecision` | boolean | True whenever `limitBreached` is `YES`; false otherwise. |
