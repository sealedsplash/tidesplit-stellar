import { Address, BASE_FEE, Contract, Networks, TransactionBuilder, nativeToScVal, rpc, scValToNative } from "@stellar/stellar-sdk";
import type { Transaction, xdr } from "@stellar/stellar-sdk";
import deployment from "../config/deployment.json";
import { signWithSelectedWallet } from "../wallet/multiWallet";

export const DEFAULT_RPC_URL = import.meta.env.VITE_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
export const DEFAULT_CONTRACT_ID = import.meta.env.VITE_CONTRACT_ID || deployment.contractId;
export const EXPLORER_ROOT = "https://stellar.expert/explorer/testnet";

export type TransactionStatus = "idle" | "signing" | "submitting" | "pending" | "success" | "failure";
export type ContractPool = { id: number; creator: string; title: string; totalStroops: bigint; participants: number; shareStroops: bigint; createdAt: number; payments: number };
export type ActivityEvent = { id: string; kind: "pool_new" | "paid"; ledger: number; at: string; txHash?: string };
export type TxResult = { hash: string; explorerUrl: string };

export class ContractServiceError extends Error {
  constructor(public code: "NOT_CONFIGURED" | "RPC_FAILURE" | "REJECTED" | "INSUFFICIENT_BALANCE" | "CONTRACT_FAILURE", message: string) { super(message); }
}

function assertConfigured() {
  if (!DEFAULT_CONTRACT_ID) throw new ContractServiceError("NOT_CONFIGURED", "The Testnet contract is awaiting deployment.");
}

function server() { return new rpc.Server(DEFAULT_RPC_URL, { allowHttp: DEFAULT_RPC_URL.startsWith("http:") }); }

export function normalizePool(value: unknown): ContractPool {
  const v = value as Record<string, unknown>;
  return { id: Number(v.id), creator: String(v.creator), title: String(v.title), totalStroops: BigInt(String(v.total_stroops)), participants: Number(v.participants), shareStroops: BigInt(String(v.share_stroops)), createdAt: Number(v.created_at), payments: Number(v.payments) };
}

async function simulate(method: string, source: string, ...args: xdr.ScVal[]) {
  assertConfigured();
  try {
    const account = await server().getAccount(source);
    const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(DEFAULT_CONTRACT_ID).call(method, ...args)).setTimeout(30).build();
    const response = await server().simulateTransaction(tx);
    if (rpc.Api.isSimulationError(response)) throw new Error(response.error);
    return response.result ? scValToNative(response.result.retval) : undefined;
  } catch (error) {
    if (error instanceof ContractServiceError) throw error;
    throw new ContractServiceError("RPC_FAILURE", error instanceof Error ? error.message : "Stellar RPC is unavailable");
  }
}

async function submit(method: string, source: string, onStatus: (status: TransactionStatus) => void, ...args: xdr.ScVal[]): Promise<TxResult> {
  assertConfigured();
  try {
    const rpcServer = server();
    const account = await rpcServer.getAccount(source);
    const raw = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
      .addOperation(new Contract(DEFAULT_CONTRACT_ID).call(method, ...args)).setTimeout(60).build();
    const prepared = await rpcServer.prepareTransaction(raw);
    onStatus("signing");
    let signedXdr: string;
    try { signedXdr = await signWithSelectedWallet(prepared.toXDR(), source); }
    catch (error) {
      if (error instanceof Error && error.message === "SIGNING_REJECTED") throw new ContractServiceError("REJECTED", "Signature request was rejected. No transaction was sent.");
      throw error;
    }
    onStatus("submitting");
    const signed = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET) as Transaction;
    const sent = await rpcServer.sendTransaction(signed);
    if (sent.status === "ERROR") {
      const detail = sent.errorResult?.toXDR("base64") ?? "contract rejected the transaction";
      if (/insufficient/i.test(detail)) throw new ContractServiceError("INSUFFICIENT_BALANCE", "Insufficient XLM for network fees.");
      throw new ContractServiceError("CONTRACT_FAILURE", detail);
    }
    if (sent.status === "TRY_AGAIN_LATER") throw new ContractServiceError("RPC_FAILURE", "Stellar RPC is busy. Retry in a few seconds.");
    onStatus("pending");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      const result = await rpcServer.getTransaction(sent.hash);
      if (result.status === rpc.Api.GetTransactionStatus.SUCCESS) return { hash: sent.hash, explorerUrl: `${EXPLORER_ROOT}/tx/${sent.hash}` };
      if (result.status === rpc.Api.GetTransactionStatus.FAILED) throw new ContractServiceError("CONTRACT_FAILURE", "The contract transaction failed on Testnet.");
    }
    throw new ContractServiceError("RPC_FAILURE", "Confirmation timed out. Check the transaction in Stellar Expert.");
  } catch (error) {
    if (error instanceof ContractServiceError) throw error;
    const text = error instanceof Error ? error.message : String(error);
    if (/balance|underfunded|insufficient/i.test(text)) throw new ContractServiceError("INSUFFICIENT_BALANCE", "Insufficient XLM for network fees.");
    throw new ContractServiceError("RPC_FAILURE", text || "Could not reach Stellar RPC.");
  }
}

export function createPool(address: string, input: { title: string; totalStroops: bigint; participants: number }, onStatus: (status: TransactionStatus) => void) {
  return submit("create_pool", address, onStatus, new Address(address).toScVal(), nativeToScVal(input.title), nativeToScVal(input.totalStroops, { type: "i128" }), nativeToScVal(input.participants, { type: "u32" }));
}

export function recordPayment(address: string, pool: ContractPool, onStatus: (status: TransactionStatus) => void) {
  return submit("record_payment", address, onStatus, new Address(address).toScVal(), nativeToScVal(pool.id, { type: "u64" }), nativeToScVal(pool.shareStroops, { type: "i128" }));
}

export async function getPool(address: string, id: number) { return normalizePool(await simulate("get_pool", address, nativeToScVal(id, { type: "u64" }))); }
export async function getPoolCount(address: string) { return Number(await simulate("pool_count", address)); }

export async function pollContractEvents(cursor?: string): Promise<{ events: ActivityEvent[]; cursor?: string }> {
  assertConfigured();
  try {
    const rpcServer = server();
    const request: rpc.Api.GetEventsRequest = cursor
      ? { filters: [{ type: "contract", contractIds: [DEFAULT_CONTRACT_ID] }], cursor, limit: 20 }
      : { filters: [{ type: "contract", contractIds: [DEFAULT_CONTRACT_ID] }], startLedger: Math.max(1, (await rpcServer.getLatestLedger()).sequence - 120), limit: 20 };
    const response = await rpcServer.getEvents(request);
    const events = response.events.map((event) => {
      const topic = event.topic[0] ? String(scValToNative(event.topic[0])) : "";
      return { id: event.id, kind: topic === "pool_new" ? "pool_new" as const : "paid" as const, ledger: event.ledger, at: event.ledgerClosedAt, txHash: event.txHash };
    });
    return { events, cursor: response.cursor };
  } catch (error) {
    if (error instanceof ContractServiceError) throw error;
    throw new ContractServiceError("RPC_FAILURE", "Live event feed is temporarily unreachable.");
  }
}
