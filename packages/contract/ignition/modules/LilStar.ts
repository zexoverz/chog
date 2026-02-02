import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("LilStarModule", (m) => {
  // Parameters
  const name = m.getParameter("name", "LilStar");
  const symbol = m.getParameter("symbol", "LSTAR");
  const maxSupply = m.getParameter("maxSupply", 6000);

  // Deploy LilStar
  const lilStar = m.contract("LilStar", [name, symbol, maxSupply]);

  return { lilStar };
});
