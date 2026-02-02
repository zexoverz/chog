// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {BlindBox, InvalidContractSetup, ChunkAlreadyProcessed, MismatchedArrays, InitialTransferLockOn, PresaleNotOpen, InvalidSignature, InsufficientFunds, RedeemBlindBoxNotOpen, LilStarContractNotSet} from "./BlindBox.sol";
import {LilStar} from "./LilStar.sol";

contract BlindBoxTest is Test {
    BlindBox public blindBox;
    LilStar public lilStar;

    address public owner = address(this);
    address public withdrawAddress = address(0x99);
    address public offchainSigner;
    uint256 public offchainSignerPk = 0x1234;
    address public alice = address(0x2);
    address public bob = address(0x3);

    uint256 public constant MAX_SUPPLY = 6000;
    uint256 public constant PRESALE_SUPPLY = 3756;

    function setUp() public {
        offchainSigner = vm.addr(offchainSignerPk);

        blindBox = new BlindBox(
            MAX_SUPPLY,
            PRESALE_SUPPLY,
            payable(withdrawAddress)
        );

        lilStar = new LilStar("LilStar", "LSTAR", uint16(MAX_SUPPLY));

        // Link contracts
        blindBox.setLilStarContract(address(lilStar));
        lilStar.setBlindBoxAddress(address(blindBox));

        // Set offchain signer
        blindBox.setOffchainSigner(offchainSigner);

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ============
    // Deployment
    // ============

    function test_DeploymentParams() public view {
        assertEq(blindBox.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(blindBox.TOTAL_PRESALE_AND_AUCTION_SUPPLY(), PRESALE_SUPPLY);
        assertEq(blindBox.WITHDRAW_ADDRESS(), withdrawAddress);
        assertEq(blindBox.owner(), owner);
    }

    function test_InitialTransferLockOn() public view {
        assertTrue(blindBox.initialTransferLockOn());
    }

    function test_RevertInvalidContractSetup() public {
        vm.expectRevert(InvalidContractSetup.selector);
        new BlindBox(1000, 1000, payable(withdrawAddress)); // presale >= max
    }

    // ============
    // Airdrop
    // ============

    function test_Airdrop() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 5;
        amounts[1] = 10;

        blindBox.airdrop(recipients, amounts, 1);

        assertEq(blindBox.balanceOf(alice), 5);
        assertEq(blindBox.balanceOf(bob), 10);
    }

    function test_AirdropEmitsEvent() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;

        vm.expectEmit(true, false, false, false);
        emit BlindBox.AirdroppedChunk(1);

        blindBox.airdrop(recipients, amounts, 1);
    }

    function test_RevertAirdropChunkAlreadyProcessed() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;

        blindBox.airdrop(recipients, amounts, 1);

        vm.expectRevert(ChunkAlreadyProcessed.selector);
        blindBox.airdrop(recipients, amounts, 1); // Same chunk
    }

    function test_RevertAirdropNotOwner() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 5;

        vm.prank(alice);
        vm.expectRevert();
        blindBox.airdrop(recipients, amounts, 1);
    }

    // ============
    // Privileged Mint
    // ============

    function test_PrivilegedMint() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](2);
        amounts[0] = 10;
        amounts[1] = 20;

        blindBox.privilegedMint(recipients, amounts);

        assertEq(blindBox.balanceOf(alice), 10);
        assertEq(blindBox.balanceOf(bob), 20);
    }

    function test_RevertPrivilegedMintMismatchedArrays() public {
        address[] memory recipients = new address[](2);
        recipients[0] = alice;
        recipients[1] = bob;

        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 10;

        vm.expectRevert(MismatchedArrays.selector);
        blindBox.privilegedMint(recipients, amounts);
    }

    // ============
    // Transfer Lock
    // ============

    function test_TransferLockPreventsTransfer() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        blindBox.privilegedMint(recipients, amounts);

        vm.prank(alice);
        vm.expectRevert(InitialTransferLockOn.selector);
        blindBox.transferFrom(alice, bob, 0);
    }

    function test_BreakTransferLockAllowsTransfer() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;

        blindBox.privilegedMint(recipients, amounts);
        blindBox.breakTransferLock();

        vm.prank(alice);
        blindBox.transferFrom(alice, bob, 0);

        assertEq(blindBox.ownerOf(0), bob);
    }

    // ============
    // Presale Mint
    // ============

    function test_PresaleMint() public {
        // Setup presale
        uint32 startTime = uint32(block.timestamp);
        uint32 endTime = uint32(block.timestamp + 1 hours);
        uint64 price = 0.1 ether;

        blindBox.setPresaleParams(startTime, endTime, price);

        uint16 amount = 3;
        uint16 maxAllowed = 5;
        bytes memory signature = _signPresale(alice, amount, maxAllowed);

        vm.prank(alice);
        blindBox.presaleMint{value: price * amount}(amount, maxAllowed, signature);

        assertEq(blindBox.balanceOf(alice), amount);
    }

    function test_RevertPresaleNotOpen() public {
        // Presale not configured
        bytes memory signature = _signPresale(alice, 1, 5);

        vm.prank(alice);
        vm.expectRevert(PresaleNotOpen.selector);
        blindBox.presaleMint{value: 0.1 ether}(1, 5, signature);
    }

    function test_RevertPresaleInvalidSignature() public {
        uint32 startTime = uint32(block.timestamp);
        uint32 endTime = uint32(block.timestamp + 1 hours);
        uint64 price = 0.1 ether;

        blindBox.setPresaleParams(startTime, endTime, price);

        // Sign for wrong address
        bytes memory signature = _signPresale(bob, 1, 5);

        vm.prank(alice);
        vm.expectRevert(InvalidSignature.selector);
        blindBox.presaleMint{value: price}(1, 5, signature);
    }

    function test_RevertPresaleInsufficientFunds() public {
        uint32 startTime = uint32(block.timestamp);
        uint32 endTime = uint32(block.timestamp + 1 hours);
        uint64 price = 0.1 ether;

        blindBox.setPresaleParams(startTime, endTime, price);

        bytes memory signature = _signPresale(alice, 3, 5);

        vm.prank(alice);
        vm.expectRevert(InsufficientFunds.selector);
        blindBox.presaleMint{value: price}(3, 5, signature); // Only paid for 1
    }

    // ============
    // Redeem BlindBox
    // ============

    function test_RedeemBlindBox() public {
        // Mint blindbox to alice
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 3;
        blindBox.privilegedMint(recipients, amounts);

        // Setup redemption
        blindBox.openRedeemBlindBoxState();
        lilStar.setRedeemBlindBoxState(true);
        blindBox.breakTransferLock();

        // Redeem
        uint256[] memory tokenIds = new uint256[](3);
        tokenIds[0] = 0;
        tokenIds[1] = 1;
        tokenIds[2] = 2;

        vm.prank(alice);
        blindBox.redeemBlindBoxes(tokenIds);

        // BlindBoxes burned
        assertEq(blindBox.balanceOf(alice), 0);
        // LilStars minted
        assertEq(lilStar.balanceOf(alice), 3);
    }

    function test_RevertRedeemNotOpen() public {
        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBox.privilegedMint(recipients, amounts);

        uint256[] memory tokenIds = new uint256[](1);
        tokenIds[0] = 0;

        vm.prank(alice);
        vm.expectRevert(RedeemBlindBoxNotOpen.selector);
        blindBox.redeemBlindBoxes(tokenIds);
    }

    function test_RevertRedeemLilStarContractNotSet() public {
        BlindBox newBlindBox = new BlindBox(MAX_SUPPLY, PRESALE_SUPPLY, payable(withdrawAddress));

        vm.expectRevert(LilStarContractNotSet.selector);
        newBlindBox.openRedeemBlindBoxState();
    }

    // ============
    // Withdraw
    // ============

    function test_Withdraw() public {
        // Setup and do a mint to get funds
        uint32 startTime = uint32(block.timestamp);
        uint32 endTime = uint32(block.timestamp + 1 hours);
        uint64 price = 1 ether;

        blindBox.setPresaleParams(startTime, endTime, price);
        bytes memory signature = _signPresale(alice, 1, 5);

        vm.prank(alice);
        blindBox.presaleMint{value: price}(1, 5, signature);

        uint256 balanceBefore = withdrawAddress.balance;
        blindBox.withdraw();
        uint256 balanceAfter = withdrawAddress.balance;

        assertEq(balanceAfter - balanceBefore, price);
    }

    // ============
    // Base URI
    // ============

    function test_SetBaseURI() public {
        string memory baseURI = "https://api.lilstar.com/blindbox/";
        blindBox.setBaseURI(baseURI);

        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBox.privilegedMint(recipients, amounts);

        assertEq(blindBox.tokenURI(0), string(abi.encodePacked(baseURI, "0")));
    }

    // ============
    // Royalties
    // ============

    function test_SetDefaultRoyalty() public {
        blindBox.setDefaultRoyalty(bob, 500); // 5%

        address[] memory recipients = new address[](1);
        recipients[0] = alice;
        uint256[] memory amounts = new uint256[](1);
        amounts[0] = 1;
        blindBox.privilegedMint(recipients, amounts);

        (address receiver, uint256 amount) = blindBox.royaltyInfo(0, 1 ether);
        assertEq(receiver, bob);
        assertEq(amount, 0.05 ether);
    }

    // ============
    // Helpers
    // ============

    function _signPresale(
        address minter,
        uint16 amount,
        uint16 maxAllowed
    ) internal view returns (bytes memory) {
        bytes32 hash = keccak256(abi.encodePacked(amount, minter, maxAllowed));
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(offchainSignerPk, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }
}
