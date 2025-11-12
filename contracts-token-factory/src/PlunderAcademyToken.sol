// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title PlunderAcademyToken - Created by the factory
 * @dev Simple ERC20 token with claimant for achievement verification
 */
contract PlunderAcademyToken is ERC20 {
    address public claimant;  // For achievement verification
    address public creator;   // Who created this token
    uint256 public createdAt; // When it was created
    
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply,
        address _creator,
        address _claimant
    ) ERC20(name, symbol) {
        require(_creator != address(0), "Invalid creator");
        require(_claimant != address(0), "Invalid claimant");
        
        creator = _creator;
        claimant = _claimant;
        createdAt = block.timestamp;
        
        // Mint initial supply to creator
        _mint(_creator, initialSupply * 10**18);
    }
}

