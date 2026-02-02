import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { nftSwapAbi, OfferStatus } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const NFT_SWAP_ADDRESS = CONTRACTS.monadTestnet.nftSwap;

export interface NFTItem {
  collection: Address;
  tokenId: bigint;
}

export interface ERC20Item {
  token: Address;
  amount: bigint;
}

export interface Offer {
  offerer: Address;
  target: Address;
  offeredNFTs: NFTItem[];
  offeredTokens: ERC20Item[];
  wantedNFTs: NFTItem[];
  status: OfferStatus;
  createdAt: bigint;
}

export function usePlatformFee() {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "platformFee",
  });
}

export function useOffer(offerId: bigint) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getOffer",
    args: [offerId],
  });
}

export function useOffersCreated(user: Address | undefined) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getOffersCreated",
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  });
}

export function useOffersReceived(user: Address | undefined) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getOffersReceived",
    args: user ? [user] : undefined,
    query: {
      enabled: !!user,
    },
  });
}

export function useOffersCreatedByStatus(user: Address | undefined, status: OfferStatus) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getOffersCreatedByStatus",
    args: user ? [user, status] : undefined,
    query: {
      enabled: !!user,
    },
  });
}

export function useOffersReceivedByStatus(user: Address | undefined, status: OfferStatus) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getOffersReceivedByStatus",
    args: user ? [user, status] : undefined,
    query: {
      enabled: !!user,
    },
  });
}

export function useWaitingOffers(offset: bigint, limit: bigint) {
  return useReadContract({
    address: NFT_SWAP_ADDRESS,
    abi: nftSwapAbi,
    functionName: "getWaitingOffers",
    args: [offset, limit],
  });
}

export function useCreateOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createOffer = (
    target: Address,
    offeredNFTs: NFTItem[],
    offeredTokens: ERC20Item[],
    wantedNFTs: NFTItem[],
    nativeAmount: bigint,
    platformFee: bigint
  ) => {
    writeContract({
      address: NFT_SWAP_ADDRESS,
      abi: nftSwapAbi,
      functionName: "createOffer",
      args: [target, offeredNFTs, offeredTokens, wantedNFTs, nativeAmount],
      value: platformFee + nativeAmount,
    });
  };

  return {
    createOffer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useAcceptOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const acceptOffer = (offerId: bigint) => {
    writeContract({
      address: NFT_SWAP_ADDRESS,
      abi: nftSwapAbi,
      functionName: "acceptOffer",
      args: [offerId],
    });
  };

  return {
    acceptOffer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useDeclineOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const declineOffer = (offerId: bigint) => {
    writeContract({
      address: NFT_SWAP_ADDRESS,
      abi: nftSwapAbi,
      functionName: "declineOffer",
      args: [offerId],
    });
  };

  return {
    declineOffer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useCancelOffer() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const cancelOffer = (offerId: bigint) => {
    writeContract({
      address: NFT_SWAP_ADDRESS,
      abi: nftSwapAbi,
      functionName: "cancelOffer",
      args: [offerId],
    });
  };

  return {
    cancelOffer,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export { OfferStatus };
