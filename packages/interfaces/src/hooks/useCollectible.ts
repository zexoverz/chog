import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address, Hex } from "viem";
import { collectibleAbi } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const COLLECTIBLE_ADDRESS = CONTRACTS.monadTestnet.collectible;

export function useCollectibleName() {
  return useReadContract({
    address: COLLECTIBLE_ADDRESS,
    abi: collectibleAbi,
    functionName: "name",
  });
}

export function useCollectibleSymbol() {
  return useReadContract({
    address: COLLECTIBLE_ADDRESS,
    abi: collectibleAbi,
    functionName: "symbol",
  });
}

export function useCollectibleBalance(owner: Address | undefined) {
  return useReadContract({
    address: COLLECTIBLE_ADDRESS,
    abi: collectibleAbi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useCollectibleOwner(tokenId: bigint) {
  return useReadContract({
    address: COLLECTIBLE_ADDRESS,
    abi: collectibleAbi,
    functionName: "ownerOf",
    args: [tokenId],
  });
}

export function useCollectibleTokenURI(tokenId: bigint) {
  return useReadContract({
    address: COLLECTIBLE_ADDRESS,
    abi: collectibleAbi,
    functionName: "tokenURI",
    args: [tokenId],
  });
}

export function useMintCollectible() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = (
    to: Address,
    tokenId: bigint,
    nonce: bigint,
    deadline: bigint,
    signature: Hex
  ) => {
    writeContract({
      address: COLLECTIBLE_ADDRESS,
      abi: collectibleAbi,
      functionName: "mint",
      args: [to, tokenId, nonce, deadline, signature],
    });
  };

  return {
    mint,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
