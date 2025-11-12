// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {PlunderAcademyToken} from "src/PlunderAcademyToken.sol";

contract PlunderAcademyTokenTest is Test {
    PlunderAcademyToken private token;
    address private creator;
    address private claimant;
    address private other;

    function setUp() public {
        // Set stable timestamp
        vm.warp(1_000_000);
        
        creator = address(0xBEEF);
        claimant = address(0xCAFE);
        other = address(0xDEAD);
        
        token = new PlunderAcademyToken(
            "Test Token",
            "TEST",
            1000,       // 1000 tokens
            creator,
            claimant
        );
    }

    function testConstructor_Success() public {
        assertEq(token.name(), "Test Token");
        assertEq(token.symbol(), "TEST");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 1000 * 10**18);
        assertEq(token.creator(), creator);
        assertEq(token.claimant(), claimant);
        assertEq(token.createdAt(), block.timestamp);
        
        // Verify creator received all tokens
        assertEq(token.balanceOf(creator), 1000 * 10**18);
        assertEq(token.balanceOf(claimant), 0);
        assertEq(token.balanceOf(other), 0);
    }

    function testConstructor_CreatorEqualsClaimant() public {
        PlunderAcademyToken sameAddressToken = new PlunderAcademyToken(
            "Same Address Token",
            "SAME",
            500,
            creator,
            creator  // Same as creator
        );
        
        assertEq(sameAddressToken.creator(), creator);
        assertEq(sameAddressToken.claimant(), creator);
        assertEq(sameAddressToken.balanceOf(creator), 500 * 10**18);
    }

    function testConstructor_RevertInvalidCreator() public {
        vm.expectRevert("Invalid creator");
        new PlunderAcademyToken(
            "Invalid Creator",
            "INVALID",
            1000,
            address(0),  // Invalid creator
            claimant
        );
    }

    function testConstructor_RevertInvalidClaimant() public {
        vm.expectRevert("Invalid claimant");
        new PlunderAcademyToken(
            "Invalid Claimant",
            "INVALID",
            1000,
            creator,
            address(0)   // Invalid claimant
        );
    }

    function testERC20Functionality_Transfer() public {
        vm.startPrank(creator);
        
        // Transfer some tokens to other address
        bool success = token.transfer(other, 100 * 10**18);
        assertTrue(success);
        
        // Verify balances
        assertEq(token.balanceOf(creator), 900 * 10**18);
        assertEq(token.balanceOf(other), 100 * 10**18);
        
        vm.stopPrank();
    }

    function testERC20Functionality_Approve() public {
        vm.startPrank(creator);
        
        // Approve spending
        bool success = token.approve(other, 200 * 10**18);
        assertTrue(success);
        
        // Verify allowance
        assertEq(token.allowance(creator, other), 200 * 10**18);
        
        vm.stopPrank();
    }

    function testERC20Functionality_TransferFrom() public {
        // Creator approves other to spend tokens
        vm.prank(creator);
        token.approve(other, 150 * 10**18);
        
        // Other transfers tokens on behalf of creator
        vm.prank(other);
        bool success = token.transferFrom(creator, claimant, 150 * 10**18);
        assertTrue(success);
        
        // Verify balances
        assertEq(token.balanceOf(creator), 850 * 10**18);
        assertEq(token.balanceOf(claimant), 150 * 10**18);
        assertEq(token.allowance(creator, other), 0);
    }

    function testERC20Functionality_TransferExceedsBalance() public {
        vm.prank(creator);
        
        // Try to transfer more than balance
        vm.expectRevert();
        token.transfer(other, 2000 * 10**18); // Creator only has 1000
    }

    function testTokenProperties_Immutable() public {
        // These properties should not change after construction
        uint256 originalCreatedAt = token.createdAt();
        
        // Advance time
        vm.warp(block.timestamp + 1000);
        
        // Properties should remain the same
        assertEq(token.creator(), creator);
        assertEq(token.claimant(), claimant);
        assertEq(token.createdAt(), originalCreatedAt);
    }

    function testLargeSupply() public {
        PlunderAcademyToken largeToken = new PlunderAcademyToken(
            "Large Token",
            "LARGE",
            1000000000, // 1 billion tokens
            creator,
            claimant
        );
        
        assertEq(largeToken.totalSupply(), 1000000000 * 10**18);
        assertEq(largeToken.balanceOf(creator), 1000000000 * 10**18);
    }

    function testSmallSupply() public {
        PlunderAcademyToken smallToken = new PlunderAcademyToken(
            "Small Token",
            "SMALL",
            1, // 1 token
            creator,
            claimant
        );
        
        assertEq(smallToken.totalSupply(), 1 * 10**18);
        assertEq(smallToken.balanceOf(creator), 1 * 10**18);
    }
}

