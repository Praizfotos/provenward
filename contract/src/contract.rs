use soroban_sdk::{contract, contractimpl, vec, Address, BytesN, Env, String, Vec};

use crate::storage::{
    read_admin, read_all_batch_ids, read_batch, read_batch_ids_by_manufacturer, read_manufacturer,
    read_manufacturer_id_by_address, read_manufacturer_ids, read_next_manufacturer_id,
    read_next_recall_id, read_owner_receipts, read_recall, read_recall_ids_by_batch, write_admin,
    write_all_batch_ids, write_batch, write_batch_ids_by_manufacturer, write_manufacturer,
    write_manufacturer_id_by_address, write_manufacturer_ids, write_next_manufacturer_id,
    write_next_recall_id, write_owner_receipts, write_recall, write_recall_ids_by_batch,
};
use crate::types::{
    ranges_overlap, serial_in_range, Batch, BatchRegisteredEvent, GenuineDetails, Manufacturer,
    ManufacturerRegisteredEvent, OwnershipReceipt, OwnershipRegisteredEvent, Recall,
    RecallIssuedEvent, Severity, VerificationResult,
};

#[contract]
pub struct Provenward;

/// Read a persistent list value, treating a missing key as an empty list.
fn unwrap_vec<T>(env: &Env, value: Option<Vec<T>>) -> Vec<T>
where
    T: soroban_sdk::IntoVal<Env, soroban_sdk::Val> + soroban_sdk::TryFromVal<Env, soroban_sdk::Val>,
{
    match value {
        Some(value) => value,
        None => Vec::new(env),
    }
}

#[contractimpl]
impl Provenward {
    /// Set the contract admin. Callable once, by the deploying address.
    pub fn initialize(env: Env, admin: Address) {
        admin.require_auth();
        if read_admin(&env).is_some() {
            panic!("Contract already initialized");
        }
        write_admin(&env, &admin);
        write_next_manufacturer_id(&env, 1);
        write_next_recall_id(&env, 1);
        write_manufacturer_ids(&env, &vec![&env]);
        write_all_batch_ids(&env, &vec![&env]);
    }

    /// Admin-gated onboarding of a new manufacturer. Returns the manufacturer_id.
    pub fn register_manufacturer(
        env: Env,
        admin: Address,
        manufacturer: Address,
        name: String,
    ) -> u64 {
        admin.require_auth();
        if Some(admin.clone()) != read_admin(&env) {
            panic!("Only the contract admin can register manufacturers");
        }
        if name.is_empty() {
            panic!("Manufacturer name must not be empty");
        }
        if name.len() > 64 {
            panic!("Manufacturer name is too long");
        }
        if read_manufacturer_id_by_address(&env, &manufacturer).is_some() {
            panic!("Manufacturer already registered");
        }

        let id = read_next_manufacturer_id(&env);
        write_next_manufacturer_id(&env, id + 1);

        let record = Manufacturer {
            id,
            address: manufacturer.clone(),
            name: name.clone(),
            registered_at: env.ledger().timestamp(),
        };
        write_manufacturer(&env, &record);
        write_manufacturer_id_by_address(&env, &manufacturer, id);

        let mut ids = unwrap_vec(&env, read_manufacturer_ids(&env));
        ids.push_back(id);
        write_manufacturer_ids(&env, &ids);

        ManufacturerRegisteredEvent {
            manufacturer: manufacturer.clone(),
            manufacturer_id: id,
            name,
        }
        .publish(&env);

        id
    }

