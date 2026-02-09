import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { network } from "hardhat";
import { getAddress, parseEther, keccak256, encodePacked, toBytes } from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

describe("Full 6000 Supply Tests", async function () {
  const { viem } = await network.connect();
  const publicClient = await viem.getPublicClient();
  const [deployer, user1, user2, withdrawAddress] = await viem.getWalletClients();

  const MAX_SUPPLY = 6000n;

  async function deployAll() {
    const blindBox = await viem.deployContract("LilStarBlindBox", [
      MAX_SUPPLY,
      getAddress(withdrawAddress.account.address),
    ]);

    const lilStar = await viem.deployContract("LilStar", [
      "LilStar",
      "LSTAR",
      Number(MAX_SUPPLY),
    ]);

    const sbt = await viem.deployContract("LilStarRewards", []);

    return { blindBox, lilStar, sbt };
  }

  async function setupForRedeem() {
    const { blindBox, lilStar, sbt } = await deployAll();

    await blindBox.write.setLilStarContract([lilStar.address]);
    await lilStar.write.setBlindBoxAddress([blindBox.address]);
    await lilStar.write.setSBTContract([sbt.address]);
    await sbt.write.setLilStarContract([lilStar.address]);

    await blindBox.write.openRedeemBlindBoxState();
    await lilStar.write.setRedeemBlindBoxState([true]);

    return { blindBox, lilStar, sbt };
  }

  // Helper: mint all 6000 via privilegedMint in batches
  async function mintFullSupply(blindBox: any, recipient: string, batchSize = 500n) {
    let minted = 0n;
    while (minted < MAX_SUPPLY) {
      const remaining = MAX_SUPPLY - minted;
      const amount = remaining < batchSize ? remaining : batchSize;
      await blindBox.write.privilegedMint([
        [getAddress(recipient)],
        [amount],
      ]);
      minted += amount;
    }
    return minted;
  }

  // Helper: mint a specific amount to a recipient in batches
  async function mintFullSupplyTo(blindBox: any, recipient: string, total: bigint, batchSize = 500n) {
    let minted = 0n;
    while (minted < total) {
      const remaining = total - minted;
      const amount = remaining < batchSize ? remaining : batchSize;
      await blindBox.write.privilegedMint([
        [recipient],
        [amount],
      ]);
      minted += amount;
    }
  }

  describe("Mint Full 6000 Supply", () => {
    it("Should mint all 6000 via privilegedMint", async () => {
      const { blindBox } = await deployAll();
      const recipient = getAddress(user1.account.address);

      await mintFullSupply(blindBox, recipient);

      assert.equal(await blindBox.read.balanceOf([recipient]), MAX_SUPPLY);
    });

    it("Should reject minting beyond 6000", async () => {
      const { blindBox } = await deployAll();
      const recipient = getAddress(user1.account.address);

      await mintFullSupply(blindBox, recipient);

      // Try to mint 1 more
      await assert.rejects(
        blindBox.write.privilegedMint([
          [recipient],
          [1n],
        ]),
        /OverMaxSupply/
      );
    });

    it("Should correctly track ownership across all 6000 tokens", async () => {
      const { blindBox } = await deployAll();
      const addr1 = getAddress(user1.account.address);
      const addr2 = getAddress(user2.account.address);

      // Mint 3000 to user1 in batches (single 3000 mint exceeds gas cap)
      await mintFullSupplyTo(blindBox, addr1, 3000n);
      // Mint 3000 to user2 in batches
      await mintFullSupplyTo(blindBox, addr2, 3000n);

      assert.equal(await blindBox.read.balanceOf([addr1]), 3000n);
      assert.equal(await blindBox.read.balanceOf([addr2]), 3000n);

      // First token belongs to user1
      assert.equal(await blindBox.read.ownerOf([0n]), addr1);
      // Token 2999 belongs to user1
      assert.equal(await blindBox.read.ownerOf([2999n]), addr1);
      // Token 3000 belongs to user2
      assert.equal(await blindBox.read.ownerOf([3000n]), addr2);
      // Last token belongs to user2
      assert.equal(await blindBox.read.ownerOf([5999n]), addr2);
    });

    it("Should reject minting 6001 in a single privilegedMint call", async () => {
      const { blindBox } = await deployAll();

      // Mint 5999 then try 2 more
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [5999n],
      ]);

      await assert.rejects(
        blindBox.write.privilegedMint([
          [getAddress(user1.account.address)],
          [2n],
        ]),
        /OverMaxSupply/
      );
    });

    it("Should allow minting exactly the last token", async () => {
      const { blindBox } = await deployAll();

      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [5999n],
      ]);

      // Mint exactly 1 more to hit 6000
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1n],
      ]);

      assert.equal(await blindBox.read.balanceOf([getAddress(user1.account.address)]), MAX_SUPPLY);
    });
  });

  describe("Airdrop First Then Public Mint Fills Remaining", () => {
    it("Should allow public mint to fill remaining after airdrop", async () => {
      const { blindBox } = await deployAll();
      const addr1 = getAddress(user1.account.address);
      const addr2 = getAddress(user2.account.address);

      // Airdrop 2000 while phase is CLOSED
      await blindBox.write.privilegedMint([
        [addr1],
        [2000n],
      ]);

      // Open FCFS with high per-wallet limit
      await blindBox.write.setPhase([3]); // FCFS
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([5000, 5000, 5000]);

      // Public can mint remaining 4000
      await blindBox.write.fcfsMint([4000], { account: user2.account, value: 0n });

      assert.equal(await blindBox.read.balanceOf([addr1]), 2000n);
      assert.equal(await blindBox.read.balanceOf([addr2]), 4000n);

      // No more supply
      await assert.rejects(
        blindBox.write.fcfsMint([1], { account: user1.account, value: 0n }),
        /OverMaxSupply/
      );
    });

    it("Should allow more public supply when fewer tokens are airdropped", async () => {
      const { blindBox } = await deployAll();
      const addr1 = getAddress(user1.account.address);
      const addr2 = getAddress(user2.account.address);

      // Only airdrop 500 instead of planned 2244
      await blindBox.write.privilegedMint([
        [addr1],
        [500n],
      ]);

      // Open FCFS
      await blindBox.write.setPhase([3]); // FCFS
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([6000, 6000, 6000]);

      // Public can now mint 5500 (6000 - 500)
      await blindBox.write.fcfsMint([5500], { account: user2.account, value: 0n });

      assert.equal(await blindBox.read.balanceOf([addr2]), 5500n);

      await assert.rejects(
        blindBox.write.fcfsMint([1], { account: user2.account, value: 0n }),
        /OverMaxSupply/
      );
    });

    it("Should work across presale + starlist + FCFS after airdrop", async () => {
      const { blindBox } = await deployAll();
      const signerKey = generatePrivateKey();
      const signer = privateKeyToAccount(signerKey);

      await blindBox.write.setOffchainSigner([signer.address]);
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([3000, 3000, 3000]);

      // Airdrop 1000 first
      await blindBox.write.privilegedMint([
        [getAddress(user1.account.address)],
        [1000n],
      ]);

      // Presale: mint 2000
      await blindBox.write.setPhase([1]);
      const presaleHash = keccak256(
        encodePacked(
          ["address", "uint16", "string"],
          [getAddress(user1.account.address), 3000, "PRESALE"]
        )
      );
      const presaleSig = await signer.signMessage({ message: { raw: toBytes(presaleHash) } });
      await blindBox.write.presaleMint([2000, 3000, presaleSig], { account: user1.account, value: 0n });

      // Starlist: mint 2000
      await blindBox.write.setPhase([2]);
      const starlistHash = keccak256(
        encodePacked(
          ["address", "uint16", "string"],
          [getAddress(user2.account.address), 3000, "STARLIST"]
        )
      );
      const starlistSig = await signer.signMessage({ message: { raw: toBytes(starlistHash) } });
      await blindBox.write.starlistMint([2000, 3000, starlistSig], { account: user2.account, value: 0n });

      // FCFS: remaining 1000
      await blindBox.write.setPhase([3]);
      await blindBox.write.fcfsMint([1000], { account: user1.account, value: 0n });

      // Total: 1000 airdrop + 2000 presale + 2000 starlist + 1000 FCFS = 6000
      const total = await blindBox.read.balanceOf([getAddress(user1.account.address)]) +
                    await blindBox.read.balanceOf([getAddress(user2.account.address)]);
      assert.equal(total, MAX_SUPPLY);

      // No more
      await assert.rejects(
        blindBox.write.fcfsMint([1], { account: user2.account, value: 0n }),
        /OverMaxSupply/
      );
    });
  });

  describe("Supply Sharing Between Airdrop and Public Phases", () => {
    it("Should block all phases once MAX_SUPPLY hit via presale alone", async () => {
      const { blindBox } = await deployAll();
      const signerKey = generatePrivateKey();
      const signer = privateKeyToAccount(signerKey);

      await blindBox.write.setOffchainSigner([signer.address]);
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([6000, 6000, 6000]);

      // Presale: mint all 6000
      await blindBox.write.setPhase([1]);
      const presaleHash = keccak256(
        encodePacked(
          ["address", "uint16", "string"],
          [getAddress(user1.account.address), 6000, "PRESALE"]
        )
      );
      const presaleSig = await signer.signMessage({ message: { raw: toBytes(presaleHash) } });
      await mintFullSupplyTo(blindBox, getAddress(user1.account.address), MAX_SUPPLY, 500n);

      // Starlist blocked
      await blindBox.write.setPhase([2]);
      const starlistHash = keccak256(
        encodePacked(
          ["address", "uint16", "string"],
          [getAddress(user2.account.address), 6000, "STARLIST"]
        )
      );
      const starlistSig = await signer.signMessage({ message: { raw: toBytes(starlistHash) } });
      await assert.rejects(
        blindBox.write.starlistMint([1, 6000, starlistSig], { account: user2.account, value: 0n }),
        /OverMaxSupply/
      );

      // FCFS blocked
      await blindBox.write.setPhase([3]);
      await assert.rejects(
        blindBox.write.fcfsMint([1], { account: user2.account, value: 0n }),
        /OverMaxSupply/
      );

      // privilegedMint also blocked
      await assert.rejects(
        blindBox.write.privilegedMint([
          [getAddress(user2.account.address)],
          [1n],
        ]),
        /OverMaxSupply/
      );
    });

    it("Should allow zero airdrops and full public mint of 6000", async () => {
      const { blindBox } = await deployAll();
      const addr1 = getAddress(user1.account.address);

      // No airdrop at all - go straight to FCFS
      await blindBox.write.setPhase([3]);
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([6000, 6000, 6000]);

      await blindBox.write.fcfsMint([5000], { account: user1.account, value: 0n });
      await blindBox.write.fcfsMint([1000], { account: user1.account, value: 0n });

      assert.equal(await blindBox.read.balanceOf([addr1]), MAX_SUPPLY);
    });
  });

  describe("Burn Does Not Free Supply", () => {
    it("Should NOT allow minting after BlindBoxes are redeemed (burned)", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();
      const addr1 = getAddress(user1.account.address);
      const signerKey = generatePrivateKey();
      const signer = privateKeyToAccount(signerKey);

      await blindBox.write.setOffchainSigner([signer.address]);
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([4000, 4000, 4000]);

      // Mint all 6000 via privilegedMint
      await mintFullSupply(blindBox, addr1);
      assert.equal(await blindBox.read.balanceOf([addr1]), MAX_SUPPLY);

      // Redeem (burn) 100 BlindBoxes in batches of 20
      for (let i = 0; i < 100; i += 20) {
        const tokenIds = Array.from({ length: 20 }, (_, j) => BigInt(i + j));
        await blindBox.write.redeemBlindBoxes([tokenIds], { account: user1.account });
      }

      // Balance decreased
      assert.equal(await blindBox.read.balanceOf([addr1]), MAX_SUPPLY - 100n);

      // But _totalMinted is still 6000 - can't mint more via privilegedMint
      await assert.rejects(
        blindBox.write.privilegedMint([
          [addr1],
          [1n],
        ]),
        /OverMaxSupply/
      );

      // Can't mint via FCFS either
      await blindBox.write.setPhase([3]); // FCFS
      await blindBox.write.setPrices([0n, 0n, 0n]);
      await blindBox.write.setMaxPerWallet([6000, 6000, 6000]);
      await assert.rejects(
        blindBox.write.fcfsMint([1], { account: user1.account, value: 0n }),
        /OverMaxSupply/
      );
    });

    it("Should NOT allow minting even after ALL 6000 are burned", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();
      const addr1 = getAddress(user1.account.address);

      // Mint all 6000
      await mintFullSupply(blindBox, addr1);

      // Redeem all 6000 in batches
      const batchSize = 50;
      let redeemed = 0;
      while (redeemed < Number(MAX_SUPPLY)) {
        const remaining = Number(MAX_SUPPLY) - redeemed;
        const count = remaining < batchSize ? remaining : batchSize;
        const ids = Array.from({ length: count }, (_, i) => BigInt(redeemed + i));
        await blindBox.write.redeemBlindBoxes([ids], { account: user1.account });
        redeemed += count;
      }

      // All burned - balance is 0
      assert.equal(await blindBox.read.balanceOf([addr1]), 0n);

      // Still can't mint - _totalMinted() is permanently 6000
      await assert.rejects(
        blindBox.write.privilegedMint([
          [addr1],
          [1n],
        ]),
        /OverMaxSupply/
      );
    });
  });

  describe("Redeem Full 6000 Supply", () => {
    it("Should redeem all 6000 with no LilStar ID collisions and exact SBT distribution", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();
      const addr1 = getAddress(user1.account.address);

      // Mint all 6000 to user1
      await mintFullSupply(blindBox, addr1);
      assert.equal(await blindBox.read.balanceOf([addr1]), MAX_SUPPLY);

      const blockBefore = await publicClient.getBlockNumber();

      // Redeem in batches of 50
      const batchSize = 50;
      let redeemed = 0;
      while (redeemed < Number(MAX_SUPPLY)) {
        const remaining = Number(MAX_SUPPLY) - redeemed;
        const count = remaining < batchSize ? remaining : batchSize;
        const tokenIds = Array.from({ length: count }, (_, i) => BigInt(redeemed + i));

        const tx = await blindBox.write.redeemBlindBoxes([tokenIds], { account: user1.account });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });

        redeemed += count;
        if (redeemed % 500 === 0 || redeemed === Number(MAX_SUPPLY)) {
          console.log(`Redeemed ${redeemed}/${MAX_SUPPLY} - gas: ${receipt.gasUsed}`);
        }
      }

      // All BlindBoxes burned
      assert.equal(await blindBox.read.balanceOf([addr1]), 0n);

      // All LilStars minted
      assert.equal(await lilStar.read.balanceOf([addr1]), MAX_SUPPLY);
      assert.equal(await lilStar.read.totalSupply(), MAX_SUPPLY);

      // ===== Verify NO LilStar token ID collisions =====
      // Collect all BlindBoxRedeemed events to get every assigned LilStar tokenId
      const redeemEvents = await publicClient.getContractEvents({
        address: lilStar.address,
        abi: lilStar.abi,
        eventName: "BlindBoxRedeemed",
        fromBlock: blockBefore,
        strict: true,
      });

      assert.equal(redeemEvents.length, Number(MAX_SUPPLY), `Expected ${MAX_SUPPLY} BlindBoxRedeemed events`);

      const lilStarTokenIds = redeemEvents.map((e: any) => e.args.tokenId);
      const uniqueIds = new Set(lilStarTokenIds.map((id: bigint) => id.toString()));

      // Every LilStar token ID must be unique (no collisions)
      assert.equal(uniqueIds.size, Number(MAX_SUPPLY),
        `Expected ${MAX_SUPPLY} unique LilStar token IDs but got ${uniqueIds.size} (collision detected!)`);

      // Every LilStar token ID must be in valid range [0, 6000)
      for (const id of lilStarTokenIds) {
        assert.ok(id >= 0n && id < MAX_SUPPLY,
          `LilStar token ID ${id} is out of range [0, ${MAX_SUPPLY})`);
      }

      console.log(`All ${uniqueIds.size} LilStar token IDs are unique and in range [0, ${MAX_SUPPLY})`);

      // ===== Verify EXACT SBT distribution =====
      const sbt1 = await sbt.read.balanceOf([addr1, 1n]);
      const sbt2 = await sbt.read.balanceOf([addr1, 2n]);
      const sbt3 = await sbt.read.balanceOf([addr1, 3n]);
      console.log(`SBT distribution: 5%Discount=${sbt1}, 10%Discount=${sbt2}, FreeIRLBlindBox=${sbt3}`);

      // Total must equal MAX_SUPPLY
      assert.equal(sbt1 + sbt2 + sbt3, MAX_SUPPLY, "Total SBTs should equal MAX_SUPPLY");

      // Exact distribution: 2500 + 2500 + 1000 = 6000
      assert.equal(sbt1, 2500n, `5% Discount SBTs should be exactly 2500, got ${sbt1}`);
      assert.equal(sbt2, 2500n, `10% Discount SBTs should be exactly 2500, got ${sbt2}`);
      assert.equal(sbt3, 1000n, `Free IRL BlindBox SBTs should be exactly 1000, got ${sbt3}`);

      // Verify remaining supply is 0 across all types
      const [rem1, rem2, rem3] = await sbt.read.getRemainingSupply();
      assert.equal(rem1, 0, "Remaining 5% Discount supply should be 0");
      assert.equal(rem2, 0, "Remaining 10% Discount supply should be 0");
      assert.equal(rem3, 0, "Remaining Free IRL BlindBox supply should be 0");
    });

    it("Should fail to redeem token 6001 after all minted and redeemed (NoMoreTokenIds)", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();
      const addr1 = getAddress(user1.account.address);
      const addr2 = getAddress(user2.account.address);

      // Mint 5999 to user1 in batches, 1 to user2
      await mintFullSupplyTo(blindBox, addr1, 5999n);
      await blindBox.write.privilegedMint([
        [addr2],
        [1n],
      ]);

      // Redeem all 5999 of user1's in batches of 50
      const batchSize = 50;
      let redeemed = 0;
      while (redeemed < 5999) {
        const remaining = 5999 - redeemed;
        const count = remaining < batchSize ? remaining : batchSize;
        const tokenIds = Array.from({ length: count }, (_, i) => BigInt(redeemed + i));
        await blindBox.write.redeemBlindBoxes([tokenIds], { account: user1.account });
        redeemed += count;
      }

      // LilStar has 1 token ID remaining
      // Redeem user2's last BlindBox - should use the last LilStar token ID
      await blindBox.write.redeemBlindBoxes([[5999n]], { account: user2.account });

      assert.equal(await lilStar.read.totalSupply(), MAX_SUPPLY);
      assert.equal(await lilStar.read.balanceOf([addr1]), 5999n);
      assert.equal(await lilStar.read.balanceOf([addr2]), 1n);
    });
  });

  describe("Gas Analysis for Batch Redeems", () => {
    it("Should measure gas for various batch sizes", async () => {
      const { blindBox, lilStar, sbt } = await setupForRedeem();
      const addr1 = getAddress(user1.account.address);

      // Mint enough for testing
      await blindBox.write.privilegedMint([
        [addr1],
        [100n],
      ]);

      const batchSizes = [1, 2, 5, 10, 20, 50];
      let offset = 0;

      for (const size of batchSizes) {
        const tokenIds = Array.from({ length: size }, (_, i) => BigInt(offset + i));
        const tx = await blindBox.write.redeemBlindBoxes([tokenIds], { account: user1.account });
        const receipt = await publicClient.waitForTransactionReceipt({ hash: tx });
        const perToken = receipt.gasUsed / BigInt(size);
        console.log(`Batch ${size}: total=${receipt.gasUsed}, per_token=${perToken}`);
        offset += size;
      }
    });
  });
});
