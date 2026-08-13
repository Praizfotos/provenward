# Changelog

All notable changes to Provenward are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Soroban smart contract (`contract/`): manufacturer registration, batch
  registration, serial verification, recall issuance, recall queries, and
  ownership receipts on Soroban SDK 27 (wasm32v1-none). 21 unit tests.
- Backend API (`backend/`): Express + Prisma + stellar-sdk 13. Read-only
  verification with an indexed-DB fallback, recalls, manufacturers, batches,
  count-only analytics, and SEP-53-authenticated alert preferences. 28 Jest
  unit tests.
- Chain indexer: polls Soroban RPC and upserts contract events into Postgres.
- Notifier: sends opt-in email/webhook alerts for new recalls.
- Frontend (`frontend/`): Next.js 14 app with anonymous consumer verification
  (`/verify/[batchId]/[serial]`), manufacturer registration, and a dashboard
  driven by Freighter v6 wallet signatures and simulated reads.
- Deployment tooling (`scripts/deploy-testnet.mjs`): uploads wasm, creates the
  contract instance, initializes the admin, and writes `deployments/testnet.json`.
- Docker Compose stack (Postgres + migrate + backend + indexer + notifier +
  frontend) and CI workflow (contract clippy/tests, backend, frontend).
- Documentation: architecture, REST API reference, security model, deployment,
  and contributing guides.

### Changed
- Alert preference signing migrated from SEP-35 to **SEP-53** (Freighter v6
  `signMessage` standard) in `alertService.ts`, with the contract-required
  message prefix `Stellar Signed Message:\n`.
- Analytics endpoint reduced to aggregate counts only (no per-scan serials) to
  preserve consumer privacy.

### Notes
- Contract and backend are verified for testnet deployments. Docker images
  have not been built locally (no Docker daemon on the development machine);
  build them on a Docker host per `docs/DEPLOYMENT.md`.