    /// Manufacturer registers a production batch. The manufacturer must be
    /// already onboarded and the serial range must not overlap any existing
    /// batch owned by the same manufacturer.
    pub fn register_batch(
        env: Env,
        manufacturer: Address,
        batch_id: BytesN<32>,
        product_name: String,
        serial_range_start: u64,
        serial_range_end: u64,
        manufactured_date: u64,
    ) {
        manufacturer.require_auth();

        let Some(manufacturer_id) = read_manufacturer_id_by_address(&env, &manufacturer) else {
            panic!("Manufacturer is not registered");
        };

        if batch_id == [0u8; 32] {
            panic!("batch_id must not be all zeros");
        }
        if product_name.is_empty() {
            panic!("Product name must not be empty");
        }
        if product_name.len() > 128 {
            panic!("Product name is too long");
        }
        if serial_range_end < serial_range_start {
            panic!("Serial range end must be >= start");
        }
        if manufactured_date == 0 {
            panic!("Manufactured date must be set");
        }
        if read_batch(&env, &batch_id).is_some() {
            panic!("batch_id already registered");
        }

        let existing = unwrap_vec(&env, read_batch_ids_by_manufacturer(&env, manufacturer_id));
        for existing_id in existing.iter() {
            let existing_batch = read_batch(&env, &existing_id).expect("indexed batch missing");
            if ranges_overlap(
                serial_range_start,
                serial_range_end,
                existing_batch.serial_range_start,
                existing_batch.serial_range_end,
            ) {
                panic!("Serial range overlaps an existing batch");
            }
        }

        let batch = Batch {
            id: batch_id.clone(),
            manufacturer_id,
            manufacturer: manufacturer.clone(),
            product_name: product_name.clone(),
            serial_range_start,
            serial_range_end,
            manufactured_date,
            registered_at: env.ledger().timestamp(),
        };
        write_batch(&env, &batch);

        let mut all_ids = unwrap_vec(&env, read_all_batch_ids(&env));
        all_ids.push_back(batch_id.clone());
        write_all_batch_ids(&env, &all_ids);

        let mut manufacturer_ids =
            unwrap_vec(&env, read_batch_ids_by_manufacturer(&env, manufacturer_id));
        manufacturer_ids.push_back(batch_id.clone());
        write_batch_ids_by_manufacturer(&env, manufacturer_id, &manufacturer_ids);

        BatchRegisteredEvent {
            manufacturer: manufacturer.clone(),
            batch_id: batch_id.clone(),
            product_name,
            serial_range_start,
            serial_range_end,
            manufactured_date,
        }
        .publish(&env);
    }

    /// Public, auth-free serial verification. The consumer-facing entrypoint.
    pub fn verify_serial(env: Env, batch_id: BytesN<32>, serial_number: u64) -> VerificationResult {
        let Some(batch) = read_batch(&env, &batch_id) else {
            return VerificationResult::Unregistered;
        };
        if serial_number < batch.serial_range_start || serial_number > batch.serial_range_end {
            return VerificationResult::OutOfRange;
        }
        VerificationResult::Genuine(GenuineDetails {
            manufacturer: batch.manufacturer,
            product_name: batch.product_name,
            manufactured_date: batch.manufactured_date,
        })
    }

    /// Issue a recall against a batch. Only the manufacturer that registered
    /// the batch may recall it. Returns the recall id.
    pub fn issue_recall(
        env: Env,
        manufacturer: Address,
        batch_id: BytesN<32>,
        severity: Severity,
        message: BytesN<32>,
        affected_serial_start: u64,
        affected_serial_end: u64,
    ) -> u64 {
        manufacturer.require_auth();

        let Some(batch) = read_batch(&env, &batch_id) else {
            panic!("Batch not found");
        };
        if batch.manufacturer != manufacturer {
            panic!("Only the batch manufacturer can issue recalls");
        }
        if message == [0u8; 32] {
            panic!("message hash must point to off-chain details");
        }
        if affected_serial_end < affected_serial_start {
            panic!("Affected serial range end must be >= start");
        }
        if affected_serial_start < batch.serial_range_start
            || affected_serial_end > batch.serial_range_end
        {
            panic!("Affected serial range must be within the batch serial range");
        }

        let id = read_next_recall_id(&env);
        write_next_recall_id(&env, id + 1);

        let recall = Recall {
            id,
            batch_id: batch_id.clone(),
            manufacturer: manufacturer.clone(),
            severity: severity.clone(),
            message_hash: message.clone(),
            affected_serial_start,
            affected_serial_end,
            issued_at: env.ledger().timestamp(),
        };
        write_recall(&env, &recall);

        let mut ids = unwrap_vec(&env, read_recall_ids_by_batch(&env, &batch_id));
        ids.push_back(id);
        write_recall_ids_by_batch(&env, &batch_id, &ids);

        RecallIssuedEvent {
            batch_id: batch_id.clone(),
            recall_id: id,
            severity: severity.to_symbol(&env),
            manufacturer: manufacturer.clone(),
            message_hash: message,
            affected_serial_start,
            affected_serial_end,
        }
        .publish(&env);

        id
    }

