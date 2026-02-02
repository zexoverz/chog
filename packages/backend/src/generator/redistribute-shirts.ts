import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const COMMON_PATH = join(import.meta.dir, "../../output/common");
const OUTPUT_PATH = join(import.meta.dir, "../../output/common_redistributed");
const ASSETS_PATH = join(import.meta.dir, "../../assets/art/traits");

const characters = ["bear", "bunny", "fox", "chogstar"] as const;

const LEGENDARY_SHIRTS = [
	"Outfit Cutegoldenstar",
	"Outfit Shark",
	"Outfit Cutestar",
	"Outfit Greenfrog",
	"Outfit Line",
	"Outfit Goldensweater",
	"Outfit Dino",
];

const MIN_TARGET = 40;

// Layer order for image compositing
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

interface NFTInfo {
	tokenId: string;
	character: string;
	shirtName: string;
	metadata: any;
	metadataPath: string;
	imagePath: string;
}

function toFileName(traitName: string): string {
	return traitName
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "_")
		.replace(/_+/g, "_")
		.replace(/^_|_$/g, "");
}

async function _findShirtAsset(shirtName: string): Promise<string | null> {
	const fileName = `${toFileName(shirtName)}.png`;
	const clothesPath = join(ASSETS_PATH, "clothes", fileName);
	if (existsSync(clothesPath)) return clothesPath;

	// Try alternate naming
	const altPath = join(ASSETS_PATH, "clothes");
	if (existsSync(altPath)) {
		const files = readdirSync(altPath);
		for (const file of files) {
			if (file.toLowerCase().includes(toFileName(shirtName))) {
				return join(altPath, file);
			}
		}
	}
	return null;
}

async function regenerateImage(
	metadata: any,
	character: string,
	outputImagePath: string,
) {
	const layers: { path: string; zIndex: number }[] = [];

	for (const attr of metadata.attributes) {
		const traitType = attr.trait_type;
		const value = attr.value;

		if (traitType === "Rarity" || traitType === "Character" || !value) continue;

		let layerPath: string | null = null;
		const fileName = `${toFileName(value)}.png`;

		// Map trait types to folder names (character-specific folders)
		const shirtFolder =
			character === "chogstar" ? "shirt_chogstar" : "shirt_bear_bunny_fox";
		const headAccFolder =
			character === "chogstar"
				? "head_acc_chogstar"
				: "head_acc_bear_bunny_fox";

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
			"Hand Accessories": ["hand_accessories"],
			"Side Hand": [`side_hand_${character}`],
			"Side Hand Accessories": ["side_hand_accessories"],
		};

		const folders = folderMap[traitType] || [
			traitType.toLowerCase().replace(/ /g, "_"),
		];

		for (const folder of folders) {
			const testPath = join(ASSETS_PATH, folder, fileName);
			if (existsSync(testPath)) {
				layerPath = testPath;
				break;
			}
			// Try legendary folder for inherited traits
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

		if (layerPath) {
			const layerName = traitType.toLowerCase().replace(/ /g, "_");
			const zIndex = LAYER_ORDER.indexOf(
				layerName === "shirt"
					? "clothes"
					: layerName === "necklace"
						? "necklaces"
						: layerName === "head_accessory"
							? "head_acc"
							: layerName,
			);
			layers.push({ path: layerPath, zIndex: zIndex >= 0 ? zIndex : 99 });
		}
	}

	// Sort by z-index
	layers.sort((a, b) => a.zIndex - b.zIndex);

	if (layers.length === 0) {
		console.log("  Warning: No layers found for regeneration");
		return;
	}

	// Composite image
	let composite = sharp(layers[0].path);

	if (layers.length > 1) {
		const overlays = await Promise.all(
			layers.slice(1).map(async (layer) => ({
				input: await sharp(layer.path).toBuffer(),
			})),
		);
		composite = composite.composite(overlays);
	}

	await composite.png().toFile(outputImagePath);
}

