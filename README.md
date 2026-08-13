# Provenward

### On-Chain Product Authenticity & Recall Registry powered by Stellar and Soroban

Provenward is a manufacturer-agnostic platform that lets any consumer prove a
product is genuine — and instantly see active recalls — using only the batch ID
and serial number printed on the product. No app, no account, no wallet, no
personal data required.

[![CI](https://github.com/Praizfotos/provenward/actions/workflows/ci.yml/badge.svg)](https://github.com/Praizfotos/provenward/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Soroban](https://img.shields.io/badge/Soroban-SDK%2027-6A5AFF.svg)](https://soroban.stellar.org)
[![Stellar](https://img.shields.io/badge/Stellar-Testnet-000000.svg)](https://stellar.org)
[![Network](https://img.shields.io/badge/RPC-Soroban%20Testnet-00c0e8.svg)](https://soroban-testnet.stellar.org:443)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](docs/CONTRIBUTING.md)

---

## The problem

Counterfeit goods are not a niche problem. They cost the global economy an
estimated half a trillion dollars a year, erode brand trust, and in regulated
industries — food, pharmaceuticals, auto parts, baby products — they put lives
at risk. At the same time, when a real defect is discovered, manufacturers
struggle to reach the people who own the affected products. Most recall
communication still relies on press releases, in-store posters, and whatever
media picks the story up; most consumers never hear about a recall at all until
it is too late.

The tools that do exist are fragmented. Traditional serial-number databases are
proprietary, siloed per brand, and run by the very companies with an incentive
to hide problems. Consumers cannot check a product from a small brand, a
grey-market import, or a resale without trusting a middleman. And even when
verification works, there is no shared, neutral place to publish a recall that a
brand cannot quietly bury.

Provenward exists to change that: **verification should be free, anonymous, and
available to every product from every manufacturer; recalls should be public,
immutable, and impossible to ignore.**

## What Provenward does

Provenward is built around five core, on-chain primitives:

| Module | What it does |
| --- | --- |
| **Manufacturer registry** | Any organization registers itself on-chain, receives a verifiable identity, and manages its own product catalog. No gatekeeper. |
| **Batch registration** | Manufacturers register production batches with a product name, manufactured date, and a serial-number range. |
| **Serial verification** | Consumers verify any `batch ID + serial` combination in milliseconds and get a definitive `genuine`, `not found`, or `out of range` result. |
| **Recall issuance** | A manufacturer issues an immutable, on-chain recall with a severity (`Info` / `Warning` / `Critical`), a message hash, and the affected serial range. |
| **Ownership receipts & alerts** | Owners can record proof-of-ownership (address-only) and opt in to email/webhook alerts so they are notified the moment a recall touches their serial. |

Because every brand plugs into the same contract, a consumer can verify a
pharmaceutical from one company and an electronics component from another with
the same flow — and a recall from any of them shows up in the same place.

## Why Stellar and Soroban

Stellar was built for exactly this job. Its settlement is cheap and fast, which
matters when a small manufacturer wants to issue a recall for a few thousand
units without paying enterprise SaaS fees, and when the registry needs to
survive on sponsorship and grants rather than per-scan tolls. Soroban brings
**programmable trust**: the rules that decide who can register a batch or recall
a product are enforced by the contract, not by a company's goodwill. Data on the
Stellar ledger is public, auditable, and permanent — which is precisely what a
recall record needs to be. And because reading is a simulated call, consumers
verify **for free, with no wallet and no fee** — an experience paper-and-Excel
registries cannot offer.

## Architecture

```
consumer (verify page) ──► Next.js frontend ──► Express/Postgres API
                              │                       │
                      Freighter wallet         Soroban RPC (simulated reads)
   manufacturer (dashboard) ─┤                       │
                              └──►  Soroban contract (source of truth)
```

- **Smart contract** — a single Soroban (Rust, SDK 27) contract owns all state:
  manufacturers, batches, recalls, ownership receipts, and the verify logic.
  Every write is `require_auth`-guarded; every read is a free simulated call.
  Written and tested in `contract/`.
- **Backend** — Node.js + TypeScript + Express + PostgreSQL (Prisma). Serves
  verification, recall, manufacturer, analytics, and alert-preference
  endpoints; runs a **chain indexer** that mirrors contract events into Postgres
  for fast lookups and dashboards, and a **notifier** that delivers opt-in
  alerts. It holds no keys and never submits transactions — it is a
  convenience layer, never the source of truth.
- **Frontend** — Next.js 14 + TypeScript + Tailwind + shadcn-style components.
  Two experiences: an anonymous consumer verification flow, and a
  manufacturer dashboard that signs on-chain writes through the Freighter
  wallet (SEP-53 signatures for preferences).

The contract is deployed with a single command; the whole stack runs locally
with Docker Compose. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detail.

## Getting started

**Prerequisites:** Rust with the `wasm32v1-none` target, Node.js ≥ 20, Docker +
Docker Compose, and a funded Stellar Testnet account.

```bash
# 1. Clone and build the contract
git clone https://github.com/Praizfotos/provenward.git
cd provenward/contract
rustup target add wasm32v1-none
cargo build --release --target wasm32v1-none

# 2. Deploy to Testnet (fund the account with Friendbot first)
cd ../scripts
npm install
node deploy-testnet.mjs --secret <DEPLOYER_SECRET>

# 3. Configure the environment with the contract ID the script prints
cp ../.env.example ../.env          # set CONTRACT_ID
cp ../backend/.env.example ../backend/.env
cp ../frontend/.env.example ../frontend/.env.local

# 4. Run the full stack
cd ..
docker compose up --build -d
# frontend → http://localhost:3000   backend → http://localhost:3001
```

Prefer running services without Docker? Instructions for running the backend,
indexer, notifier, and frontend directly are in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Project structure

```
provenward/
├── contract/          Soroban smart contract (Rust, SDK 27) — state + verify logic
│   └── src/           contract.rs (interface), storage.rs, types.rs
├── backend/           Node.js/TS/Express API, Prisma/Postgres, indexer, notifier
│   └── src/
│       ├── routes/    REST endpoints (verify, recalls, manufacturers, alerts)
│       ├── services/  contract client, verification, delivery, SEP-53 alerts
│       └── scval.ts   XDR ScVal ⇄ typed-JS decoding
├── frontend/          Next.js 14 app — consumer verify page + manufacturer dashboard
│   └── src/
│       ├── app/       pages (/verify/[...], /register, /dashboard)
│       └── lib/       contract, wallet (Freighter), API clients
├── scripts/           deploy-testnet.mjs — one-command Testnet deployment
├── docs/              architecture, API, security, deployment, contributing
├── docker/            Dockerfiles + compose stack (Postgres, API, indexer, notifier, UI)
└── .github/workflows/ CI: contract clippy/tests, backend, frontend
```

## Contributing

Contributions are welcome — code, tests, docs, and issues. Start with
[CONTRIBUTING.md](docs/CONTRIBUTING.md). Issues are labelled
`good-first-issue`, `bug`, `feature`, `docs`, and `testing` so new contributors
can find a scoped task; scoped issues are also posted for contributor sprints.

Key conventions: strict TypeScript, `cargo clippy -D warnings` for contract
changes, on-chain `u64` values returned as strings over the API, and alert
signatures kept byte-identical between `frontend/` and `backend/`.

## Roadmap

See [ROADMAP.md](ROADMAP.md). Near-term milestones:

- Product scans for batches without a registered manufacturer (open verification)
- Batch/recall admin UI with wallet-signed actions end-to-end
- SEP-8 tokenized authenticity for high-value goods
- Historical verification analytics and per-brand transparency dashboards
- Mainnet deployment and a public indexer/notifier offering

## Testing

```bash
# Contract (Soroban) — 21 tests
cd contract
cargo test
cargo clippy --lib --tests -- -D warnings

# Backend — 28 Jest unit tests (ScVal decoding, serializers, SEP-53 verification)
cd backend
npm install && npx prisma generate
npm run lint && npm run typecheck && npm test

# Frontend
cd frontend
npm install
npm run lint && npm run typecheck && npm run build
```

CI runs the contract and backend/frontend checks on every push.

## License

MIT — see [LICENSE](LICENSE).

## Acknowledgments

- **Stellar Development Foundation** for the ecosystem, funding, and Testnet
  infrastructure that make this project possible.
- The **Soroban SDK** team and contributors.
- The **Wave / Drips** programs for supporting open-source builders in the
  Stellar community.
