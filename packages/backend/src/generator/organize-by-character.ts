import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CharacterType, NFTMetadata } from "./config";

const INPUT_PATH = join(import.meta.dir, "../../output/common");
const OUTPUT_PATH = join(import.meta.dir, "../../output/common");

const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

async function organizeByCharacter() {
	console.log("=== Organizing NFTs by Character ===\n");

	// Create character folders
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
		mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
	}

	// Read all metadata files
	const metadataDir = join(INPUT_PATH, "metadata");
	const files = readdirSync(metadataDir).filter((f) => f.endsWith(".json"));

	console.log(`Processing ${files.length} NFTs...\n`);

	// Group by character
	const characterCollections: Record<CharacterType, NFTMetadata[]> = {
		bear: [],
		bunny: [],
		fox: [],
		chogstar: [],
	};

	const characterCounts: Record<string, number> = {};

	for (const file of files) {
		const tokenId = file.replace(".json", "");
		const metadata: NFTMetadata = await Bun.file(
			join(metadataDir, file),
		).json();
		const character = metadata.character as CharacterType;

		// Copy metadata to character folder
		const metadataSrc = join(metadataDir, file);
		const metadataDest = join(OUTPUT_PATH, character, "metadata", file);
		copyFileSync(metadataSrc, metadataDest);

		// Copy image to character folder
		const imageSrc = join(INPUT_PATH, "images", `${tokenId}.png`);
		const imageDest = join(OUTPUT_PATH, character, "images", `${tokenId}.png`);
		copyFileSync(imageSrc, imageDest);

		// Add to collection
		characterCollections[character].push(metadata);

		// Count
		characterCounts[character] = (characterCounts[character] || 0) + 1;
	}

	// Save collection.json for each character
	for (const char of characters) {
		const collectionPath = join(OUTPUT_PATH, char, "collection.json");
		writeFileSync(
			collectionPath,
			JSON.stringify(characterCollections[char], null, 2),
		);
		console.log(`  ${char}: ${characterCounts[char]} NFTs`);
	}

	console.log(`\n=== Complete ===`);
	console.log(`NFTs organized into character folders:`);
	for (const char of characters) {
		console.log(`  output/common/${char}/`);
		console.log(`    - images/`);
		console.log(`    - metadata/`);
		console.log(`    - collection.json`);
	}
}

organizeByCharacter().catch(console.error);
