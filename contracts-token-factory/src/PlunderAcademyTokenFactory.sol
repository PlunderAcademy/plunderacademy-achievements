// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./PlunderAcademyToken.sol";

/**
 * @title PlunderAcademyTokenFactory
 * @dev Factory for creating standardized tokens for Plunder Academy learners
 */
contract PlunderAcademyTokenFactory {
    uint256 public totalTokensCreated;
    mapping(address => address[]) public userTokens;
    address[] public allTokens;
    
    event TokenCreated(
        address indexed creator,
        address indexed claimant,
        address indexed tokenAddress,
        string name,
        string symbol,
        uint256 initialSupply,
        uint256 timestamp
    );
    
    /**
     * @dev Create a new token with creator as claimant (for achievement verification)
     * @param name Token name (e.g., "My First Token")
     * @param symbol Token symbol (e.g., "MFT")
     * @param initialSupply Initial supply in tokens (will be multiplied by 10^18)
     */
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(bytes(symbol).length > 0, "Symbol cannot be empty");
        require(initialSupply > 0 && initialSupply <= 1000000000, "Invalid supply"); // Max 1B tokens
        
        // Create new token with msg.sender as both creator and claimant
        PlunderAcademyToken newToken = new PlunderAcademyToken(
            name,
            symbol,
            initialSupply,
            msg.sender,  // creator
            msg.sender   // claimant (same as creator for simplicity)
        );
        
        address tokenAddress = address(newToken);
        
        // Track the token
        userTokens[msg.sender].push(tokenAddress);
        allTokens.push(tokenAddress);
        totalTokensCreated++;
        
        emit TokenCreated(
            msg.sender,
            msg.sender,
            tokenAddress,
            name,
            symbol,
            initialSupply,
            block.timestamp
        );
        
        return tokenAddress;
    }
    
    /**
     * @dev Get all tokens created by a user
     */
    function getUserTokens(address user) external view returns (address[] memory) {
        return userTokens[user];
    }
    
    /**
     * @dev Get token details
     */
    function getTokenInfo(address tokenAddress) external view returns (
        string memory name,
        string memory symbol,
        uint256 totalSupply,
        address creator,
        address claimant,
        uint256 createdAt
    ) {
        PlunderAcademyToken token = PlunderAcademyToken(tokenAddress);
        return (
            token.name(),
            token.symbol(),
            token.totalSupply(),
            token.creator(),
            token.claimant(),
            token.createdAt()
        );
    }
}

