// Adapter tests: bounded detection, access mapping, network guard,
// locked-wallet classification, and resume semantics.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  connected: false,
  allowed: false,
  allowedError: false,
  address: "",
  network: "TESTNET",
  networkError: undefined as unknown,
  accessError: undefined as unknown,
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => ({ isConnected: state.connected })),
  isAllowed: vi.fn(async () => {
    if (state.allowedError) return { isAllowed: false, error: { code: -1, message: "x" } };
    return { isAllowed: state.allowed };
  }),
  getAddress: vi.fn(async () => {
    if (state.address) return { address: state.address };
    return { address: "", error: { code: -1, message: "locked" } };
  }),
  requestAccess: vi.fn(async () => {
    if (state.accessError) return { address: "", error: state.accessError };
    return { address: state.address };
  }),
  getNetwork: vi.fn(async () => {
    if (state.networkError) {
      return { network: "", networkPassphrase: "", error: state.networkError };
    }
    return { network: state.network, networkPassphrase: "Test SDF Network ; September 2015" };
  }),
  signTransaction: vi.fn(),
}));

import {
  currentNetwork,
  requestAccessResult,
  storedAddress,
  verifyTestnet,
  waitForFreighter,
} from "../src/wallet/freighterAdapter";

beforeEach(() => {
  vi.useFakeTimers();
  state.connected = false;
  state.allowed = false;
  state.allowedError = false;
  state.address = "";
  state.network = "TESTNET";
  state.networkError = undefined;
  state.accessError = undefined;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("waitForFreighter", () => {
  it("detects an immediately available extension", async () => {
    state.connected = true;
    const promise = waitForFreighter(1000);
    await vi.advanceTimersByTimeAsync(300);
    expect(await promise).toBe(true);
  });

  it("keeps polling through delayed injection and detects a late arrival", async () => {
    setTimeout(() => {
      state.connected = true;
    }, 1500);
    const promise = waitForFreighter(8000);
    await vi.advanceTimersByTimeAsync(2500);
    expect(await promise).toBe(true);
  });

  it("gives up after the bounded timeout without looping forever", async () => {
    let settled = false;
    const promise = waitForFreighter(1000).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(9000);
    expect(await promise).toBe(false);
    expect(settled).toBe(true);
  });
});

describe("requestAccessResult", () => {
  it("returns the address on success", async () => {
    state.address = "GA7QYNF7SOWQ3GLR2ZGMGIWQGNKWRRGDCB4VPFVKGNTTJOOOSAHC7YQ4";
    const result = await requestAccessResult();
    expect(result).toEqual({ ok: true, data: state.address });
  });

  it("classifies an explicit rejection as ACCESS_DENIED", async () => {
    state.accessError = { code: -1, message: "user declined" };
    const result = await requestAccessResult();
    expect(result).toEqual({ ok: false, code: "ACCESS_DENIED" });
  });

  it("classifies an empty address as WALLET_LOCKED", async () => {
    const result = await requestAccessResult();
    expect(result).toEqual({ ok: false, code: "WALLET_LOCKED" });
  });
});

describe("verifyTestnet / currentNetwork", () => {
  it("accepts TESTNET", async () => {
    const result = await verifyTestnet();
    expect(result).toEqual({ ok: true, data: "TESTNET" });
  });

  it("rejects other networks as NETWORK_MISMATCH", async () => {
    state.network = "PUBLIC";
    const result = await verifyTestnet();
    expect(result).toEqual({ ok: false, code: "NETWORK_MISMATCH" });
  });

  it("maps query failures to NETWORK_UNKNOWN", async () => {
    state.networkError = { code: -1, message: "down" };
    const result = await currentNetwork();
    expect(result).toEqual({ ok: false, code: "NETWORK_UNKNOWN" });
  });
});

describe("storedAddress", () => {
  it("restores a granted session address", async () => {
    state.allowed = true;
    state.address = "GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H";
    expect(await storedAddress()).toBe(state.address);
  });

  it("returns null when access was never granted", async () => {
    expect(await storedAddress()).toBeNull();
  });

  it("signals DETECTING when the allowed-status query errors", async () => {
    state.allowedError = true;
    expect(await storedAddress()).toBe("DETECTING");
  });
});
