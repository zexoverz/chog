import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { type CharacterType, COLOR_MATCHING_COMMON } from "./config";

const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");
const OUTPUT_PATH = join(import.meta.dir, "../../output/common_test");
const IMAGE_SIZE = 2048;

const characters: CharacterType[] = ["bear", "bunny", "fox", "chogstar"];

async function generateTestImages() {
	// Create output directories
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char), { recursive: true });
	}

	console.log(
		"=== Generating Common Base + Hand + Side Hand Test Images ===\n",
	);

	for (const char of characters) {
		console.log(`\n--- ${char.toUpperCase()} ---`);

		const baseDir = join(ASSETS_PATH, `base_${char}`);
		const handDir = join(ASSETS_PATH, `hand_${char}`);
		const sideHandDir = join(ASSETS_PATH, `side_hand_${char}`);
		const baseFiles = readdirSync(baseDir).filter((f) => f.endsWith(".png"));

		for (const baseFile of baseFiles) {
			const colorMapping = COLOR_MATCHING_COMMON[char][baseFile];
			if (!colorMapping) {
				console.log(`  ⚠️ No mapping for ${baseFile}`);
				continue;
			}

			const basePath = join(baseDir, baseFile);
			const handPath = join(handDir, colorMapping.hand);
			const sideHandPath = join(sideHandDir, colorMapping.side_hand);

			// Composite base + hand + side_hand
			const baseBuffer = await sharp(basePath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const handBuffer = await sharp(handPath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const sideHandBuffer = await sharp(sideHandPath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const outputName = baseFile.replace(".png", `_hands.png`);
			const outputPath = join(OUTPUT_PATH, char, outputName);

			await sharp(baseBuffer)
				.composite([
					{ input: handBuffer, top: 0, left: 0 },
					{ input: sideHandBuffer, top: 0, left: 0 },
				])
				.png()
				.toFile(outputPath);

			console.log(
				`  ✓ ${baseFile} + ${colorMapping.hand} + ${colorMapping.side_hand}`,
			);
		}
	}

	console.log(`\n✅ Test images saved to: output/common_test/`);
}

generateTestImages().catch(console.error);
