import type { TransactionStatus } from "./contractService";

export type PoolInput = { title: string; total: string; participants: string };
export type ValidPoolInput = { title: string; totalStroops: bigint; participants: number };

export function validatePoolInput(input: PoolInput): { ok: true; value: ValidPoolInput } | { ok: false; message: string } {
  const title = input.title.trim();
  if (title.length < 2 || title.length > 64) return { ok: false, message: "Pool title must be 2–64 characters." };
  if (!/^\d+(\.\d{1,7})?$/.test(input.total) || Number(input.total) <= 0) return { ok: false, message: "Enter a positive XLM total with at most 7 decimals." };
  const participants = Number(input.participants);
  if (!Number.isInteger(participants) || participants < 2 || participants > 100) return { ok: false, message: "Participants must be a whole number from 2 to 100." };
  const [whole, fraction = ""] = input.total.split(".");
  const totalStroops = BigInt(whole) * 10_000_000n + BigInt(fraction.padEnd(7, "0"));
  return { ok: true, value: { title, totalStroops, participants } };
}

export function canStartTransaction(status: TransactionStatus) {
  return status === "idle" || status === "success" || status === "failure";
}

export function hasEnoughFeeBalance(balanceXlm: string | null) {
  if (balanceXlm === null) return true;
  const amount = Number(balanceXlm);
  return Number.isFinite(amount) && amount >= 0.01;
}
