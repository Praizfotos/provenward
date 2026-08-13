# Contributing

Thanks for helping with Provenward. This guide covers the conventions we
follow.

## Development setup

- **Contract** — Rust with Soroban SDK 27. Build/test:
  ```sh
  cd contract
  cargo test                 # 21 unit tests
  cargo clippy --lib --tests -- -D warnings
  cargo build --release --target wasm32v1-none
  ```
- **Backend** — Node.js + TypeScript (strict), Express, Prisma, Jest:
  ```sh
  cd backend
  npm install
  npx prisma generate
  npm run lint && npm run typecheck && npm test
  ```
- **Frontend** — Next.js 14, TypeScript, Tailwind:
  ```sh
  cd frontend
  npm install
  npm run lint && npm run typecheck && npm run build
  ```

## Conventions

- **TypeScript strict everywhere.** No `any` unless there is no safe
  alternative; prefer discriminated unions over status strings where shape
  varies (see `src/scval.ts`).
- **Contract changes** must keep `cargo clippy -- -D warnings` clean and add
  unit tests in `contract/src/contract.rs`. Changes to return types or events
  must be mirrored in `backend/src/scval.ts` and its tests.
- **BigInt serialization.** On-chain u64 values are returned from the API as
  strings (or `0x`-prefixed hex for 32-byte batch ids) to avoid JS precision
  loss — never as bare numbers.
- **Privacy budget.** Do not add endpoints that expose per-scan serials or
  raw (unmasked) contact details. Analytics stays count-only.
- **SEP-53 signatures** for alert preferences must stay byte-identical between
  `frontend/src/lib/wallet.ts` and `backend/src/services/alertService.ts`; any
  change is a breaking change and needs a version bump in the message.
- **No secrets in code.** Everything configurable lives in env files with
  `.env.example` templates. `deployments/*.json` is gitignored.
- Keep CI green: the workflow runs contract clippy/tests, backend
  lint/typecheck/test, and frontend lint/typecheck/build.

## Branches & PRs

- Create a branch per feature, keep commits focused.
- Write a test for any behavior change (Jest for backend, contract tests for
  the wasm).
- Before opening a PR, run the full verification commands above locally.

## Project structure

```
contract/src/   contract.rs (interface + logic), storage.rs, types.rs
backend/src/    routes/ (HTTP), services/ (logic), scval.ts (XDR decoding)
frontend/src/   app/ (pages), lib/ (contract, wallet, api clients), components/
scripts/        deploy-testnet.mjs
docs/           architecture, API, security, deployment
```
