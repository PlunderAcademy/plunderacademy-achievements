// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import {Ownable2StepUpgradeable} from "@openzeppelin/contracts-upgradeable/access/Ownable2StepUpgradeable.sol";
import {PausableUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import {EIP712Upgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ERC1155Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC1155/ERC1155Upgradeable.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @title TrainingRegistry (Upgradeable)
/// @notice Verifies EIP-712 signed completion vouchers from approved issuers and
///         optionally mints ERC-1155 badge tokens (one tokenId per task).
contract TrainingRegistry is
    Initializable,
    UUPSUpgradeable,
    Ownable2StepUpgradeable,
    PausableUpgradeable,
    EIP712Upgradeable,
    ERC1155Upgradeable
{
    using ECDSA for bytes32;

    /// @dev Minimal voucher: binds a task code to a specific wallet
    struct CompletionVoucher {
        uint256 taskCode;      // decimal task/badge code (also tokenId)
        address wallet;        // learner (must equal msg.sender)
    }

    // EIP-712 struct type hash for minimal CompletionVoucher
    bytes32 private constant VOUCHER_TYPEHASH = keccak256(
        "CompletionVoucher(uint256 taskCode,address wallet)"
    );

    // Issuer allowlist (EOA addresses). Optional 1271 support can be added later.
    mapping(address => bool) public isIssuer;

    // Per-wallet task completion flag (taskCode is the tokenId)
    mapping(address => mapping(uint256 => bool)) public completed;


    // Per-wallet achievement index for fast frontend queries
    mapping(address => uint256[]) private _walletTokenIds;
    mapping(address => mapping(uint256 => bool)) private _hasTokenId;

    event IssuerUpdated(address indexed issuer, bool allowed);
    event TaskCompleted(uint256 indexed taskCode, address indexed wallet);
    // tokenId equals taskCode; no per-task on-chain config needed
    event BaseURISet(string newBaseURI);
    event UriPadDigitsSet(uint8 newPadDigits);

    /// @custom:oz-upgrades-unsafe-allow state-variable-immutable
    constructor() {
        _disableInitializers();
    }

    /// @notice Initializer for proxy deployment.
    /// @param initialOwner Owner address with permission to manage issuers and upgrades
    /// @param baseURI Base URI for ERC-1155 metadata
    /// @param eip712Name EIP-712 domain name
    /// @param eip712Version EIP-712 domain version
    function initialize(
        address initialOwner,
        string memory baseURI,
        string memory eip712Name,
        string memory eip712Version
    ) external initializer {
        __ERC1155_init(baseURI);
        __Pausable_init();
        __Ownable2Step_init();
        __UUPSUpgradeable_init();
        __EIP712_init(eip712Name, eip712Version);

        // Transfer ownership to the requested owner
        _transferOwnership(initialOwner);

        _baseDirectoryURI = baseURI;
        uriPadDigits = 4;
    }

    // --- Admin functions ---

    function setIssuer(address issuer, bool allowed) external onlyOwner {
        isIssuer[issuer] = allowed;
        emit IssuerUpdated(issuer, allowed);
    }

    // No per-task configuration needed: taskCode doubles as tokenId

    function setBaseURI(string memory newBaseURI) external onlyOwner {
        _setURI(newBaseURI);
        _baseDirectoryURI = newBaseURI;
        emit BaseURISet(newBaseURI);
    }

    function setUriPadDigits(uint8 newPad) external onlyOwner {
        uriPadDigits = newPad;
        emit UriPadDigitsSet(newPad);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    // --- Public flow ---

    /// @notice Submit a signed voucher to record completion (and mint the badge with tokenId == taskCode).
    function submitVoucher(uint256 taskCode, bytes calldata signature) external whenNotPaused {
        require(!completed[msg.sender][taskCode], "already completed");

        // Reconstruct struct hash with wallet bound to msg.sender
        bytes32 structHash = keccak256(abi.encode(VOUCHER_TYPEHASH, taskCode, msg.sender));
        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparatorV4(), structHash);
        address signer = ECDSA.recover(digest, signature);
        require(isIssuer[signer], "invalid issuer");

        completed[msg.sender][taskCode] = true;
        _mint(msg.sender, taskCode, 1, "");
        emit TaskCompleted(taskCode, msg.sender);
    }

    // --- ERC-1155 soulbound guard (OZ 5.x hook) ---
    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory amounts
    ) internal override {
        // Disallow any transfers between non-zero addresses (global soulbound behavior)
        require(from == address(0) || to == address(0), "SBT: non-transferable");
        super._update(from, to, ids, amounts);

        // Maintain cached achievement index
        if (to != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                uint256 tokenId = ids[i];
                if (!_hasTokenId[to][tokenId] && balanceOf(to, tokenId) > 0) {
                    _hasTokenId[to][tokenId] = true;
                    _walletTokenIds[to].push(tokenId);
                }
            }
        }
        if (from != address(0)) {
            for (uint256 i = 0; i < ids.length; i++) {
                uint256 tokenId = ids[i];
                if (_hasTokenId[from][tokenId] && balanceOf(from, tokenId) == 0) {
                    _hasTokenId[from][tokenId] = false;
                    _removeWalletTokenId(from, tokenId);
                }
            }
        }
    }

    /// @dev Override ERC-1155 URI resolution to support decimal zero-padded filenames like 0001.json
    function uri(uint256 tokenId) public view override returns (string memory) {
        return string(abi.encodePacked(_baseDirectoryURI, _paddedDecimal(tokenId, uriPadDigits), ".json"));
    }

    function _paddedDecimal(uint256 value, uint8 minDigits) internal pure returns (string memory) {
        string memory dec = Strings.toString(value);
        uint256 len = bytes(dec).length;
        if (len >= minDigits) return dec;
        uint256 pad = uint256(minDigits) - len;
        bytes memory zeros = new bytes(pad);
        for (uint256 i = 0; i < pad; i++) zeros[i] = bytes1("0");
        return string(abi.encodePacked(zeros, dec));
    }

    function _removeWalletTokenId(address wallet, uint256 tokenId) internal {
        uint256[] storage list = _walletTokenIds[wallet];
        for (uint256 i = 0; i < list.length; i++) {
            if (list[i] == tokenId) {
                uint256 last = list[list.length - 1];
                list[i] = last;
                list.pop();
                break;
            }
        }
    }

    /// @notice Returns all badge tokenIds held by `wallet` as recorded at mint time.
    function getWalletAchievements(address wallet) external view returns (uint256[] memory) {
        return _walletTokenIds[wallet];
    }

    /// @notice Returns true if `wallet` holds the badge `tokenId` (cached boolean for O(1) checks).
    function hasAchievement(address wallet, uint256 tokenId) external view returns (bool) {
        return _hasTokenId[wallet][tokenId];
    }

    // --- Upgradability ---
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Storage gap ---
    string private _baseDirectoryURI;
    uint8 public uriPadDigits;
    uint256[39] private __gap;
}


