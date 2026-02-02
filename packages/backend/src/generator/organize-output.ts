import { readFileSync, mkdirSync, copyFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUTPUT_PATH = join(import.meta.dir, "../../output");

// Read collection data
const collection = JSON.parse(
	readFileSync(join(OUTPUT_PATH, "collection.json"), "utf-8"),
);

const characters = ["bear", "bunny", "fox", "chogstar"];

// Create character folders
for (const char of characters) {
	mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
	mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
}

// Group by character
const byCharacter: Record<string, typeof collection> = {
	bear: [],
	bunny: [],
	fox: [],
	chogstar: [],
};

for (const nft of collection) {
	byCharacter[nft.character].push(nft);
}

// Copy files to character folders
for (const nft of collection) {
	const char = nft.character;
	const tokenId = nft.tokenId;

	// Copy image
	const srcImage = join(OUTPUT_PATH, "images", `${tokenId}.png`);
	const destImage = join(OUTPUT_PATH, char, "images", `${tokenId}.png`);
	copyFileSync(srcImage, destImage);

	// Copy metadata
	const srcMeta = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
	const destMeta = join(OUTPUT_PATH, char, "metadata", `${tokenId}.json`);
	copyFileSync(srcMeta, destMeta);
}

// Save per-character collection.json
for (const [char, nfts] of Object.entries(byCharacter)) {
	const charCollectionPath = join(OUTPUT_PATH, char, "collection.json");
	writeFileSync(charCollectionPath, JSON.stringify(nfts, null, 2));
	console.log(`${char}: ${nfts.length} NFTs`);
}

console.log("\nFiles organized into character folders.");
