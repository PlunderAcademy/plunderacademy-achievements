// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";

interface IUUPS {
    function upgradeTo(address newImplementation) external;
}

/// Upgrades a UUPS proxy to a new TrainingRegistry implementation.
contract Upgrade is Script {
    function run(address payable proxy) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(pk);
        TrainingRegistry impl = new TrainingRegistry();
        IUUPS(proxy).upgradeTo(address(impl));
        vm.stopBroadcast();

        console2.log("New implementation deployed:", address(impl));
        console2.log("Proxy upgraded:", proxy);
    }
}


