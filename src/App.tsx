import { useState } from "react";
import { useWalletSession } from "./hooks/useWalletSession";
import { useSettlement } from "./hooks/useSettlement";
import { useRecentSplits } from "./hooks/useRecentSplits";
import { WalletPanel } from "./components/WalletPanel";
import { SplitPanel } from "./components/SplitPanel";
import { SettlementReceipt } from "./components/SettlementReceipt";
import { RecentSplitsCard } from "./components/RecentSplitsCard";
import { WaveDivider } from "./components/WaveDivider";

export default function App() {
  const { session, connect, disconnect, recheckNetwork, recheckWallet } =
    useWalletSession();
  const settlement = useSettlement();
  const recentSplits = useRecentSplits();
  const [connecting, setConnecting] = useState(false);

  const guarded = session.phase === "connected" && session.onTestnet === true;

  async function handleConnect() {
    setConnecting(true);
    await connect();
    setConnecting(false);
  }

  function handleSettle(recipient: string, shareXlm: string, totalXlm: string, participants: number) {
    if (!session.address) return;
    void settlement.settle(session.address, recipient, shareXlm);
    recentSplits.record({
      totalXlm,
      participants,
      shareXlm,
      recipient,
    });
  }

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        Skip to main content
      </a>

      <header className="masthead">
        <h1 className="wordmark">TideSplit</h1>
        <p className="slogan">
          Divide a shared expense into exact per-person shares and settle yours
          in XLM on the Stellar Testnet.
        </p>
      </header>

      <WaveDivider />

      <main className="stack" id="main">
        <WalletPanel
          session={session}
          connecting={connecting}
          onConnect={() => void handleConnect()}
          onDisconnect={disconnect}
          onRecheck={() => {
            if (session.phase === "connected") {
              void recheckNetwork();
            } else {
              recheckWallet();
            }
          }}
        />

        <SplitPanel
          balanceXlm={session.balanceXlm}
          locked={!guarded || settlement.record.status !== "idle"}
          onSettle={(recipient, shareXlm, totalXlm, participants) =>
            handleSettle(recipient, shareXlm, totalXlm, participants)
          }
        />

        <SettlementReceipt record={settlement.record} onDismiss={settlement.clear} />

        <RecentSplitsCard recent={recentSplits.recent} onClear={recentSplits.clearAll} />
      </main>
    </div>
  );
}
