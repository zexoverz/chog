import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { CharacterType, NFTMetadata } from "./config";
import { generateMetadata } from "./metadata";
import { generateDNAHash, SeededRandom, selectTraitsForNFT } from "./random";
import { loadTraitDatabase, printTraitSummary } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common_test_100");
const SEED = 42;
const PER_CHARACTER = 25; // 25 x 4 = 100 total
const LEGENDARY_INHERIT_COUNT = 10; // 10 out of 100 will have legendary inheritance

async function generateTestCommon() {
	console.log(
		"=== Generating 100 Common NFTs Test (with Legendary Inheritance) ===\n",
	);

	// Load trait database
	console.log("Loading trait database...");
	const db = await loadTraitDatabase();
	printTraitSummary(db);

	// Create output directories
	mkdirSync(join(OUTPUT_PATH, "images"), { recursive: true });
	mkdirSync(join(OUTPUT_PATH, "metadata"), { recursive: true });

	const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];
	const allSelections: Array<{
		selection: ReturnType<typeof selectTraitsForNFT>;
		tokenId: number;
		character: CharacterType;
	}> = [];

	// Generate unique NFTs per character
	const seenDNA = new Set<string>();
	let tokenId = 1;

	for (const character of characters) {
		console.log(`\nGenerating ${PER_CHARACTER} common ${character}s...`);

		let generated = 0;
		let attempts = 0;
		const maxAttempts = PER_CHARACTER * 20;

		while (generated < PER_CHARACTER && attempts < maxAttempts) {
			const rng = new SeededRandom(
				SEED + characters.indexOf(character) * 1000 + attempts,
			);

			// First few of each character get legendary inheritance for testing
			const legendaryInherit =
				generated < Math.ceil(LEGENDARY_INHERIT_COUNT / 4);

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
			}
			attempts++;
		}
	}

	// Shuffle to mix characters
	const rng = new SeededRandom(SEED);
	const shuffled = rng.shuffle(allSelections);

	// Reassign token IDs after shuffle
	for (let i = 0; i < shuffled.length; i++) {
		shuffled[i].tokenId = i + 1;
	}

	console.log(`\nTotal NFTs to generate: ${shuffled.length}`);

	// Generate images and metadata
	const allMetadata: NFTMetadata[] = [];

	for (const { selection, tokenId } of shuffled) {
		// Generate image
		const _imagePath = await generateImageToPath(
			selection,
			tokenId,
			OUTPUT_PATH,
		);

		// Generate metadata
		const metadata = generateMetadata(selection, tokenId, "ipfs://test/");

		// Save metadata
		const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
		await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

		allMetadata.push(metadata);
	}

	// Count per character and legendary inherit
	const perChar: Record<string, number> = {};
	let legendaryInheritCount = 0;
	const legendaryTraitCounts: Record<string, Record<string, number>> = {};

	// Track hoodie/astronaut rule enforcement
	let hoodieCount = 0;
	let hoodieWithHeadAcc = 0;
	let hoodieWithNecklace = 0;
	let astronautCount = 0;
	let astronautWithLegendaryEyes = 0;
	let astronautWithHeadAcc = 0;
	let astronautWithNecklace = 0;
	let legendaryClothesCount = 0;
	let legendaryClothesWithNecklace = 0;
	let maskCount = 0;
	let maskWithEyeglasses = 0;
	let maskWithLegendaryEyes = 0;
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

		// Check hoodie/astronaut rules
		const shirtTrait = selection.traits.get("shirt");
		const headAccTrait = selection.traits.get("head_acc");
		const eyesTrait = selection.traits.get("eyes");
		const necklaceTrait = selection.traits.get("necklaces");

		if (shirtTrait && HOODIES.includes(shirtTrait.filename)) {
			hoodieCount++;
			if (headAccTrait) hoodieWithHeadAcc++;
			if (necklaceTrait) hoodieWithNecklace++;
		}

		if (shirtTrait && shirtTrait.filename === "astronaut.png") {
			astronautCount++;
			if (headAccTrait) astronautWithHeadAcc++;
			if (eyesTrait && eyesTrait.rarity === "legendary")
				astronautWithLegendaryEyes++;
			if (necklaceTrait) astronautWithNecklace++;
		}

		// Check legendary clothes + necklace rule
		if (shirtTrait && shirtTrait.rarity === "legendary") {
			legendaryClothesCount++;
			if (necklaceTrait) legendaryClothesWithNecklace++;
		}

		// Check mask/scarf + eyeglasses/legendary eyes rule
		const eyeglassesTrait = selection.traits.get("eyeglasses");
		if (headAccTrait && MASKS.includes(headAccTrait.filename)) {
			maskCount++;
			if (eyeglassesTrait) maskWithEyeglasses++;
			if (eyesTrait && eyesTrait.rarity === "legendary")
				maskWithLegendaryEyes++;
		}

		// Check legendary eyes + eyeglasses rule
		if (eyesTrait && eyesTrait.rarity === "legendary") {
			legendaryEyesCount++;
			if (eyeglassesTrait) legendaryEyesWithEyeglasses++;
		}
	}

	console.log(`\n=== Generation Complete ===`);
	console.log(`Total: ${allMetadata.length}`);
	console.log(
		`Legendary Inherit: ${legendaryInheritCount} (${((legendaryInheritCount / allMetadata.length) * 100).toFixed(1)}%)`,
	);
	console.log(`Per character:`, perChar);

	console.log(`\n=== Rule Enforcement Check ===`);
	console.log(`Hoodies: ${hoodieCount} total`);
	console.log(
		`  - With head_acc (violations): ${hoodieWithHeadAcc} ${hoodieWithHeadAcc === 0 ? "✓" : "✗"}`,
	);
	console.log(
		`  - With necklace (violations): ${hoodieWithNecklace} ${hoodieWithNecklace === 0 ? "✓" : "✗"}`,
	);
	console.log(`Astronauts: ${astronautCount} total`);
	console.log(
		`  - With head_acc (violations): ${astronautWithHeadAcc} ${astronautWithHeadAcc === 0 ? "✓" : "✗"}`,
	);
	console.log(
		`  - With legendary eyes (violations): ${astronautWithLegendaryEyes} ${astronautWithLegendaryEyes === 0 ? "✓" : "✗"}`,
	);
	console.log(
		`  - With necklace (violations): ${astronautWithNecklace} ${astronautWithNecklace === 0 ? "✓" : "✗"}`,
	);
	console.log(`Legendary Clothes: ${legendaryClothesCount} total`);
	console.log(
		`  - With necklace (violations): ${legendaryClothesWithNecklace} ${legendaryClothesWithNecklace === 0 ? "✓" : "✗"}`,
	);
	console.log(`Masks/Scarves: ${maskCount} total`);
	console.log(
		`  - With eyeglasses (violations): ${maskWithEyeglasses} ${maskWithEyeglasses === 0 ? "✓" : "✗"}`,
	);
	console.log(
		`  - With legendary eyes (violations): ${maskWithLegendaryEyes} ${maskWithLegendaryEyes === 0 ? "✓" : "✗"}`,
	);
	console.log(`Legendary Eyes: ${legendaryEyesCount} total`);
	console.log(
		`  - With eyeglasses (violations): ${legendaryEyesWithEyeglasses} ${legendaryEyesWithEyeglasses === 0 ? "✓" : "✗"}`,
	);

	// Print legendary trait breakdown
	console.log(`\n=== Legendary Traits Breakdown ===`);
	for (const [layer, traits] of Object.entries(legendaryTraitCounts)) {
		const totalInLayer = Object.values(traits).reduce((a, b) => a + b, 0);
		console.log(
			`\n${layer}: ${totalInLayer} total (${((totalInLayer / allMetadata.length) * 100).toFixed(1)}% of all NFTs)`,
		);
		for (const [traitName, count] of Object.entries(traits).sort(
			(a, b) => b[1] - a[1],
		)) {
			console.log(
				`  - ${traitName}: ${count} (${((count / allMetadata.length) * 100).toFixed(1)}%)`,
			);
		}
	}

	console.log(`\nOutput saved to: output/common_test_100/`);
}

