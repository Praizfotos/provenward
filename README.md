# Provenward

Manufacturer-agnostic, on-chain product **authenticity & recall registry**.

Provenward lets consumers verify that a product is genuine and check for active
recalls by entering a **batch ID + serial number** — with no app, no account, and
no personal data required. Registration, batch management, and recall issuance
happen on a Soroban smart contract; a backend indexes the chain into Postgres
for fast lookups, dashboard analytics, and opt-in recall notifications.

## What makes Provenward different

- **Manufacturer-agnostic.** No central authority owns the registry. Any
  manufacturer can register themselves and manage their own batches; the
  contract enforces that only a batch's manufacturer can recall it.
- **Verification is free and anonymous.** `verify_serial` is a read-only,
  simulated contract call — no fees, no wallet, no personal data. The consumer
  only needs the batch ID and serial printed on the product.
- **Privacy by design.** Only Stellar addresses and batch metadata live
  on-chain. PII (email, webhooks) is opt-in, stored off-chain, and can be
  withdrawn. Ownership receipts store only the address of the owner — never a
  name.
- **Censorship-resistant recalls.** A recall notice is a first-class, on-chain
  data structure with a severity and an affected serial range. It is readable
  by anyone, forever.
- **Verifiable without trust.** The backend is a convenience layer. A consumer
  (or a third party) can query the contract directly through the Soroban RPC.

## Repository layout

```
contract/    Soroban smart contract (Rust, Soroban SDK 27)
backend/     Express + Prisma API, chain indexer, and notifier
frontend/    Next.js app (consumer verification + manufacturer dashboard)
scripts/     Testnet/standalone deployment tooling
docker/      Container images and compose definitions
docs/        Architecture, API, security, deployment, contribution guides
.github/     CI workflow
```

## Quick start

### 1. Deploy the contract

```sh
# from contract/
cargo build --release --target wasm32v1-none

# from scripts/
npm install
node deploy-testnet.mjs --secret S...   # fund the account with friendbot first
```

The script uploads the wasm, creates the contract instance, runs
`initialize(admin)`, and writes the contract ID to `deployments/testnet.json`.

### 2. Run the backend

```sh
# from backend/
cp .env.example .env          # set CONTRACT_ID to the deployed address
npm install
npx prisma migrate deploy
npm run dev                   # API on :3001
npm run indexer               # separate process; streams contract events into Postgres
npm run notifier              # separate process; sends opt-in recall alerts
```

### 3. Run the frontend

```sh
# from frontend/
cp .env.example .env.local    # NEXT_PUBLIC_CONTRACT_ID must match
npm install
npm run dev                   # http://localhost:3000
```

### 4. Verify a product

Visit `http://localhost:3000/verify/<batchId>/<serial>` — a consumer can type
(or scan) the batch ID and serial printed on the product. The page shows
genuine/not-found/out-of-range status plus any active recalls for that batch.

## Documented elsewhere

- **Architecture** — `docs/ARCHITECTURE.md`
- **REST API reference** — `docs/API.md`
- **Security & privacy model** — `docs/SECURITY.md`
- **Deploying to Testnet/mainnet** — `docs/DEPLOYMENT.md`
- **Contributing** — `docs/CONTRIBUTING.md`
- **Release notes** — `CHANGELOG.md`

## License

MIT — see `LICENSE`.
