/**
 * TideSplit Freighter adapter.
 * Wraps every extension call in an explicit result object so UI code
 * never inspects raw SDK payloads.
 */
export type AdapterErrorCode =
  | "EXTENSION_MISSING"
  | "ACCESS_DENIED"
  | "NETWORK_MISMATCH"
  | "NETWORK_UNKNOWN"
  | "SIGN_DECLINED"
  | "SIGN_ERROR";

export type AdapterResult<T> = { ok: true; data: T } | { ok: false; code: AdapterErrorCode };

export const REQUIRED_NETWORK = "TESTNET";
const TESTNET_PASSPHRASE = "Test SDF Network ; September 2015";

interface FreighterWindow {
  freighter?: {
    isAvailable?: () => Promise<boolean>;
    requestAccess?: () => Promise<{ address?: string; error?: unknown }>;
    getNetwork?: () => Promise<{ network?: string; error?: unknown }>;
    getAddress?: () => Promise<{ address?: string; error?: unknown }>;
    signTransaction?: (
      xdr: string,
      opts?: Record<string, unknown>,
    ) => Promise<{ signedTxXdr?: string; signedTransaction?: string; error?: unknown }>;
  };
}

function api() {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as FreighterWindow).freighter;
}

/** Synchronous probe usable during first render. */
export function hasFreighter(): boolean {
  return Boolean(api());
}

export async function requestAccess(): Promise<AdapterResult<string>> {
  if (!api()) {
    return { ok: false, code: "EXTENSION_MISSING" };
  }
  try {
    const response = await api()!.requestAccess!();
    const address = response?.address;
    if (!address || response?.error) {
      return { ok: false, code: "ACCESS_DENIED" };
    }
    return { ok: true, data: address };
  } catch {
    return { ok: false, code: "ACCESS_DENIED" };
  }
}

export async function currentNetwork(): Promise<AdapterResult<string>> {
  if (!api()) {
    return { ok: false, code: "EXTENSION_MISSING" };
  }
  try {
    const response = await api()!.getNetwork!();
    if (!response?.network) {
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

export async function storedAddress(): Promise<string | null> {
  try {
    const response = await api()?.getAddress?.();
    return response?.address ?? null;
  } catch {
    return null;
  }
}

export async function signEnvelope(xdr: string): Promise<AdapterResult<string>> {
  if (!api()?.signTransaction) {
    return { ok: false, code: "EXTENSION_MISSING" };
  }
  try {
    const response = await api()!.signTransaction!(xdr, {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    const signed = response?.signedTxXdr ?? response?.signedTransaction;
    if (!signed || response?.error) {
      return { ok: false, code: "SIGN_DECLINED" };
    }
    return { ok: true, data: signed };
  } catch {
    return { ok: false, code: "SIGN_DECLINED" };
  }
}
