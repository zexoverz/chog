// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error NotTransferable();
error NotLilStarContract();
error NoMoreSBTsAvailable();
error InvalidSBTType();
error NotOwnerOfToken();
error InsufficientBalance();

/**
 * @title LilStarSBT
 * @notice Soulbound tokens (ERC-1155) for LilStar utility perks
 *
 * Token IDs:
 * - 1: 5% Lifetime IRL BlindBox Discount (2500 supply)
 * - 2: 10% Lifetime IRL BlindBox Discount (2500 supply)
 * - 3: Free IRL BlindBox (1000 supply)
 *
 * All SBTs are:
 * - Soulbound (non-transferable)
 * - Burnable (redeemed on website for IRL perks)
 */
contract LilStarSBT is ERC1155, Ownable {

    // Token IDs
    uint256 public constant DISCOUNT_5 = 1;
    uint256 public constant DISCOUNT_10 = 2;
    uint256 public constant FREE_BLINDBOX = 3;

    // Supply limits
    uint16 public constant MAX_DISCOUNT_5 = 2500;
    uint16 public constant MAX_DISCOUNT_10 = 2500;
    uint16 public constant MAX_FREE_BLINDBOX = 1000;

    // Minted counts
    uint16 public mintedDiscount5;
    uint16 public mintedDiscount10;
    uint16 public mintedFreeBlindbox;

    // Authorized minter (LilStar contract)
    address public lilStarContract;

    // Token names for metadata
    string public constant name = "LilStar SBT";
    string public constant symbol = "LSTARSBT";

    event SBTMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
    event SBTBurned(address indexed owner, uint256 indexed tokenId, uint256 amount);

    constructor() ERC1155("") Ownable(msg.sender) {}

    // ==================
    // Minting (only by LilStar contract during reveal)
    // ==================

    /**
     * @notice Mint a random SBT to user during reveal
     * @param to Recipient address
     * @param randomSeed Random seed for determining SBT type
     * @return tokenId The token type minted (1, 2, or 3)
     */
    function mintRandomSBT(address to, uint256 randomSeed)
        external
        returns (uint256 tokenId, uint256)
    {
        if (msg.sender != lilStarContract) revert NotLilStarContract();

        tokenId = _determineRandomType(randomSeed);
        if (tokenId == 0) revert NoMoreSBTsAvailable();

        _mint(to, tokenId, 1, "");

        emit SBTMinted(to, tokenId, 1);
        return (tokenId, tokenId); // Return tokenId twice for interface compatibility
    }

    /**
     * @notice Determine SBT type based on random seed and remaining supply
     */
    function _determineRandomType(uint256 randomSeed) internal returns (uint256) {
        uint16 remainingDiscount5 = MAX_DISCOUNT_5 - mintedDiscount5;
        uint16 remainingDiscount10 = MAX_DISCOUNT_10 - mintedDiscount10;
        uint16 remainingFreeBlindbox = MAX_FREE_BLINDBOX - mintedFreeBlindbox;
        uint16 totalRemaining = remainingDiscount5 + remainingDiscount10 + remainingFreeBlindbox;

        if (totalRemaining == 0) return 0;

        uint256 rand = randomSeed % totalRemaining;

        if (rand < remainingDiscount5) {
            mintedDiscount5++;
            return DISCOUNT_5;
        } else if (rand < remainingDiscount5 + remainingDiscount10) {
            mintedDiscount10++;
            return DISCOUNT_10;
        } else {
            mintedFreeBlindbox++;
            return FREE_BLINDBOX;
        }
    }

    // ==================
    // Burning (redeem perk)
    // ==================

    /**
     * @notice Burn SBT to redeem perk
     * @param tokenId Token type to burn (1, 2, or 3)
     * @param amount Amount to burn
     */
    function burn(uint256 tokenId, uint256 amount) external {
        if (balanceOf(msg.sender, tokenId) < amount) revert InsufficientBalance();

        _burn(msg.sender, tokenId, amount);

        emit SBTBurned(msg.sender, tokenId, amount);
    }

    /**
     * @notice Burn SBT on behalf of owner (requires approval - but SBTs can't be approved, so owner only)
     */
    function burnFrom(address owner, uint256 tokenId, uint256 amount) external {
        // Only owner can burn their own SBTs (no approval system for soulbound)
        if (msg.sender != owner) revert NotOwnerOfToken();
        if (balanceOf(owner, tokenId) < amount) revert InsufficientBalance();

        _burn(owner, tokenId, amount);

        emit SBTBurned(owner, tokenId, amount);
    }

    // ==================
    // Soulbound (block transfers)
    // ==================

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        // Allow minting (from == address(0)) and burning (to == address(0))
        // Block transfers (from != 0 && to != 0)
        if (from != address(0) && to != address(0)) {
            revert NotTransferable();
        }

        super._update(from, to, ids, values);
    }

    // Override transfer functions to make explicitly soulbound
    function safeTransferFrom(
        address,
        address,
        uint256,
        uint256,
        bytes memory
    ) public pure override {
        revert NotTransferable();
    }

    function safeBatchTransferFrom(
        address,
        address,
        uint256[] memory,
        uint256[] memory,
        bytes memory
    ) public pure override {
        revert NotTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert NotTransferable();
    }

    // ==================
    // View Functions
    // ==================

    function getRemainingSupply() external view returns (
        uint16 discount5Remaining,
        uint16 discount10Remaining,
        uint16 freeBlindboxRemaining
    ) {
        discount5Remaining = MAX_DISCOUNT_5 - mintedDiscount5;
        discount10Remaining = MAX_DISCOUNT_10 - mintedDiscount10;
        freeBlindboxRemaining = MAX_FREE_BLINDBOX - mintedFreeBlindbox;
    }

    function getTotalMinted() external view returns (uint16) {
        return mintedDiscount5 + mintedDiscount10 + mintedFreeBlindbox;
    }

    function getTokenName(uint256 tokenId) external pure returns (string memory) {
        if (tokenId == DISCOUNT_5) return "5% Lifetime Discount";
        if (tokenId == DISCOUNT_10) return "10% Lifetime Discount";
        if (tokenId == FREE_BLINDBOX) return "Free IRL BlindBox";
        return "";
    }

    // ==================
    // Admin
    // ==================

    function setLilStarContract(address _lilStarContract) external onlyOwner {
        lilStarContract = _lilStarContract;
    }

    function setURI(string calldata newuri) external onlyOwner {
        _setURI(newuri);
    }

    /**
     * @notice Returns metadata URI for a token
     * @dev Override to return different URIs per token type
     */
    function uri(uint256 tokenId) public view override returns (string memory) {
        string memory baseURI = super.uri(tokenId);
        if (bytes(baseURI).length == 0) return "";

        // Append token ID to base URI
        return string(abi.encodePacked(baseURI, _toString(tokenId)));
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
