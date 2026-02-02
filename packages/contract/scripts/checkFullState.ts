import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";
const SBT_ADDRESS = "0x285c21Fd7f7fBd5501949cf1398502699f018172";

const blindBoxAbi = parseAbi([
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address lilStarContract)",
]);

const lilStarAbi = parseAbi([
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address blindBoxAddress)",
  "function totalSupply() view returns (uint256)",
  "function MAX_SUPPLY() view returns (uint256)",
  "function sbtContract() view returns (address)",
]);

const sbtAbi = parseAbi([
  "function lilStarContract() view returns (address)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  console.log("=== Full State Check ===\n");

  // BlindBox
  const blindBoxInfo = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });
  console.log("BlindBox:");
  console.log("  redeemBlindBoxOpen:", blindBoxInfo[0]);
  console.log("  lilStarContract:", blindBoxInfo[1]);

  // LilStar
  const lilStarInfo = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "redeemInfo",
  });
  const lilStarSupply = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "totalSupply",
  });
  const lilStarMaxSupply = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "MAX_SUPPLY",
  });
  const sbtContract = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "sbtContract",
  });
  console.log("\nLilStar:");
  console.log("  redeemBlindBoxOpen:", lilStarInfo[0]);
  console.log("  blindBoxAddress:", lilStarInfo[1]);
  console.log("  totalSupply:", lilStarSupply.toString());
  console.log("  MAX_SUPPLY:", lilStarMaxSupply.toString());
  console.log("  remaining tokens:", (lilStarMaxSupply - lilStarSupply).toString());
  console.log("  sbtContract:", sbtContract);

  // SBT
  if (sbtContract !== "0x0000000000000000000000000000000000000000") {
    const lilStarOnSbt = await publicClient.readContract({
      address: sbtContract,
      abi: sbtAbi,
      functionName: "lilStarContract",
    });
    console.log("\nSBT:");
    console.log("  lilStarContract:", lilStarOnSbt);
    console.log("  matches LILSTAR_ADDRESS:", lilStarOnSbt.toLowerCase() === LILSTAR_ADDRESS.toLowerCase());
  } else {
    console.log("\n⚠️ SBT: Not set on LilStar - this will cause redeem to fail!");
  }

  // Verification
  console.log("\n=== Verification ===");
  const issues = [];

  if (!blindBoxInfo[0]) issues.push("BlindBox redemption NOT open");
  if (!lilStarInfo[0]) issues.push("LilStar redemption NOT open");
  if (blindBoxInfo[1].toLowerCase() !== LILSTAR_ADDRESS.toLowerCase()) {
    issues.push(`BlindBox's lilStarContract (${blindBoxInfo[1]}) != LILSTAR_ADDRESS`);
  }
  if (lilStarInfo[1].toLowerCase() !== BLINDBOX_ADDRESS.toLowerCase()) {
    issues.push(`LilStar's blindBoxAddress (${lilStarInfo[1]}) != BLINDBOX_ADDRESS`);
  }
  if (lilStarMaxSupply <= lilStarSupply) {
    issues.push("No more LilStar tokens available!");
  }
  if (sbtContract === "0x0000000000000000000000000000000000000000") {
    issues.push("SBT contract not set on LilStar!");
  }

  if (issues.length === 0) {
    console.log("✅ All checks passed!");
  } else {
    issues.forEach(i => console.log("❌", i));
  }
}

main().catch(console.error);
