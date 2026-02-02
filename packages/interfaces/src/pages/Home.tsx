import { Link } from "react-router-dom";
import { ConnectWallet } from "../components/ConnectWallet";
import { OfferList } from "../components/OfferList";
import { MintNFT } from "../components/MintNFT";
import { CreateOffer } from "../components/CreateOffer";
import { WMONManager } from "../components/WMONManager";
import { NFTPreviewGenerator } from "../components/NFTPreviewGenerator";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">Collectible Swap</h1>
          <div className="flex items-center gap-4">
            <Link to="/gallery">
              <Button variant="outline">View Gallery</Button>
            </Link>
            <ConnectWallet />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* NFT Preview Generator */}
        <Card>
          <CardHeader>
            <CardTitle>NFT Preview Generator</CardTitle>
          </CardHeader>
          <CardContent>
            <NFTPreviewGenerator />
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Create Trade Offer</CardTitle>
              </CardHeader>
              <CardContent>
                <CreateOffer />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Mint NFT</CardTitle>
              </CardHeader>
              <CardContent>
                <MintNFT />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Wrap/Unwrap MON</CardTitle>
              </CardHeader>
              <CardContent>
                <WMONManager />
              </CardContent>
            </Card>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Your Offers</CardTitle>
              </CardHeader>
              <CardContent>
                <OfferList />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contract Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Network:</span>{" "}
                  <span>Monad Testnet</span>
                </div>
                <div>
                  <span className="text-muted-foreground">NFT Swap:</span>{" "}
                  <span className="font-mono text-xs">0x4966ef...9cAb1F</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Collectible:</span>{" "}
                  <span className="font-mono text-xs">0xF5361F...a253b3</span>
                </div>
                <div>
                  <span className="text-muted-foreground">WMON:</span>{" "}
                  <span className="font-mono text-xs">0x629280...Fb0Fc2</span>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-muted-foreground">API:</span>{" "}
                  <span className="font-mono text-xs">localhost:3001</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
