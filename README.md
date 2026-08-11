# POP — Exposure Decision API

Headless, stateless decision service for ACH exposure exceptions (credit and debit).

POP is **not** a user application. Pega handles email, cases, screens, humans, and audit; it
calls POP with an exception payload, POP computes a decision, and returns it. POP holds no state
between calls and takes no action beyond returning the decision.

The decision service implements **only** the decision — no email, Excel parsing, or case
management.

Alongside it, this repository now carries a **workflow view** (`web/`): a read-only dashboard that
shows an ACH exposure case moving through its processing steps. It runs on simulated data today and
is designed to be pointed at a real orchestrator later without UI changes. See
[Workflow UI](#workflow-ui) and [docs/INTEGRATION-MAP.md](docs/INTEGRATION-MAP.md).

---

## What it does

Given case, limit, and transaction data, POP:

1. Computes the **overage**: `Exposure − Debit Limit − Credit Limit` against the highest-value
   transaction matching the exposure type.
2. Computes a **grand total** (PCG hold): sum of overage across credit transactions only (null for
   debit exposure).
3. Determines whether the exposure limit is **breached**.
4. Produces a **recommendation** when breached — `APPROVE` or `ROUTE-UW`. **Never `REJECT`** —
   rejection is a human-only outcome.
5. Flags **senior-lender referral** when exposure/overage exceeds the authority ceiling
   (informational; does not change the recommendation).
6. Returns a **confidence** score and a plain-language **rationale** citing the actual figures.

Missing business data is **not** a validation error — it returns `limitBreached: INSUFFICIENT_DATA`
with the specific `missingDataFields`, so Pega can supply them and retry.

---

## Two contracts, one engine

The same decision engine backs two endpoints (both requested by the reference specs):

| Endpoint | View | Output vocabulary |
|---|---|---|
| `POST /pop/api/exposure-decision` | Richer advisory | `APPROVE` / `ROUTE-UW`, confidence, insufficient-data, senior referral |
| `POST /pop/api/threshold-determination` | Routing (Pega workflow) | `EQUALS_LIMIT` / `BELOW_THRESHOLD` / `EXCEEDS_THRESHOLD` + route |

The core math is computed once; two thin adapters phrase the result. See
[Architecture](#architecture).

### Routing map (`threshold-determination`)

| Condition | determination | route |
|---|---|---|
| `overage > tempValue` | `EXCEEDS_THRESHOLD` | `RBOPCG_ESCALATION` |
| `0 < overage ≤ tempValue` | `BELOW_THRESHOLD` | `AUTO_CLOSE_BELOW_THRESHOLD` |
| `overage == 0` | `EQUALS_LIMIT` | `HUMAN_REVIEW` |
| `overage < 0` (extension) | `BELOW_THRESHOLD` | `AUTO_CLOSE_BELOW_THRESHOLD` |

> Note the deliberate difference at `overage == 0`: the routing contract sends it to
> `HUMAN_REVIEW`; the advisory contract treats `overage ≤ 0` as **not breached** (no
> recommendation). Each follows its own reference spec.

---

## Quick start

```bash
cp .env.example .env
npm install
npm run dev          # tsx watch, http://localhost:4000
```

Build & run compiled:

```bash
npm run build
npm start
```

Docker:

```bash
docker build -t pop-exposure-decision .
docker run -p 4000:4000 pop-exposure-decision
```

- Swagger UI: `http://localhost:4000/docs`
- OpenAPI JSON: `http://localhost:4000/openapi.json`
- Health: `http://localhost:4000/health`

### Example

```bash
curl -s http://localhost:4000/pop/api/exposure-decision \
  -H 'Content-Type: application/json' \
  -d '{
    "caseId": "EXP-30412",
    "exceptionType": "Credit Exposure",
    "limits": { "dLimitValue": 50000, "cLimitValue": 450000, "tempValue": 25000, "exposureValue": 550000 },
    "transactions": [ { "type": "Credit", "tc": "27", "amount": 180000 } ]
  }'
```

```json
{
  "caseId": "EXP-30412",
  "exceptionType": "Credit Exposure",
  "overageValue": 50000,
  "grandTotalValue": 0,
  "limitBreached": "YES",
  "recommendation": "ROUTE-UW",
  "confidence": 0.85,
  "rationale": "Exposure $550,000.00 less D-Limit $50,000.00 and C-Limit $450,000.00 leaves overage $50,000.00, which exceeds the $25,000.00 temporary limit increase on file — route to an underwriter.",
  "seniorLenderReferral": true,
  "missingDataFields": [],
  "additionalNotes": null,
  "requiresHumanDecision": true
}
```

---

## Workflow UI

A step-by-step view of an ACH exposure case for banking operations staff. React + Vite +
TypeScript, in `web/`, with its own `package.json` so it never enters the API's dependency tree.

```bash
cd web
npm install
npm run dev          # http://localhost:5173
```

The UI needs no backend to run — every step is simulated in the browser. Start the API too if you
want the **Use live decision service** toggle, which switches the Exposure Review and Routing
Decision steps to the real endpoints:

```bash
npm run dev          # in the repo root, http://localhost:4000
```

Vite proxies `/pop` and `/health` to `http://localhost:4000`. Point it somewhere else — the
deployed API Gateway, for instance — with `VITE_PROXY_TARGET`. See `web/.env.example`.

### What it shows

Workflow name and overall status, then each step with its status (**Not Started**, **Processing**,
**Completed**, **Needs Attention**, **Waiting for Review**), a one-line result, start and finish
times, and an expandable panel with the full response or the failure reason. The step currently
processing is highlighted. Three example cases are included: over-threshold escalation,
within-threshold auto-close, and a lookup failure.

Every step is badged **Simulated** or **Live data** so simulated output is never mistaken for real
customer records.

### Real vs simulated

Two of the nine steps have a real API behind them (Exposure Review, Routing Decision). The other
seven are simulated. Full mapping, plus the contract the future orchestrator must satisfy, is in
[docs/INTEGRATION-MAP.md](docs/INTEGRATION-MAP.md).

### Served in production

`npm run build` in `web/` emits `web/dist`, which the Express app serves at `/ui` when present —
one origin, one Lambda, no CORS. The API behaves identically when `web/dist` is absent.
`deploy/lambda-deploy.sh` builds and packages the UI automatically.

---

## Architecture

```
src/
├── core/                 # PURE. no Express, no AWS — the reusable "skill"
│   ├── engine/           # money, exposure, sufficiency, confidence, ceilings, rationale, decide()
│   ├── adapters/         # neutral result -> each contract's output shape
│   └── types.ts
├── http/                 # Express transport (swappable)
│   ├── app.ts            # app factory (used by server + tests)
│   ├── routes/
│   ├── controllers/      # thin: normalize -> decide() -> adapter -> respond
│   ├── middleware/       # validation, error handling
│   ├── validators/       # Zod schemas (structural 400s only)
│   └── docs/openapi.ts   # self-contained OpenAPI spec
├── config/               # env-driven (12-factor)
├── logger/               # Pino (structured JSON, CloudWatch-native)
├── aws/lambda.ts         # deployment seam — same engine, no Express
└── server.ts             # local / container entrypoint

web/                      # workflow UI (React + Vite), own package.json
├── src/types/            # WorkflowRun contract — the orchestrator handoff artifact
├── src/services/         # WorkflowService interface + mock and HTTP implementations
├── src/hooks/            # polling
└── src/components/       # header, step timeline, expandable detail

docs/INTEGRATION-MAP.md   # workflow step -> API mapping, real vs mocked
```

**Design invariant:** `core/` never imports a transport. Express today, AWS Lambda tomorrow — the
engine is untouched. Stateless by design, so it drops straight into Lambda / Step Functions.

### AWS path (future)

- `src/aws/lambda.ts` is a working API-Gateway-proxy handler that calls the same `decide()` engine.
- Config is env-only → maps to Lambda env vars / SSM.
- Structured JSON logs → CloudWatch.
- Suggested: API Gateway → Lambda; DynamoDB/SSM for config; Step Functions for future agent
  orchestration.

---

## Configuration

All business tunables come from the environment (see `.env.example`):

| Var | Default | Meaning |
|---|---|---|
| `PORT` | `4000` | HTTP port |
| `LOG_LEVEL` | `info` | Pino level |
| `CREDIT_CEILING` | `300000` | Credit authority ceiling (senior referral) |
| `DEBIT_CEILING` | `200000` | Debit authority ceiling (senior referral) |
| `MIN_CONFIDENCE` | `0.5` | Below this, force the conservative outcome (`ROUTE-UW`) |
| `UNCONFIRMED_TEMP_PENALTY` | `0.25` | Confidence penalty for an unconfirmed temp increase |
| `MISSING_OPTIONAL_PENALTY` | `0.15` | Confidence penalty per missing optional field |

---

## Documented default decisions

These fill gaps the reference specs left open. All are config-driven and easy to change once the
lead confirms.

1. **Confidence formula.** Start at `1.0`; subtract penalties (unconfirmed temp, missing optional
   fields); clamp to `[0,1]`. Below `MIN_CONFIDENCE`, force `ROUTE-UW`. The spec requires a 0–1
   score and a minimum threshold but defines no formula.
2. **Unconfirmed temp increase.** Signaled by `limits.tempConfirmed: false` in the payload. Absent
   ⇒ treated as confirmed.
3. **Highest-value transaction tie-break.** First occurrence in array order.
4. **Grand total.** Sum of per-credit-transaction overage above combined limit headroom
   (`dLimit + cLimit`), floored at 0; credits only.
5. **`overage == 0`.** Routing contract → `EQUALS_LIMIT` / `HUMAN_REVIEW`; advisory contract →
   `NO` breach. (Per each spec.)

---

## Validation rules

- **Structural problems → HTTP 400**: missing `caseId`, wrong types, bad enums, malformed JSON,
  unknown fields.
- **Missing business data → HTTP 200** with `INSUFFICIENT_DATA` (advisory contract). The routing
  contract requires the full `limits` block, so an incomplete payload there is a 400.

---

## Testing

```bash
npm test               # run once
npm run test:watch     # watch
npm run test:coverage  # coverage report
```

32 tests cover the exposure math, breach ladder, sufficiency, confidence, ceilings, both adapters,
and full HTTP behavior (valid, insufficient, and 400 paths) for both endpoints.

---

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Hot-reload dev server (tsx) |
| `npm run build` | Compile TS → `dist/` |
| `npm start` | Run compiled server |
| `npm test` | Run tests |
| `npm run typecheck` | Type-check without emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