    /// Public read of all recalls issued against a batch, oldest first.
    pub fn get_recalls_for_batch(env: Env, batch_id: BytesN<32>) -> Vec<Recall> {
        let recall_ids = unwrap_vec(&env, read_recall_ids_by_batch(&env, &batch_id));
        let mut recalls = Vec::new(&env);
        for id in recall_ids.iter() {
            if let Some(recall) = read_recall(&env, id) {
                recalls.push_back(recall);
            }
        }
        recalls
    }

    /// Privacy-preserving purchase registration. Stores only the caller's
    /// Address (as the storage key) plus batch_id / serial / timestamp.
    /// No PII is ever written on-chain. The serial must belong to a registered
    /// batch.
    pub fn register_ownership_receipt(
        env: Env,
        caller: Address,
        batch_id: BytesN<32>,
        serial_number: u64,
    ) {
        caller.require_auth();

        let Some(batch) = read_batch(&env, &batch_id) else {
            panic!("Batch not found");
        };
        if !serial_in_range(
            serial_number,
            batch.serial_range_start,
            batch.serial_range_end,
        ) {
            panic!("Serial number is not in the batch range");
        }

        let mut receipts = unwrap_vec(&env, read_owner_receipts(&env, &caller));
        for receipt in receipts.iter() {
            if receipt.batch_id == batch_id && receipt.serial_number == serial_number {
                panic!("Ownership receipt already registered");
            }
        }
        receipts.push_back(OwnershipReceipt {
            batch_id: batch_id.clone(),
            serial_number,
            registered_at: env.ledger().timestamp(),
        });
        write_owner_receipts(&env, &caller, &receipts);

        OwnershipRegisteredEvent {
            owner: caller.clone(),
            batch_id: batch_id.clone(),
            serial_number,
        }
        .publish(&env);
    }

    /// Return every recall that affects a serial the caller owns. Recall data is
    /// public, so this read is auth-free. Deduplicated by recall id.
    pub fn get_my_recalls(env: Env, caller: Address) -> Vec<Recall> {
        let receipts = unwrap_vec(&env, read_owner_receipts(&env, &caller));
        let mut result = Vec::new(&env);
        for receipt in receipts.iter() {
            for recall in Self::get_recalls_for_batch(env.clone(), receipt.batch_id.clone()).iter()
            {
                if serial_in_range(
                    receipt.serial_number,
                    recall.affected_serial_start,
                    recall.affected_serial_end,
                ) && !result.contains(&recall)
                {
                    result.push_back(recall);
                }
            }
        }
        result
    }

    /// Read helpers used by the off-chain indexer and dashboards.
    pub fn get_manufacturers(env: Env) -> Vec<Manufacturer> {
        let ids = unwrap_vec(&env, read_manufacturer_ids(&env));
        let mut manufacturers = Vec::new(&env);
        for id in ids.iter() {
            if let Some(manufacturer) = read_manufacturer(&env, id) {
                manufacturers.push_back(manufacturer);
            }
        }
        manufacturers
    }

    pub fn get_batches(env: Env) -> Vec<Batch> {
        let ids = unwrap_vec(&env, read_all_batch_ids(&env));
        let mut batches = Vec::new(&env);
        for id in ids.iter() {
            if let Some(batch) = read_batch(&env, &id) {
                batches.push_back(batch);
            }
        }
        batches
    }

    pub fn get_batches_for_manufacturer(env: Env, manufacturer: Address) -> Vec<BytesN<32>> {
        match read_manufacturer_id_by_address(&env, &manufacturer) {
            Some(manufacturer_id) => {
                unwrap_vec(&env, read_batch_ids_by_manufacturer(&env, manufacturer_id))
            }
            None => Vec::new(&env),
        }
    }

    pub fn get_manufacturer(env: Env, id: u64) -> Option<Manufacturer> {
        read_manufacturer(&env, id)
    }

    pub fn get_manufacturer_id(env: Env, manufacturer: Address) -> Option<u64> {
        read_manufacturer_id_by_address(&env, &manufacturer)
    }

