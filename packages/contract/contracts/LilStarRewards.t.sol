// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {LilStarRewards, NotTransferable, NotLilStarContract, NoMoreSBTsAvailable, InsufficientBalance} from "./LilStarRewards.sol";
import {LilStarBlindBox} from "./LilStarBlindBox.sol";
import {LilStar} from "./LilStar.sol";

contract LilStarRewardsTest is Test {
    LilStarRewards public sbt;
    LilStarBlindBox public blindBox;
    LilStar public lilStar;

    address public owner = address(this);
    address public withdrawAddress = address(0x99);
    address public alice = address(0x2);
    address public bob = address(0x3);

    uint256 public constant MAX_SUPPLY = 6000;

    function setUp() public {
        // Deploy contracts
        blindBox = new LilStarBlindBox(MAX_SUPPLY, payable(withdrawAddress));
        lilStar = new LilStar("LilStar", "LSTAR", uint16(MAX_SUPPLY));
        sbt = new LilStarRewards();

        // Link contracts
        blindBox.setLilStarContract(address(lilStar));
        lilStar.setBlindBoxAddress(address(blindBox));
        lilStar.setSBTContract(address(sbt));
        sbt.setLilStarContract(address(lilStar));

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ============
    // Deployment
    // ============

    function test_DeploymentParams() public view {
        assertEq(sbt.name(), "LilStar SBT");
        assertEq(sbt.symbol(), "LSTARSBT");
        assertEq(sbt.MAX_DISCOUNT_5(), 2500);
        assertEq(sbt.MAX_DISCOUNT_10(), 2500);
        assertEq(sbt.MAX_FREE_BLINDBOX(), 1000);
    }

    function test_TokenConstants() public view {
        assertEq(sbt.DISCOUNT_5(), 1);
        assertEq(sbt.DISCOUNT_10(), 2);
        assertEq(sbt.FREE_BLINDBOX(), 3);
    }

    function test_InitialSupply() public view {
        (uint16 d5, uint16 d10, uint16 fb) = sbt.getRemainingSupply();
        assertEq(d5, 2500);
        assertEq(d10, 2500);
        assertEq(fb, 1000);
        assertEq(sbt.getTotalMinted(), 0);
    }

    function test_TokenNames() public view {
        assertEq(sbt.getTokenName(1), "5% Lifetime Discount");
        assertEq(sbt.getTokenName(2), "10% Lifetime Discount");
        assertEq(sbt.getTokenName(3), "Free IRL BlindBox");
        assertEq(sbt.getTokenName(99), "");
    }

    // ============
    // Minting via Reveal
    // ============

    function test_MintSBTDuringReveal() public {
        // Mint blindbox to alice
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem
        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 0;

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Check alice got LilStar
        assertEq(lilStar.balanceOf(alice), 1);

        // Check alice got exactly 1 SBT (one of the 3 types)
        uint256 totalSBTs = sbt.balanceOf(alice, 1) + sbt.balanceOf(alice, 2) + sbt.balanceOf(alice, 3);
        assertEq(totalSBTs, 1);
    }

    function test_MultipleSBTsDuringReveal() public {
        // Mint 5 blindboxes to alice
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;
        blindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem all 5
        uint256[] memory tokenIds = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = i;
        }

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Check alice got 5 LilStars
        assertEq(lilStar.balanceOf(alice), 5);

        // Check alice got 5 SBTs total (distributed across types)
        uint256 totalSBTs = sbt.balanceOf(alice, 1) + sbt.balanceOf(alice, 2) + sbt.balanceOf(alice, 3);
        assertEq(totalSBTs, 5);
        assertEq(sbt.getTotalMinted(), 5);
    }

    // ============
    // Soulbound (Non-transferable)
    // ============

    function test_RevertTransferSBT() public {
        _mintSBTToAlice();

        // Find which token alice has
        uint256 tokenId = _getAliceSBTType();

        // Try to transfer
        vm.prank(alice);
        vm.expectRevert(NotTransferable.selector);
        sbt.safeTransferFrom(alice, bob, tokenId, 1, "");
    }

    function test_RevertBatchTransferSBT() public {
        _mintSBTToAlice();

        uint256 tokenId = _getAliceSBTType();

        uint256[] memory ids = new uint256[](1);
        ids[0] = tokenId;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        vm.prank(alice);
        vm.expectRevert(NotTransferable.selector);
        sbt.safeBatchTransferFrom(alice, bob, ids, amounts, "");
    }

    function test_RevertSetApprovalForAllSBT() public {
        _mintSBTToAlice();

        vm.prank(alice);
        vm.expectRevert(NotTransferable.selector);
        sbt.setApprovalForAll(bob, true);
    }

    // ============
    // Burning
    // ============

    function test_BurnSBT() public {
        _mintSBTToAlice();

        uint256 tokenId = _getAliceSBTType();
        assertEq(sbt.balanceOf(alice, tokenId), 1);

        vm.prank(alice);
        sbt.burn(tokenId, 1);

        assertEq(sbt.balanceOf(alice, tokenId), 0);
    }

    function test_RevertBurnInsufficientBalance() public {
        _mintSBTToAlice();

        uint256 tokenId = _getAliceSBTType();

        vm.prank(alice);
        vm.expectRevert(InsufficientBalance.selector);
        sbt.burn(tokenId, 2); // Alice only has 1
    }

    function test_BurnEmitsEvent() public {
        _mintSBTToAlice();

        uint256 tokenId = _getAliceSBTType();

        vm.expectEmit(true, true, false, true);
        emit LilStarRewards.SBTBurned(alice, tokenId, 1);

        vm.prank(alice);
        sbt.burn(tokenId, 1);
    }

    // ============
    // Access Control
    // ============

    function test_RevertMintNotLilStarContract() public {
        vm.prank(alice);
        vm.expectRevert(NotLilStarContract.selector);
        sbt.mintRandomSBT(alice, 12345);
    }

    // ============
    // SBT Type Distribution
    // ============

    function test_SBTTypeDistribution() public {
        // Mint many blindboxes and reveal them
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 100;
        blindBox.privilegedMint(recipients, amounts);

        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem all 100
        uint256[] memory tokenIds = new uint256[](100);
        for (uint256 i = 0; i < 100; i++) {
            tokenIds[i] = i;
        }

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Check supply decreased
        (uint16 d5, uint16 d10, uint16 fb) = sbt.getRemainingSupply();
        uint16 totalRemaining = d5 + d10 + fb;
        assertEq(totalRemaining, 6000 - 100); // 5900 remaining

        assertEq(sbt.getTotalMinted(), 100);
    }

    // ============
    // URI
    // ============

    function test_SetURI() public {
        sbt.setURI("https://api.lilstars.xyz/sbt/metadata/");

        assertEq(sbt.uri(1), "https://api.lilstars.xyz/sbt/metadata/1");
        assertEq(sbt.uri(2), "https://api.lilstars.xyz/sbt/metadata/2");
        assertEq(sbt.uri(3), "https://api.lilstars.xyz/sbt/metadata/3");
    }

    // ============
    // Admin
    // ============

    function test_SetLilStarContract() public {
        LilStarRewards newSbt = new LilStarRewards();
        newSbt.setLilStarContract(address(0x123));
        assertEq(newSbt.lilStarContract(), address(0x123));
    }

    // ============
    // Helpers
    // ============

    function _mintSBTToAlice() internal {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBox.privilegedMint(recipients, amounts);

        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 0;

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);
    }

    function _getAliceSBTType() internal view returns (uint256) {
        if (sbt.balanceOf(alice, 1) > 0) return 1;
        if (sbt.balanceOf(alice, 2) > 0) return 2;
        if (sbt.balanceOf(alice, 3) > 0) return 3;
        revert("Alice has no SBT");
    }
}
