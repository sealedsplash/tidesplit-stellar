import { describe, expect, it } from "vitest";
import {
  ContractServiceError,
  DEFAULT_CONTRACT_ID,
  DEFAULT_RPC_URL,
  EXPLORER_ROOT,
  normalizePool,
} from "../src/contract/contractService";

describe("Soroban contract configuration", () => {
  it("uses the public Testnet RPC endpoint", () => {
    expect(DEFAULT_RPC_URL).toBe("https://soroban-testnet.stellar.org");
    expect(EXPLORER_ROOT).toContain("/testnet");
  });

  it("allows an empty id only before the deployment workflow", () => {
    expect(typeof DEFAULT_CONTRACT_ID).toBe("string");
  });
});

describe("contract value decoding", () => {
  it("normalizes the snake-case Soroban struct without losing stroop precision", () => {
    const pool = normalizePool({
      id: 7n,
      creator: "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF",
      title: "Studio dinner",
      total_stroops: 9_000_000_000_000_001n,
      participants: 6,
      share_stroops: 1_500_000_000_000_001n,
      created_at: 1_700_000_000n,
      payments: 2,
    });
    expect(pool.id).toBe(7);
    expect(pool.totalStroops).toBe(9_000_000_000_000_001n);
    expect(pool.shareStroops).toBe(1_500_000_000_000_001n);
    expect(pool.payments).toBe(2);
  });

  it("preserves typed RPC failures", () => {
    const error = new ContractServiceError("RPC_FAILURE", "offline");
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("RPC_FAILURE");
  });
});
