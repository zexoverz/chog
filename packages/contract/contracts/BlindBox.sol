// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "erc721a/contracts/ERC721A.sol";
import "@openzeppelin/contracts/token/common/ERC2981.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "closedsea/src/OperatorFilterer.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error ChunkAlreadyProcessed();
error MismatchedArrays();
error MaxMintableSupplyReached();
error RedeemBlindBoxNotOpen();
error LilStarContractNotSet();
error ForceRedeemBlindBoxOwnerMismatch();
error RegistryNotSet();
error NotAllowedByRegistry();
error WithdrawFailed();
error InitialTransferLockOn();
error InsufficientFunds();
error InvalidSignature();
error OverMaxSupply();
error PhaseNotOpen();
error ExceedsMaxPerWallet();
error InvalidContractSetup();

interface ILilStarRedeemer {
    function redeemBlindBoxes(address to, uint256[] calldata blindBoxIds)
        external
        returns (uint256[] memory);
}

interface IRegistry {
    function isAllowedOperator(address operator) external view returns (bool);
}

/**
 * @title BlindBox
 * @notice Mystery box NFT that can be redeemed for LilStar NFTs
 *
 * Mint Phases (from mint-plan.md):
 * - Presale: $25 (1,800 reserved, signature required)
 * - Starlist (WL): $35 (signature required)
 * - FCFS (Public): $40 (open to all)
 */
