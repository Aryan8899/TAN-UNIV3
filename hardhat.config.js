require("@nomiclabs/hardhat-ethers");
require("dotenv").config();

module.exports = {
  solidity: {
    version: "0.7.6",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    tan: {
      url: "https://tan-devnetrpc2.tan.live", // TAN RPC
      accounts: [process.env.PRIVATE_KEY],    // Your wallet private key
      chainId: 4442,
      
      // Set gas fees as strings or numbers directly (values in wei)
      maxFeePerGas: 50_000_000_000,       // 50 gwei in wei (50 * 10^9)
      maxPriorityFeePerGas: 3_000_000_000, // 3 gwei in wei (3 * 10^9)
      gas: 2100000,
    },
  },
};