    pub fn get_batch(env: Env, batch_id: BytesN<32>) -> Option<Batch> {
        read_batch(&env, &batch_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::{filter_recalls_by_severity, has_recall_at_least};
    use soroban_sdk::testutils::Address as _;
    use soroban_sdk::{Address, BytesN, Env, String};

    const DATE: u64 = 1_700_000_000;

    fn setup() -> (Env, Address, Address) {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Provenward, ());
        let client = ProvenwardClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        (env, contract_id, admin)
    }

    fn batch_id(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn msg_hash(env: &Env, seed: u8) -> BytesN<32> {
        BytesN::from_array(env, &[seed; 32])
    }

    fn register_manufacturer(
        env: &Env,
        client: &ProvenwardClient<'_>,
        admin: &Address,
        name: &str,
    ) -> Address {
        let manufacturer = Address::generate(env);
        let id = client.register_manufacturer(admin, &manufacturer, &String::from_str(env, name));
        assert!(id >= 1);
        manufacturer
    }

    fn register_batch(
        env: &Env,
        client: &ProvenwardClient<'_>,
        manufacturer: &Address,
        seed: u8,
        product: &str,
        start: u64,
        end: u64,
    ) -> BytesN<32> {
        let id = batch_id(env, seed);
        client.register_batch(
            manufacturer,
            &id,
            &String::from_str(env, product),
            &start,
            &end,
            &DATE,
        );
        id
    }

    fn issue_recall(
        env: &Env,
        client: &ProvenwardClient<'_>,
        manufacturer: &Address,
        batch: &BytesN<32>,
        severity: Severity,
        start: u64,
        end: u64,
    ) -> u64 {
        client.issue_recall(
            manufacturer,
            batch,
            &severity,
            &msg_hash(env, 9),
            &start,
            &end,
        )
    }

    #[test]
    fn test_initialize_sets_admin() {
        let env = Env::default();
        env.mock_all_auths();
        let contract_id = env.register(Provenward, ());
        let client = ProvenwardClient::new(&env, &contract_id);
        let admin = Address::generate(&env);
        client.initialize(&admin);
        let stored_admin = env.as_contract(&contract_id, || read_admin(&env));
        assert_eq!(stored_admin, Some(admin));
    }

    #[test]
    #[should_panic(expected = "Contract already initialized")]
    fn test_initialize_only_once() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        client.initialize(&admin);
    }

    #[test]
    fn test_register_manufacturer_returns_id() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = Address::generate(&env);
        let id = client.register_manufacturer(
            &admin,
            &manufacturer,
            &String::from_str(&env, "Acme Industries"),
        );
        assert_eq!(id, 1);
        let record = client.get_manufacturer(&id).unwrap();
        assert_eq!(record.id, 1);
        assert_eq!(record.address, manufacturer);
        assert_eq!(record.name, String::from_str(&env, "Acme Industries"));
        assert_eq!(client.get_manufacturer_id(&manufacturer), Some(1));
    }

    #[test]
    #[should_panic(expected = "Only the contract admin can register manufacturers")]
    fn test_register_manufacturer_requires_admin() {
        let (env, contract_id, _admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let not_admin = Address::generate(&env);
        let manufacturer = Address::generate(&env);
        client.register_manufacturer(
            &not_admin,
            &manufacturer,
            &String::from_str(&env, "Unauthorized"),
        );
    }

    #[test]
    #[should_panic(expected = "Manufacturer already registered")]
    fn test_register_manufacturer_duplicate() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = Address::generate(&env);
        client.register_manufacturer(&admin, &manufacturer, &String::from_str(&env, "Acme"));
        client.register_manufacturer(&admin, &manufacturer, &String::from_str(&env, "Acme 2"));
    }

