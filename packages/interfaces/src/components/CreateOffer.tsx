import { useState } from "react";
import { useAccount } from "wagmi";
import { parseEther, type Address } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateOffer, usePlatformFee, type NFTItem } from "../hooks";
import { useNFTApprovalForAll } from "../hooks";
import { CONTRACTS } from "../config";

export function CreateOffer() {
  const { address, isConnected } = useAccount();
  const { data: platformFee } = usePlatformFee();

  // Form state
  const [targetAddress, setTargetAddress] = useState("");
  const [offeredCollection, setOfferedCollection] = useState(CONTRACTS.monadTestnet.collectible);
  const [offeredTokenId, setOfferedTokenId] = useState("");
  const [wantedCollection, setWantedCollection] = useState(CONTRACTS.monadTestnet.collectible);
  const [wantedTokenId, setWantedTokenId] = useState("");
  const [nativeAmount, setNativeAmount] = useState("");

  // Lists
  const [offeredNFTs, setOfferedNFTs] = useState<NFTItem[]>([]);
  const [wantedNFTs, setWantedNFTs] = useState<NFTItem[]>([]);

  // Hooks
  const { createOffer, isPending, isConfirming, isSuccess, error, hash } = useCreateOffer();
  const { isApprovedForAll, setApprovalForAll, isPending: isApproving } = useNFTApprovalForAll(
    offeredCollection as Address,
    address
  );

  const addOfferedNFT = () => {
    if (!offeredTokenId) return;
    setOfferedNFTs([
      ...offeredNFTs,
      { collection: offeredCollection as Address, tokenId: BigInt(offeredTokenId) },
    ]);
    setOfferedTokenId("");
  };

  const addWantedNFT = () => {
    if (!wantedTokenId) return;
    setWantedNFTs([
      ...wantedNFTs,
      { collection: wantedCollection as Address, tokenId: BigInt(wantedTokenId) },
    ]);
    setWantedTokenId("");
  };

  const removeOfferedNFT = (index: number) => {
    setOfferedNFTs(offeredNFTs.filter((_, i) => i !== index));
  };

  const removeWantedNFT = (index: number) => {
    setWantedNFTs(wantedNFTs.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    if (!targetAddress || wantedNFTs.length === 0) return;
    if (offeredNFTs.length === 0 && !nativeAmount) return;

    const nativeWei = nativeAmount ? parseEther(nativeAmount) : 0n;
    const fee = platformFee ?? 0n;

    createOffer(
      targetAddress as Address,
      offeredNFTs,
      [], // ERC20 tokens - empty for now
      wantedNFTs,
      nativeWei,
      fee
    );
  };

  const isLoading = isPending || isConfirming;
  const canSubmit =
    isConnected &&
    targetAddress &&
    wantedNFTs.length > 0 &&
    (offeredNFTs.length > 0 || nativeAmount);

  if (!isConnected) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Connect your wallet to create offers
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Target Address */}
      <div className="space-y-2">
        <Label>Target Wallet Address</Label>
        <Input
          placeholder="0x..."
          value={targetAddress}
          onChange={(e) => setTargetAddress(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Offered NFTs */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">Your Offer (NFTs you'll give)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Collection address"
              value={offeredCollection}
              onChange={(e) => setOfferedCollection(e.target.value)}
              className="flex-1 text-xs"
              disabled={isLoading}
            />
            <Input
              placeholder="Token ID"
              type="number"
              value={offeredTokenId}
              onChange={(e) => setOfferedTokenId(e.target.value)}
              className="w-24"
              disabled={isLoading}
            />
            <Button size="sm" onClick={addOfferedNFT} disabled={!offeredTokenId || isLoading}>
              Add
            </Button>
          </div>

          {offeredNFTs.length > 0 && (
            <div className="space-y-1">
              {offeredNFTs.map((nft, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-muted p-2 rounded">
                  <span className="font-mono">
                    {nft.collection.slice(0, 8)}...#{nft.tokenId.toString()}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeOfferedNFT(i)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Approval check */}
          {offeredNFTs.length > 0 && !isApprovedForAll && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setApprovalForAll(true)}
              disabled={isApproving}
              className="w-full"
            >
              {isApproving ? "Approving..." : "Approve NFTs for Trading"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Native MON offer */}
      <div className="space-y-2">
        <Label>Add Native MON (optional)</Label>
        <Input
          placeholder="0.0"
          type="number"
          step="0.001"
          value={nativeAmount}
          onChange={(e) => setNativeAmount(e.target.value)}
          disabled={isLoading}
        />
      </div>

      {/* Wanted NFTs */}
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-sm">What You Want (NFTs you'll receive)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Collection address"
              value={wantedCollection}
              onChange={(e) => setWantedCollection(e.target.value)}
              className="flex-1 text-xs"
              disabled={isLoading}
            />
            <Input
              placeholder="Token ID"
              type="number"
              value={wantedTokenId}
              onChange={(e) => setWantedTokenId(e.target.value)}
              className="w-24"
              disabled={isLoading}
            />
            <Button size="sm" onClick={addWantedNFT} disabled={!wantedTokenId || isLoading}>
              Add
            </Button>
          </div>

          {wantedNFTs.length > 0 && (
            <div className="space-y-1">
              {wantedNFTs.map((nft, i) => (
                <div key={i} className="flex justify-between items-center text-xs bg-muted p-2 rounded">
                  <span className="font-mono">
                    {nft.collection.slice(0, 8)}...#{nft.tokenId.toString()}
                  </span>
                  <Button size="sm" variant="ghost" onClick={() => removeWantedNFT(i)}>
                    ✕
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Platform fee info */}
      {platformFee !== undefined && platformFee > 0n && (
        <div className="text-xs text-muted-foreground">
          Platform fee: {(Number(platformFee) / 1e18).toFixed(6)} MON
        </div>
      )}

      {/* Submit */}
      <Button onClick={handleSubmit} disabled={!canSubmit || isLoading} className="w-full">
        {isPending && "Confirm in wallet..."}
        {isConfirming && "Creating offer..."}
        {!isLoading && "Create Offer"}
      </Button>

      {error && (
        <div className="text-sm text-destructive">Error: {error.message}</div>
      )}

      {isSuccess && hash && (
        <div className="text-sm text-green-600">
          Offer created!{" "}
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
