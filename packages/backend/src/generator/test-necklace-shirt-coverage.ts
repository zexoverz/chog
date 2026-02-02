import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");
const OUTPUT_PATH = join(import.meta.dir, "../../output/necklace_shirt_test");
const IMAGE_SIZE = 2048;

async function generateNecklaceShirtTest() {
	console.log("=== Testing Necklace + Shirt Compatibility ===\n");

	// Create output directories
	mkdirSync(OUTPUT_PATH, { recursive: true });

	// Get all necklaces
	const necklacesDir = join(ASSETS_PATH, "necklaces");
	const necklaces = readdirSync(necklacesDir).filter((f) => f.endsWith(".png"));
	console.log(`Found ${necklaces.length} necklaces\n`);

	// Get shirts from bear/bunny/fox (shared)
	const shirtDir = join(ASSETS_PATH, "shirt_bear_bunny_fox");
	const shirts = readdirSync(shirtDir).filter((f) => f.endsWith(".png"));
	console.log(`Found ${shirts.length} shirts (bear/bunny/fox)\n`);

	// Use bear as test character
	const baseDir = join(ASSETS_PATH, "base_bear");
	const testBase = "brown.png";
	const basePath = join(baseDir, testBase);

	// Get a sample of shirts to test (hoodies, jackets, full coverage shirts)
	// We'll test all necklaces against a subset of shirts
	const testShirts = shirts.slice(0, 20); // First 20 shirts

	let count = 0;
	for (const necklace of necklaces) {
		const necklaceFolder = join(OUTPUT_PATH, necklace.replace(".png", ""));
		mkdirSync(necklaceFolder, { recursive: true });

		console.log(`Testing necklace: ${necklace}`);

		for (const shirt of testShirts) {
			const necklacePath = join(necklacesDir, necklace);
			const shirtPath = join(shirtDir, shirt);

			// Load and resize layers
			const baseBuffer = await sharp(basePath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const shirtBuffer = await sharp(shirtPath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const necklaceBuffer = await sharp(necklacePath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			// Composite: base -> shirt -> necklace
			const outputPath = join(
				necklaceFolder,
				`${shirt.replace(".png", "")}_${necklace}`,
			);

			await sharp(baseBuffer)
				.composite([
					{ input: shirtBuffer, top: 0, left: 0 },
					{ input: necklaceBuffer, top: 0, left: 0 },
				])
				.png()
				.toFile(outputPath);

			count++;
		}
	}

	console.log(`\n=== Complete ===`);
	console.log(`Generated ${count} test images`);
	console.log(`Output: ${OUTPUT_PATH}`);
	console.log(
		`\nCheck each necklace folder to identify incompatible shirt combinations.`,
	);
}

generateNecklaceShirtTest().catch(console.error);
