// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

interface IWMON {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

contract NFTSwap is IERC721Receiver, ReentrancyGuard, Ownable {
    using SafeERC20 for IERC20;

    enum OfferStatus {
        Waiting,
        Completed,
        Declined,
        Cancelled
    }

    struct NFTItem {
        address collection;
        uint256 tokenId;
    }

    struct ERC20Item {
        address token;
        uint256 amount;
    }

    struct Offer {
        address offerer;
        address target;
        NFTItem[] offeredNFTs;
        ERC20Item[] offeredTokens;
        NFTItem[] wantedNFTs;
        OfferStatus status;
        uint256 createdAt;
    }

    uint256 public nextOfferId;
    uint256 public platformFee;
    address public feeRecipient;
    IWMON public immutable wmon;

    mapping(uint256 => Offer) private _offers;

    // Track offers by user (both as offerer and target)
    mapping(address => uint256[]) public offersCreated;
    mapping(address => uint256[]) public offersReceived;

    event OfferCreated(
        uint256 indexed offerId,
        address indexed offerer,
        address indexed target
    );

    event OfferAccepted(
        uint256 indexed offerId,
        address indexed offerer,
        address indexed target
    );

    event OfferDeclined(uint256 indexed offerId, address indexed target);

    event OfferCancelled(uint256 indexed offerId, address indexed offerer);

    event PlatformFeeUpdated(uint256 oldFee, uint256 newFee);

    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    error InvalidAddress();
    error EmptyOffer();
    error NotOfferTarget();
    error NotOfferer();
    error OfferNotWaiting();
    error NotNFTOwner();
    error InsufficientPayment();

    constructor(
        address initialOwner,
        address initialFeeRecipient,
        uint256 initialFee,
        address wmonAddress
    ) Ownable(initialOwner) {
        if (initialFeeRecipient == address(0)) revert InvalidAddress();
        if (wmonAddress == address(0)) revert InvalidAddress();
        feeRecipient = initialFeeRecipient;
        platformFee = initialFee;
        wmon = IWMON(wmonAddress);
    }

    /// @notice Create a trade offer
    /// @param target The wallet address to send the offer to
    /// @param offeredNFTs Array of NFTs to offer
    /// @param offeredTokens Array of ERC20 tokens to offer
    /// @param wantedNFTs Array of NFTs wanted from target
    /// @param nativeAmount Amount of native ETH to offer (will be wrapped to WETH)
    /// @dev Send msg.value = platformFee + nativeAmount
    function createOffer(
        address target,
        NFTItem[] calldata offeredNFTs,
        ERC20Item[] calldata offeredTokens,
        NFTItem[] calldata wantedNFTs,
        uint256 nativeAmount
    ) external payable nonReentrant returns (uint256 offerId) {
        if (target == address(0) || target == msg.sender) {
            revert InvalidAddress();
        }

        bool hasOffer = offeredNFTs.length > 0 ||
            offeredTokens.length > 0 ||
            nativeAmount > 0;
        if (!hasOffer) {
            revert EmptyOffer();
        }
        if (wantedNFTs.length == 0) {
            revert EmptyOffer();
        }

        // Check payment covers fee + native offering
        uint256 requiredPayment = platformFee + nativeAmount;
        if (msg.value < requiredPayment) revert InsufficientPayment();

        // Collect platform fee
        if (platformFee > 0) {
            (bool sent, ) = feeRecipient.call{value: platformFee}("");
            require(sent, "Fee transfer failed");
        }

        // Refund excess
        uint256 excess = msg.value - requiredPayment;
        if (excess > 0) {
            (bool refunded, ) = msg.sender.call{value: excess}("");
            require(refunded, "Refund failed");
        }

        offerId = ++nextOfferId;

        Offer storage offer = _offers[offerId];
        offer.offerer = msg.sender;
        offer.target = target;
        offer.status = OfferStatus.Waiting;
        offer.createdAt = block.timestamp;

        // Transfer offered NFTs to escrow
        for (uint256 i = 0; i < offeredNFTs.length; i++) {
            IERC721 nft = IERC721(offeredNFTs[i].collection);
            if (nft.ownerOf(offeredNFTs[i].tokenId) != msg.sender) {
                revert NotNFTOwner();
            }
            nft.safeTransferFrom(
                msg.sender,
                address(this),
                offeredNFTs[i].tokenId
            );
            offer.offeredNFTs.push(offeredNFTs[i]);
        }

        // Transfer offered ERC20 tokens to escrow
        for (uint256 i = 0; i < offeredTokens.length; i++) {
            IERC20(offeredTokens[i].token).safeTransferFrom(
                msg.sender,
                address(this),
                offeredTokens[i].amount
            );
            offer.offeredTokens.push(offeredTokens[i]);
        }

        // Wrap native MON to WMON and add to offered tokens
        if (nativeAmount > 0) {
            wmon.deposit{value: nativeAmount}();
            offer.offeredTokens.push(
                ERC20Item({token: address(wmon), amount: nativeAmount})
            );
        }

        // Store wanted NFTs
        for (uint256 i = 0; i < wantedNFTs.length; i++) {
            offer.wantedNFTs.push(wantedNFTs[i]);
        }

        offersCreated[msg.sender].push(offerId);
        offersReceived[target].push(offerId);

        emit OfferCreated(offerId, msg.sender, target);
    }

    function acceptOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = _offers[offerId];

        if (offer.target != msg.sender) revert NotOfferTarget();
        if (offer.status != OfferStatus.Waiting) revert OfferNotWaiting();

        offer.status = OfferStatus.Completed;

        // Transfer wanted NFTs from target to offerer
        for (uint256 i = 0; i < offer.wantedNFTs.length; i++) {
            IERC721 nft = IERC721(offer.wantedNFTs[i].collection);
            if (nft.ownerOf(offer.wantedNFTs[i].tokenId) != msg.sender) {
                revert NotNFTOwner();
            }
            nft.safeTransferFrom(
                msg.sender,
                offer.offerer,
                offer.wantedNFTs[i].tokenId
            );
        }

        // Transfer offered NFTs from escrow to target
        for (uint256 i = 0; i < offer.offeredNFTs.length; i++) {
            IERC721(offer.offeredNFTs[i].collection).safeTransferFrom(
                address(this),
                msg.sender,
                offer.offeredNFTs[i].tokenId
            );
        }

        // Transfer offered ERC20 from escrow to target (includes WETH)
        for (uint256 i = 0; i < offer.offeredTokens.length; i++) {
            IERC20(offer.offeredTokens[i].token).safeTransfer(
                msg.sender,
                offer.offeredTokens[i].amount
            );
        }

        emit OfferAccepted(offerId, offer.offerer, msg.sender);
    }