contract BlindBox is ERC2981, Ownable, OperatorFilterer, ERC721A {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;
    using EnumerableSet for EnumerableSet.UintSet;

    event AirdroppedChunk(uint256 indexed chunkNum);
    event Minted(address indexed minter, uint8 phase, uint16 amount);

    // Airdrop chunk tracking
    EnumerableSet.UintSet private _processedChunksForAirdrop;

    // Transfer controls
    bool public operatorFilteringEnabled = true;
    bool public initialTransferLockOn = true;
    bool public isRegistryActive = false;
    address public registryAddress;

    // Supply tracking
    uint256 public immutable MAX_SUPPLY;
    uint256 public immutable MINTABLE_SUPPLY; // 3,756 per plan
    uint16 public totalMintableMinted;

    // Mint phases: 0=Closed, 1=Presale, 2=Starlist, 3=FCFS
    enum MintPhase { CLOSED, PRESALE, STARLIST, FCFS }
    MintPhase public currentPhase;

    // Prices (set in wei, e.g., for MON or ETH)
    uint64 public presalePrice;    // $25
    uint64 public starlistPrice;   // $35
    uint64 public fcfsPrice;       // $40

    // Max per wallet limits
    uint16 public maxPerWalletPresale = 5;
    uint16 public maxPerWalletStarlist = 3;
    uint16 public maxPerWalletFcfs = 2;

    // Track mints per wallet per phase
    mapping(address => uint16) public mintedInPresale;
    mapping(address => uint16) public mintedInStarlist;
    mapping(address => uint16) public mintedInFcfs;

    // Signature verification
    address private _offchainSigner;

    // Redeem to LilStar
    struct RedeemInfo {
        bool redeemBlindBoxOpen;
        address lilStarContract;
    }
    RedeemInfo public redeemInfo;

    string private _baseTokenURI;
    address payable public immutable WITHDRAW_ADDRESS;
    uint256 public constant MINT_BATCH_SIZE = 10;

    constructor(
        uint256 _maxSupply,
        uint256 _mintableSupply,
        address payable _withdrawAddress
    ) ERC721A("BlindBox", "BBOX") Ownable(msg.sender) {
        MAX_SUPPLY = _maxSupply;
        MINTABLE_SUPPLY = _mintableSupply;
        WITHDRAW_ADDRESS = _withdrawAddress;

        if (_mintableSupply >= _maxSupply)
            revert InvalidContractSetup();

        _registerForOperatorFiltering();
        operatorFilteringEnabled = true;
    }

    // ==================
    // Mint Functions
    // ==================

    /**
     * @notice Presale mint for whitelisted addresses ($25)
     * @param amount Number of NFTs to mint
     * @param maxAllowed Max allocation for this address (verified via signature)
     * @param signature Backend signature proving eligibility
     */
    function presaleMint(
        uint16 amount,
        uint16 maxAllowed,
        bytes calldata signature
    ) external payable {
        if (currentPhase != MintPhase.PRESALE) revert PhaseNotOpen();

        uint16 alreadyMinted = mintedInPresale[msg.sender];
        if (alreadyMinted + amount > maxAllowed) revert ExceedsMaxPerWallet();
        if (alreadyMinted + amount > maxPerWalletPresale) revert ExceedsMaxPerWallet();

        if (totalMintableMinted + amount > MINTABLE_SUPPLY)
            revert MaxMintableSupplyReached();
        if (_totalMinted() + amount > MAX_SUPPLY)
            revert OverMaxSupply();

        if (!_verifySignature(msg.sender, maxAllowed, "PRESALE", signature))
            revert InvalidSignature();

        uint256 totalCost = uint256(presalePrice) * amount;
        if (msg.value < totalCost) revert InsufficientFunds();

        mintedInPresale[msg.sender] = alreadyMinted + amount;
        totalMintableMinted += amount;

        _mint(msg.sender, amount);
        emit Minted(msg.sender, uint8(MintPhase.PRESALE), amount);
    }

    /**
     * @notice Starlist (whitelist) mint ($35)
     * @param amount Number of NFTs to mint
     * @param maxAllowed Max allocation for this address
     * @param signature Backend signature proving eligibility
     */
    function starlistMint(
        uint16 amount,
        uint16 maxAllowed,
        bytes calldata signature
    ) external payable {
        if (currentPhase != MintPhase.STARLIST) revert PhaseNotOpen();

        uint16 alreadyMinted = mintedInStarlist[msg.sender];
        if (alreadyMinted + amount > maxAllowed) revert ExceedsMaxPerWallet();
        if (alreadyMinted + amount > maxPerWalletStarlist) revert ExceedsMaxPerWallet();

        if (totalMintableMinted + amount > MINTABLE_SUPPLY)
            revert MaxMintableSupplyReached();
        if (_totalMinted() + amount > MAX_SUPPLY)
            revert OverMaxSupply();

        if (!_verifySignature(msg.sender, maxAllowed, "STARLIST", signature))
            revert InvalidSignature();

        uint256 totalCost = uint256(starlistPrice) * amount;
        if (msg.value < totalCost) revert InsufficientFunds();

        mintedInStarlist[msg.sender] = alreadyMinted + amount;
        totalMintableMinted += amount;

        _mint(msg.sender, amount);
        emit Minted(msg.sender, uint8(MintPhase.STARLIST), amount);
    }

    /**
     * @notice FCFS public mint ($40)
     * @param amount Number of NFTs to mint
     */
    function fcfsMint(uint16 amount) external payable {
        if (currentPhase != MintPhase.FCFS) revert PhaseNotOpen();

        uint16 alreadyMinted = mintedInFcfs[msg.sender];
        if (alreadyMinted + amount > maxPerWalletFcfs) revert ExceedsMaxPerWallet();

        if (totalMintableMinted + amount > MINTABLE_SUPPLY)
            revert MaxMintableSupplyReached();
        if (_totalMinted() + amount > MAX_SUPPLY)
            revert OverMaxSupply();

        uint256 totalCost = uint256(fcfsPrice) * amount;
        if (msg.value < totalCost) revert InsufficientFunds();

        mintedInFcfs[msg.sender] = alreadyMinted + amount;
        totalMintableMinted += amount;

        _mint(msg.sender, amount);
        emit Minted(msg.sender, uint8(MintPhase.FCFS), amount);
    }

    /**
     * @notice Verify signature from backend
     */
    function _verifySignature(
        address minter,
        uint16 maxAllowed,
        string memory phase,
        bytes memory signature
    ) private view returns (bool) {
        bytes32 hashVal = keccak256(
            abi.encodePacked(minter, maxAllowed, phase)
        );
        bytes32 signedHash = hashVal.toEthSignedMessageHash();
        address signingAddress = signedHash.recover(signature);
        return signingAddress == _offchainSigner;
    }

    // ==================
    // Admin: Phase Control
    // ==================

    function setPhase(MintPhase _phase) external onlyOwner {
        currentPhase = _phase;
    }

    function setPrices(
        uint64 _presalePrice,
        uint64 _starlistPrice,
        uint64 _fcfsPrice
    ) external onlyOwner {
        presalePrice = _presalePrice;
        starlistPrice = _starlistPrice;
        fcfsPrice = _fcfsPrice;
    }

    function setMaxPerWallet(
        uint16 _presale,
        uint16 _starlist,
        uint16 _fcfs
    ) external onlyOwner {
        maxPerWalletPresale = _presale;
        maxPerWalletStarlist = _starlist;
        maxPerWalletFcfs = _fcfs;
    }

    function setOffchainSigner(address signer) external onlyOwner {
        _offchainSigner = signer;
    }

    // ==================
    // Admin: Privileged Mint (Team/Airdrop)
    // ==================

    function airdrop(
        address[] calldata receivers,
        uint256[] calldata amounts,
        uint256 chunkNum
    ) external onlyOwner {
        if (_processedChunksForAirdrop.contains(chunkNum))
            revert ChunkAlreadyProcessed();
        _processedChunksForAirdrop.add(chunkNum);
        privilegedMint(receivers, amounts);
        emit AirdroppedChunk(chunkNum);
    }

    function privilegedMint(
        address[] calldata receivers,
        uint256[] calldata amounts
    ) public onlyOwner {
        if (receivers.length != amounts.length || receivers.length == 0)
            revert MismatchedArrays();
        for (uint256 i; i < receivers.length; ) {
            _mint(receivers[i], amounts[i]);
            unchecked { ++i; }
        }
        if (_totalMinted() > MAX_SUPPLY) {
            revert OverMaxSupply();
        }
    }

    // ==================
    // Redeem BlindBox -> LilStar
    // ==================

    function redeemBlindBoxes(uint256[] calldata blindBoxIds)
        external
        returns (uint256[] memory)
    {
        RedeemInfo memory info = redeemInfo;
        if (!info.redeemBlindBoxOpen) revert RedeemBlindBoxNotOpen();

        for (uint256 i; i < blindBoxIds.length; ) {
            _burn(blindBoxIds[i], true);
            unchecked { ++i; }
        }
        return ILilStarRedeemer(info.lilStarContract).redeemBlindBoxes(msg.sender, blindBoxIds);
    }

    function forceRedeemBlindBoxes(address blindBoxOwner, uint256[] calldata blindBoxIds)
        external
        onlyOwner
        returns (uint256[] memory)
    {
        for (uint256 i; i < blindBoxIds.length; ) {
            if (ownerOf(blindBoxIds[i]) != blindBoxOwner)
                revert ForceRedeemBlindBoxOwnerMismatch();
            _burn(blindBoxIds[i], false);
            unchecked { ++i; }
        }
        return ILilStarRedeemer(redeemInfo.lilStarContract).redeemBlindBoxes(blindBoxOwner, blindBoxIds);
    }

    function openRedeemBlindBoxState() external onlyOwner {
        if (redeemInfo.lilStarContract == address(0))
            revert LilStarContractNotSet();
        redeemInfo.redeemBlindBoxOpen = true;
    }

    function setLilStarContract(address contractAddress) external onlyOwner {
        redeemInfo.lilStarContract = contractAddress;
    }

    // ==================
    // Withdraw
    // ==================

    function withdraw() external {
        (bool sent, ) = WITHDRAW_ADDRESS.call{value: address(this).balance}("");
        if (!sent) revert WithdrawFailed();
    }

    // ==================
    // Transfer Lock
    // ==================

    function breakTransferLock() external onlyOwner {
        initialTransferLockOn = false;
    }

    // ==================
    // Metadata
    // ==================

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function setBaseURI(string calldata baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }

    // ==================
    // EIP-2981 Royalties
    // ==================

    function setDefaultRoyalty(address receiver, uint96 feeNumerator)
        external
        onlyOwner
    {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyOwner {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
    }

    // ==================
    // Operator Filtering
    // ==================

    function setApprovalForAll(address operator, bool approved)
        public
        override(ERC721A)
        onlyAllowedOperatorApproval(operator)
    {
        if (initialTransferLockOn) revert InitialTransferLockOn();
        super.setApprovalForAll(operator, approved);
    }

    function setOperatorFilteringEnabled(bool value) public onlyOwner {
        operatorFilteringEnabled = value;
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return operatorFilteringEnabled;
    }

    function approve(address operator, uint256 tokenId)
        public
        payable
        override(ERC721A)
        onlyAllowedOperatorApproval(operator)
    {
        if (initialTransferLockOn) revert InitialTransferLockOn();
        super.approve(operator, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public payable override(ERC721A) onlyAllowedOperator(from) {
        super.transferFrom(from, to, tokenId);
    }

    // ==================
    // Registry Check
    // ==================

    function _beforeTokenTransfers(
        address from,
        address to,
        uint256 startTokenId,
        uint256 quantity
    ) internal override {
        if (initialTransferLockOn && from != address(0) && to != address(0))
            revert InitialTransferLockOn();
        if (_isValidAgainstRegistry(msg.sender)) {
            super._beforeTokenTransfers(from, to, startTokenId, quantity);
        } else {
            revert NotAllowedByRegistry();
        }
    }

    function _isValidAgainstRegistry(address operator)
        internal
        view
        returns (bool)
    {
        if (isRegistryActive) {
            IRegistry registry = IRegistry(registryAddress);
            return registry.isAllowedOperator(operator);
        }
        return true;
    }

    function setIsRegistryActive(bool _isRegistryActive) external onlyOwner {
        if (registryAddress == address(0)) revert RegistryNotSet();
        isRegistryActive = _isRegistryActive;
    }

    function setRegistryAddress(address _registryAddress) external onlyOwner {
        registryAddress = _registryAddress;
    }

    // ==================
    // EIP-165
    // ==================

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721A, ERC2981)
        returns (bool)
    {
        return
            ERC721A.supportsInterface(interfaceId) ||
            ERC2981.supportsInterface(interfaceId);
    }
}