    #[test]
    fn test_verify_serial_genuine() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);

        let result = client.verify_serial(&batch, &1000);
        assert_eq!(
            result,
            VerificationResult::Genuine(GenuineDetails {
                manufacturer: manufacturer.clone(),
                product_name: String::from_str(&env, "Widget"),
                manufactured_date: DATE,
            })
        );

        let result = client.verify_serial(&batch, &1999);
        assert!(matches!(
            result,
            VerificationResult::Genuine(GenuineDetails { .. })
        ));
    }

    #[test]
    fn test_verify_serial_out_of_range() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);

        assert_eq!(
            client.verify_serial(&batch, &999),
            VerificationResult::OutOfRange
        );
        assert_eq!(
            client.verify_serial(&batch, &2000),
            VerificationResult::OutOfRange
        );
    }

    #[test]
    fn test_verify_serial_unregistered() {
        let (env, contract_id, _admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let unknown = batch_id(&env, 42);
        assert_eq!(
            client.verify_serial(&unknown, &1000),
            VerificationResult::Unregistered
        );
    }

    #[test]
    #[should_panic(expected = "batch_id already registered")]
    fn test_register_batch_duplicate_rejected() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let id = batch_id(&env, 7);
        client.register_batch(
            &manufacturer,
            &id,
            &String::from_str(&env, "Widget"),
            &100,
            &199,
            &DATE,
        );
        client.register_batch(
            &manufacturer,
            &id,
            &String::from_str(&env, "Widget"),
            &100,
            &199,
            &DATE,
        );
    }

    #[test]
    #[should_panic(expected = "Serial range overlaps an existing batch")]
    fn test_register_batch_overlap_rejected() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        register_batch(&env, &client, &manufacturer, 1, "Widget", 100, 199);
        let second = batch_id(&env, 2);
        client.register_batch(
            &manufacturer,
            &second,
            &String::from_str(&env, "Widget"),
            &150,
            &250,
            &DATE,
        );
    }

    #[test]
    fn test_register_batch_non_overlapping_allowed() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let first = register_batch(&env, &client, &manufacturer, 1, "Widget", 100, 199);
        let second = batch_id(&env, 2);
        client.register_batch(
            &manufacturer,
            &second,
            &String::from_str(&env, "Widget"),
            &200,
            &299,
            &DATE,
        );
        assert_eq!(client.get_batch(&first).unwrap().serial_range_end, 199);
        assert_eq!(client.get_batch(&second).unwrap().serial_range_start, 200);
    }

    #[test]
    fn test_issue_recall_and_get_recalls() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        let msg = msg_hash(&env, 9);

        let recall_id = client.issue_recall(
            &manufacturer,
            &batch,
            &Severity::Critical,
            &msg,
            &1200,
            &1400,
        );
        assert_eq!(recall_id, 1);

        let recalls = client.get_recalls_for_batch(&batch);
        assert_eq!(recalls.len(), 1);
        assert_eq!(recalls.get(0).unwrap().severity, Severity::Critical);
        assert_eq!(recalls.get(0).unwrap().message_hash, msg);
        assert_eq!(recalls.get(0).unwrap().affected_serial_start, 1200);
        assert_eq!(recalls.get(0).unwrap().affected_serial_end, 1400);
    }

    #[test]
    #[should_panic(expected = "Only the batch manufacturer can issue recalls")]
    fn test_issue_recall_other_manufacturer_rejected() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer_a = register_manufacturer(&env, &client, &admin, "Acme");
        let manufacturer_b = register_manufacturer(&env, &client, &admin, "Globex");
        let batch = register_batch(&env, &client, &manufacturer_a, 1, "Widget", 1000, 1999);
        let msg = msg_hash(&env, 9);
        client.issue_recall(
            &manufacturer_b,
            &batch,
            &Severity::Warning,
            &msg,
            &1100,
            &1200,
        );
    }

    #[test]
    #[should_panic]
    fn test_issue_recall_requires_auth() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        // Stop mocking auth: the caller must now actually authorize the call.
        env.set_auths(&[]);
        issue_recall(
            &env,
            &client,
            &manufacturer,
            &batch,
            Severity::Warning,
            1100,
            1200,
        );
    }

    #[test]
    #[should_panic(expected = "Affected serial range must be within the batch serial range")]
    fn test_issue_recall_outside_batch_range_rejected() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        issue_recall(&env, &client, &manufacturer, &batch, Severity::Info, 1, 50);
    }

    #[test]
    fn test_recall_severity_filtering() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);

        client.issue_recall(
            &manufacturer,
            &batch,
            &Severity::Info,
            &msg_hash(&env, 1),
            &1000,
            &1099,
        );
        client.issue_recall(
            &manufacturer,
            &batch,
            &Severity::Critical,
            &msg_hash(&env, 2),
            &1500,
            &1599,
        );

        let all = client.get_recalls_for_batch(&batch);
        assert_eq!(all.len(), 2);

        let critical = filter_recalls_by_severity(&env, all.clone(), Severity::Critical);
        assert_eq!(critical.len(), 1);
        assert_eq!(critical.get(0).unwrap().severity, Severity::Critical);

        let info = filter_recalls_by_severity(&env, all.clone(), Severity::Info);
        assert_eq!(info.len(), 1);

        assert!(has_recall_at_least(all.clone(), Severity::Critical));
        assert!(has_recall_at_least(all.clone(), Severity::Info));
        assert!(has_recall_at_least(all.clone(), Severity::Warning));
    }

    #[test]
    fn test_ownership_registration_privacy() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        let consumer = Address::generate(&env);

        client.register_ownership_receipt(&consumer, &batch, &1234);

        // The only on-chain record for this consumer must be a
        // `Vec<OwnershipReceipt>`. Each receipt carries exactly three binary
        // fields (BytesN<32> batch id, u64 serial, u64 timestamp) under the
        // owner's Address as the map key. There is no String / PII field on
        // the record type and nothing besides the address links the caller to
        // the purchase on-chain.
        let stored = env.as_contract(&contract_id, || {
            (
                read_owner_receipts(&env, &consumer),
                env.storage()
                    .persistent()
                    .get::<_, Vec<OwnershipReceipt>>(&(
                        soroban_sdk::Symbol::new(&env, "owner_receipts"),
                        consumer.clone(),
                    )),
            )
        });
        let receipts = stored.0.unwrap();
        assert_eq!(receipts.len(), 1);
        let receipt = receipts.get(0).unwrap();
        assert_eq!(receipt.batch_id, batch);
        assert_eq!(receipt.serial_number, 1234);
        assert_eq!(receipt.registered_at, env.ledger().timestamp());

        let direct = stored.1;
        assert_eq!(direct.unwrap().len(), 1);
    }

    #[test]
    #[should_panic(expected = "Serial number is not in the batch range")]
    fn test_ownership_registration_out_of_range_rejected() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        let consumer = Address::generate(&env);
        client.register_ownership_receipt(&consumer, &batch, &5000);
    }

    #[test]
    fn test_get_my_recalls_matches_owned_serial() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        let consumer = Address::generate(&env);

        client.register_ownership_receipt(&consumer, &batch, &1234);
        client.issue_recall(
            &manufacturer,
            &batch,
            &Severity::Critical,
            &msg_hash(&env, 1),
            &1200,
            &1300,
        );
        client.issue_recall(
            &manufacturer,
            &batch,
            &Severity::Warning,
            &msg_hash(&env, 2),
            &1301,
            &1400,
        );

        let affected = client.get_my_recalls(&consumer);
        assert_eq!(affected.len(), 1);
        assert_eq!(affected.get(0).unwrap().affected_serial_start, 1200);
        assert_eq!(affected.get(0).unwrap().severity, Severity::Critical);

        let unaffected = Address::generate(&env);
        client.register_ownership_receipt(&unaffected, &batch, &1500);
        assert_eq!(client.get_my_recalls(&unaffected).len(), 0);
    }

    #[test]
    fn test_unique_ownership_receipts_per_serial() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer = register_manufacturer(&env, &client, &admin, "Acme");
        let batch = register_batch(&env, &client, &manufacturer, 1, "Widget", 1000, 1999);
        let consumer = Address::generate(&env);

        client.register_ownership_receipt(&consumer, &batch, &1000);
        client.register_ownership_receipt(&consumer, &batch, &1001);
        let receipts = env.as_contract(&contract_id, || {
            read_owner_receipts(&env, &consumer).unwrap()
        });
        assert_eq!(receipts.len(), 2);
    }

    #[test]
    fn test_read_helpers() {
        let (env, contract_id, admin) = setup();
        let client = ProvenwardClient::new(&env, &contract_id);
        let manufacturer_a = register_manufacturer(&env, &client, &admin, "Acme");
        let manufacturer_b = register_manufacturer(&env, &client, &admin, "Globex");
        let batch_a = register_batch(&env, &client, &manufacturer_a, 1, "Widget", 1000, 1999);
        let batch_b = register_batch(&env, &client, &manufacturer_b, 2, "Gadget", 101, 104);

        assert_eq!(client.get_manufacturers().len(), 2);
        assert_eq!(client.get_batches().len(), 2);
        assert_eq!(
            client
                .get_batches_for_manufacturer(&manufacturer_a)
                .get(0)
                .unwrap(),
            batch_a
        );
        assert_eq!(
            client
                .get_batches_for_manufacturer(&manufacturer_b)
                .get(0)
                .unwrap(),
            batch_b
        );
        assert_eq!(client.get_manufacturer_id(&manufacturer_a), Some(1));
        assert_eq!(client.get_manufacturer_id(&manufacturer_b), Some(2));
        assert_eq!(
            client.get_manufacturer(&1).unwrap().name,
            String::from_str(&env, "Acme")
        );
    }
}
