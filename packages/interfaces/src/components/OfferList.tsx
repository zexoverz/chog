import { useAccount } from "wagmi";
import { useOffersCreated, useOffersReceived } from "../hooks";
import { OfferCard } from "./OfferCard";

export function OfferList() {
  const { address } = useAccount();
  const { data: created, refetch: refetchCreated } = useOffersCreated(address);
  const { data: received, refetch: refetchReceived } = useOffersReceived(address);

  const handleSuccess = () => {
    refetchCreated();
    refetchReceived();
  };

  if (!address) {
    return (
      <div className="text-center text-muted-foreground py-8">
        Connect your wallet to view offers
      </div>
    );
  }

  const allOfferIds = [
    ...(created || []),
    ...(received || []).filter((id) => !created?.includes(id)),
  ].sort((a, b) => Number(b - a));

  if (allOfferIds.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No offers yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {allOfferIds.map((offerId) => (
        <OfferCard key={offerId.toString()} offerId={offerId} onSuccess={handleSuccess} />
      ))}
    </div>
  );
}
