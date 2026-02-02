import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import {
	type CharacterType,
	COLLECTION_CONFIG,
	LAYER_OFFSETS,
	LAYER_ORDER_COMMON,
} from "./config";
import { generateMetadata } from "./metadata";
import { generateDNAHash, SeededRandom, selectTraitsForNFT } from "./random";
import { getTraitPath, loadTraitDatabase, printTraitSummary } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common");
const SEED = 12345;
const IMAGE_SIZE = 2048;

// Distribution from config
const TOTAL_COMMON = COLLECTION_CONFIG.distribution.common.count; // 5735
const LEGENDARY_COUNT = COLLECTION_CONFIG.distribution.legendary.count; // 240
const LEGENDARY_INHERIT_COUNT =
	COLLECTION_CONFIG.distribution.common.legendaryInheritCount; // 57

async function generateCommonFull() {
	const startTime = Date.now();
	console.log("=== Generating Full Common NFT Collection ===\n");
	console.log(`Total to generate: ${TOTAL_COMMON}`);
	console.log(
		`Token ID range: ${LEGENDARY_COUNT + 1} - ${LEGENDARY_COUNT + TOTAL_COMMON}`,
	);
	console.log(`Legendary inheritance: ${LEGENDARY_INHERIT_COUNT} (~1%)\n`);

	// Load trait database
	console.log("Loading trait database...");
	const db = await loadTraitDatabase();
	printTraitSummary(db);

	// Create output directories
	mkdirSync(join(OUTPUT_PATH, "images"), { recursive: true });
	mkdirSync(join(OUTPUT_PATH, "metadata"), { recursive: true });

	const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

	// Calculate per character (5735 / 4 = 1433.75, so 3 get 1434 and 1 gets 1433)
	const perCharacter: Record<CharacterType, number> = {
		bear: 1434,
		bunny: 1434,
		fox: 1434,
		chogstar: 1433,
	};

	// Calculate legendary inherit per character (57 / 4 = 14.25)
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
			`\nGenerating ${count} ${character}s (${legendaryCount} with legendary inheritance)...`,
		);

		let generated = 0;
		let legendaryGenerated = 0;
		let attempts = 0;
		const maxAttempts = count * 50;

		while (generated < count && attempts < maxAttempts) {
			const rng = new SeededRandom(
				SEED + characters.indexOf(character) * 10000 + attempts,
			);

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
	}

	// Shuffle to mix characters
	console.log(`\nShuffling ${allSelections.length} NFTs...`);
	const rng = new SeededRandom(SEED);
	const shuffled = rng.shuffle(allSelections);

	// Reassign token IDs after shuffle (starting from 241)
	for (let i = 0; i < shuffled.length; i++) {
		shuffled[i].tokenId = LEGENDARY_COUNT + i + 1;
	}

	console.log(
		`\nGenerating images and metadata for ${shuffled.length} NFTs...`,
	);
	console.log(`This may take a while...\n`);

	// Process in batches for better performance
	const BATCH_SIZE = 50;
	let processedCount = 0;

	for (let i = 0; i < shuffled.length; i += BATCH_SIZE) {
		const batch = shuffled.slice(i, i + BATCH_SIZE);

		await Promise.all(
			batch.map(async ({ selection, tokenId, character }) => {
				// Generate image
				await generateImage(selection, tokenId, character);

				// Generate and save metadata
				const metadata = generateMetadata(
					selection,
					tokenId,
					"ipfs://PLACEHOLDER/",
				);
				const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
				await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));
			}),
		);

		processedCount += batch.length;
		const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
		const rate = (processedCount / parseFloat(elapsed)).toFixed(1);
		console.log(
			`  Processed: ${processedCount}/${shuffled.length} (${rate}/s)`,
		);
	}

	const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
	console.log(`\n=== Generation Complete ===`);
	console.log(`Total NFTs: ${shuffled.length}`);
	console.log(
		`Token IDs: ${LEGENDARY_COUNT + 1} - ${LEGENDARY_COUNT + shuffled.length}`,
	);
	console.log(`Time: ${totalTime} minutes`);
	console.log(`Output: ${OUTPUT_PATH}`);
}

async function generateImage(
	selection: ReturnType<typeof selectTraitsForNFT>,
	tokenId: number,
	character: CharacterType,
): Promise<void> {
	const layers: Array<{ path: string; layer: string }> = [];

	for (const layer of LAYER_ORDER_COMMON) {
		const trait = selection.traits.get(layer);
		if (!trait) continue;

		const path = getTraitPath(character, layer, trait.filename, trait.rarity);
		layers.push({ path, layer });
	}

	if (layers.length === 0) {
		throw new Error(`No layers found for token ${tokenId}`);
	}

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

	const imgPath = join(OUTPUT_PATH, "images", `${tokenId}.png`);
	await composite.png({ quality: 90 }).toFile(imgPath);
}

generateCommonFull().catch(console.error);