    function declineOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = _offers[offerId];

        if (offer.target != msg.sender) revert NotOfferTarget();
        if (offer.status != OfferStatus.Waiting) revert OfferNotWaiting();

        offer.status = OfferStatus.Declined;

        _returnAssetsToOfferer(offer);

        emit OfferDeclined(offerId, msg.sender);
    }

    function cancelOffer(uint256 offerId) external nonReentrant {
        Offer storage offer = _offers[offerId];

        if (offer.offerer != msg.sender) revert NotOfferer();
        if (offer.status != OfferStatus.Waiting) revert OfferNotWaiting();

        offer.status = OfferStatus.Cancelled;

        _returnAssetsToOfferer(offer);

        emit OfferCancelled(offerId, msg.sender);
    }

    function _returnAssetsToOfferer(Offer storage offer) private {
        // Return NFTs to offerer
        for (uint256 i = 0; i < offer.offeredNFTs.length; i++) {
            IERC721(offer.offeredNFTs[i].collection).safeTransferFrom(
                address(this),
                offer.offerer,
                offer.offeredNFTs[i].tokenId
            );
        }

        // Return ERC20 to offerer (includes WETH - user can unwrap manually if needed)
        for (uint256 i = 0; i < offer.offeredTokens.length; i++) {
            IERC20(offer.offeredTokens[i].token).safeTransfer(
                offer.offerer,
                offer.offeredTokens[i].amount
            );
        }
    }

    // View functions
    function getOffer(
        uint256 offerId
    )
        external
        view
        returns (
            address offerer,
            address target,
            NFTItem[] memory offeredNFTs,
            ERC20Item[] memory offeredTokens,
            NFTItem[] memory wantedNFTs,
            OfferStatus status,
            uint256 createdAt
        )
    {
        Offer storage offer = _offers[offerId];
        return (
            offer.offerer,
            offer.target,
            offer.offeredNFTs,
            offer.offeredTokens,
            offer.wantedNFTs,
            offer.status,
            offer.createdAt
        );
    }

    function getOffersCreated(
        address user
    ) external view returns (uint256[] memory) {
        return offersCreated[user];
    }

    function getOffersReceived(
        address user
    ) external view returns (uint256[] memory) {
        return offersReceived[user];
    }

    /// @notice Get multiple offers at once
    /// @param offerIds Array of offer IDs to fetch
    function getOffersBatch(
        uint256[] calldata offerIds
    )
        external
        view
        returns (
            address[] memory offerers,
            address[] memory targets,
            OfferStatus[] memory statuses,
            uint256[] memory createdAts
        )
    {
        uint256 len = offerIds.length;
        offerers = new address[](len);
        targets = new address[](len);
        statuses = new OfferStatus[](len);
        createdAts = new uint256[](len);

        for (uint256 i = 0; i < len; i++) {
            Offer storage offer = _offers[offerIds[i]];
            offerers[i] = offer.offerer;
            targets[i] = offer.target;
            statuses[i] = offer.status;
            createdAts[i] = offer.createdAt;
        }
    }

    /// @notice Get offers created by user filtered by status
    /// @param user The user address
    /// @param status The status to filter by
    function getOffersCreatedByStatus(
        address user,
        OfferStatus status
    ) external view returns (uint256[] memory) {
        uint256[] storage allOffers = offersCreated[user];
        uint256 count = 0;

        // Count matching offers
        for (uint256 i = 0; i < allOffers.length; i++) {
            if (_offers[allOffers[i]].status == status) {
                count++;
            }
        }

        // Build result array
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allOffers.length; i++) {
            if (_offers[allOffers[i]].status == status) {
                result[idx++] = allOffers[i];
            }
        }

        return result;
    }

    /// @notice Get offers received by user filtered by status
    /// @param user The user address
    /// @param status The status to filter by
    function getOffersReceivedByStatus(
        address user,
        OfferStatus status
    ) external view returns (uint256[] memory) {
        uint256[] storage allOffers = offersReceived[user];
        uint256 count = 0;

        // Count matching offers
        for (uint256 i = 0; i < allOffers.length; i++) {
            if (_offers[allOffers[i]].status == status) {
                count++;
            }
        }

        // Build result array
        uint256[] memory result = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allOffers.length; i++) {
            if (_offers[allOffers[i]].status == status) {
                result[idx++] = allOffers[i];
            }
        }

        return result;
    }

    /// @notice Get all waiting (active) offers with pagination
    /// @param offset Starting index
    /// @param limit Maximum number of offers to return
    function getWaitingOffers(
        uint256 offset,
        uint256 limit
    ) external view returns (uint256[] memory offerIds, uint256 total) {
        // Count total waiting offers
        total = 0;
        for (uint256 i = 1; i <= nextOfferId; i++) {
            if (_offers[i].status == OfferStatus.Waiting) {
                total++;
            }
        }

        if (offset >= total || limit == 0) {
            return (new uint256[](0), total);
        }

        uint256 remaining = total - offset;
        uint256 size = remaining < limit ? remaining : limit;
        offerIds = new uint256[](size);

        uint256 found = 0;
        uint256 added = 0;

        for (uint256 i = 1; i <= nextOfferId && added < size; i++) {
            if (_offers[i].status == OfferStatus.Waiting) {
                if (found >= offset) {
                    offerIds[added++] = i;
                }
                found++;
            }
        }
    }

    // Admin functions
    function setPlatformFee(uint256 newFee) external onlyOwner {
        uint256 oldFee = platformFee;
        platformFee = newFee;
        emit PlatformFeeUpdated(oldFee, newFee);
    }

    function setFeeRecipient(address newRecipient) external onlyOwner {
        if (newRecipient == address(0)) revert InvalidAddress();
        address oldRecipient = feeRecipient;
        feeRecipient = newRecipient;
        emit FeeRecipientUpdated(oldRecipient, newRecipient);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    // Allow contract to receive ETH (for WETH unwrap if needed)
    receive() external payable {}
}
