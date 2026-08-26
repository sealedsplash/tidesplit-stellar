import { useCallback, useRef, useState } from "react";
import { signEnvelope } from "../wallet/freighterAdapter";
import {
  createPaymentEnvelope,
  submitSettlement,
  EXPLORER_BASE,
} from "../wallet/horizonClient";

export type SettlementStatus = "idle" | "signing" | "submitting" | "confirmed" | "failed";

export interface SettlementRecord {
  status: SettlementStatus;
  hash: string | null;
  explorerUrl: string | null;
  explanation: string | null;
}

const IDLE: SettlementRecord = {
  status: "idle",
  hash: null,
  explorerUrl: null,
  explanation: null,
};

export interface SettlementApi {
  record: SettlementRecord;
  settle: (sender: string, recipient: string, shareXlm: string) => Promise<void>;
  clear: () => void;
}

/**
 * Runs one settlement at a time; a ref lock prevents duplicate envelopes
 * while signing or submission is in progress.
 */
export function useSettlement(): SettlementApi {
  const [record, setRecord] = useState<SettlementRecord>(IDLE);
  const busyRef = useRef(false);

  const settle = useCallback(
    async (sender: string, recipient: string, shareXlm: string) => {
      if (busyRef.current) return;
      busyRef.current = true;

      setRecord({ ...IDLE, status: "signing" });

      const envelope = await createPaymentEnvelope(sender, recipient, shareXlm);
      if (!envelope.ok) {
        setRecord({
          status: "failed",
          hash: null,
          explorerUrl: null,
          explanation:
            envelope.reason === "SOURCE_UNAVAILABLE"
              ? "Your account could not be loaded from the Testnet. It may be unfunded or unreachable."
              : "The payment could not be assembled. Verify the recipient address belongs to an existing Testnet account.",
        });
        busyRef.current = false;
        return;
      }

      const signed = await signEnvelope(envelope.unsigned);
      if (!signed.ok) {
        setRecord({
          status: "failed",
          hash: null,
          explorerUrl: null,
          explanation:
            signed.code === "SIGN_DECLINED"
              ? "You declined to sign in Freighter. No funds moved; the calculated share is unchanged and you can try again."
              : "Freighter was unavailable for signing. Unlock the extension and retry the settlement.",
        });
        busyRef.current = false;
        return;
      }

      setRecord({ ...IDLE, status: "submitting" });
      const outcome = await submitSettlement(signed.data);
      if (outcome.ok) {
        setRecord({
          status: "confirmed",
          hash: outcome.hash,
          explorerUrl: `${EXPLORER_BASE}/${outcome.hash}`,
          explanation: null,
        });
      } else {
        setRecord({
          status: "failed",
          hash: null,
          explorerUrl: null,
          explanation: explain(outcome.reason),
        });
      }
      busyRef.current = false;
    },
    [],
  );

  const clear = useCallback(() => setRecord(IDLE), []);

  return { record, settle, clear };
}

function explain(reason: string): string {
  switch (reason) {
    case "NO_BALANCE":
      return "The Testnet rejected this settlement because your balance cannot cover the share plus reserves. Send a smaller amount or top up first.";
    case "BAD_ENVELOPE":
      return "The network considered the transaction malformed. Check the amount format and try again.";
    default:
      return "The Stellar Testnet did not accept the transaction right now. This is often temporary; please retry.";
  }
}
