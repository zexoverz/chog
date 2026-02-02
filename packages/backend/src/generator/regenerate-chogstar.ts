import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { NFTMetadata } from "./config";
import { generateImage } from "./image";
import { generateMetadata } from "./metadata";
import { SeededRandom, selectTraitsForNFT } from "./random";
import { loadTraitDatabase } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output");

async function regenerateChogstars() {
	// Load chogstar collection
	const chogstarCollection: NFTMetadata[] = JSON.parse(
		readFileSync(join(OUTPUT_PATH, "chogstar/collection.json"), "utf-8"),
	);

	// Load full collection
	const fullCollection: NFTMetadata[] = JSON.parse(
		readFileSync(join(OUTPUT_PATH, "collection.json"), "utf-8"),
	);

	console.log(`Found ${chogstarCollection.length} chogstar NFTs`);

	// Pick first 30 to regenerate with illuminate base
	const toRegenerate = chogstarCollection.slice(0, 30);

	console.log(
		`Regenerating ${toRegenerate.length} chogstars with illuminate base...`,
	);

	// Load trait database
	const traitDb = await loadTraitDatabase();

	for (const nft of toRegenerate) {
		const tokenId = nft.tokenId;
		console.log(`  Regenerating token ${tokenId}...`);

		// Create RNG with token ID as seed
		const rng = new SeededRandom(tokenId * 1000);

		// Generate new traits with forced illuminate base
		const selection = selectTraitsForNFT(
			traitDb,
			"chogstar",
			"legendary",
			rng,
			"illuminate_chogstars.png", // Force illuminate base
		);

		// Generate image (returns output path)
		await generateImage(selection, tokenId);

		// Copy to chogstar folder
		const srcImage = join(OUTPUT_PATH, "images", `${tokenId}.png`);
		const destImage = join(OUTPUT_PATH, "chogstar/images", `${tokenId}.png`);
		copyFileSync(srcImage, destImage);

		// Generate metadata
		const metadata = generateMetadata(selection, tokenId, "ipfs://");

		// Save metadata
		const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
		const chogstarMetadataPath = join(
			OUTPUT_PATH,
			"chogstar/metadata",
			`${tokenId}.json`,
		);

		// Clean metadata for public use
		const cleanMetadata = {
			name: metadata.name,
			description: metadata.description,
			image: metadata.image,
			attributes: metadata.attributes,
		};

		writeFileSync(metadataPath, JSON.stringify(cleanMetadata, null, 2));
		writeFileSync(chogstarMetadataPath, JSON.stringify(cleanMetadata, null, 2));

		// Update in collections
		const fullIndex = fullCollection.findIndex((n) => n.tokenId === tokenId);
		if (fullIndex !== -1) {
			fullCollection[fullIndex] = metadata;
		}

		const chogstarIndex = chogstarCollection.findIndex(
			(n) => n.tokenId === tokenId,
		);
		if (chogstarIndex !== -1) {
			chogstarCollection[chogstarIndex] = metadata;
		}
	}

	// Save updated collections
	writeFileSync(
		join(OUTPUT_PATH, "collection.json"),
		JSON.stringify(fullCollection, null, 2),
	);
	writeFileSync(
		join(OUTPUT_PATH, "chogstar/collection.json"),
		JSON.stringify(chogstarCollection, null, 2),
	);

	console.log("\nDone! Regenerated 30 chogstars with illuminate base.");
}

regenerateChogstars().catch(console.error);
