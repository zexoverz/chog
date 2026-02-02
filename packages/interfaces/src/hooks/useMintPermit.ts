import { useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { requestMintPermit } from "../config/api";
import { collectibleAbi } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const COLLECTIBLE_ADDRESS = CONTRACTS.monadTestnet.collectible;

export function useMintWithPermit() {
  const { address } = useAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<Error | null>(null);

  const { writeContract, data: hash, isPending, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const mint = async (tokenId: string) => {
    if (!address) {
      setRequestError(new Error("Wallet not connected"));
      return;
    }

    setIsRequesting(true);
    setRequestError(null);

    try {
      const permit = await requestMintPermit(address, tokenId);

      writeContract({
        address: COLLECTIBLE_ADDRESS,
        abi: collectibleAbi,
        functionName: "mint",
        args: [
          permit.to as Address,
          BigInt(permit.tokenId),
          BigInt(permit.nonce),
          BigInt(permit.deadline),
          permit.signature,
        ],
      });
    } catch (err) {
      setRequestError(err instanceof Error ? err : new Error("Failed to get permit"));
    } finally {
      setIsRequesting(false);
    }
  };

  return {
    mint,
    hash,
    isRequesting,
    isPending,
    isConfirming,
    isSuccess,
    error: requestError || writeError,
  };
}
