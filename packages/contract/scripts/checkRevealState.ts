import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";

const blindBoxAbi = parseAbi([
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address lilStarContract)",
]);

const lilStarAbi = parseAbi([
  "function redeemOpen() view returns (bool)",
  "function blindBox() view returns (address)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  console.log("Checking reveal state...\n");

  // Check BlindBox
  const blindBoxInfo = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });
  console.log("BlindBox:");
  console.log("  redeemBlindBoxOpen:", blindBoxInfo[0]);
  console.log("  lilStarContract:", blindBoxInfo[1]);

  // Check LilStar
  const lilStarRedeemOpen = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "redeemOpen",
  });
  const lilStarBlindBox = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "blindBox",
  });
  console.log("\nLilStar:");
  console.log("  redeemOpen:", lilStarRedeemOpen);
  console.log("  blindBox:", lilStarBlindBox);

  // Analysis
  console.log("\n--- Analysis ---");
  if (!blindBoxInfo[0]) {
    console.log("❌ BlindBox redemption is NOT open. Run: npx ts-node scripts/openReveal.ts");
  } else {
    console.log("✅ BlindBox redemption is open");
  }

  if (!lilStarRedeemOpen) {
    console.log("❌ LilStar redemption is NOT open. Run: npx ts-node scripts/openReveal.ts");
  } else {
    console.log("✅ LilStar redemption is open");
  }

  if (blindBoxInfo[1].toLowerCase() !== LILSTAR_ADDRESS.toLowerCase()) {
    console.log("❌ BlindBox's lilStarContract is NOT set correctly!");
  } else {
    console.log("✅ BlindBox's lilStarContract is correct");
  }

  if (lilStarBlindBox.toLowerCase() !== BLINDBOX_ADDRESS.toLowerCase()) {
    console.log("❌ LilStar's blindBox is NOT set correctly!");
  } else {
    console.log("✅ LilStar's blindBox is correct");
  }
}

main().catch(console.error);
