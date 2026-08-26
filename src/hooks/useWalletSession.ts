import { useCallback, useEffect, useRef, useState } from "react";
import {
  currentNetwork,
  requestAccessResult,
  storedAddress,
  verifyTestnet,
  waitForFreighter,
  type AdapterErrorCode,
} from "../wallet/freighterAdapter";
import { readBalance } from "../wallet/horizonClient";

export type SessionPhase =
  | "checking" // bounded detection window is open
  | "missing" // extension never appeared before the deadline
  | "disconnected" // extension present, not connected
  | "connected";

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
 * TideSplit session store. Detection runs through the official API with a
 * bounded retry window, so a late content-script injection can never be
 * misread as "extension missing". The UI shows a checking state until the
 * deadline passes; only then does it report the wallet as unavailable.
 */
export function useWalletSession() {
  const [session, setSession] = useState<WalletSession>(EMPTY_SESSION);
  const runIdRef = useRef(0);

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

  const detectAndRestore = useCallback(
    async (runId: number) => {
      setSession({ ...EMPTY_SESSION });
      const present = await waitForFreighter();
      if (runIdRef.current !== runId) return;

      if (!present) {
        setSession({ ...EMPTY_SESSION, phase: "missing" });
        return;
      }

      setSession({ ...EMPTY_SESSION, phase: "disconnected" });
      const known = await storedAddress();
      if (runIdRef.current !== runId) return;
      if (!known || typeof known !== "string") {
        // null (never granted), WALLET_LOCKED, or DETECTING all land in the
        // disconnected state; connect/retry actions remain available.
        return;
      }
      const net = await verifyTestnet();
      if (runIdRef.current !== runId) return;
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
    },
    [pullBalance],
  );

  useEffect(() => {
    runIdRef.current += 1;
    const runId = runIdRef.current;
    void detectAndRestore(runId);
    return () => {
      runIdRef.current += 1;
    };
  }, [detectAndRestore]);

  const connect = useCallback(async () => {
    setSession((prev) => ({ ...prev, lastError: null }));
    const access = await requestAccessResult();
    if (!access.ok) {
      setSession((prev) => ({
        ...prev,
        phase: prev.phase === "checking" ? "disconnected" : prev.phase,
        lastError: access.code,
      }));
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

  /** Manual recovery path after installing or unlocking Freighter. */
  const recheckWallet = useCallback(() => {
    runIdRef.current += 1;
    void detectAndRestore(runIdRef.current);
  }, [detectAndRestore]);

  const disconnect = useCallback(() => {
    runIdRef.current += 1;
    setSession({ ...EMPTY_SESSION, phase: "disconnected" });
  }, []);

  return {
    session,
    connect,
    disconnect,
    recheckNetwork,
    recheckWallet,
    refreshBalance: pullBalance,
  };
}
