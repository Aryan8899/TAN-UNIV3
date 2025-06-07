const { Contract, ContractFactory, utils, BigNumber } = require("ethers")
const WETH9 = require("../WETH9.json")

const artifacts = {
  UniswapV3Factory: require("@uniswap/v3-core/artifacts/contracts/UniswapV3Factory.sol/UniswapV3Factory.json"),
  SwapRouter: require("../artifacts/contracts/v3-periphery/SwapRouter.sol/SwapRouter.json"),
  NFTDescriptor: require("../artifacts/contracts/v3-periphery/libraries/NFTDescriptor.sol/NFTDescriptor.json"),
  NonfungibleTokenPositionDescriptor: require("../artifacts/contracts/v3-periphery/NonfungibleTokenPositionDescriptor.sol/NonfungibleTokenPositionDescriptor.json"),
  NonfungiblePositionManager: require("../artifacts/contracts/v3-periphery/NonfungiblePositionManager.sol/NonfungiblePositionManager.json"),
  WETH9,
};

const linkLibraries = ({ bytecode, linkReferences }, libraries) => {
  let linkedBytecode = bytecode;
  
  Object.keys(linkReferences).forEach((fileName) => {
    Object.keys(linkReferences[fileName]).forEach((contractName) => {
      if (!libraries.hasOwnProperty(contractName)) {
        throw new Error(`Missing link library name ${contractName}`)
      }
      
      const address = utils
        .getAddress(libraries[contractName])
        .toLowerCase()
        .slice(2); // Remove 0x prefix
      
      linkReferences[fileName][contractName].forEach(
        ({ start, length }) => {
          const start2 = 2 + start * 2; // Account for 0x prefix
          const length2 = length * 2;
          
          // Ensure we have enough bytecode
          if (start2 + length2 > linkedBytecode.length) {
            throw new Error(`Invalid bytecode linking parameters for ${contractName}`);
          }
          
          linkedBytecode = linkedBytecode
            .slice(0, start2)
            .concat(address)
            .concat(linkedBytecode.slice(start2 + length2));
        }
      )
    })
  })
  
  return linkedBytecode;
}

