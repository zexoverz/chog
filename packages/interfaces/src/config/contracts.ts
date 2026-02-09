import type { Address } from "viem";

export const CONTRACTS = {
  monadTestnet: {
    wmon: "0x6292801F2598D7a24FA99265685bcCD4DcFB0Fc2" as Address,
    collectible: "0xF5361Ff6f59103db06BA5758DFE105a70da253b3" as Address,
    nftSwap: "0x4966ef314ED51dc52Ba4e210BC766D953f9cAb1F" as Address,
    blindBox: "0x19c1Fa41821dA8Fb08B879b5185a2bB09e65fBB0" as Address,
    lilStar: "0xF9e709Ad3e63540ba2E92F7051dA64f7f2D02990" as Address,
    lilStarSBT: "0x73cdEAFE62Fe3c7b1B51cb1621443B52FC82a613" as Address,
  },
} as const;

export type NetworkName = keyof typeof CONTRACTS;

export function getContracts(network: NetworkName) {
  return CONTRACTS[network];
}
