# Provenward Architecture

## System overview

```
                         ┌────────────────────────────┐
                         │      Soroban contract      │
                         │   (provenward.wasm, v27)   │
                         └─────────────┬──────────────┘
                                       │  Soroban RPC
        ┌──────────────┬───────────────┼──────────────┐
        │              │               │              │
   consumer       manufacturer    backend API    indexer
   (frontend/     (frontend/     (Express)       (reads contract
    verify page)   dashboard)     read-only via   events, writes
        │              │          simulateRPC)    to Postgres)
        │              │               │              │
        │              │               └──────►  Postgres
        │              │                          (analytics)
        │              ▼
        └───►  backend API  (verify + recalls, cached)
```

Components:

| Process     | Responsibility                                                        |
| ----------- | --------------------------------------------------------------------- |
| Contract    | Source of truth. Registers manufacturers, batches, recalls, receipts. |
| Backend API | Serves verification/recall/manufacturer/alert endpoints (read-mostly).|
| Indexer     | Long-running worker that ingests contract events into Postgres.       |
| Notifier    | Long-running worker that sends opt-in email/webhook recall alerts.    |
| Frontend    | Consumer verification page + manufacturer dashboard.                  |
| Postgres    | Off-chain cache/index for dashboard analytics and alert preferences.  |

## Contract layer

See `contract/src/contract.rs`. State lives in contract storage:

- `manufacturers` — map from on-chain id to `{ address, name, active }`
- `manufacturer_address_to_id` — address → id lookup
- `batches` — map from `batch_id` (BytesN<32>) to `{ manufacturer, product_name,
  serial_range_start, serial_range_end, manufactured_date, active }`
- `manufacturer_batches` — manufacturer address → list of batch ids
- `recalls` — map from `(batch_id, recall_id)` to `Recall`
- `batch_recalls` — batch_id → list of recall ids
- `ownership_receipts` — map from `(batch_id, serial)` to owner address
- `next_manufacturer_id`, `next_recall_id` — counters
- `admin` — bootstrap address

Public entry points: `initialize`, `register_manufacturer`, `register_batch`,
`verify_serial`, `issue_recall`, `get_recalls_for_batch`, `get_my_recalls`,
`register_ownership_receipt`, plus read helpers (`get_manufacturers`,
`get_batches`, `get_batch`, `get_batches_for_manufacturer`,
`get_manufacturer`, `get_manufacturer_id`).

Verification logic (`verify_serial`) is intentionally simple and cheap: it
resolves the batch, checks the serial against the range, and returns
`Genuine(details)`, `NotFound`, or `OutOfRange`. No external data, no oracles.

### Events

State transitions emit contract events that the indexer subscribes to:

- `ManufacturerRegistered(manufacturer, manufacturer_id)`
- `BatchRegistered(manufacturer, batch_id)`
- `RecallIssued(batch_id, recall_id, severity, manufacturer)`
- `OwnershipRegistered(owner, batch_id, serial_number)`

## Backend layer

`backend/src/`:

- `app.ts` — Express wiring. Mounts the routers; JSON body limit 64kb; no
  `x-powered-by`; pino request logging (health excluded).
- `config.ts` — zod-validated environment configuration; exits on invalid env.
- `services/contract.ts` — `ProvenwardContract`, a **read-only** client. Every
  call is a simulated invoke-host-function transaction (no submission, no
  fees). Only used by verify/recall routes.
- `services/verifyService.ts` — verification with an indexed-DB fallback when
  RPC is unreachable.
- `services/recallService.ts` — recall lookup + severity summarization.
- `services/alertService.ts` — SEP-53 signature verification and email masking.
- `services/cache.ts` — tiny TTL cache for verification results.
- `services/delivery.ts` — email (nodemailer) and webhook delivery.
- `routes/` — HTTP handlers (see `docs/API.md`).
- `scval.ts` — XDR ScVal ⇄ typed-JS decoding for verification results, recalls,
  and contract events.
- `indexer.ts` — polls Soroban RPC for events starting at
  `INDEXER_START_LEDGER`, upserts manufacturers/batches/recalls/receipts.
- `notifier.ts` — polls for new recalls and alerts opted-in owners.

Backend responsibilities are deliberately thin: it never submits transactions
and holds no funds. On-chain correctness never depends on it.

## Frontend layer

`frontend/src/lib/`:

- `constants.ts` — `NEXT_PUBLIC_*` contract/RPC/network settings.
- `wallet.ts` — Freighter v6 helpers (`getAddress`, `signMessage`). Message
  signatures follow SEP-53 and must byte-match `buildMessage` in the backend.
- `contract.ts` — `invoke()` (build → simulate → sign via Freighter → submit)
  for `register_batch`, `issue_recall`, `register_ownership_receipt`; and
  `simulateRead()` for the dashboard's `get_manufacturer_id` /
  `get_batches_for_manufacturer`.
- `api.ts` — typed backend client. In the browser it calls the same-origin
  `/api/backend` proxy; on the server it calls `BACKEND_URL` directly.

Pages: `/` (landing), `/verify/[batchId]/[serial]` (server-rendered
verification), `/register` (manufacturer onboarding), `/dashboard`
(manufacturer analytics + management).

## Data flow: verification

1. Consumer submits `GET /api/verify/:batchId/:serial`.
2. Backend calls `verify_serial` against the contract (simulated read).
3. If RPC is unavailable, `verifyService` falls back to the indexed DB copy.
4. Recalls for the batch (filtered to the serial range) are fetched from the
   contract via `get_recalls_for_batch`.
5. Result is cached for `VERIFY_CACHE_TTL_MS`; a `VerificationScan` row is
   written best-effort for analytics.

## Deployment topology

See `docker-compose.yml`: `postgres`, `migrate` (one-shot), `backend`,
`indexer`, `notifier`, and `frontend` (standalone Next.js). See
`docs/DEPLOYMENT.md`.
