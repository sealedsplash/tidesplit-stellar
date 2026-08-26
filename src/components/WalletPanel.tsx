import type { WalletSession } from "../hooks/useWalletSession";

const ERROR_COPY: Record<string, string> = {
  EXTENSION_MISSING:
    "Freighter is not installed in this browser. Get it at freighter.app, then reload TideSplit.",
  WALLET_LOCKED:
    "Freighter is locked. Unlock the extension, then press Check again.",
  ACCESS_DENIED:
    "Access was declined, so TideSplit cannot see your address. Press Connect when you are ready to allow it.",
  NETWORK_MISMATCH:
    "Freighter is not on the Stellar Testnet. Switch networks in the extension, then check again.",
  NETWORK_UNKNOWN:
    "TideSplit could not read which network Freighter is on. Open the extension and check its status.",
};

interface Props {
  session: WalletSession;
  connecting: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onRecheck: () => void;
}

/** Connection card: connect/disconnect controls, guard notice, balance. */
export function WalletPanel({
  session,
  connecting,
  onConnect,
  onDisconnect,
  onRecheck,
}: Props) {
  // Bounded detection window: never claim the wallet is missing here.
  if (session.phase === "checking") {
    return (
      <section className="panel" aria-labelledby="wallet-title">
        <h2 className="panel-heading" id="wallet-title">
          Your wallet
        </h2>
        <p className="banner banner-info" role="status">
          Checking for the Freighter extension…
        </p>
      </section>
    );
  }

  // Only after the detection deadline has elapsed do we show this.
  if (session.phase === "missing") {
    return (
      <section className="panel" aria-labelledby="wallet-title">
        <h2 className="panel-heading" id="wallet-title">
          Your wallet
        </h2>
        <p className="banner banner-error" role="alert">
          No Freighter extension detected. TideSplit needs it to hold your keys
          and sign settlements.{" "}
          <a href="https://www.freighter.app/" target="_blank" rel="noreferrer noopener">
            Install Freighter
          </a>{" "}
          — if you just enabled it, press Check again.
        </p>
        <button type="button" className="btn-outline-ts" onClick={onRecheck}>
          Check again
        </button>
      </section>
    );
  }

  if (session.phase !== "connected") {
    return (
      <section className="panel" aria-labelledby="wallet-title">
        <h2 className="panel-heading" id="wallet-title">
          Your wallet
        </h2>
        <p style={{ marginTop: 0 }}>
          Connect Freighter to see your balance and settle shares on the Stellar
          Testnet.
        </p>
        {session.lastError && (
          <p className="banner banner-error" role="alert">
            {ERROR_COPY[session.lastError] ?? "Connecting did not complete. Please try again."}
          </p>
        )}
        <div className="btn-row">
          <button type="button" className="btn-primary-ts" onClick={onConnect} disabled={connecting}>
            {connecting ? "Connecting…" : "Connect Freighter"}
          </button>
          <button type="button" className="btn-outline-ts" onClick={onRecheck}>
            Check again
          </button>
        </div>
      </section>
    );
  }

  const balanceText =
    session.balanceState === "loading"
      ? "Checking balance…"
      : session.balanceState === "ready"
        ? `${session.balanceXlm} XLM`
        : session.balanceState === "unfunded"
          ? "Unfunded account"
          : session.balanceState === "unreachable"
            ? "Balance unavailable"
            : "—";

  return (
    <section className="panel" aria-labelledby="wallet-title">
      <h2 className="panel-heading" id="wallet-title">
        Your wallet
      </h2>

      {!session.onTestnet && (
        <p className="banner banner-warn" role="alert">
          Freighter is not on the Test Network. Switch networks in the extension,
          then press Check again — settlements stay locked until then.
        </p>
      )}

      <dl className="facts">
        <div>
          <dt>Address</dt>
          <dd className="mono">
            {session.address?.slice(0, 6)}…{session.address?.slice(-4)}
          </dd>
        </div>
        <div>
          <dt>Balance</dt>
          <dd>{balanceText}</dd>
        </div>
        <div>
          <dt>Network</dt>
          <dd>
            {session.onTestnet === null
              ? "Detecting…"
              : session.onTestnet
                ? "Testnet"
                : "Wrong network"}
          </dd>
        </div>
      </dl>

      <div className="btn-row">
        {!session.onTestnet && (
          <button type="button" className="btn-outline-ts" onClick={onRecheck}>
            Check again
          </button>
        )}
        <button type="button" className="btn-quiet-ts" onClick={onDisconnect}>
          Disconnect
        </button>
      </div>
    </section>
  );
}
