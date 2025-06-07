const { ethers } = require("hardhat");
const { BigNumber } = require("ethers");
const bn = require("bignumber.js");
bn.config({ EXPONENTIAL_AT: 999999, DECIMAL_PLACES: 40 });

const {
  WETH_ADDRESS,
  FACTORY_ADDRESS,
  SWAP_ROUTER_ADDRESS,
  NFT_DESCRIPTOR_ADDRESS,
  POSITION_DESCRIPTOR_ADDRESS,
  POSITION_MANAGER_ADDRESS,
  TETHER_ADDRESS,
  USDC_ADDRESS,
  WRAPPED_BITCOIN_ADDRESS
} = require('./addresses.js');

const {
  NonfungiblePositionManager_Contract,
  Factory_Contract,
} = require('./contractInstances');

// 🔀 Token sorter
function sortTokens(tokenA, tokenB) {
  return tokenA.toLowerCase() < tokenB.toLowerCase() ? [tokenA, tokenB] : [tokenB, tokenA];
}

// 🔢 Price encoder
function encodePriceSqrt(reserve1, reserve0) {
  return BigNumber.from(
    new bn(reserve1.toString())
      .div(reserve0.toString())
      .sqrt()
      .multipliedBy(new bn(2).pow(96))
      .integerValue(3)
      .toString()
  );
}

// 🏗️ Deploy and initialize pool
async function deployPool(token0, token1, fee, price) {
  const [owner] = await ethers.getSigners();
  let poolAddress;

  console.log(`\n🌊 Deploying pool ${fee} for:\n   Token0: ${token0}\n   Token1: ${token1}\n   Price: ${price.toString()}`);

  try {
    const tx = await NonfungiblePositionManager_Contract.connect(owner).createAndInitializePoolIfNecessary(
      token0,
      token1,
      fee,
      price,
      { gasLimit: 5000000 }
    );
    await tx.wait();
    console.log(`✅ Pool created or already exists`);
  } catch (err) {
    console.error(`❌ createAndInitializePoolIfNecessary failed:`, err.message);
  }

  try {
    poolAddress = await Factory_Contract.connect(owner).getPool(token0, token1, fee);
    console.log(`📘 Pool address: ${poolAddress}`);
  } catch (err) {
    console.error(`❌ getPool failed:`, err.message);
    poolAddress = "0x0000000000000000000000000000000000000000";
  }

  return poolAddress;
}

// 🚀 Main
async function main() {
  const [token0, token1] = sortTokens(TETHER_ADDRESS, USDC_ADDRESS);
  const sqrtPriceX96 = encodePriceSqrt(1, 1);

  const usdtUsdc500 = await deployPool(token0, token1, 500, sqrtPriceX96);
  console.log('POOL_USDT_USDC_500:', `'${usdtUsdc500}',`);

  const usdtUsdc3000 = await deployPool(token0, token1, 3000, sqrtPriceX96);
  console.log('POOL_USDT_USDC_3000:', `'${usdtUsdc3000}',`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("💥 Script failed:", err);
    process.exit(1);
  });