// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/// Forge script to sign a minimal EIP-712 voucher with the ISSUER private key
/// Usage (no broadcast):
/// forge script script/SignVoucher.s.sol --rpc-url $RPC_URL_TESTNET --sig \
///   "run(address,uint256,address)" $PROXY $TASK_CODE $LEARNER_WALLET
/// Prints the 0x-prefixed signature that you can pass to SubmitVoucher.s.sol
contract SignVoucher is Script {
    function run(
        address payable proxy,
        uint256 taskCode,
        address wallet
    ) external {
        uint256 issuerPk = vm.envUint("ISSUER_PK");
        string memory eip712Name = vm.envOr("EIP712_NAME", string("TrainingCert"));
        string memory eip712Version = vm.envOr("EIP712_VERSION", string("1"));

        bytes32 domainTypehash = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        bytes32 domainSeparator = keccak256(
            abi.encode(
                domainTypehash,
                keccak256(bytes(eip712Name)),
                keccak256(bytes(eip712Version)),
                block.chainid,
                proxy
            )
        );

        bytes32 voucherTypehash = keccak256("CompletionVoucher(uint256 taskCode,address wallet)");
        bytes32 structHash = keccak256(abi.encode(voucherTypehash, taskCode, wallet));
        bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator, structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(issuerPk, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        console2.log("Proxy:", proxy);
        console2.log("ChainId:", block.chainid);
        console2.log("TaskCode:", taskCode);
        console2.log("Wallet:", wallet);
        console2.log("EIP712 name:", eip712Name);
        console2.log("EIP712 version:", eip712Version);
        console2.logBytes(signature);
    }
}


