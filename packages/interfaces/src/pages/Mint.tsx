import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAccount } from "wagmi";
import { formatEther, type Hex } from "viem";
import { ConnectWallet } from "../components/ConnectWallet";
import { useBlindBoxMint, MintPhase } from "../hooks/useBlindBox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CONTRACTS } from "@/config/contracts";

// API base URL for getting mint signatures
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

export function Mint() {
  const { isConnected, address } = useAccount();
  const [amount, setAmount] = useState(1);
  const [signature, setSignature] = useState<Hex | null>(null);
  const [maxAllowed, setMaxAllowed] = useState(0);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const [isLoadingSignature, setIsLoadingSignature] = useState(false);

  const {
    currentPhase,
    phaseName,
    price,
    maxPerWallet,
    minted,
    balance,
    supply,
    presaleMint,
    starlistMint,
    fcfsMint,
  } = useBlindBoxMint();

  const remainingMints = maxPerWallet - minted;
  const totalCost = BigInt(price) * BigInt(amount);
  const isMintDisabled =
    currentPhase === MintPhase.CLOSED ||
    remainingMints <= 0 ||
    amount > remainingMints ||
    !isConnected;

  // Fetch signature for presale/starlist phases
  useEffect(() => {
    async function fetchSignature() {
      if (!address) return;
      if (currentPhase !== MintPhase.PRESALE && currentPhase !== MintPhase.STARLIST) {
        setSignature(null);
        setMaxAllowed(0);
        return;
      }

      setIsLoadingSignature(true);
      setSignatureError(null);

      try {
        const phaseStr = currentPhase === MintPhase.PRESALE ? "PRESALE" : "STARLIST";
        const response = await fetch(
          `${API_BASE_URL}/blindbox/signature?address=${address}&phase=${phaseStr}`
        );

        if (!response.ok) {
          if (response.status === 404) {
            setSignatureError("Your address is not on the allowlist for this phase");
          } else {
            setSignatureError("Failed to fetch signature");
          }
          setSignature(null);
          setMaxAllowed(0);
          return;
        }

        const data = await response.json();
        setSignature(data.signature as Hex);
        setMaxAllowed(data.maxAllowed);
      } catch {
        setSignatureError("Failed to connect to API");
        setSignature(null);
        setMaxAllowed(0);
      } finally {
        setIsLoadingSignature(false);
      }
    }

    fetchSignature();
  }, [address, currentPhase]);

  const handleMint = () => {
    if (currentPhase === MintPhase.PRESALE && signature) {
      presaleMint.mint(amount, maxAllowed, signature, totalCost);
    } else if (currentPhase === MintPhase.STARLIST && signature) {
      starlistMint.mint(amount, maxAllowed, signature, totalCost);
    } else if (currentPhase === MintPhase.FCFS) {
      fcfsMint.mint(amount, totalCost);
    }
  };

  const isPending =
    presaleMint.isPending || starlistMint.isPending || fcfsMint.isPending;
  const isConfirming =
    presaleMint.isConfirming || starlistMint.isConfirming || fcfsMint.isConfirming;
  const isSuccess =
    presaleMint.isSuccess || starlistMint.isSuccess || fcfsMint.isSuccess;
  const mintError = presaleMint.error || starlistMint.error || fcfsMint.error;

  const mintedPercent =
    supply.mintableSupply && supply.totalMinted
      ? (Number(supply.totalMinted) / Number(supply.mintableSupply)) * 100
      : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link to="/" className="text-2xl font-bold">
            LilStar BlindBox
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/reveal">
              <Button variant="default">Reveal</Button>
            </Link>
            <Link to="/">
              <Button variant="outline">Back to Home</Button>
            </Link>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="mb-6">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">BlindBox Mint</CardTitle>
            <p className="text-muted-foreground mt-2">
              Mint a BlindBox and reveal it to get a unique LilStar NFT + SBT utility token
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Phase Status */}
            <div className="text-center">
              <div
                className={`inline-block px-4 py-2 rounded-full text-sm font-medium ${
                  currentPhase === MintPhase.CLOSED
                    ? "bg-red-500/20 text-red-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {phaseName}
              </div>
            </div>

            {/* Supply Progress */}
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Minted</span>
                <span>
                  {supply.totalMinted?.toString() ?? "0"} /{" "}
                  {supply.mintableSupply?.toString() ?? "0"}
                </span>
              </div>
              <div className="w-full bg-secondary rounded-full h-3">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300"
                  style={{ width: `${mintedPercent}%` }}
                />
              </div>
            </div>

            {/* Price Display */}
            {currentPhase !== MintPhase.CLOSED && (
              <div className="bg-secondary/50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Price per BlindBox</span>
                  <span className="text-xl font-bold">
                    {formatEther(BigInt(price))} MON
                  </span>
                </div>
              </div>
            )}

            {/* Connect Wallet or Mint UI */}
            {!isConnected ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Connect your wallet to mint
                </p>
                <ConnectWallet />
              </div>
            ) : currentPhase === MintPhase.CLOSED ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">
                  Minting is currently closed. Check back later!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Signature status for presale/starlist */}
                {(currentPhase === MintPhase.PRESALE ||
                  currentPhase === MintPhase.STARLIST) && (
                  <div className="text-sm">
                    {isLoadingSignature ? (
                      <p className="text-muted-foreground">
                        Checking allowlist status...
                      </p>
                    ) : signatureError ? (
                      <p className="text-red-400">{signatureError}</p>
                    ) : signature ? (
                      <p className="text-green-400">
                        You're on the allowlist! Max allocation: {maxAllowed}
                      </p>
                    ) : null}
                  </div>
                )}

                {/* Amount Selector */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAmount((a) => Math.max(1, a - 1))}
                    disabled={amount <= 1}
                  >
                    -
                  </Button>
                  <span className="text-2xl font-bold w-12 text-center">
                    {amount}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setAmount((a) => Math.min(remainingMints, a + 1))}
                    disabled={amount >= remainingMints}
                  >
                    +
                  </Button>
                </div>

                {/* Remaining mints */}
                <p className="text-center text-sm text-muted-foreground">
                  You can mint {remainingMints} more (minted: {minted} / {maxPerWallet})
                </p>

                {/* Total Cost */}
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Cost</span>
                    <span className="text-xl font-bold">
                      {formatEther(totalCost)} MON
                    </span>
                  </div>
                </div>

                {/* Mint Button */}
                <Button
                  className="w-full h-12 text-lg"
                  onClick={handleMint}
                  disabled={
                    isMintDisabled ||
                    isPending ||
                    isConfirming ||
                    ((currentPhase === MintPhase.PRESALE ||
                      currentPhase === MintPhase.STARLIST) &&
                      !signature)
                  }
                >
                  {isPending
                    ? "Confirming..."
                    : isConfirming
                    ? "Minting..."
                    : `Mint ${amount} BlindBox${amount > 1 ? "es" : ""}`}
                </Button>

                {/* Success Message */}
                {isSuccess && (
                  <div className="text-center p-4 bg-green-500/20 text-green-400 rounded-lg">
                    Successfully minted! Check your wallet.
                  </div>
                )}

                {/* Error Message */}
                {mintError && (
                  <div className="text-center p-4 bg-red-500/20 text-red-400 rounded-lg">
                    {(mintError as Error).message?.includes("InsufficientFunds")
                      ? "Insufficient funds"
                      : (mintError as Error).message?.includes("ExceedsMaxPerWallet")
                      ? "Exceeds max per wallet"
                      : (mintError as Error).message?.includes("PhaseNotOpen")
                      ? "This phase is not open"
                      : "Mint failed. Please try again."}
                  </div>
                )}
              </div>
            )}

            {/* Your BlindBoxes */}
            {isConnected && Number(balance) > 0 && (
              <div className="border-t pt-4">
                <p className="text-center text-muted-foreground">
                  You own <span className="font-bold text-foreground">{balance.toString()}</span>{" "}
                  BlindBox{Number(balance) > 1 ? "es" : ""}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contract Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">BlindBox</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${CONTRACTS.monadTestnet.blindBox}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline"
              >
                {CONTRACTS.monadTestnet.blindBox.slice(0, 6)}...
                {CONTRACTS.monadTestnet.blindBox.slice(-4)}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">LilStar</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${CONTRACTS.monadTestnet.lilStar}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline"
              >
                {CONTRACTS.monadTestnet.lilStar.slice(0, 6)}...
                {CONTRACTS.monadTestnet.lilStar.slice(-4)}
              </a>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">LilStarSBT</span>
              <a
                href={`https://testnet.monadexplorer.com/address/${CONTRACTS.monadTestnet.lilStarSBT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs hover:underline"
              >
                {CONTRACTS.monadTestnet.lilStarSBT.slice(0, 6)}...
                {CONTRACTS.monadTestnet.lilStarSBT.slice(-4)}
              </a>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
