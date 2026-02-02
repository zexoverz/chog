import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOffer, useAcceptOffer, useDeclineOffer, useCancelOffer, OfferStatus } from "../hooks";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatEther } from "viem";
import { CONTRACTS, erc721Abi } from "../config";

interface OfferCardProps {
  offerId: bigint;
  onSuccess?: () => void;
}

const statusLabels: Record<OfferStatus, string> = {
  [OfferStatus.Waiting]: "Waiting",
  [OfferStatus.Completed]: "Completed",
  [OfferStatus.Declined]: "Declined",
  [OfferStatus.Cancelled]: "Cancelled",
};

const statusColors: Record<OfferStatus, string> = {
  [OfferStatus.Waiting]: "bg-yellow-500",
  [OfferStatus.Completed]: "bg-green-500",
  [OfferStatus.Declined]: "bg-red-500",
  [OfferStatus.Cancelled]: "bg-gray-500",
};

const NFT_SWAP_ADDRESS = CONTRACTS.monadTestnet.nftSwap;

export function OfferCard({ offerId, onSuccess }: OfferCardProps) {
  const { address } = useAccount();
  const { data: offer, isLoading, refetch } = useOffer(offerId);
  const { acceptOffer, isPending: isAccepting } = useAcceptOffer();
  const { declineOffer, isPending: isDeclining } = useDeclineOffer();
  const { cancelOffer, isPending: isCancelling } = useCancelOffer();

  // Get the first wanted NFT collection to check approval
  const wantedCollection = offer?.[4]?.[0]?.collection;

  // Check if target has approved NFTSwap for their NFTs
  const { data: isApprovedForAll, refetch: refetchApproval } = useReadContract({
    address: wantedCollection,
    abi: erc721Abi,
    functionName: "isApprovedForAll",
    args: address && wantedCollection ? [address, NFT_SWAP_ADDRESS] : undefined,
    query: {
      enabled: !!address && !!wantedCollection,
    },
  });

  // Approval transaction
  const { writeContract: approveWrite, data: approveHash, isPending: isApprovePending } = useWriteContract();
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash
  });

  // Refetch approval status after successful approval
  if (isApproveSuccess) {
    refetchApproval();
  }

  const handleApprove = () => {
    if (!wantedCollection) return;
    approveWrite({
      address: wantedCollection,
      abi: erc721Abi,
      functionName: "setApprovalForAll",
      args: [NFT_SWAP_ADDRESS, true],
    });
  };

  if (isLoading || !offer) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse h-20 bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  const [offerer, target, offeredNFTs, offeredTokens, wantedNFTs, status, createdAt] = offer;
  const isOfferer = address?.toLowerCase() === offerer.toLowerCase();
  const isTarget = address?.toLowerCase() === target.toLowerCase();
  const isWaiting = status === OfferStatus.Waiting;
  const needsApproval = isTarget && isWaiting && !isApprovedForAll;

  const handleAction = async (action: () => void) => {
    action();
    setTimeout(() => {
      refetch();
      onSuccess?.();
    }, 2000);
  };

  const totalTokenValue = offeredTokens.reduce((acc, t) => acc + t.amount, 0n);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Offer #{offerId.toString()}</CardTitle>
          <span className={`px-2 py-1 rounded text-xs text-white ${statusColors[status as OfferStatus]}`}>
            {statusLabels[status as OfferStatus]}
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <span className="text-muted-foreground">From:</span>{" "}
          <span className="font-mono">{offerer.slice(0, 8)}...{offerer.slice(-6)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">To:</span>{" "}
          <span className="font-mono">{target.slice(0, 8)}...{target.slice(-6)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-muted-foreground mb-1">Offering:</p>
            <ul className="text-xs space-y-1">
              {offeredNFTs.map((nft, i) => (
                <li key={i} className="font-mono">
                  NFT #{nft.tokenId.toString()}
                </li>
              ))}
              {totalTokenValue > 0n && (
                <li>{formatEther(totalTokenValue)} MON</li>
              )}
            </ul>
          </div>
          <div>
            <p className="text-muted-foreground mb-1">Wants:</p>
            <ul className="text-xs space-y-1">
              {wantedNFTs.map((nft, i) => (
                <li key={i} className="font-mono">
                  NFT #{nft.tokenId.toString()}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Created: {new Date(Number(createdAt) * 1000).toLocaleString()}
        </div>
      </CardContent>
      {isWaiting && (
        <CardFooter className="gap-2 flex-wrap">
          {isTarget && (
            <>
              {needsApproval ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleApprove}
                  disabled={isApprovePending || isApproveConfirming}
                  className="w-full"
                >
                  {isApprovePending && "Confirm in wallet..."}
                  {isApproveConfirming && "Approving..."}
                  {!isApprovePending && !isApproveConfirming && "Approve NFT for Trade"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleAction(() => acceptOffer(offerId))}
                  disabled={isAccepting}
                >
                  {isAccepting ? "Accepting..." : "Accept"}
                </Button>
              )}
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleAction(() => declineOffer(offerId))}
                disabled={isDeclining}
              >
                {isDeclining ? "Declining..." : "Decline"}
              </Button>
            </>
          )}
          {isOfferer && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleAction(() => cancelOffer(offerId))}
              disabled={isCancelling}
            >
              {isCancelling ? "Cancelling..." : "Cancel"}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
