import { hasFreighter } from "../wallet/freighterAdapter";
import type { WalletSession } from "../hooks/useWalletSession";

const ERROR_COPY: Record<string, string> = {
  EXTENSION_MISSING:
    "Freighter is not installed in this browser. Get it at freighter.app, then reload TideSplit.",
  ACCESS_DENIED:
    "Access was declined, so TideSplit cannot see your address. Press Connect when you are ready to allow it.",
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
export function WalletPanel({ session, connecting, onConnect, onDisconnect, onRecheck }: Props) {
  if (!hasFreighter()) {
    return (
      <section className="panel" aria-labelledby="wallet-title">
        <h2 className="panel-heading" id="wallet-title">
          Your wallet
        </h2>
        <p className="banner banner-error">
          No Freighter extension detected. TideSplit needs it to hold your keys
          and sign settlements.{" "}
          <a href="https://www.freighter.app/" target="_blank" rel="noreferrer noopener">
            Install Freighter
          </a>{" "}
          and reload this page.
        </p>
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
        <button type="button" className="btn-primary-ts" onClick={onConnect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Freighter"}
        </button>
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
          <dd>{session.onTestnet === null ? "Detecting…" : session.onTestnet ? "Testnet" : "Wrong network"}</dd>
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
