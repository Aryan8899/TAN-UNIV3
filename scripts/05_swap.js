const { ethers } = require("hardhat");
const {
  TETHER_ADDRESS,
  USDC_ADDRESS,
  SWAP_ROUTER_ADDRESS,
} = require("./addresses");

const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() view returns (uint8)"
];

const SWAP_ROUTER_ABI = [
  "function exactInputSingle(tuple(address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) external payable returns (uint256 amountOut)"
];

async function main() {
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);

  const tokenIn = TETHER_ADDRESS;
  const tokenOut = USDC_ADDRESS;
  const fee = 500; // 0.05%
  const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes from now

  const tokenInContract = await ethers.getContractAt(ERC20_ABI, tokenIn);
  const tokenOutContract = await ethers.getContractAt(ERC20_ABI, tokenOut);
  const swapRouter = await ethers.getContractAt(SWAP_ROUTER_ABI, SWAP_ROUTER_ADDRESS);

  const decimals = await tokenInContract.decimals();
  console.log("USDT decimals:", decimals.toString());

  const amountIn = ethers.utils.parseUnits("10", decimals); // 10 USDT
  console.log("AmountIn (raw units):", amountIn.toString());

  // Check allowance
  const allowance = await tokenInContract.allowance(signer.address, SWAP_ROUTER_ADDRESS);
  if (allowance.lt(amountIn)) {
    console.log("Approving token...");
    const approveTx = await tokenInContract.approve(SWAP_ROUTER_ADDRESS, amountIn);
    await approveTx.wait();
    console.log("Approval successful.");
  } else {
    console.log("Sufficient allowance already set.");
  }

  // Perform swap
  console.log("Swapping 10 USDT for USDC...");
  const tx = await swapRouter.exactInputSingle({
    tokenIn,
    tokenOut,
    fee,
    recipient: signer.address,
    deadline,
    amountIn,
    amountOutMinimum: 0, // Set to 0 for demo; consider using slippage tolerance in prod
    sqrtPriceLimitX96: 0 // No price limit
  }, {
    gasLimit: 300000
  });

  const receipt = await tx.wait();
  console.log("✅ Swap complete!");
  console.log("📦 Tx hash:", receipt.transactionHash);
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
