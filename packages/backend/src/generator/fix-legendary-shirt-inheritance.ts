import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const COMMON_PATH = join(import.meta.dir, "../../output/common");
const OUTPUT_PATH = join(
	import.meta.dir,
	"../../output/common_fix_legendary_shirts",
);
const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");

const characters = ["bear", "bunny", "fox", "chogstar"] as const;
type CharacterType = (typeof characters)[number];

const LEGENDARY_SHIRTS = [
	"Outfit Cutegoldenstar",
	"Outfit Shark",
	"Outfit Cutestar",
	"Outfit Greenfrog",
	"Outfit Line",
	"Outfit Goldensweater",
	"Outfit Dino",
];

// High-count common shirts to use as replacements (these won't become rare)
const REPLACEMENT_SHIRTS: Record<string, string[]> = {
	chogstar: ["Chogstar", "Black Chogstar", "Khaki", "Baddie", "Beige Fur"],
	bearBunnyFox: [
		"Chogstar",
		"Astronaut",
		"Black Hoodie",
		"Monad",
		"Self Love Club",
	],
};

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

function getShirtFolder(character: CharacterType): string {
	return character === "chogstar" ? "shirt_chogstar" : "shirt_bear_bunny_fox";
}

async function regenerateImage(
	metadata: any,
	character: CharacterType,
	outputImagePath: string,
) {
	const layers: { path: string; zIndex: number }[] = [];
	const shirtFolder = getShirtFolder(character);
	const headAccFolder =
		character === "chogstar" ? "head_acc_chogstar" : "head_acc_bear_bunny_fox";

	for (const attr of metadata.attributes) {
		const traitType = attr.trait_type;
		const value = attr.value;
		if (traitType === "Rarity" || traitType === "Character" || !value) continue;

		let layerPath: string | null = null;
		const fileName = `${toFileName(value)}.png`;

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
			"Hand Accessories": ["hand_accessories", "side_hand_accessories"], // Check both folders
			"Side Hand": [`side_hand_${character}`],
			"Side Hand Accessories": ["side_hand_accessories"],
		};

		// Legendary folders have different names for some traits
		const legendaryFolderMap: Record<string, string[]> = {
			Background: ["background"],
			Shirt: ["clothes"],
			Eyes: ["eyes"],
			"Hand Accessories": [
				"hand_accessories_gold",
				"side_hand_accessories_gold",
			],
		};

		const folders = folderMap[traitType] || [
			traitType.toLowerCase().replace(/ /g, "_"),
		];
		const legendaryFolders = legendaryFolderMap[traitType] || folders;

		// First check traits folders
		for (const folder of folders) {
			const testPath = join(ASSETS_PATH, folder, fileName);
			if (existsSync(testPath)) {
				layerPath = testPath;
				break;
			}
		}

		// Then check legendary folders
		if (!layerPath) {
			for (const folder of legendaryFolders) {
				const legendaryPath = join(
					import.meta.dir,
					"../../assets/art/legendary",
					folder,
					fileName,
				);
				if (existsSync(legendaryPath)) {
					layerPath = legendaryPath;
					break;
				}
			}
		}

		if (layerPath) {
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
								: // Render BEFORE side_hand (hand holds the accessory)
									layerName,
			);
			layers.push({ path: layerPath, zIndex: zIndex >= 0 ? zIndex : 99 });
		}
	}

	layers.sort((a, b) => a.zIndex - b.zIndex);

	if (layers.length === 0) return;

	let composite = sharp(layers[0].path);
	if (layers.length > 1) {
		const overlays = await Promise.all(
			layers
				.slice(1)
				.map(async (layer) => ({ input: await sharp(layer.path).toBuffer() })),
		);
		composite = composite.composite(overlays);
	}

	await composite.png().toFile(outputImagePath);
}

