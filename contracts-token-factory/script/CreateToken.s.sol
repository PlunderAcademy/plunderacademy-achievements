// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PlunderAcademyTokenFactory} from "src/PlunderAcademyTokenFactory.sol";
import {PlunderAcademyToken} from "src/PlunderAcademyToken.sol";

/// Create a token using the factory
contract CreateToken is Script {
    
    /**
     * @dev Create a new token through the factory
     * @param factoryAddress Address of the deployed factory
     * @param name Token name
     * @param symbol Token symbol  
     * @param initialSupply Initial supply (in tokens, not wei)
     */
    function run(
        address factoryAddress,
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address creator = vm.addr(pk);
        
        console2.log("=== Creating Token ===");
        console2.log("Factory Address:", factoryAddress);
        console2.log("Creator:", creator);
        console2.log("Token Name:", name);
        console2.log("Token Symbol:", symbol);
        console2.log("Initial Supply:", initialSupply);
        
        PlunderAcademyTokenFactory factory = PlunderAcademyTokenFactory(factoryAddress);
        
        vm.startBroadcast(pk);
        
        address tokenAddress = factory.createToken(name, symbol, initialSupply);
        
        vm.stopBroadcast();
        
        console2.log("=== Token Created Successfully ===");
        console2.log("Token Address:", tokenAddress);
        
        // Verify token details
        (
            string memory tokenName,
            string memory tokenSymbol,
            uint256 totalSupply,
            address tokenCreator,
            address claimant,
            uint256 createdAt
        ) = factory.getTokenInfo(tokenAddress);
        
        console2.log("=== Verification ===");
        console2.log("Name:", tokenName);
        console2.log("Symbol:", tokenSymbol);
        console2.log("Total Supply:", totalSupply);
        console2.log("Creator:", tokenCreator);
        console2.log("Claimant:", claimant);
        console2.log("Created At:", createdAt);
        
        // Check creator's balance
        PlunderAcademyToken token = PlunderAcademyToken(tokenAddress);
        uint256 creatorBalance = token.balanceOf(creator);
        console2.log("Creator Balance:", creatorBalance);
        
        console2.log("=== Success! ===");
    }
}
