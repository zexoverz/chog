import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("NFTSwapModule", (m) => {
  const owner = m.getParameter<string>("owner");
  const feeRecipient = m.getParameter<string>("feeRecipient");
  const platformFee = m.getParameter("platformFee", 0n);
  const wmon = m.getParameter<string>("wmon");

  const nftSwap = m.contract("NFTSwap", [owner, feeRecipient, platformFee, wmon]);

  return { nftSwap };
});
