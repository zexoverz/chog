// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {NFTSwap} from "./NFTSwap.sol";
import {MockERC721} from "./mocks/MockERC721.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockWMON} from "./mocks/MockWMON.sol";

contract NFTSwapTest is Test {
    NFTSwap public swap;
    MockERC721 public nftA;
    MockERC721 public nftB;
    MockERC20 public token;
    MockWMON public wmon;

    address public owner = address(0x1);
    address public feeRecipient = address(0x99);
    address public alice = address(0x2);
    address public bob = address(0x3);

    uint256 public constant PLATFORM_FEE = 0.01 ether;

    function setUp() public {
        wmon = new MockWMON();
        swap = new NFTSwap(owner, feeRecipient, PLATFORM_FEE, address(wmon));
        nftA = new MockERC721("NFT A", "NFTA");
        nftB = new MockERC721("NFT B", "NFTB");
        token = new MockERC20("Token", "TKN");

        // Setup Alice - has NFT A tokens and ERC20
        vm.startPrank(alice);
        nftA.mint(alice); // tokenId 1
        nftA.mint(alice); // tokenId 2
        token.mint(alice, 1000 ether);
        nftA.setApprovalForAll(address(swap), true);
        token.approve(address(swap), type(uint256).max);
        vm.stopPrank();

        // Setup Bob - has NFT B tokens
        vm.startPrank(bob);
        nftB.mint(bob); // tokenId 1
        nftB.mint(bob); // tokenId 2
        nftB.setApprovalForAll(address(swap), true);
        vm.stopPrank();

        // Fund accounts with ETH for fees
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
    }

    function test_CreateOfferWithNFT() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0 // no native ETH
        );

        assertEq(offerId, 1);
        assertEq(nftA.ownerOf(1), address(swap)); // NFT in escrow

        (
            address offerer,
            address target,
            ,
            ,
            ,
            NFTSwap.OfferStatus status,

        ) = swap.getOffer(offerId);

        assertEq(offerer, alice);
        assertEq(target, bob);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Waiting));
    }

    function test_CreateOfferWithNativeETH() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](0);
        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        uint256 nativeAmount = 1 ether;

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE + nativeAmount}(
            bob,
            offered,
            offeredTokens,
            wanted,
            nativeAmount
        );

        assertEq(offerId, 1);
        // WETH should be in escrow
        assertEq(wmon.balanceOf(address(swap)), nativeAmount);

        (, , , NFTSwap.ERC20Item[] memory tokens, , , ) = swap.getOffer(
            offerId
        );
        assertEq(tokens.length, 1);
        assertEq(tokens[0].token, address(wmon));
        assertEq(tokens[0].amount, nativeAmount);
    }

    function test_CreateOfferWithNFTAndNativeETH() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        uint256 nativeAmount = 0.5 ether;

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE + nativeAmount}(
            bob,
            offered,
            offeredTokens,
            wanted,
            nativeAmount
        );

        assertEq(offerId, 1);
        assertEq(nftA.ownerOf(1), address(swap));
        assertEq(wmon.balanceOf(address(swap)), nativeAmount);
    }

    function test_CreateOfferWithNFTAndERC20() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](1);
        offeredTokens[0] = NFTSwap.ERC20Item(address(token), 100 ether);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        assertEq(offerId, 1);
        assertEq(nftA.ownerOf(1), address(swap));
        assertEq(token.balanceOf(address(swap)), 100 ether);
    }

    function test_CreateOfferCollectsFee() public {
        uint256 feeRecipientBalanceBefore = feeRecipient.balance;

        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered, offeredTokens, wanted, 0);

        assertEq(feeRecipient.balance, feeRecipientBalanceBefore + PLATFORM_FEE);
    }

    function test_AcceptOffer() public {
        // Alice creates offer
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](1);
        offeredTokens[0] = NFTSwap.ERC20Item(address(token), 100 ether);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        // Bob accepts
        vm.prank(bob);
        swap.acceptOffer(offerId);

        // Alice gets Bob's NFT
        assertEq(nftB.ownerOf(1), alice);
        // Bob gets Alice's NFT and tokens
        assertEq(nftA.ownerOf(1), bob);
        assertEq(token.balanceOf(bob), 100 ether);

        (, , , , , NFTSwap.OfferStatus status, ) = swap.getOffer(offerId);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Completed));
    }

    function test_AcceptOfferWithNativeETH() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        uint256 nativeAmount = 1 ether;

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE + nativeAmount}(
            bob,
            offered,
            offeredTokens,
            wanted,
            nativeAmount
        );

        // Bob accepts
        vm.prank(bob);
        swap.acceptOffer(offerId);

        // Alice gets Bob's NFT
        assertEq(nftB.ownerOf(1), alice);
        // Bob gets Alice's NFT and WETH
        assertEq(nftA.ownerOf(1), bob);
        assertEq(wmon.balanceOf(bob), nativeAmount);

        (, , , , , NFTSwap.OfferStatus status, ) = swap.getOffer(offerId);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Completed));
    }

    function test_DeclineOffer() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](1);
        offeredTokens[0] = NFTSwap.ERC20Item(address(token), 100 ether);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        // Bob declines
        vm.prank(bob);
        swap.declineOffer(offerId);

        // Assets returned to Alice
        assertEq(nftA.ownerOf(1), alice);
        assertEq(token.balanceOf(alice), 1000 ether);

        (, , , , , NFTSwap.OfferStatus status, ) = swap.getOffer(offerId);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Declined));
    }

    function test_DeclineOfferReturnsWETH() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](0);
        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        uint256 nativeAmount = 1 ether;

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE + nativeAmount}(
            bob,
            offered,
            offeredTokens,
            wanted,
            nativeAmount
        );

        // Bob declines
        vm.prank(bob);
        swap.declineOffer(offerId);

        // WETH returned to Alice (she can unwrap manually)
        assertEq(wmon.balanceOf(alice), nativeAmount);

        (, , , , , NFTSwap.OfferStatus status, ) = swap.getOffer(offerId);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Declined));
    }

    function test_CancelOffer() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        // Alice cancels
        vm.prank(alice);
        swap.cancelOffer(offerId);

        // NFT returned to Alice
        assertEq(nftA.ownerOf(1), alice);

        (, , , , , NFTSwap.OfferStatus status, ) = swap.getOffer(offerId);
        assertEq(uint8(status), uint8(NFTSwap.OfferStatus.Cancelled));
    }

    function test_RevertAcceptNotTarget() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        // Charlie tries to accept
        address charlie = address(0x4);
        vm.prank(charlie);
        vm.expectRevert(NFTSwap.NotOfferTarget.selector);
        swap.acceptOffer(offerId);
    }

    function test_RevertCancelNotOfferer() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        uint256 offerId = swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            0
        );

        // Bob tries to cancel
        vm.prank(bob);
        vm.expectRevert(NFTSwap.NotOfferer.selector);
        swap.cancelOffer(offerId);
    }

    function test_RevertInsufficientPayment() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        vm.expectRevert(NFTSwap.InsufficientPayment.selector);
        swap.createOffer{value: 0}(bob, offered, offeredTokens, wanted, 0);
    }

    function test_RevertInsufficientPaymentWithNative() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](0);
        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        uint256 nativeAmount = 1 ether;

        vm.prank(alice);
        vm.expectRevert(NFTSwap.InsufficientPayment.selector);
        // Only send fee, not native amount
        swap.createOffer{value: PLATFORM_FEE}(
            bob,
            offered,
            offeredTokens,
            wanted,
            nativeAmount
        );
    }

    function test_GetOffersCreatedAndReceived() public {
        NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](1);
        offered[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.prank(alice);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered, offeredTokens, wanted, 0);

        uint256[] memory aliceOffers = swap.getOffersCreated(alice);
        uint256[] memory bobOffers = swap.getOffersReceived(bob);

        assertEq(aliceOffers.length, 1);
        assertEq(aliceOffers[0], 1);
        assertEq(bobOffers.length, 1);
        assertEq(bobOffers[0], 1);
    }

    function test_SetPlatformFee() public {
        uint256 newFee = 0.02 ether;

        vm.prank(owner);
        swap.setPlatformFee(newFee);

        assertEq(swap.platformFee(), newFee);
    }

    function test_SetFeeRecipient() public {
        address newRecipient = address(0x100);

        vm.prank(owner);
        swap.setFeeRecipient(newRecipient);

        assertEq(swap.feeRecipient(), newRecipient);
    }

    function test_GetOffersBatch() public {
        // Create 2 offers
        NFTSwap.NFTItem[] memory offered1 = new NFTSwap.NFTItem[](1);
        offered1[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.NFTItem[] memory offered2 = new NFTSwap.NFTItem[](1);
        offered2[0] = NFTSwap.NFTItem(address(nftA), 2);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.startPrank(alice);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered1, offeredTokens, wanted, 0);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered2, offeredTokens, wanted, 0);
        vm.stopPrank();

        uint256[] memory ids = new uint256[](2);
        ids[0] = 1;
        ids[1] = 2;

        (
            address[] memory offerers,
            address[] memory targets,
            NFTSwap.OfferStatus[] memory statuses,
            uint256[] memory createdAts
        ) = swap.getOffersBatch(ids);

        assertEq(offerers.length, 2);
        assertEq(offerers[0], alice);
        assertEq(offerers[1], alice);
        assertEq(targets[0], bob);
        assertEq(targets[1], bob);
        assertEq(uint8(statuses[0]), uint8(NFTSwap.OfferStatus.Waiting));
        assertEq(uint8(statuses[1]), uint8(NFTSwap.OfferStatus.Waiting));
        assertTrue(createdAts[0] > 0);
        assertTrue(createdAts[1] > 0);
    }

    function test_GetOffersCreatedByStatus() public {
        NFTSwap.NFTItem[] memory offered1 = new NFTSwap.NFTItem[](1);
        offered1[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.NFTItem[] memory offered2 = new NFTSwap.NFTItem[](1);
        offered2[0] = NFTSwap.NFTItem(address(nftA), 2);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.startPrank(alice);
        uint256 offerId1 = swap.createOffer{value: PLATFORM_FEE}(bob, offered1, offeredTokens, wanted, 0);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered2, offeredTokens, wanted, 0);

        // Cancel first offer
        swap.cancelOffer(offerId1);
        vm.stopPrank();

        // Get waiting offers
        uint256[] memory waitingOffers = swap.getOffersCreatedByStatus(alice, NFTSwap.OfferStatus.Waiting);
        assertEq(waitingOffers.length, 1);
        assertEq(waitingOffers[0], 2);

        // Get cancelled offers
        uint256[] memory cancelledOffers = swap.getOffersCreatedByStatus(alice, NFTSwap.OfferStatus.Cancelled);
        assertEq(cancelledOffers.length, 1);
        assertEq(cancelledOffers[0], 1);
    }

    function test_GetOffersReceivedByStatus() public {
        NFTSwap.NFTItem[] memory offered1 = new NFTSwap.NFTItem[](1);
        offered1[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.NFTItem[] memory offered2 = new NFTSwap.NFTItem[](1);
        offered2[0] = NFTSwap.NFTItem(address(nftA), 2);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.startPrank(alice);
        uint256 offerId1 = swap.createOffer{value: PLATFORM_FEE}(bob, offered1, offeredTokens, wanted, 0);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered2, offeredTokens, wanted, 0);
        vm.stopPrank();

        // Bob declines first offer
        vm.prank(bob);
        swap.declineOffer(offerId1);

        // Get waiting offers for Bob
        uint256[] memory waitingOffers = swap.getOffersReceivedByStatus(bob, NFTSwap.OfferStatus.Waiting);
        assertEq(waitingOffers.length, 1);
        assertEq(waitingOffers[0], 2);

        // Get declined offers for Bob
        uint256[] memory declinedOffers = swap.getOffersReceivedByStatus(bob, NFTSwap.OfferStatus.Declined);
        assertEq(declinedOffers.length, 1);
        assertEq(declinedOffers[0], 1);
    }

    function test_GetWaitingOffers() public {
        NFTSwap.NFTItem[] memory offered1 = new NFTSwap.NFTItem[](1);
        offered1[0] = NFTSwap.NFTItem(address(nftA), 1);

        NFTSwap.NFTItem[] memory offered2 = new NFTSwap.NFTItem[](1);
        offered2[0] = NFTSwap.NFTItem(address(nftA), 2);

        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        vm.startPrank(alice);
        uint256 offerId1 = swap.createOffer{value: PLATFORM_FEE}(bob, offered1, offeredTokens, wanted, 0);
        swap.createOffer{value: PLATFORM_FEE}(bob, offered2, offeredTokens, wanted, 0);

        // Cancel first offer
        swap.cancelOffer(offerId1);
        vm.stopPrank();

        // Get all waiting offers
        (uint256[] memory offerIds, uint256 total) = swap.getWaitingOffers(0, 10);
        assertEq(total, 1);
        assertEq(offerIds.length, 1);
        assertEq(offerIds[0], 2);
    }

    function test_GetWaitingOffersPagination() public {
        NFTSwap.ERC20Item[] memory offeredTokens = new NFTSwap.ERC20Item[](0);

        NFTSwap.NFTItem[] memory wanted = new NFTSwap.NFTItem[](1);
        wanted[0] = NFTSwap.NFTItem(address(nftB), 1);

        // Create offer with just native ETH (no NFT needed)
        vm.startPrank(alice);
        for (uint256 i = 0; i < 5; i++) {
            NFTSwap.NFTItem[] memory offered = new NFTSwap.NFTItem[](0);
            swap.createOffer{value: PLATFORM_FEE + 0.1 ether}(
                bob,
                offered,
                offeredTokens,
                wanted,
                0.1 ether
            );
        }
        vm.stopPrank();

        // Get first 2
        (uint256[] memory page1, uint256 total1) = swap.getWaitingOffers(0, 2);
        assertEq(total1, 5);
        assertEq(page1.length, 2);
        assertEq(page1[0], 1);
        assertEq(page1[1], 2);

        // Get next 2
        (uint256[] memory page2, uint256 total2) = swap.getWaitingOffers(2, 2);
        assertEq(total2, 5);
        assertEq(page2.length, 2);
        assertEq(page2[0], 3);
        assertEq(page2[1], 4);

        // Get last 1
        (uint256[] memory page3, uint256 total3) = swap.getWaitingOffers(4, 2);
        assertEq(total3, 5);
        assertEq(page3.length, 1);
        assertEq(page3[0], 5);
    }
}
