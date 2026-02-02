import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";
const SBT_ADDRESS = "0x285c21Fd7f7fBd5501949cf1398502699f018172";

const blindBoxAbi = parseAbi([
  "function setBaseURI(string calldata baseURI) external",
]);

const lilStarAbi = parseAbi([
  "function setBaseURI(string calldata baseURI) external",
]);

const sbtAbi = parseAbi([
  "function setURI(string calldata newuri) external",
]);

async function main() {
  const account = privateKeyToAccount(process.env.MONAD_PRIVATE_KEY as `0x${string}`);
  
  const client = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const API_BASE = "https://testnet-api.lilchogstars.com";

  // Set BlindBox base URI
  console.log("Setting BlindBox baseURI...");
  const hash1 = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "setBaseURI",
    args: [`${API_BASE}/blindbox/metadata/`],
  });
  console.log("BlindBox TX:", hash1);
  await publicClient.waitForTransactionReceipt({ hash: hash1 });

  // Set LilStar base URI
  console.log("Setting LilStar baseURI...");
  const hash2 = await client.writeContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "setBaseURI",
    args: [`${API_BASE}/lilstar/metadata/`],
  });
  console.log("LilStar TX:", hash2);
  await publicClient.waitForTransactionReceipt({ hash: hash2 });

  // Set SBT URI
  console.log("Setting LilStarSBT URI...");
  const hash3 = await client.writeContract({
    address: SBT_ADDRESS,
    abi: sbtAbi,
    functionName: "setURI",
    args: [`${API_BASE}/sbt/metadata/{id}`],
  });
  console.log("SBT TX:", hash3);
  await publicClient.waitForTransactionReceipt({ hash: hash3 });

  console.log("\nAll metadata URIs set!");
  console.log("  BlindBox:", `${API_BASE}/blindbox/metadata/`);
  console.log("  LilStar:", `${API_BASE}/lilstar/metadata/`);
  console.log("  SBT:", `${API_BASE}/sbt/metadata/{id}`);
}

main().catch(console.error);
