// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";

/// Read-only helpers to inspect wallet achievements
contract State is Script {
    // List all tokenIds (achievements) recorded for a wallet
    function list(address proxy, address wallet) external view {
        uint256[] memory ids = TrainingRegistry(proxy).getWalletAchievements(wallet);
        console2.log("Wallet:", wallet);
        console2.log("Count:", ids.length);
        for (uint256 i = 0; i < ids.length; i++) {
            console2.log("- tokenId:", ids[i]);
        }
    }

    // Check a particular tokenId and print balance, membership, uri
    function check(address proxy, address wallet, uint256 tokenId) external view {
        TrainingRegistry reg = TrainingRegistry(proxy);
        bool hasIt = reg.hasAchievement(wallet, tokenId);
        uint256 bal = reg.balanceOf(wallet, tokenId);
        string memory u = reg.uri(tokenId);

        console2.log("Wallet:", wallet);
        console2.log("tokenId:", tokenId);
        console2.log("hasAchievement:", hasIt);
        console2.log("balance:", bal);
        console2.log("uri:", u);
    }
}


