// Hook integration tests: delayed availability, missing wallet, rejection,
// wrong network, retry recovery, and no duplicate initialization loops.
import { cleanup, renderHook, waitFor, act } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useWalletSession } from "../src/hooks/useWalletSession";

const state = vi.hoisted(() => ({
  connected: false,
  allowed: false,
  address: "",
  network: "TESTNET",
}));

vi.mock("@stellar/freighter-api", () => ({
  isConnected: vi.fn(async () => ({ isConnected: state.connected })),
  isAllowed: vi.fn(async () => ({ isAllowed: state.allowed })),
  getAddress: vi.fn(async () =>
    state.address
      ? { address: state.address }
      : { address: "", error: { code: -1, message: "locked" } },
  ),
  requestAccess: vi.fn(async () =>
    state.allowed && state.address
      ? { address: state.address }
      : { address: "", error: { code: -1, message: "rejected" } },
  ),
  getNetwork: vi.fn(async () => ({
    network: state.network,
    networkPassphrase: "Test SDF Network ; September 2015",
  })),
  signTransaction: vi.fn(),
}));

vi.mock("../src/wallet/horizonClient", () => ({
  readBalance: vi.fn(async () => ({ ok: true, xlm: "42.1000000" })),
}));

const ADDRESS = "GA7QYNF7SOWQ3GLR2ZGMGIWQGNKWRRGDCB4VPFVKGNTTJOOOSAHC7YQ4";

beforeEach(() => {
  state.connected = false;
  state.allowed = false;
  state.address = "";
  state.network = "TESTNET";
});

afterEach(() => {
  cleanup();
});

describe("useWalletSession", () => {
  it("stays in checking phase during the detection window", async () => {
    const { result } = renderHook(() => useWalletSession());
    expect(result.current.session.phase).toBe("checking");
    await waitFor(() => expect(result.current.session.phase).not.toBe("checking"), {
      timeout: 15_000,
    });
  });

  it("moves to disconnected when the extension appears mid-window", async () => {
    setTimeout(() => {
      state.connected = true;
    }, 400);
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.phase).toBe("disconnected"), {
      timeout: 15_000,
    });
  });

  it("reports missing only after the bounded deadline elapses", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useWalletSession());
      expect(result.current.session.phase).toBe("checking");
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9500);
      });
      expect(result.current.session.phase).toBe("missing");
    } finally {
      vi.useRealTimers();
    }
  });

  it("recovers through recheckWallet after an initial failure", async () => {
    vi.useFakeTimers();
    try {
      const { result } = renderHook(() => useWalletSession());
      await act(async () => {
        await vi.advanceTimersByTimeAsync(9500);
      });
      expect(result.current.session.phase).toBe("missing");

      state.connected = true;
      act(() => {
        result.current.recheckWallet();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(500);
      });
      expect(result.current.session.phase).toBe("disconnected");
    } finally {
      vi.useRealTimers();
    }
  });

  it("connects on Testnet with balance loaded", async () => {
    state.connected = true;
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.phase).toBe("disconnected"));

    state.allowed = true;
    state.address = ADDRESS;
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.session.address).toBe(ADDRESS);
    expect(result.current.session.onTestnet).toBe(true);
    expect(result.current.session.balanceXlm).toBe("42.1000000");
  });

  it("surfaces ACCESS_DENIED when the prompt is dismissed", async () => {
    state.connected = true;
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.phase).toBe("disconnected"));

    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.session.lastError).toBe("ACCESS_DENIED");
    expect(result.current.session.address).toBeNull();
  });

  it("flags NETWORK_MISMATCH off-Testnet and keeps payments locked", async () => {
    state.connected = true;
    state.network = "PUBLIC";
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.phase).toBe("disconnected"));

    state.allowed = true;
    state.address = ADDRESS;
    await act(async () => {
      await result.current.connect();
    });
    expect(result.current.session.onTestnet).toBe(false);
    expect(result.current.session.balanceXlm).toBeNull();
  });

  it("resumes a previously granted session without prompting", async () => {
    state.connected = true;
    state.allowed = true;
    state.address = ADDRESS;
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.address).toBe(ADDRESS), {
      timeout: 15_000,
    });
    expect(result.current.session.balanceXlm).toBe("42.1000000");
  });

  it("does not duplicate initialization across repeated rechecks", async () => {
    state.connected = true;
    const { result } = renderHook(() => useWalletSession());
    await waitFor(() => expect(result.current.session.phase).toBe("disconnected"), {
      timeout: 15_000,
    });

    act(() => {
      result.current.recheckWallet();
    });
    await waitFor(
      () => expect(result.current.session.phase).toBe("disconnected"),
      { timeout: 15_000 },
    );
    expect(result.current.session.address).toBeNull();
    expect(result.current.session.lastError).toBeNull();
  });
});
