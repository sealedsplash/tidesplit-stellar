import type { SettlementRecord } from "../hooks/useSettlement";

interface Props {
  record: SettlementRecord;
  onDismiss: () => void;
}

/** Settlement receipt: signing → submitting → confirmed / failed. */
export function SettlementReceipt({ record, onDismiss }: Props) {
  if (record.status === "idle") return null;

  return (
    <section className="panel" aria-live="polite" aria-labelledby="receipt-title">
      <h2 className="panel-heading" id="receipt-title">
        Settlement status
      </h2>

      {record.status === "signing" && (
        <p className="banner banner-pending">
          Waiting for you to approve the signature in Freighter…
        </p>
      )}

      {record.status === "submitting" && (
        <p className="banner banner-pending">Sending your share to the Stellar Testnet…</p>
      )}

      {record.status === "confirmed" && (
        <>
          <p className="banner banner-ok">
            Share settled. The payment is confirmed on the Testnet ledger.
          </p>
          <dl className="facts">
            <div>
              <dt>Transaction</dt>
              <dd className="mono small">{record.hash}</dd>
            </div>
            <div>
              <dt>Explorer</dt>
              <dd>
                <a href={record.explorerUrl ?? "#"} target="_blank" rel="noreferrer noopener">
                  View on Stellar Expert
                </a>
              </dd>
            </div>
          </dl>
        </>
      )}

      {record.status === "failed" && (
        <p className="banner banner-error" role="alert">
          {record.explanation}
        </p>
      )}

      {(record.status === "confirmed" || record.status === "failed") && (
        <button type="button" className="btn-outline-ts" onClick={onDismiss}>
          {record.status === "confirmed" ? "Split another expense" : "Adjust and retry"}
        </button>
      )}
    </section>
  );
}
