# Plunder Academy Training Registry

A Foundry-based smart contract system for verifying achievement completions using EIP-712 signed vouchers and optionally minting ERC-1155 soulbound badges. The TrainingRegistry contract uses UUPS upgradeable proxy pattern with comprehensive access controls.

## 🏗️ Architecture

### Contracts

- **`TrainingRegistry.sol`**: Main upgradeable contract with EIP-712 voucher verification and ERC-1155 badge minting

### Key Features

- ✅ **EIP-712 Voucher Verification**: Cryptographically secure completion verification
- ✅ **Issuer Allowlist**: Controlled access for voucher signing authorities  
- ✅ **ERC-1155 Badges**: Optional soulbound (non-transferable) achievement badges
- ✅ **UUPS Upgradeable**: Future-proof contract upgrade capability
- ✅ **Access Controls**: Ownable2Step with pause functionality
- ✅ **Per-wallet Tracking**: Completion status per wallet per task
- ✅ **Gas Optimized**: Efficient storage and operations

## 🚀 Quick Start

### Prerequisites

- Foundry installed (`https://book.getfoundry.sh/getting-started/installation`)
- Environment variables set (see below)

### Environment Setup

Set these environment variables following your preferred method [[memory:5848151]]:

```bash
# Private keys
export PRIVATE_KEY="0x..."              # For contract deployment
export ISSUER_PRIVATE_KEY="0x..."       # For API voucher signing

# RPC URLs  
export RPC_URL_MAINNET="https://api.zilliqa.com"
export RPC_URL_TESTNET="https://api.testnet.zilliqa.com"

# Contract addresses (set after deployment)
export PROXY="0x..."                    # TrainingRegistry proxy address
export CONTRACT_ADDRESS="0x..."         # Same as PROXY
export ISSUER_ADDRESS="0x..."           # Address of ISSUER_PRIVATE_KEY
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

### Deploy TrainingRegistry

Deploy the upgradeable TrainingRegistry contract:

```bash
# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --broadcast --legacy \
  --sig "run(string,string,string)" \
  "https://static.plunderswap.com/training/" "TrainingCert" "1"

# Deploy to mainnet
forge script script/Deploy.s.sol \
  --rpc-url $RPC_URL_MAINNET \
  --broadcast --legacy \
  --sig "run(string,string,string)" \
  "https://static.plunderswap.com/training/" "TrainingCert" "1"
```

The deployment script will:

1. Deploy the TrainingRegistry implementation
2. Deploy an ERC1967 proxy pointing to the implementation
3. Initialize the contract with owner, base URI, and EIP-712 domain
4. Display proxy address and configuration details

### Configure Contract

After deployment, configure the contract with your API as an approved issuer:

```bash
# Add issuer to allowlist
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "issuer(address,address,bool)" $PROXY $ISSUER_ADDRESS true

# Update base URI (if needed)
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "baseURI(address,string)" $PROXY "https://static.yourdomain.com/training/"

# Pause contract (if needed)
forge script script/Configure.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "pause(address)" $PROXY
```

## 🔧 Usage

### Submit Vouchers via Command Line

Use the SubmitVoucher script to submit vouchers from the command line:

```bash
# Submit a voucher (typically done by frontend)
export TASK_CODE=1
export SIGNATURE=<signature_from_api>

forge script script/SubmitVoucher.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "run(address,uint256,bytes)" \
  $PROXY $TASK_CODE $SIGNATURE
```

### Query Registry State

Use the State script to query registry information:

```bash
# List all achievements for a wallet
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "list(address,address)" $PROXY $LEARNER_WALLET

# Check specific achievement
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "check(address,address,uint256)" $PROXY $LEARNER_WALLET 1

# Get contract configuration
forge script script/State.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "config(address)" $PROXY
```

### Sign Vouchers (for API)

Use the SignVoucher script to generate voucher signatures:

```bash
# Sign a voucher for task completion
forge script script/SignVoucher.s.sol \
  --rpc-url $RPC_URL_TESTNET \
  --sig "run(address,uint256,address)" \
  $PROXY 1 $LEARNER_WALLET
```

## 🌐 Frontend Integration

### Registry Contract ABI

Key functions for frontend integration:

```solidity
// Submit a voucher to claim achievement
function submitVoucher(uint256 taskCode, bytes calldata signature) external;

// Check if wallet completed specific task
function completed(address wallet, uint256 taskCode) external view returns (bool);

