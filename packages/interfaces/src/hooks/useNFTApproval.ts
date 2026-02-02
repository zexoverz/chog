import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { erc721Abi } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const NFT_SWAP_ADDRESS = CONTRACTS.monadTestnet.nftSwap;

export function useNFTApproval(collection: Address, tokenId: bigint) {
  const { data: approved } = useReadContract({
    address: collection,
    abi: erc721Abi,
    functionName: "getApproved",
    args: [tokenId],
  });

  const isApproved = approved === NFT_SWAP_ADDRESS;

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const approve = () => {
    writeContract({
      address: collection,
      abi: erc721Abi,
      functionName: "approve",
      args: [NFT_SWAP_ADDRESS, tokenId],
    });
  };

  return {
    isApproved,
    approve,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useNFTApprovalForAll(collection: Address, owner: Address | undefined) {
  const { data: isApprovedForAll } = useReadContract({
    address: collection,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: owner ? [owner, NFT_SWAP_ADDRESS] : undefined,
    query: {
      enabled: !!owner,
    },
  });

  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const setApprovalForAll = (approved: boolean) => {
    writeContract({
      address: collection,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [NFT_SWAP_ADDRESS, approved],
    });
  };

  return {
    isApprovedForAll,
    setApprovalForAll,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
