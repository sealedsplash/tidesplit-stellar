/**
 * Inline validation for the TideSplit expense form.
 * Each rule produces a human explanation, not just a flag.
 */
import { MAX_PARTICIPANTS, MIN_PARTICIPANTS } from "./calculator";

const ADDRESS_PATTERN = /^G[A-Z2-7]{55}$/;

export interface FormIssues {
  total?: string;
  participants?: string;
  recipient?: string;
}

export function validateSplitForm(
  totalXlm: string,
  participants: string,
  recipient: string,
  balanceXlm: string | null,
): FormIssues {
  const issues: FormIssues = {};

  const total = Number.parseFloat(totalXlm.trim());
  if (totalXlm.trim() === "" || !Number.isFinite(total)) {
    issues.total = "Enter the total expense amount in XLM.";
  } else if (total <= 0) {
    issues.total = "The total must be a positive amount.";
  } else if (total > 1_000_000) {
    issues.total = "That total exceeds the supported range.";
  }

  const people = Number.parseInt(participants, 10);
  if (participants.trim() === "" || Number.isNaN(people)) {
    issues.participants = `Enter how many people are sharing, from ${MIN_PARTICIPANTS} to ${MAX_PARTICIPANTS}.`;
  } else if (people < MIN_PARTICIPANTS || people > MAX_PARTICIPANTS) {
    issues.participants = `Participant count must stay between ${MIN_PARTICIPANTS} and ${MAX_PARTICIPANTS}.`;
  }

  if (!ADDRESS_PATTERN.test(recipient.trim())) {
    issues.recipient =
      "Enter the full Stellar address that will receive this share. It starts with G and has exactly 56 characters.";
  }

  if (
    !issues.total &&
    balanceXlm !== null &&
    total >= Number.parseFloat(balanceXlm)
  ) {
    issues.total =
      "Your balance cannot cover this total. Lower the amount or top up from the Testnet faucet first.";
  }

  return issues;
}
