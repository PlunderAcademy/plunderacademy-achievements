// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {PlunderAcademyTokenFactory} from "src/PlunderAcademyTokenFactory.sol";

/// Deploys PlunderAcademyTokenFactory contract
contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(pk);

        vm.startBroadcast(pk);

        // Deploy the factory
        PlunderAcademyTokenFactory factory = new PlunderAcademyTokenFactory();

        vm.stopBroadcast();

        console2.log("Deployer:", deployer);
        console2.log("PlunderAcademyTokenFactory deployed:", address(factory));
        
        // Test deployment by creating a sample token
        console2.log("Testing factory with sample token...");
        
        vm.startBroadcast(pk);
        address sampleTokenAddress = factory.createToken("Test Token", "TEST", 1000);
        vm.stopBroadcast();
        
        console2.log("Sample token created successfully!");
        console2.log("Sample token address:", sampleTokenAddress);
        
        // Verify token details
        (
            string memory name,
            string memory symbol,
            uint256 totalSupply,
            address creator,
            address claimant,
            uint256 createdAt
        ) = factory.getTokenInfo(sampleTokenAddress);
        
        console2.log("Token details:");
        console2.log("  Name:", name);
        console2.log("  Symbol:", symbol);
        console2.log("  Total Supply:", totalSupply);
        console2.log("  Creator:", creator);
        console2.log("  Claimant:", claimant);
        console2.log("  Created At:", createdAt);
    }
}