// Get wallet's token IDs (achievements)
function getWalletTokenIds(address wallet) external view returns (uint256[] memory);

// Check badge balance
function balanceOf(address account, uint256 id) external view returns (uint256);

// Get metadata URI for achievement
function uri(uint256 tokenId) external view returns (string memory);
```

### Integration Example

```typescript
// Using wagmi to interact with TrainingRegistry
import { useContractWrite, useContractRead } from 'wagmi';

const REGISTRY_ABI = [
  "function submitVoucher(uint256 taskCode, bytes signature)",
  "function completed(address wallet, uint256 taskCode) view returns (bool)",
  "function getWalletTokenIds(address wallet) view returns (uint256[])",
  "function balanceOf(address account, uint256 id) view returns (uint256)"
];

// Submit voucher to claim achievement
const { writeContract } = useContractWrite({
  address: REGISTRY_ADDRESS,
  abi: REGISTRY_ABI,
  functionName: 'submitVoucher',
});

await writeContract({
  args: [taskCode, signature]
});

// Check if achievement is completed
const { data: isCompleted } = useContractRead({
  address: REGISTRY_ADDRESS,
  abi: REGISTRY_ABI,
  functionName: 'completed',
  args: [walletAddress, taskCode]
});

// Get user's achievements
const { data: tokenIds } = useContractRead({
  address: REGISTRY_ADDRESS,
  abi: REGISTRY_ABI,
  functionName: 'getWalletTokenIds',
  args: [walletAddress]
});
```

## 🧪 Testing

### Test Coverage

The test suite covers:

- ✅ **Voucher Verification**: EIP-712 signature validation
- ✅ **Issuer Controls**: Allowlist management and access controls
- ✅ **Achievement Tracking**: Completion status and badge minting
- ✅ **Upgrade Functionality**: UUPS proxy upgrade mechanism
- ✅ **Access Controls**: Owner management and pause functionality
- ✅ **Edge Cases**: Invalid signatures, duplicate submissions, etc.

### Run Specific Tests

```bash
# Test only the TrainingRegistry
forge test --match-contract TrainingRegistryTest

# Test with verbose output
forge test -vvv

# Test specific function
forge test --match-test testSubmitVoucher

# Generate coverage report
forge coverage
```

## 📊 Gas Costs

Approximate gas costs (Zilliqa testnet):

| Operation | Gas Cost |
|-----------|----------|
| Deploy Registry | ~2,500,000 |
| Submit Voucher (first) | ~180,000 |
| Submit Voucher (repeat) | ~95,000 |
| Check Completion | ~2,500 |

## 🔐 Security

### Security Features

- ✅ **EIP-712 Signatures**: Cryptographically secure voucher verification
- ✅ **Issuer Allowlist**: Controlled access for voucher authorities
- ✅ **UUPS Upgradeable**: Secure upgrade mechanism with owner controls
- ✅ **OpenZeppelin Base**: Battle-tested security patterns
- ✅ **Soulbound Badges**: Non-transferable achievement tokens
- ✅ **Reentrancy Protection**: Safe external calls

### Security Considerations

- Registry is upgradeable - owner has significant control
- Issuer private keys must be kept secure
- Voucher signatures are replay-protected per wallet+task
- Pause functionality allows emergency stops

## 🔄 Achievement Integration

This registry is designed to work with the Plunder Academy API system:

1. **User completes achievement** in frontend application
2. **API validates completion** and generates EIP-712 signed voucher
3. **Frontend submits voucher** to TrainingRegistry contract
4. **Contract verifies signature** and marks achievement as completed
5. **Optional badge is minted** as soulbound ERC-1155 token

The registry supports any number of achievements through the `taskCode` system.

## 📝 Contract Verification

After deployment, verify contracts on block explorer:

```bash
# Verify implementation contract
forge verify-contract $IMPLEMENTATION_ADDRESS \
  src/TrainingRegistry.sol:TrainingRegistry \
  --rpc-url $RPC_URL_TESTNET

# Note: Proxy verification is typically automatic
```

## 🚀 Upgrade Procedure

When upgrading the TrainingRegistry implementation:

```bash
# Deploy new implementation and upgrade proxy
forge script script/Upgrade.s.sol \
  --rpc-url $RPC_URL_TESTNET --broadcast --legacy \
  --sig "run(address payable)" $PROXY
```

## 📄 License

MIT License - see LICENSE file for details.
