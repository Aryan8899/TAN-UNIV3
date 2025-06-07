const { ethers } = require("hardhat");
const fs = require('fs');

async function getSigner() {
  const [owner] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log("=".repeat(50));
  console.log("TOKEN DEPLOYMENT CONFIGURATION");
  console.log("=".repeat(50));
  console.log(`Network: ${network.name} (Chain ID: ${network.chainId})`);
  console.log(`Deployer Address: ${owner.address}`);

  const ownerBalance = await owner.getBalance();
  const ownerBalanceInEth = ethers.utils.formatEther(ownerBalance);
  console.log(`Balance: ${ownerBalanceInEth} ETH`);

  console.log("=".repeat(50));

  return owner;
}

async function deployWithRetry(contractName, owner, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`\n📦 Deploying ${contractName}... (Attempt ${i + 1}/${maxRetries})`);
      
      const ContractFactory = await ethers.getContractFactory(contractName, owner);
      const contract = await ContractFactory.deploy();
      await contract.deployed();
      
      console.log(`✅ ${contractName} deployed to: ${contract.address}`);
      console.log(`   Transaction hash: ${contract.deployTransaction.hash}`);
      
      // Wait for confirmations on non-localhost networks
      const network = await ethers.provider.getNetwork();
      if (network.chainId !== 31337) { // Not localhost
        console.log(`   Waiting for confirmations...`);
        await contract.deployTransaction.wait(2);
      }
      
      return contract;
    } catch (error) {
      console.error(`❌ Attempt ${i + 1} failed for ${contractName}:`);
      console.error(error.message);
      
      if (i === maxRetries - 1) {
        throw error;
      }
      
      console.log(`   Retrying in 2 seconds...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

async function mintTokens(contract, tokenName, owner, recipient, amount) {
  console.log(`\n🪙 Minting ${amount} ${tokenName} tokens...`);
  
  try {
    const mintAmount = ethers.utils.parseEther(amount);
    const tx = await contract.connect(owner).mint(recipient.address, mintAmount);
    await tx.wait();
    
    console.log(`✅ Minted ${amount} ${tokenName} to ${recipient.address}`);
    console.log(`   Transaction hash: ${tx.hash}`);
    
    // Verify balance
    const balance = await contract.balanceOf(recipient.address);
    const formattedBalance = ethers.utils.formatEther(balance);
    console.log(`   Recipient balance: ${formattedBalance} ${tokenName}`);
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to mint ${tokenName}:`);
    console.error(error.message);
    throw error;
  }
}

