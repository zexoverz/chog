import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Full deployment module for LilStar NFT system
 *
 * Deploys all three contracts and links them together:
 * - BlindBox: The mintable mystery box NFT (ERC-721A)
 * - LilStar: The revealed NFT (ERC-721)
 * - LilStarSBT: Soulbound utility tokens (ERC-1155)
 *
 * After deployment, you need to:
 * 1. Set offchain signer: blindBox.setOffchainSigner(signerAddress)
 * 2. Set prices: blindBox.setPrices(presalePrice, starlistPrice, fcfsPrice)
 * 3. Set base URIs:
 *    - blindBox.setBaseURI("https://api.lilchogstars.com/blindbox/metadata/")
 *    - lilStar.setBaseURI("https://api.lilchogstars.com/lilstar/metadata/")
 *    - lilStarSBT.setURI("https://api.lilchogstars.com/sbt/metadata/")
 * 4. Set phase: blindBox.setPhase(1) for PRESALE, 2 for STARLIST, 3 for FCFS
 * 5. Open redemption when ready:
 *    - blindBox.openRedeemBlindBoxState()
 *    - lilStar.setRedeemBlindBoxState(true)
 */
export default buildModule("LilStarDeployModule", (m) => {
  // ============
  // Parameters
  // ============

  // BlindBox params
  const maxSupply = m.getParameter("maxSupply", 6000n);
  const withdrawAddress = m.getParameter("withdrawAddress", m.getAccount(0));

  // LilStar params
  const lilStarName = m.getParameter("lilStarName", "LilStar");
  const lilStarSymbol = m.getParameter("lilStarSymbol", "LSTAR");

  // ============
  // Deploy Contracts
  // ============

  // 1. Deploy BlindBox (the mintable mystery box NFT)
  const blindBox = m.contract("LilStarBlindBox", [
    maxSupply,
    withdrawAddress,
  ]);

  // 2. Deploy LilStar (the revealed NFT)
  const lilStar = m.contract("LilStar", [
    lilStarName,
    lilStarSymbol,
    maxSupply, // Same max supply as BlindBox
  ]);

  // 3. Deploy LilStarSBT (soulbound utility tokens)
  const lilStarSBT = m.contract("LilStarRewards", []);

  // ============
  // Link Contracts
  // ============

  // BlindBox -> LilStar (for redemption)
  m.call(blindBox, "setLilStarContract", [lilStar]);

  // LilStar -> BlindBox (to verify redeemer)
  m.call(lilStar, "setBlindBoxAddress", [blindBox]);

  // LilStar -> SBT (to mint SBTs during reveal)
  m.call(lilStar, "setSBTContract", [lilStarSBT]);

  // SBT -> LilStar (to authorize minting)
  m.call(lilStarSBT, "setLilStarContract", [lilStar]);

  return { blindBox, lilStar, lilStarSBT };
});
