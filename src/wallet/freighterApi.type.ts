// Freighter API surface (subset used by TideSplit multi-wallet).
// Sourced from @stellar/freighter-api — the full SDK is bundled via
// freighterAdapter.ts; this type is only for the multiWallet.ts window probe.

export interface FreighterApi {
  requestAccess: () => Promise<{
    address: string;
    error?: { message: string };
  }>;
  getNetwork: () => Promise<{
    network: string;
    networkPassphrase: string;
    error?: { message: string };
  }>;
}
