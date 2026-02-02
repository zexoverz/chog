import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";

const abi = parseAbi([
  "function setPhase(uint8 _phase) external",
  "function currentPhase() view returns (uint8)",
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

  const phaseArg = Number(process.argv[2] ?? 3);
  const phaseNames = ["CLOSED", "PRESALE", "STARLIST", "FCFS"];
  console.log(`Setting phase to ${phaseNames[phaseArg]} (${phaseArg})...`);

  const hash = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi,
    functionName: "setPhase",
    args: [phaseArg],
  });

  console.log("TX:", hash);
  
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  console.log("Confirmed in block:", receipt.blockNumber);

  const phase = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi,
    functionName: "currentPhase",
  });
  console.log("Current phase:", phase);
}

main().catch(console.error);
