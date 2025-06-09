// scripts/mintPositionExample.js
const { ethers } = require("hardhat");
const addresses = require('./addresses');

async function main() {
  // --- Setup ---
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  // Replace with your deployed tokens and position manager addresses
  const token0Address = addresses.TETHER_ADDRESS;     // USDT
const token1Address = addresses.USDC_ADDRESS;       // USDC
const positionManagerAddress = addresses.POSITION_MANAGER_ADDRESS;

  // Ensure token0 < token1 by address for Uniswap V3
  let tokenA = token0Address.toLowerCase();
  let tokenB = token1Address.toLowerCase();
  if (tokenA > tokenB) {
    // Swap
    [tokenA, tokenB] = [tokenB, tokenA];
    console.log("Swapped token order for Uniswap:", tokenA, tokenB);
  } else {
    console.log("Token order correct:", tokenA, tokenB);
  }

  // Token contract ABI minimal
  const erc20Abi = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
  ];

  // Instantiate token contracts
  const tokenAContract = await ethers.getContractAt(erc20Abi, tokenA);
  const tokenBContract = await ethers.getContractAt(erc20Abi, tokenB);

  // Position manager ABI (simplified mint function)
  const positionManagerAbi = [
    "function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)",
  ];
  const positionManager = await ethers.getContractAt(positionManagerAbi, positionManagerAddress);

  // --- Parameters ---
  const fee = 3000; // 0.03%
  const tickLower = -60;
  const tickUpper = 60;

  // Amounts to provide (adjust these for your liquidity)
  // Fetch decimals to convert amount properly
  const decimalsA = await tokenAContract.decimals();
  const decimalsB = await tokenBContract.decimals();

  // Example: 20 tokens of each (adjust as needed)
  const amountADesired = ethers.utils.parseUnits("20", decimalsA);
  const amountBDesired = ethers.utils.parseUnits("20", decimalsB);

  // --- Approvals ---
  const allowanceA = await tokenAContract.allowance(signer.address, positionManagerAddress);
  if (allowanceA.lt(amountADesired)) {
    console.log(`Approving ${amountADesired.toString()} tokens for tokenA...`);
    const txA = await tokenAContract.approve(positionManagerAddress, amountADesired);
    await txA.wait();
    console.log("TokenA approved");
  } else {
    console.log("TokenA allowance sufficient");
  }

  const allowanceB = await tokenBContract.allowance(signer.address, positionManagerAddress);
  if (allowanceB.lt(amountBDesired)) {
    console.log(`Approving ${amountBDesired.toString()} tokens for tokenB...`);
    const txB = await tokenBContract.approve(positionManagerAddress, amountBDesired);
    await txB.wait();
    console.log("TokenB approved");
  } else {
    console.log("TokenB allowance sufficient");
  }

  // --- Mint Position ---
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now

  console.log("Minting position with params:");
  console.log({
    token0: tokenA,
    token1: tokenB,
    fee,
    tickLower,
    tickUpper,
    amount0Desired: amountADesired.toString(),
    amount1Desired: amountBDesired.toString(),
    amount0Min: 0, // can add slippage tolerance
    amount1Min: 0,
    recipient: signer.address,
    deadline,
  });

  try {
    const tx = await positionManager.mint({
      token0: tokenA,
      token1: tokenB,
      fee,
      tickLower,
      tickUpper,
      amount0Desired: amountADesired,
      amount1Desired: amountBDesired,
      amount0Min: 0,
      amount1Min: 0,
      recipient: signer.address,
      deadline,
    }, { gasLimit: 1000000 });

    console.log("Mint tx sent:", tx.hash);
    const receipt = await tx.wait();
    console.log("Mint tx confirmed:", receipt.transactionHash);
  } catch (error) {
    console.error("Minting failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
