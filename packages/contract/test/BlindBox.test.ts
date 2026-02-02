import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { network } from "hardhat";
import { parseEther, getAddress, keccak256, encodePacked, toBytes, Hex } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

describe("BlindBox", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, withdrawAddress] = await viem.getWalletClients();

  const MAX_SUPPLY = 6000n;
  const TOTAL_PRESALE_AND_AUCTION_SUPPLY = 3756n;

  async function deployBlindBox() {
    const blindBox = await viem.deployContract("BlindBox", [
      MAX_SUPPLY,
      TOTAL_PRESALE_AND_AUCTION_SUPPLY,
      getAddress(withdrawAddress.account.address),
    ]);
    return blindBox;
  }

  async function deployLilStar() {
    const lilStar = await viem.deployContract("LilStar", [
      "LilStar",
      "LSTAR",
      Number(MAX_SUPPLY),
    ]);
    return lilStar;
  }

  describe("Deployment", () => {
    it("Should deploy with correct parameters", async () => {
      const blindBox = await deployBlindBox();

      assert.equal(await blindBox.read.MAX_SUPPLY(), MAX_SUPPLY);
      assert.equal(await blindBox.read.TOTAL_PRESALE_AND_AUCTION_SUPPLY(), TOTAL_PRESALE_AND_AUCTION_SUPPLY);
      assert.equal(await blindBox.read.WITHDRAW_ADDRESS(), getAddress(withdrawAddress.account.address));
      assert.equal(await blindBox.read.name(), "BlindBox");
      assert.equal(await blindBox.read.symbol(), "BBOX");
    });

    it("Should set deployer as owner", async () => {
      const blindBox = await deployBlindBox();
      assert.equal(await blindBox.read.owner(), getAddress(deployer.account.address));
    });

    it("Should have transfer lock enabled by default", async () => {
      const blindBox = await deployBlindBox();
      assert.equal(await blindBox.read.initialTransferLockOn(), true);
    });

    it("Should revert if presale supply >= max supply", async () => {
      await assert.rejects(
        viem.deployContract("BlindBox", [
          1000n,
          1000n, // equal to max supply
          getAddress(withdrawAddress.account.address),
        ]),
        /InvalidContractSetup/
      );
    });
  });

  describe("Airdrop", () => {
    it("Should allow owner to airdrop tokens", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.airdrop([
        [getAddress(user1.account.address)],
        [5n],
        1n, // chunk number
      ]);

      assert.equal(await blindBox.read.balanceOf([getAddress(user1.account.address)]), 5n);
    });

    it("Should emit AirdroppedChunk event", async () => {
      const blindBox = await deployBlindBox();

      await viem.assertions.emitWithArgs(
        blindBox.write.airdrop([
          [getAddress(user1.account.address)],
          [5n],
          1n,
        ]),
        blindBox,
        "AirdroppedChunk",
        [1n]
      );
    });

    it("Should revert if chunk already processed", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.airdrop([
        [getAddress(user1.account.address)],
        [5n],
        1n,
      ]);

      await assert.rejects(
        blindBox.write.airdrop([
          [getAddress(user2.account.address)],
          [5n],
          1n, // same chunk number
        ]),
        /ChunkAlreadyProcessed/
      );
    });

    it("Should revert if non-owner tries to airdrop", async () => {
      const blindBox = await deployBlindBox();

      await assert.rejects(
        blindBox.write.airdrop([
          [getAddress(user1.account.address)],
          [5n],
          1n,
        ], { account: user1.account }),
        /OwnableUnauthorizedAccount/
      );
    });
  });

  describe("Privileged Mint", () => {
    it("Should allow owner to privileged mint to multiple addresses", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address), getAddress(user2.account.address)],
        [10n, 20n],
      ]);

      assert.equal(await blindBox.read.balanceOf([getAddress(user1.account.address)]), 10n);
      assert.equal(await blindBox.read.balanceOf([getAddress(user2.account.address)]), 20n);
    });

    it("Should revert on mismatched arrays", async () => {
      const blindBox = await deployBlindBox();

      await assert.rejects(
        blindBox.write.privilegedMint([
          [getAddress(user1.account.address)],
          [10n, 20n], // mismatched length
        ]),
        /MismatchedArrays/
      );
    });
  });

  describe("Allowlist Mint", () => {
    it("Should allow allowlisted users to mint", async () => {
      const blindBox = await deployBlindBox();
      const mintPrice = parseEther("0.01");

      // Set allowlist allocation and price
      await blindBox.write.setAllowlistMintsAlloc([
        [getAddress(user1.account.address)],
        [3n],
      ]);
      await blindBox.write.setAllowlistMintPrice([mintPrice]);

      // Break transfer lock for testing
      await blindBox.write.breakTransferLock();

      // Mint
      await blindBox.write.allowlistMint([], {
        account: user1.account,
        value: mintPrice * 3n,
      });

      assert.equal(await blindBox.read.balanceOf([getAddress(user1.account.address)]), 3n);
    });

    it("Should revert if allowlist mint not open", async () => {
      const blindBox = await deployBlindBox();

      await assert.rejects(
        blindBox.write.allowlistMint([], {
          account: user1.account,
          value: parseEther("0.1"),
        }),
        /AllowlistMintNotOpen/
      );
    });

    it("Should revert if insufficient funds", async () => {
      const blindBox = await deployBlindBox();
      const mintPrice = parseEther("0.01");

      await blindBox.write.setAllowlistMintsAlloc([
        [getAddress(user1.account.address)],
        [3n],
      ]);
      await blindBox.write.setAllowlistMintPrice([mintPrice]);

      await assert.rejects(
        blindBox.write.allowlistMint([], {
          account: user1.account,
          value: mintPrice, // only enough for 1, but allocated 3
        }),
        /InsufficientFunds/
      );
    });
  });

  describe("Transfer Lock", () => {
    it("Should prevent transfers when lock is on", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await assert.rejects(
        blindBox.write.transferFrom([
          getAddress(user1.account.address),
          getAddress(user2.account.address),
          0n,
        ], { account: user1.account }),
        /InitialTransferLockOn/
      );
    });

    it("Should allow transfers after lock is broken", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await blindBox.write.breakTransferLock();

      await blindBox.write.transferFrom([
        getAddress(user1.account.address),
        getAddress(user2.account.address),
        0n,
      ], { account: user1.account });

      assert.equal(await blindBox.read.ownerOf([0n]), getAddress(user2.account.address));
    });
  });

  describe("Redeem BlindBox", () => {
    it("Should redeem BlindBox for LilStar", async () => {
      const blindBox = await deployBlindBox();
      const lilStar = await deployLilStar();

      // Setup: mint BlindBox, set LilStar contract, open redemption
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [2n],
      ]);

      await blindBox.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();

      // Setup LilStar to accept redemptions
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      // Break transfer lock
      await blindBox.write.breakTransferLock();

      // Redeem
      await blindBox.write.redeemBlindBoxes([[0n, 1n]], { account: user1.account });

      // BlindBoxes should be burned
      assert.equal(await blindBox.read.balanceOf([getAddress(user1.account.address)]), 0n);

      // User should have LilStars
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 2n);
    });

    it("Should revert if redemption not open", async () => {
      const blindBox = await deployBlindBox();

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account }),
        /RedeemBlindBoxNotOpen/
      );
    });

    it("Should revert opening redemption if LilStar contract not set", async () => {
      const blindBox = await deployBlindBox();

      await assert.rejects(
        blindBox.write.openRedeemBlindBoxState(),
        /LilStarContractNotSet/
      );
    });
  });

  describe("Withdraw", () => {
    it("Should withdraw funds to withdraw address", async () => {
      const blindBox = await deployBlindBox();
      const mintPrice = parseEther("0.01");

      // Setup and mint to get funds in contract
      await blindBox.write.setAllowlistMintsAlloc([
        [getAddress(user1.account.address)],
        [1n],
      ]);
      await blindBox.write.setAllowlistMintPrice([mintPrice]);
      await blindBox.write.allowlistMint([], {
        account: user1.account,
        value: mintPrice,
      });

      const balanceBefore = await publicClient.getBalance({
        address: getAddress(withdrawAddress.account.address),
      });

      await blindBox.write.withdraw();

      const balanceAfter = await publicClient.getBalance({
        address: getAddress(withdrawAddress.account.address),
      });

      assert.equal(balanceAfter - balanceBefore, mintPrice);
    });
  });

  describe("Base URI", () => {
    it("Should allow owner to set base URI", async () => {
      const blindBox = await deployBlindBox();
      const baseURI = "https://api.lilstar.com/blindbox/";

      await blindBox.write.setBaseURI([baseURI]);

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      const tokenURI = await blindBox.read.tokenURI([0n]);
      assert.equal(tokenURI, `${baseURI}0`);
    });
  });

  describe("Royalties (EIP-2981)", () => {
    it("Should set default royalty", async () => {
      const blindBox = await deployBlindBox();
      const royaltyReceiver = getAddress(user1.account.address);
      const feeNumerator = 500n; // 5%

      await blindBox.write.setDefaultRoyalty([royaltyReceiver, feeNumerator]);

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      const [receiver, amount] = await blindBox.read.royaltyInfo([0n, parseEther("1")]);
      assert.equal(receiver, royaltyReceiver);
      assert.equal(amount, parseEther("0.05"));
    });
  });
});
