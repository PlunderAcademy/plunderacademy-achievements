// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";
import {TrainingRegistry} from "src/TrainingRegistry.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

contract TrainingRegistryTest is Test {
    using MessageHashUtils for bytes32;

    TrainingRegistry private registry;
    address private owner;
    address private issuer;
    uint256 private issuerPk;
    address private learner;

    string private constant EIP712_NAME = "TrainingCert";
    string private constant EIP712_VERSION = "1";

    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "CompletionVoucher(uint256 taskCode,address wallet)"
    );

    function setUp() public {
        // Ensure a stable timestamp far from zero to avoid underflow in tests
        vm.warp(1_000_000);
        owner = address(this);
        (issuer, issuerPk) = makeAddrAndKey("ISSUER");
        learner = address(0xBEEF);

        TrainingRegistry impl = new TrainingRegistry();
        bytes memory initData = abi.encodeWithSelector(
            TrainingRegistry.initialize.selector,
            owner,
            "https://static.plunderswap.com/training/",
            EIP712_NAME,
            EIP712_VERSION
        );
        ERC1967Proxy proxy = new ERC1967Proxy(address(impl), initData);
        registry = TrainingRegistry(address(proxy));

        // allow issuer
        registry.setIssuer(issuer, true);
        // default 4-digit padding
        assertEq(registry.uriPadDigits(), 4);
    }

    function testSubmitVoucher_Succeeds_BadgeMinted() public {
        uint256 taskCode = 1;
        bytes memory sig = _signMinimal(taskCode, learner);

        vm.prank(learner);
        registry.submitVoucher(taskCode, sig);

        assertEq(registry.balanceOf(learner, taskCode), 1);
        assertTrue(registry.hasAchievement(learner, taskCode));
    }

    function testSubmitVoucher_MintsBadge_AndIndexed() public {
        uint256 tokenId = 1;
        bytes memory sig = _signMinimal(tokenId, learner);

        vm.prank(learner);
        registry.submitVoucher(tokenId, sig);

        assertEq(registry.balanceOf(learner, tokenId), 1);
        uint256[] memory ids = registry.getWalletAchievements(learner);
        assertEq(ids.length, 1);
        assertEq(ids[0], tokenId);
        assertTrue(registry.hasAchievement(learner, tokenId));

        // URI is decimal padded to 4 digits by default
        assertEq(registry.uri(tokenId), string(abi.encodePacked("https://static.plunderswap.com/training/", "0001", ".json")));
    }

    function testSubmitVoucher_Revert_InvalidIssuer() public {
        // do not allow this signer
        (, uint256 badPk) = makeAddrAndKey("BAD");
        uint256 taskCode = 42;
        bytes memory sig = _signMinimalWith(badPk, taskCode, learner);

        vm.prank(learner);
        vm.expectRevert(bytes("invalid issuer"));
        registry.submitVoucher(taskCode, sig);
    }

    function testSubmitVoucher_Revert_WalletMismatch() public {
        uint256 taskCode = 2;
        bytes memory sig = _signMinimal(taskCode, learner);
        // call from different sender -> signature expects learner, contract uses msg.sender
        vm.prank(address(0xCAFE));
        vm.expectRevert(bytes("invalid issuer")); // signature won't match for different msg.sender
        registry.submitVoucher(taskCode, sig);
    }

    // removed: expiry and nonce tests (not applicable to minimal voucher)

    function testSubmitVoucher_Revert_AlreadyCompletedSameTask() public {
        uint256 code = 5;
        bytes memory sig1 = _signMinimal(code, learner);
        vm.prank(learner);
        registry.submitVoucher(code, sig1);
        bytes memory sig2 = _signMinimal(code, learner);
        vm.prank(learner);
        vm.expectRevert(bytes("already completed"));
        registry.submitVoucher(code, sig2);
    }

    function testSoulbound_BlockTransfers() public {
        uint256 tokenId = 7;
        bytes memory sig = _signMinimal(tokenId, learner);
        vm.prank(learner);
        registry.submitVoucher(tokenId, sig);
        assertEq(registry.balanceOf(learner, tokenId), 1);

        // attempt transfer should revert
        vm.prank(learner);
        vm.expectRevert(bytes("SBT: non-transferable"));
        registry.safeTransferFrom(learner, address(0x1234), tokenId, 1, "");
    }

    // --- helpers ---
    function _signMinimal(uint256 taskCode, address wallet) internal view returns (bytes memory sig) {
        return _signMinimalWith(issuerPk, taskCode, wallet);
    }

    function _signMinimalWith(uint256 pk, uint256 taskCode, address wallet) internal view returns (bytes memory sig) {
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, taskCode, wallet));
        bytes32 domainSeparator = _domainSeparator();
        bytes32 digest = MessageHashUtils.toTypedDataHash(domainSeparator, structHash);
        (uint8 v_, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        sig = abi.encodePacked(r, s, v_);
    }

    function _domainSeparator() internal view returns (bytes32) {
        bytes32 typehash = keccak256(
            "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
        );
        return keccak256(
            abi.encode(
                typehash,
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes(EIP712_VERSION)),
                block.chainid,
                address(registry)
            )
        );
    }

    // no extra helpers
}


