import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const abi = parseAbi([
  "function setMaxPerWallet(uint16 _presale, uint16 _starlist, uint16 _fcfs) external",
  "function maxPerWalletPresale() view returns (uint16)",
  "function maxPerWalletStarlist() view returns (uint16)",
  "function maxPerWalletFcfs() view returns (uint16)",
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

  // New limits
  const presaleMax = 10;
  const starlistMax = 10;
  const fcfsMax = 10;

  console.log("Setting max per wallet...");
  console.log("  Presale:", presaleMax);
  console.log("  Starlist:", starlistMax);
  console.log("  FCFS:", fcfsMax);

  const hash = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi,
    functionName: "setMaxPerWallet",
    args: [presaleMax, starlistMax, fcfsMax],
  });
  console.log("TX:", hash);
  await publicClient.waitForTransactionReceipt({ hash });

  // Verify
  const p = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletPresale" });
  const s = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletStarlist" });
  const f = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletFcfs" });
  
  console.log("\nNew limits:");
  console.log("  Presale:", p);
  console.log("  Starlist:", s);
  console.log("  FCFS:", f);
}

main().catch(console.error);
