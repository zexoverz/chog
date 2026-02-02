import { createWalletClient, createPublicClient, http, parseAbi, parseEther } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const abi = parseAbi([
  "function setPrices(uint64 _presalePrice, uint64 _starlistPrice, uint64 _fcfsPrice) external",
  "function presalePrice() view returns (uint64)",
  "function starlistPrice() view returns (uint64)",
  "function fcfsPrice() view returns (uint64)",
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

  // Set prices in MON (adjust these values as needed)
  // Example: 0.5 MON for presale, 0.7 MON for starlist, 0.8 MON for FCFS
  const presalePrice = parseEther("0.5");   // $25 equivalent
  const starlistPrice = parseEther("0.7");  // $35 equivalent
  const fcfsPrice = parseEther("0.8");      // $40 equivalent

  console.log("Setting prices...");
  console.log("  Presale:", presalePrice.toString(), "wei (0.5 MON)");
  console.log("  Starlist:", starlistPrice.toString(), "wei (0.7 MON)");
  console.log("  FCFS:", fcfsPrice.toString(), "wei (0.8 MON)");

  const hash = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi,
    functionName: "setPrices",
    args: [presalePrice, starlistPrice, fcfsPrice],
  });

  console.log("TX:", hash);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Confirmed in block:", receipt.blockNumber);

  // Verify prices
  const p1 = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "presalePrice" });
  const p2 = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "starlistPrice" });
  const p3 = await publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "fcfsPrice" });
  
  console.log("\nCurrent prices:");
  console.log("  Presale:", p1.toString(), "wei");
  console.log("  Starlist:", p2.toString(), "wei");
  console.log("  FCFS:", p3.toString(), "wei");
}

main().catch(console.error);
