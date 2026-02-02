import { createPublicClient, http, parseAbi } from "viem";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const abi = parseAbi([
  "function maxPerWalletPresale() view returns (uint16)",
  "function maxPerWalletStarlist() view returns (uint16)",
  "function maxPerWalletFcfs() view returns (uint16)",
]);

async function main() {
  const publicClient = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.MONAD_TESTNET_RPC_URL),
  });

  const [presale, starlist, fcfs] = await Promise.all([
    publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletPresale" }),
    publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletStarlist" }),
    publicClient.readContract({ address: BLINDBOX_ADDRESS, abi, functionName: "maxPerWalletFcfs" }),
  ]);

  console.log("=== BlindBox Max Per Wallet Limits ===\n");
  console.log("  Presale:", presale.toString());
  console.log("  Starlist:", starlist.toString());
  console.log("  FCFS:", fcfs.toString());
}

main().catch(console.error);
