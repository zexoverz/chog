import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const SBT_ADDRESS = "0x285c21Fd7f7fBd5501949cf1398502699f018172";

const abi = parseAbi([
  "function setURI(string calldata newuri) external",
  "function uri(uint256 tokenId) view returns (string)",
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

  // Set correct URI (contract appends token ID automatically)
  const newUri = "https://testnet-api.lilchogstars.com/sbt/metadata/";
  
  console.log("Setting SBT URI to:", newUri);
  
  const hash = await client.writeContract({
    address: SBT_ADDRESS,
    abi,
    functionName: "setURI",
    args: [newUri],
  });
  console.log("TX:", hash);
  await publicClient.waitForTransactionReceipt({ hash });

  // Verify
  const uri1 = await publicClient.readContract({ address: SBT_ADDRESS, abi, functionName: "uri", args: [1n] });
  const uri2 = await publicClient.readContract({ address: SBT_ADDRESS, abi, functionName: "uri", args: [2n] });
  const uri3 = await publicClient.readContract({ address: SBT_ADDRESS, abi, functionName: "uri", args: [3n] });
  
  console.log("\nToken URIs:");
  console.log("  Token 1:", uri1);
  console.log("  Token 2:", uri2);
  console.log("  Token 3:", uri3);
}

main().catch(console.error);
