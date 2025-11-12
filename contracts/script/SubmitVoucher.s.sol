// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";

/// Submits a pre-signed voucher to the TrainingRegistry from the learner wallet
/// Usage:
/// forge script script/SubmitVoucher.s.sol --rpc-url $RPC_URL_TESTNET --broadcast --legacy --sig "run(address,uint256,bytes)" \
///   $PROXY $TASK_CODE 0xSIG
contract SubmitVoucher is Script {
    function run(address payable proxy, uint256 taskCode, bytes memory signature) external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        TrainingRegistry(proxy).submitVoucher(taskCode, signature);
        vm.stopBroadcast();
        console2.log("Submitted voucher for task:", taskCode);
    }
}


