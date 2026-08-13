# Provenward Roadmap

High-level milestones for Provenward. Issues are tracked on GitHub with the
labels `good-first-issue`, `bug`, `feature`, `docs`, and `testing`; scoped
sprints are posted for contributors. Status reflects the current `main`.

## Near-term

- [ ] **Open verification for unregistered batches** — allow consumers to scan
      a batch ID that no manufacturer has registered and get a clear
      `unregistered` state instead of a bare not-found, improving UX for
      pre-launch and small batches.
- [ ] **Admin batch/recall UI** — finish wallet-signed batch registration and
      recall issuance from the dashboard with confirmation + transaction
      history (currently exercised end-to-end in `frontend/src/lib/contract.ts`
      and `contract/src/contract.rs`).
- [ ] **Notification hardening** — support SMTP retries, webhook signing, and
      digest emails for opted-in owners; add delivery metrics.
- [ ] **Indexer reliability** — checkpointed cursor, backfill resume, and
      handling of ledger reorgs to guarantee Postgres mirrors the contract.

## Mid-term

- [ ] **SEP-8 tokenized authenticity** — represent high-value units as
      authenticated assets so secondary-market checks can be automated.
- [ ] **Transparency dashboards** — per-brand verification analytics with
      privacy-preserving aggregates (counts only, no per-scan serials).
- [ ] **Multi-network support** — run the same contract/backend on Futurenet and
      Public networks from one config; automated deploy checks.
- [ ] **Public indexer + notifier offering** — operate hosted indexing and
      alerting so small manufacturers need no infrastructure.

## Longer-term

- [ ] **Standards** — propose batch-ID/serial verification as an open standard
      for the Stellar ecosystem and integrate with other registry dapps.
- [ ] **DAO-managed governance** — let the community govern registry
      parameters (fees, dispute handling) on-chain.

Contributors: pick any unchecked item and open a PR; the corresponding GitHub
issue will carry the scope and acceptance criteria.
