import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { decodeEventLog } from "viem";
import { ConnectWallet } from "../components/ConnectWallet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CONTRACTS } from "@/config/contracts";
import { blindBoxAbi } from "@/config/abis";
import { multicall } from "viem/actions";

const BLINDBOX_ADDRESS = CONTRACTS.monadTestnet.blindBox;
const LILSTAR_ADDRESS = CONTRACTS.monadTestnet.lilStar;
const SBT_ADDRESS = CONTRACTS.monadTestnet.lilStarSBT;

// Event ABIs for parsing logs
const lilStarEventAbi = [{
  type: "event",
  name: "Transfer",
  inputs: [
    { indexed: true, name: "from", type: "address" },
    { indexed: true, name: "to", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
  ],
}] as const;

const sbtEventAbi = [{
  type: "event",
  name: "SBTMinted",
  inputs: [
    { indexed: true, name: "to", type: "address" },
    { indexed: true, name: "tokenId", type: "uint256" },
    { indexed: false, name: "amount", type: "uint256" },
  ],
}] as const;

interface RevealResult {
  lilStarTokenIds: bigint[];
  sbtTypes: number[];
}

interface SBTInfo {
  id: number;
  name: string;
  image: string;
  rarity: string;
}

const SBT_INFO: Record<number, SBTInfo> = {
  1: { id: 1, name: "5% Lifetime Discount", image: "https://static4.depositphotos.com/1012407/370/v/450/depositphotos_3707681-stock-illustration-yellow-ticket.jpg", rarity: "Common" },
  2: { id: 2, name: "10% Lifetime Discount", image: "https://unitedpeople.global/wp-content/uploads/2021/12/raffle-ticket-blue-600x428.jpg", rarity: "Rare" },
  3: { id: 3, name: "Free IRL BlindBox", image: "https://flagster.in/cdn/shop/files/ed-mystery-box-red.png?v=1704102519", rarity: "Legendary" },
};

export function Reveal() {
  const { isConnected, address } = useAccount();
  const [selectedTokens, setSelectedTokens] = useState<bigint[]>([]);
  const [revealingTokens, setRevealingTokens] = useState<bigint[]>([]); // Tokens currently being revealed
  const revealingTokensRef = useRef<bigint[]>([]); // Ref to avoid effect re-runs
  const processedHashRef = useRef<string | null>(null); // Track processed tx hash
  const [ownedTokens, setOwnedTokens] = useState<bigint[]>([]);
  const [revealState, setRevealState] = useState<"idle" | "revealing" | "results">("idle");
  const [revealResults, setRevealResults] = useState<RevealResult | null>(null);
  const [currentRevealIndex, setCurrentRevealIndex] = useState(0);

  // Get balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: [{ inputs: [{ name: "owner", type: "address" }], name: "balanceOf", outputs: [{ name: "", type: "uint256" }], stateMutability: "view", type: "function" }],
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Check if redeem is open
  const { data: redeemInfo } = useReadContract({
    address: BLINDBOX_ADDRESS,
    abi: blindBoxAbi,
    functionName: "redeemInfo",
  });

  const isRedeemOpen = redeemInfo?.[0] ?? false;

  // Redeem transaction
  const { writeContract, data: hash, isPending, error, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash });

  // Fetch owned tokens using readContracts
  const ownerOfAbi = [{
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  }] as const;

  const tokenIdsToCheck = Array.from({ length: 200 }, (_, i) => BigInt(i));

  const chainid = useChainId()
  const { data: ownerResults, isLoading: isLoadingTokens } = useReadContracts({
    contracts: tokenIdsToCheck.map((tokenId) => ({
      address: BLINDBOX_ADDRESS,
      abi: ownerOfAbi,
      functionName: "ownerOf",
      args: [tokenId],
      chainId: chainid
    })),
    query: {
      enabled: !!address && !!balance && balance > 0n,
    },
  });

  // Update owned tokens when results change
  useEffect(() => {
    if (!ownerResults || !address) {
      setOwnedTokens([]);
      return;
    }

    const tokens: bigint[] = [];
    ownerResults.forEach((result, index) => {
      if (result.status === "success" &&
          (result.result as string).toLowerCase() === address.toLowerCase()) {
        tokens.push(BigInt(index));
      }
    });
    setOwnedTokens(tokens);
  }, [ownerResults, address]);

  // Parse reveal results from transaction receipt
  useEffect(() => {
    async function parseResults() {
      if (!isSuccess || !receipt || !address) return;

      // Prevent re-running for the same transaction
      if (processedHashRef.current === receipt.transactionHash) return;
      processedHashRef.current = receipt.transactionHash;

      setRevealState("revealing");

      const lilStarTokenIds: bigint[] = [];
      const sbtTypes: number[] = [];

      // Parse logs for LilStar transfers and SBT mints
      for (const log of receipt.logs) {
        try {
          // Check for LilStar Transfer events
          if (log.address.toLowerCase() === LILSTAR_ADDRESS.toLowerCase()) {
            const decoded = decodeEventLog({
              abi: lilStarEventAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "Transfer" && decoded.args.to?.toLowerCase() === address.toLowerCase()) {
              lilStarTokenIds.push(decoded.args.tokenId);
            }
          }

          // Check for SBT Minted events
          if (log.address.toLowerCase() === SBT_ADDRESS.toLowerCase()) {
            const decoded = decodeEventLog({
              abi: sbtEventAbi,
              data: log.data,
              topics: log.topics,
            });
            if (decoded.eventName === "SBTMinted") {
              sbtTypes.push(Number(decoded.args.tokenId));
            }
          }
        } catch {
          // Skip logs that don't match our events
        }
      }

      setRevealResults({ lilStarTokenIds, sbtTypes });

      // Start reveal animation
      setCurrentRevealIndex(0);

      // Animate through each reveal
      const totalReveals = lilStarTokenIds.length;
      if (totalReveals > 0) {
        for (let i = 0; i < totalReveals; i++) {
          await new Promise(resolve => setTimeout(resolve, 1500));
          setCurrentRevealIndex(i + 1);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setRevealState("results");

      // Refresh token list - remove the revealed tokens from owned (use ref)
      const tokensToRemove = revealingTokensRef.current;
      refetchBalance();
      setOwnedTokens(prev => prev.filter(t => !tokensToRemove.includes(t)));
      setRevealingTokens([]);
      revealingTokensRef.current = [];
    }

    parseResults();
  }, [isSuccess, receipt, address, refetchBalance]);

  const toggleToken = (tokenId: bigint) => {
    setSelectedTokens(prev =>
      prev.includes(tokenId)
        ? prev.filter(t => t !== tokenId)
        : [...prev, tokenId]
    );
  };

  const selectAll = () => setSelectedTokens([...ownedTokens]);
  const deselectAll = () => setSelectedTokens([]);

  const handleReveal = () => {
    if (selectedTokens.length === 0 || isPending || isConfirming) return;

    // Capture tokens to reveal and clear selection immediately to prevent double-reveal
    const tokensToReveal = [...selectedTokens];
    revealingTokensRef.current = tokensToReveal; // Store in ref for effect
    processedHashRef.current = null; // Reset processed hash for new transaction
    setRevealingTokens(tokensToReveal);
    setSelectedTokens([]);
    setRevealState("idle");
    setRevealResults(null);

    writeContract({
      address: BLINDBOX_ADDRESS,
      abi: blindBoxAbi,
      functionName: "redeemBlindBoxes",
      args: [tokensToReveal],
    });
  };

  const handleCloseResults = () => {
    setRevealState("idle");
    setRevealResults(null);
    setCurrentRevealIndex(0);
    setRevealingTokens([]);
    revealingTokensRef.current = [];
    processedHashRef.current = null;
    reset();
  };

  // Revealing Animation Overlay
  if (revealState === "revealing" && revealResults) {
    const isAnimating = currentRevealIndex <= revealResults.lilStarTokenIds.length;

    return (
      <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
        <div className="text-center">
          {isAnimating ? (
            <>
              {/* Animated Box */}
              <div className="relative mb-8">
                <div className="text-[120px] animate-bounce">
                  📦
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-32 h-32 rounded-full bg-primary/30 animate-ping" />
                </div>
              </div>
              <p className="text-2xl text-white mb-2">Opening BlindBox...</p>
              <p className="text-muted-foreground">
                {currentRevealIndex} / {revealResults.lilStarTokenIds.length}
              </p>
            </>
          ) : (
            <div className="animate-pulse">
              <p className="text-2xl text-white">Preparing results...</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Results Screen
  if (revealState === "results" && revealResults) {
    return (
      <div className="fixed inset-0 bg-black/95 flex items-center justify-center z-50 overflow-auto py-8">
        <div className="max-w-4xl w-full mx-4">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-white mb-2">Congratulations!</h2>
            <p className="text-muted-foreground">You revealed {revealResults.lilStarTokenIds.length} BlindBox{revealResults.lilStarTokenIds.length !== 1 ? "es" : ""}!</p>
          </div>

          {/* LilStar NFTs */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">LilStar NFTs Received</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {revealResults.lilStarTokenIds.map((tokenId, i) => (
                <div
                  key={i}
                  className="bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl p-4 text-center animate-fade-in"
                  style={{ animationDelay: `${i * 100}ms` }}
                >
                  <div className="text-6xl mb-2">⭐</div>
                  <p className="text-white font-semibold">LilStar</p>
                  <p className="text-sm text-muted-foreground">#{tokenId.toString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* SBT Utility Tokens */}
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4 text-center">SBT Utility Tokens Received</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {revealResults.sbtTypes.map((sbtType, i) => {
                const info = SBT_INFO[sbtType];
                return (
                  <div
                    key={i}
                    className={`rounded-xl p-4 text-center animate-fade-in border-2 ${
                      sbtType === 3
                        ? "bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border-yellow-500/50"
                        : sbtType === 2
                        ? "bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border-blue-500/50"
                        : "bg-gradient-to-br from-gray-500/20 to-slate-500/20 border-gray-500/50"
                    }`}
                    style={{ animationDelay: `${(revealResults.lilStarTokenIds.length + i) * 100}ms` }}
                  >
                    <img
                      src={info?.image}
                      alt={info?.name}
                      className="w-20 h-20 mx-auto mb-2 rounded-lg object-cover"
                    />
                    <p className="text-white font-semibold text-sm">{info?.name}</p>
                    <p className={`text-xs mt-1 ${
                      sbtType === 3 ? "text-yellow-400" : sbtType === 2 ? "text-blue-400" : "text-gray-400"
                    }`}>
                      {info?.rarity}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="text-center">
            <Button onClick={handleCloseResults} size="lg">
              Continue
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold">
            LilStar Reveal
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/mint">
              <Button variant="outline">Mint</Button>
            </Link>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Reveal Your BlindBoxes</CardTitle>
            <p className="text-muted-foreground mt-2">
              Burn your BlindBoxes to reveal LilStar NFTs + SBT utility tokens
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Redeem Status */}
            <div className="text-center">
              <div
                className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  isRedeemOpen
                    ? "bg-green-500/20 text-green-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {isRedeemOpen ? "Reveal is OPEN" : "Reveal is CLOSED"}
              </div>
            </div>

            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Connect your wallet to reveal</p>
                <ConnectWallet />
              </div>
            ) : !isRedeemOpen ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Reveal is not open yet. Check back later!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Balance */}
                <div className="text-center">
                  <p className="text-muted-foreground">
                    You own <span className="font-bold text-foreground">{balance?.toString() ?? "0"}</span> BlindBox{Number(balance) !== 1 ? "es" : ""}
                  </p>
                </div>

                {/* Token Selection */}
                {isLoadingTokens ? (
                  <div className="text-center py-8">
                    <div className="text-4xl animate-bounce mb-2">📦</div>
                    <p className="text-muted-foreground">Loading your BlindBoxes...</p>
                  </div>
                ) : ownedTokens.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-muted-foreground">You don't have any BlindBoxes to reveal.</p>
                    <Link to="/mint">
                      <Button className="mt-4">Mint BlindBoxes</Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Select All / Deselect All */}
                    <div className="flex justify-center gap-2">
                      <Button variant="outline" size="sm" onClick={selectAll}>
                        Select All
                      </Button>
                      <Button variant="outline" size="sm" onClick={deselectAll}>
                        Deselect All
                      </Button>
                    </div>

                    {/* Token Grid */}
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {ownedTokens.map((tokenId) => (
                        <button
                          key={tokenId.toString()}
                          onClick={() => toggleToken(tokenId)}
                          className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                            selectedTokens.includes(tokenId)
                              ? "border-primary bg-primary/20 shadow-lg shadow-primary/20"
                              : "border-border bg-secondary/50 hover:border-primary/50"
                          }`}
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-1">📦</div>
                            <div className="text-xs font-mono">#{tokenId.toString()}</div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected Count */}
                    <div className="text-center text-sm text-muted-foreground">
                      {selectedTokens.length} selected
                    </div>

                    {/* Reveal Button */}
                    <Button
                      className="w-full h-14 text-lg font-bold bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                      onClick={handleReveal}
                      disabled={selectedTokens.length === 0 || isPending || isConfirming || revealingTokens.length > 0}
                    >
                      {isPending
                        ? "Confirm in wallet..."
                        : isConfirming
                        ? "Revealing..."
                        : `Reveal ${selectedTokens.length} BlindBox${selectedTokens.length !== 1 ? "es" : ""}`}
                    </Button>

                    {/* Error Message */}
                    {error && (
                      <div className="text-center p-4 bg-red-500/20 text-red-400 rounded-lg">
                        {(error as Error).message?.includes("RedeemBlindBoxNotOpen")
                          ? "Reveal is not open yet"
                          : "Reveal failed. Please try again."}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What happens when you reveal?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>1. Your BlindBox NFTs are burned</p>
            <p>2. You receive a random LilStar NFT for each BlindBox</p>
            <p>3. You also receive an SBT (Soulbound Token) utility perk:</p>
            <ul className="list-disc list-inside ml-4">
              <li>5% Lifetime Discount (Common)</li>
              <li>10% Lifetime Discount (Rare)</li>
              <li>Free IRL BlindBox (Legendary)</li>
            </ul>
          </CardContent>
        </Card>
      </main>

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.5s ease-out forwards;
          opacity: 0;
        }
      `}</style>
    </div>
  );
}
