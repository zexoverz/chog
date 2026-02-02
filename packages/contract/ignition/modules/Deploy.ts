import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { Address } from "viem";

export default buildModule("DeployModule", (m) => {
  // Parameters
  const owner = m.getParameter<string>("owner");
  const signer = m.getParameter<string>("signer");
  const feeRecipient = m.getParameter<string>("feeRecipient");
  const platformFee = m.getParameter("platformFee", 0n);
  const nftName = m.getParameter("nftName", "Collectible");
  const nftSymbol = m.getParameter("nftSymbol", "COL");
  const baseTokenURI = m.getParameter("baseTokenURI", "");

  // Deploy WMON (or use existing if provided)
  const existingWmon = m.getParameter("wmon", undefined);
  const wmon = existingWmon
    ? m.contractAt("WMON", existingWmon as unknown as Address)
    : m.contract("WMON");

  // Deploy Collectible NFT
  const collectible = m.contract("Collectible", [
    nftName,
    nftSymbol,
    baseTokenURI,
    signer,
    owner,
  ]);

  // Deploy NFTSwap
  const nftSwap = m.contract("NFTSwap", [
    owner,
    feeRecipient,
    platformFee,
    wmon,
  ]);

  return { wmon, collectible, nftSwap };
});
