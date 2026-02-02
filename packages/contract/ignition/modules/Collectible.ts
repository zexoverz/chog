import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CollectibleModule", (m) => {
  const name = m.getParameter("name", "Collectible");
  const symbol = m.getParameter("symbol", "COL");
  const baseTokenURI = m.getParameter("baseTokenURI", "");
  const signer = m.getParameter<string>("signer");
  const owner = m.getParameter<string>("owner");

  const collectible = m.contract("Collectible", [
    name,
    symbol,
    baseTokenURI,
    signer,
    owner,
  ]);

  return { collectible };
});
