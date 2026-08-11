# POP Workflow — Integration Map

Which workflow step maps to which API, what is real today, and what still needs building.

The UI reads the `WorkflowRun` contract in [`web/src/types/workflow.ts`](../web/src/types/workflow.ts).
Anything that emits that shape can drive the screen.

---

## Step → API map

| # | Workflow Step | Backing API | Status | Request | Response |
|---|---|---|---|---|---|
| 1 | Case Created | — | **Mocked** | Case intake from Pega | `caseId`, `company`, `exceptionType`, `receivedAt` |
| 2 | PayPlus Lookup | — | **Mocked** | Customer / account identifier | `dLimitValue`, `cLimitValue`, `tempValue`, `profileStatus` |
| 3 | Account / ACH Lookup | — | **Mocked** | Account + batch identifier | `accountStatus`, `exposureValue`, `transactions[]` |
| 4 | Exposure Review | `POST /pop/api/exposure-decision` | **REAL** | `caseId`, `exceptionType`, `limits{}`, `transactions[]` | `overageValue`, `grandTotalValue`, `limitBreached`, `recommendation`, `confidence`, `rationale`, `seniorLenderReferral`, `missingDataFields`, `requiresHumanDecision` |
| 5 | Routing Decision | `POST /pop/api/threshold-determination` | **REAL** | `caseId`, full `limits{}` (all four values required) | `determination`, `route`, `overageValue`, `grandTotalValue`, `rationale` |
| 6 | Notify RBO Team | — | **Mocked** | Case summary + recipients | `notified`, `recipients[]`, `subject`, `sentAt` |
| 7 | Manual Review Queue | — | **Mocked** | Case + queue name | `decision`, `reviewer`, `decidedAt` |
| 8 | Update Pega Case | — | **Mocked** | `caseId`, outcome, audit trail | `caseStatus`, `outcome`, `auditTrailWritten` |
| 9 | Workflow Complete | — | Computed | — | `finalOutcome`, `completedAt` |

Two of nine steps have a real API today. The mocked seven are simulated in the browser and are
labelled **Simulated** on screen so an operations user never mistakes them for real records.

---

## The two real APIs

Both are live on AWS and unchanged by this work.

### `POST /pop/api/exposure-decision`

```json
{
  "caseId": "EXP-30412",
  "exceptionType": "Credit Exposure",
  "limits": { "dLimitValue": 50000, "cLimitValue": 450000, "tempValue": 25000, "exposureValue": 550000 },
  "transactions": [{ "type": "Credit", "tc": "27", "amount": 180000 }]
}
```

Returns `limitBreached` (`YES` / `NO` / `INSUFFICIENT_DATA`), a `recommendation` of `APPROVE` or
`ROUTE-UW` (never `REJECT` — rejection is a human-only outcome), `confidence`, and a plain-language
`rationale`. Missing business data comes back as `INSUFFICIENT_DATA` with `missingDataFields`, not
as an error.

### `POST /pop/api/threshold-determination`

Same payload, but the full `limits` block is mandatory — an incomplete payload is a `400`.

Returns `determination` (`EQUALS_LIMIT` / `BELOW_THRESHOLD` / `EXCEEDS_THRESHOLD`) and `route`
(`HUMAN_REVIEW` / `AUTO_CLOSE_BELOW_THRESHOLD` / `RBOPCG_ESCALATION`).

---

## What the orchestrator team needs to expose

The UI polls a workflow service. Implement these three endpoints returning the `WorkflowRun` shape
and the UI needs no changes:

```
POST /workflows        -> WorkflowRun     start a run
GET  /workflows/:id    -> WorkflowRun     current status (polled roughly once per second)
GET  /workflows        -> WorkflowRun[]   recent runs, newest first
```

A ready-to-use client already exists at
[`web/src/services/HttpWorkflowService.ts`](../web/src/services/HttpWorkflowService.ts). Switching
over is one line in `web/src/App.tsx`:

```ts
// from
const service = useMemo(() => new MockWorkflowService(), []);
// to
const service = useMemo(() => new HttpWorkflowService(import.meta.env.VITE_ORCHESTRATOR_URL), []);
```

### Contract notes

- `nodes[].status` must be one of `pending` / `running` / `success` / `failed` / `waiting`.
  `waiting` renders as "Waiting for Review" and is meant for human-in-the-loop pauses.
- `nodes[].source` must be `live` or `simulated`. The UI badges every step accordingly — keep
  reporting `simulated` for steps still backed by stubs.
- `startedAt` / `completedAt` are ISO-8601 strings, or `null` when not applicable.
- `summary` is one short sentence shown on the collapsed card; `response` is the full payload shown
  when a user expands the step. Keep `summary` free of engineering vocabulary.
- Polling is deliberate. The backend runs on Lambda behind API Gateway, which cannot hold open a
  websocket or server-sent-events connection.

---

## Intended end-state architecture

```
Pega / queue trigger
      ↓
POP Orchestrator            ← to be built (LangGraph or equivalent)
      ↓
POP APIs                    ← exists today: exposure-decision, threshold-determination
      ↓
Legacy systems              ← PayPlus, ACH/account lookup (not yet integrated)
      ↓
Workflow status             ← this UI, polling GET /workflows/:id
```

A message broker (Kafka, EventBridge, or SQS) may sit between the trigger and the orchestrator
later. Nothing in this repository depends on one today, and none is installed.
