import { mkdirSync } from "node:fs";
import { join } from "node:path";
import {
	type CharacterType,
	COLLECTION_CONFIG,
	type NFTMetadata,
} from "./config";
import { generateMetadata } from "./metadata";
import { generateDNAHash, SeededRandom, selectTraitsForNFT } from "./random";
import { loadTraitDatabase, printTraitSummary } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common_full");
const SEED = 12345;

// Distribution from config
const TOTAL_COMMON = COLLECTION_CONFIG.distribution.common.count; // 5735
const LEGENDARY_INHERIT_PERCENT =
	COLLECTION_CONFIG.distribution.common.legendaryInheritPercentage; // 1%
const LEGENDARY_INHERIT_COUNT =
	COLLECTION_CONFIG.distribution.common.legendaryInheritCount; // 57

async function generateCommonMetadata() {
	console.log("=== Generating Common NFT Metadata ===\n");
	console.log(`Total to generate: ${TOTAL_COMMON}`);
	console.log(
		`Legendary inheritance: ${LEGENDARY_INHERIT_COUNT} (${LEGENDARY_INHERIT_PERCENT}%)\n`,
	);

	// Load trait database
	console.log("Loading trait database...");
	const db = await loadTraitDatabase();
	printTraitSummary(db);

	// Create output directory
	mkdirSync(join(OUTPUT_PATH, "metadata"), { recursive: true });

	const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

	// Calculate per character (5735 / 4 = 1433.75, so 3 get 1434 and 1 gets 1433)
	const perCharacter: Record<CharacterType, number> = {
		bear: 1434,
		bunny: 1434,
		fox: 1434,
		chogstar: 1433,
	};

	// Calculate legendary inherit per character (57 / 4 = 14.25, so distribute evenly)
	const legendaryPerCharacter: Record<CharacterType, number> = {
		bear: 15,
		bunny: 14,
		fox: 14,
		chogstar: 14,
	};

	const allSelections: Array<{
		selection: ReturnType<typeof selectTraitsForNFT>;
		tokenId: number;
		character: CharacterType;
	}> = [];

	// Generate unique NFTs per character
	const seenDNA = new Set<string>();
	let tokenId = 1;

	for (const character of characters) {
		const count = perCharacter[character];
		const legendaryCount = legendaryPerCharacter[character];

		console.log(
			`\nGenerating ${count} common ${character}s (${legendaryCount} with legendary inheritance)...`,
		);

		let generated = 0;
		let legendaryGenerated = 0;
		let attempts = 0;
		const maxAttempts = count * 50;

		while (generated < count && attempts < maxAttempts) {
			const rng = new SeededRandom(
				SEED + characters.indexOf(character) * 10000 + attempts,
			);

			// Apply legendary inheritance to first N of each character
			const legendaryInherit = legendaryGenerated < legendaryCount;

			const selection = selectTraitsForNFT(
				db,
				character,
				"common",
				rng,
				undefined,
				legendaryInherit,
			);
			const dna = generateDNAHash(selection);

			if (!seenDNA.has(dna)) {
				seenDNA.add(dna);
				allSelections.push({ selection, tokenId, character });
				tokenId++;
				generated++;
				if (legendaryInherit) legendaryGenerated++;
			}
			attempts++;
		}

		console.log(
			`  Generated: ${generated}/${count}, Legendary: ${legendaryGenerated}/${legendaryCount}`,
		);

		if (generated < count) {
			console.warn(
				`  WARNING: Could not generate enough unique NFTs for ${character}`,
			);
		}
	}

	// Shuffle to mix characters
	console.log(`\nShuffling ${allSelections.length} NFTs...`);
	const rng = new SeededRandom(SEED);
	const shuffled = rng.shuffle(allSelections);

	// Reassign token IDs after shuffle (starting from 241 for common, after 240 legendary)
	const LEGENDARY_COUNT = COLLECTION_CONFIG.distribution.legendary.count; // 240
	for (let i = 0; i < shuffled.length; i++) {
		shuffled[i].tokenId = LEGENDARY_COUNT + i + 1; // 241 onwards
	}

	console.log(`\nGenerating metadata for ${shuffled.length} NFTs...`);

	// Generate and save metadata
	const allMetadata: NFTMetadata[] = [];
	let processedCount = 0;

	for (const { selection, tokenId } of shuffled) {
		const metadata = generateMetadata(
			selection,
			tokenId,
			"ipfs://PLACEHOLDER/",
		);

		const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
		await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

		allMetadata.push(metadata);
		processedCount++;

		if (processedCount % 500 === 0) {
			console.log(`  Processed: ${processedCount}/${shuffled.length}`);
		}
	}

	// === Statistics ===
	console.log(`\n${"=".repeat(60)}`);
	console.log("=== GENERATION STATISTICS ===");
	console.log("=".repeat(60));

	// Count per character
	const perChar: Record<string, number> = {};
	let legendaryInheritCount = 0;
	const legendaryTraitCounts: Record<string, Record<string, number>> = {};

	// Rule enforcement tracking
	let hoodieCount = 0;
	let hoodieWithHeadAcc = 0;
	let astronautCount = 0;
	let astronautWithLegendaryEyes = 0;
	let astronautWithHeadAcc = 0;
	let maskCount = 0;
	let maskWithEyeglasses = 0;
	let legendaryClothesCount = 0;
	let legendaryClothesWithHeadAcc = 0;
	let legendaryEyesCount = 0;
	let legendaryEyesWithEyeglasses = 0;

	const HOODIES = [
		"beige_hoodie.png",
		"black_hoodie.png",
		"chogstar_hoodie.png",
		"purple_hoodie.png",
		"stripes_hoodie.png",
		"white_hoodie.png",
		"gray__orange_striped_hoodie.png",
		"gray_hoodie.png",
	];
	const MASKS = [
		"scarf.png",
		"black_mask_w_black_hair.png",
		"black_mask_with_hair.png",
		"black_mask.png",
		"blue_mask.png",
		"fur_mask.png",
		"gojo_mask.png",
		"pink_scarf.png",
		"red_mask.png",
		"washed_mask.png",
		"yapper_mask.png",
	];

	for (const { selection } of shuffled) {
		perChar[selection.character] = (perChar[selection.character] || 0) + 1;
		if (selection.hasLegendaryInheritance) {
			legendaryInheritCount++;
		}

		// Count legendary traits by layer
		for (const [layer, trait] of selection.traits) {
			if (trait && trait.rarity === "legendary") {
				if (!legendaryTraitCounts[layer]) {
					legendaryTraitCounts[layer] = {};
				}
				legendaryTraitCounts[layer][trait.filename] =
					(legendaryTraitCounts[layer][trait.filename] || 0) + 1;
			}
		}

		const shirtTrait = selection.traits.get("shirt");
		const headAccTrait = selection.traits.get("head_acc");
		const eyesTrait = selection.traits.get("eyes");
		const eyeglassesTrait = selection.traits.get("eyeglasses");

		// Check hoodies
		if (shirtTrait && HOODIES.includes(shirtTrait.filename)) {
			hoodieCount++;
			if (headAccTrait) hoodieWithHeadAcc++;
		}

		// Check astronaut
		if (shirtTrait && shirtTrait.filename === "astronaut.png") {
			astronautCount++;
			if (headAccTrait) astronautWithHeadAcc++;
			if (eyesTrait && eyesTrait.rarity === "legendary")
				astronautWithLegendaryEyes++;
		}

		// Check masks/scarves
		if (headAccTrait && MASKS.includes(headAccTrait.filename)) {
			maskCount++;
			if (eyeglassesTrait) maskWithEyeglasses++;
		}

		// Check legendary clothes
		if (shirtTrait && shirtTrait.rarity === "legendary") {
			legendaryClothesCount++;
			if (headAccTrait) legendaryClothesWithHeadAcc++;
		}

		// Check legendary eyes
		if (eyesTrait && eyesTrait.rarity === "legendary") {
			legendaryEyesCount++;
			if (eyeglassesTrait) legendaryEyesWithEyeglasses++;
		}
	}

	console.log(`\nTotal NFTs: ${allMetadata.length}`);
	console.log(`Expected: ${TOTAL_COMMON}`);
	console.log(`Match: ${allMetadata.length === TOTAL_COMMON ? "✓" : "✗"}`);

	console.log(`\n--- Character Distribution ---`);
	for (const [char, count] of Object.entries(perChar).sort()) {
		const expected = perCharacter[char as CharacterType];
		const pct = ((count / allMetadata.length) * 100).toFixed(2);
		console.log(
			`${char}: ${count} (${pct}%) - Expected: ${expected} ${count === expected ? "✓" : "✗"}`,
		);
	}

	console.log(`\n--- Legendary Inheritance ---`);
	console.log(`Total with legendary traits: ${legendaryInheritCount}`);
	console.log(`Expected: ${LEGENDARY_INHERIT_COUNT}`);
	console.log(
		`Percentage: ${((legendaryInheritCount / allMetadata.length) * 100).toFixed(2)}%`,
	);
	console.log(`Expected percentage: ${LEGENDARY_INHERIT_PERCENT}%`);
	console.log(
		`Match: ${legendaryInheritCount === LEGENDARY_INHERIT_COUNT ? "✓" : "✗"}`,
	);

	console.log(`\n--- Rule Enforcement Check ---`);
	console.log(`Hoodies: ${hoodieCount} total`);
	console.log(
		`  - With head_acc (violations): ${hoodieWithHeadAcc} ${hoodieWithHeadAcc === 0 ? "✓" : "✗"}`,
	);
	console.log(`Astronauts: ${astronautCount} total`);
	console.log(
		`  - With head_acc (violations): ${astronautWithHeadAcc} ${astronautWithHeadAcc === 0 ? "✓" : "✗"}`,
	);
	console.log(
		`  - With legendary eyes (violations): ${astronautWithLegendaryEyes} ${astronautWithLegendaryEyes === 0 ? "✓" : "✗"}`,
	);
	console.log(`Masks/Scarves: ${maskCount} total`);
	console.log(
		`  - With eyeglasses (violations): ${maskWithEyeglasses} ${maskWithEyeglasses === 0 ? "✓" : "✗"}`,
	);
	console.log(`Legendary Clothes: ${legendaryClothesCount} total`);
	console.log(
		`  - With head_acc (violations): ${legendaryClothesWithHeadAcc} ${legendaryClothesWithHeadAcc === 0 ? "✓" : "✗"}`,
	);
	console.log(`Legendary Eyes: ${legendaryEyesCount} total`);
	console.log(
		`  - With eyeglasses (violations): ${legendaryEyesWithEyeglasses} ${legendaryEyesWithEyeglasses === 0 ? "✓" : "✗"}`,
	);

	// Print legendary trait breakdown
	console.log(`\n--- Legendary Traits Breakdown ---`);
	for (const [layer, traits] of Object.entries(legendaryTraitCounts).sort()) {
		const totalInLayer = Object.values(traits).reduce((a, b) => a + b, 0);
		console.log(
			`\n${layer}: ${totalInLayer} total (${((totalInLayer / allMetadata.length) * 100).toFixed(2)}%)`,
		);
		for (const [traitName, count] of Object.entries(traits).sort(
			(a, b) => b[1] - a[1],
		)) {
			console.log(
				`  - ${traitName}: ${count} (${((count / allMetadata.length) * 100).toFixed(2)}%)`,
			);
		}
	}

	console.log(`\n${"=".repeat(60)}`);
	console.log(`Metadata saved to: output/common_full/metadata/`);
	console.log(
		`Token IDs: ${LEGENDARY_COUNT + 1} - ${LEGENDARY_COUNT + allMetadata.length}`,
	);
}

generateCommonMetadata().catch(console.error);
