import { COLLECTION_CONFIG, type NFTMetadata } from "./config";
import { ensureOutputDirs, generateImage } from "./image";
import {
	generateMetadata,
	saveCollectionMetadata,
	saveMetadata,
} from "./metadata";
import { SeededRandom, type SelectedTraits, selectUniqueNFTs } from "./random";
import { loadTraitDatabase, printTraitSummary } from "./traits";

interface GenerationOptions {
	seed?: number;
	baseImageURI?: string;
	skipImages?: boolean;
	batchSize?: number;
	startTokenId?: number;
	legendaryOnly?: boolean;
}

export async function generateCollection(
	options: GenerationOptions = {},
): Promise<NFTMetadata[]> {
	const {
		seed = 42,
		baseImageURI = "ipfs://",
		skipImages = false,
		batchSize = 50,
		startTokenId = 1,
		legendaryOnly = false,
	} = options;

	console.log("Loading trait database...");
	const db = await loadTraitDatabase();
	printTraitSummary(db);

	console.log("\nEnsuring output directories...");
	await ensureOutputDirs();

	const allSelections: Array<{ selection: SelectedTraits; tokenId: number }> =
		[];
	let currentTokenId = startTokenId;

	// Generate LEGENDARY NFTs first (4% = 240 total, 60 per character)
	console.log("\n=== Generating LEGENDARY NFTs ===");
	console.log(
		`Target: ${COLLECTION_CONFIG.distribution.legendary.count} total (${COLLECTION_CONFIG.distribution.legendary.perCharacter} per character)`,
	);

	for (const character of COLLECTION_CONFIG.characters) {
		console.log(
			`  Generating ${COLLECTION_CONFIG.distribution.legendary.perCharacter} legendary ${character}s...`,
		);

		const selections = selectUniqueNFTs(
			db,
			COLLECTION_CONFIG.distribution.legendary.perCharacter,
			character,
			"legendary",
			seed + COLLECTION_CONFIG.characters.indexOf(character) * 1000,
		);

		for (const selection of selections) {
			allSelections.push({ selection, tokenId: currentTokenId });
			currentTokenId++;
		}
	}

	// Generate COMMON NFTs (96% = 5760 total, 1440 per character)
	if (!legendaryOnly) {
		console.log("\n=== Generating COMMON NFTs ===");
		console.log(
			`Target: ${COLLECTION_CONFIG.distribution.common.count} total (${COLLECTION_CONFIG.distribution.common.perCharacter} per character)`,
		);

		for (const character of COLLECTION_CONFIG.characters) {
			console.log(
				`  Generating ${COLLECTION_CONFIG.distribution.common.perCharacter} common ${character}s...`,
			);

			const selections = selectUniqueNFTs(
				db,
				COLLECTION_CONFIG.distribution.common.perCharacter,
				character,
				"common",
				seed + 100000 + COLLECTION_CONFIG.characters.indexOf(character) * 10000,
			);

			for (const selection of selections) {
				allSelections.push({ selection, tokenId: currentTokenId });
				currentTokenId++;
			}
		}
	} else {
		console.log("\n=== Skipping COMMON NFTs (legendary-only mode) ===");
	}

	console.log(`\nTotal NFTs to generate: ${allSelections.length}`);

	// Shuffle to mix legendary and common, and different characters
	const rng = new SeededRandom(seed);
	const shuffled = rng.shuffle(allSelections);

	// Reassign token IDs after shuffle
	for (let i = 0; i < shuffled.length; i++) {
		shuffled[i].tokenId = startTokenId + i;
	}

	// Count distribution after shuffle
	const legendaryCount = shuffled.filter(
		(s) => s.selection.rarity === "legendary",
	).length;
	const commonCount = shuffled.filter(
		(s) => s.selection.rarity === "common",
	).length;
	console.log(`\nDistribution after shuffle:`);
	console.log(
		`  Legendary: ${legendaryCount} (${((legendaryCount / shuffled.length) * 100).toFixed(2)}%)`,
	);
	console.log(
		`  Common: ${commonCount} (${((commonCount / shuffled.length) * 100).toFixed(2)}%)`,
	);

	// Generate images and metadata in batches
	console.log("\nGenerating images and metadata...");
	const totalBatches = Math.ceil(shuffled.length / batchSize);
	const allMetadata: NFTMetadata[] = [];

	for (let batch = 0; batch < totalBatches; batch++) {
		const start = batch * batchSize;
		const end = Math.min(start + batchSize, shuffled.length);
		const batchItems = shuffled.slice(start, end);

		const legendaryInBatch = batchItems.filter(
			(s) => s.selection.rarity === "legendary",
		).length;
		console.log(
			`  Batch ${batch + 1}/${totalBatches} (tokens ${start + startTokenId}-${end + startTokenId - 1}, ${legendaryInBatch} legendary)...`,
		);

		const batchPromises = batchItems.map(async ({ selection, tokenId }) => {
			// Generate image
			if (!skipImages) {
				await generateImage(selection, tokenId);
			}

			// Generate and save metadata
			const metadata = generateMetadata(selection, tokenId, baseImageURI);
			await saveMetadata(metadata);

			return metadata;
		});

		const batchMetadata = await Promise.all(batchPromises);
		allMetadata.push(...batchMetadata);
	}

	// Save collection metadata and rarity report
	console.log("\nSaving collection metadata...");
	await saveCollectionMetadata(allMetadata);

	// Print final summary
	console.log(`\n=== Generation Complete ===`);
	console.log(`Total NFTs: ${allMetadata.length}`);
	console.log(
		`Legendary: ${allMetadata.filter((m) => m.rarity === "legendary").length}`,
	);
	console.log(
		`Common: ${allMetadata.filter((m) => m.rarity === "common").length}`,
	);

	return allMetadata;
}

// CLI entry point
if (import.meta.main) {
	const args = process.argv.slice(2);
	const options: GenerationOptions = {};

	for (let i = 0; i < args.length; i++) {
		switch (args[i]) {
			case "--seed":
				options.seed = Number.parseInt(args[++i], 10);
				break;
			case "--uri":
				options.baseImageURI = args[++i];
				break;
			case "--skip-images":
				options.skipImages = true;
				break;
			case "--batch":
				options.batchSize = Number.parseInt(args[++i], 10);
				break;
			case "--start":
				options.startTokenId = Number.parseInt(args[++i], 10);
				break;
			case "--legendary-only":
				options.legendaryOnly = true;
				break;
		}
	}

	generateCollection(options)
		.then((metadata) => {
			console.log("\nSample LEGENDARY metadata:");
			const legendary = metadata.find((m) => m.rarity === "legendary");
			if (legendary) {
				console.log(JSON.stringify(legendary, null, 2));
			}

			console.log("\nSample COMMON metadata:");
			const common = metadata.find((m) => m.rarity === "common");
			if (common) {
				console.log(JSON.stringify(common, null, 2));
			}
		})
		.catch(console.error);
}
