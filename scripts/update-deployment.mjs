import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

const [contractId, writeTxHash] = process.argv.slice(2);
if (!/^C[A-Z2-7]{55}$/.test(contractId ?? "")) throw new Error("Invalid Stellar contract ID");
if (!/^[0-9a-fA-F]{64}$/.test(writeTxHash ?? "")) throw new Error("Invalid transaction hash");

writeFileSync("src/config/deployment.json", `${JSON.stringify({ network: "testnet", contractId, deploymentTxHash: "", writeTxHash: writeTxHash.toLowerCase() }, null, 2)}\n`);

const readmePath = "README.md";
let readme = readFileSync(readmePath, "utf8");
const block = `<!-- deployment:start -->
- Contract ID: \`${contractId}\`
- Contract explorer: https://stellar.expert/explorer/testnet/contract/${contractId}
- Verified write transaction: \`${writeTxHash.toLowerCase()}\`
- Transaction explorer: https://stellar.expert/explorer/testnet/tx/${writeTxHash.toLowerCase()}
<!-- deployment:end -->`;
const pattern = /<!-- deployment:start -->[\s\S]*?<!-- deployment:end -->/;
readme = pattern.test(readme) ? readme.replace(pattern, block) : `${readme.trim()}\n\n## Verified Testnet deployment\n\n${block}\n`;
writeFileSync(readmePath, readme);
