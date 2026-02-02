import { createWalletClient, createPublicClient, http, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "viem/chains";

const BLINDBOX_ADDRESS = "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF";
const LILSTAR_ADDRESS = "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4";

const blindBoxAbi = parseAbi([
  "function openRedeemBlindBoxState() external",
  "function breakTransferLock() external",
  "function redeemInfo() view returns (bool redeemBlindBoxOpen, address lilStarContract)",
]);

const lilStarAbi = parseAbi([
  "function setRedeemBlindBoxState(bool _open) external",
  "function redeemInfo() view returns (bool isOpen, address blindBoxAddr)",
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

  // 1. Open redemption on BlindBox
  console.log("Opening BlindBox redemption...");
  const hash1 = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "openRedeemBlindBoxState",
  });
  console.log("TX:", hash1);
  await publicClient.waitForTransactionReceipt({ hash: hash1 });

  // 2. Open redemption on LilStar
  console.log("Opening LilStar redemption...");
  const hash2 = await client.writeContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "setRedeemBlindBoxState",
    args: [true],
  });
  console.log("TX:", hash2);
  await publicClient.waitForTransactionReceipt({ hash: hash2 });

  // 3. Break transfer lock (allow trading)
  console.log("Breaking transfer lock...");
  const hash3 = await client.writeContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "breakTransferLock",
  });
  console.log("TX:", hash3);
  await publicClient.waitForTransactionReceipt({ hash: hash3 });

  // Verify
  const blindBoxInfo = await publicClient.readContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });
  const lilStarInfo = await publicClient.readContract({
    address: LILSTAR_ADDRESS,
    abi: lilStarAbi,
    functionName: "redeemInfo",
  });

  console.log("\nReveal is now OPEN!");
  console.log("  BlindBox redeemOpen:", blindBoxInfo[0]);
  console.log("  LilStar redeemOpen:", lilStarInfo[0]);
}

main().catch(console.error);
