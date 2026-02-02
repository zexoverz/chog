import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { type CharacterType, COLOR_MATCHING_COMMON } from "./config";

const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");
const OUTPUT_PATH = join(import.meta.dir, "../../output/side_hand_acc_test");
const IMAGE_SIZE = 2048;

const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

async function generateTestImages() {
	// Create output directories
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char), { recursive: true });
	}

	console.log("=== Testing Side Hand + Accessories Compatibility ===\n");

	// Get all side hand accessories
	const accDir = join(ASSETS_PATH, "side_hand_accessories");
	const accessories = readdirSync(accDir).filter((f) => f.endsWith(".png"));

	console.log(`Found ${accessories.length} side hand accessories\n`);

	for (const char of characters) {
		console.log(`\n--- ${char.toUpperCase()} ---`);

		const baseDir = join(ASSETS_PATH, `base_${char}`);
		const sideHandDir = join(ASSETS_PATH, `side_hand_${char}`);

		// Pick first base for testing
		const baseFiles = readdirSync(baseDir).filter((f) => f.endsWith(".png"));
		const testBase = baseFiles[0];
		const colorMapping = COLOR_MATCHING_COMMON[char][testBase];

		if (!colorMapping) {
			console.log(`  ⚠️ No mapping for ${testBase}`);
			continue;
		}

		const basePath = join(baseDir, testBase);
		const sideHandPath = join(sideHandDir, colorMapping.side_hand);

		// Load base and side_hand
		const baseBuffer = await sharp(basePath)
			.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
			.png()
			.toBuffer();

		const sideHandBuffer = await sharp(sideHandPath)
			.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
			.png()
			.toBuffer();

		// Test each accessory
		for (const acc of accessories) {
			const accPath = join(accDir, acc);

			const accBuffer = await sharp(accPath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const outputName = `${testBase.replace(".png", "")}_${acc}`;
			const outputPath = join(OUTPUT_PATH, char, outputName);

			await sharp(baseBuffer)
				.composite([
					{ input: accBuffer, top: 0, left: 0 },
					{ input: sideHandBuffer, top: 0, left: 0 },
				])
				.png()
				.toFile(outputPath);
		}

		console.log(
			`  ✓ Generated ${accessories.length} images with ${testBase} + ${colorMapping.side_hand}`,
		);
	}

	console.log(`\n✅ Test images saved to: output/side_hand_acc_test/`);
	console.log(
		`   Check each character folder to verify accessory positioning.`,
	);
}

generateTestImages().catch(console.error);