async function main() {
  console.log("🚀 Starting Token Deployment");
  
  const owner = await getSigner();

  
  try {
    // Deploy tokens
    console.log("\n" + "=".repeat(40));
    console.log("DEPLOYING TOKENS");
    console.log("=".repeat(40));
    
    const Tether = await ethers.getContractFactory('Tether', owner);
    const tether = await Tether.deploy();
    await tether.deployed();
    console.log(`✅ Tether deployed to: ${tether.address}`);
    
    const Usdc = await ethers.getContractFactory('UsdCoin', owner);
    const usdc = await Usdc.deploy();
    await usdc.deployed();
    console.log(`✅ USDC deployed to: ${usdc.address}`);
    
    const WrappedBitcoin = await ethers.getContractFactory('WrappedBitcoin', owner);
    const wrappedBitcoin = await WrappedBitcoin.deploy();
    await wrappedBitcoin.deployed();
    console.log(`✅ Wrapped Bitcoin deployed to: ${wrappedBitcoin.address}`);
    
    // Wait for confirmations on testnets/mainnet
    const network = await ethers.provider.getNetwork();
    if (network.chainId !== 31337) {
      console.log(`\n⏳ Waiting for confirmations on ${network.name}...`);
      await Promise.all([
        tether.deployTransaction.wait(2),
        usdc.deployTransaction.wait(2),
        wrappedBitcoin.deployTransaction.wait(2)
      ]);
      console.log(`✅ All deployments confirmed`);
    }
    
    // Mint tokens
    console.log("\n" + "=".repeat(40));
    console.log("MINTING TOKENS");
    console.log("=".repeat(40));
    
    await tether.connect(owner).mint(
      owner.address,
      ethers.utils.parseEther('100000')
    );
    console.log(`✅ Minted 100,000 USDT to ${owner.address}`);
    
    await usdc.connect(owner).mint(
      owner.address,
      ethers.utils.parseEther('100000')
    );
    console.log(`✅ Minted 100,000 USDC to ${owner.address}`);
    
    await wrappedBitcoin.connect(owner).mint(
      owner.address,
      ethers.utils.parseEther('100000')
    );
    console.log(`✅ Minted 100,000 WBTC to ${owner.address}`);
    
    // Print final results
    console.log("\n" + "=".repeat(50));
    console.log("🎉 TOKEN DEPLOYMENT COMPLETED SUCCESSFULLY!");
    console.log("=".repeat(50));
    console.log("📋 Contract Addresses:");
    console.log("=".repeat(50));
    console.log('TETHER_ADDRESS:', `'${tether.address}',`);
    console.log('USDC_ADDRESS:', `'${usdc.address}',`);
    console.log('WRAPPED_BITCOIN_ADDRESS:', `'${wrappedBitcoin.address}',`);
    console.log("=".repeat(50));
    
    // Verify final balances
    console.log("\n📊 FINAL TOKEN BALANCES:");
    console.log("=".repeat(50));
    const tetherBalance = await tether.balanceOf(owner.address);
    const usdcBalance = await usdc.balanceOf(owner.address);
    const wbtcBalance = await wrappedBitcoin.balanceOf(owner.address);
    
    console.log(`USDT: ${ethers.utils.formatEther(tetherBalance)} (${owner.address})`);
    console.log(`USDC: ${ethers.utils.formatEther(usdcBalance)} (${owner.address})`);
    console.log(`WBTC: ${ethers.utils.formatEther(wbtcBalance)} (${owner.address})`);
    console.log("=".repeat(50));
    
    // Save deployment info
    const deploymentInfo = {
      network: network.name,
      chainId: network.chainId,
      deployer: owner.address,
      recipient: owner.address,
      contracts: {
        TETHER_ADDRESS: tether.address,
        USDC_ADDRESS: usdc.address,
        WRAPPED_BITCOIN_ADDRESS: wrappedBitcoin.address,
      },
      balances: {
        USDT: ethers.utils.formatEther(tetherBalance),
        USDC: ethers.utils.formatEther(usdcBalance),
        WBTC: ethers.utils.formatEther(wbtcBalance)
      },
      timestamp: new Date().toISOString()
    };
    
    const filename = `deployed-tokens-${network.name}.json`;
    fs.writeFileSync(filename, JSON.stringify(deploymentInfo, null, 2));
    console.log(`💾 Deployment info saved to: ${filename}`);
    
  } catch (error) {
    console.error("\n❌ TOKEN DEPLOYMENT FAILED:");
    console.error(error);
    
    // Additional error context
    if (error.message.includes('insufficient funds')) {
      console.error("\n💡 Possible solutions:");
      console.error("   1. Add more ETH to your deployer account");
      console.error("   2. Reduce gas price in hardhat.config.js");
      console.error("   3. Use a different network with lower fees");
    }
    
    throw error;
  }
}

/*
Usage Examples:
- Local deployment: npx hardhat run --network localhost scripts/02_deployTokens.js
- Sepolia testnet: npx hardhat run --network sepolia scripts/02_deployTokens.js
- Mainnet: npx hardhat run --network mainnet scripts/02_deployTokens.js

Prerequisites:
- Hardhat configured with proper networks
- Wallet with sufficient ETH for gas fees
- Token contracts (Tether, UsdCoin, WrappedBitcoin) in contracts folder

Network Configuration Example (hardhat.config.js):
networks: {
  sepolia: {
    url: process.env.SEPOLIA_URL,
    accounts: [process.env.PRIVATE_KEY, process.env.PRIVATE_KEY_2]
  }
}
*/

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });