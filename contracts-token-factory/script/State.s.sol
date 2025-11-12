// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PlunderAcademyTokenFactory} from "src/PlunderAcademyTokenFactory.sol";
import {PlunderAcademyToken} from "src/PlunderAcademyToken.sol";

/// Query factory state and token details
contract State is Script {
    
    /**
     * @dev Get factory statistics
     */
    function stats(address factoryAddress) external view {
        PlunderAcademyTokenFactory factory = PlunderAcademyTokenFactory(factoryAddress);
        
        console2.log("=== Factory Statistics ===");
        console2.log("Factory Address:", factoryAddress);
        console2.log("Total Tokens Created:", factory.totalTokensCreated());
    }
    
    /**
     * @dev List all tokens created by a user
     */
    function userTokens(address factoryAddress, address user) external view {
        PlunderAcademyTokenFactory factory = PlunderAcademyTokenFactory(factoryAddress);
        
        address[] memory tokens = factory.getUserTokens(user);
        
        console2.log("=== User Tokens ===");
        console2.log("User Address:", user);
        console2.log("Number of Tokens:", tokens.length);
        
        for (uint256 i = 0; i < tokens.length; i++) {
            console2.log("Token", i + 1, ":", tokens[i]);
            
            // Get token details
            (
                string memory name,
                string memory symbol,
                uint256 totalSupply,
                address creator,
                address claimant,
                uint256 createdAt
            ) = factory.getTokenInfo(tokens[i]);
            
            console2.log("  Name:", name);
            console2.log("  Symbol:", symbol);
            console2.log("  Total Supply:", totalSupply);
            console2.log("  Creator:", creator);
            console2.log("  Claimant:", claimant);
            console2.log("  Created At:", createdAt);
            console2.log("---");
        }
    }
    
    /**
     * @dev Get details of a specific token
     */
    function tokenInfo(address factoryAddress, address tokenAddress) external view {
        PlunderAcademyTokenFactory factory = PlunderAcademyTokenFactory(factoryAddress);
        
        console2.log("=== Token Details ===");
        console2.log("Token Address:", tokenAddress);
        
        (
            string memory name,
            string memory symbol,
            uint256 totalSupply,
            address creator,
            address claimant,
            uint256 createdAt
        ) = factory.getTokenInfo(tokenAddress);
        
        console2.log("Name:", name);
        console2.log("Symbol:", symbol);
        console2.log("Total Supply:", totalSupply);
        console2.log("Creator:", creator);
        console2.log("Claimant:", claimant);
        console2.log("Created At:", createdAt);
        
        // Additional token details
        PlunderAcademyToken token = PlunderAcademyToken(tokenAddress);
        console2.log("Decimals:", token.decimals());
    }
    
    /**
     * @dev Check token balance for an address
     */
    function balance(address tokenAddress, address holder) external view {
        PlunderAcademyToken token = PlunderAcademyToken(tokenAddress);
        
        console2.log("=== Token Balance ===");
        console2.log("Token Address:", tokenAddress);
        console2.log("Holder Address:", holder);
        console2.log("Balance:", token.balanceOf(holder));
        console2.log("Token Name:", token.name());
        console2.log("Token Symbol:", token.symbol());
    }
}

