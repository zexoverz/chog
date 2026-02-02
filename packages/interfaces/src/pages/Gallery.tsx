import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

interface NFTData {
  tokenId: number;
  metadata: NFTMetadata | null;
}

const CHARACTERS = ["All", "Bear", "Bunny", "Fox", "Chogstar"] as const;
const RARITIES = ["All", "Legendary", "Common"] as const;

export function Gallery() {
  const [allNFTs, setAllNFTs] = useState<NFTData[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

  // Filters
  const [characterFilter, setCharacterFilter] = useState<string>("All");
  const [rarityFilter, setRarityFilter] = useState<string>("All");
  const [searchId, setSearchId] = useState<string>("");
  const [traitFilter, setTraitFilter] = useState<string>("");

  // Load all NFT metadata from collection.json
  useEffect(() => {
    async function loadNFTs() {
      setLoading(true);

      try {
        // Try to load from collection.json first (has all NFTs)
        const res = await fetch(`${API_BASE_URL}/output/collection.json`);
        if (res.ok) {
          const collection = await res.json();
          const nfts: NFTData[] = collection.map((item: any) => ({
            tokenId: item.tokenId,
            metadata: {
              name: item.name,
              description: item.description,
              image: item.image,
              attributes: item.attributes,
            },
          }));
          nfts.sort((a, b) => a.tokenId - b.tokenId);
          setAllNFTs(nfts);
          setLoading(false);
          return;
        }
      } catch {
        // Fall back to individual metadata files
      }

      // Fallback: Load metadata for tokens individually
      const nfts: NFTData[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 1; i <= 6000; i++) {
        const tokenId = i;
        promises.push(
          fetch(`${API_BASE_URL}/metadata/${tokenId}`)
            .then((res) => (res.ok ? res.json() : null))
            .then((metadata) => {
              if (metadata) {
                nfts.push({ tokenId, metadata });
              }
            })
            .catch(() => {})
        );
      }

      await Promise.all(promises);

      // Sort by tokenId
      nfts.sort((a, b) => a.tokenId - b.tokenId);
      setAllNFTs(nfts);
      setLoading(false);
    }

    loadNFTs();
  }, []);

  // Filter NFTs
  const filteredNFTs = useMemo(() => {
    return allNFTs.filter((nft) => {
      // Character filter
      if (characterFilter !== "All") {
        const charAttr = nft.metadata?.attributes.find(
          (a) => a.trait_type === "Character"
        );
        if (charAttr?.value !== characterFilter) return false;
      }

      // Rarity filter
      if (rarityFilter !== "All") {
        const rarityAttr = nft.metadata?.attributes.find(
          (a) => a.trait_type === "Rarity"
        );
        if (rarityAttr?.value !== rarityFilter) return false;
      }

      // Search by ID
      if (searchId) {
        if (!nft.tokenId.toString().includes(searchId)) return false;
      }

      // Trait filter (search in any trait value)
      if (traitFilter) {
        const hasMatch = nft.metadata?.attributes.some((a) =>
          a.value.toLowerCase().includes(traitFilter.toLowerCase())
        );
        if (!hasMatch) return false;
      }

      return true;
    });
  }, [allNFTs, characterFilter, rarityFilter, searchId, traitFilter]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [characterFilter, rarityFilter, searchId, traitFilter]);

  const totalPages = Math.ceil(filteredNFTs.length / pageSize);
  const currentNFTs = filteredNFTs.slice(page * pageSize, (page + 1) * pageSize);

  // Get unique trait values for the current filter
  const traitSuggestions = useMemo(() => {
    const values = new Set<string>();
    allNFTs.forEach((nft) => {
      nft.metadata?.attributes.forEach((a) => {
        if (a.trait_type !== "Character") {
          values.add(a.value);
        }
      });
    });
    return Array.from(values).sort();
  }, [allNFTs]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background z-10">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                &larr; Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold">NFT Gallery</h1>
          </div>
          <div className="text-sm text-muted-foreground">
            {filteredNFTs.length} NFTs
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid gap-4 md:grid-cols-5">
              {/* Rarity Filter */}
              <div className="space-y-2">
                <Label>Rarity</Label>
                <div className="flex flex-wrap gap-1">
                  {RARITIES.map((rar) => (
                    <Button
                      key={rar}
                      variant={rarityFilter === rar ? "default" : "outline"}
                      size="sm"
                      onClick={() => setRarityFilter(rar)}
                      className={
                        rarityFilter === rar && rar === "Legendary"
                          ? "bg-amber-500 hover:bg-amber-600"
                          : rar === "Legendary"
                          ? "border-amber-500 text-amber-500 hover:bg-amber-500/10"
                          : ""
                      }
                    >
                      {rar}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Character Filter */}
              <div className="space-y-2">
                <Label>Character</Label>
                <div className="flex flex-wrap gap-1">
                  {CHARACTERS.map((char) => (
                    <Button
                      key={char}
                      variant={characterFilter === char ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCharacterFilter(char)}
                    >
                      {char}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Search by ID */}
              <div className="space-y-2">
                <Label>Token ID</Label>
                <Input
                  type="text"
                  placeholder="Search by ID..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
              </div>

              {/* Trait Filter */}
              <div className="space-y-2 md:col-span-2">
                <Label>Trait Search</Label>
                <Input
                  type="text"
                  placeholder="Search traits (e.g., Laser, Gold, Purple)..."
                  value={traitFilter}
                  onChange={(e) => setTraitFilter(e.target.value)}
                  list="trait-suggestions"
                />
                <datalist id="trait-suggestions">
                  {traitSuggestions.slice(0, 50).map((trait) => (
                    <option key={trait} value={trait} />
                  ))}
                </datalist>
              </div>
            </div>

            {/* Active Filters */}
            {(rarityFilter !== "All" || characterFilter !== "All" || searchId || traitFilter) && (
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">Active filters:</span>
                {rarityFilter !== "All" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setRarityFilter("All")}
                    className={rarityFilter === "Legendary" ? "bg-amber-500/20 text-amber-500" : ""}
                  >
                    {rarityFilter} &times;
                  </Button>
                )}
                {characterFilter !== "All" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCharacterFilter("All")}
                  >
                    {characterFilter} &times;
                  </Button>
                )}
                {searchId && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setSearchId("")}
                  >
                    ID: {searchId} &times;
                  </Button>
                )}
                {traitFilter && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setTraitFilter("")}
                  >
                    Trait: {traitFilter} &times;
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setRarityFilter("All");
                    setCharacterFilter("All");
                    setSearchId("");
                    setTraitFilter("");
                  }}
                >
                  Clear all
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12 text-muted-foreground">
            Loading NFTs...
          </div>
        )}

        {/* No results */}
        {!loading && filteredNFTs.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            {allNFTs.length === 0
              ? "No NFTs generated yet. Run the generator first."
              : "No NFTs match your filters."}
          </div>
        )}

        {/* Gallery Grid */}
        {!loading && filteredNFTs.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {currentNFTs.map((nft) => (
                <NFTCard key={nft.tokenId} nft={nft} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 mt-8">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(0)}
                  disabled={page === 0}
                >
                  First
                </Button>
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
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(totalPages - 1)}
                  disabled={page >= totalPages - 1}
                >
                  Last
                </Button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NFTCard({ nft }: { nft: NFTData }) {
  const [showDetails, setShowDetails] = useState(false);
  const [imageError, setImageError] = useState(false);

  const imageUrl = `${API_BASE_URL}/output/images/${nft.tokenId}.png`;
  const character = nft.metadata?.attributes.find(
    (a) => a.trait_type === "Character"
  )?.value;
  const rarity = nft.metadata?.attributes.find(
    (a) => a.trait_type === "Rarity"
  )?.value;
  const isLegendary = rarity === "Legendary";

  return (
    <Card
      className={`cursor-pointer transition-all hover:ring-2 overflow-hidden ${
        isLegendary ? "hover:ring-amber-500 ring-1 ring-amber-500/50" : "hover:ring-primary"
      }`}
      onClick={() => setShowDetails(!showDetails)}
    >
      <div className="relative">
        {!imageError ? (
          <img
            src={imageUrl}
            alt={nft.metadata?.name || `NFT #${nft.tokenId}`}
            className="w-full aspect-square object-cover"
            onError={() => setImageError(true)}
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-square bg-muted flex items-center justify-center text-muted-foreground">
            No Image
          </div>
        )}

        {/* Rarity badge */}
        {isLegendary && (
          <span className="absolute top-2 left-2 bg-amber-500 text-white text-xs font-bold px-2 py-1 rounded">
            LEGENDARY
          </span>
        )}

        {/* Character badge */}
        {character && !isLegendary && (
          <span className="absolute top-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {character}
          </span>
        )}

        {/* Token ID badge */}
        <span className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          #{nft.tokenId}
        </span>
      </div>

      {/* Details panel */}
      {showDetails && nft.metadata && (
        <CardContent className="p-3 border-t bg-muted/50">
          <p className="font-medium text-sm mb-2">{nft.metadata.name}</p>
          <div className="space-y-1 text-xs">
            {nft.metadata.attributes
              .filter((a) => a.trait_type !== "Character")
              .slice(0, 5)
              .map((attr, i) => (
                <div key={i} className="flex justify-between">
                  <span className="text-muted-foreground">{attr.trait_type}:</span>
                  <span className="truncate ml-2">{attr.value}</span>
                </div>
              ))}
            {nft.metadata.attributes.length > 6 && (
              <div className="text-muted-foreground text-center">
                +{nft.metadata.attributes.length - 6} more traits
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
