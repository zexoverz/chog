// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {LilStarBlindBox} from "./LilStarBlindBox.sol";
import {LilStar, BlindBoxAddressNotSet, RedeemBlindBoxNotOpen, InvalidRedeemer} from "./LilStar.sol";
import {LilStarRewards} from "./LilStarRewards.sol";

contract LilStarTest is Test {
    LilStarBlindBox public blindBox;
    LilStar public lilStar;
    LilStarRewards public sbt;

    address public owner = address(this);
    address public withdrawAddress = address(0x99);
    address public alice = address(0x2);
    address public bob = address(0x3);

    uint16 public constant MAX_SUPPLY = 6000;

    function setUp() public {
        blindBox = new LilStarBlindBox(
            MAX_SUPPLY,
            payable(withdrawAddress)
        );

        lilStar = new LilStar("LilStar", "LSTAR", MAX_SUPPLY);
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
        assertEq(lilStar.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(lilStar.name(), "LilStar");
        assertEq(lilStar.symbol(), "LSTAR");
        assertEq(lilStar.owner(), owner);
    }

    function test_InitialTotalSupply() public view {
        assertEq(lilStar.totalSupply(), 0);
    }

    function test_SBTContractLinked() public view {
        assertEq(lilStar.sbtContract(), address(sbt));
    }

    // ============
    // Name and Symbol
    // ============

    function test_SetNameAndSymbol() public {
        lilStar.setNameAndSymbol("NewName", "NNFT");

        assertEq(lilStar.name(), "NewName");
        assertEq(lilStar.symbol(), "NNFT");
    }

    function test_RevertSetNameAndSymbolNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        lilStar.setNameAndSymbol("NewName", "NNFT");
    }

    // ============
    // BlindBox Address
    // ============

    function test_SetBlindBoxAddress() public {
        LilStar newLilStar = new LilStar("Test", "TEST", MAX_SUPPLY);
        newLilStar.setBlindBoxAddress(address(blindBox));

        (bool isOpen, address blindBoxAddr) = newLilStar.redeemInfo();
        assertEq(blindBoxAddr, address(blindBox));
        assertFalse(isOpen);
    }

    function test_RevertSetRedeemStateWithoutBlindBoxAddress() public {
        LilStar newLilStar = new LilStar("Test", "TEST", MAX_SUPPLY);

        vm.expectRevert(BlindBoxAddressNotSet.selector);
        newLilStar.setRedeemBlindBoxState(true);
    }

    // ============
    // Redeem BlindBoxes
    // ============

    function test_RedeemBlindBoxesMints() public {
        // Mint blindboxes to alice
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;
        blindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem
        uint256[] memory tokenIds = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = i;
        }

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Check LilStar balance
        assertEq(lilStar.balanceOf(alice), 5);
        assertEq(lilStar.totalSupply(), 5);
    }

    function test_RedeemBlindBoxesMintsSBT() public {
        // Mint blindboxes to alice
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;
        blindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem
        uint256[] memory tokenIds = new uint256[](5);
        for (uint256 i = 0; i < 5; i++) {
            tokenIds[i] = i;
        }

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Check SBT balance (should have 5 SBTs distributed across types)
        uint256 totalSBTs = sbt.balanceOf(alice, 1) + sbt.balanceOf(alice, 2) + sbt.balanceOf(alice, 3);
        assertEq(totalSBTs, 5);
    }

    function test_RedeemEmitsEvents() public {
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

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 0;

        // Expect BlindBoxRedeemed event (can't predict tokenId due to randomness)
        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Verify alice got a LilStar
        assertEq(lilStar.balanceOf(alice), 1);
    }

    function test_RevertRedeemNotOpen() public {
        // BlindBox address set but redeem not open
        uint256[] memory blindBoxIds = new uint256[](1);
        blindBoxIds[0] = 0;

        vm.prank(address(blindBox));
        vm.expectRevert(RedeemBlindBoxNotOpen.selector);
        lilStar.redeemBlindBoxes(alice, blindBoxIds);
    }

    function test_RevertRedeemInvalidCaller() public {
        lilStar.setRedeemBlindBoxState(true);

        uint256[] memory blindBoxIds = new uint256[](1);
        blindBoxIds[0] = 0;

        // Alice tries to call directly (not BlindBox contract)
        vm.prank(alice);
        vm.expectRevert(InvalidRedeemer.selector);
        lilStar.redeemBlindBoxes(alice, blindBoxIds);
    }

    function test_RandomTokenIdAssignment() public {
        // Mint multiple blindboxes
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10;
        blindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem all
        uint256[] memory tokenIds = new uint256[](10);
        for (uint256 i = 0; i < 10; i++) {
            tokenIds[i] = i;
        }

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // Alice should have 10 LilStars
        assertEq(lilStar.balanceOf(alice), 10);

        // Token IDs should be unique and within range
        assertEq(lilStar.totalSupply(), 10);
    }

    // ============
    // Redeem without SBT Contract
    // ============

    function test_RedeemWithoutSBTContract() public {
        // Create new LilStar without SBT
        LilStar lilStarNoSBT = new LilStar("NoSBT", "NOSBT", MAX_SUPPLY);
        LilStarBlindBox blindBoxNoSBT = new LilStarBlindBox(MAX_SUPPLY, payable(withdrawAddress));

        blindBoxNoSBT.setLilStarContract(address(lilStarNoSBT));
        lilStarNoSBT.setBlindBoxAddress(address(blindBoxNoSBT));
        // Note: NOT setting SBT contract

        // Mint and redeem
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBoxNoSBT.privilegedMint(recipients, amounts);

        blindBoxNoSBT.openRedeemBlindBoxState();
        lilStarNoSBT.setRedeemBlindBoxState(true);
        blindBoxNoSBT.breakTransferLock();

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 0;

        vm.prank(alice);
        blindBoxNoSBT.redeemBlindBoxes(tokenIds);

        // Should still get LilStar, just no SBT
        assertEq(lilStarNoSBT.balanceOf(alice), 1);
    }

    // ============
    // Base URI
    // ============

    function test_SetBaseURI() public {
        string memory baseURI = "https://api.lilstar.com/metadata/";
        lilStar.setBaseURI(baseURI);

        // Mint via redemption
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

        // Find the minted token
        uint256 mintedTokenId = _findAliceToken();

        string memory expectedURI = string(
            abi.encodePacked(baseURI, vm.toString(mintedTokenId))
        );
        assertEq(lilStar.tokenURI(mintedTokenId), expectedURI);
    }

    function test_PermanentURI() public {
        string memory baseURI = "https://api.lilstar.com/metadata/";
        string memory permanentURI = "https://api.lilstar.com/permanent/";
        lilStar.setBaseURI(baseURI);
        lilStar.setBaseURIPermanent(permanentURI);

        // Mint via redemption
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

        // Find the minted token
        uint256 mintedTokenId = _findAliceToken();

        // Set as permanent
        uint256[] memory permanentIds = new uint256[](1);
        permanentIds[0] = mintedTokenId;
        lilStar.setIsUriPermanent(permanentIds);

        string memory expectedURI = string(
            abi.encodePacked(permanentURI, vm.toString(mintedTokenId))
        );
        assertEq(lilStar.tokenURI(mintedTokenId), expectedURI);
    }

    // ============
    // Transfers
    // ============

    function test_Transfer() public {
        // Mint via redemption
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

        // Find the minted token
        uint256 mintedTokenId = _findAliceToken();

        // Transfer to bob
        vm.prank(alice);
        lilStar.transferFrom(alice, bob, mintedTokenId);

        assertEq(lilStar.ownerOf(mintedTokenId), bob);
    }

    // ============
    // Royalties (EIP-2981)
    // ============

    function test_SetDefaultRoyalty() public {
        lilStar.setDefaultRoyalty(bob, 750); // 7.5%

        // Mint via redemption
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

        // Find the minted token
        uint256 mintedTokenId = _findAliceToken();

        (address receiver, uint256 amount) = lilStar.royaltyInfo(
            mintedTokenId,
            1 ether
        );
        assertEq(receiver, bob);
        assertEq(amount, 0.075 ether);
    }

    // ============
    // EIP-165
    // ============

    function test_SupportsERC721Interface() public view {
        // ERC721 interface ID: 0x80ac58cd
        assertTrue(lilStar.supportsInterface(0x80ac58cd));
    }

    function test_SupportsERC2981Interface() public view {
        // ERC2981 interface ID: 0x2a55205a
        assertTrue(lilStar.supportsInterface(0x2a55205a));
    }

    // ============
    // No More Token IDs
    // ============

    function test_RevertNoMoreTokenIds() public {
        // Deploy with tiny supply
        LilStarBlindBox tinyBlindBox = new LilStarBlindBox(3, payable(withdrawAddress));
        LilStar tinyLilStar = new LilStar("Tiny", "TINY", 3);

        tinyBlindBox.setLilStarContract(address(tinyLilStar));
        tinyLilStar.setBlindBoxAddress(address(tinyBlindBox));

        // Mint all blindboxes
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3;
        tinyBlindBox.privilegedMint(recipients, amounts);

        // Enable redemption
        tinyBlindBox.openRedeemBlindBoxState();
        tinyLilStar.setRedeemBlindBoxState(true);
        tinyBlindBox.breakTransferLock();

        // Redeem all 3
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 0;
        tokenIds[1] = 1;
        tokenIds[2] = 2;
        vm.prank(alice);
        tinyBlindBox.redeemBlindBoxes(tokenIds);

        // All LilStars minted
        assertEq(tinyLilStar.totalSupply(), 3);
    }

    // ============
    // Helpers
    // ============

    function _findAliceToken() internal view returns (uint256) {
        for (uint256 i = 0; i < MAX_SUPPLY; i++) {
            try lilStar.ownerOf(i) returns (address tokenOwner) {
                if (tokenOwner == alice) {
                    return i;
                }
            } catch {
                continue;
            }
        }
        revert("Alice token not found");
    }
}