async function redistributeShirts() {
	console.log("=== SHIRT REDISTRIBUTION ===\n");

	// Step 1: Collect all NFT info
	const allNFTs: NFTInfo[] = [];
	const shirtCounts: Record<string, number> = {};

	for (const char of characters) {
		const metadataPath = join(COMMON_PATH, char, "metadata");
		if (!existsSync(metadataPath)) continue;

		const files = readdirSync(metadataPath).filter((f) => f.endsWith(".json"));

		for (const file of files) {
			const fullPath = join(metadataPath, file);
			const metadata = await Bun.file(fullPath).json();
			const shirtAttr = metadata.attributes.find(
				(a: any) => a.trait_type === "Shirt",
			);
			const shirtName = shirtAttr?.value || "None";

			allNFTs.push({
				tokenId: file.replace(".json", ""),
				character: char,
				shirtName,
				metadata,
				metadataPath: fullPath,
				imagePath: join(
					COMMON_PATH,
					char,
					"images",
					file.replace(".json", ".png"),
				),
			});

			shirtCounts[shirtName] = (shirtCounts[shirtName] || 0) + 1;
		}
	}

	console.log(`Total NFTs: ${allNFTs.length}`);

	// Step 2: Identify shirts that need more and shirts that can give
	const needMore: { name: string; current: number; needed: number }[] = [];
	const canGive: { name: string; current: number; excess: number }[] = [];

	for (const [name, count] of Object.entries(shirtCounts)) {
		if (LEGENDARY_SHIRTS.some((l) => l.toLowerCase() === name.toLowerCase()))
			continue;
		if (name === "None") continue;

		if (count < MIN_TARGET) {
			needMore.push({ name, current: count, needed: MIN_TARGET - count });
		} else if (count > MIN_TARGET) {
			canGive.push({ name, current: count, excess: count - MIN_TARGET });
		}
	}

	// Sort: need more by most needed first, can give by most excess first
	needMore.sort((a, b) => b.needed - a.needed);
	canGive.sort((a, b) => b.excess - a.excess);

	const totalNeeded = needMore.reduce((sum, s) => sum + s.needed, 0);
	const totalExcess = canGive.reduce((sum, s) => sum + s.excess, 0);

	console.log(
		`\nShirts needing boost: ${needMore.length} types, total +${totalNeeded}`,
	);
	console.log(
		`Shirts with excess: ${canGive.length} types, total -${totalExcess}`,
	);

	if (totalExcess < totalNeeded) {
		console.log("\nERROR: Not enough excess to redistribute!");
		return;
	}

	// Step 3: Create redistribution plan
	const changes: { nft: NFTInfo; newShirt: string }[] = [];
	const newShirtCounts = { ...shirtCounts };

	for (const target of needMore) {
		let stillNeeded = target.needed;

		for (const source of canGive) {
			if (stillNeeded <= 0) break;

			const available = newShirtCounts[source.name] - MIN_TARGET;
			if (available <= 0) continue;

			const toTake = Math.min(stillNeeded, available);

			// Find NFTs with this shirt to change
			const nftsWithShirt = allNFTs.filter(
				(n) =>
					n.shirtName === source.name &&
					!changes.some((c) => c.nft.tokenId === n.tokenId),
			);

			for (let i = 0; i < toTake && i < nftsWithShirt.length; i++) {
				changes.push({ nft: nftsWithShirt[i], newShirt: target.name });
				newShirtCounts[source.name]--;
				newShirtCounts[target.name]++;
				stillNeeded--;
			}
		}
	}

	console.log(`\nPlanned changes: ${changes.length} NFTs`);

	// Step 4: Create output directory structure
	console.log("\nCreating output directories...");
	for (const char of characters) {
		mkdirSync(join(OUTPUT_PATH, char, "metadata"), { recursive: true });
		mkdirSync(join(OUTPUT_PATH, char, "images"), { recursive: true });
	}

	// Step 5: Apply changes
	console.log("\nApplying changes...\n");

	let processed = 0;
	for (const change of changes) {
		const { nft, newShirt } = change;

		// Update metadata
		const newMetadata = JSON.parse(JSON.stringify(nft.metadata));
		const shirtAttr = newMetadata.attributes.find(
			(a: any) => a.trait_type === "Shirt",
		);
		if (shirtAttr) {
			shirtAttr.value = newShirt;
		}

		// Save metadata
		const newMetadataPath = join(
			OUTPUT_PATH,
			nft.character,
			"metadata",
			`${nft.tokenId}.json`,
		);
		writeFileSync(newMetadataPath, JSON.stringify(newMetadata, null, 2));

		// Regenerate image
		const newImagePath = join(
			OUTPUT_PATH,
			nft.character,
			"images",
			`${nft.tokenId}.png`,
		);
		await regenerateImage(newMetadata, nft.character, newImagePath);

		processed++;
		if (processed % 50 === 0 || processed === changes.length) {
			console.log(
				`  Processed ${processed}/${changes.length} (${((processed / changes.length) * 100).toFixed(1)}%)`,
			);
		}
	}

	// Step 6: Save change log
	const changeLog = changes.map((c) => ({
		tokenId: c.nft.tokenId,
		character: c.nft.character,
		oldShirt: c.nft.shirtName,
		newShirt: c.newShirt,
	}));

	writeFileSync(
		join(OUTPUT_PATH, "redistribution_log.json"),
		JSON.stringify(changeLog, null, 2),
	);

	console.log(`\n=== COMPLETE ===`);
	console.log(`Modified NFTs saved to: ${OUTPUT_PATH}`);
	console.log(`Change log: ${join(OUTPUT_PATH, "redistribution_log.json")}`);
	console.log(`\nNext steps:`);
	console.log(`1. Review the changes in output/common_redistributed/`);
	console.log(`2. Copy the modified files to replace originals when ready`);
}

redistributeShirts().catch(console.error);
