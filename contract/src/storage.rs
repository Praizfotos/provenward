use soroban_sdk::{Address, BytesN, Env, Symbol, Vec};

use crate::types::{Batch, Manufacturer, OwnershipReceipt, Recall};

/// Below this remaining TTL (in ledgers) an entry is bumped to `TTL_EXTEND_TO`.
pub const TTL_THRESHOLD: u32 = 5_000;

/// Entries are kept alive for up to this many ledgers (~5 years at 5s/ledger).
/// Persistent entries are clamped to the network's `max_live_until`, so a
/// generous value is safe here.
pub const TTL_EXTEND_TO: u32 = 31_536_000;

fn sym(env: &Env, name: &str) -> Symbol {
    Symbol::new(env, name)
}

fn bump_instance(env: &Env) {
    env.storage()
        .instance()
        .extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

// ---------------------------------------------------------------------------
// Instance storage: admin + id counters
// ---------------------------------------------------------------------------

pub fn read_admin(env: &Env) -> Option<Address> {
    let value: Option<Address> = env.storage().instance().get(&sym(env, "admin"));
    if value.is_some() {
        bump_instance(env);
    }
    value
}

pub fn write_admin(env: &Env, admin: &Address) {
    env.storage().instance().set(&sym(env, "admin"), admin);
    bump_instance(env);
}

pub fn read_next_manufacturer_id(env: &Env) -> u64 {
    let value: Option<u64> = env
        .storage()
        .instance()
        .get(&sym(env, "next_manufacturer_id"));
    if value.is_some() {
        bump_instance(env);
    }
    value.unwrap_or(0)
}

pub fn write_next_manufacturer_id(env: &Env, id: u64) {
    env.storage()
        .instance()
        .set(&sym(env, "next_manufacturer_id"), &id);
    bump_instance(env);
}

pub fn read_next_recall_id(env: &Env) -> u64 {
    let value: Option<u64> = env.storage().instance().get(&sym(env, "next_recall_id"));
    if value.is_some() {
        bump_instance(env);
    }
    value.unwrap_or(0)
}

pub fn write_next_recall_id(env: &Env, id: u64) {
    env.storage()
        .instance()
        .set(&sym(env, "next_recall_id"), &id);
    bump_instance(env);
}

// ---------------------------------------------------------------------------
// Persistent storage
// ---------------------------------------------------------------------------

pub fn read_manufacturer(env: &Env, id: u64) -> Option<Manufacturer> {
    let key = (sym(env, "manufacturer"), id);
    let value: Option<Manufacturer> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_manufacturer(env: &Env, manufacturer: &Manufacturer) {
    let key = (sym(env, "manufacturer"), manufacturer.id);
    env.storage().persistent().set(&key, manufacturer);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_manufacturer_id_by_address(env: &Env, address: &Address) -> Option<u64> {
    let key = (sym(env, "manufacturer_by_addr"), address.clone());
    let value: Option<u64> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_manufacturer_id_by_address(env: &Env, address: &Address, id: u64) {
    let key = (sym(env, "manufacturer_by_addr"), address.clone());
    env.storage().persistent().set(&key, &id);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_manufacturer_ids(env: &Env) -> Option<Vec<u64>> {
    let key = sym(env, "manufacturer_ids");
    let value: Option<Vec<u64>> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_manufacturer_ids(env: &Env, ids: &Vec<u64>) {
    let key = sym(env, "manufacturer_ids");
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_batch(env: &Env, batch_id: &BytesN<32>) -> Option<Batch> {
    let key = (sym(env, "batch"), batch_id.clone());
    let value: Option<Batch> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_batch(env: &Env, batch: &Batch) {
    let key = (sym(env, "batch"), batch.id.clone());
    env.storage().persistent().set(&key, batch);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_all_batch_ids(env: &Env) -> Option<Vec<BytesN<32>>> {
    let key = sym(env, "all_batch_ids");
    let value: Option<Vec<BytesN<32>>> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_all_batch_ids(env: &Env, ids: &Vec<BytesN<32>>) {
    let key = sym(env, "all_batch_ids");
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_batch_ids_by_manufacturer(env: &Env, manufacturer_id: u64) -> Option<Vec<BytesN<32>>> {
    let key = (sym(env, "batch_ids_by_manufacturer"), manufacturer_id);
    let value: Option<Vec<BytesN<32>>> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_batch_ids_by_manufacturer(env: &Env, manufacturer_id: u64, ids: &Vec<BytesN<32>>) {
    let key = (sym(env, "batch_ids_by_manufacturer"), manufacturer_id);
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_recall(env: &Env, id: u64) -> Option<Recall> {
    let key = (sym(env, "recall"), id);
    let value: Option<Recall> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_recall(env: &Env, recall: &Recall) {
    let key = (sym(env, "recall"), recall.id);
    env.storage().persistent().set(&key, recall);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_recall_ids_by_batch(env: &Env, batch_id: &BytesN<32>) -> Option<Vec<u64>> {
    let key = (sym(env, "recall_ids_by_batch"), batch_id.clone());
    let value: Option<Vec<u64>> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_recall_ids_by_batch(env: &Env, batch_id: &BytesN<32>, ids: &Vec<u64>) {
    let key = (sym(env, "recall_ids_by_batch"), batch_id.clone());
    env.storage().persistent().set(&key, ids);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

pub fn read_owner_receipts(env: &Env, owner: &Address) -> Option<Vec<OwnershipReceipt>> {
    let key = (sym(env, "owner_receipts"), owner.clone());
    let value: Option<Vec<OwnershipReceipt>> = env.storage().persistent().get(&key);
    if value.is_some() {
        env.storage()
            .persistent()
            .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

pub fn write_owner_receipts(env: &Env, owner: &Address, receipts: &Vec<OwnershipReceipt>) {
    let key = (sym(env, "owner_receipts"), owner.clone());
    env.storage().persistent().set(&key, receipts);
    env.storage()
        .persistent()
        .extend_ttl(&key, TTL_THRESHOLD, TTL_EXTEND_TO);
}
