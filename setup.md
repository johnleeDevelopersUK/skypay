# 1. Set up environment
cp .env.example .env
# Edit .env with your keys

# 2. Install dependencies
forge install

# 3. Run tests
forge test

# 4. Deploy to testnet
forge script scripts/deploy/DeployAll.s.sol:DeployAll \
  --rpc-url $RPC_URL \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvvv

# 5. Deploy to mainnet
forge script scripts/deploy/DeployAll.s.sol:DeployAll \
  --rpc-url $MAINNET_RPC \
  --private-key $MAINNET_KEY \
  --broadcast \
  --verify \
  --slow
