import { mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ASSETS_PATH_COMMON = join(import.meta.dir, "../../assets/art/traits");
const ASSETS_PATH_LEGENDARY = join(
	import.meta.dir,
	"../../assets/art/legendary",
);
const OUTPUT_PATH = join(
	import.meta.dir,
	"../../output/necklace_legendary_clothes_test",
);
const IMAGE_SIZE = 2048;

async function generateNecklaceLegendaryClothesTest() {
	console.log("=== Testing Necklace + Legendary Clothes Compatibility ===\n");

	// Create output directory
	mkdirSync(OUTPUT_PATH, { recursive: true });

	// Get all necklaces
	const necklacesDir = join(ASSETS_PATH_COMMON, "necklaces");
	const necklaces = readdirSync(necklacesDir).filter((f) => f.endsWith(".png"));
	console.log(`Found ${necklaces.length} necklaces\n`);

	// Get legendary clothes
	const clothesDir = join(ASSETS_PATH_LEGENDARY, "clothes");
	const clothes = readdirSync(clothesDir).filter((f) => f.endsWith(".png"));
	console.log(`Found ${clothes.length} legendary clothes\n`);

	// Use bear common base
	const baseDir = join(ASSETS_PATH_COMMON, "base_bear");
	const testBase = "brown.png";
	const basePath = join(baseDir, testBase);

	let count = 0;

	// Test first 3 necklaces with all legendary clothes
	const testNecklaces = necklaces.slice(0, 3);

	for (const clothe of clothes) {
		console.log(`Testing legendary clothes: ${clothe}`);

		for (const necklace of testNecklaces) {
			const necklacePath = join(necklacesDir, necklace);
			const clothesPath = join(clothesDir, clothe);

			const baseBuffer = await sharp(basePath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const clothesBuffer = await sharp(clothesPath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const necklaceBuffer = await sharp(necklacePath)
				.resize(IMAGE_SIZE, IMAGE_SIZE, { fit: "fill" })
				.png()
				.toBuffer();

			const outputPath = join(
				OUTPUT_PATH,
				`${clothe.replace(".png", "")}_${necklace}`,
			);

			await sharp(baseBuffer)
				.composite([
					{ input: clothesBuffer, top: 0, left: 0 },
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
}

generateNecklaceLegendaryClothesTest().catch(console.error);
