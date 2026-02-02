import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const blindBoxAbi = parseAbi([
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const userAddress = process.argv[2] || "0xb0175f56d4731C02aC9A30877fcD7c18C6af1858";

  console.log("Checking BlindBox tokens for:", userAddress);

  const balance = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "balanceOf",
    args: [userAddress as `0x${string}`],
  });
  console.log("Balance:", balance.toString());

  // Check tokens 0-20
  console.log("\nOwned tokens:");
  const owned: bigint[] = [];
  for (let i = 0; i < 20; i++) {
    try {
      const owner = await publicClient.readContract({
        address: BLINDBOX_ADDRESS,
        abi: blindBoxAbi,
        functionName: "ownerOf",
        args: [BigInt(i)],
      });
      if (owner.toLowerCase() === userAddress.toLowerCase()) {
        owned.push(BigInt(i));
        console.log(`  Token #${i}`);
      }
    } catch {
      // Token doesn't exist
    }
  }

  if (owned.length === 0) {
    console.log("  (none found in first 20 tokens)");
  }

  console.log("\nTokens you can redeem:", owned.map(t => t.toString()).join(", ") || "none");
}

main().catch(console.error);
