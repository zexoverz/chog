import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "../config/api";

interface NFTMetadata {
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

interface NFTCardProps {
  tokenId: number;
  onSelect?: (tokenId: number) => void;
  selected?: boolean;
}

function NFTCard({ tokenId, onSelect, selected }: NFTCardProps) {
  const [metadata, setMetadata] = useState<NFTMetadata | null>(null);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/metadata/${tokenId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setMetadata)
      .catch(() => setMetadata(null));
  }, [tokenId]);

  const imageUrl = `${API_BASE_URL}/output/images/${tokenId}.png`;

  return (
    <Card
      className={`cursor-pointer transition-all hover:ring-2 hover:ring-primary ${
        selected ? "ring-2 ring-primary" : ""
      }`}
      onClick={() => onSelect?.(tokenId)}
    >
      <CardContent className="p-2">
        {!imageError ? (
          <img
            src={imageUrl}
            alt={metadata?.name || `NFT #${tokenId}`}
            className="w-full aspect-square object-cover rounded-md"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full aspect-square bg-muted rounded-md flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}
        <div className="mt-2 text-center">
          <p className="font-medium text-sm">{metadata?.name || `#${tokenId}`}</p>
          {metadata?.attributes && (
            <p className="text-xs text-muted-foreground">
              {metadata.attributes.find((a) => a.trait_type === "Character")?.value}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

interface NFTGalleryProps {
  onSelectNFT?: (tokenId: number) => void;
  selectedTokenIds?: number[];
  selectable?: boolean;
}

export function NFTGallery({ onSelectNFT, selectedTokenIds = [], selectable = false }: NFTGalleryProps) {
  const [tokenIds, setTokenIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 12;

  useEffect(() => {
    // Check which token IDs have images available
    async function loadTokenIds() {
      setLoading(true);
      const ids: number[] = [];

      // Check first 300 tokens to see which exist
      for (let i = 1; i <= 300; i++) {
        try {
          const res = await fetch(`${API_BASE_URL}/metadata/${i}`, { method: "HEAD" });
          if (res.ok) {
            ids.push(i);
          }
        } catch {
          // Token doesn't exist
        }
      }

      setTokenIds(ids);
      setLoading(false);
    }

    loadTokenIds();
  }, []);

  const totalPages = Math.ceil(tokenIds.length / pageSize);
  const currentTokens = tokenIds.slice(page * pageSize, (page + 1) * pageSize);

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading NFTs...
      </div>
    );
  }

  if (tokenIds.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No NFTs generated yet. Run the generator first.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">
          {tokenIds.length} NFTs available
        </p>
        {selectable && selectedTokenIds.length > 0 && (
          <p className="text-sm text-primary">
            {selectedTokenIds.length} selected
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {currentTokens.map((tokenId) => (
          <NFTCard
            key={tokenId}
            tokenId={tokenId}
            onSelect={selectable ? onSelectNFT : undefined}
            selected={selectedTokenIds.includes(tokenId)}
          />
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
          >
            Previous
          </Button>
          <span className="px-4 py-2 text-sm">
            Page {page + 1} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// Preview generator component
export function NFTPreview() {
  const [character, setCharacter] = useState<string>("bear");
  const [rarity, setRarity] = useState<string>("common");
  const [seed, setSeed] = useState<number>(Date.now());
  const [traits, setTraits] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(false);

  const previewUrl = `${API_BASE_URL}/generate/preview?character=${character}&rarity=${rarity}&seed=${seed}`;

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE_URL}/generate/traits?character=${character}&rarity=${rarity}&seed=${seed}`)
      .then((res) => res.json())
      .then((data) => {
        setTraits(data.traits || {});
        setLoading(false);
      })
      .catch(() => {
        setTraits({});
        setLoading(false);
      });
  }, [character, rarity, seed]);

  const randomize = () => setSeed(Date.now());

  return (
    <div className="space-y-4">
      {/* Rarity Toggle */}
      <div className="flex gap-2">
        <Button
          variant={rarity === "common" ? "default" : "outline"}
          size="sm"
          onClick={() => setRarity("common")}
        >
          Common (96%)
        </Button>
        <Button
          variant={rarity === "legendary" ? "default" : "outline"}
          size="sm"
          onClick={() => setRarity("legendary")}
          className={rarity === "legendary" ? "bg-amber-500 hover:bg-amber-600" : "border-amber-500 text-amber-500 hover:bg-amber-500/10"}
        >
          Legendary (4%)
        </Button>
      </div>

      {/* Character Selection */}
      <div className="flex gap-2 flex-wrap">
        {["bear", "bunny", "fox", "chogstar"].map((char) => (
          <Button
            key={char}
            variant={character === char ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setCharacter(char)}
          >
            {char.charAt(0).toUpperCase() + char.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <div className="relative">
            {rarity === "legendary" && (
              <div className="absolute top-2 left-2 z-10 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
                LEGENDARY
              </div>
            )}
            <img
              src={previewUrl}
              alt="NFT Preview"
              className={`w-full aspect-square object-cover rounded-lg border-2 ${
                rarity === "legendary" ? "border-amber-500" : "border-border"
              }`}
            />
          </div>
          <Button className="w-full mt-2" onClick={randomize} disabled={loading}>
            {loading ? "Loading..." : "Randomize"}
          </Button>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Traits</h4>
            <span className={`text-xs px-2 py-1 rounded ${
              rarity === "legendary"
                ? "bg-amber-500/20 text-amber-500"
                : "bg-muted text-muted-foreground"
            }`}>
              {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
            </span>
          </div>
          <div className="text-sm space-y-1">
            {Object.entries(traits).map(([key, value]) => (
              value && (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/_/g, " ")}:
                  </span>
                  <span>{value}</span>
                </div>
              )
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
