import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { parseEther, formatEther } from "viem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useWMONBalance, useWrapMON, useUnwrapWMON } from "../hooks";

export function WMONManager() {
  const { address, isConnected } = useAccount();
  const { data: monBalance } = useBalance({ address });
  const { data: wmonBalance, refetch: refetchWMON } = useWMONBalance(address);

  const [wrapAmount, setWrapAmount] = useState("");
  const [unwrapAmount, setUnwrapAmount] = useState("");

  const { wrap, isPending: isWrapping, isConfirming: isWrapConfirming, isSuccess: wrapSuccess, hash: wrapHash } = useWrapMON();
  const { unwrap, isPending: isUnwrapping, isConfirming: isUnwrapConfirming, isSuccess: unwrapSuccess, hash: unwrapHash } = useUnwrapWMON();

  const handleWrap = () => {
    if (!wrapAmount) return;
    wrap(parseEther(wrapAmount));
  };

  const handleUnwrap = () => {
    if (!unwrapAmount) return;
    unwrap(parseEther(unwrapAmount));
  };

  const handleMaxWrap = () => {
    if (monBalance) {
      // Leave some for gas
      const maxAmount = monBalance.value > parseEther("0.01")
        ? monBalance.value - parseEther("0.01")
        : 0n;
      setWrapAmount(formatEther(maxAmount));
    }
  };

  const handleMaxUnwrap = () => {
    if (wmonBalance) {
      setUnwrapAmount(formatEther(wmonBalance));
    }
  };

  // Refetch balances after successful transactions
  if (wrapSuccess || unwrapSuccess) {
    setTimeout(() => refetchWMON(), 1000);
  }

  if (!isConnected) {
    return (
      <div className="text-center text-muted-foreground py-4">
        Connect your wallet to manage WMON
      </div>
    );
  }

  const isWrapLoading = isWrapping || isWrapConfirming;
  const isUnwrapLoading = isUnwrapping || isUnwrapConfirming;

  return (
    <div className="space-y-4">
      {/* Balances */}
      <div className="grid grid-cols-2 gap-4 p-3 bg-muted rounded-lg text-sm">
        <div>
          <span className="text-muted-foreground">MON:</span>{" "}
          <span className="font-mono">
            {monBalance ? parseFloat(formatEther(monBalance.value)).toFixed(4) : "0"}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">WMON:</span>{" "}
          <span className="font-mono">
            {wmonBalance ? parseFloat(formatEther(wmonBalance)).toFixed(4) : "0"}
          </span>
        </div>
      </div>

      {/* Wrap MON → WMON */}
      <div className="space-y-2">
        <Label>Wrap MON → WMON</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.001"
            placeholder="0.0"
            value={wrapAmount}
            onChange={(e) => setWrapAmount(e.target.value)}
            disabled={isWrapLoading}
          />
          <Button size="sm" variant="outline" onClick={handleMaxWrap} disabled={isWrapLoading}>
            Max
          </Button>
          <Button onClick={handleWrap} disabled={!wrapAmount || isWrapLoading}>
            {isWrapping && "Confirm..."}
            {isWrapConfirming && "Wrapping..."}
            {!isWrapLoading && "Wrap"}
          </Button>
        </div>
      </div>

      {/* Unwrap WMON → MON */}
      <div className="space-y-2">
        <Label>Unwrap WMON → MON</Label>
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.001"
            placeholder="0.0"
            value={unwrapAmount}
            onChange={(e) => setUnwrapAmount(e.target.value)}
            disabled={isUnwrapLoading}
          />
          <Button size="sm" variant="outline" onClick={handleMaxUnwrap} disabled={isUnwrapLoading}>
            Max
          </Button>
          <Button onClick={handleUnwrap} disabled={!unwrapAmount || isUnwrapLoading}>
            {isUnwrapping && "Confirm..."}
            {isUnwrapConfirming && "Unwrapping..."}
            {!isUnwrapLoading && "Unwrap"}
          </Button>
        </div>
      </div>

      {/* Success messages */}
      {wrapSuccess && wrapHash && (
        <div className="text-sm text-green-600">
          Wrapped!{" "}
          <a href={`https://testnet.monadexplorer.com/tx/${wrapHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            View tx
          </a>
        </div>
      )}
      {unwrapSuccess && unwrapHash && (
        <div className="text-sm text-green-600">
          Unwrapped!{" "}
          <a href={`https://testnet.monadexplorer.com/tx/${unwrapHash}`} target="_blank" rel="noopener noreferrer" className="underline">
            View tx
          </a>
        </div>
      )}
    </div>
  );
}
