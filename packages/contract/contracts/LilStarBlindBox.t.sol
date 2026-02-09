// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Test} from "forge-std/Test.sol";
import {LilStarBlindBox, ChunkAlreadyProcessed, MismatchedArrays, InitialTransferLockOn, PhaseNotOpen, InvalidSignature, InsufficientFunds, RedeemBlindBoxNotOpen, LilStarContractNotSet, ExceedsMaxPerWallet, OverMaxSupply} from "./LilStarBlindBox.sol";
import {LilStar} from "./LilStar.sol";

contract LilStarBlindBoxTest is Test {
    LilStarBlindBox public blindBox;
    LilStar public lilStar;

    address public owner = address(this);
    address public withdrawAddress = address(0x99);
    address public offchainSigner;
    uint256 public offchainSignerPk = 0x1234;
    address public alice = address(0x2);
    address public bob = address(0x3);

    uint256 public constant MAX_SUPPLY = 6000;

    // Prices from mint-plan.md
    uint64 public constant PRESALE_PRICE = 0.025 ether;   // ~$25
    uint64 public constant STARLIST_PRICE = 0.035 ether;  // ~$35
    uint64 public constant FCFS_PRICE = 0.040 ether;      // ~$40

    function setUp() public {
        offchainSigner = vm.addr(offchainSignerPk);

        blindBox = new LilStarBlindBox(
            MAX_SUPPLY,
            payable(withdrawAddress)
        );

        lilStar = new LilStar("LilStar", "LSTAR", uint16(MAX_SUPPLY));

        // Link contracts
        blindBox.setLilStarContract(address(lilStar));
        lilStar.setBlindBoxAddress(address(blindBox));

        // Set offchain signer
        blindBox.setOffchainSigner(offchainSigner);

        // Set prices
        blindBox.setPrices(PRESALE_PRICE, STARLIST_PRICE, FCFS_PRICE);

        // Fund test accounts
        vm.deal(alice, 100 ether);
        vm.deal(bob, 100 ether);
    }

    // ============
    // Deployment
    // ============

    function test_DeploymentParams() public view {
        assertEq(blindBox.MAX_SUPPLY(), MAX_SUPPLY);
        assertEq(blindBox.WITHDRAW_ADDRESS(), withdrawAddress);
        assertEq(blindBox.owner(), owner);
    }

    function test_InitialTransferLockOn() public view {
        assertTrue(blindBox.initialTransferLockOn());
    }

    function test_InitialPhaseIsClosed() public view {
        assertEq(uint8(blindBox.currentPhase()), uint8(LilStarBlindBox.MintPhase.CLOSED));
    }

    function test_DeployAnyMaxSupply() public {
        LilStarBlindBox newBox = new LilStarBlindBox(1000, payable(withdrawAddress));
        assertEq(newBox.MAX_SUPPLY(), 1000);
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
        emit LilStarBlindBox.AirdroppedChunk(1);

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
        // Enable presale phase
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);

        uint16 amount = 3;
        uint16 maxAllowed = 5;
        bytes memory signature = _signMint(alice, maxAllowed, "PRESALE");

        vm.prank(alice);
        blindBox.presaleMint{value: PRESALE_PRICE * amount}(amount, maxAllowed, signature);

        assertEq(blindBox.balanceOf(alice), amount);
        assertEq(blindBox.mintedInPresale(alice), amount);
    }

    function test_RevertPresalePhaseNotOpen() public {
        // Phase is CLOSED by default
        bytes memory signature = _signMint(alice, 5, "PRESALE");

        vm.prank(alice);
        vm.expectRevert(PhaseNotOpen.selector);
        blindBox.presaleMint{value: PRESALE_PRICE}(1, 5, signature);
    }

    function test_RevertPresaleInvalidSignature() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);

        // Sign for wrong address
        bytes memory signature = _signMint(bob, 5, "PRESALE");

        vm.prank(alice);
        vm.expectRevert(InvalidSignature.selector);
        blindBox.presaleMint{value: PRESALE_PRICE}(1, 5, signature);
    }

    function test_RevertPresaleInsufficientFunds() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);

        bytes memory signature = _signMint(alice, 5, "PRESALE");

        vm.prank(alice);
        vm.expectRevert(InsufficientFunds.selector);
        blindBox.presaleMint{value: PRESALE_PRICE}(3, 5, signature); // Only paid for 1
    }

    function test_RevertPresaleExceedsMaxPerWallet() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);

        // maxPerWalletPresale is 5 by default
        bytes memory signature = _signMint(alice, 10, "PRESALE");

        vm.prank(alice);
        vm.expectRevert(ExceedsMaxPerWallet.selector);
        blindBox.presaleMint{value: PRESALE_PRICE * 6}(6, 10, signature);
    }

    // ============
    // Starlist Mint
    // ============

    function test_StarlistMint() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.STARLIST);

        uint16 amount = 2;
        uint16 maxAllowed = 3;
        bytes memory signature = _signMint(alice, maxAllowed, "STARLIST");

        vm.prank(alice);
        blindBox.starlistMint{value: STARLIST_PRICE * amount}(amount, maxAllowed, signature);

        assertEq(blindBox.balanceOf(alice), amount);
        assertEq(blindBox.mintedInStarlist(alice), amount);
    }

    function test_RevertStarlistPhaseNotOpen() public {
        // Phase is CLOSED
        bytes memory signature = _signMint(alice, 3, "STARLIST");

        vm.prank(alice);
        vm.expectRevert(PhaseNotOpen.selector);
        blindBox.starlistMint{value: STARLIST_PRICE}(1, 3, signature);
    }

    function test_RevertStarlistWrongPhase() public {
        // Set to PRESALE instead of STARLIST
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);

        bytes memory signature = _signMint(alice, 3, "STARLIST");

        vm.prank(alice);
        vm.expectRevert(PhaseNotOpen.selector);
        blindBox.starlistMint{value: STARLIST_PRICE}(1, 3, signature);
    }

    // ============
    // FCFS Mint
    // ============

    function test_FcfsMint() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.FCFS);

        uint16 amount = 2;

        vm.prank(alice);
        blindBox.fcfsMint{value: FCFS_PRICE * amount}(amount);

        assertEq(blindBox.balanceOf(alice), amount);
        assertEq(blindBox.mintedInFcfs(alice), amount);
    }

    function test_RevertFcfsPhaseNotOpen() public {
        vm.prank(alice);
        vm.expectRevert(PhaseNotOpen.selector);
        blindBox.fcfsMint{value: FCFS_PRICE}(1);
    }

    function test_RevertFcfsExceedsMaxPerWallet() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.FCFS);

        // maxPerWalletFcfs is 2 by default
        vm.prank(alice);
        vm.expectRevert(ExceedsMaxPerWallet.selector);
        blindBox.fcfsMint{value: FCFS_PRICE * 3}(3);
    }

    function test_RevertFcfsInsufficientFunds() public {
        blindBox.setPhase(LilStarBlindBox.MintPhase.FCFS);

        vm.prank(alice);
        vm.expectRevert(InsufficientFunds.selector);
        blindBox.fcfsMint{value: FCFS_PRICE}(2); // Only paid for 1
    }

    // ============
    // Phase Transitions
    // ============

    function test_PhaseTransitions() public {
        // Start CLOSED
        assertEq(uint8(blindBox.currentPhase()), 0);

        // Move to PRESALE
        blindBox.setPhase(LilStarBlindBox.MintPhase.PRESALE);
        assertEq(uint8(blindBox.currentPhase()), 1);

        // Move to STARLIST
        blindBox.setPhase(LilStarBlindBox.MintPhase.STARLIST);
        assertEq(uint8(blindBox.currentPhase()), 2);

        // Move to FCFS
        blindBox.setPhase(LilStarBlindBox.MintPhase.FCFS);
        assertEq(uint8(blindBox.currentPhase()), 3);

        // Back to CLOSED
        blindBox.setPhase(LilStarBlindBox.MintPhase.CLOSED);
        assertEq(uint8(blindBox.currentPhase()), 0);
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
        LilStarBlindBox newBlindBox = new LilStarBlindBox(MAX_SUPPLY, payable(withdrawAddress));

        vm.expectRevert(LilStarContractNotSet.selector);
        newBlindBox.openRedeemBlindBoxState();
    }

    // ============
    // Withdraw
    // ============

    function test_Withdraw() public {
        // Setup and do a mint to get funds
        blindBox.setPhase(LilStarBlindBox.MintPhase.FCFS);

        vm.prank(alice);
        blindBox.fcfsMint{value: FCFS_PRICE * 2}(2);

        uint256 balanceBefore = withdrawAddress.balance;
        blindBox.withdraw();
        uint256 balanceAfter = withdrawAddress.balance;

        assertEq(balanceAfter - balanceBefore, FCFS_PRICE * 2);
    }

    // ============
    // Base URI
    // ============

    function test_SetBaseURI() public {
        string memory baseURI = "https://api.lilstar.com/blindbox/metadata/";
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
    // Admin Functions
    // ============

    function test_SetPrices() public {
        blindBox.setPrices(0.1 ether, 0.2 ether, 0.3 ether);

        assertEq(blindBox.presalePrice(), 0.1 ether);
        assertEq(blindBox.starlistPrice(), 0.2 ether);
        assertEq(blindBox.fcfsPrice(), 0.3 ether);
    }

    function test_SetMaxPerWallet() public {
        blindBox.setMaxPerWallet(10, 5, 3);

        assertEq(blindBox.maxPerWalletPresale(), 10);
        assertEq(blindBox.maxPerWalletStarlist(), 5);
        assertEq(blindBox.maxPerWalletFcfs(), 3);
    }

    // ============
    // Helpers
    // ============

    function _signMint(
        address minter,
        uint16 maxAllowed,
        string memory phase
    ) internal view returns (bytes memory) {
        bytes32 hash = keccak256(abi.encodePacked(minter, maxAllowed, phase));
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(offchainSignerPk, ethSignedHash);
        return abi.encodePacked(r, s, v);
    }
}
