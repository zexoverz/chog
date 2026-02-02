import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { loadTraitDatabase, getTraitPath } from "./traits";
import { SeededRandom, selectTraitsForNFT } from "./random";
import { generateMetadata } from "./metadata";
import { LAYER_ORDER_COMMON, LAYER_OFFSETS, type CharacterType, type LayerType } from "./config";

const OUTPUT_PATH = join(import.meta.dir, "../../output/legendary_accessories_test");
const IMAGE_SIZE = 2048;
const SEED = 99999;

// These are now in hand_accessories_gold folder
const LEGENDARY_HAND_ACCESSORIES = ["golden_axe.png", "golden_lunarstaff.png", "golden_sword.png", "golden_gun.png", "golden_pistol.png", "golden_popsicle.png"];

async function generateLegendaryAccessoriesTest() {
	console.log("=== Testing Legendary Hand Accessories ===\n");

	// Load trait database
	const db = await loadTraitDatabase();

	// Create output directories
	mkdirSync(join(OUTPUT_PATH, "images"), { recursive: true });
	mkdirSync(join(OUTPUT_PATH, "metadata"), { recursive: true });

	const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];
	let tokenId = 1;

	// Generate one NFT per character per accessory
	for (const accessory of LEGENDARY_HAND_ACCESSORIES) {
		console.log(`\n--- ${accessory} ---`);

		for (const character of characters) {
			// Keep trying until we get a good selection
			let attempts = 0;
			let success = false;

			while (!success && attempts < 100) {
				const rng = new SeededRandom(SEED + tokenId * 100 + attempts);

				// Create selection with legendary inheritance
				const selection = selectTraitsForNFT(db, character, "common", rng, undefined, true);

				// Get legendary hand_accessories from db
				const legendaryHandAcc = db.legendary.shared.get("hand_accessories") || [];
				const targetAccessory = legendaryHandAcc.find(t => t.filename === accessory);

				if (targetAccessory) {
					// Force the specific legendary hand accessory
					selection.traits.set("hand_accessories", targetAccessory);

					// Clear side_hand and side_hand_accessories (only one accessory type per NFT)
					selection.traits.set("side_hand", null);
					selection.traits.set("side_hand_accessories", null);

					// Ensure hand is present (color-matched to base)
					const baseTrait = selection.traits.get("base");
					if (baseTrait) {
						const { COLOR_MATCHING_COMMON } = await import("./config");
						const colorMatch = COLOR_MATCHING_COMMON[character]?.[baseTrait.filename];
						if (colorMatch) {
							const handTraits = db.common.characters.get(character)?.get("hand") || [];
							const matchedHand = handTraits.find(t => t.filename === colorMatch.hand);
							if (matchedHand) {
								selection.traits.set("hand", matchedHand);
							}
						}
					}

					success = true;

					// Generate image
					await generateImage(selection, tokenId, accessory, character);

					// Generate metadata
					const metadata = generateMetadata(selection, tokenId, "ipfs://test/");
					const metadataPath = join(OUTPUT_PATH, "metadata", `${tokenId}.json`);
					await Bun.write(metadataPath, JSON.stringify(metadata, null, 2));

					console.log(`  ✓ Token ${tokenId}: ${character} with ${accessory}`);
					tokenId++;
				}

				attempts++;
			}

			if (!success) {
				console.log(`  ✗ Failed to generate ${character} with ${accessory}`);
			}
		}
	}

	console.log(`\n=== Complete ===`);
	console.log(`Generated ${tokenId - 1} NFTs with legendary hand accessories`);
	console.log(`Output: ${OUTPUT_PATH}`);
}

async function generateImage(
	selection: ReturnType<typeof selectTraitsForNFT>,
	tokenId: number,
	accessoryName: string,
	character: CharacterType,
): Promise<void> {
	const layers: Array<{ path: string; layer: string }> = [];

	console.log(`\n  Token ${tokenId} (${character}) - ${accessoryName}:`);

	for (const layer of LAYER_ORDER_COMMON) {
		const trait = selection.traits.get(layer);
		if (!trait) continue;

		const path = getTraitPath(character, layer, trait.filename, trait.rarity);
		const legendaryTag = trait.rarity === "legendary" ? " [L]" : "";
		console.log(`    ${layer}: ${trait.filename}${legendaryTag}`);
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

	const imgPath = join(OUTPUT_PATH, "images", `${tokenId}_${character}_${accessoryName}`);
	await composite.png({ quality: 90 }).toFile(imgPath);
}

generateLegendaryAccessoriesTest().catch(console.error);
