import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * Full deployment module for LilStar NFT system
 *
 * Deploys both BlindBox and LilStar contracts and links them together.
 *
 * After deployment, you need to:
 * 1. Set offchain signer on BlindBox: blindBox.setOffchainSigner(signerAddress)
 * 2. Set base URIs: blindBox.setBaseURI(...), lilStar.setBaseURI(...)
 * 3. Set presale/auction params when ready
 * 4. Open redemption when ready: blindBox.openRedeemBlindBoxState(), lilStar.setRedeemBlindBoxState(true)
 */
export default buildModule("LilStarDeployModule", (m) => {
  // ============
  // Parameters
  // ============

  // BlindBox params
  const maxSupply = m.getParameter("maxSupply", 6000n);
  const totalPresaleAndAuctionSupply = m.getParameter("totalPresaleAndAuctionSupply", 3756n);
  const withdrawAddress = m.getParameter<string>("withdrawAddress");

  // LilStar params
  const lilStarName = m.getParameter("lilStarName", "LilStar");
  const lilStarSymbol = m.getParameter("lilStarSymbol", "LSTAR");

  // ============
  // Deploy Contracts
  // ============

  // Deploy BlindBox (the mintable blind box NFT)
  const blindBox = m.contract("BlindBox", [
    maxSupply,
    totalPresaleAndAuctionSupply,
    withdrawAddress,
  ]);

  // Deploy LilStar (the revealed NFT)
  const lilStar = m.contract("LilStar", [
    lilStarName,
    lilStarSymbol,
    maxSupply, // Same max supply as BlindBox
  ]);

  // ============
  // Link Contracts
  // ============

  // Set LilStar contract address on BlindBox (for redemption)
  m.call(blindBox, "setLilStarContract", [lilStar]);

  // Set BlindBox contract address on LilStar (to verify redeemer)
  m.call(lilStar, "setBlindBoxAddress", [blindBox]);

  return { blindBox, lilStar };
});
