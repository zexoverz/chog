import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";

const blindBoxAbi = parseAbi([
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address lilStarContract)",
]);

const lilStarAbi = parseAbi([
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address blindBoxAddress)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const txHash = process.argv[2] || "0xb736ed3d4005ff214c2cd67270ff378d1238a33a04d5ce854c02a8391000908b";

  console.log("Checking tx:", txHash);

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    console.log("Status:", receipt.status);
    console.log("Block:", receipt.blockNumber.toString());
  } catch(e) {
    console.log("Error:", e);
  }

  console.log("\n--- Current Contract State ---");

  // Check BlindBox
  const blindBoxInfo = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });
  console.log("\nBlindBox:");
  console.log("  redeemBlindBoxOpen:", blindBoxInfo[0]);
  console.log("  lilStarContract:", blindBoxInfo[1]);

  // Check LilStar
  const lilStarInfo = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "redeemInfo",
  });
  console.log("\nLilStar:");
  console.log("  redeemBlindBoxOpen:", lilStarInfo[0]);
  console.log("  blindBoxAddress:", lilStarInfo[1]);

  // Analysis
  console.log("\n--- Issues ---");
  const issues = [];

  if (!blindBoxInfo[0]) {
    issues.push("BlindBox redemption is NOT open");
  }
  if (!lilStarInfo[0]) {
    issues.push("LilStar redemption is NOT open");
  }
  if (blindBoxInfo[1].toLowerCase() !== LILSTAR_ADDRESS.toLowerCase()) {
    issues.push("BlindBox's lilStarContract doesn't match LILSTAR_ADDRESS");
  }
  if (lilStarInfo[1].toLowerCase() !== BLINDBOX_ADDRESS.toLowerCase()) {
    issues.push("LilStar's blindBoxAddress doesn't match BLINDBOX_ADDRESS");
  }

  if (issues.length === 0) {
    console.log("✅ All checks passed! Redeem should work.");
  } else {
    issues.forEach(i => console.log("❌", i));
    console.log("\nRun: npx ts-node scripts/openReveal.ts");
  }
}

main().catch(console.error);
