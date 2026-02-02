import {
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
  useAccount,
} from "wagmi";
import type { Address, Hex } from "viem";
import { blindBoxAbi, MintPhase } from "../config/abis";
import { CONTRACTS } from "../config/contracts";

const BLINDBOX_ADDRESS = CONTRACTS.monadTestnet.blindBox;

export { MintPhase };

export function useBlindBoxName() {
  return useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "name",
  });
}

export function useBlindBoxSymbol() {
  return useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "symbol",
  });
}

export function useBlindBoxBalance(owner: Address | undefined) {
  return useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "balanceOf",
    args: owner ? [owner] : undefined,
    query: {
      enabled: !!owner,
    },
  });
}

export function useBlindBoxSupply() {
  const maxSupply = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "MAX_SUPPLY",
  });

  const mintableSupply = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "MINTABLE_SUPPLY",
  });

  const totalMinted = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "totalMintableMinted",
  });

  const totalSupply = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "totalSupply",
  });

  return {
    maxSupply: maxSupply.data,
    mintableSupply: mintableSupply.data,
    totalMinted: totalMinted.data,
    totalSupply: totalSupply.data,
    isLoading:
      maxSupply.isLoading ||
      mintableSupply.isLoading ||
      totalMinted.isLoading ||
      totalSupply.isLoading,
  };
}

export function useBlindBoxPhase() {
  return useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "currentPhase",
  });
}

export function useBlindBoxPrices() {
  const presalePrice = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "presalePrice",
  });

  const starlistPrice = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "starlistPrice",
  });

  const fcfsPrice = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "fcfsPrice",
  });

  return {
    presalePrice: presalePrice.data,
    starlistPrice: starlistPrice.data,
    fcfsPrice: fcfsPrice.data,
    isLoading:
      presalePrice.isLoading || starlistPrice.isLoading || fcfsPrice.isLoading,
  };
}

export function useBlindBoxMaxPerWallet() {
  const presale = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "maxPerWalletPresale",
  });

  const starlist = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "maxPerWalletStarlist",
  });

  const fcfs = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "maxPerWalletFcfs",
  });

  return {
    presale: presale.data,
    starlist: starlist.data,
    fcfs: fcfs.data,
    isLoading: presale.isLoading || starlist.isLoading || fcfs.isLoading,
  };
}

export function useBlindBoxMintedByAddress(address: Address | undefined) {
  const presale = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "mintedInPresale",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const starlist = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "mintedInStarlist",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  const fcfs = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "mintedInFcfs",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  return {
    presale: presale.data ?? 0,
    starlist: starlist.data ?? 0,
    fcfs: fcfs.data ?? 0,
    isLoading: presale.isLoading || starlist.isLoading || fcfs.isLoading,
  };
}

export function useRedeemInfo() {
  return useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });
}

export function usePresaleMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = (
    amount: number,
    maxAllowed: number,
    signature: Hex,
    value: bigint
  ) => {
    writeContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "presaleMint",
      args: [amount, maxAllowed, signature],
      value,
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

export function useStarlistMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = (
    amount: number,
    maxAllowed: number,
    signature: Hex,
    value: bigint
  ) => {
    writeContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "starlistMint",
      args: [amount, maxAllowed, signature],
      value,
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

export function useFcfsMint() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const mint = (amount: number, value: bigint) => {
    writeContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "fcfsMint",
      args: [amount],
      value,
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

export function useRedeemBlindBoxes() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash,
  });

  const redeem = (blindBoxIds: bigint[]) => {
    writeContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "redeemBlindBoxes",
      args: [blindBoxIds],
    });
  };

  return {
    redeem,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error,
  };
}

// Combined hook for mint page
export function useBlindBoxMint() {
  const { address } = useAccount();
  const phase = useBlindBoxPhase();
  const prices = useBlindBoxPrices();
  const supply = useBlindBoxSupply();
  const maxPerWallet = useBlindBoxMaxPerWallet();
  const minted = useBlindBoxMintedByAddress(address);
  const balance = useBlindBoxBalance(address);
  const redeemInfo = useRedeemInfo();

  const presaleMint = usePresaleMint();
  const starlistMint = useStarlistMint();
  const fcfsMint = useFcfsMint();

  const currentPhase = phase.data ?? MintPhase.CLOSED;

  const getCurrentPrice = () => {
    switch (currentPhase) {
      case MintPhase.PRESALE:
        return prices.presalePrice ?? 0n;
      case MintPhase.STARLIST:
        return prices.starlistPrice ?? 0n;
      case MintPhase.FCFS:
        return prices.fcfsPrice ?? 0n;
      default:
        return 0n;
    }
  };

  const getCurrentMaxPerWallet = () => {
    switch (currentPhase) {
      case MintPhase.PRESALE:
        return maxPerWallet.presale ?? 0;
      case MintPhase.STARLIST:
        return maxPerWallet.starlist ?? 0;
      case MintPhase.FCFS:
        return maxPerWallet.fcfs ?? 0;
      default:
        return 0;
    }
  };

  const getCurrentMinted = () => {
    switch (currentPhase) {
      case MintPhase.PRESALE:
        return minted.presale;
      case MintPhase.STARLIST:
        return minted.starlist;
      case MintPhase.FCFS:
        return minted.fcfs;
      default:
        return 0;
    }
  };

  const getPhaseName = () => {
    switch (currentPhase) {
      case MintPhase.PRESALE:
        return "Presale";
      case MintPhase.STARLIST:
        return "Starlist";
      case MintPhase.FCFS:
        return "Public Sale";
      default:
        return "Closed";
    }
  };

  return {
    address,
    currentPhase,
    phaseName: getPhaseName(),
    price: getCurrentPrice(),
    maxPerWallet: getCurrentMaxPerWallet(),
    minted: getCurrentMinted(),
    balance: balance.data ?? 0n,
    supply,
    redeemInfo: redeemInfo.data,
    isLoading:
      phase.isLoading ||
      prices.isLoading ||
      supply.isLoading ||
      maxPerWallet.isLoading ||
      minted.isLoading,
    presaleMint,
    starlistMint,
    fcfsMint,
  };
}
