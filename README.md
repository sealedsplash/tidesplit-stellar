# TideSplit

TideSplit divides a shared expense into exact per-person shares and settles
one computed share in XLM on the Stellar Testnet. The calculation summary and
the payment receipt sit at the center of the experience — what you see is
precisely what gets submitted.

> ⚠️ **Testnet only.** TideSplit talks exclusively to the Stellar Testnet.
> Funds come from the free friendbot faucet and carry no real-world value.

## Live App

[Launch TideSplit on GitHub Pages](https://sealedsplash.github.io/tidesplit-stellar/)

## Features

- Freighter connection with an explicit Testnet network guard
- Live XLM balance with loading / ready / unfunded / unreachable states
- Expense inputs: total, participant count, optional whole-XLM rounding
- Transparent calculation summary showing the exact per-person share
- Stroop-precision arithmetic (integer math) — never NaN, never Infinity
- Settlement through a signed XLM payment with signing → submitting →
  confirmed/failed receipt states
- Transaction hash plus Stellar Expert explorer link on success
- **Yellow Belt: Multi-wallet detection** — TideSplit probes for installed
  Stellar wallet extensions and routes signing through any detected wallet
  via `@stellar/wallet-sdk`
- **Yellow Belt: Soroban contract** — expense pools are stored on-chain via
  a Soroban contract; pool creation, share computation, and settlement
  recording all happen on-chain through direct RPC calls
- **Yellow Belt: Contract UI** — `ContractForm` creates on-chain pools;
  `ContractTable` loads and displays pool metadata plus settlement history
- Distinct messages for: missing wallet, declined access, declined signing,
  wrong network, invalid recipient, insufficient balance, malformed
  transaction, and Horizon outages
- Duplicate-settlement lock while a transaction is in flight

## Prerequisites

- Node.js 18+ and npm 9+
- [Freighter](https://www.freighter.app/) installed and set to **Test Network**
- A funded Testnet account (visit `https://friendbot.stellar.org/?addr=<YOUR_PUBLIC_KEY>` once)

## Local Setup

```bash
git clone https://github.com/sealedsplash/tidesplit-stellar.git
cd tidesplit-stellar
npm install
npm run dev
```

Open `http://localhost:5174` in the browser where Freighter is installed.

## Environment Variables

None. The Horizon Testnet URL is fixed in source so the app cannot point at
Mainnet by misconfiguration.

## Scripts

| Command             | What it does                    |
| ------------------- | ------------------------------- |
| `npm run dev`       | Vite dev server on port 5174    |
| `npm run build`     | Typecheck + production bundle   |
| `npm test`          | Vitest unit tests               |
| `npm run lint`      | ESLint                          |
| `npm run typecheck` | Standalone TypeScript check     |

## Architecture

```
src/
├── components/            # WalletPanel, SplitPanel, SettlementReceipt, WaveDivider, ContractForm, ContractTable
├── hooks/
│   ├── useWalletSession.ts   # Connection phase machine + balance states
│   ├── useSettlement.ts      # Build/sign/submit lifecycle + receipt record
│   └── useRecentSplits.ts    # Local-only recent calculations history
├── contract/                # Yellow Belt: contract RPC service + Soroban wiring
│   └── contractService.ts    # useContract hook, PoolRecord, SettlementRecord
├── wallet/                  # Yellow Belt: multi-wallet adapter + Freighter
│   ├── freighterAdapter.ts   # Typed Freighter result wrapper
│   ├── freighterApi.type.ts  # Typed Freighter API surface
│   ├── horizonClient.ts      # Balance reads + settlement submission
│   └── multiWallet.ts        # Multi-wallet state machine via @stellar/wallet-sdk
├── split/                   # Yellow Belt: contract source
│   ├── calculator.ts         # Integer stroop arithmetic for even division
│   └── validation.ts         # Inline form rules with explanatory messages
└── styles/                  # Theme tokens, layout, controls
```

### Yellow Belt additions

- `contracts/tidesplit/` — Soroban contract (Cargo.toml, src/lib.rs) with
  pool creation, share computation, settlement recording, and 10 unit tests
- `src/contract/contractService.ts` — React hook + RPC bridge to the
  on-chain contract
- `src/wallet/multiWallet.ts` — wallet detection + connection state via
  `@stellar/wallet-sdk`
- `src/components/ContractForm.tsx` — create on-chain pools
- `src/components/ContractTable.tsx` — load and display pool + settlement data
- `tests/contract.service.test.ts` — contract service unit tests

Secret keys never touch the app: unsigned envelopes go to Freighter, and only
signed envelopes are submitted to Horizon.

## Screenshots

### Freighter connection request

![Freighter connection request on Stellar Testnet](docs/screenshots/01-tidesplit-home.png)

### Connected wallet and XLM balance

![Connected Freighter wallet with Testnet XLM balance](docs/screenshots/02-wallet-connected.png)

### Calculated share awaiting signature

![Calculated TideSplit share awaiting confirmation in Freighter](docs/screenshots/03-transaction-pending.png)

### Successful Testnet settlement

![Successful TideSplit settlement with transaction hash](docs/screenshots/04-transaction-success.png)

### Stellar Expert confirmation

![Successful settlement verified on Stellar Expert Testnet](docs/screenshots/05-stellar-expert-confirmation.png)

## Verified Example Transaction

- Transaction hash: `e0c41741cec6a11ed5df66196dc878dfb70a4e38a9303bba88c6ffcfa7ae20f7`
- Explorer link: [View on Stellar Expert](https://stellar.expert/explorer/testnet/tx/e0c41741cec6a11ed5df66196dc878dfb70a4e38a9303bba88c6ffcfa7ae20f7)
- Payment: `46 XLM` on Stellar Testnet

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| "No Freighter extension detected" | Install from freighter.app and reload. |
| Wrong-network banner | Switch Freighter to Test Network and press Check again. |
| "Unfunded account" | Claim faucet XLM for your address, then reconnect. |
| Signing declined | Nothing was sent; adjust the share and settle again. |

## License

MIT

## Verified Testnet deployment

<!-- deployment:start -->
- Contract ID: `CBOLGJBIWE4NUTIGJ57DCZOCCWSZ6JLXS2MV6SSYXDHGMKZEUNZSUMZN`
- Contract explorer: https://stellar.expert/explorer/testnet/contract/CBOLGJBIWE4NUTIGJ57DCZOCCWSZ6JLXS2MV6SSYXDHGMKZEUNZSUMZN
- Verified write transaction: `e1f942145846a230155a903bbdcd5581a9a2df775c34dd9305c5734aa9c7893a`
- Transaction explorer: https://stellar.expert/explorer/testnet/tx/e1f942145846a230155a903bbdcd5581a9a2df775c34dd9305c5734aa9c7893a
<!-- deployment:end -->
