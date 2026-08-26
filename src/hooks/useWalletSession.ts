import { useCallback, useEffect, useState } from "react";
import {
  currentNetwork,
  hasFreighter,
  requestAccess,
  storedAddress,
  verifyTestnet,
  type AdapterErrorCode,
} from "../wallet/freighterAdapter";
import { readBalance } from "../wallet/horizonClient";

export type SessionPhase = "checking" | "disconnected" | "connected";

export interface WalletSession {
  phase: SessionPhase;
  address: string | null;
  onTestnet: boolean | null;
  balanceXlm: string | null;
  balanceState: "idle" | "loading" | "ready" | "unfunded" | "unreachable";
  lastError: AdapterErrorCode | null;
}

const EMPTY_SESSION: WalletSession = {
  phase: "checking",
  address: null,
  onTestnet: null,
  balanceXlm: null,
  balanceState: "idle",
  lastError: null,
};

/**
 * TideSplit session store. The UI subscribes to one object describing
 * the whole wallet journey; updates flow through explicit transitions.
 */
export function useWalletSession() {
  const [session, setSession] = useState<WalletSession>(EMPTY_SESSION);

  const pullBalance = useCallback(async (address: string) => {
    setSession((prev) => ({ ...prev, balanceState: "loading" }));
    const outcome = await readBalance(address);
    setSession((prev) => {
      if (!outcome.ok) {
        return {
          ...prev,
          balanceState: outcome.reason === "UNFUNDED" ? "unfunded" : "unreachable",
        };
      }
      return { ...prev, balanceXlm: outcome.xlm, balanceState: "ready" };
    });
  }, []);

  // Restore a previous grant asynchronously (no synchronous setState).
  useEffect(() => {
    let alive = true;
    async function restore() {
      if (!hasFreighter()) {
        if (alive) {
          setSession({ ...EMPTY_SESSION, phase: "disconnected" });
        }
        return;
      }
      const known = await storedAddress();
      if (!alive) return;
      if (!known) {
        setSession({ ...EMPTY_SESSION, phase: "disconnected" });
        return;
      }
      const net = await verifyTestnet();
      if (!alive) return;
      setSession({
        phase: "connected",
        address: known,
        onTestnet: net.ok,
        balanceXlm: null,
        balanceState: "idle",
        lastError: null,
      });
      if (net.ok) {
        await pullBalance(known);
      }
    }
    void restore();
    return () => {
      alive = false;
    };
  }, [pullBalance]);

  const connect = useCallback(async () => {
    setSession((prev) => ({ ...prev, lastError: null }));
    const access = await requestAccess();
    if (!access.ok) {
      setSession({ ...EMPTY_SESSION, phase: "disconnected", lastError: access.code });
      return;
    }
    const net = await verifyTestnet();
    setSession({
      phase: "connected",
      address: access.data,
      onTestnet: net.ok,
      balanceXlm: null,
      balanceState: "idle",
      lastError: null,
    });
    if (net.ok) {
      await pullBalance(access.data);
    }
  }, [pullBalance]);

  const recheckNetwork = useCallback(async () => {
    const network = await currentNetwork();
    setSession((prev) => {
      const isTestnet = network.ok && network.data === "TESTNET";
      return { ...prev, onTestnet: isTestnet };
    });
    if (network.ok && network.data === "TESTNET" && session.address) {
      await pullBalance(session.address);
    }
  }, [session.address, pullBalance]);

  const disconnect = useCallback(() => {
    setSession({ ...EMPTY_SESSION, phase: "disconnected" });
  }, []);

  return { session, connect, disconnect, recheckNetwork, refreshBalance: pullBalance };
}
