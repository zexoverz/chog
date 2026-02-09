import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * BlindBox standalone deployment module
 *
 * Deploys the BlindBox (Mystery Box) NFT contract
 *
 * Mint Phases:
 * - Presale: $25 (signature required)
 * - Starlist: $35 (signature required)
 * - FCFS: $40 (open to public)
 */
export default buildModule("LilStarBlindBoxModule", (m) => {
  // Parameters
  const maxSupply = m.getParameter("maxSupply", 6000n);
  const withdrawAddress = m.getParameter<string>("withdrawAddress");

  // Deploy BlindBox
  const blindBox = m.contract("LilStarBlindBox", [
    maxSupply,
    withdrawAddress,
  ]);

  return { blindBox };
});