async function fixLegendaryShirtInheritance() {
	console.log("=== FIX LEGENDARY SHIRT INHERITANCE ===\n");
	console.log("Goal: Keep only 1 of each legendary shirt in commons\n");

	// Find all common NFTs with legendary shirts
	const legendaryShirtNFTs: Record<
		string,
		{ tokenId: string; character: CharacterType }[]
	> = {};
	for (const shirt of LEGENDARY_SHIRTS) {
		legendaryShirtNFTs[shirt] = [];
	}

	for (const char of characters) {
		const metadataPath = join(COMMON_PATH, char, "metadata");
		if (!existsSync(metadataPath)) continue;
		const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));

		for (const file of files) {
			const metadata = await Bun.file(join(metadataPath, file)).json();
			const shirtAttr = metadata.attributes.find(
				(a: any) => a.trait_type === "Shirt",
			);

			if (shirtAttr) {
				const matchedShirt = LEGENDARY_SHIRTS.find(
					(l) => l.toLowerCase() === shirtAttr.value.toLowerCase(),
				);
				if (matchedShirt) {
					legendaryShirtNFTs[matchedShirt].push({
						tokenId: file.replace(".json", ""),
						character: char,
					});
				}
			}
		}
	}

	// Plan changes: keep first one of each, change the rest
	const changes: {
		tokenId: string;
		character: CharacterType;
		oldShirt: string;
		newShirt: string;
	}[] = [];
	let replacementIndex = 0;

	for (const [shirt, nfts] of Object.entries(legendaryShirtNFTs)) {
		console.log(`${shirt}: ${nfts.length} NFTs`);

		// Keep the first one
		if (nfts.length > 0) {
			console.log(`  Keeping: Token ${nfts[0].tokenId} (${nfts[0].character})`);
		}

		// Change the rest
		for (let i = 1; i < nfts.length; i++) {
			const nft = nfts[i];
			const isChogstar = nft.character === "chogstar";
			const replacements = isChogstar
				? REPLACEMENT_SHIRTS.chogstar
				: REPLACEMENT_SHIRTS.bearBunnyFox;
			const newShirt = replacements[replacementIndex % replacements.length];

			changes.push({
				tokenId: nft.tokenId,
				character: nft.character,
				oldShirt: shirt,
				newShirt,
			});

			console.log(
				`  Changing: Token ${nft.tokenId} (${nft.character}) -> ${newShirt}`,
			);
			replacementIndex++;
		}
	}

	console.log(`\nTotal NFTs to change: ${changes.length}\n`);

	// Create output directories
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
		mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
	}

	// Apply changes
	console.log("Applying changes...\n");

	for (const change of changes) {
		const metadataPath = join(
			COMMON_PATH,
			change.character,
			"metadata",
			`${change.tokenId}.json`,
		);
		const metadata = await Bun.file(metadataPath).json();

		// Update shirt
		const shirtAttr = metadata.attributes.find(
			(a: any) => a.trait_type === "Shirt",
		);
		if (shirtAttr) {
			shirtAttr.value = change.newShirt;
		}

		// Save metadata
		const newMetadataPath = join(
			OUTPUT_PATH,
			change.character,
			"metadata",
			`${change.tokenId}.json`,
		);
		writeFileSync(newMetadataPath, JSON.stringify(metadata, null, 2));

		// Regenerate image
		const newImagePath = join(
			OUTPUT_PATH,
			change.character,
			"images",
			`${change.tokenId}.png`,
		);
		await regenerateImage(metadata, change.character, newImagePath);

		console.log(
			`  Fixed Token ${change.tokenId}: ${change.oldShirt} -> ${change.newShirt}`,
		);
	}

	// Save change log
	writeFileSync(
		join(OUTPUT_PATH, "fix_log.json"),
		JSON.stringify(changes, null, 2),
	);

	console.log(`\n=== COMPLETE ===`);
	console.log(`Changed: ${changes.length} NFTs`);
	console.log(`Output: ${OUTPUT_PATH}`);
	console.log(
		`\nNew legendary shirt distribution in commons: 1 each (7 total)`,
	);
}

fixLegendaryShirtInheritance().catch(console.error);
