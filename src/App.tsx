import { useState } from "react";
import { useWalletSession } from "./hooks/useWalletSession";
import { useSettlement } from "./hooks/useSettlement";
import { WalletPanel } from "./components/WalletPanel";
import { SplitPanel } from "./components/SplitPanel";
import { SettlementReceipt } from "./components/SettlementReceipt";
import { WaveDivider } from "./components/WaveDivider";

export default function App() {
  const { session, connect, disconnect, recheckNetwork } = useWalletSession();
  const settlement = useSettlement();
  const [connecting, setConnecting] = useState(false);

  const guarded = session.phase === "connected" && session.onTestnet === true;

  async function handleConnect() {
    setConnecting(true);
    await connect();
    setConnecting(false);
  }

  return (
    <div className="page">
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
          onRecheck={() => void recheckNetwork()}
        />

        <SplitPanel
          balanceXlm={session.balanceXlm}
          locked={!guarded || settlement.record.status !== "idle"}
          onSettle={(recipient, shareXlm) => {
            if (session.address) {
              void settlement.settle(session.address, recipient, shareXlm);
            }
          }}
        />

        <SettlementReceipt record={settlement.record} onDismiss={settlement.clear} />
      </main>
    </div>
  );
}
