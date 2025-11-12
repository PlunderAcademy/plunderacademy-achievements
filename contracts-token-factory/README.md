# Plunder Academy Token Factory

A Foundry-based smart contract system for creating standardized ERC-20 tokens for Plunder Academy learners. This factory provides a simple way for users to deploy their own tokens with built-in creator/claimant verification for achievement tracking.

## 🏗️ Architecture

### Contracts

- **`PlunderAcademyToken.sol`**: ERC-20 token with creator/claimant tracking
- **`PlunderAcademyTokenFactory.sol`**: Factory contract for creating tokens

### Key Features

- ✅ **ERC-20 Compliance**: Full OpenZeppelin ERC-20 implementation
- ✅ **Creator Tracking**: Each token tracks who created it  
- ✅ **Claimant Verification**: Built-in claimant field for achievement verification
- ✅ **Gas Efficient**: ~50% cheaper than individual contract deployment
- ✅ **Supply Controls**: Maximum 1 billion tokens per deployment
- ✅ **Event Logging**: Comprehensive event emission for tracking

## 🚀 Quick Start

### Prerequisites

- Foundry installed (`https://book.getfoundry.sh/getting-started/installation`)
- Environment variables set (see below)

### Environment Setup

Set these environment variables following your preferred method [[memory:5848151]]:

```bash
# Private key for deployment
export PRIVATE_KEY="0x..."

# RPC URLs
export RPC_URL_MAINNET="https://api.zilliqa.com"
export RPC_URL_TESTNET="https://api.testnet.zilliqa.com"
```

### Build and Test

```bash
# Install dependencies
forge install

# Build contracts
forge build

# Run tests
forge test

# Run tests with gas reporting
forge test --gas-report
```

## 📦 Deployment

### Deploy Factory

Deploy the factory contract to your chosen network:

```bash
# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --broadcast --legacy

# Deploy to mainnet  
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_MAINNET \
  --broadcast --legacy
```

The deployment script will:

1. Deploy the factory contract
2. Create a test token to verify functionality
3. Display all relevant addresses and details

### Environment Variables for API

After deployment, add these to your API environment (Cloudflare Workers):

```bash
# Factory contract addresses (from deployment output)
NEXT_PUBLIC_FACTORY_ADDRESS_TESTNET=0x92aE8eA5a9eD94Bb230999E77376765a88bfEC09
NEXT_PUBLIC_FACTORY_ADDRESS_MAINNET=0x...
```

## 🔧 Usage

### Create Tokens via Command Line

Use the CreateToken script to create tokens from the command line:

```bash
# Create a token via the factory
export FACTORY_ADDRESS=0x...  # From deployment

forge script script/CreateToken.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "run(address,string,string,uint256)" \
  $FACTORY_ADDRESS "My Token" "MTK" 1000
```

### Query Factory State

Use the State script to query factory and token information:

```bash
# Get factory statistics
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "stats(address)" $FACTORY_ADDRESS

# Get all tokens created by a user
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "userTokens(address,address)" $FACTORY_ADDRESS $USER_ADDRESS

# Get specific token information
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "tokenInfo(address,address)" $FACTORY_ADDRESS $TOKEN_ADDRESS

# Check token balance
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "balance(address,address)" $TOKEN_ADDRESS $HOLDER_ADDRESS
```

## 🌐 Frontend Integration

### Factory Contract ABI

Key functions for frontend integration:

```solidity
// Create a new token
function createToken(
    string memory name,
    string memory symbol, 
    uint256 initialSupply
) external returns (address);

// Get user's tokens
function getUserTokens(address user) external view returns (address[] memory);

// Get token details
function getTokenInfo(address tokenAddress) external view returns (
    string memory name,
    string memory symbol,
    uint256 totalSupply,
    address creator,
    address claimant,
    uint256 createdAt
);
```

### Integration Example

```typescript
// Using wagmi/viem to interact with factory
import { useContractWrite, useContractRead } from 'wagmi';

const FACTORY_ABI = [
  "function createToken(string name, string symbol, uint256 initialSupply) returns (address)",
  "function getUserTokens(address user) view returns (address[])",
  "function getTokenInfo(address tokenAddress) view returns (string, string, uint256, address, address, uint256)"
];

// Create a token
const { writeContract } = useContractWrite({
  address: FACTORY_ADDRESS,
  abi: FACTORY_ABI,
  functionName: 'createToken',
});

await writeContract({
  args: ['My Token', 'MTK', 1000]
});

// Get user's tokens
const { data: userTokens } = useContractRead({
  address: FACTORY_ADDRESS,
  abi: FACTORY_ABI,
  functionName: 'getUserTokens',
  args: [userAddress]
});
```

## 🧪 Testing

### Test Coverage

The test suite covers:

- ✅ **Token Creation**: Factory token creation functionality
- ✅ **ERC-20 Compliance**: Standard token operations
- ✅ **Access Controls**: Creator/claimant validation
- ✅ **Edge Cases**: Empty strings, invalid supplies, etc.
- ✅ **Gas Optimization**: Efficient contract deployment

### Run Specific Tests

```bash
# Test only the factory
forge test --match-contract PlunderAcademyTokenFactoryTest

# Test only the token
forge test --match-contract PlunderAcademyTokenTest

# Test with verbose output
forge test -vvv

# Generate coverage report
forge coverage
```

## 📊 Gas Costs

Approximate gas costs (Zilliqa testnet):

| Operation | Gas Cost |
|-----------|----------|
| Deploy Factory | ~1,200,000 |
| Create Token | ~650,000 |
| Token Transfer | ~50,000 |

## 🔐 Security

### Security Features

- ✅ **Input Validation**: Name, symbol, and supply validation
- ✅ **OpenZeppelin Base**: Battle-tested ERC-20 implementation  
- ✅ **No Upgrade Risk**: Immutable token contracts
- ✅ **Creator Verification**: Built-in creator/claimant tracking

### Security Considerations

- Factory contract is not upgradeable (by design)
- Individual tokens are immutable once created
- No admin functions in token contracts
- Supply limits prevent excessive token creation

## 🔄 Achievement Integration

This factory is designed to work with the Plunder Academy achievement system:

1. **User creates token** via factory or manual deployment
2. **API validates transaction** for achievement 0005
3. **Voucher is issued** for successful token creation
4. **Achievement is claimed** on the TrainingRegistry contract

The `claimant` field in each token provides verification that the connected wallet created the token.

## 📝 Contract Verification

After deployment, verify contracts on block explorer:

```bash
# Verify factory contract
forge verify-contract $FACTORY_ADDRESS \
  src/PlunderAcademyTokenFactory.sol:PlunderAcademyTokenFactory \
  --rpc-url $RPC_URL_TESTNET

# Note: Individual tokens are verified automatically by most explorers
```

## 🚀 Next Steps

1. **Deploy to testnet** and verify functionality
2. **Update API** with factory verification logic
3. **Deploy to mainnet** for production use
4. **Integrate with frontend** for user token creation

## 📄 License

MIT License - see LICENSE file for details.
