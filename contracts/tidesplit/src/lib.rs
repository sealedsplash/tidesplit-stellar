#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, symbol_short, Address, Env, String, Vec,
};

const DAY_LEDGERS: u32 = 17_280;

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Pool {
    pub id: u64,
    pub creator: Address,
    pub title: String,
    pub total_stroops: i128,
    pub participants: u32,
    pub share_stroops: i128,
    pub created_at: u64,
    pub payments: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Payment {
    pub pool_id: u64,
    pub payer: Address,
    pub amount_stroops: i128,
    pub paid_at: u64,
}

#[contracttype]
enum DataKey {
    NextPool,
    Pool(u64),
    Payments(u64),
    Paid(u64, Address),
}

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq)]
#[repr(u32)]
pub enum Error {
    InvalidAmount = 1,
    InvalidParticipants = 2,
    InvalidTitle = 3,
    PoolNotFound = 4,
    AlreadyPaid = 5,
    PoolFull = 6,
    InvalidPayment = 7,
}

#[contract]
pub struct TideSplit;

#[contractimpl]
impl TideSplit {
    pub fn create_pool(
        env: Env,
        creator: Address,
        title: String,
        total_stroops: i128,
        participants: u32,
    ) -> Result<u64, Error> {
        creator.require_auth();
        if total_stroops <= 0 {
            return Err(Error::InvalidAmount);
        }
        if participants < 2 || participants > 100 {
            return Err(Error::InvalidParticipants);
        }
        if title.len() == 0 || title.len() > 64 {
            return Err(Error::InvalidTitle);
        }
        let id = env
            .storage()
            .instance()
            .get(&DataKey::NextPool)
            .unwrap_or(0u64);
        let pool = Pool {
            id,
            creator: creator.clone(),
            title,
            total_stroops,
            participants,
            share_stroops: (total_stroops + participants as i128 - 1) / participants as i128,
            created_at: env.ledger().timestamp(),
            payments: 0,
        };
        env.storage().persistent().set(&DataKey::Pool(id), &pool);
        env.storage()
            .persistent()
            .set(&DataKey::Payments(id), &Vec::<Payment>::new(&env));
        env.storage().persistent().extend_ttl(
            &DataKey::Pool(id),
            DAY_LEDGERS * 7,
            DAY_LEDGERS * 30,
        );
        env.storage().instance().set(&DataKey::NextPool, &(id + 1));
        env.events()
            .publish((symbol_short!("pool_new"), id), pool.clone());
        Ok(id)
    }

    pub fn record_payment(
        env: Env,
        payer: Address,
        pool_id: u64,
        amount_stroops: i128,
    ) -> Result<(), Error> {
        payer.require_auth();
        let mut pool: Pool = env
            .storage()
            .persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)?;
        if amount_stroops != pool.share_stroops {
            return Err(Error::InvalidPayment);
        }
        if pool.payments >= pool.participants {
            return Err(Error::PoolFull);
        }
        let paid_key = DataKey::Paid(pool_id, payer.clone());
        if env.storage().persistent().has(&paid_key) {
            return Err(Error::AlreadyPaid);
        }
        let payment = Payment {
            pool_id,
            payer: payer.clone(),
            amount_stroops,
            paid_at: env.ledger().timestamp(),
        };
        let mut payments: Vec<Payment> = env
            .storage()
            .persistent()
            .get(&DataKey::Payments(pool_id))
            .unwrap_or(Vec::new(&env));
        payments.push_back(payment.clone());
        pool.payments += 1;
        env.storage()
            .persistent()
            .set(&DataKey::Pool(pool_id), &pool);
        env.storage()
            .persistent()
            .set(&DataKey::Payments(pool_id), &payments);
        env.storage().persistent().set(&paid_key, &true);
        env.events()
            .publish((symbol_short!("paid"), pool_id), payment);
        Ok(())
    }

    pub fn get_pool(env: Env, pool_id: u64) -> Result<Pool, Error> {
        env.storage()
            .persistent()
            .get(&DataKey::Pool(pool_id))
            .ok_or(Error::PoolNotFound)
    }
    pub fn get_payments(env: Env, pool_id: u64) -> Result<Vec<Payment>, Error> {
        if !env.storage().persistent().has(&DataKey::Pool(pool_id)) {
            return Err(Error::PoolNotFound);
        }
        Ok(env
            .storage()
            .persistent()
            .get(&DataKey::Payments(pool_id))
            .unwrap_or(Vec::new(&env)))
    }
    pub fn has_paid(env: Env, pool_id: u64, payer: Address) -> bool {
        env.storage()
            .persistent()
            .has(&DataKey::Paid(pool_id, payer))
    }
    pub fn pool_count(env: Env) -> u64 {
        env.storage()
            .instance()
            .get(&DataKey::NextPool)
            .unwrap_or(0)
    }
}

#[cfg(test)]
mod test;
