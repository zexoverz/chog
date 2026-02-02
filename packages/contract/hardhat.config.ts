import "dotenv/config"
import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import { configVariable, defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatToolboxViemPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
      production: {
        version: "0.8.28",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    },
  },
  networks: {
    hardhatMainnet: {
      type: "edr-simulated",
      chainType: "l1",
    },
    hardhatOp: {
      type: "edr-simulated",
      chainType: "op",
    },
    sepolia: {
      type: "http",
      chainType: "l1",
      url: configVariable("SEPOLIA_RPC_URL"),
      accounts: [configVariable("SEPOLIA_PRIVATE_KEY")],
    },
    monadTestnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("MONAD_TESTNET_RPC_URL"),
      accounts: [configVariable("MONAD_PRIVATE_KEY")],
    },
    monadMainnet: {
      type: "http",
      chainType: "l1",
      url: configVariable("MONAD_MAINNET_RPC_URL"),
      accounts: [configVariable("MONAD_PRIVATE_KEY")],
    },
  },
  verify: {
    blockscout: {
      enabled: false,
    },
    etherscan: {
      enabled: true,
      apiKey: configVariable('ETHERSCAN_API_KEY'),
    },
    sourcify: {
      enabled: true,
      apiUrl: "https://sourcify-api-monad.blockvision.org",
    },
  },
  chainDescriptors: {
    143: {
      name: "MonadMainnet",
      blockExplorers: {
        etherscan: {
          name: "Monadscan",
          url: "https://monadscan.com",
          apiUrl: "https://api.etherscan.io/v2/api",
        },
      },
    },
  }
});
