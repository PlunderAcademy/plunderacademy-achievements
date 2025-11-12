// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";

/// Deploys TrainingRegistry implementation and a UUPS ERC1967 proxy, calling initialize.
contract Deploy is Script {
    function run(string memory baseURI, string memory eip712Name, string memory eip712Version) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(pk);

        vm.startBroadcast(pk);

        TrainingRegistry impl = new TrainingRegistry();

        bytes memory initData = abi.encodeWithSelector(
            TrainingRegistry.initialize.selector,
            owner,
            baseURI,
            eip712Name,
            eip712Version
        );

        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);

        vm.stopBroadcast();

        console2.log("Owner is", owner);
        console2.log("Implementation deployed:", address(impl));
        console2.log("Proxy deployed:", address(proxy));
    }
}


