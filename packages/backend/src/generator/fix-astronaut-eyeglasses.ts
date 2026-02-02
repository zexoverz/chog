import { join } from "node:path";
import sharp from "sharp";
import { LAYER_ORDER_COMMON, LAYER_OFFSETS, type CharacterType, type NFTMetadata } from "./config";
import { getTraitPath } from "./traits";

const OUTPUT_PATH = join(import.meta.dir, "../../output/common");
const IMAGE_SIZE = 2048;

// Violated NFT token IDs (astronauts with eyeglasses)
const VIOLATED_IDS = [
	268, 436, 599, 602, 768, 829, 891, 923, 943, 944,
	1036, 1044, 1077, 1160, 1366, 1609, 1797, 1865,
	2045, 2177, 3080, 3710, 3856, 3957,
	4129, 4229, 4566, 4956,
	5004, 5491, 5500, 5599, 5861
];

async function fixAstronautEyeglasses() {
	console.log(`=== Fixing ${VIOLATED_IDS.length} Astronaut NFTs with Eyeglasses ===\n`);

	for (const tokenId of VIOLATED_IDS) {
		// Read existing metadata
		const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
		const metadataFile = Bun.file(metadataPath);
		const metadata: NFTMetadata = await metadataFile.json();

		// Remove eyeglasses from attributes
		const originalAttributes = metadata.attributes;
		metadata.attributes = metadata.attributes.filter(attr => attr.trait_type !== "Eyeglasses");

		// Remove eyeglasses from traits
		metadata.traits = metadata.traits.filter(trait => trait.layer !== "eyeglasses");

		// Save updated metadata
		await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

		// Regenerate image without eyeglasses
		await regenerateImage(metadata, tokenId);

		const removedGlasses = originalAttributes.find(a => a.trait_type === "Eyeglasses")?.value || "unknown";
		console.log(`  ✓ Fixed #${tokenId} (${metadata.character}) - removed ${removedGlasses}`);
	}

	console.log(`\n=== Complete ===`);
	console.log(`Fixed ${VIOLATED_IDS.length} NFTs`);
}

async function regenerateImage(metadata: NFTMetadata, tokenId: number): Promise<void> {
	const character = metadata.character as CharacterType;
	const layers: Array<{ path: string; layer: string }> = [];

	for (const layer of LAYER_ORDER_COMMON) {
		// Find trait for this layer
		const trait = metadata.traits.find(t => t.layer === layer);
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

	let composite = sharp(baseLayer.path).resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" });

	if (resizedOverlays.length > 0) {
		composite = composite.composite(
			resizedOverlays.map(({ buffer, layer }) => {
				const offset = (LAYER_OFFSETS as Record<string, { top: number; left: number }>)[layer] || { top: 0, left: 0 };
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

fixAstronautEyeglasses().catch(console.error);
