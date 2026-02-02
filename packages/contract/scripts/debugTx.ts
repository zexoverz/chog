import { createPublicClient, http, parseAbi, decodeAbiParameters, decodeFunctionData } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const blindBoxAbi = parseAbi([
  "function redeemBlindBoxes(uint256[] calldata blindBoxIds) external returns (uint256[] memory)",
  "function ownerOf(uint256 tokenId) view returns (address)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const txHash = process.argv[2] || "0xb736ed3d4005ff214c2cd67270ff378d1238a33a04d5ce854c02a8391000908b";
  console.log("Debugging tx:", txHash);

  const tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
  console.log("\nFrom:", tx.from);
  console.log("To:", tx.to);
  console.log("Input data:", tx.input);

  // Try to decode the function call
  try {
    const decoded = decodeFunctionData({
      abi: blindBoxAbi,
      data: tx.input,
    });
    console.log("\nDecoded function:", decoded.functionName);
    console.log("Args:", decoded.args);

    if (decoded.functionName === "redeemBlindBoxes") {
      const blindBoxIds = decoded.args[0] as bigint[];
      console.log("\nBlindBox IDs being redeemed:", blindBoxIds.map(id => id.toString()));

      // Check ownership of each token
      console.log("\nChecking ownership:");
      for (const tokenId of blindBoxIds) {
        try {
          const owner = await publicClient.readContract({
            address: BLINDBOX_ADDRESS,
            abi: blindBoxAbi,
            functionName: "ownerOf",
            args: [tokenId],
          });
          console.log(`  Token ${tokenId}: owned by ${owner}`);
          if (owner.toLowerCase() !== tx.from.toLowerCase()) {
            console.log(`    ❌ NOT owned by tx sender (${tx.from})`);
          }
        } catch (e) {
          console.log(`  Token ${tokenId}: ❌ Does not exist (already burned/never minted)`);
        }
      }
    }
  } catch (e) {
    console.log("Failed to decode:", e);
  }
}

main().catch(console.error);
