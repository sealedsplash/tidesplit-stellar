import { describe, expect, it } from "vitest";
import { classifyWalletError, FEATURED_WALLET_IDS, TESTNET_PASSPHRASE } from "../src/wallet/multiWallet";

describe("StellarWalletsKit integration", () => {
  it("exposes all five required wallets", () => {
    expect(Object.keys(FEATURED_WALLET_IDS)).toEqual(["freighter", "albedo", "xbull", "rabet", "lobstr"]);
    expect(new Set(Object.values(FEATURED_WALLET_IDS)).size).toBe(5);
  });

  it("is permanently scoped to Testnet", () => {
    expect(TESTNET_PASSPHRASE).toContain("Test SDF Network");
  });

  it.each([
    ["wallet extension not installed", "NOT_FOUND"],
    ["User rejected request", "REJECTED"],
    ["wrong network passphrase", "WRONG_NETWORK"],
    ["provider timed out", "CONNECTION_FAILED"],
  ])("classifies %s", (message, code) => {
    expect(classifyWalletError(new Error(message)).code).toBe(code);
  });
});
