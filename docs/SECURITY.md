# Provenward Security & Privacy

## Threat model

Provenward stores two classes of data:

1. **On-chain (public, immutable)** — contract state written by the Soroban
   contract.
2. **Off-chain (Postgres)** — an index/cache of on-chain state plus opt-in
   notification preferences (email, webhook URL).

An attacker can read anything public. The meaningful threats are forged data,
account takeover of a manufacturer, and leaking private contact information.

## On-chain integrity

- **Sovereignty is enforced by the contract, not the backend.** Only a
  registered manufacturer address can register a batch under its own identity;
  only the batch's manufacturer can issue a recall for it. An unregistered
  caller or a different manufacturer cannot forge entries. (`contract.rs`
  checks `require_auth` on every write.)
- **Initialization is one-time.** `initialize(admin)` sets the bootstrap
  admin; the admin is the only address permitted to register the first
  manufacturer. A re-initialization or takeover of `admin` requires that
  account's private key.
- **Verification is deterministic and local to the chain.** `verify_serial`
  only reads contract storage; it depends on no off-chain oracle, so a
  compromised backend cannot change the answer a consumer gets by querying the
  chain directly.
- **Recalls are immutable once issued.** There is no "un-recall"; a correction
  is issued as a new recall with a higher id. This preserves an audit trail.

## Backend API

- Read-mostly. The backend holds **no secret keys** and **never submits**
  transactions, so a backend compromise cannot forge on-chain data.
- Input validation via zod on every route (addresses, batch-id format, u64
  serials, URL/email formats).
- `x-powered-by` disabled; structured pino logging; 404/error handlers return
  opaque JSON. Rate limiting/API keys are expected to be added at a reverse
  proxy in front of the service.

## Alert preferences (off-chain PII)

- **Opt-in only.** No email or webhook is stored unless the user submits it.
- **Authenticated by wallet signature (SEP-53).** The owner proves control of
  the Stellar address by signing the exact message
  `provenward:alert-preferences:1:<owner>:<email>:<webhookUrl>`. The backend
  verifies the ed25519 signature over the SHA-256 of
  `"Stellar Signed Message:\n" + message` (see `alertService.ts`). Only the
  address that signs can set or change its own preferences.
- **Masked on read.** Emails are returned masked (e.g. `a****@example.com`);
  webhook URLs are never returned at all — only whether one is enabled.
- **Credentials are external.** SMTP credentials and webhook URLs live in
  environment variables / a secrets manager, never in the codebase or the DB
  in plain text. Postgres secrets are supplied via env in compose, and
  `deployments/*.json` is gitignored.

## Consumer verification privacy

- **Anonymous.** Verifying a serial requires no account, no wallet, no email.
- **Analytics without PII.** The only data recorded for a scan is the batch ID,
  serial number, and outcome — never who scanned. The analytics endpoint
  returns **counts only**; per-scan serials are never exposed.
- **Ownership receipts hold only addresses.** `register_ownership_receipt`
  stores the owner's Stellar address and the serial; no name, contact detail,
  or purchase metadata. It is useful as a proof-of-ownership record without
  linking to personal identity.

## Dependencies & operations

- Keep the Soroban SDK, stellar-sdk, and framework dependencies up to date.
  CI (`.github/workflows/ci.yml`) runs `cargo clippy -D warnings` and backend
  lint/typecheck on every push.
- Deploy secrets (deployer secret key) should be provided via environment or a
  secrets manager and rotated; the deployer key can be discarded after
  deployment unless more manufacturers will be registered through it.
- The indexer/notifier run with the least privilege: database write access and
  outbound SMTP/HTTP only — no wallet keys.

## Reporting

Contact the project maintainers (see `docs/CONTRIBUTING.md`) with a
responsible-disclosure description of any vulnerability.
