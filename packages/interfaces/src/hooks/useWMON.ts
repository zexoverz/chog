import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import type { Address } from "viem";
import { wmonAbi } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const WMON_ADDRESS = CONTRACTS.monadTestnet.wmon;

export function useWMONBalance(address: Address | undefined) {
  return useReadContract({
    address: WMON_ADDRESS,
    abi: wmonAbi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });
}

export function useWrapMON() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const wrap = (amount: bigint) => {
    writeContract({
      address: WMON_ADDRESS,
      abi: wmonAbi,
      functionName: "deposit",
      value: amount,
    });
  };

  return {
    wrap,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

export function useUnwrapWMON() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const unwrap = (amount: bigint) => {
    writeContract({
      address: WMON_ADDRESS,
      abi: wmonAbi,
      functionName: "withdraw",
      args: [amount],
    });
  };

  return {
    unwrap,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}
