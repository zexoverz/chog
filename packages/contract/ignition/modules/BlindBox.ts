import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("BlindBoxModule", (m) => {
  // Parameters
  const maxSupply = m.getParameter("maxSupply", 6000n);
  const totalPresaleAndAuctionSupply = m.getParameter("totalPresaleAndAuctionSupply", 3756n);
  const withdrawAddress = m.getParameter<string>("withdrawAddress");

  // Deploy BlindBox
  const blindBox = m.contract("BlindBox", [
    maxSupply,
    totalPresaleAndAuctionSupply,
    withdrawAddress,
  ]);

  return { blindBox };
});
