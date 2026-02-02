import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL } from "../config/api";

type Character = "All" | "Bear" | "Bunny" | "Fox" | "Chogstar";
type Rarity = "All" | "Legendary" | "Common";

interface NFTMetadata {
  tokenId: number;
  name: string;
  description: string;
  image: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export function NFTPreviewGenerator() {
  const [allNFTs, setAllNFTs] = useState<NFTMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNFT, setSelectedNFT] = useState<NFTMetadata | null>(null);

  // Filters
  const [character, setCharacter] = useState<Character>("All");
  const [rarity, setRarity] = useState<Rarity>("All");
  const [tokenIdSearch, setTokenIdSearch] = useState("");

  // Load all NFTs from collection.json
  useEffect(() => {
    async function loadNFTs() {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/output/collection.json`);
        if (res.ok) {
          const collection = await res.json();
          setAllNFTs(collection);
          // Select first NFT by default
          if (collection.length > 0) {
            setSelectedNFT(collection[0]);
          }
        }
      } catch (err) {
        console.error("Failed to load collection:", err);
      }
      setLoading(false);
    }
    loadNFTs();
  }, []);

  // Filter NFTs based on selection
  const filteredNFTs = useMemo(() => {
    return allNFTs.filter((nft) => {
      // Character filter
      if (character !== "All") {
        const charAttr = nft.attributes.find((a) => a.trait_type === "Character");
        if (charAttr?.value !== character) return false;
      }
      // Rarity filter
      if (rarity !== "All") {
        const rarityAttr = nft.attributes.find((a) => a.trait_type === "Rarity");
        if (rarityAttr?.value !== rarity) return false;
      }
      // Token ID search
      if (tokenIdSearch) {
        if (!nft.tokenId.toString().includes(tokenIdSearch)) return false;
      }
      return true;
    });
  }, [allNFTs, character, rarity, tokenIdSearch]);

  // Get random NFT from filtered list
  const randomize = () => {
    if (filteredNFTs.length > 0) {
      const randomIndex = Math.floor(Math.random() * filteredNFTs.length);
      setSelectedNFT(filteredNFTs[randomIndex]);
    }
  };

  // Navigate to specific token
  const goToToken = (direction: "prev" | "next") => {
    if (!selectedNFT || filteredNFTs.length === 0) return;

    const currentIndex = filteredNFTs.findIndex((n) => n.tokenId === selectedNFT.tokenId);
    let newIndex: number;

    if (direction === "prev") {
      newIndex = currentIndex <= 0 ? filteredNFTs.length - 1 : currentIndex - 1;
    } else {
      newIndex = currentIndex >= filteredNFTs.length - 1 ? 0 : currentIndex + 1;
    }

    setSelectedNFT(filteredNFTs[newIndex]);
  };

  // Get attribute value
  const getAttr = (nft: NFTMetadata | null, type: string) => {
    return nft?.attributes.find((a) => a.trait_type === type)?.value || "";
  };

  const isLegendary = getAttr(selectedNFT, "Rarity") === "Legendary";

  // Primary URL: pre-generated image, Fallback: generate on-the-fly
  const imageUrl = selectedNFT
    ? `${API_BASE_URL}/output/images/${selectedNFT.tokenId}.png`
    : "";
  const fallbackImageUrl = selectedNFT
    ? `${API_BASE_URL}/generate/image/${selectedNFT.tokenId}`
    : "";

  if (loading) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        Loading collection...
      </div>
    );
  }

  if (allNFTs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        No NFTs generated yet. Run <code className="bg-muted px-2 py-1 rounded">bun run generate</code> first.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        {/* Rarity Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Rarity</label>
          <div className="flex gap-2">
            {(["All", "Common", "Legendary"] as Rarity[]).map((r) => (
              <Button
                key={r}
                variant={rarity === r ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setRarity(r);
                  setSelectedNFT(null);
                }}
                className={
                  rarity === r && r === "Legendary"
                    ? "bg-amber-500 hover:bg-amber-600 text-white"
                    : r === "Legendary"
                    ? "border-amber-500 text-amber-500 hover:bg-amber-500/10"
                    : ""
                }
              >
                {r}
              </Button>
            ))}
          </div>
        </div>

        {/* Character Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Character</label>
          <div className="flex gap-2 flex-wrap">
            {(["All", "Bear", "Bunny", "Fox", "Chogstar"] as Character[]).map((char) => (
              <Button
                key={char}
                variant={character === char ? "secondary" : "ghost"}
                size="sm"
                onClick={() => {
                  setCharacter(char);
                  setSelectedNFT(null);
                }}
              >
                {char}
              </Button>
            ))}
          </div>
        </div>

        {/* Token ID Search */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Token ID</label>
          <Input
            type="text"
            placeholder="Search by ID..."
            value={tokenIdSearch}
            onChange={(e) => setTokenIdSearch(e.target.value)}
            className="w-32"
          />
        </div>
      </div>

      {/* Filtered Count */}
      <div className="text-sm text-muted-foreground">
        Showing {filteredNFTs.length} of {allNFTs.length} NFTs
        {rarity === "Legendary" && (
          <span className="ml-2 text-amber-500">({filteredNFTs.length} Legendary)</span>
        )}
      </div>

      {/* Auto-select first filtered NFT */}
      {!selectedNFT && filteredNFTs.length > 0 && (
        <Button onClick={() => setSelectedNFT(filteredNFTs[0])}>
          Show First NFT
        </Button>
      )}

      {/* Preview Area */}
      {selectedNFT && (
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Image Preview */}
          <Card className={isLegendary ? "border-amber-500 border-2" : ""}>
            <CardContent className="p-4">
              <div className="relative">
                {/* Rarity Badge */}
                {isLegendary && (
                  <div className="absolute top-3 left-3 z-10 bg-amber-500 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">
                    LEGENDARY
                  </div>
                )}

                {/* Token ID Badge */}
                <div className="absolute top-3 right-3 z-10 bg-black/70 text-white text-sm font-bold px-3 py-1 rounded-full">
                  #{selectedNFT.tokenId}
                </div>

                {/* NFT Image */}
                <img
                  src={imageUrl}
                  alt={selectedNFT.name}
                  className={`w-full aspect-square object-cover rounded-lg ${
                    isLegendary ? "ring-2 ring-amber-500/50" : ""
                  }`}
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    // If pre-generated image fails, try generating on-the-fly
                    if (img.src !== fallbackImageUrl && fallbackImageUrl) {
                      img.src = fallbackImageUrl;
                    }
                  }}
                />
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-2 mt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToToken("prev")}
                >
                  ← Previous
                </Button>
                <Button
                  className={`flex-1 ${isLegendary ? "bg-amber-500 hover:bg-amber-600" : ""}`}
                  onClick={randomize}
                >
                  🎲 Random
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => goToToken("next")}
                >
                  Next →
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Traits Panel */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span>{selectedNFT.name}</span>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${
                    isLegendary
                      ? "bg-amber-500/20 text-amber-500"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {getAttr(selectedNFT, "Rarity")}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {selectedNFT.attributes.map((attr, i) => (
                  <div
                    key={i}
                    className={`flex justify-between items-center py-2 border-b border-border/50 last:border-0 ${
                      attr.trait_type === "Rarity" && attr.value === "Legendary"
                        ? "text-amber-500"
                        : ""
                    }`}
                  >
                    <span className="text-muted-foreground">{attr.trait_type}</span>
                    <span className="font-medium text-right max-w-[60%] truncate">
                      {attr.value}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Quick Stats */}
      <Card>
        <CardContent className="py-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{allNFTs.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">Total Supply</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-500">
                {allNFTs.filter((n) => n.attributes.find((a) => a.trait_type === "Rarity")?.value === "Legendary").length}
              </p>
              <p className="text-sm text-muted-foreground">Legendary (4%)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {allNFTs.filter((n) => n.attributes.find((a) => a.trait_type === "Rarity")?.value === "Common").length.toLocaleString()}
              </p>
              <p className="text-sm text-muted-foreground">Common (96%)</p>
            </div>
            <div>
              <p className="text-2xl font-bold">4</p>
              <p className="text-sm text-muted-foreground">Characters</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
