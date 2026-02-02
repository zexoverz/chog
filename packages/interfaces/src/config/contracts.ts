import type { Address } from "viem";

export const CONTRACTS = {
  monadTestnet: {
    wmon: "0x6292801F2598D7a24FA99265685bcCD4DcFB0Fc2" as Address,
    collectible: "0xF5361Ff6f59103db06BA5758DFE105a70da253b3" as Address,
    nftSwap: "0x4966ef314ED51dc52Ba4e210BC766D953f9cAb1F" as Address,
    blindBox: "0xEaB0Cb3bF45F7D8b27dFbb7E1390Bf4a10510dBF" as Address,
    lilStar: "0x1c9f5B6e8C9e358C4E583B2c2F6F7e9C75d577B4" as Address,
    lilStarSBT: "0x285c21Fd7f7fBd5501949cf1398502699f018172" as Address,
  },
} as const;

export type NetworkName = keyof typeof CONTRACTS;

export function getContracts(network: NetworkName) {
  return CONTRACTS[network];
}
