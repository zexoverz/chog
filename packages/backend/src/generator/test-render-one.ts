import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");
const LEGENDARY_PATH = join(import.meta.dir, "../../assets/art/legendary");
const OUTPUT_PATH = join(import.meta.dir, "../../output/test_render");

const LAYER_ORDER = [
	"background",
	"base",
	"clothes",
	"necklaces",
	"mouth",
	"eyes",
	"eyeglasses",
	"head_acc",
	"hand",
	"hand_accessories",
	"side_hand",
	"side_hand_accessories",
];

function toFileName(traitName: string): string {
	return traitName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

async function testRender() {
	// Token 5850 metadata
	const metadata = {
		character: "bear",
		attributes: [
			{ trait_type: "Background", value: "Background Lensflare" },
			{ trait_type: "Base", value: "Mustard" },
			{ trait_type: "Shirt", value: "Black Hoodie" },
			{ trait_type: "Mouth", value: "Small" },
			{ trait_type: "Eyes", value: "Smoke" },
			{ trait_type: "Hand Accessories", value: "Golden Ak47" },
			{ trait_type: "Side Hand", value: "Mustard Yellow" },
		],
	};

	const character = metadata.character;
	const shirtFolder = "shirt_bear_bunny_fox";
	const headAccFolder = "head_acc_bear_bunny_fox";

	const layers: { path: string; zIndex: number; name: string }[] = [];

	for (const attr of metadata.attributes) {
		const traitType = attr.trait_type;
		const value = attr.value;

		if (!value) continue;

		let layerPath: string | null = null;
		const fileName = `${toFileName(value)}.png`;

		// Define folders to check for each trait type
		const folderMap: Record<string, string[]> = {
			Background: ["background"],
			Base: [`base_${character}`],
			Shirt: [shirtFolder],
			Necklace: ["necklaces"],
			Mouth: ["mouth"],
			Eyes: ["eyes"],
			Eyeglasses: ["eyeglasses"],
			"Head Accessory": [headAccFolder],
			Hand: [`hand_${character}`],
			"Hand Accessories": ["hand_accessories", "side_hand_accessories"],
			"Side Hand": [`side_hand_${character}`],
		};

		// Legendary folders to also check
		const legendaryFolderMap: Record<string, string[]> = {
			Background: ["background"],
			Shirt: ["clothes"],
			Eyes: ["eyes"],
			"Hand Accessories": [
				"hand_accessories_gold",
				"side_hand_accessories_gold",
			],
		};

		const folders = folderMap[traitType] || [];

		// First check traits folders
		for (const folder of folders) {
			const testPath = join(ASSETS_PATH, folder, fileName);
			if (existsSync(testPath)) {
				layerPath = testPath;
				console.log(`Found ${traitType} "${value}" at: ${folder}/${fileName}`);
				break;
			}
		}

		// Then check legendary folders
		if (!layerPath) {
			const legendaryFolders = legendaryFolderMap[traitType] || [];
			for (const folder of legendaryFolders) {
				const testPath = join(LEGENDARY_PATH, folder, fileName);
				if (existsSync(testPath)) {
					layerPath = testPath;
					console.log(
						`Found ${traitType} "${value}" at: legendary/${folder}/${fileName}`,
					);
					break;
				}
			}
		}

		if (!layerPath) {
			console.log(`NOT FOUND: ${traitType} "${value}" (tried: ${fileName})`);
			continue;
		}

		const layerName = traitType.toLowerCase().replace(/ /g, "_");
		const zIndex = LAYER_ORDER.indexOf(
			layerName === "shirt"
				? "clothes"
				: layerName === "necklace"
					? "necklaces"
					: layerName === "head_accessory"
						? "head_acc"
						: layerName === "hand_accessories"
							? "hand_accessories"
							: // Render BEFORE side_hand
								layerName,
		);
		layers.push({
			path: layerPath,
			zIndex: zIndex >= 0 ? zIndex : 99,
			name: traitType,
		});
	}

	console.log("\nLayers to render (in order):");
	layers.sort((a, b) => a.zIndex - b.zIndex);
	for (const l of layers) {
		console.log(`  ${l.zIndex}: ${l.name}`);
	}

	// Composite image
	mkdirSync(OUTPUT_PATH, { recursive: true });
	const outputPath = join(OUTPUT_PATH, "5850_test.png");

	let composite = sharp(layers[0].path);
	if (layers.length > 1) {
		const overlays = await Promise.all(
			layers.slice(1).map(async (layer) => ({
				input: await sharp(layer.path).toBuffer(),
			})),
		);
		composite = composite.composite(overlays);
	}

	await composite.png().toFile(outputPath);
	console.log(`\nRendered to: ${outputPath}`);
}

testRender().catch(console.error);
