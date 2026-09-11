import { useCallback, useEffect, useState } from "react";
import { Networks, StrKey } from "@stellar/stellar-sdk";
import type { StellarWalletsKit as StellarWalletsKitType } from "@creit.tech/stellar-wallets-kit/sdk";

export const TESTNET_PASSPHRASE = Networks.TESTNET;

export type WalletOption = { id: string; name: string; url: string; icon: string; available: boolean };
export type WalletErrorCode = "NOT_FOUND" | "REJECTED" | "WRONG_NETWORK" | "CONNECTION_FAILED";
export type WalletError = { code: WalletErrorCode; message: string };
const icon = (letter: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#10383a"/><text x="24" y="31" text-anchor="middle" font-family="sans-serif" font-size="22" font-weight="700" fill="#b9ffde">${letter}</text></svg>`)}`;
const FALLBACKS: WalletOption[] = [
  { id: "freighter", name: "Freighter", url: "https://freighter.app", icon: icon("F"), available: false },
  { id: "albedo", name: "Albedo", url: "https://albedo.link", icon: icon("A"), available: true },
  { id: "xbull", name: "xBull", url: "https://xbull.app", icon: icon("X"), available: false },
  { id: "rabet", name: "Rabet", url: "https://rabet.io", icon: icon("R"), available: false },
  { id: "lobstr", name: "LOBSTR", url: "https://lobstr.co", icon: icon("L"), available: false },
];

type Kit = typeof StellarWalletsKitType;
let kitPromise: Promise<Kit> | undefined;
function getKit(): Promise<Kit> {
  kitPromise ??= Promise.all([
    import("@creit.tech/stellar-wallets-kit/sdk"),
    import("@creit.tech/stellar-wallets-kit/types"),
    import("@creit.tech/stellar-wallets-kit/modules/albedo"),
    import("@creit.tech/stellar-wallets-kit/modules/freighter"),
    import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
    import("@creit.tech/stellar-wallets-kit/modules/rabet"),
    import("@creit.tech/stellar-wallets-kit/modules/xbull"),
  ]).then(([sdk, types, albedo, freighter, lobstr, rabet, xbull]) => {
    sdk.StellarWalletsKit.init({ modules: [new freighter.FreighterModule(), new albedo.AlbedoModule(), new xbull.xBullModule(), new rabet.RabetModule(), new lobstr.LobstrModule()], network: types.Networks.TESTNET, authModal: { showInstallLabel: true, hideUnsupportedWallets: false } });
    return sdk.StellarWalletsKit;
  });
  return kitPromise;
}

export function classifyWalletError(error: unknown): WalletError {
  const text = error instanceof Error ? error.message : String(error ?? "");
  const lower = text.toLowerCase();
  if (/reject|declin|cancel|denied|closed/.test(lower)) return { code: "REJECTED", message: "Connection was cancelled in your wallet. Nothing was submitted." };
  if (/not found|not installed|unavailable|extension/.test(lower)) return { code: "NOT_FOUND", message: "This wallet is not available here. Install it or choose another option." };
  if (/network|testnet|passphrase/.test(lower)) return { code: "WRONG_NETWORK", message: "Wrong network. Switch the wallet to Stellar Testnet and reconnect." };
  return { code: "CONNECTION_FAILED", message: "The wallet could not connect. Check the extension and try again." };
}

export function useMultiWalletState() {
  const [wallets, setWallets] = useState<WalletOption[]>(FALLBACKS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<WalletError | null>(null);
  const refresh = useCallback(async () => {
    try {
      const kit = await getKit();
      const supported = await kit.refreshSupportedWallets();
      setWallets(FALLBACKS.map((wallet) => {
        const found = supported.find((item) => item.id === wallet.id);
        return found ? { id: found.id, name: found.name, url: found.url, icon: found.icon, available: found.isAvailable } : wallet;
      }));
    } catch { setWallets(FALLBACKS); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
  }, [refresh]);
  const connect = useCallback(async (id: string) => {
    setConnecting(true); setSelectedId(id); setError(null);
    try {
      const option = wallets.find((wallet) => wallet.id === id);
      if (option && !option.available && id !== "albedo") throw new Error("wallet not installed or unavailable");
      const kit = await getKit();
      kit.setWallet(id);
      const result = await kit.fetchAddress();
      if (!StrKey.isValidEd25519PublicKey(result.address)) throw new Error("invalid wallet address");
      const network = await kit.getNetwork();
      if (network.networkPassphrase !== Networks.TESTNET) throw new Error("wrong network passphrase");
      setAddress(result.address);
    } catch (cause) { setAddress(null); setError(classifyWalletError(cause)); }
    finally { setConnecting(false); }
  }, [wallets]);
  const disconnect = useCallback(async () => {
    try { await (await getKit()).disconnect(); } catch { /* local disconnect still succeeds */ }
    setAddress(null); setSelectedId(null); setError(null);
  }, []);
  return { wallets, selectedId, address, connecting, error, connect, disconnect, refresh };
}

export async function signWithSelectedWallet(transactionXdr: string, address: string): Promise<string> {
  try {
    const { signedTxXdr } = await (await getKit()).signTransaction(transactionXdr, { networkPassphrase: Networks.TESTNET, address });
    if (!signedTxXdr) throw new Error("signing rejected");
    return signedTxXdr;
  } catch (error) {
    if (classifyWalletError(error).code === "REJECTED") throw new Error("SIGNING_REJECTED");
    throw error;
  }
}

export const FEATURED_WALLET_IDS = { freighter: "freighter", albedo: "albedo", xbull: "xbull", rabet: "rabet", lobstr: "lobstr" } as const;