// Custom generateImage that outputs to test folder
async function generateImageToPath(
	selection: ReturnType<typeof selectTraitsForNFT>,
	tokenId: number,
	outputPath: string,
): Promise<string> {
	const sharp = (await import("sharp")).default;
	const { getTraitPath } = await import("./traits");
	const { LAYER_ORDER_COMMON, LAYER_OFFSETS } = await import("./config");

	const IMAGE_SIZE = 2048;
	const layers: Array<{ path: string; layer: string }> = [];

	const inheritLabel = selection.hasLegendaryInheritance
		? " [LEGENDARY INHERIT]"
		: "";
	console.log(
		`\n=== Token ${tokenId} (${selection.character})${inheritLabel} ===`,
	);

	for (const layer of LAYER_ORDER_COMMON) {
		const trait = selection.traits.get(layer);
		if (!trait) {
			continue;
		}

		// Use the trait's own rarity to get the correct path (important for inherited legendary traits)
		const path = getTraitPath(
			selection.character,
			layer,
			trait.filename,
			trait.rarity,
		);
		const legendaryTag = trait.rarity === "legendary" ? " [L]" : "";
		console.log(`  ${layer}: ${trait.filename}${legendaryTag}`);
		layers.push({ path, layer });
	}

	if (layers.length === 0) {
		throw new Error(`No layers found for token ${tokenId}`);
	}

	// Composite layers
	const [baseLayer, ...overlayLayers] = layers;

	const resizedOverlays = await Promise.all(
		overlayLayers.map(async (l) => ({
			buffer: await sharp(l.path)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer(),
			layer: l.layer,
		})),
	);

	let composite = sharp(baseLayer.path).resize(IMAGE_SIZE, IMAGE_SIZE, {
		fit: "fill",
	});

	if (resizedOverlays.length > 0) {
		composite = composite.composite(
			resizedOverlays.map(({ buffer, layer }) => {
				const offset = (
					LAYER_OFFSETS as Record<string, { top: number; left: number }>
				)[layer] || { top: 0, left: 0 };
				return {
					input: buffer,
					top: offset.top,
					left: offset.left,
				};
			}),
		);
	}

	const imgPath = join(outputPath, "images", `${tokenId}.png`);
	await composite.png({ quality: 90 }).toFile(imgPath);

	return imgPath;
}

generateTestCommon().catch(console.error);
