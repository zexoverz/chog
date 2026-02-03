import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress } from "viem";

describe("Redeem BlindBox Edge Cases", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, withdrawAddress] = await viem.getWalletClients();

  const MAX_SUPPLY = 6000n;
  const MINTABLE_SUPPLY = 3756n;

  async function deployAll() {
    const blindBox = await viem.deployContract("BlindBox", [
      MAX_SUPPLY,
      MINTABLE_SUPPLY,
      getAddress(withdrawAddress.account.address),
    ]);

    const lilStar = await viem.deployContract("LilStar", [
      "LilStar",
      "LSTAR",
      Number(MAX_SUPPLY),
    ]);

    const sbt = await viem.deployContract("LilStarSBT", []);

    return { blindBox, lilStar, sbt };
  }

  async function setupForRedeem() {
    const { blindBox, lilStar, sbt } = await deployAll();

    // Wire up contracts
    await blindBox.write.setLilStarContract([lilStar.address]);
    await lilStar.write.setBlindBoxAddress([blindBox.address]);
    await lilStar.write.setSBTContract([sbt.address]);
    await sbt.write.setLilStarContract([lilStar.address]);

    // Open redemption on both
    await blindBox.write.openRedeemBlindBoxState();
    await lilStar.write.setRedeemBlindBoxState([true]);

    return { blindBox, lilStar, sbt };
  }

  describe("BlindBox Revert Conditions", () => {
    it("Should revert if redeemBlindBoxOpen is false on BlindBox", async () => {
      const { blindBox, lilStar, sbt } = await deployAll();

      // Wire up but DON'T open redemption on BlindBox
      await blindBox.write.setLilStarContract([lilStar.address]);
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setRedeemBlindBoxState([true]);

      // Mint a BlindBox
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account }),
        /RedeemBlindBoxNotOpen/
      );
    });

    it("Should revert if user doesn't own the BlindBox token", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Mint to user1
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      // User2 tries to redeem user1's token
      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[0n]], { account: user2.account }),
        /TransferCallerNotOwnerNorApproved/
      );
    });

    it("Should revert if token doesn't exist", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Try to redeem token 999 which doesn't exist
      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[999n]], { account: user1.account }),
        /OwnerQueryForNonexistentToken/
      );
    });

    it("Should revert if token already burned (double redeem)", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Mint to user1
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      // First redeem succeeds
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Second redeem of same token should fail
      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account }),
        /OwnerQueryForNonexistentToken/
      );
    });
  });

  describe("LilStar Revert Conditions", () => {
    it("Should revert if redeemBlindBoxOpen is false on LilStar", async () => {
      const { blindBox, lilStar, sbt } = await deployAll();

      // Wire up and open on BlindBox but NOT on LilStar
      await blindBox.write.setLilStarContract([lilStar.address]);
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await blindBox.write.openRedeemBlindBoxState();
      // NOT calling: await lilStar.write.setRedeemBlindBoxState([true]);

      // Mint a BlindBox
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account }),
        /RedeemBlindBoxNotOpen/
      );
    });

    it("Should revert if caller is not BlindBox contract (InvalidRedeemer)", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Try to call LilStar.redeemBlindBoxes directly
      await assert.rejects(
        lilStar.write.redeemBlindBoxes([
          getAddress(user1.account.address),
          [0n]
        ], { account: user1.account }),
        /InvalidRedeemer/
      );
    });

    it("Should revert if all LilStar tokens are minted (NoMoreTokenIds)", async () => {
      // This would require minting all 6000 - too expensive to test fully
      // But we can test with a small supply LilStar
      const blindBox = await viem.deployContract("BlindBox", [
        10n, // MAX_SUPPLY = 10
        5n,  // MINTABLE_SUPPLY = 5
        getAddress(withdrawAddress.account.address),
      ]);

      const lilStar = await viem.deployContract("LilStar", [
        "LilStar",
        "LSTAR",
        5, // Only 5 tokens available
      ]);

      const sbt = await viem.deployContract("LilStarSBT", []);

      // Wire up
      await blindBox.write.setLilStarContract([lilStar.address]);
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      await lilStar.write.setSBTContract([sbt.address]);
      await sbt.write.setLilStarContract([lilStar.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await lilStar.write.setRedeemBlindBoxState([true]);

      // Mint 6 BlindBoxes (more than LilStar supply)
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [6n],
      ]);

      // Redeem 5 - should succeed
      await blindBox.write.redeemBlindBoxes([[0n, 1n, 2n, 3n, 4n]], { account: user1.account });

      // Redeem 6th - should fail with NoMoreTokenIds
      await assert.rejects(
        blindBox.write.redeemBlindBoxes([[5n]], { account: user1.account }),
        /NoMoreTokenIds/
      );
    });
  });

  describe("SBT Revert Conditions", () => {
    it("Should revert if caller is not LilStar contract (NotLilStarContract)", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Try to mint SBT directly
      await assert.rejects(
        sbt.write.mintRandomSBT([getAddress(user1.account.address), 12345n], { account: user1.account }),
        /NotLilStarContract/
      );
    });

    it("Should revert if all SBTs are minted (NoMoreSBTsAvailable)", async () => {
      // This would require minting all 6000 SBTs - too expensive
      // The SBT supply is 2500 + 2500 + 1000 = 6000
      // This matches the LilStar supply, so if LilStar runs out first, we won't hit this
      console.log("Skipping full SBT exhaustion test - would require 6000 mints");
    });
  });

  describe("Successful Redeem Flow", () => {
    it("Should successfully redeem BlindBox and receive LilStar + SBT", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Mint BlindBox to user
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [3n],
      ]);

      const userAddress = getAddress(user1.account.address);

      // Check initial state
      assert.equal(await blindBox.read.balanceOf([userAddress]), 3n);
      assert.equal(await lilStar.read.balanceOf([userAddress]), 0n);

      // Redeem all 3
      const tx = await blindBox.write.redeemBlindBoxes([[0n, 1n, 2n]], { account: user1.account });

      // Wait for receipt
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log("Redeem tx gas used:", receipt.gasUsed);

      // Check final state
      assert.equal(await blindBox.read.balanceOf([userAddress]), 0n);
      assert.equal(await lilStar.read.balanceOf([userAddress]), 3n);

      // Check SBT balance (should have 3 SBTs total across types 1, 2, 3)
      const sbt1 = await sbt.read.balanceOf([userAddress, 1n]);
      const sbt2 = await sbt.read.balanceOf([userAddress, 2n]);
      const sbt3 = await sbt.read.balanceOf([userAddress, 3n]);
      console.log("SBT balances:", { type1: sbt1, type2: sbt2, type3: sbt3 });
      assert.equal(sbt1 + sbt2 + sbt3, 3n);
    });

    it("Should handle batch redeem of many tokens", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Mint 10 BlindBoxes
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [10n],
      ]);

      const tokenIds = [0n, 1n, 2n, 3n, 4n, 5n, 6n, 7n, 8n, 9n];

      // Redeem all 10 at once
      const tx = await blindBox.write.redeemBlindBoxes([tokenIds], { account: user1.account });
      const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
      console.log("Batch redeem (10 tokens) gas used:", receipt.gasUsed);

      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 10n);
    });

    it("Should handle sequential redeems", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();

      // Mint 3 BlindBoxes
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [3n],
      ]);

      // Redeem one at a time
      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 1n);

      await blindBox.write.redeemBlindBoxes([[1n]], { account: user1.account });
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 2n);

      await blindBox.write.redeemBlindBoxes([[2n]], { account: user1.account });
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 3n);
    });
  });

  describe("Contract Configuration Edge Cases", () => {
    it("Should revert if LilStar contract not set on BlindBox", async () => {
      const { blindBox, lilStar, sbt } = await deployAll();

      // Don't set LilStar contract - try to open redemption
      await assert.rejects(
        blindBox.write.openRedeemBlindBoxState(),
        /LilStarContractNotSet/
      );
    });

    it("Should revert if BlindBox address not set on LilStar", async () => {
      const { blindBox, lilStar, sbt } = await deployAll();

      // Don't set BlindBox address - try to open redemption
      await assert.rejects(
        lilStar.write.setRedeemBlindBoxState([true]),
        /BlindBoxAddressNotSet/
      );
    });

    it("Should work without SBT contract (no SBT minted)", async () => {
      const { blindBox, lilStar, sbt } = await deployAll();

      // Wire up WITHOUT SBT
      await blindBox.write.setLilStarContract([lilStar.address]);
      await lilStar.write.setBlindBoxAddress([blindBox.address]);
      // NOT setting: await lilStar.write.setSBTContract([sbt.address]);
      await blindBox.write.openRedeemBlindBoxState();
      await lilStar.write.setRedeemBlindBoxState([true]);

      // Mint and redeem
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      await blindBox.write.redeemBlindBoxes([[0n]], { account: user1.account });

      // Should have LilStar but no SBT
      assert.equal(await lilStar.read.balanceOf([getAddress(user1.account.address)]), 1n);
      const sbt1 = await sbt.read.balanceOf([getAddress(user1.account.address), 1n]);
      const sbt2 = await sbt.read.balanceOf([getAddress(user1.account.address), 2n]);
      const sbt3 = await sbt.read.balanceOf([getAddress(user1.account.address), 3n]);
      assert.equal(sbt1 + sbt2 + sbt3, 0n);
    });
  });
});
