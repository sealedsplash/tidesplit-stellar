extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, Ledger},
    Address, Env, String,
};

fn setup() -> (Env, Address, Address) {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_700_000_000);
    let contract = env.register(TideSplit, ());
    let creator = Address::generate(&env);
    (env, contract, creator)
}

fn create(env: &Env, contract: &Address, creator: &Address, total: i128, participants: u32) -> u64 {
    TideSplitClient::new(env, contract).create_pool(
        creator,
        &String::from_str(env, "Team dinner"),
        &total,
        &participants,
    )
}

#[test]
fn creates_and_reads_pool() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let id = create(&env, &contract, &creator, 1_000_000_000, 4);
    let pool = client.get_pool(&id);
    assert_eq!(pool.creator, creator);
    assert_eq!(pool.share_stroops, 250_000_000);
    assert_eq!(pool.created_at, 1_700_000_000);
    assert_eq!(client.pool_count(), 1);
}

#[test]
fn rounds_share_up_to_one_stroop() {
    let (env, contract, creator) = setup();
    let id = create(&env, &contract, &creator, 10, 3);
    assert_eq!(
        TideSplitClient::new(&env, &contract)
            .get_pool(&id)
            .share_stroops,
        4
    );
}

#[test]
fn rejects_zero_and_negative_amounts() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    for amount in [0, -1] {
        assert_eq!(
            client.try_create_pool(&creator, &String::from_str(&env, "Bad"), &amount, &2),
            Err(Ok(Error::InvalidAmount))
        );
    }
}

#[test]
fn rejects_participant_counts_outside_bounds() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    for participants in [0, 1, 101] {
        assert_eq!(
            client.try_create_pool(&creator, &String::from_str(&env, "Bad"), &1, &participants),
            Err(Ok(Error::InvalidParticipants))
        );
    }
}

#[test]
fn accepts_participant_boundaries() {
    let (env, contract, creator) = setup();
    create(&env, &contract, &creator, 100, 2);
    create(&env, &contract, &creator, 100, 100);
    assert_eq!(TideSplitClient::new(&env, &contract).pool_count(), 2);
}

#[test]
fn rejects_empty_and_overlong_titles() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let long = String::from_str(
        &env,
        "12345678901234567890123456789012345678901234567890123456789012345",
    );
    assert_eq!(
        client.try_create_pool(&creator, &String::from_str(&env, ""), &1, &2),
        Err(Ok(Error::InvalidTitle))
    );
    assert_eq!(
        client.try_create_pool(&creator, &long, &1, &2),
        Err(Ok(Error::InvalidTitle))
    );
}

#[test]
fn pool_ids_are_sequential() {
    let (env, contract, creator) = setup();
    assert_eq!(create(&env, &contract, &creator, 10, 2), 0);
    assert_eq!(create(&env, &contract, &creator, 20, 2), 1);
}

#[test]
fn records_one_payment_per_payer() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let payer = Address::generate(&env);
    let id = create(&env, &contract, &creator, 100, 2);
    client.record_payment(&payer, &id, &50);
    assert!(client.has_paid(&id, &payer));
    assert_eq!(client.get_payments(&id).len(), 1);
    assert_eq!(client.get_pool(&id).payments, 1);
    assert_eq!(
        client.try_record_payment(&payer, &id, &50),
        Err(Ok(Error::AlreadyPaid))
    );
}

#[test]
fn rejects_wrong_share() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let payer = Address::generate(&env);
    let id = create(&env, &contract, &creator, 100, 2);
    assert_eq!(
        client.try_record_payment(&payer, &id, &49),
        Err(Ok(Error::InvalidPayment))
    );
}

#[test]
fn rejects_unknown_pool_queries_and_payments() {
    let (env, contract, _) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let payer = Address::generate(&env);
    assert_eq!(client.try_get_pool(&99), Err(Ok(Error::PoolNotFound)));
    assert_eq!(client.try_get_payments(&99), Err(Ok(Error::PoolNotFound)));
    assert_eq!(
        client.try_record_payment(&payer, &99, &1),
        Err(Ok(Error::PoolNotFound))
    );
}

#[test]
fn rejects_payments_after_pool_is_full() {
    let (env, contract, creator) = setup();
    let client = TideSplitClient::new(&env, &contract);
    let id = create(&env, &contract, &creator, 100, 2);
    client.record_payment(&Address::generate(&env), &id, &50);
    client.record_payment(&Address::generate(&env), &id, &50);
    assert_eq!(
        client.try_record_payment(&Address::generate(&env), &id, &50),
        Err(Ok(Error::PoolFull))
    );
}
