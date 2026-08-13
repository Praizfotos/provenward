#[cfg(test)]
use soroban_sdk::Vec;
use soroban_sdk::{contractevent, contracttype, Address, BytesN, Env, String, Symbol};

/// Severity levels for a recall or safety alert, ordered by increasing urgency.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum Severity {
    Info,
    Warning,
    Critical,
}

impl Severity {
    /// Symbol form used as an event topic for simple off-chain parsing.
    pub fn to_symbol(&self, env: &Env) -> Symbol {
        match self {
            Severity::Info => Symbol::new(env, "Info"),
            Severity::Warning => Symbol::new(env, "Warning"),
            Severity::Critical => Symbol::new(env, "Critical"),
        }
    }
}

/// A registered manufacturer. `id` is the stable, monotonic on-chain identifier.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Manufacturer {
    pub id: u64,
    pub address: Address,
    pub name: String,
    pub registered_at: u64,
}

/// A registered production batch owned by exactly one manufacturer.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Batch {
    pub id: BytesN<32>,
    pub manufacturer_id: u64,
    pub manufacturer: Address,
    pub product_name: String,
    pub serial_range_start: u64,
    pub serial_range_end: u64,
    pub manufactured_date: u64,
    pub registered_at: u64,
}

/// A recall / safety alert scoped to a serial sub-range of a single batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Recall {
    pub id: u64,
    pub batch_id: BytesN<32>,
    pub manufacturer: Address,
    pub severity: Severity,
    /// Hash (e.g. SHA-256) of the off-chain recall detail document.
    pub message_hash: BytesN<32>,
    pub affected_serial_start: u64,
    pub affected_serial_end: u64,
    pub issued_at: u64,
}

/// A consumer's proof that they own a specific serial.
///
/// **Privacy invariant: this structure contains no personally identifiable
/// information.** It deliberately holds only the batch identifier, the serial
/// number, and a timestamp. The owning caller's `Address` is the storage map
/// key and is the only on-chain record linking a person to a purchase. No
/// name, email, phone number, or physical address is ever stored on-chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipReceipt {
    pub batch_id: BytesN<32>,
    pub serial_number: u64,
    pub registered_at: u64,
}

/// Details returned when a serial verifies as genuine.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct GenuineDetails {
    pub manufacturer: Address,
    pub product_name: String,
    pub manufactured_date: u64,
}

/// Public, auth-free result of a serial verification.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub enum VerificationResult {
    Genuine(GenuineDetails),
    /// The batch identifier is not registered with any manufacturer.
    Unregistered,
    OutOfRange,
}

/// True when the closed range `[a_start, a_end]` overlaps `[b_start, b_end]`.
pub fn ranges_overlap(a_start: u64, a_end: u64, b_start: u64, b_end: u64) -> bool {
    a_start <= b_end && b_start <= a_end
}

/// True when `serial` falls inside the closed range `[start, end]`.
pub fn serial_in_range(serial: u64, start: u64, end: u64) -> bool {
    serial >= start && serial <= end
}

/// Filter a list of recalls to a single severity level. Test/off-chain helper.
#[cfg(test)]
pub fn filter_recalls_by_severity(
    env: &Env,
    recalls: Vec<Recall>,
    severity: Severity,
) -> Vec<Recall> {
    let mut filtered = Vec::new(env);
    for recall in recalls.iter() {
        if recall.severity == severity {
            filtered.push_back(recall);
        }
    }
    filtered
}

/// True when any recall in `recalls` is more severe than (or equal to) `min_severity`.
///
/// Severity ordering is `Info < Warning < Critical`. Test/off-chain helper.
#[cfg(test)]
pub fn has_recall_at_least(recalls: Vec<Recall>, min_severity: Severity) -> bool {
    let threshold = severity_rank(&min_severity);
    for recall in recalls.iter() {
        if severity_rank(&recall.severity) >= threshold {
            return true;
        }
    }
    false
}

#[cfg(test)]
fn severity_rank(severity: &Severity) -> u8 {
    match severity {
        Severity::Info => 0,
        Severity::Warning => 1,
        Severity::Critical => 2,
    }
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

/// Emitted when the admin onboards a new manufacturer.
#[contractevent(topics = ["ManufacturerRegistered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ManufacturerRegisteredEvent {
    #[topic]
    pub manufacturer: Address,
    #[topic]
    pub manufacturer_id: u64,
    pub name: String,
}

/// Emitted when a manufacturer registers a new production batch.
#[contractevent(topics = ["BatchRegistered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchRegisteredEvent {
    #[topic]
    pub manufacturer: Address,
    #[topic]
    pub batch_id: BytesN<32>,
    pub product_name: String,
    pub serial_range_start: u64,
    pub serial_range_end: u64,
    pub manufactured_date: u64,
}

/// Emitted when a manufacturer issues a recall against a batch.
#[contractevent(topics = ["RecallIssued"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RecallIssuedEvent {
    #[topic]
    pub batch_id: BytesN<32>,
    #[topic]
    pub recall_id: u64,
    #[topic]
    pub severity: Symbol,
    #[topic]
    pub manufacturer: Address,
    pub message_hash: BytesN<32>,
    pub affected_serial_start: u64,
    pub affected_serial_end: u64,
}

/// Emitted when a consumer registers ownership of a serial. The `owner` topic
/// is the caller's wallet `Address` — never a name, email, or other PII.
#[contractevent(topics = ["OwnershipRegistered"])]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OwnershipRegisteredEvent {
    #[topic]
    pub owner: Address,
    #[topic]
    pub batch_id: BytesN<32>,
    pub serial_number: u64,
}
