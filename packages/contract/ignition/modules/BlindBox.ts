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
export default buildModule("BlindBoxModule", (m) => {
  // Parameters
  const maxSupply = m.getParameter("maxSupply", 6000n);
  const mintableSupply = m.getParameter("mintableSupply", 3756n);
  const withdrawAddress = m.getParameter<string>("withdrawAddress");

  // Deploy BlindBox
  const blindBox = m.contract("BlindBox", [
    maxSupply,
    mintableSupply,
    withdrawAddress,
  ]);

  return { blindBox };
});
