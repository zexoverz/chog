import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress } from "viem";

describe("LilStar", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, blindBoxMock] = await viem.getWalletClients();

  const MAX_SUPPLY = 6000;

  async function deployLilStar() {
    const lilStar = await viem.deployContract("LilStar", [
      "LilStar",
      "LSTAR",
      MAX_SUPPLY,
    ]);
    return lilStar;
  }

  async function deployBlindBox() {
    const blindBox = await viem.deployContract("LilStarBlindBox", [
      BigInt(MAX_SUPPLY),
      getAddress(deployer.account.address),
    ]);
    return blindBox;
  }

  describe("Deployment", () => {
    it("Should deploy with correct parameters", async () => {
      const lilStar = await deployLilStar();

      assert.equal(Number(await lilStar.read.MAX_SUPPLY()), MAX_SUPPLY);
      assert.equal(await lilStar.read.name(), "LilStar");
      assert.equal(await lilStar.read.symbol(), "LSTAR");
    });

    it("Should set deployer as owner", async () => {
      const lilStar = await deployLilStar();
      assert.equal(await lilStar.read.owner(), getAddress(deployer.account.address));
    });

    it("Should have correct initial total supply", async () => {
      const lilStar = await deployLilStar();
      assert.equal(await lilStar.read.totalSupply(), 0n);
    });
  });

  describe("Name and Symbol", () => {
    it("Should allow owner to change name and symbol", async () => {
      const lilStar = await deployLilStar();

      await lilStar.write.setNameAndSymbol(["NewName", "NNFT"]);

      assert.equal(await lilStar.read.name(), "NewName");
      assert.equal(await lilStar.read.symbol(), "NNFT");
    });

    it("Should revert if non-owner tries to change name", async () => {
      const lilStar = await deployLilStar();

      await assert.rejects(
        lilStar.write.setNameAndSymbol(["NewName", "NNFT"], { account: user1.account }),
        /OwnableUnauthorizedAccount/
      );
    });
  });

  describe("BlindBox Address", () => {
    it("Should allow owner to set BlindBox address", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      await lilStar.write.setBlindBoxAddress([blindBox.address]);

      const redeemInfo = await lilStar.read.redeemInfo();
      assert.equal(getAddress(redeemInfo[1]), getAddress(blindBox.address));
    });

    it("Should revert setting redeem state without BlindBox address", async () => {
      const lilStar = await deployLilStar();

      await assert.rejects(
        lilStar.write.setRedeemBlindBoxState([true]),
        /BlindBoxAddressNotSet/
      );
    });
  });

  describe("Redeem BlindBoxes", () => {
    it("Should mint LilStar when BlindBox calls redeem", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      // Setup
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();

      // Mint BlindBox to user
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [3n],
      ]);

      // Break transfer lock
      await blindBox.write.breakTransferLock();

      // Redeem BlindBoxes
      await blindBox.write.redeemBlindBoxes([[0n, 1n, 2n]], { account: user1.account });

      // Check LilStar balance
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 3n);
      assert.equal(await lilStar.read.totalSupply(), 3n);
    });

    it("Should emit BlindBoxRedeemed events", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      // Setup
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();

      // Mint BlindBox to user
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      // Break transfer lock
      await blindBox.write.breakTransferLock();

      const blockBefore = await publicClient.getBlockNumber();

      // Redeem BlindBox
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Check events
      const events = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: blockBefore,
        strict: true,
      });

      assert.equal(events.length, 1);
      assert.equal(events[0].args.to, getAddress(user1.account.address));
      assert.equal(events[0].args.blindBoxId, 0n);
    });

    it("Should revert if redeem not open", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      // Not opening redeem state

      await assert.rejects(
        lilStar.write.redeemBlindBoxes([
          getAddress(user1.account.address),
          [0n],
        ], { account: blindBoxMock.account }),
        /RedeemBlindBoxNotOpen/
      );
    });

    it("Should revert if caller is not BlindBox contract", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      // Try to call from non-BlindBox address
      await assert.rejects(
        lilStar.write.redeemBlindBoxes([
          getAddress(user1.account.address),
          [0n],
        ], { account: user1.account }),
        /InvalidRedeemer/
      );
    });

    it("Should assign random token IDs", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      // Setup
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();

      // Mint multiple BlindBoxes
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [10n],
      ]);

      // Break transfer lock
      await blindBox.write.breakTransferLock();

      // Redeem all
      await blindBox.write.redeemBlindBoxes([[0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n]], { account: user1.account });

      // Token IDs should be assigned (we can't predict them, but they should exist)
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 10n);
    });
  });

  describe("Base URI", () => {
    it("Should allow owner to set base URI", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();
      const baseURI = "https://api.lilstar.com/metadata/";

      await lilStar.write.setBaseURI([baseURI]);

      // Setup and mint via redemption
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);
      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);
      await blindBox.write.breakTransferLock();
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Get minted token ID from events
      const events = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: 0n,
        strict: true,
      });

      const tokenId = events[0].args.tokenId;
      const tokenURI = await lilStar.read.tokenURI([tokenId]);
      assert.equal(tokenURI, `${baseURI}${tokenId}`);
    });

    it("Should support permanent URI for specific tokens", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();
      const baseURI = "https://api.lilstar.com/metadata/";
      const permanentURI = "https://api.lilstar.com/permanent/";

      await lilStar.write.setBaseURI([baseURI]);
      await lilStar.write.setBaseURIPermanent([permanentURI]);

      // Setup and mint
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);
      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);
      await blindBox.write.breakTransferLock();
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Get minted token ID
      const events = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: 0n,
        strict: true,
      });

      const tokenId = events[0].args.tokenId;

      // Set token as permanent
      await lilStar.write.setIsUriPermanent([[tokenId]]);

      const tokenURI = await lilStar.read.tokenURI([tokenId]);
      assert.equal(tokenURI, `${permanentURI}${tokenId}`);
    });
  });

  describe("Transfers", () => {
    it("Should allow transfers", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();

      // Setup and mint
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);
      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);
      await blindBox.write.breakTransferLock();
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Get minted token ID
      const events = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: 0n,
        strict: true,
      });

      const tokenId = events[0].args.tokenId;

      // Transfer
      await lilStar.write.transferFrom([
        getAddress(user1.account.address),
        getAddress(user2.account.address),
        tokenId,
      ], { account: user1.account });

      assert.equal(await lilStar.read.ownerOf([tokenId]), getAddress(user2.account.address));
    });
  });

  describe("Royalties (EIP-2981)", () => {
    it("Should set default royalty", async () => {
      const lilStar = await deployLilStar();
      const blindBox = await deployBlindBox();
      const royaltyReceiver = getAddress(user2.account.address);
      const feeNumerator = 750n; // 7.5%

      await lilStar.write.setDefaultRoyalty([royaltyReceiver, feeNumerator]);

      // Mint a token
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);
      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);
      await blindBox.write.breakTransferLock();
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Get minted token ID
      const events = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: 0n,
        strict: true,
      });

      const tokenId = events[0].args.tokenId;

      const [receiver, amount] = await lilStar.read.royaltyInfo([tokenId, parseEther("1")]);
      assert.equal(receiver, royaltyReceiver);
      assert.equal(amount, parseEther("0.075"));
    });
  });

  describe("EIP-165 Support", () => {
    it("Should support ERC721 interface", async () => {
      const lilStar = await deployLilStar();
      // ERC721 interface ID: 0x80ac58cd
      assert.equal(await lilStar.read.supportsInterface(["0x80ac58cd"]), true);
    });

    it("Should support ERC2981 interface", async () => {
      const lilStar = await deployLilStar();
      // ERC2981 interface ID: 0x2a55205a
      assert.equal(await lilStar.read.supportsInterface(["0x2a55205a"]), true);
    });
  });
});
