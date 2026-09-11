import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { createPool, DEFAULT_CONTRACT_ID, getPool, getPoolCount, pollContractEvents, recordPayment, type ActivityEvent, type ContractPool, type TransactionStatus } from "./contract/contractService";
import { useMultiWalletState } from "./wallet/multiWallet";
import { readBalance } from "./wallet/horizonClient";
import { canStartTransaction, hasEnoughFeeBalance, validatePoolInput } from "./contract/transactionGuard";
import "./styles/splash.css";

const compact = (value: string) => value ? `${value.slice(0, 5)}…${value.slice(-5)}` : "—";
const xlm = (stroops: bigint) => `${Number(stroops) / 10_000_000} XLM`;

export default function App() {
  const wallet = useMultiWalletState();
  const [balance, setBalance] = useState<string | null>(null);
  const [pool, setPool] = useState<ContractPool | null>(null);
  const [poolId, setPoolId] = useState("0");
  const [status, setStatus] = useState<TransactionStatus>("idle");
  const [hash, setHash] = useState("");
  const [error, setError] = useState("");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [eventsOnline, setEventsOnline] = useState(true);
  const cursor = useRef<string>();
  const transactionLock = useRef(false);
  const busy = !["idle", "success", "failure"].includes(status);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!wallet.address) { setBalance(null); return; }
      void readBalance(wallet.address).then((result) => setBalance(result.ok ? result.xlm : result.reason === "UNFUNDED" ? "0" : null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [wallet.address]);

  const sync = useCallback(async () => {
    if (!wallet.address || !DEFAULT_CONTRACT_ID) return;
    try {
      const count = await getPoolCount(wallet.address);
      if (count > 0) { const latest = count - 1; setPoolId(String(latest)); setPool(await getPool(wallet.address, latest)); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not sync contract state."); }
  }, [wallet.address]);

  useEffect(() => {
    const timer = window.setTimeout(() => void sync(), 0);
    return () => window.clearTimeout(timer);
  }, [sync]);
  useEffect(() => {
    if (!DEFAULT_CONTRACT_ID) return;
    let active = true;
    const tick = async () => {
      try {
        const result = await pollContractEvents(cursor.current);
        if (!active) return;
        cursor.current = result.cursor ?? cursor.current; setEvents((old) => [...result.events, ...old].slice(0, 12)); setEventsOnline(true);
      } catch { if (active) setEventsOnline(false); }
    };
    void tick(); const timer = window.setInterval(() => void tick(), 6000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const run = async (operation: () => Promise<{ hash: string }>) => {
    if (transactionLock.current || !canStartTransaction(status)) return;
    if (!hasEnoughFeeBalance(balance)) { setError("Insufficient XLM for the Testnet network fee."); setStatus("failure"); return; }
    transactionLock.current = true;
    setError(""); setHash(""); setStatus("signing");
    try { const result = await operation(); setHash(result.hash); setStatus("success"); await sync(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Transaction failed."); setStatus("failure"); }
    finally { transactionLock.current = false; }
  };

  const submitPool = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!wallet.address) return;
    const data = new FormData(event.currentTarget);
    const validation = validatePoolInput({ title: String(data.get("title") ?? ""), total: String(data.get("total") ?? ""), participants: String(data.get("participants") ?? "") });
    if (!validation.ok) { setError(validation.message); setStatus("failure"); return; }
    await run(() => createPool(wallet.address!, validation.value, setStatus));
  };

  const loadPool = async () => {
    if (!wallet.address || !/^\d+$/.test(poolId)) { setError("Enter a valid numeric pool ID."); return; }
    setError(""); try { setPool(await getPool(wallet.address, Number(poolId))); } catch (cause) { setError(cause instanceof Error ? cause.message : "Pool not found."); }
  };

  const progress = useMemo(() => pool ? Math.round(pool.payments / pool.participants * 100) : 0, [pool]);

  return (
    <div className="ocean-shell">
      <a className="skip-link" href="#workspace">Skip to workspace</a>
      <div className="orb orb-a" aria-hidden="true" /><div className="orb orb-b" aria-hidden="true" />
      <header className="topbar">
        <a className="brand" href="#top" aria-label="TideSplit home"><span className="brand-drop">T</span><span>TideSplit</span></a>
        <span className="network-pill"><i aria-hidden="true" /> STELLAR TESTNET</span>
        {wallet.address ? <button type="button" className="wallet-chip" onClick={() => void wallet.disconnect()} aria-label={`Disconnect wallet ${compact(wallet.address)}`}><span>{compact(wallet.address)}</span><b>{balance === null ? "Syncing…" : `${balance} XLM`}</b></button> : <a className="ghost-link" href="#wallets">Connect wallet</a>}
      </header>

      <main id="top">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy"><p className="eyebrow">ON-CHAIN SHARED EXPENSES</p><h1 id="hero-title">Make every share<br/><em>land perfectly.</em></h1><p className="hero-lede">Create transparent expense pools. Split to the stroop. Leave an immutable ripple on Stellar.</p><a className="primary" href="#workspace">Open the workspace <span>↘</span></a></div>
          <div className="ripple-stage" aria-hidden="true"><div className="drop"/><div className="ripple r1"/><div className="ripple r2"/><div className="ripple r3"/><div className="float-card one"><span>Pool #12</span><b>4 / 6 settled</b></div><div className="float-card two"><span>Last ripple</span><b>+ 18.4 XLM</b></div></div>
        </section>

        <section className="wallet-section" id="wallets" aria-labelledby="wallet-title">
          <div><p className="eyebrow">01 — ENTER THE CURRENT</p><h2 id="wallet-title">Choose your wallet</h2><p>Powered by StellarWalletsKit. Testnet only; your keys never touch TideSplit.</p></div>
          <div className="wallet-grid">
            {wallet.wallets.map((item) => <button type="button" key={item.id} disabled={wallet.connecting} aria-pressed={wallet.selectedId === item.id} aria-label={`${item.name}, ${item.available ? "ready to connect" : "not detected"}`} className={`wallet-option ${wallet.selectedId === item.id ? "selected" : ""}`} onClick={() => void wallet.connect(item.id)}><img src={item.icon} alt=""/><span><b>{item.name}</b><small>{wallet.connecting && wallet.selectedId === item.id ? "Awaiting approval…" : item.available ? "Ready" : "Not detected"}</small></span><i aria-hidden="true" className={item.available ? "online" : ""}/></button>)}
          </div>
          {wallet.error && <div className="notice error" role="alert"><b>{wallet.error.code.replaceAll("_", " ")}</b><span>{wallet.error.message}</span></div>}
        </section>

        <section className="workspace" id="workspace" aria-labelledby="workspace-title">
          <div className="section-head"><div><p className="eyebrow">02 — SHAPE THE SPLIT</p><h2 id="workspace-title">Settlement workspace</h2></div><div className="contract-badge"><span>CONTRACT</span><b>{DEFAULT_CONTRACT_ID ? compact(DEFAULT_CONTRACT_ID) : "AWAITING DEPLOY"}</b></div></div>
          {!wallet.address ? <div className="locked-state"><span>≈</span><h3>Connect to enter the workspace</h3><p>Select any available wallet above. TideSplit checks Testnet before enabling writes.</p></div> : !DEFAULT_CONTRACT_ID ? <div className="locked-state"><span>◌</span><h3>Contract deployment queued</h3><p>Run the Testnet Deploy workflow; it writes the real Contract ID back to this repository.</p></div> : <div className="workspace-grid">
            <form className="create-card" onSubmit={(e) => void submitPool(e)}><div className="card-index">NEW POOL</div><label>What are we splitting?<input name="title" maxLength={64} placeholder="Lisbon studio dinner" required/></label><div className="field-row"><label>Total<input name="total" inputMode="decimal" placeholder="120.00" required/><small>XLM</small></label><label>People<input name="participants" type="number" min="2" max="100" defaultValue="4" required/></label></div><div className="share-preview"><span>Each participant pays</span><strong>calculated on-chain</strong></div><button className="primary wide" disabled={busy}>Create contract pool <span>↗</span></button></form>
            <div className="pool-card"><div className="pool-search"><label htmlFor="pool-id">POOL ID</label><input id="pool-id" value={poolId} onChange={(e) => setPoolId(e.target.value)} inputMode="numeric" aria-describedby="pool-id-hint"/><button type="button" onClick={() => void loadPool()}>Load</button><span className="sr-only" id="pool-id-hint">Enter a numeric on-chain pool identifier</span></div>{pool ? <><div className="pool-title"><span>POOL #{pool.id}</span><h3>{pool.title}</h3><p>by {compact(pool.creator)}</p></div><div className="pool-amount"><span>YOUR EXACT SHARE</span><strong>{xlm(pool.shareStroops)}</strong><small>of {xlm(pool.totalStroops)} total</small></div><div className="progress" role="progressbar" aria-label="Pool settlement progress" aria-valuemin={0} aria-valuemax={pool.participants} aria-valuenow={pool.payments}><div style={{width:`${progress}%`}}/><span>{pool.payments} of {pool.participants} ripples recorded</span></div><button type="button" className="secondary wide" disabled={busy || pool.payments >= pool.participants} onClick={() => void run(() => recordPayment(wallet.address!, pool, setStatus))}>Record my share on-chain</button></> : <div className="empty"><span aria-hidden="true">◌</span><p>No pool loaded yet.<br/>Create one or enter its ID.</p></div>}</div>
          </div>}
          {(status !== "idle" || error) && <div className={`tx-dock ${status}`} role={status === "failure" ? "alert" : "status"} aria-live={status === "failure" ? "assertive" : "polite"}><div className="tx-icon" aria-hidden="true">{status === "success" ? "✓" : status === "failure" ? "!" : "≈"}</div><div><small>TRANSACTION STATUS</small><b>{status === "submitting" ? "Submitting to Testnet" : status}</b><p>{error || (status === "success" ? "Your ripple is final on Stellar." : "Keep this window open while the network confirms.")}</p>{hash && <a href={`https://stellar.expert/explorer/testnet/tx/${hash}`} target="_blank" rel="noreferrer">{compact(hash)} · Open Stellar Expert ↗</a>}</div>{["success","failure"].includes(status) && <button type="button" onClick={() => {setStatus("idle");setError("");setHash("")}}>Dismiss</button>}</div>}
        </section>

        <section className="activity" aria-labelledby="activity-title"><div className="activity-head"><div><p className="eyebrow">03 — FOLLOW THE RIPPLES</p><h2 id="activity-title">Live contract activity</h2></div><span className={eventsOnline ? "live" : "offline"} role="status"><i aria-hidden="true"/>{eventsOnline ? "POLLING LIVE" : "RPC RETRYING"}</span></div><div className="event-list">{events.length ? events.map((event) => <a key={event.id} href={event.txHash ? `https://stellar.expert/explorer/testnet/tx/${event.txHash}` : "#workspace"}><span className="event-icon" aria-hidden="true">≈</span><b>{event.kind === "paid" ? "Share recorded" : "New pool created"}</b><small>Ledger {event.ledger}</small><em>{event.at ? new Date(event.at).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"}) : "live"}</em></a>) : <div className="activity-empty"><span aria-hidden="true">≈</span><p>The surface is calm.<br/>New contract events will appear here automatically.</p></div>}</div></section>
      </main>
      <footer><div className="brand"><span className="brand-drop">T</span><span>TideSplit</span></div><p>Built for Stellar Yellow Belt · Testnet only</p><a href={DEFAULT_CONTRACT_ID ? `https://stellar.expert/explorer/testnet/contract/${DEFAULT_CONTRACT_ID}` : "https://stellar.expert/explorer/testnet"} target="_blank" rel="noreferrer">View on Stellar Expert ↗</a></footer>
    </div>
  );
}
