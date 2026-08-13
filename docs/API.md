# Provenward API

Base URL for the backend is `http://<host>:3001`. The Next.js frontend exposes
the same paths under `/api/backend` when served from the browser.

All responses are JSON. Errors use `{ "error": string, "message": string }`.

## `GET /health`

Liveness/readiness. Checks the Postgres connection.

```json
{ "status": "ok", "db": true, "contractId": "CC…", "rpc": "https://…" }
```

## `GET /api/verify/:batchId/:serial`

Verify a product and get recalls affecting it.

- `batchId` — 32-byte hex, `0x` prefix optional.
- `serial` — non-negative decimal integer (≤ u64 max).

```json
{
  "result": {
    "status": "genuine",
    "details": { "manufacturer": "G…", "productName": "Acme Widget", "manufacturedDate": "1720000000" }
  },
  "recalls": [
    {
      "id": 1,
      "batchId": "0xab…",
      "manufacturer": "G…",
      "severity": "Critical",
      "messageHash": "0xcd…",
      "affectedSerialStart": "10",
      "affectedSerialEnd": "20",
      "issuedAt": "1720000000"
    }
  ],
  "cached": true
}
```

`status` is one of `genuine`, `not_found`, `out_of_range`. BigInt fields
(`manufacturedDate`, `affectedSerialStart/End`, `issuedAt`) are serialized as
strings to avoid precision loss. `cached` reflects the TTL cache.

## `GET /api/recalls?batchId=…`

List recalls for a batch (not filtered by serial).

```json
{
  "batchId": "0xab…",
  "recalls": [ /* same shape as above */ ],
  "summary": { "count": 1, "critical": 1, "warning": 0, "info": 0 }
}
```

## `GET /api/manufacturers`

List registered manufacturers.

```json
{ "manufacturers": [ { "id": 1, "address": "G…", "name": "Acme Corp", "registeredAt": 1720000000 } ] }
```

## `GET /api/manufacturers/:id/batches`

List a manufacturer's batches with recall counts.

```json
{
  "manufacturer": { "id": 1, "address": "G…", "name": "Acme Corp" },
  "batches": [
    {
      "batchId": "0xab…",
      "productName": "Acme Widget",
      "serialRangeStart": "1",
      "serialRangeEnd": "100",
      "manufacturedDate": 1720000000,
      "recallCount": 1
    }
  ]
}
```

## `GET /api/manufacturers/:id/analytics`

Aggregate scan and recall statistics. Only counts are returned — never
individual scan serials (privacy).

```json
{
  "manufacturerId": 1,
  "totalBatches": 1,
  "totalScans": 50,
  "genuineScans": 48,
  "nonGenuineScans": 2,
  "totalRecalls": 1,
  "criticalRecalls": 1
}
```

## `GET /api/alert-preferences/:owner`

Read alert preferences (masked). `owner` is a Stellar `G…` address.

```json
{ "owner": "G…", "active": true, "email": "a****@example.com", "webhookEnabled": false }
```

## `POST /api/alert-preferences`

Create or update alert preferences. `signature` must be a Freighter
SEP-53 signature over:

```
provenward:alert-preferences:1:<owner>:<email or "">:<webhookUrl or "">
```

```json
{
  "owner": "G…",
  "email": "alice@example.com",
  "webhookUrl": null,
  "signature": "base64…"
}
```

Response: `{ "ok": true, "prefs": { "active": true, "email": "a****@…", "webhookEnabled": false } }`.
Returns `401` if the signature fails, `400` if neither `email` nor `webhookUrl`
is provided or the owner address is invalid.

## Notes

- The backend is read-mostly; it never submits transactions. Writing data is
  done by calling the contract directly (see `frontend/src/lib/contract.ts`).
- Verification falls back to the indexed database copy of the batch when the
  Soroban RPC is unreachable (see `verifyService.ts`).
