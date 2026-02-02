import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const blindBoxAbi = parseAbi([
  "function redeemBlindBoxes(uint256[] calldata blindBoxIds) external returns (uint256[] memory)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const userAddress = "0xb0175f56d4731C02aC9A30877fcD7c18C6af1858";
  const tokenIds = [2n];

  console.log("Simulating redeemBlindBoxes call...");
  console.log("  From:", userAddress);
  console.log("  Token IDs:", tokenIds.map(id => id.toString()));

  try {
    const result = await publicClient.simulateContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "redeemBlindBoxes",
      args: [tokenIds],
      account: userAddress,
    });
    console.log("\n✅ Simulation SUCCESS!");
    console.log("Result:", result);
  } catch (e: any) {
    console.log("\n❌ Simulation FAILED!");
    console.log("Error:", e.message);
    if (e.cause) {
      console.log("\nCause:", e.cause.message || e.cause);
    }
    if (e.shortMessage) {
      console.log("\nShort message:", e.shortMessage);
    }
    // Try to extract error data
    if (e.cause?.data) {
      console.log("\nError data:", e.cause.data);
    }
  }
}

main().catch(console.error);
