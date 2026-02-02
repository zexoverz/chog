import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * LilStarSBT standalone deployment module
 *
 * Deploys the Soulbound Token (ERC-1155) contract for utility perks:
 * - Token ID 1: 5% Lifetime Discount (2500 supply)
 * - Token ID 2: 10% Lifetime Discount (2500 supply)
 * - Token ID 3: Free IRL BlindBox (1000 supply)
 */
export default buildModule("LilStarSBTModule", (m) => {
  // Deploy LilStarSBT
  const lilStarSBT = m.contract("LilStarSBT", []);

  return { lilStarSBT };
});
