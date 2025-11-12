// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";

/// Admin/configuration helpers for TrainingRegistry
contract Configure is Script {
    function issuer(address payable proxy, address issuerAddr, bool allowed) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).setIssuer(issuerAddr, allowed);
        vm.stopBroadcast();
    }

    // Badge per-task configuration removed; tokenId == taskCode

    function baseURI(address payable proxy, string memory newBaseURI) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).setBaseURI(newBaseURI);
        vm.stopBroadcast();
    }

    function padDigits(address payable proxy, uint8 newPad) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).setUriPadDigits(newPad);
        vm.stopBroadcast();
    }

    function pause(address payable proxy) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).pause();
        vm.stopBroadcast();
    }

    function unpause(address payable proxy) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).unpause();
        vm.stopBroadcast();
    }
}


