/**
 * TideSplit Horizon client: Testnet balance lookup and share settlement.
 * All amounts use string decimals; conversion happens only at the edge.
 */
import { Asset, Horizon, Networks, Operation, TransactionBuilder } from "@stellar/stellar-sdk";

const HORIZON = "https://horizon-testnet.stellar.org";
export const PASSPHRASE = Networks.TESTNET;
export const EXPLORER_BASE = "https://stellar.expert/explorer/testnet/tx";

export type BalanceOutcome =
  | { ok: true; xlm: string }
  | { ok: false; reason: "UNFUNDED" | "HORIZON_DOWN" };

export async function readBalance(address: string): Promise<BalanceOutcome> {
  try {
    const server = new Horizon.Server(HORIZON);
    const account = await server.loadAccount(address);
    const native = account.balances.find((entry) => entry.asset_type === "native");
    return native
      ? { ok: true, xlm: native.balance }
      : { ok: false, reason: "UNFUNDED" };
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    return { ok: false, reason: status === 404 ? "UNFUNDED" : "HORIZON_DOWN" };
  }
}

export type EnvelopeOutcome =
  | { ok: true; unsigned: string }
  | { ok: false; reason: "SOURCE_UNAVAILABLE" | "BUILD_ERROR" };

/**
 * Build an unsigned payment envelope for the computed share.
 * The destination must already exist on Testnet (friendbot-funded).
 */
export async function createPaymentEnvelope(
  sender: string,
  recipient: string,
  amount: string,
): Promise<EnvelopeOutcome> {
  try {
    const server = new Horizon.Server(HORIZON);
    const source = await server.loadAccount(sender);
    const fee = await server.fetchBaseFee();
    const builder = new TransactionBuilder(source, {
      fee: fee.toString(),
      networkPassphrase: PASSPHRASE,
    });
    builder.addOperation(
      Operation.payment({
        destination: recipient,
        asset: Asset.native(),
        amount,
      }),
    );
    builder.setTimeout(120);
    return { ok: true, unsigned: builder.build().toXDR() };
  } catch {
    return { ok: false, reason: "BUILD_ERROR" };
  }
}

export type SettleOutcome =
  | { ok: true; hash: string }
  | { ok: false; reason: "NO_BALANCE" | "REJECTED_BY_NETWORK" | "BAD_ENVELOPE" };

/** Submit a signed settlement envelope and classify any failure. */
export async function submitSettlement(signedXdr: string): Promise<SettleOutcome> {
  let parsed: ReturnType<typeof TransactionBuilder.fromXDR>;
  try {
    parsed = TransactionBuilder.fromXDR(signedXdr, PASSPHRASE);
  } catch {
    return { ok: false, reason: "BAD_ENVELOPE" };
  }
  try {
    const server = new Horizon.Server(HORIZON);
    const response = await server.submitTransaction(parsed);
    return { ok: true, hash: response.hash };
  } catch (error) {
    const codes = (
      error as {
        response?: { data?: { extras?: { result_codes?: { transaction?: string } } } };
      }
    ).response?.data?.extras?.result_codes;
    if (codes?.transaction === "tx_insufficient_balance") {
      return { ok: false, reason: "NO_BALANCE" };
    }
    if (codes?.transaction === "tx_malformed") {
      return { ok: false, reason: "BAD_ENVELOPE" };
    }
    return { ok: false, reason: "REJECTED_BY_NETWORK" };
  }
}
