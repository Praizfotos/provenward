# Deployment

## Prerequisites

- Rust toolchain with the `wasm32v1-none` target (Soroban SDK 27 requires it):
  ```sh
  rustup target add wasm32v1-none
  ```
- Node.js ≥ 20 (verified on 22).
- Docker + Docker Compose (for the full stack) — note: images have not been
  built on a machine without the Docker daemon; build them on a Docker host.
- A funded Stellar account on the target network. For Testnet, use
  [Friendbot](https://friendbot.stellar.org) or the
  [Stellar lab](https://lab.stellar.org) to fund a freshly generated account.

## 1. Build the contract

```sh
cd contract
cargo build --release --target wasm32v1-none
```

Artifact: `contract/target/wasm32v1-none/release/provenward.wasm`.

## 2. Deploy to Testnet

```sh
cd scripts
npm install
node deploy-testnet.mjs --secret <DEPLOYER_SECRET> \
  --admin <G… or default=deployer> \
  --rpc-url https://soroban-testnet.stellar.org:443 \
  --network-passphrase "Test SDF Network ; September 2015"
```

The script:

1. Uploads the wasm blob.
2. Creates the contract instance with a random salt.
3. Reads the new contract address from the create simulation.
4. Submits `initialize(admin)`.
5. Writes `deployments/testnet.json` (gitignored) and prints the env values.

Environment variables work too: `DEPLOY_SECRET`, `CONTRACT_WASM`,
`ADMIN_ADDRESS`, `SOROBAN_RPC_URL`, `STELLAR_NETWORK_PASSPHRASE`.

> **Note on signatures:** the script signs transactions server-side with the
> deployer key (`Keypair`). The browser-facing flow instead signs with the
> Freighter wallet (`signTransaction` + `TransactionBuilder.fromXDR`). Both
> produce the same transaction format.

### Local standalone / quicknet

The script also supports a local node:
`npm run deploy:standalone -- --secret S… --admin G…` (defaults to
`http://localhost:8000`, passphrase `Standalone Network ; February 2017`).

## 3. Configure environment

Copy the printed `CONTRACT_ID` into each of:

- `.env` (root, docker-compose)
- `backend/.env` (must match; the API exits without it)
- `frontend/.env.local` (`NEXT_PUBLIC_CONTRACT_ID`)

The placeholder `CCXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX` is *not*
a valid contract id — a deployment will fail to read/simulate against it.

## 4. Run the full stack with Docker Compose

```sh
cp .env.example .env   # fill CONTRACT_ID, secrets
docker compose up --build -d
```

Services: `postgres`, `migrate` (one-shot `prisma migrate deploy`), `backend`
(:3001), `indexer`, `notifier`, `frontend` (:3000).

> The compose `migrate` service runs against `DATABASE_URL`; the schema is the
> migration in `backend/prisma/migrations`.

## 5. Run without Docker (local dev)

```sh
# backend
cd backend
cp .env.example .env            # set CONTRACT_ID, DATABASE_URL
npx prisma migrate deploy
npm run dev                     # API
npm run indexer                 # event ingestion
npm run notifier                # recall alerts

# frontend
cd frontend
cp .env.example .env.local
npm run dev
```

## 6. Indexer backfill

Set `INDEXER_START_LEDGER` to the ledger at which the contract was created (the
deploy script reports the ledger) or leave at `0` to start from the earliest
and rely on the polling window. Re-running the indexer is idempotent
(upserts).

## 7. Mainnet

Point `SOROBAN_RPC_URL` at a mainnet RPC, set the passphrase
`Public Global Stellar Network ; September 2015`, fund a real account, and
repeat steps 1–2. Budget for real fees and ledger entry storage.

## CI

`.github/workflows/ci.yml` runs on every push: contract `cargo test` +
`clippy -D warnings`, backend build/lint/typecheck/test, frontend
build/lint/typecheck.