async function getSigner() {
  const signers = await ethers.getSigners();
  
  if (signers.length === 0) {
    throw new Error("No signers available. Make sure your wallet is configured in hardhat.config.js");
  }

  const deployer = signers[0];
  const network = await ethers.provider.getNetwork();
  
  console.log("=".repeat(50));
  console.log("DEPLOYMENT CONFIGURATION");
  console.log("=".repeat(50));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer Address: ${deployer.address}`);
  
  const balance = await deployer.getBalance();
  const balanceInEth = ethers.utils.formatEther(balance);
  console.log(`Deployer Balance: ${balanceInEth} ETH`);
  
  if (balance.lt(ethers.utils.parseEther("0.1"))) {
    console.warn("⚠️  WARNING: Low balance detected. You may need more funds for deployment.");
  }
  
  console.log("=".repeat(50));
  
  return deployer;
}

async function deployContract(name, factory, ...args) {
  console.log(`\n📦 Deploying ${name}...`);
  
  try {
    const contract = await factory.deploy(...args);
    await contract.deployed();
    
    console.log(`✅ ${name} deployed to: ${contract.address}`);
    console.log(`   Transaction hash: ${contract.deployTransaction.hash}`);
    
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 31337) {
      console.log(`   Waiting for confirmations...`);
      await contract.deployTransaction.wait(2);
    }
    
    return contract;
  } catch (error) {
    console.error(`❌ Failed to deploy ${name}:`);
    console.error(error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting Uniswap V3 Core Contracts Deployment");
  
  const deployer = await getSigner();
  
  try {
    // Deploy WETH9
    const Weth = new ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, deployer);
    const weth = await deployContract("WETH9", Weth);

    // Deploy UniswapV3Factory
    const Factory = new ContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, deployer);
    const factory = await deployContract("UniswapV3Factory", Factory);

    // Deploy SwapRouter
    const SwapRouter = new ContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, deployer);
    const swapRouter = await deployContract("SwapRouter", SwapRouter, factory.address, weth.address);

    // Deploy NFTDescriptor
    const NFTDescriptor = new ContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, deployer);
    const nftDescriptor = await deployContract("NFTDescriptor", NFTDescriptor);

    // Link NFTDescriptor library for NonfungibleTokenPositionDescriptor
    console.log(`\n🔗 Linking NFTDescriptor library...`);
    
    // Get the actual link references from the artifact
    const linkReferences = artifacts.NonfungibleTokenPositionDescriptor.linkReferences;
    
    if (!linkReferences) {
      throw new Error("No link references found in NonfungibleTokenPositionDescriptor artifact");
    }
    
    console.log("Link references found:", JSON.stringify(linkReferences, null, 2));
    
    const linkedBytecode = linkLibraries(
      {
        bytecode: artifacts.NonfungibleTokenPositionDescriptor.bytecode,
        linkReferences: linkReferences,
      },
      {
        NFTDescriptor: nftDescriptor.address,
      }
    );

    // Validate linked bytecode
    if (!linkedBytecode || linkedBytecode.length < 4) {
      throw new Error("Invalid linked bytecode generated");
    }
    
    console.log(`✅ Library linking completed. Bytecode length: ${linkedBytecode.length}`);

    // Deploy NonfungibleTokenPositionDescriptor
    const NonfungibleTokenPositionDescriptor = new ContractFactory(
      artifacts.NonfungibleTokenPositionDescriptor.abi, 
      linkedBytecode, 
      deployer
    );
    const nonfungibleTokenPositionDescriptor = await deployContract(
      "NonfungibleTokenPositionDescriptor", 
      NonfungibleTokenPositionDescriptor, 
      weth.address,
      "0x0000000000000000000000000000000000000000000000000000000000000000" // nativeCurrencyLabelBytes
    );

    // Deploy NonfungiblePositionManager
    const NonfungiblePositionManager = new ContractFactory(
      artifacts.NonfungiblePositionManager.abi, 
      artifacts.NonfungiblePositionManager.bytecode, 
      deployer
    );
    const nonfungiblePositionManager = await deployContract(
      "NonfungiblePositionManager", 
      NonfungiblePositionManager, 
      factory.address, 
      weth.address, 
      nonfungibleTokenPositionDescriptor.address
    );

    // Print deployment summary
    console.log("\n" + "=".repeat(50));
    console.log("🎉 DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(50));
    console.log("📋 Contract Addresses:");
    console.log("=".repeat(50));
    console.log('WETH_ADDRESS:', `'${weth.address}',`);
    console.log('FACTORY_ADDRESS:', `'${factory.address}',`);
    console.log('SWAP_ROUTER_ADDRESS:', `'${swapRouter.address}',`);
    console.log('NFT_DESCRIPTOR_ADDRESS:', `'${nftDescriptor.address}',`);
    console.log('POSITION_DESCRIPTOR_ADDRESS:', `'${nonfungibleTokenPositionDescriptor.address}',`);
    console.log('POSITION_MANAGER_ADDRESS:', `'${nonfungiblePositionManager.address}',`);
    console.log("=".repeat(50));
    
    // Save addresses to file
    const fs = require('fs');
    const addresses = {
      network: (await ethers.provider.getNetwork()).name,
      chainId: (await ethers.provider.getNetwork()).chainId,
      contracts: {
        WETH_ADDRESS: weth.address,
        FACTORY_ADDRESS: factory.address,
        SWAP_ROUTER_ADDRESS: swapRouter.address,
        NFT_DESCRIPTOR_ADDRESS: nftDescriptor.address,
        POSITION_DESCRIPTOR_ADDRESS: nonfungibleTokenPositionDescriptor.address,
        POSITION_MANAGER_ADDRESS: nonfungiblePositionManager.address,
      },
      deployer: deployer.address,
      timestamp: new Date().toISOString()
    };
    
    const networkName = (await ethers.provider.getNetwork()).name;
    fs.writeFileSync(
      `deployed-addresses-${networkName}.json`, 
      JSON.stringify(addresses, null, 2)
    );
    
    console.log(`Paste your 💾 Addresses to Address.js deployed-Network${networkName}`);
    
  } catch (error) {
    console.error("\n❌ DEPLOYMENT FAILED:");
    console.error(error);
    throw error;
  }
}

// Alternative approach if the above still fails
async function deployWithAlternativeApproach() {
  console.log("🔄 Trying alternative deployment approach...");
  
  const deployer = await getSigner();
  
  try {
    // Deploy WETH9
    const Weth = new ContractFactory(artifacts.WETH9.abi, artifacts.WETH9.bytecode, deployer);
    const weth = await deployContract("WETH9", Weth);

    // Deploy UniswapV3Factory
    const Factory = new ContractFactory(artifacts.UniswapV3Factory.abi, artifacts.UniswapV3Factory.bytecode, deployer);
    const factory = await deployContract("UniswapV3Factory", Factory);

    // Deploy SwapRouter
    const SwapRouter = new ContractFactory(artifacts.SwapRouter.abi, artifacts.SwapRouter.bytecode, deployer);
    const swapRouter = await deployContract("SwapRouter", SwapRouter, factory.address, weth.address);

    // Deploy NFTDescriptor
    const NFTDescriptor = new ContractFactory(artifacts.NFTDescriptor.abi, artifacts.NFTDescriptor.bytecode, deployer);
    const nftDescriptor = await deployContract("NFTDescriptor", NFTDescriptor);

    // Skip NonfungibleTokenPositionDescriptor for now (deploy manually later)
    console.log("\n⚠️  Skipping NonfungibleTokenPositionDescriptor due to library linking issues");
    console.log("    You'll need to deploy this manually using Hardhat tasks or alternative methods");

    // Deploy NonfungiblePositionManager with a dummy address (replace later)
    console.log("\n⚠️  Deploying NonfungiblePositionManager with dummy descriptor address");
    const NonfungiblePositionManager = new ContractFactory(
      artifacts.NonfungiblePositionManager.abi, 
      artifacts.NonfungiblePositionManager.bytecode, 
      deployer
    );
    const nonfungiblePositionManager = await deployContract(
      "NonfungiblePositionManager", 
      NonfungiblePositionManager, 
      factory.address, 
      weth.address, 
      "0x0000000000000000000000000000000000000000" // Dummy address
    );

    console.log("\n" + "=".repeat(50));
    console.log("🎉 PARTIAL DEPLOYMENT COMPLETED!");
    console.log("=".repeat(50));
    console.log("📋 Contract Addresses:");
    console.log("=".repeat(50));
    console.log('WETH_ADDRESS:', `'${weth.address}',`);
    console.log('FACTORY_ADDRESS:', `'${factory.address}',`);
    console.log('SWAP_ROUTER_ADDRESS:', `'${swapRouter.address}',`);
    console.log('NFT_DESCRIPTOR_ADDRESS:', `'${nftDescriptor.address}',`);
    console.log('POSITION_MANAGER_ADDRESS:', `'${nonfungiblePositionManager.address}',`);
    console.log("=".repeat(50));
    
    console.log("\n📝 NEXT STEPS:");
    console.log("1. Deploy NonfungibleTokenPositionDescriptor manually");
    console.log("2. Update NonfungiblePositionManager with correct descriptor address");
    console.log("3. Use Hardhat library linking features or deploy script with proper linking");
    
  } catch (error) {
    console.error("\n❌ ALTERNATIVE DEPLOYMENT ALSO FAILED:");
    console.error(error);
    throw error;
  }
}

/*
Usage Examples:
- Local deployment: npx hardhat run --network localhost scripts/01_deployContracts.js
- Sepolia testnet: npx hardhat run --network sepolia scripts/01_deployContracts.js

If the main deployment fails, you can also try:
- Using Hardhat's built-in library linking: https://hardhat.org/plugins/nomiclabs-hardhat-ethers.html#library-linking
- Deploy contracts individually using Hardhat tasks
- Use Hardhat's deploy plugin for better library management

For library linking issues, consider:
1. Checking the exact link references in your compiled artifacts
2. Using Hardhat's automatic library linking features
3. Deploying the NFTDescriptor and then manually linking
*/

main()
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error("Main deployment failed, trying alternative approach...");
    try {
      await deployWithAlternativeApproach();
      process.exit(0);
    } catch (altError) {
      console.error("Both deployment methods failed:");
      console.error("Original error:", error);
      console.error("Alternative error:", altError);
      process.exit(1);
    }
  });