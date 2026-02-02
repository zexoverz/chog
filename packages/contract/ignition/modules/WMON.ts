import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("WMONModule", (m) => {
  const wmon = m.contract("WMON");

  return { wmon };
});
