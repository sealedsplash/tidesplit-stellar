/**
 * TideSplit Freighter adapter.
 * Uses the official @stellar/freighter-api package (4.x result-object
 * shapes) so detection survives asynchronous extension injection. Every
 * call resolves to an explicit result object; UI code never inspects raw
 * SDK payloads or the fragile window.freighter global.
 */
import {
  getAddress,
  getNetwork,
  isConnected,
  isAllowed,
  requestAccess,
  signTransaction as freighterSignTransaction,
} from "@stellar/freighter-api";

export type AdapterErrorCode =
  | "EXTENSION_MISSING"
  | "DETECTING"
  | "WALLET_LOCKED"
  | "ACCESS_DENIED"
  | "NETWORK_MISMATCH"
  | "NETWORK_UNKNOWN"
  | "SIGN_DECLINED"
  | "SIGN_ERROR";

export type AdapterResult<T> = { ok: true; data: T } | { ok: false; code: AdapterErrorCode };

export const REQUIRED_NETWORK = "TESTNET";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

/** Bounded window for late content-script injection. */
export const DETECTION_TIMEOUT_MS = 8000;
const DETECTION_INTERVAL_MS = 250;

/**
 * Poll the official isConnected() API until the extension answers or the
 * deadline passes. Injection is asynchronous in Chrome, so a first-render
 * synchronous probe would misreport an installed wallet as missing.
 */
export async function waitForFreighter(
  timeoutMs: number = DETECTION_TIMEOUT_MS,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const result = await isConnected();
      if (!result.error && result.isConnected === true) {
        return true;
      }
    } catch {
      // Transient messaging failure: keep polling until the deadline.
    }
    if (Date.now() >= deadline) {
      return false;
    }
    await new Promise((resolve) => setTimeout(resolve, DETECTION_INTERVAL_MS));
  }
}

export async function requestAccessResult(): Promise<AdapterResult<string>> {
  try {
    const response = await requestAccess();
    if (response.error) {
      return { ok: false, code: "ACCESS_DENIED" };
    }
    if (!response.address) {
      // Empty address without an error means the wallet could not resolve
      // an account: locked or no account created yet.
      return { ok: false, code: "WALLET_LOCKED" };
    }
    return { ok: true, data: response.address };
  } catch {
    return { ok: false, code: "ACCESS_DENIED" };
  }
}

export async function currentNetwork(): Promise<AdapterResult<string>> {
  try {
    const response = await getNetwork();
    if (response.error || !response.network) {
      return { ok: false, code: "NETWORK_UNKNOWN" };
    }
    return { ok: true, data: response.network };
  } catch {
    return { ok: false, code: "NETWORK_UNKNOWN" };
  }
}

export async function verifyTestnet(): Promise<AdapterResult<"TESTNET">> {
  const network = await currentNetwork();
  if (!network.ok) {
    return network;
  }
  if (network.data !== REQUIRED_NETWORK) {
    return { ok: false, code: "NETWORK_MISMATCH" };
  }
  return { ok: true, data: "TESTNET" };
}

/**
 * Resume an existing grant without prompting.
 * - address string: session restored
 * - null: nothing to restore yet (never granted)
 * - "WALLET_LOCKED": granted but the wallet cannot answer right now
 * - "DETECTING": transient bridge failure, worth retrying
 */
export async function storedAddress(): Promise<
  string | "WALLET_LOCKED" | "DETECTING" | null
> {
  try {
    const allowed = await isAllowed();
    if (allowed.error) {
      return "DETECTING";
    }
    if (!allowed.isAllowed) {
      return null;
    }
    const response = await getAddress();
    if (response.error) {
      return "WALLET_LOCKED";
    }
    return response.address || "WALLET_LOCKED";
  } catch {
    return null;
  }
}

export async function signEnvelope(xdr: string): Promise<AdapterResult<string>> {
  try {
    const response = await freighterSignTransaction(xdr, {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    if (response.error || !response.signedTxXdr) {
      return { ok: false, code: "SIGN_DECLINED" };
    }
    return { ok: true, data: response.signedTxXdr };
  } catch {
    return { ok: false, code: "SIGN_DECLINED" };
  }
}
