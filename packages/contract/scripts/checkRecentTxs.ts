import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  // Check LilStar total supply and recent mints
  const lilStarAbi = parseAbi([
    "function totalSupply() view returns (uint256)",
  ]);

  const lilStarSupply = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "totalSupply",
  });

  console.log("LilStar total supply:", lilStarSupply.toString());
  console.log("This means", lilStarSupply.toString(), "BlindBoxes have been successfully redeemed\n");

  // Check which BlindBox tokens still exist (0-15)
  const blindBoxAbi = parseAbi([
    "function ownerOf(uint256 tokenId) view returns (address)",
  ]);

  console.log("BlindBox token status (0-15):");
  for (let i = 0; i <= 15; i++) {
    try {
      const owner = await publicClient.readContract({
        address: BLINDBOX_ADDRESS,
        abi: blindBoxAbi,
        functionName: "ownerOf",
        args: [BigInt(i)],
      });
      console.log(`  #${i}: exists (owner: ${owner.slice(0,10)}...)`);
    } catch {
      console.log(`  #${i}: BURNED or never minted`);
    }
  }
}

main().catch(console.error);
