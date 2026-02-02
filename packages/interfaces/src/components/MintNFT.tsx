import { useState } from "react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMintWithPermit, useCollectibleBalance } from "../hooks";

export function MintNFT() {
  const { address, isConnected } = useAccount();
  const [tokenId, setTokenId] = useState("");
  const { mint, isRequesting, isPending, isConfirming, isSuccess, error, hash } = useMintWithPermit();
  const { data: balance, refetch: refetchBalance } = useCollectibleBalance(address);

  const handleMint = async () => {
    if (!tokenId) return;
    await mint(tokenId);
    setTimeout(() => refetchBalance(), 2000);
  };

  const isLoading = isRequesting || isPending || isConfirming;

  if (!isConnected) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Connect your wallet to mint
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Your balance: {balance?.toString() ?? "0"} NFTs
      </div>

      <div className="space-y-2">
        <Label htmlFor="tokenId">Token ID</Label>
        <Input
          id="tokenId"
          type="number"
          placeholder="Enter token ID to mint"
          value={tokenId}
          onChange={(e) => setTokenId(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <Button
        onClick={handleMint}
        disabled={!tokenId || isLoading}
        className="w-full"
      >
        {isRequesting && "Getting permit..."}
        {isPending && "Confirm in wallet..."}
        {isConfirming && "Minting..."}
        {!isLoading && "Mint NFT"}
      </Button>

      {error && (
        <div className="text-sm text-destructive">
          Error: {error.message}
        </div>
      )}

      {isSuccess && hash && (
        <div className="text-sm text-green-600">
          Minted successfully!{" "}
          <a
            href={`https://testnet.monadexplorer.com/tx/${hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            View tx
          </a>
        </div>
      )}
    </div>
  );
}
