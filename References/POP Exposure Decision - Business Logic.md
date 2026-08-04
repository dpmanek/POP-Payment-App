# POP Exposure Decision — Business Logic

## Purpose

POP is a headless, stateless decision service for ACH exposure exceptions (credit and debit). Given case and transaction data, it calculates the exposure overage, determines whether the exposure limit is breached, and returns a recommendation. It holds no state between calls, performs no actions beyond returning the decision, and requires no knowledge of anything outside the data it is given.

## Data sufficiency

- A decision requires: an exposure type (credit or debit), an exposure value, a debit limit, a credit limit, and a resolvable highest-value transaction matching that exposure type (the transaction the decision is based on).

- If any of these is missing, non-numeric, or unresolvable, no overage or recommendation is computed. The case is marked as having insufficient data, and the specific missing elements are identified so they can be supplied and the decision requested again.

- A temporary limit increase value of zero or absent is a valid state — "no temporary increase on file" — and is not, by itself, treated as missing data. However, when the reliability of a supplied temporary increase value cannot be established, it should be treated as unconfirmed and should reduce confidence accordingly (see Confidence).

## Overage calculation

- Overage = Exposure − Debit Limit − Credit Limit, computed against the highest-value transaction.

- A grand total is also computed: the sum of overage amounts across credit-type transactions only. This value is null for debit exposure.

## Breach determination

- Overage ≤ 0: the exposure limit is not breached. No recommendation is produced — there is nothing to route or advise on.

- Overage > 0: the exposure limit is breached, and a recommendation is produced.

## Recommendation

- When breached and the overage is within the temporary limit increase on file: recommend approval.

- When breached and the overage exceeds the temporary limit increase (or none is confirmed): recommend routing to an underwriter for a decision.

- A recommendation to reject is never produced by this decision. Rejection can only be made by a human reviewer; this decision is limited to recommending approval or escalation.

- Every breach recommendation is advisory, not an action. The decision always flags that a human decision is required when the limit is breached, and never flags this when it is not.

- When overage or exposure exceeds a defined authority ceiling for the exposure type (credit or debit), flag the case for senior-level referral. This is informational only and does not change the recommendation itself.

## Confidence

- Every recommendation carries a confidence score reflecting how complete and reliable the input data was — for example, whether the temporary increase value could be treated as reliable.

- Below a minimum confidence threshold, the recommendation defaults to the more conservative outcome (route to underwriter) regardless of what the overage-vs-threshold comparison alone would suggest.

## Rationale

- Every decision includes a plain-language explanation citing the actual figures used (exposure, limits, temporary increase, overage), so the basis for the recommendation is traceable.
