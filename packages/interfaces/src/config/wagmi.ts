import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { monadTestnet } from "./chains";

export const config = getDefaultConfig({
  appName: "Collectible Swap",
  projectId: "demo",
  chains: [monadTestnet],
  ssr: false,
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
